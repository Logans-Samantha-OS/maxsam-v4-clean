'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export default function BlastPage() {
  const params = useParams();
  const dealId = params.id as string;
  
  const [deal, setDeal] = useState<any>(null);
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Fetch deal details
  useEffect(() => {
    fetch(`/api/deals/${dealId}`)
      .then(res => res.json())
      .then(data => setDeal(data))
      .catch(error => console.error('Error fetching deal:', error));
  }, [dealId]);

  // Send blast function
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
      
      // Show success for 5 seconds then redirect
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

  if (!deal) return <div className="p-8">Loading deal...</div>;

  // Calculate numbers for preview
  const arv = deal.arv_estimate || 0;
  const repairs = deal.repair_estimate || 0;
  const excess = deal.excess_funds_amount || 0;
  const mao = (arv * 0.70) - repairs;
  const wholesaleFee = mao * 0.10;
  const excessFee = excess * 0.25;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">📱 Telegram Blast</h1>
        <Button variant="outline" onClick={() => window.history.back()}>
          ← Back
        </Button>
      </div>

      {/* Deal Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Deal Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-lg font-semibold">
            📍 {deal.property_address}
          </div>
          <div className="text-muted-foreground">
            {deal.city}, {deal.state} {deal.zip}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div>
              <div className="text-sm text-muted-foreground">ARV</div>
              <div className="text-xl font-bold">${arv.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Excess Funds</div>
              <div className="text-xl font-bold">${excess.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Eleanor Score</div>
              <div className="text-xl font-bold">{deal.eleanor_score} ({deal.eleanor_grade})</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buyer Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Buyers</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={buyerFilter} onValueChange={setBuyerFilter}>
            <div className="flex items-center space-x-2 mb-3">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="cursor-pointer">
                All Buyers with Telegram (247+)
              </Label>
            </div>
            <div className="flex items-center space-x-2 mb-3">
              <RadioGroupItem value="max" id="max" />
              <Label htmlFor="max" className="cursor-pointer">
                Max's Network Only (~247)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="top10" id="top10" />
              <Label htmlFor="top10" className="cursor-pointer">
                My Top 10 Buyers
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Message Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Message Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm whitespace-pre-line">
            {`🏠 **NEW DEAL ALERT**

📍 ${deal.property_address}
${deal.city}, ${deal.state} ${deal.zip}

💰 **ARV:** $${arv.toLocaleString()}
🔧 **Repairs:** $${repairs.toLocaleString()}
⭐ **Eleanor Score:** ${deal.eleanor_score} (Grade ${deal.eleanor_grade})
${excess > 0 ? `💵 **Excess Funds:** $${excess.toLocaleString()}` : ''}

📊 **Max Offer (MAO):** $${Math.round(mao).toLocaleString()}
🎯 **Your 10% Fee:** $${Math.round(wholesaleFee).toLocaleString()}
${excess > 0 ? `💎 **Bonus Excess Fee:** $${Math.round(excessFee).toLocaleString()}` : ''}

⏰ **First come, first served!**
Reply with your offer or tap the button below 👇`}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            ℹ️ This is what buyers will see in Telegram
          </div>
        </CardContent>
      </Card>

      {/* Send Button */}
      <Card>
        <CardContent className="pt-6">
          <Button 
            onClick={sendBlast} 
            disabled={loading}
            className="w-full h-16 text-lg"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Sending blast...
              </>
            ) : (
              <>
                📱 Send Telegram Blast
              </>
            )}
          </Button>

          {result && (
            <div className={`mt-4 p-4 rounded-lg ${result.success ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
              {result.success ? (
                <>
                  <div className="font-bold">✅ Blast Complete!</div>
                  <div className="text-sm mt-1">
                    Sent to {buyerFilter === 'all' ? '247+' : buyerFilter === 'max' ? '~247' : '10'} buyers
                  </div>
                  <div className="text-xs mt-1">Redirecting to deal page...</div>
                </>
              ) : (
                <>
                  <div className="font-bold">❌ Blast Failed</div>
                  <div className="text-sm">{result.error}</div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
