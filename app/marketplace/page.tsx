'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Megaphone, 
  Home, 
  DollarSign, 
  Search, 
  Scale, 
  Building, 
  Skull,
  ShoppingCart,
  TrendingUp,
  Users,
  Clock
} from 'lucide-react'

// Lead type categories with icons and pricing
const leadCategories = [
  { id: 'distressed', name: 'Distressed Seller', icon: Home, price: '$40-100/lead', color: 'text-red-400' },
  { id: 'excess_funds', name: 'Excess Funds', icon: DollarSign, price: '$40-100/lead', color: 'text-emerald-400' },
  { id: 'skip_trace', name: 'Skip Trace', icon: Search, price: '$15-35/lead', color: 'text-blue-400' },
  { id: 'mass_tort', name: 'Mass Tort', icon: Scale, price: '$150-300/lead', color: 'text-purple-400' },
  { id: 'unclaimed_property', name: 'Unclaimed Property', icon: Building, price: '$25-75/lead', color: 'text-amber-400' },
  { id: 'death_benefit', name: 'Death Benefit', icon: Skull, price: '$50-150/lead', color: 'text-slate-400' },
  { id: 'wholesale', name: 'Wholesale', icon: ShoppingCart, price: '$100-500/lead', color: 'text-cyan-400' },
]

interface MarketplaceLead {
  id: string
  type: string
  address?: string
  name?: string
  amount?: number
  price: number
  listedAt: string
  seller: string
}

export default function MarketplacePage() {
  const [leads, setLeads] = useState<MarketplaceLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalValue: 0,
    buyersReady: 8,
    categories: {} as Record<string, { count: number; value: number }>
  })

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/marketplace')
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads || [])
        calculateStats(data.leads || [])
      }
    } catch (error) {
      console.error('Failed to fetch marketplace leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (leadData: MarketplaceLead[]) => {
    const categories: Record<string, { count: number; value: number }> = {}
    let totalValue = 0

    leadData.forEach(lead => {
      if (!categories[lead.type]) {
        categories[lead.type] = { count: 0, value: 0 }
      }
      categories[lead.type].count++
      categories[lead.type].value += lead.price
      totalValue += lead.price
    })

    setStats({
      totalLeads: leadData.length,
      totalValue,
      buyersReady: 8,
      categories
    })
  }

  const handleBlastBuyers = async () => {
    // TODO: Implement buyer blast functionality
    alert('Blasting all buyers with available leads...')
  }

  const getCategoryIcon = (type: string) => {
    const cat = leadCategories.find(c => c.id === type)
    return cat?.icon || Home
  }

  const getCategoryColor = (type: string) => {
    const cat = leadCategories.find(c => c.id === type)
    return cat?.color || 'text-slate-400'
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header - Dark theme matching dashboard */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <ShoppingCart className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Lead Marketplace</h1>
                <p className="text-slate-400">Buy and sell verified leads to your network</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                <Users className="h-5 w-5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">{stats.buyersReady} Buyers Ready</span>
              </div>
              <Button 
                onClick={handleBlastBuyers}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Megaphone className="h-4 w-4 mr-2" />
                Blast All Buyers
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Category Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {leadCategories.map((category) => {
            const Icon = category.icon
            const catStats = stats.categories[category.id] || { count: 0, value: 0 }
            return (
              <Card 
                key={category.id}
                className={`bg-slate-900/50 border-slate-700 cursor-pointer transition-all hover:border-slate-500 ${
                  selectedCategory === category.id ? 'border-emerald-500 bg-slate-800/50' : ''
                }`}
                onClick={() => setSelectedCategory(
                  selectedCategory === category.id ? null : category.id
                )}
              >
                <CardContent className="p-4 text-center">
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${category.color}`} />
                  <p className="text-2xl font-bold text-white">{catStats.count}</p>
                  <p className="text-xs text-slate-400">{category.name}</p>
                  <p className="text-xs text-emerald-400 mt-1">
                    ${catStats.value.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Leads List */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Listed Leads
              {selectedCategory && (
                <Badge variant="outline" className="ml-2 border-emerald-500 text-emerald-400">
                  {leadCategories.find(c => c.id === selectedCategory)?.name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Loading marketplace...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4">
                  <Clock className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Leads Listed Yet</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  List leads for sale to populate your marketplace. Use the "List for Sale" 
                  button on any lead card to add it here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {leads
                  .filter(lead => !selectedCategory || lead.type === selectedCategory)
                  .map((lead) => {
                    const Icon = getCategoryIcon(lead.type)
                    return (
                      <div 
                        key={lead.id}
                        className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg bg-slate-700/50`}>
                            <Icon className={`h-5 w-5 ${getCategoryColor(lead.type)}`} />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {lead.name || lead.address || 'Lead #' + lead.id}
                            </p>
                            <p className="text-sm text-slate-400">
                              Listed by {lead.seller} • {new Date(lead.listedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {lead.amount && (
                            <div className="text-right">
                              <p className="text-sm text-slate-400">Potential</p>
                              <p className="font-semibold text-emerald-400">
                                ${lead.amount.toLocaleString()}
                              </p>
                            </div>
                          )}
                          <div className="text-right">
                            <p className="text-sm text-slate-400">Price</p>
                            <p className="font-bold text-white">${lead.price}</p>
                          </div>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                            Buy Lead
                          </Button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Guide */}
        <Card className="bg-slate-900/50 border-slate-700 mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Pricing Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {leadCategories.map((category) => {
                const Icon = category.icon
                return (
                  <div key={category.id} className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <Icon className={`h-6 w-6 mx-auto mb-2 ${category.color}`} />
                    <p className="text-sm font-medium text-white">{category.name}</p>
                    <p className="text-sm text-emerald-400 mt-1">{category.price}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}