'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Buyer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  telegram_username: string;
  min_arv: number;
  max_arv: number;
  active: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  telegram_username: string;
  min_arv: string;
  max_arv: string;
}

export default function BuyersManagementPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    company: '',
    email: '',
    phone: '',
    telegram_username: '',
    min_arv: '',
    max_arv: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchBuyers();
  }, []);

  const fetchBuyers = async () => {
    try {
      const { data, error } = await supabase
        .from('wholesale_buyers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBuyers(data || []);
    } catch (error) {
      console.error('Error fetching buyers:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      telegram_username: '',
      min_arv: '',
      max_arv: ''
    });
    setEditingBuyer(null);
  };

  const openModal = (buyer?: Buyer) => {
    if (buyer) {
      setEditingBuyer(buyer);
      setFormData({
        name: buyer.name,
        company: buyer.company,
        email: buyer.email,
        phone: buyer.phone,
        telegram_username: buyer.telegram_username,
        min_arv: buyer.min_arv.toString(),
        max_arv: buyer.max_arv.toString()
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const submitData = {
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        telegram_username: formData.telegram_username,
        min_arv: parseFloat(formData.min_arv),
        max_arv: parseFloat(formData.max_arv)
      };

      let result;
      if (editingBuyer) {
        // Update existing buyer
        result = await supabase
          .from('wholesale_buyers')
          .update(submitData)
          .eq('id', editingBuyer.id);
      } else {
        // Create new buyer
        result = await supabase
          .from('wholesale_buyers')
          .insert(submitData);
      }

      if (result.error) throw result.error;

      await fetchBuyers();
      closeModal();
    } catch (error) {
      console.error('Error saving buyer:', error);
      alert('Error saving buyer');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActiveStatus = async (buyerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('wholesale_buyers')
        .update({ active: !currentStatus })
        .eq('id', buyerId);

      if (error) throw error;

      await fetchBuyers();
    } catch (error) {
      console.error('Error updating buyer status:', error);
      alert('Error updating buyer status');
    }
  };

  const deleteBuyer = async (buyerId: string) => {
    try {
      const { error } = await supabase
        .from('wholesale_buyers')
        .delete()
        .eq('id', buyerId);

      if (error) throw error;

      await fetchBuyers();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting buyer:', error);
      alert('Error deleting buyer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading buyers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Buyer Management</h1>
            <button
              onClick={() => openModal()}
              className="bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition-colors"
            >
              Add Buyer
            </button>
          </div>

          {/* Buyers Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Min ARV
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Max ARV
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {buyers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-slate-500">
                      No buyers found
                    </td>
                  </tr>
                ) : (
                  buyers.map((buyer) => (
                    <tr key={buyer.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {buyer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {buyer.company || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {buyer.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {buyer.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        ${buyer.min_arv?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        ${buyer.max_arv?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleActiveStatus(buyer.id, buyer.active)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            buyer.active ? 'bg-emerald-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              buyer.active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openModal(buyer)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(buyer.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
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

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                {editingBuyer ? 'Edit Buyer' : 'Add New Buyer'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Telegram Username
                  </label>
                  <input
                    type="text"
                    value={formData.telegram_username}
                    onChange={(e) => setFormData({ ...formData, telegram_username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Min ARV *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.min_arv}
                      onChange={(e) => setFormData({ ...formData, min_arv: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Max ARV *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.max_arv}
                      onChange={(e) => setFormData({ ...formData, max_arv: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 disabled:bg-slate-400 transition-colors"
                  >
                    {submitting ? 'Saving...' : (editingBuyer ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Confirm Delete</h3>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this buyer? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteBuyer(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
