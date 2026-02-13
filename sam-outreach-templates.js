/**
 * SAM Outreach SMS Templates — MaxSam V4
 *
 * Tiered, personalized message templates that leverage all enriched lead data.
 * Each function takes a lead object (from Supabase `leads` table) and returns
 * a TCPA-compliant SMS string.
 *
 * RULES:
 * - Professional paralegal tone (recovery services firm, not sales)
 * - Weaponize specificity: name, dollar amount, case #, property address
 * - Urgency via expiry_date when available
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

function urgencyLine(lead) {
  const days = daysUntilExpiry(lead.expiry_date);
  const formatted = fmtDate(lead.expiry_date);
  if (days !== null && days <= 30) {
    return `The filing deadline is ${formatted} — only ${days} days remain.`;
  }
  if (days !== null && days <= 90) {
    return `The deadline to claim is ${formatted}.`;
  }
  if (formatted) {
    return `This must be claimed before ${formatted}.`;
  }
  return 'There is a deadline to file, and unclaimed funds revert to the county.';
}

function countyName(lead) {
  return lead.county || 'Dallas';
}

/**
 * Determine personalization tier:
 *   1 = Golden Lead (dual opportunity)
 *   2 = High value ($5K+)
 *   3 = Standard ($1K–$5K)
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
 * Automatically selects tier based on lead data.
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

  if (tier === 2) {
    // High value ($5K+): Lead with dollar amount, case number, full urgency
    let msg = `${name}, this is Sam with MaxSam Recovery Services. `;
    msg += `${county} County is holding ${amt} in surplus funds from the tax sale of ${addr}`;
    if (caseNum) msg += ` (Case ${caseNum})`;
    msg += `. This money belongs to you as the former owner.\n\n`;
    msg += urgencyLine(lead) + '\n\n';
    msg += 'We handle the entire claims process at no upfront cost — our fee is only collected when you receive your funds.\n\n';
    msg += 'Reply 1 to receive your recovery agreement.\n\n';
    msg += 'Reply STOP to opt out';
    return msg;
  }

  if (tier === 3) {
    // Standard ($1K–$5K): Name + amount + property address
    let msg = `${name}, this is Sam with MaxSam Recovery Services. `;
    msg += `${county} County has ${amt} from the sale of ${addr} that may belong to you.\n\n`;
    msg += urgencyLine(lead) + '\n\n';
    msg += 'We handle the paperwork at no upfront cost.\n\n';
    msg += 'Reply 1 to receive your recovery agreement.\n\n';
    msg += 'Reply STOP to opt out';
    return msg;
  }

  // Tier 4: Low value (<$1K), shorter message
  let msg = `${name}, ${county} County may be holding ${amt} from a property sale that belongs to you.\n\n`;
  msg += 'We can recover it at no upfront cost.\n\n';
  msg += 'Reply 1 for details.\n\n';
  msg += 'Reply STOP to opt out';
  return msg;
}

/**
 * FOLLOW-UP 1 — Sent 3 days after initial.
 * Reinforces legitimacy with specifics.
 */
function buildFollowUp1(lead) {
  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const addr = lead.property_address || 'your former property';
  const caseNum = lead.case_number;

  let msg = `${name}, following up regarding the ${amt} that ${county} County is holding from the sale of ${addr}`;
  if (caseNum) msg += ` (Case ${caseNum})`;
  msg += '.\n\n';
  msg += 'This is your money from the foreclosure surplus. ';
  msg += 'I handle the full claims process — no upfront cost, and I only get paid when you do.\n\n';
  msg += urgencyLine(lead) + '\n\n';
  msg += 'Reply 1 to receive your recovery agreement.\n\n';
  msg += '-Sam, MaxSam Recovery\n';
  msg += 'Reply STOP to opt out';
  return msg;
}

/**
 * FOLLOW-UP 2 — Sent 7 days after initial.
 * More urgent tone, leverages enriched data to prove legitimacy.
 */
function buildFollowUp2(lead) {
  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const addr = lead.property_address || 'your former property';

  let msg = `${name}, I want to make sure you received my previous messages about the ${amt} from ${addr}.\n\n`;

  // If we have relatives data, reference it to prove legitimacy
  const relatives = parseJsonbArray(lead.relatives);
  if (relatives.length > 0) {
    const relName = relatives[0].name;
    if (relName) {
      const formattedRelName = relName.split(/\s+/).map(w => titleCase(w)).join(' ');
      msg += `I reached out because our records associate you and ${formattedRelName} with this property. `;
    }
  }

  // If we have previous addresses, show we did our homework
  const prevAddrs = parseJsonbArray(lead.previous_addresses);
  if (prevAddrs.length > 0 && prevAddrs[0].city) {
    msg += `Our records show your connection to the ${prevAddrs[0].city} area. `;
  }

  msg += `${county} County will not notify you about this — unclaimed funds eventually revert to the county.\n\n`;
  msg += urgencyLine(lead) + '\n\n';
  msg += 'Reply 1 to claim your funds, or reply with any questions.\n\n';
  msg += '-Sam, MaxSam Recovery\n';
  msg += 'Reply STOP to opt out';
  return msg;
}

/**
 * FINAL NOTICE — Sent 14 days after initial.
 * Last chance urgency, clear consequences.
 */
function buildFinalNotice(lead) {
  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const caseNum = lead.case_number;

  let msg = `${name}, this is my final message regarding the ${amt} held by ${county} County`;
  if (caseNum) msg += ` under Case ${caseNum}`;
  msg += '.\n\n';

  const days = daysUntilExpiry(lead.expiry_date);
  if (days !== null && days <= 60) {
    msg += `You have ${days} days before the filing deadline. `;
  }

  msg += 'If I don\'t hear back, I\'ll close your file and this money may go unclaimed.\n\n';
  msg += 'Reply 1 to start your claim, or STOP to opt out.\n\n';
  msg += '-Sam, MaxSam Recovery';
  return msg;
}

/**
 * GOLDEN LEAD SMS — Special dual-opportunity message.
 * For leads on BOTH excess funds AND distressed sellers list.
 */
function buildGoldenLeadSMS(lead) {
  const name = firstName(lead);
  const amt = fmtAmount(lead.excess_funds_amount);
  const county = countyName(lead);
  const addr = lead.property_address || 'your former property';
  const caseNum = lead.case_number;

  let msg = `${name}, this is Sam with MaxSam Recovery Services. I have two items regarding ${addr}:\n\n`;

  // Item 1: Excess funds
  msg += `1) ${county} County is holding ${amt} from the tax sale`;
  if (caseNum) msg += ` (Case ${caseNum})`;
  const expiryFormatted = fmtDate(lead.expiry_date);
  if (expiryFormatted) msg += ` — deadline: ${expiryFormatted}`;
  msg += '. This is owed to you as the prior owner.\n\n';

  // Item 2: Buyer interest
  msg += '2) I also have cash buyers interested in properties in your area — quick close, no repairs needed.\n\n';

  msg += 'I can help with either or both at no upfront cost.\n\n';
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
    daysUntilExpiry,
    urgencyLine,
    getTier,
    parseJsonbArray,
  },
};
