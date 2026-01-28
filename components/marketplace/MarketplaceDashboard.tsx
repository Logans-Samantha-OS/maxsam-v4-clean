'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InventoryItem {
  id: string;
  lead_id: string;
  lead_type: string;
  asking_price: number;
  quality_score: number | null;
  status: string;
  listed_at: string;
  lead?: {
    id: string;
    owner_name: string;
    city: string | null;
    county: string | null;
    excess_funds_amount: number | null;
  };
}

interface Buyer {
  id: string;
  name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  lead_types: string[];
  lifetime_spend: number;
  leads_purchased: number;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  distressed_seller: { label: 'Distressed Seller', icon: '🏚️', color: 'bg-orange-600' },
  excess_funds: { label: 'Excess Funds', icon: '💰', color: 'bg-green-600' },
  skip_trace: { label: 'Skip Trace', icon: '🔍', color: 'bg-blue-600' },
  mass_tort: { label: 'Mass Tort', icon: '⚖️', color: 'bg-purple-600' },
  unclaimed_property: { label: 'Unclaimed Property', icon: '🏛️', color: 'bg-cyan-600' },
  death_benefit: { label: 'Death Benefit', icon: '📜', color: 'bg-pink-600' },
  wholesale: { label: 'Wholesale', icon: '🏠', color: 'bg-yellow-600' }
};

export default function MarketplaceDashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [blasting, setBlasting] = useState<string | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellItem, setSellItem] = useState<InventoryItem | null>(null);
  const [selectedBuyer, setSelectedBuyer] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, buyerRes] = await Promise.all([
        fetch('/api/marketplace/inventory'),
        fetch('/api/buyers')
      ]);
      const invData = await invRes.json();
      const buyerData = await buyerRes.json();
      setInventory(invData.inventory || []);
      setSummary(invData.summary || {});
      setBuyers(buyerData.buyers || buyerData || []);
    } catch (error) {
      console.error('Failed to fetch marketplace data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlast = async (leadType: string) => {
    if (buyers.length === 0) {
      alert('Add buyers first before blasting!');
      return;
    }
    
    setBlasting(leadType);
    try {
      const res = await fetch('/api/marketplace/blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_type: leadType })
      });
      const data = await res.json();
      alert(`Notified ${data.notified || 0} buyers about ${TYPE_CONFIG[leadType]?.label || leadType} leads!`);
    } catch (error) {
      console.error('Blast failed:', error);
      alert('Failed to send blast');
    } finally {
      setBlasting(null);
    }
  };

  const handleSell = async () => {
    if (!sellItem || !selectedBuyer) return;
    
    try {
      const res = await fetch('/api/marketplace/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_id: sellItem.id,
          buyer_id: selectedBuyer,
          sale_price: sellItem.asking_price
        })
      });
      
      if (res.ok) {
        setShowSellModal(false);
        setSellItem(null);
        setSelectedBuyer('');
        fetchData();
        alert('Sale recorded successfully!');
      }
    } catch (error) {
      console.error('Sale failed:', error);
      alert('Failed to record sale');
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  const filteredInventory = selectedType 
    ? inventory.filter(i => i.lead_type === selectedType)
    : inventory;

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-zinc-400">Loading marketplace...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">🏪</span> Lead Marketplace
          </h1>
          <p className="text-zinc-400">Your inventory ready to sell</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-green-400">
            {formatCurrency(summary.totalValue || 0)}
          </div>
          <div className="text-sm text-zinc-400">{summary.total || 0} leads listed</div>
        </div>
      </div>

      {/* Buyer Status Banner */}
      {buyers.length === 0 ? (
        <Card className="bg-yellow-900/30 border-yellow-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">👥</div>
              <div className="flex-1">
                <h3 className="font-bold text-yellow-400">No Buyers Yet</h3>
                <p className="text-zinc-300 text-sm">
                  Add your first buyer to start selling leads. Find them through deals, 
                  Facebook groups, BiggerPockets, or local REI meetups.
                </p>
              </div>
              <Button onClick={() => window.location.href = '/buyers'}>
                + Add Buyer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-green-900/30 border-green-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">✅</div>
                <div>
                  <h3 className="font-bold text-green-400">{buyers.length} Buyers Ready</h3>
                  <p className="text-zinc-300 text-sm">You can blast leads to your buyer network</p>
                </div>
              </div>
              <Button 
                onClick={() => handleBlast('excess_funds')}
                disabled={blasting !== null}
              >
                {blasting ? '📤 Sending...' : '📢 Blast All Buyers'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Type Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(TYPE_CONFIG).map(([type, config]) => {
          const typeData = summary.by_type?.[type] || { count: 0, value: 0 };
          const isSelected = selectedType === type;
          
          return (
            <Card 
              key={type}
              className={`cursor-pointer transition-all hover:scale-105 ${
                isSelected ? 'ring-2 ring-green-500' : ''
              } ${typeData.count === 0 ? 'opacity-50' : ''}`}
              onClick={() => setSelectedType(isSelected ? null : type)}
            >
              <CardContent className="p-3 text-center">
                <div className="text-xl mb-1">{config.icon}</div>
                <div className="text-xl font-bold">{typeData.count}</div>
                <div className="text-xs text-zinc-400 truncate">{config.label}</div>
                <div className="text-xs text-green-400">{formatCurrency(typeData.value)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {inventory.length === 0 && (
        <Card className="bg-zinc-800/50">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-semibold mb-2">No Leads Listed Yet</h3>
            <p className="text-zinc-400 max-w-md mx-auto">
              List leads for sale to populate your marketplace. Use the "List for Sale" 
              button on any lead card to add it here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Inventory List */}
      {filteredInventory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {selectedType ? TYPE_CONFIG[selectedType]?.label : 'All'} Inventory
                <Badge variant="outline" className="ml-2">{filteredInventory.length}</Badge>
              </span>
              <div className="flex gap-2">
                {selectedType && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                    Show All
                  </Button>
                )}
                {selectedType && buyers.length > 0 && (
                  <Button 
                    size="sm" 
                    onClick={() => handleBlast(selectedType)}
                    disabled={blasting !== null}
                  >
                    {blasting === selectedType ? '📤 Sending...' : `📢 Blast ${TYPE_CONFIG[selectedType]?.label}`}
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredInventory.map((item) => {
                const config = TYPE_CONFIG[item.lead_type] || { label: item.lead_type, icon: '📋', color: 'bg-gray-600' };
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
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-green-400 font-semibold text-lg">
                          {formatCurrency(item.asking_price)}
                        </div>
                        {item.quality_score && (
                          <div className="text-xs text-zinc-500">
                            Score: {item.quality_score}
                          </div>
                        )}
                      </div>
                      
                      <Badge className={config.color}>{config.label}</Badge>
                      
                      {buyers.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSellItem(item);
                            setShowSellModal(true);
                          }}
                        >
                          💸 Sell
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sell Modal */}
      <Dialog open={showSellModal} onOpenChange={setShowSellModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sell Lead</DialogTitle>
          </DialogHeader>
          {sellItem && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="font-medium">{sellItem.lead?.owner_name}</div>
                <div className="text-sm text-zinc-400">
                  {sellItem.lead?.city}, {sellItem.lead?.county}
                </div>
                <div className="text-xl text-green-400 font-bold mt-2">
                  {formatCurrency(sellItem.asking_price)}
                </div>
              </div>
              
              <Select value={selectedBuyer} onValueChange={setSelectedBuyer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Buyer" />
                </SelectTrigger>
                <SelectContent>
                  {buyers.map(buyer => (
                    <SelectItem key={buyer.id} value={buyer.id}>
                      {buyer.name} {buyer.company_name ? `(${buyer.company_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                className="w-full" 
                onClick={handleSell}
                disabled={!selectedBuyer}
              >
                Complete Sale
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revenue Info */}
      <Card className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700">
        <CardHeader>
          <CardTitle className="text-lg">💵 Pricing Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            {Object.entries(TYPE_CONFIG).slice(0, 4).map(([type, config]) => (
              <div key={type} className="text-center">
                <div className="text-2xl">{config.icon}</div>
                <div className="font-medium">{config.label}</div>
                <div className="text-green-400">
                  ${type === 'mass_tort' ? '150-300' : type === 'skip_trace' ? '15-35' : '40-100'}/lead
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
