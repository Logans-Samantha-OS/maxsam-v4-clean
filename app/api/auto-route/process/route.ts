/**
 * Auto-Route Process API - Execute automatic lead routing
 * POST: Run the auto-router to match inventory with buyer rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { dry_run = false } = body;

    // Get active routing rules ordered by priority
    const { data: rules, error: rulesError } = await supabase
      .from('auto_routing_rules')
      .select('*, buyer:maxsam_buyers(*)')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) throw rulesError;

    if (!rules?.length) {
      return NextResponse.json({ 
        success: true, 
        routed: 0, 
        message: 'No active routing rules' 
      });
    }

    // Get available inventory
    const { data: inventory, error: invError } = await supabase
      .from('marketplace_inventory')
      .select('*, lead:maxsam_leads(*)')
      .eq('status', 'available');

    if (invError) throw invError;

    if (!inventory?.length) {
      return NextResponse.json({ 
        success: true, 
        routed: 0, 
        message: 'No available inventory' 
      });
    }

    const routed: { 
      item_id: string; 
      lead_id: string;
      buyer_id: string; 
      buyer_name: string;
      price: number;
      rule: string;
    }[] = [];

    const skipped: {
      item_id: string;
      reason: string;
    }[] = [];

    // Process each inventory item
    for (const item of inventory) {
      let matched = false;

      // Try each rule in priority order
      for (const rule of rules) {
        // Check lead type match
        if (item.lead_type !== rule.lead_type) continue;

        // Check conditions
        const conditions = rule.conditions as {
          min_score?: number;
          max_price?: number;
          counties?: string[];
          min_amount?: number;
        };

        let meetsConditions = true;

        if (conditions.min_score && item.quality_score < conditions.min_score) {
          meetsConditions = false;
        }

        if (conditions.max_price && item.asking_price > conditions.max_price) {
          meetsConditions = false;
        }

        if (conditions.counties?.length && item.lead?.county) {
          if (!conditions.counties.includes(item.lead.county)) {
            meetsConditions = false;
          }
        }

        if (conditions.min_amount && item.lead?.excess_funds_amount) {
          if (item.lead.excess_funds_amount < conditions.min_amount) {
            meetsConditions = false;
          }
        }

        if (!meetsConditions) continue;

        // Check buyer's monthly budget
        const buyer = rule.buyer;
        if (buyer?.monthly_budget && buyer?.monthly_spent) {
          if (buyer.monthly_spent + rule.price > buyer.monthly_budget) {
            skipped.push({ item_id: item.id, reason: 'Buyer budget exceeded' });
            continue;
          }
        }

        // Match found!
        if (!dry_run) {
          // Create sale record
          await supabase.from('lead_sales').insert({
            inventory_id: item.id,
            lead_id: item.lead_id,
            buyer_id: rule.buyer_id,
            lead_type: item.lead_type,
            sale_price: rule.price,
            sale_method: 'auto_route',
            notes: `Auto-routed by rule: ${rule.name}`
          });

          // Update inventory status
          await supabase
            .from('marketplace_inventory')
            .update({ status: 'sold', sold_at: new Date().toISOString() })
            .eq('id', item.id);

          // Update rule stats
          await supabase
            .from('auto_routing_rules')
            .update({ 
              leads_routed: rule.leads_routed + 1,
              last_routed_at: new Date().toISOString()
            })
            .eq('id', rule.id);

          // Update buyer stats
          await supabase.rpc('increment_buyer_stats', { 
            p_buyer_id: rule.buyer_id, 
            p_amount: rule.price 
          });

          // Update lead status
          await supabase
            .from('maxsam_leads')
            .update({ status: 'sold', updated_at: new Date().toISOString() })
            .eq('id', item.lead_id);
        }

        routed.push({
          item_id: item.id,
          lead_id: item.lead_id,
          buyer_id: rule.buyer_id,
          buyer_name: buyer?.name || 'Unknown',
          price: rule.price,
          rule: rule.name
        });

        matched = true;
        break; // Stop checking rules for this item
      }

      if (!matched) {
        skipped.push({ item_id: item.id, reason: 'No matching rule' });
      }
    }

    const totalRevenue = routed.reduce((sum, r) => sum + r.price, 0);

    return NextResponse.json({ 
      success: true, 
      dry_run,
      routed: routed.length,
      skipped: skipped.length,
      revenue: totalRevenue,
      details: {
        routed,
        skipped
      }
    });
  } catch (error: any) {
    console.error('Auto-Route Process error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
