'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Bid {
  id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_company: string;
  buyer_email: string;
  bid_amount: number;
  bid_percentage: number;
  status: string;
  submitted_at: string;
  contract?: {
    id: string;
    status: string;
    stripe_invoice_id?: string;
    payment_url?: string;
  };
}

interface Deal {
  id: string;
  property_address: string;
  city: string;
  arv: number;
}

export default function DealBidsPage() {
  const params = useParams();
  const dealId = params.id as string;
  
  const [bids, setBids] = useState<Bid[]>([]);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchBidsData();
  }, [dealId]);

  const fetchBidsData = async () => {
    try {
      // Fetch deal info
      const { data: dealData, error: dealError } = await supabase
        .from('maxsam_leads')
        .select('id, property_address, city, arv')
        .eq('id', dealId)
        .single();

      if (dealError) throw dealError;
      setDeal(dealData);

      // Fetch bids with buyer info and contract status
      const { data: bidsData, error: bidsError } = await supabase
        .from('deal_bids')
        .select(`
          id,
          buyer_id,
          bid_amount,
          bid_percentage,
          status,
          submitted_at,
          wholesale_buyers!inner(
            name,
            company,
            email
          ),
          contracts!left(
            id,
            status,
            stripe_invoice_id,
            payment_url
          )
        `)
        .eq('deal_id', dealId)
        .order('bid_amount', { ascending: false });

      if (bidsError) throw bidsError;

      const formattedBids = bidsData.map(bid => ({
        id: bid.id,
        buyer_id: bid.buyer_id,
        buyer_name: (bid as any).wholesale_buyers.name,
        buyer_company: (bid as any).wholesale_buyers.company || '',
        buyer_email: (bid as any).wholesale_buyers.email,
        bid_amount: bid.bid_amount,
        bid_percentage: bid.bid_percentage,
        status: bid.status,
        submitted_at: bid.submitted_at,
        contract: (bid as any).contracts || null
      }));

      setBids(formattedBids);
    } catch (error) {
      console.error('Error fetching bids data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async (bidId: string, buyerEmail: string) => {
    setInvoiceLoading(bidId);
    try {
      const response = await fetch(`/api/deals/${dealId}/invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyer_email: buyerEmail
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Invoice created successfully! Payment URL: ${result.invoice.payment_url}`);
        // Refresh data to show updated contract status
        await fetchBidsData();
      } else {
        alert(result.error || 'Error creating invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Error creating invoice');
    } finally {
      setInvoiceLoading(null);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    setActionLoading(bidId);
    try {
      // Update bid status to accepted
      const { error: bidError } = await supabase
        .from('deal_bids')
        .update({ status: 'accepted' })
        .eq('id', bidId);

      if (bidError) throw bidError;

      // Update deal status to under_contract
      const { error: dealError } = await supabase
        .from('maxsam_leads')
        .update({ status: 'under_contract' })
        .eq('id', dealId);

      if (dealError) throw dealError;

      // Refresh data
      await fetchBidsData();
    } catch (error) {
      console.error('Error accepting bid:', error);
      alert('Error accepting bid');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBid = async (bidId: string) => {
    setActionLoading(bidId);
    try {
      const { error } = await supabase
        .from('deal_bids')
        .update({ status: 'rejected' })
        .eq('id', bidId);

      if (error) throw error;

      // Refresh data
      await fetchBidsData();
    } catch (error) {
      console.error('Error rejecting bid:', error);
      alert('Error rejecting bid');
    } finally {
      setActionLoading(null);
    }
  };

  const exportToCSV = () => {
    const headers = ['Buyer Name', 'Company', 'Email', 'Bid Amount', 'Bid %', 'Status', 'Submitted Time'];
    const csvContent = [
      headers.join(','),
      ...bids.map(bid => [
        `"${bid.buyer_name}"`,
        `"${bid.buyer_company}"`,
        `"${bid.buyer_email}"`,
        bid.bid_amount,
        `${bid.bid_percentage}%`,
        bid.status,
        new Date(bid.submitted_at).toLocaleString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deal-${dealId}-bids.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading bids...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Deal not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Bid Management</h1>
              <p className="text-slate-600 mt-1">
                {deal.property_address}, {deal.city} (ARV: ${deal.arv?.toLocaleString()})
              </p>
            </div>
            <button
              onClick={exportToCSV}
              className="bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition-colors"
            >
              Export to CSV
            </button>
          </div>

          {/* Bids Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Buyer Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Bid Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Bid %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Submitted Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {bids.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-slate-500">
                      No bids submitted yet
                    </td>
                  </tr>
                ) : (
                  bids.map((bid) => (
                    <tr key={bid.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {bid.buyer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {bid.buyer_company || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {bid.buyer_email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        ${bid.bid_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {bid.bid_percentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(bid.submitted_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          bid.status === 'accepted' 
                            ? 'bg-emerald-100 text-emerald-800'
                            : bid.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {bid.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bid.contract ? (
                          <div className="space-y-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              bid.contract.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bid.contract.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {bid.contract.status}
                            </span>
                            {bid.contract.payment_url && (
                              <div>
                                <a
                                  href={bid.contract.payment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-slate-600 hover:text-slate-900 underline"
                                >
                                  View Invoice
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">No invoice</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {bid.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleAcceptBid(bid.id)}
                                disabled={actionLoading === bid.id}
                                className="bg-emerald-600 text-white px-3 py-1 rounded text-xs hover:bg-emerald-700 disabled:bg-slate-400 transition-colors"
                              >
                                {actionLoading === bid.id ? '...' : 'Accept'}
                              </button>
                              <button
                                onClick={() => handleRejectBid(bid.id)}
                                disabled={actionLoading === bid.id}
                                className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:bg-slate-400 transition-colors"
                              >
                                {actionLoading === bid.id ? '...' : 'Reject'}
                              </button>
                            </>
                          )}
                          {bid.status === 'accepted' && (
                            <>
                              <span className="text-emerald-600 text-xs font-medium">Accepted</span>
                              {!bid.contract?.stripe_invoice_id && (
                                <button
                                  onClick={() => handleSendInvoice(bid.id, bid.buyer_email)}
                                  disabled={invoiceLoading === bid.id}
                                  className="bg-slate-600 text-white px-3 py-1 rounded text-xs hover:bg-slate-700 disabled:bg-slate-400 transition-colors"
                                >
                                  {invoiceLoading === bid.id ? '...' : 'Send Invoice'}
                                </button>
                              )}
                              {bid.contract?.stripe_invoice_id && (
                                <a
                                  href="https://dashboard.stripe.com/invoices"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-slate-600 hover:text-slate-900 underline"
                                >
                                  Stripe Dashboard
                                </a>
                              )}
                            </>
                          )}
                          {bid.status === 'rejected' && (
                            <span className="text-red-600 text-xs font-medium">Rejected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
