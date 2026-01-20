'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ============================================================================
// Types
// ============================================================================

interface PacketData {
  id: string
  client_name: string
  property_address: string
  selection_code: 1 | 2 | 3
  excess_funds_amount: number
  total_fee: number
  status: string
  agreement_type: string
  documents: Array<{
    id: string
    document_type: string
    status: string
  }>
}

// ============================================================================
// Agreement Text Templates
// ============================================================================

const EXCESS_FUNDS_SUMMARY = `
This Excess Funds Recovery Agreement authorizes MaxSam Real Estate to act on your behalf to recover foreclosure excess funds owed to you by Dallas County.

Key Terms:
• Service Fee: 25% of recovered funds (contingency - no recovery, no fee)
• MaxSam will handle all paperwork, court filings, and communication with the county
• You retain all rights to your funds; we only collect our fee upon successful recovery
• Timeline: Most claims are processed within 30-90 days
`;

const WHOLESALE_SUMMARY = `
This Real Estate Assignment Agreement authorizes MaxSam Real Estate to market and assign your property to qualified buyers.

Key Terms:
• Assignment Fee: 10% of purchase price
• 10-day inspection period for buyer due diligence
• MaxSam will connect you with cash buyers in our investor network
• You maintain property ownership until closing
`;

const DUAL_DEAL_SUMMARY = `
This Combined Agreement covers both Excess Funds Recovery AND Real Estate Assignment services.

Excess Funds Recovery:
• Service Fee: 25% of recovered funds (contingency basis)
• MaxSam handles all county paperwork and filings

Real Estate Assignment:
• Assignment Fee: 10% of purchase price
• 10-day inspection period
• Access to our cash buyer network
`;

// ============================================================================
// Main Sign Page Component
// ============================================================================

export default function SignPage() {
  const params = useParams()
  const router = useRouter()
  const packetId = params.packetId as string

  const [packet, setPacket] = useState<PacketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Form state
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeFee, setAgreeFee] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [signDate] = useState(new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }))

  // Load packet data
  useEffect(() => {
    async function loadPacket() {
      try {
        const res = await fetch(`/api/sign/${packetId}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load agreement')
        }

        if (data.packet.status === 'signed') {
          setSuccess(true)
        }

        setPacket(data.packet)

        // Log view event
        await fetch(`/api/sign/${packetId}/view`, { method: 'POST' })

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agreement')
      } finally {
        setLoading(false)
      }
    }

    if (packetId) {
      loadPacket()
    }
  }, [packetId])

  // Handle signature submission
  async function handleSign() {
    if (!agreeTerms || !agreeFee || !typedName.trim()) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/sign/${packetId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typed_name: typedName.trim(),
          agree_terms: agreeTerms,
          agree_fee: agreeFee,
          signed_at: new Date().toISOString(),
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit signature')
      }

      setSuccess(true)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit signature')
    } finally {
      setSubmitting(false)
    }
  }

  // Get agreement summary based on selection code
  function getAgreementSummary() {
    if (!packet) return ''
    switch (packet.selection_code) {
      case 1: return EXCESS_FUNDS_SUMMARY
      case 2: return WHOLESALE_SUMMARY
      case 3: return DUAL_DEAL_SUMMARY
      default: return ''
    }
  }

  // Check if name matches (case-insensitive, trimmed)
  const nameMatches = typedName.trim().toLowerCase() === packet?.client_name?.toLowerCase()
  const canSign = agreeTerms && agreeFee && nameMatches && !submitting

  // ============================================================================
  // Loading State
  // ============================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Loading your agreement...</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // Error State
  // ============================================================================
  if (error && !packet) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Unable to Load Agreement</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <p className="text-slate-500 text-sm">
            If this problem persists, please contact us.
          </p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // Success State
  // ============================================================================
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-2">Agreement Signed!</h1>
          <p className="text-slate-400 mb-6">
            Thank you, {packet?.client_name?.split(' ')[0]}! Your agreement has been successfully signed.
          </p>
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
            <p className="text-green-400 font-medium">What happens next?</p>
            <p className="text-green-300 text-sm mt-1">
              We&apos;ll start processing your claim right away. Most claims complete within 30-60 days.
              We&apos;ll keep you updated via text message.
            </p>
          </div>
          <p className="text-slate-500 text-sm">
            You can close this page now.
          </p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // Main Signing Form
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">MaxSam Real Estate</h1>
          <p className="text-slate-400">Sign your agreement securely online</p>
        </div>

        {/* Agreement Card */}
        <div className="bg-slate-800 rounded-xl shadow-xl overflow-hidden">
          {/* Client Info Header */}
          <div className="bg-blue-600 p-6">
            <h2 className="text-xl font-bold text-white">{packet?.agreement_type}</h2>
            <p className="text-blue-200 mt-1">Prepared for: {packet?.client_name}</p>
          </div>

          {/* Property Details */}
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Property Details
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Property:</span>
                <span className="text-white font-medium">{packet?.property_address || 'N/A'}</span>
              </div>
              {packet?.excess_funds_amount && packet.excess_funds_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Available Funds:</span>
                  <span className="text-green-400 font-bold">
                    ${packet.excess_funds_amount.toLocaleString()}
                  </span>
                </div>
              )}
              {packet?.total_fee && packet.total_fee > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated Fee:</span>
                  <span className="text-white font-medium">
                    ${packet.total_fee.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Agreement Summary */}
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Agreement Summary
            </h3>
            <div className="bg-slate-900 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-slate-300 text-sm whitespace-pre-wrap font-sans">
                {getAgreementSummary()}
              </pre>
            </div>
            <p className="text-slate-500 text-xs mt-2">
              The full agreement terms will be provided via email after signing.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mx-6 mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Signature Section */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
              Your Signature
            </h3>

            {/* Checkboxes */}
            <div className="space-y-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-slate-300 group-hover:text-white transition-colors">
                  I have read and agree to the terms of this agreement. I understand that by signing,
                  I am authorizing MaxSam Real Estate to act on my behalf as described above.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreeFee}
                  onChange={(e) => setAgreeFee(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-slate-300 group-hover:text-white transition-colors">
                  I understand and agree to the fee structure outlined in this agreement.
                </span>
              </label>
            </div>

            {/* Typed Signature */}
            <div className="mb-6">
              <label className="block text-slate-400 text-sm mb-2">
                Type your full legal name to sign:
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={packet?.client_name || 'Your full name'}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {typedName && !nameMatches && (
                <p className="text-yellow-400 text-sm mt-2">
                  Please type your name exactly as shown: <strong>{packet?.client_name}</strong>
                </p>
              )}
              {nameMatches && (
                <p className="text-green-400 text-sm mt-2">✓ Name verified</p>
              )}
            </div>

            {/* Date */}
            <div className="mb-8">
              <label className="block text-slate-400 text-sm mb-2">Date:</label>
              <div className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-300">
                {signDate}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSign}
              disabled={!canSign}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                canSign
                  ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/25'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Signing...
                </span>
              ) : (
                '✍️ Sign Agreement'
              )}
            </button>

            {/* Security Note */}
            <p className="text-slate-500 text-xs text-center mt-4">
              🔒 Your signature is secured with encryption. By clicking &quot;Sign Agreement&quot;,
              you agree that your electronic signature is legally binding.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} MaxSam Real Estate. All rights reserved.</p>
          <p className="mt-1">Questions? Contact us at support@maxsam.com</p>
        </div>
      </div>
    </div>
  )
}
