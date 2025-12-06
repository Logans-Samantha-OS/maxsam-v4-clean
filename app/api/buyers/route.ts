/**
 * Buyer API - Full CRUD operations
 * All buyer data goes to Supabase buyers table
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
      .from('buyers')
      .select('*')
      .order('deals_closed', { ascending: false });

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

// POST - Create new buyer
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // Map form fields to database columns
    const buyerData = {
      name: body.full_name || body.name || 'Unknown',
      full_name: body.full_name || body.name,
      company: body.company || body.company_name || null,
      company_name: body.company || body.company_name || null,
      email: body.email || null,
      phone: body.phone || null,
      secondary_phone: body.secondary_phone || null,
      property_types: body.property_types || [],
      preferred_zips: body.preferred_zips || null,
      min_purchase_price: body.min_purchase_price ? parseFloat(body.min_purchase_price) : null,
      max_purchase_price: body.max_purchase_price ? parseFloat(body.max_purchase_price) : null,
      min_arv: body.min_arv ? parseFloat(body.min_arv) : null,
      max_arv: body.max_arv ? parseFloat(body.max_arv) : null,
      condition_preference: body.condition_preference || 'any',
      deal_types: body.deal_types || [],
      closing_speed: body.closing_speed || '30 days',
      funding_type: body.funding_type || 'cash',
      proof_of_funds: body.proof_of_funds || false,
      deals_closed: body.deals_closed ? parseInt(body.deals_closed) : 0,
      average_deal_size: body.average_deal_size ? parseFloat(body.average_deal_size) : 0,
      reliability_rating: body.reliability_rating ? parseInt(body.reliability_rating) : 3,
      is_active: body.is_active !== false,
      status: body.status || 'active',
      notes: body.notes || null,
    };

    const { data, error } = await supabase
      .from('buyers')
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

    // Map form fields to database columns
    const buyerData = {
      name: updateData.full_name || updateData.name,
      full_name: updateData.full_name || updateData.name,
      company: updateData.company || updateData.company_name || null,
      company_name: updateData.company || updateData.company_name || null,
      email: updateData.email || null,
      phone: updateData.phone || null,
      secondary_phone: updateData.secondary_phone || null,
      property_types: updateData.property_types || [],
      preferred_zips: updateData.preferred_zips || null,
      min_purchase_price: updateData.min_purchase_price ? parseFloat(updateData.min_purchase_price) : null,
      max_purchase_price: updateData.max_purchase_price ? parseFloat(updateData.max_purchase_price) : null,
      min_arv: updateData.min_arv ? parseFloat(updateData.min_arv) : null,
      max_arv: updateData.max_arv ? parseFloat(updateData.max_arv) : null,
      condition_preference: updateData.condition_preference || 'any',
      deal_types: updateData.deal_types || [],
      closing_speed: updateData.closing_speed || '30 days',
      funding_type: updateData.funding_type || 'cash',
      proof_of_funds: updateData.proof_of_funds || false,
      deals_closed: updateData.deals_closed ? parseInt(updateData.deals_closed) : 0,
      average_deal_size: updateData.average_deal_size ? parseFloat(updateData.average_deal_size) : 0,
      reliability_rating: updateData.reliability_rating ? parseInt(updateData.reliability_rating) : 3,
      is_active: updateData.is_active !== false,
      status: updateData.status || 'active',
      notes: updateData.notes || null,
    };

    const { data, error } = await supabase
      .from('buyers')
      .update(buyerData)
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

    const { error } = await supabase
      .from('buyers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase DELETE error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Buyer deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete buyer';
    console.error('API DELETE error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
