'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Database,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Home,
  DollarSign,
  MapPin,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Star,
  MoreVertical,
  Eye,
  MessageSquare,
  FileText
} from 'lucide-react'

interface Lead {
  id: string
  address: string
  city: string
  state: string
  zip: string
  ownerName: string
  estimatedValue: number
  estimatedEquity: number
  equityPercentage: number
  leadTypes: string[]
  auctionDate?: string
  propertyType: string
  bedrooms: number
  bathrooms: number
  sqft: number
  yearBuilt: number
  status: 'new' | 'contacted' | 'negotiating' | 'closed' | 'dead'
  isGoldenLead: boolean
  source: string
  createdAt: string
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  negotiating: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  closed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  dead: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export default function LeadBankPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    golden: 0,
    totalEquity: 0,
    newThisWeek: 0
  })

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/lead-bank')
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads || [])
        calculateStats(data.leads || [])
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (leadData: Lead[]) => {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    setStats({
      total: leadData.length,
      golden: leadData.filter(l => l.isGoldenLead).length,
      totalEquity: leadData.reduce((sum, l) => sum + (l.estimatedEquity || 0), 0),
      newThisWeek: leadData.filter(l => new Date(l.createdAt) > oneWeekAgo).length
    })
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm || 
      lead.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.city.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !statusFilter || lead.status === statusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header - Dark theme matching dashboard */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <Database className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Lead Bank</h1>
                <p className="text-slate-400">All your property leads in one place</p>
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
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Leads</p>
                  <p className="text-3xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Database className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-emerald-400 mt-2">+{stats.newThisWeek} this week</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Golden Leads</p>
                  <p className="text-3xl font-bold text-amber-400">{stats.golden}</p>
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
                  <p className="text-sm text-slate-400">Total Equity</p>
                  <p className="text-3xl font-bold text-emerald-400">
                    ${(stats.totalEquity / 1000000).toFixed(2)}M
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">In pipeline</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Potential (25%)</p>
                  <p className="text-3xl font-bold text-white">
                    ${((stats.totalEquity * 0.25) / 1000000).toFixed(2)}M
                  </p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <DollarSign className="h-6 w-6 text-purple-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Revenue opportunity</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by address, owner, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {['new', 'contacted', 'negotiating', 'closed'].map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                className={`capitalize ${
                  statusFilter === status 
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' 
                    : 'border-slate-600 text-slate-400 hover:bg-slate-800'
                }`}
                onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        {/* Leads Table */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Loading leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4">
                  <Database className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Leads Yet</h3>
                <p className="text-slate-400 max-w-md mx-auto mb-6">
                  Import property data from Propwire or add leads manually to get started.
                </p>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Leads
                </Button>
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
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr 
                        key={lead.id} 
                        className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {lead.isGoldenLead && (
                              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                            )}
                            <div>
                              <p className="font-medium text-white">{lead.address}</p>
                              <p className="text-sm text-slate-400">
                                {lead.city}, {lead.state} {lead.zip}
                              </p>
                              <div className="flex gap-1 mt-1">
                                {lead.leadTypes.slice(0, 2).map((type, i) => (
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
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-white">{lead.ownerName}</p>
                          <p className="text-sm text-slate-400">
                            {lead.bedrooms}bd/{lead.bathrooms}ba • {lead.sqft?.toLocaleString()} sqft
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-white font-medium">
                            ${lead.estimatedValue?.toLocaleString()}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-emerald-400 font-medium">
                            ${lead.estimatedEquity?.toLocaleString()}
                          </p>
                          <p className="text-sm text-slate-400">{lead.equityPercentage}%</p>
                        </td>
                        <td className="p-4">
                          <Badge className={statusColors[lead.status]}>
                            {lead.status}
                          </Badge>
                          {lead.auctionDate && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(lead.auctionDate).toLocaleDateString()}
                            </p>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}