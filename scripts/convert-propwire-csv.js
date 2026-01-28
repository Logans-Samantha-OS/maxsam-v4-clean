// MaxSam V4 - Propwire CSV to JSON Converter
// Run: node scripts/convert-propwire-csv.js

const fs = require('fs');
const path = require('path');

const csvPath = 'C:\\Users\\MrTin\\Downloads\\propwire.csv';
const outputPath = 'C:\\Users\\MrTin\\Downloads\\propwire-converted.json';

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  // Skip header row
  const dataLines = lines.slice(1);
  
  const properties = [];
  
  for (const line of dataLines) {
    // Parse CSV with quoted fields
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    if (fields.length < 6) continue;
    
    // Parse address
    const address = fields[0];
    
    // Parse city, state, zip
    const locationParts = fields[1].match(/^(.+),\s*([A-Z]{2})\s*(\d{5})/);
    const city = locationParts ? locationParts[1] : '';
    const state = locationParts ? locationParts[2] : 'TX';
    const zip = locationParts ? locationParts[3] : '';
    
    // Parse lot size (remove commas)
    const lotSqft = parseInt(fields[2].replace(/,/g, '')) || null;
    
    // Property type
    const propertyType = fields[3] || 'Single Family';
    
    // Owner type
    const ownerType = fields[4] || '';
    const isIndividual = ownerType.includes('Individual');
    const isCorporate = ownerType.includes('Corporate');
    const isBankOwned = ownerType.includes('Bank');
    
    // Parse value (remove $ and commas)
    const valueStr = fields[5].replace(/[$,]/g, '');
    const estimatedValue = parseInt(valueStr) || null;
    
    // Parse equity or price/sqft
    const metric2 = fields[7] || '';
    const metric2Label = fields[8] || '';
    let equityPercent = null;
    
    if (metric2.includes('%')) {
      equityPercent = parseInt(metric2.replace('%', ''));
      if (equityPercent < 0) equityPercent = 0;
      if (equityPercent > 100) equityPercent = 100;
    } else if (metric2Label.includes('Equity')) {
      // Try parsing as equity
      const parsed = parseInt(metric2.replace('%', ''));
      if (!isNaN(parsed)) {
        equityPercent = Math.min(100, Math.max(0, parsed));
      }
    }
    
    // Calculate estimated equity
    const estimatedEquity = equityPercent !== null && estimatedValue 
      ? Math.round(estimatedValue * (equityPercent / 100))
      : null;
    
    // Collect lead types from columns 9, 10, 11
    const leadTypes = [];
    for (let i = 9; i <= 11; i++) {
      const leadType = fields[i];
      if (leadType && leadType.trim() && !leadType.match(/^\d+\+?$/)) {
        // Normalize lead type names
        const normalized = leadType
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace('PREFORECLOSURES', 'PREFORECLOSURE')
          .replace('AUCTIONS', 'AUCTION')
          .replace('ABSENTEE_OWNERS', 'ABSENTEE_OWNER')
          .replace('BARGAIN_PROPERTIES', 'BARGAIN')
          .replace('CASH_BUYERS', 'CASH_BUYER')
          .replace('EMPTY_NESTERS', 'EMPTY_NESTER')
          .replace('TIRED_LANDLORDS', 'TIRED_LANDLORD')
          .replace('FLIPPED_PROPERTIES', 'FLIPPED')
          .replace('INTRAFAMILY_TRANSFERS', 'INTRAFAMILY')
          .replace('ASSUMABLE_LOANS', 'ASSUMABLE_LOAN')
          .replace('ADJUSTABLE_LOANS', 'ADJUSTABLE_LOAN')
          .replace('VACANT_LOTS', 'VACANT_LOT');
        leadTypes.push(normalized);
      }
    }
    
    // Calculate distress score
    let distressScore = 0;
    if (leadTypes.includes('PREFORECLOSURE')) distressScore += 30;
    if (leadTypes.includes('AUCTION')) distressScore += 25;
    if (leadTypes.includes('HIGH_EQUITY')) distressScore += 10;
    if (leadTypes.includes('ABSENTEE_OWNER')) distressScore += 10;
    if (leadTypes.includes('VACANT')) distressScore += 15;
    if (leadTypes.includes('TIRED_LANDLORD')) distressScore += 10;
    if (leadTypes.includes('BARGAIN')) distressScore += 15;
    if (equityPercent && equityPercent >= 80) distressScore += 10;
    distressScore = Math.min(100, distressScore);
    
    // Determine situation type
    let situationType = 'unknown';
    if (leadTypes.includes('PREFORECLOSURE')) situationType = 'preforeclosure';
    else if (leadTypes.includes('AUCTION')) situationType = 'auction';
    else if (leadTypes.includes('VACANT') || leadTypes.includes('VACANT_LOT')) situationType = 'vacant';
    else if (leadTypes.includes('ABSENTEE_OWNER')) situationType = 'absentee';
    else if (leadTypes.includes('HIGH_EQUITY')) situationType = 'high_equity';
    
    // Determine opportunity tier
    let opportunityTier = 'cold';
    if (distressScore >= 50 && equityPercent >= 40) opportunityTier = 'golden';
    else if (distressScore >= 40 || equityPercent >= 60) opportunityTier = 'hot';
    else if (distressScore >= 25 || equityPercent >= 40) opportunityTier = 'warm';
    
    // Generate a unique ID from address
    const propwireId = `csv_${address.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50)}`;
    
    properties.push({
      propwire_id: propwireId,
      address: address,
      city: city,
      state: state,
      zip: zip,
      county: 'Dallas', // Default, most are Dallas County
      property_type: propertyType,
      lot_sqft: lotSqft,
      estimated_value: estimatedValue,
      estimated_equity: estimatedEquity,
      equity_percent: equityPercent,
      owner_occupied: !leadTypes.includes('ABSENTEE_OWNER'),
      is_corporate: isCorporate,
      is_bank_owned: isBankOwned,
      lead_types: leadTypes,
      is_preforeclosure: leadTypes.includes('PREFORECLOSURE'),
      is_auction: leadTypes.includes('AUCTION'),
      is_vacant: leadTypes.includes('VACANT') || leadTypes.includes('VACANT_LOT'),
      is_absentee: leadTypes.includes('ABSENTEE_OWNER'),
      is_high_equity: leadTypes.includes('HIGH_EQUITY'),
      distress_score: distressScore,
      situation_type: situationType,
      opportunity_tier: opportunityTier,
      data_source: 'propwire_csv',
      imported_at: new Date().toISOString(),
    });
  }
  
  return properties;
}

// Main
const csvContent = fs.readFileSync(csvPath, 'utf8');
const properties = parseCSV(csvContent);

console.log(`Parsed ${properties.length} properties from CSV`);

// Save as JSON
fs.writeFileSync(outputPath, JSON.stringify(properties, null, 2));
console.log(`Saved to ${outputPath}`);

// Summary stats
const preforeclosure = properties.filter(p => p.is_preforeclosure).length;
const highEquity = properties.filter(p => p.is_high_equity).length;
const auction = properties.filter(p => p.is_auction).length;
const golden = properties.filter(p => p.opportunity_tier === 'golden').length;
const hot = properties.filter(p => p.opportunity_tier === 'hot').length;

console.log('\n--- Summary ---');
console.log(`Total: ${properties.length}`);
console.log(`Preforeclosure: ${preforeclosure}`);
console.log(`High Equity: ${highEquity}`);
console.log(`Auction: ${auction}`);
console.log(`Golden Tier: ${golden}`);
console.log(`Hot Tier: ${hot}`);

const totalValue = properties.reduce((sum, p) => sum + (p.estimated_value || 0), 0);
const totalEquity = properties.reduce((sum, p) => sum + (p.estimated_equity || 0), 0);
console.log(`Total Value: $${(totalValue / 1000000).toFixed(2)}M`);
console.log(`Total Equity: $${(totalEquity / 1000000).toFixed(2)}M`);
