import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainDeliveryCloseoutGate } from '../../scripts/main-agent-delivery-closeout-gate';
import {
  evaluateSubagentCurrentAttemptRevalidation,
  runSubagentCurrentAttemptRevalidation,
} from '../../scripts/subagent-current-attempt-revalidation';
import { sha256Object } from '../../scripts/subagent-evidence-envelope';

const SOURCE_HASH = 'sha256:043bd30ee5975f75196fa688964f7373a087eeca2464cd04cf725ecc8bc0e570';
const IMPLEMENTATION_HASH = 'sha256:837f69a7551c36022df0c4f76647b8f66d49c5f914a37074657d21a821bb6d9a';
const ARCHITECTURE_HASH = 'sha256:a3de7e8c4d97e8befc507e5edbb640ae706ccd418df9b2b6e047d7967cb8f9da';

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function artifactRef(root: string, artifactPath: string, relatedRequirementIds: string[] = ['MUST-047', 'NEG-036', 'EVD-046']) {
  return {
    artifactType: 'subagent_revalidation_evidence',
    sourceOfTruthRole: 'evidence',
    path: artifactPath.replace(/\\/gu, '/'),
    hash: sha256File(path.resolve(root, artifactPath)),
    producer: 'subagent-current-attempt-revalidation.test',
    purpose: 'prove subagent current-attempt revalidation',
    relatedRequirementIds,
    status: 'active',
    inputVersion: 'trace-036',
    outputVersion: 'subagent-current-attempt-revalidation-v1',
  };
}

function record(root: string, artifactRefs: Record<string, unknown>[] = []) {
  return {
    recordId: 'REQ-CLOSED-LOOP-DESIGN',
    requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
      resolvedRecipeHash: 'sha256:da10b7ad044a705fb04be14c32a0062e9dc5e91012e5d267a435b83c3ba86b75',
    },
    closeout: {
      currentAttemptId: 'closeout-current',
      attempts: [],
    },
    implementationEntryGate: {
      decision: 'pass',
    },
    gateChecks: [
      {
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      },
    ],
    architectureConfirmationStateChecks: [
      {
        decision: 'pass',
        resolvedRecipeHash: 'sha256:da10b7ad044a705fb04be14c32a0062e9dc5e91012e5d267a435b83c3ba86b75',
        stateTransition: { toStatus: 'active' },
      },
    ],
    requirementClosures: [{ requirementId: 'MUST-047', status: 'pass' }],
    artifactIndex: artifactRefs,
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-DELIVERY',
          command: 'node verify.js',
          blockingIfMissing: true,
          negativeOrRegression: true,
          closeoutAttemptId: 'closeout-current',
          artifactRefs,
        },
      ],
    },
    executionIterations: [
      {
        executionIterationId: 'exec-delivery',
        commandRunRefs: [{ commandId: 'CMD-DELIVERY', closeoutAttemptId: 'closeout-current', exitCode: 0 }],
      },
    ],
  };
}

function envelope(root: string, artifactRefs: Record<string, unknown>[]) {
  return {
    envelopeVersion: 'subagent-evidence-envelope/v1',
    recordId: 'REQ-CLOSED-LOOP-DESIGN',
    requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
    parentRunId: 'run-subagent',
    parentCloseoutAttemptId: 'closeout-current',
    subtaskId: 'subtask-current-attempt',
    packetId: 'packet-current-attempt',
    packetKind: 'execution',
    executorKind: 'codex_worker_adapter',
    executorRole: 'implementation-worker',
    decisionAuthority: 'none',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    traceRows: ['TRACE-036'],
    coveredRequirementIds: ['MUST-047', 'NEG-036'],
    taskRefs: ['TASK-SUBAGENT-CLOSEOUT-REVALIDATION'],
    allowedWriteScope: ['scripts/**', 'tests/**'],
    actualFilesChanged: ['scripts/subagent-current-attempt-revalidation.ts'],
    diffHash: sha256Object({ changed: ['scripts/subagent-current-attempt-revalidation.ts'] }),
    workspaceRef: {
      kind: 'main_workspace',
      path: root,
      commitBefore: 'before',
      commitAfter: 'after',
    },
    commandRuns: [
      {
        commandId: 'CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION',
        command: 'npx vitest run tests/acceptance/subagent-current-attempt-revalidation.test.ts',
        exitCode: 0,
        startedAt: '2026-05-21T00:00:00.000Z',
        completedAt: '2026-05-21T00:00:05.000Z',
        outputSummary: 'subagent current-attempt revalidation passed',
        artifactRefs,
        closeoutAttemptId: 'closeout-current',
      },
    ],
    artifactRefs,
    hookReceipts: [],
    transportRefs: [],
    status: 'accepted',
    failureRecords: [],
  };
}

describe('subagent current-attempt revalidation', () => {
  it('passes only when accepted envelope commandRuns and artifacts bind to the current closeout attempt in main workspace', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-current-attempt-pass-'));
    try {
      const evidencePath = path.join(root, 'evidence.json');
      writeJson(evidencePath, { ok: true });
      const artifact = artifactRef(root, 'evidence.json');
      const currentRecord = record(root, [artifact]);
      const report = evaluateSubagentCurrentAttemptRevalidation({
        envelope: envelope(root, [artifact]),
        record: currentRecord,
        projectRoot: root,
        generatedAt: '2026-05-21T00:00:06.000Z',
      });
      expect(report).toMatchObject({
        reportType: 'subagent_current_attempt_revalidation_report',
        schemaVersion: 'subagent-current-attempt-revalidation/v1',
        decision: 'pass',
        currentCloseoutAttemptId: 'closeout-current',
        parentCloseoutAttemptId: 'closeout-current',
        mismatches: [],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks and emits failure/rerun evidence when attempt, workspace, or command evidence is stale', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-current-attempt-block-'));
    try {
      const evidencePath = path.join(root, 'evidence.json');
      writeJson(evidencePath, { ok: true });
      const artifact = artifactRef(root, 'evidence.json');
      const badEnvelope = envelope(root, [artifact]);
      badEnvelope.parentCloseoutAttemptId = 'old-attempt';
      badEnvelope.workspaceRef = { kind: 'worktree', path: path.join(root, 'wt'), commitBefore: 'before', commitAfter: 'after' };
      badEnvelope.commandRuns[0].closeoutAttemptId = 'old-attempt';
      badEnvelope.commandRuns[0].exitCode = 1;
      const report = evaluateSubagentCurrentAttemptRevalidation({
        envelope: badEnvelope,
        record: record(root, [artifact]),
        projectRoot: root,
      });
      expect(report.decision).toBe('blocked');
      expect(report.mismatches).toEqual(
        expect.arrayContaining([
          'subagent_envelope_parent_closeout_attempt_id_mismatch',
          'subagent_revalidation_parent_attempt_mismatch',
          'subagent_revalidation_workspace_not_main:worktree',
          'subagent_revalidation_workspace_path_mismatch',
          'subagent_revalidation_command_attempt_mismatch:CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION',
          'subagent_revalidation_command_failed:CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION',
        ])
      );
      expect(report.failureRecords[0]).toMatchObject({ type: 'subagent_revalidation_failed', status: 'open' });
      expect(report.rerunLoops[0]).toMatchObject({ status: 'open' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a report artifact and returns non-zero for blocked revalidation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-current-attempt-cli-'));
    try {
      const evidencePath = path.join(root, 'evidence.json');
      writeJson(evidencePath, { ok: true });
      const artifact = artifactRef(root, 'evidence.json');
      const recordPath = path.join(root, 'requirement-record.json');
      const envelopePath = path.join(root, 'envelope.json');
      const reportPath = path.join(root, 'subagent-current-attempt-revalidation-report.json');
      const badRecord = record(root, [artifact]);
      badRecord.closeout = { currentAttemptId: 'new-attempt', attempts: [] };
      writeJson(recordPath, badRecord);
      writeJson(envelopePath, envelope(root, [artifact]));
      const code = runSubagentCurrentAttemptRevalidation([
        '--envelope',
        envelopePath,
        '--requirement-record',
        recordPath,
        '--report-out',
        reportPath,
        '--project-root',
        root,
        '--json',
      ]);
      expect(code).toBe(3);
      expect(existsSync(reportPath)).toBe(true);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.mismatches).toContain('subagent_revalidation_parent_attempt_mismatch');
      expect(report.controlWrite).toBe('forbidden_use_controlled_ingest');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks Delivery Closeout Gate when an accepted subagent envelope lacks current-attempt revalidation report', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-current-attempt-closeout-'));
    const previousCwd = process.cwd();
    try {
      const evidencePath = path.join(root, 'evidence.json');
      writeJson(evidencePath, { ok: true });
      const artifact = artifactRef(root, 'evidence.json');
      const acceptedEnvelope = envelope(root, [artifact]);
      const acceptedEnvelopeHash = sha256Object(acceptedEnvelope);
      const currentRecord = {
        ...record(root, [artifact]),
        executionIterations: [
          {
            eventType: 'subagent_evidence_envelope_recorded',
            executionIterationId: 'exec-subagent-envelope',
            status: 'accepted',
            subagentEvidenceEnvelopeHash: acceptedEnvelopeHash,
            subagentEvidenceEnvelope: acceptedEnvelope,
          },
          {
            executionIterationId: 'exec-delivery',
            commandRunRefs: [{ commandId: 'CMD-DELIVERY', closeoutAttemptId: 'closeout-current', exitCode: 0 }],
          },
        ],
      };
      const recordPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-CLOSEOUT', 'requirement-record.json');
      writeJson(recordPath, currentRecord);
      process.chdir(root);
      try {
        const code = mainDeliveryCloseoutGate([
          '--requirement-record',
          recordPath,
          '--attempt-id',
          'closeout-current',
          '--evaluated-at',
          '2026-05-21T00:00:00.000Z',
        ]);
        expect(code).toBe(1);
      } finally {
        process.chdir(previousCwd);
      }
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(updated.closeout.decision).toBe('blocked');
      expect(updated.closeout.attempts[0].blockingReasons).toContain(
        `subagent_current_attempt_revalidation_missing:${acceptedEnvelopeHash}`
      );
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
