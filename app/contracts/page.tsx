'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

interface Lead {
  id: string;
  owner_name: string;
  property_address: string;
  excess_amount: number;
  email: string | null;
  phone: string | null;
  ready_for_contract: boolean;
  boldsign_status: string | null;
}

interface Contract {
  id: string;
  owner_name: string;
  property_address: string;
  excess_amount: number;
  contract_type: string;
  fee_percentage: number;
  boldsign_document_id: string;
  boldsign_status: string;
  contract_sent_at: string;
  contract_signed_at: string | null;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  
  // New contract form state
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [contractType, setContractType] = useState<'recovery' | 'wholesale'>('recovery');
  const [feePercentage, setFeePercentage] = useState(25);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [earnestMoney, setEarnestMoney] = useState('1000');
  const [inspectionDays, setInspectionDays] = useState(7);
  const [closingDays, setClosingDays] = useState(30);

  useEffect(() => {
    fetchContracts();
    fetchAvailableLeads();
  }, []);

  async function fetchContracts() {
    try {
      const { data, error } = await supabase
        .from('maxsam_leads')
        .select('*')
        .not('boldsign_document_id', 'is', null)
        .order('contract_sent_at', { ascending: false });

      if (!error && data) {
        setContracts(data);
      }
    } catch (err) {
      console.error('Error fetching contracts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableLeads() {
    try {
      const { data, error } = await supabase
        .from('maxsam_leads')
        .select('*')
        .eq('ready_for_contract', true)
        .is('boldsign_document_id', null)
        .order('excess_amount', { ascending: false });

      if (!error && data) {
        setAvailableLeads(data);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  }

  async function sendContract() {
    if (!selectedLeadId) return;
    
    setSending(true);
    try {
      const response = await fetch('/api/contracts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLeadId,
          contractType,
          feePercentage,
          purchasePrice: contractType === 'wholesale' ? parseFloat(purchasePrice) : undefined,
          earnestMoney: contractType === 'wholesale' ? parseFloat(earnestMoney) : undefined,
          inspectionDays: contractType === 'wholesale' ? inspectionDays : undefined,
          closingDays: contractType === 'wholesale' ? closingDays : undefined,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        setSelectedLeadId('');
        fetchContracts();
        fetchAvailableLeads();
        alert('Contract sent successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to send contract'}`);
      }
    } catch (err) {
      console.error('Error sending contract:', err);
      alert('Failed to send contract');
    } finally {
      setSending(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      sent: 'bg-blue-500/20 text-blue-400',
      viewed: 'bg-yellow-500/20 text-yellow-400',
      signed: 'bg-green-500/20 text-green-400',
      completed: 'bg-emerald-500/20 text-emerald-400',
      declined: 'bg-red-500/20 text-red-400',
      expired: 'bg-zinc-500/20 text-zinc-400',
    };
    return styles[status?.toLowerCase()] || 'bg-zinc-500/20 text-zinc-400';
  }

  const selectedLead = availableLeads.find(l => l.id === selectedLeadId);
  const calculatedFee = selectedLead ? selectedLead.excess_amount * (feePercentage / 100) : 0;
  const clientReceives = selectedLead ? selectedLead.excess_amount - calculatedFee : 0;

  const totalContracts = contracts.length;
  const pendingContracts = contracts.filter(c => c.boldsign_status === 'sent' || c.boldsign_status === 'viewed').length;
  const signedContracts = contracts.filter(c => c.boldsign_status === 'signed' || c.boldsign_status === 'completed').length;
  const totalRevenue = contracts
    .filter(c => c.boldsign_status === 'signed' || c.boldsign_status === 'completed')
    .reduce((sum, c) => sum + (c.excess_amount * (c.fee_percentage || 25) / 100), 0);

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
            <h1 className="text-3xl font-bold text-white">Contracts</h1>
            <p className="text-zinc-500 mt-1">Boldsign contract management</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition flex items-center gap-2"
          >
            <span>+</span> New Contract
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-cyan-400">{totalContracts}</div>
            <div className="text-zinc-500 text-sm">Total Contracts</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-blue-400">{pendingContracts}</div>
            <div className="text-zinc-500 text-sm">Pending Signature</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-green-400">{signedContracts}</div>
            <div className="text-zinc-500 text-sm">Signed</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-yellow-400">{formatCurrency(totalRevenue)}</div>
            <div className="text-zinc-500 text-sm">Total Revenue</div>
          </div>
        </div>

        {/* Contracts Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Property</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Owner</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Type</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Fee</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    <p className="text-lg mb-2">No contracts yet</p>
                    <p className="text-sm">Click "+ New Contract" to send your first contract via Boldsign</p>
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-zinc-800/50 transition">
                    <td className="px-4 py-4">
                      <div className="text-white font-medium truncate max-w-[200px]">
                        {contract.property_address || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-300">{contract.owner_name || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        contract.contract_type === 'recovery' 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {contract.contract_type?.toUpperCase() || 'RECOVERY'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white">
                      {formatCurrency(contract.excess_amount || 0)}
                    </td>
                    <td className="px-4 py-4 text-green-400 font-medium">
                      {formatCurrency((contract.excess_amount || 0) * (contract.fee_percentage || 25) / 100)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(contract.boldsign_status)}`}>
                        {contract.boldsign_status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-400 text-sm">
                      {contract.contract_sent_at 
                        ? new Date(contract.contract_sent_at).toLocaleDateString() 
                        : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* New Contract Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">New Contract</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-zinc-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Contract Type Toggle */}
              <div className="mb-6">
                <label className="block text-zinc-400 text-sm mb-2">Contract Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setContractType('recovery')}
                    className={`px-4 py-3 rounded-lg font-medium transition ${
                      contractType === 'recovery'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    💰 Recovery Agreement
                  </button>
                  <button
                    onClick={() => setContractType('wholesale')}
                    className={`px-4 py-3 rounded-lg font-medium transition ${
                      contractType === 'wholesale'
                        ? 'bg-orange-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    🏠 Wholesale Agreement
                  </button>
                </div>
              </div>

              {/* Lead Selection */}
              <div className="mb-4">
                <label className="block text-zinc-400 text-sm mb-2">Select Lead</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Choose a lead...</option>
                  {availableLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.owner_name} - {formatCurrency(lead.excess_amount)} - {lead.property_address?.slice(0, 30)}...
                    </option>
                  ))}
                </select>
                {availableLeads.length === 0 && (
                  <p className="text-yellow-400 text-xs mt-2">
                    No leads ready for contract. Mark leads as "ready_for_contract" in the database.
                  </p>
                )}
              </div>

              {/* Selected Lead Info */}
              {selectedLead && (
                <div className="mb-4 p-4 bg-zinc-800 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-zinc-500">Owner:</span>
                      <span className="text-white ml-2">{selectedLead.owner_name}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Amount:</span>
                      <span className="text-cyan-400 ml-2">{formatCurrency(selectedLead.excess_amount)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-zinc-500">Property:</span>
                      <span className="text-white ml-2">{selectedLead.property_address}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Email:</span>
                      <span className={`ml-2 ${selectedLead.email ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedLead.email || 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Phone:</span>
                      <span className={`ml-2 ${selectedLead.phone ? 'text-green-400' : 'text-yellow-400'}`}>
                        {selectedLead.phone || 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Recovery Agreement Fields */}
              {contractType === 'recovery' && (
                <div className="mb-4">
                  <label className="block text-zinc-400 text-sm mb-2">
                    Fee Percentage: {feePercentage}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={feePercentage}
                    onChange={(e) => setFeePercentage(parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>10%</span>
                    <span>25% (default)</span>
                    <span>40%</span>
                  </div>
                </div>
              )}

              {/* Wholesale Agreement Fields */}
              {contractType === 'wholesale' && (
                <>
                  <div className="mb-4">
                    <label className="block text-zinc-400 text-sm mb-2">Purchase Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                      <input
                        type="number"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        placeholder="0"
                        className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-zinc-400 text-sm mb-2">Earnest Money</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                      <input
                        type="number"
                        value={earnestMoney}
                        onChange={(e) => setEarnestMoney(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-zinc-400 text-sm mb-2">
                      Inspection Period: {inspectionDays} days
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="30"
                      value={inspectionDays}
                      onChange={(e) => setInspectionDays(parseInt(e.target.value))}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-zinc-400 text-sm mb-2">
                      Closing Days: {closingDays} days
                    </label>
                    <input
                      type="range"
                      min="14"
                      max="60"
                      value={closingDays}
                      onChange={(e) => setClosingDays(parseInt(e.target.value))}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Fee Calculation Display */}
              {selectedLead && contractType === 'recovery' && (
                <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-zinc-400">Excess Amount</span>
                    <span className="text-white">{formatCurrency(selectedLead.excess_amount)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-zinc-400">Your Fee ({feePercentage}%)</span>
                    <span className="text-green-400 font-bold">{formatCurrency(calculatedFee)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-zinc-700">
                    <span className="text-zinc-400">Client Receives</span>
                    <span className="text-cyan-400">{formatCurrency(clientReceives)}</span>
                  </div>
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={sendContract}
                disabled={!selectedLeadId || sending}
                className={`w-full py-3 rounded-lg font-medium transition ${
                  !selectedLeadId || sending
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'bg-cyan-600 text-white hover:bg-cyan-700'
                }`}
              >
                {sending ? 'Sending...' : `Send ${contractType === 'recovery' ? 'Recovery' : 'Wholesale'} Contract`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

