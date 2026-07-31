import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as yaml from 'js-yaml';
import type {
  ExecutionPacket,
  RecommendationPacket,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-dispatch-contract';
import {
  type AuditJudgeExecutor,
  buildMainAgentDispatchInstruction,
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  invalidateMainAgentPendingPacket,
  mainMainAgentOrchestration,
  runMainAgentControlledReadinessAudit,
  runMainAgentAutomaticLoop,
  runMainAgentAutomaticLoopAsync,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
  writeMainAgentRunLoopTaskReport,
  resolveMainAgentJudgeReviewCampaignBridge,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { runUnifiedIngressAsync } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-unified-ingress';
import { mainImplementationReadinessGate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate';
import {
  requirementsContractPromptTransactionPublishCommand,
  type PromptTransactionPublisherDeps,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher';
import {
  createDefaultOrchestrationState,
  readOrchestrationState,
  writeOrchestrationState,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-state';
import {
  defaultRuntimeContextFile,
  writeRuntimeContext,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context-registry';
import { resolveBmadHelpRuntimePolicy } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/bmad-config';
import { runAuditorHost } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/run-auditor-host';
import { expandSixModelAuthority } from '../helpers/requirement-fixture-runtime';
import {
  createFixtureAuditAdapterCommands,
  createFixtureAuditTriadRound,
} from '../helpers/audit-triad-fixture-runtime';
import { writeMinimalRequirementRecordContext } from '../helpers/runtime-registry-fixture';
import { writePassingSourcePrdLintReport } from '../helpers/source-prd-lint-fixture';
import type { ImplementationEntryGate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-governance';
import { resolveArchitectureConfirmationHashRecipe } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/architecture-confirmation-hash-recipe';
import {
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';
import { prepareAuditDispatchRuntime } from './helpers/prompt-transaction-audit-dispatch-fixture';
import type { ConfirmedRequirementsAuthorityProjection } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmed-authority-projection';
import type { RequirementsContractJudgeReviewCampaignJ06Output } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';
import {
  materializePromptPublicationFixture,
  setPromptPublicationReadiness,
} from './helpers/prompt-transaction-publication-fixture';
import {
  executeRequiredCommandsForPublishedFixture,
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';
import { dispatchPlanAction } from '../../packages/bmad-speckit/src/main-agent/actions/dispatch-plan';

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

function normalizeFixtureJudgeRuntimePolicy(root: string): void {
  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  const config = yaml.load(readFileSync(configPath, 'utf8')) as Record<string, any>;
  const judgeRuntime = config.judgeRuntime as Record<string, any>;
  const activeProviderRef = String(judgeRuntime.activeProviderRef ?? '');
  const providers = judgeRuntime.providers as Record<string, any>;
  const provider = providers[activeProviderRef] as Record<string, any>;
  provider.requestPolicy = provider.requestPolicy ?? judgeRuntime.requestPolicy ?? {
    timeoutMs: 1_800_000,
    maximumAttempts: 1,
    structuredResponseRequired: true,
    maxBudgetUsd: 5,
  };
  delete judgeRuntime.requestPolicy;
  delete judgeRuntime.requirementsConvergence;
  writeFileSync(configPath, `${yaml.dump(config, { lineWidth: -1 })}\n`, 'utf8');
}

function removeTempRoot(root: string): void {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

function attachVerifiedSixModelAuthority(
  record: Record<string, unknown>,
  rawResults: Record<string, unknown>
): void {
  const sixModelAuthority = expandSixModelAuthority({
    rawResults,
    recordId: String(record.recordId),
    requirementSetId: String(record.requirementSetId),
    implementationAttemptId: String(
      record.currentAttemptId ?? record.implementationAttemptId ?? record.runId
    ),
    sourceDocumentHash: String(record.sourceDocumentHash),
    implementationConfirmationHash: String(record.implementationConfirmationHash),
    semanticModelHash: String(record.semanticModelHash),
  });
  record.sixModelResults = sixModelAuthority.sixModelResults;
  record.runtimeStatusDecisionReceipts = sixModelAuthority.runtimeStatusDecisionReceipts;
  record.artifactIndex = sixModelAuthority.artifactIndex;
}

function writeConfirmedReadinessRecord(root: string): string {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const sourcePathRelative = 'tests/fixtures/requirements/readiness.md';
  const recordPath = writeMinimalRequirementRecordContext(root, {
    flow: 'standalone_tasks',
    stage: 'implement',
    runId: 'readiness-e2e',
    artifactPath: sourcePathRelative,
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
      semanticFingerprint: sourcePathRelative,
      evaluatedAt: '2026-05-20T00:00:00.000Z',
    },
  });
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  const recordRoot = path.dirname(recordPath);
  const sourcePath = path.join(root, sourcePathRelative);
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
    reconfirmationRequest: null,
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
        path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
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
          path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      canonicalArtifacts: [
        {
          id: 'ART-001',
          targetPathOrField:
            'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
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
        path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
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
  writePassingSourcePrdLintReport({
    requirementRecordPath: recordPath,
    sourcePath,
  });
  return recordPath;
}

describe('main-agent orchestration consumer', () => {
  it('bridges typed J03 and J05 Judge outputs without caller authority injection', () => {
    const hash = (label: string) => sha256Text(label);
    const requirementsAuthority = {
      schemaVersion: 'requirements-contract-confirmed-authority-projection/v1',
      requirementRecordId: 'REQ-001',
      sourceSnapshotHash: hash('source'),
      implementationConfirmationSemanticHash: hash('implementation-confirmation'),
      controlledConfirmationEventHash: hash('confirmation-event'),
      confirmedAuthorityIdentity: {
        path: 'docs/requirements/source.md',
        semanticHash: hash('identity-semantic'),
        contentHash: hash('identity-content'),
      },
      RequirementsEffectivePassReceiptRef: {
        path: 'receipts/requirements-effective-pass.json',
        schemaVersion: 'requirements-effective-pass-receipt/v1',
        receiptHash: hash('requirements-effective-pass'),
        actorClass: 'requirements_critical_auditor_judge',
        judgeRole: 'requirements_critical_auditor',
        decision: 'pass',
      },
      writerId: 'requirements-confirmation-ingest',
      controlReceiptHash: hash('control-receipt'),
      authorityTupleHash: hash('authority-tuple'),
      projectionHash: hash('projection'),
    } satisfies ConfirmedRequirementsAuthorityProjection;
    const judgeReviewCampaign = {
      schemaVersion: 'requirements-contract-judge-review-campaign-j06-output/v1',
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
      initialReviewAttemptKey: hash('attempt'),
      campaignInputHash: hash('campaign-input'),
      controllerHash: hash('controller'),
      cleanTrace: {
        schemaVersion: 'requirements-contract-judge-review-campaign-j06-trace-output/v1',
        campaignId: 'goal-campaign-001',
        campaignLineageKey: hash('lineage'),
        initialReviewAttemptKey: hash('attempt'),
        mode: 'clean',
        semanticInvocationCount: 2,
        reviewerInvocationCount: 1,
        finalJudgeInvocationCount: 1,
        completeReceiptSet: true,
        traceHash: hash('clean-trace'),
        outputHash: hash('clean-output'),
      },
      remediatedTrace: {
        schemaVersion: 'requirements-contract-judge-review-campaign-j06-trace-output/v1',
        campaignId: 'goal-campaign-001',
        campaignLineageKey: hash('lineage'),
        initialReviewAttemptKey: hash('attempt'),
        mode: 'remediated',
        semanticInvocationCount: 3,
        reviewerInvocationCount: 1,
        finalJudgeInvocationCount: 2,
        completeReceiptSet: true,
        traceHash: hash('remediated-trace'),
        outputHash: hash('remediated-output'),
      },
      cleanSemanticInvocationCount: 2,
      remediatedSemanticInvocationCount: 3,
      reviewerInvocationCount: 1,
      secondReviewerPath: false,
      outputHash: hash('j06-output'),
    } satisfies RequirementsContractJudgeReviewCampaignJ06Output;

    const bridge = resolveMainAgentJudgeReviewCampaignBridge({
      roleInput: 'requirements_judge',
      confirmedRequirementsAuthority: requirementsAuthority,
      judgeReviewCampaign,
      controlledDispatchRef: {
        packetId: 'packet-001',
        packetKind: 'execution',
        route: 'implementation-worker',
      },
    });

    expect(bridge.requirementsAuthorityTupleHash).toBe(requirementsAuthority.authorityTupleHash);
    expect(bridge.judgeReviewCampaignOutputHash).toBe(judgeReviewCampaign.outputHash);
    expect(bridge.directAdapterDispatch).toBe(false);
    expect(bridge.roleInference).toBe(false);
    expect(bridge.callerAuthorityInjection).toBe(false);
    expect(bridge.decision).toBe('pass');
  });

  it('rejects caller verdicts, findings, scope, EffectivePass, and direct adapter dispatch', () => {
    const hash = (label: string) => sha256Text(label);
    const valid = {
      roleInput: 'requirements_judge',
      confirmedRequirementsAuthority: {
        schemaVersion: 'requirements-contract-confirmed-authority-projection/v1',
        requirementRecordId: 'REQ-001',
        sourceSnapshotHash: hash('source'),
        implementationConfirmationSemanticHash: hash('implementation-confirmation'),
        controlledConfirmationEventHash: hash('confirmation-event'),
        confirmedAuthorityIdentity: {
          path: 'docs/requirements/source.md',
          semanticHash: hash('identity-semantic'),
          contentHash: hash('identity-content'),
        },
        RequirementsEffectivePassReceiptRef: {
          path: 'receipts/requirements-effective-pass.json',
          schemaVersion: 'requirements-effective-pass-receipt/v1',
          receiptHash: hash('requirements-effective-pass'),
          actorClass: 'requirements_critical_auditor_judge',
          judgeRole: 'requirements_critical_auditor',
          decision: 'pass',
        },
        writerId: 'requirements-confirmation-ingest',
        controlReceiptHash: hash('control-receipt'),
        authorityTupleHash: hash('authority-tuple'),
        projectionHash: hash('projection'),
      },
      judgeReviewCampaign: {
        schemaVersion: 'requirements-contract-judge-review-campaign-j06-output/v1',
        campaignId: 'goal-campaign-001',
        campaignLineageKey: hash('lineage'),
        initialReviewAttemptKey: hash('attempt'),
        campaignInputHash: hash('campaign-input'),
        controllerHash: hash('controller'),
        cleanTrace: {
          schemaVersion: 'requirements-contract-judge-review-campaign-j06-trace-output/v1',
          campaignId: 'goal-campaign-001',
          campaignLineageKey: hash('lineage'),
          initialReviewAttemptKey: hash('attempt'),
          mode: 'clean',
          semanticInvocationCount: 2,
          reviewerInvocationCount: 1,
          finalJudgeInvocationCount: 1,
          completeReceiptSet: true,
          traceHash: hash('clean-trace'),
          outputHash: hash('clean-output'),
        },
        remediatedTrace: {
          schemaVersion: 'requirements-contract-judge-review-campaign-j06-trace-output/v1',
          campaignId: 'goal-campaign-001',
          campaignLineageKey: hash('lineage'),
          initialReviewAttemptKey: hash('attempt'),
          mode: 'remediated',
          semanticInvocationCount: 3,
          reviewerInvocationCount: 1,
          finalJudgeInvocationCount: 2,
          completeReceiptSet: true,
          traceHash: hash('remediated-trace'),
          outputHash: hash('remediated-output'),
        },
        cleanSemanticInvocationCount: 2,
        remediatedSemanticInvocationCount: 3,
        reviewerInvocationCount: 1,
        secondReviewerPath: false,
        outputHash: hash('j06-output'),
      },
      controlledDispatchRef: {
        packetId: 'packet-001',
        packetKind: 'execution',
        route: 'implementation-worker',
      },
    };

    expect(() =>
      resolveMainAgentJudgeReviewCampaignBridge({ ...valid, callerVerdict: 'pass' })
    ).toThrow('main_agent_judge_bridge_caller_authority_injection');
    expect(() =>
      resolveMainAgentJudgeReviewCampaignBridge({ ...valid, directAdapterDispatch: true })
    ).toThrow('main_agent_judge_bridge_direct_adapter_forbidden');
    expect(() =>
      resolveMainAgentJudgeReviewCampaignBridge({ ...valid, roleInput: null })
    ).toThrow('main_agent_judge_bridge_role_explicit_required');
  });

  it('keeps audit finalization bound to the gate-owned commit snapshot', () => {
    const sourcePath = path.resolve(
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'
    );
    const source = readFileSync(sourcePath, 'utf8');
    const start = source.indexOf('function finalizeAuditControlledExecution(');
    const end = source.indexOf('\nfunction sha256Text(', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const finalizerSource = source.slice(start, end);

    expect(finalizerSource).toContain('gateCommitBundle');
    expect(finalizerSource).not.toContain('readJsonIfExists(');
    expect(finalizerSource).not.toContain('fs.readFileSync(');
    expect(finalizerSource).not.toContain('fs.existsSync(');
    expect(finalizerSource).toContain('loadOrCreateAuditControlledFinalizationIntent');
    expect(finalizerSource.indexOf('loadOrCreateAuditControlledFinalizationIntent')).toBeLessThan(
      finalizerSource.indexOf('mainAuditReviewGate(')
    );
    expect(finalizerSource).toContain('auditControlledTaskReportAlreadyIngested');
    expect(finalizerSource).toContain('markAuditControlledFinalizationCommitted');

    const runLoopStart = source.indexOf('export function runMainAgentAutomaticLoop(');
    const dispatchStart = source.indexOf('const instruction = buildMainAgentDispatchInstruction(', runLoopStart);
    expect(runLoopStart).toBeGreaterThanOrEqual(0);
    expect(dispatchStart).toBeGreaterThan(runLoopStart);
    const preDispatchSource = source.slice(runLoopStart, dispatchStart);
    expect(preDispatchSource).toContain('resumePreparedAuditControlledFinalization');
  });

  it('rejects direct Audit Judge result injection before runtime inspection', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-audit-judge-injection-'));
    let injectedExecutorCalled = false;
    try {
      expect(() =>
        runMainAgentAutomaticLoop({
          projectRoot: root,
          flow: 'standalone_tasks',
          stage: 'implement',
          auditJudgeExecutor: (() => {
            injectedExecutorCalled = true;
            return {};
          }) as AuditJudgeExecutor,
        })
      ).toThrow('audit_judge_result_injection_forbidden');
      expect(injectedExecutorCalled).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects direct Audit Judge result injection at the async entry before project inspection', async () => {
    let projectRootRead = false;
    const input = {
      get projectRoot(): string {
        projectRootRead = true;
        throw new Error('project_root_should_not_be_read');
      },
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      auditJudgeExecutor: (() => ({})) as AuditJudgeExecutor,
    };

    await expect(
      runMainAgentAutomaticLoopAsync(
        input as unknown as Parameters<typeof runMainAgentAutomaticLoopAsync>[0]
      )
    ).rejects.toThrow('audit_judge_result_injection_forbidden');
    expect(projectRootRead).toBe(false);
  });

  it('rejects audit process command override at the async entry before project inspection', async () => {
    let projectRootRead = false;
    const input = {
      get projectRoot(): string {
        projectRootRead = true;
        throw new Error('project_root_should_not_be_read');
      },
      flow: 'standalone_tasks' as const,
      stage: 'implement',
      args: {
        auditJudgeAdapterCommand: JSON.stringify([process.execPath, '-e', 'process.exit(0)']),
      },
    };

    await expect(runMainAgentAutomaticLoopAsync(input)).rejects.toThrow(
      'audit_controlled_executor_command_override_forbidden'
    );
    expect(projectRootRead).toBe(false);
  });

  it.each([
    'auditJudgeAdapterCommand',
    'auditReadonlyAuditorAdapterCommand',
  ] as const)(
    'rejects production audit process command override %s before runtime inspection',
    (argumentName) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-audit-command-override-'));
      try {
        expect(() =>
          runMainAgentAutomaticLoop({
            projectRoot: root,
            flow: 'standalone_tasks',
            stage: 'implement',
            args: {
              [argumentName]: JSON.stringify([process.execPath, '-e', 'process.exit(0)']),
            },
          })
        ).toThrow('audit_controlled_executor_command_override_forbidden');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('returns no-active-requirement surface instead of readiness when no active record exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-no-active-'));
    try {
      mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
      writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'context', 'bootstrap.json'),
        '{"flow":"unknown","stage":"specify"}\n',
        'utf8'
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'specify',
      });
      expect(surface.mainAgentStageSummary).not.toBeNull();
      const stageSummary = surface.mainAgentStageSummary!;

      expect(surface.source).toBe('no_active_requirement');
      expect(surface.mainAgentReady).toBe(false);
      expect(surface.mainAgentCanContinue).toBe(false);
      expect(surface.continueDecision).toBe('blocked');
      expect(surface.mainAgentNextAction).toBe('contract_authoring_required');
      expect(stageSummary.currentMentalModelStatus).toBe('no_active_requirement');
      expect(stageSummary.blockingReasons).toEqual([
        'no_active_requirement',
        'contract_authoring_required',
      ]);
      expect(stageSummary.nextAction).toBe('contract_authoring_required');
      expect(stageSummary.nextAction).not.toBe(
        'run_implementation_readiness_gate'
      );
      expect(surface.diagnostics[0]).toMatchObject({
        category: 'active_requirement',
        repairAction: 'contract_authoring_required',
        automaticRepairAvailable: false,
      });
    } finally {
      removeTempRoot(root);
    }
  });

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
      attachVerifiedSixModelAuthority(record, {
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
      });
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
      removeTempRoot(root);
    }
  }, 40000);

  it('dispatches implementation from published readiness authority without projecting review early', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const recordPath = fixture.paths.recordPath;
      const before = resolveMainAgentOrchestrationSurface({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(before.diagnostics.map((item) => item.category)).not.toContain(
        'repairable_readiness_audit_required'
      );
      expect(before.sixModelRuntimeDecision?.currentModelStatus).toBe('pass');
      expect(before.mainAgentNextAction).toBe('dispatch_implement');
      expect(before.mainAgentReady).toBe(true);

      const result = await runMainAgentAutomaticLoopAsync({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'cursor',
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
      expect(result.status).toBe('blocked');
      expect(
        result.dispatchInstruction,
        JSON.stringify(
          {
            steps: result.steps,
            taskReport: result.taskReport,
            finalNextAction: result.finalSurface.mainAgentNextAction,
          },
          null,
          2
        )
      ).not.toBeNull();
      expect(result.dispatchInstruction!.nextAction).toBe('dispatch_implement');
      expect(result.taskReport?.status).toBe('blocked');
      expect(result.taskReport?.driftFlags).toContain(
        'required-command-receipt-validation-failed'
      );
      expect(result.finalSurface.mainAgentNextAction).not.toBe('dispatch_review');
      expect(result.finalSurface.diagnostics.map((item) => item.category)).not.toContain(
        'repairable_readiness_audit_required'
      );
      expect(result.finalSurface.diagnostics.some((item) => item.nextCommand)).toBe(false);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.sixModelResults.implementation_readiness.status).toBe('pass');
      expect(record.sixModelResults.execution_closure.status).not.toBe('pass');
    } finally {
      fixture.cleanup();
    }
  }, 40000);

  it('consumes published readiness authority through unified ingress high-level entry', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const recordPath = fixture.paths.recordPath;

      const receipt = await runUnifiedIngressAsync({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        hostKind: 'cursor',
        flow: 'standalone_tasks',
        stage: 'implement',
        forceNoHooks: true,
      });

      expect(receipt.controlPlane).toBe('main-agent-orchestration');
      expect(receipt.runLoop.status).toBe('blocked');
      expect(receipt.runLoop.pendingPacketStatus).toBe('invalidated');
      expect(receipt.runLoop.finalNextAction).toBe('dispatch_implement');
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.sixModelResults.implementation_readiness.status).toBe('pass');
      expect(record.sixModelResults.execution_closure.status).not.toBe('pass');
    } finally {
      fixture.cleanup();
    }
  }, 40000);

  it('keeps machine closeout pass awaiting controlled user acceptance', () => {
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
      record.status = 'awaiting_user_acceptance';
      record.currentMentalModel = 'delivery_confirmation';
      record.currentStage = 'delivery_confirmation';
      record.lastEventType = 'delivery_confirmation_user_acceptance_requested';
      record.lastAppliedEventId =
        'delivery_confirmation_user_acceptance_requested:closeout-pass-001';
      record.sixModelResults = {
        ...(record.sixModelResults ?? {}),
        delivery_confirmation: {
          status: 'awaiting_user_acceptance',
          blockingReasons: [],
        },
      };
      record.closeout = {
        currentAttemptId: 'closeout-pass-001',
        decision: 'pass',
        updatedAt: '2026-05-20T00:01:00.000Z',
        acceptanceRequest: {
          status: 'awaiting_user_acceptance',
          closeoutAttemptId: 'closeout-pass-001',
          htmlPath: 'confirmation/closeout-confirmation-current.html',
          renderReportPath: 'confirmation/closeout-confirmation-current.render-report.json',
          closeoutConfirmationPageHash: `sha256:${'c'.repeat(64)}`,
          deliveryCloseoutReportHash: `sha256:${'d'.repeat(64)}`,
        },
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

      expect(surface.mainAgentNextAction).toBe('await_user_acceptance');
      expect(surface.mainAgentReady).toBe(false);
      expect(surface.runtimeResumeProjection?.terminalState).toBeUndefined();
      expect(surface.sixModelRuntimeDecision?.nextAction).toBe('await_user_acceptance');
      expect(surface.diagnostics.map((item) => item.category)).not.toContain(
        'completed_no_dispatch'
      );
    } finally {
      removeTempRoot(root);
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
      removeTempRoot(root);
    }
  });

  it('invalidates stale post-audit run-closeout state after current confirmation until compiled implementation prompt exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-stale-closeout-state-'));
    try {
      const sourcePathRelative = 'tests/fixtures/requirements/stale-closeout-state.md';
      writeTextFixture(
        path.join(root, sourcePathRelative),
        '# Fixture source for stale closeout state\n'
      );
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'stale-closeout-state',
        artifactPath: sourcePathRelative,
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
      attachVerifiedSixModelAuthority(record, {
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
      });
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
      removeTempRoot(root);
    }
  });

  it('rejects compiled prompt refs that are not bound to the current confirmed hashes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-stale-compiled-ref-'));
    try {
      const sourcePathRelative = 'tests/fixtures/requirements/stale-compiled-ref.md';
      writeTextFixture(
        path.join(root, sourcePathRelative),
        '# Fixture source for stale compiled ref\n'
      );
      const recordPath = writeMinimalRequirementRecordContext(root, {
        flow: 'standalone_tasks',
        stage: 'implement',
        runId: 'stale-compiled-ref',
        artifactPath: sourcePathRelative,
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
      attachVerifiedSixModelAuthority(record, {
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
      });
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
      removeTempRoot(root);
    }
  });

  it('ignores unrelated completed global orchestration state for an explicit requirement-set dispatch plan', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const root = fixture.root;
      const recordPath = fixture.paths.recordPath;
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
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
      fixture.cleanup();
    }
  });

  it('does not reuse blocked invalidated implementation state to dispatch review for an explicit requirement-set', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const root = fixture.root;
      const recordPath = fixture.paths.recordPath;
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
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
        validationsRun: ['main-session-execution-preparation'],
        evidence: ['current main session did not produce task report'],
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
      fixture.cleanup();
    }
  });

  it('falls back to audit write scope when active mapping lacks allowedWriteScope', async () => {
    const fixture = materializePromptPublicationFixture();
    try {
      fixture.options.currentDispatchPointer = path.join(
        fixture.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      setPromptPublicationReadiness(fixture, { decision: 'pass' });
      prepareAuditDispatchRuntime(fixture);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);
      const record = JSON.parse(readFileSync(fixture.paths.recordPath, 'utf8'));
      record.taskBindings = [
        {
          flow: 'standalone_tasks',
          runId: record.runId,
          allowedWriteScope: [],
        },
      ];
      writeJsonFixture(fixture.paths.recordPath, record);
      const publisherOutput: string[] = [];
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        publisherOutput.push(String(chunk));
        return true;
      });
      const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
        extraPacket: {
          packetId: fixture.identity.implementationAttemptId,
        },
      }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
      const publishCode = await requirementsContractPromptTransactionPublishCommand(
        fixture.options,
        { runCompiledPrompt }
      ).finally(() => stdout.mockRestore());
      expect(publishCode, publisherOutput.join('')).toBe(0);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: fixture.root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        host: 'codex',
        hydratePacket: true,
        preferredPacketId: 'audit-scope-fallback',
      });

      expect(instruction?.nextAction).toBe('dispatch_review');
      expect(instruction?.taskType).toBe('audit');
      expect(instruction).not.toBeNull();
      const packet = JSON.parse(readFileSync(instruction!.packetPath, 'utf8')) as ExecutionPacket;
      expect(packet.allowedWriteScope).toEqual(['docs/**', '_bmad-output/**', 'specs/**']);
    } finally {
      fixture.cleanup();
    }
  });

  it.skip('legacy injected readonly process failure is replaced by canonical-host negative controls', async () => {
    const fixture = materializePromptPublicationFixture();
    try {
      fixture.options.currentDispatchPointer = path.join(
        fixture.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      setPromptPublicationReadiness(fixture, { decision: 'pass' });
      prepareAuditDispatchRuntime(fixture);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);
      const publisherOutput: string[] = [];
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        publisherOutput.push(String(chunk));
        return true;
      });
      const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
        extraPacket: {
          packetId: fixture.identity.implementationAttemptId,
        },
      }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
      const publishCode = await requirementsContractPromptTransactionPublishCommand(
        fixture.options,
        { runCompiledPrompt }
      ).finally(() => stdout.mockRestore());
      expect(publishCode, publisherOutput.join('')).toBe(0);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);

      const loop = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        args: {
          auditReadonlyAuditorAdapterCommand: JSON.stringify([
            process.execPath,
            '-e',
            'process.exit(23)',
          ]),
        },
      });

      expect(loop.status).toBe('blocked');
      expect(loop.taskReport).toBeNull();
      expect(loop.steps).toContainEqual(
        expect.objectContaining({
          step: 'audit-controlled-executor.readonly-auditor-request',
          status: 'fail',
          summary: expect.stringContaining('audit_readonly_auditor_adapter_failed:23'),
        })
      );
      const packet = loop.dispatchInstruction?.packet as ExecutionPacket;
      const planRef = packet.auditTriadExecutionPlanRef;
      expect(planRef).not.toBeNull();
      const requestPath = path.join(
        path.dirname(planRef!.path),
        'rounds',
        'round-1',
        'readonly-auditor-request.json'
      );
      expect(existsSync(requestPath)).toBe(true);
      expect(JSON.parse(readFileSync(requestPath, 'utf8'))).toMatchObject({
        schemaVersion: 'audit-readonly-auditor-request/v1',
        auditEpochId: packet.auditExecutionProfile?.auditEpochId,
        auditTargetBundleHash: packet.auditExecutionProfile?.auditTargetBundleHash,
        semanticModelHash: packet.auditExecutionProfile?.semanticModelHash,
        projectionSetHash: packet.auditExecutionProfile?.projectionSetHash,
        qualityRuleSetHash: packet.auditExecutionProfile?.qualityRuleSetHash,
        roundIndex: 1,
      });
      const roundDir = path.dirname(requestPath);
      const hostReceiptPath = path.join(
        roundDir,
        'readonly-auditor-host-invocation-receipt.json'
      );
      expect(existsSync(hostReceiptPath)).toBe(true);
      expect(JSON.parse(readFileSync(hostReceiptPath, 'utf8'))).toMatchObject({
        schemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
        roundIndex: 1,
        requestHash: JSON.parse(readFileSync(requestPath, 'utf8')).requestHash,
        exitCode: 23,
        responseProduced: false,
        failureCode: 'audit_readonly_auditor_adapter_failed',
        receiptHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(existsSync(path.join(roundDir, 'readonly-auditor-response.json'))).toBe(false);
      expect(existsSync(path.join(roundDir, 'judge-request.json'))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it.runIf(process.platform === 'win32')(
    'resolves the default readonly Auditor npm shim to its JavaScript entry on Windows',
    async () => {
      const fixture = materializePromptPublicationFixture();
      const originalPath = process.env.PATH;
      try {
        fixture.options.currentDispatchPointer = path.join(
          fixture.root,
          'docs',
          'plans',
          'evidence',
          'loop-engineering-remediation',
          'current-dispatch-pointer-receipt.json'
        );
        setPromptPublicationReadiness(fixture, { decision: 'pass' });
        prepareAuditDispatchRuntime(fixture);
        normalizeFixtureJudgeRuntimePolicy(fixture.root);
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
          extraPacket: {
            packetId: fixture.identity.implementationAttemptId,
          },
        }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
        const publishCode = await requirementsContractPromptTransactionPublishCommand(
          fixture.options,
          { runCompiledPrompt }
        ).finally(() => stdout.mockRestore());
        expect(publishCode).toBe(0);
        normalizeFixtureJudgeRuntimePolicy(fixture.root);

        const fakeBin = path.join(fixture.root, 'readonly-auditor-codex-bin');
        const codexEntry = path.join(
          fakeBin,
          'node_modules',
          '@openai',
          'codex',
          'bin',
          'codex.js'
        );
        mkdirSync(path.dirname(codexEntry), { recursive: true });
        writeFileSync(path.join(fakeBin, 'codex.cmd'), '@exit /b 99\r\n', 'utf8');
        writeFileSync(
          codexEntry,
          "process.stderr.write('readonly-auditor-js-entry-reached'); process.exit(17);\n",
          'utf8'
        );
        process.env.PATH = `${fakeBin}${path.delimiter}${originalPath ?? ''}`;

        const loop = runMainAgentAutomaticLoop({
          projectRoot: fixture.root,
          recordId: fixture.authority.recordId,
          requirementSetId: fixture.identity.requirementSetId,
          runId: fixture.identity.implementationAttemptId,
          flow: 'standalone_tasks',
          stage: 'implement',
          host: 'codex',
        });

        expect(loop.status).toBe('blocked');
        expect(loop.taskReport).toBeNull();
        expect(loop.steps).toContainEqual(
          expect.objectContaining({
            step: 'audit-controlled-executor.readonly-auditor-request',
            status: 'fail',
            summary: expect.stringContaining('audit_readonly_auditor_adapter_failed:17'),
          })
        );
        const packet = loop.dispatchInstruction?.packet as ExecutionPacket;
        const roundDir = path.join(
          path.dirname(packet.auditTriadExecutionPlanRef!.path),
          'rounds',
          'round-1'
        );
        const hostReceipt = JSON.parse(
          readFileSync(
            path.join(roundDir, 'readonly-auditor-host-invocation-receipt.json'),
            'utf8'
          )
        );
        expect(hostReceipt).toMatchObject({
          schemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
          adapterKind: 'codex_exec_readonly',
          exitCode: 17,
          responseProduced: false,
          failureCode: 'audit_readonly_auditor_adapter_failed',
        });
        expect(
          readFileSync(path.join(roundDir, 'readonly-auditor-host.stderr.log'), 'utf8')
        ).toBe('readonly-auditor-js-entry-reached');
        expect(existsSync(path.join(roundDir, 'readonly-auditor-response.json'))).toBe(false);
        expect(existsSync(path.join(roundDir, 'judge-request.json'))).toBe(false);
      } finally {
        process.env.PATH = originalPath;
        fixture.cleanup();
      }
    }
  );

  it.runIf(process.platform === 'win32')(
    'emits a Codex-compatible readonly Auditor output schema',
    async () => {
      const fixture = materializePromptPublicationFixture();
      const originalPath = process.env.PATH;
      try {
        fixture.options.currentDispatchPointer = path.join(
          fixture.root,
          'docs',
          'plans',
          'evidence',
          'loop-engineering-remediation',
          'current-dispatch-pointer-receipt.json'
        );
        setPromptPublicationReadiness(fixture, { decision: 'pass' });
        prepareAuditDispatchRuntime(fixture);
        normalizeFixtureJudgeRuntimePolicy(fixture.root);
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
          extraPacket: {
            packetId: fixture.identity.implementationAttemptId,
          },
        }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
        const publishCode = await requirementsContractPromptTransactionPublishCommand(
          fixture.options,
          { runCompiledPrompt }
        ).finally(() => stdout.mockRestore());
        expect(publishCode).toBe(0);
        normalizeFixtureJudgeRuntimePolicy(fixture.root);

        const fakeBin = path.join(fixture.root, 'readonly-auditor-schema-bin');
        const codexEntry = path.join(
          fakeBin,
          'node_modules',
          '@openai',
          'codex',
          'bin',
          'codex.js'
        );
        mkdirSync(path.dirname(codexEntry), { recursive: true });
        writeFileSync(path.join(fakeBin, 'codex.cmd'), '@exit /b 99\r\n', 'utf8');
        writeFileSync(codexEntry, 'process.exit(17);\n', 'utf8');
        process.env.PATH = `${fakeBin}${path.delimiter}${originalPath ?? ''}`;

        const loop = runMainAgentAutomaticLoop({
          projectRoot: fixture.root,
          recordId: fixture.authority.recordId,
          requirementSetId: fixture.identity.requirementSetId,
          runId: fixture.identity.implementationAttemptId,
          flow: 'standalone_tasks',
          stage: 'implement',
          host: 'codex',
        });
        const packet = loop.dispatchInstruction?.packet as ExecutionPacket;
        const schemaPath = path.join(
          path.dirname(packet.auditTriadExecutionPlanRef!.path),
          'rounds',
          'round-1',
          'readonly-auditor-response.schema.json'
        );
        const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
        const untypedPropertyPaths: string[] = [];
        const unsupportedKeywordPaths: string[] = [];
        const nonStrictObjectPaths: string[] = [];
        const unsupportedKeywords = new Set([
          'minItems',
          'maxItems',
          'uniqueItems',
          'contains',
          'unevaluatedItems',
        ]);
        const inspectSchema = (node: unknown, nodePath: string): void => {
          if (!node || typeof node !== 'object' || Array.isArray(node)) return;
          const record = node as Record<string, unknown>;
          for (const keyword of Object.keys(record)) {
            if (unsupportedKeywords.has(keyword)) {
              unsupportedKeywordPaths.push(`${nodePath}.${keyword}`);
            }
          }
          if (record.type === 'object' && record.additionalProperties !== false) {
            nonStrictObjectPaths.push(nodePath);
          }
          if (record.properties && typeof record.properties === 'object') {
            for (const [name, propertySchema] of Object.entries(
              record.properties as Record<string, unknown>
            )) {
              if (
                !propertySchema ||
                typeof propertySchema !== 'object' ||
                Array.isArray(propertySchema) ||
                typeof (propertySchema as Record<string, unknown>).type !== 'string'
              ) {
                untypedPropertyPaths.push(`${nodePath}.properties.${name}`);
              }
              inspectSchema(propertySchema, `${nodePath}.properties.${name}`);
            }
          }
          inspectSchema(record.items, `${nodePath}.items`);
          for (const [index, variant] of (
            Array.isArray(record.anyOf) ? record.anyOf : []
          ).entries()) {
            inspectSchema(variant, `${nodePath}.anyOf[${index}]`);
          }
        };
        inspectSchema(schema, '$');

        expect(untypedPropertyPaths).toEqual([]);
        expect(unsupportedKeywordPaths).toEqual([]);
        expect(nonStrictObjectPaths).toEqual([]);
      } finally {
        process.env.PATH = originalPath;
        fixture.cleanup();
      }
    }
  );

  it.runIf(process.platform === 'win32')(
    'rejects readonly Auditor stdout when the declared response file was not produced',
    async () => {
      const fixture = materializePromptPublicationFixture();
      const originalPath = process.env.PATH;
      try {
        fixture.options.currentDispatchPointer = path.join(
          fixture.root,
          'docs',
          'plans',
          'evidence',
          'loop-engineering-remediation',
          'current-dispatch-pointer-receipt.json'
        );
        setPromptPublicationReadiness(fixture, { decision: 'pass' });
        prepareAuditDispatchRuntime(fixture);
        normalizeFixtureJudgeRuntimePolicy(fixture.root);
        const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
          extraPacket: {
            packetId: fixture.identity.implementationAttemptId,
          },
        }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
        const publishCode = await requirementsContractPromptTransactionPublishCommand(
          fixture.options,
          { runCompiledPrompt }
        ).finally(() => stdout.mockRestore());
        expect(publishCode).toBe(0);
        normalizeFixtureJudgeRuntimePolicy(fixture.root);

        const fakeBin = path.join(fixture.root, 'readonly-auditor-stdout-only-bin');
        const codexEntry = path.join(
          fakeBin,
          'node_modules',
          '@openai',
          'codex',
          'bin',
          'codex.js'
        );
        mkdirSync(path.dirname(codexEntry), { recursive: true });
        writeFileSync(path.join(fakeBin, 'codex.cmd'), '@exit /b 99\r\n', 'utf8');
        writeFileSync(
          codexEntry,
          [
            "const fs = require('node:fs');",
            'const request = JSON.parse(',
            "  fs.readFileSync(process.env.BMAD_READONLY_AUDITOR_REQUEST_PATH, 'utf8')",
            ');',
            'const assignments = Array.isArray(request.perspectiveAssignments)',
            '  ? request.perspectiveAssignments',
            '  : [];',
            'const perspectiveResults = Object.fromEntries(',
            '  assignments.map((assignment) => [',
            '    assignment.perspectiveId,',
            '    { agentId: `${String(assignment.agentId)}:stdout-only`, validGaps: [] },',
            '  ])',
            ');',
            'const coveredCheckItemIds = [',
            '  ...new Set(',
            '    assignments.flatMap((assignment) =>',
            '      Array.isArray(assignment.requiredCheckItemIds)',
            '        ? assignment.requiredCheckItemIds',
            '        : []',
            '    )',
            '  ),',
            '];',
            'const requiredVetoItemIds = Array.isArray(request.requiredVetoItemIds)',
            '  ? request.requiredVetoItemIds',
            '  : [];',
            'process.stdout.write(JSON.stringify({',
            "  schemaVersion: 'audit-readonly-auditor-response/v1',",
            '  requestHash: request.requestHash,',
            '  auditEpochId: request.auditEpochId,',
            '  auditTargetBundleHash: request.auditTargetBundleHash,',
            '  roundIndex: request.roundIndex,',
            '  perspectiveResults,',
            '  coveredCheckItemIds,',
            '  vetoItemResults: requiredVetoItemIds.map((itemId) => ({ itemId, passed: true })),',
            '  validatedGapRefs: [],',
            '  invalidGapRefs: [],',
            '  checkedProjectionQualityRuleCodes: request.checkedProjectionQualityRuleCodes,',
            "  rationale: 'The readonly process wrote stdout but omitted the declared response file.',",
            '}));',
          ].join('\n'),
          'utf8'
        );
        process.env.PATH = `${fakeBin}${path.delimiter}${originalPath ?? ''}`;

        const result = runMainAgentAutomaticLoop({
          projectRoot: fixture.root,
          recordId: fixture.authority.recordId,
          requirementSetId: fixture.identity.requirementSetId,
          runId: fixture.identity.implementationAttemptId,
          flow: 'standalone_tasks',
          stage: 'implement',
          host: 'codex',
        });
        const packet = result.dispatchInstruction?.packet as ExecutionPacket;
        const roundDir = path.join(
          path.dirname(packet.auditTriadExecutionPlanRef!.path),
          'rounds',
          'round-1'
        );

        expect(result.status).toBe('blocked');
        expect(result.steps).toContainEqual(
          expect.objectContaining({
            step: 'audit-controlled-executor.readonly-auditor-request',
            status: 'fail',
            summary: 'audit_readonly_auditor_response_file_missing',
          })
        );
        expect(existsSync(path.join(roundDir, 'readonly-auditor-response.json'))).toBe(false);
        expect(existsSync(path.join(roundDir, 'judge-request.json'))).toBe(false);
        expect(existsSync(path.join(roundDir, 'audit-triad-round-receipt.json'))).toBe(false);
      } finally {
        process.env.PATH = originalPath;
        fixture.cleanup();
      }
    }
  );

  it.skip('legacy injected missing-veto response is replaced by the real-provider negative journey', async () => {
    const fixture = materializePromptPublicationFixture();
    try {
      fixture.options.currentDispatchPointer = path.join(
        fixture.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      setPromptPublicationReadiness(fixture, { decision: 'pass' });
      prepareAuditDispatchRuntime(fixture);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
        extraPacket: {
          packetId: fixture.identity.implementationAttemptId,
        },
      }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
      const publishCode = await requirementsContractPromptTransactionPublishCommand(
        fixture.options,
        { runCompiledPrompt }
      ).finally(() => stdout.mockRestore());
      expect(publishCode).toBe(0);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);

      const first = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        args: {
          auditReadonlyAuditorAdapterCommand: JSON.stringify([
            process.execPath,
            '-e',
            'process.exit(23)',
          ]),
        },
      });
      const packet = first.dispatchInstruction?.packet as ExecutionPacket;
      const planRef = packet.auditTriadExecutionPlanRef!;
      const roundOneDir = path.join(path.dirname(planRef.path), 'rounds', 'round-1');
      const readonlyRequest = JSON.parse(
        readFileSync(path.join(roundOneDir, 'readonly-auditor-request.json'), 'utf8')
      );
      const readonlyResponseWithoutHash = {
        schemaVersion: 'audit-readonly-auditor-response/v1',
        requestHash: readonlyRequest.requestHash,
        auditEpochId: readonlyRequest.auditEpochId,
        auditTargetBundleHash: readonlyRequest.auditTargetBundleHash,
        roundIndex: 1,
        perspectiveResults: {
          product_intent: { agentId: 'readonly-product-r1', validGaps: [] },
          model_projection: { agentId: 'readonly-model-r1', validGaps: [] },
          main_agent_execution: { agentId: 'readonly-execution-r1', validGaps: [] },
        },
        coveredCheckItemIds: readonlyRequest.perspectiveAssignments[0].requiredCheckItemIds,
        vetoItemResults: [],
        validatedGapRefs: [],
        invalidGapRefs: [],
        checkedProjectionQualityRuleCodes: readonlyRequest.checkedProjectionQualityRuleCodes,
        rationale: 'All assigned perspectives completed without a current valid gap.',
      };
      writeJsonFixture(path.join(roundOneDir, 'readonly-auditor-response.json'), {
        ...readonlyResponseWithoutHash,
        responseHash: sha256Text(stableStringify(readonlyResponseWithoutHash)),
      });

      const second = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
      });

      expect(second.status).toBe('blocked');
      expect(second.taskReport).toBeNull();
      expect(second.steps).toContainEqual(
        expect.objectContaining({
          step: 'audit-controlled-executor.readonly-auditor-request',
          status: 'fail',
          summary: expect.stringMatching(/^audit_readonly_auditor_veto_item_missing:/u),
        })
      );
      const roundReceiptPath = path.join(roundOneDir, 'audit-triad-round-receipt.json');
      expect(existsSync(path.join(roundOneDir, 'judge-request.json'))).toBe(false);
      expect(existsSync(path.join(roundOneDir, 'judge-execution-receipt.json'))).toBe(false);
      expect(existsSync(roundReceiptPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('does not accept a prewritten readonly response and self-signed host receipt as host execution', async () => {
    const fixture = materializePromptPublicationFixture();
    const originalPath = process.env.PATH;
    try {
      fixture.options.currentDispatchPointer = path.join(
        fixture.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      setPromptPublicationReadiness(fixture, { decision: 'pass' });
      prepareAuditDispatchRuntime(fixture);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
        extraPacket: {
          packetId: fixture.identity.implementationAttemptId,
        },
      }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
      const publishCode = await requirementsContractPromptTransactionPublishCommand(
        fixture.options,
        { runCompiledPrompt }
      ).finally(() => stdout.mockRestore());
      expect(publishCode).toBe(0);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);

      const loopInput = {
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks' as const,
        stage: 'implement',
        host: 'codex' as const,
      };
      const emptyPath = path.join(fixture.root, '.test-runtime', 'empty-path');
      mkdirSync(emptyPath, { recursive: true });
      process.env.PATH = emptyPath;
      const first = runMainAgentAutomaticLoop(loopInput);
      const packet = first.dispatchInstruction?.packet as ExecutionPacket;
      const planRef = packet.auditTriadExecutionPlanRef!;
      const roundDir = path.join(path.dirname(planRef.path), 'rounds', 'round-1');
      const requestPath = path.join(roundDir, 'readonly-auditor-request.json');
      const readonlyRequest = JSON.parse(readFileSync(requestPath, 'utf8'));
      const readonlyResponseWithoutHash = {
        schemaVersion: 'audit-readonly-auditor-response/v1',
        requestHash: readonlyRequest.requestHash,
        auditEpochId: readonlyRequest.auditEpochId,
        auditTargetBundleHash: readonlyRequest.auditTargetBundleHash,
        roundIndex: 1,
        perspectiveResults: {
          product_intent: { agentId: 'readonly-product-host-negative', validGaps: [] },
          model_projection: { agentId: 'readonly-model-host-negative', validGaps: [] },
          main_agent_execution: {
            agentId: 'readonly-execution-host-negative',
            validGaps: [],
          },
        },
        coveredCheckItemIds: readonlyRequest.perspectiveAssignments[0].requiredCheckItemIds,
        vetoItemResults: readonlyRequest.requiredVetoItemIds.map((itemId: string) => ({
          itemId,
          passed: true,
        })),
        validatedGapRefs: [],
        invalidGapRefs: [],
        checkedProjectionQualityRuleCodes: readonlyRequest.checkedProjectionQualityRuleCodes,
        rationale: 'Negative control: response file has no producer invocation receipt.',
      };
      const readonlyResponse = {
        ...readonlyResponseWithoutHash,
        responseHash: sha256Text(stableStringify(readonlyResponseWithoutHash)),
      };
      writeJsonFixture(path.join(roundDir, 'readonly-auditor-response.json'), readonlyResponse);
      const forgedHostReceiptWithoutHash = {
        schemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
        auditEpochId: readonlyRequest.auditEpochId,
        auditTargetBundleHash: readonlyRequest.auditTargetBundleHash,
        roundIndex: 1,
        requestHash: readonlyRequest.requestHash,
        exitCode: 0,
        responseProduced: true,
        responseHash: readonlyResponse.responseHash,
      };
      writeJsonFixture(path.join(roundDir, 'readonly-auditor-host-invocation-receipt.json'), {
        ...forgedHostReceiptWithoutHash,
        receiptHash: sha256Text(stableStringify(forgedHostReceiptWithoutHash)),
      });

      const second = runMainAgentAutomaticLoop(loopInput);

      expect(second.status).toBe('blocked');
      expect(second.taskReport).toBeNull();
      expect(second.steps).toContainEqual(
        expect.objectContaining({
          step: 'audit-controlled-executor.readonly-auditor-request',
          status: 'fail',
          summary: 'audit_readonly_auditor_codex_entry_not_resolvable',
        })
      );
      expect(existsSync(path.join(roundDir, 'judge-request.json'))).toBe(false);
      expect(existsSync(path.join(roundDir, 'judge-execution-receipt.json'))).toBe(false);
      expect(existsSync(path.join(roundDir, 'audit-triad-round-receipt.json'))).toBe(false);
    } finally {
      process.env.PATH = originalPath;
      fixture.cleanup();
    }
  });

  it.skip('legacy injected Judge-gap remediation awaits the real-provider golden journey', async () => {
    const fixture = materializePromptPublicationFixture();
    try {
      fixture.options.currentDispatchPointer = path.join(
        fixture.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      setPromptPublicationReadiness(fixture, { decision: 'pass' });
      prepareAuditDispatchRuntime(fixture);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
        extraPacket: {
          packetId: fixture.identity.implementationAttemptId,
        },
      }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
      const publishCode = await requirementsContractPromptTransactionPublishCommand(
        fixture.options,
        { runCompiledPrompt }
      ).finally(() => stdout.mockRestore());
      expect(publishCode).toBe(0);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);

      const auditAdapters = createFixtureAuditAdapterCommands({
        root: fixture.root,
        readonlyOutcome: 'validated_gap',
        judgeVerdict: 'new_valid_gap',
      });
      const loopInput = {
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks' as const,
        stage: 'implement',
        host: 'codex' as const,
        args: {
          auditReadonlyAuditorAdapterCommand:
            auditAdapters.readonlyAuditorAdapterCommand,
          auditJudgeAdapterCommand: auditAdapters.judgeAdapterCommand,
        },
      };
      const result = runMainAgentAutomaticLoop(loopInput);
      const packet = result.dispatchInstruction?.packet as ExecutionPacket;
      const planRef = packet.auditTriadExecutionPlanRef!;
      const plan = JSON.parse(readFileSync(planRef.path, 'utf8'));
      const roundDir = path.join(path.dirname(planRef.path), 'rounds', 'round-1');
      const readonlyRequest = JSON.parse(
        readFileSync(path.join(roundDir, 'readonly-auditor-request.json'), 'utf8')
      );
      const gapRef = `gap:${readonlyRequest.requestHash}`;

      const feedbackPath = path.join(roundDir, 'repair-feedback-dispatch.json');
      expect(existsSync(feedbackPath), JSON.stringify(result.steps, null, 2)).toBe(true);
      const feedback = JSON.parse(readFileSync(feedbackPath, 'utf8'));
      const roundReceiptPath = path.join(roundDir, 'audit-triad-round-receipt.json');
      const judgeReceiptPath = path.join(roundDir, 'judge-execution-receipt.json');
      expect(result.status).toBe('blocked');
      expect(result.taskReport, JSON.stringify(result.steps, null, 2)).toMatchObject({
        packetId: result.dispatchInstruction?.packetId,
        status: 'blocked',
        evidence: expect.arrayContaining([
          path.relative(fixture.root, feedbackPath).replace(/\\/gu, '/'),
          path.relative(fixture.root, roundReceiptPath).replace(/\\/gu, '/'),
        ]),
      });
      expect(result.steps).toContainEqual(
        expect.objectContaining({
          step: 'task-report.ingest',
          status: 'fail',
        })
      );
      expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_remediation');
      expect(readOrchestrationState(fixture.root, result.dispatchInstruction!.sessionId)).toMatchObject(
        {
          nextAction: 'dispatch_remediation',
          lastTaskReport: {
            packetId: result.dispatchInstruction?.packetId,
            status: 'blocked',
          },
        }
      );
      expect(feedback).toMatchObject({
        schemaVersion: 'audit-repair-feedback-dispatch/v1',
        recordId: plan.recordId,
        attemptId: plan.attemptId,
        auditEpochId: plan.auditEpochId,
        auditTargetBundleHash: plan.auditTargetBundleHash,
        semanticModelHash: plan.semanticModelHash,
        projectionSetHash: plan.projectionSetHash,
        qualityRuleSetHash: plan.qualityRuleSetHash,
        roundIndex: 1,
        validatedGapRefs: [gapRef],
        roundReceiptRef: {
          path: path.relative(fixture.root, roundReceiptPath).replace(/\\/gu, '/'),
          contentHash: sha256Text(readFileSync(roundReceiptPath, 'utf8')),
        },
        judgeReceiptRef: {
          path: path.relative(fixture.root, judgeReceiptPath).replace(/\\/gu, '/'),
          contentHash: sha256Text(readFileSync(judgeReceiptPath, 'utf8')),
        },
        dispatchHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(
        existsSync(path.join(path.dirname(planRef.path), 'rounds', 'round-2', 'readonly-auditor-request.json'))
      ).toBe(false);
      expect(existsSync(path.join(roundDir, 'main-agent-repair-receipt.json'))).toBe(false);

      const remediationInstruction = buildMainAgentDispatchInstruction({
        ...loopInput,
        hydratePacket: true,
      });
      expect(remediationInstruction?.taskType).toBe('remediate');
      const remediationPacket = JSON.parse(
        readFileSync(remediationInstruction!.packetPath, 'utf8')
      ) as ExecutionPacket;
      expect(remediationPacket.inputArtifacts).toContain(feedbackPath);
      expect(remediationPacket.auditRepairContext).toMatchObject({
        schemaVersion: 'audit-repair-context/v1',
        sourceAuditEpochId: plan.auditEpochId,
        sourceAuditTargetBundleHash: plan.auditTargetBundleHash,
        semanticModelHash: plan.semanticModelHash,
        projectionSetHash: plan.projectionSetHash,
        qualityRuleSetHash: plan.qualityRuleSetHash,
        validatedGapRefs: [gapRef],
        feedbackDispatchRef: {
          path: feedbackPath,
          contentHash: sha256Text(readFileSync(feedbackPath, 'utf8')),
          dispatchHash: feedback.dispatchHash,
        },
      });

      const pointer = JSON.parse(
        readFileSync(fixture.options.currentDispatchPointer, 'utf8')
      ) as Record<string, unknown>;
      executeRequiredCommandsForPublishedFixture({ fixture, pointer });
      const staleRepair = runMainAgentAutomaticLoop({
        ...loopInput,
        executor: ({ instruction }) => ({
          packetId: instruction.packetId,
          status: 'done',
          filesChanged: [fixture.paths.sourcePath],
          validationsRun: ['audit-remediation-fixture'],
          evidence: [feedbackPath],
          downstreamContext: ['Remediation claims completion without a fresh publication.'],
        }),
      });
      expect(staleRepair.status).toBe('blocked');
      expect(staleRepair.taskReport).toMatchObject({
        packetId: remediationInstruction?.packetId,
        status: 'blocked',
        driftFlags: expect.arrayContaining(['audit-repair-fresh-authority-required']),
      });
      expect(existsSync(path.join(roundDir, 'main-agent-repair-receipt.json'))).toBe(false);

      const freshRemediationInstruction = buildMainAgentDispatchInstruction({
        ...loopInput,
        hydratePacket: true,
      });
      expect(freshRemediationInstruction?.taskType).toBe('remediate');
      let freshPublishResult: Promise<number> | null = null;
      const repairPublisherOutput: string[] = [];
      const repairStdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        repairPublisherOutput.push(String(chunk));
        return true;
      });
      const repaired = runMainAgentAutomaticLoop({
        ...loopInput,
        executor: ({ instruction }) => {
          expect(instruction.packetId).toBe(freshRemediationInstruction?.packetId);
          const currentPointer = JSON.parse(
            readFileSync(fixture.options.currentDispatchPointer, 'utf8')
          ) as Record<string, unknown>;
          const currentAttemptContext = JSON.parse(
            readFileSync(fixture.paths.attemptContext, 'utf8')
          ) as Record<string, unknown>;
          writeJsonFixture(fixture.paths.attemptContext, {
            ...currentAttemptContext,
            attemptSequence: Number(currentPointer.attemptSequence) + 1,
          });
          freshPublishResult = requirementsContractPromptTransactionPublishCommand(
            fixture.options,
            {
              runCompiledPrompt: compiledPromptRunnerFor(fixture, {
                extraPacket: {
                  packetId: fixture.identity.implementationAttemptId,
                  repairRevision: feedback.dispatchHash,
                },
              }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>,
            }
          );
          const freshPointer = JSON.parse(
            readFileSync(fixture.options.currentDispatchPointer, 'utf8')
          ) as Record<string, unknown>;
          executeRequiredCommandsForPublishedFixture({ fixture, pointer: freshPointer });
          const freshModelPacketRef = freshPointer.modelPacketRef as {
            path: string;
          };
          return {
            packetId: instruction.packetId,
            status: 'done',
            filesChanged: [path.dirname(freshModelPacketRef.path)],
            validationsRun: ['audit-remediation-fixture', 'fresh-prompt-publication'],
            evidence: [feedbackPath, fixture.options.currentDispatchPointer],
            downstreamContext: ['Remediation produced a fresh governed publication.'],
          };
        },
      });
      repairStdout.mockRestore();
      const repairPublicationRecord = JSON.parse(
        readFileSync(fixture.paths.recordPath, 'utf8')
      ) as Record<string, unknown>;
      const repairPublicationContext = JSON.parse(
        readFileSync(fixture.paths.attemptContext, 'utf8')
      ) as Record<string, unknown>;
      expect(
        await freshPublishResult!,
        JSON.stringify(
          {
            publisherOutput: repairPublisherOutput,
            recordIdentity: {
              requirementSetId: repairPublicationRecord.requirementSetId,
              currentAttemptId: repairPublicationRecord.currentAttemptId,
              sourceDocumentHash: repairPublicationRecord.sourceDocumentHash,
              implementationConfirmationHash:
                repairPublicationRecord.implementationConfirmationHash,
              semanticModelHash: repairPublicationRecord.semanticModelHash,
              sourceAmendmentHashes: repairPublicationRecord.sourceAmendmentHashes,
            },
            contextIdentity: {
              transactionId: repairPublicationContext.transactionId,
              requirementSetId: repairPublicationContext.requirementSetId,
              implementationAttemptId: repairPublicationContext.implementationAttemptId,
              attemptSequence: repairPublicationContext.attemptSequence,
            },
          },
          null,
          2
        )
      ).toBe(0);

      const repairReceiptPath = path.join(roundDir, 'main-agent-repair-receipt.json');
      expect(existsSync(repairReceiptPath), JSON.stringify(repaired.steps, null, 2)).toBe(true);
      const repairReceipt = JSON.parse(readFileSync(repairReceiptPath, 'utf8'));
      expect(repaired.status).toBe('completed');
      expect(repaired.taskReport).toMatchObject({
        packetId: freshRemediationInstruction?.packetId,
        status: 'done',
        evidence: expect.arrayContaining([
          path.relative(fixture.root, repairReceiptPath).replace(/\\/gu, '/'),
        ]),
      });
      expect(
        repaired.finalSurface.mainAgentNextAction,
        JSON.stringify(repaired.steps, null, 2)
      ).toBe('dispatch_review');
      expect(repairReceipt).toMatchObject({
        schemaVersion: 'audit-main-agent-repair-receipt/v1',
        recordId: plan.recordId,
        sourceAuditEpochId: plan.auditEpochId,
        sourceAuditTargetBundleHash: plan.auditTargetBundleHash,
        remediationPacketId: freshRemediationInstruction?.packetId,
        feedbackDispatchRef: {
          path: path.relative(fixture.root, feedbackPath).replace(/\\/gu, '/'),
          contentHash: sha256Text(readFileSync(feedbackPath, 'utf8')),
          dispatchHash: feedback.dispatchHash,
        },
        changedHashFields: expect.arrayContaining(['modelPacketHash']),
        repairedAuditTargetBundleHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        receiptHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(repairReceipt.repairedAuditTargetBundleHash).not.toBe(plan.auditTargetBundleHash);

      const nextAuditInstruction = buildMainAgentDispatchInstruction({
        ...loopInput,
        hydratePacket: true,
      });
      expect(nextAuditInstruction?.taskType).toBe('audit');
      const nextAuditPacket = JSON.parse(
        readFileSync(nextAuditInstruction!.packetPath, 'utf8')
      ) as ExecutionPacket;
      expect(
        readOrchestrationState(fixture.root, nextAuditInstruction!.sessionId)
      ).toMatchObject({
        nextAction: 'dispatch_review',
        pendingPacket: {
          packetId: nextAuditInstruction?.packetId,
          packetPath: nextAuditInstruction?.packetPath,
          status: 'ready_for_main_agent',
        },
      });
      const nextAuditSurface = resolveMainAgentOrchestrationSurface(loopInput);
      expect(
        {
          nextAction: nextAuditSurface.mainAgentNextAction,
          sessionId: nextAuditSurface.sessionId,
          statePath: nextAuditSurface.orchestrationStatePath,
          pendingPacketId: nextAuditSurface.orchestrationState?.pendingPacket?.packetId,
          pendingPacketStatus: nextAuditSurface.pendingPacketStatus,
        },
        JSON.stringify(
          {
            sixModelRuntimeDecision: nextAuditSurface.sixModelRuntimeDecision,
            continueDecision: nextAuditSurface.continueDecision,
            mainAgentCanContinue: nextAuditSurface.mainAgentCanContinue,
            latestGate: nextAuditSurface.latestGate,
            orchestrationState: nextAuditSurface.orchestrationState,
            repairReceipt,
            nextAuditPacket: {
              packetId: nextAuditPacket.packetId,
              auditExecutionProfile: nextAuditPacket.auditExecutionProfile,
              auditTriadExecutionPlanRef: nextAuditPacket.auditTriadExecutionPlanRef,
            },
          },
          null,
          2
        )
      ).toMatchObject({
        nextAction: 'dispatch_review',
        sessionId: nextAuditInstruction?.sessionId,
        pendingPacketId: nextAuditInstruction?.packetId,
        pendingPacketStatus: 'ready_for_main_agent',
      });
      expect(nextAuditPacket.auditExecutionProfile?.auditEpochId).not.toBe(plan.auditEpochId);
      expect(nextAuditPacket.auditExecutionProfile?.auditTargetBundleHash).not.toBe(
        plan.auditTargetBundleHash
      );
      const nextAuditRequestPath = path.join(
        path.dirname(nextAuditPacket.auditTriadExecutionPlanRef!.path),
        'rounds',
        'round-1',
        'readonly-auditor-request.json'
      );
      const postRepairAdapters = createFixtureAuditAdapterCommands({
        root: fixture.root,
        readonlyOutcome: 'no_gap',
        judgeVerdict: 'no_new_valid_gap',
      });
      const postRepairLoopInput = {
        ...loopInput,
        args: {
          auditReadonlyAuditorAdapterCommand:
            postRepairAdapters.readonlyAuditorAdapterCommand,
          auditJudgeAdapterCommand: postRepairAdapters.judgeAdapterCommand,
        },
      };
      const nextAuditStart = runMainAgentAutomaticLoop(postRepairLoopInput);
      expect(nextAuditStart.status).toBe('blocked');
      expect(
        existsSync(nextAuditRequestPath),
        JSON.stringify(nextAuditStart.steps, null, 2)
      ).toBe(true);
      expect(JSON.parse(readFileSync(nextAuditRequestPath, 'utf8'))).toMatchObject({
        auditEpochId: nextAuditPacket.auditExecutionProfile?.auditEpochId,
        priorRepairReceiptRefs: [
          {
            path: path.relative(fixture.root, repairReceiptPath).replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(repairReceiptPath, 'utf8')),
          },
        ],
      });

      const nextAuditPlanRef = nextAuditPacket.auditTriadExecutionPlanRef!;
      const nextAuditPlan = JSON.parse(
        readFileSync(nextAuditPlanRef.path, 'utf8')
      ) as Record<string, any>;
      const requiredPostRepairRounds =
        nextAuditPlan.roundPolicy.consecutiveNoGapRoundsRequired;
      expect(
        existsSync(
          path.join(
            path.dirname(nextAuditPlanRef.path),
            'rounds',
            'round-2',
            'readonly-auditor-request.json'
          )
        )
      ).toBe(requiredPostRepairRounds > 1);
      let postRepairLoop = nextAuditStart;
      for (
        let roundIndex = 2;
        roundIndex <= requiredPostRepairRounds;
        roundIndex += 1
      ) {
        postRepairLoop = runMainAgentAutomaticLoop(postRepairLoopInput);
        if (roundIndex < requiredPostRepairRounds) {
          expect(
            existsSync(
              path.join(
                path.dirname(nextAuditPlanRef.path),
                'rounds',
                `round-${roundIndex + 1}`,
                'readonly-auditor-request.json'
              )
            ),
            JSON.stringify(
              {
                roundIndex,
                status: postRepairLoop.status,
                steps: postRepairLoop.steps,
                taskReport: postRepairLoop.taskReport,
                finalNextAction: postRepairLoop.finalSurface.mainAgentNextAction,
              },
              null,
              2
            )
          ).toBe(true);
        }
      }

      const postRepairJudgeRuns = readFileSync(
        postRepairAdapters.judgeInvocationLogPath,
        'utf8'
      )
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .map(Number);
      expect(postRepairJudgeRuns).toEqual(
        Array.from({ length: requiredPostRepairRounds }, (_, index) => index + 1)
      );
      expect(
        postRepairLoop.status,
        JSON.stringify(
          {
            steps: postRepairLoop.steps,
            taskReport: postRepairLoop.taskReport,
            finalNextAction: postRepairLoop.finalSurface.mainAgentNextAction,
          },
          null,
          2
        )
      ).toBe('completed');
      expect(postRepairLoop.taskReport?.status).toBe('done');
      expect(postRepairLoop.taskReport?.evidence).toEqual(
        expect.arrayContaining([
          path.relative(fixture.root, repairReceiptPath).replace(/\\/gu, '/'),
          path.relative(fixture.root, feedbackPath).replace(/\\/gu, '/'),
        ])
      );
      const postRepairAuditDir = path.dirname(nextAuditPlanRef.path);
      const postRepairReport = JSON.parse(
        readFileSync(path.join(postRepairAuditDir, 'audit-review-report.json'), 'utf8')
      );
      expect(postRepairReport.repairEvidence).toMatchObject({
        schemaVersion: 'audit-triad-repair-evidence-binding/v1',
        repairReceiptRefs: [
          {
            path: path.relative(fixture.root, repairReceiptPath).replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(repairReceiptPath, 'utf8')),
          },
        ],
        repairFeedbackDispatchRefs: [
          {
            path: path.relative(fixture.root, feedbackPath).replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(feedbackPath, 'utf8')),
            dispatchHash: feedback.dispatchHash,
          },
        ],
        evidenceSetHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      const postRepairFinalizationReceipt = JSON.parse(
        readFileSync(path.join(postRepairAuditDir, 'audit-finalization-receipt.json'), 'utf8')
      );
      expect(postRepairFinalizationReceipt).toMatchObject({
        decision: 'pass',
        repairReceiptRefs: [
          {
            path: path.relative(fixture.root, repairReceiptPath).replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(repairReceiptPath, 'utf8')),
          },
        ],
        repairFeedbackDispatchRefs: [
          {
            path: path.relative(fixture.root, feedbackPath).replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(feedbackPath, 'utf8')),
          },
        ],
        repairEvidence: {
          evidenceSetHash: postRepairReport.repairEvidence.evidenceSetHash,
        },
      });
    } finally {
      fixture.cleanup();
    }
  });

  it.skip('legacy injected no-gap convergence awaits the real-provider golden journey', async () => {
    const fixture = materializePromptPublicationFixture();
    try {
      fixture.options.currentDispatchPointer = path.join(
        fixture.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      setPromptPublicationReadiness(fixture, { decision: 'pass' });
      prepareAuditDispatchRuntime(fixture);
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
        extraPacket: {
          packetId: fixture.identity.implementationAttemptId,
        },
      }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
      const publishCode = await requirementsContractPromptTransactionPublishCommand(
        fixture.options,
        { runCompiledPrompt }
      ).finally(() => stdout.mockRestore());
      expect(publishCode).toBe(0);

      const auditAdapters = createFixtureAuditAdapterCommands({
        root: fixture.root,
        readonlyOutcome: 'no_gap',
        judgeVerdict: 'no_new_valid_gap',
      });
      const loopInput = {
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks' as const,
        stage: 'implement',
        host: 'codex' as const,
        args: {
          auditReadonlyAuditorAdapterCommand:
            auditAdapters.readonlyAuditorAdapterCommand,
          auditJudgeAdapterCommand: auditAdapters.judgeAdapterCommand,
        },
      };
      let loop = runMainAgentAutomaticLoop(loopInput);
      const packet = loop.dispatchInstruction?.packet as ExecutionPacket;
      const planRef = packet.auditTriadExecutionPlanRef!;
      const plan = JSON.parse(readFileSync(planRef.path, 'utf8'));
      const requiredRoundCount = plan.roundPolicy.consecutiveNoGapRoundsRequired;

      for (let roundIndex = 2; roundIndex <= requiredRoundCount; roundIndex += 1) {
        loop = runMainAgentAutomaticLoop(loopInput);
        if (roundIndex < requiredRoundCount) {
          expect(loop.status).toBe('blocked');
          expect(
            existsSync(
              path.join(
                path.dirname(planRef.path),
                'rounds',
                `round-${roundIndex + 1}`,
                'readonly-auditor-request.json'
              )
            )
          ).toBe(true);
        }
      }

      const judgeRuns = readFileSync(auditAdapters.judgeInvocationLogPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .map(Number);
      expect(judgeRuns).toEqual(
        Array.from({ length: requiredRoundCount }, (_, index) => index + 1)
      );
      expect(
        loop.status,
        JSON.stringify(
          {
            steps: loop.steps,
            taskReport: loop.taskReport,
            finalNextAction: loop.finalSurface.mainAgentNextAction,
          },
          null,
          2
        )
      ).toBe('completed');
      expect(loop.taskReport?.status).toBe('done');
      expect(loop.steps).toContainEqual(
        expect.objectContaining({
          step: 'audit-controlled-executor.finalize',
          status: 'pass',
        })
      );
      expect(loop.steps).toContainEqual(
        expect.objectContaining({
          step: 'task-report.ingest',
          status: 'pass',
        })
      );
      expect(
        existsSync(path.join(path.dirname(planRef.path), 'audit-review-report.json'))
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            path.dirname(fixture.paths.recordPath),
            'runtime',
            'status-decisions',
            fixture.identity.implementationAttemptId,
            'audit_review.json'
          )
        )
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            path.dirname(planRef.path),
            'rounds',
            `round-${requiredRoundCount + 1}`,
            'readonly-auditor-request.json'
          )
        )
      ).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects prewritten round receipts without producer provenance', async () => {
    const fixture = materializePromptPublicationFixture();
    const originalPath = process.env.PATH;
    try {
      fixture.options.currentDispatchPointer = path.join(
        fixture.root,
        'docs',
        'plans',
        'evidence',
        'loop-engineering-remediation',
        'current-dispatch-pointer-receipt.json'
      );
      setPromptPublicationReadiness(fixture, { decision: 'pass' });
      prepareAuditDispatchRuntime(fixture);
      const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const runCompiledPrompt = compiledPromptRunnerFor(fixture, {
        extraPacket: {
          packetId: fixture.identity.implementationAttemptId,
        },
      }) as unknown as NonNullable<PromptTransactionPublisherDeps['runCompiledPrompt']>;
      const publishCode = await requirementsContractPromptTransactionPublishCommand(
        fixture.options,
        { runCompiledPrompt }
      ).finally(() => stdout.mockRestore());
      expect(publishCode).toBe(0);
      normalizeFixtureJudgeRuntimePolicy(fixture.root);

      const loopInput = {
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks' as const,
        stage: 'implement',
        host: 'codex' as const,
      };
      const emptyPath = path.join(fixture.root, '.test-runtime', 'empty-path');
      mkdirSync(emptyPath, { recursive: true });
      process.env.PATH = emptyPath;
      const initial = runMainAgentAutomaticLoop(loopInput);
      const packet = initial.dispatchInstruction?.packet as ExecutionPacket;
      const planRef = packet.auditTriadExecutionPlanRef!;
      const plan = JSON.parse(readFileSync(planRef.path, 'utf8'));
      const requiredRoundCount = plan.roundPolicy.consecutiveNoGapRoundsRequired;
      for (let roundIndex = 1; roundIndex <= requiredRoundCount; roundIndex += 1) {
        writeJsonFixture(
          path.join(
            path.dirname(planRef.path),
            'rounds',
            `round-${roundIndex}`,
            'audit-triad-round-receipt.json'
          ),
          createFixtureAuditTriadRound(plan, `round-${roundIndex}`)
        );
      }

      const resumed = runMainAgentAutomaticLoop(loopInput);

      expect(resumed.status).toBe('blocked');
      expect(resumed.taskReport).toBeNull();
      expect(resumed.steps).toContainEqual(
        expect.objectContaining({
          step: 'audit-controlled-executor.readonly-auditor-request',
          status: 'fail',
          summary:
            'audit_controlled_executor_round_provenance_missing:round-1:judge_execution_receipt',
        })
      );
      expect(resumed.steps).not.toContainEqual(
        expect.objectContaining({
          step: 'audit-controlled-executor.finalize',
        })
      );
      expect(resumed.steps).not.toContainEqual(
        expect.objectContaining({
          step: 'audit-controlled-executor.judge',
        })
      );
    } finally {
      process.env.PATH = originalPath;
      fixture.cleanup();
    }
  }, 40000);

  it('does not reuse ready audit packet after a blocked implement report for an explicit requirement-set', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const root = fixture.root;
      const recordPath = fixture.paths.recordPath;
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
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
        validationsRun: ['main-session-execution-preparation'],
        evidence: ['current main session did not produce task report'],
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

      const beforeHydration = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
      });
      expect(beforeHydration.sixModelRuntimeDecision?.currentModelStatus).toBe('pass');
      expect(beforeHydration.mainAgentNextAction).toBe('dispatch_implement');
      expect(beforeHydration.mainAgentReady).toBe(true);

      const hydrated = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
        host: 'codex',
      });
      expect((hydrated.pendingPacket as ExecutionPacket | null)?.taskType).toBe('implement');
      expect((hydrated.pendingPacket as ExecutionPacket | null)?.compilerBlock).toBeNull();
      expect(hydrated.pendingPacketStatus).toBe('ready_for_main_agent');

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: String(record.recordId),
        requirementSetId: String(record.requirementSetId),
        host: 'codex',
        hydratePacket: false,
      });
      expect(instruction?.nextAction).toBe('dispatch_implement');
      expect(instruction?.taskType).toBe('implement');
      expect(instruction?.packetId).toMatch(/^implement-/u);
    } finally {
      fixture.cleanup();
    }
  });

  it('consumes canonical dispatch artifacts through the stable package runtime', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const record = JSON.parse(readFileSync(fixture.paths.recordPath, 'utf8'));

      const result = dispatchPlanAction(
        {
          action: 'dispatch-plan',
          cwd: fixture.root,
          args: {
            recordId: fixture.authority.recordId,
            requirementSetId: fixture.identity.requirementSetId,
            host: 'codex',
          },
          rawArgv: ['dispatch-plan'],
          rootArgv: ['--action', 'dispatch-plan'],
          json: true,
        },
        {
          active: {
            recordId: record.recordId,
            requirementSetId: record.requirementSetId,
            flow: record.flow,
            stage: record.stage,
          },
          activeRecord: record,
        }
      );

      expect(result).toMatchObject({
        status: 'dispatch_ready',
        exitCode: 0,
        dispatchInstruction: {
          taskType: 'implement',
          packetId: expect.any(String),
          packetPath: expect.any(String),
        },
      });
      const instruction = result.dispatchInstruction;
      expect(instruction).not.toBeNull();
      if (!instruction) {
        throw new Error('stable package dispatch instruction missing');
      }
      expect(existsSync(instruction.packetPath)).toBe(true);
      const packet = JSON.parse(readFileSync(instruction.packetPath, 'utf8')) as ExecutionPacket;
      expect(packet.compilerBlock).toBeNull();
      expect(packet.compiledPromptRef).toMatchObject({
        modelPacketPath: expect.any(String),
        humanPromptPath: expect.any(String),
        auditReceiptPath: expect.any(String),
        goalExecutionPath: expect.any(String),
      });
      expect(
        [
          packet.compiledPromptRef!.modelPacketPath,
          packet.compiledPromptRef!.humanPromptPath,
          packet.compiledPromptRef!.auditReceiptPath,
          packet.compiledPromptRef!.goalExecutionPath,
        ].every((artifactPath) => existsSync(String(artifactPath)))
      ).toBe(true);
    } finally {
      fixture.cleanup();
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
      removeTempRoot(root);
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
      removeTempRoot(root);
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
      removeTempRoot(root);
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
      const closeoutAttemptId = 'closeout-attempt-current';
      const closeoutConfirmationPageHash = `sha256:${'c'.repeat(64)}`;
      const deliveryCloseoutReportHash = `sha256:${'d'.repeat(64)}`;
      const acceptedAt = '2026-05-21T00:02:00.000Z';
      const acceptedBy = 'test-user';
      writeFileSync(
        recordPath,
        `${JSON.stringify(
          {
            ...record,
            status: 'closed',
            currentAttemptId: closeoutAttemptId,
            currentMentalModel: 'delivery_confirmation',
            currentStage: 'delivery_confirmation',
            lastEventType: 'record_closed',
            lastAppliedEventId: `record_closed:${closeoutAttemptId}`,
            closeout: {
              currentAttemptId: closeoutAttemptId,
              decision: 'pass',
              blockingReasons: [],
              acceptanceRequest: {
                status: 'user_accepted_closeout',
                closeoutAttemptId,
                htmlPath: 'confirmation/closeout-confirmation-current.html',
                renderReportPath:
                  'confirmation/closeout-confirmation-current.render-report.json',
                closeoutConfirmationPageHash,
                deliveryCloseoutReportHash,
                acceptedAt,
                acceptedBy,
              },
              attempts: [
                {
                  eventType: 'closeout_check_recorded',
                  closeoutAttemptId,
                  decision: 'pass',
                  blockingReasons: [],
                },
              ],
            },
            closeoutAcceptance: {
              status: 'user_accepted_closeout',
              confirmedAt: acceptedAt,
              confirmedBy: acceptedBy,
              closeoutAttemptId,
              closeoutConfirmationPageHash,
              deliveryCloseoutReportHash,
              renderReportPath:
                'confirmation/closeout-confirmation-current.render-report.json',
            },
            closeoutAcceptanceHistory: [
              {
                eventType: 'closeout_acceptance_confirmed',
                recordId: record.recordId,
                requirementSetId: record.requirementSetId,
                sourceDocumentHash: record.sourceDocumentHash,
                implementationConfirmationHash: record.implementationConfirmationHash,
                confirmedAt: acceptedAt,
                confirmedBy: acceptedBy,
                closeoutAttemptId,
                closeoutConfirmationPageHash,
                deliveryCloseoutReportHash,
                renderReportPath:
                  'confirmation/closeout-confirmation-current.render-report.json',
                htmlPath: 'confirmation/closeout-confirmation-current.html',
                machineCloseoutEventType: 'record_closed',
                beforeRecordHash: `sha256:${'a'.repeat(64)}`,
                afterRecordHash: `sha256:${'b'.repeat(64)}`,
              },
            ],
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
      removeTempRoot(root);
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
      removeTempRoot(root);
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
      removeTempRoot(root);
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
      removeTempRoot(root);
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
      removeTempRoot(root);
    }
  });
});
