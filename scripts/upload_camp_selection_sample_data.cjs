const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');

// Import your Firebase config
const { firebaseConfig } = require('../src/firebase-config.js');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample data for spot selection dashboard
const sampleData = {
  company_names: [
    { id: 'thunder-hawks', name: 'Thunder Hawks', status: 'available', claimedBy: null },
    { id: 'lightning-eagles', name: 'Lightning Eagles', status: 'available', claimedBy: null },
    { id: 'mountain-lions', name: 'Mountain Lions', status: 'available', claimedBy: null },
    { id: 'river-wolves', name: 'River Wolves', status: 'available', claimedBy: null },
    { id: 'forest-bears', name: 'Forest Bears', status: 'available', claimedBy: null },
    { id: 'sky-falcons', name: 'Sky Falcons', status: 'available', claimedBy: null },
    { id: 'storm-tigers', name: 'Storm Tigers', status: 'available', claimedBy: null },
    { id: 'fire-dragons', name: 'Fire Dragons', status: 'available', claimedBy: null }
  ],
  
  indoor_locations: [
    {
      id: 'great-hall',
      name: 'The Great Hall',
      status: 'available',
      claimedBy: null,
      description: 'Large meeting space with stage and AV equipment'
    },
    {
      id: 'library',
      name: 'The Library',
      status: 'available', 
      claimedBy: null,
      description: 'Quiet study and discussion area with books and resources'
    },
    {
      id: 'art-studio',
      name: 'Art Studio',
      status: 'available',
      claimedBy: null,
      description: 'Creative space with art supplies and large tables'
    },
    {
      id: 'music-room',
      name: 'Music Room',
      status: 'available',
      claimedBy: null,
      description: 'Sound-equipped room with instruments and recording capability'
    },
    {
      id: 'conference-room',
      name: 'Conference Room',
      status: 'available',
      claimedBy: null,
      description: 'Professional meeting space with presentation equipment'
    },
    {
      id: 'game-room',
      name: 'Game Room',
      status: 'available',
      claimedBy: null,
      description: 'Recreation area with board games, video games, and comfortable seating'
    }
  ],
  
  outdoor_locations: [
    {
      id: 'lookout-hill',
      name: 'Lookout Hill',
      status: 'available',
      claimedBy: null,
      description: 'Elevated area with panoramic views of the surrounding valley',
      lat: 51.051,
      lon: -114.078
    },
    {
      id: 'forest-grove',
      name: 'Forest Grove',
      status: 'available',
      claimedBy: null,
      description: 'Shaded woodland area perfect for nature activities and reflection',
      lat: 51.045,
      lon: -114.085
    },
    {
      id: 'lakeside-beach',
      name: 'Lakeside Beach',
      status: 'available',
      claimedBy: null,
      description: 'Sandy beach area by the lake, great for water activities',
      lat: 51.048,
      lon: -114.072
    },
    {
      id: 'meadow-fields',
      name: 'Meadow Fields',
      status: 'available',
      claimedBy: null,
      description: 'Open grassy area perfect for sports and large group activities',
      lat: 51.053,
      lon: -114.080
    },
    {
      id: 'canyon-overlook',
      name: 'Canyon Overlook',
      status: 'available',
      claimedBy: null,
      description: 'Dramatic viewpoint overlooking the canyon with hiking trails',
      lat: 51.040,
      lon: -114.090
    },
    {
      id: 'pine-pavilion',
      name: 'Pine Pavilion',
      status: 'available',
      claimedBy: null,
      description: 'Covered outdoor area surrounded by pine trees',
      lat: 51.055,
      lon: -114.075
    }
  ]
};

async function uploadSampleData() {
  console.log(' Starting upload of sample spot selection data...');
  
  try {
    // Upload company names
    console.log(' Uploading company names...');
    for (const companyName of sampleData.company_names) {
      await setDoc(doc(collection(db, 'company_names'), companyName.id), {
        name: companyName.name,
        status: companyName.status,
        claimedBy: companyName.claimedBy,
        updatedAt: new Date().toISOString()
      });
      console.log(` Added company name: ${companyName.name}`);
    }
    
    // Upload indoor locations
    console.log(' Uploading indoor locations...');
    for (const location of sampleData.indoor_locations) {
      await setDoc(doc(collection(db, 'indoor_locations'), location.id), {
        name: location.name,
        status: location.status,
        claimedBy: location.claimedBy,
        description: location.description,
        updatedAt: new Date().toISOString()
      });
      console.log(` Added indoor location: ${location.name}`);
    }
    
    // Upload outdoor locations
    console.log('️ Uploading outdoor locations...');
    for (const location of sampleData.outdoor_locations) {
      await setDoc(doc(collection(db, 'outdoor_locations'), location.id), {
        name: location.name,
        status: location.status,
        claimedBy: location.claimedBy,
        description: location.description,
        lat: location.lat,
        lon: location.lon,
        updatedAt: new Date().toISOString()
      });
      console.log(` Added outdoor location: ${location.name} (${location.lat}, ${location.lon})`);
    }
    
    console.log(' Successfully uploaded all sample data!');
    console.log('');
    console.log('Your Firebase collections now contain:');
    console.log(`- ${sampleData.company_names.length} company names`);
    console.log(`- ${sampleData.indoor_locations.length} indoor locations`);
    console.log(`- ${sampleData.outdoor_locations.length} outdoor locations`);
    console.log('');
    console.log('You can now test the Company Selection Dashboard!');
    
  } catch (error) {
    console.error(' Error uploading sample data:', error);
    console.log('');
    console.log('Make sure your Firebase configuration is correct and you have write permissions to Firestore.');
  }
}

// Run the upload
uploadSampleData();
