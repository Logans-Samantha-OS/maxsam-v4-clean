import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supabase = getSupabase();

    // Filters
    const status = searchParams.get('status');
    const minAmount = searchParams.get('minAmount');
    const minScore = searchParams.get('minScore');
    const hasPhone = searchParams.get('hasPhone');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'eleanor_score';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact' })
      .neq('status', 'deleted'); // Exclude soft-deleted

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (minAmount) {
      query = query.gte('excess_funds_amount', parseInt(minAmount));
    }
    if (minScore) {
      query = query.gte('eleanor_score', parseInt(minScore));
    }
    if (hasPhone === 'true') {
      query = query.or('phone_1.neq.null,phone_2.neq.null');
    }
    if (search) {
      query = query.or(`owner_name.ilike.%${search}%,property_address.ilike.%${search}%,phone_1.ilike.%${search}%`);
    }

    // Sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      leads: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create new lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('maxsam_leads')
      .insert([{
        ...body,
        status: body.status || 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
