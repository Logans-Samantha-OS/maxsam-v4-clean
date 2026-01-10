import { useRouter } from 'next/navigation';

interface Lead {
  id: string;
  case_number?: string;
  owner_name: string;
  property_address?: string;
  property_city?: string;
  source_county?: string;
  phone_1?: string;
  phone_2?: string;
  excess_amount: number;
  status: 'new' | 'contacted' | 'contract' | 'closed' | 'do_not_contact' | 'opted_out';
  priority: 'low' | 'medium' | 'high' | 'critical';
  expiration_date?: string;
  golden_lead: boolean;
  eleanor_score?: number;
  created_at: string;
  updated_at: string;
  last_contacted_at?: string;
  first_contacted_at?: string;
  contact_count?: number;
}

interface LeadCardProps {
  lead: Lead;
  variant?: 'dashboard' | 'sellers' | 'compact';
  onStatusChange?: (leadId: string, newStatus: string) => void;
  onContact?: (leadId: string) => void;
}

export default function LeadCard({ lead, variant = 'sellers', onStatusChange, onContact }: LeadCardProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'contacted': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'contract': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'closed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const handleCall = () => {
    if (lead.phone_1 || lead.phone_2) {
      const phone = lead.phone_1 || lead.phone_2;
      window.open(`tel:${phone}`);
    } else {
      alert('No phone number available');
    }
  };

  const handleSMS = () => {
    if (lead.phone_1 || lead.phone_2) {
      // Trigger SMS via API
      fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          message: `Hello ${lead.owner_name?.split(' ')[0]}, I found your excess funds claim and wanted to reach out about helping you recover your money.`,
          template: 'initial_outreach'
        })
      }).then(response => {
        if (response.ok) {
          alert('SMS sent successfully!');
          // Update contact count
          if (onContact) onContact(lead.id);
        } else {
          alert('Failed to send SMS');
        }
      }).catch(error => {
        console.error('SMS error:', error);
        alert('Error sending SMS');
      });
    } else {
      alert('No phone number available');
    }
  };

  const handleContract = () => {
    router.push(`/contracts/new?lead_id=${lead.id}`);
  };

  const handleViewLead = () => {
    router.push(`/sellers?lead=${lead.id}`);
  };

  const isCompact = variant === 'compact';
  const isDashboard = variant === 'dashboard';

  return (
    <div className={`pharaoh-card hover:border-gold/50 transition-all duration-300 ${
      lead.golden_lead ? 'ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/20' : ''
    } ${isCompact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className={`text-lg font-bold text-white mb-1 ${isDashboard ? 'text-xl' : ''}`}>
            {lead.property_address || lead.case_number || 'Unknown Property'}
          </h3>
          <div className="flex items-center gap-2">
            {lead.golden_lead && (
              <span className="text-yellow-500 text-xl">⭐</span>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(lead.status)}`}>
              {lead.status || 'New'}
            </span>
          </div>
        </div>
        {!isDashboard && (
          <div className="text-right">
            <span className={`text-xs font-bold ${getPriorityColor(lead.priority)}`}>
              {lead.priority?.toUpperCase() || 'LOW'}
            </span>
          </div>
        )}
      </div>

      {/* Content based on variant */}
      {isDashboard ? (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-zinc-400 text-sm">Excess Amount</span>
            <div className="text-2xl font-bold text-gold">
              {formatCurrency(lead.excess_amount || 0)}
            </div>
          </div>
          <div>
            <span className="text-zinc-400 text-sm">Your Fee (25%)</span>
            <div className="text-2xl font-bold text-green-400">
              {formatCurrency((lead.excess_amount || 0) * 0.25)}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Contact Info */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-sm">Owner</span>
              <span className="text-white font-medium">{lead.owner_name?.split(' ')[0]}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-sm">Location</span>
              <span className="text-white font-medium">
                {lead.property_address || `${lead.source_county}, TX`}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-sm">Phone</span>
              <span className="text-white font-medium">
                {lead.phone_1 || lead.phone_2 || 'No phone'}
              </span>
            </div>
          </div>

          {/* Expiration Badge */}
          {lead.expiration_date && (
            <div className="mb-4">
              <span className="text-zinc-400 text-sm">Expires</span>
              <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                new Date(lead.expiration_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  ? 'bg-red-500 text-white animate-pulse'
                  : new Date(lead.expiration_date) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                  ? 'bg-orange-500 text-white'
                  : 'bg-green-500 text-white'
              }`}>
                {new Date(lead.expiration_date).toLocaleDateString()}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={handleCall}
              className={`px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors ${
                lead.phone_1 || lead.phone_2
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              disabled={!lead.phone_1 && !lead.phone_2}
            >
              📞 Call
            </button>
            <button
              onClick={handleSMS}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              disabled={!lead.phone_1 && !lead.phone_2}
            >
              💬 SMS
            </button>
            <button
              onClick={handleContract}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              📄 Contract
            </button>
          </div>

          {/* Last Contact */}
          <div className="pt-3 border-t border-zinc-800">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-xs">Last Contact</span>
              <span className="text-zinc-400 text-sm">
                {new Date(lead.last_contacted_at || lead.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
