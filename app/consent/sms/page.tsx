import Link from 'next/link'

export const metadata = {
  title: 'SMS Consent | MaxSam Recovery Services',
  description: 'SMS Communication Consent for MaxSam Recovery Services LLC.',
}

export default function SmsConsentPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-900 bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">MaxSam Recovery — SMS Communication Consent</h1>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
        <p className="mb-4 leading-relaxed">
          MaxSam Recovery Services LLC sends SMS messages to inform property owners about potential
          unclaimed excess funds from county tax sales.
        </p>

        <p className="mb-4 leading-relaxed">
          <strong>Opt-In:</strong> By replying <strong>YES</strong> or <strong>1</strong> to our
          initial informational message, you consent to receive recurring automated SMS/text
          messages from MaxSam Recovery Services at the phone number you used to respond.
        </p>

        <p className="mb-4 leading-relaxed font-semibold">
          Consent is not required as a condition of purchase.
        </p>

        <p className="mb-4 leading-relaxed">
          <strong>Message Frequency:</strong> Approximately 2–8 messages per month.
          Message and data rates may apply.
        </p>

        <p className="mb-4 leading-relaxed">
          <strong>Opt-Out:</strong> Reply <strong>STOP</strong> to any message at any time to stop
          receiving messages.
        </p>

        <p className="mb-4 leading-relaxed">
          <strong>Help:</strong> Reply <strong>HELP</strong> for assistance, call{' '}
          <a href="tel:+18449632549" className="text-blue-700 underline">(844) 963-2549</a>, or
          email{' '}
          <a href="mailto:support@maxsamrecovery.com" className="text-blue-700 underline">
            support@maxsamrecovery.com
          </a>.
        </p>

        <p className="text-sm leading-relaxed">
          We do not sell, rent, or share your phone number or opt-in data with third parties
          for marketing purposes.
        </p>
      </div>

      <div className="flex gap-4">
        <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>
        <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link>
      </div>
    </main>
  )
}
