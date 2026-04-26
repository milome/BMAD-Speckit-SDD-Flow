import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

interface GateCheckResult {
  id: string;
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  failureReason?: string;
}

interface ReleaseGateReport {
  generatedAt: string;
  gate: 'main-agent-release-gate';
  critical_failures: number;
  blocked_sprint_status_update: boolean;
  checks: GateCheckResult[];
  blocking_reasons: string[];
}

interface ReleaseGateCliOptions {
  ledgerPath?: string;
}

interface ExecutionAuditLedgerItem {
  taskId: string;
  status: 'todo' | 'in_progress' | 'pass' | 'partial' | 'fail' | 'blocked';
  updatedAt: string;
  dependsOn?: string[];
  evidenceRefs: string[];
  notes?: string;
}

interface ExecutionAuditLedger {
  version: 1;
  ledgerType: 'execution_audit';
  runId: string;
  taskSetId?: string;
  generatedAt: string;
  items: ExecutionAuditLedgerItem[];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function parseArgs(argv: string[]): ReleaseGateCliOptions {
  const out: ReleaseGateCliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--ledgerPath' && argv[index + 1]) {
      out.ledgerPath = argv[index + 1];
      index += 1;
    }
  }
  return out;
}

function runCommand(command: string): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
  });

  return {
    exitCode: result.status ?? (result.error ? 1 : 0),
    stdout: normalizeText(result.stdout),
    stderr: normalizeText(result.stderr || result.error?.message),
  };
}

function writeReport(report: ReleaseGateReport): string {
  const targetPath =
    normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_REPORT_PATH) ||
    path.join(process.cwd(), '_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return targetPath;
}

function resolveOptionalPath(root: string, raw: string | undefined): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return null;
  }
  return path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
}

function executionAuditLedgerSchemaPath(root: string): string {
  return path.join(root, 'docs', 'reference', 'execution-audit-ledger.schema.json');
}

function validateExecutionAuditLedger(
  root: string,
  ledgerPath: string
): { passed: true; summary: string } | { passed: false; reason: string } {
  if (!fs.existsSync(ledgerPath)) {
    return {
      passed: false,
      reason: `execution audit ledger missing: ${ledgerPath}`,
    };
  }

  const schemaPath = executionAuditLedgerSchemaPath(root);
  if (!fs.existsSync(schemaPath)) {
    return {
      passed: false,
      reason: `execution audit ledger schema missing: ${schemaPath}`,
    };
  }

  let ledger: ExecutionAuditLedger;
  let schema: unknown;
  try {
    ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as ExecutionAuditLedger;
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    return {
      passed: false,
      reason: `execution audit ledger parse failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(ledger)) {
    const details = (validate.errors ?? [])
      .map((item) => `${item.instancePath || '/'} ${item.message || 'invalid'}`)
      .join('; ');
    return {
      passed: false,
      reason: `execution audit ledger schema validation failed: ${details}`,
    };
  }

  const seen = new Set<string>();
  for (const item of ledger.items) {
    if (seen.has(item.taskId)) {
      return {
        passed: false,
        reason: `execution audit ledger contains duplicate taskId: ${item.taskId}`,
      };
    }
    seen.add(item.taskId);
  }

  const taskMap = new Map<string, ExecutionAuditLedgerItem>(
    ledger.items.map((item) => [item.taskId, item])
  );

  for (const item of ledger.items) {
    for (const dep of item.dependsOn ?? []) {
      const upstream = taskMap.get(dep);
      if (!upstream) {
        return {
          passed: false,
          reason: `execution audit ledger dependency missing: ${item.taskId} depends on unknown task ${dep}`,
        };
      }

      if (
        (item.status === 'pass' || item.status === 'in_progress') &&
        (upstream.status === 'fail' || upstream.status === 'blocked')
      ) {
        return {
          passed: false,
          reason: `execution audit ledger inconsistent: downstream ${item.taskId}=${item.status} while upstream ${dep}=${upstream.status}`,
        };
      }
    }
  }

  return {
    passed: true,
    summary: `execution audit ledger validated: ${ledger.items.length} items`,
  };
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  const root = process.cwd();
  const e2eCommand =
    normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_E2E_COMMAND) ||
    'npm run test:e2e:dual-host:journey';
  const ledgerPath =
    resolveOptionalPath(root, args.ledgerPath) ??
    resolveOptionalPath(root, process.env.MAIN_AGENT_RELEASE_GATE_LEDGER_PATH);

  const e2eResult = runCommand(e2eCommand);
  const checks: GateCheckResult[] = [
    {
      id: 'dual-host-e2e-journey',
      passed: e2eResult.exitCode === 0,
      command: e2eCommand,
      exitCode: e2eResult.exitCode,
      stdout: e2eResult.stdout,
      stderr: e2eResult.stderr,
      ...(e2eResult.exitCode === 0
        ? {}
        : {
            failureReason:
              '禁止更新 sprint-status：dual-host E2E journey 未通过，存在半成品风险（contract gate/user journey 未闭环）。',
          }),
    },
  ];

  if (ledgerPath) {
    const ledgerCheck = validateExecutionAuditLedger(root, ledgerPath);
    checks.push({
      id: 'execution-audit-ledger',
      passed: ledgerCheck.passed,
      command: `validate-ledger ${ledgerPath}`,
      exitCode: ledgerCheck.passed ? 0 : 1,
      stdout: ledgerCheck.passed ? ledgerCheck.summary : '',
      stderr: ledgerCheck.passed ? '' : ledgerCheck.reason,
      ...(ledgerCheck.passed
        ? {}
        : {
            failureReason: `禁止更新 sprint-status：execution audit ledger 校验失败（${ledgerCheck.reason}）。`,
          }),
    });
  }

  const blockingReasons = checks
    .filter((item) => !item.passed)
    .map((item) => item.failureReason ?? `${item.id} failed`);
  const report: ReleaseGateReport = {
    generatedAt: new Date().toISOString(),
    gate: 'main-agent-release-gate',
    critical_failures: blockingReasons.length,
    blocked_sprint_status_update: blockingReasons.length > 0,
    checks,
    blocking_reasons: blockingReasons,
  };
  const reportPath = writeReport(report);

  process.stdout.write(
    `${JSON.stringify(
      {
        report_path: reportPath,
        critical_failures: report.critical_failures,
        blocked_sprint_status_update: report.blocked_sprint_status_update,
      },
      null,
      2
    )}\n`
  );

  if (blockingReasons.length > 0) {
    process.stderr.write('[main-agent-release-gate] BLOCKED\n');
    for (const reason of blockingReasons) {
      process.stderr.write(`- ${reason}\n`);
    }
    return 1;
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
