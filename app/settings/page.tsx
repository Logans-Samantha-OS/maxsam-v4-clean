'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

interface Settings {
  legal_entity_name: string;
  business_address: string;
  signer_name: string;
  signer_title: string;
  excess_funds_fee_percent: string;
  wholesale_fee_percent: string;
  dallas_county_pdf_url: string;
  outreach_enabled: boolean;
  max_daily_sms: string;
  max_contact_attempts: string;
}

interface Integration {
  configured: boolean;
  status: string;
  phone?: string;
  account_id?: string;
}

interface Integrations {
  supabase: Integration;
  docusign: Integration;
  twilio: Integration;
  stripe: Integration;
  telegram: Integration;
  skip_tracing: Integration;
  elevenlabs: Integration;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    legal_entity_name: 'Logan Toups LLC',
    business_address: '',
    signer_name: 'Logan Toups',
    signer_title: 'Owner',
    excess_funds_fee_percent: '25',
    wholesale_fee_percent: '10',
    dallas_county_pdf_url: '',
    outreach_enabled: false,
    max_daily_sms: '100',
    max_contact_attempts: '5',
  });
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setSettings(prev => ({ ...prev, ...data.config }));
        }
        setIntegrations(data.integrations);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  async function testTelegram() {
    try {
      const response = await fetch('/api/telegram/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test notification from MaxSam V4 Settings'
        })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Test notification sent!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to send notification' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send notification' });
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'connected':
        return 'text-green-400';
      case 'not_configured':
        return 'text-yellow-400';
      default:
        return 'text-red-400';
    }
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case 'connected':
        return '✓';
      case 'not_configured':
        return '○';
      default:
        return '✗';
    }
  }

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
        <div className="max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-zinc-500 mt-1">Configure MaxSam V4 system settings</p>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {message.text}
            </div>
          )}

          {/* Owner Info Banner */}
          <div className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-cyan-500/20 rounded-full flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Logan Toups</h2>
                <p className="text-cyan-400">Sole Owner - 100% Revenue</p>
                <p className="text-zinc-500 text-sm">All fees and commissions go directly to you</p>
              </div>
            </div>
          </div>

          {/* Integration Status */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Integration Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {integrations && Object.entries(integrations).map(([key, value]) => (
                <div key={key} className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-300 capitalize">{key.replace('_', ' ')}</span>
                    <span className={getStatusColor(value.status)}>
                      {getStatusIcon(value.status)}
                    </span>
                  </div>
                  <div className={`text-sm ${getStatusColor(value.status)}`}>
                    {value.status.replace('_', ' ')}
                  </div>
                  {value.phone && (
                    <div className="text-xs text-zinc-500 mt-1">{value.phone}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Legal Entity */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Legal Entity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Entity Name</label>
                <input
                  type="text"
                  value={settings.legal_entity_name}
                  onChange={(e) => setSettings(s => ({ ...s, legal_entity_name: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Business Address</label>
                <input
                  type="text"
                  value={settings.business_address}
                  onChange={(e) => setSettings(s => ({ ...s, business_address: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Signer Name</label>
                <input
                  type="text"
                  value={settings.signer_name}
                  onChange={(e) => setSettings(s => ({ ...s, signer_name: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Signer Title</label>
                <input
                  type="text"
                  value={settings.signer_title}
                  onChange={(e) => setSettings(s => ({ ...s, signer_title: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </section>

          {/* Fee Configuration */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Fee Configuration</h2>
            <p className="text-zinc-500 text-sm mb-4">Configure your fee percentages for different deal types</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <label className="block text-zinc-300 font-medium mb-2">Excess Funds Fee</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.excess_funds_fee_percent}
                    onChange={(e) => setSettings(s => ({ ...s, excess_funds_fee_percent: e.target.value }))}
                    className="w-24 px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-center focus:ring-2 focus:ring-cyan-500"
                    min="0"
                    max="100"
                  />
                  <span className="text-zinc-400">%</span>
                </div>
                <p className="text-zinc-500 text-xs mt-2">Percentage of excess funds collected</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <label className="block text-zinc-300 font-medium mb-2">Wholesale Fee</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.wholesale_fee_percent}
                    onChange={(e) => setSettings(s => ({ ...s, wholesale_fee_percent: e.target.value }))}
                    className="w-24 px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-center focus:ring-2 focus:ring-cyan-500"
                    min="0"
                    max="100"
                  />
                  <span className="text-zinc-400">%</span>
                </div>
                <p className="text-zinc-500 text-xs mt-2">Percentage of wholesale equity</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-green-400">
                <span>💰</span>
                <span className="font-medium">Revenue Split: 100% to Logan Toups</span>
              </div>
            </div>
          </section>

          {/* Outreach Settings */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Outreach Settings (Sam AI)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-2 text-zinc-400 text-sm mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.outreach_enabled}
                    onChange={(e) => setSettings(s => ({ ...s, outreach_enabled: e.target.checked }))}
                    className="rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Enable Automated Outreach
                </label>
                <p className="text-xs text-zinc-500">Sam AI will automatically contact leads</p>
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Max Daily SMS</label>
                <input
                  type="number"
                  value={settings.max_daily_sms}
                  onChange={(e) => setSettings(s => ({ ...s, max_daily_sms: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Max Contact Attempts</label>
                <input
                  type="number"
                  value={settings.max_contact_attempts}
                  onChange={(e) => setSettings(s => ({ ...s, max_contact_attempts: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </section>

          {/* Data Source */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Data Source</h2>
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Dallas County PDF URL</label>
              <input
                type="url"
                value={settings.dallas_county_pdf_url}
                onChange={(e) => setSettings(s => ({ ...s, dallas_county_pdf_url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-zinc-500 mt-2">URL to the Dallas County excess funds PDF for automated import</p>
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={testTelegram}
              className="px-6 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition"
            >
              Test Telegram
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
