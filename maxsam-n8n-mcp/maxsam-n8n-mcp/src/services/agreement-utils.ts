import { supabaseClient } from './api-clients.js';
import { COMPANY_INFO } from '../constants.js';
import type { AgreementData, AgreementStatus } from '../types.js';
import { formatCurrency } from './property-calculations.js';

/**
 * Generate all data needed for a wholesale agreement
 */
export async function generateAgreementData(
  leadId: string,
  purchasePrice: number,
  earnestMoney: number,
  closingDays: number = 30,
  additionalTerms?: string
): Promise<AgreementData> {
  // Fetch lead data
  const lead = await supabaseClient.getLead(leadId);
  
  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }
  
  // Calculate closing date
  const closingDate = new Date();
  closingDate.setDate(closingDate.getDate() + closingDays);
  
  return {
    leadId,
    sellerName: lead.name as string || 'Unknown',
    sellerPhone: lead.phone as string | undefined,
    sellerEmail: lead.email as string | undefined,
    sellerAddress: lead.address as string || '',
    propertyAddress: lead.address as string || '',
    propertyCity: lead.city as string || '',
    propertyState: lead.state as string || 'TX',
    propertyZip: lead.zip as string || '',
    legalDescription: lead.legal_description as string | undefined,
    purchasePrice,
    earnestMoney,
    closingDate: closingDate.toISOString().split('T')[0],
    closingDays,
    contingencies: [
      'Subject to clear title',
      'Subject to satisfactory inspection within 10 days',
      'Subject to buyer obtaining financing or proof of funds',
    ],
    additionalTerms,
    generatedAt: new Date().toISOString(),
    buyerInfo: {
      name: 'MaxSam Recovery Services, LLC',
      company: COMPANY_INFO.name,
      address: COMPANY_INFO.address,
      phone: COMPANY_INFO.phone,
      email: COMPANY_INFO.email,
    },
  };
}

/**
 * Mark an agreement as sent
 */
export async function markAgreementSent(
  leadId: string,
  agreementId: string,
  sentVia: 'email' | 'sms' | 'docusign' = 'email'
): Promise<AgreementStatus> {
  const sentAt = new Date().toISOString();
  
  await supabaseClient.updateAgreementStatus(leadId, agreementId, 'sent', sentVia);
  
  return {
    leadId,
    agreementId,
    status: 'sent',
    sentVia,
    sentAt,
  };
}

/**
 * Format agreement summary for display
 */
export function formatAgreementSummary(data: AgreementData): string {
  return `📝 AGREEMENT DATA GENERATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏠 PROPERTY
Address: ${data.propertyAddress}
${data.propertyCity}, ${data.propertyState} ${data.propertyZip}

👤 SELLER
Name: ${data.sellerName}
${data.sellerPhone ? `Phone: ${data.sellerPhone}` : ''}
${data.sellerEmail ? `Email: ${data.sellerEmail}` : ''}

💰 TERMS
Purchase Price: ${formatCurrency(data.purchasePrice)}
Earnest Money: ${formatCurrency(data.earnestMoney)}
Closing Date: ${data.closingDate} (${data.closingDays} days)

📋 CONTINGENCIES
${data.contingencies?.map(c => `• ${c}`).join('\n') || 'None'}

${data.additionalTerms ? `📌 ADDITIONAL TERMS\n${data.additionalTerms}\n` : ''}
🏢 BUYER
${data.buyerInfo.company}
${data.buyerInfo.address}
${data.buyerInfo.phone}
${data.buyerInfo.email}

Generated: ${new Date(data.generatedAt).toLocaleString()}`;
}

/**
 * Generate agreement filename
 */
export function generateAgreementFilename(data: AgreementData): string {
  const sanitizedAddress = data.propertyAddress
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 30);
  const date = new Date().toISOString().split('T')[0];
  return `Agreement_${sanitizedAddress}_${date}.pdf`;
}

/**
 * Validate agreement data before sending
 */
export function validateAgreementData(data: AgreementData): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!data.sellerName || data.sellerName === 'Unknown') {
    errors.push('Seller name is required');
  }
  if (!data.propertyAddress) {
    errors.push('Property address is required');
  }
  if (data.purchasePrice <= 0) {
    errors.push('Purchase price must be positive');
  }
  if (data.earnestMoney < 0) {
    errors.push('Earnest money cannot be negative');
  }
  
  // Warnings
  if (!data.sellerPhone && !data.sellerEmail) {
    warnings.push('No seller contact information');
  }
  if (data.earnestMoney < data.purchasePrice * 0.01) {
    warnings.push('Earnest money is less than 1% of purchase price');
  }
  if (data.closingDays < 14) {
    warnings.push('Closing timeline is aggressive (< 14 days)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
