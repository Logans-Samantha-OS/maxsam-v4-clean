import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// GET - Dashboard analytics
export async function GET() {
    try {
        const supabase = getSupabase();

        // Get all leads for calculations
        const { data: leads, error } = await supabase
            .from('maxsam_leads')
            .select('id, excess_funds_amount, eleanor_score, status, phone_1, phone_2, days_until_expiration, golden_lead, sms_count, last_contacted_at');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const allLeads = leads || [];

        // Calculate stats
        const stats = {
            totalLeads: allLeads.length,
            totalPipeline: allLeads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0),
            potentialFees: allLeads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0) * 0.25, 0),

            // By status
            statusBreakdown: {
                new: allLeads.filter(l => l.status === 'new' || !l.status).length,
                contacted: allLeads.filter(l => l.status === 'contacted').length,
                qualified: allLeads.filter(l => l.status === 'qualified').length,
                negotiating: allLeads.filter(l => l.status === 'negotiating').length,
                contract_sent: allLeads.filter(l => l.status === 'contract_sent').length,
                contract_signed: allLeads.filter(l => l.status === 'contract_signed').length,
                closed: allLeads.filter(l => l.status === 'closed').length,
                dead: allLeads.filter(l => l.status === 'dead').length,
            },

            // By score
            scoreBreakdown: {
                diamond: allLeads.filter(l => (l.eleanor_score || 0) >= 90).length,
                emerald: allLeads.filter(l => (l.eleanor_score || 0) >= 70 && (l.eleanor_score || 0) < 90).length,
                sapphire: allLeads.filter(l => (l.eleanor_score || 0) >= 50 && (l.eleanor_score || 0) < 70).length,
                ruby: allLeads.filter(l => (l.eleanor_score || 0) < 50).length,
            },

            // Deadline urgency
            deadlineBreakdown: {
                expiring7: allLeads.filter(l => (l.days_until_expiration || 999) <= 7).length,
                expiring14: allLeads.filter(l => (l.days_until_expiration || 999) > 7 && (l.days_until_expiration || 999) <= 14).length,
                expiring30: allLeads.filter(l => (l.days_until_expiration || 999) > 14 && (l.days_until_expiration || 999) <= 30).length,
                expiring60: allLeads.filter(l => (l.days_until_expiration || 999) > 30 && (l.days_until_expiration || 999) <= 60).length,
            },

            // Action metrics
            readyToBlast: allLeads.filter(l => (l.status === 'new' || !l.status) && (l.phone_1 || l.phone_2)).length,
            awaitingResponse: allLeads.filter(l => l.status === 'contacted').length,
            hotResponses: allLeads.filter(l => l.status === 'qualified').length,
            goldenLeads: allLeads.filter(l => l.golden_lead).length,
            withPhone: allLeads.filter(l => l.phone_1 || l.phone_2).length,
            noPhone: allLeads.filter(l => !l.phone_1 && !l.phone_2).length,

            // SMS stats
            totalSmsSent: allLeads.reduce((sum, l) => sum + (l.sms_count || 0), 0),
            leadsContacted: allLeads.filter(l => l.sms_count && l.sms_count > 0).length,
        };

        return NextResponse.json(stats);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to get analytics';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
