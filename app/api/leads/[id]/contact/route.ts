import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Increment contact count and update last_contacted_at
    const { data, error } = await supabase
      .from('leads')
      .update({
        last_contacted_at: new Date().toISOString(),
        contact_count: supabase.rpc('increment_contact_count', { lead_id: id })
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Contact update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Contact API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
