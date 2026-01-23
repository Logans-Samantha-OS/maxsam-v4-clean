/**
 * SignWell Adapter (Stub)
 * Concrete implementation of SigningAdapter for SignWell
 *
 * SignWell: https://www.signwell.com/
 * Free tier: 3 documents/month
 * API docs: https://developers.signwell.com/
 */

import {
  SigningAdapter,
  registerAdapter,
} from '../adapter';
import {
  AgreementPacket,
  AgreementType,
  AgreementPacketStatus,
  AgreementEventType,
  CreatePacketResponse,
  SendPacketResponse,
  PacketStatusResponse,
  DownloadSignedDocsResponse,
  WebhookPayload,
  NormalizedWebhookEvent,
  WebhookVerifyResult,
  SigningProvider,
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

interface SignWellConfig {
  apiKey: string;
  apiBase: string;
  webhookSecret: string;
}

function getConfig(): SignWellConfig | null {
  if (!process.env.SIGNWELL_API_KEY) {
    return null;
  }

  return {
    apiKey: process.env.SIGNWELL_API_KEY,
    apiBase: 'https://www.signwell.com/api/v1',
    webhookSecret: process.env.SIGNWELL_WEBHOOK_SECRET || '',
  };
}

// ============================================================================
// SignWell Adapter Implementation
// ============================================================================

class SignWellAdapter implements SigningAdapter {
  readonly provider = SigningProvider.SIGNWELL;

  isConfigured(): boolean {
    return !!getConfig()?.apiKey;
  }

  async createPacket(
    packet: AgreementPacket,
    documents: AgreementType[]
  ): Promise<CreatePacketResponse & { providerPacketId?: string; signingLink?: string }> {
    const config = getConfig();

    if (!config) {
      return {
        success: false,
        error: 'SignWell not configured. Set SIGNWELL_API_KEY environment variable.',
      };
    }

    try {
      // SignWell API: Create document from template or file
      // https://developers.signwell.com/reference/create-document-from-template

      const templateId = this.getTemplateId(documents[0]);

      if (!templateId) {
        return {
          success: false,
          error: 'No SignWell template configured for this document type',
        };
      }

      const response = await fetch(`${config.apiBase}/document_templates/${templateId}/documents`, {
        method: 'POST',
        headers: {
          'X-Api-Key': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_mode: process.env.NODE_ENV !== 'production',
          name: `Agreement - ${packet.clientName} - ${packet.propertyAddress}`,
          subject: `Please sign your agreement for ${packet.propertyAddress}`,
          message: `Dear ${packet.clientName},\n\nPlease review and sign the attached agreement for ${packet.propertyAddress}.`,
          recipients: [
            {
              id: '1',
              email: packet.clientEmail,
              name: packet.clientName,
              phone_number: packet.clientPhone,
            },
          ],
          fields: this.buildFieldValues(packet),
          metadata: {
            packet_id: packet.id,
            lead_id: packet.leadId,
            selection_code: packet.selectionCode,
          },
          // Webhook URL for status updates
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/signing/webhook?provider=signwell`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`SignWell API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();

      return {
        success: true,
        packetId: packet.id,
        status: AgreementPacketStatus.READY_TO_SEND,
        providerPacketId: result.id,
        signingLink: result.recipients?.[0]?.embedded_signing_url || result.signing_url,
      };

    } catch (error) {
      console.error('SignWell createPacket error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendPacket(packet: AgreementPacket): Promise<SendPacketResponse> {
    const config = getConfig();

    if (!config) {
      return { success: false, error: 'SignWell not configured' };
    }

    if (!packet.providerPacketId) {
      return { success: false, error: 'No provider packet ID' };
    }

    try {
      // SignWell: Send document for signing
      const response = await fetch(`${config.apiBase}/documents/${packet.providerPacketId}/send_reminders`, {
        method: 'POST',
        headers: {
          'X-Api-Key': config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`SignWell send error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      return {
        success: true,
        signingLink: packet.signingLink,
      };

    } catch (error) {
      console.error('SignWell sendPacket error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
      };
    }
  }

  async getPacketStatus(providerPacketId: string): Promise<PacketStatusResponse> {
    const config = getConfig();

    if (!config) {
      return { success: false, error: 'SignWell not configured' };
    }

    try {
      const response = await fetch(`${config.apiBase}/documents/${providerPacketId}`, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`SignWell API error: ${response.status}`);
      }

      const data = await response.json();

      // Map SignWell status to canonical status
      const status = this.mapStatus(data.status);

      return {
        success: true,
        packetId: data.metadata?.packet_id,
        status,
        signedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      };

    } catch (error) {
      console.error('SignWell getPacketStatus error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed',
      };
    }
  }

  async downloadSignedDocuments(providerPacketId: string): Promise<DownloadSignedDocsResponse> {
    const config = getConfig();

    if (!config) {
      return { success: false, error: 'SignWell not configured' };
    }

    try {
      // Get document to find PDF URL
      const docResponse = await fetch(`${config.apiBase}/documents/${providerPacketId}`, {
        headers: {
          'X-Api-Key': config.apiKey,
        },
      });

      if (!docResponse.ok) {
        throw new Error(`Failed to fetch document: ${docResponse.status}`);
      }

      const docData = await docResponse.json();

      // Download the completed PDF
      if (docData.files?.[0]?.url) {
        const pdfResponse = await fetch(docData.files[0].url);

        if (!pdfResponse.ok) {
          throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
        }

        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

        return {
          success: true,
          documents: [
            {
              agreementType: AgreementType.EXCESS_FUNDS, // Would need context
              pdfBuffer,
              pdfUrl: docData.files[0].url,
            },
          ],
        };
      }

      return {
        success: false,
        error: 'No PDF available',
      };

    } catch (error) {
      console.error('SignWell downloadSignedDocuments error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  async verifyWebhook(payload: WebhookPayload): Promise<WebhookVerifyResult> {
    const config = getConfig();

    if (!config?.webhookSecret) {
      return { valid: true }; // Dev mode
    }

    // SignWell uses HMAC-SHA256 signature verification
    const signature = payload.headers['x-signwell-signature'] || payload.headers['X-Signwell-Signature'];

    if (!signature) {
      return { valid: false, error: 'Missing signature header' };
    }

    // TODO: Implement HMAC verification
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', config.webhookSecret)
    //   .update(JSON.stringify(payload.rawPayload))
    //   .digest('hex');

    return { valid: true };
  }

  async normalizeWebhook(payload: WebhookPayload): Promise<NormalizedWebhookEvent> {
    const raw = payload.rawPayload;

    // SignWell webhook structure
    const documentId = raw.document_id as string;
    const event = raw.event as string;
    const recipient = (raw.recipient || {}) as Record<string, unknown>;

    return {
      packetId: (raw.metadata as Record<string, unknown>)?.packet_id as string,
      providerPacketId: documentId,
      eventType: this.mapEventType(event),
      signerEmail: recipient.email as string,
      signerName: recipient.name as string,
      timestamp: raw.created_at ? new Date(raw.created_at as string) : new Date(),
      rawPayload: raw,
    };
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private getTemplateId(docType: AgreementType): string | null {
    // Template IDs should be configured via env vars
    if (docType === AgreementType.EXCESS_FUNDS) {
      return process.env.SIGNWELL_EXCESS_FUNDS_TEMPLATE_ID || null;
    }
    if (docType === AgreementType.WHOLESALE_ASSIGNMENT) {
      return process.env.SIGNWELL_WHOLESALE_TEMPLATE_ID || null;
    }
    return null;
  }

  private buildFieldValues(packet: AgreementPacket): Array<{ api_id: string; value: string }> {
    // Map packet data to SignWell template fields
    return [
      { api_id: 'client_name', value: packet.clientName },
      { api_id: 'client_email', value: packet.clientEmail || '' },
      { api_id: 'client_phone', value: packet.clientPhone },
      { api_id: 'property_address', value: packet.propertyAddress || '' },
      { api_id: 'case_number', value: packet.caseNumber || '' },
      { api_id: 'excess_amount', value: packet.excessFundsAmount?.toFixed(2) || '0.00' },
      { api_id: 'total_fee', value: packet.totalFee?.toFixed(2) || '0.00' },
      { api_id: 'agreement_date', value: new Date().toLocaleDateString('en-US') },
    ];
  }

  private mapStatus(signwellStatus: string): AgreementPacketStatus {
    switch (signwellStatus?.toLowerCase()) {
      case 'draft':
        return AgreementPacketStatus.DRAFT;
      case 'pending':
      case 'sent':
        return AgreementPacketStatus.SENT;
      case 'viewed':
        return AgreementPacketStatus.VIEWED;
      case 'completed':
      case 'signed':
        return AgreementPacketStatus.SIGNED;
      case 'declined':
        return AgreementPacketStatus.DECLINED;
      case 'expired':
        return AgreementPacketStatus.EXPIRED;
      case 'voided':
      case 'cancelled':
        return AgreementPacketStatus.VOIDED;
      default:
        return AgreementPacketStatus.SENT;
    }
  }

  private mapEventType(signwellEvent: string): AgreementEventType {
    switch (signwellEvent?.toLowerCase()) {
      case 'document.completed':
      case 'document.signed':
        return AgreementEventType.SIGNED;
      case 'document.viewed':
        return AgreementEventType.VIEWED;
      case 'document.declined':
        return AgreementEventType.DECLINED;
      case 'document.expired':
        return AgreementEventType.EXPIRED;
      case 'document.sent':
        return AgreementEventType.SENT;
      case 'document.voided':
        return AgreementEventType.VOIDED;
      default:
        return AgreementEventType.WEBHOOK_RECEIVED;
    }
  }
}

// ============================================================================
// Register adapter
// ============================================================================

const signwellAdapter = new SignWellAdapter();
registerAdapter(signwellAdapter);

export { signwellAdapter, SignWellAdapter };
