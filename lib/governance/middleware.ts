/**
 * Governance Middleware - MaxSam V4 Agentic Control System
 *
 * Provides utilities to enforce gate checks in API routes.
 * All execution paths must use this middleware to ensure consistent gate enforcement.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkMasterGate,
  checkWorkflowGate,
  checkAgentGate,
  checkN8nWorkflowGate,
  createBlockedResponse,
  GateCheckResult
} from './gates';

export type GateConfig = {
  master?: boolean;
  agent?: 'orion' | 'ralph' | 'sam';
  gate?: string;
  n8n_workflow?: string;
};

/**
 * Higher-order function to wrap API route handlers with gate enforcement.
 *
 * Usage:
 * ```ts
 * export const POST = withGateEnforcement(
 *   { agent: 'orion', gate: 'gate_orion_scoring' },
 *   async (request) => {
 *     // Your route logic here
 *   }
 * );
 * ```
 */
export function withGateEnforcement(
  config: GateConfig,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Always check master gate
    const masterCheck = await checkMasterGate();
    if (!masterCheck.allowed) {
      return NextResponse.json(createBlockedResponse(masterCheck), { status: 503 });
    }

    // Check agent gate if specified
    if (config.agent) {
      const agentCheck = await checkAgentGate(config.agent);
      if (!agentCheck.allowed) {
        return NextResponse.json(createBlockedResponse(agentCheck), { status: 503 });
      }
    }

    // Check specific gate if specified
    if (config.gate) {
      const gateCheck = await checkWorkflowGate(config.gate);
      if (!gateCheck.allowed) {
        return NextResponse.json(createBlockedResponse(gateCheck), { status: 503 });
      }
    }

    // Check n8n workflow gate if specified
    if (config.n8n_workflow) {
      const n8nCheck = await checkN8nWorkflowGate(config.n8n_workflow);
      if (!n8nCheck.allowed) {
        return NextResponse.json(createBlockedResponse(n8nCheck), { status: 503 });
      }
    }

    // All gates passed, execute handler
    return handler(request);
  };
}

/**
 * Inline gate check for existing routes.
 * Returns null if all gates pass, or the first failing GateCheckResult.
 *
 * Usage:
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const blocked = await enforceGates({ agent: 'ralph', gate: 'gate_ralph_execution' });
 *   if (blocked) {
 *     return NextResponse.json(createBlockedResponse(blocked), { status: 503 });
 *   }
 *   // Your route logic here
 * }
 * ```
 */
export async function enforceGates(gates: GateConfig): Promise<GateCheckResult | null> {
  // Always check master gate
  const masterCheck = await checkMasterGate();
  if (!masterCheck.allowed) return masterCheck;

  // Check agent gate if specified
  if (gates.agent) {
    const agentCheck = await checkAgentGate(gates.agent);
    if (!agentCheck.allowed) return agentCheck;
  }

  // Check specific gate if specified
  if (gates.gate) {
    const gateCheck = await checkWorkflowGate(gates.gate);
    if (!gateCheck.allowed) return gateCheck;
  }

  // Check n8n workflow gate if specified
  if (gates.n8n_workflow) {
    const n8nCheck = await checkN8nWorkflowGate(gates.n8n_workflow);
    if (!n8nCheck.allowed) return n8nCheck;
  }

  // All gates passed
  return null;
}

/**
 * Re-export createBlockedResponse for convenience
 */
export { createBlockedResponse } from './gates';
