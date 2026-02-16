/**
 * SAM Outreach SMS Templates — MaxSam V4
 *
 * Tiered, personalized message templates that leverage all enriched lead data.
 * Each function takes a lead object (from Supabase `leads` table) and returns
 * a TCPA-compliant SMS string.
 *
 * PERSUASION LAYERS:
 * 1. SPECIFICITY = TRUST: Every message includes exact $ amount, property
 *    address, case number, and expiration date. Never generic.
 * 2. LOSS AVERSION > GAIN FRAMING: Lead with what they'll lose, not gain.
 *    "Your $104,168.04 expires Feb 2028" not "You could receive $104,168.04"
 * 3. SOCIAL PROOF + AUTHORITY: Reference county records, court filings,
 *    tax office. "Per Dallas County records from the February 2024 tax sale..."
 * 4. URGENCY WITHOUT HYPE: Professional paralegal tone. No exclamation marks,
 *    no ALL CAPS, no "ACT NOW." Measured, factual deadlines.
 * 5. RECIPROCITY: We already did the work. "We've already identified your
 *    claim, verified the amount with the county, and prepared the paperwork."
 * 6. FOLLOW-UP ESCALATION: Each message adds new info they didn't have —
 *    a relative's name, a previous address, the exact court.
 *
 * RULES:
 * - Professional paralegal tone (recovery services firm, not sales)
 * - Every data point we have appears in the message
 * - CTA: "Reply 1 to receive your recovery agreement"
 * - Compliance: "Reply STOP to opt out"
 * - Max ~600 chars (3-4 SMS segments)
 * - A2P 10DLC compliant: no ALL CAPS, no spam trigger words
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstName(lead) {
  if (!lead.owner_name) return 'there';
  const name = lead.owner_name.trim();
  // Handle "LASTNAME, FIRSTNAME" format
  if (name.includes(',')) {
    const parts = name.split(',');
    const first = (parts[1] || '').trim().split(/\s+/)[0];
    if (first) return titleCase(first);
  }
  // Handle "FIRSTNAME LASTNAME" format
  const first = name.split(/\s+/)[0];
  return titleCase(first);
}

function titleCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function fmtAmount(amount) {
  if (!amount || amount <= 0) return '$0';
  return '$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

function fmtShortDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
}

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  } catch {
    return null;
  }
}

/**
 * LOSS AVERSION urgency line — frames as what they lose, not what they gain.
 * Includes exact date and countdown when available.
 */
function lossAversionLine(lead) {
  const days = daysUntilExpiry(lead.expiry_date);
  const formatted = fmtDate(lead.expiry_date);
  const amt = fmtAmount(lead.excess_funds_amount);
  if (days !== null && days <= 30) {
    return `Your ${amt} expires ${formatted} — only ${days} days before these funds may be permanently forfeited to the county.`;
  }
  if (days !== null && days <= 90) {
    return `Your ${amt} expires ${formatted} — ${days} days remaining. After the statutory deadline, unclaimed funds revert to the county.`;
  }
  if (days !== null && formatted) {
    return `Your ${amt} expires ${formatted} — ${days} days remaining. The county is under no obligation to notify you before this deadline passes.`;
  }
  if (formatted) {
    return `Your ${amt} must be claimed before ${formatted}. After the statutory deadline, these funds revert to the county permanently.`;
  }
  return `There is a statutory deadline to file. If no claim is made, your ${amt} reverts to the county permanently.`;
}

function countyName(lead) {
  return lead.county || 'Dallas';
}

/**
 * Determine personalization tier:
 *   1 = Golden Lead (dual opportunity)
 *   2 = High value ($5K+)
 *   3 = Standard ($1K-$5K)
 *   4 = Low value (<$1K)
 */
function getTier(lead) {
  if (lead.is_golden_lead) return 1;
  const amt = Number(lead.excess_funds_amount) || 0;
  if (amt >= 5000) return 2;
  if (amt >= 1000) return 3;
  return 4;
}

// ---------------------------------------------------------------------------
// Template builders
// ---------------------------------------------------------------------------

/**
 * INITIAL SMS — First contact. Sent by SAM on first outreach attempt.
 *
 * Persuasion layers active:
 * - SPECIFICITY: exact dollar amount, property address, case number, county
 * - LOSS AVERSION: leads with expiry/forfeiture, not "you could receive"
 * - AUTHORITY: references county records + specific tax sale
 * - RECIPROCITY: "We've already identified and verified your claim"
 */
function buildInitialSMS(lead) {
  const tier = getTier(lead);

  // Golden leads get the special dual-opportunity message
  if (tier === 1) {
    return buildGoldenLeadSMS(lead);
  }

  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const addr = lead.property_address || 'your former property';
  const caseNum = lead.case_number;
  const saleDate = fmtShortDate(lead.sale_date);

  if (tier === 2) {
    // High value ($5K+): Maximum specificity — every data point we have
    let msg = `${name}, this is Sam with MaxSam Recovery Services. `;
    msg += `Per ${county} County records`;
    if (saleDate) msg += ` from the ${saleDate} tax sale`;
    msg += `, ${amt} in surplus funds from ${addr}`;
    if (caseNum) msg += ` (Case ${caseNum})`;
    msg += ` is being held in the county registry.\n\n`;
    msg += lossAversionLine(lead) + '\n\n';
    msg += `We've already identified your claim, verified the amount with the ${county} County tax office, and prepared the filing paperwork. The entire process is handled at no upfront cost to you — our fee is only collected if and when you receive your funds.\n\n`;
    msg += 'Reply 1 to receive your recovery agreement.\n\n';
    msg += 'Reply STOP to opt out';
    return msg;
  }

  if (tier === 3) {
    // Standard ($1K-$5K): Strong specificity, all available data
    let msg = `${name}, this is Sam with MaxSam Recovery Services. `;
    msg += `Per ${county} County records, ${amt} from the sale of ${addr}`;
    if (caseNum) msg += ` (Case ${caseNum})`;
    msg += ` is being held in your name.\n\n`;
    msg += lossAversionLine(lead) + '\n\n';
    msg += `We've already verified your claim and prepared the paperwork. No upfront cost.\n\n`;
    msg += 'Reply 1 to receive your recovery agreement.\n\n';
    msg += 'Reply STOP to opt out';
    return msg;
  }

  // Tier 4: Low value (<$1K) — still specific, just more concise
  let msg = `${name}, per ${county} County records, ${amt} from the sale of ${addr}`;
  if (caseNum) msg += ` (Case ${caseNum})`;
  msg += ' is being held in the county registry.\n\n';
  msg += lossAversionLine(lead) + '\n\n';
  msg += 'We handle the full claims process at no upfront cost.\n\n';
  msg += 'Reply 1 for your recovery agreement.\n\n';
  msg += 'Reply STOP to opt out';
  return msg;
}

/**
 * FOLLOW-UP 1 — Sent 3 days after initial.
 *
 * Persuasion layers active:
 * - SPECIFICITY: repeats exact amount, address, case number
 * - AUTHORITY: references county tax office, court registry
 * - RECIPROCITY: "We've completed our preliminary review"
 * - LOSS AVERSION: deadline + forfeiture language
 *
 * NEW INFO added: references the specific court/tax office holding funds,
 * and the fact we've completed a preliminary title review.
 */
function buildFollowUp1(lead) {
  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const addr = lead.property_address || 'your former property';
  const caseNum = lead.case_number;
  const saleDate = fmtShortDate(lead.sale_date);

  let msg = `${name}, following up regarding the ${amt}`;
  if (saleDate) msg += ` from the ${saleDate} tax sale`;
  msg += ` of ${addr}`;
  if (caseNum) msg += `, Case ${caseNum}`;
  msg += `.\n\n`;
  msg += `We've completed a preliminary review of the ${county} County records and confirmed these funds are held in the court registry pending a valid claim. `;
  msg += `The county does not proactively notify former owners — if no claim is filed, the funds revert to the county.\n\n`;
  msg += lossAversionLine(lead) + '\n\n';
  msg += 'We handle the entire filing process at no upfront cost. Our fee is only collected when you receive your funds.\n\n';
  msg += 'Reply 1 to receive your recovery agreement.\n\n';
  msg += '-Sam, MaxSam Recovery\n';
  msg += 'Reply STOP to opt out';
  return msg;
}

/**
 * FOLLOW-UP 2 — Sent 7 days after initial.
 *
 * Persuasion layers active:
 * - ESCALATION: adds NEW info they didn't have before — relative names,
 *   previous addresses, sale date details
 * - SPECIFICITY: repeats all identifiers
 * - AUTHORITY: references how we found them via county/court records
 * - LOSS AVERSION: county won't notify, permanent forfeiture
 */
function buildFollowUp2(lead) {
  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const addr = lead.property_address || 'your former property';
  const caseNum = lead.case_number;
  const saleDate = fmtShortDate(lead.sale_date);

  let msg = `${name}, I want to ensure you received my previous messages regarding the ${amt} from ${addr}`;
  if (caseNum) msg += ` (Case ${caseNum})`;
  msg += '.\n\n';

  // ESCALATION: If we have relatives data, reference it to prove depth of research
  const relatives = parseJsonbArray(lead.relatives);
  if (relatives.length > 0) {
    const relName = relatives[0].name;
    if (relName) {
      const formattedRelName = relName.split(/\s+/).map(w => titleCase(w)).join(' ');
      msg += `Our research into the ${county} County deed records connected you and ${formattedRelName} to this property. `;
    }
  }

  // ESCALATION: If we have previous addresses, show depth of skip trace
  const prevAddrs = parseJsonbArray(lead.previous_addresses);
  if (prevAddrs.length > 0 && prevAddrs[0].city) {
    msg += `We located you through records associated with the ${prevAddrs[0].city} area. `;
  }

  // AUTHORITY: reference how we found this
  if (saleDate) {
    msg += `Per county filings, these funds have been on deposit since the ${saleDate} sale`;
  } else {
    msg += `Per county filings, these funds have been on deposit since the original tax sale`;
  }
  msg += ` and ${county} County is under no obligation to contact you before the claim window closes.\n\n`;

  msg += lossAversionLine(lead) + '\n\n';
  msg += 'Reply 1 to start your claim, or reply with any questions.\n\n';
  msg += '-Sam, MaxSam Recovery\n';
  msg += 'Reply STOP to opt out';
  return msg;
}

/**
 * FINAL NOTICE — Sent 14 days after initial.
 *
 * Persuasion layers active:
 * - LOSS AVERSION: maximum — permanent forfeiture, file closure, countdown
 * - SPECIFICITY: repeats all identifiers one last time
 * - RECIPROCITY: summarizes all work already done on their behalf
 * - URGENCY WITHOUT HYPE: measured, factual, no exclamation marks
 */
function buildFinalNotice(lead) {
  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const addr = lead.property_address || 'your former property';
  const caseNum = lead.case_number;

  let msg = `${name}, this is my final correspondence regarding the ${amt} held by ${county} County`;
  if (caseNum) msg += ` under Case ${caseNum}`;
  msg += ` from the sale of ${addr}.\n\n`;

  // RECIPROCITY: summarize work already done
  msg += `We have already identified your claim, verified the surplus amount with the county, and prepared the necessary filing documents. `;

  // LOSS AVERSION: specific deadline + consequences
  const days = daysUntilExpiry(lead.expiry_date);
  const formatted = fmtDate(lead.expiry_date);
  if (days !== null && formatted) {
    msg += `The statutory deadline is ${formatted} — ${days} days from today. `;
  }

  msg += 'Without a response, we will close your file and these funds will remain unclaimed in the county registry until they are permanently forfeited.\n\n';
  msg += 'The claims process requires no upfront cost from you.\n\n';
  msg += 'Reply 1 to start your claim, or STOP to opt out.\n\n';
  msg += '-Sam, MaxSam Recovery';
  return msg;
}

/**
 * GOLDEN LEAD SMS — Special dual-opportunity message.
 * For leads on BOTH excess funds AND distressed sellers list.
 *
 * Persuasion layers active:
 * - SPECIFICITY: exact amounts, case numbers, addresses for both opportunities
 * - AUTHORITY: county records + tax sale reference
 * - LOSS AVERSION: expiry on funds, market timing on property
 * - RECIPROCITY: "We've already identified both opportunities"
 */
function buildGoldenLeadSMS(lead) {
  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const addr = lead.property_address || 'your former property';
  const caseNum = lead.case_number;
  const saleDate = fmtShortDate(lead.sale_date);

  let msg = `${name}, this is Sam with MaxSam Recovery Services. Per ${county} County records, we've identified two matters regarding ${addr}:\n\n`;

  // Item 1: Excess funds — loss aversion framing
  msg += `1) ${amt} in surplus funds from the`;
  if (saleDate) msg += ` ${saleDate}`;
  msg += ' tax sale';
  if (caseNum) msg += ` (Case ${caseNum})`;
  const expiryFormatted = fmtDate(lead.expiry_date);
  const days = daysUntilExpiry(lead.expiry_date);
  if (expiryFormatted && days) {
    msg += ` — expires ${expiryFormatted} (${days} days remaining)`;
  } else if (expiryFormatted) {
    msg += ` — expires ${expiryFormatted}`;
  }
  msg += '. These funds are owed to you as the prior owner of record.\n\n';

  // Item 2: Buyer interest
  msg += '2) We also have qualified cash buyers seeking properties in your area — quick close, no repairs required.\n\n';

  // RECIPROCITY
  msg += 'We\'ve already verified both opportunities and prepared the initial paperwork. I can assist with either or both at no upfront cost.\n\n';
  msg += 'Reply 1 for the funds recovery agreement, or reply with any questions.\n\n';
  msg += 'Reply STOP to opt out';
  return msg;
}

// ---------------------------------------------------------------------------
// JSONB parser helper
// ---------------------------------------------------------------------------

function parseJsonbArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  buildInitialSMS,
  buildFollowUp1,
  buildFollowUp2,
  buildFinalNotice,
  buildGoldenLeadSMS,

  // Expose helpers for N8N Code node usage
  _helpers: {
    firstName,
    fmtAmount,
    fmtDate,
    fmtShortDate,
    daysUntilExpiry,
    lossAversionLine,
    getTier,
    parseJsonbArray,
  },
};
