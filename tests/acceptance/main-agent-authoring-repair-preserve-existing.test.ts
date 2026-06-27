import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  mainMainAgentOrchestration,
  runMainAgentAuthoringRepair,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

const requireForTest = createRequire(import.meta.url);
const SKILL_SCRIPTS = path.join(
  process.cwd(),
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts'
);
const {
  extractImplementationConfirmation: extractImplementationConfirmationForHash,
  implementationConfirmationHashFor: implementationConfirmationHashForContract,
  sourceDocumentHashFor: sourceDocumentHashForContract,
} = requireForTest(path.join(SKILL_SCRIPTS, 'pre_render_definition_drilldown_lib.js'));

function fixedHash(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function sha256Json(value: unknown): string {
  return sha256Text(stableStringify(value));
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readInlineConfirmation(source: string): any {
  const text = readFileSync(source, 'utf8');
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) {
    throw new Error('implementationConfirmation block missing');
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  return (yaml.load(lines.slice(start, end).join('\n')) as any).implementationConfirmation;
}

function writeRichSource(root: string, recordId = 'REQ-AUTHORING-REPAIR-PRESERVE'): string {
  const source = path.join(root, 'docs', 'requirements', 'rich-source.md');
  mkdirSync(path.dirname(source), { recursive: true });
  const packetHash = fixedHash('a');
  const backRef = [
    `      derivedFromMustRef: MUST-001`,
    `      derivedFromPacketHash: ${packetHash}`,
    `      projectionStatus: synchronized`,
  ].join('\n');
  writeFileSync(
    source,
    [
      '# Rich Existing Source',
      '',
      'This source already contains a rich implementationConfirmation block.',
      '',
      '## Custom Semantic Notes',
      '',
      'CUSTOM-SECTION-MUST-STAY: Preserve this human-authored section exactly.',
      '',
      'implementationConfirmation:',
      '  contractSchemaVersion: 1',
      '  status: draft',
      `  recordId: ${recordId}`,
      `  requirementSetId: ${recordId}-SET`,
      '  entryFlow: standalone_tasks',
      '  entryFlowClass: task_packet_entry',
      '  workflowAdapter: direct',
      '  contractAuthoringRequired: true',
      '  confirmationLanguage: zh-CN',
      '  confirmationProfile: implementation_confirmation',
      '  requiredViewPacks: ["currentTargetMap"]',
      '  optionalViewPacks: []',
      '  confirmedAt: null',
      '  confirmedBy: null',
      '  sourceDocumentHash: null',
      '  confirmationRender:',
      '    htmlPath: null',
      '    summaryPath: null',
      '    reportPath: null',
      '    htmlHash: null',
      '    confirmationPhrase: null',
      '  preConfirmationDrilldown:',
      '    semanticKernelRef:',
      '      path: _bmad-output/runtime/requirement-records/REQ-AUTHORING-REPAIR-PRESERVE/authoring/semantic-kernel.json',
      `      hash: ${fixedHash('b')}`,
      '    mustDecompositionPacketRef:',
      '      path: _bmad-output/runtime/requirement-records/REQ-AUTHORING-REPAIR-PRESERVE/authoring/must_decomposition_packet.json',
      `      hash: ${packetHash}`,
      '      status: synchronized',
      '    criticalAuditor:',
      '      minimumRounds: 3',
      '      consecutiveNoNewGapRounds: 0',
      '      latestReceiptHash: null',
      '      convergenceVerdict: blocked',
      '    packetSourceReconciliation:',
      '      reportPath: _bmad-output/runtime/requirement-records/REQ-AUTHORING-REPAIR-PRESERVE/authoring/must_packet_source_reconciliation_report.json',
      '      verdict: blocked',
      '    preRenderGateReportPath: _bmad-output/runtime/requirement-records/REQ-AUTHORING-REPAIR-PRESERVE/authoring/pre-render-must-decomposition-gate-report.json',
      '  applicability:',
      '    governanceEvents:',
      '      applies: false',
      '      reasonCode: no_governance_event_or_control_envelope_changes',
      '    runtimeRecovery:',
      '      applies: false',
      '      reasonCode: no_resume_rerun_closeout_hook_ingest_or_trace_checkpoint_changes',
      '      requiresFunctionalResumeFailureCaseRegistry: false',
      '      activeRequirementResolutionRequired: false',
      '      retiredContextSurfaceForbidden: true',
      '    scoringDashboardSft:',
      '      applies: false',
      '      reasonCode: no_scoring_dashboard_sft_dataset_or_read_model_changes',
      '    currentTargetMap:',
      '      applies: true',
      '      reasonCode: rich_source_requires_current_target_map',
      '    scriptsAndHooks:',
      '      applies: false',
      '      reasonCode: no_script_hook_report_or_generated_artifact_changes',
      '    aiTddContractGate:',
      '      applies: true',
      '      reasonCode: rich_source_requires_ai_tdd_manifest_projection',
      '  must:',
      '    - id: MUST-001',
      '      text: "Preserve existing rich source contract and block confirmation until authoring repair converges."',
      '      evidenceRefs: ["EVD-001"]',
      '      coveredByTraceRows: ["TRACE-001"]',
      '      coveredBySequenceViews: ["SEQ-001"]',
      '      derivedFromMustRef: MUST-001',
      `      derivedFromPacketHash: ${packetHash}`,
      '      projectionStatus: synchronized',
      '  notDone:',
      '    - id: NEG-001',
      '      text: "Do not replace rich implementationConfirmation with generated simplified YAML."',
      '      evidenceRefs: ["EVD-001"]',
      '      whyItBlocksCompletion: "Overwrite would destroy author intent."',
      '      negativeAssertionRequired: true',
      '      coveredByFailurePath: ["FAIL-001"]',
      '  mustNot:',
      '    - id: OUT-001',
      '      text: "Do not claim delivery readiness from confirmation renderability."',
      '      scopeBoundary: confirmation_only',
      '      userApprovalRequiredIfChanged: true',
      '  evidence:',
      '    - id: EVD-001',
      '      text: "Authoring repair emits request/response/receipt artifacts without mutating the source."',
      '      gate: "npx vitest run tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts"',
      '      oracle: "Source text remains byte-identical while authoring artifacts advance."',
      '      requiredCommandRefs: ["CMD-001"]',
      '      artifactRefs: ["ART-001"]',
      ...backRef.split('\n'),
      '  openQuestions: []',
      '  failurePaths:',
      '    - id: FAIL-001',
      '      title: "Synthetic clean audit is attempted"',
      '      trigger: "No Critical Auditor response exists."',
      '      expectedBehavior: "Emit a round request and block."',
      '      forbiddenBehavior: "Do not fabricate no-new-gap receipts."',
      '      blocksCompletionWhenViolated: true',
      '      linkedNegIds: ["NEG-001"]',
      '      linkedEvidenceIds: ["EVD-001"]',
      ...backRef.split('\n'),
      '  edgeCases:',
      '    - id: EDGE-001',
      '      category: stale_audit_response',
      '      condition: "Source hash changes after request generation."',
      '      expectedBehavior: "Reject the stale response."',
      '      forbiddenBehavior: "Do not accept stale audit artifacts."',
      '      linkedFailurePathIds: ["FAIL-001"]',
      '      linkedEvidenceIds: ["EVD-001"]',
      ...backRef.split('\n'),
      '  traceRows:',
      '    - id: TRACE-001',
      '      covers: ["MUST-001", "NEG-001"]',
      '      taskRefs: ["TASK-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      contractValidationCommandRefs: ["CMD-001"]',
      '      deliveryEvidenceCommandRefs: ["CMD-001"]',
      '      acceptanceRefs: ["ACC-001", "E2E-001"]',
      '      sequenceViewRefs: ["SEQ-001"]',
      '      boundaryViewRefs: ["BOUNDARY-001"]',
      '      artifactRefs: ["ART-001"]',
      '      status: PENDING',
      ...backRef.split('\n'),
      '  acceptanceTests:',
      '    - id: ACC-001',
      '      file: tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts',
      '      covers: ["MUST-001"]',
      '      traceRows: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      failurePathRefs: ["FAIL-001"]',
      '      edgeCaseRefs: ["EDGE-001"]',
      '      commandRefs: ["CMD-001"]',
      '      positiveControl: true',
      '      expectedPreImplementationState: expected_red',
      '      oracle: "Authoring repair blocks until three validated no-new-gap responses."',
      ...backRef.split('\n'),
      '  e2eSuites:',
      '    - id: E2E-001',
      '      file: tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts',
      '      covers: ["NEG-001"]',
      '      traceRows: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      failurePathRefs: ["FAIL-001"]',
      '      edgeCaseRefs: ["EDGE-001"]',
      '      commandRefs: ["CMD-001"]',
      '      negativeControls: ["NEG-001"]',
      '      expectedPreImplementationState: expected_red',
      '      oracle: "No source overwrite occurs."',
      ...backRef.split('\n'),
      '  targetModificationPaths:',
      '    - id: TARGET-MOD-001',
      '      path: scripts/main-agent-orchestration.ts',
      '      changeType: modify',
      '      coverageRole: modify',
      '      intent: "Implement preserve-existing repair."',
      '      ownerModel: requirement_confirmation',
      '      requirementRefs: ["MUST-001"]',
      '      traceRefs: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      artifactRefs: ["ART-001"]',
      ...backRef.split('\n'),
      '    - id: TARGET-MOD-002',
      '      path: tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts',
      '      changeType: validation_only',
      '      coverageRole: validation_only',
      '      intent: "Validate request/response/receipt repair loop."',
      '      ownerModel: acceptance_tests',
      '      requirementRefs: ["MUST-001"]',
      '      traceRefs: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      artifactRefs: ["ART-001"]',
      ...backRef.split('\n'),
      '    - id: TARGET-MOD-003',
      '      path: _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts',
      '      changeType: modify',
      '      coverageRole: modify',
      '      intent: "Fail closed on missing pre-render gate."',
      '      ownerModel: renderer',
      '      requirementRefs: ["MUST-001"]',
      '      traceRefs: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      artifactRefs: ["ART-001"]',
      ...backRef.split('\n'),
      '    - id: TARGET-MOD-004',
      '      path: _bmad/skills/requirements-contract-authoring/SKILL.md',
      '      changeType: modify',
      '      coverageRole: modify',
      '      intent: "Document mandatory repair loop."',
      '      ownerModel: skill_definition',
      '      requirementRefs: ["MUST-001"]',
      '      traceRefs: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      artifactRefs: ["ART-001"]',
      ...backRef.split('\n'),
      '  sequenceViews:',
      '    - id: SEQ-001',
      '      title: "Preserve-existing authoring repair loop"',
      '      covers: ["MUST-001", "NEG-001"]',
      '  flowViews:',
      '    - id: FLOW-001',
      '      title: "Request response receipt gate flow"',
      '      covers: ["MUST-001"]',
      '  edgeCaseViews:',
      '    - id: EDGEVIEW-001',
      '      title: "Stale response is rejected"',
      '      covers: ["NEG-001"]',
      '      cases: ["EDGE-001"]',
      '  boundaryViews:',
      '    - id: BOUNDARY-001',
      '      title: "Confirmation is not delivery readiness"',
      '      covers: ["OUT-001"]',
      '  currentTargetMap:',
      '    schemaVersion: current-target-map/v1',
      '    displayProfile: closed_loop_current_target_map',
      '    introduction: "Preserve existing rich contract while authoring artifacts converge."',
      '    currentSummary:',
      '      - title: "Manual source update"',
      '        detail: "Source has rich implementationConfirmation."',
      '    targetSummary:',
      '      - title: "Pre-render ready source"',
      '        detail: "Authoring artifacts converge without source overwrite."',
      '    diffRows:',
      '      - dimension: "Critical Auditor"',
      '        currentState: "No response artifact"',
      '        targetState: "Three validated no-new-gap receipts"',
      '        action: "Generate request and ingest response"',
      '    process:',
      '      - phase: "Repair"',
      '        currentState: "blocked"',
      '        targetState: "pre_render_ready"',
      '    artifactPaths:',
      '      - path: "_bmad-output/runtime/requirement-records/REQ-AUTHORING-REPAIR-PRESERVE/authoring"',
      '        targetRole: "authoring artifacts"',
      '        traceRows: ["TRACE-001"]',
      '        evidenceRefs: ["EVD-001"]',
      '    canonicalArtifacts:',
      '      - targetPathOrField: "pre-render-must-decomposition-gate-report.json"',
      '        functionDescription: "Pre-render gate evidence"',
      '        controlPlaneRole: "confirmation gate"',
      '        traceRows: ["TRACE-001"]',
      '        evidenceRefs: ["EVD-001"]',
      '    existingArtifacts:',
      '      - currentPath: "docs/requirements/rich-source.md"',
      '        currentFunction: "Authoritative source"',
      '        targetTreatment: "preserve byte-identical source"',
      '        completionProofPolicy: "source_preservation_only"',
      '        traceRows: ["TRACE-001"]',
      '        evidenceRefs: ["EVD-001"]',
      '  aiTddContractExecutionManifestProjection:',
      '    AI-TDD-001:',
      '      id: AI-TDD-001',
      '      status: required',
      '      traceRows: ["TRACE-001"]',
      '  artifactAutomationPlan:',
      '    - id: ART-001',
      '      artifactId: ART-001',
      '      path: _bmad-output/runtime/requirement-records/REQ-AUTHORING-REPAIR-PRESERVE/authoring',
      '      artifactType: runtime_authoring_artifacts',
      '      sourceOfTruthRole: evidence',
      '      ownerModel: requirement_confirmation',
      '      producer: main-agent-orchestration',
      '      consumer: requirements-contract-authoring',
      '      inputArtifacts: ["rich-source.md"]',
      '      outputArtifacts: ["semantic-kernel.json", "must_decomposition_packet.json"]',
      '      canAffectControlFlow: false',
      '      traceRows: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      ...backRef.split('\n'),
      '    - id: ART-002',
      '      artifactId: ART-002',
      '      path: _bmad-output/runtime/requirement-records/REQ-AUTHORING-REPAIR-PRESERVE/confirmation/confirmation.html',
      '      artifactType: confirmation_html',
      '      sourceOfTruthRole: read_model',
      '      ownerModel: renderer',
      '      producer: render-requirements-confirmation-html',
      '      consumer: user',
      '      inputArtifacts: ["pre-render-must-decomposition-gate-report.json"]',
      '      outputArtifacts: ["confirmation.html"]',
      '      canAffectControlFlow: false',
      '      traceRows: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      ...backRef.split('\n'),
      '  requiredCommands:',
      '    - id: CMD-001',
      '      command: "npx vitest run tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts"',
      '      purpose: "Validate preserve-existing repair loop."',
      '      expected: "All tests pass."',
      '      targetFiles: ["scripts/main-agent-orchestration.ts"]',
      '      traceRows: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      ...backRef.split('\n'),
      '  closeoutReadinessPreview:',
      '    requiredCommands: ["CMD-001"]',
      '    orphanPolicy: "Authoring artifacts are required before render."',
      '    currentAttemptPolicy: "Confirmation render is not delivery readiness."',
      '    recordClosedPolicy: "Controlled closeout evidence is separate."',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function authoringPaths(root: string, recordId: string) {
  const dir = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring'
  );
  return {
    dir,
    kernel: path.join(dir, 'semantic-kernel.json'),
    packet: path.join(dir, 'must_decomposition_packet.json'),
    promotionReceipt: path.join(dir, 'promotion-receipt.json'),
    sourceMaterializationReceipt: path.join(dir, 'source-materialization-receipt.json'),
    request: (round: number) => path.join(dir, `critical-auditor-round-request-${round}.json`),
    response: (round: number) => path.join(dir, `critical-auditor-round-response-${round}.json`),
    receipt: (round: number) => path.join(dir, `critical-auditor-receipt-round-${round}.json`),
    gate: path.join(dir, 'pre-render-must-decomposition-gate-report.json'),
    reconciliation: path.join(dir, 'must_packet_source_reconciliation_report.json'),
    progress: path.join(dir, 'semantic-checkpoint-progress.json'),
    checkpointReceipt: (index: number) =>
      path.join(dir, `checkpoint-receipt-cp-${String(index).padStart(2, '0')}.json`),
    checkpointPersistenceEvidence: path.join(dir, 'checkpoint-persistence-evidence.json'),
  };
}

function expectReceiptBinding(paths: ReturnType<typeof authoringPaths>, round: number, verdict: string) {
  const request = readJson(paths.request(round));
  const receiptEnvelope = readJson(paths.receipt(round));
  const receipt = receiptEnvelope.criticalAuditorReceipt;
  expect(receipt).toMatchObject({
    roundIndex: round,
    requestHash: request.requestHash,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash: request.gateDryRun.gateDryRunHash,
  });
  expect(receipt.responseHash).toEqual(expect.stringMatching(/^sha256:[a-f0-9]{64}$/));
  expect((receipt.convergenceDecision as any).verdict).toBe(verdict);
  expect(receipt.sourceGapFixes ?? []).toEqual([]);
}

function writePromotionReceipt(
  root: string,
  source: string,
  recordId: string,
  requirementSetId = `${recordId}-SET`,
  options: { statusValue?: string; promotionStage?: string } = {}
): string {
  void requirementSetId;
  const receiptDir = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring'
  );
  const receiptPath = path.join(receiptDir, 'promotion-receipt.json');
  mkdirSync(receiptDir, { recursive: true });
  const sourceText = readFileSync(source, 'utf8');
  const targetHash = sha256Text(sourceText);
  const extracted = extractImplementationConfirmationForHash(sourceText);
  const semanticSourceHash = sourceDocumentHashForContract(
    sourceText,
    extracted.blockText,
    extracted.confirmation
  );
  const implementationConfirmationHash = implementationConfirmationHashForContract(
    extracted.confirmation
  );
  const sourceRel = rootRelative(root, source);
  const receipt: Record<string, unknown> = {
    ok: true,
    dryRun: false,
    preflightOnly: false,
    draftPath: sourceRel,
    targetPath: sourceRel,
    promotionStage: options.promotionStage ?? 'authoring-draft',
    allowedStatuses:
      options.promotionStage === 'current-source-receipt-refresh'
        ? ['draft', 'draft_updated_not_confirmation_ready', 'reconfirm_required', 'user_confirmed']
        : ['draft'],
    statusValue: options.statusValue ?? 'draft',
    confirmationReady: false,
    safePromotionAsDraft: options.promotionStage === 'current-source-receipt-refresh' ? false : true,
    requiresUserConfirmationBeforeExecution: true,
    manifestPath: `${sourceRel}.manifest.json`,
    targetHash,
    writeReceipt: {
      backupPath: null,
      finalHash: targetHash,
    },
    receiptPath: rootRelative(root, receiptPath),
    backupPath: null,
    audit: {
      status: null,
      ok: true,
      skipped: true,
      reason: 'authoring_draft_is_not_confirmation_ready',
    },
    preflight: {
      manifest: {
        ok: true,
        draftHash: targetHash,
        statusValue: options.statusValue ?? 'draft',
      },
    },
    authoringPromotionGate: {
      required: true,
      ok: true,
      decisions: {
        sourceMutation: {
          finalDecision: 'allow_source_materialization',
          sourceDocumentHashBefore: targetHash,
          sourceDocumentHashAfter: targetHash,
          targetRawHashBefore: targetHash,
          targetRawHashAfter: targetHash,
          semanticSourceHashBefore: semanticSourceHash,
          semanticSourceHashAfter: semanticSourceHash,
        },
      },
    },
    sourceDocumentHash: semanticSourceHash,
    implementationConfirmationHash,
    failureClass: null,
    warnings: [],
    residualRisks: ['reverse_audit_not_run_authoring_draft'],
  };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receiptPath;
}

function rootRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function initGitTracking(root: string, files: string[]): void {
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  expect(init.status, init.stderr || init.stdout).toBe(0);
  for (const file of files) {
    const add = spawnSync('git', ['add', rootRelative(root, file)], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(add.status, add.stderr || add.stdout).toBe(0);
  }
}

function markSourceUserConfirmed(source: string): void {
  const text = readFileSync(source, 'utf8');
  writeFileSync(source, text.replace(/\n {2}status: draft\n/u, '\n  status: user_confirmed\n'), 'utf8');
}

function writeSinglePassScaleArtifacts(root: string, source: string, recordId: string): void {
  const paths = authoringPaths(root, recordId);
  mkdirSync(paths.dir, { recursive: true });
  const assessment = {
    schemaVersion: 'contract-authoring-scale-assessment/v1',
    phase: 'initial_assessment',
    target: rootRelative(root, source),
    decision: 'single_pass_allowed',
    assessmentTrace: {
      visibleOutputStream: 'stderr',
      stdoutContract: 'json_only',
      start: {
        phase: 'initial_assessment',
        source: rootRelative(root, source),
        progressPath: rootRelative(root, paths.progress),
      },
      process: {
        scoreReason: 'single-pass fixture for current-source receipt refresh',
        triggeredHardTriggers: [],
        scoreBreakdown: [],
        hardTriggerBreakdown: [],
      },
      result: {
        phase: 'initial_assessment',
        decision: 'single_pass_final_allowed',
        authoringMode: 'semantic_kernel_then_packet',
        riskLevel: 'low',
        checkpointRequired: false,
        recommendedCheckpointCount: 0,
      },
    },
  };
  const assessmentPath = path.join(paths.dir, 'scale-assessment-initial.json');
  writeFileSync(assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`, 'utf8');
  const route = {
    schemaVersion: 'contract-authoring-scale-routing-decision/v1',
    latestCompletedPhase: 'initial_assessment',
    decision: 'single_pass_final_allowed',
    decisionSource: 'initial_assessment',
    nextAction: 'continue_pre_render_readiness',
    checkpointPersistenceSatisfied: false,
    initialAssessmentRef: {
      path: path.resolve(assessmentPath).replace(/\\/g, '/'),
      hash: sha256Json(assessment),
    },
  };
  writeFileSync(
    path.join(paths.dir, 'scale-routing-decision.json'),
    `${JSON.stringify(route, null, 2)}\n`,
    'utf8'
  );
}

function makePromotionReceiptStale(receiptPath: string): void {
  const receipt = readJson(receiptPath);
  const staleHash = fixedHash('9');
  receipt.targetHash = staleHash;
  receipt.writeReceipt.finalHash = staleHash;
  receipt.preflight.manifest.draftHash = staleHash;
  receipt.authoringPromotionGate.decisions.sourceMutation.sourceDocumentHashAfter = staleHash;
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
}

function makeCheckpointReceiptsStale(paths: ReturnType<typeof authoringPaths>): void {
  for (let index = 0; index < 9; index += 1) {
    const receiptPath = paths.checkpointReceipt(index);
    if (!existsSync(receiptPath)) continue;
    const receipt = readJson(receiptPath);
    receipt.sourceDocumentHash = fixedHash('7');
    receipt.implementationConfirmationHash = fixedHash('8');
    const { receiptHash, ...receiptPayload } = receipt;
    void receiptHash;
    receipt.receiptHash = sha256Json(receiptPayload);
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  }
}

function authoringExecutableHelpers(authoringDir: string): string[] {
  if (!existsSync(authoringDir)) return [];
  return readdirSync(authoringDir)
    .filter((name) => /\.(?:cjs|js|mjs|ps1)$/iu.test(name))
    .sort();
}

function checkedProjectionQualityRuleCodesForRequest(request: any): string[] {
  return (
    request.requiredResponseSchema?.checkedProjectionQualityRuleCodes ??
    request.projectionQualityGate?.requiredRuleCodes ??
    []
  );
}

function writeNoNewGapResponse(
  requestPath: string,
  responsePath: string,
  overrides: Record<string, unknown> = {}
) {
  const request = readJson(requestPath);
  const projectionRefs = request.packetProjectionSummary?.projectionRefs ?? [];
  const checkedProjectionGroups = request.packetProjectionSummary?.projectionGroups ?? [];
  const checkedProjectionQualityRuleCodes = checkedProjectionQualityRuleCodesForRequest(request);
  const body = {
    schemaVersion: 'critical-auditor-round-response/v1',
    requestHash: request.requestHash,
    recordId: request.recordId,
    roundIndex: request.roundIndex,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash: request.gateDryRun.gateDryRunHash,
    reconciliationIssueCount: request.gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups,
    checkedProjectionQualityRuleCodes,
    verdict: 'no_new_valid_gap',
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: projectionRefs.length ? [projectionRefs[0]] : [],
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${request.roundIndex}-BASELINE`,
        disposition: request.roundIndex === 1 ? 'new' : 'unchanged',
        evidenceRefs: [request.gateDryRun.reportPath],
      },
    ],
    rejectedGapCandidates: [
      { id: `REJ-${request.roundIndex}`, reason: 'no new valid gap detected' },
    ],
    validatedGaps: [],
    rationale: `Round ${request.roundIndex} found no new valid gap.`,
    ...overrides,
  };
  writeFileSync(responsePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return responsePath;
}

function writeNewValidGapResponse(
  requestPath: string,
  responsePath: string,
  overrides: Record<string, unknown> = {}
) {
  const request = readJson(requestPath);
  const projectionRefs = request.packetProjectionSummary?.projectionRefs ?? [];
  const checkedProjectionGroups = request.packetProjectionSummary?.projectionGroups ?? [];
  const checkedProjectionQualityRuleCodes = checkedProjectionQualityRuleCodesForRequest(request);
  const body = {
    schemaVersion: 'critical-auditor-round-response/v1',
    requestHash: request.requestHash,
    recordId: request.recordId,
    roundIndex: request.roundIndex,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash: request.gateDryRun.gateDryRunHash,
    reconciliationIssueCount: request.gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups,
    checkedProjectionQualityRuleCodes,
    verdict: 'new_valid_gap',
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: projectionRefs.length ? [projectionRefs[0]] : [],
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${request.roundIndex}-GAP`,
        disposition: 'new',
        evidenceRefs: [request.gateDryRun.reportPath],
      },
    ],
    gapCandidates: [{ id: `GAP-CANDIDATE-${request.roundIndex}` }],
    validatedGaps: [
      {
        id: `VALID-GAP-${request.roundIndex}`,
        status: 'open',
        repairActions: [
          {
            actionId: `REPAIR-${request.roundIndex}-001`,
            type: 'add_must',
            sourceSpan: { startLine: 1, endLine: 1 },
            sourceText: 'Add source-bound missing requirement.',
            targetField: 'implementationConfirmation.must',
            newValue: {
              id: 'MUST-REPAIR-001',
              text: 'Add source-bound missing requirement.',
            },
            reason: 'Critical Auditor found an omitted requirement.',
            mustRefs: request.mustRefs?.length ? [request.mustRefs[0]] : ['MUST-001'],
            requirementIds: ['REQ-REPAIR-001'],
          },
        ],
      },
    ],
    rejectedGapCandidates: [],
    rationale: `Round ${request.roundIndex} found a valid repairable gap.`,
    ...overrides,
  };
  writeFileSync(responsePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return responsePath;
}

function writeBlockedResponse(
  requestPath: string,
  responsePath: string,
  overrides: Record<string, unknown> = {}
) {
  const request = readJson(requestPath);
  const projectionRefs = request.packetProjectionSummary?.projectionRefs ?? [];
  const checkedProjectionGroups = request.packetProjectionSummary?.projectionGroups ?? [];
  const checkedProjectionQualityRuleCodes = checkedProjectionQualityRuleCodesForRequest(request);
  const body = {
    schemaVersion: 'critical-auditor-round-response/v1',
    requestHash: request.requestHash,
    recordId: request.recordId,
    roundIndex: request.roundIndex,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash: request.gateDryRun.gateDryRunHash,
    reconciliationIssueCount: request.gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups,
    checkedProjectionQualityRuleCodes,
    verdict: 'blocked',
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: projectionRefs.length ? [projectionRefs[0]] : [],
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${request.roundIndex}-BLOCKED`,
        disposition: 'new',
        evidenceRefs: [request.gateDryRun.reportPath],
      },
    ],
    validatedGaps: [],
        sourceMaterializationFindings: [
          {
            code: 'audit_dependency_unavailable',
            message: 'Audit dependency unavailable; this blocker is not a projection metadata synchronization issue.',
          },
        ],
    rationale: `Round ${request.roundIndex} blocked on non-semantic audit dependency.`,
    ...overrides,
  };
  writeFileSync(responsePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return responsePath;
}

function writeInsufficientAuditResponse(
  requestPath: string,
  responsePath: string,
  overrides: Record<string, unknown> = {}
) {
  const request = readJson(requestPath);
  const projectionRefs = request.packetProjectionSummary?.projectionRefs ?? [];
  const checkedProjectionGroups = request.packetProjectionSummary?.projectionGroups ?? [];
  const checkedProjectionQualityRuleCodes = checkedProjectionQualityRuleCodesForRequest(request);
  const body = {
    schemaVersion: 'critical-auditor-round-response/v1',
    requestHash: request.requestHash,
    recordId: request.recordId,
    roundIndex: request.roundIndex,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash: request.gateDryRun.gateDryRunHash,
    reconciliationIssueCount: request.gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups,
    checkedProjectionQualityRuleCodes,
    verdict: 'insufficient_audit',
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: projectionRefs.length ? [projectionRefs[0]] : [],
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${request.roundIndex}-INSUFFICIENT`,
        disposition: 'new',
        evidenceRefs: [request.gateDryRun.reportPath],
      },
    ],
    validatedGaps: [],
    invalidProofFindings: [
      {
        code: 'audit_evidence_incomplete',
        message: 'Audit response lacks enough evidence for convergence.',
      },
    ],
    rationale: `Round ${request.roundIndex} did not provide enough audit evidence.`,
    ...overrides,
  };
  writeFileSync(responsePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return responsePath;
}

function writeSingleMustRepairResponse(requestPath: string, responsePath: string) {
  return writeNewValidGapResponse(requestPath, responsePath, {
    validatedGaps: [
      {
        id: 'VALID-GAP-SINGLE-MUST',
        status: 'open',
        repairActions: [
          {
            actionId: 'REPAIR-SINGLE-MUST',
            type: 'add_must',
            sourceSpan: { startLine: 1, endLine: 1 },
            sourceText: 'Repair must rebuild the packet.',
            targetField: 'implementationConfirmation.must',
            newValue: {
              id: 'MUST-REBUILT-001',
              text: 'Repair must rebuild the packet.',
            },
            reason: 'Validated gap requires packet rebuild.',
            mustRefs: ['MUST-001'],
            requirementIds: ['REQ-REBUILT-001'],
          },
        ],
      },
    ],
  });
}

describe('main-agent authoring-repair preserve-existing lane', () => {
  it('rebuilds stale source-state currentTargetMap rows during preserve-existing repair', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-source-state-map-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-SOURCE-STATE';
      const source = writeRichSource(root, recordId);
      let sourceText = readFileSync(source, 'utf8');
      sourceText = sourceText.replace(
        'This source already contains a rich implementationConfirmation block.',
        [
          'This source already contains a rich implementationConfirmation block.',
          '',
          '## Source Current State',
          '',
          '- SOURCE-CURRENT-ANCHOR: current rich source behavior.',
          '',
          '## Source Target State',
          '',
          '- SOURCE-TARGET-ANCHOR: target rich source behavior.',
          '',
          'Current implementation evidence:',
          '',
          '- CURRENT-EVIDENCE-NOISE: current code reading must not be treated as a target state.',
        ].join('\n')
      );
      sourceText = sourceText.replace(
        [
          '  currentTargetMap:',
          '    schemaVersion: current-target-map/v1',
          '    displayProfile: closed_loop_current_target_map',
          '    introduction: "Preserve existing rich contract while authoring artifacts converge."',
          '    currentSummary:',
          '      - title: "Manual source update"',
          '        detail: "Source has rich implementationConfirmation."',
          '    targetSummary:',
          '      - title: "Pre-render ready source"',
          '        detail: "Authoring artifacts converge without source overwrite."',
          '    diffRows:',
          '      - dimension: "Critical Auditor"',
          '        currentState: "No response artifact"',
          '        targetState: "Three validated no-new-gap receipts"',
          '        action: "Generate request and ingest response"',
        ].join('\n'),
        [
          '  currentTargetMap:',
          '    schemaVersion: current-target-map/v1',
          '    displayProfile: closed_loop_current_target_map',
          '    introduction: "Existing product current/target projection."',
          '    sourceStateProjection:',
          '      mode: source_current_target_sections',
          '      currentSectionHeadings: ["Source Current State"]',
          '      targetSectionHeadings: ["Source Target State"]',
          '      currentRows:',
          '        - id: SOURCE-CURRENT-001',
          '          text: "SOURCE-CURRENT-ANCHOR: current rich source behavior."',
          '      targetRows:',
          '        - id: SOURCE-TARGET-001',
          '          text: "SOURCE-TARGET-ANCHOR: target rich source behavior."',
          '        - id: SOURCE-TARGET-002',
          '          text: "CURRENT-EVIDENCE-NOISE: current code reading must not be treated as a target state."',
          '    currentSummary:',
          '      - title: "Current rich source state"',
          '        detail: "SOURCE-CURRENT-ANCHOR: current rich source behavior."',
          '    targetSummary:',
          '      - title: "Target rich source state"',
          '        detail: "SOURCE-TARGET-ANCHOR: target rich source behavior. CURRENT-EVIDENCE-NOISE."',
          '    diffRows:',
          '      - id: CT-DIFF-002',
          '        dimension: "Product behavior semantics"',
          '        currentState: "SOURCE-CURRENT-ANCHOR: current rich source behavior."',
          '        targetState: "SOURCE-TARGET-ANCHOR: target rich source behavior. CURRENT-EVIDENCE-NOISE."',
          '        action: "Bind source-defined product current and target state."',
        ].join('\n')
      );
      writeFileSync(source, sourceText, 'utf8');
      writePromotionReceipt(root, source, recordId);
      initGitTracking(root, [source]);

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });

      expect(result.blockingStage).toBe('critical_auditor_round_required');
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'business_visual_proof_resync_materialized'
      );
      const confirmation = readInlineConfirmation(source);
      const currentTargetMapText = stableStringify(confirmation.currentTargetMap);
      expect(currentTargetMapText).toContain('SOURCE-CURRENT-ANCHOR');
      expect(currentTargetMapText).toContain('SOURCE-TARGET-ANCHOR');
      expect(currentTargetMapText).not.toContain('CURRENT-EVIDENCE-NOISE');
      expect(
        confirmation.currentTargetMap.sourceStateProjection.targetRows.map((row: any) => row.text)
      ).toEqual(['SOURCE-TARGET-ANCHOR: target rich source behavior.']);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it('resynchronizes legacy business visual views with explicit proof refs before pre-render ready', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-business-visual-resync-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      let sourceText = readFileSync(source, 'utf8');
      sourceText = sourceText
        .replace(
          [
            '  sequenceViews:',
            '    - id: SEQ-001',
            '      title: "Preserve-existing authoring repair loop"',
            '      covers: ["MUST-001", "NEG-001"]',
          ].join('\n'),
          [
            '  sequenceViews:',
            '    - id: SEQ-BUSINESS-001',
            '      title: "Legacy business happy path"',
            '      visualKind: happy',
            '      scope: business',
            '      covers: ["MUST-001"]',
            '    - id: SEQ-BUSINESS-FAILURE-001',
            '      title: "Legacy business failure path"',
            '      visualKind: failure',
            '      scope: business',
            '      covers: ["MUST-001", "NEG-001"]',
            '    - id: SEQ-001',
            '      title: "Preserve-existing authoring repair loop"',
            '      covers: ["MUST-001", "NEG-001"]',
          ].join('\n')
        )
        .replace(
          [
            '  flowViews:',
            '    - id: FLOW-001',
            '      title: "Request response receipt gate flow"',
            '      covers: ["MUST-001"]',
          ].join('\n'),
          [
            '  flowViews:',
            '    - id: FLOW-BUSINESS-STATE-001',
            '      title: "Legacy business state view"',
            '      visualKind: state',
            '      scope: business',
            '      covers: ["MUST-001"]',
            '    - id: FLOW-BUSINESS-001',
            '      title: "Legacy business flow view"',
            '      visualKind: flow',
            '      scope: business',
            '      covers: ["MUST-001"]',
            '    - id: FLOW-001',
            '      title: "Request response receipt gate flow"',
            '      covers: ["MUST-001"]',
          ].join('\n')
        )
        .replace(
          [
            '  edgeCaseViews:',
            '    - id: EDGEVIEW-001',
            '      title: "Stale response is rejected"',
            '      covers: ["NEG-001"]',
            '      cases: ["EDGE-001"]',
          ].join('\n'),
          [
            '  edgeCaseViews:',
            '    - id: EDGEVIEW-BUSINESS-001',
            '      title: "Legacy business edge view"',
             '      visualKind: edge',
             '      scope: business',
             '      covers: ["MUST-001", "NEG-001"]',
             '      cases:',
             '        - "legacy business edge remains human readable [MUST-001]"',
             '        - "EDGE-001"',
            '    - id: EDGEVIEW-001',
            '      title: "Stale response is rejected"',
            '      covers: ["NEG-001"]',
            '      cases: ["EDGE-001"]',
          ].join('\n')
      );
      sourceText = sourceText
        .replace(
          [
            '  currentTargetMap:',
            '    schemaVersion: current-target-map/v1',
            '    displayProfile: closed_loop_current_target_map',
            '    introduction: "Preserve existing rich contract while authoring artifacts converge."',
            '    currentSummary:',
            '      - title: "Manual source update"',
            '        detail: "Source has rich implementationConfirmation."',
            '    targetSummary:',
            '      - title: "Pre-render ready source"',
            '        detail: "Authoring artifacts converge without source overwrite."',
            '    diffRows:',
            '      - dimension: "Critical Auditor"',
            '        currentState: "No response artifact"',
            '        targetState: "Three validated no-new-gap receipts"',
            '        action: "Generate request and ingest response"',
          ].join('\n'),
          [
            '  currentTargetMap:',
            '    schemaVersion: current-target-map/v1',
            '    displayProfile: closed_loop_current_target_map',
            '    introduction: "Stale product current/target projection."',
            '    sourceStateProjection:',
            '      mode: source_current_target_sections',
            '      currentSectionHeadings: ["Source Current State"]',
            '      targetSectionHeadings: ["Source Target State"]',
            '      currentRows:',
            '        - id: SOURCE-CURRENT-001',
            '          text: "SOURCE-CURRENT-ANCHOR: current rich source behavior."',
            '      targetRows:',
            '        - id: SOURCE-TARGET-001',
            '          text: "SOURCE-TARGET-ANCHOR: target rich source behavior."',
            '        - id: SOURCE-TARGET-002',
            '          text: "CURRENT-EVIDENCE-NOISE: current code reading must not remain in target rows."',
            '    currentSummary:',
            '      - title: "Stale multi-timeframe state"',
            '        detail: "Current source anchors include 1m, 5m, 15m, 30m, 45m, D."',
            '    targetSummary:',
            '      - title: "Stale target state"',
            '        detail: "Target source-defined periods (1m, 5m, 15m, 30m, 45m, D). CURRENT-EVIDENCE-NOISE."',
            '    diffRows:',
            '      - id: CT-DIFF-002',
            '        dimension: "Default visibility and rollback-sensitive settings"',
            '        currentState: "Current source anchors for default/visibility behavior include 1m, 5m, 15m, 30m, 45m, D."',
            '        targetState: "Target source-defined periods (1m, 5m, 15m, 30m, 45m, D). CURRENT-EVIDENCE-NOISE."',
            '        action: "Bind stale source anchors."',
          ].join('\n')
        )
        .replace('      coverageRole: validate', '')
        .replace('      coverageRole: modify', '');
      sourceText = [
        sourceText,
        '',
        '## Definition of Done',
        '',
        '- Run the implementation readiness stage audit before any delivery-readiness claim.',
        '- Keep the AI-TDD pre-implementation gate bound before implementation dispatch.',
        '',
        '## Reverse Audit Report',
        '',
        'Audit command:',
        '',
        '```text',
        'node <skill-dir>/scripts/audit_contract_confirmability.js rich-source.md --json',
        '```',
        '',
        '## Residual Risk Statement',
        '',
        '- The source document is structurally detailed but still not user confirmed.',
        '- Listed tests are required future implementation evidence; they have not been created or run by this authoring task.',
        '- Unrelated untracked package.json and package-lock.json exist in the worktree and are intentionally out of scope.',
      ].join('\n');
      writeFileSync(source, sourceText, 'utf8');
      writePromotionReceipt(root, source, recordId);
      initGitTracking(root, [source]);
      const paths = authoringPaths(root, recordId);

      let result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      for (let round = 1; round <= 3; round += 1) {
        writeNoNewGapResponse(paths.request(round), paths.response(round));
        result = runMainAgentAuthoringRepair(root, {
          source,
          recordId,
          requirementSetId: `${recordId}-SET`,
          mode: 'preserve-existing',
          criticalAuditorResponse: paths.response(round),
        });
      }

      expect(result).toMatchObject({
        ok: true,
        status: 'pre_render_ready',
        blockingStage: null,
      });
      const repairedSourceText = readFileSync(source, 'utf8');
      expect(repairedSourceText).toContain('## Definition of Done');
      expect(repairedSourceText).toContain('implementation readiness stage audit');
      expect(repairedSourceText).toContain('AI-TDD pre-implementation gate');
      const confirmation = readInlineConfirmation(source);
      const businessViews = [
        ...confirmation.sequenceViews,
        ...confirmation.flowViews,
        ...confirmation.edgeCaseViews,
      ].filter((view: any) => view.scope === 'business' && view.visualKind);
      expect(businessViews.map((view: any) => view.visualKind).sort()).toEqual([
        'edge',
        'failure',
        'flow',
        'happy',
        'state',
      ]);
      const traceIds = confirmation.traceRows.map((row: any) => row.id);
      const evidenceIds = confirmation.evidence.map((row: any) => row.id);
      const acceptanceIds = [
        ...confirmation.acceptanceTests.map((row: any) => row.id),
        ...confirmation.e2eSuites.map((row: any) => row.id),
      ];
      const traceRowsById = new Map(confirmation.traceRows.map((row: any) => [row.id, row]));
      for (const view of businessViews) {
        expect(view.traceRows, `${view.id} traceRows`).toEqual(expect.arrayContaining(traceIds));
        expect(view.evidenceRefs, `${view.id} evidenceRefs`).toEqual(expect.arrayContaining(evidenceIds));
        expect(view.acceptanceRefs, `${view.id} acceptanceRefs`).toEqual(expect.arrayContaining(acceptanceIds));
        for (const traceRef of view.traceRows) {
          const trace = traceRowsById.get(traceRef) as any;
          expect(
            [
              ...(trace.sequenceViewRefs ?? []),
              ...(trace.flowViewRefs ?? []),
              ...(trace.edgeCaseViewRefs ?? []),
              ...(trace.viewRefs ?? []),
              ...(trace.diagramRefs ?? []),
            ],
            `${traceRef} reciprocates ${view.id}`
          ).toContain(view.id);
        }
      }
      expect(businessViews.find((view: any) => view.visualKind === 'failure')?.failurePathRefs).toEqual(
        expect.arrayContaining(confirmation.failurePaths.map((row: any) => row.id))
      );
      expect(businessViews.find((view: any) => view.visualKind === 'edge')?.edgeCaseRefs).toEqual(
        expect.arrayContaining(confirmation.edgeCases.map((row: any) => row.id))
      );
      expect(businessViews.find((view: any) => view.visualKind === 'edge')?.edgeCaseRefs).not.toContain(
        'legacy business edge remains human readable [MUST-001]'
      );
      const targetPathRows = confirmation.targetModificationPaths as Array<Record<string, unknown>>;
      expect(targetPathRows.find((row) => row.path === 'scripts/main-agent-orchestration.ts')).toMatchObject({
        changeType: 'modify',
        coverageRole: 'modify',
      });
      expect(
        targetPathRows.find(
          (row) =>
            row.path === 'tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts'
        )
      ).toMatchObject({
        changeType: 'validation_only',
        coverageRole: 'validation_only',
      });
      const currentTargetMapText = stableStringify(confirmation.currentTargetMap);
      expect(confirmation.currentTargetMap.sourceDefaultVisibility).toMatchObject({
        visible: [],
        hidden: [],
      });
      expect((confirmation.currentTargetMap.diffRows as Array<Record<string, unknown>>).map((row) => row.id)).toContain(
        'CT-DIFF-002'
      );
      expect(currentTargetMapText).not.toContain('Current source anchors for default/visibility behavior include');
      expect(currentTargetMapText).not.toContain('Target source-defined periods');
      expect(currentTargetMapText).not.toContain('CURRENT-EVIDENCE-NOISE');
      expect(currentTargetMapText).not.toMatch(/(?:include|includes|periods|entries)[^.;]*1m/iu);
      expect(currentTargetMapText).not.toContain('Residual Risk Statement');
      expect(currentTargetMapText).not.toContain('still not user confirmed');
      expect(currentTargetMapText).not.toContain('Listed tests are required future implementation evidence');
      expect(currentTargetMapText).not.toContain('untracked package.json');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('authoring-repair accepts blocked auditor response without gap materialization', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-blocked-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const before = sha256Text(readFileSync(source, 'utf8'));
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeBlockedResponse(paths.request(1), paths.response(1));

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(result.blockingStage).toBe('critical_auditor_blocked');
      expect(result.nextRequiredAction).toBe('resolve_critical_auditor_blocker');
      expect(existsSync(paths.receipt(1))).toBe(true);
      expectReceiptBinding(paths, 1, 'blocked');
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(before);
      expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
        'source_gap_fix_materialization_required'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('authoring-repair accepts insufficient audit without repair actions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-insufficient-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const before = sha256Text(readFileSync(source, 'utf8'));
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeInsufficientAuditResponse(paths.request(1), paths.response(1));

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(result.blockingStage).toBe('critical_auditor_insufficient_audit');
      expect(result.nextRequiredAction).toBe('rewrite_current_critical_auditor_round_response');
      expect(existsSync(paths.receipt(1))).toBe(true);
      expectReceiptBinding(paths, 1, 'insufficient_audit');
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(before);
      expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
        'source_gap_fix_materialization_required'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocked and insufficient audit require verdict-specific evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-verdict-evidence-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const before = sha256Text(readFileSync(source, 'utf8'));
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeBlockedResponse(paths.request(1), paths.response(1), {
        sourceMaterializationFindings: [],
        falsePositiveProofs: [
          {
            blockerCode: 'synthetic_gate_blocker',
            proofType: 'current_source_packet_hash_match',
            evidenceRefs: ['gate-dry-run'],
          },
        ],
      });

      const blockedResult = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(blockedResult.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_blocked_evidence_missing'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);

      writeInsufficientAuditResponse(paths.request(1), paths.response(1), {
        invalidProofFindings: [],
        sourceMaterializationFindings: [
          {
            code: 'source_packet_projection_metadata_drift',
            message: 'source packet projection metadata drift is a blocker, not audit incompleteness.',
          },
        ],
      });

      const insufficientResult = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(insufficientResult.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_insufficient_audit_evidence_missing'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('new_valid_gap still requires unresolved validated gap', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-new-gap-empty-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const before = sha256Text(readFileSync(source, 'utf8'));
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeNewValidGapResponse(paths.request(1), paths.response(1), { validatedGaps: [] });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_new_valid_gap_missing_validated_gap'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('new_valid_gap still requires repair actions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-new-gap-no-actions-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const before = sha256Text(readFileSync(source, 'utf8'));
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeNewValidGapResponse(paths.request(1), paths.response(1), {
        validatedGaps: [{ id: 'VALID-GAP-NO-ACTIONS', status: 'open' }],
      });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_validated_gap_repair_actions_missing'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('projection metadata blocker routes to resync not semantic repair', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-metadata-drift-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const before = sha256Text(readFileSync(source, 'utf8'));
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeBlockedResponse(paths.request(1), paths.response(1), {
        sourceMaterializationFindings: [
          {
            code: 'packet_source_projection_metadata_drift',
            message: 'source packet projection metadata drift requires resynchronization',
          },
        ],
      });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(result.blockingStage).toBe('packet_source_projection_resynchronization_required');
      expect(result.nextRequiredAction).toBe('run_packet_source_projection_resynchronization');
      expect(existsSync(paths.receipt(1))).toBe(true);
      expectReceiptBinding(paths, 1, 'blocked');
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(before);
      expect(existsSync(paths.kernel)).toBe(true);
      expect(existsSync(paths.packet)).toBe(true);
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
      expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
        'source_gap_fix_materialization_required'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('source gap fix materialization required only applies to new valid gap', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-gap-fix-scope-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeNewValidGapResponse(paths.request(1), paths.response(1), {
        validatedGaps: [
          {
            id: 'VALID-GAP-INVALID-TARGET',
            status: 'open',
            repairActions: [
              {
                actionId: 'REPAIR-INVALID-TARGET',
                type: 'add_must',
                sourceSpan: { startLine: 1, endLine: 1 },
                sourceText: 'Invalid target field should fail materialization.',
                targetField: 'implementationConfirmation.unknownField',
                newValue: { id: 'MUST-INVALID-TARGET', text: 'Invalid target field.' },
                reason: 'The materializer must reject target fields that do not match the action type.',
                mustRefs: ['MUST-001'],
                requirementIds: ['REQ-INVALID-TARGET'],
              },
            ],
          },
        ],
      });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(result.blockingStage).toBe('source_gap_fix_materialization_required');
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'source_gap_fix_materialization_required'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid Critical Auditor repair actions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-action-schema-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });

      writeNewValidGapResponse(paths.request(1), paths.response(1), {
        validatedGaps: [{ id: 'VALID-GAP-NO-ACTIONS', status: 'open' }],
      });
      let result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_validated_gap_repair_actions_missing'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);

      writeNewValidGapResponse(paths.request(1), paths.response(1), {
        validatedGaps: [
          {
            id: 'VALID-GAP-UNKNOWN-TYPE',
            status: 'open',
            repairActions: [
              {
                actionId: 'REPAIR-UNKNOWN-TYPE',
                type: 'invent_semantics',
                sourceSpan: { startLine: 1, endLine: 1 },
                sourceText: 'Invalid action type.',
                targetField: 'implementationConfirmation.must',
                newValue: { id: 'MUST-INVALID', text: 'Invalid action type.' },
                reason: 'Unknown type must fail closed.',
                mustRefs: ['MUST-001'],
                requirementIds: ['REQ-INVALID'],
              },
            ],
          },
        ],
      });
      result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_repair_action_type_unknown'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);

      writeNewValidGapResponse(paths.request(1), paths.response(1), {
        validatedGaps: [
          {
            id: 'VALID-GAP-MISSING-FIELD',
            status: 'open',
            repairActions: [
              {
                actionId: 'REPAIR-MISSING-FIELD',
                type: 'add_must',
                sourceSpan: { startLine: 1, endLine: 1 },
                sourceText: 'Missing reason should fail.',
                targetField: 'implementationConfirmation.must',
                newValue: { id: 'MUST-MISSING-FIELD', text: 'Missing reason should fail.' },
                mustRefs: ['MUST-001'],
                requirementIds: ['REQ-MISSING-FIELD'],
              },
            ],
          },
        ],
      });
      result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_repair_action_field_missing'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('materializes Critical Auditor repair actions into semantic contract fields', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-materialize-actions-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const request = readJson(paths.request(1));
      const actionBase = {
        sourceSpan: { startLine: 10, endLine: 11 },
        sourceText: 'Materialize every semantic field from a Critical Auditor gap.',
        reason: 'Semantic materialization must update contract fields.',
        mustRefs: ['MUST-001'],
        requirementIds: ['REQ-SEMANTIC-REPAIR'],
      };
      writeNewValidGapResponse(paths.request(1), paths.response(1), {
        validatedGaps: [
          {
            id: 'VALID-GAP-SEMANTIC',
            status: 'open',
            repairActions: [
              {
                actionId: 'REPAIR-ADD-MUST',
                type: 'add_must',
                targetField: 'implementationConfirmation.must',
                newValue: { id: 'MUST-REPAIR-001', text: 'Repair adds a business MUST.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-SPLIT-MUST',
                type: 'split_must',
                targetField: 'implementationConfirmation.must',
                newValue: { id: 'MUST-REPAIR-002', text: 'Repair splits a broad MUST.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-NEG',
                type: 'add_neg',
                targetField: 'implementationConfirmation.negativeRequirements',
                newValue: { id: 'NEG-REPAIR-001', text: 'Repair adds a negative requirement.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-OUT',
                type: 'add_out',
                targetField: 'implementationConfirmation.outOfScope',
                newValue: { id: 'OUT-REPAIR-001', text: 'Repair adds an out-of-scope boundary.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-EVD',
                type: 'add_evidence',
                targetField: 'implementationConfirmation.evidence',
                newValue: { id: 'EVD-REPAIR-001', text: 'Repair adds evidence.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-TRACE',
                type: 'add_trace',
                targetField: 'implementationConfirmation.traceRows',
                newValue: { id: 'TRACE-REPAIR-001', covers: ['MUST-REPAIR-001'] },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-ACC',
                type: 'add_acc',
                targetField: 'implementationConfirmation.acceptanceCriteria',
                newValue: { id: 'ACC-REPAIR-001', file: 'tests/acceptance/repair.test.ts' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-E2E',
                type: 'add_e2e',
                targetField: 'implementationConfirmation.e2eScenarios',
                newValue: { id: 'E2E-REPAIR-001', file: 'tests/e2e/repair.e2e.ts' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-BUSINESS',
                type: 'add_business_view',
                targetField: 'implementationConfirmation.businessViews',
                newValue: { id: 'BUSINESS-VIEW-REPAIR-001', title: 'Repair business view' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-TARGET',
                type: 'replace_target_path',
                targetField: 'implementationConfirmation.targetModificationPaths',
                newValue: {
                  id: 'TARGET-MOD-REPAIR-001',
                  path: 'src/repair-target.ts',
                  coverageRole: 'modify',
                },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-COMMAND',
                type: 'replace_validation_command',
                targetField: 'implementationConfirmation.requiredCommands',
                newValue: {
                  id: 'CMD-REPAIR-001',
                  command: 'npm run repair:test',
                  targetFiles: ['src/repair-target.ts'],
                },
                ...actionBase,
              },
            ],
          },
        ],
        reviewedProjectionRefs: request.packetProjectionSummary.projectionRefs.length
          ? [request.packetProjectionSummary.projectionRefs[0]]
          : [],
      });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'critical_auditor_round_required',
        nextRequiredAction: 'write_critical_auditor_round_response',
        consecutiveNoNewGapRounds: 0,
      });
      const confirmation = readInlineConfirmation(source);
      expect(confirmation.must.map((row: any) => row.id)).toEqual(
        expect.arrayContaining(['MUST-REPAIR-001', 'MUST-REPAIR-002'])
      );
      expect(confirmation.notDone.map((row: any) => row.id)).toContain('NEG-REPAIR-001');
      expect(confirmation.negativeRequirements.map((row: any) => row.id)).toContain(
        'NEG-REPAIR-001'
      );
      expect(confirmation.mustNot.map((row: any) => row.id)).toContain('OUT-REPAIR-001');
      expect(confirmation.outOfScope.map((row: any) => row.id)).toContain('OUT-REPAIR-001');
      expect(confirmation.evidence.map((row: any) => row.id)).toContain('EVD-REPAIR-001');
      expect(confirmation.traceRows.map((row: any) => row.id)).toContain('TRACE-REPAIR-001');
      expect(confirmation.acceptanceTests.map((row: any) => row.id)).toContain('ACC-REPAIR-001');
      expect(confirmation.acceptanceCriteria.map((row: any) => row.id)).toContain(
        'ACC-REPAIR-001'
      );
      expect(confirmation.e2eSuites.map((row: any) => row.id)).toContain('E2E-REPAIR-001');
      expect(confirmation.e2eScenarios.map((row: any) => row.id)).toContain('E2E-REPAIR-001');
      expect(confirmation.businessViews.map((row: any) => row.id)).toContain(
        'BUSINESS-VIEW-REPAIR-001'
      );
      expect(confirmation.targetModificationPaths.map((row: any) => row.path)).toContain(
        'src/repair-target.ts'
      );
      expect(confirmation.requiredCommands.map((row: any) => row.command)).toContain(
        'npm run repair:test'
      );
      expect(confirmation.sourceGapFixes).toHaveLength(1);
      expect(confirmation.sourceGapFixes[0].appliedActions).toHaveLength(11);
      expect(confirmation.sourceGapFixes[0].targetFieldsChanged).toEqual(
        expect.arrayContaining([
          'must',
          'notDone',
          'negativeRequirements',
          'mustNot',
          'outOfScope',
          'evidence',
          'traceRows',
          'acceptanceTests',
          'acceptanceCriteria',
          'e2eSuites',
          'e2eScenarios',
          'businessViews',
          'targetModificationPaths',
          'requiredCommands',
        ])
      );
      expect(confirmation.sourceGapFixes[0].semanticHashBefore).not.toBe(
        confirmation.sourceGapFixes[0].semanticHashAfter
      );
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'semantic_repair_transaction_restarted'
      );
      expect(existsSync(paths.request(1))).toBe(true);
      const restartedRequest = readJson(paths.request(1));
      const rebuiltPacket = readJson(paths.packet).must_decomposition_packet;
      expect(restartedRequest.roundIndex).toBe(1);
      expect(restartedRequest.packetHash).toBe(rebuiltPacket.packetHash);
      expect(restartedRequest.sourceDocumentHash).toBe(result.sourceDocumentHash);
      expect(restartedRequest.implementationConfirmationHash).toBe(
        result.implementationConfirmationHash
      );
      expect(result.artifacts.some((artifact: string) => artifact.includes('/archive/'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not promote source-bound prose during preserve-existing repair', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-source-bound-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const original = readFileSync(source, 'utf8');
      const enriched = original.replace(
        '## Custom Semantic Notes\n\nCUSTOM-SECTION-MUST-STAY',
        [
          '## Custom Semantic Notes',
          '',
          '### Source-bound business requirements',
          '',
          '- 系统必须保留源文档中的新增业务需求，不得只审计 inline MUST。',
          '- 验收：repair packet 必须包含源文档新增需求。',
          '',
          'CUSTOM-SECTION-MUST-STAY',
        ].join('\n')
      );
      writeFileSync(source, enriched, 'utf8');
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'critical_auditor_round_required',
      });
      const kernel = readJson(paths.kernel).semanticKernel;
      const packet = readJson(paths.packet).must_decomposition_packet;
      expect(kernel.mustCandidates).toEqual(['MUST-001']);
      expect(kernel.sourceRequirementTexts).toContain(
        'Preserve existing rich source contract and block confirmation until authoring repair converges.'
      );
      expect(kernel.sourceRequirementTexts).not.toEqual(
        expect.arrayContaining([
          '系统必须保留源文档中的新增业务需求，不得只审计 inline MUST。',
          '验收：repair packet 必须包含源文档新增需求。',
        ])
      );
      expect(packet.mustRefs).toEqual(['MUST-001']);
      expect(packet.sourceRequirementTexts).toEqual(kernel.sourceRequirementTexts);
      const repairedSource = readFileSync(source, 'utf8');
      expect(repairedSource).toContain('CUSTOM-SECTION-MUST-STAY');
      expect(repairedSource).toContain(
        '系统必须保留源文档中的新增业务需求，不得只审计 inline MUST。'
      );
      expect(repairedSource).toContain('验收：repair packet 必须包含源文档新增需求。');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rebuilds packet source reconciliation after semantic repair', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-packet-rebuild-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const originalRequest = readJson(paths.request(1));
      writeSingleMustRepairResponse(paths.request(1), paths.response(1));

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      const repairedConfirmation = readInlineConfirmation(source);
      const rebuiltPacket = readJson(paths.packet).must_decomposition_packet;
      const restartedRequest = readJson(paths.request(1));

      expect(repairedConfirmation.must.map((row: any) => row.id)).toContain('MUST-REBUILT-001');
      expect(rebuiltPacket.mustRefs).toContain('MUST-REBUILT-001');
      expect(rebuiltPacket.packetHash).not.toBe(originalRequest.packetHash);
      expect(rebuiltPacket.implementationConfirmationHash).toBe(
        result.implementationConfirmationHash
      );
      expect(restartedRequest.packetHash).toBe(rebuiltPacket.packetHash);
      expect(restartedRequest.mustRefs).toContain('MUST-REBUILT-001');
      expect(restartedRequest.previousReceipts).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('archives stale Critical Auditor artifacts and restarts round one after semantic repair', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-semantic-restart-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeSingleMustRepairResponse(paths.request(1), paths.response(1));
      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      const archiveArtifact = result.artifacts.find((artifact: string) => artifact.includes('/archive/'));
      expect(archiveArtifact).toBeTruthy();
      const archiveDir = path.join(root, archiveArtifact as string);
      const archiveManifest = readJson(path.join(archiveDir, 'archive-manifest.json'));
      expect(archiveManifest.reason).toBe('semantic_repair_transaction_restart');
      expect(archiveManifest.artifacts).toEqual(
        expect.arrayContaining([
          'critical-auditor-round-request-1.json',
          'critical-auditor-round-response-1.json',
          'critical-auditor-receipt-round-1.json',
        ])
      );
      expect(existsSync(paths.request(1))).toBe(true);
      expect(existsSync(paths.response(1))).toBe(false);
      expect(existsSync(paths.receipt(1))).toBe(false);
      const restartedRequest = readJson(paths.request(1));
      expect(restartedRequest.roundIndex).toBe(1);
      expect(restartedRequest.previousReceipts).toEqual([]);
      expect(result.consecutiveNoNewGapRounds).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves a rich implementationConfirmation and blocks with a Critical Auditor request when no response exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-preserve-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const original = readFileSync(source, 'utf8');
      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const paths = authoringPaths(root, recordId);

      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        mode: 'preserve-existing',
        blockingStage: 'critical_auditor_round_required',
        nextRequiredAction: 'write_critical_auditor_round_response',
      });
      expect(result.repairCommand).toContain('--action authoring-repair');
      expect(result.artifacts).toContain(rootRelative(root, paths.request(1)));
      expect(existsSync(paths.kernel)).toBe(true);
      expect(existsSync(paths.packet)).toBe(true);
      expect(existsSync(paths.request(1))).toBe(true);
      expect(existsSync(paths.gate)).toBe(false);
      expect(readFileSync(source, 'utf8')).toBe(original);
      expect(readFileSync(source, 'utf8')).toContain('CUSTOM-SECTION-MUST-STAY');
      expect(readFileSync(source, 'utf8')).toContain('requiredCommands:');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires three validated no-new-gap responses before pre-render readiness', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-three-rounds-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const original = readFileSync(source, 'utf8');
      const paths = authoringPaths(root, recordId);

      let result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      expect(result.blockingStage).toBe('critical_auditor_round_required');
      expect(readJson(paths.request(1)).roundPerspective.id).toBe('round_1_must_atomicity');
      expect(readJson(paths.request(1)).gateDryRun.gateDryRunHash).toMatch(/^sha256:/);

      writeNoNewGapResponse(paths.request(1), paths.response(1));
      result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result.status).toBe('blocked');
      expect(result.consecutiveNoNewGapRounds).toBe(1);
      expect(existsSync(paths.receipt(1))).toBe(true);
      expect(existsSync(paths.request(2))).toBe(true);
      expect(readJson(paths.request(2)).roundPerspective.id).toBe(
        'round_2_projection_materialization'
      );
      expect(existsSync(paths.gate)).toBe(false);

      writeNoNewGapResponse(paths.request(2), paths.response(2));
      result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(2),
      });
      expect(result.status).toBe('blocked');
      expect(result.consecutiveNoNewGapRounds).toBe(2);
      expect(existsSync(paths.request(3))).toBe(true);
      expect(readJson(paths.request(3)).roundPerspective.id).toBe(
        'round_3_authority_boundary_hash_delivery_confusion'
      );
      expect(existsSync(paths.gate)).toBe(false);

      writeNoNewGapResponse(paths.request(3), paths.response(3));
      result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(3),
      });
      expect(result).toMatchObject({
        ok: true,
        status: 'pre_render_ready',
        mode: 'preserve-existing',
        blockingStage: null,
        nextRequiredAction: 'render_confirmation_allowed',
        consecutiveNoNewGapRounds: 3,
      });
      expect(readJson(paths.gate).verdict).toBe('PASS');
      expect(readJson(paths.reconciliation).verdict).toBe('pass');
      expect(readJson(paths.progress).status).toBe('pre_render_ready');
      expect(readFileSync(source, 'utf8')).toBe(original);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('auto-archives stale Critical Auditor artifacts and restarts round one after the source changes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-stale-response-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      writeSinglePassScaleArtifacts(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeNoNewGapResponse(paths.request(1), paths.response(1));
      writeFileSync(source, `${readFileSync(source, 'utf8')}\nStale hash mutation.\n`, 'utf8');

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'critical_auditor_round_required',
        nextRequiredAction: 'write_critical_auditor_round_response',
        consecutiveNoNewGapRounds: 0,
      });
      const issueCodes = result.blockingIssues.map((issue: any) => issue.code);
      expect(
        issueCodes.some((code: string) =>
          code.endsWith('critical_auditor_round_request_1_json_sourceDocumentHash_stale')
        )
      ).toBe(true);
      expect(
        issueCodes.some((code: string) =>
          code.endsWith('critical_auditor_round_response_1_json_sourceDocumentHash_stale')
        )
      ).toBe(true);
      expect(readJson(paths.promotionReceipt).targetHash).toBe(
        sha256Text(readFileSync(source, 'utf8'))
      );
      expect(readJson(path.join(paths.dir, 'source-mutation-decision.json'))).toMatchObject({
        sourceDocumentHashAfter: sha256Text(readFileSync(source, 'utf8')),
        targetRawHashAfter: sha256Text(readFileSync(source, 'utf8')),
        semanticSourceHashAfter: result.sourceDocumentHash,
      });
      expect(existsSync(paths.receipt(1))).toBe(false);
      expect(existsSync(paths.request(1))).toBe(true);
      expect(existsSync(paths.request(2))).toBe(false);
      expect(authoringExecutableHelpers(paths.dir)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refreshes current-source checkpoint receipts before stale promotion receipt refresh', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-checkpoint-receipt-refresh-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const receiptPath = writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      makePromotionReceiptStale(receiptPath);
      makeCheckpointReceiptsStale(paths);

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'critical_auditor_round_required',
        nextRequiredAction: 'write_critical_auditor_round_response',
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
        'current_source_promotion_receipt_refresh_failed'
      );
      const refreshedPromotionReceipt = readJson(paths.promotionReceipt);
      expect(refreshedPromotionReceipt.targetHash).toBe(sha256Text(readFileSync(source, 'utf8')));
      const checkpointEvidence = readJson(paths.checkpointPersistenceEvidence);
      expect(checkpointEvidence.checkpointPersistenceSatisfiedCandidate).toBe(true);
      for (let index = 0; index < 9; index += 1) {
        const checkpointReceipt = readJson(paths.checkpointReceipt(index));
        expect(checkpointReceipt.sourceDocumentHash).toBe(result.sourceDocumentHash);
        expect(checkpointReceipt.implementationConfirmationHash).toBe(
          result.implementationConfirmationHash
        );
      }
      expect(authoringExecutableHelpers(paths.dir)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refreshes a stale current-source receipt for an already confirmed source without downgrading status', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-confirmed-refresh-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      markSourceUserConfirmed(source);
      const receiptPath = writePromotionReceipt(root, source, recordId, `${recordId}-SET`, {
        statusValue: 'user_confirmed',
        promotionStage: 'authoring-draft',
      });
      writeSinglePassScaleArtifacts(root, source, recordId);
      makePromotionReceiptStale(receiptPath);
      const paths = authoringPaths(root, recordId);

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });

      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'critical_auditor_round_required',
        nextRequiredAction: 'write_critical_auditor_round_response',
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
        'current_source_promotion_receipt_refresh_failed'
      );
      const refreshedPromotionReceipt = readJson(paths.promotionReceipt);
      expect(refreshedPromotionReceipt).toMatchObject({
        promotionStage: 'current-source-receipt-refresh',
        statusValue: 'user_confirmed',
        targetHash: sha256Text(readFileSync(source, 'utf8')),
        confirmationReady: false,
        safePromotionAsDraft: false,
        requiresUserConfirmationBeforeExecution: true,
      });
      expect(readFileSync(source, 'utf8')).toContain('status: user_confirmed');
      expect(existsSync(paths.request(1))).toBe(true);
      expect(authoringExecutableHelpers(paths.dir)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when current-source stale receipt refresh finds authoring helper scripts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-helper-denied-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const receiptPath = writePromotionReceipt(root, source, recordId);
      writeSinglePassScaleArtifacts(root, source, recordId);
      makePromotionReceiptStale(receiptPath);
      const paths = authoringPaths(root, recordId);
      writeFileSync(
        path.join(paths.dir, 'prepare-current-source-promotion.cjs'),
        'module.exports = {};\n',
        'utf8'
      );

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });

      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'current_source_promotion_refresh_failed_before_audit',
        nextRequiredAction: 'rerun_skill_local_current_source_promotion_or_fix_promotion_gate_blockers',
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'authoring_temporary_executable_helper_present'
      );
      expect(existsSync(paths.request(1))).toBe(false);
      expect(authoringExecutableHelpers(paths.dir)).toEqual([
        'prepare-current-source-promotion.cjs',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires gate dry-run binding fields and non-empty reviewedProjectionRefs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-schema-tight-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const request = readJson(paths.request(1));
      writeFileSync(
        paths.response(1),
        `${JSON.stringify(
          {
            schemaVersion: 'critical-auditor-round-response/v1',
            requestHash: request.requestHash,
            recordId: request.recordId,
            roundIndex: request.roundIndex,
            sourceDocumentHash: request.sourceDocumentHash,
            implementationConfirmationHash: request.implementationConfirmationHash,
            packetHash: request.packetHash,
            verdict: 'no_new_valid_gap',
            reviewedMustRefs: request.mustRefs,
            validatedGaps: [],
            rejectedGapCandidates: [],
            rationale: 'Missing required dry-run binding should fail.',
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      const codes = result.blockingIssues.map((issue: any) => issue.code);
      expect(codes).toContain('critical_auditor_response_gate_dry_run_hash_mismatch');
      expect(codes).toContain('critical_auditor_response_reviewed_projection_refs_missing');
      expect(codes).toContain('critical_auditor_response_prior_findings_disposition_missing');
      expect(codes).toContain('critical_auditor_response_checked_projection_group_missing');
      expect(existsSync(paths.receipt(1))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects no-new-gap when gate dry-run exposes actionable blockers', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-gate-blocker-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const original = readFileSync(source, 'utf8');
      const corrupted = original
        .replace(/^ {6,8}derivedFromMustRef: MUST-001\n/gm, '')
        .replace(/^ {6,8}derivedFromPacketHash: sha256:a{64}\n/gm, '')
        .replace(/^ {6,8}projectionStatus: synchronized\n/gm, '');
      writeFileSync(source, corrupted, 'utf8');
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const request = readJson(paths.request(1));
      expect(request.gateDryRun.actionableBlockingIssueCount).toBeGreaterThan(0);
      writeNoNewGapResponse(paths.request(1), paths.response(1));

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_no_new_gap_forbidden_by_gate_dry_run_blockers'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects Critical Auditor responses that reference unknown projection refs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-unknown-projection-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      writeNoNewGapResponse(paths.request(1), paths.response(1), {
        reviewedProjectionRefs: ['UNKNOWN-PROJECTION-REF'],
      });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'critical_auditor_response_invalid',
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_response_unknown_projection_ref'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exposes authoring-repair through the main-agent orchestration CLI action', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-cli-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const exitCode = mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'authoring-repair',
        '--source',
        source,
        '--record-id',
        recordId,
        '--requirement-set-id',
        `${recordId}-SET`,
        '--mode',
        'preserve-existing',
        '--json',
      ]);
      expect(exitCode).toBe(1);
      expect(existsSync(authoringPaths(root, recordId).request(1))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('warns when an authoritative docs/requirements source is ignored by git', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-gitignore-'));
    try {
      writeFileSync(path.join(root, '.gitignore'), 'docs/requirements/\n', 'utf8');
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      expect(result.warnings).toContainEqual({
        warning: 'source_document_ignored_by_git',
        recommendedAction: 'git add -f docs/requirements/rich-source.md',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
