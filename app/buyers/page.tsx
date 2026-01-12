'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import BuyerCard from '@/components/BuyerCard';
import Sidebar from '@/components/Sidebar';

interface Buyer {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  counties_interested?: string[];
  property_types?: string[];
  min_price?: number;
  max_price?: number;
  is_active?: boolean;
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
    fetchBuyers();
  }, []);

  async function fetchBuyers() {
    try {
      setLoading(true);
      setError(null);

      // Use correct table maxsam_buyers
      const { data, error } = await supabase
        .from('maxsam_buyers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBuyers(data || []);
    } catch (err) {
      console.error('Error fetching buyers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateBuyer = (updatedBuyer: Buyer) => {
    setBuyers(buyers.map(b => b.id === updatedBuyer.id ? updatedBuyer : b));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030305] flex graphene-bg text-zinc-100 font-sans">
      <Sidebar />
      <div className="flex-1 container mx-auto px-8 py-8 h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-gold mb-2">Buyer Network</h1>
            <p className="text-zinc-400">Manage your buyer relationships and deal flow</p>
          </div>
          <button
            onClick={() => router.push('/buyers/intake')}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg font-bold shadow-lg transform hover:scale-105 transition-all"
          >
            + Add Buyer
          </button>
        </div>

        {error ? (
          <div className="pharaoh-card p-8 max-w-md mx-auto text-center border-red-500/50">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Buyers</h2>
            <p className="text-zinc-400 mb-4">{error}</p>
            <button onClick={() => fetchBuyers()} className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700">Retry</button>
          </div>
        ) : buyers.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-xl">
            <h2 className="text-2xl font-bold text-zinc-500 mb-2">No Buyers Network Yet</h2>
            <p className="text-zinc-600 mb-6">Start building your rolodex of investors.</p>
            <button
              onClick={() => router.push('/buyers/intake')}
              className="px-6 py-3 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500"
            >
              Add Your First Buyer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {buyers.map(buyer => (
              <BuyerCard key={buyer.id} buyer={buyer} onUpdate={handleUpdateBuyer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
