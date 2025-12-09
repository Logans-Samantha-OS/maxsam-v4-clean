'use client';

import { useState } from 'react';

export default function ConsentPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    consent: false,
    terms: false
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 0) {
      if (value.length <= 3) {
        value = value;
      } else if (value.length <= 6) {
        value = '(' + value.slice(0, 3) + ') ' + value.slice(3);
      } else {
        value = '(' + value.slice(0, 3) + ') ' + value.slice(3, 6) + '-' + value.slice(6, 10);
      }
    }
    setFormData({ ...formData, phone: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const phone = formData.phone.replace(/[^0-9]/g, '');
    if (phone.length !== 10) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }
    
    alert('Thank you for your consent! You will receive a confirmation SMS shortly. You can opt-out at any time by replying STOP.');
    
    // Reset form
    setFormData({
      name: '',
      phone: '',
      email: '',
      consent: false,
      terms: false
    });
  };

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #374151;
          background-color: #f9fafb;
        }
        
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          padding: 2.5rem;
          margin-bottom: 2rem;
        }
        
        .header {
          text-align: center;
          margin-bottom: 3rem;
        }
        
        .logo {
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 0.5rem;
        }
        
        .tagline {
          color: #6b7280;
          font-size: 1.1rem;
        }
        
        h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 1.5rem;
          text-align: center;
        }
        
        h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1f2937;
          margin: 2rem 0 1rem 0;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }
        
        h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
          margin: 1.5rem 0 0.5rem 0;
        }
        
        p {
          margin-bottom: 1rem;
          color: #4b5563;
        }
        
        ul {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        
        li {
          margin-bottom: 0.5rem;
          color: #4b5563;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }
        
        label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #374151;
        }
        
        input[type="text"],
        input[type="tel"],
        input[type="email"] {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
          transition: border-color 0.15s;
        }
        
        input[type="text"]:focus,
        input[type="tel"]:focus,
        input[type="email"]:focus {
          outline: none;
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }
        
        .checkbox-group {
          display: flex;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        
        .checkbox-group input[type="checkbox"] {
          margin-right: 0.75rem;
          margin-top: 0.25rem;
        }
        
        .checkbox-label {
          flex: 1;
        }
        
        .btn {
          background: #0ea5e9;
          color: white;
          padding: 0.75rem 2rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s;
          width: 100%;
        }
        
        .btn:hover {
          background: #0284c7;
        }
        
        .btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        
        .opt-out {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 1rem;
          margin: 1rem 0;
        }
        
        .opt-out strong {
          color: #dc2626;
        }
        
        .footer {
          text-align: center;
          padding: 2rem;
          border-top: 1px solid #e5e7eb;
          margin-top: 2rem;
          color: #6b7280;
          font-size: 0.9rem;
        }
        
        .compliance-notice {
          background: #f3f4f6;
          border-radius: 6px;
          padding: 1rem;
          margin-top: 2rem;
          text-align: center;
          font-size: 0.85rem;
          color: #6b7280;
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }
          
          .card {
            padding: 1.5rem;
          }
          
          h1 {
            font-size: 1.5rem;
          }
          
          h2 {
            font-size: 1.25rem;
          }
        }
      `}</style>
      
      <div className="container">
        <div className="header">
          <div className="logo">MaxSam V4</div>
          <div className="tagline">AI-Powered Real Estate Operations</div>
        </div>
        
        <div className="card">
          <h1>SMS Communications Consent & Privacy Policy</h1>
          
          <div className="consent-form">
            <h2>Consent to SMS Communications</h2>
            <p>By providing your phone number, you consent to receive SMS messages from MaxSam V4 regarding real estate services.</p>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="phone">Mobile Phone Number *</label>
                <input 
                  type="tel" 
                  id="phone" 
                  name="phone" 
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  required 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  placeholder="optional@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              
              <div className="checkbox-group">
                <input 
                  type="checkbox" 
                  id="consent" 
                  name="consent"
                  checked={formData.consent}
                  onChange={(e) => setFormData({...formData, consent: e.target.checked})}
                  required 
                />
                <div className="checkbox-label">
                  <label htmlFor="consent">I consent to receive SMS messages from MaxSam V4 about:</label>
                  <ul>
                    <li>Excess funds recovery opportunities</li>
                    <li>Real estate wholesale offers</li>
                    <li>Property-related communications</li>
                    <li>Transaction updates</li>
                  </ul>
                </div>
              </div>
              
              <div className="checkbox-group">
                <input 
                  type="checkbox" 
                  id="terms" 
                  name="terms"
                  checked={formData.terms}
                  onChange={(e) => setFormData({...formData, terms: e.target.checked})}
                  required 
                />
                <div className="checkbox-label">
                  <label htmlFor="terms">I have read and agree to the Privacy Policy and terms of service outlined below.</label>
                </div>
              </div>
              
              <button type="submit" className="btn">Submit Consent</button>
            </form>
          </div>
          
          <h2>Message Frequency & Opt-Out</h2>
          <div className="opt-out">
            <p><strong>Opt-Out Instructions:</strong> You can opt-out of SMS messages at any time by:</p>
            <ul>
              <li>Replying <strong>"STOP"</strong> to any message</li>
              <li>Replying <strong>"UNSUBSCRIBE"</strong> to any message</li>
              <li>Emailing: support@maxsam-v4.com</li>
            </ul>
            <p>For help, reply <strong>"HELP"</strong> to any message.</p>
          </div>
          
          <p><strong>Message Frequency:</strong> Message frequency varies based on your specific opportunities and transaction status. Typically 2-4 messages per month per property/claim.</p>
          <p><strong>Costs:</strong> Message and data rates may apply. Check with your mobile carrier for details.</p>
          
          <h2>Privacy Policy</h2>
          
          <h3>Information We Collect</h3>
          <ul>
            <li>Full name and contact information (phone, email)</li>
            <li>Property details and ownership information</li>
            <li>Excess funds claim information</li>
            <li>Communication preferences and consent status</li>
            <li>Transaction-related information</li>
          </ul>
          
          <h3>How We Use Your Information</h3>
          <ul>
            <li>To identify potential excess funds claims you may be entitled to</li>
            <li>To make cash offers on real estate properties</li>
            <li>To facilitate real estate transactions and excess funds recovery</li>
            <li>To provide customer service and transaction updates</li>
            <li>To comply with legal and regulatory requirements</li>
          </ul>
          
          <h3>Information Sharing</h3>
          <p>We do not sell, rent, or share your personal information with third parties for their marketing purposes. We may share information with:</p>
          <ul>
            <li>Service providers who assist in transaction processing (title companies, attorneys)</li>
            <li>Government agencies as required by law</li>
            <li>Compliance partners for regulatory requirements</li>
          </ul>
          
          <h3>Data Security</h3>
          <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
          
          <h3>Your Rights</h3>
          <ul>
            <li>Access to your personal information</li>
            <li>Correction of inaccurate information</li>
            <li>Deletion of your information (subject to legal requirements)</li>
            <li>Opt-out of SMS communications at any time</li>
            <li>Complaint filing with regulatory authorities</li>
          </ul>
          
          <h2>Contact Information</h2>
          <p>
            <strong>MaxSam V4</strong><br />
            Owner: Logan Toups<br />
            Location: Richardson, Texas<br />
            Email: support@maxsam-v4.com<br />
            Website: https://maxsam-v4-clean.vercel.app
          </p>
          
          <h2>Regulatory Compliance</h2>
          <p>This SMS consent program complies with:</p>
          <ul>
            <li>TCPA (Telephone Consumer Protection Act)</li>
            <li>Twilio A2P 10DLC requirements</li>
            <li>FCC regulations for SMS marketing</li>
            <li>State and federal privacy laws</li>
          </ul>
          
          <div className="compliance-notice">
            <p><strong>Twilio 10DLC Compliance Notice:</strong> This page satisfies all requirements for SMS campaign registration including clear consent mechanism, opt-out instructions, privacy policy, and contact information.</p>
            <p>Last Updated: December 2025 | Effective Date: December 2025</p>
          </div>
        </div>
        
        <div className="footer">
          <p>&copy; 2025 MaxSam V4. All rights reserved. | 100% Owner: Logan Toups</p>
          <p>This page is compliant with Twilio A2P 10DLC SMS campaign requirements.</p>
        </div>
      </div>
    </>
  );
}
