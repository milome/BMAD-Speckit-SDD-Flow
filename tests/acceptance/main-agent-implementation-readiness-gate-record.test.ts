import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainImplementationReadinessGate } from '../../scripts/main-agent-implementation-readiness-gate';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';

const ARCH_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';

const CONFIRMATION_BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(confirmation).filter(([key]) => !CONFIRMATION_BOOKKEEPING_FIELDS.has(key))
  );
}

function implementationConfirmationHash(confirmation: Record<string, unknown>): string {
  return sha256Text(stableStringify(semanticConfirmationForHash(confirmation)));
}

function sourceDocumentHashFor(
  sourceText: string,
  blockText: string,
  confirmation: Record<string, unknown>
): string {
  const normalizedBlock = `implementationConfirmation:${stableStringify(semanticConfirmationForHash(confirmation))}`;
  return sha256Text(sourceText.replace(blockText, normalizedBlock));
}

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

function writeReadinessFixture(
  root: string,
  options: { proof?: boolean } = {}
): {
  sourcePath: string;
  renderReportPath: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmationPageHash: string;
  preImplementationRedProofs: Record<string, unknown>[];
} {
  const acceptancePath = path.join(root, 'tests', 'acceptance', 'readiness-ai-tdd.test.ts');
  const e2ePath = path.join(root, 'tests', 'e2e', 'readiness-ai-tdd.e2e.test.ts');
  const sourcePath = path.join(root, 'docs', 'requirements', 'readiness-ai-tdd.md');
  const renderReportPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-READINESS',
    'confirmation',
    'confirmation-render-report.json'
  );
  const drilldownReportPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-READINESS',
    'authoring',
    'pre-render-must-decomposition-gate-report.json'
  );
  const htmlPath = path.join(path.dirname(renderReportPath), 'confirmation.html');
  const summaryPath = path.join(path.dirname(renderReportPath), 'confirmation-summary.json');
  writeText(acceptancePath, 'import { it } from "vitest"; it("acceptance", () => {});\n');
  writeText(e2ePath, 'import { it } from "vitest"; it("e2e", () => {});\n');

  const semanticConfirmation: Record<string, unknown> = {
    contractSchemaVersion: 1,
    status: 'user_confirmed',
    recordId: 'REQ-READINESS',
    requirementSetId: 'REQ-READINESS',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    confirmationLanguage: 'zh-CN',
    confirmationProfile: 'implementation_confirmation',
    requiredViewPacks: ['currentTargetMap'],
    optionalViewPacks: [],
    confirmedAt: '2026-05-19T00:00:00.000Z',
    confirmedBy: 'user',
    sourceDocumentHash: null,
    implementationConfirmationHash: null,
    confirmationRender: {
      htmlPath: null,
      summaryPath: null,
      reportPath: null,
      htmlHash: null,
      confirmationPhrase: null,
    },
    applicability: {
      currentTargetMap: { applies: true },
      aiTddContractGate: { applies: true },
    },
    must: [
      {
        id: 'MUST-001',
        text: 'Must enforce AI-TDD readiness before implementation dispatch.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: ['TRACE-001'],
      },
    ],
    notDone: [
      {
        id: 'NEG-001',
        text: 'Missing red proof cannot enter implementation.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: ['TRACE-001'],
        oracle: 'controlled red proof oracle',
      },
    ],
    mustNot: [
      {
        id: 'OUT-001',
        text: 'Scope boundary: record-only shortcut is legacy evidence, not readiness authority.',
      },
    ],
    evidence: [
      {
        id: 'EVD-001',
        text: 'AI-TDD readiness evidence.',
        gate: 'Implementation Readiness Gate',
        oracle: 'controlled red proof before implementation',
        requiredCommandRefs: ['CMD-001', 'CMD-002'],
        artifactRefs: ['CANONICAL-001'],
      },
    ],
    traceRows: [
      {
        id: 'TRACE-001',
        covers: ['MUST-001', 'NEG-001'],
        evidenceRefs: ['EVD-001'],
        deliveryEvidenceCommandRefs: ['CMD-001', 'CMD-002'],
        acceptanceRefs: ['ACC-001', 'E2E-001'],
        artifactRefs: ['CANONICAL-001'],
        status: 'PENDING',
      },
    ],
    failurePaths: [
      {
        id: 'FAIL-001',
        title: 'Missing AI-TDD red proof',
        trigger: 'AI-TDD expected-red proof is absent.',
        expectedBehavior: 'Fail closed before implementation dispatch.',
        forbiddenBehavior: 'Dispatch implementation from record status only.',
        blocksCompletionWhenViolated: true,
        linkedNegIds: ['NEG-001'],
        linkedEvidenceIds: ['EVD-001'],
        viewRefs: ['EDGEVIEW-001'],
        requiredAssertions: ['AI-TDD gate blocks missing red proof.'],
      },
    ],
    edgeCases: [
      {
        id: 'EDGE-001',
        category: 'missing_red_proof',
        condition: 'Only record status is user_confirmed.',
        expectedBehavior: 'Block implementation readiness.',
        forbiddenBehavior: 'Treat user confirmation as implementation readiness.',
        linkedFailurePathIds: ['FAIL-001'],
        linkedEvidenceIds: ['EVD-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: `npx vitest run ${acceptancePath.replace(/\\/gu, '/')}`,
        oracle: 'acceptance oracle',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
      {
        id: 'CMD-002',
        command: `npx vitest run ${e2ePath.replace(/\\/gu, '/')}`,
        oracle: 'e2e oracle',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    acceptanceTests: [
      {
        id: 'ACC-001',
        file: acceptancePath.replace(/\\/gu, '/'),
        covers: ['MUST-001'],
        failurePathRefs: ['FAIL-001'],
        edgeCaseRefs: ['EDGE-001'],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        expectedPreImplementationState: 'expected_red',
        oracle: 'acceptance oracle',
      },
    ],
    e2eSuites: [
      {
        id: 'E2E-001',
        file: e2ePath.replace(/\\/gu, '/'),
        covers: ['NEG-001'],
        failurePathRefs: ['FAIL-001'],
        edgeCaseRefs: ['EDGE-001'],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-002'],
        negativeControls: ['NEG-001'],
        expectedPreImplementationState: 'expected_red',
        oracle: 'e2e oracle',
      },
    ],
    sequenceViews: [{ id: 'SEQ-001', title: 'Readiness flow', covers: ['MUST-001', 'NEG-001'] }],
    flowViews: [{ id: 'FLOW-001', title: 'Readiness flow', covers: ['MUST-001', 'NEG-001'] }],
    edgeCaseViews: [
      { id: 'EDGEVIEW-001', title: 'Missing red proof', covers: ['NEG-001'], cases: ['EDGE-001'] },
    ],
    boundaryViews: [{ id: 'BOUNDARY-001', title: 'AI-TDD boundary', covers: ['OUT-001'] }],
    artifactAutomationPlan: [
      {
        id: 'CANONICAL-001',
        artifactType: 'code',
        path: 'scripts/main-agent-implementation-readiness-gate.ts',
        producer: 'readiness-gate',
        sourceOfTruthRole: 'implementation',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    currentTargetMap: {
      schemaVersion: 'current-target-map/v1',
      displayProfile: 'closed_loop_current_target_map',
      currentSummary: [
        {
          id: 'CUR-001',
          text: 'Record-only readiness can appear sufficient.',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      targetSummary: [
        {
          id: 'TAR-001',
          text: 'Stage audit and AI-TDD gate are both mandatory.',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      diffRows: [
        {
          id: 'DIFF-001',
          current: 'record-only',
          target: 'stage-audit-plus-ai-tdd',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      process: [
        {
          id: 'PROC-001',
          from: 'record',
          to: 'gate',
          action: 'run stage audit and AI-TDD gate',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      artifactPaths: [
        {
          id: 'PATH-001',
          path: 'scripts/main-agent-implementation-readiness-gate.ts',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      canonicalArtifacts: [
        {
          id: 'CANONICAL-001',
          targetPathOrField: 'scripts/main-agent-implementation-readiness-gate.ts',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      existingArtifacts: [
        {
          id: 'LEGACY-001',
          currentPath: 'record-only-readiness',
          completionProofPolicy: 'legacy_only',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
    },
    closeoutReadinessPreview: {
      requiredCommands: ['CMD-001', 'CMD-002'],
      orphanPolicy: 'no orphan proof may satisfy readiness',
      currentAttemptPolicy: 'current-attempt proof is required after implementation',
      recordClosedPolicy: 'record_closed requires closeout gate pass',
    },
    targetModificationPaths: [
      {
        id: 'TARGET-MOD-001',
        path: 'scripts/main-agent-implementation-readiness-gate.ts',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
  };

  const initialBlock = `implementationConfirmation:\n${stableStringify(semanticConfirmation)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  const sourceTemplate = `# Readiness AI TDD Fixture\n\nMust Not Count As Completion: exit code only, stdout, HTTP 200, page render, and mock calls cannot satisfy readiness.\n\n\`\`\`yaml\n${initialBlock}\n\`\`\`\n\n\`\`\`mermaid\nsequenceDiagram\n  actor User\n  participant Gate\n  User->>Gate: Require mandatory AI-TDD readiness [MUST-001][EVD-001]\n  Gate-->>User: Block missing red proof [NEG-001][EVD-001]\n\`\`\`\n\n## Reverse Audit Report\n\nVerdict: PASS\n\n### implementationConfirmation Findings\n### HTML Confirmation Findings\n### Reconfirmation Findings\n### ID Reference Findings\n### Diagram And Step Findings\n### Artifact Automation Plan Findings\n### traceRows Findings\n### Row Quality Findings\n### E2E Anti-Smoke Findings\n### Open Findings\n\n## Definition of Done\n\n- Stage audit and AI-TDD gate pass before implementation dispatch.\n`;
  const confirmation = {
    ...semanticConfirmation,
    sourceDocumentHash: '',
    implementationConfirmationHash: '',
    confirmationRender: {
      htmlPath: htmlPath.replace(/\\/gu, '/'),
      summaryPath: summaryPath.replace(/\\/gu, '/'),
      reportPath: renderReportPath.replace(/\\/gu, '/'),
      htmlHash: '',
      confirmationPhrase: '',
    },
  };
  const implementationHash = implementationConfirmationHash(confirmation);
  confirmation.implementationConfirmationHash = implementationHash;
  const finalBlock = `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  const sourceHash = sourceDocumentHashFor(
    sourceTemplate.replace(initialBlock, finalBlock),
    finalBlock,
    confirmation
  );
  const pageHash = sha256Text(`confirmation:${sourceHash}:${implementationHash}`);
  const confirmationPhrase = `确认以上范围进入下一阶段\nsourceDocumentHash=${sourceHash}\nimplementationConfirmationHash=${implementationHash}\nconfirmationPageHash=${pageHash}`;
  confirmation.sourceDocumentHash = sourceHash;
  confirmation.confirmationRender.htmlHash = pageHash;
  confirmation.confirmationRender.confirmationPhrase = confirmationPhrase;
  const confirmedBlock = `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  const sourceText = sourceTemplate.replace(initialBlock, confirmedBlock);
  writeText(sourcePath, sourceText);
  writeText(htmlPath, '<!doctype html><title>confirmation</title>');
  writeText(summaryPath, '{}\n');
  writeText(
    renderReportPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-READINESS',
        requirementSetId: 'REQ-READINESS',
        sourcePath: sourcePath.replace(/\\/gu, '/'),
        sourceDocumentHash: sourceHash,
        implementationConfirmationHash: implementationHash,
        confirmationPageHash: pageHash,
        actualHtmlFileHash: pageHash,
        generatedAt: '2026-05-19T00:00:00.000Z',
        language: 'zh-CN',
        confirmability: 'confirmable',
        deliveryReadiness: { ready: false, status: 'delivery_not_ready' },
        blockingIssues: [],
        warnings: [],
        diagramCoverage: {},
        traceCoverage: {},
        artifactAutomationCoverage: {},
        preConfirmationSemanticDrilldown: {
          reportPath: drilldownReportPath.replace(/\\/gu, '/'),
        },
        renderedSections: ['pre-confirmation-semantic-drilldown'],
        confirmInstruction: confirmationPhrase,
        artifactRef: { path: htmlPath.replace(/\\/gu, '/'), hash: pageHash },
      },
      null,
      2
    )}\n`
  );
  writeText(
    drilldownReportPath,
    `${JSON.stringify(
      {
        schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
        sourceDocumentHash: sourceHash,
        implementationConfirmationHash: implementationHash,
        verdict: 'PASS',
        confirmability: 'confirmable',
        failedChecks: [],
        criticalAuditor: {
          consecutiveNoNewGapRounds: 3,
        },
        packetSourceReconciliation: {
          verdict: 'pass',
        },
      },
      null,
      2
    )}\n`
  );
  const preImplementationRedProofs = options.proof
    ? [
        {
          proofId: 'readiness-proof-acc',
          acceptanceId: 'ACC-001',
          commandId: 'CMD-001',
          state: 'expected_red',
          oracle: 'controlled acceptance red proof oracle',
          failureClass: 'oracle_failure',
          recordedAt: '2026-05-25T00:00:00.000Z',
          recordedBy: 'test-agent',
        },
        {
          proofId: 'readiness-proof-e2e',
          acceptanceId: 'E2E-001',
          commandId: 'CMD-002',
          state: 'expected_red',
          oracle: 'controlled e2e red proof oracle',
          failureClass: 'oracle_failure',
          recordedAt: '2026-05-25T00:00:00.000Z',
          recordedBy: 'test-agent',
        },
      ]
    : [];
  return {
    sourcePath,
    renderReportPath,
    sourceDocumentHash: sourceHash,
    implementationConfirmationHash: implementationHash,
    confirmationPageHash: pageHash,
    preImplementationRedProofs,
  };
}

function baseRecord(
  root: string,
  options: { proof?: boolean } = { proof: true }
): Record<string, unknown> {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const fixture = writeReadinessFixture(root, options);
  return {
    recordId: 'REQ-READINESS',
    requirementSetId: 'REQ-READINESS',
    status: 'user_confirmed',
    sourcePath: fixture.sourcePath,
    sourceDocumentHash: fixture.sourceDocumentHash,
    implementationConfirmationHash: fixture.implementationConfirmationHash,
    confirmationPageHash: fixture.confirmationPageHash,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-READINESS',
        requirementSetId: 'REQ-READINESS',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: fixture.sourcePath,
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        confirmationPageHash: fixture.confirmationPageHash,
        confirmationText: 'confirmed hashes',
        renderReportPath: fixture.renderReportPath,
        htmlPath: path.join(path.dirname(fixture.renderReportPath), 'confirmation.html'),
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: 'arch-run-001',
      currentArchitectureConfirmationHash: ARCH_HASH,
      resolvedRecipeHash: recipe.resolvedRecipeHash,
      staleInputs: {
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        currentArtifactHash: ARCH_HASH,
        resolvedRecipeHash: recipe.resolvedRecipeHash,
      },
    },
    architectureConfirmationStateChecks: [
      {
        eventType: 'architecture_confirmation_recorded',
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
            sourceDocumentHash: fixture.sourceDocumentHash,
            implementationConfirmationHash: fixture.implementationConfirmationHash,
            currentArtifactHash: ARCH_HASH,
            resolvedRecipeHash: recipe.resolvedRecipeHash,
          },
          currentHashes: {
            sourceDocumentHash: fixture.sourceDocumentHash,
            implementationConfirmationHash: fixture.implementationConfirmationHash,
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
    aiTddContractGate: {
      preImplementationRedProofs: fixture.preImplementationRedProofs,
    },
  };
}

function aiTddRecord(
  root: string,
  options: { proof?: boolean; rerun?: boolean } = {}
): Record<string, unknown> {
  const record = {
    ...baseRecord(root, { proof: options.proof === true }),
  };
  if (!options.rerun) return record;
  return {
    ...record,
    closeout: { currentAttemptId: 'readiness-rerun-attempt' },
    executionIterations: [
      {
        executionIterationId: 'readiness-rerun-iteration',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRunRefs: [
          {
            commandId: 'CMD-001',
            closeoutAttemptId: 'readiness-rerun-attempt',
            runId: 'run-readiness-acc',
            exitCode: 0,
          },
          {
            commandId: 'CMD-002',
            closeoutAttemptId: 'readiness-rerun-attempt',
            runId: 'run-readiness-e2e',
            exitCode: 0,
          },
        ],
      },
    ],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-001',
          artifactRefs: [
            {
              artifactType: 'report',
              path: 'evidence/readiness-ai-tdd.json',
              contentHash:
                'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              producer: 'readiness-test',
              sourceOfTruthRole: 'evidence',
              relatedRequirementIds: ['TRACE-001'],
              status: 'active',
            },
          ],
        },
        {
          commandId: 'CMD-002',
          artifactRefs: [
            {
              artifactType: 'report',
              path: 'evidence/readiness-ai-tdd.json',
              contentHash:
                'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              producer: 'readiness-test',
              sourceOfTruthRole: 'evidence',
              relatedRequirementIds: ['TRACE-001'],
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
        relatedRequirementIds: ['TRACE-001'],
        status: 'active',
      },
    ],
  };
}

describe('requirement-scoped implementation readiness gate', () => {
  it('passes only from explicit confirmation history and active architecture confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-pass-'));
    try {
      const recordPath = writeRecord(root, baseRecord(root));
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
      expect(record.lastEventType).toBe('implementation_readiness_result_recorded');
      expect(record.lastAppliedEventId).toContain('implementation_readiness_result_recorded');
      expect(record).not.toHaveProperty('readinessBaselineActivationEventType');
      expect(record).not.toHaveProperty('readinessBaselineActivation');
      expect(record.sixModelResults.implementation_readiness).toMatchObject({
        payloadKind: 'model_result',
        model: 'implementation_readiness',
        recordId: 'REQ-READINESS',
        requirementSetId: 'REQ-READINESS',
        sourceDocumentHash: record.sourceDocumentHash,
        implementationConfirmationHash: record.implementationConfirmationHash,
        status: 'pass',
        resultRecordedAt: '2026-05-19T00:00:01.000Z',
        resultRecordedBy: 'agent',
        blockingReasons: [],
      });
      expect(record.readinessBaselineMetadata).toMatchObject({
        status: 'current',
        readinessGateRecipeVersion: 'implementation-readiness-gate/v1',
        baselineCreatedByEventId:
          'implementation-readiness-result:REQ-READINESS:2026-05-19T00:00:01.000Z',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks first implementation when AI-TDD pre-implementation red proof is missing', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'implementation-readiness-ai-tdd-missing-proof-')
    );
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
      expect(record.lastEventType).toBe('implementation_readiness_result_recorded');
      expect(record.sixModelResults.implementation_readiness).toMatchObject({
        model: 'implementation_readiness',
        status: 'blocked',
      });
      expect(record.readinessBaselineMetadata.status).toBe('not_established');
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
        ...baseRecord(root),
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
        ...baseRecord(root),
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

  it('does not require legacy architecture state check when architecture state is current', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-arch-state-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(root),
        architectureConfirmationStateChecks: [],
      });
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1).blockingReasons).not.toContain(
        'architecture_confirmation_state_check_not_current'
      );
      expect(record.gateChecks.at(-1).checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'architecture-confirmation-state-current',
            passed: true,
          }),
          expect.objectContaining({
            id: 'architecture-confirmation-state-check-current',
            passed: true,
            compatibilityOnly: true,
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when architecture state hashes are stale', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-arch-stale-'));
    try {
      const record = baseRecord(root);
      const state = record.architectureConfirmationState as Record<string, unknown>;
      state.staleInputs = {
        ...(state.staleInputs as Record<string, unknown>),
        sourceDocumentHash:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      };
      const recordPath = writeRecord(root, {
        ...record,
        architectureConfirmationStateChecks: [],
      });
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(1);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(updated.gateChecks.at(-1).blockingReasons).toContain(
        'architecture_confirmation_source_hash_not_current'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
