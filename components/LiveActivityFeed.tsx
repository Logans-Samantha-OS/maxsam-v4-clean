'use client';

import { useEffect, useState } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtime';

interface ActivityItem {
  id: string;
  event_type: string;
  lead_id?: string;
  description: string;
  created_at: string;
  metadata?: any;
}

export default function LiveActivityFeed() {
  const { data: activities, loading } = useRealtimeTable('activity_log', 'created_at');

  const getActivityIcon = (eventType: string) => {
    switch (eventType) {
      case 'sms_sent': return '📱';
      case 'lead_created': return '🆕';
      case 'contract_sent': return '📄';
      case 'status_change': return '🔄';
      case 'skip_trace': return '🔍';
      case 'eleanor_scored': return '🧠';
      case 'call_made': return '📞';
      case 'contract_viewed': return '👁️';
      case 'contract_signed': return '✅';
      default: return '📊';
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
          <span>🔴</span> Live Activity Feed
        </h3>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pharaoh-card">
      <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
        <span>🔴</span> Live Activity Feed
      </h3>
      
      <div className="space-y-3 max-h-48 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <div className="text-4xl mb-2">📭</div>
            <p>No recent activity</p>
          </div>
        ) : (
          activities.slice(0, 30).map((activity, index) => (
            <div 
              key={activity.id} 
              className="flex items-start gap-3 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-cyan-500/30 transition-all duration-300 animate-in-slide-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="text-2xl flex-shrink-0 mt-1">
                {getActivityIcon(activity.event_type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">
                  {activity.description}
                </p>
                <p className="text-zinc-500 text-xs mt-1">
                  {getRelativeTime(activity.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
