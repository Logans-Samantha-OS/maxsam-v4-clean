/**
 * SMS Templates for Sam AI Outreach
 * These are TCPA-compliant message templates for lead outreach
 *
 * DATA TO INCLUDE:
 * - first_name, property_address, county, excess_amount, case_number
 * - expiry_date, city, offer_amount
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
  offerAmount: number;
  twilioNumber: string;
  hasExcessFunds: boolean;
  hasWholesalePotential: boolean;
  companyName?: string;
}

/**
 * Format currency for SMS
 */
function formatAmount(amount: number): string {
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
  if (!dateStr) return 'soon';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'soon';
  }
}

// ============================================================================
// MAIN TEMPLATES - Three types based on deal potential
// ============================================================================

/**
 * EXCESS_FUNDS Template
 * For leads with excess funds but no wholesale potential
 */
export const TEMPLATE_EXCESS_FUNDS = (data: SMSTemplateData) =>
`${data.firstName} - ${data.county} County has ${formatAmount(data.excessAmount)} from ${data.propertyAddress}${data.caseNumber ? ` (Case #${data.caseNumber})` : ''}.

This expires ${data.expiryDate} and requires specific paperwork to claim.

I handle the entire process - no upfront cost, I only get paid when you do.

Want me to recover this for you? Reply YES

Text STOP to opt-out`;

/**
 * WHOLESALE Template
 * For leads with wholesale potential but no excess funds
 */
export const TEMPLATE_WHOLESALE = (data: SMSTemplateData) =>
`${data.firstName} - I work with cash buyers looking for properties like ${data.propertyAddress}.

Based on recent sales in ${data.city}, they're offering around ${formatAmount(data.offerAmount)} for homes in your area. No repairs, no fees, close in 2 weeks.

Want to see what they'd offer? Reply YES

Text STOP to opt-out`;

/**
 * GOLDEN Template
 * For leads with BOTH excess funds AND wholesale potential
 */
export const TEMPLATE_GOLDEN = (data: SMSTemplateData) =>
`${data.firstName} - Two things about ${data.propertyAddress}:

1) ${data.county} County is holding ${formatAmount(data.excessAmount)} for you${data.caseNumber ? ` (Case #${data.caseNumber}` : ''}${data.expiryDate ? `, expires ${data.expiryDate})` : ')'}

2) I have buyers paying ${formatAmount(data.offerAmount)}+ for properties in ${data.city}

I can help with either or both - no upfront cost.

Interested? Reply YES

Text STOP to opt-out`;

// ============================================================================
// LEGACY TEMPLATES - Kept for follow-up sequences
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
   * First follow-up (Day 1-2)
   */
  followUp1: (data: SMSTemplateData) =>
`${data.firstName}, following up about ${data.propertyAddress} in ${data.city}.

${data.county} County has ${formatAmount(data.excessAmount)} waiting${data.caseNumber ? ` (Case #${data.caseNumber})` : ''}.

I handle all paperwork at no upfront cost - I only get paid if you do.

Interested? Reply YES

-Sam`,

  /**
   * Second follow-up (Day 3-4)
   */
  followUp2: (data: SMSTemplateData) =>
`${data.firstName}, wanted to make sure you saw my messages about the ${formatAmount(data.excessAmount)} from ${data.propertyAddress}.

This is YOUR money from the foreclosure sale${data.expiryDate ? ` and it expires ${data.expiryDate}` : ''}.

Reply YES to learn how I can recover it for you.

-Sam`,

  /**
   * Final attempt (Day 5-7)
   */
  final: (data: SMSTemplateData) =>
`${data.firstName}, last message about ${formatAmount(data.excessAmount)} in ${data.county} County${data.caseNumber ? ` (Case #${data.caseNumber})` : ''}.

If I don't hear back, I'll close your file. This money will go unclaimed.

Reply YES to claim it, or STOP to opt out.

-Sam`,

  /**
   * Qualified lead - They responded YES
   */
  qualified: (data: SMSTemplateData) =>
`Great, ${data.firstName}! I'll prepare your paperwork for the ${formatAmount(data.excessAmount)} recovery.

You'll receive an agreement via text shortly. No upfront cost - we only get paid when you do.

Questions? Reply here.

-Sam`,

  /**
   * Contract sent confirmation
   */
  contractSent: (data: SMSTemplateData) =>
`${data.firstName}, I just sent your agreement for the ${formatAmount(data.excessAmount)} recovery from ${data.propertyAddress}.

Check your texts for a signing link. Sign it and we start working immediately.

Questions? Reply here.

-Sam`,

  /**
   * Contract signed - Thank you
   */
  contractSigned: (data: SMSTemplateData) =>
`${data.firstName}, thank you for signing! We're processing your ${formatAmount(data.excessAmount)} claim now.

I'll keep you updated. Most claims complete within 30-60 days.

-Sam`,

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
 * - IF has_excess_funds AND has_wholesale_potential → GOLDEN
 * - IF has_excess_funds AND NOT has_wholesale_potential → EXCESS_FUNDS
 * - IF NOT has_excess_funds AND has_wholesale_potential → WHOLESALE
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
  const expiryDateRaw = lead.excess_funds_expiry_date || lead.expiration_date;
  const expiryDate = formatDate(expiryDateRaw);

  // Calculate offer amount
  const offerAmount = calculateOfferAmount(lead);

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
