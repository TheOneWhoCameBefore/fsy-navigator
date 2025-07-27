#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, deleteDoc } = require('firebase/firestore');

const firebaseConfigModule = require('../src/firebase-config');
const firebaseConfig = firebaseConfigModule.firebaseConfig || firebaseConfigModule;
const appId = firebaseConfigModule.appId || '';

const roleAssignmentsCsvPath = path.resolve(__dirname, '../data/role_assignments.csv');
const roleAssignmentsCollectionPath = `artifacts/${appId}/public/data/roleAssignments`;

// Simple CSV parser (no external dependency)
function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return headers.reduce((obj, h, idx) => {
      let v = values[idx] || '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      obj[h] = v.trim();
      return obj;
    }, {});
  });
}

async function clearExistingRoleAssignments(db, colRef) {
  console.log('Clearing existing role assignments...');
  const snapshot = await getDocs(colRef);
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  console.log(`Cleared ${snapshot.docs.length} existing role assignments.`);
}

async function uploadRoleAssignments() {
  // Read and parse CSV
  const csvContent = fs.readFileSync(roleAssignmentsCsvPath, 'utf8');
  const records = parseCsv(csvContent);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const colRef = collection(db, roleAssignmentsCollectionPath);

  // Clear existing role assignments before uploading new ones
  await clearExistingRoleAssignments(db, colRef);

  let successCount = 0;
  let failCount = 0;

  for (const row of records) {
    // Convert names to array (split by semicolon if needed)
    let namesArr = [];
    if (row.names.includes(';')) {
      namesArr = row.names.split(';').map(n => n.trim()).filter(Boolean);
    } else if (row.names) {
      namesArr = [row.names.trim()];
    }
    const docData = {
      role: row.role || '',
      names: namesArr,
      updatedAt: row.updatedAt || new Date().toISOString()
    };
    try {
      await addDoc(colRef, docData);
      successCount++;
    } catch (err) {
      console.error('Failed to upload row:', docData, err);
      failCount++;
    }
  }
  console.log(`Upload complete. Success: ${successCount}, Failed: ${failCount}`);
}

uploadRoleAssignments().catch(err => {
  console.error('Error uploading role assignments:', err);
  process.exit(1);
});
