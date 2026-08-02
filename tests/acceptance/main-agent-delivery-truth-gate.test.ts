import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateDeliveryTruthGate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-truth-gate';
import {
  buildPrTopology,
  buildParallelMissionPlan,
} from '../../packages/bmad-speckit/src/main-agent/runtime/parallel-mission-control.ts';

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function deliveryBinding() {
  const seed = randomUUID();
  return {
    runId: `run-${randomUUID()}`,
    storyKey: `story-${randomUUID()}`,
    evidenceBundleId: `bundle-${randomUUID()}`,
    contractHash: sha256(`${seed}:contract`),
    gateReportHash: sha256(`${seed}:gate-report`),
    completionToken: `completion-${randomUUID()}`,
    attemptId: `attempt-${randomUUID()}`,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

function closedPrTopology(provenance: ReturnType<typeof deliveryBinding>) {
  const plan = buildParallelMissionPlan({
    batchId: `delivery-truth-${randomUUID()}`,
    nodes: [
      {
        node_id: `node-${randomUUID()}`,
        story_key: provenance.storyKey,
        packet_id: `packet-${randomUUID()}`,
        write_scope: ['src/a.ts'],
        depends_on: [],
        assigned_agent: 'claude',
        target_branch: `task/${randomUUID()}`,
        target_pr: `PR-${randomUUID()}`,
      },
    ],
  });
  const nodeId = plan.nodes[0].node_id;
  return buildPrTopology({
    plan,
    states: { [nodeId]: 'merged' },
    evidence_provenance: { ...provenance },
  });
}

function passingReleaseGate(binding: ReturnType<typeof deliveryBinding>) {
  return {
    critical_failures: 0,
    blocked_sprint_status_update: false,
    evidence_provenance: { ...binding },
    completion_intent: {
      token: binding.completionToken,
      runId: binding.runId,
      storyKey: binding.storyKey,
      evidenceBundleId: binding.evidenceBundleId,
      attemptId: binding.attemptId,
      contractHash: binding.contractHash,
      gateReportHash: binding.gateReportHash,
      singleUse: true,
      expiresAt: binding.expiresAt,
    },
  };
}

function hostMatrix(
  journeyMode: 'mock' | 'real',
  binding: ReturnType<typeof deliveryBinding>
) {
  return {
    journeyMode,
    journeyE2EPassed: true,
    hostMatrix: {
      matrixType: 'main_agent_multi_host_matrix' as const,
      requiredHosts: ['cursor', 'claude', 'codex'] as Array<'cursor' | 'claude' | 'codex'>,
      hostsPassed: { cursor: true, claude: true, codex: true },
      allRequiredHostsPassed: true,
    },
    evidence_provenance: { ...binding },
  };
}

function passingSprintAudit(binding: ReturnType<typeof deliveryBinding>) {
  return {
    runId: binding.runId,
    storyKey: binding.storyKey,
    evidenceBundleId: binding.evidenceBundleId,
    attemptId: binding.attemptId,
    status: 'done',
    authorized: true,
    releaseGateReportPath: '_bmad-output/runtime/gates/main-agent-release-gate-report.json',
    gateReportHash: binding.gateReportHash,
    contractHash: binding.contractHash,
    fromStatus: 'in_progress',
    toStatus: 'done',
    token: binding.completionToken,
    singleUse: true,
    expiresAt: binding.expiresAt,
    evidence_provenance: { ...binding },
  };
}

function passingInput(binding = deliveryBinding()) {
  return {
    releaseGate: passingReleaseGate(binding),
    hostMatrix: hostMatrix('real', binding),
    prTopology: closedPrTopology(binding),
    sprintAudit: passingSprintAudit(binding),
    qualityGate: { critical_failures: 0, evidence_provenance: { ...binding } },
    env: {},
  };
}

describe('main-agent delivery truth gate', () => {
  it('blocks completion language for missing delivery evidence without requiring long-run evidence', () => {
    const binding = deliveryBinding();
    const report = evaluateDeliveryTruthGate({
      releaseGate: { critical_failures: 0, blocked_sprint_status_update: false },
      hostMatrix: hostMatrix('mock', binding),
      prTopology: closedPrTopology(binding),
      sprintAudit: { storyKey: binding.storyKey, status: 'done', authorized: true },
    });

    expect(report.completionAllowed).toBe(false);
    expect(report.completionLanguage).toBe('partial_only');
    expect(report.failedEvidence.join('\n')).toContain('multi-host-host-matrix');
    expect(report.checks.map((check) => check.id)).not.toContain('long-run-soak-observation');
  });

  it('allows completion language with real delivery evidence even without long-run soak', () => {
    const report = evaluateDeliveryTruthGate(passingInput());

    expect(report.completionAllowed).toBe(true);
    expect(report.deliveryStatus).toBe('complete');
    expect(report.completionLanguage).toBe('complete_allowed');
  });

  it('allows delivery confirmation before post-confirmation PR topology evidence exists', () => {
    const binding = deliveryBinding();
    const report = evaluateDeliveryTruthGate({
      releaseGate: passingReleaseGate(binding),
      hostMatrix: hostMatrix('real', binding),
      sprintAudit: passingSprintAudit(binding),
      qualityGate: { critical_failures: 0, evidence_provenance: { ...binding } },
      env: {},
    });

    expect(report.completionAllowed).toBe(true);
    expect(report.deliveryStatus).toBe('complete');
    expect(report.failedEvidence.join('\n')).not.toContain('pr-topology-closed');
    expect(report.checks.find((check) => check.id === 'pr-topology-closed')?.summary).toContain(
      'not_required_pre_delivery'
    );
  });

  it.each([
    [
      'contract hash',
      (input: ReturnType<typeof passingInput>) => {
        input.releaseGate.completion_intent.contractHash = sha256(randomUUID());
      },
    ],
    [
      'gate report hash',
      (input: ReturnType<typeof passingInput>) => {
        input.sprintAudit.gateReportHash = sha256(randomUUID());
      },
    ],
    [
      'completion token',
      (input: ReturnType<typeof passingInput>) => {
        input.sprintAudit.token = `completion-${randomUUID()}`;
      },
    ],
    [
      'evidence bundle',
      (input: ReturnType<typeof passingInput>) => {
        input.hostMatrix.evidence_provenance.evidenceBundleId = `bundle-${randomUUID()}`;
      },
    ],
    [
      'run',
      (input: ReturnType<typeof passingInput>) => {
        input.qualityGate.evidence_provenance.runId = `run-${randomUUID()}`;
      },
    ],
    [
      'story',
      (input: ReturnType<typeof passingInput>) => {
        input.prTopology.evidence_provenance!.storyKey = `story-${randomUUID()}`;
      },
    ],
    [
      'expiry',
      (input: ReturnType<typeof passingInput>) => {
        input.sprintAudit.expiresAt = new Date(Date.now() + 7_200_000).toISOString();
      },
    ],
    [
      'attempt',
      (input: ReturnType<typeof passingInput>) => {
        input.releaseGate.completion_intent.attemptId = `attempt-${randomUUID()}`;
      },
    ],
  ])('rejects mixed %s artifacts', (_label, mutate) => {
    const input = passingInput();
    mutate(input);

    const report = evaluateDeliveryTruthGate(input);

    expect(report.completionAllowed).toBe(false);
    expect(report.failedEvidence.join('\n')).toContain('same-run-evidence-provenance');
  });

  it('blocks legacy provenance that lacks the expanded binding dimensions', () => {
    const binding = deliveryBinding();
    const input = passingInput(binding);
    const {
      completionToken: _completionToken,
      attemptId: _attemptId,
      expiresAt: _expiresAt,
      ...legacyProvenance
    } = binding;
    input.releaseGate.evidence_provenance = legacyProvenance as never;
    input.hostMatrix.evidence_provenance = legacyProvenance as never;
    input.prTopology.evidence_provenance = legacyProvenance;
    input.sprintAudit.evidence_provenance = legacyProvenance as never;
    input.qualityGate.evidence_provenance = legacyProvenance as never;

    const report = evaluateDeliveryTruthGate(input);

    expect(report.completionAllowed).toBe(false);
    expect(report.failedEvidence.join('\n')).toContain('missing:completionToken');
    expect(report.failedEvidence.join('\n')).toContain('missing:attemptId');
    expect(report.failedEvidence.join('\n')).toContain('missing:expiresAt');
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
          path.join(
            process.cwd(),
            'packages',
            'bmad-speckit',
            'src',
            'main-agent',
            'source-authority',
            'scripts',
            'main-agent-delivery-truth-gate.ts'
          ),
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
          path.join(
            process.cwd(),
            'packages',
            'bmad-speckit',
            'src',
            'main-agent',
            'source-authority',
            'scripts',
            'main-agent-delivery-truth-gate.ts'
          ),
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
