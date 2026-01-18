/**
 * /api/saas/requests - SaaS Requests Endpoint
 *
 * POST: Create a new request (awaiting OS approval)
 * GET: List requests and their statuses
 *
 * Requests do NOT execute anything - they create records for OS review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSaaSAuthority } from '@/lib/auth/authority-guard';
import { SaaSRequest, RequestType } from '@/types/shared';
import {
  SaaSCreateRequestPayload,
  SaaSCreateRequestResponse,
  SaaSRequestsResponse,
} from '@/types/saas';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const VALID_REQUEST_TYPES: RequestType[] = [
  'contact_request',
  'contract_request',
  'info_request',
  'escalation_request',
];

/**
 * POST /api/saas/requests - Create a new request
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = requireSaaSAuthority(request);
  if (authError) return authError;

  try {
    const body = await request.json() as SaaSCreateRequestPayload;
    const { leadId, requestType, note } = body;

    // Validate input
    if (!leadId || typeof leadId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'leadId is required' } as SaaSCreateRequestResponse,
        { status: 400 }
      );
    }

    if (!requestType || !VALID_REQUEST_TYPES.includes(requestType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid requestType. Must be one of: ${VALID_REQUEST_TYPES.join(', ')}` } as SaaSCreateRequestResponse,
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { ok: false, error: `Lead not found: ${leadId}` } as SaaSCreateRequestResponse,
        { status: 404 }
      );
    }

    // Create the request
    const { data: newRequest, error: insertError } = await supabase
      .from('saas_requests')
      .insert({
        lead_id: leadId,
        request_type: requestType,
        note: note || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create request:', insertError);
      return NextResponse.json(
        { ok: false, error: 'Failed to create request' } as SaaSCreateRequestResponse,
        { status: 500 }
      );
    }

    // Also create a pending approval record
    await supabase.from('approvals').insert({
      lead_id: leadId,
      request_id: newRequest.id,
      status: 'pending',
    });

    const response: SaaSCreateRequestResponse = {
      ok: true,
      request: newRequest as SaaSRequest,
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('SaaS request creation error:', message);
    return NextResponse.json(
      { ok: false, error: message } as SaaSCreateRequestResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/saas/requests - List requests and statuses
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = requireSaaSAuthority(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // pending, approved, rejected
    const leadId = searchParams.get('leadId');

    const supabase = getSupabase();

    let query = supabase
      .from('saas_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    const { data, error, count } = await query.limit(100);

    if (error) {
      console.error('SaaS requests fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch requests' },
        { status: 500 }
      );
    }

    const response: SaaSRequestsResponse = {
      requests: (data || []) as SaaSRequest[],
      total: count || 0,
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('SaaS requests list error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
