'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

// Types
interface Buyer {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string;
  secondary_phone: string | null;
  property_types: string[];
  preferred_zips: string | null;
  min_purchase_price: number | null;
  max_purchase_price: number | null;
  min_arv: number | null;
  max_arv: number | null;
  condition_preference: string;
  deal_types: string[];
  closing_speed: string;
  funding_type: string;
  proof_of_funds: boolean;
  deals_closed: number;
  average_deal_size: number;
  reliability_rating: number;
  is_active: boolean;
  status: string;
  notes: string | null;
  created_at: string;
}

interface BuyerFormData {
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  secondary_phone: string;
  property_types: string[];
  preferred_zips: string;
  min_purchase_price: string;
  max_purchase_price: string;
  min_arv: string;
  max_arv: string;
  condition_preference: string;
  deal_types: string[];
  closing_speed: string;
  funding_type: string;
  proof_of_funds: boolean;
  deals_closed: string;
  average_deal_size: string;
  reliability_rating: number;
  is_active: boolean;
  notes: string;
}

interface MatchedLead {
  id: string;
  property_address: string;
  city: string;
  zip_code: string;
  excess_funds_amount: number;
  eleanor_score: number;
  deal_grade: string;
  status: string;
}

const PROPERTY_TYPES = ['SFR', 'Duplex', 'Triplex', 'Quad', 'Multi-family', 'Commercial', 'Land'];
const DEAL_TYPE_OPTIONS = ['Excess Funds', 'Wholesale', 'Both'];
const CLOSING_SPEEDS = ['7 days', '14 days', '21 days', '30 days', '30+ days'];
const FUNDING_TYPES = ['Cash', 'Hard Money', 'Conventional', 'Private Lending'];
const CONDITION_OPTIONS = ['Any', 'Light Rehab', 'Heavy Rehab', 'Turnkey'];

const emptyFormData: BuyerFormData = {
  full_name: '',
  company_name: '',
  email: '',
  phone: '',
  secondary_phone: '',
  property_types: [],
  preferred_zips: '',
  min_purchase_price: '',
  max_purchase_price: '',
  min_arv: '',
  max_arv: '',
  condition_preference: 'Any',
  deal_types: [],
  closing_speed: '30 days',
  funding_type: 'Cash',
  proof_of_funds: false,
  deals_closed: '0',
  average_deal_size: '0',
  reliability_rating: 3,
  is_active: true,
  notes: '',
};

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedLeads, setMatchedLeads] = useState<MatchedLead[]>([]);
  const [matchingBuyer, setMatchingBuyer] = useState<Buyer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [deletingBuyer, setDeletingBuyer] = useState<Buyer | null>(null);
  const [formData, setFormData] = useState<BuyerFormData>(emptyFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBuyers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('buyers')
        .select('*')
        .order('created_at', { ascending: false });

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
  }, []);

  useEffect(() => {
    fetchBuyers();
  }, [fetchBuyers]);

  function formatCurrency(amount: number | null): string {
    if (!amount) return '$0';
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

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function saveBuyer() {
    if (!validateForm()) return;

    setSaving(true);
    setMessage(null);

    const buyerData = {
      full_name: formData.full_name.trim(),
      name: formData.full_name.trim(), // Also set legacy name field
      company_name: formData.company_name.trim() || null,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      secondary_phone: formData.secondary_phone.trim() || null,
      property_types: formData.property_types,
      preferred_zips: formData.preferred_zips.trim() || null,
      preferred_areas: formData.preferred_zips.split(',').map(z => z.trim()).filter(Boolean),
      min_purchase_price: parseFloat(formData.min_purchase_price) || null,
      max_purchase_price: parseFloat(formData.max_purchase_price) || null,
      min_arv: parseFloat(formData.min_arv) || null,
      max_arv: parseFloat(formData.max_arv) || null,
      condition_preference: formData.condition_preference,
      deal_types: formData.deal_types,
      closing_speed: formData.closing_speed,
      funding_type: formData.funding_type.toLowerCase().replace(' ', '_'),
      proof_of_funds: formData.proof_of_funds,
      deals_closed: parseInt(formData.deals_closed) || 0,
      average_deal_size: parseFloat(formData.average_deal_size) || 0,
      reliability_rating: formData.reliability_rating,
      is_active: formData.is_active,
      status: formData.is_active ? 'active' : 'inactive',
      notes: formData.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingBuyer) {
        const { error } = await supabase
          .from('buyers')
          .update(buyerData)
          .eq('id', editingBuyer.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Buyer updated successfully!' });
      } else {
        const { error } = await supabase
          .from('buyers')
          .insert({ ...buyerData, created_at: new Date().toISOString() });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Buyer added successfully!' });
      }

      await fetchBuyers();
      closeModal();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save buyer';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  }

  async function deleteBuyer() {
    if (!deletingBuyer) return;

    try {
      const { error } = await supabase
        .from('buyers')
        .delete()
        .eq('id', deletingBuyer.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Buyer deleted successfully!' });
      await fetchBuyers();
      setShowDeleteConfirm(false);
      setDeletingBuyer(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete buyer';
      setMessage({ type: 'error', text: errorMessage });
    }
  }

  async function matchProperties(buyer: Buyer) {
    setMatchingBuyer(buyer);
    setShowMatchModal(true);
    setMatchedLeads([]);

    try {
      // Build query based on buyer's buy box
      let query = supabase
        .from('maxsam_leads')
        .select('id, property_address, city, zip_code, excess_funds_amount, eleanor_score, deal_grade, status')
        .order('eleanor_score', { ascending: false })
        .limit(20);

      // Filter by zip codes if specified
      if (buyer.preferred_zips) {
        const zips = buyer.preferred_zips.split(',').map(z => z.trim()).filter(Boolean);
        if (zips.length > 0) {
          query = query.in('zip_code', zips);
        }
      }

      // Filter by max purchase price (excess_funds_amount)
      if (buyer.max_purchase_price) {
        query = query.lte('excess_funds_amount', buyer.max_purchase_price);
      }

      // Filter by min purchase price
      if (buyer.min_purchase_price) {
        query = query.gte('excess_funds_amount', buyer.min_purchase_price);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMatchedLeads(data || []);
    } catch (error) {
      console.error('Match error:', error);
      setMatchedLeads([]);
    }
  }

  function openAddModal() {
    setEditingBuyer(null);
    setFormData(emptyFormData);
    setFormErrors({});
    setShowModal(true);
  }

  function openEditModal(buyer: Buyer) {
    setEditingBuyer(buyer);
    setFormData({
      full_name: buyer.full_name || '',
      company_name: buyer.company_name || '',
      email: buyer.email || '',
      phone: buyer.phone || '',
      secondary_phone: buyer.secondary_phone || '',
      property_types: buyer.property_types || [],
      preferred_zips: buyer.preferred_zips || '',
      min_purchase_price: buyer.min_purchase_price?.toString() || '',
      max_purchase_price: buyer.max_purchase_price?.toString() || '',
      min_arv: buyer.min_arv?.toString() || '',
      max_arv: buyer.max_arv?.toString() || '',
      condition_preference: buyer.condition_preference || 'Any',
      deal_types: buyer.deal_types || [],
      closing_speed: buyer.closing_speed || '30 days',
      funding_type: buyer.funding_type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Cash',
      proof_of_funds: buyer.proof_of_funds || false,
      deals_closed: buyer.deals_closed?.toString() || '0',
      average_deal_size: buyer.average_deal_size?.toString() || '0',
      reliability_rating: buyer.reliability_rating || 3,
      is_active: buyer.is_active ?? buyer.status === 'active',
      notes: buyer.notes || '',
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingBuyer(null);
    setFormData(emptyFormData);
    setFormErrors({});
  }

  function togglePropertyType(type: string) {
    setFormData(prev => ({
      ...prev,
      property_types: prev.property_types.includes(type)
        ? prev.property_types.filter(t => t !== type)
        : [...prev.property_types, type]
    }));
  }

  function toggleDealType(type: string) {
    setFormData(prev => ({
      ...prev,
      deal_types: prev.deal_types.includes(type)
        ? prev.deal_types.filter(t => t !== type)
        : [...prev.deal_types, type]
    }));
  }

  // Filter buyers
  const filteredBuyers = buyers.filter(buyer =>
    buyer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    buyer.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    buyer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    buyer.phone?.includes(searchTerm)
  );

  // Analytics calculations
  const activeBuyers = buyers.filter(b => b.is_active || b.status === 'active').length;
  const totalDealsClosed = buyers.reduce((sum, b) => sum + (b.deals_closed || 0), 0);
  const avgMaxBudget = buyers.filter(b => b.max_purchase_price).length > 0
    ? buyers.reduce((sum, b) => sum + (b.max_purchase_price || 0), 0) / buyers.filter(b => b.max_purchase_price).length
    : 0;
  const quickClosers = buyers.filter(b => b.closing_speed === '7 days' && (b.is_active || b.status === 'active')).length;

  // Calculate funding type distribution
  const fundingDistribution = buyers.reduce((acc, b) => {
    const type = b.funding_type || 'cash';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate top zip codes
  const zipCounts: Record<string, number> = {};
  buyers.forEach(b => {
    if (b.preferred_zips) {
      b.preferred_zips.split(',').forEach(zip => {
        const z = zip.trim();
        if (z) zipCounts[z] = (zipCounts[z] || 0) + 1;
      });
    }
  });
  const topZips = Object.entries(zipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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
            onClick={openAddModal}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
          >
            + Add Buyer
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-cyan-400">{buyers.length}</div>
            <div className="text-zinc-500 text-sm">Total Buyers</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-green-400">{activeBuyers}</div>
            <div className="text-zinc-500 text-sm">Active Buyers</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-purple-400">{totalDealsClosed}</div>
            <div className="text-zinc-500 text-sm">Deals Closed</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-yellow-400">{formatCurrency(avgMaxBudget)}</div>
            <div className="text-zinc-500 text-sm">Avg Max Budget</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-orange-400">{quickClosers}</div>
            <div className="text-zinc-500 text-sm">Quick Closers (7d)</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 col-span-2">
            <div className="text-sm font-medium text-white mb-2">Funding Types</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(fundingDistribution).map(([type, count]) => (
                <span key={type} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300">
                  {type.replace('_', ' ')}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Top Zip Codes */}
        {topZips.length > 0 && (
          <div className="mb-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-sm font-medium text-white mb-2">Top Requested Zip Codes</div>
            <div className="flex flex-wrap gap-2">
              {topZips.map(([zip, count]) => (
                <span key={zip} className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm">
                  {zip} ({count})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search buyers by name, company, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Buyers Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Company</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Max Budget</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Areas</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Deal Types</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Closed</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredBuyers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
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
                        <div className="text-white font-medium">{buyer.full_name || 'N/A'}</div>
                        <div className="text-zinc-500 text-xs flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < (buyer.reliability_rating || 0) ? 'text-yellow-400' : 'text-zinc-600'}>★</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{buyer.company_name || '-'}</td>
                      <td className="px-4 py-4 text-zinc-300">{formatPhone(buyer.phone)}</td>
                      <td className="px-4 py-4 text-zinc-300 text-sm">{buyer.email || '-'}</td>
                      <td className="px-4 py-4 text-green-400 font-medium">
                        {formatCurrency(buyer.max_purchase_price)}
                      </td>
                      <td className="px-4 py-4 text-zinc-300 text-sm max-w-32 truncate">
                        {buyer.preferred_zips || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(buyer.deal_types || []).map(type => (
                            <span key={type} className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                              {type}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-cyan-400 font-medium">{buyer.deals_closed || 0}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          buyer.is_active || buyer.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-zinc-500/20 text-zinc-400'
                        }`}>
                          {buyer.is_active || buyer.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(buyer)}
                            className="text-cyan-400 hover:text-cyan-300 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setDeletingBuyer(buyer);
                              setShowDeleteConfirm(true);
                            }}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => matchProperties(buyer)}
                            className="text-purple-400 hover:text-purple-300 text-sm"
                          >
                            Match
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Buyer Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">
                  {editingBuyer ? 'Edit Buyer' : 'Add New Buyer'}
                </h2>
                <button onClick={closeModal} className="text-zinc-400 hover:text-white text-2xl">&times;</button>
              </div>

              <div className="p-6 space-y-6">
                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        className={`w-full px-3 py-2 bg-zinc-800 border rounded-lg text-white ${
                          formErrors.full_name ? 'border-red-500' : 'border-zinc-700'
                        }`}
                        placeholder="John Smith"
                      />
                      {formErrors.full_name && <p className="text-red-400 text-xs mt-1">{formErrors.full_name}</p>}
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Company Name</label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                        placeholder="ABC Investments LLC"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full px-3 py-2 bg-zinc-800 border rounded-lg text-white ${
                          formErrors.email ? 'border-red-500' : 'border-zinc-700'
                        }`}
                        placeholder="john@example.com"
                      />
                      {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Phone *</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className={`w-full px-3 py-2 bg-zinc-800 border rounded-lg text-white ${
                          formErrors.phone ? 'border-red-500' : 'border-zinc-700'
                        }`}
                        placeholder="(214) 555-1234"
                      />
                      {formErrors.phone && <p className="text-red-400 text-xs mt-1">{formErrors.phone}</p>}
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Secondary Phone</label>
                      <input
                        type="tel"
                        value={formData.secondary_phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, secondary_phone: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                        placeholder="(214) 555-5678"
                      />
                    </div>
                  </div>
                </div>

                {/* Buy Box Criteria */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Buy Box Criteria</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-zinc-400 text-sm mb-2">Property Types</label>
                      <div className="flex flex-wrap gap-2">
                        {PROPERTY_TYPES.map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => togglePropertyType(type)}
                            className={`px-3 py-1 rounded-lg text-sm transition ${
                              formData.property_types.includes(type)
                                ? 'bg-cyan-600 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Preferred Zip Codes (comma separated)</label>
                      <input
                        type="text"
                        value={formData.preferred_zips}
                        onChange={(e) => setFormData(prev => ({ ...prev, preferred_zips: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                        placeholder="75201, 75202, 75219"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-zinc-400 text-sm mb-1">Min Purchase $</label>
                        <input
                          type="number"
                          value={formData.min_purchase_price}
                          onChange={(e) => setFormData(prev => ({ ...prev, min_purchase_price: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                          placeholder="50000"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 text-sm mb-1">Max Purchase $</label>
                        <input
                          type="number"
                          value={formData.max_purchase_price}
                          onChange={(e) => setFormData(prev => ({ ...prev, max_purchase_price: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                          placeholder="500000"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 text-sm mb-1">Min ARV $</label>
                        <input
                          type="number"
                          value={formData.min_arv}
                          onChange={(e) => setFormData(prev => ({ ...prev, min_arv: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                          placeholder="100000"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 text-sm mb-1">Max ARV $</label>
                        <input
                          type="number"
                          value={formData.max_arv}
                          onChange={(e) => setFormData(prev => ({ ...prev, max_arv: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                          placeholder="1000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Condition Preference</label>
                      <select
                        value={formData.condition_preference}
                        onChange={(e) => setFormData(prev => ({ ...prev, condition_preference: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                      >
                        {CONDITION_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Deal Preferences */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Deal Preferences</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-zinc-400 text-sm mb-2">Deal Types Interested</label>
                      <div className="flex flex-wrap gap-2">
                        {DEAL_TYPE_OPTIONS.map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => toggleDealType(type)}
                            className={`px-3 py-1 rounded-lg text-sm transition ${
                              formData.deal_types.includes(type)
                                ? 'bg-purple-600 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-zinc-400 text-sm mb-1">Closing Speed</label>
                        <select
                          value={formData.closing_speed}
                          onChange={(e) => setFormData(prev => ({ ...prev, closing_speed: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                        >
                          {CLOSING_SPEEDS.map(speed => (
                            <option key={speed} value={speed}>{speed}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-zinc-400 text-sm mb-1">Funding Type</label>
                        <select
                          value={formData.funding_type}
                          onChange={(e) => setFormData(prev => ({ ...prev, funding_type: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                        >
                          {FUNDING_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.proof_of_funds}
                            onChange={(e) => setFormData(prev => ({ ...prev, proof_of_funds: e.target.checked }))}
                            className="rounded border-zinc-600 bg-zinc-800 text-cyan-500"
                          />
                          <span className="text-zinc-300">Proof of Funds on File</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Track Record */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Track Record</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Deals Closed</label>
                      <input
                        type="number"
                        value={formData.deals_closed}
                        onChange={(e) => setFormData(prev => ({ ...prev, deals_closed: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Average Deal Size $</label>
                      <input
                        type="number"
                        value={formData.average_deal_size}
                        onChange={(e) => setFormData(prev => ({ ...prev, average_deal_size: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Reliability Rating</label>
                      <div className="flex items-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, reliability_rating: star }))}
                            className={`text-2xl transition ${
                              star <= formData.reliability_rating ? 'text-yellow-400' : 'text-zinc-600'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status & Notes */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Status & Notes</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                          className="rounded border-zinc-600 bg-zinc-800 text-green-500 w-5 h-5"
                        />
                        <span className="text-white">Active Buyer</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm mb-1">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white h-24 resize-none"
                        placeholder="Special requirements, preferences, or other notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveBuyer}
                  disabled={saving}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingBuyer ? 'Update Buyer' : 'Add Buyer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deletingBuyer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Delete Buyer</h2>
              <p className="text-zinc-400 mb-6">
                Are you sure you want to delete <span className="text-white font-medium">{deletingBuyer.full_name}</span>?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingBuyer(null);
                  }}
                  className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteBuyer}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Match Properties Modal */}
        {showMatchModal && matchingBuyer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
              <div className="border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Matching Properties</h2>
                  <p className="text-zinc-500 text-sm">For {matchingBuyer.full_name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowMatchModal(false);
                    setMatchingBuyer(null);
                  }}
                  className="text-zinc-400 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {matchedLeads.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    No matching properties found for this buyer's criteria.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matchedLeads.map(lead => (
                      <div key={lead.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-white font-medium">{lead.property_address || 'No Address'}</div>
                            <div className="text-zinc-500 text-sm">{lead.city} {lead.zip_code}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-400 font-bold">{formatCurrency(lead.excess_funds_amount)}</div>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              lead.deal_grade === 'A+' || lead.deal_grade === 'A'
                                ? 'bg-green-500/20 text-green-400'
                                : lead.deal_grade === 'B'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {lead.deal_grade || 'N/A'} - Score: {lead.eleanor_score || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
