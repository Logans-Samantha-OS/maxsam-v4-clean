import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { n8nClient, supabaseClient, telegramClient } from "./services/api-clients.js";
import { calculateOfferPrice, calculateBuyBoxPrice, validateARV, validateRepairs, formatCurrency } from "./services/property-calculations.js";
import { generateAgreementData, markAgreementSent, formatAgreementSummary } from "./services/agreement-utils.js";
import { TELEGRAM_DEFAULT_CHAT_ID, AGENT_NAMES, COMPANY_INFO, N8N_BASE_URL } from "./constants.js";

// Browserless Configuration
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY || '2TaFV71D6Cm56Ua44ab549b7e251fe9a85eb1e7a9b11a0aec';
const BROWSERLESS_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/browserless-fetch`;
const BROWSERLESS_DIRECT_URL = 'https://production-sfo.browserless.io';

// Initialize MCP Server
const server = new McpServer({
  name: "maxsam",
  version: "2.2.0",
});

// ============================================================
// BROWSERLESS TOOLS (5 tools)
// ============================================================

// browserless_fetch_html - Fetch HTML from JS-heavy pages
server.tool(
  "browserless_fetch_html",
  "Fetch HTML from JavaScript-heavy pages (Zillow, portals) using Browserless headless Chrome. Use for sites that require JS rendering.",
  {
    url: z.string().url().describe("URL to fetch"),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional().default('networkidle0').describe("Wait condition"),
    useN8n: z.boolean().optional().default(false).describe("Route through n8n workflow"),
  },
  async ({ url, waitUntil, useN8n }) => {
    try {
      const startTime = Date.now();
      
      if (useN8n) {
        const response = await fetch(BROWSERLESS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, waitUntil }),
        });
        
        if (!response.ok) throw new Error(`n8n webhook returned ${response.status}`);
        
        const result = await response.json() as { success: boolean; html?: string; error?: string };
        const duration = Date.now() - startTime;
        
        if (result.success && result.html) {
          const preview = result.html.substring(0, 500).replace(/\s+/g, ' ');
          return {
            content: [{
              type: "text",
              text: `✅ Browserless fetch (n8n)\nURL: ${url}\nSize: ${result.html.length.toLocaleString()} chars\nDuration: ${duration}ms\n\nPreview:\n${preview}...`,
            }],
          };
        }
        throw new Error(result.error || 'Unknown error');
      }
      
      // Direct Browserless API
      const response = await fetch(`${BROWSERLESS_DIRECT_URL}/content?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, waitUntil, gotoOptions: { timeout: 30000 } }),
      });
      
      if (!response.ok) throw new Error(`Browserless API returned ${response.status}`);
      
      const html = await response.text();
      const duration = Date.now() - startTime;
      const preview = html.substring(0, 500).replace(/\s+/g, ' ');
      
      return {
        content: [{
          type: "text",
          text: `✅ Browserless fetch (direct)\nURL: ${url}\nSize: ${html.length.toLocaleString()} chars\nDuration: ${duration}ms\n\nPreview:\n${preview}...`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Browserless fetch failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// browserless_screenshot - Take screenshot
server.tool(
  "browserless_screenshot",
  "Take a screenshot of a webpage using Browserless headless Chrome",
  {
    url: z.string().url().describe("URL to screenshot"),
    fullPage: z.boolean().optional().default(false).describe("Capture full page"),
  },
  async ({ url, fullPage }) => {
    try {
      const startTime = Date.now();
      const response = await fetch(`${BROWSERLESS_DIRECT_URL}/screenshot?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          options: { fullPage, type: 'png' },
          gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
        }),
      });
      
      if (!response.ok) throw new Error(`Screenshot failed: ${response.status}`);
      
      const buffer = await response.arrayBuffer();
      const duration = Date.now() - startTime;
      
      return {
        content: [{
          type: "text",
          text: `✅ Screenshot captured!\nURL: ${url}\nFull Page: ${fullPage}\nSize: ${buffer.byteLength.toLocaleString()} bytes\nDuration: ${duration}ms`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Screenshot failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// browserless_pdf - Generate PDF
server.tool(
  "browserless_pdf",
  "Generate a PDF of a webpage using Browserless",
  {
    url: z.string().url().describe("URL to convert to PDF"),
  },
  async ({ url }) => {
    try {
      const startTime = Date.now();
      const response = await fetch(`${BROWSERLESS_DIRECT_URL}/pdf?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          options: { printBackground: true, format: 'Letter' },
          gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
        }),
      });
      
      if (!response.ok) throw new Error(`PDF failed: ${response.status}`);
      
      const buffer = await response.arrayBuffer();
      const duration = Date.now() - startTime;
      
      return {
        content: [{
          type: "text",
          text: `✅ PDF generated!\nURL: ${url}\nSize: ${buffer.byteLength.toLocaleString()} bytes\nDuration: ${duration}ms`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ PDF failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// browserless_scrape - Scrape specific elements
server.tool(
  "browserless_scrape",
  "Scrape specific elements from a webpage using CSS selectors",
  {
    url: z.string().url().describe("URL to scrape"),
    selectors: z.array(z.string()).describe("CSS selectors to extract"),
  },
  async ({ url, selectors }) => {
    try {
      const startTime = Date.now();
      const elements = selectors.map(selector => ({ selector }));
      
      const response = await fetch(`${BROWSERLESS_DIRECT_URL}/scrape?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          elements,
          gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
        }),
      });
      
      if (!response.ok) throw new Error(`Scrape failed: ${response.status}`);
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      return {
        content: [{
          type: "text",
          text: `✅ Scrape successful!\nURL: ${url}\nDuration: ${duration}ms\n\nResults:\n${JSON.stringify(result, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Scrape failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// browserless_zillow - Specialized Zillow scraper
server.tool(
  "browserless_zillow",
  "Scrape Zillow property data (Zestimate, beds, baths, sqft) from a Zillow URL",
  {
    url: z.string().url().describe("Zillow property URL"),
  },
  async ({ url }) => {
    try {
      if (!url.includes('zillow.com')) {
        return { content: [{ type: "text", text: "❌ URL must be a Zillow property page" }], isError: true };
      }
      
      const startTime = Date.now();
      const response = await fetch(`${BROWSERLESS_DIRECT_URL}/content?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, waitUntil: 'networkidle0', gotoOptions: { timeout: 45000 } }),
      });
      
      if (!response.ok) throw new Error(`Browserless returned ${response.status}`);
      
      const html = await response.text();
      const duration = Date.now() - startTime;
      
      // Extract data using regex
      const zestimateMatch = html.match(/\$[\d,]+(?=<\/span>.*?Zestimate)/i) || html.match(/"zestimate":\s*(\d+)/i);
      const priceMatch = html.match(/\$[\d,]+(?=<\/span>.*?(?:Price|Sold))/i) || html.match(/"price":\s*(\d+)/i);
      const bedsMatch = html.match(/(\d+)\s*(?:bd|bed|bedroom)/i);
      const bathsMatch = html.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|bathroom)/i);
      const sqftMatch = html.match(/([\d,]+)\s*(?:sqft|sq\s*ft|square\s*feet)/i);
      const addressMatch = html.match(/<h1[^>]*>([^<]+)</i);
      const yearBuiltMatch = html.match(/(?:Built|Year\s*Built)[:\s]*(\d{4})/i);
      
      const zestimate = zestimateMatch ? zestimateMatch[0].replace(/[$,]/g, '') : null;
      const price = priceMatch ? priceMatch[0].replace(/[$,]/g, '') : null;
      
      return {
        content: [{
          type: "text",
          text: `🏠 ZILLOW PROPERTY DATA
━━━━━━━━━━━━━━━━━━━━━━
Address: ${addressMatch ? addressMatch[1].trim() : 'Not found'}
Zestimate: ${zestimate ? '$' + parseInt(zestimate).toLocaleString() : 'Not found'}
Price: ${price ? '$' + parseInt(price).toLocaleString() : 'Not found'}
Beds: ${bedsMatch ? bedsMatch[1] : 'N/A'}
Baths: ${bathsMatch ? bathsMatch[1] : 'N/A'}
Sqft: ${sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')).toLocaleString() : 'N/A'}
Year Built: ${yearBuiltMatch ? yearBuiltMatch[1] : 'N/A'}

Duration: ${duration}ms
URL: ${url}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ Zillow scrape failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ============================================================
// N8N WORKFLOW MANAGEMENT TOOLS (12 tools)
// ============================================================

server.tool("n8n_list_workflows", "List all N8N workflows", { active: z.boolean().optional() }, async ({ active }) => {
  try {
    const workflows = await n8nClient.listWorkflows(active);
    const summary = workflows.map(wf => `${wf.active ? '🟢' : '⚪'} ${wf.name} (ID: ${wf.id})`).join('\n');
    return { content: [{ type: "text", text: `Found ${workflows.length} workflows:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_get_workflow", "Get workflow by ID", { id: z.string() }, async ({ id }) => {
  try {
    const wf = await n8nClient.getWorkflow(id);
    const nodes = wf.nodes?.map(n => `  • ${n.name} (${n.type})`).join('\n') || 'No nodes';
    return { content: [{ type: "text", text: `📋 ${wf.name}\nID: ${wf.id}\nActive: ${wf.active ? '🟢' : '⚪'}\n\nNodes:\n${nodes}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_create_workflow", "Create workflow", { name: z.string(), nodes: z.array(z.any()), connections: z.record(z.any()).optional() }, async ({ name, nodes, connections }) => {
  try {
    const wf = await n8nClient.createWorkflow({ name, nodes, connections });
    return { content: [{ type: "text", text: `✅ Created: ${wf.name} (ID: ${wf.id})` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_update_workflow", "Update workflow", { id: z.string(), name: z.string().optional(), active: z.boolean().optional() }, async ({ id, name, active }) => {
  try {
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (active !== undefined) updates.active = active;
    const wf = await n8nClient.updateWorkflow(id, updates);
    return { content: [{ type: "text", text: `✅ Updated: ${wf.name}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_delete_workflow", "Delete workflow", { id: z.string() }, async ({ id }) => {
  try {
    await n8nClient.deleteWorkflow(id);
    return { content: [{ type: "text", text: `✅ Deleted: ${id}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_activate_workflow", "Activate/deactivate workflow", { id: z.string(), active: z.boolean() }, async ({ id, active }) => {
  try {
    const wf = await n8nClient.activateWorkflow(id, active);
    return { content: [{ type: "text", text: `${active ? '🟢' : '⚪'} "${wf.name}" is now ${active ? 'ACTIVE' : 'INACTIVE'}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_execute_workflow", "Execute workflow", { id: z.string(), data: z.record(z.any()).optional() }, async ({ id, data }) => {
  try {
    const ex = await n8nClient.executeWorkflow(id, data);
    return { content: [{ type: "text", text: `🚀 Execution started: ${ex.id} (${ex.status})` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_get_executions", "Get execution history", { workflowId: z.string().optional(), status: z.string().optional(), limit: z.number().optional().default(10) }, async ({ workflowId, status, limit }) => {
  try {
    const execs = await n8nClient.getExecutions({ workflowId, status: status as any, limit });
    if (!execs.length) return { content: [{ type: "text", text: "No executions found." }] };
    const summary = execs.map(e => `${e.status === 'success' ? '✅' : '❌'} ${e.id} - ${e.status}`).join('\n');
    return { content: [{ type: "text", text: `Found ${execs.length} executions:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_get_execution_data", "Get execution details", { executionId: z.string() }, async ({ executionId }) => {
  try {
    const ex = await n8nClient.getExecutionData(executionId);
    return { content: [{ type: "text", text: `${ex.status === 'success' ? '✅' : '❌'} Execution ${executionId}\nStatus: ${ex.status}\nStarted: ${ex.startedAt}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_duplicate_workflow", "Clone workflow", { id: z.string(), newName: z.string().optional() }, async ({ id, newName }) => {
  try {
    const wf = await n8nClient.duplicateWorkflow(id, newName);
    return { content: [{ type: "text", text: `✅ Duplicated: ${wf.name} (ID: ${wf.id})` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_get_credentials", "List credentials", {}, async () => {
  try {
    const creds = await n8nClient.getCredentials();
    const summary = creds.map(c => `• ${c.name} (${c.type})`).join('\n');
    return { content: [{ type: "text", text: `Found ${creds.length} credentials:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("n8n_test_webhook", "Test webhook", { id: z.string() }, async ({ id }) => {
  try {
    const url = await n8nClient.getWebhookUrl(id);
    if (!url) return { content: [{ type: "text", text: `No webhook for ${id}` }] };
    const result = await n8nClient.testWebhook(url, { test: true });
    return { content: [{ type: "text", text: `${result.success ? '✅' : '❌'} ${url}\nStatus: ${result.statusCode}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

// ============================================================
// PROPERTY CALCULATIONS (4 tools)
// ============================================================

server.tool("calculate_offer_price", "Calculate offer: ARV × 0.70 - repairs", { arv: z.number().positive(), repair_estimate: z.number().optional().default(0) }, async ({ arv, repair_estimate }) => {
  const result = calculateOfferPrice(arv, repair_estimate || 0);
  return { content: [{ type: "text", text: `💰 OFFER: ${formatCurrency(result.maxOffer)}\nARV: ${formatCurrency(arv)} | Repairs: ${formatCurrency(repair_estimate || 0)}\nFormula: ${result.formula}` }] };
});

server.tool("calculate_buybox_price", "Calculate BuyBox listing range", { arv: z.number().positive(), offer_price: z.number().positive() }, async ({ arv, offer_price }) => {
  const result = calculateBuyBoxPrice(offer_price, arv);
  return { content: [{ type: "text", text: `📊 BUYBOX\nMin: ${formatCurrency(result.recommendedListMin)} | Max: ${formatCurrency(result.recommendedListMax)}\nProfit: ${formatCurrency(result.expectedProfit)}` }] };
});

server.tool("get_leads_missing_arv", "Find leads needing Zillow ARV", { limit: z.number().optional().default(50) }, async ({ limit }) => {
  try {
    const leads = await supabaseClient.getLeadsMissingARV(limit);
    if (!leads.length) return { content: [{ type: "text", text: "✅ All leads have ARV!" }] };
    const summary = leads.slice(0, 10).map(l => `• ${l.name || 'Unknown'} - ${l.address}`).join('\n');
    return { content: [{ type: "text", text: `🔍 ${leads.length} leads missing ARV:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("update_lead_arv", "Update lead ARV + calc offer", { lead_id: z.string(), arv: z.number().positive(), repair_estimate: z.number().optional().default(0) }, async ({ lead_id, arv, repair_estimate }) => {
  try {
    const result = await supabaseClient.updateLeadARV(lead_id, arv, repair_estimate);
    return { content: [{ type: "text", text: `✅ Updated!\nARV: ${formatCurrency(arv)} | Offer: ${formatCurrency(result.offerPrice || 0)}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

// ============================================================
// AGREEMENT TOOLS (4 tools)
// ============================================================

server.tool("generate_agreement_data", "Generate agreement data", { lead_id: z.string(), purchasePrice: z.number(), earnestMoney: z.number(), closingDays: z.number().optional().default(30) }, async ({ lead_id, purchasePrice, earnestMoney, closingDays }) => {
  try {
    const data = await generateAgreementData(lead_id, purchasePrice, earnestMoney, closingDays);
    return { content: [{ type: "text", text: formatAgreementSummary(data) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("mark_agreement_sent", "Mark agreement sent", { lead_id: z.string() }, async ({ lead_id }) => {
  try {
    const status = await markAgreementSent(lead_id, `AGR-${Date.now()}`, 'email');
    return { content: [{ type: "text", text: `✅ Agreement sent for ${lead_id}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("mark_agreement_signed", "Mark agreement signed", { lead_id: z.string() }, async ({ lead_id }) => {
  try {
    await supabaseClient.markAgreementSigned(lead_id);
    return { content: [{ type: "text", text: `✅ Agreement signed! ${lead_id} → UNDER CONTRACT 🎉` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("get_leads_ready_for_agreement", "Get leads ready for agreement", { limit: z.number().optional().default(20) }, async ({ limit }) => {
  try {
    const leads = await supabaseClient.getLeadsReadyForAgreement(limit);
    if (!leads.length) return { content: [{ type: "text", text: "No leads ready." }] };
    const summary = leads.map(l => `• ${l.name} - ${l.phone || 'No phone'}`).join('\n');
    return { content: [{ type: "text", text: `📝 ${leads.length} ready:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

// ============================================================
// TELEGRAM TOOLS (2 tools)
// ============================================================

server.tool("send_telegram_message", "Send Telegram message", { message: z.string() }, async ({ message }) => {
  try {
    if (!TELEGRAM_DEFAULT_CHAT_ID) return { content: [{ type: "text", text: "❌ No chat ID" }], isError: true };
    const result = await telegramClient.sendMessage(TELEGRAM_DEFAULT_CHAT_ID, message, 'HTML');
    return { content: [{ type: "text", text: result.ok ? `✅ Sent! ID: ${result.messageId}` : `❌ ${result.error}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("send_morning_brief_telegram", "Send morning brief to Telegram", {}, async () => {
  try {
    if (!TELEGRAM_DEFAULT_CHAT_ID) return { content: [{ type: "text", text: "❌ No chat ID" }], isError: true };
    const brief = await supabaseClient.getMorningBrief();
    const result = await telegramClient.sendMorningBrief(TELEGRAM_DEFAULT_CHAT_ID, brief);
    return { content: [{ type: "text", text: result.ok ? `✅ Brief sent!` : `❌ ${result.error}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

// ============================================================
// AGENT MEMORY TOOLS (2 tools)
// ============================================================

server.tool("log_agent_action", "Log ALEX/ELEANOR/SAM action", { agent_name: z.enum(AGENT_NAMES), action_type: z.string(), content: z.string(), lead_id: z.string().optional() }, async ({ agent_name, action_type, content, lead_id }) => {
  try {
    await supabaseClient.logAgentAction({ agentName: agent_name, actionType: action_type, actionDetails: { content }, leadId: lead_id, success: true, timestamp: new Date().toISOString() });
    return { content: [{ type: "text", text: `✅ Logged: [${agent_name}] ${action_type}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("get_agent_logs", "Get agent activity logs", { agent_name: z.enum(AGENT_NAMES).optional(), hours: z.number().optional().default(24), limit: z.number().optional().default(20) }, async ({ agent_name, hours, limit }) => {
  try {
    const startDate = new Date(); startDate.setHours(startDate.getHours() - (hours || 24));
    const logs = await supabaseClient.getAgentLogs({ agentName: agent_name, startDate: startDate.toISOString(), limit });
    if (!logs.length) return { content: [{ type: "text", text: "No logs found." }] };
    const summary = logs.map(l => `${l.success ? '✅' : '❌'} [${l.agentName}] ${l.actionType}`).join('\n');
    return { content: [{ type: "text", text: `📋 ${logs.length} logs:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

// ============================================================
// LEAD MANAGEMENT TOOLS (10 tools)
// ============================================================

server.tool("get_morning_brief", "Get morning brief", {}, async () => {
  try {
    const b = await supabaseClient.getMorningBrief();
    return { content: [{ type: "text", text: `🌅 BRIEF - ${b.date}\nLeads: ${b.totalLeads} | Golden: ${b.goldenLeads} 🏆 | Expiring: ${b.expiringIn7Days} ⚠️\nPipeline: $${b.pipelineValue.toLocaleString()} | Revenue: $${b.expectedRevenue.toLocaleString()}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("get_leads", "Get leads with filters", { status: z.string().optional(), priority: z.string().optional(), limit: z.number().optional().default(20) }, async ({ status, priority, limit }) => {
  try {
    const leads = await supabaseClient.getLeads({ status, priority, limit });
    if (!leads.length) return { content: [{ type: "text", text: "No leads." }] };
    const summary = leads.map(l => `• ${l.name} | ${l.status} | $${(l.excessFundsAmount || 0).toLocaleString()}`).join('\n');
    return { content: [{ type: "text", text: `Found ${leads.length}:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("get_golden_leads", "Get golden leads", { limit: z.number().optional().default(10) }, async ({ limit }) => {
  try {
    const leads = await supabaseClient.getGoldenLeads(limit);
    if (!leads.length) return { content: [{ type: "text", text: "No golden leads." }] };
    const summary = leads.map(l => `🏆 ${l.name} - $${(l.excessFundsAmount || 0).toLocaleString()}`).join('\n');
    return { content: [{ type: "text", text: `${leads.length} Golden:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("search_leads", "Search leads", { query: z.string() }, async ({ query }) => {
  try {
    const leads = await supabaseClient.searchLeads(query);
    if (!leads.length) return { content: [{ type: "text", text: `No results for "${query}"` }] };
    const summary = leads.slice(0, 10).map(l => `• ${l.name} | ${l.address}`).join('\n');
    return { content: [{ type: "text", text: `Found ${leads.length}:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("update_lead_status", "Update lead status", { lead_id: z.string(), status: z.string(), notes: z.string().optional() }, async ({ lead_id, status, notes }) => {
  try {
    await supabaseClient.updateLeadStatus(lead_id, status, notes);
    return { content: [{ type: "text", text: `✅ ${lead_id} → ${status}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("get_stats", "Get dashboard stats", {}, async () => {
  try {
    const s = await supabaseClient.getStats();
    return { content: [{ type: "text", text: `📊 STATS\nTotal: ${s.totalLeads} | New: ${s.newLeads} | Golden: ${s.goldenLeads} 🏆 | Contract: ${s.underContract} | Closed: ${s.closed} 🎉` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("calculate_fee", "Calculate recovery fee", { amount: z.number().positive(), fee_percent: z.number().optional().default(0.25) }, async ({ amount, fee_percent }) => {
  const fee = amount * (fee_percent || 0.25);
  return { content: [{ type: "text", text: `💰 Fee (${((fee_percent || 0.25) * 100)}%): ${formatCurrency(fee)}\nClient: ${formatCurrency(amount - fee)}` }] };
});

server.tool("get_expiring_leads", "Get expiring leads", { days: z.number().optional().default(7) }, async ({ days }) => {
  try {
    const leads = await supabaseClient.getExpiringLeads(days);
    if (!leads.length) return { content: [{ type: "text", text: `No leads expiring in ${days} days.` }] };
    const summary = leads.map(l => `⚠️ ${l.name} - ${l.expirationDate}`).join('\n');
    return { content: [{ type: "text", text: `🚨 ${leads.length} expiring:\n\n${summary}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("add_lead", "Add new lead", { owner_name: z.string(), property_address: z.string().optional(), phone: z.string().optional(), excess_amount: z.number().optional(), source: z.string().optional() }, async ({ owner_name, property_address, phone, excess_amount, source }) => {
  try {
    const lead = await supabaseClient.addLead({ name: owner_name, address: property_address || '', phone, excessFundsAmount: excess_amount, source });
    return { content: [{ type: "text", text: `✅ Added: ${lead.name} (${lead.id})` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

server.tool("log_sms", "Log SMS message", { lead_id: z.string(), message: z.string(), direction: z.enum(['inbound', 'outbound']) }, async ({ lead_id, message, direction }) => {
  try {
    await supabaseClient.logSMS({ leadId: lead_id, message, direction, timestamp: new Date().toISOString() });
    return { content: [{ type: "text", text: `✅ SMS logged: ${direction}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

// ============================================================
// SERVER STARTUP
// ============================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MaxSam MCP Server v2.2.0 started");
  console.error("Tools: 37 total");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("Browserless (5): browserless_fetch_html, browserless_screenshot, browserless_pdf, browserless_scrape, browserless_zillow");
  console.error("N8N (12): list/get/create/update/delete/activate workflows, execute, executions, credentials, webhooks");
  console.error("Property (4): calculate_offer_price, calculate_buybox_price, get_leads_missing_arv, update_lead_arv");
  console.error("Agreement (4): generate_agreement_data, mark_agreement_sent, mark_agreement_signed, get_leads_ready_for_agreement");
  console.error("Telegram (2): send_telegram_message, send_morning_brief_telegram");
  console.error("Agent Memory (2): log_agent_action, get_agent_logs");
  console.error("Leads (8): get_morning_brief, get_leads, get_golden_leads, search_leads, update_lead_status, get_stats, get_expiring_leads, add_lead, calculate_fee, log_sms");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
