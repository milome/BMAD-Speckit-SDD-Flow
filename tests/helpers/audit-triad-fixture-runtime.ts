import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  createAuditTriadExecutionPlan,
  sha256Json,
  type AuditTriadRoundReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/audit-triad-orchestrator';
import {
  criticalAuditorIndependentProviderRunHash,
  type CriticalAuditorIndependentProviderEvidence,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence';
import type {
  MaterializedRequirementFixture,
  writeCompiledImplementPacket,
} from './requirement-fixture-runtime';

type CompiledFixture = ReturnType<typeof writeCompiledImplementPacket>;
type AuditTriadPlanInput = Parameters<typeof createAuditTriadExecutionPlan>[0];

export function createFixtureAuditAdapterCommands(input: {
  root: string;
  readonlyOutcome: 'no_gap' | 'validated_gap';
  judgeVerdict: 'no_new_valid_gap' | 'new_valid_gap';
}): {
  readonlyAuditorAdapterCommand: string;
  judgeAdapterCommand: string;
  judgeInvocationLogPath: string;
} {
  const adapterDir = path.join(input.root, '.test-runtime', 'audit-adapters');
  mkdirSync(adapterDir, { recursive: true });
  const readonlyAdapterPath = path.join(adapterDir, 'readonly-auditor-adapter.cjs');
  const judgeAdapterPath = path.join(adapterDir, 'judge-adapter.cjs');
  const judgeInvocationLogPath = path.join(
    adapterDir,
    `judge-invocations-${randomUUID()}.log`
  );

  writeFileSync(
    readonlyAdapterPath,
    [
      "const fs = require('node:fs');",
      "const outcome = process.argv[2] || 'no_gap';",
      'const requestPath = process.env.BMAD_READONLY_AUDITOR_REQUEST_PATH;',
      "if (!requestPath) process.exit(2);",
      "const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));",
      'const assignments = Array.isArray(request.perspectiveAssignments)',
      '  ? request.perspectiveAssignments',
      '  : [];',
      "const gapRef = `gap:${String(request.requestHash || '')}`;",
      "const validatedGapRefs = outcome === 'validated_gap' ? [gapRef] : [];",
      'const perspectiveResults = Object.fromEntries(',
      '  assignments.map((assignment, index) => [',
      '    assignment.perspectiveId,',
      '    {',
      "      agentId: `${String(assignment.agentId)}:external-fixture-process`,",
      '      validGaps:',
      "        outcome === 'validated_gap' && index === assignments.length - 1",
      '          ? [{ gapId: gapRef }]',
      '          : [],',
      '    },',
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
      'const response = {',
      "  schemaVersion: 'audit-readonly-auditor-response/v1',",
      '  perspectiveResults,',
      '  coveredCheckItemIds,',
      '  vetoItemResults: requiredVetoItemIds.map((itemId) => ({ itemId, passed: true })),',
      '  validatedGapRefs,',
      '  invalidGapRefs: [],',
      '  checkedProjectionQualityRuleCodes: Array.isArray(',
      '    request.checkedProjectionQualityRuleCodes',
      '  )',
      '    ? request.checkedProjectionQualityRuleCodes',
      '    : [],',
      '  rationale:',
      "    outcome === 'validated_gap'",
      "      ? 'The external readonly fixture process reported a current gap.'",
      "      : 'The external readonly fixture process reported no current gap.',",
      '};',
      "process.stdout.write(`${JSON.stringify(response)}\\n`);",
    ].join('\n'),
    'utf8'
  );

  writeFileSync(
    judgeAdapterPath,
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      'const args = process.argv.slice(2);',
      'const verdict = args[0];',
      'const invocationLogPath = args[1];',
      "const requestIndex = args.indexOf('--request');",
      'if (requestIndex < 0 || !args[requestIndex + 1]) process.exit(2);',
      "const request = JSON.parse(fs.readFileSync(args[requestIndex + 1], 'utf8'));",
      'const readonlyResponse = request.readonlyAuditorResponse || {};',
      'const readonlyGapRefs = Array.isArray(readonlyResponse.validatedGapRefs)',
      '  ? readonlyResponse.validatedGapRefs',
      '  : [];',
      "const validatedGapRefs = verdict === 'new_valid_gap' ? readonlyGapRefs : [];",
      'if (invocationLogPath) {',
      '  fs.mkdirSync(path.dirname(invocationLogPath), { recursive: true });',
      "  fs.appendFileSync(invocationLogPath, `${Number(request.roundIndex)}\\n`, 'utf8');",
      '}',
      'const providerRunId = [',
      "  'fixture-provider',",
      '  Number(request.roundIndex),',
      "  String(request.requestHash || '').replace(/^sha256:/u, '').slice(0, 12),",
      "].join('-');",
      'const result = {',
      "  schemaVersion: 'critical-auditor-external-adapter-result/v1',",
      '  providerRun: {',
      '    ...request.independentProviderBinding,',
      '    providerRunId,',
      '  },',
      '  response: {',
      "    schemaVersion: 'critical-auditor-round-response/v1',",
      '    roundIndex: Number(request.roundIndex),',
      '    transactionId: request.transactionId,',
      '    namespaceVersion: request.namespaceVersion,',
      '    requestHash: request.requestHash,',
      '    sourceHash: request.sourceHash,',
      '    sourceDocumentHash: request.sourceDocumentHash,',
      '    semanticModelHash: request.semanticModelHash,',
      '    implementationConfirmationHash: request.implementationConfirmationHash,',
      '    packetHash: request.packetHash,',
      '    projectionSetHash: request.projectionSetHash,',
      '    gateDryRunHash: request.gateDryRun.gateDryRunHash,',
      '    reconciliationIssueCount: request.gateDryRun.reconciliation.issueCount,',
      '    verdict,',
      '    gapCandidates: validatedGapRefs.map((gapId) => ({ gapId })),',
      '    validatedGaps: validatedGapRefs.map((gapId) => ({ gapId })),',
      '    rejectedGapCandidates: [],',
      '    mutationPressureFindings: [],',
      '    overBroadTaskFindings: [],',
      '    missingProjectionFindings: [],',
      '    invalidProofFindings: [],',
      '    legacyBypassFindings: [],',
      '    sourceMaterializationFindings: [],',
      '    reviewedMustRefs: [],',
      '    reviewedProjectionRefs: [],',
      '    checkedProjectionGroups: [],',
      '    checkedProjectionQualityRuleCodes:',
      '      request.projectionQualityGate.requiredRuleCodes,',
      '    priorFindingsDisposition: [],',
      '    falsePositiveProofs: [],',
      "    rationale: `The external Judge fixture process returned ${verdict}.`,",
      '  },',
      '};',
      "process.stdout.write(`${JSON.stringify(result)}\\n`);",
    ].join('\n'),
    'utf8'
  );

  return {
    readonlyAuditorAdapterCommand: JSON.stringify([
      process.execPath,
      readonlyAdapterPath,
      input.readonlyOutcome,
    ]),
    judgeAdapterCommand: JSON.stringify([
      process.execPath,
      judgeAdapterPath,
      input.judgeVerdict,
      judgeInvocationLogPath,
    ]),
    judgeInvocationLogPath,
  };
}

export function fixtureProjectionSetHash(compiled: CompiledFixture): string {
  return sha256Json({ modelPacketHash: compiled.compiledPromptRef.modelPacketHash });
}

export function createFixtureAuditTriadPlan(input: {
  fixture: MaterializedRequirementFixture;
  compiled: CompiledFixture;
  attemptId: string;
  overrides?: Partial<AuditTriadPlanInput>;
}) {
  return createAuditTriadExecutionPlan({
    projectRoot: input.fixture.root,
    recordId: input.fixture.recordId,
    stage: 'implement',
    callPoint: 'audit_review',
    attemptId: input.attemptId,
    sourceDocumentHash: input.fixture.sourceDocumentHash,
    semanticModelHash: input.fixture.semanticModelHash,
    implementationConfirmationHash: input.fixture.implementationConfirmationHash,
    projectionSetHash: fixtureProjectionSetHash(input.compiled),
    modelPacketHash: input.compiled.compiledPromptRef.modelPacketHash,
    auditReceiptHash: input.compiled.compiledPromptRef.auditReceiptHash,
    goalExecutionHash: input.compiled.compiledPromptRef.goalExecutionHash,
    ...input.overrides,
  });
}

export function createFixtureAuditTriadRound(
  plan: ReturnType<typeof createAuditTriadExecutionPlan>,
  roundId: string,
  overrides: Partial<AuditTriadRoundReceipt> = {}
): AuditTriadRoundReceipt {
  const criticalAuditorRequestHash = sha256Json({
    auditEpochId: plan.auditEpochId,
    roundId,
    role: 'llm_as_judge',
  });
  const evidenceWithoutRunHash: Omit<CriticalAuditorIndependentProviderEvidence, 'runHash'> = {
    ...plan.independentProviderBinding,
    transactionId: plan.auditEpochId,
    auditAttemptId: plan.attemptId,
    providerRunId: `provider-${roundId}`,
    requestHash: criticalAuditorRequestHash,
    responseHash: sha256Json({ roundId, verdict: 'no_new_valid_gap' }),
    sourceDocumentHash: plan.sourceDocumentHash,
    semanticModelHash: plan.semanticModelHash,
    projectionSetHash: plan.projectionSetHash,
  };
  const judgeReceiptWithoutHash = {
    schemaVersion: 'audit-judge-execution-receipt/v1',
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    roundId,
    providerRunId: evidenceWithoutRunHash.providerRunId,
  };
  const readonlyHostReceiptWithoutHash = {
    schemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    roundId,
    requestHash: criticalAuditorRequestHash,
  };
  return {
    schemaVersion: 'audit-triad-round-receipt/v1',
    roundId,
    verdict: 'no_new_valid_gap',
    stageProfileId: plan.stageProfileId,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    perspectiveResults: {
      product_intent: { agentId: `product-${roundId}`, validGaps: [] },
      model_projection: { agentId: `model-${roundId}`, validGaps: [] },
      main_agent_execution: { agentId: `main-${roundId}`, validGaps: [] },
    },
    coveredCheckItemIds: plan.subagents[0].requiredCheckItemIds,
    vetoItemResults: plan.subagents[0].requiredCheckItemIds
      .filter((id) => id.startsWith('veto_'))
      .map((itemId) => ({ itemId, passed: true })),
    validatedGapRefs: [],
    invalidGapRefs: [],
    sourceDocumentHash: plan.sourceDocumentHash,
    semanticModelHash: plan.semanticModelHash,
    implementationConfirmationHash: plan.implementationConfirmationHash,
    projectionSetHash: plan.projectionSetHash,
    checkedProjectionQualityRuleCodes: plan.checkedProjectionQualityRuleCodes,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    modelPacketHash: plan.modelPacketHash,
    auditReceiptHash: plan.auditReceiptHash,
    goalExecutionHash: plan.goalExecutionHash,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    criticalAuditorRequestHash,
    independentProviderEvidence: {
      ...evidenceWithoutRunHash,
      runHash: criticalAuditorIndependentProviderRunHash(evidenceWithoutRunHash),
    },
    judgeExecutionReceiptRef: {
      path: `audit-triad/rounds/${roundId}/judge-execution-receipt.json`,
      contentHash: sha256Json(judgeReceiptWithoutHash),
      receiptHash: sha256Json(judgeReceiptWithoutHash),
    },
    readonlyAuditorHostInvocationReceiptRef: {
      path: `audit-triad/rounds/${roundId}/readonly-auditor-host-invocation-receipt.json`,
      contentHash: sha256Json(readonlyHostReceiptWithoutHash),
      receiptHash: sha256Json(readonlyHostReceiptWithoutHash),
    },
    scoreReceiptRefs: [`score-${roundId}.json`],
    runAuditorHostReceiptRefs: [`auditor-host-${roundId}.json`],
    ...overrides,
  };
}
