const fs = require('fs');
const csv = require('csv-parser');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');

// Import your Firebase config
const { firebaseConfig } = require('../src/firebase-config.js');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to show usage instructions
function showUsage() {
  console.log(' Company Names Upload Tool');
  console.log('');
  console.log('This script uploads company names from a CSV file to Firebase.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/upload_company_names.cjs <csv-file-path>');
  console.log('');
  console.log('Expected CSV format:');
  console.log('  - company_name (required)');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/upload_company_names.cjs ./data/company_names.csv');
}

// Function to parse CSV and validate data
function parseCompanyNamesCSV(filePath) {
  return new Promise((resolve, reject) => {
    const companies = [];
    
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const name = row.company_name || row.Company_Name || row['Company Name'] || row.name;

        if (!name || !name.trim()) {
          console.warn('️  Skipping row with missing company name:', row);
          return;
        }

        // Generate ID from name (slugify)
        const id = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        companies.push({
          id,
          name: name.trim()
        });
      })
      .on('end', () => {
        console.log(` Parsed ${companies.length} company names from CSV`);
        resolve(companies);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Function to upload company names to Firebase
async function uploadCompanyNames(companies) {
  console.log(' Uploading company names to Firebase...');
  
  const uploadPromises = companies.map(async (company) => {
    try {
      await setDoc(doc(collection(db, 'company_names'), company.id), {
        name: company.name,
        status: 'available',
        claimedBy: null,
        updatedAt: new Date().toISOString()
      });
      console.log(` Uploaded: ${company.name}`);
    } catch (error) {
      console.error(` Error uploading ${company.name}:`, error);
      throw error;
    }
  });

  await Promise.all(uploadPromises);
  console.log(` Successfully uploaded ${companies.length} company names!`);
}

// Main function
async function uploadCompanyNamesFromCSV() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    return;
  }

  const csvFilePath = args[0];

  console.log(' Company Names Upload Tool');
  console.log('');
  console.log(` CSV File: ${csvFilePath}`);
  console.log('');

  try {
    // Parse the CSV file
    const companies = await parseCompanyNamesCSV(csvFilePath);

    if (companies.length === 0) {
      console.log('️  No valid company names found in the CSV file.');
      return;
    }

    // Show preview of what will be uploaded
    console.log('');
    console.log(' Company names to upload:');
    companies.forEach((company, index) => {
      console.log(`   ${index + 1}. ${company.name}`);
    });
    console.log('');

    // Upload company names
    await uploadCompanyNames(companies);

    console.log('');
    console.log(' Upload completed successfully!');
    console.log('');
    console.log('Your company names are now available in the Selection Dashboard.');
    
  } catch (error) {
    console.error(' Upload failed:', error.message);
    console.log('');
    console.log('Make sure:');
    console.log('1. The CSV file exists and is readable');
    console.log('2. Your Firebase configuration is correct');
    console.log('3. You have write permissions to Firestore');
    console.log('4. The CSV has the expected column (company_name)');
  }
}

// Run the upload
uploadCompanyNamesFromCSV();
