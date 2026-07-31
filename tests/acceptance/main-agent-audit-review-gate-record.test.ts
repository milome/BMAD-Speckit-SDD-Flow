import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it, vi } from 'vitest';
import {
  createAuditTriadExecutionPlan,
  sha256Json,
  type AuditTriadExecutionPlan,
  type AuditTriadRoundReceipt,
  writeAuditTriadExecutionPlan,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/audit-triad-orchestrator';
import {
  criticalAuditorIndependentProviderRunHash,
  type CriticalAuditorIndependentProviderEvidence,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence';
import { mainAuditReviewGate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-audit-review-gate';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
  validateRuntimeStatusDecisionReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import {
  sha256Json as sha256ControlJson,
  sha256Text,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store';
import { resolveSixModelRuntimeDecision } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/six-model-runtime-decision';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture as materializeRequirementFixtureBase,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function materializeRequirementFixture(
  input?: Parameters<typeof materializeRequirementFixtureBase>[0]
): ReturnType<typeof materializeRequirementFixtureBase> {
  const fixture = materializeRequirementFixtureBase(input);
  normalizeFixtureJudgeRuntimePolicy(fixture.root);
  return fixture;
}

function auditPlanSemanticBindings(
  fixture: ReturnType<typeof materializeRequirementFixture>,
  compiled: ReturnType<typeof writeCompiledImplementPacket>
): { semanticModelHash: string; projectionSetHash: string } {
  return {
    semanticModelHash: fixture.semanticModelHash,
    projectionSetHash: sha256Json({
      modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
    }),
  };
}

function establishExecutionClosureAuthority(
  fixture: ReturnType<typeof materializeRequirementFixture>,
  compiled: ReturnType<typeof writeCompiledImplementPacket>
): void {
  const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8')) as Record<string, unknown>;
  const sixModelResults = record.sixModelResults as Record<
    string,
    Record<string, unknown>
  >;
  const update = createRuntimeStatusProjectionUpdate({
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    modelId: 'execution_closure',
    implementationAttemptId: fixture.runId,
    sourceDocumentHash: fixture.sourceDocumentHash,
    implementationConfirmationHash: fixture.implementationConfirmationHash,
    semanticModelHash: String(record.semanticModelHash),
    stageInputs: [
      {
        role: 'model_packet',
        path: compiled.compiledPromptRef.modelPacketPath,
        hash: compiled.compiledPromptRef.modelPacketHash,
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'audit_receipt',
        path: compiled.compiledPromptRef.auditReceiptPath,
        hash: compiled.compiledPromptRef.auditReceiptHash,
      },
    ],
    blockerRefs: [],
    evidenceRefs: [compiled.compiledPromptRef.auditReceiptPath],
    authorityClass: 'controlled_closeout',
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt: '2026-05-30T11:59:59.000Z',
    receiptPath: path.join(
      fixture.root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      fixture.recordId,
      'runtime-status',
      fixture.runId,
      'execution-closure.json'
    ),
    projection: {
      ...sixModelResults.execution_closure,
      status: 'pass',
    },
  });
  writeJson(fixture.recordPath, {
    ...record,
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: 'execution_closure',
      update,
    }),
  });
}

function cleanRound(plan: AuditTriadExecutionPlan, roundId: string): AuditTriadRoundReceipt {
  const readonlyAuditorInvocationId = `readonly-${roundId}`;
  const criticalAuditorRequestHash = sha256Json({
    auditEpochId: plan.auditEpochId,
    roundId,
    role: 'llm_as_judge',
  });
  const evidenceWithoutRunHash: Omit<CriticalAuditorIndependentProviderEvidence, 'runHash'> = {
    ...plan.independentProviderBinding,
    requestedModel: plan.independentProviderBinding.model,
    model: `gateway-selected-${sha256Json({
      providerId: plan.independentProviderBinding.providerId,
      roundId,
    }).slice('sha256:'.length, 'sha256:'.length + 16)}`,
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
  const scoreWriterReceiptWithoutHash = {
    schemaVersion: 'run-auditor-host-score-writer-invocation-receipt/v1',
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    roundId,
    producerInvocationId: readonlyAuditorInvocationId,
  };
  const roundWithoutHash = {
    schemaVersion: 'audit-triad-round-receipt/v1',
    roundId,
    verdict: 'no_new_valid_gap',
    stageProfileId: plan.stageProfileId,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    readonlyAuditorInvocationId,
    perspectiveResults: {
      product_intent: { agentId: readonlyAuditorInvocationId, validGaps: [] },
      model_projection: { agentId: readonlyAuditorInvocationId, validGaps: [] },
      main_agent_execution: { agentId: readonlyAuditorInvocationId, validGaps: [] },
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
    scoreWriterInvocationReceiptRef: {
      path: `audit-triad/rounds/${roundId}/score-writer-invocation-receipt.json`,
      contentHash: sha256Json(scoreWriterReceiptWithoutHash),
      receiptHash: sha256Json(scoreWriterReceiptWithoutHash),
    },
    providerInvocationReceiptRef: {
      path: `audit-triad/rounds/${roundId}/judge-provider-invocation-receipt.json`,
      contentHash: sha256Json({
        schemaVersion: 'critical-auditor-judge-invocation-receipt/v1',
        auditEpochId: plan.auditEpochId,
        roundId,
      }),
      receiptHash: sha256Json({
        schemaVersion: 'critical-auditor-judge-invocation-receipt/v1',
        auditEpochId: plan.auditEpochId,
        roundId,
      }),
    },
    scoreReceiptRefs: [`score-${roundId}.json`],
    runAuditorHostReceiptRefs: [`auditor-host-${roundId}.json`],
  };
  return {
    ...roundWithoutHash,
    receiptHash: sha256Json(roundWithoutHash),
  } as AuditTriadRoundReceipt;
}

function writeAuditTriadReceiptRef(
  root: string,
  relativePath: string,
  payload: Record<string, unknown>
): { path: string; contentHash: string; receiptHash: string } {
  const receipt = {
    ...payload,
    receiptHash: sha256Json(payload),
  };
  const absolutePath = path.resolve(root, relativePath);
  writeJson(absolutePath, receipt);
  return {
    path: relativePath.replace(/\\/gu, '/'),
    contentHash: sha256Text(readFileSync(absolutePath, 'utf8')),
    receiptHash: String(receipt.receiptHash),
  };
}

function writeSelfHashJson(
  filePath: string,
  hashField: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const value = {
    ...payload,
    [hashField]: sha256Json(payload),
  };
  writeJson(filePath, value);
  return value;
}

function materializeRoundProducerArtifacts(input: {
  root: string;
  plan: AuditTriadExecutionPlan;
  round: AuditTriadRoundReceipt;
  roundIndex: number;
}): AuditTriadRoundReceipt {
  const roundDir = path.join(
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.plan.recordId,
    'audit-triad',
    input.plan.attemptId,
    'rounds',
    `round-${input.roundIndex}`
  );
  const absoluteRoundDir = path.join(input.root, roundDir);
  const readonlyRequestWithoutHash = {
    schemaVersion: 'audit-readonly-auditor-request/v1',
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    roundIndex: input.roundIndex,
  };
  const readonlyRequest = {
    ...readonlyRequestWithoutHash,
    requestHash: sha256Json(readonlyRequestWithoutHash),
  };
  writeJson(path.join(absoluteRoundDir, 'readonly-auditor-request.json'), readonlyRequest);
  const readonlyResponseWithoutHash = {
    schemaVersion: 'audit-readonly-auditor-response/v1',
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    roundIndex: input.roundIndex,
    requestHash: readonlyRequest.requestHash,
    producerInvocationId: input.round.readonlyAuditorInvocationId,
    perspectiveResults: input.round.perspectiveResults,
    vetoItemResults: input.round.vetoItemResults,
  };
  const readonlyResponse = {
    ...readonlyResponseWithoutHash,
    responseHash: sha256Json(readonlyResponseWithoutHash),
  };
  writeJson(path.join(absoluteRoundDir, 'readonly-auditor-response.json'), readonlyResponse);
  const judgeRequestWithoutHash = {
    schemaVersion: 'critical-auditor-round-request/v1',
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    readonlyAuditorResponseHash: readonlyResponse.responseHash,
    requestHash: null,
  };
  const judgeRequest = {
    ...judgeRequestWithoutHash,
    requestHash: sha256Json(judgeRequestWithoutHash),
  };
  writeJson(path.join(absoluteRoundDir, 'judge-request.json'), judgeRequest);
  writeJson(
    path.join(absoluteRoundDir, 'judge-authoritative-audit-report.md'),
    { status: 'PASS' }
  );
  const reportPath = path.join(absoluteRoundDir, 'judge-authoritative-audit-report.md');
  const readonlyStdoutPath = path.join(absoluteRoundDir, 'readonly-stdout.log');
  const readonlyStderrPath = path.join(absoluteRoundDir, 'readonly-stderr.log');
  const judgeStdoutPath = path.join(absoluteRoundDir, 'judge-stdout.log');
  const judgeStderrPath = path.join(absoluteRoundDir, 'judge-stderr.log');
  writeFileSync(readonlyStdoutPath, 'pass\n', 'utf8');
  writeFileSync(readonlyStderrPath, '', 'utf8');
  writeFileSync(judgeStdoutPath, 'pass\n', 'utf8');
  writeFileSync(judgeStderrPath, '', 'utf8');
  const providerResultPath = path.join(absoluteRoundDir, 'judge-provider-result.json');
  writeJson(providerResultPath, { schemaVersion: 'critical-auditor-judge-provider-result/v1' });
  const transportEvidence = {
    command: 'claude',
    executorKind: 'native_spawn',
    exitCode: 0,
  };
  const providerRef = writeAuditTriadReceiptRef(input.root, path.join(roundDir, 'judge-provider-invocation-receipt.json'), {
    schemaVersion: 'critical-auditor-judge-invocation-receipt/v1',
    requestHash: input.round.criticalAuditorRequestHash,
    sourceDocumentHash: input.plan.sourceDocumentHash,
    semanticModelHash: input.plan.semanticModelHash,
    projectionSetHash: input.plan.projectionSetHash,
    providerRunId: input.round.independentProviderEvidence?.providerRunId,
    responseHash: input.round.independentProviderEvidence?.responseHash,
    resultPath: providerResultPath.replace(/\\/gu, '/'),
    resultContentHash: sha256Text(readFileSync(providerResultPath, 'utf8')),
    transportEvidence,
    transportEvidenceHash: sha256Json(transportEvidence),
  });
  writeSelfHashJson(path.join(absoluteRoundDir, 'judge-provider-invocation-state.json'), 'stateHash', {
    status: 'committed',
    receiptHash: providerRef.receiptHash,
    receiptContentHash: providerRef.contentHash,
    resultContentHash: sha256Text(readFileSync(providerResultPath, 'utf8')),
  });
  writeSelfHashJson(path.join(absoluteRoundDir, 'judge-provider-invocation-commit.json'), 'commitHash', {
    receiptHash: providerRef.receiptHash,
    receiptContentHash: providerRef.contentHash,
    stateContentHash: sha256Text(readFileSync(path.join(absoluteRoundDir, 'judge-provider-invocation-state.json'), 'utf8')),
    resultContentHash: sha256Text(readFileSync(providerResultPath, 'utf8')),
  });
  const judgeRef = writeAuditTriadReceiptRef(input.root, path.join(roundDir, 'judge-execution-receipt.json'), {
    schemaVersion: 'audit-judge-execution-receipt/v1',
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    roundIndex: input.roundIndex,
    judgeRequestHash: judgeRequest.requestHash,
    readonlyAuditorResponseHash: readonlyResponse.responseHash,
    verdict: input.round.verdict,
    validatedGapRefs: input.round.validatedGapRefs,
    independentProviderEvidence: input.round.independentProviderEvidence,
    providerInvocationReceiptRef: providerRef,
    sourceDocumentHash: input.plan.sourceDocumentHash,
    semanticModelHash: input.plan.semanticModelHash,
    implementationConfirmationHash: input.plan.implementationConfirmationHash,
    projectionSetHash: input.plan.projectionSetHash,
    qualityRuleSetHash: input.plan.qualityRuleSetHash,
    currentAttemptHash: input.plan.currentAttemptHash,
    currentEvidenceHash: input.plan.currentEvidenceHash,
  });
  const hostRef = writeAuditTriadReceiptRef(input.root, path.join(roundDir, 'readonly-host-receipt.json'), {
    schemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    roundIndex: input.roundIndex,
    producerInvocationId: input.round.readonlyAuditorInvocationId,
    responseHash: readonlyResponse.responseHash,
    responseProduced: true,
    exitCode: 0,
    stdoutPath: readonlyStdoutPath.replace(/\\/gu, '/'),
    stdoutHash: sha256Text(readFileSync(readonlyStdoutPath, 'utf8')),
    stderrPath: readonlyStderrPath.replace(/\\/gu, '/'),
    stderrHash: sha256Text(readFileSync(readonlyStderrPath, 'utf8')),
  });
  writeSelfHashJson(path.join(absoluteRoundDir, 'readonly-auditor-invocation-state.json'), 'stateHash', {
    status: 'committed',
    requestHash: readonlyRequest.requestHash,
    responseHash: readonlyResponse.responseHash,
    responseContentHash: sha256Text(readFileSync(path.join(absoluteRoundDir, 'readonly-auditor-response.json'), 'utf8')),
    hostReceiptReceiptHash: hostRef.receiptHash,
    hostReceiptContentHash: hostRef.contentHash,
  });
  const binding = {
    roundId: input.round.roundId,
    runAuditorHostInvocationId: `invocation-${input.roundIndex}`,
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    sourceDocumentHash: input.plan.sourceDocumentHash,
    semanticModelHash: input.plan.semanticModelHash,
    projectionSetHash: input.plan.projectionSetHash,
    readonlyAuditorRequestHash: readonlyRequest.requestHash,
    readonlyAuditorResponseHash: readonlyResponse.responseHash,
    judgeRequestHash: judgeRequest.requestHash,
    judgeExecutionReceiptRef: judgeRef,
    judgeProviderInvocationReceiptRef: providerRef,
    judgeAuthoritativeReportHash: sha256Text(readFileSync(reportPath, 'utf8')),
  };
  writeJson(path.join(absoluteRoundDir, 'run-auditor-host-binding.json'), binding);
  const scoreWriterRef = writeAuditTriadReceiptRef(input.root, path.join(roundDir, 'score-writer-receipt.json'), {
    schemaVersion: 'run-auditor-host-score-writer-invocation-receipt/v1',
    roundId: input.round.roundId,
    producerIdentity: { id: 'package-score-command', role: 'score_writer' },
    bindingHash: sha256Json(binding),
    scoreRecordPath: path.join(absoluteRoundDir, 'score-record.json').replace(/\\/gu, '/'),
    scoreRecordHash: sha256Text('score-record-placeholder'),
  });
  const scoreRecordPath = path.join(absoluteRoundDir, 'score-record.json');
  writeJson(scoreRecordPath, { status: 'approved' });
  const scoreRecordHash = sha256Text(readFileSync(scoreRecordPath, 'utf8'));
  const scoreWriterReceiptPath = path.join(input.root, scoreWriterRef.path);
  const scoreWriter = JSON.parse(readFileSync(scoreWriterReceiptPath, 'utf8'));
  scoreWriter.scoreRecordHash = scoreRecordHash;
  delete scoreWriter.receiptHash;
  scoreWriter.receiptHash = sha256Json(scoreWriter);
  writeJson(scoreWriterReceiptPath, scoreWriter);
  const updatedScoreWriterRef = {
    ...scoreWriterRef,
    contentHash: sha256Text(readFileSync(scoreWriterReceiptPath, 'utf8')),
    receiptHash: scoreWriter.receiptHash,
  };
  writeSelfHashJson(path.join(absoluteRoundDir, 'score-writer-invocation-state.json'), 'stateHash', {
    status: 'committed',
    receiptHash: updatedScoreWriterRef.receiptHash,
  });
  const scoreRef = writeAuditTriadReceiptRef(input.root, path.join(roundDir, 'score-receipt.json'), {
    schemaVersion: 'run-auditor-host-score-receipt/v1',
    bindingHash: sha256Json(binding),
    scoreWriterInvocationReceiptRef: updatedScoreWriterRef,
    scoreRecordHash,
  });
  const closeoutRef = writeAuditTriadReceiptRef(input.root, path.join(roundDir, 'host-closeout-receipt.json'), {
    schemaVersion: 'run-auditor-host-closeout-receipt/v1',
    bindingHash: sha256Json(binding),
    scoreReceiptPath: scoreRef.path,
    scoreReceiptHash: scoreRef.receiptHash,
    scoreWriterInvocationReceiptRef: updatedScoreWriterRef,
    auditStatus: 'PASS',
    closeoutApproved: true,
  });
  const materializedRound = {
    ...input.round,
    providerInvocationReceiptRef: providerRef,
    judgeExecutionReceiptRef: judgeRef,
    readonlyAuditorHostInvocationReceiptRef: hostRef,
    scoreWriterInvocationReceiptRef: updatedScoreWriterRef,
    scoreReceiptRefs: [scoreRef.path],
    runAuditorHostReceiptRefs: [closeoutRef.path],
    judgeAdapterHostExecution: {
      adapterKind: 'package_cli_external_adapter',
      commandHash: sha256Text('claude'),
      exitCode: 0,
      stdoutPath: judgeStdoutPath.replace(/\\/gu, '/'),
      stdoutHash: sha256Text(readFileSync(judgeStdoutPath, 'utf8')),
      stderrPath: judgeStderrPath.replace(/\\/gu, '/'),
      stderrHash: sha256Text(readFileSync(judgeStderrPath, 'utf8')),
    },
  };
  const { receiptHash: _oldReceiptHash, ...roundWithoutHash } = materializedRound;
  return {
    ...materializedRound,
    receiptHash: sha256Json(roundWithoutHash),
  };
}

function materializePostRepairAuditGateFixture(input: {
  fixture: ReturnType<typeof materializeRequirementFixture>;
  compiled: ReturnType<typeof writeCompiledImplementPacket>;
}): {
  plan: AuditTriadExecutionPlan;
  planPath: string;
  roundsPath: string;
  repairReceiptPath: string;
  feedbackDispatchPath: string;
} {
  const { fixture, compiled } = input;
  const auditAttemptId = `${fixture.runId}-post-repair-audit`;
  const preliminaryPlan = createAuditTriadExecutionPlan({
    projectRoot: fixture.root,
    recordId: fixture.recordId,
    stage: 'implement',
    callPoint: 'audit_review',
    attemptId: auditAttemptId,
    ...auditPlanSemanticBindings(fixture, compiled),
    sourceDocumentHash: fixture.sourceDocumentHash,
    implementationConfirmationHash: fixture.implementationConfirmationHash,
    modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
    auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
    goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
  });
  const sourceAuditEpochId = sha256Json({
    recordId: fixture.recordId,
    role: 'source-audit-epoch',
  });
  const sourceAuditTargetBundleHash = sha256Json({
    recordId: fixture.recordId,
    role: 'source-audit-target',
  });
  const sourceSemanticModelHash = sha256Json({
    recordId: fixture.recordId,
    role: 'source-semantic-model',
  });
  const sourceProjectionSetHash = sha256Json({
    recordId: fixture.recordId,
    role: 'source-projection-set',
  });
  const validatedGapRefs = [
    `gap:${sha256Json({ recordId: fixture.recordId, role: 'validated-gap' })}`,
  ];
  const sourceRoundReceiptRef = {
    path: `_bmad-output/runtime/requirement-records/${fixture.recordId}/audit-source/round.json`,
    contentHash: sha256Json({ recordId: fixture.recordId, role: 'source-round' }),
  };
  const sourceJudgeReceiptRef = {
    path: `_bmad-output/runtime/requirement-records/${fixture.recordId}/audit-source/judge.json`,
    contentHash: sha256Json({ recordId: fixture.recordId, role: 'source-judge' }),
  };
  const evidenceDir = path.join(
    fixture.root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    fixture.recordId,
    'audit-repair-evidence'
  );
  const feedbackDispatchPath = path.join(evidenceDir, 'repair-feedback-dispatch.json');
  const feedbackWithoutHash = {
    schemaVersion: 'audit-repair-feedback-dispatch/v1',
    recordId: fixture.recordId,
    attemptId: `${fixture.runId}-source-audit`,
    auditEpochId: sourceAuditEpochId,
    auditTargetBundleHash: sourceAuditTargetBundleHash,
    semanticModelHash: sourceSemanticModelHash,
    projectionSetHash: sourceProjectionSetHash,
    qualityRuleSetHash: preliminaryPlan.qualityRuleSetHash,
    roundIndex: 1,
    validatedGapRefs,
    priorRepairReceiptRefs: [],
    roundReceiptRef: sourceRoundReceiptRef,
    judgeReceiptRef: sourceJudgeReceiptRef,
  };
  const feedbackDispatch = {
    ...feedbackWithoutHash,
    dispatchHash: sha256Json(feedbackWithoutHash),
  };
  writeJson(feedbackDispatchPath, feedbackDispatch);

  const repairReceiptPath = path.join(evidenceDir, 'main-agent-repair-receipt.json');
  const repairReceiptWithoutHash = {
    schemaVersion: 'audit-main-agent-repair-receipt/v1',
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    sourceAuditEpochId,
    sourceAuditTargetBundleHash,
    remediationPacketId: `${fixture.runId}-remediation`,
    feedbackDispatchRef: {
      path: path.relative(fixture.root, feedbackDispatchPath).replace(/\\/gu, '/'),
      contentHash: sha256Text(readFileSync(feedbackDispatchPath, 'utf8')),
      dispatchHash: feedbackDispatch.dispatchHash,
    },
    sourceRoundReceiptRef,
    sourceJudgeReceiptRef,
    priorRepairReceiptRefs: [],
    validatedGapRefs,
    sourceSemanticModelHash,
    sourceProjectionSetHash,
    qualityRuleSetHash: preliminaryPlan.qualityRuleSetHash,
    repairedSemanticModelHash: preliminaryPlan.semanticModelHash,
    repairedProjectionSetHash: preliminaryPlan.projectionSetHash,
    repairedModelPacketHash: preliminaryPlan.modelPacketHash,
    repairedAuditReceiptHash: preliminaryPlan.auditReceiptHash,
    repairedGoalExecutionHash: preliminaryPlan.goalExecutionHash,
    repairedAuditTargetBundleHash: sha256Json({
      sourceDocumentHash: preliminaryPlan.sourceDocumentHash,
      semanticModelHash: preliminaryPlan.semanticModelHash,
      implementationConfirmationHash: preliminaryPlan.implementationConfirmationHash,
      projectionSetHash: preliminaryPlan.projectionSetHash,
      checkedProjectionQualityRuleCodes: preliminaryPlan.checkedProjectionQualityRuleCodes,
      qualityRuleSetHash: preliminaryPlan.qualityRuleSetHash,
      modelPacketHash: preliminaryPlan.modelPacketHash ?? null,
      auditReceiptHash: preliminaryPlan.auditReceiptHash ?? null,
      goalExecutionHash: preliminaryPlan.goalExecutionHash ?? null,
      vetoItemIds: preliminaryPlan.vetoItemIds,
      priorRepairReceiptRefs: [],
    }),
    changedHashFields: ['publicationHash'],
    executorTaskReportHash: sha256Json({
      packetId: `${fixture.runId}-remediation`,
      status: 'done',
    }),
    filesChanged: [compiled.compiledPromptRef.modelPacketPath],
    validationsRun: ['fixture-post-repair-publication'],
    executorEvidenceRefs: [
      path.relative(fixture.root, feedbackDispatchPath).replace(/\\/gu, '/'),
    ],
  };
  writeJson(repairReceiptPath, {
    ...repairReceiptWithoutHash,
    receiptHash: sha256Json(repairReceiptWithoutHash),
  });
  const priorRepairReceiptRefs = [
    {
      path: path.relative(fixture.root, repairReceiptPath).replace(/\\/gu, '/'),
      contentHash: sha256Text(readFileSync(repairReceiptPath, 'utf8')),
    },
  ];
  const plan = createAuditTriadExecutionPlan({
    projectRoot: fixture.root,
    recordId: fixture.recordId,
    stage: 'implement',
    callPoint: 'audit_review',
    attemptId: auditAttemptId,
    ...auditPlanSemanticBindings(fixture, compiled),
    sourceDocumentHash: fixture.sourceDocumentHash,
    implementationConfirmationHash: fixture.implementationConfirmationHash,
    modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
    auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
    goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
    priorRepairReceiptRefs,
  });
  const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
  const roundsPath = path.join(path.dirname(planPath), 'rounds.json');
  writeJson(roundsPath, [
    materializeRoundProducerArtifacts({
      root: fixture.root,
      plan,
      round: cleanRound(plan, `${auditAttemptId}-round-1`),
      roundIndex: 1,
    }),
    materializeRoundProducerArtifacts({
      root: fixture.root,
      plan,
      round: cleanRound(plan, `${auditAttemptId}-round-2`),
      roundIndex: 2,
    }),
    materializeRoundProducerArtifacts({
      root: fixture.root,
      plan,
      round: cleanRound(plan, `${auditAttemptId}-round-3`),
      roundIndex: 3,
    }),
  ]);
  return {
    plan,
    planPath,
    roundsPath,
    repairReceiptPath,
    feedbackDispatchPath,
  };
}

describe('main agent audit review gate', () => {
  it('records audit_review pass only after current execution closure and three no-gap receipt rounds', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
        ...auditPlanSemanticBindings(fixture, compiled),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-triad',
        fixture.runId,
        'rounds.json'
      );
      writeJson(roundsPath, [
        materializeRoundProducerArtifacts({
          root: fixture.root,
          plan,
          round: cleanRound(plan, 'r1'),
          roundIndex: 1,
        }),
        materializeRoundProducerArtifacts({
          root: fixture.root,
          plan,
          round: cleanRound(plan, 'r2'),
          roundIndex: 2,
        }),
        materializeRoundProducerArtifacts({
          root: fixture.root,
          plan,
          round: cleanRound(plan, 'r3'),
          roundIndex: 3,
        }),
      ]);

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        fixture.runId,
        '--plan',
        planPath,
        '--rounds',
        roundsPath,
        '--evaluated-at',
        '2026-05-30T12:00:00.000Z',
        '--evaluated-by',
        'test-agent',
        '--json',
      ]);

      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.currentMentalModel).toBe('audit_review');
      expect(record.lastEventType).toBe('audit_review_result_recorded');
      expect(record.sixModelResults.audit_review).toMatchObject({
        model: 'audit_review',
        status: 'pass',
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        blockingReasons: [],
      });
      expect(record.mentalModelTransitions.at(-1)).toMatchObject({
        fromModel: 'execution_closure',
        toModel: 'audit_review',
      });
      const reportPath = path.join(
        path.dirname(fixture.recordPath),
        'audit-triad',
        fixture.runId,
        'audit-review-report.json'
      );
      const receiptRef = record.runtimeStatusDecisionReceipts.find(
        (entry: { receipt?: { modelId?: string } }) =>
          entry.receipt?.modelId === 'audit_review'
      );
      expect(receiptRef).toBeTruthy();
      const runtimeReceiptPath = path.resolve(
        path.dirname(fixture.recordPath),
        receiptRef.path
      );
      expect(existsSync(reportPath)).toBe(true);
      expect(existsSync(runtimeReceiptPath)).toBe(true);
      const runtimeReceipt = JSON.parse(readFileSync(runtimeReceiptPath, 'utf8'));
      expect(validateRuntimeStatusDecisionReceipt(runtimeReceipt)).toBe(true);
      expect(runtimeReceipt).toMatchObject({
        modelId: 'audit_review',
        implementationAttemptId: fixture.runId,
        stageInputs: expect.arrayContaining([
          expect.objectContaining({
            role: 'audit_triad_execution_plan',
            path: planPath.replace(/\\/gu, '/'),
            hash: sha256Text(readFileSync(planPath, 'utf8')),
          }),
          expect.objectContaining({
            role: 'audit_triad_round_1',
            path: roundsPath.replace(/\\/gu, '/'),
            hash: sha256Text(readFileSync(roundsPath, 'utf8')),
          }),
          expect.objectContaining({
            role: 'audit_triad_run_auditor_host_receipt',
            hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          }),
        ]),
        deterministicGateOutputs: expect.arrayContaining([
          expect.objectContaining({
            role: 'audit_review_report',
            path: reportPath.replace(/\\/gu, '/'),
            hash: sha256Text(readFileSync(reportPath, 'utf8')),
          }),
        ]),
      });
      expect(record.artifactIndex).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            artifactType: 'runtime_status_decision_receipt',
            path: receiptRef.path,
            contentHash: runtimeReceipt.receiptHash,
          }),
          expect.objectContaining({
            artifactType: 'runtime_status_stage_input',
            path: planPath.replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(planPath, 'utf8')),
          }),
          expect.objectContaining({
            artifactType: 'runtime_status_deterministic_gate_output',
            path: reportPath.replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(reportPath, 'utf8')),
          }),
        ])
      );
      const runtimeDecision = resolveSixModelRuntimeDecision({
        record,
        attemptId: fixture.runId,
      });
      expect(
        runtimeDecision.blockingReasonRefs,
        JSON.stringify(runtimeDecision, null, 2)
      ).toEqual([]);
      expect(runtimeDecision.currentModelStatus).toBe('pass');
      expect(runtimeDecision.nextAction).toBe('run_closeout');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when round metadata references missing producer artifacts', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
        ...auditPlanSemanticBindings(fixture, compiled),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(path.dirname(planPath), 'rounds.json');
      writeJson(
        roundsPath,
        Array.from({ length: 3 }, (_, index) =>
          cleanRound(plan, `${fixture.runId}-missing-producer-${index + 1}`)
        )
      );
      let committedBundle: Record<string, unknown> | null = null;

      const gateArgs = [
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        fixture.runId,
        '--plan',
        planPath,
        '--rounds',
        roundsPath,
        '--json',
      ];
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-24T01:00:00.000Z'));
      const code = mainAuditReviewGate(
        gateArgs,
        {
          onCommitted: (bundle: Record<string, unknown>) => {
            committedBundle = bundle;
          },
        }
      );

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.sixModelResults.audit_review.blockingReasons).toContain(
        'round_1_provider_invocation_receipt_artifact_missing'
      );
      expect(committedBundle).toMatchObject({
        decision: 'blocked',
        report: {
          path: expect.stringContaining('audit-review-report.json'),
          contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        },
        control: {
          eventId: expect.any(String),
          eventHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          afterRecordHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          transactionId: expect.any(String),
        },
      });
      let recoveredBundle: Record<string, unknown> | null = null;
      vi.setSystemTime(new Date('2026-07-24T01:05:00.000Z'));
      expect(
        mainAuditReviewGate(gateArgs, {
          onCommitted: (bundle: Record<string, unknown>) => {
            recoveredBundle = bundle;
          },
        })
      ).toBe(1);
      expect(recoveredBundle).toMatchObject({
        control: {
          eventId: (committedBundle as Record<string, any>).control.eventId,
          eventHash: (committedBundle as Record<string, any>).control.eventHash,
          transactionId: (committedBundle as Record<string, any>).control.transactionId,
        },
      });
      const eventLogPath = path.join(path.dirname(fixture.recordPath), 'events', 'control-events.jsonl');
      const events = readFileSync(eventLogPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(events).toHaveLength(1);
      const payload = events[0].payload as Record<string, unknown>;
      const snapshotPath = String(payload.gateSnapshotPath);
      expect(existsSync(snapshotPath)).toBe(true);
      const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Record<string, unknown>;
      const snapshotHash = String(snapshot.snapshotHash);
      const { snapshotHash: _ignoredSnapshotHash, ...snapshotPayload } = snapshot;
      expect(snapshotHash).toBe(sha256ControlJson(snapshotPayload));
    } finally {
      vi.useRealTimers();
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('binds verified repair receipt and feedback dispatch into post-repair convergence', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      establishExecutionClosureAuthority(fixture, compiled);
      const evidence = materializePostRepairAuditGateFixture({ fixture, compiled });

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        evidence.plan.attemptId,
        '--plan',
        evidence.planPath,
        '--rounds',
        evidence.roundsPath,
        '--repair-receipt',
        evidence.repairReceiptPath,
        '--repair-feedback-dispatch',
        evidence.feedbackDispatchPath,
        '--evaluated-at',
        '2026-07-21T05:00:00.000Z',
        '--json',
      ]);

      expect(code).toBe(0);
      const reportPath = path.join(
        path.dirname(fixture.recordPath),
        'audit-triad',
        evidence.plan.attemptId,
        'audit-review-report.json'
      );
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report).toMatchObject({
        decision: 'pass',
        repairEvidence: {
          schemaVersion: 'audit-triad-repair-evidence-binding/v1',
          repairReceiptRefs: [
            {
              path: path.relative(fixture.root, evidence.repairReceiptPath).replace(/\\/gu, '/'),
              contentHash: sha256Text(readFileSync(evidence.repairReceiptPath, 'utf8')),
            },
          ],
          repairFeedbackDispatchRefs: [
            {
              path: path
                .relative(fixture.root, evidence.feedbackDispatchPath)
                .replace(/\\/gu, '/'),
              contentHash: sha256Text(readFileSync(evidence.feedbackDispatchPath, 'utf8')),
            },
          ],
          evidenceSetHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        },
        convergenceReceipt: {
          repairEvidence: {
            evidenceSetHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          },
        },
      });
      expect(report.convergenceReceipt.repairEvidence.evidenceSetHash).toBe(
        report.repairEvidence.evidenceSetHash
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when a verified repair receipt changes before the control commit', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      establishExecutionClosureAuthority(fixture, compiled);
      const evidence = materializePostRepairAuditGateFixture({ fixture, compiled });
      const recordBefore = readFileSync(fixture.recordPath, 'utf8');
      const reportPath = path.join(
        path.dirname(fixture.recordPath),
        'audit-triad',
        evidence.plan.attemptId,
        'audit-review-report.json'
      );

      expect(() =>
        mainAuditReviewGate(
          [
            '--requirement-record',
            fixture.recordPath,
            '--attempt-id',
            evidence.plan.attemptId,
            '--plan',
            evidence.planPath,
            '--rounds',
            evidence.roundsPath,
            '--repair-receipt',
            evidence.repairReceiptPath,
            '--repair-feedback-dispatch',
            evidence.feedbackDispatchPath,
            '--evaluated-at',
            '2026-07-21T05:01:00.000Z',
          ],
          {
            beforeControlCommit: () => {
              const receipt = JSON.parse(
                readFileSync(evidence.repairReceiptPath, 'utf8')
              ) as Record<string, unknown>;
              writeJson(evidence.repairReceiptPath, {
                ...receipt,
                changedAfterEvaluation: true,
              });
            },
          }
        )
      ).toThrow('audit_review_input_changed:repair_receipt_1');
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(recordBefore);
      expect(existsSync(reportPath)).toBe(false);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when the audit report path aliases the execution plan input', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
        ...auditPlanSemanticBindings(fixture, compiled),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        path.dirname(planPath),
        'rounds.json'
      );
      writeJson(roundsPath, [
        materializeRoundProducerArtifacts({
          root: fixture.root,
          plan,
          round: cleanRound(plan, 'r1'),
          roundIndex: 1,
        }),
        materializeRoundProducerArtifacts({
          root: fixture.root,
          plan,
          round: cleanRound(plan, 'r2'),
          roundIndex: 2,
        }),
        materializeRoundProducerArtifacts({
          root: fixture.root,
          plan,
          round: cleanRound(plan, 'r3'),
          roundIndex: 3,
        }),
      ]);
      const recordBefore = readFileSync(fixture.recordPath, 'utf8');
      const planBefore = readFileSync(planPath, 'utf8');

      expect(() =>
        mainAuditReviewGate([
          '--requirement-record',
          fixture.recordPath,
          '--attempt-id',
          fixture.runId,
          '--plan',
          planPath,
          '--rounds',
          roundsPath,
          '--report-path',
          planPath,
          '--evaluated-at',
          '2026-05-30T12:00:00.000Z',
        ])
      ).toThrow('audit_review_artifact_path_conflict');

      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(recordBefore);
      expect(readFileSync(planPath, 'utf8')).toBe(planBefore);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when the execution plan changes before the control commit', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
        ...auditPlanSemanticBindings(fixture, compiled),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(path.dirname(planPath), 'rounds.json');
      const reportPath = path.join(path.dirname(planPath), 'audit-review-report.json');
      writeJson(roundsPath, [
        cleanRound(plan, 'r1'),
        cleanRound(plan, 'r2'),
        cleanRound(plan, 'r3'),
      ]);
      const recordBefore = readFileSync(fixture.recordPath, 'utf8');

      expect(() =>
        mainAuditReviewGate(
          [
            '--requirement-record',
            fixture.recordPath,
            '--attempt-id',
            fixture.runId,
            '--plan',
            planPath,
            '--rounds',
            roundsPath,
            '--report-path',
            reportPath,
            '--evaluated-at',
            '2026-05-30T12:00:00.000Z',
          ],
          {
            beforeControlCommit: () =>
              writeJson(planPath, {
                ...plan,
                currentEvidenceHash: `sha256:${'9'.repeat(64)}`,
              }),
          }
        )
      ).toThrow('audit_review_input_changed:plan');

      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(recordBefore);
      expect(existsSync(reportPath)).toBe(false);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when an evaluated round receipt changes before the control commit', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
        ...auditPlanSemanticBindings(fixture, compiled),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundPaths = Array.from({ length: 3 }, (_, index) => {
        const roundPath = path.join(
          path.dirname(planPath),
          'rounds',
          `round-${index + 1}`,
          'audit-triad-round-receipt.json'
        );
        writeJson(roundPath, cleanRound(plan, `round-${index + 1}`));
        return roundPath;
      });
      const reportPath = path.join(path.dirname(planPath), 'audit-review-report.json');
      const recordBefore = readFileSync(fixture.recordPath, 'utf8');

      expect(() =>
        mainAuditReviewGate(
          [
            '--requirement-record',
            fixture.recordPath,
            '--attempt-id',
            fixture.runId,
            '--plan',
            planPath,
            ...roundPaths.flatMap((roundPath) => ['--round', roundPath]),
            '--report-path',
            reportPath,
            '--evaluated-at',
            '2026-07-23T17:30:00.000Z',
          ],
          {
            beforeControlCommit: () => {
              const round = JSON.parse(readFileSync(roundPaths[1], 'utf8')) as Record<
                string,
                unknown
              >;
              writeJson(roundPaths[1], {
                ...round,
                changedAfterEvaluation: true,
              });
            },
          }
        )
      ).toThrow('audit_review_input_changed:round_2');

      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(recordBefore);
      expect(existsSync(reportPath)).toBe(false);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed without score and runAuditorHost receipts', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-current',
        ...auditPlanSemanticBindings(fixture, compiled),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-triad',
        'audit-current',
        'rounds.json'
      );
      const withoutReceipts = (roundId: string): AuditTriadRoundReceipt => {
        const round = cleanRound(plan, roundId);
        delete round.scoreReceiptRefs;
        delete round.runAuditorHostReceiptRefs;
        return round;
      };
      writeJson(roundsPath, [withoutReceipts('r1'), withoutReceipts('r2'), withoutReceipts('r3')]);

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        'audit-current',
        '--plan',
        planPath,
        '--rounds',
        roundsPath,
        '--evaluated-at',
        '2026-05-30T12:00:00.000Z',
        '--json',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.sixModelResults.audit_review.status).toBe('blocked');
      expect(record.sixModelResults.audit_review.blockingReasons).toEqual(
        expect.arrayContaining([
          'round_1_score_receipt_ref_missing',
          'round_1_run_auditor_host_receipt_ref_missing',
        ])
      );
      expect(
        resolveSixModelRuntimeDecision({
          record,
          attemptId: String(record.currentAttemptId),
        }).nextAction
      ).toBe('dispatch_remediation');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('blocks audit_review when current rounds lack independent Critical Auditor provider evidence', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
        ...auditPlanSemanticBindings(fixture, compiled),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-triad',
        fixture.runId,
        'rounds.json'
      );
      writeJson(
        roundsPath,
        [cleanRound(plan, 'r1'), cleanRound(plan, 'r2'), cleanRound(plan, 'r3')].map(
          (round) => {
            const { independentProviderEvidence: _removed, ...withoutProviderEvidence } = round;
            return withoutProviderEvidence;
          }
        )
      );

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        fixture.runId,
        '--plan',
        planPath,
        '--rounds',
        roundsPath,
        '--evaluated-at',
        '2026-07-21T09:00:00.000Z',
        '--evaluated-by',
        'test-agent',
        '--json',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.sixModelResults.audit_review).toMatchObject({
        status: 'blocked',
        blockingReasons: expect.arrayContaining([
          'round_1_independent_provider_evidence_missing',
          'round_2_independent_provider_evidence_missing',
          'round_3_independent_provider_evidence_missing',
        ]),
      });
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when the triad plan uses placeholder current evidence', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-current',
        ...auditPlanSemanticBindings(fixture, compiled),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-triad',
        'audit-current',
        'rounds.json'
      );
      writeJson(roundsPath, [
        cleanRound(plan, 'r1'),
        cleanRound(plan, 'r2'),
        cleanRound(plan, 'r3'),
      ]);

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        'audit-current',
        '--plan',
        planPath,
        '--rounds',
        roundsPath,
        '--evaluated-at',
        '2026-05-30T12:00:00.000Z',
        '--json',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.sixModelResults.audit_review.blockingReasons).toContain(
        'audit_triad_plan_current_evidence_hash_placeholder'
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
