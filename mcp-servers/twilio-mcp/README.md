# Twilio MCP Server

SMS & voice calls

## Installation

```bash
cd C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\twilio-mcp
npm install
```

## Configuration

Add to `claude_desktop_config.json`:

```json
{
  "twilio": {
    "command": "node",
    "args": ["C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\twilio-mcp\index.js"],
    "env": {
      "TWILIO_ACCOUNT_SID": "YOUR_TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN": "YOUR_TWILIO_AUTH_TOKEN",
      "TWILIO_PHONE_NUMBER": "YOUR_TWILIO_PHONE_NUMBER"
    }
  }
}
```

## Environment Variables

- `TWILIO_ACCOUNT_SID`: Required
- `TWILIO_AUTH_TOKEN`: Required
- `TWILIO_PHONE_NUMBER`: Required

## Tools

### twilio_send_sms
Send SMS message

### twilio_get_messages
Retrieve message history

### twilio_make_call
Initiate outbound call

