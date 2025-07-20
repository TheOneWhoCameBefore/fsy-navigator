const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Import your Firebase config
const { firebaseConfig } = require('../src/firebase-config.js');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportClaimedSpots() {
  console.log(' Exporting claimed company spots...');
  
  try {
    // Fetch all data
    const [companyNames, indoorLocations, outdoorLocations] = await Promise.all([
      getDocs(collection(db, 'company_names')),
      getDocs(collection(db, 'indoor_locations')),
      getDocs(collection(db, 'outdoor_locations'))
    ]);

    // Convert to arrays
    const companies = companyNames.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const indoor = indoorLocations.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const outdoor = outdoorLocations.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter claimed items
    const claimedCompanies = companies.filter(c => c.status === 'claimed');
    const claimedIndoor = indoor.filter(l => l.status === 'claimed');
    const claimedOutdoor = outdoor.filter(l => l.status === 'claimed');

    console.log(`Found ${claimedCompanies.length} claimed companies`);

    if (claimedCompanies.length === 0) {
      console.log('No claimed spots found to export.');
      return;
    }

    // Create export data
    const exportData = [];
    
    for (const company of claimedCompanies) {
      const indoorSpot = claimedIndoor.find(l => l.claimedBy === company.name);
      const outdoorSpot = claimedOutdoor.find(l => l.claimedBy === company.name);
      
      exportData.push({
        companyName: company.name,
        cnCounselors: company.cnCounselors ? company.cnCounselors.map(cn => cn.name).join('; ') : 'None',
        outdoorLocation: outdoorSpot ? outdoorSpot.name : 'None',
        outdoorDescription: outdoorSpot ? outdoorSpot.description : '',
        outdoorCoordinates: outdoorSpot ? `${outdoorSpot.lat}, ${outdoorSpot.lon}` : '',
        indoorLocation: indoorSpot ? indoorSpot.name : 'None',
        indoorDescription: indoorSpot ? indoorSpot.description : '',
        claimedAt: company.claimedAt ? new Date(company.claimedAt).toLocaleString() : 'Unknown'
      });
    }

    // Create CSV content
    const csvHeaders = [
      'Company Name',
      'CN Counselors', 
      'Outdoor Location',
      'Outdoor Description',
      'Coordinates (lat, lon)',
      'Indoor Location', 
      'Indoor Description',
      'Claimed At'
    ];

    const csvRows = exportData.map(row => [
      `"${row.companyName}"`,
      `"${row.cnCounselors}"`,
      `"${row.outdoorLocation}"`,
      `"${row.outdoorDescription}"`,
      `"${row.outdoorCoordinates}"`,
      `"${row.indoorLocation}"`,
      `"${row.indoorDescription}"`,
      `"${row.claimedAt}"`
    ]);

    const csvContent = [csvHeaders.map(h => `"${h}"`).join(','), ...csvRows.map(row => row.join(','))].join('\n');

    // Save to file
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `company-spot-assignments-${timestamp}.csv`;
    const filepath = path.join(__dirname, '..', 'data', filename);
    
    // Ensure data directory exists
    const dataDir = path.dirname(filepath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(filepath, csvContent);
    
    console.log(' Export completed!');
    console.log(` File saved: ${filepath}`);
    console.log(` Exported ${exportData.length} company assignments`);
    
    // Also create a JSON export for detailed data
    const jsonFilename = `company-spot-assignments-${timestamp}.json`;
    const jsonFilepath = path.join(__dirname, '..', 'data', jsonFilename);
    fs.writeFileSync(jsonFilepath, JSON.stringify(exportData, null, 2));
    console.log(` JSON file saved: ${jsonFilepath}`);

  } catch (error) {
    console.error(' Error exporting data:', error);
    console.log('Make sure your Firebase configuration is correct and you have read permissions to Firestore.');
  }
}

// Run the export
exportClaimedSpots();
