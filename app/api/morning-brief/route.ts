import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyMorningBrief } from '@/lib/telegram';

/**
 * GET /api/morning-brief - Get today's morning brief data
 */
export async function GET() {
  try {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    // Get leads
    const { data: leads } = await supabase
      .from('maxsam_leads')
      .select('*');

    // Get contracts
    const { data: contracts } = await supabase
      .from('contracts')
      .select('*');

    // Get revenue
    const { data: revenue } = await supabase
      .from('revenue')
      .select('*');

    if (!leads) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    // Calculate metrics
    const newLeadsToday = leads.filter(l => l.created_at?.startsWith(today)).length;

    const hotLeads = leads.filter(l =>
      (l.contact_priority === 'hot' || l.deal_grade === 'A+' || l.deal_grade === 'A') &&
      !['closed', 'dead', 'contract_signed'].includes(l.status)
    );

    const followUpsDue = leads.filter(l => {
      if (!l.last_contact_date) return false;
      const lastContact = new Date(l.last_contact_date);
      const daysSince = (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= 2 && l.status === 'contacted' && l.contact_attempts < 5;
    });

    const pendingContracts = contracts?.filter(c =>
      c.status === 'sent' || c.status === 'delivered'
    ) || [];

    const pendingInvoices = revenue?.filter(r =>
      r.status === 'invoiced'
    ) || [];

    const totalPipeline = leads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0);

    const closedThisMonth = leads.filter(l => {
      const thisMonth = new Date().toISOString().slice(0, 7);
      return l.status === 'closed' && l.created_at?.startsWith(thisMonth);
    });

    const estimatedRevenue = pendingContracts.reduce((sum, c) => sum + (Number(c.total_fee) || 0), 0) +
      pendingInvoices.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return NextResponse.json({
      date: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      summary: {
        new_leads_today: newLeadsToday,
        hot_leads: hotLeads.length,
        follow_ups_due: followUpsDue.length,
        pending_contracts: pendingContracts.length,
        pending_invoices: pendingInvoices.length,
        total_pipeline: totalPipeline,
        estimated_revenue: estimatedRevenue,
        closed_this_month: closedThisMonth.length
      },
      hot_leads: hotLeads.slice(0, 10).map(l => ({
        id: l.id,
        owner_name: l.owner_name,
        property_address: l.property_address,
        excess_funds: l.excess_funds_amount,
        score: l.eleanor_score,
        grade: l.deal_grade,
        phone: l.phone || l.phone_1 || l.phone_2
      })),
      follow_ups: followUpsDue.slice(0, 10).map(l => ({
        id: l.id,
        owner_name: l.owner_name,
        property_address: l.property_address,
        last_contact: l.last_contact_date,
        attempts: l.contact_attempts
      })),
      pending_contracts: pendingContracts.map(c => ({
        id: c.id,
        seller_name: c.seller_name,
        property_address: c.property_address,
        total_fee: c.total_fee,
        sent_at: c.sent_at
      }))
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/morning-brief - Send morning brief notification
 */
export async function POST() {
  try {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    // Get quick counts
    const { count: newLeads } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    const { count: hotLeads } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .in('contact_priority', ['hot'])
      .not('status', 'in', '("closed","dead")');

    const { count: pendingContracts } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['sent', 'delivered']);

    const { count: pendingInvoices } = await supabase
      .from('revenue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'invoiced');

    const { data: leads } = await supabase
      .from('maxsam_leads')
      .select('excess_funds_amount, last_contact_date, contact_attempts, status');

    const followUpsToday = leads?.filter(l => {
      if (!l.last_contact_date) return false;
      const lastContact = new Date(l.last_contact_date);
      const daysSince = (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= 2 && l.status === 'contacted' && l.contact_attempts < 5;
    }).length || 0;

    const totalPipeline = leads?.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0) || 0;

    // Send notification
    await notifyMorningBrief({
      date: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }),
      newLeads: newLeads || 0,
      hotLeads: hotLeads || 0,
      followUpsToday,
      pendingContracts: pendingContracts || 0,
      pendingInvoices: pendingInvoices || 0,
      totalPipeline
    });

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
