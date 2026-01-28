/**
 * Marketplace Sell API - Complete a lead sale to a buyer
 * POST: Record a sale transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { inventory_id, buyer_id, sale_price, sale_method = 'direct', notes } = await request.json();
    
    if (!inventory_id || !buyer_id || !sale_price) {
      return NextResponse.json({ error: 'inventory_id, buyer_id, and sale_price required' }, { status: 400 });
    }

    // Get inventory item
    const { data: inventory, error: invError } = await supabase
      .from('marketplace_inventory')
      .select('*')
      .eq('id', inventory_id)
      .eq('status', 'available')
      .single();

    if (invError || !inventory) {
      return NextResponse.json({ error: 'Listing not found or already sold' }, { status: 404 });
    }

    // Create sale record
    const { data: sale, error: saleError } = await supabase
      .from('lead_sales')
      .insert({
        inventory_id,
        lead_id: inventory.lead_id,
        buyer_id,
        lead_type: inventory.lead_type,
        sale_price,
        sale_method,
        notes
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Mark inventory as sold
    await supabase
      .from('marketplace_inventory')
      .update({ 
        status: 'sold', 
        sold_at: new Date().toISOString() 
      })
      .eq('id', inventory_id);

    // Update buyer stats
    await supabase.rpc('increment_buyer_stats', { 
      p_buyer_id: buyer_id, 
      p_amount: sale_price 
    });

    // Update lead status
    await supabase
      .from('maxsam_leads')
      .update({ 
        status: 'sold', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', inventory.lead_id);

    return NextResponse.json({ success: true, sale });
  } catch (error: any) {
    console.error('Marketplace Sell error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Get sales history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const buyer_id = searchParams.get('buyer_id');

    let query = supabase
      .from('lead_sales')
      .select(`
        *,
        buyer:maxsam_buyers(id, name, company_name, email),
        lead:maxsam_leads(id, owner_name, property_address, county)
      `)
      .order('sold_at', { ascending: false })
      .limit(limit);

    if (buyer_id) {
      query = query.eq('buyer_id', buyer_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Calculate totals
    const totalRevenue = (data || []).reduce((sum, sale) => sum + (sale.sale_price || 0), 0);
    const totalSales = data?.length || 0;

    return NextResponse.json({ 
      sales: data, 
      totalRevenue, 
      totalSales 
    });
  } catch (error: any) {
    console.error('Marketplace Sales GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
