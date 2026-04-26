import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
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

function main(): number {
  const e2eCommand =
    normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_E2E_COMMAND) ||
    'npm run test:e2e:dual-host:journey';

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

process.exit(main());
