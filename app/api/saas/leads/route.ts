/**
 * GET /api/saas/leads - SaaS Leads Endpoint (Read-Only)
 *
 * Returns a curated subset of lead data for SaaS consumers.
 * No internal fields, agent reasoning, or autonomy metadata exposed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSaaSAuthority } from '@/lib/auth/authority-guard';
import { LeadPublic } from '@/types/shared';
import { SaaSLeadsResponse } from '@/types/saas';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Fields exposed to SaaS layer - curated subset only
 */
const SAAS_LEAD_FIELDS = [
  'id',
  'owner_name',
  'property_address',
  'city',
  'state',
  'excess_funds_amount',
  'eleanor_score',
  'status',
  'updated_at',
].join(',');

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate authority (SaaS or OS both allowed)
  const authError = requireSaaSAuthority(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    const supabase = getSupabase();

    const { data, error, count } = await supabase
      .from('maxsam_leads')
      .select(SAAS_LEAD_FIELDS, { count: 'exact' })
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('SaaS leads fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      );
    }

    const response: SaaSLeadsResponse = {
      leads: (data as unknown as LeadPublic[]) || [],
      total: count || 0,
      page,
      limit,
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('SaaS leads error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
