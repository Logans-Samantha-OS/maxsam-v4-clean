import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client
 * IMPORTANT:
 * - This file runs ONLY on the server
 * - Service role key is safe here
 */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase environment variables are not set');
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * GET /api/leads
 * Supports filtering, search, sorting, pagination
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const searchParams = request.nextUrl.searchParams;

    // ---- Query params ----
    const status = searchParams.get('status');
    const minAmount = Number(searchParams.get('minAmount'));
    const minScore = Number(searchParams.get('minScore'));
    const hasPhone = searchParams.get('hasPhone') === 'true';
    const search = searchParams.get('search');

    const sortBy = searchParams.get('sortBy') || 'eleanor_score';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);
    const offset = (page - 1) * limit;

    // ---- Base query ----
    let query = supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact' })
      .neq('status', 'deleted');

    // ---- Filters ----
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (!Number.isNaN(minAmount)) {
      query = query.gte('excess_funds_amount', minAmount);
    }

    if (!Number.isNaN(minScore)) {
      query = query.gte('eleanor_score', minScore);
    }

    if (hasPhone) {
      query = query.or('phone.not.is.null,phone_1.not.is.null,phone_2.not.is.null,owner_phone.not.is.null');
    }

    if (search) {
      query = query.or(
        `owner_name.ilike.%${search}%,property_address.ilike.%${search}%,phone_1.ilike.%${search}%`
      );
    }

    // ---- Sort + paginate ----
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Leads query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      leads: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    console.error('GET /api/leads failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/leads
 * Create a new lead
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const payload = {
      ...body,
      status: body.status ?? 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('maxsam_leads')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Lead insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/leads failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
