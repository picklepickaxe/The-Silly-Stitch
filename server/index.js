const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");



// ─── Firebase Admin init ────────────────────────────────────────
// The service account JSON is stored as a single env var on Render
// (FIREBASE_SERVICE_ACCOUNT), never committed to git. Locally, you
// can point this at your existing serviceAccountKey.json via a
// .env file (see server/.env.example).

//process.env -> render in this case because i deployed on render (waise, process is a part of node.js execution/ OS executing the node.js)
//environment variables are an operating-system/runtime concept, not a Render-specific concept
//index.js in itself is not a process. but, Node.js reads and executes index.js, and the resulting running application exists inside a Node.js process.
function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    //JSON.parse -> converts the string into javascript object
  }
  // Local dev fallback: require the file directly if present.
  // eslint-disable-next-line global-require
  return require("./serviceAccountKey.json");
}

//note: this firebase to node.js initialisation only needs to be done ONCE in the same node process, so we will not be doing this again in the bot/rag pipeline
admin.initializeApp({
  credential: admin.credential.cert(loadServiceAccount()),
});

const db = admin.firestore();

// ─── Metrics: timing + cold-start detection ──────────────────────
// Render's free tier actually kills the process on spin-down, so
// "first request since this process booted" IS a cold start, not
// just a guess based on idle time.
const SERVER_BOOT_TIME = Date.now();
let hasHandledFirstRequest = false;

function metricsMiddleware(req, res, next) {
  req._metricsStart = Date.now();
  req._isColdStart = !hasHandledFirstRequest;
  hasHandledFirstRequest = true;

  res.on("finish", () => {
    const durationMs = Date.now() - req._metricsStart;
    const entry = {
      route: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
      coldStart: req._isColdStart,
      timeSinceBootMs: Date.now() - SERVER_BOOT_TIME,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(
      `[metrics] ${req.method} ${req.originalUrl} → ${res.statusCode} in ${durationMs}ms${
        req._isColdStart ? "  (COLD START)" : ""
      }`
    );

    // Fire-and-forget: never block or slow down the actual response.
    db.collection("server_metrics")
      .add(entry)
      .catch((err) => console.error("[metrics] Firestore write failed:", err.message));
  });

  next();
}

app.use(metricsMiddleware);

// ─── Express setup ──────────────────────────────────────────────
const app = express();
app.use(express.json());

// Lock CORS to your real frontend origin(s) only.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://the-silly-stitch.vercel.app",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow tools like curl/Postman (no origin header) during testing.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

// ─── Constants (mirrors firestore.rules validation) ─────────────
const MAX_ITEMS = 50;
const MAX_QTY_PER_ITEM = 20; // enforced on the AGGREGATED quantity per productId, see below
const NAME_MAX = 128;
const EMAIL_MAX = 256;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/;

function generateOrderId() {
  const now = Date.now();
  const random = Math.floor(Math.random() * 900 + 100);
  return `ORD-${now}-${random}`;
}

// ─── Auth middleware ─────────────────────────────────────────────
// Verifies the Firebase ID token sent from the client in the
// Authorization header, replacing what onCall gave us for free.
async function requireRealUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: "Missing auth token." });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    if (decoded.firebase?.sign_in_provider === "anonymous") {
      return res.status(403).json({ error: "Please create an account to place an order." });
    }
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

// ─── Rate limiting ────────────────────────────────────────────────
// Runs AFTER requireRealUser so req.uid is available — keys by uid
// rather than IP, so it can't be sidestepped by rotating networks,
// and doesn't accidentally throttle a whole shared IP (e.g. campus
// wifi, a mobile carrier NAT) down to one person's allowance.
const placeOrderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // 5 orders per user per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.uid || req.ip,
  handler: (req, res) => {
    res.status(429).json({ error: "Too many orders placed. Please wait a moment and try again." });
  },
});

// ─── Route: place an order ───────────────────────────────────────
app.post("/placeOrder", requireRealUser, placeOrderLimiter, async (req, res) => {
  const timings = { start: Date.now() };

  try {
    const { items, customerName, email, phone } = req.body || {};

    // --- validate customer fields ---
    if (
      typeof customerName !== "string" ||
      customerName.trim().length < 2 ||
      customerName.trim().length > NAME_MAX
    ) {
      return res.status(400).json({ error: "Please provide a valid name." });
    }

    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    if (!EMAIL_RE.test(trimmedEmail) || trimmedEmail.length > EMAIL_MAX) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
    if (!PHONE_RE.test(trimmedPhone)) {
      return res.status(400).json({ error: "Please provide a valid 10-digit phone number." });
    }

    // --- validate items shape ---
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return res.status(400).json({ error: "Your cart is empty or has too many items." });
    }

    // --- aggregate quantities per product FIRST, then cap the total ---
    const quantityByProductId = new Map();
    for (const raw of items) {
      const productId = raw?.productId;
      const quantity = raw?.quantity;

      if (typeof productId !== "string" || productId.length === 0) {
        return res.status(400).json({ error: "Invalid item in cart." });
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: "Invalid quantity in cart." });
      }
      quantityByProductId.set(productId, (quantityByProductId.get(productId) || 0) + quantity);
    }

    for (const [, quantity] of quantityByProductId) {
      if (quantity > MAX_QTY_PER_ITEM) {
        return res.status(400).json({
          error: `You can order at most ${MAX_QTY_PER_ITEM} of a single item.`,
        });
      }
    }

    timings.afterValidation = Date.now();

    // --- resolve REAL prices/names from Firestore, never trust client ---
    const productIds = [...quantityByProductId.keys()];
    const productRefs = productIds.map((id) => db.collection("products").doc(id));
    const productSnaps = await db.getAll(...productRefs);

    timings.afterProductFetch = Date.now();

    const resolvedItems = [];
    let total = 0;

    for (let i = 0; i < productIds.length; i++) {
      const snap = productSnaps[i];
      const productId = productIds[i];

      if (!snap.exists) {
        return res.status(409).json({ error: "A product in your cart is no longer available." });
      }

      const product = snap.data();
      const price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(409).json({ error: "A product in your cart has an invalid price." });
      }

      const quantity = quantityByProductId.get(productId);
      total += price * quantity;

      resolvedItems.push({
        productId,
        name: product.name || "Item",
        price,
        quantity,
      });
    }

    if (total <= 0 || total >= 1000000) {
      return res.status(400).json({ error: "Order total is invalid." });
    }

    const orderId = generateOrderId();

    const orderPayload = {
      orderId,
      userId: req.uid,
      customerName: customerName.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,
      items: resolvedItems,
      total,
      status: "pending",
      whatsappConfirmed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("orders").add(orderPayload);

    timings.afterOrderWrite = Date.now();

    // Attach breakdown so metricsMiddleware can log/store it alongside this request
    req._breakdown = {
      validationMs: timings.afterValidation - timings.start,
      productFetchMs: timings.afterProductFetch - timings.afterValidation,
      orderWriteMs: timings.afterOrderWrite - timings.afterProductFetch,
      totalMs: timings.afterOrderWrite - timings.start,
    };

    return res.json({
      docId: docRef.id,
      orderId,
      total,
      items: resolvedItems,
      customerName: orderPayload.customerName,
      email: orderPayload.email,
      phone: orderPayload.phone,
    });
  } catch (err) {
    console.error("placeOrder error:", err);
    return res.status(500).json({ error: "Could not place order. Please try again." });
  }
});

// Simple health check so you (and Render) can confirm the service is alive.
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});