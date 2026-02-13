/**
 * SAM Outreach Templates — Test Suite
 *
 * Run: node sam-outreach-templates.test.js
 *
 * Verifies templates render correctly for each tier and follow-up stage.
 */

const {
  buildInitialSMS,
  buildFollowUp1,
  buildFollowUp2,
  buildFinalNotice,
  buildGoldenLeadSMS,
  _helpers,
} = require('./sam-outreach-templates');

// ---------------------------------------------------------------------------
// Sample lead data (mirrors Supabase `leads` table columns)
// ---------------------------------------------------------------------------

const goldenLead = {
  id: 'uuid-001',
  owner_name: 'JOHNSON, MARIA',
  phone: '+12145551234',
  phone_type: 'Wireless',
  email: 'maria.j@gmail.com',
  property_address: '4521 Elm St, Dallas, TX 75201',
  county: 'Dallas',
  case_number: 'TX-2024-58291',
  excess_funds_amount: 47250,
  expiry_date: '2025-06-15',
  eleanor_score: 92,
  eleanor_grade: 'A+',
  is_golden_lead: true,
  relatives: [
    { name: 'Robert Johnson', age: 67 },
    { name: 'Lisa Johnson-Park', age: 41 },
  ],
  previous_addresses: [
    { street: '1200 Oak Lawn Ave', city: 'Dallas', state: 'TX', zip: '75207', county: 'Dallas' },
    { street: '890 Preston Rd', city: 'Plano', state: 'TX', zip: '75024', county: 'Collin' },
  ],
  sms_sent_count: 0,
  last_sms_at: null,
  sam_enabled: true,
  status: 'scored',
  skip_trace_status: 'found',
};

const highValueLead = {
  id: 'uuid-002',
  owner_name: 'WILLIAMS, CHARLES R',
  phone: '+18175559876',
  phone_type: 'Wireless',
  email: null,
  property_address: '712 Magnolia Blvd, Fort Worth, TX 76104',
  county: 'Tarrant',
  case_number: 'TAR-2024-11034',
  excess_funds_amount: 23800,
  expiry_date: '2025-09-30',
  eleanor_score: 78,
  eleanor_grade: 'A',
  is_golden_lead: false,
  relatives: [
    { name: 'Dorothy Williams', age: 72 },
  ],
  previous_addresses: [
    { street: '3344 Camp Bowie Blvd', city: 'Fort Worth', state: 'TX', zip: '76107', county: 'Tarrant' },
  ],
  sms_sent_count: 0,
  last_sms_at: null,
  sam_enabled: true,
  status: 'scored',
  skip_trace_status: 'found',
};

const standardLead = {
  id: 'uuid-003',
  owner_name: 'NGUYEN, TRAN',
  phone: '+19725553210',
  phone_type: 'Landline',
  email: 'tran.nguyen@yahoo.com',
  property_address: '1809 Belt Line Rd, Garland, TX 75044',
  county: 'Dallas',
  case_number: 'TX-2024-70122',
  excess_funds_amount: 3150,
  expiry_date: '2026-01-15',
  eleanor_score: 55,
  eleanor_grade: 'B',
  is_golden_lead: false,
  relatives: [],
  previous_addresses: [],
  sms_sent_count: 0,
  last_sms_at: null,
  sam_enabled: true,
  status: 'new',
  skip_trace_status: 'found',
};

const lowValueLead = {
  id: 'uuid-004',
  owner_name: 'SMITH, JAMES',
  phone: '+14695557777',
  phone_type: 'Wireless',
  email: null,
  property_address: '2245 Greenville Ave, Dallas, TX 75206',
  county: 'Dallas',
  case_number: null,
  excess_funds_amount: 485,
  expiry_date: null,
  eleanor_score: 30,
  eleanor_grade: 'C',
  is_golden_lead: false,
  relatives: null,
  previous_addresses: null,
  sms_sent_count: 0,
  last_sms_at: null,
  sam_enabled: true,
  status: 'new',
  skip_trace_status: 'found',
};

const minimalLead = {
  id: 'uuid-005',
  owner_name: null,
  phone: '+12145550000',
  phone_type: null,
  email: null,
  property_address: null,
  county: null,
  case_number: null,
  excess_funds_amount: 0,
  expiry_date: null,
  eleanor_score: 10,
  eleanor_grade: 'D',
  is_golden_lead: false,
  relatives: null,
  previous_addresses: '[]', // string-encoded empty array
  sms_sent_count: 0,
  last_sms_at: null,
  sam_enabled: true,
  status: 'new',
  skip_trace_status: 'found',
};

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function section(title) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function showMsg(label, msg) {
  console.log(`\n--- ${label} (${msg.length} chars, ~${Math.ceil(msg.length / 160)} SMS segments) ---`);
  console.log(msg);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

section('Helper Functions');

assert(_helpers.firstName(goldenLead) === 'Maria', 'firstName parses LASTNAME, FIRSTNAME');
assert(_helpers.firstName(highValueLead) === 'Charles', 'firstName parses LASTNAME, FIRSTNAME MIDDLE');
assert(_helpers.firstName(minimalLead) === 'there', 'firstName defaults to "there" for null');
assert(_helpers.fmtAmount(47250) === '$47,250', 'fmtAmount formats with commas');
assert(_helpers.fmtAmount(485) === '$485', 'fmtAmount handles small amounts');
assert(_helpers.fmtAmount(0) === '$0', 'fmtAmount handles zero');
assert(_helpers.getTier(goldenLead) === 1, 'getTier returns 1 for golden lead');
assert(_helpers.getTier(highValueLead) === 2, 'getTier returns 2 for high value ($5K+)');
assert(_helpers.getTier(standardLead) === 3, 'getTier returns 3 for standard ($1K-$5K)');
assert(_helpers.getTier(lowValueLead) === 4, 'getTier returns 4 for low value (<$1K)');

section('Golden Lead — Initial SMS (Tier 1)');

const goldenInitial = buildInitialSMS(goldenLead);
showMsg('Golden Initial', goldenInitial);
assert(goldenInitial.includes('Maria'), 'Contains first name');
assert(goldenInitial.includes('$47,250'), 'Contains exact dollar amount');
assert(goldenInitial.includes('TX-2024-58291'), 'Contains case number');
assert(goldenInitial.includes('4521 Elm St'), 'Contains property address');
assert(goldenInitial.includes('Dallas County'), 'Contains county');
assert(goldenInitial.includes('cash buyers'), 'Mentions buyer interest');
assert(goldenInitial.includes('Reply 1'), 'Contains CTA');
assert(goldenInitial.includes('Reply STOP to opt out'), 'Contains opt-out');
assert(goldenInitial.length <= 700, `Under 700 chars (actual: ${goldenInitial.length})`);

section('High Value Lead — Initial SMS (Tier 2)');

const highInitial = buildInitialSMS(highValueLead);
showMsg('High Value Initial', highInitial);
assert(highInitial.includes('Charles'), 'Contains first name');
assert(highInitial.includes('$23,800'), 'Contains exact dollar amount');
assert(highInitial.includes('TAR-2024-11034'), 'Contains case number');
assert(highInitial.includes('712 Magnolia Blvd'), 'Contains property address');
assert(highInitial.includes('Tarrant County'), 'Contains county');
assert(highInitial.includes('Reply 1'), 'Contains CTA');
assert(highInitial.includes('Reply STOP to opt out'), 'Contains opt-out');
assert(highInitial.length <= 700, `Under 700 chars (actual: ${highInitial.length})`);

section('Standard Lead — Initial SMS (Tier 3)');

const stdInitial = buildInitialSMS(standardLead);
showMsg('Standard Initial', stdInitial);
assert(stdInitial.includes('Tran'), 'Contains first name');
assert(stdInitial.includes('$3,150'), 'Contains exact dollar amount');
assert(stdInitial.includes('Reply 1'), 'Contains CTA');
assert(stdInitial.includes('Reply STOP to opt out'), 'Contains opt-out');

section('Low Value Lead — Initial SMS (Tier 4)');

const lowInitial = buildInitialSMS(lowValueLead);
showMsg('Low Value Initial', lowInitial);
assert(lowInitial.includes('James'), 'Contains first name');
assert(lowInitial.includes('$485'), 'Contains dollar amount');
assert(lowInitial.includes('Reply 1'), 'Contains CTA');
assert(lowInitial.includes('Reply STOP to opt out'), 'Contains opt-out');
assert(lowInitial.length <= 400, `Shorter message for low value (actual: ${lowInitial.length})`);

section('Minimal Lead — Edge Case');

const minInitial = buildInitialSMS(minimalLead);
showMsg('Minimal Initial', minInitial);
assert(minInitial.includes('there'), 'Falls back to "there" for null name');
assert(minInitial.includes('Reply STOP to opt out'), 'Contains opt-out');

section('Follow-Up 1 (3 days later)');

const fu1 = buildFollowUp1(highValueLead);
showMsg('Follow-Up 1 (High Value)', fu1);
assert(fu1.includes('Charles'), 'Contains first name');
assert(fu1.includes('$23,800'), 'Contains dollar amount');
assert(fu1.includes('following up'), 'Follow-up language');
assert(fu1.includes('-Sam, MaxSam Recovery'), 'Signed by Sam');
assert(fu1.includes('Reply 1'), 'Contains CTA');
assert(fu1.includes('Reply STOP to opt out'), 'Contains opt-out');

section('Follow-Up 2 (7 days later) — With Enriched Data');

const fu2 = buildFollowUp2(highValueLead);
showMsg('Follow-Up 2 (High Value, enriched)', fu2);
assert(fu2.includes('Charles'), 'Contains first name');
assert(fu2.includes('$23,800'), 'Contains dollar amount');
assert(fu2.includes('Dorothy'), 'References relative name (proof of legitimacy)');
assert(fu2.includes('Fort Worth'), 'References previous address city');
assert(fu2.includes('Reply 1'), 'Contains CTA');

const fu2NoEnrich = buildFollowUp2(lowValueLead);
showMsg('Follow-Up 2 (Low Value, no enrichment)', fu2NoEnrich);
assert(!fu2NoEnrich.includes('null'), 'No "null" strings in output');
assert(!fu2NoEnrich.includes('undefined'), 'No "undefined" strings in output');

section('Final Notice (14 days later)');

const final = buildFinalNotice(highValueLead);
showMsg('Final Notice (High Value)', final);
assert(final.includes('Charles'), 'Contains first name');
assert(final.includes('final message'), 'Final message language');
assert(final.includes('close your file'), 'File closure warning');
assert(final.includes('Reply 1'), 'Contains CTA');
assert(final.includes('STOP to opt out'), 'Contains opt-out');

section('Golden Lead — Direct Call');

const goldenDirect = buildGoldenLeadSMS(goldenLead);
showMsg('Golden Lead Direct', goldenDirect);
assert(goldenDirect.includes('1)'), 'Has numbered item 1 (excess funds)');
assert(goldenDirect.includes('2)'), 'Has numbered item 2 (buyer interest)');
assert(goldenDirect.includes('$47,250'), 'Contains exact dollar amount');
assert(goldenDirect.includes('TX-2024-58291'), 'Contains case number');

section('Compliance Checks');

const allMessages = [
  goldenInitial, highInitial, stdInitial, lowInitial, minInitial,
  fu1, fu2, fu2NoEnrich, final, goldenDirect,
];

for (const msg of allMessages) {
  assert(msg.includes('STOP'), 'Every message includes STOP keyword');
  assert(!/[A-Z]{5,}/.test(msg.replace('STOP', '').replace('Reply STOP to opt out', '')),
    'No ALL CAPS words (except STOP)');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(70)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('='.repeat(70));

if (failed > 0) {
  process.exit(1);
}
