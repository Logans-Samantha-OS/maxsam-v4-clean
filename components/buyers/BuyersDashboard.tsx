'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Buyer {
  id: string;
  name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  buyer_type: string | null;
  lead_types: string[];
  max_price_per_lead: number | null;
  monthly_budget: number | null;
  monthly_spent: number | null;
  lifetime_spend: number | null;
  leads_purchased: number;
  is_active: boolean;
  reliability_score: number | null;
  notes: string | null;
}

const BUYER_TYPES = [
  { value: 'wholesaler', label: '🏠 Wholesaler', desc: 'Buys distressed seller leads' },
  { value: 'investor', label: '💵 Cash Investor', desc: 'Buys any property lead' },
  { value: 'law_firm', label: '⚖️ Law Firm', desc: 'Buys mass tort leads' },
  { value: 'recovery_company', label: '💰 Recovery Company', desc: 'Buys excess funds leads' },
  { value: 'heir_locator', label: '🔍 Heir Locator', desc: 'Buys skip trace data' },
  { value: 'collection_agency', label: '📞 Collections', desc: 'Buys skip trace data' },
  { value: 'pi', label: '🕵️ Private Investigator', desc: 'Buys skip trace data' },
  { value: 'other', label: '📋 Other', desc: 'Custom buyer type' }
];

const LEAD_TYPES = [
  { value: 'distressed_seller', label: '🏚️ Distressed Seller' },
  { value: 'excess_funds', label: '💰 Excess Funds' },
  { value: 'skip_trace', label: '🔍 Skip Trace' },
  { value: 'mass_tort', label: '⚖️ Mass Tort' },
  { value: 'unclaimed_property', label: '🏛️ Unclaimed Property' },
  { value: 'wholesale', label: '🏠 Wholesale' }
];

export default function BuyersDashboard() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBuyer, setNewBuyer] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    buyer_type: '',
    lead_types: [] as string[],
    max_price_per_lead: '',
    monthly_budget: '',
    notes: ''
  });

  useEffect(() => {
    fetchBuyers();
  }, []);

  const fetchBuyers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/buyers');
      const data = await res.json();
      setBuyers(Array.isArray(data) ? data : data.buyers || []);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBuyer = async () => {
    if (!newBuyer.name || !newBuyer.email) {
      alert('Name and email are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBuyer,
          max_price_per_lead: newBuyer.max_price_per_lead ? parseFloat(newBuyer.max_price_per_lead) : null,
          monthly_budget: newBuyer.monthly_budget ? parseFloat(newBuyer.monthly_budget) : null
        })
      });

      if (res.ok) {
        setShowAdd(false);
        setNewBuyer({
          name: '', email: '', phone: '', company_name: '', buyer_type: '',
          lead_types: [], max_price_per_lead: '', monthly_budget: '', notes: ''
        });
        fetchBuyers();
      }
    } catch (error) {
      console.error('Failed to add buyer:', error);
      alert('Failed to add buyer');
    } finally {
      setSaving(false);
    }
  };

  const toggleLeadType = (type: string) => {
    setNewBuyer(prev => ({
      ...prev,
      lead_types: prev.lead_types.includes(type)
        ? prev.lead_types.filter(t => t !== type)
        : [...prev.lead_types, type]
    }));
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  const totalSpend = buyers.reduce((sum, b) => sum + (b.lifetime_spend || 0), 0);
  const totalLeads = buyers.reduce((sum, b) => sum + (b.leads_purchased || 0), 0);
  const activeBuyers = buyers.filter(b => b.is_active).length;

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-zinc-400">Loading buyers...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">👥</span> Buyer Network
          </h1>
          <p className="text-zinc-400">People who buy your leads</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>+ Add Buyer</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Buyer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
              <Input 
                placeholder="Name *" 
                value={newBuyer.name} 
                onChange={(e) => setNewBuyer({...newBuyer, name: e.target.value})} 
              />
              <Input 
                placeholder="Email *" 
                type="email"
                value={newBuyer.email} 
                onChange={(e) => setNewBuyer({...newBuyer, email: e.target.value})} 
              />
              <Input 
                placeholder="Phone" 
                value={newBuyer.phone} 
                onChange={(e) => setNewBuyer({...newBuyer, phone: e.target.value})} 
              />
              <Input 
                placeholder="Company Name" 
                value={newBuyer.company_name} 
                onChange={(e) => setNewBuyer({...newBuyer, company_name: e.target.value})} 
              />
              
              <Select 
                value={newBuyer.buyer_type} 
                onValueChange={(v) => setNewBuyer({...newBuyer, buyer_type: v})}
              >
                <SelectTrigger><SelectValue placeholder="Buyer Type" /></SelectTrigger>
                <SelectContent>
                  {BUYER_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Lead Types Interested In:</label>
                <div className="flex flex-wrap gap-2">
                  {LEAD_TYPES.map(type => (
                    <Badge
                      key={type.value}
                      variant={newBuyer.lead_types.includes(type.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleLeadType(type.value)}
                    >
                      {type.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  placeholder="Max Price/Lead ($)" 
                  type="number"
                  value={newBuyer.max_price_per_lead} 
                  onChange={(e) => setNewBuyer({...newBuyer, max_price_per_lead: e.target.value})} 
                />
                <Input 
                  placeholder="Monthly Budget ($)" 
                  type="number"
                  value={newBuyer.monthly_budget} 
                  onChange={(e) => setNewBuyer({...newBuyer, monthly_budget: e.target.value})} 
                />
              </div>

              <textarea
                placeholder="Notes (how you met, preferences, etc.)"
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm resize-none"
                rows={3}
                value={newBuyer.notes}
                onChange={(e) => setNewBuyer({...newBuyer, notes: e.target.value})}
              />

              <Button 
                className="w-full" 
                onClick={handleAddBuyer}
                disabled={saving}
              >
                {saving ? 'Adding...' : 'Add Buyer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Buyers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{buyers.length}</div>
            <div className="text-xs text-green-400">{activeBuyers} active</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Lifetime Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{formatCurrency(totalSpend)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Leads Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Avg per Buyer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">
              {formatCurrency(buyers.length > 0 ? totalSpend / buyers.length : 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* No Buyers State */}
      {buyers.length === 0 && (
        <Card className="bg-blue-900/20 border-blue-700">
          <CardHeader>
            <CardTitle>🎯 Where to Find Buyers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BUYER_TYPES.slice(0, 6).map(t => (
                <div key={t.value} className="p-4 bg-zinc-800/50 rounded-lg">
                  <div className="text-xl mb-1">{t.label.split(' ')[0]}</div>
                  <div className="font-medium">{t.label.slice(3)}</div>
                  <div className="text-sm text-zinc-400">{t.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-zinc-800 rounded-lg">
              <h4 className="font-semibold mb-2">💡 Pro Tips for Finding Buyers:</h4>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>• Join local REI Facebook groups and network</li>
                <li>• BiggerPockets marketplace and forums</li>
                <li>• Attend local real estate meetups</li>
                <li>• Your existing deals - buyers become repeat customers</li>
                <li>• Law firm directories for mass tort</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buyer List */}
      {buyers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Buyers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {buyers.map(buyer => {
                const buyerType = BUYER_TYPES.find(t => t.value === buyer.buyer_type);
                
                return (
                  <div 
                    key={buyer.id}
                    className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">
                        {buyerType?.label.split(' ')[0] || '👤'}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {buyer.name}
                          {!buyer.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {buyer.company_name || buyer.email}
                        </div>
                        {buyer.lead_types?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {buyer.lead_types.slice(0, 3).map(type => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {LEAD_TYPES.find(t => t.value === type)?.label.slice(3) || type}
                              </Badge>
                            ))}
                            {buyer.lead_types.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{buyer.lead_types.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-xl font-bold">{buyer.leads_purchased || 0}</div>
                        <div className="text-xs text-zinc-500">leads</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-400">
                          {formatCurrency(buyer.lifetime_spend)}
                        </div>
                        <div className="text-xs text-zinc-500">spent</div>
                      </div>
                      {buyer.reliability_score !== null && (
                        <div className="text-center">
                          <div className="text-xl font-bold text-amber-400">
                            {buyer.reliability_score}
                          </div>
                          <div className="text-xs text-zinc-500">score</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
