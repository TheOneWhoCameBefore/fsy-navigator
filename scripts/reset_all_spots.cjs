const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Import your Firebase config
const { firebaseConfig } = require('../src/firebase-config.js');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetAllSpots() {
  console.log(' Starting reset of all company spots...');
  
  try {
    // Reset outdoor and indoor locations
    const locationCollections = ['indoor_locations', 'outdoor_locations'];
    
    for (const collectionName of locationCollections) {
      console.log(` Resetting ${collectionName}...`);
      
      const querySnapshot = await getDocs(collection(db, collectionName));
      
      for (const docSnap of querySnapshot.docs) {
        await updateDoc(doc(db, collectionName, docSnap.id), {
          status: 'available',
          claimedBy: null,
          cnCounselors: null,
          claimedAt: null,
          updatedAt: new Date().toISOString()
        });
        
        const data = docSnap.data();
        console.log(`   Reset: ${data.name}`);
      }
    }
    
    // Reset company names (different field structure)
    console.log(' Resetting company_names...');
    const companiesSnapshot = await getDocs(collection(db, 'company_names'));
    
    for (const docSnap of companiesSnapshot.docs) {
      const data = docSnap.data();
      
      // Prepare update data - preserve core fields, reset status fields
      const updateData = {
        status: 'available',
        claimedBy: null,           // CN counselor names
        cnCounselors: null,        // CN counselor objects
        companyName: null,         // Company name (when claimed)
        claimedAt: null,
        updatedAt: new Date().toISOString()
      };
      
      // Preserve scripture reference if it exists
      if (data.scripture_reference) {
        updateData.scripture_reference = data.scripture_reference;
      }
      
      await updateDoc(doc(db, 'company_names', docSnap.id), updateData);
      
      console.log(`   Reset: ${data.name}${data.scripture_reference ? ` (${data.scripture_reference})` : ''}`);
    }
    
    console.log(' Successfully reset all company spots!');
    console.log('All spots are now available for selection.');
    
  } catch (error) {
    console.error(' Error resetting spots:', error);
    console.log('');
    console.log('Make sure your Firebase configuration is correct and you have write permissions to Firestore.');
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--confirm')) {
  resetAllSpots();
} else {
  console.log('️  This will reset ALL company spot selections!');
  console.log('All claimed spots will be made available again.');
  console.log('');
  console.log('To confirm, run: node scripts/reset_all_spots.cjs --confirm');
}
