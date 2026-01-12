'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function BlastPage() {
  const params = useParams();
  const dealId = params.id as string;
  
  const [deal, setDeal] = useState<any>(null);
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/deals/${dealId}`)
      .then(res => res.json())
      .then(data => setDeal(data))
      .catch(err => console.error(err));
  }, [dealId]);

  const sendBlast = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('https://skooki.app.n8n.cloud/webhook/telegram-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          buyer_filter: buyerFilter,
          message_override: null
        })
      });
      
      const data = await response.json();
      setResult({ success: true, data });
      
      setTimeout(() => {
        window.location.href = `/deals/${dealId}`;
      }, 5000);
      
    } catch (error) {
      console.error('Blast error:', error);
      setResult({ success: false, error: 'Failed to send blast' });
    } finally {
      setLoading(false);
    }
  };

  if (!deal) {
    return (
      <div className="p-8">
        <div className="text-lg">Loading deal...</div>
      </div>
    );
  }

  const arv = deal.arv_estimate || 0;
  const repairs = deal.repair_estimate || 0;
  const excess = deal.excess_funds_amount || 0;
  const mao = (arv * 0.70) - repairs;
  const wholesaleFee = mao * 0.10;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">📱 Telegram Blast</h1>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            ← Back
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Deal Summary</h2>
          <div className="space-y-2">
            <div className="text-lg font-semibold">
              📍 {deal.property_address}
            </div>
            <div className="text-gray-600">
              {deal.city}, {deal.state} {deal.zip}
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div>
                <div className="text-sm text-gray-600">ARV</div>
                <div className="text-xl font-bold">${arv.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Excess Funds</div>
                <div className="text-xl font-bold">${excess.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Eleanor Score</div>
                <div className="text-xl font-bold">{deal.eleanor_score} ({deal.eleanor_grade})</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Select Buyers</h2>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input 
                type="radio" 
                name="buyers" 
                value="all" 
                checked={buyerFilter === 'all'}
                onChange={(e) => setBuyerFilter(e.target.value)}
                className="w-4 h-4"
              />
              <span>All Buyers with Telegram (247+)</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input 
                type="radio" 
                name="buyers" 
                value="max" 
                checked={buyerFilter === 'max'}
                onChange={(e) => setBuyerFilter(e.target.value)}
                className="w-4 h-4"
              />
              <span>Max Network Only (~247)</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input 
                type="radio" 
                name="buyers" 
                value="top10" 
                checked={buyerFilter === 'top10'}
                onChange={(e) => setBuyerFilter(e.target.value)}
                className="w-4 h-4"
              />
              <span>My Top 10 Buyers</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Message Preview</h2>
          <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm whitespace-pre-line">
{`🏠 NEW DEAL ALERT

📍 ${deal.property_address}
${deal.city}, ${deal.state} ${deal.zip}

💰 ARV: $${arv.toLocaleString()}
🔧 Repairs: $${repairs.toLocaleString()}
⭐ Eleanor Score: ${deal.eleanor_score} (Grade ${deal.eleanor_grade})
${excess > 0 ? `💵 Excess Funds: $${excess.toLocaleString()}` : ''}

📊 Max Offer: $${Math.round(mao).toLocaleString()}
🎯 Your 10% Fee: $${Math.round(wholesaleFee).toLocaleString()}

⏰ First come, first served!`}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <button 
            onClick={sendBlast} 
            disabled={loading}
            className="w-full h-16 text-lg font-bold bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition"
          >
            {loading ? '⏳ Sending blast...' : '📱 Send Telegram Blast'}
          </button>

          {result && (
            <div className={`mt-4 p-4 rounded-lg ${result.success ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
              {result.success ? (
                <>
                  <div className="font-bold">✅ Blast Complete!</div>
                  <div className="text-sm mt-1">Sent to buyers successfully</div>
                </>
              ) : (
                <>
                  <div className="font-bold">❌ Blast Failed</div>
                  <div className="text-sm">{result.error}</div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
```

---

### **6. Save the file:**
- Press: **Ctrl + S**

---

## 📸 **TAKE A SCREENSHOT SHOWING:**

The left sidebar should show:
```
app
  └─ deals
      └─ [id]
          └─ blast          ← NEW FOLDER
              └─ page.tsx   ← NEW FILE