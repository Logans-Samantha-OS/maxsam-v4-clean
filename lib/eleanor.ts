/**
 * Eleanor AI - Lead Scoring Engine
 * Named after Eleanor Roosevelt: "The future belongs to those who believe in the beauty of their dreams"
 *
 * This is the brain of MaxSam V4. Eleanor evaluates every lead and determines:
 * - Scoring (0-100)
 * - Deal grade (A+, A, B, C, D)
 * - Contact priority (hot, warm, cold)
 * - Deal type (dual, excess_only, wholesale)
 * - Potential revenue
 * - Detailed reasoning for transparency
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
  days_until_expiry?: number | null;
}

export interface ScoringResult {
  eleanor_score: number;
  deal_grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  contact_priority: 'hot' | 'warm' | 'cold';
  deal_type: 'dual' | 'excess_only' | 'wholesale';
  reasoning: string[];
  potential_revenue: number;
  excess_fee: number;
  wholesale_fee: number;
  estimated_equity: number;
}

// Thresholds
const MINIMUM_EXCESS_FUNDS = 5000;
const MINIMUM_WHOLESALE_PROFIT = 5000;

// Premium Dallas zip codes (higher priority)
const HOT_ZIPS = ['75201', '75202', '75219', '75214', '75206', '75204', '75226', '75205', '75209'];
const WARM_ZIPS = ['75235', '75220', '75230', '75248', '75225', '75240', '75243', '75231', '75238'];

/**
 * Calculate Eleanor Score for a lead
 * Returns comprehensive scoring result with reasoning
 */
export function calculateEleanorScore(lead: Lead): ScoringResult {
  let score = 0;
  const reasoning: string[] = [];

  const excessAmount = Number(lead.excess_funds_amount) || 0;
  const hasPhone = !!(lead.phone || lead.phone_1 || lead.phone_2);
  const hasEmail = !!lead.email;
  const hasFullName = lead.owner_name && lead.owner_name.trim().split(' ').length >= 2;

  // Estimate ARV if not provided (rough estimate: 3x excess funds)
  const arv = Number(lead.estimated_arv) || (excessAmount > 0 ? excessAmount * 3 : 0);
  // Estimate repair cost if not provided (15% of ARV)
  const repairCost = Number(lead.estimated_repair_cost) || (arv * 0.15);
  // Calculate Maximum Allowable Offer (70% rule)
  const mao = arv * 0.70;
  // Equity = ARV - Repairs - MAO (profit margin for investor)
  const equity = arv - repairCost - mao;

  // ============================================
  // FACTOR 1: EXCESS FUNDS AMOUNT (40 points max)
  // This is guaranteed money if we can reach the owner
  // ============================================
  if (excessAmount >= 50000) {
    score += 40;
    reasoning.push(`Excellent excess funds: $${excessAmount.toLocaleString()} (+40)`);
  } else if (excessAmount >= 30000) {
    score += 35;
    reasoning.push(`Strong excess funds: $${excessAmount.toLocaleString()} (+35)`);
  } else if (excessAmount >= 20000) {
    score += 30;
    reasoning.push(`Good excess funds: $${excessAmount.toLocaleString()} (+30)`);
  } else if (excessAmount >= 15000) {
    score += 25;
    reasoning.push(`Moderate excess funds: $${excessAmount.toLocaleString()} (+25)`);
  } else if (excessAmount >= 10000) {
    score += 20;
    reasoning.push(`Acceptable excess funds: $${excessAmount.toLocaleString()} (+20)`);
  } else if (excessAmount >= 5000) {
    score += 10;
    reasoning.push(`Minimum excess funds: $${excessAmount.toLocaleString()} (+10)`);
  } else if (excessAmount > 0) {
    reasoning.push(`Below minimum threshold: $${excessAmount.toLocaleString()} (+0)`);
  } else {
    reasoning.push(`No excess funds data (+0)`);
  }

  // ============================================
  // FACTOR 2: WHOLESALE POTENTIAL (25 points max)
  // Estimated equity determines wholesale viability
  // ============================================
  if (equity >= 50000) {
    score += 25;
    reasoning.push(`Excellent wholesale potential: $${equity.toLocaleString()} equity (+25)`);
  } else if (equity >= 30000) {
    score += 20;
    reasoning.push(`Strong wholesale potential: $${equity.toLocaleString()} equity (+20)`);
  } else if (equity >= 20000) {
    score += 15;
    reasoning.push(`Good wholesale potential: $${equity.toLocaleString()} equity (+15)`);
  } else if (equity >= 10000) {
    score += 10;
    reasoning.push(`Moderate wholesale potential: $${equity.toLocaleString()} equity (+10)`);
  } else if (equity >= 5000) {
    score += 5;
    reasoning.push(`Minimal wholesale potential: $${equity.toLocaleString()} equity (+5)`);
  } else {
    reasoning.push(`No wholesale potential: $${Math.max(0, equity).toLocaleString()} equity (+0)`);
  }

  // ============================================
  // FACTOR 3: CONTACT INFO QUALITY (20 points max)
  // Can't make money if we can't reach them
  // ============================================
  let contactScore = 0;
  if (hasPhone) {
    contactScore += 10;
    reasoning.push(`Phone number available (+10)`);
  } else {
    reasoning.push(`No phone - skip tracing needed (+0)`);
  }

  if (hasEmail) {
    contactScore += 5;
    reasoning.push(`Email available (+5)`);
  }

  if (hasFullName) {
    contactScore += 5;
    reasoning.push(`Full name available (+5)`);
  }
  score += contactScore;

  // ============================================
  // FACTOR 4: LOCATION DESIRABILITY (10 points max)
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
  // FACTOR 5: DEAL COMPLEXITY / RISK (5 points max)
  // Lower complexity = higher score
  // ============================================
  let complexityScore = 5;

  if (!hasPhone) {
    complexityScore -= 2;
    reasoning.push(`Missing phone increases complexity (-2)`);
  }

  if (repairCost > arv * 0.30) {
    complexityScore -= 2;
    reasoning.push(`High repair costs increase risk (-2)`);
  }

  if (excessAmount < 10000 && equity < 10000) {
    complexityScore -= 1;
    reasoning.push(`Low profit potential on both streams (-1)`);
  }

  score += Math.max(0, complexityScore);

  // ============================================
  // BONUS: URGENCY FACTORS
  // ============================================
  if (lead.days_until_expiry !== undefined && lead.days_until_expiry !== null) {
    if (lead.days_until_expiry <= 30) {
      score += 5;
      reasoning.push(`Expiring soon: ${lead.days_until_expiry} days (+5 URGENT)`);
    } else if (lead.days_until_expiry <= 90) {
      score += 3;
      reasoning.push(`Expiring within 90 days (+3)`);
    }
  }

  if (lead.is_distressed) {
    score += 5;
    reasoning.push(`Distressed property - motivated seller (+5)`);
  }

  // ============================================
  // FINAL CALCULATIONS
  // ============================================

  // Cap score at 0-100
  score = Math.round(Math.min(100, Math.max(0, score)));

  // Assign grade based on score
  let deal_grade: ScoringResult['deal_grade'];
  if (score >= 85) {
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

  // Assign priority based on grade
  let contact_priority: ScoringResult['contact_priority'];
  if (deal_grade === 'A+' || deal_grade === 'A') {
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

  // Calculate potential revenue (100% to Logan by default)
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
  reasoning.push(`TOTAL SCORE: ${score}/100`);
  reasoning.push(`GRADE: ${deal_grade}`);
  reasoning.push(`PRIORITY: ${contact_priority.toUpperCase()}`);
  reasoning.push(`DEAL TYPE: ${deal_type.replace('_', ' ').toUpperCase()}`);
  reasoning.push(`POTENTIAL REVENUE: $${potential_revenue.toLocaleString()}`);

  return {
    eleanor_score: score,
    deal_grade,
    contact_priority,
    deal_type,
    reasoning,
    potential_revenue,
    excess_fee,
    wholesale_fee,
    estimated_equity: Math.max(0, equity)
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
 * Get priority color for UI display
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'hot':
      return 'text-red-500 bg-red-500/20';
    case 'warm':
      return 'text-orange-500 bg-orange-500/20';
    case 'cold':
      return 'text-blue-500 bg-blue-500/20';
    default:
      return 'text-gray-500 bg-gray-500/20';
  }
}

/**
 * Get grade color for UI display
 */
export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+':
      return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50';
    case 'A':
      return 'text-green-400 bg-green-500/20 border-green-500/50';
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
