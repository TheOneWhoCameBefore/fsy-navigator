#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
// Simple CSV parser (no external dependency)
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

const firebaseConfigModule = require('./src/firebase-config');
const firebaseConfig = firebaseConfigModule.firebaseConfig || firebaseConfigModule;
const appId = firebaseConfigModule.appId || '';

const agendaCsvPath = path.resolve(__dirname, '../data/agenda.csv');
const agendaEventsCollectionPath = `artifacts/${appId}/public/data/agendaEvents`;

async function uploadAgendaEvents() {

  // Read and parse CSV
  const csvContent = fs.readFileSync(agendaCsvPath, 'utf8');
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());
  const records = lines.slice(1).map(line => {
    // Handle quoted fields and commas inside quotes
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
    // Remove surrounding quotes and trim
    return headers.reduce((obj, h, idx) => {
      let v = values[idx] || '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      obj[h] = v.trim();
      return obj;
    }, {});
  });

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const colRef = collection(db, agendaEventsCollectionPath);

  let successCount = 0;
  let failCount = 0;

  for (const row of records) {
    // Prepare document data
    const docData = {
      weekday: row['Weekday'] || '',
      startTime: row['Start Time'] || '',
      endTime: row['End Time'] || '',
      role: row['Role'] || '',
      eventName: row['Event Name'] || '',
      eventAbbreviation: row['Event Abbreviation'] || '',
      eventType: row['Event Type'] || '',
      eventDescription: row['Event Description'] || ''
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

uploadAgendaEvents().catch(err => {
  console.error('Error uploading agenda events:', err);
  process.exit(1);
});
