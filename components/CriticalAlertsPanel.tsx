'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Alert {
  id: string;
  type: 'expiring' | 'hot_response' | 'stale_contract';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  time: string;
  lead_id?: string;
}

export default function CriticalAlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchAlerts() {
      try {
        // Get expiring leads
        const { data: expiringLeads } = await supabase
          .from('leads')
          .select('*')
          .lt('expiration_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
          .eq('status', 'new')
          .order('expiration_date', { ascending: true })
          .limit(5);

        const alertsData: Alert[] = [
          ...expiringLeads?.map(lead => ({
            id: lead.id,
            type: 'expiring' as const,
            title: 'Lead Expiring Soon',
            description: `${lead.owner_name} - ${lead.property_address || 'No Address'}`,
            severity: 'high' as const,
            time: new Date(lead.expiration_date || '').toLocaleDateString(),
            lead_id: lead.id
          })) || []
        ];

        setAlerts(alertsData);
      } catch (error) {
        console.error('Error fetching alerts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'expiring': return '⏰';
      case 'hot_response': return '🔥';
      case 'stale_contract': return '📄';
      default: return '⚠️';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'expiring': return 'border-red-500/50 bg-red-500/10';
      case 'hot_response': return 'border-orange-500/50 bg-orange-500/10';
      case 'stale_contract': return 'border-yellow-500/50 bg-yellow-500/10';
      default: return 'border-zinc-500/50 bg-zinc-500/10';
    }
  };

  const handleViewLead = (leadId: string) => {
    router.push(`/sellers?lead=${leadId}`);
  };

  const handleTakeAction = (leadId: string) => {
    // Open action modal or navigate to lead details
    router.push(`/sellers?lead=${leadId}&action=contact`);
  };

  if (loading) {
    return (
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
          <span>🚨</span> Critical Alerts
        </h3>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
          <span>✅</span> Critical Alerts
        </h3>
        <div className="text-center py-8 text-zinc-500">
          <div className="text-4xl mb-2">🎯</div>
          <p>All systems clear - No critical alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pharaoh-card border-2 border-red-500/30 shadow-lg shadow-red-500/20">
      <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2 animate-pulse">
        <span>🚨</span> Critical Alerts ({alerts.length})
      </h3>
      
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {alerts.map((alert) => (
          <div 
            key={alert.id} 
            className={`p-4 rounded-lg border ${getAlertColor(alert.type)} hover:border-opacity-100 transition-all duration-300`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">
                {getActivityIcon(alert.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-semibold text-sm">
                    {alert.title}
                  </h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    alert.severity === 'high' ? 'bg-red-500 text-white' :
                    alert.severity === 'medium' ? 'bg-orange-500 text-white' :
                    'bg-yellow-500 text-white'
                  }`}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
                
                <p className="text-zinc-300 text-sm mb-1">
                  {alert.description}
                </p>
                
                <p className="text-gold font-bold text-sm mb-2">
                  Expires: {alert.time}
                </p>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleViewLead(alert.lead_id || '')}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-medium transition-colors"
                  >
                    View Lead
                  </button>
                  <button 
                    onClick={() => handleTakeAction(alert.lead_id || '')}
                    className="px-3 py-1 bg-gold hover:bg-yellow-600 text-black rounded text-xs font-bold transition-colors"
                  >
                    Take Action
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
