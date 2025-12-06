/**
 * Eleanor AI - Lead Scoring Engine V2: THE GOLDEN FILTER
 * Named after Eleanor Roosevelt: "The future belongs to those who believe in the beauty of their dreams"
 *
 * EXPIRATION IS KING - Days until expiration is the PRIMARY scoring factor
 * Cross-reference with distressed lists provides MASSIVE boost
 *
 * This is the brain of MaxSam V4. Eleanor evaluates every lead and determines:
 * - Scoring (0-100) with EXPIRATION as primary factor
 * - Deal grade (CRITICAL, A+, A, B, C, D)
 * - Contact priority (critical, hot, warm, cold)
 * - Deal type (dual, excess_only, wholesale)
 * - Potential revenue
 * - Detailed reasoning for transparency
 *
 * 100% of all revenue goes to Logan Toups (sole owner)
 */

export interface Lead {
  id: string;
  excess_funds_amount: number | null;
  estimated_arv?: number | null;
  estimated_repair_cost?: number | null;
  phone?: string | null;
  phone_1?: string | null;
  phone_2?: string | null;
  email?: string | null;
  owner_name?: string | null;
  zip_code?: string | null;
  city?: string | null;
  property_address?: string | null;
  is_distressed?: boolean;
  is_cross_referenced?: boolean;
  days_until_expiration?: number | null;
  days_until_expiry?: number | null; // Legacy support
  expiration_date?: string | null;
  cross_reference_boost?: number;
}

export interface ScoringResult {
  eleanor_score: number;
  deal_grade: 'CRITICAL' | 'A+' | 'A' | 'B' | 'C' | 'D';
  contact_priority: 'critical' | 'hot' | 'warm' | 'cold';
  deal_type: 'dual' | 'excess_only' | 'wholesale';
  reasoning: string[];
  potential_revenue: number;
  excess_fee: number;
  wholesale_fee: number;
  estimated_equity: number;
  expiration_score: number;
  urgency_tier: 'CRITICAL' | 'URGENT' | 'WARNING' | 'NORMAL' | 'SAFE';
  is_cross_referenced: boolean;
}

// Thresholds
const MINIMUM_EXCESS_FUNDS = 5000;
const MINIMUM_WHOLESALE_PROFIT = 5000;

// Premium Dallas zip codes (higher priority)
const HOT_ZIPS = ['75201', '75202', '75219', '75214', '75206', '75204', '75226', '75205', '75209'];
const WARM_ZIPS = ['75235', '75220', '75230', '75248', '75225', '75240', '75243', '75231', '75238'];

/**
 * Calculate Eleanor Score for a lead - V2 EXPIRATION FIRST
 * Returns comprehensive scoring result with reasoning
 *
 * NEW SCORING BREAKDOWN:
 * - Expiration (50 pts max) - THE PRIMARY FACTOR
 * - Cross-Reference Boost (+30 pts) - MASSIVE BOOST
 * - Excess Funds (25 pts max)
 * - Contact Quality (15 pts max)
 * - Location (10 pts max)
 */
export function calculateEleanorScore(lead: Lead): ScoringResult {
  let score = 0;
  const reasoning: string[] = [];

  const excessAmount = Number(lead.excess_funds_amount) || 0;
  const hasPhone = !!(lead.phone || lead.phone_1 || lead.phone_2);
  const hasEmail = !!lead.email;
  const hasFullName = lead.owner_name && lead.owner_name.trim().split(' ').length >= 2;

  // Get days until expiration (support both field names)
  const daysUntilExpiration = lead.days_until_expiration ?? lead.days_until_expiry ?? null;
  const isCrossReferenced = lead.is_cross_referenced ?? false;
  const crossReferenceBoost = lead.cross_reference_boost ?? 0;

  // Estimate ARV if not provided (rough estimate: 3x excess funds)
  const arv = Number(lead.estimated_arv) || (excessAmount > 0 ? excessAmount * 3 : 0);
  // Estimate repair cost if not provided (15% of ARV)
  const repairCost = Number(lead.estimated_repair_cost) || (arv * 0.15);
  // Calculate Maximum Allowable Offer (70% rule)
  const mao = arv * 0.70;
  // Equity = ARV - Repairs - MAO (profit margin for investor)
  const equity = arv - repairCost - mao;

  // ============================================
  // FACTOR 1: EXPIRATION (50 points max) - THE KING
  // This is now the PRIMARY scoring factor
  // ============================================
  let expirationScore = 0;
  let urgencyTier: ScoringResult['urgency_tier'] = 'SAFE';

  if (daysUntilExpiration !== null && daysUntilExpiration !== undefined) {
    if (daysUntilExpiration <= 7) {
      expirationScore = 50;
      urgencyTier = 'CRITICAL';
      reasoning.push(`CRITICAL: ${daysUntilExpiration} days until expiration (+50 MAXIMUM)`);
    } else if (daysUntilExpiration <= 14) {
      expirationScore = 47;
      urgencyTier = 'CRITICAL';
      reasoning.push(`CRITICAL: ${daysUntilExpiration} days until expiration (+47)`);
    } else if (daysUntilExpiration <= 30) {
      expirationScore = 45;
      urgencyTier = 'URGENT';
      reasoning.push(`URGENT: ${daysUntilExpiration} days until expiration (+45)`);
    } else if (daysUntilExpiration <= 60) {
      expirationScore = 35;
      urgencyTier = 'WARNING';
      reasoning.push(`WARNING: ${daysUntilExpiration} days until expiration (+35)`);
    } else if (daysUntilExpiration <= 90) {
      expirationScore = 25;
      urgencyTier = 'NORMAL';
      reasoning.push(`${daysUntilExpiration} days until expiration (+25)`);
    } else if (daysUntilExpiration <= 180) {
      expirationScore = 15;
      urgencyTier = 'SAFE';
      reasoning.push(`${daysUntilExpiration} days until expiration (+15)`);
    } else {
      expirationScore = 5;
      urgencyTier = 'SAFE';
      reasoning.push(`${daysUntilExpiration} days until expiration (+5)`);
    }
  } else {
    expirationScore = 20; // Default score when no expiration data
    urgencyTier = 'NORMAL';
    reasoning.push(`No expiration data - default score (+20)`);
  }
  score += expirationScore;

  // ============================================
  // FACTOR 2: CROSS-REFERENCE BOOST (+30 points)
  // Lead appears on BOTH excess funds AND distressed list
  // ============================================
  if (isCrossReferenced || crossReferenceBoost > 0) {
    const boost = crossReferenceBoost || 30;
    score += boost;
    reasoning.push(`CROSS-REFERENCED: On distressed list! (+${boost} MASSIVE BOOST)`);
  }

  // ============================================
  // FACTOR 3: EXCESS FUNDS AMOUNT (25 points max)
  // Reduced from 40 - expiration is now king
  // ============================================
  if (excessAmount >= 50000) {
    score += 25;
    reasoning.push(`Excellent excess funds: $${excessAmount.toLocaleString()} (+25)`);
  } else if (excessAmount >= 30000) {
    score += 22;
    reasoning.push(`Strong excess funds: $${excessAmount.toLocaleString()} (+22)`);
  } else if (excessAmount >= 20000) {
    score += 18;
    reasoning.push(`Good excess funds: $${excessAmount.toLocaleString()} (+18)`);
  } else if (excessAmount >= 15000) {
    score += 15;
    reasoning.push(`Moderate excess funds: $${excessAmount.toLocaleString()} (+15)`);
  } else if (excessAmount >= 10000) {
    score += 12;
    reasoning.push(`Acceptable excess funds: $${excessAmount.toLocaleString()} (+12)`);
  } else if (excessAmount >= 5000) {
    score += 8;
    reasoning.push(`Minimum excess funds: $${excessAmount.toLocaleString()} (+8)`);
  } else if (excessAmount > 0) {
    score += 3;
    reasoning.push(`Below minimum threshold: $${excessAmount.toLocaleString()} (+3)`);
  } else {
    reasoning.push(`No excess funds data (+0)`);
  }

  // ============================================
  // FACTOR 4: CONTACT INFO QUALITY (15 points max)
  // Can't make money if we can't reach them
  // ============================================
  let contactScore = 0;
  if (hasPhone) {
    contactScore += 8;
    reasoning.push(`Phone number available (+8)`);
  } else {
    reasoning.push(`No phone - skip tracing needed (+0)`);
  }

  if (hasEmail) {
    contactScore += 4;
    reasoning.push(`Email available (+4)`);
  }

  if (hasFullName) {
    contactScore += 3;
    reasoning.push(`Full name available (+3)`);
  }
  score += contactScore;

  // ============================================
  // FACTOR 5: LOCATION DESIRABILITY (10 points max)
  // Premium areas = faster closes, higher values
  // ============================================
  const zipCode = lead.zip_code || '';
  if (HOT_ZIPS.includes(zipCode)) {
    score += 10;
    reasoning.push(`Premium Dallas location: ${zipCode} (+10)`);
  } else if (WARM_ZIPS.includes(zipCode)) {
    score += 7;
    reasoning.push(`Desirable Dallas location: ${zipCode} (+7)`);
  } else if (zipCode) {
    score += 3;
    reasoning.push(`Standard Dallas County location: ${zipCode} (+3)`);
  } else if (lead.city) {
    score += 2;
    reasoning.push(`City available: ${lead.city} (+2)`);
  }

  // ============================================
  // FINAL CALCULATIONS
  // ============================================

  // Cap score at 0-130 (allows for cross-reference boost to push above 100)
  score = Math.round(Math.min(130, Math.max(0, score)));

  // Assign grade based on score WITH urgency consideration
  let deal_grade: ScoringResult['deal_grade'];
  if (urgencyTier === 'CRITICAL' && score >= 70) {
    deal_grade = 'CRITICAL';
  } else if (score >= 90 || (isCrossReferenced && score >= 75)) {
    deal_grade = 'A+';
  } else if (score >= 75) {
    deal_grade = 'A';
  } else if (score >= 60) {
    deal_grade = 'B';
  } else if (score >= 45) {
    deal_grade = 'C';
  } else {
    deal_grade = 'D';
  }

  // Override to CRITICAL if expiring within 7 days regardless of other factors
  if (daysUntilExpiration !== null && daysUntilExpiration <= 7 && excessAmount >= MINIMUM_EXCESS_FUNDS) {
    deal_grade = 'CRITICAL';
  }

  // Assign priority based on grade and urgency
  let contact_priority: ScoringResult['contact_priority'];
  if (deal_grade === 'CRITICAL' || urgencyTier === 'CRITICAL') {
    contact_priority = 'critical';
  } else if (deal_grade === 'A+' || deal_grade === 'A') {
    contact_priority = 'hot';
  } else if (deal_grade === 'B') {
    contact_priority = 'warm';
  } else {
    contact_priority = 'cold';
  }

  // Determine deal type
  const excessViable = excessAmount >= MINIMUM_EXCESS_FUNDS;
  const wholesaleViable = equity >= MINIMUM_WHOLESALE_PROFIT;

  let deal_type: ScoringResult['deal_type'];
  if (excessViable && wholesaleViable) {
    deal_type = 'dual';
  } else if (excessViable) {
    deal_type = 'excess_only';
  } else {
    deal_type = 'wholesale';
  }

  // Calculate potential revenue (100% to Logan)
  const excess_fee = excessViable ? excessAmount * 0.25 : 0;
  const wholesale_fee = wholesaleViable ? Math.max(equity * 0.10, 10000) : 0;

  let potential_revenue: number;
  if (deal_type === 'dual') {
    potential_revenue = excess_fee + wholesale_fee;
  } else if (deal_type === 'excess_only') {
    potential_revenue = excess_fee;
  } else {
    potential_revenue = wholesale_fee;
  }

  // Add summary to reasoning
  reasoning.push('---');
  reasoning.push(`TOTAL SCORE: ${score}/100${score > 100 ? ' (BOOSTED)' : ''}`);
  reasoning.push(`GRADE: ${deal_grade}`);
  reasoning.push(`URGENCY: ${urgencyTier}`);
  reasoning.push(`PRIORITY: ${contact_priority.toUpperCase()}`);
  reasoning.push(`DEAL TYPE: ${deal_type.replace('_', ' ').toUpperCase()}`);
  reasoning.push(`POTENTIAL REVENUE: $${potential_revenue.toLocaleString()}`);

  return {
    eleanor_score: Math.min(score, 100), // Cap display score at 100
    deal_grade,
    contact_priority,
    deal_type,
    reasoning,
    potential_revenue,
    excess_fee,
    wholesale_fee,
    estimated_equity: Math.max(0, equity),
    expiration_score: expirationScore,
    urgency_tier: urgencyTier,
    is_cross_referenced: isCrossReferenced
  };
}

/**
 * Calculate fees for a deal
 * 100% of all revenue goes to Logan Toups (sole owner)
 *
 * Fee Structure:
 * - Excess Funds Only: 25% of excess funds amount
 * - Wholesale Only: 10% of wholesale equity
 * - Dual Deal: 25% excess + 10% wholesale combined
 *
 * @param excessAmount - Amount of excess funds
 * @param wholesaleEquity - Equity in the property (for wholesale)
 * @param dealType - Type of deal: 'dual', 'excess_only', 'excess_funds', or 'wholesale'
 */
export function calculateFees(
  excessAmount: number,
  wholesaleEquity: number,
  dealType: 'dual' | 'excess_only' | 'excess_funds' | 'wholesale'
) {
  // 25% of excess funds for excess deals
  const excessFee = (dealType !== 'wholesale') ? excessAmount * 0.25 : 0;
  // 10% of wholesale equity for wholesale deals
  const wholesaleFee = (dealType !== 'excess_only' && dealType !== 'excess_funds') ? wholesaleEquity * 0.10 : 0;
  const totalFee = excessFee + wholesaleFee;

  return {
    excessFee,
    wholesaleFee,
    totalFee
  };
}

/**
 * Calculate Maximum Allowable Offer (MAO) for wholesale deals
 * Uses 70% rule: MAO = (ARV * 0.70) - Repair Cost
 */
export function calculateMAO(arv: number, repairCost: number): number {
  return (arv * 0.70) - repairCost;
}

/**
 * Get priority color for UI display - Updated for CRITICAL tier
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'text-red-600 bg-red-600/30 animate-pulse';
    case 'hot':
      return 'text-orange-500 bg-orange-500/20';
    case 'warm':
      return 'text-yellow-500 bg-yellow-500/20';
    case 'cold':
      return 'text-blue-500 bg-blue-500/20';
    default:
      return 'text-gray-500 bg-gray-500/20';
  }
}

/**
 * Get grade color for UI display - Updated with CRITICAL tier
 */
export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'CRITICAL':
      return 'text-red-500 bg-red-600/30 border-red-500 animate-pulse';
    case 'A+':
      return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/50';
    case 'A':
      return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50';
    case 'B':
      return 'text-blue-400 bg-blue-500/20 border-blue-500/50';
    case 'C':
      return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
    case 'D':
      return 'text-red-400 bg-red-500/20 border-red-500/50';
    default:
      return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
  }
}

/**
 * Get urgency tier color for countdown display
 */
export function getUrgencyColor(urgencyTier: string): string {
  switch (urgencyTier) {
    case 'CRITICAL':
      return '#ff0000';
    case 'URGENT':
      return '#ff4400';
    case 'WARNING':
      return '#ffaa00';
    case 'NORMAL':
      return '#00ff88';
    case 'SAFE':
      return '#00f0ff';
    default:
      return '#888888';
  }
}

/**
 * Get gem tier name for display
 */
export function getGemTierName(grade: string): string {
  switch (grade) {
    case 'CRITICAL':
      return 'BLOOD DIAMOND';
    case 'A+':
      return 'ULTRA DIAMOND';
    case 'A':
      return 'EMERALD';
    case 'B':
      return 'SAPPHIRE';
    case 'C':
      return 'AMBER';
    case 'D':
      return 'RUBY';
    default:
      return 'UNKNOWN';
  }
}
