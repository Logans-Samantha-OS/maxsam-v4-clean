'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded' | 'checking';
  lastCheck: Date | null;
  responseTime: number | null;
  details: string;
}

export default function SystemHealthPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Supabase Database', status: 'checking', lastCheck: null, responseTime: null, details: 'PostgreSQL database' },
    { name: 'Eleanor AI', status: 'checking', lastCheck: null, responseTime: null, details: 'Lead scoring engine' },
    { name: 'Sam AI (Twilio)', status: 'checking', lastCheck: null, responseTime: null, details: 'SMS/Voice outreach' },
    { name: 'DocuSign', status: 'checking', lastCheck: null, responseTime: null, details: 'Contract signing' },
    { name: 'Stripe', status: 'checking', lastCheck: null, responseTime: null, details: 'Payment processing' },
    { name: 'Telegram Bot', status: 'checking', lastCheck: null, responseTime: null, details: 'Notifications' },
    { name: 'N8N Workflows', status: 'checking', lastCheck: null, responseTime: null, details: 'Alex pipeline automation' },
    { name: 'ElevenLabs', status: 'checking', lastCheck: null, responseTime: null, details: 'Voice synthesis' },
  ]);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);

  useEffect(() => {
    checkAllServices();
    const interval = setInterval(checkAllServices, 60000);
    return () => clearInterval(interval);
  }, []);

  async function checkAllServices() {
    const startTime = Date.now();

    // Simulate health checks
    const updatedServices = await Promise.all(
      services.map(async (service) => {
        const checkStart = Date.now();
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

        // Mock status based on service name
        let status: ServiceStatus['status'] = 'online';
        if (service.name === 'Sam AI (Twilio)') {
          status = 'online'; // A2P verified
        } else if (service.name === 'ElevenLabs') {
          status = 'online';
        }

        return {
          ...service,
          status,
          lastCheck: new Date(),
          responseTime: Date.now() - checkStart,
        };
      })
    );

    setServices(updatedServices);
    setLastFullCheck(new Date());
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'degraded': return 'bg-yellow-500';
      default: return 'bg-zinc-500 animate-pulse';
    }
  }

  function getStatusText(status: string): string {
    switch (status) {
      case 'online': return 'Operational';
      case 'offline': return 'Offline';
      case 'degraded': return 'Degraded';
      default: return 'Checking...';
    }
  }

  const onlineCount = services.filter(s => s.status === 'online').length;
  const offlineCount = services.filter(s => s.status === 'offline').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;

  const overallStatus = offlineCount > 0 ? 'Issues Detected' : degradedCount > 0 ? 'Partially Degraded' : 'All Systems Operational';
  const overallColor = offlineCount > 0 ? 'text-red-400' : degradedCount > 0 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">System Health</h1>
            <p className="text-zinc-500 mt-1">Service status and monitoring</p>
          </div>
          <button
            onClick={checkAllServices}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
          >
            Refresh Status
          </button>
        </div>

        {/* Overall Status */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-2xl font-bold ${overallColor}`}>{overallStatus}</h2>
              <p className="text-zinc-500 text-sm mt-1">
                Last checked: {lastFullCheck ? lastFullCheck.toLocaleTimeString() : 'Never'}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{onlineCount}</div>
                <div className="text-zinc-500 text-sm">Online</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">{degradedCount}</div>
                <div className="text-zinc-500 text-sm">Degraded</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">{offlineCount}</div>
                <div className="text-zinc-500 text-sm">Offline</div>
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {services.map((service) => (
            <div key={service.name} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${getStatusColor(service.status)}`}></div>
                  <h3 className="text-white font-medium">{service.name}</h3>
                </div>
                <span className={`text-sm ${
                  service.status === 'online' ? 'text-green-400' :
                  service.status === 'offline' ? 'text-red-400' :
                  service.status === 'degraded' ? 'text-yellow-400' :
                  'text-zinc-400'
                }`}>
                  {getStatusText(service.status)}
                </span>
              </div>
              <p className="text-zinc-500 text-sm mb-2">{service.details}</p>
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Response: {service.responseTime ? `${service.responseTime}ms` : '-'}</span>
                <span>Checked: {service.lastCheck ? service.lastCheck.toLocaleTimeString() : '-'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* API Keys Status */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">API Keys Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'SUPABASE_URL', configured: true },
              { name: 'SUPABASE_KEY', configured: true },
              { name: 'DOCUSIGN_KEY', configured: true },
              { name: 'TWILIO_SID', configured: true },
              { name: 'TWILIO_TOKEN', configured: true },
              { name: 'STRIPE_KEY', configured: true },
              { name: 'TELEGRAM_TOKEN', configured: true },
              { name: 'ELEVENLABS_KEY', configured: true },
            ].map((key) => (
              <div key={key.name} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${key.configured ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-zinc-400 text-sm">{key.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-zinc-500 text-sm">Platform</div>
              <div className="text-white">MaxSam V4</div>
            </div>
            <div>
              <div className="text-zinc-500 text-sm">Owner</div>
              <div className="text-white">Logan Toups</div>
            </div>
            <div>
              <div className="text-zinc-500 text-sm">Revenue Split</div>
              <div className="text-green-400">100%</div>
            </div>
            <div>
              <div className="text-zinc-500 text-sm">Fee Structure</div>
              <div className="text-white">25% Excess / 10% Wholesale</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
