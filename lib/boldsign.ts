/**
 * BoldSign Integration for MaxSam V4
 * Replaces DocuSign for sending recovery agreements
 */

const BOLDSIGN_API_KEY = process.env.BOLDSIGN_API_KEY || 'M2M5ODA3NzEtOGNjNS00MGNiLWIxYTEtYzkwYmUxMDRlMTg5';
const BOLDSIGN_BASE_URL = 'https://api.boldsign.com/v1';
const RECOVERY_TEMPLATE_ID = process.env.BOLDSIGN_RECOVERY_TEMPLATE_ID || 'MzExMjVjOTgtMDNkOC00YWY1LWIzOGUtMGNmZThlMDRmYTNj';

export interface BoldSignSigner {
  name: string;
  emailAddress: string;
  signerType?: string;
  signerOrder?: number;
}

export interface SendTemplateOptions {
  templateId?: string;
  title?: string;
  message?: string;
  roles: BoldSignSigner[];
  brandId?: string;
  disableEmails?: boolean;
  disableSMS?: boolean;
  sendLinkValidTill?: string;
}

export interface BoldSignResponse {
  success: boolean;
  documentId?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Check if BoldSign is configured
 */
export function isBoldSignConfigured(): boolean {
  return !!BOLDSIGN_API_KEY && BOLDSIGN_API_KEY.length > 10;
}

/**
 * Send a document from template via BoldSign
 */
export async function sendFromTemplate(options: SendTemplateOptions): Promise<BoldSignResponse> {
  const templateId = options.templateId || RECOVERY_TEMPLATE_ID;

  if (!isBoldSignConfigured()) {
    return {
      success: false,
      error: 'BoldSign API key not configured'
    };
  }

  try {
    const response = await fetch(`${BOLDSIGN_BASE_URL}/template/send`, {
      method: 'POST',
      headers: {
        'X-API-KEY': BOLDSIGN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId,
        title: options.title || 'Excess Funds Recovery Agreement',
        message: options.message || 'Please review and sign this agreement to proceed with your excess funds recovery.',
        roles: options.roles.map((role, index) => ({
          roleIndex: index + 1,
          signerName: role.name,
          signerEmail: role.emailAddress,
          signerType: role.signerType || 'Signer',
          signerOrder: role.signerOrder || index + 1,
        })),
        disableEmails: options.disableEmails ?? false,
        disableSMS: options.disableSMS ?? true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('BoldSign API error:', data);
      return {
        success: false,
        error: data.error || data.message || `BoldSign API error: ${response.status}`,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      documentId: data.documentId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('BoldSign send error:', message);
    return {
      success: false,
      error: `Failed to send via BoldSign: ${message}`,
    };
  }
}

/**
 * Get document status from BoldSign
 */
export async function getDocumentStatus(documentId: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  if (!isBoldSignConfigured()) {
    return {
      success: false,
      error: 'BoldSign API key not configured'
    };
  }

  try {
    const response = await fetch(`${BOLDSIGN_BASE_URL}/document/properties?documentId=${documentId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': BOLDSIGN_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to get status: ${response.status}`,
      };
    }

    return {
      success: true,
      status: data.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Send recovery agreement to a lead
 * This is the main function called from the Messages page
 */
export async function sendRecoveryAgreement(lead: {
  id: string;
  owner_name: string;
  email?: string | null;
  primary_email?: string | null;
  property_address?: string;
  excess_funds_amount?: number;
}): Promise<BoldSignResponse & { lead_id?: string }> {
  const email = lead.email || lead.primary_email;

  if (!email) {
    return {
      success: false,
      error: 'Lead does not have an email address. Please add an email first.',
      lead_id: lead.id,
    };
  }

  if (!lead.owner_name) {
    return {
      success: false,
      error: 'Lead does not have an owner name.',
      lead_id: lead.id,
    };
  }

  const result = await sendFromTemplate({
    templateId: RECOVERY_TEMPLATE_ID,
    title: `Recovery Agreement - ${lead.property_address || 'Property'}`,
    message: `Dear ${lead.owner_name},\n\nPlease review and sign this Excess Funds Recovery Agreement. This agreement authorizes us to recover the unclaimed funds on your behalf.\n\nAmount to recover: $${(lead.excess_funds_amount || 0).toLocaleString()}\n\nThank you for your trust.`,
    roles: [
      {
        name: lead.owner_name,
        emailAddress: email,
        signerType: 'Signer',
        signerOrder: 1,
      },
    ],
  });

  return {
    ...result,
    lead_id: lead.id,
  };
}
