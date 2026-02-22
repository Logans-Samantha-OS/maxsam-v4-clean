import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | MaxSam Recovery Services',
  description: 'Terms of Service for MaxSam Recovery Services LLC.',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-gray-900 bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: February 22, 2026</p>

      {/* ================================================================ */}
      {/* 1. SERVICES */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">1. Services</h2>
      <p className="mb-4 leading-relaxed">
        MaxSam Recovery Services LLC (&quot;MaxSam,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides:
      </p>
      <ul className="list-disc pl-6 space-y-2 mb-4">
        <li>
          <strong>Excess Funds Recovery:</strong> We help former property owners recover unclaimed
          excess funds from county tax sales on a 25% contingency fee basis. You pay nothing
          unless we successfully recover funds on your behalf.
        </li>
        <li>
          <strong>Wholesale Property Services:</strong> We facilitate real estate transactions
          including property acquisition and assignment.
        </li>
      </ul>

      {/* ================================================================ */}
      {/* 2. NO UPFRONT FEES */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">2. No Upfront Fees</h2>
      <p className="mb-4 leading-relaxed">
        There are no upfront fees for excess funds recovery intake, eligibility review, or
        initial consultation. Our fee (25% of recovered funds) is only collected upon successful
        recovery and disbursement by the county.
      </p>

      {/* ================================================================ */}
      {/* 3. SMS/TEXT MESSAGING TERMS — TCR REQUIRED */}
      {/* ================================================================ */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 mt-8 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-900">
          3. SMS/Text Messaging Terms &amp; Consent
        </h2>

        <div className="bg-white border-2 border-amber-400 rounded-lg p-5 mb-5">
          <p className="font-bold text-lg mb-3 text-center">How Our SMS Program Works</p>

          <div className="space-y-3">
            <p className="leading-relaxed">
              <strong>Initial Message:</strong> You may receive a one-time informational SMS from
              MaxSam Recovery Services based on publicly available county records. This initial
              message informs you about potential unclaimed excess funds.
            </p>

            <p className="leading-relaxed">
              <strong>Opt-In to Recurring Messages:</strong> To receive additional messages about
              your case, you must reply <strong>YES</strong> or <strong>1</strong> to our initial
              message. By doing so, you expressly consent to receive recurring automated
              SMS/text messages from MaxSam Recovery Services at the number you used to respond.
            </p>

            <p className="leading-relaxed font-semibold text-amber-800">
              Consent is not required as a condition of purchase. You do not need to opt in to
              SMS messaging to use our services.
            </p>

            <p className="leading-relaxed">
              <strong>Message Frequency:</strong> Message frequency varies. Expect approximately
              2–8 messages per month depending on the status of your case.
            </p>

            <p className="leading-relaxed">
              <strong>Costs:</strong> Message and data rates may apply. Check with your mobile
              carrier for details about your text/data plan.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <p className="font-semibold text-red-700 mb-2">Opt Out Anytime</p>
            <p className="text-sm leading-relaxed">
              Reply <strong>STOP</strong> to any message to immediately opt out of all future
              SMS communications. You will receive a single confirmation message. No further
              messages will be sent after you opt out.
            </p>
          </div>

          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-700 mb-2">Get Help</p>
            <p className="text-sm leading-relaxed">
              Reply <strong>HELP</strong> for assistance, call{' '}
              <a href="tel:+18449632549" className="text-blue-700 underline">(844) 963-2549</a>,
              or email{' '}
              <a href="mailto:support@maxsamrecovery.com" className="text-blue-700 underline">
                support@maxsamrecovery.com
              </a>.
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed mb-3">
          <strong>Supported Carriers:</strong> AT&amp;T, Verizon, T-Mobile, Sprint, U.S. Cellular,
          Boost Mobile, MetroPCS, Cricket, Virgin Mobile, and other major U.S. carriers. Carriers
          are not liable for delayed or undelivered messages.
        </p>

        <p className="text-sm leading-relaxed font-semibold">
          We do not sell, rent, or share your phone number or SMS opt-in consent data with any
          third parties for their marketing purposes. See our{' '}
          <Link href="/privacy" className="text-blue-700 underline">Privacy Policy</Link> for
          full details.
        </p>
      </div>

      {/* ================================================================ */}
      {/* 4. AGREEMENTS & CONTRACTS */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">4. Agreements &amp; Contracts</h2>
      <p className="mb-4 leading-relaxed">
        If you choose to proceed with our excess funds recovery services, you will be asked to
        sign an assignment agreement. This agreement authorizes us to file a claim on your behalf
        and specifies the fee arrangement. No fees are owed unless funds are successfully recovered.
      </p>

      {/* ================================================================ */}
      {/* 5. LIMITATION OF LIABILITY */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">5. Limitation of Liability</h2>
      <p className="mb-4 leading-relaxed">
        MaxSam Recovery Services provides its services on a best-efforts basis. We do not guarantee
        the recovery of excess funds, as claim approval is subject to county review and approval.
        To the maximum extent permitted by law, MaxSam shall not be liable for any indirect,
        incidental, special, or consequential damages arising from the use of our services.
      </p>

      {/* ================================================================ */}
      {/* 6. GOVERNING LAW */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">6. Governing Law</h2>
      <p className="mb-4 leading-relaxed">
        These Terms of Service shall be governed by and construed in accordance with the laws of
        the State of Texas, without regard to its conflict of law principles. Any disputes arising
        under these terms shall be subject to the jurisdiction of the courts in Dallas County, Texas.
      </p>

      {/* ================================================================ */}
      {/* 7. CHANGES */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">7. Changes to These Terms</h2>
      <p className="mb-4 leading-relaxed">
        We may update these Terms of Service from time to time. Changes will be posted on this
        page with an updated revision date. Your continued use of our services after any changes
        constitutes your acceptance of the revised terms.
      </p>

      {/* ================================================================ */}
      {/* 8. CONTACT */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">8. Contact Us</h2>
      <div className="bg-gray-50 rounded-lg p-5 mb-8">
        <p className="font-semibold mb-2">MaxSam Recovery Services LLC</p>
        <p>Richardson, TX</p>
        <p>
          Phone:{' '}
          <a href="tel:+18449632549" className="text-blue-700 underline">(844) 963-2549</a>
        </p>
        <p>
          Email:{' '}
          <a href="mailto:support@maxsamrecovery.com" className="text-blue-700 underline">
            support@maxsamrecovery.com
          </a>
        </p>
      </div>

      <div className="border-t pt-6 text-sm text-gray-500 flex gap-4">
        <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>
        <Link href="/consent/sms" className="text-blue-600 underline">SMS Consent</Link>
      </div>
    </main>
  )
}
