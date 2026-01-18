/**
 * GET /api/os/approvals - List pending approvals for OS review
 *
 * Requires OS authority. Returns all approvals with linked request and lead data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOSAuthority } from '@/lib/auth/authority-guard';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = requireOSAuthority(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';

    const supabase = getSupabase();

    const { data, error, count } = await supabase
      .from('approvals')
      .select(`
        *,
        saas_requests(*),
        maxsam_leads(id, owner_name, property_address, excess_funds_amount, eleanor_score, status)
      `, { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('OS approvals fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch approvals' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      approvals: data || [],
      total: count || 0,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('OS approvals list error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
