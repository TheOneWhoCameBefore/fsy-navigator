const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log(' Starting comprehensive data setup...');
console.log('This script will:');
console.log('1. Clear all existing outdoor locations, indoor locations, and company names');
console.log('2. Re-upload outdoor locations from CSV via Google MyMaps import');
console.log('3. Re-upload indoor locations from CSV');
console.log('4. Re-upload company names from CSV');

// Function to run a command and log output
function runCommand(command, description) {
  console.log(`\n ${description}...`);
  try {
    const output = execSync(command, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    console.log(` ${description} completed`);
  } catch (error) {
    console.error(` ${description} failed:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('\n' + '='.repeat(50));
    console.log('COMPREHENSIVE DATA SETUP SCRIPT');
    console.log('='.repeat(50));

    // Step 1: Clear and upload outdoor locations via Google MyMaps import
    runCommand(
      'node scripts/import_google_mymaps.cjs data/outdoor_locations.csv --replace', 
      'Clearing and importing outdoor locations from Google MyMaps CSV'
    );

    // Step 2: Clear and upload indoor locations
    runCommand(
      'node scripts/upload_indoor_locations.cjs', 
      'Clearing and uploading indoor locations from CSV'
    );

    // Step 3: Clear and upload company names
    runCommand(
      'node scripts/upload_company_names.cjs data/company_names.csv', 
      'Clearing and uploading company names from CSV'
    );

    console.log('\n' + '='.repeat(50));
    console.log(' ALL DATA SETUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(' Outdoor locations: Imported from Google MyMaps CSV with coordinates');
    console.log(' Indoor locations: Uploaded from indoor_locations.csv');  
    console.log(' Company names: Uploaded from company_names.csv');
    console.log('\n Your Selection Dashboard is now fully populated with fresh data!');
    
  } catch (error) {
    console.error('\n Setup failed:', error.message);
    console.error('Please check the error above and try again.');
    process.exit(1);
  }
}

main();
