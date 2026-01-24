/**
 * Provider-Agnostic Signing Module
 * Entry point for agreement signing abstraction
 *
 * Usage:
 *   import { createPacket, sendPacket, getPrimaryAdapter } from '@/lib/signing';
 *
 * Provider Selection:
 *   Set PRIMARY_SIGN_PROVIDER env var to one of:
 *   - gmail_link (MVP - works without external providers!)
 *   - jotform_sign
 *   - signwell
 *   - dropbox_sign
 *   - docusign
 */

// Export types
export * from './types';

// Export adapter interface and registry
export * from './adapter';

// Import adapters to trigger registration
import './providers/gmail-link';
import './adapters/jotform-adapter';
import './adapters/signwell-adapter';

// Re-export individual adapters for direct access if needed
export { gmailLinkAdapter } from './providers/gmail-link';
export { jotformAdapter } from './adapters/jotform-adapter';
export { signwellAdapter } from './adapters/signwell-adapter';

import { createClient } from '../supabase/server';
import {
  getPrimaryAdapter,
  getAdapter,
  getDocumentTypes,
  calculateFees,
} from './adapter';
import {
  AgreementPacket,
  AgreementPacketStatus,
  AgreementEventType,
  CreatePacketRequest,
  CreatePacketResponse,
  SendPacketResponse,
  PacketStatusResponse,
  SigningProvider,
  NormalizedWebhookEvent,
} from './types';

// ============================================================================
// High-level orchestration functions
// ============================================================================

/**
 * Create a new agreement packet
 * Provider-agnostic entry point
 */
export async function createPacket(request: CreatePacketRequest): Promise<CreatePacketResponse & { signingLink?: string }> {
  const adapter = getPrimaryAdapter();

  if (!adapter) {
    return {
      success: false,
      error: 'No signing provider configured. Set PRIMARY_SIGN_PROVIDER env var.',
    };
  }

  if (!adapter.isConfigured()) {
    return {
      success: false,
      error: `${adapter.provider} is not configured. Check environment variables.`,
    };
  }

  const supabase = createClient();

  try {
    // Calculate fees
    const fees = calculateFees(
      request.selectionCode,
      request.excessFundsAmount || 0,
      request.estimatedEquity || 0
    );

    // Get document types
    const documents = getDocumentTypes(request.selectionCode);

    // Create packet record in database first
    const { data: packetData, error: insertError } = await supabase
      .from('agreement_packets')
      .insert({
        lead_id: request.leadId,
        client_name: request.clientName,
        client_email: request.clientEmail,
        client_phone: request.clientPhone,
        property_address: request.propertyAddress,
        case_number: request.caseNumber,
        selection_code: request.selectionCode,
        excess_funds_amount: request.excessFundsAmount,
        estimated_equity: request.estimatedEquity,
        calculated_excess_fee: fees.excessFee,
        calculated_wholesale_fee: fees.wholesaleFee,
        total_fee: fees.totalFee,
        signing_provider: adapter.provider,
        status: 'created',
        triggered_by: request.triggeredBy || 'api',
        source_message_sid: request.sourceMessageSid,
        next_reminder_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // +2h
      })
      .select()
      .single();

    if (insertError || !packetData) {
      throw new Error(`Database insert failed: ${insertError?.message}`);
    }

    // Build packet object
    const packet: AgreementPacket = {
      id: packetData.id,
      leadId: request.leadId,
      clientName: request.clientName,
      clientEmail: request.clientEmail,
      clientPhone: request.clientPhone,
      propertyAddress: request.propertyAddress,
      caseNumber: request.caseNumber,
      selectionCode: request.selectionCode,
      excessFundsAmount: request.excessFundsAmount,
      estimatedEquity: request.estimatedEquity,
      calculatedExcessFee: fees.excessFee,
      calculatedWholesaleFee: fees.wholesaleFee,
      totalFee: fees.totalFee,
      provider: adapter.provider as SigningProvider,
      status: AgreementPacketStatus.DRAFT,
      createdAt: new Date(),
      reminderCount: 0,
      triggeredBy: request.triggeredBy || 'api',
      sourceMessageSid: request.sourceMessageSid,
      documents: [],
    };

    // Create with provider
    const result = await adapter.createPacket(packet, documents);

    if (!result.success) {
      // Log failure event
      await logEvent(packetData.id, AgreementEventType.FAILED, 'system', {
        error: result.error,
        provider: adapter.provider,
      });

      return result;
    }

    // Update packet with provider details
    await supabase
      .from('agreement_packets')
      .update({
        provider_packet_id: result.providerPacketId,
        signing_link: result.signingLink,
        signing_link_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ready_to_send',
      })
      .eq('id', packetData.id);

    // Create document records
    for (const docType of documents) {
      await supabase.from('agreement_documents').insert({
        packet_id: packetData.id,
        document_type: docType.toLowerCase(),
        status: 'pending',
      });
    }

    // Log creation event
    await logEvent(packetData.id, AgreementEventType.CREATED, request.triggeredBy || 'api', {
      provider: adapter.provider,
      selection_code: request.selectionCode,
      documents: documents,
    });

    return {
      success: true,
      packetId: packetData.id,
      status: AgreementPacketStatus.READY_TO_SEND,
      signingLink: result.signingLink,
    };

  } catch (error) {
    console.error('createPacket error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a packet for signing
 */
export async function sendPacket(
  packetId: string,
  deliveryMethod: 'sms' | 'email' | 'both' = 'both'
): Promise<SendPacketResponse> {
  const supabase = createClient();

  // Fetch packet
  const { data: packetData, error: fetchError } = await supabase
    .from('agreement_packets')
    .select('*')
    .eq('id', packetId)
    .single();

  if (fetchError || !packetData) {
    return { success: false, error: 'Packet not found' };
  }

  if (!packetData.signing_link) {
    return { success: false, error: 'No signing link available' };
  }

  let smsSent = false;
  let emailSent = false;

  // Send SMS
  if ((deliveryMethod === 'sms' || deliveryMethod === 'both') && packetData.client_phone) {
    const { sendSMS } = await import('../twilio');

    const message = buildSigningSMS(packetData);
    const result = await sendSMS(packetData.client_phone, message, packetData.lead_id);
    smsSent = result.success;
  }

  // Send Email (via n8n webhook or direct)
  if ((deliveryMethod === 'email' || deliveryMethod === 'both') && packetData.client_email) {
    emailSent = await sendSigningEmail(packetData);
  }

  if (smsSent || emailSent) {
    // Update status to SENT
    await supabase
      .from('agreement_packets')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', packetId);

    // Log send event
    await logEvent(packetId, AgreementEventType.SENT, 'system', {
      sms_sent: smsSent,
      email_sent: emailSent,
      delivery_method: deliveryMethod,
    });
  }

  return {
    success: smsSent || emailSent,
    signingLink: packetData.signing_link,
    smsSent,
    emailSent,
    error: (!smsSent && !emailSent) ? 'Failed to deliver via any channel' : undefined,
  };
}

/**
 * Get packet status (queries provider)
 */
export async function getPacketStatus(packetId: string): Promise<PacketStatusResponse> {
  const supabase = createClient();

  const { data: packetData, error } = await supabase
    .from('agreement_packets')
    .select('*, agreement_documents(*)')
    .eq('id', packetId)
    .single();

  if (error || !packetData) {
    return { success: false, error: 'Packet not found' };
  }

  // Optionally query provider for latest status
  if (packetData.provider_packet_id) {
    const adapter = getAdapter(packetData.signing_provider as SigningProvider);

    if (adapter?.isConfigured()) {
      const providerStatus = await adapter.getPacketStatus(packetData.provider_packet_id);

      if (providerStatus.success && providerStatus.status !== packetData.status) {
        // Update local status if changed
        await supabase
          .from('agreement_packets')
          .update({ status: providerStatus.status?.toLowerCase() })
          .eq('id', packetId);

        packetData.status = providerStatus.status?.toLowerCase();
      }
    }
  }

  return {
    success: true,
    packetId,
    status: packetData.status?.toUpperCase() as AgreementPacketStatus,
    documents: packetData.agreement_documents,
    signingLink: packetData.signing_link,
    signedAt: packetData.signed_at ? new Date(packetData.signed_at) : undefined,
  };
}

/**
 * Process a webhook from any provider
 */
export async function processWebhook(
  provider: SigningProvider,
  rawPayload: Record<string, unknown>,
  headers: Record<string, string>
): Promise<{ success: boolean; event?: NormalizedWebhookEvent; error?: string }> {
  const adapter = getAdapter(provider);

  if (!adapter) {
    return { success: false, error: `Unknown provider: ${provider}` };
  }

  const payload = { provider, rawPayload, headers };

  // Verify webhook
  const verification = await adapter.verifyWebhook(payload);

  if (!verification.valid) {
    return { success: false, error: verification.error || 'Invalid webhook signature' };
  }

  // Normalize to canonical event
  const event = await adapter.normalizeWebhook(payload);

  // Log webhook event
  if (event.packetId) {
    await logEvent(event.packetId, AgreementEventType.WEBHOOK_RECEIVED, 'webhook', {
      provider,
      event_type: event.eventType,
      raw_payload_preview: JSON.stringify(rawPayload).slice(0, 500),
    });

    // Handle specific events
    await handleWebhookEvent(event);
  }

  return { success: true, event };
}

// ============================================================================
// Internal helpers
// ============================================================================

async function logEvent(
  packetId: string,
  eventType: AgreementEventType,
  source: string,
  eventData: Record<string, unknown>
): Promise<void> {
  const supabase = createClient();

  await supabase.from('agreement_events').insert({
    packet_id: packetId,
    event_type: eventType.toLowerCase(),
    source,
    event_data: eventData,
  });
}

async function handleWebhookEvent(event: NormalizedWebhookEvent): Promise<void> {
  const supabase = createClient();

  if (!event.packetId) return;

  // Map event type to status update
  let newStatus: string | null = null;
  const updates: Record<string, unknown> = {};

  switch (event.eventType) {
    case AgreementEventType.VIEWED:
      updates.first_viewed_at = new Date().toISOString();
      newStatus = 'viewed';
      break;

    case AgreementEventType.SIGNED:
      updates.signed_at = new Date().toISOString();
      newStatus = 'signed';
      // Also update lead status and AUTO-CREATE INVOICE
      const { data: packet } = await supabase
        .from('agreement_packets')
        .select('lead_id, client_email, client_name, total_fee, property_address, id')
        .eq('id', event.packetId)
        .single();

      if (packet?.lead_id) {
        // Update lead status
        await supabase
          .from('maxsam_leads')
          .update({ status: 'contract_signed' })
          .eq('id', packet.lead_id);

        // AUTO-INVOICE: Create Stripe invoice for signed contract
        if (packet.client_email && packet.total_fee && packet.total_fee > 0) {
          try {
            const { createInvoice } = await import('../stripe');
            const invoiceResult = await createInvoice(
              packet.client_email,
              packet.client_name || 'Property Owner',
              packet.total_fee,
              `Recovery Fee - ${packet.property_address || 'Property'}`,
              {
                lead_id: packet.lead_id,
                packet_id: packet.id,
                source: 'auto_signed_webhook'
              }
            );

            if (invoiceResult.success) {
              // Update packet with invoice info
              await supabase
                .from('agreement_packets')
                .update({
                  stripe_invoice_id: invoiceResult.invoiceId,
                  stripe_invoice_url: invoiceResult.invoiceUrl,
                  invoice_created_at: new Date().toISOString()
                })
                .eq('id', event.packetId);

              // Log invoice creation event
              await logEvent(event.packetId, AgreementEventType.STATUS_CHANGED, 'system', {
                action: 'auto_invoice_created',
                invoice_id: invoiceResult.invoiceId,
                invoice_url: invoiceResult.invoiceUrl,
                amount: packet.total_fee
              });

              // Send Telegram notification
              const botToken = process.env.TELEGRAM_BOT_TOKEN;
              const chatId = process.env.TELEGRAM_CHAT_ID;
              if (botToken && chatId) {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `💰 AUTO-INVOICE SENT!\n\n📝 Contract Signed: ${packet.client_name}\n🏠 ${packet.property_address}\n💵 Invoice: $${packet.total_fee.toLocaleString()}\n🔗 ${invoiceResult.invoiceUrl}\n\nWaiting for payment...`,
                    parse_mode: 'HTML'
                  })
                });
              }
            } else {
              console.error('Auto-invoice creation failed:', invoiceResult.error);
              await logEvent(event.packetId, AgreementEventType.FAILED, 'system', {
                action: 'auto_invoice_failed',
                error: invoiceResult.error
              });
            }
          } catch (invoiceError) {
            console.error('Auto-invoice exception:', invoiceError);
          }
        }
      }
      break;

    case AgreementEventType.DECLINED:
      newStatus = 'declined';
      break;

    case AgreementEventType.EXPIRED:
      updates.expired_at = new Date().toISOString();
      newStatus = 'expired';
      break;
  }

  if (newStatus) {
    await supabase
      .from('agreement_packets')
      .update({ ...updates, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', event.packetId);

    await logEvent(event.packetId, AgreementEventType.STATUS_CHANGED, 'webhook', {
      new_status: newStatus,
      event_type: event.eventType,
    });
  }
}

function buildSigningSMS(packet: {
  client_name: string;
  property_address?: string;
  signing_link: string;
  total_fee?: number;
}): string {
  const firstName = packet.client_name?.split(' ')[0] || 'there';
  const feeStr = packet.total_fee
    ? ` (Est. recovery: $${packet.total_fee.toLocaleString()})`
    : '';

  return `Hi ${firstName}! Your agreement for ${packet.property_address || 'your property'} is ready to sign${feeStr}. Takes 60 seconds on your phone: ${packet.signing_link}`;
}

async function sendSigningEmail(packet: {
  client_email: string;
  client_name: string;
  property_address?: string;
  signing_link: string;
  total_fee?: number;
}): Promise<boolean> {
  const emailWebhook = process.env.N8N_SEND_EMAIL_WEBHOOK;

  if (!emailWebhook) {
    console.warn('N8N_SEND_EMAIL_WEBHOOK not configured');
    return false;
  }

  try {
    const response = await fetch(emailWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: packet.client_email,
        subject: `Action Required: Sign Your Agreement - ${packet.property_address || 'Property Recovery'}`,
        template: 'agreement_signing',
        data: {
          client_name: packet.client_name,
          property_address: packet.property_address,
          signing_link: packet.signing_link,
          total_fee: packet.total_fee,
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send signing email:', error);
    return false;
  }
}
