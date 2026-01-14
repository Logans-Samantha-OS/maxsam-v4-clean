#!/usr/bin/env npx ts-node
/**
 * Ralph Wiggum Task Executor
 * ==========================
 * Executes autonomous development tasks in isolated branches.
 *
 * Usage:
 *   npx ts-node tools/ralph/run_task.ts < task.json
 *   npx ts-node tools/ralph/run_task.ts --file task.json
 *
 * Input: TaskPayload JSON
 * Output: result.json to stdout
 */

import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// Type Definitions
// ============================================================

interface FileToCreate {
  path: string;
  content: string;
}

interface FileChange {
  type: "replace" | "insert" | "delete" | "append";
  search?: string;
  content?: string;
  line?: number;
}

interface FileToModify {
  path: string;
  changes: FileChange[];
}

interface TaskSpec {
  description: string;
  files_to_create?: FileToCreate[];
  files_to_modify?: FileToModify[];
  files_to_delete?: string[];
  commands_to_run?: string[];
  expected_outcomes?: string[];
  rollback_instructions?: string;
}

interface TaskPayload {
  task_id: string;
  task_key: string;
  task_name: string;
  spec: TaskSpec;
  priority?: number;
  required_autonomy_level?: number;
  attempt_count?: number;
  worker_id?: string;
}

interface TaskResult {
  success: boolean;
  branch: string;
  commit_sha: string | null;
  tests_passed: boolean;
  summary: string;
  files_changed: string[];
  loc_added: number;
  loc_removed: number;
  loc_changed: number;
  artifacts: {
    log_path?: string;
    pr_url?: string;
    error?: string;
  };
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

// ============================================================
// Configuration
// ============================================================

const BLOCKED_FILE_PATTERNS = [
  /\.env$/,
  /\.env\..*/,
  /\.key$/,
  /\.pem$/,
  /\.credentials$/,
  /secrets?\//,
  /\.secret/,
];

const BLOCKED_DIRECTORIES = ["node_modules", ".git", "secrets", ".env.local"];

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB max file size
const COMMAND_TIMEOUT_MS = 300000; // 5 minutes per command

// ============================================================
// Utility Functions
// ============================================================

function log(message: string): void {
  console.error(`[Ralph] ${new Date().toISOString()} - ${message}`);
}

function generateBranchName(taskKey: string, taskId: string): string {
  const shortId = taskId.slice(0, 8);
  const sanitizedKey = taskKey.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  return `ralph/${sanitizedKey}-${shortId}`;
}

function isPathBlocked(filePath: string): boolean {
  // Check blocked directories
  for (const dir of BLOCKED_DIRECTORIES) {
    if (filePath.includes(`/${dir}/`) || filePath.startsWith(`${dir}/`)) {
      return true;
    }
  }

  // Check blocked patterns
  for (const pattern of BLOCKED_FILE_PATTERNS) {
    if (pattern.test(filePath)) {
      return true;
    }
  }

  return false;
}

function runCommand(
  command: string,
  options: { cwd?: string; timeout?: number } = {}
): { success: boolean; output: string; error?: string } {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || COMMAND_TIMEOUT_MS;

  try {
    const output = execSync(command, {
      cwd,
      timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output: output.trim() };
  } catch (err: any) {
    return {
      success: false,
      output: err.stdout?.toString() || "",
      error: err.stderr?.toString() || err.message,
    };
  }
}

function countLinesOfCode(content: string): number {
  return content.split("\n").filter((line) => line.trim().length > 0).length;
}

// ============================================================
// File Operations
// ============================================================

function createFile(
  filePath: string,
  content: string
): { success: boolean; linesAdded: number; error?: string } {
  if (isPathBlocked(filePath)) {
    return { success: false, linesAdded: 0, error: `Blocked path: ${filePath}` };
  }

  if (content.length > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      linesAdded: 0,
      error: `File too large: ${filePath}`,
    };
  }

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return { success: true, linesAdded: countLinesOfCode(content) };
  } catch (err: any) {
    return { success: false, linesAdded: 0, error: err.message };
  }
}

function modifyFile(
  filePath: string,
  changes: FileChange[]
): { success: boolean; linesAdded: number; linesRemoved: number; error?: string } {
  if (isPathBlocked(filePath)) {
    return {
      success: false,
      linesAdded: 0,
      linesRemoved: 0,
      error: `Blocked path: ${filePath}`,
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      linesAdded: 0,
      linesRemoved: 0,
      error: `File not found: ${filePath}`,
    };
  }

  try {
    let content = fs.readFileSync(filePath, "utf-8");
    const originalLines = countLinesOfCode(content);

    for (const change of changes) {
      switch (change.type) {
        case "replace":
          if (change.search && change.content !== undefined) {
            content = content.replace(change.search, change.content);
          }
          break;
        case "insert":
          if (change.line !== undefined && change.content) {
            const lines = content.split("\n");
            lines.splice(change.line, 0, change.content);
            content = lines.join("\n");
          }
          break;
        case "delete":
          if (change.search) {
            content = content
              .split("\n")
              .filter((line) => !line.includes(change.search!))
              .join("\n");
          }
          break;
        case "append":
          if (change.content) {
            content = content + "\n" + change.content;
          }
          break;
      }
    }

    fs.writeFileSync(filePath, content, "utf-8");
    const newLines = countLinesOfCode(content);

    return {
      success: true,
      linesAdded: Math.max(0, newLines - originalLines),
      linesRemoved: Math.max(0, originalLines - newLines),
    };
  } catch (err: any) {
    return {
      success: false,
      linesAdded: 0,
      linesRemoved: 0,
      error: err.message,
    };
  }
}

function deleteFile(
  filePath: string
): { success: boolean; linesRemoved: number; error?: string } {
  if (isPathBlocked(filePath)) {
    return {
      success: false,
      linesRemoved: 0,
      error: `Blocked path: ${filePath}`,
    };
  }

  if (!fs.existsSync(filePath)) {
    return { success: true, linesRemoved: 0 }; // Already deleted
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const linesRemoved = countLinesOfCode(content);
    fs.unlinkSync(filePath);
    return { success: true, linesRemoved };
  } catch (err: any) {
    return { success: false, linesRemoved: 0, error: err.message };
  }
}

// ============================================================
// Git Operations
// ============================================================

function createBranch(branchName: string): { success: boolean; error?: string } {
  // Get the default branch
  const defaultBranchResult = runCommand(
    "git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'"
  );
  const baseBranch = defaultBranchResult.success
    ? defaultBranchResult.output
    : "main";

  // Fetch latest
  runCommand(`git fetch origin ${baseBranch}`);

  // Create and checkout new branch
  const result = runCommand(`git checkout -b ${branchName} origin/${baseBranch}`);
  if (!result.success) {
    // Try without origin prefix
    const fallback = runCommand(`git checkout -b ${branchName}`);
    if (!fallback.success) {
      return { success: false, error: result.error || fallback.error };
    }
  }

  return { success: true };
}

function commitChanges(
  message: string,
  files: string[]
): { success: boolean; commitSha: string | null; error?: string } {
  // Stage files
  for (const file of files) {
    const addResult = runCommand(`git add "${file}"`);
    if (!addResult.success) {
      log(`Warning: Could not stage ${file}: ${addResult.error}`);
    }
  }

  // Check if there are changes to commit
  const statusResult = runCommand("git status --porcelain");
  if (!statusResult.output.trim()) {
    return { success: true, commitSha: null }; // Nothing to commit
  }

  // Commit
  const commitResult = runCommand(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  if (!commitResult.success) {
    return { success: false, commitSha: null, error: commitResult.error };
  }

  // Get commit SHA
  const shaResult = runCommand("git rev-parse HEAD");
  return {
    success: true,
    commitSha: shaResult.success ? shaResult.output.trim() : null,
  };
}

function getDiffStats(): { added: number; removed: number } {
  const result = runCommand("git diff --stat HEAD~1 2>/dev/null || echo '0 insertions, 0 deletions'");
  const output = result.output || "";

  const addMatch = output.match(/(\d+) insertions?/);
  const removeMatch = output.match(/(\d+) deletions?/);

  return {
    added: addMatch ? parseInt(addMatch[1], 10) : 0,
    removed: removeMatch ? parseInt(removeMatch[1], 10) : 0,
  };
}

// ============================================================
// Task Execution
// ============================================================

async function executeTask(payload: TaskPayload): Promise<TaskResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  const branchName = generateBranchName(payload.task_key, payload.task_id);

  const result: TaskResult = {
    success: false,
    branch: branchName,
    commit_sha: null,
    tests_passed: false,
    summary: "",
    files_changed: [],
    loc_added: 0,
    loc_removed: 0,
    loc_changed: 0,
    artifacts: {},
    started_at: startedAt,
    completed_at: "",
    duration_ms: 0,
  };

  const errors: string[] = [];
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;

  try {
    // Step 1: Create branch
    log(`Creating branch: ${branchName}`);
    const branchResult = createBranch(branchName);
    if (!branchResult.success) {
      throw new Error(`Failed to create branch: ${branchResult.error}`);
    }

    // Step 2: Create files
    if (payload.spec.files_to_create) {
      for (const file of payload.spec.files_to_create) {
        log(`Creating file: ${file.path}`);
        const createResult = createFile(file.path, file.content);
        if (!createResult.success) {
          errors.push(`Failed to create ${file.path}: ${createResult.error}`);
        } else {
          result.files_changed.push(file.path);
          totalLinesAdded += createResult.linesAdded;
        }
      }
    }

    // Step 3: Modify files
    if (payload.spec.files_to_modify) {
      for (const file of payload.spec.files_to_modify) {
        log(`Modifying file: ${file.path}`);
        const modifyResult = modifyFile(file.path, file.changes);
        if (!modifyResult.success) {
          errors.push(`Failed to modify ${file.path}: ${modifyResult.error}`);
        } else {
          result.files_changed.push(file.path);
          totalLinesAdded += modifyResult.linesAdded;
          totalLinesRemoved += modifyResult.linesRemoved;
        }
      }
    }

    // Step 4: Delete files
    if (payload.spec.files_to_delete) {
      for (const filePath of payload.spec.files_to_delete) {
        log(`Deleting file: ${filePath}`);
        const deleteResult = deleteFile(filePath);
        if (!deleteResult.success) {
          errors.push(`Failed to delete ${filePath}: ${deleteResult.error}`);
        } else {
          result.files_changed.push(filePath);
          totalLinesRemoved += deleteResult.linesRemoved;
        }
      }
    }

    // Step 5: Commit changes
    if (result.files_changed.length > 0) {
      log("Committing changes...");
      const commitMessage = `[Ralph] ${payload.task_name}\n\n${payload.spec.description}\n\nTask ID: ${payload.task_id}`;
      const commitResult = commitChanges(commitMessage, result.files_changed);
      if (!commitResult.success) {
        errors.push(`Failed to commit: ${commitResult.error}`);
      } else {
        result.commit_sha = commitResult.commitSha;
      }
    }

    // Step 6: Run commands
    let allCommandsSucceeded = true;
    if (payload.spec.commands_to_run) {
      for (const command of payload.spec.commands_to_run) {
        log(`Running command: ${command}`);
        const cmdResult = runCommand(command);
        if (!cmdResult.success) {
          errors.push(`Command failed: ${command}\n${cmdResult.error}`);
          allCommandsSucceeded = false;
          // Continue running other commands but track failure
        }
      }
    }

    result.tests_passed = allCommandsSucceeded;

    // Calculate LOC changes
    result.loc_added = totalLinesAdded;
    result.loc_removed = totalLinesRemoved;
    result.loc_changed = totalLinesAdded + totalLinesRemoved;

    // Determine success
    result.success = errors.length === 0 && allCommandsSucceeded;

    // Generate summary
    if (result.success) {
      result.summary = `Successfully executed task "${payload.task_name}". ` +
        `Modified ${result.files_changed.length} files, ` +
        `+${result.loc_added}/-${result.loc_removed} lines.`;
    } else {
      result.summary = `Task "${payload.task_name}" completed with errors: ${errors.join("; ")}`;
      result.artifacts.error = errors.join("\n");
    }

  } catch (err: any) {
    result.success = false;
    result.summary = `Task execution failed: ${err.message}`;
    result.artifacts.error = err.stack || err.message;
  }

  // Finalize timing
  result.completed_at = new Date().toISOString();
  result.duration_ms = Date.now() - startTime;

  return result;
}

// ============================================================
// Main Entry Point
// ============================================================

async function main(): Promise<void> {
  let inputJson = "";

  // Parse arguments
  const args = process.argv.slice(2);
  const fileArgIndex = args.indexOf("--file");

  if (fileArgIndex !== -1 && args[fileArgIndex + 1]) {
    // Read from file
    const filePath = args[fileArgIndex + 1];
    try {
      inputJson = fs.readFileSync(filePath, "utf-8");
    } catch (err: any) {
      console.error(JSON.stringify({
        success: false,
        error: `Failed to read file: ${err.message}`,
      }));
      process.exit(1);
    }
  } else {
    // Read from stdin
    inputJson = fs.readFileSync(0, "utf-8");
  }

  // Parse task payload
  let payload: TaskPayload;
  try {
    payload = JSON.parse(inputJson);
  } catch (err: any) {
    console.error(JSON.stringify({
      success: false,
      error: `Invalid JSON input: ${err.message}`,
    }));
    process.exit(1);
  }

  // Validate required fields
  if (!payload.task_id || !payload.task_key || !payload.task_name || !payload.spec) {
    console.error(JSON.stringify({
      success: false,
      error: "Missing required fields: task_id, task_key, task_name, spec",
    }));
    process.exit(1);
  }

  // Execute task
  log(`Starting task: ${payload.task_name} (${payload.task_id})`);
  const result = await executeTask(payload);

  // Output result as JSON to stdout
  console.log(JSON.stringify(result, null, 2));

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run
main().catch((err) => {
  console.error(JSON.stringify({
    success: false,
    error: `Unhandled error: ${err.message}`,
  }));
  process.exit(1);
});
