const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } = require('firebase/firestore');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Import your Firebase config
const { firebaseConfig } = require('../src/firebase-config.js');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadIndoorLocations() {
  const csvFilePath = path.join(__dirname, '..', 'data', 'indoor_locations.csv');
  
  console.log(' Starting indoor locations upload...');
  console.log(' Reading from:', csvFilePath);
  
  try {
    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found at: ${csvFilePath}`);
    }

    // Clear existing indoor locations
    console.log('️  Clearing existing indoor locations...');
    const existingSnapshot = await getDocs(collection(db, 'indoor_locations'));
    const deletePromises = existingSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log(` Deleted ${existingSnapshot.docs.length} existing indoor locations`);

    // Parse CSV and upload new data
    const locations = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          // Clean up the data (remove extra spaces, handle CSV formatting)
          const location = {
            name: row.name?.trim(),
            description: row.description?.trim() || '',
            status: 'available', // Default status
            createdAt: new Date().toISOString()
          };
          
          // Validate required fields
          if (!location.name) {
            console.warn('️  Skipping row with missing name:', row);
            return;
          }
          
          locations.push(location);
        })
        .on('end', async () => {
          try {
            console.log(` Parsed ${locations.length} indoor locations from CSV`);
            
            // Upload to Firestore
            const uploadPromises = locations.map((location, index) => {
              const docRef = doc(collection(db, 'indoor_locations'));
              console.log(` Uploading location ${index + 1}/${locations.length}: ${location.name}`);
              return setDoc(docRef, location);
            });
            
            await Promise.all(uploadPromises);
            
            console.log(' Indoor locations upload completed successfully!');
            console.log(` Total uploaded: ${locations.length} locations`);
            
            // Display summary
            console.log('\n Summary:');
            locations.forEach((location, index) => {
              console.log(`   ${index + 1}. ${location.name}${location.description ? ` - ${location.description}` : ''}`);
            });
            
            resolve();
          } catch (error) {
            console.error(' Error uploading to Firestore:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error(' Error reading CSV file:', error);
          reject(error);
        });
    });
    
  } catch (error) {
    console.error(' Upload failed:', error);
    process.exit(1);
  }
}

// Run the upload
uploadIndoorLocations()
  .then(() => {
    console.log(' Indoor locations upload process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error(' Fatal error:', error);
    process.exit(1);
  });
