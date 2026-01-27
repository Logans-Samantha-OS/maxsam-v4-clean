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

    // Get all leads with details for Sam's call list and skip trace candidates
    const { data: leads } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, excess_funds_amount, eleanor_score, last_contact_date, contact_attempts, status, phone, phone_1, phone_2, owner_phone, golden_lead, is_golden_lead, property_address, lead_class, excess_funds_expiry_date, days_until_expiration');

    // EXPIRING LEADS - Leads with funds expiring in next 14 days
    const expiringLeads = leads?.filter(l => {
      if (!l.excess_funds_expiry_date) return false;
      const expiryDate = new Date(l.excess_funds_expiry_date);
      const daysUntil = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntil > 0 && daysUntil <= 14 && !['closed', 'dead', 'contract_signed'].includes(l.status);
    })
    .sort((a, b) => new Date(a.excess_funds_expiry_date!).getTime() - new Date(b.excess_funds_expiry_date!).getTime())
    .slice(0, 5)
    .map(l => ({
      name: l.owner_name || 'Unknown',
      address: l.property_address || 'Unknown',
      amount: l.excess_funds_amount || 0,
      days_left: l.days_until_expiration || Math.ceil((new Date(l.excess_funds_expiry_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    })) || [];

    // TOP 3 FOCUS LEADS - Highest value leads that need action today
    const top3Focus = leads?.filter(l => {
      const hasPhone = l.phone || l.phone_1 || l.phone_2 || l.owner_phone;
      const hasAmount = (l.excess_funds_amount || 0) >= 10000;
      const needsAction = ['new', 'scored', 'contacted', 'qualified'].includes(l.status);
      const notMaxedOut = (l.contact_attempts || 0) < 5;
      return hasPhone && hasAmount && needsAction && notMaxedOut;
    })
    .sort((a, b) => {
      // Priority: golden leads first, then by expiry, then by amount
      const aGolden = a.golden_lead || a.is_golden_lead ? 1 : 0;
      const bGolden = b.golden_lead || b.is_golden_lead ? 1 : 0;
      if (aGolden !== bGolden) return bGolden - aGolden;

      // Expiring sooner = higher priority
      const aExpiry = a.excess_funds_expiry_date ? new Date(a.excess_funds_expiry_date).getTime() : Infinity;
      const bExpiry = b.excess_funds_expiry_date ? new Date(b.excess_funds_expiry_date).getTime() : Infinity;
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;

      // Higher amount = higher priority
      return (b.excess_funds_amount || 0) - (a.excess_funds_amount || 0);
    })
    .slice(0, 3)
    .map(l => ({
      name: l.owner_name || 'Unknown',
      address: l.property_address || 'Unknown',
      amount: l.excess_funds_amount || 0,
      score: l.eleanor_score || 0,
      class: l.lead_class || (l.golden_lead || l.is_golden_lead ? 'GOLDEN' : 'B'),
      status: l.status,
      days_until_expiry: l.days_until_expiration
    })) || [];

    const followUpsToday = leads?.filter(l => {
      if (!l.last_contact_date) return false;
      const lastContact = new Date(l.last_contact_date);
      const daysSince = (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= 2 && l.status === 'contacted' && l.contact_attempts < 5;
    }).length || 0;

    const totalPipeline = leads?.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0) || 0;

    // SAM'S CALL LIST - Leads with phone AND amount, ready for outreach
    const samCallingToday = leads?.filter(l => {
      const hasPhone = l.phone || l.phone_1 || l.phone_2 || l.owner_phone;
      const hasAmount = (l.excess_funds_amount || 0) > 0;
      const isReady = ['new', 'scored', 'ready_for_outreach'].includes(l.status);
      const notMaxedOut = (l.contact_attempts || 0) < 5;
      return hasPhone && hasAmount && isReady && notMaxedOut;
    })
    .sort((a, b) => (b.eleanor_score || 0) - (a.eleanor_score || 0))
    .slice(0, 10)
    .map(l => {
      const isGolden = l.golden_lead || l.is_golden_lead;
      const leadClass = isGolden ? 'GOLDEN' :
                        (l.eleanor_score || 0) >= 75 ? 'A' :
                        (l.eleanor_score || 0) >= 60 ? 'B' : 'C';
      return {
        name: l.owner_name || 'Unknown',
        amount: l.excess_funds_amount || 0,
        score: l.eleanor_score || 0,
        class: leadClass
      };
    }) || [];

    // SKIP TRACE CANDIDATES - Leads with amount but NO phone (Class A or B, worth $5K+)
    const skipTraceCandidates = leads?.filter(l => {
      const hasPhone = l.phone || l.phone_1 || l.phone_2 || l.owner_phone;
      const hasAmount = (l.excess_funds_amount || 0) >= 5000; // Worth skip tracing
      const isClassAorB = (l.eleanor_score || 0) >= 60;
      const notClosed = !['closed', 'dead', 'contract_signed'].includes(l.status);
      return !hasPhone && hasAmount && isClassAorB && notClosed;
    }).length || 0;

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
      totalPipeline,
      samCallingToday,
      skipTraceCandidates,
      top3Focus,
      expiringLeads
    });

    return NextResponse.json({
      success: true,
      samCallingToday,
      skipTraceCandidates,
      top3Focus,
      expiringLeads
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
