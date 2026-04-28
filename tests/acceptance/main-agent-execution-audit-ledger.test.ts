import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeReleaseArtifacts(
  root: string,
  provenance: Record<string, string>
): { hostMatrixPath: string; prTopologyPath: string; qualityGatePath: string } {
  const hostMatrixPath = path.join(root, 'multi-host-report.json');
  const prTopologyPath = path.join(root, 'pr-topology.json');
  const qualityGatePath = path.join(root, 'quality-gate.json');
  writeJson(hostMatrixPath, {
    journeyMode: 'real',
    journeyE2EPassed: true,
    hostsPassed: { claude: true, codex: true },
    hostMatrix: {
      matrixType: 'main_agent_multi_host_matrix',
      requiredHosts: ['cursor', 'claude', 'codex'],
      hostsPassed: { cursor: true, claude: true, codex: true },
      allRequiredHostsPassed: true,
    },
    githubPrApi: { passed: true, prUrl: 'https://example.invalid/pr/1' },
    evidence_provenance: provenance,
  });
  writeJson(prTopologyPath, {
    version: 1,
    batch_id: provenance.runId,
    required_nodes: [
      {
        node_id: 'main',
        target_pr: 'https://example.invalid/pr/1',
        depends_on: [],
        state: 'merged',
      },
    ],
    all_affected_stories_passed: true,
    evidence_provenance: provenance,
  });
  writeJson(qualityGatePath, {
    critical_failures: 0,
    evidence_provenance: provenance,
  });
  return { hostMatrixPath, prTopologyPath, qualityGatePath };
}

function runReleaseGate(
  reportPath: string,
  artifacts: { hostMatrixPath: string; prTopologyPath: string; qualityGatePath: string },
  ledgerPath?: string
): { stdout: string; report: any } {
  const runId = '2026-04-27-tasks-v1-acceptance';
  const storyKey = 'S-release-gate-ledger';
  const evidenceBundleId = `${runId}:bundle`;
  const args = [
    '--project',
    'tsconfig.node.json',
    '--transpile-only',
    'scripts/main-agent-release-gate.ts',
    '--runId',
    runId,
    '--storyKey',
    storyKey,
    '--evidenceBundleId',
    evidenceBundleId,
    '--hostMatrixPath',
    artifacts.hostMatrixPath,
    '--prTopologyPath',
    artifacts.prTopologyPath,
    '--qualityGatePath',
    artifacts.qualityGatePath,
    '--singleSourceCommand',
    `${process.execPath} -e "process.exit(0)"`,
    '--rerunGateCommand',
    `${process.execPath} -e "process.exit(0)"`,
    '--skipSprintStatusUpdate',
    'true',
  ];
  if (ledgerPath) {
    args.push('--ledgerPath', ledgerPath);
  }
  const stdout = execFileSync(process.execPath, [
    path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'),
    ...args,
  ], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      Path: process.env.Path,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      MAIN_AGENT_RELEASE_GATE_LEDGER_PATH: '',
      MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: `${process.execPath} -e "process.exit(0)"`,
      MAIN_AGENT_RELEASE_GATE_REPORT_PATH: reportPath,
    },
    encoding: 'utf8',
  });
  return {
    stdout,
    report: JSON.parse(fs.readFileSync(reportPath, 'utf8')),
  };
}

describe('main-agent execution audit ledger', () => {
  it('keeps TASKS_v1 ledger temporary and only validates it when explicitly provided', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-audit-ledger-'));
    try {
      const runId = '2026-04-27-tasks-v1-acceptance';
      const auditDir = path.join(root, '_bmad-output', 'runtime', 'task-audits', runId);
      fs.mkdirSync(auditDir, { recursive: true });
      const ledgerPath = path.join(auditDir, 'TASKS_v1.audit-log.md');
      fs.writeFileSync(
        ledgerPath,
        JSON.stringify(
          {
            version: 1,
            ledgerType: 'execution_audit',
            runId,
            taskSetId: 'TASKS_v1',
            generatedAt: '2026-04-27T00:00:00.000Z',
            items: [
              {
                taskId: 'T1.8',
                status: 'pass',
                updatedAt: '2026-04-27T00:01:00.000Z',
                evidenceRefs: ['_bmad-output/runtime/gates/main-agent-quality-gate-report.json'],
              },
              {
                taskId: 'T1.9',
                status: 'pass',
                updatedAt: '2026-04-27T00:02:00.000Z',
                dependsOn: ['T1.8'],
                evidenceRefs: [ledgerPath],
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );

      const defaultReportPath = path.join(root, 'default-report.json');
      const explicitReportPath = path.join(root, 'explicit-report.json');
      const artifacts = writeReleaseArtifacts(root, {
        runId,
        storyKey: 'S-release-gate-ledger',
        evidenceBundleId: `${runId}:bundle`,
        gateReportHash: 'acceptance-gate-hash',
      });
      const defaultRun = runReleaseGate(defaultReportPath, artifacts);
      const explicitRun = runReleaseGate(explicitReportPath, artifacts, ledgerPath);

      expect(defaultRun.report.checks.map((item: { id: string }) => item.id)).not.toContain(
        'execution-audit-ledger'
      );
      expect(explicitRun.report.checks.find((item: { id: string }) => item.id === 'execution-audit-ledger')?.passed).toBe(
        true
      );
      expect(fs.existsSync(path.join(auditDir, 'TASKS_v1.audit-log.md'))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
