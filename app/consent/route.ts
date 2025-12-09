export async function GET() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MaxSam V4 - SMS Consent</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; text-align: center; }
        h2 { color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .opt-out { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .contact { background: #f8f9fa; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>MaxSam V4 - SMS Communications Consent</h1>
    
    <h2>SMS Consent</h2>
    <p>By providing your phone number, you consent to receive SMS messages from MaxSam V4 regarding:</p>
    <ul>
        <li>Excess funds recovery opportunities</li>
        <li>Real estate wholesale offers</li>
        <li>Property-related communications</li>
        <li>Transaction updates</li>
    </ul>
    
    <h2>Opt-Out Instructions</h2>
    <div class="opt-out">
        <p><strong>You can opt-out at any time by:</strong></p>
        <ul>
            <li>Replying "STOP" to any message</li>
            <li>Replying "UNSUBSCRIBE" to any message</li>
            <li>Calling: [Your Phone Number]</li>
            <li>Emailing: privacy@maxsam-v4.com</li>
        </ul>
        <p>For help, reply "HELP" to any message.</p>
    </div>
    
    <p><strong>Message Frequency:</strong> Varies based on your opportunities (typically 2-4 messages/month)</p>
    <p><strong>Costs:</strong> Message and data rates may apply</p>
    
    <h2>Contact Information</h2>
    <div class="contact">
        <p><strong>MaxSam V4</strong><br>
        Owner: Logan Toups<br>
        Location: Richardson, Texas<br>
        Email: privacy@maxsam-v4.com<br>
        Website: https://maxsam-v4-clean.vercel.app</p>
    </div>
    
    <h2>Compliance</h2>
    <p>This SMS consent program complies with:</p>
    <ul>
        <li>TCPA (Telephone Consumer Protection Act)</li>
        <li>Twilio A2P 10DLC requirements</li>
        <li>FCC regulations for SMS marketing</li>
    </ul>
    
    <p style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
        © 2025 MaxSam V4 | Twilio 10DLC Compliant
    </p>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
