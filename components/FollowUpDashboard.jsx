'use client';
import { useState, useEffect } from 'react';

export default function FollowUpDashboard() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFollowUps();
  }, []);

  const loadFollowUps = async () => {
    try {
      const response = await fetch('/api/followups?action=check');
      const data = await response.json();
      setFollowUps(data.actions || []);
    } catch (error) {
      console.error('Failed to load follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendNotifications = async () => {
    try {
      await fetch('/api/followups?action=notify');
      alert('Follow-up notifications sent!');
    } catch (error) {
      alert('Failed to send notifications');
    }
  };

  const priorityColors = {
    high: 'border-red-500 bg-red-500/10',
    medium: 'border-yellow-500 bg-yellow-500/10',
    low: 'border-green-500 bg-green-500/10',
  };

  if (loading) {
    return <div className="text-zinc-400">Loading follow-ups...</div>;
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">📅 Today's Follow-Ups</h2>
        <button
          onClick={sendNotifications}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm transition-colors"
        >
          📱 Send Notifications
        </button>
      </div>

      {followUps.length === 0 ? (
        <div className="text-center py-8 text-zinc-400">
          ✅ No follow-ups due today!
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map((item, idx) => (
            <div
              key={idx}
              className={`border-2 rounded-lg p-4 ${priorityColors[item.priority]}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white font-semibold">{item.lead.owner_name}</div>
                  <div className="text-sm text-zinc-400">{item.lead.property_address}</div>
                  <div className="text-sm text-zinc-300 mt-2">
                    <span className="font-medium">Action:</span>{' '}
                    {item.action.replace('-', ' ')}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{item.reason}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase font-semibold text-zinc-400">
                    {item.priority}
                  </div>
                  {item.lead.phone && (
                    <div className="text-sm text-cyan-400 mt-1">
                      {item.lead.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
