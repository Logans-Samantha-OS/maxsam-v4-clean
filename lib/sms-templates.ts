/**
 * SMS Templates for Sam AI Outreach
 * These are TCPA-compliant message templates for lead outreach
 *
 * PERSUASION LAYERS:
 * 1. SPECIFICITY = TRUST: exact $ amount, property address, case #, expiry date
 * 2. LOSS AVERSION > GAIN FRAMING: lead with forfeiture, not potential gain
 * 3. SOCIAL PROOF + AUTHORITY: county records, court filings, tax office
 * 4. URGENCY WITHOUT HYPE: paralegal tone, no exclamation marks, no ALL CAPS
 * 5. RECIPROCITY: we already did the work — verified, prepared paperwork
 * 6. FOLLOW-UP ESCALATION: each message adds new info they didn't have
 *
 * DATA TO INCLUDE:
 * - first_name, property_address, county, excess_amount, case_number
 * - expiry_date, city, offer_amount, sale_date
 *
 * DATA TO NEVER INCLUDE:
 * - How to file claims themselves
 * - County office contact info
 * - Buyer names or contact info
 * - Claim form details
 */

export interface SMSTemplateData {
  firstName: string;
  propertyAddress: string;
  city: string;
  county: string;
  excessAmount: number;
  caseNumber: string;
  expiryDate: string;
  saleDate: string;
  daysUntilExpiry: number | null;
  offerAmount: number;
  twilioNumber: string;
  hasExcessFunds: boolean;
  hasWholesalePotential: boolean;
  companyName?: string;
}

/**
 * Format currency — exact cents for specificity/trust
 */
function formatAmount(amount: number): string {
  if (!amount || amount === 0) return '$0';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format currency — abbreviated for compact contexts
 */
function formatAmountShort(amount: number): string {
  if (!amount || amount === 0) return '$0';
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

/**
 * Format date for SMS
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === 'soon') return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * LOSS AVERSION line — frames what they lose, not what they gain
 */
function lossAversionLine(data: SMSTemplateData): string {
  const amt = formatAmount(data.excessAmount);
  const dateStr = formatDate(data.expiryDate);
  const days = data.daysUntilExpiry;

  if (days != null && days > 0 && days <= 30 && dateStr) {
    return `Your ${amt} expires ${dateStr} — only ${days} days before these funds may be permanently forfeited to the county.`;
  }
  if (days != null && days > 0 && days <= 90 && dateStr) {
    return `Your ${amt} expires ${dateStr} — ${days} days remaining. After the statutory deadline, unclaimed funds revert to the county.`;
  }
  if (days != null && days > 0 && dateStr) {
    return `Your ${amt} expires ${dateStr} — ${days} days remaining. The county is under no obligation to notify you before this deadline passes.`;
  }
  if (dateStr) {
    return `Your ${amt} must be claimed before ${dateStr}. After the statutory deadline, these funds revert to the county permanently.`;
  }
  return `There is a statutory deadline to file. If no claim is made, your ${amt} reverts to the county permanently.`;
}

// ============================================================================
// MAIN TEMPLATES - Three types based on deal potential
// ============================================================================

/**
 * EXCESS_FUNDS Template
 * For leads with excess funds but no wholesale potential
 *
 * Layers: SPECIFICITY, LOSS AVERSION, AUTHORITY, RECIPROCITY
 */
export const TEMPLATE_EXCESS_FUNDS = (data: SMSTemplateData) => {
  const amt = formatAmount(data.excessAmount);
  const caseRef = data.caseNumber ? ` (Case #${data.caseNumber})` : '';
  const saleDateRef = data.saleDate && data.saleDate !== 'soon'
    ? ` from the ${formatDate(data.saleDate) || data.saleDate} tax sale`
    : '';

  return `${data.firstName}, this is Sam with MaxSam Recovery Services. Per ${data.county} County records${saleDateRef}, ${amt} in surplus funds from ${data.propertyAddress}${caseRef} is being held in the county registry.

${lossAversionLine(data)}

We've already identified your claim, verified the amount with the ${data.county} County tax office, and prepared the filing paperwork. The entire process is handled at no upfront cost — our fee is only collected when you receive your funds.

Reply 1 to receive your recovery agreement.

Reply STOP to opt out`;
};

/**
 * WHOLESALE Template
 * For leads with wholesale potential but no excess funds
 *
 * Layers: SPECIFICITY, AUTHORITY (recent sales data), RECIPROCITY
 */
export const TEMPLATE_WHOLESALE = (data: SMSTemplateData) =>
`${data.firstName}, this is Sam with MaxSam Recovery Services. Per ${data.county} County records, we've identified your property at ${data.propertyAddress}.

Based on recent comparable sales in ${data.city}, qualified cash buyers in our network are offering around ${formatAmountShort(data.offerAmount)} for properties in your area. No repairs needed, no agent fees, close in as few as 14 days.

We've already completed a preliminary valuation and have interested buyers.

Reply 1 to receive a written offer, or reply with any questions.

Reply STOP to opt out`;

/**
 * GOLDEN Template
 * For leads with BOTH excess funds AND wholesale potential
 *
 * Layers: SPECIFICITY (exact amounts both), LOSS AVERSION, AUTHORITY, RECIPROCITY
 */
export const TEMPLATE_GOLDEN = (data: SMSTemplateData) => {
  const amt = formatAmount(data.excessAmount);
  const caseRef = data.caseNumber ? ` (Case #${data.caseNumber}` : '';
  const saleDateRef = data.saleDate && data.saleDate !== 'soon'
    ? ` from the ${formatDate(data.saleDate) || data.saleDate} tax sale`
    : '';

  let expiryRef = '';
  const dateStr = formatDate(data.expiryDate);
  if (dateStr && data.daysUntilExpiry && data.daysUntilExpiry > 0) {
    expiryRef = `, expires ${dateStr} — ${data.daysUntilExpiry} days remaining`;
  } else if (dateStr) {
    expiryRef = `, expires ${dateStr}`;
  }

  const caseClose = caseRef ? (expiryRef ? `${expiryRef})` : ')') : '';
  const expiryOnly = !caseRef && expiryRef ? ` —${expiryRef.substring(1)}` : '';

  return `${data.firstName}, this is Sam with MaxSam Recovery Services. Per ${data.county} County records, we've identified two matters regarding ${data.propertyAddress}:

1) ${amt} in surplus funds${saleDateRef}${caseRef}${caseClose}${expiryOnly}. These funds are owed to you as the prior owner of record.

2) Qualified cash buyers in our network are paying ${formatAmountShort(data.offerAmount)}+ for properties in ${data.city} — quick close, no repairs required.

We've already verified both opportunities and prepared the initial paperwork. I can assist with either or both at no upfront cost.

Reply 1 for the funds recovery agreement, or reply with any questions.

Reply STOP to opt out`;
};

// ============================================================================
// FOLLOW-UP & STATUS TEMPLATES
// ============================================================================

export const SMS_TEMPLATES = {
  /**
   * Initial outreach - Dynamically selected based on deal type
   */
  initial: (data: SMSTemplateData) => {
    // Use new template selection logic
    if (data.hasExcessFunds && data.hasWholesalePotential) {
      return TEMPLATE_GOLDEN(data);
    } else if (data.hasExcessFunds && !data.hasWholesalePotential) {
      return TEMPLATE_EXCESS_FUNDS(data);
    } else if (!data.hasExcessFunds && data.hasWholesalePotential) {
      return TEMPLATE_WHOLESALE(data);
    }
    // Fallback to excess funds template
    return TEMPLATE_EXCESS_FUNDS(data);
  },

  /**
   * First follow-up (Day 2-3)
   *
   * ESCALATION: adds preliminary title review, county registry confirmation
   * AUTHORITY: references specific county tax office + court registry
   * RECIPROCITY: "completed a preliminary review"
   * LOSS AVERSION: county won't notify them
   */
  followUp1: (data: SMSTemplateData) => {
    const amt = formatAmount(data.excessAmount);
    const caseRef = data.caseNumber ? `, Case #${data.caseNumber}` : '';
    const saleDateRef = data.saleDate && data.saleDate !== 'soon'
      ? ` from the ${formatDate(data.saleDate) || data.saleDate} tax sale`
      : '';

    return `${data.firstName}, following up regarding the ${amt}${saleDateRef} of ${data.propertyAddress}${caseRef}.

We've completed a preliminary review of the ${data.county} County records and confirmed these funds are held in the court registry pending a valid claim. The county does not proactively notify former owners — if no claim is filed, the funds revert to the county.

${lossAversionLine(data)}

We handle the entire filing process at no upfront cost. Our fee is only collected when you receive your funds.

Reply 1 to receive your recovery agreement.

-Sam, MaxSam Recovery
Reply STOP to opt out`;
  },

  /**
   * Second follow-up (Day 5-7)
   *
   * ESCALATION: adds "your money" ownership language, deposit timeline
   * AUTHORITY: "per county filings", references deposit date
   * LOSS AVERSION: maximum — funds on deposit unclaimed, county keeps them
   */
  followUp2: (data: SMSTemplateData) => {
    const amt = formatAmount(data.excessAmount);
    const caseRef = data.caseNumber ? ` (Case #${data.caseNumber})` : '';
    const saleDateRef = data.saleDate && data.saleDate !== 'soon'
      ? `Per county filings, these funds have been on deposit since the ${formatDate(data.saleDate) || data.saleDate} sale`
      : 'Per county filings, these funds have been on deposit since the original tax sale';

    return `${data.firstName}, I want to ensure you received my previous messages regarding the ${amt} from ${data.propertyAddress}${caseRef}.

${saleDateRef} and ${data.county} County is under no obligation to contact you before the claim window closes.

${lossAversionLine(data)}

We have already verified your entitlement and prepared the necessary filing documents. The claims process requires no upfront cost from you.

Reply 1 to start your claim, or reply with any questions.

-Sam, MaxSam Recovery
Reply STOP to opt out`;
  },

  /**
   * Final attempt (Day 10-14)
   *
   * LOSS AVERSION: maximum — file closure, permanent forfeiture, countdown
   * RECIPROCITY: summarizes all work already completed
   * SPECIFICITY: repeats every identifier one final time
   * URGENCY WITHOUT HYPE: measured, factual, no exclamation marks
   */
  final: (data: SMSTemplateData) => {
    const amt = formatAmount(data.excessAmount);
    const caseRef = data.caseNumber ? ` under Case #${data.caseNumber}` : '';
    const days = data.daysUntilExpiry;
    const dateStr = formatDate(data.expiryDate);
    const deadlineRef = (days != null && days > 0 && dateStr)
      ? `The statutory deadline is ${dateStr} — ${days} days from today. `
      : '';

    return `${data.firstName}, this is my final correspondence regarding the ${amt} held by ${data.county} County${caseRef} from the sale of ${data.propertyAddress}.

We have already identified your claim, verified the surplus amount with the county, and prepared the necessary filing documents. ${deadlineRef}Without a response, we will close your file and these funds will remain unclaimed in the county registry until they are permanently forfeited.

The claims process requires no upfront cost from you.

Reply 1 to start your claim, or STOP to opt out.

-Sam, MaxSam Recovery`;
  },

  /**
   * Qualified lead - They responded YES
   */
  qualified: (data: SMSTemplateData) => {
    const amt = formatAmount(data.excessAmount);
    return `${data.firstName}, thank you for your response. We will now prepare the formal documentation for your ${amt} recovery from ${data.county} County.

You will receive an agreement via text shortly. As a reminder, there is no upfront cost — our fee is contingent on successful recovery of your funds.

Reply here with any questions.

-Sam, MaxSam Recovery`;
  },

  /**
   * Contract sent confirmation
   */
  contractSent: (data: SMSTemplateData) => {
    const amt = formatAmount(data.excessAmount);
    return `${data.firstName}, your recovery agreement for the ${amt} from ${data.propertyAddress} has been sent. Check your texts for a secure signing link.

The agreement can be signed electronically in under 60 seconds. Once signed, we begin the filing process with ${data.county} County immediately.

Reply here with any questions.

-Sam, MaxSam Recovery`;
  },

  /**
   * Contract signed - Thank you
   */
  contractSigned: (data: SMSTemplateData) => {
    const amt = formatAmount(data.excessAmount);
    return `${data.firstName}, your agreement has been received and recorded. We are now initiating the claims process with ${data.county} County for your ${amt} recovery.

We will provide status updates as your claim progresses. Most claims are resolved within 30-60 days.

-Sam, MaxSam Recovery`;
  },

  /**
   * Wholesale opportunity - Dedicated wholesale pitch
   */
  wholesaleInitial: (data: SMSTemplateData) => TEMPLATE_WHOLESALE(data),

  /**
   * Dual opportunity - Golden lead pitch
   */
  dualInitial: (data: SMSTemplateData) => TEMPLATE_GOLDEN(data),

  /**
   * Excess funds only - Dedicated excess pitch
   */
  excessInitial: (data: SMSTemplateData) => TEMPLATE_EXCESS_FUNDS(data),

  /**
   * Golden lead - Priority pitch
   */
  golden: (data: SMSTemplateData) => TEMPLATE_GOLDEN(data),
};

/**
 * Template type selection based on deal potential
 */
export type TemplateType = 'EXCESS_FUNDS' | 'WHOLESALE' | 'GOLDEN';

/**
 * Select template type based on lead data
 *
 * Logic:
 * - IF has_excess_funds AND has_wholesale_potential -> GOLDEN
 * - IF has_excess_funds AND NOT has_wholesale_potential -> EXCESS_FUNDS
 * - IF NOT has_excess_funds AND has_wholesale_potential -> WHOLESALE
 */
export function selectTemplateType(
  hasExcessFunds: boolean,
  hasWholesalePotential: boolean
): TemplateType {
  if (hasExcessFunds && hasWholesalePotential) {
    return 'GOLDEN';
  } else if (hasExcessFunds && !hasWholesalePotential) {
    return 'EXCESS_FUNDS';
  } else if (!hasExcessFunds && hasWholesalePotential) {
    return 'WHOLESALE';
  }
  // Default to excess funds if neither (shouldn't reach lead anyway)
  return 'EXCESS_FUNDS';
}

/**
 * Get template function by type
 */
export function getTemplateByType(type: TemplateType): (data: SMSTemplateData) => string {
  switch (type) {
    case 'GOLDEN':
      return TEMPLATE_GOLDEN;
    case 'WHOLESALE':
      return TEMPLATE_WHOLESALE;
    case 'EXCESS_FUNDS':
    default:
      return TEMPLATE_EXCESS_FUNDS;
  }
}

/**
 * Get the appropriate template based on lead state and contact attempts
 */
export function getNextTemplate(
  contactAttempts: number,
  dealType: 'dual' | 'excess_only' | 'wholesale',
  status: string
): keyof typeof SMS_TEMPLATES | null {
  // If already qualified, use qualified template
  if (status === 'qualified') {
    return 'qualified';
  }

  // If contract sent, use contract sent template
  if (status === 'contract_sent') {
    return 'contractSent';
  }

  // Initial outreach based on deal type
  if (contactAttempts === 0) {
    if (dealType === 'dual') {
      return 'dualInitial';
    } else if (dealType === 'wholesale') {
      return 'wholesaleInitial';
    }
    return 'excessInitial';
  }

  // Follow-up sequence
  if (contactAttempts === 1) {
    return 'followUp1';
  }

  if (contactAttempts === 2) {
    return 'followUp2';
  }

  if (contactAttempts === 3 || contactAttempts === 4) {
    return 'final';
  }

  // Max attempts reached
  return null;
}

/**
 * Calculate offer amount for wholesale
 *
 * Uses:
 * - eleanor_calculated_offer if available
 * - OR assessed_value * 0.90 as fallback
 */
export function calculateOfferAmount(lead: {
  eleanor_calculated_offer?: number | null;
  assessed_value?: number | null;
  estimated_arv?: number | null;
  excess_funds_amount?: number | null;
}): number {
  // Priority 1: Eleanor calculated offer
  if (lead.eleanor_calculated_offer && lead.eleanor_calculated_offer > 0) {
    return lead.eleanor_calculated_offer;
  }

  // Priority 2: 90% of assessed value
  if (lead.assessed_value && lead.assessed_value > 0) {
    return Math.round(lead.assessed_value * 0.90);
  }

  // Priority 3: Estimated ARV at 70% (typical wholesale offer)
  if (lead.estimated_arv && lead.estimated_arv > 0) {
    return Math.round(lead.estimated_arv * 0.70);
  }

  // Priority 4: Use excess funds * 3 as rough estimate (last resort)
  if (lead.excess_funds_amount && lead.excess_funds_amount > 0) {
    return Math.round(lead.excess_funds_amount * 3 * 0.70);
  }

  // Default: $50K placeholder (shouldn't reach here)
  return 50000;
}

/**
 * Determine if lead has wholesale potential
 */
export function hasWholesalePotential(lead: {
  estimated_equity?: number | null;
  estimated_arv?: number | null;
  assessed_value?: number | null;
  is_golden_lead?: boolean | null;
  golden_lead?: boolean | null;
}): boolean {
  // Golden leads always have wholesale potential
  if (lead.is_golden_lead || lead.golden_lead) {
    return true;
  }

  // Equity >= $20K indicates wholesale potential
  if (lead.estimated_equity && lead.estimated_equity >= 20000) {
    return true;
  }

  // Has ARV or assessed value (property can be sold)
  if ((lead.estimated_arv && lead.estimated_arv > 50000) ||
      (lead.assessed_value && lead.assessed_value > 50000)) {
    return true;
  }

  return false;
}

/**
 * Compute days until expiry from a date string
 */
function computeDaysUntilExpiry(dateStr: string | null | undefined): number | null {
  if (!dateStr || dateStr === 'soon') return null;
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
 * Build template data from lead
 */
export function buildTemplateData(lead: {
  owner_name?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  city?: string | null;
  county?: string | null;
  county_name?: string | null;
  excess_funds_amount?: number | null;
  case_number?: string | null;
  excess_funds_expiry_date?: string | null;
  expiration_date?: string | null;
  expiry_date?: string | null;
  sale_date?: string | null;
  eleanor_calculated_offer?: number | null;
  assessed_value?: number | null;
  estimated_arv?: number | null;
  estimated_equity?: number | null;
  is_golden_lead?: boolean | null;
  golden_lead?: boolean | null;
}): SMSTemplateData {
  // Extract first name from owner_name
  let firstName = 'there';
  if (lead.owner_name) {
    const nameParts = lead.owner_name.split(/[,\s]+/);
    // Handle "LASTNAME, FIRSTNAME" format
    if (lead.owner_name.includes(',') && nameParts.length >= 2) {
      firstName = nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1).toLowerCase();
    } else {
      firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
    }
  }

  // Get city
  const city = lead.property_city || lead.city || 'your area';

  // Get county
  const county = lead.county || lead.county_name || 'Dallas';

  // Get expiry date
  const expiryDateRaw = lead.excess_funds_expiry_date || lead.expiration_date || lead.expiry_date;
  const expiryDate = formatDate(expiryDateRaw) || 'soon';

  // Get sale date
  const saleDateRaw = lead.sale_date;
  const saleDate = formatDate(saleDateRaw) || '';

  // Calculate offer amount
  const offerAmount = calculateOfferAmount(lead);

  // Compute days until expiry
  const daysUntilExpiry = computeDaysUntilExpiry(expiryDateRaw);

  // Determine deal potential
  const hasExcess = (lead.excess_funds_amount || 0) >= 5000;
  const hasWholesale = hasWholesalePotential(lead);

  return {
    firstName,
    propertyAddress: lead.property_address || 'your property',
    city,
    county,
    excessAmount: Number(lead.excess_funds_amount) || 0,
    caseNumber: lead.case_number || '',
    expiryDate,
    saleDate,
    daysUntilExpiry,
    offerAmount,
    twilioNumber: process.env.TWILIO_PHONE_NUMBER || '',
    hasExcessFunds: hasExcess,
    hasWholesalePotential: hasWholesale,
    companyName: 'MaxSam Real Estate'
  };
}

/**
 * Get the complete message for a lead
 */
export function getMessageForLead(
  lead: Parameters<typeof buildTemplateData>[0],
  contactAttempts: number,
  status: string
): { message: string; templateType: TemplateType; templateKey: string } | null {
  const data = buildTemplateData(lead);

  // Determine deal type
  const dealType: 'dual' | 'excess_only' | 'wholesale' =
    data.hasExcessFunds && data.hasWholesalePotential ? 'dual' :
    data.hasExcessFunds ? 'excess_only' : 'wholesale';

  // Get template key
  const templateKey = getNextTemplate(contactAttempts, dealType, status);
  if (!templateKey) {
    return null; // Max attempts reached
  }

  // Get template and generate message
  const template = SMS_TEMPLATES[templateKey];
  const message = template(data);

  // Determine template type for logging
  const templateType = selectTemplateType(data.hasExcessFunds, data.hasWholesalePotential);

  return {
    message,
    templateType,
    templateKey
  };
}
