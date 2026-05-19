import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainProductionLoopReadyCheck } from '../../scripts/main-agent-production-loop-ready-check';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';

const SUBSYSTEM_IDS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'main_agent_orchestration',
  'execution_tracking',
  'audit_review',
  'delivery_closeout',
  'observability',
  'rca_improvement',
  'data_production',
  'eval_sft',
  'governance',
  'coach',
  'dashboard_read_model',
  'scoring',
  'prompt_packet_generation',
];

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function subsystem(subsystemId: string) {
  return {
    subsystemId,
    inputRefs: [`input:${subsystemId}`],
    outputRefs: [`output:${subsystemId}`],
    status: 'ready',
    evidenceRefs: ['EVD-010'],
    hash: sha256Text(subsystemId),
    failureHandling: {
      failureModes: [`${subsystemId}_unavailable`],
      recordEventTypes: ['failure_recorded', 'rca_created'],
      recoveryActions: ['record_failure', 'open_rca', 'route_sample'],
    },
  };
}

function extension(recordId: string, requirementSetId: string) {
  return {
    recordId,
    requirementSetId,
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    canaryPlan: [{ stage: 'internal', rolloutPercent: 10, rollbackOn: 'slo_violation' }],
    sloTargets: [{ name: 'delivery_closeout_gate_latency', target: '<= 5000ms' }],
    errorRateMetrics: [{ name: 'gate_failure_rate', threshold: '<= 1%' }],
    performanceMetrics: [{ name: 'closeout_eval_duration_ms', threshold: '<= 5000' }],
    businessMetrics: [{ name: 'requirement_reopen_rate', threshold: '<= 5%' }],
    alerts: [{ name: 'production_loop_blocked', owner: 'main-agent' }],
    rollbackConditions: [{ condition: 'hash_mismatch_or_slo_violation', action: 'block_closeout_and_open_rca' }],
    feedbackRouting: {
      failureRecordEventTypes: ['failure_recorded'],
      rcaRecordEventTypes: ['rca_created'],
      sampleRouteOutputs: ['sample-routes.jsonl'],
    },
    subsystemReadiness: SUBSYSTEM_IDS.map(subsystem),
  };
}

function writeFixture(root: string, options: { completeExtension?: boolean } = {}) {
  const recordId = 'REQ-PRODUCTION-LOOP';
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const extensionDir = path.join(base, 'extensions');
  mkdirSync(extensionDir, { recursive: true });
  const extensionPath = path.join(extensionDir, 'observability-extension.json');
  const extensionValue = extension(recordId, recordId);
  if (options.completeExtension === false) {
    delete (extensionValue as Record<string, unknown>).rollbackConditions;
    extensionValue.subsystemReadiness = extensionValue.subsystemReadiness.slice(0, 11);
  }
  writeFileSync(extensionPath, `${JSON.stringify(extensionValue, null, 2)}\n`, 'utf8');
  const recordPath = path.join(base, 'requirement-record.json');
  const relativeExtensionPath = path
    .relative(root, extensionPath)
    .replace(/\\/gu, '/');
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId,
        requirementSetId: recordId,
        status: 'user_confirmed',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            recordId,
            requirementSetId: recordId,
            confirmedAt: '2026-05-19T00:00:00.000Z',
            confirmedBy: 'user',
            sourcePath: 'docs/design/example.md',
            sourceDocumentHash: SOURCE_HASH,
            implementationConfirmationHash: IMPLEMENTATION_HASH,
            confirmationPageHash:
              'sha256:4444444444444444444444444444444444444444444444444444444444444444',
            confirmationText: 'confirm',
            renderReportPath: 'confirmation-render-report.json',
            htmlPath: 'confirmation.html',
          },
        ],
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
        },
        extensionRefs: [
          {
            eventType: 'artifact_indexed',
            artifactType: 'observability_extension',
            sourceOfTruthRole: 'evidence',
            recordId,
            requirementSetId: recordId,
            path: relativeExtensionPath,
            contentHash: sha256File(extensionPath),
            producer: 'main-agent-production-loop-ready-check.test',
            purpose: 'prove observability extension and sixteen subsystem machine-readable readiness',
            relatedRequirementIds: ['MUST-011', 'MUST-017', 'EVD-010'],
            status: 'active',
            inputVersion: 'trace-007',
            outputVersion: 'observability-extension-v1',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { recordPath };
}

describe('main-agent production loop ready check', () => {
  it('passes only when observability extension and all sixteen subsystem contracts are machine readable', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'production-loop-ready-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const { recordPath } = writeFixture(root);
      const code = mainProductionLoopReadyCheck([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
        '--evaluated-by',
        'test-agent',
        '--json',
      ]);

      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.lastEventType).toBe('production_loop_ready_check_recorded');
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Production Loop Ready Check',
        decision: 'pass',
        recordedBy: 'test-agent',
      });
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when the extension ref is missing from the controlled requirement record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'production-loop-no-extension-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const { recordPath } = writeFixture(root);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      record.extensionRefs = [];
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainProductionLoopReadyCheck([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);

      expect(code).toBe(1);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(updated.gateChecks.at(-1)).toMatchObject({
        gate: 'Production Loop Ready Check',
        decision: 'blocked',
      });
      expect(updated.gateChecks.at(-1).blockingReasons).toContain('observability_extension_ref_missing');
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when observability or subsystem readiness coverage is incomplete', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'production-loop-incomplete-'));
    const cwd = process.cwd();
    try {
      process.chdir(root);
      const { recordPath } = writeFixture(root, { completeExtension: false });

      const code = mainProductionLoopReadyCheck([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);

      expect(code).toBe(1);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      const latestGate = updated.gateChecks.at(-1);
      expect(latestGate.decision).toBe('blocked');
      expect(latestGate.blockingReasons).toContain('observability_rollbackConditions_missing');
    expect(latestGate.blockingReasons).toContain('subsystem_missing:prompt_packet_generation');
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
