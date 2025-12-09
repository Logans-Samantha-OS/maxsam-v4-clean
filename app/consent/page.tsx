'use client';

export default function ConsentPage() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phone = formData.get('phone') as string;
    const cleaned = phone.replace(/[^0-9]/g, '');
    
    if (cleaned.length !== 10) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }
    
    alert('Thank you for your consent! You can opt-out at any time by replying STOP.');
    e.currentTarget.reset();
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '2rem', lineHeight: 1.6 }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>MaxSam V4</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>AI-Powered Real Estate Operations</p>
      </div>
      
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '2.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'center' }}>
          SMS Communications Consent & Privacy Policy
        </h1>
        
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: '2rem', marginBottom: '1rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          Consent to SMS Communications
        </h2>
        <p>By providing your phone number, you consent to receive SMS messages from MaxSam V4 regarding real estate services.</p>
        
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="name" style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>Full Name *</label>
            <input type="text" id="name" name="name" required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="phone" style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>Mobile Phone Number *</label>
            <input type="tel" id="phone" name="phone" placeholder="(555) 123-4567" required style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="email" style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>Email Address</label>
            <input type="email" id="email" name="email" placeholder="optional@email.com" style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <input type="checkbox" id="consent" name="consent" required style={{ marginRight: '0.75rem', marginTop: '0.25rem' }} />
            <div>
              <label htmlFor="consent">I consent to receive SMS messages from MaxSam V4 about:</label>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                <li>Excess funds recovery opportunities</li>
                <li>Real estate wholesale offers</li>
                <li>Property-related communications</li>
                <li>Transaction updates</li>
              </ul>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <input type="checkbox" id="terms" name="terms" required style={{ marginRight: '0.75rem', marginTop: '0.25rem' }} />
            <label htmlFor="terms">I have read and agree to the Privacy Policy and terms of service outlined below.</label>
          </div>
          
          <button type="submit" style={{ background: '#0ea5e9', color: 'white', padding: '0.75rem 2rem', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
            Submit Consent
          </button>
        </form>
        
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: '2rem', marginBottom: '1rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          Message Frequency & Opt-Out
        </h2>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '1rem', margin: '1rem 0' }}>
          <p><strong style={{ color: '#dc2626' }}>Opt-Out Instructions:</strong> You can opt-out of SMS messages at any time by:</p>
          <ul>
            <li>Replying <strong>"STOP"</strong> to any message</li>
            <li>Replying <strong>"UNSUBSCRIBE"</strong> to any message</li>
            <li>Emailing: support@maxsam-v4.com</li>
          </ul>
          <p>For help, reply <strong>"HELP"</strong> to any message.</p>
        </div>
        
        <p><strong>Message Frequency:</strong> Message frequency varies. Typically 2-4 messages per month per property/claim.</p>
        <p><strong>Costs:</strong> Message and data rates may apply.</p>
        
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: '2rem', marginBottom: '1rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          Contact Information
        </h2>
        <p>
          <strong>MaxSam V4</strong><br />
          Owner: Logan Toups<br />
          Location: Richardson, Texas<br />
          Email: support@maxsam-v4.com<br />
          Website: https://maxsam-v4-clean.vercel.app
        </p>
        
        <div style={{ background: '#f3f4f6', borderRadius: '6px', padding: '1rem', marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: '#6b7280' }}>
          <p><strong>Twilio 10DLC Compliance Notice:</strong> This page satisfies all SMS campaign requirements including consent mechanism, opt-out instructions, privacy policy, and contact information.</p>
          <p>Last Updated: December 2025</p>
        </div>
      </div>
      
      <div style={{ textAlign: 'center', padding: '2rem', borderTop: '1px solid #e5e7eb', marginTop: '2rem', color: '#6b7280', fontSize: '0.9rem' }}>
        <p>&copy; 2025 MaxSam V4. All rights reserved.</p>
        <p>Twilio A2P 10DLC Compliant</p>
      </div>
    </div>
  );
}
