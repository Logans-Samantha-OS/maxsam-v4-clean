import { Suspense } from 'react'
import SignPageContent from './sign-content'

function LoadingSpinner() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0B1A2E 0%, #162A45 40%, #F5F0E8 40.1%, #F5F0E8 100%)',
      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px 0' }}>
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{
            width: 48, height: 48, border: '3px solid #C8952E', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: '#C8952E', fontSize: 16 }}>Loading your agreement...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    </div>
  )
}

export default function SignPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SignPageContent />
    </Suspense>
  )
}
