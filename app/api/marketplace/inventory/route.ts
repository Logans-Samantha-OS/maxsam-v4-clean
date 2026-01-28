/**
 * Marketplace Inventory API - Manage leads listed for sale
 * GET: List available inventory with filters
 * POST: List a new lead for sale
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default prices by lead type
const DEFAULT_PRICES: Record<string, number> = {
  distressed_seller: 75,
  excess_funds: 50,
  skip_trace: 25,
  mass_tort: 200,
  unclaimed_property: 50,
  death_benefit: 100,
  wholesale: 100
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'available';
    const lead_type = searchParams.get('lead_type');

    let query = supabase
      .from('marketplace_inventory')
      .select(`
        *,
        lead:maxsam_leads(
          id, 
          owner_name, 
          primary_phone,
          phone,
          email, 
          property_address, 
          city, 
          county,
          excess_funds_amount
        )
      `)
      .eq('status', status)
      .order('listed_at', { ascending: false });

    if (lead_type) {
      query = query.eq('lead_type', lead_type);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get summary stats for available inventory
    const { data: stats } = await supabase
      .from('marketplace_inventory')
      .select('lead_type, asking_price')
      .eq('status', 'available');

    const summary = {
      total: stats?.length || 0,
      totalValue: stats?.reduce((sum, item) => sum + (item.asking_price || 0), 0) || 0,
      by_type: stats?.reduce((acc: Record<string, { count: number; value: number }>, item) => {
        if (!acc[item.lead_type]) {
          acc[item.lead_type] = { count: 0, value: 0 };
        }
        acc[item.lead_type].count++;
        acc[item.lead_type].value += item.asking_price || 0;
        return acc;
      }, {}) || {}
    };

    return NextResponse.json({ inventory: data, summary, defaultPrices: DEFAULT_PRICES });
  } catch (error: any) {
    console.error('Marketplace Inventory GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lead_id, lead_type, asking_price, quality_score, source_vertical, description } = await request.json();
    
    if (!lead_id || !lead_type) {
      return NextResponse.json({ error: 'lead_id and lead_type required' }, { status: 400 });
    }

    // Check if already listed
    const { data: existing } = await supabase
      .from('marketplace_inventory')
      .select('id')
      .eq('lead_id', lead_id)
      .eq('status', 'available')
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Lead already listed' }, { status: 400 });
    }

    // Get lead data for quality score if not provided
    let finalQualityScore = quality_score;
    if (!finalQualityScore) {
      const { data: lead } = await supabase
        .from('maxsam_leads')
        .select('eleanor_score')
        .eq('id', lead_id)
        .single();
      finalQualityScore = lead?.eleanor_score || 50;
    }

    // Use default price if not provided
    const finalPrice = asking_price || DEFAULT_PRICES[lead_type] || 50;

    const { data, error } = await supabase
      .from('marketplace_inventory')
      .insert({ 
        lead_id, 
        lead_type, 
        asking_price: finalPrice, 
        quality_score: finalQualityScore, 
        source_vertical,
        description
      })
      .select()
      .single();

    if (error) throw error;

    // Update lead status
    await supabase
      .from('maxsam_leads')
      .update({ status: 'listed_for_sale', updated_at: new Date().toISOString() })
      .eq('id', lead_id);

    return NextResponse.json({ success: true, listing: data });
  } catch (error: any) {
    console.error('Marketplace Inventory POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const inventory_id = searchParams.get('id');

    if (!inventory_id) {
      return NextResponse.json({ error: 'Inventory ID required' }, { status: 400 });
    }

    // Get the listing to find lead_id
    const { data: listing } = await supabase
      .from('marketplace_inventory')
      .select('lead_id')
      .eq('id', inventory_id)
      .single();

    // Mark as withdrawn
    const { error } = await supabase
      .from('marketplace_inventory')
      .update({ status: 'withdrawn' })
      .eq('id', inventory_id);

    if (error) throw error;

    // Update lead status back
    if (listing?.lead_id) {
      await supabase
        .from('maxsam_leads')
        .update({ status: 'new', updated_at: new Date().toISOString() })
        .eq('id', listing.lead_id);
    }

    return NextResponse.json({ success: true, message: 'Listing withdrawn' });
  } catch (error: any) {
    console.error('Marketplace Inventory DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
