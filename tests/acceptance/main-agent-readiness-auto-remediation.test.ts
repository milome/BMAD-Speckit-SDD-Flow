import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveMainAgentOrchestrationSurface,
  runMainAgentAutomaticLoop,
} from '../../scripts/main-agent-orchestration';
import { mainImplementationReadinessGate } from '../../scripts/main-agent-implementation-readiness-gate';
import type { ResolvedRuntimeContext } from '../../scripts/resolve-active-requirement';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  buildImplementationEntryIndexKey,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

const CONFIRMATION_BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

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

function implementationConfirmationHashFor(confirmation: Record<string, unknown>): string {
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

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

function writeRuntimeRecordContext(
  root: string,
  recordId: string,
  recordPath: string,
  sourcePath: string
): void {
  const context = defaultRuntimeContextFile({
    flow: 'standalone_tasks',
    stage: 'implement',
    sourceMode: 'standalone_story',
    contextScope: 'run',
    runId: recordId,
    artifactPath: sourcePath,
    updatedAt: '2026-05-26T00:00:00.000Z',
  });
  const resolvedRuntimeContext: ResolvedRuntimeContext = {
    version: 1,
    kind: 'ResolvedRuntimeContext',
    recordId,
    requirementSetId: recordId,
    runId: recordId,
    status: 'user_confirmed',
    flow: 'standalone_tasks',
    stage: 'implement',
    recordPath,
    sourcePath,
    sourceDocumentHash: '',
    implementationConfirmationHash: '',
    indexPath: path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'),
    runtimePolicySnapshotPath: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      recordId,
      'recovery',
      'runtime-policy-snapshot.json'
    ),
    runtimePolicySnapshotExists: false,
    recoveryContextPath: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      recordId,
      'recovery',
      'recovery-context.json'
    ),
    recoveryContextExists: false,
    artifactIndexPath: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      'artifact-index.jsonl'
    ),
    orchestrationStateDir: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      recordId,
      'orchestration',
      'orchestration-state'
    ),
    promptPacketsDir: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      recordId,
      'prompts',
      'prompt-packets'
    ),
    resolutionSource: 'explicit_args_without_index',
    resolvedAt: '2026-05-26T00:00:00.000Z',
  };
  const contextWithResolution = {
    ...context,
    resolvedRuntimeContext,
  };
  writeRuntimeContext(root, contextWithResolution);
  const registry = defaultRuntimeContextRegistry(root);
  registry.runContexts[recordId] = {
    path: path.join('_bmad-output', 'runtime', 'context', 'runs', `${recordId}.json`),
    runId: recordId,
    sourcePath,
  };
  registry.activeScope = {
    scopeType: 'run',
    runId: recordId,
    resolvedContextPath: registry.runContexts[recordId].path,
    reason: 'main-agent-readiness-auto-remediation fixture',
  };
  registry.implementationEntryIndex.standalone_tasks[
    buildImplementationEntryIndexKey({
      flow: 'standalone_tasks',
      runId: recordId,
      artifactDocPath: sourcePath,
    })
  ] = {
    gateName: 'implementation-readiness',
    requestedFlow: 'standalone_tasks',
    recommendedFlow: 'standalone_tasks',
    decision: 'block',
    readinessStatus: 'blocked',
    blockerCodes: [],
    blockerSummary: [],
    rerouteRequired: false,
    rerouteReason: null,
    evidenceSources: {
      readinessReportPath: null,
      remediationArtifactPath: null,
      executionRecordPath: null,
      authoritativeAuditReportPath: null,
    },
    semanticFingerprint: null,
    evaluatedAt: '2026-05-26T00:00:00.000Z',
  };
  writeRuntimeContextRegistry(root, registry);
}

function makeSourceFixture(
  root: string,
  options: {
    missingCommandFile?: boolean;
    semanticGap?: boolean;
    uniqueProjectionGap?: boolean;
    ambiguousProjectionGap?: boolean;
  } = {}
): {
  sourcePath: string;
  recordPath: string;
  testPath: string;
  reportPath: string;
} {
  const recordId = options.semanticGap ? 'REQ-SEMANTIC-GAP' : 'REQ-AUTO-REMEDIATE';
  const sourcePath = path.join(root, 'docs', 'requirements', `${recordId}.md`);
  const testPath = path.join(root, 'tests', 'acceptance', `${recordId}.test.ts`);
  const e2ePath = path.join(root, 'tests', 'e2e', `${recordId}.e2e.test.ts`);
  const reportPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'implementation-readiness-report.json'
  );
  const confirmationDir = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'confirmation'
  );
  const renderReportPath = path.join(confirmationDir, 'confirmation-render-report.json');
  const htmlPath = path.join(confirmationDir, 'confirmation.html');
  const summaryPath = path.join(confirmationDir, 'confirmation-summary.json');
  const drilldownReportPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'pre-render-must-decomposition-gate-report.json'
  );
  if (!options.missingCommandFile) {
    writeText(
      testPath,
      'import { it, expect } from "vitest"; it("expected red placeholder", () => { expect(true).toBe(false); });\n'
    );
    writeText(
      e2ePath,
      'import { it, expect } from "vitest"; it("expected red e2e placeholder", () => { expect(true).toBe(false); });\n'
    );
  } else {
    writeText(
      e2ePath,
      'import { it, expect } from "vitest"; it("expected red e2e placeholder", () => { expect(true).toBe(false); });\n'
    );
  }

  const confirmation = {
    contractSchemaVersion: 1,
    status: 'user_confirmed',
    recordId,
    requirementSetId: recordId,
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    confirmationLanguage: 'zh-CN',
    confirmationProfile: 'implementation_confirmation',
    requiredViewPacks: ['currentTargetMap'],
    optionalViewPacks: [],
    applicability: {
      currentTargetMap: { applies: true },
      aiTddContractGate: { applies: true },
    },
    must: [
      {
        id: 'MUST-001',
        text: 'Implementation readiness must require an expected-red adapter test before implementation.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: options.semanticGap ? [] : ['TRACE-001'],
      },
    ],
    notDone: [
      {
        id: 'NEG-001',
        text: 'Readiness auto-remediation must not change confirmed requirement semantics.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: options.semanticGap ? [] : ['TRACE-001'],
        oracle: 'confirmed semantics must be preserved during readiness auto-remediation',
      },
    ],
    mustNot: [
      { id: 'OUT-001', text: 'Implementation evidence is out of scope before readiness passes.' },
    ],
    evidence: [
      {
        id: 'EVD-001',
        text: 'Expected-red adapter proof.',
        gate: 'Implementation Readiness Gate',
        oracle: 'adapter test fails for the expected requirement oracle',
        requiredCommandRefs: ['CMD-001', 'CMD-002'],
        artifactRefs: ['ART-001'],
      },
    ],
    traceRows: [
      {
        id: 'TRACE-001',
        covers:
          options.semanticGap || options.ambiguousProjectionGap ? [] : ['MUST-001', 'NEG-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001', 'CMD-002'],
        acceptanceRefs: ['ACC-001', 'E2E-001'],
        artifactRefs: ['ART-001'],
        status: 'PENDING',
      },
    ],
    failurePaths: [
      {
        id: 'FAIL-001',
        title: 'Missing expected-red adapter',
        trigger: 'Adapter test file is missing before implementation.',
        expectedBehavior:
          'Main Agent creates a deterministic expected-red adapter and reruns readiness.',
        forbiddenBehavior: 'Dispatch implementation while readiness is blocked.',
        linkedNegIds: ['NEG-001'],
        linkedEvidenceIds: ['EVD-001'],
        viewRefs: ['EDGEVIEW-001'],
      },
    ],
    edgeCases: [
      {
        id: 'EDGE-001',
        category: 'readiness_auto_remediation',
        condition: 'Readiness gate blocks on missing adapter proof.',
        expectedBehavior: 'Repair only non-semantic readiness gaps.',
        forbiddenBehavior: 'Change confirmed MUST/NEG semantics.',
        linkedFailurePathIds: ['FAIL-001'],
        linkedEvidenceIds: ['EVD-001'],
        viewRefs: ['EDGEVIEW-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: `npx vitest run ${testPath.replace(/\\/gu, '/')}`,
        oracle: 'expected-red adapter test fails before implementation',
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
      {
        id: 'CMD-002',
        command: `npx vitest run ${e2ePath.replace(/\\/gu, '/')}`,
        oracle: 'expected-red e2e adapter test fails before implementation',
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    acceptanceTests: [
      {
        id: 'ACC-001',
        file: testPath.replace(/\\/gu, '/'),
        covers: options.uniqueProjectionGap || options.ambiguousProjectionGap ? [] : ['MUST-001'],
        failurePathRefs: ['FAIL-001'],
        edgeCaseRefs: ['EDGE-001'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        expectedPreImplementationState: 'expected_red',
        oracle: 'expected-red adapter test fails before implementation',
      },
    ],
    e2eSuites: [
      {
        id: 'E2E-001',
        file: e2ePath.replace(/\\/gu, '/'),
        covers: options.uniqueProjectionGap || options.ambiguousProjectionGap ? [] : ['NEG-001'],
        failurePathRefs: ['FAIL-001'],
        edgeCaseRefs: ['EDGE-001'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-002'],
        negativeControls: ['NEG-001'],
        expectedPreImplementationState: 'expected_red',
        oracle: 'expected-red e2e adapter test fails before implementation',
      },
    ],
    sequenceViews: [
      {
        id: 'SEQ-001',
        title: 'Readiness auto remediation sequence',
        covers: ['MUST-001', 'NEG-001'],
      },
    ],
    flowViews: [
      { id: 'FLOW-001', title: 'Readiness auto remediation flow', covers: ['MUST-001', 'NEG-001'] },
    ],
    edgeCaseViews: [
      {
        id: 'EDGEVIEW-001',
        title: 'Missing expected-red adapter',
        covers: ['NEG-001'],
        cases: ['EDGE-001', 'FAIL-001'],
      },
    ],
    boundaryViews: [{ id: 'BOUNDARY-001', title: 'Readiness boundary', covers: ['OUT-001'] }],
    artifactAutomationPlan: [
      {
        id: 'ART-001',
        artifactType: 'test',
        path: testPath.replace(/\\/gu, '/'),
        producer: 'main-agent-readiness-auto-remediation',
        sourceOfTruthRole: 'evidence',
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        contractBound: true,
      },
    ],
    currentTargetMap: {
      schemaVersion: 'current-target-map/v1',
      displayProfile: 'closed_loop_current_target_map',
      currentSummary: [
        {
          id: 'CUR-001',
          text: 'Adapter test may be absent.',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      targetSummary: [
        {
          id: 'TAR-001',
          text: 'Adapter test and expected-red proof exist.',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      diffRows: [
        {
          id: 'DIFF-001',
          current: 'missing adapter',
          target: 'expected-red adapter',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      process: [
        {
          id: 'PROC-001',
          from: 'blocked',
          to: 'readiness-pass',
          action: 'auto-remediate non-semantic blocker',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      artifactPaths: [
        {
          id: 'PATH-001',
          path: testPath.replace(/\\/gu, '/'),
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      canonicalArtifacts: [
        {
          id: 'ART-001',
          targetPathOrField: testPath.replace(/\\/gu, '/'),
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      existingArtifacts: [
        {
          id: 'LEGACY-001',
          currentPath: 'legacy-readiness-prompt',
          completionProofPolicy: 'legacy_only',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
    },
    closeoutReadinessPreview: {
      requiredCommands: ['CMD-001', 'CMD-002'],
      orphanPolicy: 'no orphan proof may satisfy readiness',
      currentAttemptPolicy: 'not applicable before implementation',
      recordClosedPolicy: 'readiness artifacts are not implementation completion evidence',
    },
    targetModificationPaths: [
      {
        id: 'TARGET-MOD-001',
        path: testPath.replace(/\\/gu, '/'),
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        artifactRefs: ['ART-001'],
      },
    ],
    confirmedAt: '2026-05-26T00:00:00.000Z',
    confirmedBy: 'user',
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
  const initialBlock = `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  const sourceTemplate = `# ${recordId}\n\nMust Not Count As Completion: exit code only, stdout, HTTP 200, page render, and mock calls cannot satisfy readiness.\n\n\`\`\`yaml\n${initialBlock}\n\`\`\`\n\n\`\`\`mermaid\nsequenceDiagram\n  actor User\n  participant MainAgent\n  User->>MainAgent: Confirm readiness scope [MUST-001][NEG-001][EVD-001][TRACE-001][ACC-001][E2E-001]\n  MainAgent-->>User: Block semantic drift [NEG-001][EVD-001]\n\`\`\`\n\n## Reverse Audit Report\n\nVerdict: PASS\n\n### implementationConfirmation Findings\n### HTML Confirmation Findings\n### Reconfirmation Findings\n### ID Reference Findings\n### Diagram And Step Findings\n### Artifact Automation Plan Findings\n### traceRows Findings\n### Row Quality Findings\n### E2E Anti-Smoke Findings\n### Open Findings\n\n## Definition of Done\n\n- Implementation readiness auto-remediation creates only non-semantic expected-red proof before dispatch.\n`;
  const implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
  confirmation.implementationConfirmationHash = implementationConfirmationHash;
  const finalBlock = `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  const sourceHashInput = sourceTemplate.replace(initialBlock, finalBlock);
  const sourceDocumentHash = sourceDocumentHashFor(sourceHashInput, finalBlock, confirmation);
  const confirmationPageHash = sha256Text(
    `confirmation:${sourceDocumentHash}:${implementationConfirmationHash}`
  );
  confirmation.sourceDocumentHash = sourceDocumentHash;
  confirmation.confirmationRender = {
    ...(confirmation.confirmationRender as Record<string, unknown>),
    htmlPath: htmlPath.replace(/\\/gu, '/'),
    summaryPath: summaryPath.replace(/\\/gu, '/'),
    reportPath: renderReportPath.replace(/\\/gu, '/'),
    htmlHash: confirmationPageHash,
    confirmationPhrase: `确认以上范围进入下一阶段\nsourceDocumentHash=${sourceDocumentHash}\nimplementationConfirmationHash=${implementationConfirmationHash}\nconfirmationPageHash=${confirmationPageHash}`,
  };
  const confirmedBlock = `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  const sourceText = sourceTemplate.replace(initialBlock, confirmedBlock);
  writeText(sourcePath, sourceText);
  writeText(htmlPath, '<!doctype html><title>confirmation</title>');
  writeText(summaryPath, '{}\n');
  writeJson(renderReportPath, {
    recordId,
    requirementSetId: recordId,
    sourcePath: sourcePath.replace(/\\/gu, '/'),
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    actualHtmlFileHash: confirmationPageHash,
    generatedAt: '2026-05-26T00:00:00.000Z',
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
    confirmInstruction: (confirmation.confirmationRender as Record<string, unknown>)
      .confirmationPhrase,
    artifactRef: { path: htmlPath.replace(/\\/gu, '/'), hash: confirmationPageHash },
  });
  writeJson(drilldownReportPath, {
    schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
    sourceDocumentHash,
    implementationConfirmationHash,
    verdict: 'PASS',
    confirmability: 'confirmable',
    failedChecks: [],
    criticalAuditor: {
      consecutiveNoNewGapRounds: 3,
    },
    packetSourceReconciliation: {
      verdict: 'pass',
    },
  });
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'requirement-record.json'
  );
  writeJson(recordPath, {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId: recordId,
    flow: 'standalone_tasks',
    stage: 'implement',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    runId: recordId,
    status: 'user_confirmed',
    sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId,
        requirementSetId: recordId,
        confirmedAt: '2026-05-26T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath,
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationPageHash,
        confirmationText: (confirmation.confirmationRender as Record<string, unknown>)
          .confirmationPhrase,
        renderReportPath: (confirmation.confirmationRender as Record<string, unknown>).reportPath,
        htmlPath: (confirmation.confirmationRender as Record<string, unknown>).htmlPath,
      },
    ],
    contractSummary: { openQuestions: [] },
    gateChecks: [],
    contractChecks: [],
    artifactIndex: [],
    extensionRefs: [],
  });
  writeJson(path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'), {
    schemaVersion: 'requirement-record-index/v1',
    activeRequirementSetId: recordId,
    records: [
      {
        recordId,
        requirementSetId: recordId,
        recordPath,
        sourcePath,
        status: 'user_confirmed',
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: recordId,
      },
    ],
  });
  writeRuntimeRecordContext(root, recordId, recordPath, sourcePath);
  return { sourcePath, recordPath, testPath, reportPath };
}

describe('main-agent readiness auto remediation lane', () => {
  it('does not let missing architecture state block dispatch when architecture confirmation is not required', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-readiness-projection-'));
    try {
      const { recordPath } = makeSourceFixture(root, { missingCommandFile: true });
      expect(
        mainImplementationReadinessGate([
          '--requirement-record',
          recordPath,
          '--implementation-run-kind',
          'first-implementation',
          '--evaluated-at',
          '2026-05-26T00:00:01.000Z',
        ])
      ).toBe(1);

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId: 'REQ-AUTO-REMEDIATE',
        flow: 'standalone_tasks',
        stage: 'implement',
      });

      expect(surface.mainAgentNextAction).toBe('dispatch_remediation');
      expect(surface.runtimeResumeProjection?.blockingReasonRefs).not.toContainEqual(
        expect.objectContaining({ sourceType: 'architecture_confirmation' })
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('auto-remediates non-semantic readiness blockers, records receipt, reruns gate, then allows implementation dispatch', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-readiness-auto-remediate-'));
    try {
      const { recordPath, testPath, reportPath } = makeSourceFixture(root, {
        missingCommandFile: true,
      });
      expect(fs.existsSync(testPath)).toBe(false);
      expect(
        mainImplementationReadinessGate([
          '--requirement-record',
          recordPath,
          '--implementation-run-kind',
          'first-implementation',
          '--evaluated-at',
          '2026-05-26T00:00:01.000Z',
        ])
      ).toBe(1);

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        recordId: 'REQ-AUTO-REMEDIATE',
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        args: {
          implementationRunKind: 'first-implementation',
          readinessReportPath: reportPath,
        },
      });

      expect(result.status).toBe('completed');
      expect(result.steps.map((step) => step.step)).toContain('readiness-auto-remediation');
      expect(fs.existsSync(testPath)).toBe(true);
      const testText = fs.readFileSync(testPath, 'utf8');
      expect(testText).toContain('expected red');
      expect(testText).not.toMatch(/\bskip\b/u);

      const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      expect(record.aiTddContractGate).toEqual(
        expect.objectContaining({
          requirementPreImplementationPlan: expect.objectContaining({
            schemaVersion: 'ai-tdd-requirement-pre-implementation-plan/v1',
            status: 'ready_for_expected_red_validation',
            acceptanceIds: expect.arrayContaining(['ACC-001', 'E2E-001']),
            requiredProofPolicy: 'controlled_red_proof_or_execute_red_proof_only',
            recordedBy: 'main-agent-readiness-auto-remediation',
          }),
          preImplementationRedProofs: expect.arrayContaining([
            expect.objectContaining({
              acceptanceId: 'ACC-001',
              state: 'expected_red',
              proofSource: 'main_agent_readiness_auto_remediation',
            }),
          ]),
        })
      );
      expect(record.contractChecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: 'contract_check_recorded',
            contract: 'ai_tdd_pre_implementation_red_proof',
            decision: 'pass',
          }),
        ])
      );
      expect(record.gateChecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            gate: 'Implementation Readiness Gate',
            decision: 'pass',
          }),
        ])
      );
      expect(record.extensionRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            artifactType: 'readiness_auto_remediation_receipt',
          }),
        ])
      );
      expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_implement');
      expect(result.finalSurface.mainAgentReady).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('auto-remediates uniquely derivable projection gaps through controlled overlay without mutating source', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-readiness-unique-overlay-'));
    try {
      const { recordPath, sourcePath, reportPath } = makeSourceFixture(root, {
        uniqueProjectionGap: true,
      });
      const beforeSource = fs.readFileSync(sourcePath, 'utf8');
      expect(beforeSource).toContain('"covers": []');
      expect(
        mainImplementationReadinessGate([
          '--requirement-record',
          recordPath,
          '--implementation-run-kind',
          'first-implementation',
          '--evaluated-at',
          '2026-05-26T00:00:01.000Z',
        ])
      ).toBe(1);

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        recordId: 'REQ-AUTO-REMEDIATE',
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        args: {
          implementationRunKind: 'first-implementation',
          readinessReportPath: reportPath,
        },
      });

      expect(result.status).toBe('completed');
      const afterSource = fs.readFileSync(sourcePath, 'utf8');
      expect(afterSource).toBe(beforeSource);
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      expect(record.aiTddContractGate).toEqual(
        expect.objectContaining({
          readinessAutoRemediationOverlay: expect.objectContaining({
            schemaVersion: 'readiness-auto-remediation-overlay/v1',
            sourceMutationPolicy: 'non_semantic_projection_only',
            acceptanceBindings: expect.arrayContaining([
              expect.objectContaining({ id: 'ACC-001', covers: ['MUST-001'] }),
              expect.objectContaining({ id: 'E2E-001', covers: ['NEG-001'] }),
            ]),
          }),
        })
      );
      expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_implement');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks semantic readiness gaps instead of auto-changing confirmed requirement semantics', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-readiness-semantic-gap-'));
    try {
      const { recordPath } = makeSourceFixture(root, { semanticGap: true });
      expect(
        mainImplementationReadinessGate([
          '--requirement-record',
          recordPath,
          '--implementation-run-kind',
          'first-implementation',
          '--evaluated-at',
          '2026-05-26T00:00:01.000Z',
        ])
      ).toBe(1);

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        recordId: 'REQ-SEMANTIC-GAP',
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        args: {
          implementationRunKind: 'first-implementation',
        },
      });

      expect(result.status).toBe('blocked');
      expect(result.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            step: 'readiness-auto-remediation',
            status: 'fail',
          }),
        ])
      );
      expect(result.finalSurface.mainAgentNextAction).toBe('await_user');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks projection gaps when the current ID graph is not uniquely derivable', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-readiness-ambiguous-overlay-'));
    try {
      const { recordPath, sourcePath, reportPath } = makeSourceFixture(root, {
        ambiguousProjectionGap: true,
      });
      const beforeSource = fs.readFileSync(sourcePath, 'utf8');
      expect(
        mainImplementationReadinessGate([
          '--requirement-record',
          recordPath,
          '--implementation-run-kind',
          'first-implementation',
          '--evaluated-at',
          '2026-05-26T00:00:01.000Z',
        ])
      ).toBe(1);

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        recordId: 'REQ-AUTO-REMEDIATE',
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        args: {
          implementationRunKind: 'first-implementation',
          readinessReportPath: reportPath,
        },
      });

      expect(result.status).toBe('blocked');
      expect(fs.readFileSync(sourcePath, 'utf8')).toBe(beforeSource);
      expect(result.taskReport?.driftFlags).toEqual(
        expect.arrayContaining([
          'trace_closure_requirement_refs_missing',
          'trace_binding_incomplete',
        ])
      );
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      expect(record.aiTddContractGate).not.toEqual(
        expect.objectContaining({
          readinessAutoRemediationOverlay: expect.anything(),
        })
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
