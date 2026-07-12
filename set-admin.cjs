const admin = require("firebase-admin");

// Reads the key file path from environment variable instead of hardcoding it
// Usage: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node set-admin.cjs
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!credentialsPath) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.");
  console.error("   Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node set-admin.cjs");
  process.exit(1);
}

const serviceAccount = require(credentialsPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setAdmin(email) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`✔ Admin claim set for ${email}`);
  process.exit(0);
}

setAdmin("boopweee@gmail.com");