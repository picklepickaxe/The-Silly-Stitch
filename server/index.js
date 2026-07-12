const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// ─── Firebase Admin init ────────────────────────────────────────
// The service account JSON is stored as a single env var on Render
// (FIREBASE_SERVICE_ACCOUNT), never committed to git. Locally, you
// can point this at your existing serviceAccountKey.json via a
// .env file (see server/.env.example).
function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  // Local dev fallback: require the file directly if present.
  // eslint-disable-next-line global-require
  return require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(loadServiceAccount()),
});

const db = admin.firestore();

// ─── Express setup ──────────────────────────────────────────────
const app = express();
app.use(express.json());

// Lock CORS to your real frontend origin(s) only.
// Add your production domain once you have one; keep localhost for dev.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://the-silly-stitch.vercel.app", // TODO: replace with your real deployed frontend URL
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
const MAX_QTY_PER_ITEM = 20;
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

// ─── Route: place an order ───────────────────────────────────────
app.post("/placeOrder", requireRealUser, async (req, res) => {
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

    const quantityByProductId = new Map();
    for (const raw of items) {
      const productId = raw?.productId;
      const quantity = raw?.quantity;

      if (typeof productId !== "string" || productId.length === 0) {
        return res.status(400).json({ error: "Invalid item in cart." });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
        return res.status(400).json({ error: "Invalid quantity in cart." });
      }
      quantityByProductId.set(productId, (quantityByProductId.get(productId) || 0) + quantity);
    }

    // --- resolve REAL prices/names from Firestore, never trust client ---
    const productIds = [...quantityByProductId.keys()];
    const productRefs = productIds.map((id) => db.collection("products").doc(id));
    const productSnaps = await db.getAll(...productRefs);

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