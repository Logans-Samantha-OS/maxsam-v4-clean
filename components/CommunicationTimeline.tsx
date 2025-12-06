'use client';

import { GemBadgeInline } from './GemBadge';

interface TimelineEvent {
  id: string;
  type: 'imported' | 'scored' | 'skip_traced' | 'sms_sent' | 'sms_received' | 'call_made' | 'call_received' | 'contract_created' | 'contract_signed' | 'payment_received' | 'note';
  timestamp: string;
  title: string;
  description?: string;
  metadata?: {
    score?: number;
    grade?: string;
    reasoning?: string[];
    from?: string;
    to?: string;
    message?: string;
    duration?: string;
    amount?: number;
    by?: string;
  };
}

interface CommunicationTimelineProps {
  events: TimelineEvent[];
  leadName?: string;
}

const EVENT_CONFIG = {
  imported: {
    icon: '📥',
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    label: 'Lead Imported',
  },
  scored: {
    icon: '🧠',
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    label: 'Eleanor Scored',
  },
  skip_traced: {
    icon: '🔍',
    color: 'bg-cyan-500',
    borderColor: 'border-cyan-500',
    label: 'Skip Traced',
  },
  sms_sent: {
    icon: '📤',
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    label: 'SMS Sent',
  },
  sms_received: {
    icon: '📥',
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    label: 'SMS Received',
  },
  call_made: {
    icon: '📞',
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    label: 'Call Made',
  },
  call_received: {
    icon: '📲',
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    label: 'Call Received',
  },
  contract_created: {
    icon: '📄',
    color: 'bg-indigo-500',
    borderColor: 'border-indigo-500',
    label: 'Contract Created',
  },
  contract_signed: {
    icon: '✍️',
    color: 'bg-pink-500',
    borderColor: 'border-pink-500',
    label: 'Contract Signed',
  },
  payment_received: {
    icon: '💰',
    color: 'bg-yellow-400',
    borderColor: 'border-yellow-400',
    label: 'Payment Received',
  },
  note: {
    icon: '📝',
    color: 'bg-zinc-500',
    borderColor: 'border-zinc-500',
    label: 'Note Added',
  },
};

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function CommunicationTimeline({ events, leadName }: CommunicationTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📜</span> Communication Timeline
        </h3>
        <p className="text-zinc-500 text-center py-8">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>📜</span> Communication Timeline
        {leadName && <span className="text-zinc-400 text-sm font-normal">- {leadName}</span>}
      </h3>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-zinc-800" />

        {/* Events */}
        <div className="space-y-4">
          {events.map((event, index) => {
            const config = EVENT_CONFIG[event.type];

            return (
              <div key={event.id || index} className="relative flex gap-4">
                {/* Icon */}
                <div
                  className={`
                    relative z-10 w-12 h-12 rounded-full flex items-center justify-center
                    ${config.color}/20 border-2 ${config.borderColor}/50
                    transition-all hover:scale-110
                  `}
                >
                  <span className="text-xl">{config.icon}</span>
                </div>

                {/* Content */}
                <div className="flex-1 bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4 hover:border-zinc-600 transition">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <span className="text-white font-medium">{event.title || config.label}</span>
                      {event.metadata?.by && (
                        <span className="text-zinc-500 text-sm ml-2">by {event.metadata.by}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-500 text-xs">{formatDate(event.timestamp)}</span>
                      <br />
                      <span className="text-zinc-600 text-xs">{formatTime(event.timestamp)}</span>
                    </div>
                  </div>

                  {event.description && (
                    <p className="text-zinc-400 text-sm mt-1">{event.description}</p>
                  )}

                  {/* Type-specific content */}
                  {event.type === 'scored' && event.metadata?.grade && (
                    <div className="mt-3 p-3 bg-zinc-900/50 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <GemBadgeInline
                          grade={event.metadata.grade}
                          score={event.metadata.score}
                        />
                        <span className="text-white">Score: {event.metadata.score}/100</span>
                      </div>
                      {event.metadata.reasoning && event.metadata.reasoning.length > 0 && (
                        <div className="text-xs text-zinc-500 space-y-1">
                          {event.metadata.reasoning.slice(0, 3).map((r, i) => (
                            <p key={i}>• {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(event.type === 'sms_sent' || event.type === 'sms_received') && event.metadata?.message && (
                    <div className={`
                      mt-3 p-3 rounded-lg max-w-md
                      ${event.type === 'sms_sent' ? 'bg-cyan-500/10 border border-cyan-500/30 ml-auto' : 'bg-zinc-700/50'}
                    `}>
                      <p className="text-zinc-300 text-sm">{event.metadata.message}</p>
                    </div>
                  )}

                  {(event.type === 'call_made' || event.type === 'call_received') && (
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      {event.metadata?.duration && (
                        <span className="text-zinc-400">
                          <span className="text-zinc-500">Duration:</span> {event.metadata.duration}
                        </span>
                      )}
                      {event.metadata?.to && (
                        <span className="text-zinc-400">
                          <span className="text-zinc-500">To:</span> {event.metadata.to}
                        </span>
                      )}
                    </div>
                  )}

                  {event.type === 'payment_received' && event.metadata?.amount && (
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-yellow-400">
                        ${event.metadata.amount.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {event.type === 'skip_traced' && event.metadata && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {event.metadata.to && (
                        <div>
                          <span className="text-zinc-500">Phone: </span>
                          <span className="text-cyan-400">{event.metadata.to}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Demo timeline for testing
export function DemoTimeline() {
  const demoEvents: TimelineEvent[] = [
    {
      id: '1',
      type: 'imported',
      timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
      title: 'Lead Imported',
      description: 'Imported from Dallas County PDF',
      metadata: { by: 'System' },
    },
    {
      id: '2',
      type: 'scored',
      timestamp: new Date(Date.now() - 7 * 86400000 + 300000).toISOString(),
      title: 'Eleanor AI Scored',
      metadata: {
        score: 87,
        grade: 'A',
        reasoning: [
          'Excellent excess funds: $45,000 (+40)',
          'Strong wholesale potential: $120,000 equity (+20)',
          'Phone number available (+10)',
          'Premium Dallas location: 75201 (+10)',
        ],
      },
    },
    {
      id: '3',
      type: 'skip_traced',
      timestamp: new Date(Date.now() - 6 * 86400000).toISOString(),
      title: 'Skip Trace Complete',
      description: 'Found 2 phone numbers',
      metadata: { to: '214-555-0123' },
    },
    {
      id: '4',
      type: 'sms_sent',
      timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
      title: 'Initial Outreach',
      metadata: {
        message: 'Hi Sarah, this is Logan. I noticed you may have unclaimed funds from a property sale. Would you like to learn more about recovering this money?',
        by: 'Sam AI',
      },
    },
    {
      id: '5',
      type: 'sms_received',
      timestamp: new Date(Date.now() - 4 * 86400000).toISOString(),
      title: 'Response Received',
      metadata: {
        message: 'Hi Logan, yes I would like to know more. What do I need to do?',
      },
    },
    {
      id: '6',
      type: 'call_made',
      timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
      title: 'Discovery Call',
      description: 'Discussed deal terms and next steps',
      metadata: {
        duration: '12:34',
        to: '214-555-0123',
        by: 'Logan',
      },
    },
    {
      id: '7',
      type: 'contract_created',
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
      title: 'Contract Sent',
      description: 'Dual deal contract sent via DocuSign',
      metadata: { by: 'System' },
    },
    {
      id: '8',
      type: 'contract_signed',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      title: 'Contract Signed!',
      description: 'All parties have signed the agreement',
    },
    {
      id: '9',
      type: 'payment_received',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      title: 'Payment Received!',
      description: 'Deal closed successfully',
      metadata: { amount: 23250 },
    },
  ];

  return <CommunicationTimeline events={demoEvents} leadName="Martinez, Sarah L." />;
}
