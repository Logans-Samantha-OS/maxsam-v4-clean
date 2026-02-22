import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | MaxSam Recovery Services',
  description: 'Privacy Policy for MaxSam Recovery Services LLC SMS and web services.',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-gray-900 bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: February 22, 2026</p>

      {/* ================================================================ */}
      {/* 1. WHO WE ARE */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">1. Who We Are</h2>
      <p className="mb-4 leading-relaxed">
        MaxSam Recovery Services LLC (&quot;MaxSam,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a Texas-based company
        that helps property owners recover unclaimed excess funds from county tax sales and provides
        real estate property services. Our principal office is located in Richardson, TX.
      </p>

      {/* ================================================================ */}
      {/* 2. INFORMATION WE COLLECT */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">2. Information We Collect</h2>
      <p className="mb-3 leading-relaxed">We may collect the following categories of information:</p>
      <ul className="list-disc pl-6 space-y-2 mb-4">
        <li>Your name, phone number, and email address</li>
        <li>Property address and related public records information</li>
        <li>County case numbers related to excess funds or property proceedings</li>
        <li>Communication preferences and opt-in/opt-out status</li>
        <li>Records of SMS messages sent to and received from you</li>
      </ul>
      <p className="mb-4 leading-relaxed">
        Our initial contact information is gathered from publicly available county records,
        including foreclosure filings, tax sale records, and property ownership records.
      </p>

      {/* ================================================================ */}
      {/* 3. HOW WE USE YOUR INFORMATION */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">3. How We Use Your Information</h2>
      <p className="mb-3 leading-relaxed">We use the information we collect to:</p>
      <ul className="list-disc pl-6 space-y-2 mb-4">
        <li>Contact you about potential unclaimed excess funds you may be entitled to</li>
        <li>Provide excess funds recovery services</li>
        <li>Provide real estate property services</li>
        <li>Send you SMS messages related to your case and our services</li>
        <li>Process agreements and contracts</li>
        <li>Comply with legal obligations</li>
      </ul>

      {/* ================================================================ */}
      {/* 4. SMS/TEXT MESSAGING PROGRAM — TCR REQUIRED */}
      {/* ================================================================ */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mt-8 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-blue-900">4. SMS/Text Messaging Program</h2>

        <p className="mb-3 leading-relaxed">
          <strong>Program Name:</strong> MaxSam Recovery Services SMS Notifications
        </p>

        <p className="mb-3 leading-relaxed">
          <strong>Purpose:</strong> We send SMS messages to inform property owners about unclaimed
          excess funds they may be entitled to recover, and to facilitate the recovery process.
        </p>

        <p className="mb-3 leading-relaxed">
          <strong>Consent &amp; Opt-In:</strong> By replying <strong>YES</strong>, <strong>1</strong>,
          or any affirmative response to our initial informational message, you expressly consent to
          receive recurring automated SMS/text messages from MaxSam Recovery Services at the phone
          number you used to respond. Our initial message is a one-time informational notification
          based on public county records; recurring messages begin only after you opt in.
        </p>

        <p className="mb-3 leading-relaxed">
          <strong>Consent is not required as a condition of purchase.</strong> You are not required to
          opt in to SMS messaging to use our services or receive any benefit.
        </p>

        <p className="mb-3 leading-relaxed">
          <strong>Message Frequency:</strong> Message frequency varies. You may receive approximately
          2–8 messages per month depending on the status of your case.
        </p>

        <p className="mb-3 leading-relaxed">
          <strong>Message &amp; Data Rates:</strong> Message and data rates may apply. Check with your
          mobile carrier for details about your text messaging plan.
        </p>

        <div className="bg-white border border-blue-300 rounded-lg p-4 my-4">
          <p className="font-semibold mb-2">Opt-Out:</p>
          <p className="leading-relaxed">
            You can opt out of receiving SMS messages at any time by replying <strong>STOP</strong> to
            any message. After opting out, you will receive a one-time confirmation message and no
            further SMS messages will be sent.
          </p>
        </div>

        <div className="bg-white border border-blue-300 rounded-lg p-4 my-4">
          <p className="font-semibold mb-2">Help:</p>
          <p className="leading-relaxed">
            For help, reply <strong>HELP</strong> to any message, call us at{' '}
            <a href="tel:+18449632549" className="text-blue-700 underline">(844) 963-2549</a>, or
            email{' '}
            <a href="mailto:support@maxsamrecovery.com" className="text-blue-700 underline">
              support@maxsamrecovery.com
            </a>.
          </p>
        </div>

        <p className="mb-3 leading-relaxed">
          <strong>Supported Carriers:</strong> AT&amp;T, Verizon, T-Mobile, Sprint, U.S. Cellular,
          Boost Mobile, MetroPCS, Cricket, Virgin Mobile, and other major U.S. carriers. Carriers
          are not liable for delayed or undelivered messages.
        </p>

        <p className="mb-3 leading-relaxed">
          <strong>No Sharing of Phone Numbers or Opt-In Data:</strong> We do not sell, rent, or share
          your phone number or SMS opt-in consent data with any third parties for their marketing
          purposes. Your opt-in data (including your phone number and consent status) will not be
          shared with or sold to third parties or affiliates for purposes unrelated to our services.
        </p>
      </div>

      {/* ================================================================ */}
      {/* 5. DATA SHARING */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Sharing &amp; Third Parties</h2>
      <p className="mb-4 leading-relaxed">
        We do not sell your personal information. We may share limited information with:
      </p>
      <ul className="list-disc pl-6 space-y-2 mb-4">
        <li>County government agencies to process your excess funds claim</li>
        <li>Title companies as needed to facilitate property transactions</li>
        <li>Service providers who help us operate our business (e.g., SMS delivery via Twilio), under strict confidentiality agreements</li>
        <li>Legal authorities if required by law or legal process</li>
      </ul>
      <p className="mb-4 leading-relaxed font-semibold">
        We never sell, rent, or share your phone number or SMS opt-in consent data with any
        third parties for their marketing or promotional purposes.
      </p>

      {/* ================================================================ */}
      {/* 6. DATA SECURITY */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Security</h2>
      <p className="mb-4 leading-relaxed">
        We implement reasonable technical and organizational security measures to protect your
        personal information against unauthorized access, alteration, disclosure, or destruction.
        However, no method of electronic transmission or storage is 100% secure.
      </p>

      {/* ================================================================ */}
      {/* 7. DATA RETENTION */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">7. Data Retention</h2>
      <p className="mb-4 leading-relaxed">
        We retain your personal information for as long as necessary to fulfill the purposes
        outlined in this policy, comply with our legal obligations, resolve disputes, and
        enforce our agreements. SMS opt-out records are retained indefinitely to ensure compliance.
      </p>

      {/* ================================================================ */}
      {/* 8. YOUR RIGHTS */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">8. Your Rights</h2>
      <p className="mb-3 leading-relaxed">You have the right to:</p>
      <ul className="list-disc pl-6 space-y-2 mb-4">
        <li>Request access to the personal information we hold about you</li>
        <li>Request correction of inaccurate information</li>
        <li>Request deletion of your information (subject to legal requirements)</li>
        <li>Opt out of SMS communications at any time by replying STOP</li>
      </ul>

      {/* ================================================================ */}
      {/* 9. CHANGES */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">9. Changes to This Policy</h2>
      <p className="mb-4 leading-relaxed">
        We may update this Privacy Policy from time to time. Changes will be posted on this page
        with an updated revision date. Your continued use of our services after any changes
        constitutes your acceptance of the revised policy.
      </p>

      {/* ================================================================ */}
      {/* 10. CONTACT */}
      {/* ================================================================ */}
      <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact Us</h2>
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
        <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link>
        <Link href="/consent/sms" className="text-blue-600 underline">SMS Consent</Link>
      </div>
    </main>
  )
}
