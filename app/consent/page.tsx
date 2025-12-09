export default function ConsentPage() {
  return (
    <div style={{ 
      backgroundColor: '#ffffff',
      padding: '40px 20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      
      <h1 style={{ 
        color: '#000000', 
        textAlign: 'center',
        fontSize: '36px',
        fontWeight: 'bold',
        marginBottom: '10px'
      }}>
        MaxSam V4
      </h1>
      
      <p style={{ 
        color: '#000000', 
        textAlign: 'center',
        fontSize: '18px',
        marginBottom: '40px'
      }}>
        AI-Powered Real Estate Operations
      </p>

      <div style={{
        backgroundColor: '#f0f0f0',
        border: '3px solid #000000',
        padding: '30px',
        marginBottom: '30px',
        borderRadius: '10px'
      }}>
        <h2 style={{ 
          color: '#000000', 
          fontSize: '28px',
          fontWeight: 'bold',
          marginTop: '0',
          marginBottom: '20px'
        }}>
          SMS Communications Consent
        </h2>
        
        <p style={{ color: '#000000', fontSize: '18px', marginBottom: '15px' }}>
          By providing your phone number to MaxSam V4, you consent to receive SMS messages regarding:
        </p>
        
        <ul style={{ color: '#000000', fontSize: '18px', marginBottom: '20px' }}>
          <li style={{ marginBottom: '8px' }}>Excess funds recovery opportunities</li>
          <li style={{ marginBottom: '8px' }}>Real estate wholesale offers</li>
          <li style={{ marginBottom: '8px' }}>Property-related communications</li>
          <li style={{ marginBottom: '8px' }}>Transaction updates</li>
        </ul>
      </div>

      <div style={{
        backgroundColor: '#ffcccc',
        border: '3px solid #cc0000',
        padding: '30px',
        marginBottom: '30px',
        borderRadius: '10px'
      }}>
        <h3 style={{ 
          color: '#000000', 
          fontSize: '24px',
          fontWeight: 'bold',
          marginTop: '0',
          marginBottom: '15px'
        }}>
          How to Opt-Out:
        </h3>
        
        <ul style={{ color: '#000000', fontSize: '18px', marginBottom: '15px' }}>
          <li style={{ marginBottom: '8px' }}><strong>Reply STOP to any message</strong></li>
          <li style={{ marginBottom: '8px' }}><strong>Reply UNSUBSCRIBE to any message</strong></li>
          <li style={{ marginBottom: '8px' }}><strong>Email: support@maxsam-v4.com</strong></li>
        </ul>
        
        <p style={{ color: '#000000', fontSize: '18px', margin: '0' }}>
          <strong>For help, reply HELP to any message.</strong>
        </p>
      </div>

      <div style={{
        backgroundColor: '#f0f0f0',
        border: '3px solid #000000',
        padding: '30px',
        marginBottom: '30px',
        borderRadius: '10px'
      }}>
        <p style={{ color: '#000000', fontSize: '18px', marginBottom: '8px' }}>
          <strong>Message Frequency:</strong> 2-4 messages per month
        </p>
        <p style={{ color: '#000000', fontSize: '18px', margin: '0' }}>
          <strong>Cost:</strong> Message and data rates may apply
        </p>
      </div>

      <div style={{
        backgroundColor: '#cce5ff',
        border: '3px solid #0066cc',
        padding: '30px',
        marginBottom: '30px',
        borderRadius: '10px'
      }}>
        <h2 style={{ 
          color: '#000000', 
          fontSize: '28px',
          fontWeight: 'bold',
          marginTop: '0',
          marginBottom: '20px'
        }}>
          Contact Information
        </h2>
        
        <p style={{ color: '#000000', fontSize: '18px', marginBottom: '8px' }}>
          <strong>MaxSam V4</strong>
        </p>
        <p style={{ color: '#000000', fontSize: '18px', marginBottom: '8px' }}>
          Owner: Logan Toups
        </p>
        <p style={{ color: '#000000', fontSize: '18px', marginBottom: '8px' }}>
          Location: Richardson, Texas
        </p>
        <p style={{ color: '#000000', fontSize: '18px', marginBottom: '8px' }}>
          Email: support@maxsam-v4.com
        </p>
        <p style={{ color: '#000000', fontSize: '18px', marginBottom: '8px' }}>
          Phone: (469) 222-9255
        </p>
        <p style={{ color: '#000000', fontSize: '18px', margin: '0' }}>
          Website: https://maxsam-v4-clean.vercel.app
        </p>
      </div>

      <div style={{
        backgroundColor: '#f0f0f0',
        border: '3px solid #666666',
        padding: '30px',
        borderRadius: '10px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#000000', fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>
          Twilio 10DLC Compliance Notice
        </p>
        <p style={{ color: '#000000', fontSize: '16px', marginBottom: '15px' }}>
          This page satisfies all SMS campaign requirements including consent mechanism, 
          opt-out instructions, privacy policy, and contact information.
        </p>
        <p style={{ color: '#000000', fontSize: '16px', marginBottom: '15px' }}>
          Last Updated: December 2025
        </p>
        <p style={{ color: '#000000', fontSize: '16px', margin: '0' }}>
          &copy; 2025 MaxSam V4. All rights reserved.
        </p>
      </div>

    </div>
  );
}
