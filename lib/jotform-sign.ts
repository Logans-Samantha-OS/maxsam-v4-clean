/**
 * JotForm Sign Integration for MaxSam V4
 * Provider-abstracted e-signature integration
 *
 * Primary provider: JotForm Sign
 * Fallback: Dropbox Sign, SignWell
 *
 * Design: Abstracted interface allows provider swapping without code changes
 */

import { createClient } from './supabase/server';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SigningPacketConfig {
  leadId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone: string;
  propertyAddress?: string;
  caseNumber?: string;
  selectionCode: 1 | 2 | 3; // 1=Excess, 2=Wholesale, 3=Both
  excessFundsAmount?: number;
  estimatedEquity?: number;
  triggeredBy: 'sms' | 'ui' | 'api' | 'workflow';
  sourceMessageSid?: string;
}

export interface SigningPacketResult {
  success: boolean;
  packetId?: string;
  signingLink?: string;
  error?: string;
  providerDocumentId?: string;
}

export interface SignedDocumentResult {
  success: boolean;
  pdfBuffer?: Buffer;
  pdfUrl?: string;
  error?: string;
}

export interface ProviderWebhookPayload {
  eventType: string;
  documentId: string;
  submissionId?: string;
  status: string;
  signedAt?: string;
  signerEmail?: string;
  signerName?: string;
  signerIp?: string;
  rawPayload: Record<string, unknown>;
}

// ============================================================================
// Configuration
// ============================================================================

export function isJotFormConfigured(): boolean {
  return !!(
    process.env.JOTFORM_API_KEY &&
    process.env.JOTFORM_EXCESS_FUNDS_FORM_ID
  );
}

function getJotFormConfig() {
  if (!isJotFormConfigured()) {
    return null;
  }

  return {
    apiKey: process.env.JOTFORM_API_KEY!,
    excessFundsFormId: process.env.JOTFORM_EXCESS_FUNDS_FORM_ID!,
    wholesaleFormId: process.env.JOTFORM_WHOLESALE_FORM_ID || process.env.JOTFORM_EXCESS_FUNDS_FORM_ID!,
    apiBase: 'https://api.jotform.com',
    signApiBase: 'https://sign.jotform.com/api',
    webhookSecret: process.env.JOTFORM_WEBHOOK_SECRET || '',
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create and send a signing packet to the client
 */
export async function createSigningPacket(
  config: SigningPacketConfig
): Promise<SigningPacketResult> {
  const jotform = getJotFormConfig();

  if (!jotform) {
    return {
      success: false,
      error: 'JotForm Sign not configured. Set JOTFORM_API_KEY and JOTFORM_EXCESS_FUNDS_FORM_ID environment variables.',
    };
  }

  const supabase = createClient();

  try {
    // Create packet record in database first
    const { data: packet, error: packetError } = await supabase
      .rpc('create_agreement_packet', {
        p_lead_id: config.leadId,
        p_selection_code: config.selectionCode,
        p_triggered_by: config.triggeredBy,
        p_source_message_sid: config.sourceMessageSid || null,
      });

    if (packetError) {
      throw new Error(`Failed to create packet: ${packetError.message}`);
    }

    const packetId = packet as string;

    // Determine which forms to include
    const formsToSign: { formId: string; type: string }[] = [];

    if (config.selectionCode === 1 || config.selectionCode === 3) {
      formsToSign.push({ formId: jotform.excessFundsFormId, type: 'excess_funds_recovery' });
    }

    if (config.selectionCode === 2 || config.selectionCode === 3) {
      formsToSign.push({ formId: jotform.wholesaleFormId, type: 'wholesale_assignment' });
    }

    // Calculate fees
    const excessFee = (config.selectionCode === 1 || config.selectionCode === 3)
      ? (config.excessFundsAmount || 0) * 0.25
      : 0;
    const wholesaleFee = (config.selectionCode === 2 || config.selectionCode === 3)
      ? (config.estimatedEquity || (config.excessFundsAmount || 0) * 0.5) * 0.10
      : 0;

    // Create JotForm Sign document request
    // For JotForm Sign, we use prefilled forms with signing enabled
    const prefilledData = {
      // Standard JotForm prefill format
      client_name: config.clientName,
      client_email: config.clientEmail || '',
      client_phone: config.clientPhone,
      property_address: config.propertyAddress || '',
      case_number: config.caseNumber || '',
      excess_funds_amount: config.excessFundsAmount?.toFixed(2) || '0.00',
      excess_fee_amount: excessFee.toFixed(2),
      wholesale_fee_amount: wholesaleFee.toFixed(2),
      total_fee_amount: (excessFee + wholesaleFee).toFixed(2),
      agreement_date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      // Internal tracking
      packet_id: packetId,
      lead_id: config.leadId,
    };

    // For single document, use direct form prefill
    // For multiple documents (selection 3), create a JotForm Sign packet
    let signingLink: string;
    let providerDocumentId: string;

    if (formsToSign.length === 1) {
      // Single document flow
      const formId = formsToSign[0].formId;
      const prefillParams = buildPrefillQueryString(prefilledData);

      // Generate JotForm prefilled link with signing
      signingLink = `https://form.jotform.com/${formId}?${prefillParams}`;
      providerDocumentId = `${formId}_${packetId}`;
    } else {
      // Multi-document flow using JotForm Sign API
      const signResult = await createJotFormSignPacket(
        jotform,
        formsToSign,
        prefilledData,
        packetId
      );

      if (!signResult.success) {
        throw new Error(signResult.error || 'Failed to create JotForm Sign packet');
      }

      signingLink = signResult.signingLink!;
      providerDocumentId = signResult.documentId!;
    }

    // Update packet with signing details
    await supabase
      .from('agreement_packets')
      .update({
        signing_link: signingLink,
        provider_document_id: providerDocumentId,
        signing_link_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', packetId);

    // Log send event
    await supabase.from('agreement_events').insert({
      packet_id: packetId,
      event_type: 'sent',
      source: config.triggeredBy,
      event_data: {
        signing_link: signingLink,
        provider_document_id: providerDocumentId,
        forms_included: formsToSign.map(f => f.type),
      },
    });

    return {
      success: true,
      packetId,
      signingLink,
      providerDocumentId,
    };

  } catch (error) {
    console.error('JotForm Sign error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating signing packet',
    };
  }
}

/**
 * Create a JotForm Sign multi-document packet
 */
async function createJotFormSignPacket(
  config: ReturnType<typeof getJotFormConfig>,
  forms: { formId: string; type: string }[],
  prefillData: Record<string, string>,
  packetId: string
): Promise<{ success: boolean; signingLink?: string; documentId?: string; error?: string }> {
  if (!config) {
    return { success: false, error: 'JotForm not configured' };
  }

  try {
    // JotForm Sign API endpoint for creating signing requests
    // Documentation: https://api.jotform.com/docs/
    const response = await fetch(`${config.signApiBase}/documents`, {
      method: 'POST',
      headers: {
        'APIKEY': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        forms: forms.map(f => ({
          formId: f.formId,
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
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://maxsam.vercel.app'}/api/webhooks/jotform-sign`,
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
      documentId: result.content?.documentId || result.documentId,
    };

  } catch (error) {
    console.error('JotForm Sign API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JotForm Sign API error',
    };
  }
}

/**
 * Build query string for JotForm prefill
 */
function buildPrefillQueryString(data: Record<string, string>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(data)) {
    if (value) {
      // JotForm uses specific prefill format: fieldName[fieldId]=value
      // For simplicity, we use direct field names that should be configured in the form
      params.append(key, value);
    }
  }

  return params.toString();
}

/**
 * Process webhook from JotForm Sign
 */
export async function processJotFormWebhook(
  payload: Record<string, unknown>
): Promise<{ success: boolean; action: string; error?: string }> {
  const supabase = createClient();

  try {
    // JotForm webhook format varies by event type
    const eventType = payload.event as string || payload.eventType as string || 'submission';
    const submissionId = payload.submissionID as string || payload.submission_id as string;
    const formId = payload.formID as string || payload.form_id as string;
    const rawAnswers = payload.rawRequest as string || JSON.stringify(payload);

    // Parse answers to find packet_id
    let packetId: string | null = null;

    if (typeof rawAnswers === 'string') {
      try {
        const parsed = JSON.parse(rawAnswers);
        packetId = parsed.packet_id || parsed.packetId;
      } catch {
        // Try to find in payload directly
        packetId = payload.packet_id as string || payload.packetId as string;
      }
    }

    // If no packet_id, try to find by provider_document_id
    if (!packetId && (submissionId || formId)) {
      const { data: packet } = await supabase
        .from('agreement_packets')
        .select('id')
        .or(`provider_document_id.eq.${formId}_${submissionId},provider_document_id.eq.${submissionId}`)
        .single();

      if (packet) {
        packetId = packet.id;
      }
    }

    if (!packetId) {
      console.warn('JotForm webhook received without packet_id:', payload);
      return { success: false, action: 'ignored', error: 'No packet_id found' };
    }

    // Map JotForm event to our status
    let newStatus: string;
    let eventAction: string;

    switch (eventType.toLowerCase()) {
      case 'submission':
      case 'signed':
      case 'completed':
        newStatus = 'signed';
        eventAction = 'signed';
        break;
      case 'viewed':
      case 'opened':
        newStatus = 'viewed';
        eventAction = 'document_viewed';
        break;
      case 'declined':
      case 'rejected':
        newStatus = 'declined';
        eventAction = 'declined';
        break;
      case 'expired':
        newStatus = 'expired';
        eventAction = 'expired';
        break;
      default:
        // Log unknown event but don't fail
        console.log('Unknown JotForm event:', eventType);
        return { success: true, action: 'logged' };
    }

    // Update packet status
    await supabase.rpc('update_agreement_status', {
      p_packet_id: packetId,
      p_new_status: newStatus,
      p_event_type: eventAction,
      p_event_data: { webhook_payload: payload, submission_id: submissionId },
      p_source: 'webhook',
    });

    // If signed, trigger post-signing workflow
    if (newStatus === 'signed') {
      // Update documents within the packet
      await supabase
        .from('agreement_documents')
        .update({ status: 'signed', signed_at: new Date().toISOString() })
        .eq('packet_id', packetId);

      // Trigger downstream actions (will be handled by n8n)
      await triggerPostSigningWorkflow(packetId);
    }

    return { success: true, action: eventAction };

  } catch (error) {
    console.error('JotForm webhook processing error:', error);
    return {
      success: false,
      action: 'error',
      error: error instanceof Error ? error.message : 'Webhook processing error',
    };
  }
}

/**
 * Trigger post-signing workflow via n8n
 */
async function triggerPostSigningWorkflow(packetId: string): Promise<void> {
  const webhookUrl = process.env.N8N_AGREEMENT_COMPLETION_WEBHOOK;

  if (!webhookUrl) {
    console.warn('N8N_AGREEMENT_COMPLETION_WEBHOOK not configured');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packet_id: packetId, event: 'signed' }),
    });
  } catch (error) {
    console.error('Failed to trigger post-signing workflow:', error);
  }
}

/**
 * Get signed document PDF from JotForm
 */
export async function getSignedDocument(
  submissionId: string
): Promise<SignedDocumentResult> {
  const config = getJotFormConfig();

  if (!config) {
    return { success: false, error: 'JotForm not configured' };
  }

  try {
    // JotForm API endpoint for getting submission PDF
    const response = await fetch(
      `${config.apiBase}/submission/${submissionId}?apiKey=${config.apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch submission: ${response.status}`);
    }

    const data = await response.json();

    // The PDF URL is typically in the submission response
    const pdfUrl = data.content?.pdfUrl || data.pdfUrl;

    if (pdfUrl) {
      // Download the PDF
      const pdfResponse = await fetch(pdfUrl);

      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
      }

      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

      return {
        success: true,
        pdfBuffer,
        pdfUrl,
      };
    }

    return {
      success: false,
      error: 'No PDF URL found in submission',
    };

  } catch (error) {
    console.error('Error fetching signed document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch signed document',
    };
  }
}

/**
 * Send signing link to client via SMS and Email
 */
export async function sendSigningLink(
  packetId: string
): Promise<{ success: boolean; smsSent: boolean; emailSent: boolean; error?: string }> {
  const supabase = createClient();

  // Fetch packet details
  const { data: packet, error } = await supabase
    .from('agreement_packets')
    .select('*')
    .eq('id', packetId)
    .single();

  if (error || !packet) {
    return { success: false, smsSent: false, emailSent: false, error: 'Packet not found' };
  }

  if (!packet.signing_link) {
    return { success: false, smsSent: false, emailSent: false, error: 'No signing link generated' };
  }

  let smsSent = false;
  let emailSent = false;

  // Send SMS
  if (packet.client_phone) {
    const { sendSMS } = await import('./twilio');

    const smsMessage = buildSigningSmsMessage(packet);
    const smsResult = await sendSMS(packet.client_phone, smsMessage, packet.lead_id);

    smsSent = smsResult.success;

    if (!smsSent) {
      console.warn('Failed to send signing SMS:', smsResult.error);
    }
  }

  // Send Email (if email available)
  if (packet.client_email) {
    emailSent = await sendSigningEmail(packet);
  }

  return {
    success: smsSent || emailSent,
    smsSent,
    emailSent,
    error: (!smsSent && !emailSent) ? 'Failed to send via SMS and Email' : undefined,
  };
}

/**
 * Build SMS message for signing link
 */
function buildSigningSmsMessage(packet: {
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

/**
 * Send signing email via Gmail (n8n will handle this)
 */
async function sendSigningEmail(packet: {
  client_email: string;
  client_name: string;
  property_address?: string;
  signing_link: string;
  total_fee?: number;
  lead_id?: string;
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

/**
 * Send reminder for unsigned agreement
 */
export async function sendReminder(packetId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { data: packet, error } = await supabase
    .from('agreement_packets')
    .select('*')
    .eq('id', packetId)
    .single();

  if (error || !packet) {
    return { success: false, error: 'Packet not found' };
  }

  if (packet.status !== 'sent') {
    return { success: false, error: `Cannot send reminder for status: ${packet.status}` };
  }

  if (packet.reminder_count >= 3) {
    return { success: false, error: 'Max reminders already sent' };
  }

  // Build reminder message based on attempt number
  const reminderMessages = [
    `Hi ${packet.client_name?.split(' ')[0]}! Just a reminder - your agreement is ready to sign. Takes 60 seconds: ${packet.signing_link}`,
    `${packet.client_name?.split(' ')[0]}, we haven't heard back yet. Your $${packet.total_fee?.toLocaleString() || '0'} recovery is waiting. Sign here: ${packet.signing_link}`,
    `Final reminder: Your agreement expires soon. Don't miss out on $${packet.total_fee?.toLocaleString() || '0'}. Sign now: ${packet.signing_link}`,
  ];

  const message = reminderMessages[packet.reminder_count] || reminderMessages[2];

  // Send SMS
  if (packet.client_phone) {
    const { sendSMS } = await import('./twilio');
    const result = await sendSMS(packet.client_phone, message, packet.lead_id);

    if (result.success) {
      // Record reminder sent
      await supabase.rpc('record_reminder_sent', { p_packet_id: packetId });
      return { success: true };
    }

    return { success: false, error: result.error };
  }

  return { success: false, error: 'No phone number for reminder' };
}
