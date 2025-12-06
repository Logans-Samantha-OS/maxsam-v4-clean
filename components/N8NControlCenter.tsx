'use client';

import { useState } from 'react';

interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'paused' | 'error';
  lastRun?: string;
  stats?: { label: string; value: string }[];
  parameters: WorkflowParameter[];
}

interface WorkflowParameter {
  id: string;
  label: string;
  type: 'toggle' | 'select' | 'number' | 'slider' | 'text' | 'time';
  value: string | number | boolean;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
}

const WORKFLOWS: WorkflowConfig[] = [
  {
    id: 'lead-import',
    name: 'Lead Import',
    description: 'Auto-import leads from Dallas County',
    icon: '📥',
    status: 'active',
    lastRun: '2 hours ago',
    stats: [
      { label: 'Imported Today', value: '47' },
      { label: 'Total Leads', value: '1,234' },
    ],
    parameters: [
      {
        id: 'source-url',
        label: 'Source URL',
        type: 'text',
        value: 'https://dallas.county.gov/excess-funds',
      },
      {
        id: 'schedule',
        label: 'Schedule',
        type: 'select',
        value: 'daily',
        options: [
          { label: 'Every Hour', value: 'hourly' },
          { label: 'Every 6 Hours', value: '6hours' },
          { label: 'Daily', value: 'daily' },
          { label: 'Weekly', value: 'weekly' },
        ],
      },
      {
        id: 'auto-score',
        label: 'Auto-score with Eleanor',
        type: 'toggle',
        value: true,
      },
    ],
  },
  {
    id: 'eleanor-ai',
    name: 'Eleanor AI',
    description: 'Lead scoring and prioritization',
    icon: '🧠',
    status: 'active',
    lastRun: '5 mins ago',
    stats: [
      { label: 'Scored Today', value: '89' },
      { label: 'Avg Score', value: '72' },
    ],
    parameters: [
      {
        id: 'model',
        label: 'AI Model',
        type: 'select',
        value: 'gpt-4',
        options: [
          { label: 'GPT-4 (Best)', value: 'gpt-4' },
          { label: 'GPT-3.5 (Fast)', value: 'gpt-3.5' },
          { label: 'Claude (Anthropic)', value: 'claude' },
        ],
      },
      {
        id: 'min-score',
        label: 'Min Score Threshold',
        type: 'slider',
        value: 60,
        min: 0,
        max: 100,
      },
      {
        id: 'auto-flag-hot',
        label: 'Auto-flag Hot Leads',
        type: 'toggle',
        value: true,
      },
      {
        id: 'hot-threshold',
        label: 'Hot Lead Threshold',
        type: 'slider',
        value: 75,
        min: 50,
        max: 95,
      },
    ],
  },
  {
    id: 'sam-outreach',
    name: 'Sam AI Outreach',
    description: 'Automated SMS & call campaigns',
    icon: '📱',
    status: 'active',
    lastRun: '30 mins ago',
    stats: [
      { label: 'SMS Sent Today', value: '156' },
      { label: 'Response Rate', value: '12%' },
    ],
    parameters: [
      {
        id: 'daily-limit',
        label: 'Daily SMS Limit',
        type: 'number',
        value: 200,
        min: 0,
        max: 1000,
      },
      {
        id: 'quiet-start',
        label: 'Quiet Hours Start',
        type: 'time',
        value: '21:00',
      },
      {
        id: 'quiet-end',
        label: 'Quiet Hours End',
        type: 'time',
        value: '09:00',
      },
      {
        id: 'template',
        label: 'Message Template',
        type: 'select',
        value: 'friendly',
        options: [
          { label: 'Friendly', value: 'friendly' },
          { label: 'Professional', value: 'professional' },
          { label: 'Urgent', value: 'urgent' },
          { label: 'Custom', value: 'custom' },
        ],
      },
      {
        id: 'max-attempts',
        label: 'Max Attempts',
        type: 'number',
        value: 5,
        min: 1,
        max: 10,
      },
      {
        id: 'days-between',
        label: 'Days Between Attempts',
        type: 'number',
        value: 3,
        min: 1,
        max: 14,
      },
    ],
  },
  {
    id: 'skip-trace',
    name: 'Skip Tracing',
    description: 'Find missing contact info',
    icon: '🔍',
    status: 'active',
    lastRun: '1 hour ago',
    stats: [
      { label: 'Traced Today', value: '23' },
      { label: 'Success Rate', value: '78%' },
    ],
    parameters: [
      {
        id: 'provider',
        label: 'Provider',
        type: 'select',
        value: 'batchskiptracing',
        options: [
          { label: 'BatchSkipTracing', value: 'batchskiptracing' },
          { label: 'TLO', value: 'tlo' },
          { label: 'Accurint', value: 'accurint' },
        ],
      },
      {
        id: 'auto-trace',
        label: 'Auto-trace New Leads',
        type: 'toggle',
        value: true,
      },
      {
        id: 'daily-limit',
        label: 'Daily Limit',
        type: 'number',
        value: 50,
        min: 0,
        max: 500,
      },
    ],
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Contract generation & signing',
    icon: '📝',
    status: 'active',
    lastRun: '3 hours ago',
    stats: [
      { label: 'Sent This Week', value: '12' },
      { label: 'Signed', value: '8' },
    ],
    parameters: [
      {
        id: 'template',
        label: 'Contract Template',
        type: 'select',
        value: 'dual',
        options: [
          { label: 'Excess Funds Only', value: 'excess' },
          { label: 'Wholesale Only', value: 'wholesale' },
          { label: 'Dual Deal', value: 'dual' },
        ],
      },
      {
        id: 'auto-remind',
        label: 'Auto-send Reminders',
        type: 'toggle',
        value: true,
      },
      {
        id: 'remind-days',
        label: 'Remind After (days)',
        type: 'number',
        value: 3,
        min: 1,
        max: 14,
      },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    description: 'Invoice & payment processing',
    icon: '💳',
    status: 'active',
    lastRun: 'Yesterday',
    stats: [
      { label: 'This Month', value: '$45,000' },
      { label: 'Pending', value: '$12,500' },
    ],
    parameters: [
      {
        id: 'auto-invoice',
        label: 'Auto-invoice on Signing',
        type: 'toggle',
        value: true,
      },
      {
        id: 'payment-terms',
        label: 'Payment Terms (days)',
        type: 'number',
        value: 30,
        min: 7,
        max: 90,
      },
      {
        id: 'auto-remind',
        label: 'Payment Reminders',
        type: 'toggle',
        value: true,
      },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram Alerts',
    description: 'Real-time notifications',
    icon: '📲',
    status: 'active',
    lastRun: 'Just now',
    stats: [
      { label: 'Alerts Today', value: '34' },
    ],
    parameters: [
      {
        id: 'hot-leads',
        label: 'Hot Lead Alerts',
        type: 'toggle',
        value: true,
      },
      {
        id: 'contracts',
        label: 'Contract Updates',
        type: 'toggle',
        value: true,
      },
      {
        id: 'payments',
        label: 'Payment Received',
        type: 'toggle',
        value: true,
      },
      {
        id: 'daily-digest',
        label: 'Daily Digest',
        type: 'toggle',
        value: true,
      },
      {
        id: 'digest-time',
        label: 'Digest Time',
        type: 'time',
        value: '08:00',
      },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs Voice',
    description: 'AI voice calls',
    icon: '🎙️',
    status: 'paused',
    lastRun: '2 days ago',
    stats: [
      { label: 'Calls Made', value: '0' },
    ],
    parameters: [
      {
        id: 'voice',
        label: 'Voice',
        type: 'select',
        value: 'rachel',
        options: [
          { label: 'Rachel (Female)', value: 'rachel' },
          { label: 'Josh (Male)', value: 'josh' },
          { label: 'Sam (Neutral)', value: 'sam' },
        ],
      },
      {
        id: 'speed',
        label: 'Speed',
        type: 'slider',
        value: 1.0,
        min: 0.5,
        max: 2.0,
      },
      {
        id: 'pitch',
        label: 'Pitch',
        type: 'slider',
        value: 1.0,
        min: 0.5,
        max: 1.5,
      },
    ],
  },
];

export default function N8NControlCenter() {
  const [workflows, setWorkflows] = useState(WORKFLOWS);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);

  const toggleWorkflowStatus = (id: string) => {
    setWorkflows(prev =>
      prev.map(w =>
        w.id === id
          ? { ...w, status: w.status === 'active' ? 'paused' : 'active' }
          : w
      )
    );
  };

  const updateParameter = (workflowId: string, paramId: string, value: string | number | boolean) => {
    setWorkflows(prev =>
      prev.map(w =>
        w.id === workflowId
          ? {
              ...w,
              parameters: w.parameters.map(p =>
                p.id === paramId ? { ...p, value } : p
              ),
            }
          : w
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">⚡</span>
            N8N AUTOMATION CENTER
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Control all automated workflows</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-green-400 text-sm">All Systems Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className={`
              bg-zinc-800/50 border rounded-xl overflow-hidden transition-all duration-300
              ${expandedWorkflow === workflow.id ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10' : 'border-zinc-700 hover:border-zinc-600'}
            `}
          >
            {/* Header */}
            <div
              className="p-4 cursor-pointer"
              onClick={() => setExpandedWorkflow(expandedWorkflow === workflow.id ? null : workflow.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{workflow.icon}</span>
                  <span className="text-white font-semibold">{workflow.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(workflow.status)}`}></span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWorkflowStatus(workflow.id);
                    }}
                    className={`
                      px-2 py-0.5 rounded text-xs font-medium transition
                      ${workflow.status === 'active'
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}
                    `}
                  >
                    {workflow.status === 'active' ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
              <p className="text-zinc-500 text-xs">{workflow.description}</p>

              {/* Stats */}
              {workflow.stats && (
                <div className="flex gap-4 mt-3">
                  {workflow.stats.map((stat, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="text-zinc-500">{stat.label}: </span>
                      <span className="text-white font-medium">{stat.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {workflow.lastRun && (
                <p className="text-zinc-600 text-xs mt-2">Last run: {workflow.lastRun}</p>
              )}
            </div>

            {/* Expanded Parameters */}
            {expandedWorkflow === workflow.id && (
              <div className="border-t border-zinc-700 p-4 bg-zinc-900/50">
                <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Parameters</h4>
                <div className="space-y-4">
                  {workflow.parameters.map((param) => (
                    <div key={param.id}>
                      <label className="text-zinc-300 text-sm mb-1 block">{param.label}</label>

                      {param.type === 'toggle' && (
                        <button
                          onClick={() => updateParameter(workflow.id, param.id, !param.value)}
                          className={`
                            w-12 h-6 rounded-full transition-all relative
                            ${param.value ? 'bg-cyan-600' : 'bg-zinc-700'}
                          `}
                        >
                          <span
                            className={`
                              absolute top-1 w-4 h-4 bg-white rounded-full transition-all
                              ${param.value ? 'left-7' : 'left-1'}
                            `}
                          />
                        </button>
                      )}

                      {param.type === 'select' && (
                        <select
                          value={param.value as string}
                          onChange={(e) => updateParameter(workflow.id, param.id, e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          {param.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}

                      {param.type === 'number' && (
                        <input
                          type="number"
                          value={param.value as number}
                          onChange={(e) => updateParameter(workflow.id, param.id, parseInt(e.target.value) || 0)}
                          min={param.min}
                          max={param.max}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      )}

                      {param.type === 'slider' && (
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            value={param.value as number}
                            onChange={(e) => updateParameter(workflow.id, param.id, parseFloat(e.target.value))}
                            min={param.min}
                            max={param.max}
                            step={param.max && param.max <= 2 ? 0.1 : 1}
                            className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                          <span className="text-white text-sm w-10 text-right">{param.value}</span>
                        </div>
                      )}

                      {param.type === 'text' && (
                        <input
                          type="text"
                          value={param.value as string}
                          onChange={(e) => updateParameter(workflow.id, param.id, e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      )}

                      {param.type === 'time' && (
                        <input
                          type="time"
                          value={param.value as string}
                          onChange={(e) => updateParameter(workflow.id, param.id, e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-700">
                  <button className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition">
                    Run Now
                  </button>
                  <button className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition">
                    View Logs
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
