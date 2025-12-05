/**
 * Twilio Integration for MaxSam V4
 * Powers Sam AI's SMS and voice outreach capabilities
 */

import { createClient } from './supabase/server';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

/**
 * Get Twilio configuration
 */
function getConfig(): TwilioConfig | null {
  if (!isTwilioConfigured()) {
    console.warn('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
    return null;
  }

  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!
  };
}

/**
 * Check if a phone number has opted out
 */
export async function isOptedOut(phone: string): Promise<boolean> {
  const supabase = createClient();

  // Normalize phone number
  const normalizedPhone = normalizePhone(phone);

  const { data } = await supabase
    .from('opt_outs')
    .select('phone')
    .eq('phone', normalizedPhone)
    .single();

  return !!data;
}

/**
 * Add a phone number to opt-out list
 */
export async function addOptOut(phone: string, source: string = 'sms'): Promise<void> {
  const supabase = createClient();
  const normalizedPhone = normalizePhone(phone);

  await supabase.from('opt_outs').upsert({
    phone: normalizedPhone,
    source,
    opted_out_at: new Date().toISOString()
  });
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Add US country code if not present
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(
  to: string,
  message: string,
  leadId?: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const config = getConfig();

  if (!config) {
    return { success: false, error: 'Twilio not configured' };
  }

  // Normalize phone number
  const toPhone = normalizePhone(to);

  // Check opt-out list (TCPA compliance)
  if (await isOptedOut(toPhone)) {
    return { success: false, error: 'Phone number has opted out' };
  }

  try {
    // Build Twilio API URL
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;

    // Make API call
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: toPhone,
        From: config.phoneNumber,
        Body: message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Twilio API error');
    }

    // Log communication
    if (leadId) {
      const supabase = createClient();
      await supabase.from('communication_logs').insert({
        lead_id: leadId,
        type: 'sms',
        direction: 'outbound',
        from_number: config.phoneNumber,
        to_number: toPhone,
        content: message,
        twilio_sid: data.sid,
        status: 'sent',
        created_at: new Date().toISOString()
      });
    }

    return { success: true, sid: data.sid };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Twilio SMS error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Initiate a voice call via Twilio
 */
export async function initiateCall(
  to: string,
  twimlUrl: string,
  leadId?: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const config = getConfig();

  if (!config) {
    return { success: false, error: 'Twilio not configured' };
  }

  const toPhone = normalizePhone(to);

  // Check opt-out list
  if (await isOptedOut(toPhone)) {
    return { success: false, error: 'Phone number has opted out' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: toPhone,
        From: config.phoneNumber,
        Url: twimlUrl
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Twilio API error');
    }

    // Log communication
    if (leadId) {
      const supabase = createClient();
      await supabase.from('communication_logs').insert({
        lead_id: leadId,
        type: 'voice',
        direction: 'outbound',
        from_number: config.phoneNumber,
        to_number: toPhone,
        twilio_sid: data.sid,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }

    return { success: true, sid: data.sid };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Twilio call error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Look up phone number information
 */
export async function lookupPhone(phone: string): Promise<{
  valid: boolean;
  carrier?: string;
  type?: string;
  error?: string;
}> {
  const config = getConfig();

  if (!config) {
    return { valid: false, error: 'Twilio not configured' };
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(normalizedPhone)}?Fields=line_type_intelligence`;

    const response = await fetch(url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { valid: false, error: data.message };
    }

    return {
      valid: data.valid,
      carrier: data.line_type_intelligence?.carrier_name,
      type: data.line_type_intelligence?.type
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: errorMessage };
  }
}
