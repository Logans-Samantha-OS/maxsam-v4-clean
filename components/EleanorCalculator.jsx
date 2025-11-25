import { useState, useMemo } from 'react'

function calculateScore({
  propertyValue,
  repairEstimate,
  hasExcessFunds,
  excessFundsAmount,
  isDistressed,
  daysUntilExpiry,
}) {
  let score = 50

  const value = Number(propertyValue) || 0
  const repairs = Number(repairEstimate) || 0
  const excess = Number(excessFundsAmount) || 0
  const days = Number(daysUntilExpiry) || 9999

  const equity = value > 0 ? ((value - repairs) / value) * 100 : 0
  const dualOpportunity = hasExcessFunds && isDistressed

  if (dualOpportunity) score += 30
  if (excess > 10000) score += 15
  if (isDistressed) score += 10
  if (days <= 60) score += 20
  else if (days <= 120) score += 10
  if (equity > 30) score += 10

  if (score > 100) score = 100
  if (score < 0) score = 0

  return { score, equity, dualOpportunity }
}

function getGrade(score) {
  if (score >= 95) return 'S'
  if (score >= 85) return 'A'
  if (score >= 75) return 'B'
  if (score >= 65) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

function getDealQuality(score) {
  if (score >= 95) return 'Elite offmarket opportunity'
  if (score >= 85) return 'Prime investment candidate'
  if (score >= 75) return 'Strong negotiable lead'
  if (score >= 65) return 'Workable with careful underwriting'
  if (score >= 50) return 'Marginal  proceed with caution'
  return 'Low quality  likely not a fit'
}

function getContactPriority(score) {
  if (score >= 95) return 'Immediate  sameday contact required'
  if (score >= 85) return 'High  contact within 24 hours'
  if (score >= 75) return 'Medium  contact within 48 hours'
  if (score >= 65) return 'Low  contact as time allows'
  return 'Very low  nurture only'
}

function getOpportunityTier(score) {
  if (score >= 95) return 'Tier S  Whitelist / VIP'
  if (score >= 85) return 'Tier 1  Core Sam queue'
  if (score >= 75) return 'Tier 2  Priority followup'
  if (score >= 65) return 'Tier 3  Secondary queue'
  return 'Tier 4  Nurture / archive'
}

export default function EleanorCalculator() {
  const [propertyValue, setPropertyValue] = useState('')
  const [repairEstimate, setRepairEstimate] = useState('')
  const [hasExcessFunds, setHasExcessFunds] = useState(false)
  const [excessFundsAmount, setExcessFundsAmount] = useState('')
  const [isDistressed, setIsDistressed] = useState(false)
  const [daysUntilExpiry, setDaysUntilExpiry] = useState('')

  const metrics = useMemo(() => {
    const { score, equity, dualOpportunity } = calculateScore({
      propertyValue,
      repairEstimate,
      hasExcessFunds,
      excessFundsAmount,
      isDistressed,
      daysUntilExpiry,
    })

    const value = Number(propertyValue) || 0
    const repairs = Number(repairEstimate) || 0
    const excess = Number(excessFundsAmount) || 0

    const arv = value * 1.15
    const maxOffer = arv * 0.7 - repairs
    const wholesaleFee = Math.max(maxOffer * 0.1, 0)
    const fees = excess * 0.25 + wholesaleFee

    const grade = getGrade(score)
    const dealQuality = getDealQuality(score)
    const contactPriority = getContactPriority(score)
    const opportunityTier = getOpportunityTier(score)

    return {
      score,
      equity,
      dualOpportunity,
      arv,
      maxOffer,
      fees,
      grade,
      dealQuality,
      contactPriority,
      opportunityTier,
    }
  }, [
    propertyValue,
    repairEstimate,
    hasExcessFunds,
    excessFundsAmount,
    isDistressed,
    daysUntilExpiry,
  ])

  return (
    <div className="bg-gray-900 text-cyan-100 p-6 rounded-xl border border-cyan-500/40 shadow-lg shadow-cyan-500/10">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-4">
        Eleanor Deal Quality Engine
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Property Value ($)
            </label>
            <input
              type="number"
              value={propertyValue}
              onChange={e => setPropertyValue(e.target.value)}
              className="w-full bg-gray-800 border border-cyan-500/40 rounded px-3 py-2 text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Repair Estimate ($)
            </label>
            <input
              type="number"
              value={repairEstimate}
              onChange={e => setRepairEstimate(e.target.value)}
              className="w-full bg-gray-800 border border-cyan-500/40 rounded px-3 py-2 text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="hasExcessFunds"
              type="checkbox"
              checked={hasExcessFunds}
              onChange={e => setHasExcessFunds(e.target.checked)}
              className="rounded border-cyan-500/60 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <label
              htmlFor="hasExcessFunds"
              className="text-sm text-gray-200"
            >
              Has excess funds / surplus proceeds
            </label>
          </div>

          {hasExcessFunds && (
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Excess Funds Amount ($)
              </label>
              <input
                type="number"
                value={excessFundsAmount}
                onChange={e => setExcessFundsAmount(e.target.value)}
                className="w-full bg-gray-800 border border-cyan-500/40 rounded px-3 py-2 text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              id="isDistressed"
              type="checkbox"
              checked={isDistressed}
              onChange={e => setIsDistressed(e.target.checked)}
              className="rounded border-cyan-500/60 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="isDistressed" className="text-sm text-gray-200">
              Distressed seller / situation
            </label>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Days Until Expiry / Auction
            </label>
            <input
              type="number"
              value={daysUntilExpiry}
              onChange={e => setDaysUntilExpiry(e.target.value)}
              className="w-full bg-gray-800 border border-cyan-500/40 rounded px-3 py-2 text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-950/60 border border-cyan-500/40 rounded-lg p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm text-gray-400">Eleanor Score</div>
                <div className="text-4xl font-bold text-cyan-400">
                  {metrics.score}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Grade</div>
                <div className="text-3xl font-semibold text-cyan-300">
                  {metrics.grade}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-300">
              {metrics.dealQuality}
            </div>
            {metrics.dualOpportunity && (
              <div className="mt-2 text-xs font-medium text-emerald-400">
                Dual opportunity: excess funds + distressed signal detected
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-950/40 border border-cyan-500/20 rounded-lg p-3">
              <div className="text-gray-400 text-xs">Equity</div>
              <div className="text-lg text-cyan-200">
                {Number.isFinite(metrics.equity)
                  ? `${metrics.equity.toFixed(1)}%`
                  : ''}
              </div>
            </div>
            <div className="bg-gray-950/40 border border-cyan-500/20 rounded-lg p-3">
              <div className="text-gray-400 text-xs">ARV</div>
              <div className="text-lg text-cyan-200">
                {metrics.arv > 0
                  ? `$${metrics.arv.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : ''}
              </div>
            </div>
            <div className="bg-gray-950/40 border border-cyan-500/20 rounded-lg p-3">
              <div className="text-gray-400 text-xs">Max Offer</div>
              <div className="text-lg text-cyan-200">
                {metrics.maxOffer > 0
                  ? `$${metrics.maxOffer.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : ''}
              </div>
            </div>
            <div className="bg-gray-950/40 border border-cyan-500/20 rounded-lg p-3">
              <div className="text-gray-400 text-xs">Total Fees (est.)</div>
              <div className="text-lg text-cyan-200">
                {metrics.fees > 0
                  ? `$${metrics.fees.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : ''}
              </div>
            </div>
          </div>

          <div className="bg-gray-950/60 border border-cyan-500/30 rounded-lg p-4 text-sm">
            <div className="text-gray-400 text-xs mb-1">
              Contact Priority
            </div>
            <div className="text-cyan-100 mb-3">
              {metrics.contactPriority}
            </div>
            <div className="text-gray-400 text-xs mb-1">
              Opportunity Tier
            </div>
            <div className="text-cyan-100">
              {metrics.opportunityTier}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
