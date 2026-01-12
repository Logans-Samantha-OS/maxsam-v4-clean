# GoogleWorkspace MCP Server

Gmail, Calendar, Sheets

## Installation

```bash
cd C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\google-workspace-mcp
npm install
```

## Configuration

Add to `claude_desktop_config.json`:

```json
{
  "google-workspace": {
    "command": "node",
    "args": ["C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\google-workspace-mcp\index.js"],
    "env": {
      "GOOGLE_CLIENT_ID": "YOUR_GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET": "YOUR_GOOGLE_CLIENT_SECRET",
      "GOOGLE_REFRESH_TOKEN": "YOUR_GOOGLE_REFRESH_TOKEN"
    }
  }
}
```

## Environment Variables

- `GOOGLE_CLIENT_ID`: Required
- `GOOGLE_CLIENT_SECRET`: Required
- `GOOGLE_REFRESH_TOKEN`: Required

## Tools

### gmail_send_email
Send email

### calendar_create_event
Schedule meeting

### sheets_append_row
Add data to sheet

