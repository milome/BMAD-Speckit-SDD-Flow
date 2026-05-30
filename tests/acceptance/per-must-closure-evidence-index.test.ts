import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPerMustClosureEvidenceIndex,
  mainPerMustClosureEvidenceIndex,
} from '../../scripts/per-must-closure-evidence-index';

const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function evidenceArtifactRef(): Record<string, unknown> {
  return {
    artifactType: 'acceptance_test_result',
    sourceOfTruthRole: 'evidence',
    path: '_bmad-output/runtime/requirement-records/REQ-PER-MUST/evidence/CMD-001.json',
    hash: HASH,
    producer: 'per-must-closure-evidence-index.test',
    purpose: 'prove command result for MUST-001',
    relatedRequirementIds: ['MUST-001'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'test-result-v1',
  };
}

function modelPacket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'model-packet-fixture/v1',
    requirements: {
      must: [
        {
          id: 'MUST-001',
          text: 'Must have explicit command, artifact, test result, and closure.',
          riskLevel: 'critical',
          evidenceRefs: ['EVD-001'],
          coveredByTraceRows: ['TRACE-001'],
        },
      ],
    },
    traceSlices: [
      {
        traceId: 'TRACE-001',
        requirementRefs: ['MUST-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: 'npx vitest run tests/acceptance/example.test.ts',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    ...overrides,
  };
}

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const artifact = evidenceArtifactRef();
  return {
    recordId: 'REQ-PER-MUST',
    requirementSetId: 'REQ-PER-MUST',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    requirementClosures: [
      {
        requirementId: 'MUST-001',
        status: 'pass',
        recordedAt: '2026-05-30T00:00:00.000Z',
      },
    ],
    executionIterations: [
      {
        executionIterationId: 'exec-001',
        commandRunRefs: [
          {
            commandId: 'CMD-001',
            command: 'npx vitest run tests/acceptance/example.test.ts',
            runId: 'run-001',
            closeoutAttemptId: 'closeout-001',
            exitCode: 0,
            startedAt: '2026-05-30T00:00:00.000Z',
            completedAt: '2026-05-30T00:00:01.000Z',
            outputSummary: '1 test passed',
          },
        ],
        evidenceArtifactRefs: [artifact],
      },
    ],
    artifactIndex: [artifact],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-001',
          command: 'npx vitest run tests/acceptance/example.test.ts',
          blockingIfMissing: true,
          closeoutAttemptId: 'closeout-001',
          artifactRefs: [artifact],
        },
      ],
    },
    ...overrides,
  };
}

describe('per-MUST closure evidence index', () => {
  it('passes only when every MUST maps to command, artifact, passing test result, and pass closure', () => {
    const index = buildPerMustClosureEvidenceIndex({
      modelPacket: modelPacket(),
      record: record(),
      attemptId: 'closeout-001',
      generatedAt: '2026-05-30T00:00:00.000Z',
    });

    expect(index.decision).toBe('pass');
    expect(index.counts).toMatchObject({ total: 1, pass: 1, blocked: 0 });
    const rows = index.rows as Array<Record<string, any>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mustId: 'MUST-001',
      status: 'pass',
      closureStatus: 'pass',
    });
    expect(rows[0].commandResults).toHaveLength(1);
    expect(rows[0].commandResults[0]).toMatchObject({
      commandId: 'CMD-001',
      status: 'pass',
      testResults: [expect.objectContaining({ exitCode: 0 })],
      artifactRefs: [expect.objectContaining({ indexed: true })],
    });
  });

  it('does not treat supplementary target artifacts as incomplete command evidence', () => {
    const evidence = evidenceArtifactRef();
    const targetArtifact = {
      ...evidence,
      artifactType: 'report',
      sourceOfTruthRole: 'audit_dispatch_contract',
      path: '_bmad-output/runtime/requirement-records/REQ-PER-MUST/audit-review/audit-current/audit-execution-profile-packet.json',
      purpose: 'current-attempt target artifact snapshot for ART-008',
    };
    const index = buildPerMustClosureEvidenceIndex({
      modelPacket: modelPacket(),
      record: record({
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-001',
                command: 'npx vitest run tests/acceptance/example.test.ts',
                runId: 'run-001',
                closeoutAttemptId: 'closeout-001',
                exitCode: 0,
              },
            ],
            evidenceArtifactRefs: [evidence, targetArtifact],
          },
        ],
        artifactIndex: [evidence, targetArtifact],
      }),
      attemptId: 'closeout-001',
    });

    expect(index.decision).toBe('pass');
    expect(index.blockingReasons).not.toContain(
      'command_not_closed:MUST-001:artifact_incomplete:CMD-001:source_of_truth_role_not_evidence'
    );
  });

  it('fails closed when a MUST has no command mapping', () => {
    const index = buildPerMustClosureEvidenceIndex({
      modelPacket: modelPacket({ requiredCommands: [] }),
      record: record(),
      attemptId: 'closeout-001',
    });

    expect(index.decision).toBe('blocked');
    expect(index.blockingReasons).toContain('command_missing:MUST-001');
  });

  it('fails closed when the command has no current-attempt test result', () => {
    const index = buildPerMustClosureEvidenceIndex({
      modelPacket: modelPacket(),
      record: record({ executionIterations: [] }),
      attemptId: 'closeout-001',
    });

    expect(index.decision).toBe('blocked');
    expect(index.blockingReasons).toContain(
      'command_not_closed:MUST-001:test_result_missing:CMD-001'
    );
  });

  it('fails closed when the command artifact is missing or not indexed', () => {
    const index = buildPerMustClosureEvidenceIndex({
      modelPacket: modelPacket(),
      record: record({
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-001',
                closeoutAttemptId: 'closeout-001',
                exitCode: 0,
              },
            ],
            evidenceArtifactRefs: [],
          },
        ],
        artifactIndex: [],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-001',
              command: 'npx vitest run tests/acceptance/example.test.ts',
              blockingIfMissing: true,
              closeoutAttemptId: 'closeout-001',
              artifactRefs: [],
            },
          ],
        },
      }),
      attemptId: 'closeout-001',
    });

    expect(index.decision).toBe('blocked');
    expect(index.blockingReasons).toContain('command_not_closed:MUST-001:artifact_missing:CMD-001');
  });

  it('fails closed when the latest MUST closure is not pass', () => {
    const index = buildPerMustClosureEvidenceIndex({
      modelPacket: modelPacket(),
      record: record({
        requirementClosures: [{ requirementId: 'MUST-001', status: 'blocked' }],
      }),
      attemptId: 'closeout-001',
    });

    expect(index.decision).toBe('blocked');
    expect(index.blockingReasons).toContain('closure_not_pass:MUST-001:blocked');
  });

  it('writes a CLI report and returns non-zero for blocked closure', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'per-must-closure-index-'));
    try {
      const packetPath = path.join(root, 'model_packet.json');
      const recordPath = path.join(root, 'requirement-record.json');
      const outPath = path.join(root, 'per-must-closure-evidence-index.json');
      writeFileSync(packetPath, `${JSON.stringify(modelPacket(), null, 2)}\n`, 'utf8');
      writeFileSync(
        recordPath,
        `${JSON.stringify(record({ executionIterations: [] }), null, 2)}\n`,
        'utf8'
      );

      const code = mainPerMustClosureEvidenceIndex([
        '--model-packet',
        packetPath,
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-001',
        '--out',
        outPath,
        '--json',
      ]);

      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(outPath, 'utf8'));
      expect(report.decision).toBe('blocked');
      expect(report.rows[0].mustId).toBe('MUST-001');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
