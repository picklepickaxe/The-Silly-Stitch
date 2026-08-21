const admin = require('firebase-admin');

// No admin.initializeApp() here — index.js already did that.
// firebase-admin keeps a single global app instance per process,
// so calling admin.firestore() anywhere just reuses it.
const db = admin.firestore();

module.exports = { db, admin };