/**
 * Contract Generator for MaxSam V4
 * Generates and sends DocuSign contracts for leads
 */

import { createEnvelope, isDocuSignConfigured } from './docusign';
import { createClient } from './supabase/server';
import { calculateFees } from './eleanor';
import * as fs from 'fs';
import * as path from 'path';

export type ContractType = 'excess_funds' | 'wholesale' | 'dual';

interface Lead {
  id: string;
  owner_name?: string | null;
  email?: string | null;
  phone?: string | null;
  property_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  case_number?: string | null;
  excess_funds_amount?: number | null;
  estimated_arv?: number | null;
  estimated_repair_cost?: number | null;
}

interface SystemConfig {
  legal_entity_name: string;
  business_address: string;
  signer_title: string;
  excess_funds_fee_percent: string;
  wholesale_fee_percent: string;
}

interface GenerateContractResult {
  success: boolean;
  contractId?: string;
  envelopeId?: string;
  error?: string;
}

/**
 * Get system configuration from database
 */
async function getSystemConfig(): Promise<SystemConfig> {
  const supabase = createClient();

  const { data: configs } = await supabase
    .from('system_config')
    .select('key, value');

  const configMap = Object.fromEntries(
    (configs || []).map(c => [c.key, c.value])
  );

  return {
    legal_entity_name: configMap.legal_entity_name || process.env.LEGAL_ENTITY_NAME || 'Logan Toups',
    business_address: configMap.business_address || process.env.BUSINESS_ADDRESS || 'Richardson, TX',
    signer_title: configMap.signer_title || process.env.SIGNER_TITLE || 'Real Estate Investor',
    excess_funds_fee_percent: configMap.excess_funds_fee_percent || '25',
    wholesale_fee_percent: configMap.wholesale_fee_percent || '10'
  };
}

/**
 * Load and populate a contract template
 */
function loadTemplate(templateName: string, replacements: Record<string, string>): string {
  const templatePath = path.join(process.cwd(), 'templates', `${templateName}.html`);
  let template = fs.readFileSync(templatePath, 'utf-8');

  // Replace all placeholders
  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  return template;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });
}

/**
 * Generate and send a contract for a lead
 */
export async function generateContract(
  leadId: string,
  contractType: ContractType
): Promise<GenerateContractResult> {
  const supabase = createClient();

  // Check DocuSign configuration
  if (!isDocuSignConfigured()) {
    return {
      success: false,
      error: 'DocuSign not configured. Set DOCUSIGN_* environment variables.'
    };
  }

  // Get lead data
  const { data: lead, error: leadError } = await supabase
    .from('maxsam_leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    return {
      success: false,
      error: `Lead not found: ${leadError?.message || 'No data'}`
    };
  }

  // Validate required fields
  if (!lead.email) {
    return {
      success: false,
      error: 'Lead does not have an email address. Skip trace or manually add email first.'
    };
  }

  if (!lead.owner_name) {
    return {
      success: false,
      error: 'Lead does not have an owner name.'
    };
  }

  // Get system config
  const config = await getSystemConfig();

  // Calculate fees
  const excessAmount = Number(lead.excess_funds_amount) || 0;
  const arv = Number(lead.estimated_arv) || (excessAmount * 3);
  const repairCost = Number(lead.estimated_repair_cost) || (arv * 0.15);
  const equity = arv - repairCost - (arv * 0.70);

  const fees = calculateFees(excessAmount, equity, contractType);

  // Calculate dates
  const today = new Date();
  const inspectionEnd = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
  const closingDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Build replacements object
  const replacements: Record<string, string> = {
    'OWNER_NAME': lead.owner_name || 'Property Owner',
    'SELLER_NAME': lead.owner_name || 'Property Owner',
    'PROPERTY_ADDRESS': lead.property_address || '',
    'CITY': lead.city || '',
    'STATE': lead.state || 'TX',
    'ZIP_CODE': lead.zip_code || '',
    'CASE_NUMBER': lead.case_number || 'N/A',
    'EXCESS_AMOUNT': formatCurrency(excessAmount),
    'EXCESS_FEE_PERCENT': '25',
    'EXCESS_FEE_AMOUNT': formatCurrency(fees.excessFee),
    'PURCHASE_PRICE': formatCurrency(arv * 0.70),
    'ASSIGNMENT_FEE': formatCurrency(fees.wholesaleFee),
    'TOTAL_FEE': formatCurrency(fees.totalFee),
    'CONTRACT_DATE': today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    'INSPECTION_START': today.toLocaleDateString('en-US'),
    'INSPECTION_END': inspectionEnd.toLocaleDateString('en-US'),
    'CLOSING_DATE': closingDate.toLocaleDateString('en-US'),
    'EARNEST_MONEY': '$500.00',
    'LEGAL_ENTITY_NAME': config.legal_entity_name,
    'BUSINESS_ADDRESS': config.business_address,
    'SIGNER_TITLE': config.signer_title
  };

  // Select template based on contract type
  let templateName: string;
  switch (contractType) {
    case 'excess_funds':
      templateName = 'excess-funds-recovery';
      break;
    case 'wholesale':
      templateName = 'wholesale-assignment';
      break;
    case 'dual':
      templateName = 'dual-deal';
      break;
    default:
      return { success: false, error: `Invalid contract type: ${contractType}` };
  }

  // Load and populate template
  let templateHtml: string;
  try {
    templateHtml = loadTemplate(templateName, replacements);
  } catch (error) {
    return {
      success: false,
      error: `Failed to load template: ${templateName}. ${error}`
    };
  }

  // Create email subject
  const emailSubject = contractType === 'excess_funds'
    ? `Action Required: Excess Funds Recovery Agreement - ${lead.property_address}`
    : contractType === 'wholesale'
    ? `Action Required: Property Purchase Agreement - ${lead.property_address}`
    : `Action Required: Combined Services Agreement - ${lead.property_address}`;

  try {
    // Create DocuSign envelope
    const envelope = await createEnvelope({
      templateHtml,
      emailSubject,
      signers: [
        {
          email: lead.email,
          name: lead.owner_name || 'Property Owner',
          recipientId: '1',
          routingOrder: '1',
          anchorStrings: {
            signHere: '/sn1/',
            dateSigned: '/ds1/'
          }
        },
        {
          email: process.env.LOGAN_EMAIL || 'logan.toups.11@gmail.com',
          name: config.legal_entity_name,
          recipientId: '2',
          routingOrder: '2',
          anchorStrings: {
            signHere: '/sn2/',
            dateSigned: '/ds2/'
          }
        }
      ],
      status: 'sent'
    });

    // Create contract record in database
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        lead_id: leadId,
        contract_type: contractType,
        seller_name: lead.owner_name,
        seller_email: lead.email,
        property_address: lead.property_address,
        excess_funds_amount: excessAmount,
        wholesale_fee: fees.wholesaleFee,
        total_fee: fees.totalFee,
        owner_fee: fees.ownerAmount,
        partner_fee: fees.partnerAmount,
        status: 'sent',
        docusign_envelope_id: envelope.envelopeId,
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (contractError) {
      console.error('Failed to create contract record:', contractError);
      // Don't fail - the envelope was created successfully
    }

    // Update lead status
    await supabase
      .from('maxsam_leads')
      .update({ status: 'contract_sent' })
      .eq('id', leadId);

    // Log status change
    await supabase.from('status_history').insert({
      lead_id: leadId,
      contract_id: contract?.id,
      old_status: lead.status,
      new_status: 'contract_sent',
      changed_by: 'contract_generator',
      reason: `${contractType} contract sent via DocuSign`
    });

    return {
      success: true,
      contractId: contract?.id,
      envelopeId: envelope.envelopeId
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a consent required error
    if (errorMessage.startsWith('CONSENT_REQUIRED:')) {
      const consentUrl = errorMessage.replace('CONSENT_REQUIRED:', '');
      return {
        success: false,
        error: `DocuSign consent required. Visit this URL to grant access: ${consentUrl}`
      };
    }

    return {
      success: false,
      error: `Failed to create envelope: ${errorMessage}`
    };
  }
}

/**
 * Get contract status from DocuSign
 */
export async function getContractStatus(contractId: string) {
  const supabase = createClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();

  if (!contract) {
    return { error: 'Contract not found' };
  }

  return {
    id: contract.id,
    status: contract.status,
    sentAt: contract.sent_at,
    signedAt: contract.signed_at,
    paymentStatus: contract.payment_status,
    totalFee: contract.total_fee
  };
}

/**
 * Resend a contract that was rejected or expired
 */
export async function resendContract(contractId: string): Promise<GenerateContractResult> {
  const supabase = createClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();

  if (!contract) {
    return { success: false, error: 'Contract not found' };
  }

  if (!['rejected', 'expired'].includes(contract.status)) {
    return { success: false, error: 'Contract cannot be resent in current status' };
  }

  // Generate a new contract for the same lead
  return generateContract(contract.lead_id, contract.contract_type);
}
