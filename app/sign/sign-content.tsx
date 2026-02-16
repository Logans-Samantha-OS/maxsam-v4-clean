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
  sale_date: string | null
  days_until_expiration: number | null
  deal_type: string | null
  estimated_arv: number | null
  estimated_equity: number | null
  estimated_repair_cost: number | null
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
  const clientPortion = `$${(lead.excess_amount - calculatedFee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Format property address block
  const addressParts = [lead.property_address, lead.city, lead.state].filter(Boolean)
  const fullAddress = addressParts.length > 0
    ? `${lead.property_address || ''}${lead.city ? `, ${lead.city}` : ''}${lead.state ? `, ${lead.state}` : ''} ${lead.zip || ''}`.trim()
    : 'As identified in county records'

  // Format sale date
  const saleDateStr = lead.sale_date
    ? new Date(lead.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  // Format expiry date
  const expiryDateStr = lead.expiry_date
    ? new Date(lead.expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  // Build urgency clause
  let urgencyClause = ''
  if (lead.days_until_expiration != null && lead.days_until_expiration > 0) {
    urgencyClause = `\n\nIMPORTANT DEADLINE: Per ${lead.county} County records, Client's right to claim these excess funds expires on or about ${expiryDateStr || 'the date specified in county records'} (approximately ${lead.days_until_expiration} days from today). Failure to act before this deadline may result in permanent forfeiture of these funds to the county. Agent will prioritize timely filing to preserve Client's claim.`
  } else if (expiryDateStr) {
    urgencyClause = `\n\nIMPORTANT DEADLINE: Per county records, Client's right to claim these excess funds expires on or about ${expiryDateStr}. Agent will prioritize timely filing to preserve Client's claim.`
  }

  // Property valuation section (if ARV/equity data available)
  let propertyValuation = ''
  if (lead.estimated_arv || lead.estimated_equity) {
    const parts: string[] = []
    if (lead.estimated_arv) {
      parts.push(`Estimated After-Repair Value (ARV): $${lead.estimated_arv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    }
    if (lead.estimated_equity) {
      parts.push(`Estimated Property Equity: $${lead.estimated_equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    }
    if (lead.estimated_repair_cost) {
      parts.push(`Estimated Repair Cost: $${lead.estimated_repair_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    }
    propertyValuation = `\n\nPROPERTY VALUATION DATA (for reference only; does not affect excess funds claim):\n${parts.join('\n')}`
  }

  return `EXCESS FUNDS RECOVERY SERVICES AGREEMENT

This Agreement ("Agreement") is entered into as of ${d} ("Effective Date") by and between the following parties:

OWNER/CLAIMANT ("Client"):
Full Legal Name: ${lead.owner_name}
Contact Phone: ${lead.phone || 'On file'}
Contact Email: ${lead.email || 'On file'}

SUBJECT PROPERTY:
Property Address: ${fullAddress}
County: ${lead.county} County, ${lead.state || 'Texas'}${lead.case_number ? `\nCase/Cause Number: ${lead.case_number}` : ''}${saleDateStr ? `\nForeclosure/Tax Sale Date: ${saleDateStr}` : ''}${expiryDateStr ? `\nExcess Funds Claim Deadline: ${expiryDateStr}` : ''}

RECOVERY AGENT ("Agent"):
MaxSam Real Estate LLC
Richardson, Texas 75080
Managing Member

═══════════════════════════════════════════════════

RECITALS

WHEREAS, a foreclosure or tax sale proceeding occurred${saleDateStr ? ` on or about ${saleDateStr}` : ''} involving real property located at ${fullAddress}, situated in ${lead.county} County, ${lead.state || 'Texas'}${lead.case_number ? `, under Case/Cause Number ${lead.case_number}` : ''};

WHEREAS, said proceeding generated excess proceeds in the amount of ${amt} ("Excess Funds"), which are currently held by ${lead.county} County or the applicable court registry, pending rightful claim;

WHEREAS, Client, as the former owner of the subject property or their lawful successor in interest, is believed to be entitled to receive said Excess Funds pursuant to Texas Property Tax Code §34.04 and/or applicable provisions of the Texas Rules of Civil Procedure;

WHEREAS, Client desires to engage Agent to research, prepare, file, and prosecute the claim for recovery of said Excess Funds on Client's behalf;

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein set forth, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:

═══════════════════════════════════════════════════

1. SUBJECT PROPERTY AND CLAIM IDENTIFICATION

The subject claim pertains to excess funds generated from the sale of the following property:

Address: ${fullAddress}
County: ${lead.county} County, ${lead.state || 'Texas'}${lead.case_number ? `\nCase/Cause Number: ${lead.case_number}` : ''}${saleDateStr ? `\nSale Date: ${saleDateStr}` : ''}
Excess Funds on Deposit: ${amt}${expiryDateStr ? `\nClaim Expiration Date: ${expiryDateStr}` : ''}${propertyValuation}

2. SCOPE OF SERVICES

Agent agrees to perform the following services on Client's behalf:
(a) Conduct thorough research to verify Client's entitlement to the Excess Funds, including chain of title review and lien analysis within ${lead.county} County records;
(b) Prepare, compile, and file all necessary claim documentation with the ${lead.county} County Tax Office, District Clerk, or applicable court;
(c) Serve as Client's authorized representative for all communications with ${lead.county} County officials, court clerks, and any third parties relevant to the claim;
(d) Monitor claim status and pursue resolution through all administrative and legal channels;
(e) Coordinate disbursement of funds upon approval of the claim; and
(f) Provide Client with written status updates at reasonable intervals throughout the process.

3. COMPENSATION

Client agrees to pay Agent a contingency fee equal to ${feePercent}% (${feePercent === 25 ? 'twenty-five percent' : `${feePercent} percent`}) of the total Excess Funds actually recovered and received.

Financial Summary:
Excess Funds on Deposit:        ${amt}
Agent's Fee (${feePercent}%):              ${fee}
Estimated Client Net Proceeds:  ${clientPortion}

NO RECOVERY, NO FEE: Client shall owe Agent absolutely nothing if no funds are recovered. There are no upfront costs, retainer fees, filing fees, or expenses of any kind charged to Client. Agent assumes all risk and cost of pursuing this claim.

4. PAYMENT TERMS

Upon successful recovery and disbursement of Excess Funds:
(a) If the disbursing authority remits payment directly to Client, Client agrees to pay Agent's ${feePercent}% fee within fifteen (15) business days of Client's receipt of funds;
(b) If permitted by the disbursing authority, Client authorizes Agent to receive funds directly, deduct the ${feePercent}% fee, and remit the remaining ${100 - feePercent}% to Client within ten (10) business days;
(c) Payment shall be made by certified check, wire transfer, or other mutually agreed method.

5. CLIENT REPRESENTATIONS AND RESPONSIBILITIES

Client represents and warrants that:
(a) Client is the former owner of the subject property or a lawful successor in interest entitled to claim the Excess Funds;
(b) Client has not previously assigned, pledged, or encumbered their right to the Excess Funds;
(c) To the best of Client's knowledge, all information provided is true and accurate;
(d) Client shall promptly provide any documentation reasonably requested by Agent to support the claim, including but not limited to identification, proof of ownership, and any recorded instruments;
(e) Client shall not engage another party, agent, or attorney to pursue the same Excess Funds claim during the term of this Agreement; and
(f) Client shall promptly notify Agent of any change in contact information, mailing address, or legal status.${urgencyClause}

6. TERM AND TERMINATION

This Agreement shall remain in effect until the earlier of: (a) successful recovery and disbursement of the Excess Funds; or (b) two (2) years from the Effective Date.

Either party may terminate this Agreement with thirty (30) days' prior written notice; provided, however, that if Excess Funds are subsequently recovered as a direct or indirect result of Agent's efforts, research, or filings made during the term of this Agreement, the contingency fee shall remain due and payable.

7. NOTICE OF RIGHT TO CANCEL

You, the Client, have the right to cancel this Agreement within THREE (3) BUSINESS DAYS from the date you sign this Agreement, without penalty or obligation. To cancel, send written notice to: MaxSam Real Estate LLC, Richardson, TX 75080. If you cancel within this period, you owe nothing and this Agreement shall be void.

8. GOVERNING LAW AND VENUE

This Agreement shall be governed by and construed in accordance with the laws of the State of Texas. Any dispute arising under or in connection with this Agreement shall be resolved exclusively in the state or federal courts located in Dallas County, Texas.

9. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the parties with respect to the subject matter hereof and supersedes all prior negotiations, representations, warranties, commitments, offers, and agreements, whether written or oral. No amendment, modification, or waiver of any provision of this Agreement shall be effective unless in writing and signed by both parties.

10. ELECTRONIC SIGNATURE

Both parties acknowledge and agree that this Agreement may be executed electronically pursuant to the Texas Uniform Electronic Transactions Act (Tex. Bus. & Com. Code §322.001 et seq.) and the Federal Electronic Signatures in Global and National Commerce Act (15 U.S.C. §7001 et seq.). Electronic signatures shall have the same legal force and effect as original ink signatures.`
}

function buildWholesaleText(lead: LeadData): string {
  const d = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Format property address block
  const fullAddress = [lead.property_address, lead.city, lead.state].filter(Boolean).length > 0
    ? `${lead.property_address || ''}${lead.city ? `, ${lead.city}` : ''}${lead.state ? `, ${lead.state}` : ''} ${lead.zip || ''}`.trim()
    : 'As identified in county records'

  // Format sale date
  const saleDateStr = lead.sale_date
    ? new Date(lead.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  // Property valuation section
  let valuationSection = ''
  const valuationParts: string[] = []
  if (lead.estimated_arv) {
    valuationParts.push(`Estimated After-Repair Value (ARV): $${lead.estimated_arv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  }
  if (lead.estimated_equity) {
    valuationParts.push(`Estimated Equity: $${lead.estimated_equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  }
  if (lead.estimated_repair_cost) {
    valuationParts.push(`Estimated Repair/Renovation Cost: $${lead.estimated_repair_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  }
  if (lead.excess_amount > 0) {
    valuationParts.push(`Excess Funds on Record: $${lead.excess_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  }
  if (valuationParts.length > 0) {
    valuationSection = `\n\nPROPERTY VALUATION DATA (estimates only; not warranties of value):\n${valuationParts.join('\n')}`
  }

  return `WHOLESALE REAL ESTATE PURCHASE AND ASSIGNMENT AGREEMENT

This Agreement ("Agreement") is entered into as of ${d} ("Effective Date") by and between the following parties:

SELLER:
Full Legal Name: ${lead.owner_name}
Contact Phone: ${lead.phone || 'On file'}
Contact Email: ${lead.email || 'On file'}

BUYER/ASSIGNOR:
MaxSam Real Estate LLC and/or Assigns
Richardson, Texas 75080
Managing Member

═══════════════════════════════════════════════════

SUBJECT PROPERTY

Property Address: ${fullAddress}
County: ${lead.county} County, ${lead.state || 'Texas'}
Legal Description: As recorded in the Official Public Records and/or Deed Records of ${lead.county} County, ${lead.state || 'Texas'}${lead.case_number ? `\nRelated Case/Cause Number: ${lead.case_number}` : ''}${saleDateStr ? `\nPrior Sale/Foreclosure Date: ${saleDateStr}` : ''}${valuationSection}

═══════════════════════════════════════════════════

RECITALS

WHEREAS, Seller is the owner of or holds equitable interest in the real property located at ${fullAddress}, situated in ${lead.county} County, ${lead.state || 'Texas'}${lead.case_number ? `, associated with Case/Cause Number ${lead.case_number}` : ''};

WHEREAS, Buyer desires to purchase the Property${lead.estimated_arv ? `, which has an estimated after-repair value of $${lead.estimated_arv.toLocaleString('en-US')}` : ''}, and Seller desires to sell the Property, under the terms and conditions set forth herein;

NOW, THEREFORE, in consideration of the mutual covenants herein and for Ten Dollars ($10.00) and other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:

1. PURCHASE AND SALE

Seller agrees to sell and convey, and Buyer agrees to purchase, the Property described above, together with all improvements, fixtures, and appurtenances thereto. Purchase price and closing terms shall be established in a separate addendum or amendment to this Agreement prior to closing.

2. ASSIGNMENT RIGHTS

Buyer shall have the unconditional right to assign this Agreement, in whole or in part, to a third party (the "Assignee") without the prior consent of Seller. Upon valid assignment:
(a) Assignee shall assume all rights and obligations of Buyer under this Agreement;
(b) The assignment fee shall be payable by Assignee at closing through the title company; and
(c) Seller shall not be responsible for any assignment fee or additional cost arising from such assignment.

3. PROPERTY CONDITION

THE PROPERTY IS BEING SOLD AND CONVEYED "AS-IS, WHERE-IS, WITH ALL FAULTS." Seller makes no warranties, representations, or guarantees, express or implied, regarding the condition, fitness, habitability, environmental status, or suitability of the Property for any particular purpose.${lead.estimated_repair_cost ? ` Buyer acknowledges that the Property may require repairs estimated at approximately $${lead.estimated_repair_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, and accepts the Property in its present condition.` : ''}

Buyer shall have a ten (10) day inspection period from the Effective Date to conduct, at Buyer's sole cost and expense, any inspections, surveys, environmental assessments, or investigations deemed necessary.

4. SELLER REPRESENTATIONS AND WARRANTIES

Seller represents and warrants that:
(a) Seller has the full legal authority and capacity to enter into this Agreement and to convey the Property;
(b) To the best of Seller's knowledge, there are no undisclosed liens, encumbrances, easements, or claims against the Property other than those of public record;
(c) Seller shall not further encumber, lease, or convey the Property or any interest therein during the term of this Agreement;
(d) All information provided by Seller to Buyer regarding the Property is true, accurate, and complete to the best of Seller's knowledge; and
(e) Seller shall maintain the Property in its current condition through closing and shall not remove any fixtures or improvements.

5. CLOSING

Closing shall occur at a licensed title company in ${lead.county} County, ${lead.state || 'Texas'}, or at such other location as mutually agreed by the parties. At closing:
(a) Seller shall deliver a General Warranty Deed or Special Warranty Deed conveying marketable title;
(b) All closing costs shall be allocated per standard ${lead.county} County practice; and
(c) Title company shall handle all disbursements, including any assignment fee.

6. DEFAULT AND REMEDIES

If Seller defaults under this Agreement, Buyer may, at Buyer's sole election: (a) seek specific performance compelling Seller to convey the Property; or (b) terminate this Agreement and receive a return of any Earnest Money deposited.

If Buyer defaults after expiration of the inspection period, Seller's sole and exclusive remedy shall be to retain any Earnest Money deposited as liquidated damages, and both parties shall be released from further obligation.

7. NOTICE OF RIGHT TO CANCEL

Seller has the right to cancel this Agreement within THREE (3) BUSINESS DAYS from the date of Seller's signature, without penalty or obligation. To cancel, send written notice to: MaxSam Real Estate LLC, Richardson, TX 75080.

8. GOVERNING LAW AND VENUE

This Agreement shall be governed by and construed in accordance with the laws of the State of Texas. Any dispute shall be resolved exclusively in the state or federal courts of Dallas County, Texas.

9. ENTIRE AGREEMENT

This Agreement, together with any addenda or amendments executed by both parties, constitutes the entire agreement between the parties. No oral representations, warranties, or agreements shall be binding. Modifications must be in writing and signed by both parties.

10. ELECTRONIC SIGNATURE

Both parties acknowledge and agree that this Agreement may be executed electronically pursuant to the Texas Uniform Electronic Transactions Act (Tex. Bus. & Com. Code §322.001 et seq.) and the Federal Electronic Signatures in Global and National Commerce Act (15 U.S.C. §7001 et seq.). Electronic signatures shall have the same legal force and effect as original ink signatures.`
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

// =============================================================================
// MAIN SIGNING PAGE CONTENT (client component)
// =============================================================================

export default function SignPageContent() {
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
            <KeyTerm label="Fee" value={`${data!.fee_percent}% (${fee || 'contingency'})`} />
            {lead.property_address && (
              <KeyTerm label="Property" value={`${lead.property_address}${lead.city ? `, ${lead.city}` : ''}`} />
            )}
            {lead.case_number && (
              <KeyTerm label="Case #" value={lead.case_number} />
            )}
            <KeyTerm label="County" value={`${lead.county} County, ${lead.state || 'TX'}`} />
            {lead.expiry_date && (
              <KeyTerm label="Claim Deadline" value={new Date(lead.expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
            )}
            {lead.sale_date && (
              <KeyTerm label="Sale Date" value={new Date(lead.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
            )}
            {lead.estimated_arv && (
              <KeyTerm label="Est. Property Value" value={`$${lead.estimated_arv.toLocaleString('en-US')}`} />
            )}
          </div>
          {data!.agreement_type === 'excess_funds' && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
              padding: '10px 12px', marginTop: 12, fontSize: 13, color: '#166534',
            }}>
              No recovery, no fee. You pay nothing unless funds are recovered.
            </div>
          )}
          {lead.days_until_expiration != null && lead.days_until_expiration > 0 && lead.days_until_expiration < 180 && (
            <div style={{
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
              padding: '10px 12px', marginTop: 8, fontSize: 13, color: '#92400E',
            }}>
              {lead.days_until_expiration < 90
                ? `Urgent: Only ${lead.days_until_expiration} days remain to file your claim before these funds may be forfeited.`
                : `Note: ${lead.days_until_expiration} days remain before the claim filing deadline.`}
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
