/**
 * ALEX Skip Trace Engine V2 - Deep Profile Builder
 * 
 * Not just finding a phone number - building a COMPLETE PROFILE
 * so Sam can close in 1-2 texts instead of fishing for information.
 * 
 * Data Sources:
 * 1. SerpAPI (Google search)
 * 2. TruePeopleSearch (via Browserless)
 * 3. FastPeopleSearch
 * 4. County property records
 * 5. Whitepages
 * 6. Social media profiles
 * 
 * Output: Everything Sam needs to pre-fill agreements
 */

export interface SkipTraceInput {
  owner_name: string;
  property_address: string;
  property_city?: string;
  property_zip?: string;
  county?: string;
  excess_amount?: number;
  case_number?: string;
}

export interface PhoneResult {
  number: string;
  type: 'mobile' | 'landline' | 'voip' | 'unknown';
  carrier?: string;
  verified: boolean;
  source: string;
}

export interface EmailResult {
  address: string;
  type: 'personal' | 'work' | 'unknown';
  verified: boolean;
  source: string;
}

export interface AddressResult {
  street: string;
  city: string;
  state: string;
  zip: string;
  type: 'current' | 'previous' | 'property';
  is_mailing: boolean;
  source: string;
}

export interface RelativeResult {
  name: string;
  relationship?: string;
  age?: number;
  phone?: string;
}

export interface SkipTraceProfile {
  // Identity
  full_legal_name: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  age?: number;
  dob_estimate?: string;
  
  // Contact (prioritized)
  phones: PhoneResult[];
  primary_phone?: string;
  emails: EmailResult[];
  primary_email?: string;
  
  // Addresses
  addresses: AddressResult[];
  current_address?: AddressResult;
  mailing_address?: AddressResult;
  lives_at_property: boolean;
  
  // Household
  relatives: RelativeResult[];
  spouse_name?: string;
  is_deceased: boolean;
  
  // Financial signals
  property_tax_status?: 'current' | 'delinquent' | 'unknown';
  estimated_equity?: number;
  bankruptcy_flag: boolean;
  
  // For agreement pre-fill
  agreement_ready: boolean;
  missing_for_agreement: string[];
  
  // Meta
  confidence_score: number;  // 0-100
  sources_checked: string[];
  skip_trace_date: string;
  
  // Raw data for debugging
  raw_results?: Record<string, unknown>;
}

/**
 * Parse a name into components
 */
export function parseName(fullName: string): {
  first: string;
  middle?: string;
  last: string;
  suffix?: string;
} {
  // Remove common suffixes and titles
  let name = fullName
    .replace(/,?\s*(et al\.?|heirs|unknown heirs|etal|jr\.?|sr\.?|ii|iii|iv)/gi, '')
    .replace(/\s+(llc|inc|corp|ltd|trust|estate)$/gi, '')
    .trim();
  
  // Handle "LAST, FIRST MIDDLE" format
  if (name.includes(',')) {
    const [last, rest] = name.split(',').map(s => s.trim());
    const parts = rest.split(/\s+/);
    return {
      first: parts[0] || '',
      middle: parts.slice(1).join(' ') || undefined,
      last: last,
    };
  }
  
  // Handle "FIRST MIDDLE LAST" format
  const parts = name.split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  } else if (parts.length === 2) {
    return { first: parts[0], last: parts[1] };
  } else {
    return {
      first: parts[0],
      middle: parts.slice(1, -1).join(' '),
      last: parts[parts.length - 1],
    };
  }
}

/**
 * Build search queries for different sources
 */
export function buildSearchQueries(input: SkipTraceInput): {
  google: string;
  truePeopleSearch: string;
  fastPeopleSearch: string;
  whitepages: string;
} {
  const { first, last } = parseName(input.owner_name);
  const city = input.property_city || 'Dallas';
  const state = 'Texas';
  
  return {
    google: `"${first} ${last}" ${city} ${state} phone address`,
    truePeopleSearch: `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(first + ' ' + last)}&citystatezip=${encodeURIComponent(city + ', TX')}`,
    fastPeopleSearch: `https://www.fastpeoplesearch.com/name/${encodeURIComponent(first + '-' + last)}_${encodeURIComponent(city + '-tx')}`,
    whitepages: `https://www.whitepages.com/name/${encodeURIComponent(first + '-' + last)}/${encodeURIComponent(city + '-tx')}`,
  };
}

/**
 * Extract phone numbers from text
 */
export function extractPhones(text: string): string[] {
  const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  
  return matches
    .map(p => p.replace(/[^0-9]/g, ''))
    .filter(p => p.length === 10)
    .filter((p, i, arr) => arr.indexOf(p) === i); // Dedupe
}

/**
 * Extract emails from text
 */
export function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  
  return matches
    .map(e => e.toLowerCase())
    .filter((e, i, arr) => arr.indexOf(e) === i); // Dedupe
}

/**
 * Check what's missing for agreement pre-fill
 */
export function checkAgreementReadiness(profile: Partial<SkipTraceProfile>): {
  ready: boolean;
  missing: string[];
} {
  const required = [
    { field: 'full_legal_name', label: 'Full legal name' },
    { field: 'primary_phone', label: 'Phone number' },
    { field: 'mailing_address', label: 'Mailing address' },
  ];
  
  const missing: string[] = [];
  
  for (const req of required) {
    const value = profile[req.field as keyof SkipTraceProfile];
    if (!value || (typeof value === 'string' && !value.trim())) {
      missing.push(req.label);
    }
  }
  
  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Calculate confidence score based on data quality
 */
export function calculateConfidence(profile: Partial<SkipTraceProfile>): number {
  let score = 0;
  
  // Name quality (20 pts)
  if (profile.full_legal_name) score += 10;
  if (profile.first_name && profile.last_name) score += 10;
  
  // Phone quality (30 pts)
  if (profile.phones && profile.phones.length > 0) {
    score += 15;
    if (profile.phones.some(p => p.type === 'mobile')) score += 10;
    if (profile.phones.some(p => p.verified)) score += 5;
  }
  
  // Email (15 pts)
  if (profile.emails && profile.emails.length > 0) score += 15;
  
  // Address quality (25 pts)
  if (profile.current_address) score += 15;
  if (profile.mailing_address) score += 10;
  
  // Additional signals (10 pts)
  if (profile.age) score += 3;
  if (profile.relatives && profile.relatives.length > 0) score += 4;
  if (!profile.is_deceased) score += 3;
  
  return Math.min(100, score);
}

/**
 * Format phone for display
 */
export function formatPhone(phone: string): string {
  if (!phone || phone.length !== 10) return phone;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

/**
 * Build the pre-fill data for Sam's agreement
 */
export function buildAgreementPrefill(profile: SkipTraceProfile, input: SkipTraceInput): Record<string, string> {
  const mailingAddr = profile.mailing_address || profile.current_address;
  
  return {
    // Client info
    client_name: profile.full_legal_name,
    client_first_name: profile.first_name,
    client_last_name: profile.last_name,
    client_phone: profile.primary_phone || '',
    client_email: profile.primary_email || '',
    
    // Mailing address
    mailing_street: mailingAddr?.street || '',
    mailing_city: mailingAddr?.city || '',
    mailing_state: mailingAddr?.state || 'TX',
    mailing_zip: mailingAddr?.zip || '',
    
    // Property info
    property_address: input.property_address,
    property_city: input.property_city || '',
    
    // Case info
    case_number: input.case_number || '',
    excess_amount: input.excess_amount?.toString() || '',
    fee_percentage: '25',
    fee_amount: input.excess_amount ? (input.excess_amount * 0.25).toFixed(2) : '',
    
    // Dates
    date: new Date().toLocaleDateString('en-US'),
  };
}
