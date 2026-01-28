/**
 * Lead Bank Reactivate API - Bring leads back from the bank
 * POST: Reactivate a banked lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { bank_id, lead_id, new_status = 'new' } = await request.json();

    if (!bank_id || !lead_id) {
      return NextResponse.json({ error: 'bank_id and lead_id required' }, { status: 400 });
    }

    // Mark as reactivated in lead_bank
    const { error: bankError } = await supabase
      .from('lead_bank')
      .update({ reactivated_at: new Date().toISOString() })
      .eq('id', bank_id);

    if (bankError) throw bankError;

    // Update lead status back to active
    const { error: leadError } = await supabase
      .from('maxsam_leads')
      .update({ 
        status: new_status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', lead_id);

    if (leadError) throw leadError;

    return NextResponse.json({ success: true, message: 'Lead reactivated' });
  } catch (error: any) {
    console.error('Lead Bank Reactivate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
