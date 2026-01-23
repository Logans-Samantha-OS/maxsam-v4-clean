import { ARV_MULTIPLIER, BUYBOX_LIST_MIN_MULTIPLIER, BUYBOX_LIST_MAX_MULTIPLIER, DEFAULT_WHOLESALE_FEE_PERCENT } from '../constants.js';
import type { OfferCalculation, BuyBoxCalculation, ValidationResult } from '../types.js';

/**
 * Calculate max offer price using the 70% rule
 * Formula: ARV × 0.70 - repairs
 */
export function calculateOfferPrice(arv: number, repairs: number = 0): OfferCalculation {
  const maxOffer = (arv * ARV_MULTIPLIER) - repairs;
  const profitMargin = arv * (1 - ARV_MULTIPLIER);
  
  return {
    arv,
    repairs,
    maxOffer: Math.max(0, maxOffer),
    formula: `$${arv.toLocaleString()} × 0.70 - $${repairs.toLocaleString()} = $${Math.max(0, maxOffer).toLocaleString()}`,
    profitMargin,
    breakdownPercent: ARV_MULTIPLIER * 100,
  };
}

/**
 * Calculate BuyBox listing price range
 * Uses 75-82% of ARV as the standard listing range
 */
export function calculateBuyBoxPrice(
  purchasePrice: number, 
  arv: number, 
  wholesaleFeePercent: number = DEFAULT_WHOLESALE_FEE_PERCENT
): BuyBoxCalculation {
  const recommendedListMin = arv * BUYBOX_LIST_MIN_MULTIPLIER;
  const recommendedListMax = arv * BUYBOX_LIST_MAX_MULTIPLIER;
  const wholesaleFee = purchasePrice * wholesaleFeePercent;
  
  // Expected profit = midpoint of listing range - purchase price
  const midpointList = (recommendedListMin + recommendedListMax) / 2;
  const expectedProfit = midpointList - purchasePrice;
  
  // Spread as percentage of ARV
  const spreadPercent = ((midpointList - purchasePrice) / arv) * 100;
  
  return {
    purchasePrice,
    arv,
    recommendedListMin: Math.round(recommendedListMin),
    recommendedListMax: Math.round(recommendedListMax),
    wholesaleFee: Math.round(wholesaleFee),
    expectedProfit: Math.round(expectedProfit),
    spreadPercent: Math.round(spreadPercent * 10) / 10,
  };
}

/**
 * Validate ARV input
 */
export function validateARV(arv: number): ValidationResult {
  if (arv <= 0) {
    return { valid: false, error: 'ARV must be positive' };
  }
  if (arv < 10000) {
    return { valid: true, warning: 'ARV seems unusually low. Verify value.' };
  }
  if (arv > 50000000) {
    return { valid: true, warning: 'ARV seems unusually high. Verify value.' };
  }
  return { valid: true };
}

/**
 * Validate repair estimate
 */
export function validateRepairs(repairs: number, arv: number): ValidationResult {
  if (repairs < 0) {
    return { valid: false, error: 'Repairs cannot be negative' };
  }
  if (repairs > arv * 0.5) {
    return { valid: true, warning: 'Repairs exceed 50% of ARV. Verify estimate.' };
  }
  return { valid: true };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate potential revenue from excess funds
 */
export function calculateExcessFundsRevenue(excessAmount: number, feePercent: number = 0.25): {
  grossAmount: number;
  fee: number;
  clientReceives: number;
} {
  const fee = excessAmount * feePercent;
  return {
    grossAmount: excessAmount,
    fee: Math.round(fee),
    clientReceives: Math.round(excessAmount - fee),
  };
}

/**
 * Calculate combined deal value (excess funds + wholesale)
 */
export function calculateGoldenLeadValue(
  excessFundsAmount: number,
  wholesaleProfit: number,
  excessFundsFeePercent: number = 0.25,
  wholesaleFeePercent: number = 0.10
): {
  excessFundsFee: number;
  wholesaleFee: number;
  totalRevenue: number;
  revenueBreakdown: string;
} {
  const excessFundsFee = excessFundsAmount * excessFundsFeePercent;
  const wholesaleFee = wholesaleProfit * wholesaleFeePercent;
  const totalRevenue = excessFundsFee + wholesaleFee;
  
  return {
    excessFundsFee: Math.round(excessFundsFee),
    wholesaleFee: Math.round(wholesaleFee),
    totalRevenue: Math.round(totalRevenue),
    revenueBreakdown: `Excess Funds (${excessFundsFeePercent * 100}%): ${formatCurrency(excessFundsFee)} + Wholesale (${wholesaleFeePercent * 100}%): ${formatCurrency(wholesaleFee)} = ${formatCurrency(totalRevenue)}`,
  };
}
