# Stripe MCP Server

Payment collection

## Installation

```bash
cd C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\stripe-mcp
npm install
```

## Configuration

Add to `claude_desktop_config.json`:

```json
{
  "stripe": {
    "command": "node",
    "args": ["C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\stripe-mcp\index.js"],
    "env": {
      "STRIPE_SECRET_KEY": "YOUR_STRIPE_SECRET_KEY"
    }
  }
}
```

## Environment Variables

- `STRIPE_SECRET_KEY`: Required

## Tools

### stripe_create_checkout_session
Create payment session

### stripe_create_invoice
Generate invoice

### stripe_get_payment_status
Check payment status

