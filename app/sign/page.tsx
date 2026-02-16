'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

// =============================================================================
// TYPES
// =============================================================================

interface LeadData {
  id: string
  owner_name: string
  property_address: string
  city: string
  state: string
  zip: string
  excess_amount: number
  case_number: string
  county: string
  phone: string
  email: string
  expiry_date: string | null
}

interface ValidateResponse {
  success: boolean
  agreement_type: string
  lead: LeadData
  fee_percent: number
  calculated_fee: number
  expires_at: string
  error?: string
  message?: string
  signed_at?: string
}

// =============================================================================
// AGREEMENT TEXT BUILDERS
// =============================================================================

function buildExcessFundsText(lead: LeadData, feePercent: number, calculatedFee: number): string {
  const d = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const amt = `$${lead.excess_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fee = `$${calculatedFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `EXCESS FUNDS RECOVERY SERVICES AGREEMENT

This Agreement is entered into as of ${d} by and between:

OWNER/CLAIMANT ("Client"):
Name: ${lead.owner_name}
Property: ${lead.property_address || 'As identified in county records'}${lead.city ? `, ${lead.city}` : ''}${lead.state ? `, ${lead.state}` : ''} ${lead.zip || ''}

RECOVERY AGENT ("Agent"):
MaxSam Real Estate LLC
Richardson, TX
Managing Member

RECITALS

WHEREAS, Client is entitled to receive excess funds from a foreclosure or tax sale proceeding in ${lead.county} County;

WHEREAS, the relevant case number is: ${lead.case_number || 'To be determined'};

WHEREAS, the estimated excess funds amount is: ${amt};

WHEREAS, Client desires to engage Agent to assist in the recovery of said excess funds;

NOW, THEREFORE, in consideration of the mutual covenants herein, the parties agree as follows:

1. SCOPE OF SERVICES

Agent agrees to:
• Research and verify Client's claim to excess funds
• Prepare and file all necessary claim documents with the appropriate county or court
• Communicate with county officials and court clerks on Client's behalf
• Track the claim through to final disbursement
• Provide Client with updates on claim status

2. COMPENSATION

Client agrees to pay Agent a contingency fee of ${feePercent}% of the total excess funds recovered.

Estimated Excess Funds: ${amt}
Estimated Fee (${feePercent}%): ${fee}

NO RECOVERY, NO FEE: Client owes Agent nothing if no funds are recovered. There are no upfront costs or expenses charged to Client.

3. PAYMENT TERMS

Upon successful recovery of excess funds:
• Agent will invoice Client for the ${feePercent}% fee
• Payment is due within fifteen (15) days of Client receiving funds
• Client authorizes Agent to receive funds directly if permitted by the disbursing authority

4. CLIENT RESPONSIBILITIES

Client agrees to:
• Provide accurate information regarding the property and claim
• Timely execute any documents required for the claim
• Not engage another party to pursue the same claim during this Agreement
• Notify Agent of any changes in contact information

5. TERM AND TERMINATION

This Agreement shall remain in effect until the claim is resolved or for a period of two (2) years from the date hereof, whichever occurs first. Either party may terminate with thirty (30) days written notice; however, if funds are subsequently recovered as a result of Agent's efforts, the fee shall still be owed.

NOTICE OF RIGHT TO CANCEL

You, the Client, may cancel this Agreement within THREE (3) BUSINESS DAYS from the date you sign this Agreement. To cancel, send written notice to MaxSam Real Estate LLC, Richardson, TX. If you cancel within this period, you owe nothing.

6. GOVERNING LAW

This Agreement shall be governed by the laws of the State of Texas. Any disputes shall be resolved in the courts of Dallas County, Texas.

7. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the parties and supersedes all prior agreements. Any modifications must be in writing and signed by both parties.`
}

function buildWholesaleText(lead: LeadData): string {
  const d = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return `WHOLESALE / FINDER SERVICES AGREEMENT

This Agreement is entered into as of ${d} by and between:

SELLER:
Name: ${lead.owner_name}

BUYER/ASSIGNOR:
MaxSam Real Estate LLC and/or Assigns
Richardson, TX

PROPERTY DESCRIPTION

Property Address: ${lead.property_address || 'As identified in county records'}
City, State, ZIP: ${lead.city || 'Dallas'}, ${lead.state || 'TX'} ${lead.zip || ''}
Legal Description: As recorded in the deed records of ${lead.county} County, Texas

1. ASSIGNMENT RIGHTS

Buyer shall have the right to assign this Agreement to a third party (the "Assignee") without the consent of Seller. Upon assignment, Assignee shall assume all obligations of Buyer under this Agreement.

2. PROPERTY CONDITION

The Property is being sold "AS-IS, WHERE-IS" with all faults. Seller makes no warranties or representations regarding the condition of the Property.

3. SELLER'S DISCLOSURES

Seller represents that:
• Seller has the authority to sell the Property
• There are no undisclosed liens or encumbrances
• Seller will not further encumber the Property before closing
• All information provided to Buyer is accurate to Seller's knowledge

4. DEFAULT

If Seller defaults, Buyer may seek specific performance or terminate.
If Buyer defaults after the inspection period, Seller may retain the Earnest Money as liquidated damages.

5. GOVERNING LAW

This Agreement shall be governed by the laws of the State of Texas. Venue for any dispute shall be Dallas County, Texas.`
}

// =============================================================================
// SIGNATURE CANVAS
// =============================================================================

function SignatureCanvas({ onSignature }: { onSignature: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    setDrawing(true)
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0B1A2E'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const stopDraw = () => {
    setDrawing(false)
    if (hasDrawn && canvasRef.current) {
      onSignature(canvasRef.current.toDataURL('image/png'))
    }
  }

  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onSignature('')
  }

  // Set canvas size on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 600
    canvas.height = 200
  }, [])

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        className="w-full border-2 border-dashed rounded-lg cursor-crosshair touch-none"
        style={{ borderColor: '#C8952E', backgroundColor: '#FDFBF7', height: 120 }}
      />
      <div className="flex justify-between items-center mt-2">
        <span style={{ color: '#8A7D6B', fontSize: 12 }}>Draw your signature above</span>
        {hasDrawn && (
          <button onClick={clear} type="button"
            style={{ color: '#C8952E', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// MAIN SIGNING PAGE
// =============================================================================

export default function SignPage() {
  const params = useSearchParams()
  const token = params.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [data, setData] = useState<ValidateResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Form state
  const [typedName, setTypedName] = useState('')
  const [signatureData, setSignatureData] = useState('')
  const [consent, setConsent] = useState(false)
  const [showFullAgreement, setShowFullAgreement] = useState(false)

  // Demo mode when no token
  const isDemo = !token

  // Validate token on mount
  useEffect(() => {
    if (isDemo) {
      setLoading(false)
      return
    }

    async function validate() {
      try {
        const res = await fetch(`/api/sign/validate?token=${encodeURIComponent(token!)}`)
        const json = await res.json()

        if (json.error === 'already_signed') {
          setAlreadySigned(true)
          setSignedAt(json.signed_at)
          setLoading(false)
          return
        }
        if (json.error === 'expired') {
          setExpired(true)
          setLoading(false)
          return
        }
        if (!res.ok) {
          setError(json.message || json.error || 'Invalid link')
          setLoading(false)
          return
        }

        setData(json)
      } catch {
        setError('Unable to load agreement. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    validate()
  }, [token, isDemo])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!data || !consent || !typedName.trim() || !signatureData || submitting) return

    // Name check
    if (typedName.trim().toLowerCase() !== data.lead.owner_name.trim().toLowerCase()) {
      setError('Please type your name exactly as shown on the agreement.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/sign/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          typed_name: typedName.trim(),
          signature_image: signatureData,
          consent_text: `I, ${typedName.trim()}, agree and sign this ${data.agreement_type === 'excess_funds' ? 'Excess Funds Recovery Services' : 'Wholesale / Finder Services'} Agreement electronically.`,
          screen_size: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
      const json = await res.json()

      if (json.error === 'already_signed') {
        setAlreadySigned(true)
        return
      }
      if (!res.ok) {
        setError(json.error || json.message || 'Failed to submit. Please try again.')
        return
      }

      setSuccess(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }, [data, consent, typedName, signatureData, submitting, token])

  // Build agreement text
  const agreementText = data
    ? data.agreement_type === 'wholesale'
      ? buildWholesaleText(data.lead)
      : buildExcessFundsText(data.lead, data.fee_percent, data.calculated_fee)
    : ''

  const agreementLabel = data?.agreement_type === 'wholesale'
    ? 'Wholesale / Finder Services Agreement'
    : 'Excess Funds Recovery Services Agreement'

  const canSubmit = consent && typedName.trim() && signatureData && !submitting

  // =========================================================================
  // RENDER: Loading
  // =========================================================================
  if (loading) {
    return (
      <Page>
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{
            width: 48, height: 48, border: '3px solid #C8952E', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: '#C8952E', fontSize: 16 }}>Loading your agreement...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </Page>
    )
  }

  // =========================================================================
  // RENDER: Already signed
  // =========================================================================
  if (alreadySigned) {
    return (
      <Page>
        <StatusCard icon="check" title="Already Signed" color="#22C55E">
          <p style={{ color: '#8A7D6B', marginBottom: 16 }}>
            This agreement was signed on {signedAt ? new Date(signedAt).toLocaleDateString() : 'a previous date'}.
          </p>
          <p style={{ color: '#8A7D6B', fontSize: 14 }}>
            No further action needed. We&apos;re processing your claim.
          </p>
        </StatusCard>
      </Page>
    )
  }

  // =========================================================================
  // RENDER: Expired
  // =========================================================================
  if (expired) {
    return (
      <Page>
        <StatusCard icon="clock" title="Link Expired" color="#EAB308">
          <p style={{ color: '#8A7D6B', marginBottom: 16 }}>
            This signing link has expired for security.
          </p>
          <p style={{ color: '#8A7D6B', fontSize: 14 }}>
            Reply to our text message to get a new link.
          </p>
        </StatusCard>
      </Page>
    )
  }

  // =========================================================================
  // RENDER: Error
  // =========================================================================
  if (error && !data) {
    return (
      <Page>
        <StatusCard icon="alert" title="Something Went Wrong" color="#EF4444">
          <p style={{ color: '#8A7D6B' }}>{error}</p>
        </StatusCard>
      </Page>
    )
  }

  // =========================================================================
  // RENDER: Success
  // =========================================================================
  if (success) {
    return (
      <Page>
        <StatusCard icon="check" title="Agreement Signed!" color="#22C55E">
          <p style={{ color: '#4B5563', marginBottom: 16, fontSize: 16 }}>
            Thank you, {data?.lead.owner_name.split(' ')[0]}! Your agreement has been recorded.
          </p>
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16, marginBottom: 16,
          }}>
            <p style={{ color: '#166534', fontWeight: 600, marginBottom: 4 }}>What happens next?</p>
            <p style={{ color: '#15803D', fontSize: 14 }}>
              We&apos;ll begin processing your claim right away. Most claims complete within 30-60 days.
              We&apos;ll keep you updated via text.
            </p>
          </div>
          <p style={{ color: '#9CA3AF', fontSize: 13 }}>You can close this page.</p>
        </StatusCard>
      </Page>
    )
  }

  // =========================================================================
  // RENDER: Demo mode
  // =========================================================================
  if (isDemo) {
    return (
      <Page>
        <StatusCard icon="doc" title="MaxSam E-Signature" color="#C8952E">
          <p style={{ color: '#4B5563', marginBottom: 16 }}>
            This is the self-hosted electronic signature system.
          </p>
          <p style={{ color: '#8A7D6B', fontSize: 14, marginBottom: 8 }}>
            Signing links are generated by the system and sent to leads via SMS. Each link contains a
            cryptographically signed token that identifies the lead and agreement type.
          </p>
          <p style={{ color: '#8A7D6B', fontSize: 14 }}>
            To test, call POST /api/sign/generate with a lead_id and agreement_type.
          </p>
        </StatusCard>
      </Page>
    )
  }

  // =========================================================================
  // RENDER: Main Signing Flow
  // =========================================================================
  const lead = data!.lead
  const amt = lead.excess_amount > 0
    ? `$${lead.excess_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null
  const fee = data!.calculated_fee > 0
    ? `$${data!.calculated_fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null

  return (
    <Page>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#C8952E',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          fontSize: 24, color: '#fff', fontWeight: 700,
        }}>M</div>
        <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", color: '#0B1A2E', fontSize: 22, margin: 0 }}>
          MaxSam Real Estate
        </h1>
        <p style={{ color: '#8A7D6B', fontSize: 14, marginTop: 4 }}>Secure Electronic Signing</p>
      </div>

      {/* Agreement Card */}
      <div style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(11,26,46,0.08)',
      }}>
        {/* Blue header strip */}
        <div style={{ background: '#0B1A2E', padding: '20px 24px' }}>
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif", color: '#C8952E',
            fontSize: 18, margin: 0, lineHeight: 1.3,
          }}>
            {agreementLabel}
          </h2>
          <p style={{ color: '#94A3B8', fontSize: 14, marginTop: 6 }}>
            Prepared for <span style={{ color: '#F5F0E8', fontWeight: 600 }}>{lead.owner_name}</span>
          </p>
        </div>

        {/* Key terms */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E0D8' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {amt && (
              <KeyTerm label={data!.agreement_type === 'wholesale' ? 'Property Value' : 'Excess Funds'} value={amt} highlight />
            )}
            {lead.case_number && (
              <KeyTerm label="Case #" value={lead.case_number} />
            )}
            <KeyTerm label="County" value={lead.county} />
            <KeyTerm label="Fee" value={`${data!.fee_percent}% (${fee || 'contingency'})`} />
          </div>
          {data!.agreement_type === 'excess_funds' && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
              padding: '10px 12px', marginTop: 12, fontSize: 13, color: '#166534',
            }}>
              No recovery, no fee. You pay nothing unless funds are recovered.
            </div>
          )}
        </div>

        {/* Collapsible full agreement */}
        <div style={{ borderBottom: '1px solid #E5E0D8' }}>
          <button
            onClick={() => setShowFullAgreement(!showFullAgreement)}
            type="button"
            style={{
              width: '100%', padding: '14px 24px', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, color: '#0B1A2E', fontSize: 14 }}>
              View Full Agreement
            </span>
            <span style={{ color: '#C8952E', fontSize: 18, transition: 'transform 0.2s', transform: showFullAgreement ? 'rotate(180deg)' : 'none' }}>
              {'\u25BC'}
            </span>
          </button>
          {showFullAgreement && (
            <div style={{
              padding: '0 24px 20px', maxHeight: 400, overflowY: 'auto',
              fontSize: 13, lineHeight: 1.7, color: '#374151',
              whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', system-ui, sans-serif",
            }}>
              {agreementText}
            </div>
          )}
        </div>

        {/* Signature section */}
        <div style={{ padding: '20px 24px' }}>
          {/* Type name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#4B5563', fontWeight: 600, marginBottom: 6 }}>
              Type your full legal name
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={lead.owner_name}
              autoComplete="name"
              style={{
                width: '100%', padding: '12px 16px', fontSize: 16, border: '2px solid #E5E0D8',
                borderRadius: 10, outline: 'none', fontFamily: "'DM Sans', system-ui, sans-serif",
                boxSizing: 'border-box',
                borderColor: typedName && typedName.trim().toLowerCase() === lead.owner_name.trim().toLowerCase() ? '#22C55E' : '#E5E0D8',
              }}
            />
            {typedName && typedName.trim().toLowerCase() !== lead.owner_name.trim().toLowerCase() && (
              <p style={{ color: '#EAB308', fontSize: 12, marginTop: 4 }}>
                Please type: <strong>{lead.owner_name}</strong>
              </p>
            )}
          </div>

          {/* Signature canvas */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#4B5563', fontWeight: 600, marginBottom: 6 }}>
              Draw your signature
            </label>
            <SignatureCanvas onSignature={setSignatureData} />
          </div>

          {/* Consent */}
          <label style={{
            display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20,
            cursor: 'pointer', padding: '12px 14px', borderRadius: 10,
            background: consent ? '#FFFBEB' : '#F9FAFB', border: `1px solid ${consent ? '#FDE68A' : '#E5E7EB'}`,
            transition: 'all 0.15s',
          }}>
            <input
              type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2, accentColor: '#C8952E' }}
            />
            <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
              I, <strong>{typedName.trim() || lead.owner_name}</strong>, agree and sign this {agreementLabel.toLowerCase()} electronically.
              I understand this is a legally binding agreement under the Texas UETA and Federal E-SIGN Act.
            </span>
          </label>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
              padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 14,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            type="button"
            style={{
              width: '100%', padding: '16px 24px', borderRadius: 12, border: 'none',
              fontSize: 17, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default',
              fontFamily: "'DM Serif Display', Georgia, serif",
              background: canSubmit ? '#C8952E' : '#D1D5DB',
              color: canSubmit ? '#fff' : '#9CA3AF',
              boxShadow: canSubmit ? '0 4px 14px rgba(200,149,46,0.4)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {submitting ? 'Signing...' : 'I Agree & Sign'}
          </button>

          {/* Legal fine print */}
          <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
            By tapping &quot;I Agree &amp; Sign&quot; you consent to electronic signing under Texas UETA
            and the Federal E-SIGN Act. Your IP address, timestamp, and device info are recorded as part of
            the audit trail. You may cancel within 3 business days.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 32, paddingBottom: 24 }}>
        <p style={{ color: '#8A7D6B', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} MaxSam Real Estate LLC &bull; Richardson, TX
        </p>
        <p style={{ color: '#A0978B', fontSize: 11, marginTop: 4 }}>
          Questions? Reply to our text message.
        </p>
      </div>

      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap"
        rel="stylesheet"
      />
    </Page>
  )
}

// =============================================================================
// LAYOUT WRAPPERS
// =============================================================================

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0B1A2E 0%, #162A45 40%, #F5F0E8 40.1%, #F5F0E8 100%)',
      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px 0' }}>
        {children}
      </div>
    </div>
  )
}

function StatusCard({ children, icon, title, color }: {
  children: React.ReactNode; icon: string; title: string; color: string
}) {
  const icons: Record<string, string> = { check: '\u2705', clock: '\u23F0', alert: '\u26A0\uFE0F', doc: '\uD83D\uDCC4' }
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '32px 24px', textAlign: 'center',
      boxShadow: '0 4px 24px rgba(11,26,46,0.08)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icons[icon] || icons.doc}</div>
      <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", color, fontSize: 24, margin: '0 0 12px' }}>{title}</h1>
      {children}
    </div>
  )
}

function KeyTerm({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8A7D6B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: highlight ? 20 : 15, fontWeight: highlight ? 700 : 600,
        color: highlight ? '#166534' : '#0B1A2E',
        fontFamily: highlight ? "'DM Serif Display', Georgia, serif" : 'inherit',
      }}>{value}</div>
    </div>
  )
}
