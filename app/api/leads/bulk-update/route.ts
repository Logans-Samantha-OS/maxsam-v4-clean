import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// POST - Bulk update lead status or fields
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const { lead_ids, updates } = await request.json();

        if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
            return NextResponse.json({ error: 'lead_ids array required' }, { status: 400 });
        }

        if (!updates || typeof updates !== 'object') {
            return NextResponse.json({ error: 'updates object required' }, { status: 400 });
        }

        // Perform bulk update
        const { data, error } = await supabase
            .from('maxsam_leads')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .in('id', lead_ids)
            .select();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${data?.length || 0} leads`,
            updated: data?.length || 0
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to bulk update';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
