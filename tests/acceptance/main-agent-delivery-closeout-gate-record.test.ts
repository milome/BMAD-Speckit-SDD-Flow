import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainDeliveryCloseoutGate } from '../../scripts/main-agent-delivery-closeout-gate';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';

const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function writeRecord(root: string, record: Record<string, unknown>): string {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-CLOSEOUT');
  mkdirSync(base, { recursive: true });
  const coveragePath = path.join(base, 'evidence', 'failure-case-coverage.json');
  mkdirSync(path.dirname(coveragePath), { recursive: true });
  writeFileSync(
    coveragePath,
    `${JSON.stringify(
      {
        reportType: 'failure_case_coverage',
        resumeFailureCaseRegistryCoverage: {
          failureCases: 2,
          failureCaseExercisedCount: 2,
          unexercisedCases: [],
          issues: [],
        },
        blockingIssues: [],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const recordWithCoverage = {
    ...record,
    artifactIndex: [
      ...(((record.artifactIndex as unknown[]) ?? []) as Record<string, unknown>[]),
      {
        artifactType: 'failure_case_coverage',
        sourceOfTruthRole: 'evidence',
        path: coveragePath,
        hash: HASH,
        producer: 'main-agent-delivery-closeout-gate-record.test',
        purpose: 'prove complete failure-case coverage for closeout fixture',
        relatedRequirementIds: ['MUST-041', 'NEG-029', 'EVD-041'],
        status: 'active',
        inputVersion: 'source-v1',
        outputVersion: 'failure-case-coverage-v1',
      },
    ],
  };
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(recordPath, `${JSON.stringify(recordWithCoverage, null, 2)}\n`, 'utf8');
  return recordPath;
}

function evidenceArtifactRef(pathValue = '_bmad-output/runtime/requirement-records/REQ-CLOSEOUT/execution/evidence.json') {
  return {
    artifactType: 'implementation_evidence',
    sourceOfTruthRole: 'evidence',
    path: pathValue,
    hash: HASH,
    producer: 'main-agent-delivery-closeout-gate-record.test',
    purpose: 'prove current closeout attempt delivery evidence',
    relatedRequirementIds: ['MUST-007', 'NEG-008'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'artifact-v1',
  };
}

function baseRecord(): Record<string, unknown> {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  return {
    recordId: 'REQ-CLOSEOUT',
    requirementSetId: 'REQ-CLOSEOUT',
    status: 'user_confirmed',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: 'arch-run-001',
      currentArchitectureConfirmationHash: HASH,
      resolvedRecipeHash: recipe.resolvedRecipeHash,
      staleInputs: {
        sourceDocumentHash: HASH,
        implementationConfirmationHash: HASH,
        currentArtifactHash: HASH,
        resolvedRecipeHash: recipe.resolvedRecipeHash,
      },
    },
    architectureConfirmationStateChecks: [
      {
        eventType: 'architecture_confirmation_state_checked',
        recordId: 'REQ-CLOSEOUT',
        requirementSetId: 'REQ-CLOSEOUT',
        checkId: 'architecture-state:2026-05-19T00:00:00.000Z',
        decision: 'pass',
        resolvedRecipeHash: recipe.resolvedRecipeHash,
        stateTransition: {
          fromStatus: 'active',
          toStatus: 'active',
          reasonCode: 'hash_match',
          previousHashes: {
            sourceDocumentHash: HASH,
            implementationConfirmationHash: HASH,
            currentArtifactHash: HASH,
            resolvedRecipeHash: recipe.resolvedRecipeHash,
          },
          currentHashes: {
            sourceDocumentHash: HASH,
            implementationConfirmationHash: HASH,
            currentArtifactHash: HASH,
            resolvedRecipeHash: recipe.resolvedRecipeHash,
          },
          mismatchFields: [],
          recipeVersion: recipe.recipeVersion,
        },
        checkedAt: '2026-05-19T00:00:00.000Z',
        checkedBy: 'test-agent',
      },
    ],
    artifactIndex: [
      evidenceArtifactRef(),
    ],
    gateChecks: [
      {
        eventType: 'gate_check_recorded',
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      },
    ],
  };
}

describe('requirement-scoped delivery closeout gate', () => {
  it('creates a blocked immutable attempt when required commands are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-missing-'));
    try {
      const recordPath = writeRecord(root, baseRecord());
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-001',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.currentAttemptId).toBe('closeout-001');
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts).toHaveLength(1);
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'deliveryEvidence.requiredCommands_missing'
      );
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Delivery Closeout Gate',
        decision: 'blocked',
      });
      expect(record.failureRecords.at(-1)).toMatchObject({
        eventType: 'failure_recorded',
        type: 'delivery_closeout_blocked',
        status: 'open',
        closeoutAttemptId: 'closeout-001',
      });
      expect(record.failureRecords.at(-1).sourceRefs).toEqual(
        expect.arrayContaining([
          { sourceType: 'closeout_attempt', id: 'closeout-001' },
          { sourceType: 'gate_check', id: 'delivery-closeout:closeout-001' },
        ])
      );
      expect(record.rcaRecords.at(-1)).toMatchObject({
        eventType: 'rca_created',
        rcaId: 'rca:closeout-001',
        type: 'closeout_blocker',
        status: 'open',
      });
      expect(record.rcaRecords.at(-1).sourceRefs).toEqual(
        expect.arrayContaining([
          { sourceType: 'failure_record', id: 'failure:closeout-001' },
          { sourceType: 'closeout_attempt', id: 'closeout-001' },
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes only when current attempt required commands, artifacts, and closures are satisfied', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-pass-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-pass',
              artifactRefs: [
                evidenceArtifactRef(
                  '_bmad-output\\runtime\\requirement-records\\REQ-CLOSEOUT\\execution\\evidence.json'
                ),
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-pass',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-pass',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.currentAttemptId).toBe('closeout-pass');
      expect(record.closeout.decision).toBe('pass');
      expect(record.closeout.attempts[0]).toMatchObject({
        closeoutAttemptId: 'closeout-pass',
        decision: 'pass',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses latest requirement closure state instead of blocking on historical open events', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-latest-closure-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-latest-closure',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-latest-closure',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [
          { requirementId: 'MUST-001', status: 'open' },
          { requirementId: 'MUST-001', status: 'pass' },
          { requirementId: 'TRACE-001', status: 'open' },
          { requirementId: 'TRACE-001', status: 'pass' },
        ],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-latest-closure',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'requirement-closures-terminal',
            passed: true,
            openCount: 0,
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires explicit current-attempt required command selection', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-attempt-selection-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-other-attempt',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-attempt-selection',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-attempt-selection',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'deliveryEvidence.requiredCommands_current_attempt_missing'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts required command selection through lastRunRef closeoutAttemptId', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-last-run-ref-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              lastRunRef: {
                commandId: 'CMD-DELIVERY',
                runId: 'run-001',
                closeoutAttemptId: 'closeout-last-run-ref',
              },
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-last-run-ref',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-last-run-ref',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when architecture state check is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-arch-state-missing-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        architectureConfirmationStateChecks: [],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-arch-missing',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-arch-missing',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'architecture_confirmation_state_check_not_current'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when implementation readiness has not passed even if delivery evidence is green', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-no-readiness-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        gateChecks: [
          {
            eventType: 'gate_check_recorded',
            gate: 'Quality Gate',
            decision: 'pass',
          },
          {
            eventType: 'gate_check_recorded',
            gate: 'Release Gate',
            decision: 'pass',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-no-readiness',
              artifactRefs: [
                evidenceArtifactRef(),
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-no-readiness',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-no-readiness',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'implementation_readiness_gate_not_passed'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when failure-case coverage artifact is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-failure-case-missing-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        artifactIndex: [],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-failure-case-missing',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-failure-case-missing',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      record.artifactIndex = record.artifactIndex.filter(
        (artifact: Record<string, unknown>) => artifact.artifactType !== 'failure_case_coverage'
      );
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-failure-case-missing',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toContain(
        'failure_case_coverage_artifact_missing'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when failure-case coverage has unexercised cases', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-failure-case-incomplete-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-failure-case-incomplete',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-failure-case-incomplete',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const coverage = record.artifactIndex.find(
        (artifact: Record<string, unknown>) => artifact.artifactType === 'failure_case_coverage'
      );
      writeFileSync(
        coverage.path,
        `${JSON.stringify(
          {
            reportType: 'failure_case_coverage',
            resumeFailureCaseRegistryCoverage: {
              failureCases: 2,
              failureCaseExercisedCount: 1,
              unexercisedCases: ['sourceDocumentHash_changed'],
              issues: [],
            },
            blockingIssues: [],
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-failure-case-incomplete',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const nextRecord = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(nextRecord.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'failure_case_coverage_incomplete:1/2',
          'failure_case_unexercised:sourceDocumentHash_changed',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects attempts that would overwrite an existing closeout attempt', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-duplicate-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        closeout: {
          currentAttemptId: 'closeout-001',
          attempts: [{ closeoutAttemptId: 'closeout-001', decision: 'blocked' }],
        },
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-001',
      ]);
      expect(code).toBe(2);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts).toHaveLength(1);
      expect(record.closeout.attempts[0].decision).toBe('blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when evidence artifacts are projections or missing pass-grade metadata', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-artifact-metadata-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        artifactIndex: [
          {
            ...evidenceArtifactRef(),
            sourceOfTruthRole: 'projection',
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-bad-artifact',
              artifactRefs: [
                {
                  path: '_bmad-output/runtime/requirement-records/REQ-CLOSEOUT/execution/evidence.json',
                  hash: HASH,
                },
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-bad-artifact',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-bad-artifact',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('required_command_artifact_incomplete'),
          expect.stringContaining('required_command_not_satisfied:CMD-DELIVERY'),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when an RCA action is still open', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-open-rca-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        rcaRecords: [
          {
            eventType: 'rca_created',
            rcaId: 'rca-open-001',
            type: 'closeout_blocker',
            status: 'open',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-open-001' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-open-rca',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-open-rca',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-open-rca',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toContain('open_rca_action_exists');
      expect(record.failureRecords.at(-1)).toMatchObject({
        type: 'delivery_closeout_blocked',
        status: 'open',
      });
      expect(record.rcaRecords).toHaveLength(1);
      expect(record.rcaRecords[0].rcaId).toBe('rca-open-001');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses latest failure and RCA status instead of blocking on resolved historical entries', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-latest-failure-rca-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        failureRecords: [
          {
            eventType: 'failure_recorded',
            failureId: 'failure-closeout-001',
            type: 'delivery_closeout_blocked',
            status: 'open',
            sourceRefs: [{ sourceType: 'closeout_attempt', id: 'closeout-old' }],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
          {
            eventType: 'failure_recorded',
            failureId: 'failure-closeout-001',
            type: 'delivery_closeout_blocked',
            status: 'resolved',
            sourceRefs: [{ sourceType: 'closeout_attempt', id: 'closeout-old' }],
            recordedAt: '2026-05-19T00:01:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
        rcaRecords: [
          {
            eventType: 'rca_created',
            rcaId: 'rca-closeout-001',
            type: 'closeout_blocker',
            status: 'open',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-closeout-001' }],
          },
          {
            eventType: 'rca_created',
            rcaId: 'rca-closeout-001',
            type: 'closeout_blocker',
            status: 'resolved',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-closeout-001' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-latest-failure-rca',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-latest-failure-rca',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-latest-failure-rca',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when rerun loops remain open and keeps source refs as authority', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-pending-rerun-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        rerunLoops: [
          {
            rerunLoopId: 'rerun-001',
            status: 'in_progress',
            sourceRefs: [{ sourceType: 'gate_check', id: 'gate-failed-001' }],
            blockerRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-pending-rerun',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-pending-rerun',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-pending-rerun',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain('pending_rerun_exists');
      expect(record.rerunLoops[0]).not.toHaveProperty('decision');
      expect(record.rerunLoops[0]).not.toHaveProperty('result');
      expect(record.failureRecords.at(-1).sourceRefs).toEqual(
        expect.arrayContaining([
          { sourceType: 'rerun_loop', id: 'rerun-001' },
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when rerun loops use trigger-only or non-authoritative source refs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-invalid-rerun-source-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        rerunLoops: [
          {
            rerunLoopId: 'rerun-invalid-001',
            status: 'resolved',
            trigger: 'score_evaluation_failed',
            sourceRefs: [{ sourceType: 'artifact_ref', id: 'score.json' }],
          },
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-invalid-rerun-source',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-invalid-rerun-source',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-invalid-rerun-source',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'rerun_loop_source_ref_type_invalid:rerun-invalid-001:artifact_ref'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks closeout when trusted hooks have unreconciled receipt gaps without no-hook fallback', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-hook-reconciliation-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        hookReconciliation: {
          schemaVersion: 'hook-reconciliation/v1',
          hostKind: 'codex',
          hostMode: 'hooks_enabled',
          hookTrust: 'degraded',
          fallbackMode: 'none',
          closeoutReconciled: false,
          sequenceLedger: {
            status: 'gap',
            expectedNextSequence: 3,
            observedSequences: [1, 3],
          },
          missingReceipts: [
            {
              receiptType: 'PostToolUse',
              severity: 'high',
              expectedEventId: 'tool-write-001',
            },
          ],
          hashMismatches: [
            {
              field: 'runtimePolicySnapshotHash',
              expected: HASH,
              actual: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
            },
          ],
          noHookFallbackRefs: [],
        },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-hook-gap',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-hook-gap',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-hook-gap',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining([
          'hook_trust_not_trusted:degraded',
          'hook_fallback_mode_missing_for_untrusted:no_hooks_or_bounded_replay_required',
          'hook_sequence_ledger_gap',
          'hook_missing_receipt:PostToolUse:tool-write-001',
          'hook_hash_mismatch:runtimePolicySnapshotHash',
          'hook_closeout_not_reconciled',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows closeout when degraded hooks are reconciled by no-hook fallback evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-hook-fallback-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        hookReconciliation: {
          schemaVersion: 'hook-reconciliation/v1',
          hostKind: 'codex',
          hostMode: 'hooks_enabled',
          hookTrust: 'degraded',
          fallbackMode: 'bounded_replay',
          closeoutReconciled: true,
          sequenceLedger: {
            status: 'reconciled',
            expectedNextSequence: 4,
            observedSequences: [1, 2, 3],
          },
          missingReceipts: [],
          hashMismatches: [],
          noHookFallbackRefs: [{ sourceType: 'execution_iteration', id: 'exec-fallback-001' }],
        },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              command: 'node verify.js',
              blockingIfMissing: true,
              negativeOrRegression: true,
              closeoutAttemptId: 'closeout-hook-fallback',
              artifactRefs: [evidenceArtifactRef()],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-hook-fallback',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-hook-fallback',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.decision).toBe('pass');
      expect(record.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'hook-reconciliation-valid', passed: true }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
