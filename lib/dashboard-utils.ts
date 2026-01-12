export interface Lead {
    id: string;
    property_address: string;
    city: string;
    state?: string;
    owner_name: string;
    phone_1: string;
    phone_2: string;
    excess_funds_amount: number;
    eleanor_score: number;
    deal_grade: string;
    contact_priority: string;
    deal_type: string;
    status: string;
    call_attempts: number;
    last_call_date: string | null;
    created_at: string;
    updated_at?: string;
    notes: string;
    potential_revenue?: number;
    estimated_equity?: number;
    days_until_expiration?: number;
    expiration_date?: string;
    is_cross_referenced?: boolean;
    golden_lead?: boolean;
    property_type?: string;
    arv_calculated?: number;
    mao_70?: number;
    mao_75?: number;
    estimated_repairs?: number;
    case_number?: string;
    source_county?: string;
    // SMS fields
    sms_count: number;
    last_contacted_at: string | null;
}

export function formatCurrency(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
}

export function formatPhone(phone: string | null): string {
    if (!phone) return 'No phone';
    // Strip non-digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
}

export function calculateProfit(lead: Lead): number {
    const excess = lead.excess_funds_amount || 0;
    const equity = lead.estimated_equity || (excess * 2);
    const excessFee = excess * 0.25;
    const wholesaleFee = lead.deal_type === 'dual' || lead.deal_type === 'wholesale' ? equity * 0.10 : 0;
    return excessFee + wholesaleFee;
}

export function getRelativeTime(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

export function getEleanorGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
}

export const STATUS_COLORS: Record<string, string> = {
    new: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    contacted: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    qualified: 'text-green-400 bg-green-500/10 border-green-500/20', // "Responded"
    negotiating: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    contract_sent: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    contract_signed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    closed: 'text-gold bg-yellow-600/10 border-gold/20',
    dead: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Responded',
    negotiating: 'Negotiating',
    contract_sent: 'Contract Sent',
    contract_signed: 'Signed',
    closed: 'Closed',
    dead: 'Dead/Opt-out',
};
