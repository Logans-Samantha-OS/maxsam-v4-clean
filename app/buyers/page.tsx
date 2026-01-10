'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Buyer {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  preferred_counties?: string[];
  property_types?: string[];
  budget_min?: number;
  budget_max?: number;
  status?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchBuyers() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('buyers')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setBuyers(data || []);
      } catch (err) {
        console.error('Error fetching buyers:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchBuyers();
  }, []);

  const handleCall = (phone: string) => {
    if (phone) {
      window.open(`tel:${phone}`);
    } else {
      alert('No phone number available');
    }
  };

  const handleEmail = (email: string) => {
    if (email) {
      window.open(`mailto:${email}`);
    } else {
      alert('No email available');
    }
  };

  const handleSendMatches = async (buyerId: string) => {
    try {
      const response = await fetch('/api/buyers/send-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_id: buyerId })
      });

      if (response.ok) {
        alert('Matches sent successfully!');
      } else {
        throw new Error('Failed to send matches');
      }
    } catch (error) {
      alert('Error sending matches');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pharaoh-card p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Buyers</h2>
          <p className="text-zinc-400">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gold hover:bg-yellow-600 text-black rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (buyers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pharaoh-card p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gold mb-4">No Buyers Yet</h2>
          <p className="text-zinc-400 mb-6">Add your first buyer to get started</p>
          <button 
            onClick={() => router.push('/buyers/new')}
            className="px-6 py-3 bg-gold hover:bg-yellow-600 text-black rounded-lg font-bold text-lg"
          >
            Add First Buyer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gold mb-2">Buyer Network</h1>
          <p className="text-zinc-400">Manage your buyer relationships and deal flow</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buyers.map((buyer) => (
            <div key={buyer.id} className="pharaoh-card hover:border-emerald-500/50 transition-all duration-300">
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">{buyer.name}</h3>
                    {buyer.company && (
                      <p className="text-emerald-400 font-medium">{buyer.company}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 rounded-full text-xs font-bold">
                      {buyer.status || 'Active'}
                    </span>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400 text-sm">Email:</span>
                    <span className="text-white font-medium">{buyer.email || 'No email'}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400 text-sm">Phone:</span>
                    <span className="text-white font-medium">{buyer.phone || 'No phone'}</span>
                  </div>
                </div>

                {/* Budget */}
                <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg">
                  <div className="text-zinc-400 text-sm mb-1">Budget Range</div>
                  <div className="text-xl font-bold text-emerald-400">
                    ${buyer.budget_min?.toLocaleString() || '0'} - ${buyer.budget_max?.toLocaleString() || '0'}
                  </div>
                </div>

                {/* Preferences */}
                <div className="mb-4">
                  <div className="mb-2">
                    <span className="text-zinc-400 text-sm">Preferred Counties:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {buyer.preferred_counties?.map((county, index) => (
                        <span key={index} className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded text-xs">
                          {county}
                        </span>
                      )) || <span className="text-zinc-500 text-xs">No preferences</span>}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-sm">Property Types:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {buyer.property_types?.map((type, index) => (
                        <span key={index} className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded text-xs">
                          {type}
                        </span>
                      )) || <span className="text-zinc-500 text-xs">No preferences</span>}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleCall(buyer.phone || '')}
                    className="px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📞</span>
                    <span>Call</span>
                  </button>
                  <button
                    onClick={() => handleEmail(buyer.email || '')}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📧</span>
                    <span>Email</span>
                  </button>
                  <button
                    onClick={() => handleSendMatches(buyer.id)}
                    className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🎯</span>
                    <span>Send Matches</span>
                  </button>
                </div>

                {/* Notes */}
                {buyer.notes && (
                  <div className="mt-4 pt-4 border-t border-zinc-700">
                    <p className="text-zinc-400 text-sm mb-1">Notes:</p>
                    <p className="text-zinc-300 text-sm">{buyer.notes}</p>
                  </div>
                )}

                {/* Last Updated */}
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-sm">Last Updated</span>
                    <span className="text-zinc-300 text-sm">
                      {new Date(buyer.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Buyer Button */}
        <div className="fixed bottom-8 right-8">
          <button
            onClick={() => router.push('/buyers/new')}
            className="px-6 py-3 bg-gold hover:bg-yellow-600 text-black rounded-lg font-bold shadow-lg hover:scale-105 transition-all duration-300"
          >
            + Add Buyer
          </button>
        </div>
      </div>
    </div>
  );
}
