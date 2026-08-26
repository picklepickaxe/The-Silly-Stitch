// cleanupHealthDocs.js
//
// One-time cleanup: deletes all server_metrics docs where route === "/health"
// (or "/"), left over from before the skip-logging fix was deployed.
//
// Usage: node cleanupHealthDocs.js

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const ROUTES_TO_DELETE = ["/health", "/"];
const BATCH_SIZE = 400; // stay under Firestore's 500-op batch limit

async function deleteRoute(route) {
  let totalDeleted = 0;

  while (true) {
    const snap = await db
      .collection("server_metrics")
      .where("route", "==", route)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snap.size;
    console.log(`Deleted ${totalDeleted} docs for route "${route}" so far...`);
  }

  console.log(`Done with "${route}": ${totalDeleted} total deleted.`);
}

async function main() {
  for (const route of ROUTES_TO_DELETE) {
    await deleteRoute(route);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });