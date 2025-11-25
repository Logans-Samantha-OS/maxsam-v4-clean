// ============================================================
// MAXSAM V4 DASHBOARD - COMPLETE INTEGRATION PACKAGE
// ============================================================
// This file contains everything needed to connect your dashboard
// to Supabase and display real-time data + Eleanor calculations
// ============================================================

// ============================================================
// PART 1: SUPABASE CLIENT SETUP
// File: lib/supabase.js
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================================================
// PART 2: ENVIRONMENT VARIABLES
// File: .env.local (add to your project root)
// ============================================================
/*
NEXT_PUBLIC_SUPABASE_URL=https://tidcqvhxdsbnfykbvygs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
*/

// ============================================================
// PART 3: DASHBOARD METRICS HOOK
// File: hooks/useDashboardMetrics.js
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMetrics()
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'maxsam_leads' },
        () => fetchMetrics()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function fetchMetrics() {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('maxsam_dashboard_metrics')
        .select('*')
        .single()

      if (error) throw error
      setMetrics(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { metrics, loading, error, refresh: fetchMetrics }
}

// ============================================================
// PART 4: GOLDEN OPPORTUNITIES HOOK
// File: hooks/useGoldenOpportunities.js
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useGoldenOpportunities(limit = 20) {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOpportunities()
  }, [limit])

  async function fetchOpportunities() {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('maxsam_golden_opportunities')
        .select('*')
        .limit(limit)

      if (error) throw error
      setOpportunities(data || [])
    } catch (err) {
      console.error('Error fetching opportunities:', err)
    } finally {
      setLoading(false)
    }
  }

  return { opportunities, loading, refresh: fetchOpportunities }
}

// ============================================================
// PART 5: SAM'S CALL QUEUE HOOK
// File: hooks/useCallQueue.js
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCallQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQueue()
    
    // Real-time updates
    const subscription = supabase
      .channel('call-queue-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'maxsam_leads' },
        () => fetchQueue()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  async function fetchQueue() {
    try {
      const { data, error } = await supabase
        .from('maxsam_sam_call_queue')
        .select('*')
        .limit(50)

      if (error) throw error
      setQueue(data || [])
    } catch (err) {
      console.error('Error fetching call queue:', err)
    } finally {
      setLoading(false)
    }
  }

  async function updateLeadStatus(leadId, newStatus) {
    const { error } = await supabase
      .from('maxsam_leads')
      .update({ 
        sam_status: newStatus,
        sam_last_attempt: new Date().toISOString(),
        sam_attempts: supabase.raw('sam_attempts + 1')
      })
      .eq('id', leadId)

    if (!error) fetchQueue()
    return { error }
  }

  return { queue, loading, refresh: fetchQueue, updateLeadStatus }
}

// ============================================================
// PART 6: ELEANOR CALCULATOR COMPONENT
// File: components/EleanorCalculator.jsx
// ============================================================

import React, { useState } from 'react'

export function EleanorCalculator() {
  const [inputs, setInputs] = useState({
    propertyValue: 200000,
    excessFundsAmount: 0,
    hasExcessFunds: false,
    isDistressed: false,
    distressType: 'foreclosure',
    daysUntilExpiry: null,
    repairEstimate: 0,
  })

  const [results, setResults] = useState(null)

  function calculateEleanorScore() {
    let score = 50 // Base score
    let grade = 'C'
    let motivationLevel = 'MEDIUM'
    let dealQuality = 'SOLID'
    let contactPriority = 'THIS_WEEK'

    // Dual opportunity bonus (+30)
    const isDualOpportunity = inputs.hasExcessFunds && inputs.isDistressed
    if (isDualOpportunity) score += 30

    // Excess funds bonus (+15)
    if (inputs.hasExcessFunds && inputs.excessFundsAmount > 10000) score += 15

    // Distressed property bonus (+10)
    if (inputs.isDistressed) score += 10

    // Urgency bonus (expiring soon)
    if (inputs.daysUntilExpiry && inputs.daysUntilExpiry <= 60) {
      score += 20
      contactPriority = 'IMMEDIATE'
    } else if (inputs.daysUntilExpiry && inputs.daysUntilExpiry <= 120) {
      score += 10
      contactPriority = 'TODAY'
    }

    // Equity calculation
    const arv = inputs.propertyValue * 1.15
    const maxOffer = (arv - inputs.repairEstimate) * 0.70
    const equity = inputs.propertyValue - maxOffer
    const equityPercent = (equity / inputs.propertyValue) * 100

    if (equityPercent > 30) score += 10

    // Cap score at 100
    score = Math.min(score, 100)

    // Determine grade
    if (score >= 90) grade = 'S'
    else if (score >= 80) grade = 'A'
    else if (score >= 70) grade = 'B'
    else if (score >= 60) grade = 'C'
    else if (score >= 50) grade = 'D'
    else grade = 'F'

    // Determine motivation level
    if (score >= 85) motivationLevel = 'EXTREME'
    else if (score >= 70) motivationLevel = 'HIGH'
    else if (score >= 55) motivationLevel = 'MEDIUM'
    else motivationLevel = 'LOW'

    // Determine deal quality
    if (isDualOpportunity && inputs.daysUntilExpiry <= 60) dealQuality = 'UNICORN'
    else if (isDualOpportunity) dealQuality = 'PREMIUM'
    else if (score >= 70) dealQuality = 'SOLID'
    else if (score >= 50) dealQuality = 'MARGINAL'
    else dealQuality = 'PASS'

    // Calculate fees
    const excessFundsFee = inputs.hasExcessFunds ? inputs.excessFundsAmount * 0.25 : 0
    const wholesaleFee = inputs.isDistressed ? inputs.propertyValue * 0.10 : 0
    const totalFeePotential = excessFundsFee + wholesaleFee

    // Opportunity tier
    let opportunityTier = 'STANDARD'
    if (isDualOpportunity && inputs.daysUntilExpiry && inputs.daysUntilExpiry <= 60) {
      opportunityTier = 'PLATINUM'
    } else if (isDualOpportunity) {
      opportunityTier = 'GOLD'
    } else if (inputs.hasExcessFunds && inputs.daysUntilExpiry && inputs.daysUntilExpiry <= 60) {
      opportunityTier = 'SILVER_URGENT'
    } else if (inputs.hasExcessFunds) {
      opportunityTier = 'SILVER'
    } else if (inputs.isDistressed) {
      opportunityTier = 'BRONZE'
    }

    setResults({
      score,
      grade,
      motivationLevel,
      dealQuality,
      contactPriority,
      opportunityTier,
      isDualOpportunity,
      arv,
      maxOffer,
      equity,
      equityPercent: equityPercent.toFixed(1),
      excessFundsFee,
      wholesaleFee,
      totalFeePotential,
    })
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
        🤖 Eleanor AI Calculator
      </h2>

      {/* Input Section */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-gray-400 text-sm mb-1">Property Value ($)</label>
          <input
            type="number"
            value={inputs.propertyValue}
            onChange={(e) => setInputs({...inputs, propertyValue: Number(e.target.value)})}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
        </div>
        
        <div>
          <label className="block text-gray-400 text-sm mb-1">Repair Estimate ($)</label>
          <input
            type="number"
            value={inputs.repairEstimate}
            onChange={(e) => setInputs({...inputs, repairEstimate: Number(e.target.value)})}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={inputs.hasExcessFunds}
            onChange={(e) => setInputs({...inputs, hasExcessFunds: e.target.checked})}
            className="w-5 h-5"
          />
          <label className="text-gray-300">Has Excess Funds</label>
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-1">Excess Funds Amount ($)</label>
          <input
            type="number"
            value={inputs.excessFundsAmount}
            onChange={(e) => setInputs({...inputs, excessFundsAmount: Number(e.target.value)})}
            disabled={!inputs.hasExcessFunds}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={inputs.isDistressed}
            onChange={(e) => setInputs({...inputs, isDistressed: e.target.checked})}
            className="w-5 h-5"
          />
          <label className="text-gray-300">Is Distressed Property</label>
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-1">Days Until Expiry</label>
          <input
            type="number"
            value={inputs.daysUntilExpiry || ''}
            onChange={(e) => setInputs({...inputs, daysUntilExpiry: e.target.value ? Number(e.target.value) : null})}
            placeholder="Leave empty if N/A"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
        </div>
      </div>

      <button
        onClick={calculateEleanorScore}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all"
      >
        🧮 Calculate Eleanor Score
      </button>

      {/* Results Section */}
      {results && (
        <div className="mt-6 space-y-4">
          {/* Score Display */}
          <div className="text-center p-6 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl border border-cyan-500/30">
            <div className="text-6xl font-bold text-cyan-400">{results.score}</div>
            <div className="text-2xl font-bold text-white mt-2">
              Grade: <span className={`
                ${results.grade === 'S' ? 'text-purple-400' : ''}
                ${results.grade === 'A' ? 'text-green-400' : ''}
                ${results.grade === 'B' ? 'text-blue-400' : ''}
                ${results.grade === 'C' ? 'text-yellow-400' : ''}
                ${results.grade === 'D' ? 'text-orange-400' : ''}
                ${results.grade === 'F' ? 'text-red-400' : ''}
              `}>{results.grade}</span>
            </div>
            <div className={`text-lg mt-2 px-4 py-1 rounded-full inline-block ${
              results.opportunityTier === 'PLATINUM' ? 'bg-purple-500/20 text-purple-300' :
              results.opportunityTier === 'GOLD' ? 'bg-yellow-500/20 text-yellow-300' :
              results.opportunityTier.includes('SILVER') ? 'bg-gray-500/20 text-gray-300' :
              'bg-orange-500/20 text-orange-300'
            }`}>
              {results.opportunityTier} TIER
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Deal Quality</div>
              <div className="text-xl font-bold text-white">{results.dealQuality}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Motivation</div>
              <div className="text-xl font-bold text-white">{results.motivationLevel}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Contact Priority</div>
              <div className={`text-xl font-bold ${
                results.contactPriority === 'IMMEDIATE' ? 'text-red-400' :
                results.contactPriority === 'TODAY' ? 'text-orange-400' :
                'text-yellow-400'
              }`}>{results.contactPriority}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Dual Opportunity</div>
              <div className="text-xl font-bold">
                {results.isDualOpportunity ? '✅ YES (35%)' : '❌ No'}
              </div>
            </div>
          </div>

          {/* Financial Calculations */}
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4 rounded-lg border border-green-500/30">
            <h3 className="text-green-400 font-bold mb-3">💰 Financial Analysis</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">ARV Estimate:</span>
                <span className="text-white ml-2">${results.arv.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Max Offer (70%):</span>
                <span className="text-white ml-2">${results.maxOffer.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Excess Funds Fee (25%):</span>
                <span className="text-green-400 ml-2">${results.excessFundsFee.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Wholesale Fee (10%):</span>
                <span className="text-green-400 ml-2">${results.wholesaleFee.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-green-500/30 text-center">
              <div className="text-gray-400 text-sm">TOTAL FEE POTENTIAL</div>
              <div className="text-3xl font-bold text-green-400">
                ${results.totalFeePotential.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// PART 7: MAIN DASHBOARD PAGE WITH REAL DATA
// File: pages/index.jsx (or app/page.jsx for App Router)
// ============================================================

import React from 'react'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'
import { useGoldenOpportunities } from '../hooks/useGoldenOpportunities'
import { useCallQueue } from '../hooks/useCallQueue'
import { EleanorCalculator } from '../components/EleanorCalculator'

export default function Dashboard() {
  const { metrics, loading: metricsLoading } = useDashboardMetrics()
  const { opportunities, loading: oppsLoading } = useGoldenOpportunities(10)
  const { queue, loading: queueLoading } = useCallQueue()

  if (metricsLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading MaxSam V4...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          MaxSam V4 Command Center
        </h1>
        <p className="text-gray-400 mt-2">Real-time wholesale real estate automation</p>
      </header>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard 
          title="Total Leads" 
          value={metrics?.total_leads || 0} 
          icon="📊"
        />
        <MetricCard 
          title="Dual Opportunities" 
          value={metrics?.dual_opportunities || 0} 
          icon="🔥"
          highlight
        />
        <MetricCard 
          title="Expiring Critical" 
          value={metrics?.expiring_critical || 0} 
          icon="⏰"
          urgent
        />
        <MetricCard 
          title="Potential Fees" 
          value={`$${((metrics?.potential_recovery_fees || 0) + (metrics?.potential_wholesale_fees || 0)).toLocaleString()}`} 
          icon="💰"
        />
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-gray-400 text-sm">Total Excess Funds</div>
          <div className="text-3xl font-bold text-green-400">
            ${(metrics?.total_excess_funds || 0).toLocaleString()}
          </div>
          <div className="text-gray-500 text-sm mt-1">
            Recovery potential: ${(metrics?.potential_recovery_fees || 0).toLocaleString()} (25%)
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-gray-400 text-sm">Wholesale Fee Potential</div>
          <div className="text-3xl font-bold text-blue-400">
            ${(metrics?.potential_wholesale_fees || 0).toLocaleString()}
          </div>
          <div className="text-gray-500 text-sm mt-1">
            From {metrics?.distressed_leads || 0} distressed properties
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-gray-400 text-sm">Avg Eleanor Score</div>
          <div className="text-3xl font-bold text-purple-400">
            {metrics?.avg_eleanor_score || 0}/100
          </div>
          <div className="text-gray-500 text-sm mt-1">
            Lead quality indicator
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Golden Opportunities Table */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
            ⭐ Golden Opportunities
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Tier</th>
                  <th className="text-right py-2">Fee Potential</th>
                  <th className="text-right py-2">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                    <td className="py-3 text-white">{opp.property_address?.substring(0, 30)}...</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        opp.opportunity_tier === 'PLATINUM' ? 'bg-purple-500/20 text-purple-300' :
                        opp.opportunity_tier === 'GOLD' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {opp.opportunity_tier}
                      </span>
                    </td>
                    <td className="py-3 text-right text-green-400">
                      ${(opp.total_fee_potential || 0).toLocaleString()}
                    </td>
                    <td className={`py-3 text-right ${
                      opp.days_until_expiry <= 60 ? 'text-red-400 font-bold' :
                      opp.days_until_expiry <= 120 ? 'text-orange-400' :
                      'text-gray-400'
                    }`}>
                      {opp.days_until_expiry || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Eleanor Calculator */}
        <EleanorCalculator />
      </div>

      {/* Sam's Call Queue */}
      <div className="mt-6 bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
          📞 Sam's Call Queue ({queue.length} leads)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left py-2">Owner</th>
                <th className="text-left py-2">Phone</th>
                <th className="text-left py-2">Priority</th>
                <th className="text-left py-2">Score</th>
                <th className="text-left py-2">Opening Line</th>
                <th className="text-center py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.slice(0, 10).map((lead, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                  <td className="py-3 text-white font-medium">{lead.owner_name}</td>
                  <td className="py-3 text-cyan-400">{lead.owner_phone}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      lead.eleanor_contact_priority === 'IMMEDIATE' ? 'bg-red-500/20 text-red-300' :
                      lead.eleanor_contact_priority === 'TODAY' ? 'bg-orange-500/20 text-orange-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {lead.eleanor_contact_priority}
                    </span>
                  </td>
                  <td className="py-3 text-purple-400 font-bold">{lead.eleanor_score}</td>
                  <td className="py-3 text-gray-400 text-xs max-w-xs truncate">
                    {lead.eleanor_opening_line}
                  </td>
                  <td className="py-3 text-center">
                    <button className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs mr-2">
                      Call
                    </button>
                    <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                      SMS
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon, highlight, urgent }) {
  return (
    <div className={`rounded-xl p-6 border ${
      highlight ? 'bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-500/30' :
      urgent ? 'bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-500/30' :
      'bg-gray-900 border-gray-800'
    }`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-gray-400 text-sm">{title}</div>
          <div className={`text-3xl font-bold mt-1 ${
            highlight ? 'text-yellow-400' :
            urgent ? 'text-red-400' :
            'text-white'
          }`}>
            {value}
          </div>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  )
}

// ============================================================
// PART 8: PACKAGE.JSON DEPENDENCIES
// Add these to your package.json
// ============================================================
/*
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "next": "14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}

Run: npm install @supabase/supabase-js
*/
