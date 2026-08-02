import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runIngestArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/ingest-architecture-confirmation';
import { mainIngestArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-architecture-confirmation';
import { resolveArchitectureConfirmationHashRecipe } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/architecture-confirmation-hash-recipe';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionArtifactWrites,
  runtimeStatusProjectionRecordPatch,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import { writePassingSourcePrdLintReport } from '../helpers/source-prd-lint-fixture';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function removeTempTree(root: string): void {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
}

function modelResult(
  model: string,
  status: string,
  blockingReasons: string[] = []
): Record<string, unknown> {
  return {
    payloadKind: 'model_result',
    model,
    recordId: 'REQ-ARCH-INGEST',
    requirementSetId: 'REQ-ARCH-INGEST',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    status,
    resultRecordedAt: '2026-05-19T00:00:00.000Z',
    resultRecordedBy: 'architecture-confirmation-ingest.test',
    blockingReasons,
    sourceRefs: [{ sourceType: 'fixture', id: model }],
    currentHashes: {
      sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      implementationConfirmationHash:
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    },
  };
}

function writeFixture(root: string): {
  architecturePath: string;
  reportPath: string;
  recordPath: string;
  confirmationText: string;
} {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-ARCH-INGEST');
  const architectureDir = path.join(base, 'architecture');
  mkdirSync(architectureDir, { recursive: true });
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const recordPath = path.join(base, 'requirement-record.json');
  const architecturePath = path.join(architectureDir, 'architecture-confirmation.json');
  const reportPath = path.join(architectureDir, 'architecture-confirmation.render-report.json');
  const sourcePath = path.join(root, 'docs', 'requirements', 'architecture-confirmation-ingest.md');
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, '# Architecture confirmation ingest fixture\n', 'utf8');
  const architecture = {
    schemaVersion: 'architecture-confirmation/v1',
    recordId: 'REQ-ARCH-INGEST',
    requirementSetId: 'REQ-ARCH-INGEST',
    runId: 'arch-run-001',
    status: 'draft',
    decision: 'full_architecture_confirmed',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    architectureConfirmationHashRecipe: recipe,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    targetPaths: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'],
    targetPathsHash: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    consumerImpactScan: [{ category: 'product_capability', status: 'triggered' }],
    consumerImpactScanHash:
      'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    governanceImpactScan: [
      { category: 'orchestration_hook_gate_ingest_rerun_closeout', status: 'triggered' },
    ],
    governanceImpactScanHash:
      'sha256:6666666666666666666666666666666666666666666666666666666666666666',
  };
  const artifactHash = sha256(stableStringify(architecture));
  const confirmationText = [
    '确认架构确认进入实施准备',
    'sourceDocumentHash=sha256:1111111111111111111111111111111111111111111111111111111111111111',
    'implementationConfirmationHash=sha256:2222222222222222222222222222222222222222222222222222222222222222',
    `resolvedRecipeHash=${recipe.resolvedRecipeHash}`,
    `architectureConfirmationArtifactHash=${artifactHash}`,
  ].join('\n');
  const architectureWithHash = {
    ...architecture,
    artifactHash,
    architectureConfirmationArtifactHash: artifactHash,
    confirmationPhrase: confirmationText,
    architectureConfirmationArtifactRef: {
      artifactType: 'architecture_confirmation',
      sourceOfTruthRole: 'evidence',
      path: '_bmad-output/runtime/requirement-records/REQ-ARCH-INGEST/architecture/architecture-confirmation.json',
      hash: artifactHash,
      producer: 'architecture-confirmation-ingest.test',
      purpose: 'prove controlled architecture confirmation ingest behavior',
      relatedRequirementIds: ['MUST-035', 'MUST-036', 'MUST-037', 'EVD-036', 'EVD-037'],
      status: 'active',
      inputVersion: 'architecture-confirmation-fixture-v1',
      outputVersion: 'architecture-confirmation-v1',
    },
  };
  const baseRecord: Record<string, any> = {
    schemaVersion: 'requirement-record/v1',
    recordId: 'REQ-ARCH-INGEST',
    requirementSetId: 'REQ-ARCH-INGEST',
    status: 'user_confirmed',
    sourcePath,
    sourceDocumentHash: architecture.sourceDocumentHash,
    implementationConfirmationHash: architecture.implementationConfirmationHash,
    semanticModelHash: architecture.sourceDocumentHash,
    currentAttemptId: 'implementation-attempt-001',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-ARCH-INGEST',
        requirementSetId: 'REQ-ARCH-INGEST',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'test-user',
        sourcePath,
        sourceDocumentHash: architecture.sourceDocumentHash,
        implementationConfirmationHash: architecture.implementationConfirmationHash,
        confirmationPageHash:
          'sha256:9999999999999999999999999999999999999999999999999999999999999999',
        confirmationText: 'confirmed',
        renderReportPath:
          '_bmad-output/runtime/requirement-records/REQ-ARCH-INGEST/confirmation/confirmation-render-report.json',
        htmlPath:
          '_bmad-output/runtime/requirement-records/REQ-ARCH-INGEST/confirmation/confirmation.html',
      },
    ],
    currentMentalModel: 'requirement_confirmation',
    mentalModelTransitions: [],
    reconfirmationRequests: [],
    pendingBlockerIntake: [],
    blockerIntakeRuns: [],
    rerunLoops: [],
    sixModelResults: {
      requirement_confirmation: modelResult('requirement_confirmation', 'pass'),
      architecture_confirmation: modelResult('architecture_confirmation', 'not_established', [
        'architecture_confirmation_not_established',
      ]),
      implementation_readiness: modelResult('implementation_readiness', 'not_established', [
        'implementation_readiness_not_established',
      ]),
      execution_closure: modelResult('execution_closure', 'not_established', [
        'execution_closure_not_established',
      ]),
      audit_review: modelResult('audit_review', 'not_established', [
        'audit_review_not_established',
      ]),
      delivery_confirmation: modelResult('delivery_confirmation', 'not_established', [
        'delivery_confirmation_not_established',
      ]),
    },
  };
  const confirmation = baseRecord.confirmationHistory[0];
  const requirementConfirmationStatus = createRuntimeStatusProjectionUpdate({
    recordId: baseRecord.recordId,
    requirementSetId: baseRecord.requirementSetId,
    modelId: 'requirement_confirmation',
    implementationAttemptId: baseRecord.currentAttemptId,
    sourceDocumentHash: baseRecord.sourceDocumentHash,
    implementationConfirmationHash: baseRecord.implementationConfirmationHash,
    semanticModelHash: baseRecord.semanticModelHash,
    stageInputs: [
      {
        role: 'requirement_source',
        path: sourcePath,
        hash: baseRecord.sourceDocumentHash,
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'confirmation_projection',
        path: confirmation.renderReportPath,
        hash: confirmation.confirmationPageHash,
      },
    ],
    blockerRefs: [],
    evidenceRefs: [sourcePath],
    authorityClass: 'controlled_confirmation',
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt: confirmation.confirmedAt,
    receiptPath: `runtime/status-decisions/${baseRecord.currentAttemptId}/requirement_confirmation.json`,
    projection: baseRecord.sixModelResults.requirement_confirmation,
  });
  const record = {
    ...baseRecord,
    ...runtimeStatusProjectionRecordPatch({
      record: baseRecord,
      modelId: 'requirement_confirmation',
      update: requirementConfirmationStatus,
    }),
  };
  for (const artifactWrite of runtimeStatusProjectionArtifactWrites(
    requirementConfirmationStatus
  )) {
    const artifactPath = path.resolve(base, artifactWrite.path);
    mkdirSync(path.dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, artifactWrite.content, 'utf8');
  }
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  writeFileSync(architecturePath, `${JSON.stringify(architectureWithHash, null, 2)}\n`, 'utf8');
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-ARCH-INGEST',
        runId: 'arch-run-001',
        confirmability: 'confirmable',
        sourcePath,
        sourceDocumentHash: architecture.sourceDocumentHash,
        implementationConfirmationHash: architecture.implementationConfirmationHash,
        resolvedRecipeHash: recipe.resolvedRecipeHash,
        architectureConfirmationArtifactHash:
          architectureWithHash.architectureConfirmationArtifactHash,
        htmlRef: {
          artifactType: 'architecture_confirmation_view',
          sourceOfTruthRole: 'projection',
          path: '_bmad-output/runtime/requirement-records/REQ-ARCH-INGEST/architecture/architecture-confirmation.html',
          hash: 'sha256:7777777777777777777777777777777777777777777777777777777777777777',
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  writePassingSourcePrdLintReport({
    requirementRecordPath: recordPath,
    sourcePath,
  });
  return { architecturePath, reportPath, recordPath, confirmationText };
}

describe('architecture confirmation ingest', () => {
  it('returns the controlled ingest result and receipt through the stable package action', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'stable-architecture-ingest-'));
    try {
      const fixture = writeFixture(root);
      const confirmedAt = new Date().toISOString();
      const confirmedBy = path.basename(root);
      const rawArgv = [
        'ingest-architecture-confirmation',
        '--architecture-confirmation',
        fixture.architecturePath,
        '--render-report',
        fixture.reportPath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmation-text',
        fixture.confirmationText,
        '--confirmed-by',
        confirmedBy,
        '--confirmed-at',
        confirmedAt,
        '--json',
      ];
      const result = runIngestArchitectureConfirmation({
        action: 'ingest-architecture-confirmation',
        cwd: root,
        args: {
          architectureConfirmation: fixture.architecturePath,
          renderReport: fixture.reportPath,
          requirementRecord: fixture.recordPath,
          confirmationText: fixture.confirmationText,
          confirmedBy,
          confirmedAt,
          json: 'true',
        },
        rawArgv,
        rootArgv: ['--action', ...rawArgv],
        json: true,
      });

      expect(result.errors).toEqual([]);
      expect(result).toMatchObject({
        exitCode: 0,
        status: 'architecture_confirmation_recorded',
        result: {
          ok: true,
          receiptPath: expect.any(String),
          requirementRecordPath: fixture.recordPath.replace(/\\/gu, '/'),
        },
      });
      expect(existsSync(path.resolve(result.result.receiptPath))).toBe(true);

      const updated = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(updated.architectureConfirmationState.status).toBe('active');
      expect(updated.sixModelResults.architecture_confirmation.status).toBe('pass');
    } finally {
      removeTempTree(root);
    }
  });

  it('records architecture confirmation through controlled ingest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-ingest-'));
    try {
      const fixture = writeFixture(root);
      const code = mainIngestArchitectureConfirmation([
        '--architecture-confirmation',
        fixture.architecturePath,
        '--render-report',
        fixture.reportPath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmation-text',
        fixture.confirmationText,
        '--confirmed-by',
        'test-user',
        '--confirmed-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.lastEventType).toBe('mental_model_transition_recorded');
      expect(record.architectureConfirmationState).toMatchObject({
        status: 'active',
        currentArchitectureConfirmationRunId: 'arch-run-001',
        currentArchitectureConfirmationHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(record.architectureConfirmations.at(-1)).toMatchObject({
        eventType: 'architecture_confirmation_recorded',
        confirmedBy: 'test-user',
        resolvedRecipeHash: resolveArchitectureConfirmationHashRecipe().resolvedRecipeHash,
      });
      expect(record.sixModelResults.architecture_confirmation).toMatchObject({
        payloadKind: 'model_result',
        model: 'architecture_confirmation',
        status: 'pass',
        sourceDocumentHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        semanticModelHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        currentAttemptId: 'implementation-attempt-001',
        decisionReceiptRef: expect.any(String),
        decisionReceiptHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(record.runtimeStatusDecisionReceipts.at(-1)).toMatchObject({
        path: record.sixModelResults.architecture_confirmation.decisionReceiptRef,
        receipt: {
          modelId: 'architecture_confirmation',
          implementationAttemptId: 'implementation-attempt-001',
          receiptHash: record.sixModelResults.architecture_confirmation.decisionReceiptHash,
        },
      });
      const decisionReceiptPath = path.resolve(
        path.dirname(fixture.recordPath),
        record.sixModelResults.architecture_confirmation.decisionReceiptRef
      );
      expect(existsSync(decisionReceiptPath)).toBe(true);
      expect(JSON.parse(readFileSync(decisionReceiptPath, 'utf8'))).toMatchObject({
        modelId: 'architecture_confirmation',
        implementationAttemptId: record.sixModelResults.architecture_confirmation.currentAttemptId,
        receiptHash: record.sixModelResults.architecture_confirmation.decisionReceiptHash,
      });
      expect(record.currentMentalModel).toBe('implementation_readiness');
      expect(record.stage).toBe('implementation_readiness');
      expect(record.currentStage).toBe('implementation_readiness');
      expect(
        record.mentalModelTransitions.map(
          (transition: Record<string, unknown>) => transition.toModel
        )
      ).toEqual(['architecture_confirmation', 'implementation_readiness']);
      expect(
        record.mentalModelTransitions.map(
          (transition: Record<string, unknown>) => transition.eventType
        )
      ).toEqual(['mental_model_transition_recorded', 'mental_model_transition_recorded']);
      expect(existsSync(path.join(path.dirname(fixture.recordPath), 'artifact-index.jsonl'))).toBe(
        true
      );
    } finally {
      removeTempTree(root);
    }
  });

  it('rejects stale architecture confirmation hashes without writing record state', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-ingest-stale-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const badText = fixture.confirmationText.replace(
        /architectureConfirmationArtifactHash=sha256:[a-f0-9]{64}/u,
        'architectureConfirmationArtifactHash=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      );
      const code = mainIngestArchitectureConfirmation([
        '--architecture-confirmation',
        fixture.architecturePath,
        '--render-report',
        fixture.reportPath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmation-text',
        badText,
        '--confirmed-by',
        'test-user',
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      removeTempTree(root);
    }
  });

  it('reports architecture confirmation state checks as diagnostic-only output', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-state-check-'));
    try {
      const fixture = writeFixture(root);
      expect(
        mainIngestArchitectureConfirmation([
          '--architecture-confirmation',
          fixture.architecturePath,
          '--render-report',
          fixture.reportPath,
          '--requirement-record',
          fixture.recordPath,
          '--confirmation-text',
          fixture.confirmationText,
          '--confirmed-by',
          'test-user',
          '--confirmed-at',
          '2026-05-19T00:00:00.000Z',
        ])
      ).toBe(0);
      expect(
        mainIngestArchitectureConfirmation([
          '--action',
          'check-state',
          '--requirement-record',
          fixture.recordPath,
          '--confirmed-by',
          'test-agent',
          '--confirmed-at',
          '2026-05-19T00:00:01.000Z',
          '--json',
        ])
      ).toBe(0);
      const active = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(active.architectureConfirmationState.status).toBe('active');
      expect(active.architectureConfirmationStateChecks ?? []).toHaveLength(0);
      expect(active.lastEventType).toBe('mental_model_transition_recorded');

      active.sourceDocumentHash =
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      writeFileSync(fixture.recordPath, `${JSON.stringify(active, null, 2)}\n`, 'utf8');
      expect(
        mainIngestArchitectureConfirmation([
          '--action',
          'check-state',
          '--requirement-record',
          fixture.recordPath,
          '--confirmed-by',
          'test-agent',
          '--confirmed-at',
          '2026-05-19T00:00:02.000Z',
        ])
      ).toBe(1);
      const stale = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(stale.architectureConfirmationState.status).toBe('active');
      expect(stale.architectureConfirmationStateChecks ?? []).toHaveLength(0);
      expect(stale.gateChecks ?? []).toHaveLength(0);
      expect(stale.lastEventType).toBe('mental_model_transition_recorded');
    } finally {
      removeTempTree(root);
    }
  });

  it('persists architecture confirmation state checks only when explicitly requested', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-state-check-persist-'));
    try {
      const fixture = writeFixture(root);
      expect(
        mainIngestArchitectureConfirmation([
          '--architecture-confirmation',
          fixture.architecturePath,
          '--render-report',
          fixture.reportPath,
          '--requirement-record',
          fixture.recordPath,
          '--confirmation-text',
          fixture.confirmationText,
          '--confirmed-by',
          'test-user',
          '--confirmed-at',
          '2026-05-19T00:00:00.000Z',
        ])
      ).toBe(0);
      expect(
        mainIngestArchitectureConfirmation([
          '--action',
          'check-state',
          '--requirement-record',
          fixture.recordPath,
          '--confirmed-by',
          'test-agent',
          '--confirmed-at',
          '2026-05-19T00:00:01.000Z',
          '--persist-state-check',
          '--json',
        ])
      ).toBe(0);

      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.architectureConfirmationState.status).toBe('active');
      expect(record.architectureConfirmationStateChecks).toHaveLength(1);
      expect(record.architectureConfirmationStateChecks[0]).toMatchObject({
        eventType: 'architecture_confirmation_state_checked',
        decision: 'pass',
      });
      expect(record.gateChecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            gate: 'architecture_confirmation_state',
            decision: 'pass',
          }),
        ])
      );
    } finally {
      removeTempTree(root);
    }
  });
});
