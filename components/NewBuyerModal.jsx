import { useState } from 'react';
import Modal from './Modal';
import { supabase } from '@/lib/supabase';

export default function NewBuyerModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    preferred_areas: '',
    min_price: '',
    max_price: '',
    property_types: [],
    cash_buyer: true,
    deals_closed: 0,
    avg_close_days: 30,
  });

  const propertyTypeOptions = ['SFR', 'Multi-Family', 'Condo', 'Townhouse', 'Land', 'Commercial'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert preferred_areas string to array
      const areasArray = formData.preferred_areas
        .split(',')
        .map(a => a.trim())
        .filter(a => a);

      const { data, error } = await supabase
        .from('buyers')
        .insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          preferred_areas: areasArray,
          min_price: parseInt(formData.min_price) || 0,
          max_price: parseInt(formData.max_price) || 0,
          property_types: formData.property_types,
          cash_buyer: formData.cash_buyer,
          deals_closed: parseInt(formData.deals_closed) || 0,
          avg_close_days: parseInt(formData.avg_close_days) || 30,
        }])
        .select();

      if (error) throw error;

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        preferred_areas: '',
        min_price: '',
        max_price: '',
        property_types: [],
        cash_buyer: true,
        deals_closed: 0,
        avg_close_days: 30,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating buyer:', error);
      alert('Failed to create buyer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePropertyType = (type) => {
    setFormData(prev => ({
      ...prev,
      property_types: prev.property_types.includes(type)
        ? prev.property_types.filter(t => t !== type)
        : [...prev.property_types, type]
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Buyer" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({...formData, company: e.target.value})}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="Smith Properties LLC"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Phone *
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>

        {/* Preferences */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Preferred Areas (ZIP codes, comma-separated)
          </label>
          <input
            type="text"
            value={formData.preferred_areas}
            onChange={(e) => setFormData({...formData, preferred_areas: e.target.value})}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="75001, 75002, 75080"
          />
        </div>

        {/* Price Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Min Price ($)
            </label>
            <input
              type="number"
              value={formData.min_price}
              onChange={(e) => setFormData({...formData, min_price: e.target.value})}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="50000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Max Price ($)
            </label>
            <input
              type="number"
              value={formData.max_price}
              onChange={(e) => setFormData({...formData, max_price: e.target.value})}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="500000"
            />
          </div>
        </div>

        {/* Property Types */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Property Types
          </label>
          <div className="flex flex-wrap gap-2">
            {propertyTypeOptions.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => togglePropertyType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.property_types.includes(type)
                    ? 'bg-cyan-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Deals Closed
            </label>
            <input
              type="number"
              value={formData.deals_closed}
              onChange={(e) => setFormData({...formData, deals_closed: e.target.value})}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Avg Close Days
            </label>
            <input
              type="number"
              value={formData.avg_close_days}
              onChange={(e) => setFormData({...formData, avg_close_days: e.target.value})}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Cash Buyer?
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.cash_buyer}
                onChange={(e) => setFormData({...formData, cash_buyer: e.target.checked})}
                className="w-5 h-5 rounded bg-zinc-800 border-zinc-700 text-cyan-500 focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-zinc-300">Yes</span>
            </label>
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
            {loading ? 'Creating...' : 'Create Buyer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
