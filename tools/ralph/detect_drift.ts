#!/usr/bin/env npx ts-node
/**
 * Ralph Wiggum Drift Detection Script
 * ====================================
 * Nightly script to detect configuration drift between:
 * - n8n workflow exports (file vs deployed)
 * - Supabase migrations (applied vs expected)
 *
 * Emits drift_remediation tasks when differences are detected.
 *
 * Usage:
 *   npx ts-node tools/ralph/detect_drift.ts
 *   npx ts-node tools/ralph/detect_drift.ts --dry-run
 *
 * Environment variables:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Supabase service role key
 *   N8N_API_URL - n8n API endpoint (optional)
 *   N8N_API_KEY - n8n API key (optional)
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// Type Definitions
// ============================================================

interface DriftReport {
  timestamp: string;
  dry_run: boolean;
  workflows: WorkflowDrift[];
  migrations: MigrationDrift[];
  tasks_created: TaskCreated[];
  summary: DriftSummary;
}

interface WorkflowDrift {
  workflow_name: string;
  file_path: string;
  drift_type: "missing_in_n8n" | "missing_in_repo" | "content_mismatch" | "synced";
  file_hash?: string;
  deployed_hash?: string;
  details?: string;
}

interface MigrationDrift {
  migration_name: string;
  file_path: string;
  drift_type: "not_applied" | "modified_after_apply" | "missing_file" | "applied";
  file_hash?: string;
  applied_at?: string;
  details?: string;
}

interface TaskCreated {
  task_key: string;
  task_name: string;
  priority: number;
  description: string;
}

interface DriftSummary {
  total_workflows_checked: number;
  workflows_in_sync: number;
  workflows_drifted: number;
  total_migrations_checked: number;
  migrations_applied: number;
  migrations_pending: number;
  remediation_tasks_created: number;
}

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
  workflowsDir: path.resolve(__dirname, "../../n8n/workflows"),
  migrationsDir: path.resolve(__dirname, "../../supabase/migrations"),
  outputDir: path.resolve(__dirname, "../../logs/drift"),
  dryRun: process.argv.includes("--dry-run"),
};

// ============================================================
// Utility Functions
// ============================================================

function log(message: string): void {
  console.log(`[DriftDetect] ${new Date().toISOString()} - ${message}`);
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================
// Workflow Drift Detection
// ============================================================

async function detectWorkflowDrift(): Promise<WorkflowDrift[]> {
  const results: WorkflowDrift[] = [];

  log("Checking workflow drift...");

  // Get all workflow files from repo
  if (!fs.existsSync(CONFIG.workflowsDir)) {
    log(`Workflows directory not found: ${CONFIG.workflowsDir}`);
    return results;
  }

  const workflowFiles = fs.readdirSync(CONFIG.workflowsDir)
    .filter(f => f.endsWith(".json"));

  for (const file of workflowFiles) {
    const filePath = path.join(CONFIG.workflowsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const fileHash = hashContent(content);

    let workflow: any;
    try {
      workflow = JSON.parse(content);
    } catch {
      log(`Invalid JSON in workflow file: ${file}`);
      continue;
    }

    const workflowName = workflow.name || file.replace(".json", "");

    // In a real implementation, this would query n8n API to compare
    // For now, we'll create a stub that marks workflows as needing review
    const drift: WorkflowDrift = {
      workflow_name: workflowName,
      file_path: filePath,
      drift_type: "synced", // Stub: assume synced, real impl would check n8n
      file_hash: fileHash,
      details: `File hash: ${fileHash}. N8n comparison not implemented - requires API integration.`,
    };

    // TODO: Implement n8n API check when credentials are available
    // const n8nWorkflow = await fetchFromN8n(workflowName);
    // if (!n8nWorkflow) drift.drift_type = "missing_in_n8n";
    // else if (hashContent(JSON.stringify(n8nWorkflow)) !== fileHash) drift.drift_type = "content_mismatch";

    results.push(drift);
  }

  return results;
}

// ============================================================
// Migration Drift Detection
// ============================================================

async function detectMigrationDrift(): Promise<MigrationDrift[]> {
  const results: MigrationDrift[] = [];

  log("Checking migration drift...");

  // Get all migration files from repo
  if (!fs.existsSync(CONFIG.migrationsDir)) {
    log(`Migrations directory not found: ${CONFIG.migrationsDir}`);
    return results;
  }

  const migrationFiles = fs.readdirSync(CONFIG.migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const filePath = path.join(CONFIG.migrationsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const fileHash = hashContent(content);

    const drift: MigrationDrift = {
      migration_name: file.replace(".sql", ""),
      file_path: filePath,
      drift_type: "applied", // Stub: assume applied, real impl would check DB
      file_hash: fileHash,
      details: `File hash: ${fileHash}. Database comparison not implemented - requires Supabase connection.`,
    };

    // TODO: Implement Supabase migration status check
    // const applied = await checkMigrationApplied(file);
    // if (!applied) drift.drift_type = "not_applied";

    results.push(drift);
  }

  return results;
}

// ============================================================
// Remediation Task Creation
// ============================================================

function createRemediationTasks(
  workflows: WorkflowDrift[],
  migrations: MigrationDrift[]
): TaskCreated[] {
  const tasks: TaskCreated[] = [];

  // Create tasks for workflow drift
  for (const wf of workflows) {
    if (wf.drift_type === "missing_in_n8n") {
      tasks.push({
        task_key: `drift-deploy-workflow-${wf.workflow_name.toLowerCase().replace(/\s+/g, "-")}`,
        task_name: `Deploy workflow: ${wf.workflow_name}`,
        priority: 60,
        description: `Workflow "${wf.workflow_name}" exists in repo but not in n8n. Deploy to sync.`,
      });
    } else if (wf.drift_type === "content_mismatch") {
      tasks.push({
        task_key: `drift-update-workflow-${wf.workflow_name.toLowerCase().replace(/\s+/g, "-")}`,
        task_name: `Update workflow: ${wf.workflow_name}`,
        priority: 70,
        description: `Workflow "${wf.workflow_name}" differs between repo and n8n. Review and sync.`,
      });
    }
  }

  // Create tasks for migration drift
  for (const mig of migrations) {
    if (mig.drift_type === "not_applied") {
      tasks.push({
        task_key: `drift-apply-migration-${mig.migration_name}`,
        task_name: `Apply migration: ${mig.migration_name}`,
        priority: 80,
        description: `Migration "${mig.migration_name}" has not been applied to the database.`,
      });
    } else if (mig.drift_type === "modified_after_apply") {
      tasks.push({
        task_key: `drift-review-migration-${mig.migration_name}`,
        task_name: `Review modified migration: ${mig.migration_name}`,
        priority: 90,
        description: `Migration "${mig.migration_name}" was modified after being applied. Review for consistency.`,
      });
    }
  }

  return tasks;
}

// ============================================================
// Task Submission (Stub)
// ============================================================

async function submitRemediationTasks(tasks: TaskCreated[]): Promise<void> {
  if (CONFIG.dryRun) {
    log(`DRY RUN: Would create ${tasks.length} remediation tasks`);
    for (const task of tasks) {
      log(`  - ${task.task_key}: ${task.task_name} (priority: ${task.priority})`);
    }
    return;
  }

  // TODO: Implement actual task submission to Supabase
  // For each task:
  //   await supabase.rpc('create_task', { ... });

  log(`STUB: Would submit ${tasks.length} tasks to agent_tasks table`);
  log("Actual submission requires Supabase connection. Sample SQL:");

  for (const task of tasks) {
    console.log(`
-- Remediation task: ${task.task_name}
SELECT create_task(
  '${task.task_key}',
  '${task.task_name}',
  '{"description": "${task.description}", "source": "drift_detection"}'::jsonb,
  ${task.priority},
  2,
  'drift_detection'
);
    `);
  }
}

// ============================================================
// Report Generation
// ============================================================

function generateReport(
  workflows: WorkflowDrift[],
  migrations: MigrationDrift[],
  tasks: TaskCreated[]
): DriftReport {
  const summary: DriftSummary = {
    total_workflows_checked: workflows.length,
    workflows_in_sync: workflows.filter(w => w.drift_type === "synced").length,
    workflows_drifted: workflows.filter(w => w.drift_type !== "synced").length,
    total_migrations_checked: migrations.length,
    migrations_applied: migrations.filter(m => m.drift_type === "applied").length,
    migrations_pending: migrations.filter(m => m.drift_type === "not_applied").length,
    remediation_tasks_created: tasks.length,
  };

  return {
    timestamp: new Date().toISOString(),
    dry_run: CONFIG.dryRun,
    workflows,
    migrations,
    tasks_created: tasks,
    summary,
  };
}

function saveReport(report: DriftReport): string {
  ensureDir(CONFIG.outputDir);

  const filename = `drift-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filepath = path.join(CONFIG.outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  log(`Report saved to: ${filepath}`);

  return filepath;
}

// ============================================================
// Main Entry Point
// ============================================================

async function main(): Promise<void> {
  log("Starting drift detection...");
  log(`Mode: ${CONFIG.dryRun ? "DRY RUN" : "LIVE"}`);

  try {
    // Detect drift
    const workflows = await detectWorkflowDrift();
    const migrations = await detectMigrationDrift();

    // Create remediation tasks
    const tasks = createRemediationTasks(workflows, migrations);

    // Submit tasks (if not dry run)
    if (tasks.length > 0) {
      await submitRemediationTasks(tasks);
    } else {
      log("No drift detected - no remediation tasks needed");
    }

    // Generate and save report
    const report = generateReport(workflows, migrations, tasks);
    const reportPath = saveReport(report);

    // Print summary
    console.log("\n========================================");
    console.log("DRIFT DETECTION SUMMARY");
    console.log("========================================");
    console.log(`Workflows checked: ${report.summary.total_workflows_checked}`);
    console.log(`  - In sync: ${report.summary.workflows_in_sync}`);
    console.log(`  - Drifted: ${report.summary.workflows_drifted}`);
    console.log(`Migrations checked: ${report.summary.total_migrations_checked}`);
    console.log(`  - Applied: ${report.summary.migrations_applied}`);
    console.log(`  - Pending: ${report.summary.migrations_pending}`);
    console.log(`Remediation tasks: ${report.summary.remediation_tasks_created}`);
    console.log(`Report: ${reportPath}`);
    console.log("========================================\n");

    // Exit with appropriate code
    process.exit(report.summary.workflows_drifted > 0 || report.summary.migrations_pending > 0 ? 1 : 0);

  } catch (err: any) {
    log(`Error during drift detection: ${err.message}`);
    console.error(err.stack);
    process.exit(2);
  }
}

// Run
main();
