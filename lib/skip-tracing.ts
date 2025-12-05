/**
 * Skip Tracing Integration for MaxSam V4
 * Finds contact information for leads
 */

import { createClient } from './supabase/server';
import { normalizePhone } from './twilio';

interface SkipTraceResult {
  phone?: string;
  email?: string;
  alternatePhones?: string[];
  alternateEmails?: string[];
  address?: string;
  success: boolean;
  error?: string;
}

/**
 * Check if skip tracing is configured
 */
export function isSkipTracingConfigured(): boolean {
  return !!process.env.BATCH_SKIP_TRACING_API_KEY;
}

/**
 * Skip trace a lead using BatchSkipTracing API
 */
export async function skipTraceLead(
  ownerName: string,
  propertyAddress: string,
  city: string,
  state: string
): Promise<SkipTraceResult> {
  if (!isSkipTracingConfigured()) {
    return {
      success: false,
      error: 'Skip tracing not configured. Set BATCH_SKIP_TRACING_API_KEY'
    };
  }

  try {
    // BatchSkipTracing API call
    // Note: Adjust endpoint and format based on actual API documentation
    const response = await fetch('https://api.batchskiptracing.com/api/v1/skip-trace', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BATCH_SKIP_TRACING_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        first_name: ownerName.split(' ')[0] || '',
        last_name: ownerName.split(' ').slice(1).join(' ') || ownerName,
        address: propertyAddress,
        city: city,
        state: state
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse response (adjust based on actual API response format)
    return {
      success: true,
      phone: data.phone || data.phones?.[0] || data.mobile,
      email: data.email || data.emails?.[0],
      alternatePhones: data.phones?.slice(1) || data.alternate_phones,
      alternateEmails: data.emails?.slice(1) || data.alternate_emails,
      address: data.current_address || data.mailing_address
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Skip trace error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Skip trace a lead by ID and update the database
 */
export async function skipTraceLeadById(leadId: string): Promise<SkipTraceResult> {
  const supabase = createClient();

  // Get lead data
  const { data: lead, error: leadError } = await supabase
    .from('maxsam_leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    return { success: false, error: 'Lead not found' };
  }

  // Skip trace
  const result = await skipTraceLead(
    lead.owner_name || '',
    lead.property_address || '',
    lead.city || '',
    lead.state || 'TX'
  );

  if (result.success) {
    // Update lead with new contact info
    const updates: Record<string, unknown> = {};

    if (result.phone && !lead.phone) {
      updates.phone = normalizePhone(result.phone);
    }

    if (result.email && !lead.email) {
      updates.email = result.email;
    }

    if (result.alternatePhones?.length && !lead.phone_1) {
      updates.phone_1 = normalizePhone(result.alternatePhones[0]);
    }

    if ((result.alternatePhones?.length ?? 0) > 1 && !lead.phone_2) {
      updates.phone_2 = normalizePhone(result.alternatePhones![1]);
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('maxsam_leads')
        .update(updates)
        .eq('id', leadId);

      // Log status history
      await supabase.from('status_history').insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: lead.status,
        changed_by: 'skip_trace',
        reason: `Skip trace found: ${Object.keys(updates).join(', ')}`
      });
    }
  }

  return result;
}

/**
 * Batch skip trace multiple leads
 */
export async function batchSkipTrace(
  leadIds: string[]
): Promise<{ successful: number; failed: number; errors: string[] }> {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const leadId of leadIds) {
    const result = await skipTraceLeadById(leadId);

    if (result.success) {
      successful++;
    } else {
      failed++;
      errors.push(`${leadId}: ${result.error}`);
    }

    // Delay between API calls to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { successful, failed, errors };
}

/**
 * Find leads that need skip tracing (no phone number)
 */
export async function findLeadsNeedingSkipTrace(limit: number = 50): Promise<string[]> {
  const supabase = createClient();

  const { data: leads } = await supabase
    .from('maxsam_leads')
    .select('id')
    .is('phone', null)
    .is('phone_1', null)
    .is('phone_2', null)
    .not('status', 'in', '("closed","dead")')
    .order('eleanor_score', { ascending: false })
    .limit(limit);

  return leads?.map(l => l.id) || [];
}

/**
 * Alternative: Free skip trace using public records (limited)
 * This is a fallback when BatchSkipTracing is not configured
 */
export async function freeSkipTrace(
  ownerName: string,
  propertyAddress: string,
  city: string,
  state: string
): Promise<SkipTraceResult> {
  // This would use free APIs like:
  // - Property records lookup
  // - USPS address validation
  // - Public voter records
  // For now, return not configured
  return {
    success: false,
    error: 'Free skip tracing not implemented. Use BatchSkipTracing API.'
  };
}
