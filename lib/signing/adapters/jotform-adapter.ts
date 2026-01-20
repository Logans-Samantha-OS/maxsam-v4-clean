/**
 * JotForm Sign Adapter
 * Concrete implementation of SigningAdapter for JotForm Sign
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

interface JotFormConfig {
  apiKey: string;
  excessFundsFormId: string;
  wholesaleFormId: string;
  apiBase: string;
  signApiBase: string;
  webhookSecret: string;
}

function getConfig(): JotFormConfig | null {
  if (!process.env.JOTFORM_API_KEY) {
    return null;
  }

  return {
    apiKey: process.env.JOTFORM_API_KEY,
    excessFundsFormId: process.env.JOTFORM_EXCESS_FUNDS_FORM_ID || '',
    wholesaleFormId: process.env.JOTFORM_WHOLESALE_FORM_ID || process.env.JOTFORM_EXCESS_FUNDS_FORM_ID || '',
    apiBase: 'https://api.jotform.com',
    signApiBase: 'https://sign.jotform.com/api',
    webhookSecret: process.env.JOTFORM_WEBHOOK_SECRET || '',
  };
}

// ============================================================================
// JotForm Sign Adapter Implementation
// ============================================================================

class JotFormSignAdapter implements SigningAdapter {
  readonly provider = SigningProvider.JOTFORM_SIGN;

  isConfigured(): boolean {
    const config = getConfig();
    return !!(config?.apiKey && config?.excessFundsFormId);
  }

  async createPacket(
    packet: AgreementPacket,
    documents: AgreementType[]
  ): Promise<CreatePacketResponse & { providerPacketId?: string; signingLink?: string }> {
    const config = getConfig();

    if (!config) {
      return {
        success: false,
        error: 'JotForm Sign not configured',
      };
    }

    try {
      // Build prefill data
      const prefillData = this.buildPrefillData(packet);

      // Get form IDs for requested documents
      const formIds = documents.map(docType =>
        docType === AgreementType.EXCESS_FUNDS
          ? config.excessFundsFormId
          : config.wholesaleFormId
      );

      // For single document, use direct prefill URL
      // For multiple documents, would use JotForm Sign API (if available)
      if (formIds.length === 1) {
        const prefillParams = this.buildPrefillQueryString(prefillData);
        const signingLink = `https://form.jotform.com/${formIds[0]}?${prefillParams}`;
        const providerPacketId = `${formIds[0]}_${packet.id}`;

        return {
          success: true,
          packetId: packet.id,
          status: AgreementPacketStatus.READY_TO_SEND,
          providerPacketId,
          signingLink,
        };
      }

      // Multi-document flow
      const result = await this.createMultiDocPacket(config, formIds, prefillData, packet.id);

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        packetId: packet.id,
        status: AgreementPacketStatus.READY_TO_SEND,
        providerPacketId: result.providerPacketId,
        signingLink: result.signingLink,
      };

    } catch (error) {
      console.error('JotForm createPacket error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendPacket(packet: AgreementPacket): Promise<SendPacketResponse> {
    // JotForm doesn't have a separate "send" step - the signing link is active immediately
    // We just need to deliver the link via SMS/email

    if (!packet.signingLink) {
      return {
        success: false,
        error: 'No signing link available',
      };
    }

    // Note: Actual SMS/email delivery is handled by the orchestration layer
    // The adapter just confirms the packet is sendable
    return {
      success: true,
      signingLink: packet.signingLink,
    };
  }

  async getPacketStatus(providerPacketId: string): Promise<PacketStatusResponse> {
    const config = getConfig();

    if (!config) {
      return { success: false, error: 'JotForm not configured' };
    }

    try {
      // Extract submission ID from provider packet ID
      const parts = providerPacketId.split('_');
      const submissionId = parts[parts.length - 1];

      // Query JotForm API for submission status
      const response = await fetch(
        `${config.apiBase}/submission/${submissionId}?apiKey=${config.apiKey}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Submission not found - still pending
          return {
            success: true,
            packetId: providerPacketId,
            status: AgreementPacketStatus.SENT,
          };
        }
        throw new Error(`JotForm API error: ${response.status}`);
      }

      const data = await response.json();

      // If we got a submission, it means the form was submitted (signed)
      return {
        success: true,
        packetId: providerPacketId,
        status: AgreementPacketStatus.SIGNED,
        signedAt: data.created_at ? new Date(data.created_at) : new Date(),
      };

    } catch (error) {
      console.error('JotForm getPacketStatus error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed',
      };
    }
  }

  async downloadSignedDocuments(providerPacketId: string): Promise<DownloadSignedDocsResponse> {
    const config = getConfig();

    if (!config) {
      return { success: false, error: 'JotForm not configured' };
    }

    try {
      const parts = providerPacketId.split('_');
      const submissionId = parts[parts.length - 1];

      // Get submission details
      const response = await fetch(
        `${config.apiBase}/submission/${submissionId}?apiKey=${config.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch submission: ${response.status}`);
      }

      const data = await response.json();

      // JotForm may include PDF URL in submission response
      const pdfUrl = data.content?.pdfUrl || data.pdfUrl;

      if (pdfUrl) {
        const pdfResponse = await fetch(pdfUrl);

        if (!pdfResponse.ok) {
          throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
        }

        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

        return {
          success: true,
          documents: [
            {
              agreementType: AgreementType.EXCESS_FUNDS, // Default, would need context
              pdfBuffer,
              pdfUrl,
            },
          ],
        };
      }

      return {
        success: false,
        error: 'No PDF available for download',
      };

    } catch (error) {
      console.error('JotForm downloadSignedDocuments error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  async verifyWebhook(payload: WebhookPayload): Promise<WebhookVerifyResult> {
    const config = getConfig();

    if (!config?.webhookSecret) {
      // No secret configured - accept all (dev mode)
      return { valid: true };
    }

    // JotForm webhook verification would check signature header
    // For now, basic validation
    const rawPayload = payload.rawPayload;

    if (!rawPayload || typeof rawPayload !== 'object') {
      return { valid: false, error: 'Invalid payload format' };
    }

    // TODO: Implement proper HMAC signature verification if JotForm supports it
    return { valid: true };
  }

  async normalizeWebhook(payload: WebhookPayload): Promise<NormalizedWebhookEvent> {
    const raw = payload.rawPayload;

    // Extract common fields from JotForm webhook
    const submissionId = (raw.submissionID || raw.submission_id) as string;
    const formId = (raw.formID || raw.form_id) as string;
    const eventType = (raw.event || raw.eventType || 'submission') as string;

    // Try to find packet_id in various locations
    let packetId: string | undefined;

    if (raw.rawRequest && typeof raw.rawRequest === 'string') {
      try {
        const parsed = JSON.parse(raw.rawRequest);
        packetId = parsed.packet_id || parsed.packetId;
      } catch {
        // Ignore parse errors
      }
    }

    packetId = packetId || (raw.packet_id as string) || (raw.packetId as string);

    // Map JotForm event type to canonical event type
    const canonicalEventType = this.mapEventType(eventType);

    return {
      packetId,
      providerPacketId: formId && submissionId ? `${formId}_${submissionId}` : submissionId,
      eventType: canonicalEventType,
      signerEmail: raw.email as string,
      signerName: raw.name as string,
      signerIp: raw.ip as string,
      timestamp: new Date(),
      rawPayload: raw,
    };
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private buildPrefillData(packet: AgreementPacket): Record<string, string> {
    return {
      client_name: packet.clientName,
      client_email: packet.clientEmail || '',
      client_phone: packet.clientPhone,
      property_address: packet.propertyAddress || '',
      case_number: packet.caseNumber || '',
      excess_funds_amount: packet.excessFundsAmount?.toFixed(2) || '0.00',
      excess_fee_amount: packet.calculatedExcessFee?.toFixed(2) || '0.00',
      wholesale_fee_amount: packet.calculatedWholesaleFee?.toFixed(2) || '0.00',
      total_fee_amount: packet.totalFee?.toFixed(2) || '0.00',
      agreement_date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      packet_id: packet.id,
      lead_id: packet.leadId,
    };
  }

  private buildPrefillQueryString(data: Record<string, string>): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(data)) {
      if (value) {
        params.append(key, value);
      }
    }

    return params.toString();
  }

  private async createMultiDocPacket(
    config: JotFormConfig,
    formIds: string[],
    prefillData: Record<string, string>,
    packetId: string
  ): Promise<{ success: boolean; providerPacketId?: string; signingLink?: string; error?: string }> {
    // JotForm Sign API for multi-document packets
    // This is a placeholder - actual implementation depends on JotForm Sign API availability

    try {
      const response = await fetch(`${config.signApiBase}/documents`, {
        method: 'POST',
        headers: {
          'APIKEY': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forms: formIds.map(formId => ({
            formId,
            prefill: prefillData,
          })),
          signers: [
            {
              name: prefillData.client_name,
              email: prefillData.client_email,
              phone: prefillData.client_phone,
              order: 1,
            },
          ],
          metadata: {
            packetId,
            leadId: prefillData.lead_id,
          },
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/signing/webhook`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`JotForm Sign API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();

      return {
        success: true,
        signingLink: result.content?.signingUrl || result.signingUrl,
        providerPacketId: result.content?.documentId || result.documentId,
      };

    } catch (error) {
      // Fallback: if Sign API not available, use first form only
      console.warn('JotForm Sign API not available, using single form fallback');

      const prefillParams = this.buildPrefillQueryString(prefillData);
      const signingLink = `https://form.jotform.com/${formIds[0]}?${prefillParams}`;
      const providerPacketId = `${formIds[0]}_${packetId}`;

      return {
        success: true,
        providerPacketId,
        signingLink,
      };
    }
  }

  private mapEventType(jotformEvent: string): AgreementEventType {
    switch (jotformEvent.toLowerCase()) {
      case 'submission':
      case 'signed':
      case 'completed':
        return AgreementEventType.SIGNED;
      case 'viewed':
      case 'opened':
        return AgreementEventType.VIEWED;
      case 'declined':
      case 'rejected':
        return AgreementEventType.DECLINED;
      case 'expired':
        return AgreementEventType.EXPIRED;
      case 'sent':
        return AgreementEventType.SENT;
      case 'delivered':
        return AgreementEventType.DELIVERED;
      default:
        return AgreementEventType.WEBHOOK_RECEIVED;
    }
  }
}

// ============================================================================
// Register adapter
// ============================================================================

const jotformAdapter = new JotFormSignAdapter();
registerAdapter(jotformAdapter);

export { jotformAdapter, JotFormSignAdapter };
