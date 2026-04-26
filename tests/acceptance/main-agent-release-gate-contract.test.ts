import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

function runReleaseGate(
  env: NodeJS.ProcessEnv,
  expectSuccess: boolean
): { stdout: string; stderr: string; exitCode: number } {
  const command =
    'npx ts-node --project tsconfig.node.json --transpile-only scripts/main-agent-release-gate.ts';
  try {
    const stdout = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error) {
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    if (expectSuccess) {
      throw error;
    }
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}

describe('main-agent release gate contract', () => {
  it('fails closed with explicit sprint-status block reason when E2E gate fails', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-report-fail-'));
    try {
      const reportPath = path.join(reportDir, 'report.json');
      const run = runReleaseGate(
        {
          MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(2)"`,
          MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
        },
        false
      );

      expect(run.exitCode).toBe(1);
      expect(run.stderr).toContain('禁止更新 sprint-status');
      expect(fs.existsSync(reportPath)).toBe(true);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        critical_failures: number;
        blocked_sprint_status_update: boolean;
        blocking_reasons: string[];
      };
      expect(report.critical_failures).toBeGreaterThan(0);
      expect(report.blocked_sprint_status_update).toBe(true);
      expect(report.blocking_reasons.join('\n')).toContain('禁止更新 sprint-status');
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('passes when E2E gate succeeds', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-report-pass-'));
    try {
      const reportPath = path.join(reportDir, 'report.json');
      const run = runReleaseGate(
        {
          MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(0)"`,
          MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
        },
        true
      );

      expect(run.exitCode).toBe(0);
      expect(fs.existsSync(reportPath)).toBe(true);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        critical_failures: number;
        blocked_sprint_status_update: boolean;
      };
      expect(report.critical_failures).toBe(0);
      expect(report.blocked_sprint_status_update).toBe(false);
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });
});
