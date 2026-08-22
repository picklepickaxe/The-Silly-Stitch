// analyseMetrics.js (extended)
//
// Usage:
//   node analyseMetrics.js                          -> all data, grouped by route+coldStart
//   node analyseMetrics.js /placeOrder               -> filtered to one route
//   node analyseMetrics.js /placeOrder 2026-08-20     -> only docs created ON or AFTER this date
//   node analyseMetrics.js /placeOrder 2026-08-15 2026-08-20  -> only docs BETWEEN these dates
//
// This lets you compare a "before" window (pre keep-alive pinger) against
// an "after" window, to get real numbers like:
//   "cold starts dropped from X% of requests to Y%"
//   "average response time improved from Xms to Yms"

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  const routeFilter = process.argv[2];
  const startDateArg = process.argv[3];
  const endDateArg = process.argv[4];

  const startDate = startDateArg ? new Date(startDateArg) : null;
  const endDate = endDateArg ? new Date(endDateArg) : null;

  const snap = await db.collection("server_metrics").get();

  const groups = new Map();
  let totalInRange = 0;
  let coldInRange = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    if (routeFilter && d.route !== routeFilter) return;

    const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : null;
    if (startDate && createdAt && createdAt < startDate) return;
    if (endDate && createdAt && createdAt > endDate) return;

    totalInRange += 1;
    if (d.coldStart) coldInRange += 1;

    const key = `${d.route} (${d.coldStart ? "cold" : "warm"})`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d.durationMs);
  });

  if (groups.size === 0) {
    console.log("No matching docs found in this range.");
    return;
  }

  const rows = [];
  for (const [key, durations] of groups.entries()) {
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    rows.push({
      route_coldStart: key,
      count: durations.length,
      avgMs: Math.round(avg),
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
    });
  }

  rows.sort((a, b) => b.avgMs - a.avgMs);
  console.table(rows);

  const coldPct = totalInRange ? ((coldInRange / totalInRange) * 100).toFixed(1) : "0";
  console.log(`\nCold starts: ${coldInRange}/${totalInRange} requests (${coldPct}%)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error analyzing metrics:", err);
    process.exit(1);
  });