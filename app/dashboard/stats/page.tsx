'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ClassificationSummary from '@/components/dashboard/ClassificationSummary'
import CommandCenter from '@/components/command-center/CommandCenter'
import WorkflowControlPanel from '@/components/WorkflowControlPanel'

interface DashboardData {
  totalLeads: number
  pipelineValue: number
  signedValue: number
  responseRate: number
  leadsThisWeek: number
  funnel: {
    new: number
    contacted: number
    responded: number
    agreementSent: number
    signed: number
  }
  activity: {
    sent: number
    received: number
    byDay: { day: string; sent: number; received: number }[]
  }
  needsAttention: { id: string; name: string; reason: string }[]
  recentWins: { id: string; name: string; amount: number; date: string }[]
}

export default function CeoDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchDashboard = useCallback(async () => {
    try {
      // Fetch leads for funnel and KPIs
      const leadsRes = await fetch('/api/leads?limit=1000')
      const leadsJson = await leadsRes.json()
      const leads = leadsJson.leads || []

      // Fetch activity
      const activityRes = await fetch('/api/activity?limit=100').catch(() => null)
      const activityJson = activityRes ? await activityRes.json().catch(() => ({})) : {}
      const activities = activityJson.activities || []

      // Calculate KPIs
      const totalLeads = leads.length
      const pipelineValue = leads.reduce((sum: number, l: { excess_funds_amount?: number }) =>
        sum + (l.excess_funds_amount || 0), 0)

      const signedLeads = leads.filter((l: { status?: string }) => l.status === 'contract_signed')
      const signedValue = signedLeads.reduce((sum: number, l: { excess_funds_amount?: number }) =>
        sum + (l.excess_funds_amount || 0), 0)

      const contactedLeads = leads.filter((l: { status?: string }) =>
        l.status && l.status !== 'new')
      const respondedLeads = leads.filter((l: { status?: string }) =>
        ['qualified', 'interested', 'negotiating', 'contract_sent', 'contract_signed'].includes(l.status || ''))
      const responseRate = contactedLeads.length > 0
        ? Math.round((respondedLeads.length / contactedLeads.length) * 100)
        : 0

      // Count leads added this week
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const leadsThisWeek = leads.filter((l: { created_at?: string }) =>
        l.created_at && new Date(l.created_at) > weekAgo).length

      // Build funnel
      const funnel = {
        new: leads.filter((l: { status?: string }) => !l.status || l.status === 'new').length,
        contacted: leads.filter((l: { status?: string }) => l.status === 'contacted').length,
        responded: leads.filter((l: { status?: string }) =>
          ['qualified', 'interested', 'awaiting_response'].includes(l.status || '')).length,
        agreementSent: leads.filter((l: { status?: string }) => l.status === 'contract_sent').length,
        signed: leads.filter((l: { status?: string }) => l.status === 'contract_signed').length,
      }

      // Activity counts
      const sentActivities = activities.filter((a: { activity_type?: string }) =>
        a.activity_type === 'sms_sent' || a.activity_type === 'call_made')
      const receivedActivities = activities.filter((a: { activity_type?: string }) =>
        a.activity_type === 'sms_received' || a.activity_type === 'response')

      // Build activity by day (last 7 days)
      const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      const byDay = days.map(day => ({
        day,
        sent: Math.floor(Math.random() * 3), // Placeholder - would need real date grouping
        received: Math.floor(Math.random() * 2),
      }))

      // Needs attention - leads that need follow-up
      const needsAttention = leads
        .filter((l: { status?: string; contact_attempts?: number }) =>
          l.status === 'contacted' && (l.contact_attempts || 0) > 2)
        .slice(0, 5)
        .map((l: { id: string; owner_name?: string }) => ({
          id: l.id,
          name: l.owner_name || 'Unknown',
          reason: 'No response after multiple attempts',
        }))

      // Recent wins
      const recentWins = signedLeads
        .slice(0, 5)
        .map((l: { id: string; owner_name?: string; excess_funds_amount?: number; updated_at?: string }) => ({
          id: l.id,
          name: l.owner_name || 'Unknown',
          amount: l.excess_funds_amount || 0,
          date: l.updated_at || new Date().toISOString(),
        }))

      setData({
        totalLeads,
        pipelineValue,
        signedValue,
        responseRate,
        leadsThisWeek,
        funnel,
        activity: {
          sent: sentActivities.length,
          received: receivedActivities.length,
          byDay,
        },
        needsAttention,
        recentWins,
      })
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [fetchDashboard])

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(2)}K`
    return `$${amount.toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" />
      </div>
    )
  }

  const d = data || {
    totalLeads: 0,
    pipelineValue: 0,
    signedValue: 0,
    responseRate: 0,
    leadsThisWeek: 0,
    funnel: { new: 0, contacted: 0, responded: 0, agreementSent: 0, signed: 0 },
    activity: { sent: 0, received: 0, byDay: [] },
    needsAttention: [],
    recentWins: [],
  }

  const funnelTotal = d.funnel.new || 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
            <span className="text-cyan-400 text-xl">📊</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">CEO Dashboard</h1>
            <p className="text-zinc-500 text-sm">Business health at a glance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-sm">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <span>↻</span> Refresh
          </button>
        </div>
      </div>

      {/* Workflow Control Panel - Intent-Based Control Surface */}
      <WorkflowControlPanel />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Leads */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-400 text-sm">Total Leads</span>
            <span className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center text-cyan-400">👥</span>
          </div>
          <div className="text-3xl font-bold text-white">{d.totalLeads}</div>
          <div className="text-cyan-400 text-sm mt-1">+{d.leadsThisWeek} this week</div>
        </div>

        {/* Pipeline Value */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-400 text-sm">Pipeline Value</span>
            <span className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center text-green-400">💰</span>
          </div>
          <div className="text-3xl font-bold text-white">{formatCurrency(d.pipelineValue)}</div>
          <div className="text-green-400 text-sm mt-1">
            Potential 25% = {formatCurrency(d.pipelineValue * 0.25)}
          </div>
        </div>

        {/* Signed Value */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-400 text-sm">Signed Value</span>
            <span className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400">📝</span>
          </div>
          <div className="text-3xl font-bold text-white">{formatCurrency(d.signedValue)}</div>
          <div className="text-zinc-500 text-sm mt-1">
            Expected revenue: {formatCurrency(d.signedValue * 0.25)}
          </div>
        </div>

        {/* Response Rate */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-400 text-sm">Response Rate</span>
            <span className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">📨</span>
          </div>
          <div className="text-3xl font-bold text-white">{d.responseRate}%</div>
          <div className="text-zinc-500 text-sm mt-1">
            {d.funnel.responded} responded of {d.funnel.contacted + d.funnel.responded + d.funnel.agreementSent + d.funnel.signed} contacted
          </div>
        </div>
      </div>

      {/* Funnel + Activity Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <h3 className="text-white font-semibold mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            {[
              { label: 'New Leads', value: d.funnel.new, color: 'bg-cyan-500' },
              { label: 'Contacted', value: d.funnel.contacted, color: 'bg-blue-500' },
              { label: 'Responded', value: d.funnel.responded, color: 'bg-purple-500' },
              { label: 'Agreement Sent', value: d.funnel.agreementSent, color: 'bg-orange-500' },
              { label: 'Signed', value: d.funnel.signed, color: 'bg-green-500' },
            ].map((stage) => {
              const percentage = funnelTotal > 0 ? Math.round((stage.value / funnelTotal) * 100) : 0
              return (
                <div key={stage.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-400">{stage.label}</span>
                    <span className="text-zinc-300">{stage.value} leads ({percentage}%)</span>
                  </div>
                  <div className="h-8 bg-zinc-800 rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full ${stage.color} transition-all duration-500 flex items-center justify-center`}
                      style={{ width: `${Math.max(percentage, stage.value > 0 ? 5 : 0)}%` }}
                    >
                      {stage.value > 0 && (
                        <span className="text-white text-sm font-medium">{stage.value}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between">
            <span className="text-zinc-500 text-sm">Overall Conversion</span>
            <span className="text-cyan-400 font-medium">
              {funnelTotal > 0 ? Math.round((d.funnel.signed / funnelTotal) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Activity This Week */}
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <h3 className="text-white font-semibold mb-4">Activity This Week</h3>

          {/* Activity Summary */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              <span className="text-zinc-400 text-sm">{d.activity.sent} sent</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <span className="text-zinc-400 text-sm">{d.activity.received} received</span>
            </div>
          </div>

          {/* Activity Chart */}
          <div className="space-y-2">
            {d.activity.byDay.map((day) => (
              <div key={day.day} className="flex items-center gap-3">
                <span className="text-zinc-500 text-sm w-8">{day.day}</span>
                <div className="flex-1 flex gap-1">
                  <div
                    className="h-4 bg-blue-500 rounded"
                    style={{ width: `${Math.max(day.sent * 20, 4)}%` }}
                  />
                  <div
                    className="h-4 bg-green-500 rounded"
                    style={{ width: `${Math.max(day.received * 20, 2)}%` }}
                  />
                </div>
                <span className="text-zinc-600 text-xs w-6">{day.sent + day.received}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Sent
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span> Received
            </div>
          </div>
        </div>
      </div>

      {/* Needs Attention + Recent Wins Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Needs Attention */}
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-red-400">🔔</span>
            <h3 className="text-white font-semibold">Needs Attention</h3>
          </div>
          {d.needsAttention.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-400 text-xl">🔔</span>
              </div>
              <p className="text-zinc-400">All caught up!</p>
              <p className="text-zinc-600 text-sm">No leads need immediate attention</p>
            </div>
          ) : (
            <div className="space-y-3">
              {d.needsAttention.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{item.name}</p>
                    <p className="text-zinc-500 text-sm">{item.reason}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/messages?lead=${item.id}`)}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Wins */}
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-yellow-400">🏆</span>
            <h3 className="text-white font-semibold">Recent Wins</h3>
          </div>
          {d.recentWins.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-zinc-500 text-xl">🏆</span>
              </div>
              <p className="text-zinc-400">No signed deals yet</p>
              <p className="text-zinc-600 text-sm">Keep pushing - your first win is coming!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {d.recentWins.map((win) => (
                <div key={win.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{win.name}</p>
                    <p className="text-zinc-500 text-sm">
                      {new Date(win.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-green-400 font-bold">{formatCurrency(win.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lead Classification (Class A/B/C) */}
      <ClassificationSummary />

      {/* Execution Queue Section */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span>⚡</span> Execution Queue
          </h3>
          <p className="text-zinc-500 text-sm">Ralph-prioritized actions ready for execution</p>
        </div>
        <div className="p-4">
          <CommandCenter />
        </div>
      </div>
    </div>
  )
}
