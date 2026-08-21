// analyze-metrics.js
//
// Run this locally (node analyze-metrics.js) from your server/ folder,
// where serviceAccountKey.json already lives. It pulls every doc from
// server_metrics and prints average/min/max duration, grouped by
// route + coldStart, so you can answer questions like:
//   "cold starts on /placeOrder average 4.2s, warm ones average 90ms"
//
// Optional: pass a route as an argv filter, e.g.
//   node analyze-metrics.js /placeOrder

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  const routeFilter = process.argv[2]; // e.g. "/placeOrder"

  const snap = await db.collection("server_metrics").get();

  // group key: `${route}::${coldStart}`
  const groups = new Map();

  snap.forEach((doc) => {
    const d = doc.data();
    if (routeFilter && d.route !== routeFilter) return;

    const key = `${d.route} (${d.coldStart ? "cold" : "warm"})`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d.durationMs);
  });

  if (groups.size === 0) {
    console.log("No matching docs found.");
    return;
  }

  const rows = [];
  for (const [key, durations] of groups.entries()) {
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    rows.push({
      route_coldStart: key,
      count: durations.length,
      avgMs: Math.round(avg),
      minMs: min,
      maxMs: max,
    });
  }

  // sort by avg duration, slowest first
  rows.sort((a, b) => b.avgMs - a.avgMs);

  console.table(rows);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error analyzing metrics:", err);
    process.exit(1);
  });