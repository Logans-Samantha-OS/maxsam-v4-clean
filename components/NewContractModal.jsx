import { useState, useEffect } from 'react';
import Modal from './Modal';
import { supabase } from '@/lib/supabase';

export default function NewContractModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [formData, setFormData] = useState({
    lead_id: '',
    buyer_id: '',
    deal_type: 'dual',
    excess_funds_amount: '',
    wholesale_amount: '',
    property_address: '',
    seller_name: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    const [sellersResult, buyersResult] = await Promise.all([
      supabase
        .from('maxsam_leads')
        .select('id, property_address, owner_name, excess_funds_amount')
        .order('created_at', { ascending: false }),
      supabase.from('buyers').select('id, name, company').order('name'),
    ]);

    if (sellersResult.data) setSellers(sellersResult.data);
    if (buyersResult.data) setBuyers(buyersResult.data);
  };

  const handleSellerChange = (leadId) => {
    const seller = sellers.find((s) => s.id === leadId);
    if (seller) {
      setFormData({
        ...formData,
        lead_id: leadId,
        property_address: seller.property_address,
        seller_name: seller.owner_name,
        excess_funds_amount: seller.excess_funds_amount || '',
      });
    }
  };

  const calculateFees = () => {
    const excessAmount = parseFloat(formData.excess_funds_amount) || 0;
    const wholesaleAmount = parseFloat(formData.wholesale_amount) || 0;

    let excessFee = 0;
    let wholesaleFee = 0;

    if (formData.deal_type === 'excess_only' || formData.deal_type === 'dual') {
      excessFee = excessAmount * 0.25;
    }

    if (formData.deal_type === 'wholesale' || formData.deal_type === 'dual') {
      wholesaleFee = wholesaleAmount * 0.10;
    }

    const totalFee = excessFee + wholesaleFee;
    const loganCut =
      formData.deal_type === 'excess_only' ? totalFee * 0.8 : totalFee * 0.65;
    const maxCut =
      formData.deal_type === 'excess_only' ? totalFee * 0.2 : totalFee * 0.35;

    return { excessFee, wholesaleFee, totalFee, loganCut, maxCut };
  };

  const fees = calculateFees();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('contracts')
        .insert([
          {
            lead_id: formData.lead_id,
            buyer_id: formData.buyer_id,
            status: 'draft',
            deal_type: formData.deal_type,
            excess_funds_amount:
              parseFloat(formData.excess_funds_amount) || 0,
            wholesale_amount: parseFloat(formData.wholesale_amount) || 0,
            total_fee: fees.totalFee,
            logan_cut: fees.loganCut,
            max_cut: fees.maxCut,
            property_address: formData.property_address,
            seller_name: formData.seller_name,
            notes: formData.notes,
          },
        ])
        .select();

      if (error) throw error;

      setFormData({
        lead_id: '',
        buyer_id: '',
        deal_type: 'dual',
        excess_funds_amount: '',
        wholesale_amount: '',
        property_address: '',
        seller_name: '',
        notes: '',
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating contract:', error);
      alert('Failed to create contract: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Contract"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Deal Type Selection */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Deal Type *
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'excess_only', label: 'Excess Only', desc: '25% fee' },
              { value: 'wholesale', label: 'Wholesale Only', desc: '10% fee' },
              { value: 'dual', label: 'DUAL Deal', desc: '35% combined' },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() =>
                  setFormData({ ...formData, deal_type: type.value })
                }
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.deal_type === type.value
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="font-semibold text-white">{type.label}</div>
                <div className="text-sm text-zinc-400 mt-1">{type.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Seller Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Select Seller/Lead *
            </label>
            <select
              required
              value={formData.lead_id}
              onChange={(e) => handleSellerChange(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Choose a lead...</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.property_address} - {seller.owner_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Select Buyer *
            </label>
            <select
              required
              value={formData.buyer_id}
              onChange={(e) =>
                setFormData({ ...formData, buyer_id: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Choose a buyer...</option>
              {buyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.name} {buyer.company ? `(${buyer.company})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Property Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Property Address
            </label>
            <input
              type="text"
              value={formData.property_address}
              onChange={(e) =>
                setFormData({ ...formData, property_address: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              placeholder="Auto-filled from lead"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Seller Name
            </label>
            <input
              type="text"
              value={formData.seller_name}
              onChange={(e) =>
                setFormData({ ...formData, seller_name: e.target.value })
              }
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              placeholder="Auto-filled from lead"
            />
          </div>
        </div>

        {/* Deal Amounts */}
        <div className="grid grid-cols-2 gap-4">
          {(formData.deal_type === 'excess_only' ||
            formData.deal_type === 'dual') && (
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
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                placeholder="45000"
              />
            </div>
          )}

          {(formData.deal_type === 'wholesale' ||
            formData.deal_type === 'dual') && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Wholesale Amount ($)
              </label>
              <input
                type="number"
                value={formData.wholesale_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    wholesale_amount: e.target.value,
                  })
                }
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                placeholder="465000"
              />
            </div>
          )}
        </div>

        {/* Fee Breakdown */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            Fee Breakdown
          </h3>
          <div className="space-y-2 text-sm">
            {fees.excessFee > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Excess Fee (25%):</span>
                <span className="text-green-400 font-medium">
                  ${fees.excessFee.toLocaleString()}
                </span>
              </div>
            )}
            {fees.wholesaleFee > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Wholesale Fee (10%):</span>
                <span className="text-green-400 font-medium">
                  ${fees.wholesaleFee.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-zinc-700">
              <span className="text-white font-medium">Total Fee:</span>
              <span className="text-cyan-400 font-bold">
                ${fees.totalFee.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">
                Logan Cut (
                {formData.deal_type === 'excess_only' ? '80%' : '65%'}):
              </span>
              <span className="text-zinc-300">
                ${fees.loganCut.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">
                Max Cut ({formData.deal_type === 'excess_only' ? '20%' : '35%'}):
              </span>
              <span className="text-zinc-300">
                ${fees.maxCut.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={3}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
            placeholder="Additional deal notes..."
          />
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
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Contract'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
