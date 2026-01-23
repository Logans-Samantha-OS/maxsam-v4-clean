# MaxSam MCP Server v2.1.0

Complete MCP server for MaxSam V4 with 32 tools for N8N workflow management, property calculations, agreement automation, Telegram notifications, agent memory, and lead management.

## 🚀 Quick Start

### 1. Build the Server

```bash
cd C:\Users\MrTin\Downloads\MaxSam-V4\maxsam-n8n-mcp\maxsam-n8n-mcp
npm install
npm run build
```

### 2. Configure Claude Desktop

Copy the config to your Claude Desktop config location:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "maxsam": {
      "command": "node",
      "args": ["C:\\Users\\MrTin\\Downloads\\MaxSam-V4\\maxsam-n8n-mcp\\maxsam-n8n-mcp\\dist\\index.js"],
      "env": {
        "N8N_BASE_URL": "https://skooki.app.n8n.cloud",
        "N8N_API_KEY": "your-n8n-api-key",
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "TELEGRAM_BOT_TOKEN": "your-telegram-bot-token",
        "TELEGRAM_DEFAULT_CHAT_ID": "your-chat-id"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

Close and reopen Claude Desktop to load the new MCP server.

---

## 📋 Complete Tool Reference

### N8N Workflow Management (12 tools)

| Tool | Description |
|------|-------------|
| `n8n_list_workflows` | List all workflows with optional active filter |
| `n8n_get_workflow` | Get detailed workflow info by ID |
| `n8n_create_workflow` | Create a new workflow |
| `n8n_update_workflow` | Update an existing workflow |
| `n8n_delete_workflow` | Delete a workflow |
| `n8n_activate_workflow` | Activate/deactivate a workflow |
| `n8n_execute_workflow` | Execute a workflow manually |
| `n8n_get_executions` | Get execution history |
| `n8n_get_execution_data` | Get detailed execution results |
| `n8n_duplicate_workflow` | Clone a workflow |
| `n8n_get_credentials` | List available credentials |
| `n8n_test_webhook` | Test webhook triggers |

### Property/Zillow Calculations (4 tools)

| Tool | Description |
|------|-------------|
| `calculate_offer_price` | ARV × 0.70 - repairs formula |
| `calculate_buybox_price` | Calculate BuyBoxCartel listing range (75-82% ARV) |
| `get_leads_missing_arv` | Find leads needing Zillow scraping |
| `update_lead_arv` | Update lead ARV (auto-calculates offer_price) |

### Agreement Automation (4 tools)

| Tool | Description |
|------|-------------|
| `generate_agreement_data` | Prepare data for wholesale agreement |
| `mark_agreement_sent` | Track agreement sent status |
| `mark_agreement_signed` | Mark agreement as signed |
| `get_leads_ready_for_agreement` | Get leads ready for agreement generation |

### Telegram (2 tools)

| Tool | Description |
|------|-------------|
| `send_telegram_message` | Send notifications directly |
| `send_morning_brief_telegram` | Send full morning brief to Telegram |

### Agent Memory (2 tools)

| Tool | Description |
|------|-------------|
| `log_agent_action` | Log what ALEX/ELEANOR/SAM did |
| `get_agent_logs` | View agent activity |

### Lead Management (10 tools)

| Tool | Description |
|------|-------------|
| `get_morning_brief` | Get morning brief data |
| `get_leads` | Get leads with filters |
| `get_golden_leads` | Get high-value golden leads |
| `search_leads` | Search leads by name/address/phone |
| `update_lead_status` | Update lead status |
| `get_stats` | Get dashboard statistics |
| `calculate_fee` | Calculate recovery fee (25%) |
| `get_expiring_leads` | Get leads expiring soon |
| `add_lead` | Add a new lead |
| `log_sms` | Log SMS messages |

---

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `N8N_BASE_URL` | Yes | N8N instance URL (default: https://skooki.app.n8n.cloud) |
| `N8N_API_KEY` | Yes | N8N API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key (for admin ops) |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token |
| `TELEGRAM_DEFAULT_CHAT_ID` | Yes | Default Telegram chat ID |

---

## 📊 Example Usage

### Morning Brief
```
"Send me the morning brief"
→ Uses get_morning_brief + send_morning_brief_telegram
```

### Calculate Offer
```
"What should I offer on a property with ARV $350,000 and $30k repairs?"
→ Uses calculate_offer_price
→ Returns: Max offer = $215,000
```

### Find Golden Leads
```
"Show me the top 5 golden leads"
→ Uses get_golden_leads
```

### Execute N8N Workflow
```
"Run the skip trace workflow for lead abc123"
→ Uses n8n_execute_workflow
```

### Track Agent Activity
```
"What has ALEX done in the last 4 hours?"
→ Uses get_agent_logs with agent_name=ALEX, hours=4
```

---

## 🏗️ Architecture

```
maxsam-n8n-mcp/
├── src/
│   ├── index.ts           # Main MCP server with all tools
│   ├── constants.ts       # Configuration constants
│   ├── types.ts           # TypeScript interfaces
│   └── services/
│       ├── api-clients.ts         # N8N, Supabase, Telegram clients
│       ├── property-calculations.ts # ARV/offer calculations
│       └── agreement-utils.ts      # Agreement generation
├── dist/                  # Compiled JavaScript
├── package.json
└── tsconfig.json
```

---

## 🐛 Troubleshooting

### MCP not loading
1. Check Claude Desktop logs
2. Verify the path in config matches your build location
3. Ensure `npm run build` completed successfully

### N8N errors
1. Verify N8N_API_KEY is correct
2. Check N8N_BASE_URL matches your instance
3. Test with `n8n_get_credentials` first

### Supabase errors
1. Verify SUPABASE_URL format (include https://)
2. Check SUPABASE_ANON_KEY is the public key
3. Ensure tables exist (leads, agent_memories, sms_logs)

### Telegram not sending
1. Verify TELEGRAM_BOT_TOKEN is correct
2. Check TELEGRAM_DEFAULT_CHAT_ID
3. Ensure bot has permission to send to the chat

---

## 📝 Version History

- **v2.1.0** - Complete 32-tool MCP server
  - Full N8N workflow management
  - Property calculations with 70% rule
  - Agreement automation
  - Telegram integration
  - Agent memory logging
  - Lead management

---

Made for MaxSam V4 🚀
