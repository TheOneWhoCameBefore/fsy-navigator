const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Import your Firebase config
const { firebaseConfig, appId } = require('../src/firebase-config.js');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkRoleAssignments() {
  const roleAssignmentsCollectionPath = `artifacts/${appId}/public/data/roleAssignments`;
  console.log('� Checking roleAssignments collection at:', roleAssignmentsCollectionPath);
  
  try {
    const snapshot = await getDocs(collection(db, roleAssignmentsCollectionPath));
    console.log(` Found ${snapshot.docs.length} documents in roleAssignments`);
    
    if (snapshot.docs.length > 0) {
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const role = data.role || doc.id;
        console.log(`\n Document ID: ${doc.id}`);
        console.log(`   Role: ${role}`);
        console.log(`   Data:`, JSON.stringify(data, null, 2));
        
        // Check if it's a CN role
        const isCnRole = role && (
          role.startsWith('CN ') || 
          role.startsWith('CN') ||
          role.toLowerCase().includes('cn') || 
          role.toLowerCase().includes('counselor')
        );
        
        if (isCnRole) {
          console.log(`    This is a CN role!`);
          if (data.names && data.names.length > 0) {
            console.log(`    Names: ${data.names.join(', ')}`);
          } else {
            console.log(`   ️  No names found in this CN role`);
          }
        } else {
          console.log(`    Not a CN role`);
        }
      });
    }
    
  } catch (error) {
    console.error(' Error checking roleAssignments:', error);
  }
}

checkRoleAssignments();
