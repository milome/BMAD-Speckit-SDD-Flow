import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateDeliveryTruthGate } from '../../scripts/main-agent-delivery-truth-gate';
import { buildPrTopology, buildParallelMissionPlan } from '../../scripts/parallel-mission-control';

const evidenceProvenance = {
  runId: 'main-agent-run-loop-1',
  storyKey: 'S1',
  evidenceBundleId: 'bundle-1',
  contractHash: 'contract-hash-1',
  gateReportHash: 'gate-report-hash-1',
};

function closedPrTopology(provenance = evidenceProvenance) {
  const plan = buildParallelMissionPlan({
    batchId: 'delivery-truth',
    nodes: [
      {
        node_id: 'n1',
        story_key: 'S1',
        packet_id: 'p1',
        write_scope: ['src/a.ts'],
        depends_on: [],
        assigned_agent: 'claude',
        target_branch: 'task/a',
        target_pr: 'PR-1',
      },
    ],
  });
  return buildPrTopology({
    plan,
    states: { n1: 'merged' },
    evidence_provenance: provenance,
  });
}

function passingReleaseGate() {
  return {
    critical_failures: 0,
    blocked_sprint_status_update: false,
    evidence_provenance: evidenceProvenance,
    completion_intent: {
      token: 'completion-token-1',
      storyKey: 'S1',
      contractHash: 'contract-hash-1',
      gateReportHash: 'gate-report-hash-1',
      singleUse: true,
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  };
}

function hostMatrix(journeyMode: 'mock' | 'real') {
  return {
    journeyMode,
    journeyE2EPassed: true,
    hostMatrix: {
      matrixType: 'main_agent_multi_host_matrix' as const,
      requiredHosts: ['cursor', 'claude', 'codex'] as Array<'cursor' | 'claude' | 'codex'>,
      hostsPassed: { cursor: true, claude: true, codex: true },
      allRequiredHostsPassed: true,
    },
    evidence_provenance: evidenceProvenance,
  };
}

function passingSprintAudit() {
  return {
    storyKey: 'S1',
    status: 'done',
    authorized: true,
    releaseGateReportPath: '_bmad-output/runtime/gates/main-agent-release-gate-report.json',
    gateReportHash: 'gate-report-hash-1',
    contractHash: 'contract-hash-1',
    fromStatus: 'in_progress',
    toStatus: 'done',
    token: 'completion-token-1',
    singleUse: true,
    expiresAt: '2099-01-01T00:00:00.000Z',
    evidence_provenance: evidenceProvenance,
  };
}

describe('main-agent delivery truth gate', () => {
  it('blocks completion language for mock journey and short soak evidence', () => {
    const report = evaluateDeliveryTruthGate({
      releaseGate: { critical_failures: 0, blocked_sprint_status_update: false },
      hostMatrix: hostMatrix('mock'),
      soak: {
        mode: 'wall_clock',
        run_kind: 'heartbeat_only',
        target_duration_ms: 30,
        observed_duration_ms: 30,
        tick_count: 1,
        manual_restarts: 0,
        silent_hangs: 0,
        false_completions: 0,
        recovery_success_rate: 1,
      },
      prTopology: closedPrTopology(),
      sprintAudit: { storyKey: 'S1', status: 'done', authorized: true },
    });

    expect(report.completionAllowed).toBe(false);
    expect(report.completionLanguage).toBe('partial_only');
    expect(report.failedEvidence.join('\n')).toContain('multi-host-host-matrix');
    expect(report.failedEvidence.join('\n')).toContain('wall-clock-8h-soak');
  });

  it('allows completion language only with real 8h and closed PR evidence', () => {
    const report = evaluateDeliveryTruthGate({
      releaseGate: passingReleaseGate(),
      hostMatrix: hostMatrix('real'),
      soak: {
        mode: 'wall_clock',
        run_kind: 'development_run_loop',
        target_duration_ms: 8 * 60 * 60 * 1000,
        observed_duration_ms: 8 * 60 * 60 * 1000,
        tick_count: 1,
        manual_restarts: 0,
        silent_hangs: 0,
        false_completions: 0,
        recovery_success_rate: 1,
        developmentRun: {
          tick_count: 1,
          completed_ticks: 1,
          blocked_ticks: 0,
          runLoopInvocations: [
            {
              tick: 1,
              runId: 'main-agent-run-loop-1',
              status: 'completed',
              packetId: 'packet-1',
              taskReportStatus: 'done',
              evidence: ['soak-tick-1'],
              finalNextAction: 'dispatch_review',
              tickCommand: {
                command: 'main-agent run-loop',
                exitCode: 0,
                stdoutPath: 'stdout.log',
                stderrPath: 'stderr.log',
                diffHashBefore: 'before-hash',
                diffHashAfter: 'after-hash',
              },
            },
          ],
        },
        evidence_provenance: evidenceProvenance,
      },
      prTopology: closedPrTopology(),
      sprintAudit: passingSprintAudit(),
      qualityGate: { critical_failures: 0, evidence_provenance: evidenceProvenance },
      env: {},
    });

    expect(report.completionAllowed).toBe(true);
    expect(report.deliveryStatus).toBe('complete');
    expect(report.completionLanguage).toBe('complete_allowed');
  });

  it('rejects heartbeat-only 8h evidence because real development run-loop proof is required', () => {
    const report = evaluateDeliveryTruthGate({
      releaseGate: { critical_failures: 0, blocked_sprint_status_update: false },
      hostMatrix: hostMatrix('real'),
      soak: {
        mode: 'wall_clock',
        run_kind: 'heartbeat_only',
        target_duration_ms: 8 * 60 * 60 * 1000,
        observed_duration_ms: 8 * 60 * 60 * 1000,
        tick_count: 960,
        manual_restarts: 0,
        silent_hangs: 0,
        false_completions: 0,
        recovery_success_rate: 1,
      },
      prTopology: closedPrTopology(),
      sprintAudit: passingSprintAudit(),
      qualityGate: { critical_failures: 0, evidence_provenance: evidenceProvenance },
      env: {},
    });

    expect(report.completionAllowed).toBe(false);
    expect(report.failedEvidence.join('\n')).toContain('run_kind=heartbeat_only');
  });

  it('emits a blocked report when required evidence files are missing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-truth-missing-'));
    try {
      const reportPath = path.join(root, 'report.json');
      const { spawnSync } = await import('node:child_process');
      const run = spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          path.join(process.cwd(), 'tsconfig.node.json'),
          '--transpile-only',
          path.join(process.cwd(), 'scripts', 'main-agent-delivery-truth-gate.ts'),
          '--cwd',
          root,
          '--reportPath',
          reportPath,
        ],
        { encoding: 'utf8' }
      );
      expect(run.status).toBe(1);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        completionAllowed: boolean;
        deliveryStatus: string;
        missingEvidence: string[];
      };
      expect(report.completionAllowed).toBe(false);
      expect(report.deliveryStatus).toBe('blocked');
      expect(report.missingEvidence.some((item) => item.startsWith('releaseGate:'))).toBe(true);
      expect(fs.existsSync(reportPath)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes the default delivery truth report path for the project root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-truth-default-'));
    try {
      const { spawnSync } = await import('node:child_process');
      const run = spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          path.join(process.cwd(), 'tsconfig.node.json'),
          '--transpile-only',
          path.join(process.cwd(), 'scripts', 'main-agent-delivery-truth-gate.ts'),
          '--cwd',
          root,
        ],
        { encoding: 'utf8' }
      );
      expect(run.status).toBe(1);
      const defaultReportPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'gates',
        'main-agent-delivery-truth-gate-report.json'
      );
      expect(fs.existsSync(defaultReportPath)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
