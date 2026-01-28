// Run this script to import Propwire data to Supabase
// Usage: node scripts/import-propwire.js

const fs = require('fs');
const path = require('path');

// Read the Propwire JSON file
const jsonPath = path.join(__dirname, '..', '..', 'Downloads', 'dataset_propwire-leads-scraper_2026-01-28_02-27-35-668.json');

async function importData() {
  console.log('Reading Propwire JSON file...');
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Found ${data.length} properties`);
  
  // Post to the import API
  const response = await fetch('https://maxsam-v4-clean.vercel.app/api/property-intelligence/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
  console.log('Import result:', JSON.stringify(result, null, 2));
}

importData().catch(console.error);
