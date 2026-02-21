/**
 * Auto-Route Rules API - Manage automatic lead routing rules
 * GET: List all routing rules
 * POST: Create a new routing rule
 * PUT: Update a rule
 * DELETE: Deactivate a rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('auto_routing_rules')
      .select(`
        *,
        buyer:maxsam_buyers(id, name, company_name, email)
      `)
      .order('priority', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ 
      rules: data,
      total: data?.length || 0,
      active: data?.filter(r => r.is_active).length || 0
    });
  } catch (error: any) {
    console.error('Auto-Route Rules GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, lead_type, buyer_id, price, conditions = {}, priority = 0, description } = body;

    if (!name || !lead_type || !buyer_id || !price) {
      return NextResponse.json({ 
        error: 'name, lead_type, buyer_id, and price are required' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('auto_routing_rules')
      .insert({
        name,
        description,
        lead_type,
        buyer_id,
        price,
        conditions,
        priority
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, rule: data });
  } catch (error: any) {
    console.error('Auto-Route Rules POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('auto_routing_rules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, rule: data });
  } catch (error: any) {
    console.error('Auto-Route Rules PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    // Soft delete - just deactivate
    const { error } = await supabase
      .from('auto_routing_rules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Rule deactivated' });
  } catch (error: unknown) {
    console.error('Auto-Route Rules DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
