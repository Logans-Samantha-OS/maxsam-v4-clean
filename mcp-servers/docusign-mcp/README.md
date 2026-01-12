# Docusign MCP Server

E-signatures

## Installation

```bash
cd C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\docusign-mcp
npm install
```

## Configuration

Add to `claude_desktop_config.json`:

```json
{
  "docusign": {
    "command": "node",
    "args": ["C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\docusign-mcp\index.js"],
    "env": {
      "DOCUSIGN_INTEGRATION_KEY": "YOUR_DOCUSIGN_INTEGRATION_KEY",
      "DOCUSIGN_USER_ID": "YOUR_DOCUSIGN_USER_ID"
    }
  }
}
```

## Environment Variables

- `DOCUSIGN_INTEGRATION_KEY`: Required
- `DOCUSIGN_USER_ID`: Required

## Tools

### docusign_create_envelope
Create and send contract

### docusign_get_status
Check signing status

