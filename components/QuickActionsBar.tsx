'use client';

import { useState } from 'react';

export default function QuickActionsBar() {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const handleAction = async (action: string, webhook?: string) => {
    setLoading(prev => ({ ...prev, [action]: true }));

    try {
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            timestamp: new Date().toISOString(),
            user: 'Logan Toups'
          })
        });
      }
    } catch (error) {
      console.error(`Error with ${action}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  const actions = [
    {
      id: 'import',
      label: '📥 Import Leads',
      description: 'Import new leads from various sources',
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      id: 'skip-trace',
      label: '🔍 Run Skip Trace',
      description: 'Trace property ownership chains',
      webhook: 'https://skooki.app.n8n.cloud/webhook/skip-trace',
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      id: 'batch-sms',
      label: '📱 Send Batch SMS',
      description: 'Send SMS to multiple leads',
      webhook: 'https://skooki.app.n8n.cloud/webhook/sam-initial-outreach',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'generate-report',
      label: '📊 Generate Report',
      description: 'Generate comprehensive analytics report',
      color: 'from-purple-500 to-purple-600'
    }
  ];

  return (
    <div className="pharaoh-card">
      <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
        <span>⚡</span> Quick Actions
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id, action.webhook)}
            disabled={loading[action.id]}
            className={`
              relative overflow-hidden group
              px-4 py-3 rounded-lg font-bold text-white
              bg-gradient-to-r ${action.color}
              hover:shadow-lg transform transition-all duration-300
              hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed
              ${loading[action.id] ? 'animate-pulse' : ''}
            `}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">{action.label.split(' ')[0]}</span>
              <span className="text-sm">{action.label.split(' ').slice(1).join(' ')}</span>
            </div>
            
            {loading[action.id] && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
              </div>
            )}
            
            <div className="absolute inset-x-0 -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-zinc-900 text-zinc-300 text-xs rounded px-2 py-1 shadow-lg">
                {action.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
