/**
 * Gmail-Link Signing Provider (MVP)
 *
 * A simple "sign via web link" provider that:
 * 1. Sends an email (via n8n) with a signing link
 * 2. Client visits /sign/[packet_id]
 * 3. Client agrees with checkboxes + typed name + date
 * 4. System records signature with IP capture
 *
 * No external e-sign provider needed - works TODAY.
 */

import { SigningAdapter, registerAdapter } from '../adapter';
import {
  SigningProvider,
  AgreementPacket,
  AgreementType,
  CreatePacketResponse,
  SendPacketResponse,
  PacketStatusResponse,
  DownloadSignedDocsResponse,
  WebhookPayload,
  WebhookVerifyResult,
  NormalizedWebhookEvent,
  AgreementEventType,
  AgreementPacketStatus,
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

interface GmailLinkConfig {
  appUrl: string;
  n8nSendEmailWebhook: string;
  fromEmail: string;
  fromName: string;
}

function getConfig(): GmailLinkConfig | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const n8nWebhook = process.env.N8N_SEND_EMAIL_WEBHOOK;

  if (!appUrl) {
    console.warn('Gmail-link provider: Missing APP_URL');
    return null;
  }

  return {
    appUrl,
    n8nSendEmailWebhook: n8nWebhook || '',
    fromEmail: process.env.FROM_EMAIL || 'agreements@maxsam.com',
    fromName: process.env.FROM_NAME || 'MaxSam Real Estate',
  };
}

// ============================================================================
// Email Templates
// ============================================================================

export function buildSigningEmailHtml(packet: {
  clientName: string;
  propertyAddress?: string;
  signingLink: string;
  totalFee?: number;
  selectionCode: 1 | 2 | 3;
}): string {
  const firstName = packet.clientName?.split(' ')[0] || 'there';
  const feeStr = packet.totalFee
    ? `$${packet.totalFee.toLocaleString()}`
    : 'TBD';

  const agreementType = packet.selectionCode === 1
    ? 'Excess Funds Recovery'
    : packet.selectionCode === 2
      ? 'Real Estate Assignment'
      : 'Excess Funds Recovery & Assignment';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
    .cta-button { display: inline-block; background: #16a34a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 18px; margin: 20px 0; }
    .cta-button:hover { background: #15803d; }
    .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Your Agreement is Ready</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Sign in under 60 seconds</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      <p>Your <strong>${agreementType} Agreement</strong> is ready for your signature.</p>

      <div class="details">
        <div class="detail-row">
          <span>Property:</span>
          <strong>${packet.propertyAddress || 'Your Property'}</strong>
        </div>
        <div class="detail-row">
          <span>Agreement Type:</span>
          <strong>${agreementType}</strong>
        </div>
        <div class="detail-row">
          <span>Estimated Recovery:</span>
          <strong style="color: #16a34a;">${feeStr}</strong>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${packet.signingLink}" class="cta-button">
          ✍️ Sign Now (60 seconds)
        </a>
        <p style="color: #64748b; font-size: 14px;">
          This link expires in 7 days. Sign on any device.
        </p>
      </div>

      <p>Questions? Just reply to this email or call us.</p>
      <p>Thank you,<br><strong>MaxSam Real Estate</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated message from MaxSam Real Estate.</p>
      <p>© ${new Date().getFullYear()} MaxSam Real Estate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildSigningEmailText(packet: {
  clientName: string;
  propertyAddress?: string;
  signingLink: string;
  totalFee?: number;
  selectionCode: 1 | 2 | 3;
}): string {
  const firstName = packet.clientName?.split(' ')[0] || 'there';
  const feeStr = packet.totalFee
    ? `$${packet.totalFee.toLocaleString()}`
    : 'TBD';

  const agreementType = packet.selectionCode === 1
    ? 'Excess Funds Recovery'
    : packet.selectionCode === 2
      ? 'Real Estate Assignment'
      : 'Excess Funds Recovery & Assignment';

  return `
Hi ${firstName},

Your ${agreementType} Agreement is ready for your signature.

Property: ${packet.propertyAddress || 'Your Property'}
Estimated Recovery: ${feeStr}

Sign here (takes 60 seconds on your phone):
${packet.signingLink}

This link expires in 7 days.

Questions? Reply to this email or call us.

Thank you,
MaxSam Real Estate
`;
}

// ============================================================================
// Gmail-Link Adapter Implementation
// ============================================================================

class GmailLinkAdapter implements SigningAdapter {
  readonly provider = SigningProvider.GMAIL_LINK as unknown as SigningProvider;

  isConfigured(): boolean {
    const config = getConfig();
    return !!(config?.appUrl);
  }

  /**
   * Create packet - generates signing link immediately
   * (No external API call needed)
   */
  async createPacket(
    packet: AgreementPacket,
    documents: AgreementType[]
  ): Promise<CreatePacketResponse & { providerPacketId?: string; signingLink?: string }> {
    const config = getConfig();

    if (!config) {
      return {
        success: false,
        error: 'Gmail-link provider not configured',
      };
    }

    // Generate signing link pointing to our own /sign page
    const signingLink = `${config.appUrl}/sign/${packet.id}`;

    // Provider packet ID is just our own packet ID
    const providerPacketId = `gmaillink_${packet.id}`;

    return {
      success: true,
      packetId: packet.id,
      status: AgreementPacketStatus.READY_TO_SEND,
      providerPacketId,
      signingLink,
    };
  }

  /**
   * Send packet - calls n8n webhook to send email
   */
  async sendPacket(packet: AgreementPacket): Promise<SendPacketResponse> {
    const config = getConfig();

    if (!config) {
      return { success: false, error: 'Gmail-link provider not configured' };
    }

    if (!packet.signingLink) {
      return { success: false, error: 'No signing link available' };
    }

    let emailSent = false;
    let smsSent = false;

    // Send email via n8n webhook if configured
    if (config.n8nSendEmailWebhook && packet.clientEmail) {
      try {
        const emailPayload = {
          to: packet.clientEmail,
          subject: `Action Required: Sign Your Agreement - ${packet.propertyAddress || 'Property Recovery'}`,
          html: buildSigningEmailHtml({
            clientName: packet.clientName,
            propertyAddress: packet.propertyAddress,
            signingLink: packet.signingLink,
            totalFee: packet.totalFee,
            selectionCode: packet.selectionCode,
          }),
          text: buildSigningEmailText({
            clientName: packet.clientName,
            propertyAddress: packet.propertyAddress,
            signingLink: packet.signingLink,
            totalFee: packet.totalFee,
            selectionCode: packet.selectionCode,
          }),
          from_name: config.fromName,
          packet_id: packet.id,
          lead_id: packet.leadId,
        };

        const response = await fetch(config.n8nSendEmailWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload),
        });

        emailSent = response.ok;

        if (!response.ok) {
          console.error('N8N email webhook failed:', await response.text());
        }
      } catch (error) {
        console.error('Failed to send email via n8n:', error);
      }
    }

    // SMS would be handled separately by the main sendPacket function
    // This adapter focuses on email delivery

    return {
      success: emailSent,
      signingLink: packet.signingLink,
      emailSent,
      smsSent,
      error: !emailSent ? 'Email delivery failed' : undefined,
    };
  }

  /**
   * Get status - we store all state in our own DB, so this is a no-op
   */
  async getPacketStatus(providerPacketId: string): Promise<PacketStatusResponse> {
    // Extract our packet ID from provider ref
    const packetId = providerPacketId.replace('gmaillink_', '');

    return {
      success: true,
      packetId,
      // Status comes from our DB, not provider
    };
  }

  /**
   * Download signed documents - not applicable for link-based signing
   */
  async downloadSignedDocuments(providerPacketId: string): Promise<DownloadSignedDocsResponse> {
    return {
      success: false,
      error: 'Gmail-link provider does not generate downloadable PDFs. Signed agreement is recorded in database.',
    };
  }

  /**
   * Verify webhook - we generate our own webhooks, so always valid
   */
  async verifyWebhook(payload: WebhookPayload): Promise<WebhookVerifyResult> {
    // Our internal callbacks don't need signature verification
    return { valid: true };
  }

  /**
   * Normalize webhook - convert internal callback to canonical event
   */
  async normalizeWebhook(payload: WebhookPayload): Promise<NormalizedWebhookEvent> {
    const raw = payload.rawPayload;

    // Map our internal events to canonical events
    const eventMap: Record<string, AgreementEventType> = {
      'viewed': AgreementEventType.VIEWED,
      'signed': AgreementEventType.SIGNED,
      'declined': AgreementEventType.DECLINED,
    };

    const eventType = eventMap[raw.event as string] || AgreementEventType.VIEWED;

    return {
      packetId: raw.packet_id as string,
      providerPacketId: `gmaillink_${raw.packet_id}`,
      eventType,
      signerEmail: raw.signer_email as string,
      signerName: raw.signer_name as string,
      signerIp: raw.signer_ip as string,
      timestamp: new Date(),
      rawPayload: raw,
    };
  }
}

// Register the adapter
export const gmailLinkAdapter = new GmailLinkAdapter();
registerAdapter(gmailLinkAdapter);
