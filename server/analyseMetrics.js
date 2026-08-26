// analyseMetrics.js (extended)
//
// Usage:
//   node analyseMetrics.js                          -> all data, grouped by route+coldStart
//   node analyseMetrics.js /placeOrder               -> filtered to one route
//   node analyseMetrics.js /placeOrder 2026-08-20     -> only docs created ON or AFTER this date
//   node analyseMetrics.js /placeOrder 2026-08-15 2026-08-20  -> only docs BETWEEN these dates
//
// This lets you compare a "before" window (pre fire-and-forget fix) against
// an "after" window, to get real numbers like:
//   "cold starts dropped from X% of requests to Y%"
//   "average response time improved from Xms to Yms"
//   "p99 latency stabilized under Xms"

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

  let query = db.collection("server_metrics");
  if (routeFilter) query = query.where("route", "==", routeFilter);
  if (startDate) query = query.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startDate));
  if (endDate) query = query.where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endDate));

  const snap = await query.get();

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

  function percentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.min(Math.max(idx, 0), sortedArr.length - 1)];
  }

  const rows = [];
  for (const [key, durations] of groups.entries()) {
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    rows.push({
      route_coldStart: key,
      count: durations.length,
      avgMs: Math.round(avg),
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
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