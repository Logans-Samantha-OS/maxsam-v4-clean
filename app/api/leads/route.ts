import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateEleanorScore } from '@/lib/eleanor';

/**
 * GET /api/leads - List all leads with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // Build query
    let query = supabase.from('maxsam_leads').select('*');

    // Filters
    const status = searchParams.get('status');
    if (status) {
      query = query.eq('status', status);
    }

    const priority = searchParams.get('priority');
    if (priority) {
      query = query.eq('contact_priority', priority);
    }

    const dealType = searchParams.get('deal_type');
    if (dealType) {
      query = query.eq('deal_type', dealType);
    }

    const minScore = searchParams.get('min_score');
    if (minScore) {
      query = query.gte('eleanor_score', parseInt(minScore));
    }

    // Sorting
    const sortBy = searchParams.get('sort') || 'eleanor_score';
    const sortOrder = searchParams.get('order') || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      leads: data,
      count: count,
      limit,
      offset
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/leads - Create a new lead
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.property_address && !body.owner_name) {
      return NextResponse.json(
        { error: 'Either property_address or owner_name is required' },
        { status: 400 }
      );
    }

    // Calculate Eleanor score if we have excess funds amount
    let scoring = null;
    if (body.excess_funds_amount) {
      scoring = calculateEleanorScore({
        id: '',
        excess_funds_amount: body.excess_funds_amount,
        estimated_arv: body.estimated_arv,
        estimated_repair_cost: body.estimated_repair_cost,
        phone: body.phone,
        email: body.email,
        owner_name: body.owner_name,
        zip_code: body.zip_code,
        property_address: body.property_address
      });
    }

    // Insert lead
    const { data, error } = await supabase
      .from('maxsam_leads')
      .insert({
        ...body,
        status: body.status || 'new',
        eleanor_score: scoring?.eleanor_score,
        deal_grade: scoring?.deal_grade,
        contact_priority: scoring?.contact_priority,
        deal_type: scoring?.deal_type,
        potential_revenue: scoring?.potential_revenue,
        eleanor_reasoning: scoring?.reasoning,
        scored_at: scoring ? new Date().toISOString() : null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lead: data }, { status: 201 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
