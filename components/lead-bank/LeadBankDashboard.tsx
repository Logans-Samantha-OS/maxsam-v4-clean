'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BankedLead {
  id: string;
  lead_id: string;
  reason: string;
  original_score: number | null;
  amount: number | null;
  notes: string | null;
  parked_at: string;
  lead?: {
    id: string;
    owner_name: string;
    primary_phone: string | null;
    phone: string | null;
    property_address: string | null;
    city: string | null;
    county: string | null;
    excess_funds_amount: number | null;
    eleanor_score: number | null;
  };
}

const REASON_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  no_response: { label: 'No Response', icon: '📵', color: 'bg-gray-600' },
  too_small: { label: 'Amount Too Small', icon: '💵', color: 'bg-yellow-600' },
  wrong_location: { label: 'Wrong Location', icon: '📍', color: 'bg-orange-600' },
  low_score: { label: 'Low Score', icon: '📉', color: 'bg-red-600' },
  duplicate: { label: 'Duplicate', icon: '👥', color: 'bg-purple-600' },
  expired: { label: 'Expired', icon: '⏰', color: 'bg-pink-600' },
  other: { label: 'Other', icon: '📋', color: 'bg-blue-600' }
};

export default function LeadBankDashboard() {
  const [leads, setLeads] = useState<BankedLead[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lead-bank');
      const data = await res.json();
      setLeads(data.leads || []);
      setSummary(data.summary || {});
      setTotalValue(data.totalValue || 0);
    } catch (error) {
      console.error('Failed to fetch lead bank:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (bankId: string, leadId: string) => {
    setReactivating(bankId);
    try {
      const res = await fetch('/api/lead-bank/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_id: bankId, lead_id: leadId })
      });
      
      if (res.ok) {
        fetchLeads();
      }
    } catch (error) {
      console.error('Failed to reactivate lead:', error);
    } finally {
      setReactivating(null);
    }
  };

  const filteredLeads = selectedReason 
    ? leads.filter(l => l.reason === selectedReason)
    : leads;

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-zinc-400">Loading lead bank...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">🏦</span> Lead Bank
          </h1>
          <p className="text-zinc-400">Parked leads waiting for better timing</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-amber-400">{formatCurrency(totalValue)}</div>
          <div className="text-sm text-zinc-400">{leads.length} leads banked</div>
        </div>
      </div>

      {/* Reason Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(REASON_CONFIG).map(([reason, config]) => {
          const count = summary[reason] || 0;
          const isSelected = selectedReason === reason;
          
          return (
            <Card 
              key={reason}
              className={`cursor-pointer transition-all hover:scale-105 ${
                isSelected ? 'ring-2 ring-yellow-500' : ''
              } ${count === 0 ? 'opacity-50' : ''}`}
              onClick={() => setSelectedReason(isSelected ? null : reason)}
            >
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-1">{config.icon}</div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-zinc-400">{config.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {leads.length === 0 && (
        <Card className="bg-zinc-800/50">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="text-6xl mb-4">🏦</div>
            <h3 className="text-xl font-semibold mb-2">Lead Bank is Empty</h3>
            <p className="text-zinc-400 max-w-md mx-auto">
              When leads aren't ready for outreach (wrong timing, too small, etc.), 
              park them here instead of deleting. You can reactivate them later when conditions change.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lead List */}
      {filteredLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {selectedReason ? REASON_CONFIG[selectedReason]?.label : 'All'} Leads
                <Badge variant="outline" className="ml-2">{filteredLeads.length}</Badge>
              </span>
              {selectedReason && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedReason(null)}>
                  Show All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredLeads.map((item) => {
                const config = REASON_CONFIG[item.reason] || REASON_CONFIG.other;
                const lead = item.lead;
                
                return (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{config.icon}</div>
                      <div>
                        <div className="font-medium">{lead?.owner_name || 'Unknown'}</div>
                        <div className="text-sm text-zinc-400">
                          {lead?.city || 'Unknown'}, {lead?.county || 'TX'}
                        </div>
                        {item.notes && (
                          <div className="text-xs text-zinc-500 mt-1 italic">"{item.notes}"</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-green-400 font-semibold">
                          {formatCurrency(item.amount)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Parked {formatDate(item.parked_at)}
                        </div>
                      </div>
                      
                      <Badge className={config.color}>{config.label}</Badge>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReactivate(item.id, item.lead_id)}
                        disabled={reactivating === item.id}
                      >
                        {reactivating === item.id ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          '♻️ Reactivate'
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card className="bg-blue-900/20 border-blue-700">
        <CardHeader>
          <CardTitle className="text-lg">💡 How Lead Bank Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <strong className="text-blue-400">When to Bank:</strong>
              <ul className="mt-1 text-zinc-400 space-y-1">
                <li>• Amount too small for now</li>
                <li>• No response after 3+ attempts</li>
                <li>• Wrong location/out of service area</li>
                <li>• Expiration date too far out</li>
              </ul>
            </div>
            <div>
              <strong className="text-green-400">When to Reactivate:</strong>
              <ul className="mt-1 text-zinc-400 space-y-1">
                <li>• Market conditions change</li>
                <li>• Expiration approaching</li>
                <li>• New buyer interested in area</li>
                <li>• Price thresholds updated</li>
              </ul>
            </div>
            <div>
              <strong className="text-amber-400">Pro Tips:</strong>
              <ul className="mt-1 text-zinc-400 space-y-1">
                <li>• Review bank weekly</li>
                <li>• Set reminders for expiring leads</li>
                <li>• Batch reactivate by reason</li>
                <li>• Don't delete - bank instead!</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
