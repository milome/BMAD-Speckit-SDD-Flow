import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

function runReleaseGate(
  env: NodeJS.ProcessEnv,
  expectSuccess: boolean,
  args: string[] = []
): { stdout: string; stderr: string; exitCode: number } {
  const command = process.execPath;
  const commandArgs = [
    path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
    '--project',
    'tsconfig.node.json',
    '--transpile-only',
    'scripts/main-agent-release-gate.ts',
    ...args,
  ];
  try {
    const stdout = execFileSync(command, commandArgs, {
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
        false,
        [
          '--dualHostPath',
        path.join(reportDir, 'missing-dual-host.json'),
          '--prTopologyPath',
          path.join(reportDir, 'missing-pr-topology.json'),
          '--qualityGatePath',
          path.join(reportDir, 'missing-quality-gate.json'),
          '--singleSourceCommand',
          `${process.execPath} -e "process.exit(0)"`,
          '--rerunGateCommand',
          `${process.execPath} -e "process.exit(0)"`,
        ]
      );

      expect(run.exitCode).toBe(1);
      expect(run.stderr).toContain('dual-host E2E journey failed');
      expect(fs.existsSync(reportPath)).toBe(true);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        critical_failures: number;
        blocked_sprint_status_update: boolean;
        blocking_reasons: string[];
      };
      expect(report.critical_failures).toBeGreaterThan(0);
      expect(report.blocked_sprint_status_update).toBe(true);
      expect(report.blocking_reasons.join('\n')).toContain('dual-host E2E journey failed');
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });

  function writeReleaseGateEvidence(
    dir: string,
    provenance?: { runId: string; storyKey: string; evidenceBundleId: string }
  ) {
    const evidence_provenance = provenance
      ? {
          runId: provenance.runId,
          storyKey: provenance.storyKey,
          evidenceBundleId: provenance.evidenceBundleId,
        }
      : undefined;
    const dualHostPath = path.join(dir, 'dual-host.json');
    const prTopologyPath = path.join(dir, 'pr-topology.json');
    const qualityGatePath = path.join(dir, 'quality-gate.json');
    fs.writeFileSync(
      dualHostPath,
      JSON.stringify({
        journeyMode: 'real',
        journeyE2EPassed: true,
        hostsPassed: { claude: true, codex: true },
        githubPrApi: { passed: true, prUrl: 'https://example.invalid/pull/1' },
        ...(evidence_provenance ? { evidence_provenance } : {}),
      }),
      'utf8'
    );
    fs.writeFileSync(
      prTopologyPath,
      JSON.stringify({
        version: 1,
        batch_id: 'release-gate-test',
        required_nodes: [
          {
            node_id: 'node-1',
            target_pr: 'https://example.invalid/pull/1',
            depends_on: '',
            state: 'merged',
          },
        ],
        all_affected_stories_passed: true,
        ...(evidence_provenance ? { evidence_provenance } : {}),
      }),
      'utf8'
    );
    fs.writeFileSync(
      qualityGatePath,
      JSON.stringify({
        reportType: 'main_agent_quality_gate',
        critical_failures: 0,
        checks: [],
        ...(evidence_provenance ? { evidence_provenance } : {}),
      }),
      'utf8'
    );
    return { dualHostPath, prTopologyPath, qualityGatePath };
  }

  function sameRunArgs(): string[] {
    return ['--runId', 'run-pass', '--storyKey', 'S-release', '--evidenceBundleId', 'bundle-pass'];
  }

  function strongArgs(evidence: {
    dualHostPath: string;
    prTopologyPath: string;
    qualityGatePath: string;
  }): string[] {
    return [
      '--dualHostPath',
      evidence.dualHostPath,
      '--prTopologyPath',
      evidence.prTopologyPath,
      '--qualityGatePath',
      evidence.qualityGatePath,
      '--singleSourceCommand',
      `${process.execPath} -e "process.exit(0)"`,
      '--rerunGateCommand',
      `${process.execPath} -e "process.exit(0)"`,
      '--storyKey',
      'S-release',
    ];
  }

  it('fails closed when E2E command succeeds but real artifacts are missing', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-report-pass-'));
    try {
      const reportPath = path.join(reportDir, 'report.json');
      const run = runReleaseGate(
        {
          MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(0)"`,
          MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
        },
        false,
        [
          '--dualHostPath',
          path.join(reportDir, 'missing-dual-host.json'),
          '--prTopologyPath',
          path.join(reportDir, 'missing-pr-topology.json'),
          '--qualityGatePath',
          path.join(reportDir, 'missing-quality-gate.json'),
          '--singleSourceCommand',
          `${process.execPath} -e "process.exit(0)"`,
          '--rerunGateCommand',
          `${process.execPath} -e "process.exit(0)"`,
        ]
      );

      expect(run.exitCode).toBe(1);
      expect(fs.existsSync(reportPath)).toBe(true);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        critical_failures: number;
        blocked_sprint_status_update: boolean;
      };
      expect(report.critical_failures).toBeGreaterThan(0);
      expect(report.blocked_sprint_status_update).toBe(true);
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('fails closed by default when no execution audit ledger is provided', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-no-ledger-'));
    try {
      const reportPath = path.join(reportDir, 'report.json');
      const evidence = writeReleaseGateEvidence(reportDir);
      const missingLedgerPath = path.join(reportDir, 'missing-ledger.json');
      const run = runReleaseGate(
        {
          MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(0)"`,
          MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
        },
        false,
        [...strongArgs(evidence), '--ledgerPath', missingLedgerPath]
      );

      expect(run.exitCode).toBe(1);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        checks: Array<{ id: string; passed: boolean }>;
        blocking_reasons: string[];
      };
      expect(report.checks.find((item) => item.id === 'execution-audit-ledger')?.passed).toBe(false);
      expect(report.blocking_reasons.join('\n')).toContain('execution audit ledger missing');
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('passes when hard evidence and explicit ledgerPath are valid', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-ledger-pass-'));
    try {
      const reportPath = path.join(reportDir, 'report.json');
      const ledgerPath = path.join(reportDir, 'ledger.json');
      const evidence = writeReleaseGateEvidence(reportDir);
      fs.writeFileSync(
        ledgerPath,
        JSON.stringify(
          {
            version: 1,
            ledgerType: 'execution_audit',
            runId: 'run-pass',
            generatedAt: '2026-04-27T00:00:00.000Z',
            items: [
              {
                taskId: 'T1',
                status: 'pass',
                updatedAt: '2026-04-27T00:00:00.000Z',
                evidenceRefs: ['outputs/evidence/T1.json'],
              },
              {
                taskId: 'T2',
                status: 'pass',
                updatedAt: '2026-04-27T00:01:00.000Z',
                dependsOn: ['T1'],
                evidenceRefs: ['outputs/evidence/T2.json'],
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );

      const run = runReleaseGate(
        {
          MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(0)"`,
          MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
        },
        true,
        [...strongArgs(evidence), '--ledgerPath', ledgerPath]
      );

      expect(run.exitCode).toBe(0);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        checks: Array<{ id: string; passed: boolean }>;
        completion_intent?: {
          token: string;
          storyKey: string;
          contractHash: string;
          gateReportHash: string;
          singleUse: boolean;
          expiresAt: string;
        };
      };
      const sprintAuditPath = path.join(
        process.cwd(),
        '_bmad-output',
        'runtime',
        'governance',
        'sprint-status-update-audit.json'
      );
      const sprintAudit = JSON.parse(fs.readFileSync(sprintAuditPath, 'utf8')) as {
        storyKey: string;
        status: string;
        authorized: boolean;
        gateReportHash: string;
        contractHash: string;
        token: string;
        singleUse: boolean;
      };
      expect(
        report.checks.find((item) => item.id === 'execution-audit-ledger')?.passed
      ).toBe(true);
      expect(report.completion_intent?.storyKey).toBe('S-release');
      expect(report.completion_intent?.singleUse).toBe(true);
      expect(report.completion_intent?.contractHash).toBe(
        crypto
          .createHash('sha256')
          .update(
            fs.readFileSync(
              path.join(process.cwd(), '_bmad', '_config', 'orchestration-governance.contract.yaml')
            )
          )
          .digest('hex')
      );
      expect(sprintAudit).toMatchObject({
        storyKey: 'S-release',
        status: 'done',
        authorized: true,
        gateReportHash: report.completion_intent?.gateReportHash,
        contractHash: report.completion_intent?.contractHash,
        token: report.completion_intent?.token,
        singleUse: true,
      });
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('fails closed when same-run provenance is required but artifacts are stale', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-stale-provenance-'));
    try {
      const reportPath = path.join(reportDir, 'report.json');
      const ledgerPath = path.join(reportDir, 'ledger.json');
      const evidence = writeReleaseGateEvidence(reportDir, {
        runId: 'old-run',
        storyKey: 'S-release',
        evidenceBundleId: 'bundle-pass',
      });
      fs.writeFileSync(
        ledgerPath,
        JSON.stringify({
          version: 1,
          ledgerType: 'execution_audit',
          runId: 'run-pass',
          generatedAt: '2026-04-27T00:00:00.000Z',
          items: [
            {
              taskId: 'T1',
              status: 'pass',
              updatedAt: '2026-04-27T00:00:00.000Z',
              evidenceRefs: ['outputs/evidence/T1.json'],
            },
          ],
        }),
        'utf8'
      );

      const run = runReleaseGate(
        {
          MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(0)"`,
          MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
        },
        false,
        [...strongArgs(evidence), '--ledgerPath', ledgerPath, ...sameRunArgs()]
      );

      expect(run.exitCode).toBe(1);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        checks: Array<{ id: string; passed: boolean; stderr: string }>;
        blocking_reasons: string[];
      };
      expect(report.checks.find((item) => item.id === 'dual-host-real-artifact')?.passed).toBe(false);
      expect(report.blocking_reasons.join('\n')).toContain('provenance mismatch');
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('passes same-run provenance when all artifacts share run identity', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-same-run-pass-'));
    try {
      const reportPath = path.join(reportDir, 'report.json');
      const ledgerPath = path.join(reportDir, 'ledger.json');
      const evidence = writeReleaseGateEvidence(reportDir, {
        runId: 'run-pass',
        storyKey: 'S-release',
        evidenceBundleId: 'bundle-pass',
      });
      fs.writeFileSync(
        ledgerPath,
        JSON.stringify({
          version: 1,
          ledgerType: 'execution_audit',
          runId: 'run-pass',
          generatedAt: '2026-04-27T00:00:00.000Z',
          items: [
            {
              taskId: 'T1',
              status: 'pass',
              updatedAt: '2026-04-27T00:00:00.000Z',
              evidenceRefs: ['outputs/evidence/T1.json'],
            },
          ],
        }),
        'utf8'
      );

      const run = runReleaseGate(
        {
          MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(0)"`,
          MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
        },
        true,
        [...strongArgs(evidence), '--ledgerPath', ledgerPath, ...sameRunArgs(), '--skipSprintStatusUpdate', 'true']
      );
      expect(run.exitCode).toBe(0);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        completion_intent?: { storyKey: string };
      };
      expect(report.completion_intent?.storyKey).toBe('S-release');
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });

  it('fails closed when explicit ledgerPath is provided and the ledger is inconsistent', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-ledger-fail-'));
    try {
      const reportPath = path.join(reportDir, 'report.json');
      const ledgerPath = path.join(reportDir, 'ledger.json');
      const evidence = writeReleaseGateEvidence(reportDir);
      fs.writeFileSync(
        ledgerPath,
        JSON.stringify(
          {
            version: 1,
            ledgerType: 'execution_audit',
            runId: 'run-fail',
            generatedAt: '2026-04-27T00:00:00.000Z',
            items: [
              {
                taskId: 'T1',
                status: 'fail',
                updatedAt: '2026-04-27T00:00:00.000Z',
                evidenceRefs: ['outputs/evidence/T1.json'],
              },
              {
                taskId: 'T2',
                status: 'pass',
                updatedAt: '2026-04-27T00:01:00.000Z',
                dependsOn: ['T1'],
                evidenceRefs: ['outputs/evidence/T2.json'],
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );

      const run = runReleaseGate(
        {
          MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(0)"`,
          MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
        },
        false,
        [...strongArgs(evidence), '--ledgerPath', ledgerPath]
      );

      expect(run.exitCode).toBe(1);
      expect(run.stderr).toContain('execution audit ledger');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        blocked_sprint_status_update: boolean;
        blocking_reasons: string[];
      };
      expect(report.blocked_sprint_status_update).toBe(true);
      expect(report.blocking_reasons.join('\n')).toContain('execution audit ledger');
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });
});
