/**
 * SMS Templates for Sam AI Outreach
 * These are TCPA-compliant message templates for lead outreach
 */

export interface SMSTemplateData {
  firstName: string;
  propertyAddress: string;
  excessAmount: number;
  twilioNumber: string;
  deadlineDate?: string;
  companyName?: string;
}

/**
 * Format currency for SMS
 */
function formatAmount(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

/**
 * SMS Templates by outreach stage
 */
export const SMS_TEMPLATES = {
  /**
   * Initial outreach - First contact
   */
  initial: (data: SMSTemplateData) =>
`Hi ${data.firstName}, this is Sam with MaxSam Real Estate.

I have important info about potential funds owed to you from ${data.propertyAddress}.

We may be able to help you recover ${formatAmount(data.excessAmount)} that you're entitled to.

Can we schedule a quick 10-min call? Reply YES and I'll send details.

-Sam
Text STOP to opt-out`,

  /**
   * First follow-up (Day 1-2)
   */
  followUp1: (data: SMSTemplateData) =>
`${data.firstName}, following up on my message about ${data.propertyAddress}.

There's ${formatAmount(data.excessAmount)} in excess funds you may qualify for.

We handle all the paperwork at no upfront cost. Our fee is only 25% if we successfully recover funds.

Interested? Reply YES or call ${data.twilioNumber}

-Sam`,

  /**
   * Second follow-up (Day 3-4)
   */
  followUp2: (data: SMSTemplateData) =>
`${data.firstName}, I wanted to make sure you saw my messages about the ${formatAmount(data.excessAmount)} from ${data.propertyAddress}.

Many people don't know they're entitled to these funds after a foreclosure sale.

I'd love to help you claim what's yours. Reply YES to learn more.

-Sam`,

  /**
   * Final attempt (Day 5-7)
   */
  final: (data: SMSTemplateData) =>
`${data.firstName}, last attempt to reach you about ${formatAmount(data.excessAmount)} in excess funds.

This is a time-sensitive opportunity. If I don't hear back by ${data.deadlineDate}, I'll have to close your file.

Reply YES to claim these funds.

-Sam with MaxSam Real Estate`,

  /**
   * Qualified lead - They responded YES
   */
  qualified: (data: SMSTemplateData) =>
`Great news, ${data.firstName}! I'll have our team prepare the paperwork for your ${formatAmount(data.excessAmount)} recovery claim.

You'll receive a DocuSign agreement shortly. No upfront costs - we only get paid if you get paid.

Questions? Call ${data.twilioNumber}

-Sam`,

  /**
   * Contract sent confirmation
   */
  contractSent: (data: SMSTemplateData) =>
`${data.firstName}, I just sent the agreement to your email for the ${formatAmount(data.excessAmount)} recovery.

Please check your email and spam folder for a DocuSign from MaxSam Real Estate.

Questions? Reply here or call ${data.twilioNumber}

-Sam`,

  /**
   * Contract signed - Thank you
   */
  contractSigned: (data: SMSTemplateData) =>
`${data.firstName}, thank you for signing! We'll start processing your ${formatAmount(data.excessAmount)} claim right away.

We'll keep you updated on the progress. Most claims are processed within 30-60 days.

-Sam`,

  /**
   * Wholesale opportunity - Different pitch
   */
  wholesaleInitial: (data: SMSTemplateData) =>
`Hi ${data.firstName}, I'm Sam with MaxSam Real Estate.

We're looking to buy properties in your area and noticed ${data.propertyAddress}.

Are you interested in selling? We can make a cash offer within 24 hours.

Reply YES if you'd like to hear our offer.

-Sam
Text STOP to opt-out`,

  /**
   * Dual opportunity - Best pitch
   */
  dualInitial: (data: SMSTemplateData) =>
`Hi ${data.firstName}, this is Sam with MaxSam Real Estate.

I have GREAT news - you may be entitled to ${formatAmount(data.excessAmount)} in excess funds from ${data.propertyAddress}.

PLUS, we may be interested in buying the property if you're looking to sell.

Can we talk for 10 minutes? Reply YES.

-Sam
Text STOP to opt-out`
};

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
    return 'initial';
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
 * Build template data from lead
 */
export function buildTemplateData(lead: {
  owner_name?: string | null;
  property_address?: string | null;
  excess_funds_amount?: number | null;
}): SMSTemplateData {
  const firstName = lead.owner_name?.split(' ')[0] || 'there';

  return {
    firstName,
    propertyAddress: lead.property_address || 'your property',
    excessAmount: Number(lead.excess_funds_amount) || 0,
    twilioNumber: process.env.TWILIO_PHONE_NUMBER || '',
    deadlineDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }),
    companyName: 'MaxSam Real Estate'
  };
}
