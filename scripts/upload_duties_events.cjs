#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, deleteDoc } = require('firebase/firestore');

const firebaseConfigModule = require('../src/firebase-config');
const firebaseConfig = firebaseConfigModule.firebaseConfig || firebaseConfigModule;
const appId = firebaseConfigModule.appId || '';

const dutiesCsvPath = path.resolve(__dirname, '../data/duties_10_ac.csv');
const dutiesEventsCollectionPath = `artifacts/${appId}/public/data/roleEvents`;

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

async function clearCollection(db, collectionPath) {
  console.log(`Clearing existing data from ${collectionPath}...`);
  const colRef = collection(db, collectionPath);
  const snapshot = await getDocs(colRef);
  
  let deleteCount = 0;
  const deletePromises = [];
  
  snapshot.forEach((doc) => {
    deletePromises.push(deleteDoc(doc.ref));
    deleteCount++;
  });
  
  await Promise.all(deletePromises);
  console.log(`Deleted ${deleteCount} existing documents`);
}

async function uploadDutiesEvents() {
  // Read and parse CSV
  const csvContent = fs.readFileSync(dutiesCsvPath, 'utf8');
  const records = parseCsv(csvContent);

  // Combine duplicates by name, day, start, end
  const eventMap = new Map();
  console.log(`Processing ${records.length} records...`);
  
  for (const row of records) {
    const key = [
      row['Event Name'] || '',
      row['Weekday'] || '',
      row['Start Time'] || '',
      row['End Time'] || ''
    ].join('|');
    
    if (!eventMap.has(key)) {
      eventMap.set(key, {
        eventName: row['Event Name'] || '',
        weekday: row['Weekday'] || '',
        startTime: row['Start Time'] || '',
        endTime: row['End Time'] || '',
        eventAbbreviation: row['Event Abbreviation'] || '',
        eventType: row['Event Type'] || '',
        eventDescription: row['Event Description'] || '',
        assignedRoles: [row['Role'] || '']
      });
    } else {
      eventMap.get(key).assignedRoles.push(row['Role'] || '');
    }
  }
  
  console.log(`Combined ${records.length} records into ${eventMap.size} unique events`);
  
  // Show a sample of merged events for verification
  let sampleCount = 0;
  for (const [key, event] of eventMap.entries()) {
    if (event.assignedRoles.length > 1 && sampleCount < 3) {
      console.log(`Sample merged event: ${event.eventName} (${event.weekday} ${event.startTime}) - Roles: [${event.assignedRoles.join(', ')}]`);
      sampleCount++;
    }
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const colRef = collection(db, dutiesEventsCollectionPath);

  // Clear existing data first
  await clearCollection(db, dutiesEventsCollectionPath);

  let successCount = 0;
  let failCount = 0;

  for (const event of eventMap.values()) {
    try {
      await addDoc(colRef, event);
      successCount++;
    } catch (err) {
      console.error('Failed to upload event:', event, err);
      failCount++;
    }
  }
  console.log(`Upload complete. Success: ${successCount}, Failed: ${failCount}`);
}

uploadDutiesEvents().catch(err => {
  console.error('Error uploading duties events:', err);
  process.exit(1);
});
