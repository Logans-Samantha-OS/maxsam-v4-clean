/**
 * Clawdbot LLM Gate — Rate Limiter & Request Queue
 *
 * Prevents Claude API 429 errors by:
 * 1. Queuing all Claude calls with concurrency=1
 * 2. Enforcing 2000ms minimum between requests
 * 3. Hard capping prompt to 15K chars (truncate to last 12 messages, scrub large JSON)
 * 4. Exponential backoff on 429: 15s → 30s → 60s + jitter, max 3 retries
 * 5. Coalescing rapid Telegram messages (2s buffer per chat_id)
 * 6. Ops bypass: /status, /metrics, /stop, /start skip Claude entirely
 *
 * INSTALLATION:
 *   1. cd C:\Users\MrTin\clawd && npm init -y && npm install p-queue
 *   2. Copy this file to C:\Users\MrTin\clawd\hooks\llm-gate.js
 *   3. Add to C:\Users\MrTin\.clawdbot\clawdbot.json:
 *      "hooks": { "message.before": "C:\\Users\\MrTin\\clawd\\hooks\\llm-gate.js" }
 *   4. Restart: clawdbot gateway stop && clawdbot gateway run --verbose
 *
 * PLAN B (if hooks not supported):
 *   Find the file that makes Anthropic API calls and wrap it.
 *   See PLAN_B_PATCH section at bottom of file.
 */

const PQueue = require('p-queue').default;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  // Queue settings
  concurrency: 1,
  minIntervalMs: 2000,

  // Prompt truncation
  maxPromptChars: 15000,
  maxMessages: 12,

  // Backoff on 429
  retries: 3,
  baseBackoffMs: 15000, // 15s → 30s → 60s
  maxJitterMs: 3000,

  // Message coalescing
  coalesceWindowMs: 2000,

  // Ops commands that skip Claude entirely
  opsCommands: ['/status', '/metrics', '/stop', '/start', '/health', '/ping'],
};

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

const queue = new PQueue({
  concurrency: CONFIG.concurrency,
  interval: CONFIG.minIntervalMs,
  intervalCap: 1,
});

let lastRequestTime = 0;
const messageBuffer = new Map(); // chat_id → { messages: [], timer }
let stats = {
  totalRequests: 0,
  totalRetries: 0,
  total429s: 0,
  totalCoalesced: 0,
  totalBypassed: 0,
  lastRequestAt: null,
};

// ---------------------------------------------------------------------------
// Prompt truncation
// ---------------------------------------------------------------------------

/**
 * Truncate prompt to stay under token limits:
 * - Keep only last N messages
 * - Scrub large JSON blobs
 * - Hard cap at maxPromptChars
 */
function truncatePrompt(messages) {
  if (!Array.isArray(messages)) return messages;

  // Keep only the last N messages (system message + last 12 user/assistant turns)
  let truncated = messages;
  if (messages.length > CONFIG.maxMessages + 1) {
    const systemMsgs = messages.filter(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');
    truncated = [...systemMsgs, ...nonSystem.slice(-CONFIG.maxMessages)];
  }

  // Scrub large JSON in message content
  truncated = truncated.map(msg => {
    if (typeof msg.content === 'string' && msg.content.length > 3000) {
      // Try to detect JSON blobs and truncate them
      const scrubbed = msg.content.replace(
        /\{[^{}]{2000,}\}/g,
        '[JSON truncated for brevity]'
      );
      return { ...msg, content: scrubbed.slice(0, 3000) };
    }
    return msg;
  });

  // Final hard cap on total character count
  let totalChars = 0;
  const result = [];
  for (const msg of truncated) {
    const len = typeof msg.content === 'string' ? msg.content.length : JSON.stringify(msg.content).length;
    if (totalChars + len > CONFIG.maxPromptChars) {
      // Truncate this message's content to fit
      const remaining = CONFIG.maxPromptChars - totalChars;
      if (remaining > 100 && typeof msg.content === 'string') {
        result.push({ ...msg, content: msg.content.slice(0, remaining) + '...[truncated]' });
      }
      break;
    }
    totalChars += len;
    result.push(msg);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Exponential backoff with jitter
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBackoffMs(attempt) {
  const base = CONFIG.baseBackoffMs * Math.pow(2, attempt); // 15s, 30s, 60s
  const jitter = Math.random() * CONFIG.maxJitterMs;
  return base + jitter;
}

// ---------------------------------------------------------------------------
// Claude API call wrapper with retry
// ---------------------------------------------------------------------------

/**
 * Wraps a Claude API call function with queue, throttle, and retry logic.
 *
 * @param {Function} apiCallFn - The original function that calls Claude API.
 *                                Signature: (messages, options) => Promise<response>
 * @returns {Function} Wrapped function with identical signature
 */
function wrapClaudeCall(apiCallFn) {
  return async function gatedCall(messages, options = {}) {
    stats.totalRequests++;
    stats.lastRequestAt = new Date().toISOString();

    // Truncate prompt before sending
    const truncatedMessages = truncatePrompt(messages);

    // Queue the request (concurrency=1, min 2s interval)
    return queue.add(async () => {
      // Enforce minimum interval
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      if (elapsed < CONFIG.minIntervalMs) {
        await sleep(CONFIG.minIntervalMs - elapsed);
      }

      // Retry loop with exponential backoff
      for (let attempt = 0; attempt <= CONFIG.retries; attempt++) {
        try {
          lastRequestTime = Date.now();
          const result = await apiCallFn(truncatedMessages, options);
          return result;
        } catch (error) {
          const is429 = error?.status === 429 ||
            error?.statusCode === 429 ||
            error?.message?.includes('429') ||
            error?.message?.includes('rate limit');

          if (is429 && attempt < CONFIG.retries) {
            stats.total429s++;
            stats.totalRetries++;
            const backoff = getBackoffMs(attempt);
            console.log(`[LLM-GATE] 429 received, retry ${attempt + 1}/${CONFIG.retries} in ${Math.round(backoff / 1000)}s`);
            await sleep(backoff);
            continue;
          }

          throw error;
        }
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Message coalescing for Telegram
// ---------------------------------------------------------------------------

/**
 * Coalesces rapid Telegram messages from the same chat_id.
 * Buffers messages for 2s, then combines them into a single Claude request.
 *
 * @param {string} chatId - Telegram chat ID
 * @param {string} text - Message text
 * @param {Function} processCallback - Called with coalesced text after buffer window
 */
function coalesceMessage(chatId, text, processCallback) {
  const existing = messageBuffer.get(chatId);

  if (existing) {
    // Add to existing buffer
    existing.messages.push(text);
    stats.totalCoalesced++;

    // Reset timer
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => {
      const combined = existing.messages.join('\n');
      messageBuffer.delete(chatId);
      processCallback(combined);
    }, CONFIG.coalesceWindowMs);
  } else {
    // Start new buffer
    const entry = {
      messages: [text],
      timer: setTimeout(() => {
        messageBuffer.delete(chatId);
        processCallback(text);
      }, CONFIG.coalesceWindowMs),
    };
    messageBuffer.set(chatId, entry);
  }
}

// ---------------------------------------------------------------------------
// Ops command bypass
// ---------------------------------------------------------------------------

/**
 * Check if a message is an ops command that should skip Claude.
 * Returns the command name if bypassed, null otherwise.
 */
function checkOpsCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim().toLowerCase();
  for (const cmd of CONFIG.opsCommands) {
    if (trimmed === cmd || trimmed.startsWith(cmd + ' ')) {
      stats.totalBypassed++;
      return cmd;
    }
  }
  return null;
}

/**
 * Handle ops commands directly without Claude.
 */
function handleOpsCommand(command) {
  switch (command) {
    case '/status':
      return `MaxSam Status: Online\nQueue: ${queue.size} pending, ${queue.pending} active\nStats: ${JSON.stringify(stats, null, 2)}`;
    case '/metrics':
      return `LLM Gate Metrics:\n- Total requests: ${stats.totalRequests}\n- Total 429s: ${stats.total429s}\n- Total retries: ${stats.totalRetries}\n- Coalesced: ${stats.totalCoalesced}\n- Bypassed: ${stats.totalBypassed}\n- Last request: ${stats.lastRequestAt || 'never'}`;
    case '/health':
    case '/ping':
      return `Pong! Queue size: ${queue.size}, Pending: ${queue.pending}`;
    case '/stop':
      queue.pause();
      return 'LLM queue paused. No new Claude requests will be processed.';
    case '/start':
      queue.start();
      return 'LLM queue resumed.';
    default:
      return `Unknown ops command: ${command}`;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  wrapClaudeCall,
  coalesceMessage,
  checkOpsCommand,
  handleOpsCommand,
  truncatePrompt,
  getStats: () => ({ ...stats }),
  getQueueStatus: () => ({ size: queue.size, pending: queue.pending, isPaused: queue.isPaused }),
  CONFIG,
};

// ---------------------------------------------------------------------------
// PLAN B PATCH — Direct monkey-patch for Anthropic SDK
//
// If clawdbot does NOT support hooks, find the file that calls the Anthropic API:
//
//   Select-String -Path "C:\Users\MrTin\AppData\Roaming\npm\node_modules\clawdbot\**\*.js" \
//     -Pattern "anthropic|api\.anthropic\.com|messages\.create" -Recurse | Select -First 10
//
// Then add this at the TOP of that file:
//
//   const { wrapClaudeCall } = require('C:\\Users\\MrTin\\clawd\\hooks\\llm-gate.js');
//
// And wrap the API call. For example, if the original code is:
//
//   const response = await client.messages.create({ model, messages, ... });
//
// Replace with:
//
//   const _originalCreate = client.messages.create.bind(client.messages);
//   const _gatedCreate = wrapClaudeCall(async (msgs, opts) => {
//     return _originalCreate({ ...opts, messages: msgs });
//   });
//   const response = await _gatedCreate(messages, { model, ...otherOpts });
//
// ---------------------------------------------------------------------------
