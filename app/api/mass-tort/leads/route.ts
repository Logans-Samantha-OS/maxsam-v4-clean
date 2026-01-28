/**
 * Mass Tort Leads API - Manage tort case leads
 * GET: List leads for a campaign
 * POST: Add a lead to a campaign
 * PUT: Update lead qualification status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaign_id = searchParams.get('campaign_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('mass_tort_leads')
      .select(`
        *,
        lead:maxsam_leads(id, owner_name, primary_phone, phone, email, property_address, city, county),
        campaign:mass_tort_campaigns(id, name, tort_type, price_per_lead),
        buyer:maxsam_buyers(id, name, company_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }

    if (status) {
      query = query.eq('qualification_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Calculate stats
    const stats = {
      total: data?.length || 0,
      pending: data?.filter(l => l.qualification_status === 'pending').length || 0,
      screening: data?.filter(l => l.qualification_status === 'screening').length || 0,
      qualified: data?.filter(l => l.qualification_status === 'qualified').length || 0,
      disqualified: data?.filter(l => l.qualification_status === 'disqualified').length || 0,
      sold: data?.filter(l => l.qualification_status === 'sold').length || 0
    };

    return NextResponse.json({ leads: data, stats });
  } catch (error: any) {
    console.error('Mass Tort Leads GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      campaign_id, 
      lead_id, 
      tort_type,
      injury_details,
      diagnosis_date,
      treatment_history,
      screening_answers = {}
    } = body;

    if (!lead_id || !tort_type) {
      return NextResponse.json({ 
        error: 'lead_id and tort_type are required' 
      }, { status: 400 });
    }

    // Check if lead already exists in this tort type
    const { data: existing } = await supabase
      .from('mass_tort_leads')
      .select('id')
      .eq('lead_id', lead_id)
      .eq('tort_type', tort_type)
      .single();

    if (existing) {
      return NextResponse.json({ 
        error: 'Lead already enrolled in this tort campaign' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mass_tort_leads')
      .insert({
        campaign_id,
        lead_id,
        tort_type,
        injury_details,
        diagnosis_date,
        treatment_history,
        screening_answers,
        qualification_status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Increment campaign lead count
    if (campaign_id) {
      await supabase.rpc('increment', { 
        table_name: 'mass_tort_campaigns',
        column_name: 'leads_generated',
        row_id: campaign_id
      }).catch(() => {
        // Fallback if RPC doesn't exist
        supabase
          .from('mass_tort_campaigns')
          .update({ 
            leads_generated: supabase.rpc('coalesce', ['leads_generated', 0]) + 1 
          })
          .eq('id', campaign_id);
      });
    }

    return NextResponse.json({ success: true, tortLead: data });
  } catch (error: any) {
    console.error('Mass Tort Leads POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, qualification_status, screening_answers, injury_details, notes, buyer_id, sale_price } = body;

    if (!id) {
      return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (qualification_status) {
      updates.qualification_status = qualification_status;
      
      if (qualification_status === 'qualified') {
        updates.qualified_at = new Date().toISOString();
      }
      
      if (qualification_status === 'sold') {
        updates.sold_at = new Date().toISOString();
        if (buyer_id) updates.buyer_id = buyer_id;
        if (sale_price) updates.sale_price = sale_price;
      }
    }

    if (screening_answers) updates.screening_answers = screening_answers;
    if (injury_details) updates.injury_details = injury_details;
    if (notes) updates.notes = notes;

    const { data, error } = await supabase
      .from('mass_tort_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update campaign stats if qualified or sold
    if (data.campaign_id && (qualification_status === 'qualified' || qualification_status === 'sold')) {
      const { data: campaign } = await supabase
        .from('mass_tort_campaigns')
        .select('leads_qualified, leads_sold, revenue')
        .eq('id', data.campaign_id)
        .single();

      if (campaign) {
        const campaignUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
        
        if (qualification_status === 'qualified') {
          campaignUpdates.leads_qualified = (campaign.leads_qualified || 0) + 1;
        }
        
        if (qualification_status === 'sold' && sale_price) {
          campaignUpdates.leads_sold = (campaign.leads_sold || 0) + 1;
          campaignUpdates.revenue = (campaign.revenue || 0) + sale_price;
        }

        await supabase
          .from('mass_tort_campaigns')
          .update(campaignUpdates)
          .eq('id', data.campaign_id);
      }
    }

    return NextResponse.json({ success: true, tortLead: data });
  } catch (error: any) {
    console.error('Mass Tort Leads PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
