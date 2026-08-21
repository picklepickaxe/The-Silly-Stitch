// server/bot/testConnection.js
const { db } = require('./firestore');

async function test() {
  const snapshot = await db.collection('products').limit(1).get();
  console.log('Connected. Sample doc:', snapshot.docs[0]?.data() ?? 'no products found yet');
}

test();