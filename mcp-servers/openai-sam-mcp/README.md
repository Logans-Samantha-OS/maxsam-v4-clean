# OpenaiSam MCP Server

Conversational AI (Sam persona)

## Installation

```bash
cd C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\openai-sam-mcp
npm install
```

## Configuration

Add to `claude_desktop_config.json`:

```json
{
  "openai-sam": {
    "command": "node",
    "args": ["C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\openai-sam-mcp\index.js"],
    "env": {
      "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY"
    }
  }
}
```

## Environment Variables

- `OPENAI_API_KEY`: Required

## Tools

### sam_generate_sms
Create personalized SMS

### sam_generate_email
Create email outreach

### sam_handle_reply
Process inbound responses

