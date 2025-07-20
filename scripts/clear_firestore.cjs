#!/usr/bin/env node
const path = require('path');
/**
 * Clear all documents from all Firestore collections using Firebase JS SDK (dev credentials).
 * Usage: node clear_firestore_dev.cjs
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfigModule = require('./src/firebase-config');
const firebaseConfig = firebaseConfigModule.firebaseConfig || firebaseConfigModule;
const appId = firebaseConfigModule.appId || '';



async function clearCollection(firebaseConfig, collectionArg) {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // If a collection argument is provided, use it; otherwise, show usage and exit
  if (!collectionArg) {
    console.error('Usage: node clear_firestore.cjs <collectionName>');
    console.error('Example: node clear_firestore.cjs roleEvents');
    process.exit(1);
  }

  // Map short names to full Firestore paths
  const collectionMap = {
    roleAssignments: `artifacts/${appId}/public/data/roleAssignments`,
    roleEvents: `artifacts/${appId}/public/data/roleEvents`,
    agendaEvents: `artifacts/${appId}/public/data/agendaEvents`
    // Add more mappings as needed
  };

  const colName = collectionMap[collectionArg] || collectionArg;

  try {
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      console.log(`Collection '${colName}' is already empty.`);
      return;
    }
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, colName, docSnap.id));
    }
    console.log(` Cleared all documents from collection '${colName}'.`);
  } catch (err) {
    console.error(`Error clearing collection '${colName}':`, err);
  }
}

// Main entrypoint

// Main entrypoint
(async () => {
  try {
    const firebaseConfigObj = firebaseConfig.firebaseConfig || firebaseConfig;
    // Get collection name from command line argument
    const collectionArg = process.argv[2];
    await clearCollection(firebaseConfigObj, collectionArg);
    process.exit(0);
  } catch (err) {
    console.error('Error initializing or clearing collections:', err);
    process.exit(1);
  }
})();

