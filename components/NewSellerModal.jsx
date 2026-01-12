import { useState } from 'react';
import Modal from './Modal';
import { supabase } from '@/lib/supabase';

export default function NewSellerModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    property_address: '',
    owner_name: '',
    excess_funds_amount: '',
    phone: '',
    email: '',
    city: '',
    status: 'new',
    contact_priority: 'warm',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('maxsam_leads')
        .insert([
          {
            property_address: formData.property_address,
            owner_name: formData.owner_name,
            excess_funds_amount:
              parseFloat(formData.excess_funds_amount) || 0,
            phone: formData.phone,
            email: formData.email,
            city: formData.city,
            status: formData.status,
            contact_priority: formData.contact_priority,
          },
        ])
        .select();

      if (error) throw error;

      // Check if this is a high-priority lead
      if (data && data[0] && (data[0].eleanor_score >= 85 || data[0].deal_grade?.startsWith('A'))) {
        // Trigger notification
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'hot-lead',
            data: data[0],
          }),
        }).catch(console.error);
      }

      setFormData({
        property_address: '',
        owner_name: '',
        excess_funds_amount: '',
        phone: '',
        email: '',
        city: '',
        status: 'new',
        contact_priority: 'warm',
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating lead:', error);
      alert('Failed to create lead: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Seller/Lead"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Property Info */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Property Address *
          </label>
          <input
            type="text"
            required
            value={formData.property_address}
            onChange={(e) =>
              setFormData({ ...formData, property_address: e.target.value })
            }
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="123 Main St, Dallas, TX 75001"
          />
        </div>

        {/* Owner Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Owner Name *
            </label>
            <input
              type="text"
              required
              value={formData.owner_name}
              onChange={(e) =>
                setFormData({ ...formData, owner_name: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="Dallas"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>
        </div>

        {/* Excess Funds */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Excess Funds Amount ($)
          </label>
          <input
            type="number"
            value={formData.excess_funds_amount}
            onChange={(e) =>
              setFormData({
                ...formData,
                excess_funds_amount: e.target.value,
              })
            }
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="45000"
          />
        </div>

        {/* Status & Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="contract">Contract</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Priority
            </label>
            <select
              value={formData.contact_priority}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contact_priority: e.target.value,
                })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            >
              <option value="cold">Cold</option>
              <option value="warm">Warm</option>
              <option value="hot">Hot</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
