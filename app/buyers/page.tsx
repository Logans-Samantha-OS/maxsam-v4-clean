'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

interface Buyer {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  buying_criteria: string;
  preferred_areas: string[];
  min_arv: number;
  max_arv: number;
  active_deals: number;
  total_purchased: number;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  notes: string;
}

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBuyers();
  }, []);

  async function fetchBuyers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('buyers')
        .select('*')
        .order('company_name', { ascending: true });

      if (error) {
        console.error('Fetch error:', error);
        setBuyers([]);
      } else {
        setBuyers(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  }

  function formatPhone(phone: string | null): string {
    if (!phone) return 'No phone';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  }

  const filteredBuyers = buyers.filter(buyer =>
    buyer.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    buyer.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    buyer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeBuyers = buyers.filter(b => b.status === 'active').length;
  const totalDeals = buyers.reduce((sum, b) => sum + (b.active_deals || 0), 0);
  const totalPurchased = buyers.reduce((sum, b) => sum + (b.total_purchased || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Buyer Database</h1>
            <p className="text-zinc-500 mt-1">Manage cash buyers for wholesale deals</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
          >
            + Add Buyer
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-cyan-400">{buyers.length}</div>
            <div className="text-zinc-500 text-sm">Total Buyers</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-green-400">{activeBuyers}</div>
            <div className="text-zinc-500 text-sm">Active Buyers</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-purple-400">{totalDeals}</div>
            <div className="text-zinc-500 text-sm">Active Deals</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-yellow-400">{formatCurrency(totalPurchased)}</div>
            <div className="text-zinc-500 text-sm">Total Purchased</div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search buyers by name, company, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Buyers Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Company</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Contact</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">ARV Range</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Active Deals</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredBuyers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    {buyers.length === 0 ? (
                      <div>
                        <p className="text-lg mb-2">No buyers in database</p>
                        <p className="text-sm">Add your first cash buyer to get started</p>
                      </div>
                    ) : (
                      'No buyers match your search'
                    )}
                  </td>
                </tr>
              ) : (
                filteredBuyers.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-zinc-800/50 transition">
                    <td className="px-4 py-4">
                      <div className="text-white font-medium">{buyer.company_name || 'N/A'}</div>
                      <div className="text-zinc-500 text-xs">{buyer.buying_criteria || 'No criteria set'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-zinc-300">{buyer.contact_name || 'N/A'}</div>
                      <div className="text-zinc-500 text-xs">{buyer.email || 'No email'}</div>
                    </td>
                    <td className="px-4 py-4 text-zinc-300">{formatPhone(buyer.phone)}</td>
                    <td className="px-4 py-4 text-zinc-300">
                      {buyer.min_arv && buyer.max_arv
                        ? `${formatCurrency(buyer.min_arv)} - ${formatCurrency(buyer.max_arv)}`
                        : 'Not set'}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-cyan-400 font-medium">{buyer.active_deals || 0}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        buyer.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        buyer.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {buyer.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button className="text-cyan-400 hover:text-cyan-300 text-sm mr-3">Edit</button>
                      <button className="text-zinc-400 hover:text-zinc-300 text-sm">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Buyer Modal Placeholder */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg">
              <h2 className="text-xl font-bold text-white mb-4">Add New Buyer</h2>
              <p className="text-zinc-500 mb-4">Buyer management coming soon. Integration with wholesale buyer lists pending.</p>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
