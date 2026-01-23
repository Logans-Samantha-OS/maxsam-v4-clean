import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { leadId, status } = await req.json();

    if (!leadId || !status) {
      return NextResponse.json({ error: 'Missing leadId or status' }, { status: 400 });
    }

    const supabase = createClient();

    const { error } = await supabase
      .from('maxsam_leads')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (error) {
      console.error('Status update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unhandled status update error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
