/**
 * Lead Deduplication API
 * Find and merge duplicate leads
 *
 * GET /api/leads/deduplication - Find duplicate leads
 * POST /api/leads/deduplication - Merge duplicates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface DuplicateLead {
  duplicate_group: number;
  lead_id: string;
  case_number: string | null;
  property_address: string | null;
  owner_name: string | null;
  created_at: string;
  is_primary: boolean;
  excess_funds_amount?: number;
  eleanor_score?: number;
}

/**
 * GET /api/leads/deduplication
 * Find duplicate leads by case number or address
 */
export async function GET() {
  const supabase = createClient();

  try {
    // Try to use the database function first
    const { data: duplicates, error: rpcError } = await supabase.rpc('find_duplicate_leads');

    if (!rpcError && duplicates) {
      // Group duplicates by group number
      const groups: Record<number, DuplicateLead[]> = {};

      for (const dup of duplicates as DuplicateLead[]) {
        if (!groups[dup.duplicate_group]) {
          groups[dup.duplicate_group] = [];
        }
        groups[dup.duplicate_group].push(dup);
      }

      // Get additional lead details for each duplicate
      const groupsWithDetails = await Promise.all(
        Object.entries(groups).map(async ([groupId, leads]) => {
          const leadIds = leads.map(l => l.lead_id);

          const { data: leadDetails } = await supabase
            .from('maxsam_leads')
            .select('id, excess_funds_amount, eleanor_score, status, contact_attempts')
            .in('id', leadIds);

          const detailsMap = new Map(
            (leadDetails || []).map(l => [l.id, l])
          );

          return {
            group_id: parseInt(groupId),
            leads: leads.map(lead => ({
              ...lead,
              ...detailsMap.get(lead.lead_id)
            }))
          };
        })
      );

      return NextResponse.json({
        success: true,
        duplicate_groups: groupsWithDetails,
        total_groups: groupsWithDetails.length,
        total_duplicates: duplicates.length
      });
    }

    // Fallback: Manual duplicate detection
    const { data: leads, error } = await supabase
      .from('maxsam_leads')
      .select('id, case_number, property_address, owner_name, created_at, excess_funds_amount, eleanor_score')
      .order('case_number')
      .order('created_at');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Find duplicates by case_number or address
    const caseNumberGroups: Record<string, typeof leads> = {};
    const addressGroups: Record<string, typeof leads> = {};

    for (const lead of leads || []) {
      if (lead.case_number) {
        if (!caseNumberGroups[lead.case_number]) {
          caseNumberGroups[lead.case_number] = [];
        }
        caseNumberGroups[lead.case_number].push(lead);
      }

      if (lead.property_address) {
        const normalizedAddress = lead.property_address.toLowerCase().trim();
        if (!addressGroups[normalizedAddress]) {
          addressGroups[normalizedAddress] = [];
        }
        addressGroups[normalizedAddress].push(lead);
      }
    }

    // Build duplicate groups
    const duplicateGroups: { group_id: number; match_type: string; match_value: string; leads: typeof leads }[] = [];
    let groupId = 1;

    // Case number duplicates
    for (const [caseNumber, group] of Object.entries(caseNumberGroups)) {
      if (group.length > 1) {
        duplicateGroups.push({
          group_id: groupId++,
          match_type: 'case_number',
          match_value: caseNumber,
          leads: group.map((l, i) => ({ ...l, is_primary: i === 0 }))
        });
      }
    }

    // Address duplicates (excluding those already matched by case number)
    const matchedByCase = new Set(
      duplicateGroups.flatMap(g => g.leads.map(l => l.id))
    );

    for (const [address, group] of Object.entries(addressGroups)) {
      const unmatched = group.filter(l => !matchedByCase.has(l.id));
      if (unmatched.length > 1) {
        duplicateGroups.push({
          group_id: groupId++,
          match_type: 'property_address',
          match_value: address,
          leads: unmatched.map((l, i) => ({ ...l, is_primary: i === 0 }))
        });
      }
    }

    return NextResponse.json({
      success: true,
      duplicate_groups: duplicateGroups,
      total_groups: duplicateGroups.length,
      total_duplicates: duplicateGroups.reduce((sum, g) => sum + g.leads.length, 0)
    });

  } catch (error) {
    console.error('Deduplication GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to find duplicates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads/deduplication
 * Merge duplicate leads
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keep_id, merge_ids } = body;

    if (!keep_id || !merge_ids || !Array.isArray(merge_ids)) {
      return NextResponse.json(
        { success: false, error: 'keep_id and merge_ids array are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Try to use database function
    const { data, error: rpcError } = await supabase.rpc('merge_duplicate_leads', {
      keep_id,
      merge_ids
    });

    if (!rpcError && data) {
      return NextResponse.json(data);
    }

    // Fallback: Manual merge
    let mergedCount = 0;

    for (const mergeId of merge_ids) {
      // Update related records
      await supabase.from('sms_messages').update({ lead_id: keep_id }).eq('lead_id', mergeId);
      await supabase.from('communication_logs').update({ lead_id: keep_id }).eq('lead_id', mergeId);
      await supabase.from('contracts').update({ lead_id: keep_id }).eq('lead_id', mergeId);
      await supabase.from('deals').update({ lead_id: keep_id }).eq('lead_id', mergeId);
      await supabase.from('agreement_packets').update({ lead_id: keep_id }).eq('lead_id', mergeId);
      await supabase.from('status_history').update({ lead_id: keep_id }).eq('lead_id', mergeId);

      // Delete the duplicate
      const { error: deleteError } = await supabase
        .from('maxsam_leads')
        .delete()
        .eq('id', mergeId);

      if (!deleteError) {
        mergedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      kept_lead_id: keep_id,
      merged_count: mergedCount
    });

  } catch (error) {
    console.error('Deduplication POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to merge duplicates' },
      { status: 500 }
    );
  }
}
