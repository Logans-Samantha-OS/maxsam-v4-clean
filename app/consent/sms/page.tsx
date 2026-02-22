import Link from 'next/link'

export default function SmsConsentPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-900">
      <h1 className="text-3xl font-bold mb-6">MaxSam Recovery — SMS Communication Consent</h1>
      <p className="mb-4">
        By replying to our initial message, you consent to receiving SMS communications from MaxSam Recovery Services about excess funds recovery and property services.
      </p>
      <p className="mb-6">Reply STOP at any time to stop receiving messages.</p>
      <div className="flex gap-4">
        <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>
        <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link>
      </div>
    </main>
  )
}
