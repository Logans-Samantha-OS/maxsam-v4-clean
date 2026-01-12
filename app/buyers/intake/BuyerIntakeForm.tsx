'use client';

import { useState } from 'react';

interface BuyerFormData {
  name: string;
  company_name: string;
  phone: string;
  email: string;
  counties_interested: string[];
  min_price: number | null;
  max_price: number | null;
  property_types: string[];
  is_cash_buyer: boolean;
  speed_to_close: string;
  monthly_capacity: number;
  proof_of_funds: boolean;
  notes: string;
}

const TEXAS_COUNTIES = [
  'Dallas', 'Tarrant', 'Collin', 'Denton', 'Harris', 
  'Travis', 'Bexar', 'El Paso', 'Hidalgo', 'Fort Bend'
];

const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'triplex', label: 'Triplex' },
  { value: 'fourplex', label: 'Fourplex' },
  { value: 'multifamily', label: 'Multi-Family (5+)' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Land' },
];

const SPEED_OPTIONS = [
  { value: '7_days', label: '7 days or less' },
  { value: '14_days', label: '14 days' },
  { value: '21_days', label: '21 days' },
  { value: '30_days', label: '30 days' },
  { value: '45_days', label: '45+ days' },
];

export default function BuyerIntakeForm() {
  const [formData, setFormData] = useState<BuyerFormData>({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    counties_interested: [],
    min_price: null,
    max_price: null,
    property_types: [],
    is_cash_buyer: true,
    speed_to_close: '14_days',
    monthly_capacity: 5,
    proof_of_funds: false,
    notes: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCountyToggle = (county: string) => {
    setFormData(prev => ({
      ...prev,
      counties_interested: prev.counties_interested.includes(county)
        ? prev.counties_interested.filter(c => c !== county)
        : [...prev.counties_interested, county]
    }));
  };

  const handlePropertyTypeToggle = (type: string) => {
    setFormData(prev => ({
      ...prev,
      property_types: prev.property_types.includes(type)
        ? prev.property_types.filter(t => t !== type)
        : [...prev.property_types, type]
    }));
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-green-50 rounded-lg border border-green-200">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            You&apos;re on the Buyer List!
          </h2>
          <p className="text-green-700">
            Eleanor will start matching deals to your criteria immediately.
            You&apos;ll receive notifications when we have properties that fit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Buyer Application</h1>
        <p className="text-gray-600 mt-2">
          Get matched with wholesale deals that fit your criteria
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Contact Info */}
      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Contact Information
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="John Smith"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={formData.company_name}
              onChange={e => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="ABC Investments LLC"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone *
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="john@example.com"
            />
          </div>
        </div>
      </div>

      {/* Buy Box */}
      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Your Buy Box
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Counties of Interest *
          </label>
          <div className="flex flex-wrap gap-2">
            {TEXAS_COUNTIES.map(county => (
              <button
                key={county}
                type="button"
                onClick={() => handleCountyToggle(county)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  formData.counties_interested.includes(county)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {county}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Purchase Price
            </label>
            <input
              type="number"
              value={formData.min_price || ''}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                min_price: e.target.value ? parseInt(e.target.value) : null 
              }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="$50,000"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Purchase Price
            </label>
            <input
              type="number"
              value={formData.max_price || ''}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                max_price: e.target.value ? parseInt(e.target.value) : null 
              }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="$500,000"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Property Types
          </label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => handlePropertyTypeToggle(type.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  formData.property_types.includes(type.value)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Buying Capacity */}
      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Buying Capacity
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Speed to Close
            </label>
            <select
              value={formData.speed_to_close}
              onChange={e => setFormData(prev => ({ ...prev, speed_to_close: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {SPEED_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Capacity
            </label>
            <input
              type="number"
              value={formData.monthly_capacity}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                monthly_capacity: parseInt(e.target.value) || 1 
              }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              min="1"
              max="100"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_cash_buyer}
              onChange={e => setFormData(prev => ({ ...prev, is_cash_buyer: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Cash Buyer</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.proof_of_funds}
              onChange={e => setFormData(prev => ({ ...prev, proof_of_funds: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Have Proof of Funds Ready</span>
          </label>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Additional Notes
        </h2>
        
        <textarea
          value={formData.notes}
          onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder="Any specific requirements, preferred neighborhoods, renovation capabilities, etc."
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || formData.counties_interested.length === 0}
        className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Submitting...' : 'Join Buyer List'}
      </button>

      <p className="text-center text-sm text-gray-500">
        By submitting, you agree to receive deal notifications via SMS and email.
      </p>
    </form>
  );
}
