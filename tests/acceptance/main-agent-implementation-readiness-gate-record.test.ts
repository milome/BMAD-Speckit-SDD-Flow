import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainImplementationReadinessGate } from '../../scripts/main-agent-implementation-readiness-gate';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';
import { implementationConfirmationHash } from '../../scripts/target-artifact-realization-gate';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const PAGE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const ARCH_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';

function writeRecord(root: string, record: Record<string, unknown>): string {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-READINESS');
  mkdirSync(base, { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return recordPath;
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function baseRecord(): Record<string, unknown> {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  return {
    recordId: 'REQ-READINESS',
    requirementSetId: 'REQ-READINESS',
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-READINESS',
        requirementSetId: 'REQ-READINESS',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/source.md',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationPageHash: PAGE_HASH,
        confirmationText: 'confirmed hashes',
        renderReportPath:
          '_bmad-output/runtime/requirement-records/REQ-READINESS/confirmation/confirmation-render-report.json',
        htmlPath: '_bmad-output/runtime/requirement-records/REQ-READINESS/confirmation/confirmation.html',
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: 'arch-run-001',
      currentArchitectureConfirmationHash: ARCH_HASH,
      resolvedRecipeHash: recipe.resolvedRecipeHash,
      staleInputs: {
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        currentArtifactHash: ARCH_HASH,
        resolvedRecipeHash: recipe.resolvedRecipeHash,
      },
    },
    architectureConfirmationStateChecks: [
      {
        eventType: 'architecture_confirmation_state_checked',
        recordId: 'REQ-READINESS',
        requirementSetId: 'REQ-READINESS',
        checkId: 'architecture-state:2026-05-19T00:00:00.500Z',
        decision: 'pass',
        resolvedRecipeHash: recipe.resolvedRecipeHash,
        stateTransition: {
          fromStatus: 'active',
          toStatus: 'active',
          reasonCode: 'hash_match',
          previousHashes: {
            sourceDocumentHash: SOURCE_HASH,
            implementationConfirmationHash: IMPLEMENTATION_HASH,
            currentArtifactHash: ARCH_HASH,
            resolvedRecipeHash: recipe.resolvedRecipeHash,
          },
          currentHashes: {
            sourceDocumentHash: SOURCE_HASH,
            implementationConfirmationHash: IMPLEMENTATION_HASH,
            currentArtifactHash: ARCH_HASH,
            resolvedRecipeHash: recipe.resolvedRecipeHash,
          },
          mismatchFields: [],
          recipeVersion: recipe.recipeVersion,
        },
        checkedAt: '2026-05-19T00:00:00.500Z',
        checkedBy: 'test-agent',
      },
    ],
    contractSummary: {
      openQuestions: [],
    },
    aiTddContractGate: { enforcementMode: 'skipped_by_policy' },
  };
}

function aiTddConfirmation(root: string): { sourcePath: string; confirmationHash: string } {
  const acceptancePath = path.join(root, 'tests', 'acceptance', 'readiness-ai-tdd.test.ts');
  const e2ePath = path.join(root, 'tests', 'e2e', 'readiness-ai-tdd.e2e.test.ts');
  const artifactPath = path.join(root, 'evidence', 'readiness-ai-tdd.json');
  writeText(acceptancePath, 'import { it } from "vitest"; it("acceptance", () => {});\n');
  writeText(e2ePath, 'import { it } from "vitest"; it("e2e", () => {});\n');
  writeText(artifactPath, '{"ok":true}\n');
  const confirmation = {
    status: 'user_confirmed',
    must: [
      {
        id: 'MUST-READINESS-AI-TDD',
        text: 'Must enforce AI-TDD readiness.',
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
        coveredByTraceRows: ['TRACE-READINESS-AI-TDD'],
      },
    ],
    notDone: [
      {
        id: 'NEG-READINESS-AI-TDD',
        text: 'Missing negative proof cannot enter implementation.',
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
        oracle: 'negative proof oracle',
        coveredByTraceRows: ['TRACE-READINESS-AI-TDD'],
      },
    ],
    evidence: [
      {
        id: 'EVD-READINESS-AI-TDD',
        text: 'AI-TDD readiness evidence.',
        oracle: 'controlled red proof before implementation',
        requiredCommandRefs: ['CMD-READINESS-ACC', 'CMD-READINESS-E2E'],
        artifactRefs: ['ART-READINESS-AI-TDD'],
      },
    ],
    traceRows: [
      {
        id: 'TRACE-READINESS-AI-TDD',
        covers: ['MUST-READINESS-AI-TDD', 'NEG-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
        deliveryEvidenceCommandRefs: ['CMD-READINESS-ACC', 'CMD-READINESS-E2E'],
        acceptanceRefs: ['ACC-READINESS-AI-TDD', 'E2E-READINESS-AI-TDD'],
        artifactRefs: ['ART-READINESS-AI-TDD'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-READINESS-ACC',
        command: `npx vitest run ${acceptancePath.replace(/\\/gu, '/')}`,
        oracle: 'acceptance oracle',
        traceRows: ['TRACE-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
      },
      {
        id: 'CMD-READINESS-E2E',
        command: `npx vitest run ${e2ePath.replace(/\\/gu, '/')}`,
        oracle: 'e2e oracle',
        traceRows: ['TRACE-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
      },
    ],
    acceptanceTests: [
      {
        id: 'ACC-READINESS-AI-TDD',
        file: acceptancePath.replace(/\\/gu, '/'),
        covers: ['MUST-READINESS-AI-TDD'],
        traceRows: ['TRACE-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
        commandRefs: ['CMD-READINESS-ACC'],
        expectedPreImplementationState: 'expected_red',
        oracle: 'acceptance oracle',
      },
    ],
    e2eSuites: [
      {
        id: 'E2E-READINESS-AI-TDD',
        file: e2ePath.replace(/\\/gu, '/'),
        covers: ['NEG-READINESS-AI-TDD'],
        traceRows: ['TRACE-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
        commandRefs: ['CMD-READINESS-E2E'],
        negativeControls: ['NEG-READINESS-AI-TDD'],
        expectedPreImplementationState: 'expected_red',
        oracle: 'e2e oracle',
      },
    ],
    artifactAutomationPlan: [
      {
        id: 'ART-READINESS-AI-TDD',
        artifactType: 'report',
        path: artifactPath.replace(/\\/gu, '/'),
        producer: 'readiness-test',
        sourceOfTruthRole: 'evidence',
        traceRows: ['TRACE-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
      },
    ],
    targetModificationPaths: [
      {
        id: 'TARGET-MOD-READINESS-001',
        path: 'scripts/main-agent-implementation-readiness-gate.ts',
        traceRows: ['TRACE-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
      },
      {
        id: 'TARGET-MOD-READINESS-002',
        path: 'scripts/ai-tdd-contract-gate.ts',
        traceRows: ['TRACE-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
      },
    ],
  };
  const sourcePath = path.join(root, 'docs', 'requirements', 'readiness-ai-tdd.md');
  writeText(
    sourcePath,
    `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')}\n`
  );
  return { sourcePath, confirmationHash: implementationConfirmationHash(confirmation) };
}

function aiTddRecord(root: string, options: { proof?: boolean; rerun?: boolean } = {}): Record<string, unknown> {
  const fixture = aiTddConfirmation(root);
  const record = {
    ...baseRecord(),
    sourcePath: fixture.sourcePath,
    implementationConfirmationHash: fixture.confirmationHash,
    confirmationHistory: [
      {
        ...(baseRecord().confirmationHistory as Record<string, unknown>[])[0],
        sourcePath: fixture.sourcePath,
        implementationConfirmationHash: fixture.confirmationHash,
      },
    ],
    aiTddContractGate: {
      required: true,
      ...(options.proof
        ? {
            preImplementationRedProofs: [
              {
                proofId: 'readiness-proof-acc',
                acceptanceId: 'ACC-READINESS-AI-TDD',
                commandId: 'CMD-READINESS-ACC',
                state: 'expected_red',
                oracle: 'controlled acceptance red proof oracle',
                failureClass: 'oracle_failure',
                recordedAt: '2026-05-25T00:00:00.000Z',
                recordedBy: 'test-agent',
              },
              {
                proofId: 'readiness-proof-e2e',
                acceptanceId: 'E2E-READINESS-AI-TDD',
                commandId: 'CMD-READINESS-E2E',
                state: 'expected_red',
                oracle: 'controlled e2e red proof oracle',
                failureClass: 'oracle_failure',
                recordedAt: '2026-05-25T00:00:00.000Z',
                recordedBy: 'test-agent',
              },
            ],
          }
        : {}),
    },
  };
  if (!options.rerun) return record;
  return {
    ...record,
    closeout: { currentAttemptId: 'readiness-rerun-attempt' },
    executionIterations: [
      {
        executionIterationId: 'readiness-rerun-iteration',
        traceRows: ['TRACE-READINESS-AI-TDD'],
        evidenceRefs: ['EVD-READINESS-AI-TDD'],
        commandRunRefs: [
          {
            commandId: 'CMD-READINESS-ACC',
            closeoutAttemptId: 'implementation-readiness:2026-05-19T00:00:01.000Z',
            runId: 'run-readiness-acc',
            exitCode: 0,
          },
          {
            commandId: 'CMD-READINESS-E2E',
            closeoutAttemptId: 'implementation-readiness:2026-05-19T00:00:01.000Z',
            runId: 'run-readiness-e2e',
            exitCode: 0,
          },
        ],
      },
    ],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-READINESS-ACC',
          artifactRefs: [
            {
              artifactType: 'report',
              path: 'evidence/readiness-ai-tdd.json',
              contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              producer: 'readiness-test',
              sourceOfTruthRole: 'evidence',
              relatedRequirementIds: ['TRACE-READINESS-AI-TDD'],
              status: 'active',
            },
          ],
        },
        {
          commandId: 'CMD-READINESS-E2E',
          artifactRefs: [
            {
              artifactType: 'report',
              path: 'evidence/readiness-ai-tdd.json',
              contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              producer: 'readiness-test',
              sourceOfTruthRole: 'evidence',
              relatedRequirementIds: ['TRACE-READINESS-AI-TDD'],
              status: 'active',
            },
          ],
        },
      ],
    },
    artifactIndex: [
      {
        artifactType: 'report',
        path: 'evidence/readiness-ai-tdd.json',
        contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        producer: 'readiness-test',
        sourceOfTruthRole: 'evidence',
        relatedRequirementIds: ['TRACE-READINESS-AI-TDD'],
        status: 'active',
      },
    ],
  };
}

describe('requirement-scoped implementation readiness gate', () => {
  it('passes only from explicit confirmation history and active architecture confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-pass-'));
    try {
      const recordPath = writeRecord(root, baseRecord());
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      });
      expect(record.lastEventType).toBe('implementation_readiness_check_recorded');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks first implementation when AI-TDD pre-implementation red proof is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-ai-tdd-missing-proof-'));
    try {
      const recordPath = writeRecord(root, aiTddRecord(root));
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--implementation-run-kind',
        'first-implementation',
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1).blockingReasons).toContain(
        'ai_tdd_pre_implementation_readiness_not_ready'
      );
      expect(record.gateChecks.at(-1).checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ai-tdd-contract-gate-pre-implementation',
            preImplementationReady: false,
            closeoutReady: false,
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes first implementation using AI-TDD preImplementationReadinessReport, not closeout readiness', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-ai-tdd-first-pass-'));
    try {
      const recordPath = writeRecord(root, aiTddRecord(root, { proof: true }));
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--implementation-run-kind',
        'first-implementation',
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1).checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ai-tdd-contract-gate-pre-implementation',
            passed: true,
            preImplementationReady: true,
            closeoutReady: false,
          }),
        ])
      );
      expect(record.gateChecks.at(-1).blockingReasons).not.toContain(
        'ai_tdd_pre_implementation_readiness_not_ready'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses pre-rerun mode for rerun readiness instead of requiring old implementation red', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-ai-tdd-rerun-'));
    try {
      const recordPath = writeRecord(root, aiTddRecord(root, { rerun: true }));
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--implementation-run-kind',
        'rerun',
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1).checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ai-tdd-contract-gate-pre-rerun',
            mode: 'pre-rerun',
          }),
        ])
      );
      expect(record.gateChecks.at(-1).blockingReasons).not.toContain(
        'ai_tdd_pre_implementation_readiness_not_ready'
      );
      expect(code).toBe(record.gateChecks.at(-1).decision === 'pass' ? 0 : 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not infer readiness from status when confirmation history is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-missing-history-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        confirmationHistory: [],
      });
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Implementation Readiness Gate',
        decision: 'blocked',
      });
      expect(record.gateChecks.at(-1).blockingReasons).toContain('confirmation_history_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks stale source or implementation confirmation hashes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-stale-hash-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        sourceDocumentHash:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1).blockingReasons).toContain(
        'source_document_hash_not_current'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when architecture state check is missing or stale', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-arch-state-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        architectureConfirmationStateChecks: [],
      });
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1).blockingReasons).toContain(
        'architecture_confirmation_state_check_not_current'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
