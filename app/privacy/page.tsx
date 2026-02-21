export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-gray-900">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Who We Are</h2>
      <p>MaxSam Recovery Services LLC provides excess funds recovery and property services.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Data We Collect</h2>
      <p>We may collect your name, phone number, property address, and case numbers.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">How We Use Data</h2>
      <p>We use this information to contact you regarding excess funds recovery and property services.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">SMS Consent Disclosure</h2>
      <p>
        By providing your phone number and responding to our messages, you consent to receive SMS messages from MaxSam Recovery Services regarding your excess funds or property. Message and data rates may apply. Message frequency varies.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Opt Out</h2>
      <p>Reply STOP to any message to opt out at any time.</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Contact</h2>
      <p>support@maxsamrecovery.com • (844) 963-2549</p>
    </main>
  )
}
