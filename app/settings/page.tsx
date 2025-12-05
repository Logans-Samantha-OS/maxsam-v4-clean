'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Settings {
  legal_entity_name: string;
  business_address: string;
  signer_title: string;
  excess_funds_fee_percent: string;
  wholesale_fee_percent: string;
  owner_split_percent: string;
  partner_split_percent: string;
  partner_name: string;
  partner_email: string;
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
  const [settings, setSettings] = useState<Settings | null>(null);
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
      const data = await response.json();
      setSettings(data.config);
      setIntegrations(data.integrations);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;

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
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-zinc-500 mt-1">Configure MaxSam V4 system settings</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition"
          >
            ← Back to Dashboard
          </Link>
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
                value={settings?.legal_entity_name || ''}
                onChange={(e) => setSettings(s => s ? { ...s, legal_entity_name: e.target.value } : null)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Business Address</label>
              <input
                type="text"
                value={settings?.business_address || ''}
                onChange={(e) => setSettings(s => s ? { ...s, business_address: e.target.value } : null)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Signer Title</label>
              <input
                type="text"
                value={settings?.signer_title || ''}
                onChange={(e) => setSettings(s => s ? { ...s, signer_title: e.target.value } : null)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </section>

        {/* Fee Configuration */}
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Fee Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Excess Funds Fee %</label>
              <input
                type="number"
                value={settings?.excess_funds_fee_percent || '25'}
                onChange={(e) => setSettings(s => s ? { ...s, excess_funds_fee_percent: e.target.value } : null)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Wholesale Fee %</label>
              <input
                type="number"
                value={settings?.wholesale_fee_percent || '10'}
                onChange={(e) => setSettings(s => s ? { ...s, wholesale_fee_percent: e.target.value } : null)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Owner Split %</label>
              <input
                type="number"
                value={settings?.owner_split_percent || '100'}
                onChange={(e) => setSettings(s => s ? { ...s, owner_split_percent: e.target.value } : null)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Partner Split %</label>
              <input
                type="number"
                value={settings?.partner_split_percent || '0'}
                onChange={(e) => setSettings(s => s ? { ...s, partner_split_percent: e.target.value } : null)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Partner Name (optional)</label>
              <input
                type="text"
                value={settings?.partner_name || ''}
                onChange={(e) => setSettings(s => s ? { ...s, partner_name: e.target.value } : null)}
                placeholder="Leave empty if no partner"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Partner Email (optional)</label>
              <input
                type="email"
                value={settings?.partner_email || ''}
                onChange={(e) => setSettings(s => s ? { ...s, partner_email: e.target.value } : null)}
                placeholder="Leave empty if no partner"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </section>

        {/* Outreach Settings */}
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Outreach Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                <input
                  type="checkbox"
                  checked={settings?.outreach_enabled || false}
                  onChange={(e) => setSettings(s => s ? { ...s, outreach_enabled: e.target.checked } : null)}
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
                value={settings?.max_daily_sms || '100'}
                onChange={(e) => setSettings(s => s ? { ...s, max_daily_sms: e.target.value } : null)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Max Contact Attempts</label>
              <input
                type="number"
                value={settings?.max_contact_attempts || '5'}
                onChange={(e) => setSettings(s => s ? { ...s, max_contact_attempts: e.target.value } : null)}
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
              value={settings?.dallas_county_pdf_url || ''}
              onChange={(e) => setSettings(s => s ? { ...s, dallas_county_pdf_url: e.target.value } : null)}
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
    </div>
  );
}
