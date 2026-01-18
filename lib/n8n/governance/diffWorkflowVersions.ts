/**
 * diffWorkflowVersions.ts
 * Phase 12.1 → 13.1 Bridge
 *
 * Deterministic workflow diff generation for audit and review.
 * Produces human-readable diffs with risk classification.
 */

import {
  N8NWorkflow,
  N8NNode,
  WorkflowDiffSummary,
  SensitiveChange,
  RISK_WEIGHTS,
} from './types';

// ============================================================================
// CORE DIFF FUNCTION
// ============================================================================

export function diffWorkflowVersions(
  previous: N8NWorkflow | null,
  proposed: N8NWorkflow
): WorkflowDiffSummary {
  // Handle new workflow case
  if (!previous) {
    return {
      nodesAdded: proposed.nodes.map((n) => n.name),
      nodesRemoved: [],
      nodesModified: [],
      connectionsChanged: true,
      settingsChanged: !!proposed.settings,
      credentialsChanged: proposed.nodes.some((n) => !!n.credentials),
      sensitiveChanges: detectSensitiveNodes(proposed.nodes, 'ADDED'),
      totalChanges: proposed.nodes.length + 1, // nodes + structure
    };
  }

  const previousNodeMap = new Map(previous.nodes.map((n) => [n.id, n]));
  const proposedNodeMap = new Map(proposed.nodes.map((n) => [n.id, n]));

  const nodesAdded: string[] = [];
  const nodesRemoved: string[] = [];
  const nodesModified: string[] = [];
  const sensitiveChanges: SensitiveChange[] = [];

  // Find added and modified nodes
  for (const [id, node] of proposedNodeMap) {
    const previousNode = previousNodeMap.get(id);
    if (!previousNode) {
      nodesAdded.push(node.name);
      sensitiveChanges.push(...detectSensitiveNode(node, 'ADDED'));
    } else if (!nodesEqual(previousNode, node)) {
      nodesModified.push(node.name);
      sensitiveChanges.push(...detectNodeChanges(previousNode, node));
    }
  }

  // Find removed nodes
  for (const [id, node] of previousNodeMap) {
    if (!proposedNodeMap.has(id)) {
      nodesRemoved.push(node.name);
      sensitiveChanges.push(...detectSensitiveNode(node, 'REMOVED'));
    }
  }

  // Check connections
  const connectionsChanged = !deepEqual(previous.connections, proposed.connections);

  // Check settings
  const settingsChanged = !deepEqual(previous.settings, proposed.settings);

  // Check credentials
  const credentialsChanged = checkCredentialsChanged(previous.nodes, proposed.nodes);

  return {
    nodesAdded,
    nodesRemoved,
    nodesModified,
    connectionsChanged,
    settingsChanged,
    credentialsChanged,
    sensitiveChanges,
    totalChanges: nodesAdded.length + nodesRemoved.length + nodesModified.length +
      (connectionsChanged ? 1 : 0) + (settingsChanged ? 1 : 0),
  };
}

// ============================================================================
// SENSITIVE CHANGE DETECTION
// ============================================================================

const SENSITIVE_NODE_TYPE_MAP: Record<string, SensitiveChange['type']> = {
  'n8n-nodes-base.httpRequest': 'HTTP_REQUEST',
  'n8n-nodes-base.webhook': 'WEBHOOK',
  'n8n-nodes-base.postgres': 'DATABASE',
  'n8n-nodes-base.supabase': 'DATABASE',
  'n8n-nodes-base.mysql': 'DATABASE',
  'n8n-nodes-base.mongodb': 'DATABASE',
  'n8n-nodes-base.redis': 'DATABASE',
  'n8n-nodes-base.slack': 'EXTERNAL_API',
  'n8n-nodes-base.telegram': 'EXTERNAL_API',
  'n8n-nodes-base.twilio': 'EXTERNAL_API',
  'n8n-nodes-base.stripe': 'EXTERNAL_API',
  'n8n-nodes-base.github': 'EXTERNAL_API',
};

function detectSensitiveNodes(nodes: N8NNode[], action: 'ADDED' | 'REMOVED'): SensitiveChange[] {
  const changes: SensitiveChange[] = [];

  for (const node of nodes) {
    changes.push(...detectSensitiveNode(node, action));
  }

  return changes;
}

function detectSensitiveNode(node: N8NNode, action: 'ADDED' | 'REMOVED'): SensitiveChange[] {
  const changes: SensitiveChange[] = [];
  const sensitiveType = SENSITIVE_NODE_TYPE_MAP[node.type];

  if (sensitiveType) {
    changes.push({
      type: sensitiveType,
      node: node.name,
      description: `${action}: ${node.type} node "${node.name}"`,
      riskContribution: getRiskWeight(sensitiveType),
    });
  }

  if (node.credentials && Object.keys(node.credentials).length > 0) {
    changes.push({
      type: 'CREDENTIAL',
      node: node.name,
      description: `${action}: Node "${node.name}" with credentials`,
      riskContribution: RISK_WEIGHTS.CREDENTIAL_CHANGE,
    });
  }

  return changes;
}

function detectNodeChanges(previous: N8NNode, proposed: N8NNode): SensitiveChange[] {
  const changes: SensitiveChange[] = [];

  // Check if it's a sensitive node type
  const sensitiveType = SENSITIVE_NODE_TYPE_MAP[proposed.type];

  // Parameters changed on sensitive node
  if (sensitiveType && !deepEqual(previous.parameters, proposed.parameters)) {
    changes.push({
      type: sensitiveType,
      node: proposed.name,
      description: `MODIFIED: Parameters changed on ${proposed.type} node "${proposed.name}"`,
      riskContribution: getRiskWeight(sensitiveType),
    });
  }

  // Credentials changed
  if (!deepEqual(previous.credentials, proposed.credentials)) {
    changes.push({
      type: 'CREDENTIAL',
      node: proposed.name,
      description: `MODIFIED: Credentials changed on node "${proposed.name}"`,
      riskContribution: RISK_WEIGHTS.CREDENTIAL_CHANGE,
    });
  }

  return changes;
}

function getRiskWeight(type: SensitiveChange['type']): number {
  switch (type) {
    case 'CREDENTIAL':
      return RISK_WEIGHTS.CREDENTIAL_CHANGE;
    case 'WEBHOOK':
      return RISK_WEIGHTS.WEBHOOK_CHANGE;
    case 'HTTP_REQUEST':
      return RISK_WEIGHTS.HTTP_REQUEST_CHANGE;
    case 'DATABASE':
      return RISK_WEIGHTS.DATABASE_CHANGE;
    case 'EXTERNAL_API':
      return RISK_WEIGHTS.EXTERNAL_API_CHANGE;
    default:
      return 5;
  }
}

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

function nodesEqual(a: N8NNode, b: N8NNode): boolean {
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.typeVersion === b.typeVersion &&
    deepEqual(a.parameters, b.parameters) &&
    deepEqual(a.credentials, b.credentials) &&
    a.disabled === b.disabled
  );
}

function checkCredentialsChanged(previousNodes: N8NNode[], proposedNodes: N8NNode[]): boolean {
  const previousCredsMap = new Map<string, Record<string, { id: string; name: string }>>();
  const proposedCredsMap = new Map<string, Record<string, { id: string; name: string }>>();

  for (const node of previousNodes) {
    if (node.credentials) {
      previousCredsMap.set(node.id, node.credentials);
    }
  }

  for (const node of proposedNodes) {
    if (node.credentials) {
      proposedCredsMap.set(node.id, node.credentials);
    }
  }

  // Different number of nodes with credentials
  if (previousCredsMap.size !== proposedCredsMap.size) {
    return true;
  }

  // Check each node's credentials
  for (const [nodeId, creds] of proposedCredsMap) {
    const previousCreds = previousCredsMap.get(nodeId);
    if (!previousCreds || !deepEqual(previousCreds, creds)) {
      return true;
    }
  }

  return false;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const aKeys = Object.keys(aObj).sort();
  const bKeys = Object.keys(bObj).sort();

  if (aKeys.length !== bKeys.length) return false;

  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    if (!deepEqual(aObj[aKeys[i]], bObj[bKeys[i]])) return false;
  }

  return true;
}

// ============================================================================
// HUMAN-READABLE DIFF OUTPUT
// ============================================================================

export function formatDiffAsText(diff: WorkflowDiffSummary): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    WORKFLOW CHANGE SUMMARY');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  if (diff.nodesAdded.length > 0) {
    lines.push('➕ NODES ADDED:');
    for (const node of diff.nodesAdded) {
      lines.push(`   • ${node}`);
    }
    lines.push('');
  }

  if (diff.nodesRemoved.length > 0) {
    lines.push('➖ NODES REMOVED:');
    for (const node of diff.nodesRemoved) {
      lines.push(`   • ${node}`);
    }
    lines.push('');
  }

  if (diff.nodesModified.length > 0) {
    lines.push('✏️ NODES MODIFIED:');
    for (const node of diff.nodesModified) {
      lines.push(`   • ${node}`);
    }
    lines.push('');
  }

  lines.push('📋 STRUCTURAL CHANGES:');
  lines.push(`   • Connections: ${diff.connectionsChanged ? 'CHANGED' : 'Unchanged'}`);
  lines.push(`   • Settings: ${diff.settingsChanged ? 'CHANGED' : 'Unchanged'}`);
  lines.push(`   • Credentials: ${diff.credentialsChanged ? 'CHANGED' : 'Unchanged'}`);
  lines.push('');

  if (diff.sensitiveChanges.length > 0) {
    lines.push('⚠️ SENSITIVE CHANGES:');
    for (const change of diff.sensitiveChanges) {
      lines.push(`   • [${change.type}] ${change.description} (risk: +${change.riskContribution})`);
    }
    lines.push('');
  }

  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`TOTAL CHANGES: ${diff.totalChanges}`);
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

export function formatDiffAsJSON(diff: WorkflowDiffSummary): string {
  return JSON.stringify(diff, null, 2);
}
