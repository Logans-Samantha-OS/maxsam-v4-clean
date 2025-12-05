import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRevenueStats } from '@/lib/stripe';

/**
 * GET /api/analytics/revenue - Get revenue metrics
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Get revenue records
    const { data: revenue } = await supabase
      .from('revenue')
      .select('*')
      .order('created_at', { ascending: false });

    // Get contracts
    const { data: contracts } = await supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false });

    // Calculate metrics
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const paidRevenue = revenue?.filter(r => r.status === 'paid') || [];
    const pendingRevenue = revenue?.filter(r => r.status === 'pending') || [];
    const invoicedRevenue = revenue?.filter(r => r.status === 'invoiced') || [];

    const totalPaid = paidRevenue.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalPending = pendingRevenue.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalInvoiced = invoicedRevenue.reduce((sum, r) => sum + Number(r.amount), 0);

    const thisMonthPaid = paidRevenue
      .filter(r => r.paid_at?.startsWith(thisMonth))
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const lastMonthPaid = paidRevenue
      .filter(r => r.paid_at?.startsWith(lastMonth))
      .reduce((sum, r) => sum + Number(r.amount), 0);

    // Revenue by type
    const byType = {
      excess_funds: paidRevenue.filter(r => r.fee_type === 'excess_funds').reduce((s, r) => s + Number(r.amount), 0),
      wholesale: paidRevenue.filter(r => r.fee_type === 'wholesale').reduce((s, r) => s + Number(r.amount), 0),
      dual: paidRevenue.filter(r => r.fee_type === 'dual').reduce((s, r) => s + Number(r.amount), 0)
    };

    // Contract metrics
    const signedContracts = contracts?.filter(c => c.status === 'signed' || c.payment_status === 'paid') || [];
    const pendingContracts = contracts?.filter(c => c.status === 'sent' || c.status === 'delivered') || [];

    // Monthly revenue trend (last 6 months)
    const monthlyRevenue: Array<{ month: string; amount: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthAmount = paidRevenue
        .filter(r => r.paid_at?.startsWith(monthKey))
        .reduce((sum, r) => sum + Number(r.amount), 0);
      monthlyRevenue.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount: monthAmount
      });
    }

    return NextResponse.json({
      total_revenue: totalPaid,
      this_month: thisMonthPaid,
      last_month: lastMonthPaid,
      pending_revenue: totalPending,
      invoiced_amount: totalInvoiced,
      month_over_month_growth: lastMonthPaid > 0
        ? Math.round(((thisMonthPaid - lastMonthPaid) / lastMonthPaid) * 100)
        : 0,
      by_type: byType,
      contracts: {
        total: contracts?.length || 0,
        signed: signedContracts.length,
        pending: pendingContracts.length,
        total_value: contracts?.reduce((s, c) => s + Number(c.total_fee || 0), 0) || 0
      },
      monthly_trend: monthlyRevenue,
      recent_payments: paidRevenue.slice(0, 10).map(r => ({
        amount: r.amount,
        type: r.fee_type,
        paid_at: r.paid_at
      }))
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
