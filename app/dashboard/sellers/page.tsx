'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Lead {
  id: string;
  property_address: string;
  owner_name: string;
  excess_funds_amount: number;
  eleanor_score: number;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

export default function SellersPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeads() {
      const supabase = getSupabaseClient();

      if (!supabase) {
        setError('Supabase not configured. Check environment variables.');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('maxsam_leads')
          .select('*')
          .order('eleanor_score', { ascending: false });

        if (fetchError) {
          setError(fetchError.message);
        } else {
          setLeads(data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }

      setLoading(false);
    }
    fetchLeads();
  }, []);

  if (loading) return <div className="p-8 text-white">Loading from database...</div>;

  if (error) return <div className="p-8 text-red-400">Error: {error}</div>;

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-4">Sellers ({leads.length} leads)</h1>
      {leads.length === 0 ? (
        <p>No leads in database. Import some first!</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-gray-800 p-4 rounded">
              <h3 className="font-bold">{lead.property_address}</h3>
              <p>{lead.owner_name}</p>
              <p className="text-green-400">${lead.excess_funds_amount?.toLocaleString()}</p>
              <p>Score: {lead.eleanor_score}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
