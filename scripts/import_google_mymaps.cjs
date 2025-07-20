const fs = require('fs');
const csv = require('csv-parser');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } = require('firebase/firestore');

// Import your Firebase config
const { firebaseConfig } = require('../src/firebase-config.js');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to show usage instructions
function showUsage() {
  console.log(' Google MyMaps Import Tool');
  console.log('');
  console.log('This script imports outdoor locations from a Google MyMaps CSV export.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/import_google_mymaps.cjs <csv-file-path> [--replace]');
  console.log('');
  console.log('Options:');
  console.log('  --replace    Delete existing outdoor locations before importing');
  console.log('');
  console.log('Expected CSV format from Google MyMaps:');
  console.log('  Format 1 - Separate coordinates:');
  console.log('    - Name (location name)');
  console.log('    - Description (optional description)');
  console.log('    - Latitude (decimal degrees)');
  console.log('    - Longitude (decimal degrees)');
  console.log('  Format 2 - WKT format:');
  console.log('    - name (location name)');
  console.log('    - description (optional description)');  
  console.log('    - WKT (Well-Known Text: "POINT (longitude latitude)")');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/import_google_mymaps.cjs ./data/outdoor_locations.csv --replace');
}

// Function to parse CSV and validate data
function parseMyMapsCSV(filePath) {
  return new Promise((resolve, reject) => {
    const locations = [];
    
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Handle both formats: standard lat/lon columns and WKT format
        const name = row.Name || row.name || row.title || row.Title;
        const description = row.Description || row.description || row.notes || row.Notes || '';
        
        let latitude, longitude;
        
        // Check for WKT format first (e.g., "POINT (-114.1319653 51.0797664)")
        const wkt = row.WKT || row.wkt || row.Wkt;
        if (wkt) {
          // Parse WKT POINT format: "POINT (longitude latitude)"
          const pointMatch = wkt.match(/POINT\s*\(\s*([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*\)/i);
          if (pointMatch) {
            longitude = parseFloat(pointMatch[1]);
            latitude = parseFloat(pointMatch[2]);
          }
        } else {
          // Fall back to separate lat/lon columns
          const lat = row.Latitude || row.latitude || row.lat || row.Lat;
          const lon = row.Longitude || row.longitude || row.lng || row.Lng || row.lon || row.Lon;
          
          if (lat && lon) {
            latitude = parseFloat(lat);
            longitude = parseFloat(lon);
          }
        }

        if (!name) {
          console.warn('️  Skipping row with missing name:', row);
          return;
        }

        if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
          console.warn('️  Skipping row with missing or invalid coordinates:', { 
            name, 
            wkt: wkt || 'none',
            latitude, 
            longitude 
          });
          return;
        }

        // Generate ID from name (slugify)
        const id = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        locations.push({
          id,
          name: name.trim(),
          description: description.trim(),
          lat: latitude,
          lon: longitude,
          status: 'available',
          claimedBy: null
        });
      })
      .on('end', () => {
        console.log(` Parsed ${locations.length} locations from CSV`);
        resolve(locations);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Function to clear existing outdoor locations
async function clearExistingLocations() {
  console.log('️  Clearing existing outdoor locations...');
  
  try {
    // Get all existing documents
    const snapshot = await getDocs(collection(db, 'outdoor_locations'));
    
    if (snapshot.empty) {
      console.log('   No existing locations to clear.');
      return;
    }

    const deletePromises = [];
    snapshot.forEach((docSnapshot) => {
      deletePromises.push(deleteDoc(docSnapshot.ref));
    });

    await Promise.all(deletePromises);
    console.log(` Cleared ${deletePromises.length} existing locations`);
  } catch (error) {
    console.error(' Error clearing existing locations:', error);
    throw error;
  }
}

// Function to upload locations to Firebase
async function uploadLocations(locations) {
  console.log(' Uploading locations to Firebase...');
  
  const uploadPromises = locations.map(async (location) => {
    try {
      await setDoc(doc(collection(db, 'outdoor_locations'), location.id), {
        name: location.name,
        description: location.description,
        lat: location.lat,
        lon: location.lon,
        status: location.status,
        claimedBy: location.claimedBy,
        updatedAt: new Date().toISOString()
      });
      console.log(` Uploaded: ${location.name} (${location.lat}, ${location.lon})`);
    } catch (error) {
      console.error(` Error uploading ${location.name}:`, error);
      throw error;
    }
  });

  await Promise.all(uploadPromises);
  console.log(` Successfully uploaded ${locations.length} outdoor locations!`);
}

// Main function
async function importGoogleMyMaps() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    return;
  }

  const csvFilePath = args[0];
  const shouldReplace = args.includes('--replace');

  console.log(' Google MyMaps Import Tool');
  console.log('');
  console.log(` CSV File: ${csvFilePath}`);
  console.log(` Replace existing: ${shouldReplace ? 'Yes' : 'No'}`);
  console.log('');

  try {
    // Parse the CSV file
    const locations = await parseMyMapsCSV(csvFilePath);

    if (locations.length === 0) {
      console.log('️  No valid locations found in the CSV file.');
      return;
    }

    // Show preview of what will be imported
    console.log('');
    console.log(' Locations to import:');
    locations.forEach((loc, index) => {
      console.log(`   ${index + 1}. ${loc.name} (${loc.lat}, ${loc.lon})`);
      if (loc.description) {
        console.log(`      Description: ${loc.description}`);
      }
    });
    console.log('');

    // Clear existing locations if requested
    if (shouldReplace) {
      await clearExistingLocations();
    }

    // Upload new locations
    await uploadLocations(locations);

    console.log('');
    console.log(' Import completed successfully!');
    console.log('');
    console.log('Your outdoor locations are now available in the Selection Dashboard.');
    
  } catch (error) {
    console.error(' Import failed:', error.message);
    console.log('');
    console.log('Make sure:');
    console.log('1. The CSV file exists and is readable');
    console.log('2. Your Firebase configuration is correct');
    console.log('3. You have write permissions to Firestore');
    console.log('4. The CSV has the expected columns (name/Name AND either WKT OR Latitude+Longitude)');
  }
}

// Run the import
importGoogleMyMaps();
