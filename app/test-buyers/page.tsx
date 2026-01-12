'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Lead {
  id: string;
  property_address: string;
  arv_estimate: number;
}

export default function TestBuyersPage() {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFirstLead();
  }, []);

  const fetchFirstLead = async () => {
    try {
      const { data, error } = await supabase
        .from('maxsam_leads')
        .select('id, property_address, arv_estimate')
        .not('arv_estimate', 'is', null)
        .limit(1)
        .single();

      if (error) throw error;
      setLead(data);
    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading lead...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">No lead found with ARV estimate</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Test Buyer Bidding System</h1>
          
          <div className="bg-slate-100 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Lead Details</h2>
            <div className="space-y-2">
              <p className="text-slate-700">
                <span className="font-medium">Property:</span> {lead.property_address}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">ARV Estimate:</span> ${lead.arv_estimate?.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-slate-600 mb-4">Lead ID for testing:</p>
            <div className="bg-slate-900 text-white rounded-lg p-6 mb-6">
              <p className="text-3xl font-mono font-bold">{lead.id}</p>
            </div>
            
            <Link 
              href={`/deals/${lead.id}`}
              className="inline-block bg-slate-600 text-white px-6 py-3 rounded-md hover:bg-slate-700 transition-colors text-lg font-medium"
            >
              Go to Bid Submission Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
