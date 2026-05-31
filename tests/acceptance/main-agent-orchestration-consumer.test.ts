import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  CompiledPromptRef,
  ExecutionPacket,
  RecommendationPacket,
} from '../../scripts/orchestration-dispatch-contract';
import { packetArtifactPath } from '../../scripts/orchestration-dispatch-contract';
import {
  buildMainAgentDispatchInstruction,
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  invalidateMainAgentPendingPacket,
  mainMainAgentOrchestration,
  runMainAgentControlledReadinessAudit,
  runMainAgentAutomaticLoop,
  runMainAgentAutomaticLoopAsync,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
  writeMainAgentRunLoopTaskReport,
} from '../../scripts/main-agent-orchestration';
import { runUnifiedIngressAsync } from '../../scripts/main-agent-unified-ingress';
import { mainImplementationReadinessGate } from '../../scripts/main-agent-implementation-readiness-gate';
import {
  createDefaultOrchestrationState,
  writeOrchestrationState,
} from '../../scripts/orchestration-state';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { resolveBmadHelpRuntimePolicy } from '../../scripts/bmad-config';
import { runAuditorHost } from '../../scripts/run-auditor-host';
import { writeMinimalRequirementRecordContext } from '../helpers/runtime-registry-fixture';
import type { ImplementationEntryGate } from '../../scripts/runtime-governance';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';

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

function writePacket(
  root: string,
  sessionId: string,
  packet: RecommendationPacket | ExecutionPacket
): string {
  const packetPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'packets',
    sessionId,
    `${packet.packetId}.json`
  );
  mkdirSync(path.dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, JSON.stringify(packet, null, 2), 'utf8');
  return packetPath;
}

function writeTextFixture(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function writeJsonFixture(filePath: string, value: unknown): void {
  writeTextFixture(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function removeTempRoot(root: string): void {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

function copyCriticalAuditorConfig(root: string): void {
  for (const relativePath of [
    path.join('_bmad', '_config', 'audit-item-mapping.yaml'),
    path.join('_bmad', '_config', 'code-reviewer-config.yaml'),
  ]) {
    writeTextFixture(path.join(root, relativePath), readFileSync(relativePath, 'utf8'));
  }
}

function writeCurrentCompiledImplementPacket(
  root: string,
  record: Record<string, unknown>,
  packetId = 'implement-completed'
): { packetPath: string; compiledPromptRef: CompiledPromptRef } {
  const requirementSetId = String(record.requirementSetId);
  const traceDir = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'trace-execution',
    packetId
  );
  const modelPacketPath = path.join(traceDir, 'model_packet.json');
  const humanPromptPath = path.join(traceDir, 'human_prompt.txt');
  const auditReceiptPath = path.join(traceDir, 'audit_receipt.json');
  const goalExecutionPath = path.join(traceDir, 'goal_execution.md');
  writeJsonFixture(modelPacketPath, {
    schemaVersion: 'model-packet-fixture/v1',
    sourceDocumentHash: record.sourceDocumentHash,
    implementationConfirmationHash: record.implementationConfirmationHash,
  });
  writeTextFixture(humanPromptPath, 'compiled prompt fixture\n');
  writeTextFixture(goalExecutionPath, '# goal fixture\n');
  writeJsonFixture(auditReceiptPath, {
    decision: 'pass',
    goalCommand: {
      mode: 'native_goal_document_ref',
      documentHash: sha256Text(readFileSync(goalExecutionPath, 'utf8')),
    },
  });
  const compiledPromptRef: CompiledPromptRef = {
    modelPacketPath,
    modelPacketHash: sha256Text(readFileSync(modelPacketPath, 'utf8')),
    humanPromptPath,
    humanPromptHash: sha256Text(readFileSync(humanPromptPath, 'utf8')),
    auditReceiptPath,
    auditReceiptHash: sha256Text(readFileSync(auditReceiptPath, 'utf8')),
    goalExecutionPath,
    goalExecutionHash: sha256Text(readFileSync(goalExecutionPath, 'utf8')),
    sourceDocumentHash: String(record.sourceDocumentHash),
    implementationConfirmationHash: String(record.implementationConfirmationHash),
  };
  const packet: ExecutionPacket = {
    packetId,
    parentSessionId: requirementSetId,
    flow: 'standalone_tasks',
    phase: 'implement',
    taskType: 'implement',
    role: 'implementation-worker',
    inputArtifacts: [String(record.sourcePath ?? record.artifactPath ?? 'docs/requirements.md')],
    allowedWriteScope: ['src/**', 'tests/**', 'docs/**', '_bmad-output/**'],
    expectedDelta: 'fixture implementation packet',
    successCriteria: ['compiledPromptRef exists'],
    stopConditions: ['true blocker'],
    authorityMode: 'compiled_implementation_confirmation',
    compiledPromptRef,
    executionStrategy: {
      eventType: 'execution_strategy_selected',
      strategyId: 'compiled_trace_direct',
      availability: 'available',
      selectedBy: 'policy',
      strategyOptionsHash: sha256Text('fixture-options'),
      selectedOptionHash: sha256Text('fixture-option'),
      modelPacketHash: compiledPromptRef.modelPacketHash,
      sourceDocumentHash: compiledPromptRef.sourceDocumentHash,
      implementationConfirmationHash: compiledPromptRef.implementationConfirmationHash,
    },
  };
  const packetPath = packetArtifactPath(root, requirementSetId, packetId);
  writeJsonFixture(packetPath, packet);
  return { packetPath, compiledPromptRef };
}

function writeConfirmedReadinessRecord(root: string): string {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const recordPath = writeMinimalRequirementRecordContext(root, {
    flow: 'standalone_tasks',
    stage: 'implement',
    runId: 'readiness-e2e',
    artifactPath: 'docs/requirements/readiness.md',
    implementationEntryGate: {
      gateName: 'implementation-readiness',
      requestedFlow: 'standalone_tasks',
      recommendedFlow: 'standalone_tasks',
      decision: 'pass',
      readinessStatus: 'ready_clean',
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
      semanticFingerprint: 'docs/requirements/readiness.md',
      evaluatedAt: '2026-05-20T00:00:00.000Z',
    },
  });
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  const recordRoot = path.dirname(recordPath);
  const sourcePath = path.join(root, 'docs', 'requirements', 'readiness.md');
  const acceptancePath = path.join(root, 'tests', 'acceptance', 'readiness-bridge.test.ts');
  const e2ePath = path.join(root, 'tests', 'e2e', 'readiness-bridge.e2e.test.ts');
  const confirmationDir = path.join(recordRoot, 'confirmation');
  const renderReportPath = path.join(confirmationDir, 'report.json');
  const htmlPath = path.join(confirmationDir, 'confirmation.html');
  const summaryPath = path.join(confirmationDir, 'confirmation-summary.json');
  const drilldownReportPath = path.join(
    recordRoot,
    'authoring',
    'pre-render-must-decomposition-gate-report.json'
  );
  writeTextFixture(
    acceptancePath,
    'import { it, expect } from "vitest"; it("expected red bridge acceptance", () => { expect(true).toBe(false); });\n'
  );
  writeTextFixture(
    e2ePath,
    'import { it, expect } from "vitest"; it("expected red bridge e2e", () => { expect(true).toBe(false); });\n'
  );
  const confirmation: Record<string, unknown> = {
    contractSchemaVersion: 1,
    status: 'user_confirmed',
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    confirmationLanguage: 'zh-CN',
    confirmationProfile: 'implementation_confirmation',
    requiredViewPacks: ['currentTargetMap'],
    optionalViewPacks: [],
    confirmedAt: '2026-05-20T00:00:00.000Z',
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
    applicability: {
      currentTargetMap: { applies: true },
      aiTddContractGate: { applies: true },
    },
    must: [
      {
        id: 'MUST-001',
        text: 'Controlled readiness audit must activate current baseline metadata only after readiness gate passes.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: ['TRACE-001'],
      },
    ],
    notDone: [
      {
        id: 'NEG-001',
        text: 'Record-only readiness cannot activate baseline metadata.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: ['TRACE-001'],
        oracle:
          'readiness baseline activation requires gate evidence and controlled audit metadata',
      },
    ],
    mustNot: [
      {
        id: 'OUT-001',
        text: 'Implementation completion evidence is out of scope for readiness audit.',
      },
    ],
    evidence: [
      {
        id: 'EVD-001',
        text: 'Readiness audit bridge evidence.',
        gate: 'Implementation Readiness Gate',
        oracle: 'controlled readiness audit records current baseline metadata after pass',
        requiredCommandRefs: ['CMD-001', 'CMD-002'],
        artifactRefs: ['ART-001'],
      },
    ],
    traceRows: [
      {
        id: 'TRACE-001',
        covers: ['MUST-001', 'NEG-001'],
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
        title: 'Record-only readiness baseline activation',
        trigger: 'Gate evidence is absent.',
        expectedBehavior: 'Block readiness baseline activation.',
        forbiddenBehavior: 'Activate current metadata from record status alone.',
        linkedNegIds: ['NEG-001'],
        linkedEvidenceIds: ['EVD-001'],
        viewRefs: ['EDGEVIEW-001'],
      },
    ],
    edgeCases: [
      {
        id: 'EDGE-001',
        category: 'readiness_bridge',
        condition: 'Controlled audit bridge is requested after readiness pass.',
        expectedBehavior: 'Record current baseline metadata.',
        forbiddenBehavior: 'Use stale or record-only baseline metadata.',
        linkedFailurePathIds: ['FAIL-001'],
        linkedEvidenceIds: ['EVD-001'],
        viewRefs: ['EDGEVIEW-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: `npx vitest run ${acceptancePath.replace(/\\/gu, '/')}`,
        oracle: 'expected-red bridge acceptance fails before implementation',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
      {
        id: 'CMD-002',
        command: `npx vitest run ${e2ePath.replace(/\\/gu, '/')}`,
        oracle: 'expected-red bridge e2e fails before implementation',
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
        oracle: 'expected-red bridge acceptance fails before implementation',
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
        oracle: 'expected-red bridge e2e fails before implementation',
      },
    ],
    sequenceViews: [
      { id: 'SEQ-001', title: 'Readiness bridge sequence', covers: ['MUST-001', 'NEG-001'] },
    ],
    flowViews: [
      { id: 'FLOW-001', title: 'Readiness bridge flow', covers: ['MUST-001', 'NEG-001'] },
    ],
    edgeCaseViews: [
      {
        id: 'EDGEVIEW-001',
        title: 'Readiness bridge edge',
        covers: ['NEG-001'],
        cases: ['EDGE-001', 'FAIL-001'],
      },
    ],
    boundaryViews: [
      { id: 'BOUNDARY-001', title: 'Readiness bridge boundary', covers: ['OUT-001'] },
    ],
    artifactAutomationPlan: [
      {
        id: 'ART-001',
        artifactType: 'code',
        path: 'scripts/main-agent-orchestration.ts',
        producer: 'main-agent-orchestration',
        sourceOfTruthRole: 'implementation',
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
          text: 'Readiness audit bridge requires current metadata.',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      targetSummary: [
        {
          id: 'TAR-001',
          text: 'Current baseline metadata is recorded after gate pass.',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      diffRows: [
        {
          id: 'DIFF-001',
          current: 'record-only baseline',
          target: 'controlled readiness baseline',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      process: [
        {
          id: 'PROC-001',
          from: 'readiness-pass',
          to: 'baseline-current',
          action: 'run controlled readiness audit bridge',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      artifactPaths: [
        {
          id: 'PATH-001',
          path: 'scripts/main-agent-orchestration.ts',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      canonicalArtifacts: [
        {
          id: 'ART-001',
          targetPathOrField: 'scripts/main-agent-orchestration.ts',
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
      currentAttemptPolicy: 'current baseline metadata requires controlled audit',
      recordClosedPolicy: 'readiness baseline is not closeout evidence',
    },
    targetModificationPaths: [
      {
        id: 'TARGET-MOD-001',
        path: 'scripts/main-agent-orchestration.ts',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        artifactRefs: ['ART-001'],
      },
    ],
  };
  const initialBlock = `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  const sourceTemplate = `# Readiness Bridge\n\nMust Not Count As Completion: exit code only, stdout, HTTP 200, page render, and mock calls cannot satisfy readiness.\n\n\`\`\`yaml\n${initialBlock}\n\`\`\`\n\n\`\`\`mermaid\nsequenceDiagram\n  actor User\n  participant Gate\n  User->>Gate: Confirm readiness bridge [MUST-001][NEG-001][EVD-001][TRACE-001][ACC-001][E2E-001]\n  Gate-->>User: Block record-only baseline [NEG-001][EVD-001]\n\`\`\`\n\n## Reverse Audit Report\n\nVerdict: PASS\n\n### implementationConfirmation Findings\n### HTML Confirmation Findings\n### Reconfirmation Findings\n### ID Reference Findings\n### Diagram And Step Findings\n### Artifact Automation Plan Findings\n### traceRows Findings\n### Row Quality Findings\n### E2E Anti-Smoke Findings\n### Open Findings\n\n## Definition of Done\n\n- Controlled readiness audit records current baseline metadata only after readiness gate pass.\n`;
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
    htmlHash: confirmationPageHash,
    confirmationPhrase: `确认以上范围进入下一阶段\nsourceDocumentHash=${sourceDocumentHash}\nimplementationConfirmationHash=${implementationConfirmationHash}\nconfirmationPageHash=${confirmationPageHash}`,
  };
  const confirmedBlock = `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  writeTextFixture(sourcePath, sourceTemplate.replace(initialBlock, confirmedBlock));
  writeTextFixture(htmlPath, '<!doctype html><title>confirmation</title>');
  writeJsonFixture(summaryPath, {});
  writeJsonFixture(renderReportPath, {
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    sourcePath: sourcePath.replace(/\\/gu, '/'),
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    actualHtmlFileHash: confirmationPageHash,
    generatedAt: '2026-05-20T00:00:00.000Z',
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
  writeJsonFixture(drilldownReportPath, {
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
  record.sourcePath = sourcePath;
  record.artifactPath = sourcePath;
  record.sourceDocumentHash = sourceDocumentHash;
  record.implementationConfirmationHash = implementationConfirmationHash;
  record.confirmationPageHash = confirmationPageHash;
  record.aiTddContractGate = {
    preImplementationRedProofs: [
      {
        proofId: 'readiness-bridge-proof-acc',
        acceptanceId: 'ACC-001',
        commandId: 'CMD-001',
        state: 'expected_red',
        oracle: 'expected-red bridge acceptance fails before implementation',
        failureClass: 'oracle_failure',
        recordedAt: '2026-05-20T00:00:00.000Z',
        recordedBy: 'test-fixture',
      },
      {
        proofId: 'readiness-bridge-proof-e2e',
        acceptanceId: 'E2E-001',
        commandId: 'CMD-002',
        state: 'expected_red',
        oracle: 'expected-red bridge e2e fails before implementation',
        failureClass: 'oracle_failure',
        recordedAt: '2026-05-20T00:00:00.000Z',
        recordedBy: 'test-fixture',
      },
    ],
  };
  record.confirmationHistory = [
    {
      eventType: 'confirmation_recorded',
      recordId: record.recordId,
      requirementSetId: record.requirementSetId,
      confirmedAt: '2026-05-20T00:00:00.000Z',
      confirmedBy: 'user',
      sourcePath: record.sourcePath,
      sourceDocumentHash: record.sourceDocumentHash,
      implementationConfirmationHash: record.implementationConfirmationHash,
      confirmationPageHash: record.confirmationPageHash,
      confirmationText: (confirmation.confirmationRender as Record<string, unknown>)
        .confirmationPhrase,
      renderReportPath,
      htmlPath,
    },
  ];
  record.runtimePolicySnapshotRef = {
    eventType: 'artifact_indexed',
    artifactType: 'runtime_policy_snapshot',
    sourceOfTruthRole: 'control',
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    path: record.runtimePolicySnapshotRef.path,
    contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    producer: 'test-fixture',
    purpose: 'runtime policy snapshot fixture',
    relatedRequirementIds: ['readiness-e2e'],
    status: 'active',
    inputVersion: 'test',
    outputVersion: 'test',
  };
  record.architectureConfirmationState = {
    ...record.architectureConfirmationState,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    staleInputs: {
      ...(record.architectureConfirmationState.staleInputs ?? {}),
      sourceDocumentHash: record.sourceDocumentHash,
      implementationConfirmationHash: record.implementationConfirmationHash,
    },
  };
  record.architectureConfirmationStateChecks = [
    {
      eventType: 'architecture_confirmation_state_checked',
      checkId: 'architecture-state:readiness-e2e',
      decision: 'pass',
      resolvedRecipeHash: recipe.resolvedRecipeHash,
      stateTransition: {
        fromStatus: 'active',
        toStatus: 'active',
        reasonCode: 'hash_match',
        previousHashes: {},
        currentHashes: {
          sourceDocumentHash: record.sourceDocumentHash,
          implementationConfirmationHash: record.implementationConfirmationHash,
          architectureConfirmationHash:
            record.architectureConfirmationState.currentArchitectureConfirmationHash,
          resolvedRecipeHash: recipe.resolvedRecipeHash,
        },
        mismatchFields: [],
        recipeVersion: 'architecture-confirmation-hash/v1',
      },
      checkedAt: '2026-05-20T00:00:00.500Z',
      checkedBy: 'test',
    },
  ];
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return recordPath;
}

describe('main-agent orchestration consumer', () => {
  it('projects the current six-model stage and next action for user-facing command output', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-stage-summary-'));
    try {
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'story',
        stage: 'implement',
        runId: 'stage-summary',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'story',
          recommendedFlow: 'story',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'stage-summary',
          evaluatedAt: '2026-05-29T00:00:00.000Z',
        },
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      record.currentMentalModel = 'implementation_readiness';
      record.sixModelResults = {
        requirement_confirmation: { model: 'requirement_confirmation', status: 'pass' },
        architecture_confirmation: { model: 'architecture_confirmation', status: 'pass' },
        implementation_readiness: {
          model: 'implementation_readiness',
          status: 'pass',
          blockingReasons: [],
        },
        execution_closure: {
          model: 'execution_closure',
          status: 'not_established',
          blockingReasons: ['execution_closure_not_established'],
        },
        audit_review: {
          model: 'audit_review',
          status: 'not_established',
          blockingReasons: ['audit_review_not_established'],
        },
        delivery_confirmation: {
          model: 'delivery_confirmation',
          status: 'not_established',
          blockingReasons: ['delivery_confirmation_not_established'],
        },
      };
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(surface.mainAgentStageSummary).toMatchObject({
        schemaVersion: 'main-agent-stage-summary/v1',
        recordId: record.recordId,
        currentMentalModel: 'implementation_readiness',
        currentMentalModelStatus: 'pass',
        currentStageOrdinal: 3,
        nextAction: 'dispatch_implement',
        nextMentalModel: 'execution_closure',
        ready: true,
        blocked: false,
      });
      expect(surface.mainAgentStageSummary?.userFacingMessage).toContain(
        'implementation_readiness'
      );
      expect(surface.mainAgentStageSummary?.userFacingMessage).toContain('dispatch_implement');
    } finally {
      removeTempRoot(root);
    }
  });

  it('runs controlled readiness audit through scoring bridge and records current baseline metadata', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-readiness-bridge-'));
    try {
      const recordPath = writeConfirmedReadinessRecord(root);
      const gateCode = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-20T00:00:01.000Z',
        '--json',
      ]);
      expect(gateCode).toBe(0);
      let surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(surface.diagnostics.map((item) => item.category)).not.toContain(
        'repairable_readiness_audit_required'
      );
      expect(surface.drift).toMatchObject({
        effectiveVerdict: 'approved',
        baselineSource: 'requirement_metadata',
      });

      const result = await runMainAgentControlledReadinessAudit(root, {});

      expect(result.scoreRecord.stage).toBe('implementation_readiness');
      expect(result.scoreRecord.scenario).toBe('real_dev');
      expect(result.scoringRecordPath.replace(/\\/g, '/')).toContain('/_bmad-output/scoring/');
      expect(
        existsSync(path.join(root, 'packages', 'scoring', 'data', `${result.scoringRunId}.json`))
      ).toBe(false);
      expect(result.scoreRecord.tool_trace_ref).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(result.scoreRecord.tool_trace_path).toContain('readiness-audit');
      expect(result.scoreRecord.dimension_scores?.map((item) => item.dimension)).toEqual([
        'P0 Journey Coverage',
        'Smoke E2E Readiness',
        'Evidence Proof Chain',
        'Cross-Document Traceability',
      ]);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.readinessBaselineMetadata).toMatchObject({
        status: 'current',
        scoringRunId: result.scoringRunId,
        scoringRecordPath: path.relative(root, result.scoringRecordPath).replace(/\\/g, '/'),
        scoringRecordHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        auditTraceHash: result.scoreRecord.tool_trace_ref,
      });
      expect(record.readinessBaselineMetadata.readinessAuditManifestPath).toBe(
        '_bmad-output/runtime/requirement-records/REQSET-readiness-e2e/readiness-audit/manifest.json'
      );
      expect(record.readinessBaselineMetadata.readinessAuditManifestHash).toMatch(
        /^sha256:[a-f0-9]{64}$/u
      );
      expect(record.readinessScoringRecords.at(-1)).toMatchObject({
        stage: 'implementation_readiness',
        scenario: 'real_dev',
        scoringRunId: result.scoringRunId,
        scoringRecordHash: record.readinessBaselineMetadata.scoringRecordHash,
      });
      const manifestPath = path.join(
        root,
        record.readinessBaselineMetadata.readinessAuditManifestPath
      );
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      expect(manifest).toMatchObject({
        recordId: 'REQ-readiness-e2e',
        requirementSetId: 'REQSET-readiness-e2e',
        scoringRunId: result.scoringRunId,
        baselineId: result.baselineId,
        scoringRecordPath: path.relative(root, result.scoringRecordPath).replace(/\\/g, '/'),
        scoringRecordHash: record.readinessBaselineMetadata.scoringRecordHash,
      });
      surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(surface.drift).toMatchObject({
        effectiveVerdict: 'approved',
        readinessBaselineRunId: result.scoringRunId,
        baselineSource: 'requirement_metadata',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 40000);

  it('dispatches implementation and does not project review before execution closure pass', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-readiness-auto-baseline-'));
    try {
      const recordPath = writeConfirmedReadinessRecord(root);
      const dataPath = path.join(root, '_bmad-output', 'scoring');
      const gateCode = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-20T00:00:01.000Z',
        '--json',
      ]);
      expect(gateCode).toBe(0);
      const before = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(before.diagnostics.map((item) => item.category)).not.toContain(
        'repairable_readiness_audit_required'
      );
      expect(before.drift).toMatchObject({
        effectiveVerdict: 'approved',
        baselineSource: 'requirement_metadata',
      });

      const result = await runMainAgentAutomaticLoopAsync({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        args: { dataPath },
        executor: ({ instruction }) => ({
          packetId: instruction.packetId,
          status: 'done',
          filesChanged: [],
          validationsRun: ['main-agent-run-loop:implementation-fixture'],
          evidence: ['requirement-record:readinessBaselineMetadata.status=current'],
          downstreamContext: [
            'implementation readiness passed; task report is execution iteration evidence only',
          ],
        }),
      });

      expect(result.status).toBe('completed');
      expect(result.dispatchInstruction?.nextAction).toBe('dispatch_implement');
      expect(result.finalSurface.mainAgentNextAction).toBe('run_execution_closure_gate');
      expect(result.finalSurface.diagnostics.map((item) => item.category)).not.toContain(
        'repairable_readiness_audit_required'
      );
      expect(result.finalSurface.diagnostics.some((item) => item.nextCommand)).toBe(false);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.readinessBaselineMetadata).toMatchObject({
        status: 'current',
      });
      expect(record).not.toHaveProperty('readinessBaselineActivation');
    } finally {
      removeTempRoot(root);
    }
  }, 40000);

  it('auto-activates readiness baseline through unified ingress high-level entry', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-readiness-unified-baseline-'));
    try {
      const recordPath = writeConfirmedReadinessRecord(root);
      const gateCode = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-20T00:00:01.000Z',
        '--json',
      ]);
      expect(gateCode).toBe(0);

      const receipt = await runUnifiedIngressAsync({
        projectRoot: root,
        recordId: 'REQ-readiness-e2e',
        requirementSetId: 'REQSET-readiness-e2e',
        hostKind: 'cursor',
        flow: 'standalone_tasks',
        stage: 'implement',
        forceNoHooks: true,
      });

      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('completed');
      expect(receipt.runLoop.finalNextAction).toBe('run_execution_closure_gate');
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.readinessBaselineMetadata).toMatchObject({
        status: 'current',
      });
    } finally {
      removeTempRoot(root);
    }
  }, 40000);

  it('maps closeout pass with no pending packet to completed_no_dispatch without legacy baseline blocker', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-completed-no-dispatch-'));
    try {
      writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'completed-no-dispatch',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'standalone_tasks',
          recommendedFlow: 'standalone_tasks',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'completed-no-dispatch',
          evaluatedAt: '2026-05-20T00:00:00.000Z',
        },
      });
      const index = JSON.parse(
        readFileSync(
          path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'),
          'utf8'
        )
      );
      const recordPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        index.active.requirementSetId,
        'requirement-record.json'
      );
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      record.closeout = {
        currentAttemptId: 'closeout-pass-001',
        decision: 'pass',
        updatedAt: '2026-05-20T00:01:00.000Z',
        attempts: [
          {
            eventType: 'closeout_check_recorded',
            closeoutAttemptId: 'closeout-pass-001',
            decision: 'pass',
          },
        ],
      };
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
      });

      expect(surface.mainAgentNextAction).toBeNull();
      expect(surface.mainAgentReady).toBe(false);
      expect(surface.runtimeResumeProjection?.terminalState).toBe('completed_no_dispatch');
      expect(surface.diagnostics.map((item) => item.category)).toContain('completed_no_dispatch');
      expect(surface.drift?.effectiveVerdict).not.toBe('blocked_pending_rereadiness');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('observes legacy orchestration-state but derives dispatch authority from requirement record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-orch-state-'));
    try {
      const sessionId = 'story-14.1';
      const packet: RecommendationPacket = {
        packetId: 'pkt-main-agent-01',
        parentSessionId: sessionId,
        flow: 'story',
        phase: 'implement',
        recommendedRole: 'remediation-worker',
        recommendedTaskType: 'remediate',
        inputArtifacts: ['spec.md'],
        allowedWriteScope: ['src/**', 'tests/**'],
        expectedDelta: 'repair readiness blockers',
        successCriteria: ['rerun gate can pass'],
        stopConditions: ['true blocker detected'],
      };
      const packetPath = writePacket(root, sessionId, packet);
      writeMinimalRequirementRecordContext(root, {
        flow: 'story',
        stage: 'implement',
        storyId: '14.5',
        runId: 'run-14-5',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'story',
          recommendedFlow: 'story',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'run-14-5',
          evaluatedAt: '2026-05-19T00:00:00.000Z',
        },
      });
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.1',
          runId: 'run-14-1',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.1',
          updatedAt: new Date().toISOString(),
        })
      );
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId,
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
          pendingPacket: {
            packetId: packet.packetId,
            packetPath,
            packetKind: 'recommendation',
            status: 'ready_for_main_agent',
            createdAt: new Date().toISOString(),
          },
        })
      );

      const state = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(state.source).toBe('requirement_record');
      expect(state.sessionId).toBe(sessionId);
      expect(state.pendingPacketStatus).toBe('ready_for_main_agent');
      expect(state.pendingPacket).toMatchObject({
        packetId: packet.packetId,
        recommendedTaskType: 'remediate',
      });
      expect(state.runtimeResumeProjection).toMatchObject({
        source: 'requirement_record',
        observedLegacyState: {
          nextAction: 'dispatch_remediation',
          pendingPacketStatus: 'ready_for_main_agent',
        },
      });
      expect(state.latestGate?.decision).toBe('auto_repairable_block');
      expect(state.mainAgentNextAction).toBe('dispatch_implement');
      expect(state.mainAgentReady).toBe(true);

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(policy.mainAgentOrchestration.source).toBe('requirement_record');
      expect(policy.mainAgentOrchestration.pendingPacketStatus).toBe('ready_for_main_agent');
      expect(policy.helpRouting.mainAgentOrchestration.pendingPacketStatus).toBe(
        'ready_for_main_agent'
      );
      expect(policy.mainAgentNextAction).toBe('dispatch_implement');
      expect(policy.mainAgentReady).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('invalidates stale post-audit run-closeout state after current confirmation until compiled implementation prompt exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-stale-closeout-state-'));
    try {
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'stale-closeout-state',
        artifactPath: 'docs/requirements/stale-closeout-state.md',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'standalone_tasks',
          recommendedFlow: 'standalone_tasks',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'stale-closeout-state',
          evaluatedAt: '2026-05-30T00:00:00.000Z',
        },
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      record.currentMentalModel = 'implementation_readiness';
      record.lastEventType = 'confirmation_recorded';
      record.confirmationHistory = [
        {
          eventType: 'confirmation_recorded',
          sourceDocumentHash: record.sourceDocumentHash,
          implementationConfirmationHash: record.implementationConfirmationHash,
          confirmationPageHash: record.confirmationPageHash,
        },
      ];
      record.sixModelResults = {
        requirement_confirmation: { model: 'requirement_confirmation', status: 'pass' },
        architecture_confirmation: { model: 'architecture_confirmation', status: 'pass' },
        implementation_readiness: {
          model: 'implementation_readiness',
          status: 'pass',
          blockingReasons: [],
        },
        execution_closure: {
          model: 'execution_closure',
          status: 'not_established',
          blockingReasons: ['execution_closure_not_established'],
        },
        audit_review: {
          model: 'audit_review',
          status: 'not_established',
          blockingReasons: ['audit_review_not_established'],
        },
        delivery_confirmation: {
          model: 'delivery_confirmation',
          status: 'not_established',
          blockingReasons: ['delivery_confirmation_not_established'],
        },
      };
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const sessionId = String(record.requirementSetId);
      const stalePacket: ExecutionPacket = {
        packetId: 'audit-stale-completed',
        parentSessionId: sessionId,
        flow: 'standalone_tasks',
        phase: 'post_audit',
        taskType: 'audit',
        role: 'code-reviewer',
        inputArtifacts: [recordPath],
        allowedWriteScope: ['docs/**', '_bmad-output/**'],
        expectedDelta: 'old audit',
        successCriteria: ['old audit done'],
        stopConditions: ['true blocker'],
        authorityMode: 'legacy_generic_prompt',
        compiledPromptRef: null,
        legacyPromptFallbackReason: 'no_confirmed_source',
      };
      const stalePacketPath = writePacket(root, sessionId, stalePacket);
      const staleState = createDefaultOrchestrationState({
        sessionId,
        host: 'codex',
        flow: 'standalone_tasks',
        currentPhase: 'post_audit',
        nextAction: 'run_closeout',
        pendingPacket: {
          packetId: stalePacket.packetId,
          packetPath: stalePacketPath,
          packetKind: 'execution',
          status: 'completed',
          createdAt: '2026-05-29T00:00:00.000Z',
        },
      });
      staleState.lastTaskReport = {
        packetId: stalePacket.packetId,
        status: 'done',
        filesChanged: [],
        validationsRun: ['legacy audit'],
        evidence: ['legacy audit prose pass'],
      };
      writeOrchestrationState(root, staleState);

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'post_audit',
      });

      expect(surface.source).toBe('requirement_record');
      expect(surface.mainAgentNextAction).toBe('dispatch_implement');
      expect(surface.mainAgentReady).toBe(true);
      expect(surface.mainAgentStageSummary).toMatchObject({
        currentMentalModel: 'implementation_readiness',
        currentMentalModelStatus: 'pass',
        nextAction: 'dispatch_implement',
        nextMentalModel: 'execution_closure',
      });
      expect(surface.runtimeResumeProjection).toMatchObject({
        observedLegacyState: {
          nextAction: 'run_closeout',
          pendingPacketStatus: 'completed',
        },
      });
      expect(surface.runtimeResumeProjection?.blockingReasonRefs).toContainEqual({
        sourceType: 'compiled_prompt_ref',
        id: 'missing_current_hash_compiledPromptRef',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects compiled prompt refs that are not bound to the current confirmed hashes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-stale-compiled-ref-'));
    try {
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'stale-compiled-ref',
        artifactPath: 'docs/requirements/stale-compiled-ref.md',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'standalone_tasks',
          recommendedFlow: 'standalone_tasks',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'stale-compiled-ref',
          evaluatedAt: '2026-05-30T00:00:00.000Z',
        },
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      record.currentMentalModel = 'implementation_readiness';
      record.lastEventType = 'confirmation_recorded';
      record.confirmationHistory = [
        {
          eventType: 'confirmation_recorded',
          sourceDocumentHash: record.sourceDocumentHash,
          implementationConfirmationHash: record.implementationConfirmationHash,
          confirmationPageHash: record.confirmationPageHash,
        },
      ];
      record.sixModelResults = {
        requirement_confirmation: { model: 'requirement_confirmation', status: 'pass' },
        architecture_confirmation: { model: 'architecture_confirmation', status: 'pass' },
        implementation_readiness: {
          model: 'implementation_readiness',
          status: 'pass',
          blockingReasons: [],
        },
        execution_closure: {
          model: 'execution_closure',
          status: 'not_established',
          blockingReasons: ['execution_closure_not_established'],
        },
      };
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const sessionId = String(record.requirementSetId);
      const staleCompiledPromptPacket: ExecutionPacket = {
        packetId: 'implement-stale-compiled-ref',
        parentSessionId: sessionId,
        flow: 'standalone_tasks',
        phase: 'implementation_readiness',
        taskType: 'implement',
        role: 'implementation-worker',
        inputArtifacts: [recordPath],
        allowedWriteScope: ['src/**', 'tests/**', 'docs/**', '_bmad-output/**'],
        expectedDelta: 'old implementation',
        successCriteria: ['old implementation done'],
        stopConditions: ['true blocker'],
        authorityMode: 'compiled_implementation_confirmation',
        compiledPromptRef: {
          modelPacketPath: 'old/model_packet.json',
          modelPacketHash:
            'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          humanPromptPath: 'old/human_prompt.txt',
          humanPromptHash:
            'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          auditReceiptPath: 'old/audit_receipt.json',
          auditReceiptHash:
            'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          goalExecutionPath: 'old/goal_execution.md',
          goalExecutionHash:
            'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          sourceDocumentHash:
            'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          implementationConfirmationHash: String(record.implementationConfirmationHash),
        },
        legacyPromptFallbackReason: null,
      };
      const packetPath = writePacket(root, sessionId, staleCompiledPromptPacket);
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId,
          host: 'codex',
          flow: 'standalone_tasks',
          currentPhase: 'post_audit',
          nextAction: 'run_closeout',
          pendingPacket: {
            packetId: staleCompiledPromptPacket.packetId,
            packetPath,
            packetKind: 'execution',
            status: 'completed',
            createdAt: '2026-05-29T00:00:00.000Z',
          },
        })
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'post_audit',
      });

      expect(surface.mainAgentNextAction).toBe('dispatch_implement');
      expect(surface.runtimeResumeProjection?.blockingReasonRefs).toContainEqual({
        sourceType: 'compiled_prompt_ref',
        id: 'missing_current_hash_compiledPromptRef',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores unrelated completed global orchestration state for an explicit requirement-set dispatch plan', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-explicit-record-dispatch-'));
    try {
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'req-trace-packet-compiler',
        artifactPath:
          'docs/requirements/2026-05-25-req-trace-matrix-ai-tdd-execution-packet-compiler.md',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'standalone_tasks',
          recommendedFlow: 'standalone_tasks',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'req-trace-packet-compiler',
          evaluatedAt: '2026-05-26T00:00:00.000Z',
        },
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      const staleSessionId = 'story-story-1-eval-system-scoring-core';
      const stalePacket: RecommendationPacket = {
        packetId: 'audit-stale-completed',
        parentSessionId: staleSessionId,
        flow: 'story',
        phase: 'implement',
        recommendedRole: 'code-reviewer',
        recommendedTaskType: 'audit',
        inputArtifacts: [],
        allowedWriteScope: ['scripts/**'],
        expectedDelta: 'old story audit packet',
        successCriteria: ['old story task report returned'],
        stopConditions: ['old story blocker detected'],
      };
      const stalePacketPath = writePacket(root, staleSessionId, stalePacket);
      const staleState = createDefaultOrchestrationState({
        sessionId: staleSessionId,
        host: 'cursor',
        flow: 'story',
        currentPhase: 'implement',
        nextAction: 'await_user',
        pendingPacket: {
          packetId: stalePacket.packetId,
          packetPath: stalePacketPath,
          packetKind: 'execution',
          status: 'completed',
          createdAt: '2026-04-27T21:08:38.570Z',
        },
      });
      staleState.lastTaskReport = {
        packetId: stalePacket.packetId,
        status: 'done',
        filesChanged: [],
        validationsRun: ['legacy-story-audit'],
        evidence: ['legacy-story-report'],
      };
      writeJsonFixture(
        path.join(
          root,
          '_bmad-output',
          'runtime',
          'governance',
          'orchestration-state',
          `${staleSessionId}.json`
        ),
        staleState
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
      });

      expect(surface.source).toBe('requirement_record');
      expect(surface.sessionId).toBeNull();
      expect(surface.pendingPacketStatus).toBe('none');
      expect(surface.mainAgentNextAction).toBe('dispatch_implement');
      expect(surface.mainAgentReady).toBe(true);

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
        host: 'codex',
        hydratePacket: true,
      });
      if (!instruction) {
        throw new Error('expected explicit requirement dispatch instruction');
      }
      expect(instruction.nextAction).toBe('dispatch_implement');
      expect(instruction.sessionId).toBe(record.requirementSetId);
      expect(instruction.packetPath.replace(/\\/g, '/')).toContain(
        `${record.requirementSetId}/prompts/prompt-packets/implement-`
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not reuse blocked invalidated implementation state to dispatch review for an explicit requirement-set', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-blocked-state-recovery-'));
    try {
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'blocked-implementation-recovery',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'standalone_tasks',
          recommendedFlow: 'standalone_tasks',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'blocked-implementation-recovery',
          evaluatedAt: '2026-05-26T00:00:00.000Z',
        },
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      const packet: RecommendationPacket = {
        packetId: 'implement-blocked',
        parentSessionId: String(record.requirementSetId),
        flow: 'standalone_tasks',
        phase: 'implement',
        recommendedRole: 'implementation-worker',
        recommendedTaskType: 'implement',
        inputArtifacts: [recordPath],
        allowedWriteScope: ['scripts/**'],
        expectedDelta: 'blocked implementation packet',
        successCriteria: ['should be regenerated'],
        stopConditions: ['true blocker detected'],
      };
      const packetPath = writePacket(root, String(record.requirementSetId), packet);
      const state = createDefaultOrchestrationState({
        sessionId: String(record.requirementSetId),
        host: 'codex',
        flow: 'standalone_tasks',
        currentPhase: 'implement',
        nextAction: 'dispatch_review',
        pendingPacket: {
          packetId: packet.packetId,
          packetPath,
          packetKind: 'execution',
          status: 'invalidated',
          createdAt: '2026-05-26T00:00:00.000Z',
        },
      });
      state.lastTaskReport = {
        packetId: packet.packetId,
        status: 'blocked',
        filesChanged: [],
        validationsRun: ['codex-worker-adapter'],
        evidence: ['codex did not produce task report'],
      };
      writeJsonFixture(
        path.join(
          path.dirname(recordPath),
          'orchestration',
          'orchestration-state',
          `${record.requirementSetId}.json`
        ),
        state
      );

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
        host: 'codex',
        hydratePacket: true,
      });

      expect(instruction?.nextAction).toBe('dispatch_implement');
      expect(instruction?.taskType).toBe('implement');
      expect(instruction?.packetId).toMatch(/^implement-/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to audit write scope when active mapping lacks allowedWriteScope', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-audit-scope-fallback-'));
    try {
      copyCriticalAuditorConfig(root);
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'audit-scope-fallback',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'standalone_tasks',
          recommendedFlow: 'standalone_tasks',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'audit-scope-fallback',
          evaluatedAt: '2026-05-26T00:00:00.000Z',
        },
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      record.sixModelResults = {
        execution_closure: { model: 'execution_closure', status: 'pass' },
        audit_review: { model: 'audit_review', status: 'not_established' },
      };
      record.taskBindings = [
        {
          flow: 'standalone_tasks',
          runId: record.runId,
          allowedWriteScope: [],
        },
      ];
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      const { packetPath: completedPacketPath } = writeCurrentCompiledImplementPacket(
        root,
        record,
        'implement-completed'
      );
      writeJsonFixture(
        path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'),
        {
          version: 1,
          updatedAt: '2026-05-26T00:00:00.000Z',
          source: '_bmad-output/runtime/requirement-records/index.json',
          items: [
            {
              requirementId: record.requirementSetId,
              sourceType: 'controlled_requirement_record',
              flow: 'standalone_tasks',
              status: 'user_confirmed',
              recordId: record.recordId,
              requirementSetId: record.requirementSetId,
              recordPath: path.relative(root, recordPath).replace(/\\/g, '/'),
            },
          ],
        }
      );
      const state = createDefaultOrchestrationState({
        sessionId: String(record.requirementSetId),
        host: 'codex',
        flow: 'standalone_tasks',
        currentPhase: 'implement',
        nextAction: 'dispatch_review',
        pendingPacket: {
          packetId: 'implement-completed',
          packetPath: completedPacketPath,
          packetKind: 'execution',
          status: 'completed',
          createdAt: '2026-05-26T00:00:00.000Z',
        },
      });
      state.lastTaskReport = {
        packetId: 'implement-completed',
        status: 'done',
        filesChanged: [],
        validationsRun: ['fixture'],
        evidence: ['fixture'],
      };
      writeOrchestrationState(root, state);

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
        host: 'codex',
        hydratePacket: true,
      });

      expect(instruction?.nextAction).toBe('dispatch_review');
      expect(instruction?.taskType).toBe('audit');
      expect(instruction).not.toBeNull();
      const packet = JSON.parse(readFileSync(instruction!.packetPath, 'utf8')) as ExecutionPacket;
      expect(packet.allowedWriteScope).toEqual(['docs/**', '_bmad-output/**', 'specs/**']);
    } finally {
      removeTempRoot(root);
    }
  });

  it('does not reuse ready audit packet after a blocked implement report for an explicit requirement-set', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-blocked-ready-audit-recovery-'));
    try {
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'blocked-ready-audit-recovery',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'standalone_tasks',
          recommendedFlow: 'standalone_tasks',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'blocked-ready-audit-recovery',
          evaluatedAt: '2026-05-26T00:00:00.000Z',
        },
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      const auditPacket: ExecutionPacket = {
        packetId: 'audit-stale-ready',
        parentSessionId: String(record.requirementSetId),
        flow: 'standalone_tasks',
        phase: 'implement',
        taskType: 'audit',
        role: 'code-reviewer',
        inputArtifacts: [recordPath],
        allowedWriteScope: ['scripts/**'],
        expectedDelta: 'stale audit packet created after a blocked implementation',
        successCriteria: ['must not be reused'],
        stopConditions: ['true blocker detected'],
      };
      const packetPath = writePacket(root, String(record.requirementSetId), auditPacket);
      const state = createDefaultOrchestrationState({
        sessionId: String(record.requirementSetId),
        host: 'codex',
        flow: 'standalone_tasks',
        currentPhase: 'implement',
        nextAction: 'dispatch_review',
        pendingPacket: {
          packetId: auditPacket.packetId,
          packetPath,
          packetKind: 'execution',
          status: 'ready_for_main_agent',
          createdAt: '2026-05-26T00:00:00.000Z',
        },
      });
      state.lastTaskReport = {
        packetId: 'implement-blocked-before-audit',
        status: 'blocked',
        filesChanged: [],
        validationsRun: ['codex-worker-adapter'],
        evidence: ['codex did not produce task report'],
      };
      writeJsonFixture(
        path.join(
          path.dirname(recordPath),
          'orchestration',
          'orchestration-state',
          `${record.requirementSetId}.json`
        ),
        state
      );

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
        host: 'codex',
        hydratePacket: true,
      });

      expect(instruction?.nextAction).toBe('dispatch_implement');
      expect(instruction?.taskType).toBe('implement');
      expect(instruction?.packetId).toMatch(/^implement-/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('drives the packet lifecycle through claim, dispatch, complete, and invalidate transitions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-packet-lifecycle-'));
    try {
      const sessionId = 'bugfix-run-01';
      const packet: RecommendationPacket = {
        packetId: 'pkt-bugfix-01',
        parentSessionId: sessionId,
        flow: 'bugfix',
        phase: 'implement',
        recommendedRole: 'remediation-worker',
        recommendedTaskType: 'remediate',
        inputArtifacts: ['BUGFIX_demo.md'],
        allowedWriteScope: ['src/**'],
        expectedDelta: 'repair bugfix blockers',
        successCriteria: ['bugfix audit passes'],
        stopConditions: ['true blocker detected'],
      };
      const packetPath = writePacket(root, sessionId, packet);
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId,
          host: 'claude',
          flow: 'bugfix',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
          pendingPacket: {
            packetId: packet.packetId,
            packetPath,
            packetKind: 'recommendation',
            status: 'ready_for_main_agent',
            createdAt: new Date().toISOString(),
          },
        })
      );

      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).source
      ).toBe('orchestration_state');
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('ready_for_main_agent');

      claimMainAgentPendingPacket(root, sessionId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('claimed_by_main_agent');

      markMainAgentPacketDispatched(root, sessionId, packet.packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('dispatched');

      completeMainAgentPendingPacket(root, sessionId, packet.packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('completed');

      invalidateMainAgentPendingPacket(root, sessionId, packet.packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('invalidated');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exposes a repo-native CLI surface for main-agent packet lifecycle operations', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-cli-surface-'));
    try {
      const sessionId = 'story-14.5';
      const packet: RecommendationPacket = {
        packetId: 'pkt-cli-01',
        parentSessionId: sessionId,
        flow: 'story',
        phase: 'implement',
        recommendedRole: 'remediation-worker',
        recommendedTaskType: 'remediate',
        inputArtifacts: ['spec.md'],
        allowedWriteScope: ['src/**'],
        expectedDelta: 'repair blockers',
        successCriteria: ['gate can rerun'],
        stopConditions: ['true blocker detected'],
      };
      const packetPath = writePacket(root, sessionId, packet);
      writeMinimalRequirementRecordContext(root, {
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        storyId: '14.5',
        runId: 'run-14-5',
      });
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId,
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
          pendingPacket: {
            packetId: packet.packetId,
            packetPath,
            packetKind: 'recommendation',
            status: 'ready_for_main_agent',
            createdAt: new Date().toISOString(),
          },
        })
      );

      expect(mainMainAgentOrchestration(['--cwd', root, '--action', 'claim'])).toBe(0);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('claimed_by_main_agent');

      expect(mainMainAgentOrchestration(['--cwd', root, '--action', 'dispatch'])).toBe(0);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('dispatched');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads implementation-entry gate from requirement record when no explicit gate is passed in', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-registry-gate-'));
    try {
      const implementationEntryGate: ImplementationEntryGate = {
        gateName: 'implementation-readiness',
        requestedFlow: 'story',
        recommendedFlow: 'story',
        decision: 'reroute',
        readinessStatus: 'repair_closed',
        blockerCodes: ['manual-reroute'],
        blockerSummary: ['This run must return to the user before continuing.'],
        rerouteRequired: true,
        rerouteReason: 'manual-reroute',
        evidenceSources: {
          readinessReportPath: null,
          remediationArtifactPath: null,
          executionRecordPath: null,
          authoritativeAuditReportPath: null,
        },
        semanticFingerprint: 'run-14-3',
        evaluatedAt: new Date().toISOString(),
      };
      writeMinimalRequirementRecordContext(root, {
        flow: 'story',
        stage: 'implement',
        storyId: '14.3',
        runId: 'run-14-3',
        artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.3',
        implementationEntryGate,
      });

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(surface.source).toBe('requirement_record');
      expect(surface.mainAgentNextAction).toBe('await_user');
      expect(surface.mainAgentReady).toBe(false);
      expect(surface.latestGate?.decision).toBe('reroute');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not dispatch new implementation packets after a requirement record is closed', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-record-closed-'));
    try {
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'run-closed-loop',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'standalone_tasks',
          recommendedFlow: 'standalone_tasks',
          decision: 'pass',
          readinessStatus: 'ready_clean',
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
          semanticFingerprint: 'run-closed-loop',
          evaluatedAt: '2026-05-21T00:00:00.000Z',
        },
      });
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      writeFileSync(
        recordPath,
        `${JSON.stringify(
          {
            ...record,
            lastEventType: 'record_closed',
            closeout: {
              currentAttemptId: 'closeout-attempt-current',
              decision: 'pass',
              blockingReasons: [],
              attempts: [
                {
                  closeoutAttemptId: 'closeout-attempt-current',
                  decision: 'pass',
                  blockingReasons: [],
                },
              ],
            },
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const packet: RecommendationPacket = {
        packetId: 'pkt-stale-implement',
        parentSessionId: 'REQSET-run-closed-loop',
        flow: 'standalone_tasks',
        phase: 'implement',
        recommendedRole: 'implementation-worker',
        recommendedTaskType: 'implement',
        inputArtifacts: [recordPath],
        allowedWriteScope: ['scripts/**'],
        expectedDelta: 'stale implement packet',
        successCriteria: ['should not run'],
        stopConditions: ['record already closed'],
      };
      const packetPath = writePacket(root, 'REQSET-run-closed-loop', packet);
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId: 'REQSET-run-closed-loop',
          host: 'cursor',
          flow: 'standalone_tasks',
          currentPhase: 'implement',
          nextAction: 'dispatch_implement',
          pendingPacket: {
            packetId: packet.packetId,
            packetPath,
            packetKind: 'recommendation',
            status: 'ready_for_main_agent',
            createdAt: '2026-05-21T00:00:00.000Z',
          },
        })
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
      });

      expect(surface.source).toBe('requirement_record');
      expect(surface.pendingPacketStatus).toBe('ready_for_main_agent');
      expect(surface.mainAgentNextAction).toBeNull();
      expect(surface.mainAgentReady).toBe(false);
      expect(surface.runtimeResumeProjection).toMatchObject({
        runtimeNextAction: null,
        ready: false,
      });

      const dispatchExit = mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'dispatch-plan',
        '--record-id',
        String(record.recordId),
        '--requirement-set-id',
        String(record.requirementSetId),
      ]);
      expect(dispatchExit).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses fourSignal and gatesLoop to block continuation even when the stored nextAction looks runnable', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-four-signal-loop-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.4',
          runId: 'run-14-4',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.4',
          updatedAt: new Date().toISOString(),
        })
      );
      writeOrchestrationState(root, {
        version: 1,
        sessionId: 'run-14-4',
        host: 'cursor',
        flow: 'story',
        currentPhase: 'implement',
        nextAction: 'dispatch_implement',
        pendingPacket: null,
        originalExecutionPacketId: null,
        fourSignal: {
          latestStatus: 'block',
          latestHits: ['smoke_task_chain'],
          driftDetected: true,
          missingEvidence: false,
        },
        latestGate: {
          gateId: 'implementation-readiness',
          decision: 'pass',
          reason: 'readiness previously passed',
        },
        gatesLoop: {
          retryCount: 2,
          maxRetries: 3,
          noProgressCount: 2,
          circuitOpen: true,
          rerunGate: 'implementation-readiness',
          activePacketId: 'pkt-loop-01',
          lastResult: 'no-progress',
        },
        closeout: {
          invoked: false,
          approved: false,
          scoreWriteResult: null,
          handoffPersisted: false,
          resultCode: null,
        },
      });

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(surface.fourSignal?.latestStatus).toBe('block');
      expect(surface.gatesLoop?.circuitOpen).toBe(true);
      expect(surface.mainAgentCanContinue).toBe(false);
      expect(surface.continueDecision).toBe('blocked');
      expect(surface.mainAgentNextAction).toBe('await_user');
      expect(surface.mainAgentReady).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not allow legacy orchestration nextAction to become requirement-record backed projection', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-legacy-next-action-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.9',
          runId: 'run-14-9',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.9',
          updatedAt: new Date().toISOString(),
        })
      );
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId: 'run-14-9',
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_implement',
        })
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'story',
          recommendedFlow: 'story',
          decision: 'block',
          readinessStatus: 'missing',
          blockerCodes: ['missing_requirement_record'],
          blockerSummary: ['Requirement record is missing; legacy nextAction cannot dispatch.'],
          rerouteRequired: false,
          rerouteReason: null,
          evidenceSources: {
            readinessReportPath: null,
            remediationArtifactPath: null,
            executionRecordPath: null,
            authoritativeAuditReportPath: null,
          },
          semanticFingerprint: 'run-14-9',
          evaluatedAt: '2026-05-19T00:00:00.000Z',
        },
      });

      expect(surface.source).toBe('implementation_entry_gate');
      expect(surface.mainAgentNextAction).toBe('dispatch_remediation');
      expect(surface.mainAgentReady).toBe(true);
      const instruction = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        implementationEntryGate: null,
      });
      expect(instruction.pendingPacketStatus).toBe('none');
      const after = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        implementationEntryGate: null,
      });
      expect(after.pendingPacketStatus).toBe('none');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps runtime-registry bridge remediation packets authoritative for post-audit run-loop', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-bridge-post-audit-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'post_audit',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'bridge-post-audit',
          runId: 'bridge-post-audit-run',
          artifactRoot: '_bmad-output/implementation-artifacts/bridge/post-audit',
          updatedAt: new Date().toISOString(),
        })
      );

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'post_audit',
        implementationEntryGate: {
          gateName: 'implementation-readiness',
          requestedFlow: 'story',
          recommendedFlow: 'story',
          decision: 'block',
          readinessStatus: 'missing',
          blockerCodes: ['missing_post_audit_evidence'],
          blockerSummary: ['post-audit evidence must be remediated before closeout'],
          rerouteRequired: false,
          rerouteReason: null,
          evidenceSources: {
            readinessReportPath: null,
            remediationArtifactPath: null,
            executionRecordPath: null,
            authoritativeAuditReportPath: null,
          },
          semanticFingerprint: 'bridge-post-audit-run',
          evaluatedAt: '2026-05-23T00:00:00.000Z',
        },
        hydratePacket: true,
      });
      expect(instruction).not.toBeNull();
      expect(instruction?.taskType).toBe('remediate');

      const loop = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'post_audit',
        executor: ({ projectRoot, instruction, args }) => {
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, {
            ...args,
            reportEvidence: 'bridge-post-audit-remediation',
            validationsRun: 'bridge-post-audit-regression',
          });
          return JSON.parse(readFileSync(reportPath, 'utf8'));
        },
      });

      expect(loop.status).toBe('completed');
      expect(loop.dispatchInstruction?.packetId).toBe(instruction?.packetId);
      expect(loop.finalSurface.pendingPacketStatus).toBe('completed');
      expect(loop.finalSurface.mainAgentNextAction).toBe('dispatch_implement');
      expect(loop.taskReport?.evidence).toContain('bridge-post-audit-remediation');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('surfaces raw drift fields from latestReviewerCloseout to the main-agent surface', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-drift-surface-'));
    try {
      const reviewerCloseout = {
        updatedAt: new Date().toISOString(),
        runner: 'runAuditorHost' as const,
        profile: 'bmad-code-reviewer',
        stage: 'implement',
        artifactPath: 'specs/demo/implement.md',
        reportPath: 'specs/demo/implement.audit.md',
        auditStatus: 'PASS' as const,
        closeoutApproved: false,
        governanceClosure: {
          implementationReadinessStatusRequired: true,
          implementationReadinessGateName: 'implementation-readiness',
          gatesLoopRequired: true,
          rerunGatesRequired: true,
          packetExecutionClosureRequired: true,
        },
        closeoutEnvelope: {
          resultCode: 'blocked',
          requiredFixes: [],
          requiredFixesDetail: [],
          rerunDecision: 'rerun',
          scoringFailureMode: 'none',
          packetExecutionClosureStatus: 'closed',
        },
        canMainAgentContinue: false,
        scoreWriteResult: 'ok' as const,
        handoffPersisted: true,
        driftSeverity: 'critical' as const,
        effectiveVerdict: 'blocked',
        driftSignals: ['smoke_task_chain'],
        driftedDimensions: ['Smoke E2E Readiness', 'P0 Journey Coverage'],
        reReadinessRequired: true,
        readinessBaselineRunId: 'readiness-14-2',
      };
      writeMinimalRequirementRecordContext(root, {
        flow: 'story',
        stage: 'post_audit',
        storyId: '14.2',
        runId: 'run-14-2',
        artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.2',
        latestReviewerCloseout: reviewerCloseout,
      });
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'post_audit',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.2',
          runId: 'run-14-2',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.2',
          updatedAt: new Date().toISOString(),
        })
      );

      const artifactDocPath = path.join(root, 'specs', 'demo', 'implement.md');
      const reportPath = path.join(root, 'specs', 'demo', 'implement.audit.md');
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 0',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      await runAuditorHost(
        {
          projectRoot: root,
          reportPath,
          stage: 'implement',
          artifactPath: artifactDocPath,
        },
        {
          scoreCommand: vi.fn().mockResolvedValue({
            parsedRecord: {
              effective_verdict: 'blocked',
              blocking_reason:
                'Critical readiness drift detected against the current implementation baseline.',
              re_readiness_required: true,
              drift_severity: 'critical',
              drift_signals: ['smoke_task_chain'],
              drifted_dimensions: ['Smoke E2E Readiness', 'P0 Journey Coverage'],
              readiness_baseline_run_id: 'readiness-14-2',
            },
          }),
        }
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'post_audit',
      });

      expect(surface.closeout?.driftSeverity).toBe('critical');
      expect(surface.drift).toMatchObject({
        driftSignals: ['smoke_task_chain'],
        driftedDimensions: ['Smoke E2E Readiness', 'P0 Journey Coverage'],
        driftSeverity: 'critical',
        effectiveVerdict: 'blocked',
        reReadinessRequired: true,
        readinessBaselineRunId: 'readiness-14-2',
      });

      const registry = readRuntimeContextRegistry(root);
      expect(registry.latestReviewerCloseout).toMatchObject({
        driftSeverity: 'critical',
        effectiveVerdict: 'blocked',
        driftSignals: ['smoke_task_chain'],
      });

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        flow: 'story',
        stage: 'post_audit',
      });
      expect(policy.mainAgentOrchestration.drift?.driftSignals).toEqual(['smoke_task_chain']);
      expect(policy.helpRouting.mainAgentOrchestration.drift?.effectiveVerdict).toBe('blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
