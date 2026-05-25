import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateTargetArtifactRealization,
  implementationConfirmationHash,
} from '../../scripts/target-artifact-realization-gate';

const ATTEMPT = 'attempt-target-001';

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function sourceDoc(root: string) {
  const sourcePath = path.join(root, 'source.md');
  const artifactPath = path.join(root, 'evidence', 'target-report.json');
  writeJson(artifactPath, { ok: true });
  const confirmation = {
    status: 'user_confirmed',
    artifactAutomationPlan: [
      {
        id: 'ART-TARGET',
        artifactType: 'report',
        path: artifactPath.replace(/\\/gu, '/'),
        producer: 'fixture-producer',
        sourceOfTruthRole: 'evidence',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    currentTargetMap: {
      canonicalArtifacts: [{ targetPathOrField: 'RequirementRecord.genericCanonicalField' }],
      pathRegistry: [],
      existingArtifacts: [
        {
          currentPath: 'legacy_completion_event',
          completionProofPolicy: 'legacy_only',
        },
      ],
    },
  };
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      '  status: user_confirmed',
      '  artifactAutomationPlan:',
      '    - id: ART-TARGET',
      '      artifactType: report',
      `      path: ${artifactPath.replace(/\\/gu, '/')}`,
      '      producer: fixture-producer',
      '      sourceOfTruthRole: evidence',
      '      traceRows: [TRACE-001]',
      '      evidenceRefs: [EVD-001]',
      '  currentTargetMap:',
      '    canonicalArtifacts:',
      '      - targetPathOrField: RequirementRecord.genericCanonicalField',
      '    pathRegistry: []',
      '    existingArtifacts:',
      '      - currentPath: legacy_completion_event',
      '        completionProofPolicy: legacy_only',
      '',
    ].join('\n')
  );
  return {
    sourcePath,
    artifactPath,
    implementationHash: implementationConfirmationHash(confirmation),
  };
}

function passingRecord(root: string) {
  const source = sourceDoc(root);
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-GENERIC');
  const eventPath = path.join(base, 'events', 'control-events.jsonl');
  const artifact = {
    artifactType: 'report',
    path: source.artifactPath.replace(/\\/gu, '/'),
    contentHash: sha256File(source.artifactPath),
    producer: 'fixture-producer',
    sourceOfTruthRole: 'evidence',
    status: 'active',
    relatedRequirementIds: ['TRACE-001', 'EVD-001'],
  };
  const event = {
    eventId: 'artifact_indexed:target',
    eventType: 'artifact_indexed',
    payload: {
      packet: {
        closeoutAttemptId: ATTEMPT,
        artifactRefs: [artifact],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    },
  };
  mkdirSync(path.dirname(eventPath), { recursive: true });
  writeFileSync(eventPath, `${JSON.stringify(event)}\n`, 'utf8');
  const record = {
    recordId: 'REQ-GENERIC',
    requirementSetId: 'REQ-GENERIC',
    sourcePath: source.sourcePath,
    status: 'user_confirmed',
    implementationConfirmationHash: source.implementationHash,
    genericCanonicalField: [{ status: 'present' }],
    controlStore: { eventLogPath: eventPath.replace(/\\/gu, '/') },
    executionIterations: [
      {
        executionIterationId: 'exec-target',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRunRefs: [
          { commandId: 'CMD-TARGET', closeoutAttemptId: ATTEMPT, runId: 'run-target', exitCode: 0 },
        ],
      },
    ],
    artifactIndex: [artifact],
  };
  const recordPath = path.join(base, 'requirement-record.json');
  writeJson(recordPath, record);
  return { ...source, record, recordPath };
}

describe('target artifact realization gate', () => {
  it('passes declared targets without hardcoded requirement fields', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-pass-'));
    try {
      const fixture = passingRecord(root);
      const report = evaluateTargetArtifactRealization({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('pass');
      expect(report.targetCount).toBeGreaterThanOrEqual(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when declared record field, hash, and current attempt binding are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-fail-'));
    try {
      const fixture = passingRecord(root);
      const brokenRecord = {
        ...fixture.record,
        genericCanonicalField: [],
        artifactIndex: [
          {
            ...(fixture.record.artifactIndex as Record<string, unknown>[])[0],
            contentHash: undefined,
          },
        ],
        controlStore: {
          eventLogPath: path.join(root, 'missing-control-events.jsonl').replace(/\\/gu, '/'),
        },
        executionIterations: [],
        deliveryEvidence: { requiredCommands: [] },
      };
      const report = evaluateTargetArtifactRealization({
        sourcePath: fixture.sourcePath,
        record: brokenRecord,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('target_record_field_missing');
      expect(report.blockingReasons).toContain('target_artifact_hash_missing');
      expect(report.blockingReasons).toContain('target_artifact_attempt_binding_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when legacy-only artifacts are used as completion proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-legacy-'));
    try {
      const fixture = passingRecord(root);
      const report = evaluateTargetArtifactRealization({
        sourcePath: fixture.sourcePath,
        record: {
          ...fixture.record,
          lastEventType: 'legacy_completion_event',
        },
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('legacy_artifact_used_as_completion_proof');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
