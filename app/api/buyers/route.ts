/**
 * Buyer API - Full CRUD operations
 * All buyer data goes to Supabase maxsam_buyers table
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Fetch all buyers
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('maxsam_buyers')
      .select('*')
      .eq('is_active', true)
      .order('reliability_score', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Supabase GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch buyers';
    console.error('API GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create new buyer (from intake form)
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // Map intake form fields to maxsam_buyers columns
    const buyerData = {
      name: body.name || 'Unknown',
      company_name: body.company_name || null,
      email: body.email || null,
      phone: body.phone || null,
      counties_interested: body.counties_interested || [],
      min_price: body.min_price || null,
      max_price: body.max_price || null,
      property_types: body.property_types || [],
      is_cash_buyer: body.is_cash_buyer !== false,
      speed_to_close: body.speed_to_close || '14_days',
      monthly_capacity: body.monthly_capacity || 5,
      proof_of_funds: body.proof_of_funds || false,
      reliability_score: 50, // Default for new buyers
      is_active: true,
      notes: body.notes || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('maxsam_buyers')
      .insert([buyerData])
      .select()
      .single();

    if (error) {
      console.error('Supabase POST error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create buyer';
    console.error('API POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update existing buyer
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Buyer ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('maxsam_buyers')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase PUT error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update buyer';
    console.error('API PUT error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Remove buyer
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Buyer ID is required' }, { status: 400 });
    }

    // Soft delete - just deactivate
    const { error } = await supabase
      .from('maxsam_buyers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Supabase DELETE error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Buyer deactivated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete buyer';
    console.error('API DELETE error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
