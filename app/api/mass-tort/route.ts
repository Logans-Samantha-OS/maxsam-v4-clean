/**
 * Mass Tort Campaigns API - Manage tort lead campaigns
 * GET: List all campaigns
 * POST: Create a new campaign
 * PUT: Update a campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Common tort types and their default pricing
const TORT_TYPES = [
  { type: 'camp_lejeune', label: 'Camp Lejeune', price: 150 },
  { type: 'roundup', label: 'Roundup/Glyphosate', price: 200 },
  { type: 'talcum', label: 'Talcum Powder', price: 175 },
  { type: 'paraquat', label: 'Paraquat', price: 225 },
  { type: 'asbestos', label: 'Asbestos/Mesothelioma', price: 300 },
  { type: 'hair_relaxer', label: 'Hair Relaxer', price: 150 },
  { type: 'zantac', label: 'Zantac', price: 125 },
  { type: 'hernia_mesh', label: 'Hernia Mesh', price: 175 },
  { type: 'nec', label: 'NEC Baby Formula', price: 200 },
  { type: 'firefighter_foam', label: 'Firefighter Foam (AFFF)', price: 200 }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('mass_tort_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Calculate totals
    const totalLeads = (data || []).reduce((sum, c) => sum + (c.leads_generated || 0), 0);
    const totalQualified = (data || []).reduce((sum, c) => sum + (c.leads_qualified || 0), 0);
    const totalRevenue = (data || []).reduce((sum, c) => sum + (c.revenue || 0), 0);

    return NextResponse.json({ 
      campaigns: data,
      total: data?.length || 0,
      summary: {
        totalLeads,
        totalQualified,
        totalRevenue,
        conversionRate: totalLeads > 0 ? ((totalQualified / totalLeads) * 100).toFixed(1) : 0
      },
      tortTypes: TORT_TYPES
    });
  } catch (error: any) {
    console.error('Mass Tort Campaigns GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      tort_type, 
      description,
      qualification_criteria = {},
      price_per_lead,
      sms_template,
      email_template,
      screening_questions = [],
      target_leads,
      start_date,
      end_date
    } = body;

    if (!name || !tort_type) {
      return NextResponse.json({ 
        error: 'name and tort_type are required' 
      }, { status: 400 });
    }

    // Get default price if not provided
    const defaultTort = TORT_TYPES.find(t => t.type === tort_type);
    const finalPrice = price_per_lead || defaultTort?.price || 150;

    const { data, error } = await supabase
      .from('mass_tort_campaigns')
      .insert({
        name,
        tort_type,
        description,
        qualification_criteria,
        price_per_lead: finalPrice,
        sms_template,
        email_template,
        screening_questions,
        target_leads,
        start_date,
        end_date
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, campaign: data });
  } catch (error: any) {
    console.error('Mass Tort Campaigns POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mass_tort_campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, campaign: data });
  } catch (error: any) {
    console.error('Mass Tort Campaigns PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
