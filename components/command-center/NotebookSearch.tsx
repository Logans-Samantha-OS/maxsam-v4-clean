'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/components/Toast'

interface NotebookLead {
  id: string
  owner_name: string
  property_address: string
  excess_funds_amount: number
  expiration_date: string | null
  county: string
  source: string
  selected: boolean
}

interface NotebookQueryResponse {
  answer: string
  sources: Array<{
    name: string
    type: string
    relevance: number
  }>
  cached: boolean
  cache_key: string
  timestamp: string
  routing: {
    county: string | null
    notebook: string
    region: string
    used_default: boolean
  }
}

interface ImportResult {
  imported: number
  duplicates: number
  errors: string[]
}

/**
 * Parse lead data from NotebookLM answer text
 * Attempts to extract structured lead information from the AI response
 */
function parseLeadsFromAnswer(answer: string): NotebookLead[] {
  const leads: NotebookLead[] = []

  // Look for patterns like:
  // - Sharon Denise Wright: $105,629.61
  // - Owner: John Smith, Amount: $50,000
  // - $300,000.00 - Property at 123 Main St

  const patterns = [
    // Pattern: "Name: $amount" or "Name - $amount"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)[\s:•\-–—]+\$?([\d,]+(?:\.\d{2})?)/g,
    // Pattern: "$amount - Name" or "$amount: Name"
    /\$?([\d,]+(?:\.\d{2})?)[\s:•\-–—]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
    // Pattern: "• Name ($amount)" or "- Name ($amount)"
    /[•\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\(\$?([\d,]+(?:\.\d{2})?)\)/g,
  ]

  const foundLeads = new Map<string, NotebookLead>()

  patterns.forEach(pattern => {
    let match
    const text = answer
    const regex = new RegExp(pattern.source, pattern.flags)

    while ((match = regex.exec(text)) !== null) {
      // Determine which group is name and which is amount
      let name: string
      let amountStr: string

      if (/^\d/.test(match[1])) {
        // First group is amount
        amountStr = match[1]
        name = match[2]
      } else {
        // First group is name
        name = match[1]
        amountStr = match[2]
      }

      // Parse amount
      const amount = parseFloat(amountStr.replace(/,/g, ''))

      // Skip if amount is too low (likely not a lead)
      if (amount < 1000) continue

      // Skip common non-name phrases
      const skipPhrases = ['Total', 'Amount', 'Funds', 'County', 'Dallas', 'Texas', 'Unnamed']
      if (skipPhrases.some(phrase => name.includes(phrase))) continue

      // Create unique key
      const key = `${name.toLowerCase()}-${amount}`

      if (!foundLeads.has(key)) {
        foundLeads.set(key, {
          id: `nb-${Date.now()}-${foundLeads.size}`,
          owner_name: name.trim(),
          property_address: 'Address pending skip trace',
          excess_funds_amount: amount,
          expiration_date: null,
          county: 'Dallas',
          source: 'NotebookLM',
          selected: false,
        })
      }
    }
  })

  // Also look for structured list items with amounts
  const lines = answer.split('\n')
  lines.forEach((line, idx) => {
    // Match lines with dollar amounts
    const amountMatch = line.match(/\$\s*([\d,]+(?:\.\d{2})?)/)
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
      if (amount >= 5000) {
        // Try to extract a name from the same line
        const nameMatch = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/)
        if (nameMatch) {
          const name = nameMatch[1]
          const key = `${name.toLowerCase()}-${amount}`

          if (!foundLeads.has(key)) {
            foundLeads.set(key, {
              id: `nb-${Date.now()}-${idx}`,
              owner_name: name.trim(),
              property_address: 'Address pending skip trace',
              excess_funds_amount: amount,
              expiration_date: null,
              county: 'Dallas',
              source: 'NotebookLM',
              selected: false,
            })
          }
        }
      }
    }
  })

  return Array.from(foundLeads.values())
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function NotebookSearch() {
  const { addToast } = useToast()
  const [query, setQuery] = useState('')
  const [county, setCounty] = useState('Dallas')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<NotebookQueryResponse | null>(null)
  const [leads, setLeads] = useState<NotebookLead[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      addToast('error', 'Please enter a search query')
      return
    }

    setLoading(true)
    setResults(null)
    setLeads([])
    setImportResult(null)

    try {
      const res = await fetch('/api/alex/notebook-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          county,
          question: query,
          max_results: 10,
        }),
      })

      const data: NotebookQueryResponse = await res.json()

      if (!res.ok) {
        throw new Error((data as unknown as { error: string }).error || 'Query failed')
      }

      setResults(data)

      // Parse leads from the answer
      const parsedLeads = parseLeadsFromAnswer(data.answer)
      setLeads(parsedLeads)

      if (parsedLeads.length > 0) {
        addToast('success', `Found ${parsedLeads.length} potential leads`)
      } else {
        addToast('info', 'Query completed - no structured lead data found')
      }
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [query, county, addToast])

  const toggleLeadSelection = (id: string) => {
    setLeads(prev =>
      prev.map(lead =>
        lead.id === id ? { ...lead, selected: !lead.selected } : lead
      )
    )
  }

  const selectAll = () => {
    setLeads(prev => prev.map(lead => ({ ...lead, selected: true })))
  }

  const deselectAll = () => {
    setLeads(prev => prev.map(lead => ({ ...lead, selected: false })))
  }

  const importLeads = async (selectedOnly: boolean) => {
    const leadsToImport = selectedOnly
      ? leads.filter(l => l.selected)
      : leads

    if (leadsToImport.length === 0) {
      addToast('error', 'No leads to import')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: leadsToImport.map(lead => ({
            owner_name: lead.owner_name,
            property_address: lead.property_address,
            excess_funds_amount: lead.excess_funds_amount,
            claim_deadline: lead.expiration_date,
            county: lead.county,
            source: lead.source,
            status: 'new',
          })),
          source: 'notebooklm',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      const result: ImportResult = {
        imported: data.inserted || data.count || leadsToImport.length,
        duplicates: data.duplicates || 0,
        errors: data.errors || [],
      }

      setImportResult(result)

      if (result.imported > 0) {
        addToast('success', `${result.imported} leads imported${result.duplicates > 0 ? `, ${result.duplicates} already existed` : ''}`)

        // Clear imported leads from the list
        if (selectedOnly) {
          setLeads(prev => prev.filter(l => !l.selected))
        } else {
          setLeads([])
        }
      } else if (result.duplicates > 0) {
        addToast('info', `All ${result.duplicates} leads already exist in pipeline`)
      }
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const selectedCount = leads.filter(l => l.selected).length
  const totalValue = leads.reduce((sum, l) => sum + l.excess_funds_amount, 0)
  const selectedValue = leads.filter(l => l.selected).reduce((sum, l) => sum + l.excess_funds_amount, 0)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📚</span>
        <div>
          <h2 className="text-lg font-semibold text-white">NotebookLM Search</h2>
          <p className="text-xs text-zinc-500">Query your knowledge base for leads</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-3">
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="Dallas">Dallas County</option>
            <option value="Tarrant">Tarrant County</option>
            <option value="Denton">Denton County</option>
            <option value="Collin">Collin County</option>
            <option value="Bexar">Bexar County</option>
            <option value="Travis">Travis County</option>
            <option value="Harris">Harris County</option>
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Query your notebooks..."
            className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Searching...
              </>
            ) : (
              <>
                🔍 Search Notebooks
              </>
            )}
          </button>
        </div>

        {/* Quick Queries */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-zinc-500">Quick queries:</span>
          {[
            'Excess funds over $50,000',
            'Leads expiring in 90 days',
            'Golden leads with phone numbers',
            'High-value claims with owner names',
          ].map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Routing Info */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>Notebook: <span className="text-zinc-300">{results.routing.notebook}</span></span>
            <span>•</span>
            <span>Region: <span className="text-zinc-300">{results.routing.region}</span></span>
            {results.cached && (
              <>
                <span>•</span>
                <span className="text-green-400">Cached</span>
              </>
            )}
          </div>

          {/* Raw Answer (collapsible) */}
          <details className="bg-zinc-800/50 rounded-lg">
            <summary className="px-4 py-2 cursor-pointer text-sm text-zinc-400 hover:text-white">
              View raw response ({results.sources.length} sources)
            </summary>
            <div className="px-4 py-3 text-sm text-zinc-300 whitespace-pre-wrap border-t border-zinc-700 max-h-48 overflow-y-auto">
              {results.answer}
            </div>
          </details>

          {/* Leads Table */}
          {leads.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-medium text-white">
                    Found {leads.length} Leads
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Total: {formatCurrency(totalValue)}
                  </span>
                  {selectedCount > 0 && (
                    <span className="text-xs text-purple-400">
                      Selected: {selectedCount} ({formatCurrency(selectedValue)})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="pb-2 pr-4 w-8">
                        <input
                          type="checkbox"
                          checked={selectedCount === leads.length && leads.length > 0}
                          onChange={() => selectedCount === leads.length ? deselectAll() : selectAll()}
                          className="rounded bg-zinc-700 border-zinc-600 text-purple-500"
                        />
                      </th>
                      <th className="pb-2 pr-4">Owner Name</th>
                      <th className="pb-2 pr-4">Property Address</th>
                      <th className="pb-2 pr-4 text-right">Excess Funds</th>
                      <th className="pb-2 pr-4">Expiration</th>
                      <th className="pb-2">County</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => toggleLeadSelection(lead.id)}
                        className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${
                          lead.selected ? 'bg-purple-900/20' : 'hover:bg-zinc-800/50'
                        }`}
                      >
                        <td className="py-2 pr-4">
                          <input
                            type="checkbox"
                            checked={lead.selected}
                            onChange={() => toggleLeadSelection(lead.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded bg-zinc-700 border-zinc-600 text-purple-500"
                          />
                        </td>
                        <td className="py-2 pr-4 text-white font-medium">{lead.owner_name}</td>
                        <td className="py-2 pr-4 text-zinc-400">{lead.property_address}</td>
                        <td className="py-2 pr-4 text-right text-green-400 font-medium">
                          {formatCurrency(lead.excess_funds_amount)}
                        </td>
                        <td className="py-2 pr-4 text-zinc-400">{formatDate(lead.expiration_date)}</td>
                        <td className="py-2 text-zinc-400">{lead.county}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => importLeads(true)}
                  disabled={importing || selectedCount === 0}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
                >
                  {importing ? 'Importing...' : `Import Selected (${selectedCount})`}
                </button>
                <button
                  onClick={() => importLeads(false)}
                  disabled={importing || leads.length === 0}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
                >
                  {importing ? 'Importing...' : `Import All (${leads.length})`}
                </button>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className={`p-3 rounded-lg ${
                  importResult.imported > 0 ? 'bg-green-900/20 border border-green-700/50' : 'bg-yellow-900/20 border border-yellow-700/50'
                }`}>
                  <p className="text-sm">
                    {importResult.imported > 0 && (
                      <span className="text-green-400">{importResult.imported} leads imported</span>
                    )}
                    {importResult.duplicates > 0 && (
                      <span className="text-yellow-400">, {importResult.duplicates} already existed</span>
                    )}
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 text-xs text-red-400">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No Leads Found */}
          {leads.length === 0 && results && (
            <div className="text-center py-6 text-zinc-500">
              <p className="text-lg mb-2">No structured leads extracted</p>
              <p className="text-sm">Try a more specific query like "Excess funds leads over $50,000 with owner names"</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!results && !loading && (
        <div className="text-center py-8 text-zinc-500">
          <p className="text-lg mb-2">Search your NotebookLM knowledge base</p>
          <p className="text-sm">Enter a query to find leads from your notebooks</p>
        </div>
      )}
    </div>
  )
}
