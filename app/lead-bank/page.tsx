'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Database,
  Search,
  Download,
  Upload,
  RefreshCw,
  Home,
  DollarSign,
  MapPin,
  Calendar,
  TrendingUp,
  Star,
  Eye,
  MessageSquare,
  FileText,
  Building,
  Users,
  AlertTriangle
} from 'lucide-react'

interface ExcessFund {
  id: string
  defendant_name: string
  case_number: string
  county: string
  excess_amount: number
  property_address?: string
  sale_date?: string
  redemption_deadline?: string
  status?: string
  is_golden_lead?: boolean
}

interface Property {
  id: string
  address: string
  city: string
  state: string
  county: string
  owner_name: string
  estimated_value: number
  estimated_equity: number
  equity_percent: number
  lead_types: string[]
  auction_date?: string
  foreclosure_auction_date?: string
  property_type: string
  bedrooms: number
  bathrooms: number
  sqft: number
  year_built: number
  opportunity_tier: string
  distress_score: number
}

interface ApiResponse {
  success: boolean
  summary: {
    totalExcessFunds: number
    totalPropertyEquity: number
    combinedOpportunity: number
    excessFundsCount: number
    propertyCount: number
    goldenLeadCount: number
  }
  countyBreakdown: Record<string, { excessFunds: number; properties: number; totalValue: number }>
  amountTiers: {
    tier1_under5k: number
    tier2_5k_25k: number
    tier3_25k_50k: number
    tier4_50k_100k: number
    tier5_over100k: number
  }
  leads: {
    excessFunds: ExcessFund[]
    properties: Property[]
  }
}

const tierColors: Record<string, string> = {
  golden: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hot: 'bg-red-500/20 text-red-400 border-red-500/30',
  warm: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  cold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

export default function LeadBankPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'excess' | 'properties'>('excess')
  const [countyFilter, setCountyFilter] = useState<string | null>(null)

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lead-bank')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredExcessFunds = (data?.leads.excessFunds || []).filter(fund => {
    const matchesSearch = !searchTerm || 
      fund.defendant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fund.case_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fund.property_address?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCounty = !countyFilter || fund.county === countyFilter

    return matchesSearch && matchesCounty
  })

  const filteredProperties = (data?.leads.properties || []).filter(prop => {
    const matchesSearch = !searchTerm || 
      prop.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.city?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCounty = !countyFilter || prop.county?.toLowerCase().includes(countyFilter.toLowerCase())

    return matchesSearch && matchesCounty
  })

  const counties = data?.countyBreakdown ? Object.keys(data.countyBreakdown) : []

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <Database className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Lead Bank</h1>
                <p className="text-slate-400">Excess Funds + Property Intelligence</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button 
                onClick={fetchLeads}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Excess Funds</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    ${((data?.summary.totalExcessFunds || 0) / 1000000).toFixed(2)}M
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <DollarSign className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">{data?.summary.excessFundsCount || 0} records</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Property Equity</p>
                  <p className="text-2xl font-bold text-blue-400">
                    ${((data?.summary.totalPropertyEquity || 0) / 1000000).toFixed(2)}M
                  </p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Building className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">{data?.summary.propertyCount || 0} properties</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Combined</p>
                  <p className="text-2xl font-bold text-white">
                    ${((data?.summary.combinedOpportunity || 0) / 1000000).toFixed(2)}M
                  </p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-purple-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Total opportunity</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Golden Leads</p>
                  <p className="text-2xl font-bold text-amber-400">
                    {data?.summary.goldenLeadCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <Star className="h-6 w-6 text-amber-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Dual opportunity</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Potential (25%)</p>
                  <p className="text-2xl font-bold text-white">
                    ${(((data?.summary.totalExcessFunds || 0) * 0.25) / 1000000).toFixed(2)}M
                  </p>
                </div>
                <div className="p-3 bg-slate-500/20 rounded-xl">
                  <DollarSign className="h-6 w-6 text-slate-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Revenue potential</p>
            </CardContent>
          </Card>
        </div>

        {/* County Breakdown */}
        {counties.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">County Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {counties.map(county => (
                <button
                  key={county}
                  onClick={() => setCountyFilter(countyFilter === county ? null : county)}
                  className={`p-4 rounded-xl border transition-all ${
                    countyFilter === county
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <p className="font-medium text-sm">{county}</p>
                  <p className="text-lg font-bold">
                    ${((data?.countyBreakdown[county]?.excessFunds || 0) / 1000).toFixed(0)}K
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('excess')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'excess'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="h-4 w-4 inline mr-2" />
              Excess Funds ({data?.summary.excessFundsCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('properties')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'properties'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building className="h-4 w-4 inline mr-2" />
              Properties ({data?.summary.propertyCount || 0})
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={activeTab === 'excess' ? "Search by defendant, case #, address..." : "Search by address, owner, city..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          {countyFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCountyFilter(null)}
              className="border-slate-600 text-slate-300"
            >
              Clear: {countyFilter}
            </Button>
          )}
        </div>

        {/* Data Table */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Loading data...</p>
              </div>
            ) : activeTab === 'excess' ? (
              /* EXCESS FUNDS TABLE */
              filteredExcessFunds.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4">
                    <DollarSign className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Excess Funds Found</h3>
                  <p className="text-slate-400 max-w-md mx-auto">
                    {searchTerm || countyFilter ? 'Try adjusting your filters' : 'Import county excess funds data to get started'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/50">
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Defendant</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Case #</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">County</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Amount</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Deadline</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExcessFunds.map((fund) => (
                        <tr 
                          key={fund.id} 
                          className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {fund.is_golden_lead && (
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                              )}
                              <div>
                                <p className="font-medium text-white">{fund.defendant_name}</p>
                                {fund.property_address && (
                                  <p className="text-sm text-slate-400">{fund.property_address}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-slate-300 font-mono text-sm">{fund.case_number}</p>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {fund.county}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <p className="text-emerald-400 font-bold text-lg">
                              ${fund.excess_amount?.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500">
                              25% = ${((fund.excess_amount || 0) * 0.25).toLocaleString()}
                            </p>
                          </td>
                          <td className="p-4">
                            {fund.redemption_deadline ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-300">
                                  {new Date(fund.redemption_deadline).toLocaleDateString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* PROPERTIES TABLE */
              filteredProperties.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4">
                    <Building className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Properties Found</h3>
                  <p className="text-slate-400 max-w-md mx-auto">
                    {searchTerm || countyFilter ? 'Try adjusting your filters' : 'Import Propwire data to populate property intelligence'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/50">
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Property</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Owner</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Value</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Equity</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Tier</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Auction</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProperties.map((prop) => (
                        <tr 
                          key={prop.id} 
                          className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-white">{prop.address}</p>
                              <p className="text-sm text-slate-400">
                                {prop.city}, {prop.state} • {prop.county}
                              </p>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {(prop.lead_types || []).slice(0, 3).map((type, i) => (
                                  <Badge 
                                    key={i} 
                                    variant="outline" 
                                    className="text-xs border-slate-600 text-slate-400"
                                  >
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-white">{prop.owner_name}</p>
                            <p className="text-sm text-slate-400">
                              {prop.bedrooms}bd/{prop.bathrooms}ba • {prop.sqft?.toLocaleString()} sqft
                            </p>
                          </td>
                          <td className="p-4">
                            <p className="text-white font-medium">
                              ${prop.estimated_value?.toLocaleString()}
                            </p>
                          </td>
                          <td className="p-4">
                            <p className="text-emerald-400 font-bold">
                              ${prop.estimated_equity?.toLocaleString()}
                            </p>
                            <p className="text-sm text-slate-400">{prop.equity_percent}%</p>
                          </td>
                          <td className="p-4">
                            <Badge className={tierColors[prop.opportunity_tier] || tierColors.cold}>
                              {prop.opportunity_tier || 'cold'}
                            </Badge>
                            <p className="text-xs text-slate-500 mt-1">Score: {prop.distress_score}</p>
                          </td>
                          <td className="p-4">
                            {(prop.auction_date || prop.foreclosure_auction_date) ? (
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                                <span className="text-red-400 text-sm">
                                  {new Date(prop.auction_date || prop.foreclosure_auction_date!).toLocaleDateString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Amount Tiers Summary */}
        {activeTab === 'excess' && data?.amountTiers && (
          <div className="mt-6 grid grid-cols-5 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-xs">Under $5K</p>
              <p className="text-xl font-bold text-slate-300">{data.amountTiers.tier1_under5k}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-xs">$5K - $25K</p>
              <p className="text-xl font-bold text-blue-400">{data.amountTiers.tier2_5k_25k}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-xs">$25K - $50K</p>
              <p className="text-xl font-bold text-purple-400">{data.amountTiers.tier3_25k_50k}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-xs">$50K - $100K</p>
              <p className="text-xl font-bold text-amber-400">{data.amountTiers.tier4_50k_100k}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-xs">Over $100K</p>
              <p className="text-xl font-bold text-emerald-400">{data.amountTiers.tier5_over100k}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
