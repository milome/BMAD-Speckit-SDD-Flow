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
  runMainAgentAuthoringRepair as runMainAgentAuthoringRepairRaw,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { criticalAuditorIndependentProviderRunHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence';

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
const authoringRepairAttemptIds = new Map<string, string>();

function ensureCriticalAuditorProviderConfig(root: string): void {
  const target = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  if (existsSync(target)) return;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(
    target,
    readFileSync(path.join(process.cwd(), '_bmad', '_config', 'governance-remediation.yaml'), 'utf8'),
    'utf8'
  );
}

function authoringRepairAttemptId(
  root: string,
  recordId = '',
  requirementSetId = ''
): string {
  const attemptKey = [path.resolve(root), recordId, requirementSetId].join('|');
  let implementationAttemptId = authoringRepairAttemptIds.get(attemptKey);
  if (!implementationAttemptId) {
    implementationAttemptId = `implementation-attempt-${crypto.randomUUID()}`;
    authoringRepairAttemptIds.set(attemptKey, implementationAttemptId);
  }
  return implementationAttemptId;
}

function runMainAgentAuthoringRepair(
  root: string,
  options: Parameters<typeof runMainAgentAuthoringRepairRaw>[1]
): ReturnType<typeof runMainAgentAuthoringRepairRaw> {
  ensureCriticalAuditorProviderConfig(root);
  const implementationAttemptId =
    options.implementationAttemptId ??
    authoringRepairAttemptId(root, options.recordId, options.requirementSetId);
  return runMainAgentAuthoringRepairRaw(root, {
    ...options,
    implementationAttemptId,
  });
}

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
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function sha256Json(value: unknown): string {
  return sha256Text(stableStringify(value));
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function snapshotTextFileHashes(rootDir: string): Record<string, string> {
  if (!existsSync(rootDir)) return {};
  const snapshot: Record<string, string> = {};
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
        continue;
      }
      snapshot[path.relative(rootDir, filePath).replace(/\\/g, '/')] = sha256Text(
        readFileSync(filePath, 'utf8')
      );
    }
  };
  visit(rootDir);
  return snapshot;
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

function rewriteInlineConfirmation(source: string, confirmation: Record<string, unknown>): void {
  const text = readFileSync(source, 'utf8');
  const start = text.indexOf('implementationConfirmation:');
  if (start < 0) {
    throw new Error('implementationConfirmation block missing');
  }
  const serialized = yaml.dump(
    { implementationConfirmation: confirmation },
    { lineWidth: -1, noRefs: true, sortKeys: false }
  );
  writeFileSync(source, `${text.slice(0, start)}${serialized}`, 'utf8');
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
      '      path: packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
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
      '      targetFiles: ["packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts"]',
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

function expectReceiptBinding(
  paths: ReturnType<typeof authoringPaths>,
  round: number,
  verdict: string
) {
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
    safePromotionAsDraft:
      options.promotionStage === 'current-source-receipt-refresh' ? false : true,
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
  writeFileSync(
    source,
    text.replace(/\n {2}status: draft\n/u, '\n  status: user_confirmed\n'),
    'utf8'
  );
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

function withIndependentProviderEvidence(
  request: Record<string, any>,
  response: Record<string, unknown>
): Record<string, unknown> {
  const binding = request.independentProviderBinding;
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    throw new Error('critical auditor request does not contain independentProviderBinding');
  }
  const evidenceWithoutRunHash = Object.fromEntries(
    Object.entries({
      ...binding,
      transactionId: request.transactionId,
      auditAttemptId: request.auditAttemptId,
      providerRunId: `critical-auditor-run/${String(request.requestHash).slice(-24)}`,
      requestHash: request.requestHash,
      responseHash: sha256Text(JSON.stringify(response)),
      sourceDocumentHash: request.sourceDocumentHash,
      semanticModelHash: request.semanticModelHash,
      projectionSetHash: request.projectionSetHash,
    }).filter(([, value]) => value !== undefined)
  );
  return {
    ...response,
    independentProviderEvidence: {
      ...evidenceWithoutRunHash,
      runHash: criticalAuditorIndependentProviderRunHash(evidenceWithoutRunHash),
    },
  };
}

function criticalAuditorResponseIdentity(request: Record<string, any>): Record<string, unknown> {
  return {
    requestHash: request.requestHash,
    recordId: request.recordId,
    roundIndex: request.roundIndex,
    transactionId: request.transactionId,
    auditAttemptId: request.auditAttemptId,
    namespaceVersion: request.namespaceVersion,
    sourceHash: request.sourceHash,
    sourceDocumentHash: request.sourceDocumentHash,
    semanticModelHash: request.semanticModelHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    projectionSetHash: request.projectionSetHash,
  };
}

function nextNumericId(existingIds: unknown[], prefix: string, offset = 1): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}-([0-9]{3})$`, 'u');
  const highest = existingIds.reduce((max, value) => {
    const match = String(value ?? '')
      .trim()
      .toUpperCase()
      .match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + offset).padStart(3, '0')}`;
}

function canonicalMustRefs(request: Record<string, any>): string[] {
  return (request.mustRefs ?? []).map((value: unknown) => {
    const id = String(value ?? '')
      .trim()
      .toUpperCase();
    const legacy = id.match(/^MUST-([0-9]{3})$/u);
    return legacy ? `MUST-FR-${legacy[1]}` : id;
  });
}

function firstRequestMustRef(request: Record<string, any>): string {
  const mustRef = String(request.mustRefs?.[0] ?? '').trim();
  if (!mustRef) throw new Error('critical auditor request must expose at least one mustRef');
  return mustRef;
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
    ...criticalAuditorResponseIdentity(request),
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
  const response = withIndependentProviderEvidence(request, body);
  writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');
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
  const sourceMustRef = firstRequestMustRef(request);
  const repairMustId = nextNumericId(canonicalMustRefs(request), 'MUST-FR');
  const body = {
    schemaVersion: 'critical-auditor-round-response/v1',
    ...criticalAuditorResponseIdentity(request),
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
              id: repairMustId,
              text: 'Add source-bound missing requirement.',
            },
            reason: 'Critical Auditor found an omitted requirement.',
            mustRefs: [sourceMustRef],
            requirementIds: [repairMustId],
          },
        ],
      },
    ],
    rejectedGapCandidates: [],
    rationale: `Round ${request.roundIndex} found a valid repairable gap.`,
    ...overrides,
  };
  const response = withIndependentProviderEvidence(request, body);
  writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');
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
    ...criticalAuditorResponseIdentity(request),
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
        message:
          'Audit dependency unavailable; this blocker is not a projection metadata synchronization issue.',
      },
    ],
    rationale: `Round ${request.roundIndex} blocked on non-semantic audit dependency.`,
    ...overrides,
  };
  const response = withIndependentProviderEvidence(request, body);
  writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');
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
    ...criticalAuditorResponseIdentity(request),
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
  const response = withIndependentProviderEvidence(request, body);
  writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');
  return responsePath;
}

function writeSingleMustRepairResponse(requestPath: string, responsePath: string) {
  const request = readJson(requestPath);
  const sourceMustRef = firstRequestMustRef(request);
  const mustId = nextNumericId(canonicalMustRefs(request), 'MUST-FR');
  writeNewValidGapResponse(requestPath, responsePath, {
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
              id: mustId,
              text: 'Repair must rebuild the packet.',
            },
            reason: 'Validated gap requires packet rebuild.',
            mustRefs: [sourceMustRef],
            requirementIds: [mustId],
          },
        ],
      },
    ],
  });
  return { responsePath, mustId };
}

describe('main-agent authoring-repair preserve-existing lane', () => {
  it('rejects caller-provided Critical Auditor response paths before ingest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-response-injection-'));
    try {
      const recordId = `REQ-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
      const source = writeRichSource(root, recordId);
      const responsePath = path.join(root, 'caller-provided-critical-auditor-response.json');
      writeFileSync(responsePath, JSON.stringify({ transport: 'caller-controlled' }), 'utf8');

      expect(() =>
        runMainAgentAuthoringRepair(root, {
          source,
          recordId,
          requirementSetId: `${recordId}-SET`,
          mode: 'preserve-existing',
          criticalAuditorResponse: responsePath,
        })
      ).toThrow('critical_auditor_response_injection_forbidden');

      expect(
        existsSync(
          path.join(
            root,
            '_bmad-output',
            'runtime',
            'requirement-records',
            recordId,
            'authoring',
            'critical-auditor-receipt-round-1.json'
          )
        )
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

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
            '      mermaid: |-',
            '        sequenceDiagram',
            '          actor User',
            '          participant Product',
            '          User->>Product: request repair',
            '          Product-->>User: return repaired projection',
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
        .replace('      coverageRole: modify', '')
        .replace(
          '      command: "npx vitest run tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts"',
          '      command: "rg -n -e \'repair\' -- packages/bmad-speckit/src/main-agent/source-authority/scripts"'
        )
        .replace(
          '      targetFiles: ["packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts"]',
          '      targetFiles: []'
        );
      sourceText = sourceText
        .replace(
          /( {4}- id: FAIL-001\n[\s\S]*? {6}linkedEvidenceIds: \["EVD-001"\]\n)( {6}derivedFromMustRef: MUST-001\n)/u,
          '$1      ownerMustRefs: ["MUST-001"]\n'
        )
        .replace(
          /( {4}- id: TARGET-MOD-001\n[\s\S]*?)( {6}derivedFromMustRef: MUST-001\n)/u,
          '$1'
        )
        .replace(/( {4}- id: ART-001\n[\s\S]*?)( {6}derivedFromMustRef: MUST-001\n)/u, '$1')
        .replace(/( {4}- id: CMD-001\n[\s\S]*?)( {6}derivedFromMustRef: MUST-001\n)/u, '$1');
      const projectedProductTarget = path.join(
        root,
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'scripts',
        'main-agent-orchestration.ts'
      );
      mkdirSync(path.dirname(projectedProductTarget), { recursive: true });
      writeFileSync(
        projectedProductTarget,
        'export const preserveExistingRepair = true;\n',
        'utf8'
      );
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
        expect(view.evidenceRefs, `${view.id} evidenceRefs`).toEqual(
          expect.arrayContaining(evidenceIds)
        );
        expect(view.acceptanceRefs, `${view.id} acceptanceRefs`).toEqual(
          expect.arrayContaining(acceptanceIds)
        );
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
      expect(
        businessViews.find((view: any) => view.visualKind === 'failure')?.failurePathRefs
      ).toEqual(expect.arrayContaining(confirmation.failurePaths.map((row: any) => row.id)));
      expect(businessViews.find((view: any) => view.visualKind === 'edge')?.edgeCaseRefs).toEqual(
        expect.arrayContaining(confirmation.edgeCases.map((row: any) => row.id))
      );
      expect(
        businessViews.find((view: any) => view.visualKind === 'edge')?.edgeCaseRefs
      ).not.toContain('legacy business edge remains human readable [MUST-001]');
      const targetPathRows = confirmation.targetModificationPaths as Array<Record<string, unknown>>;
      expect(
        targetPathRows.find(
          (row) =>
            row.path ===
            'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'
        )
      ).toMatchObject({
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
      expect(
        (confirmation.currentTargetMap.diffRows as Array<Record<string, unknown>>).map(
          (row) => row.id
        )
      ).toContain('CT-DIFF-002');
      expect(currentTargetMapText).not.toContain(
        'Current source anchors for default/visibility behavior include'
      );
      expect(currentTargetMapText).not.toContain('Target source-defined periods');
      expect(currentTargetMapText).not.toContain('CURRENT-EVIDENCE-NOISE');
      expect(currentTargetMapText).not.toMatch(/(?:include|includes|periods|entries)[^.;]*1m/iu);
      expect(currentTargetMapText).not.toContain('Residual Risk Statement');
      expect(currentTargetMapText).not.toContain('still not user confirmed');
      expect(currentTargetMapText).not.toContain(
        'Listed tests are required future implementation evidence'
      );
      expect(currentTargetMapText).not.toContain('untracked package.json');
      const happyView = businessViews.find((view: any) => view.id === 'SEQ-BUSINESS-001');
      expect(String(happyView?.mermaid)).toContain('User->>Product: request repair [MUST-001]');
      expect(String(happyView?.mermaid)).toContain(
        'Product-->>User: return repaired projection [MUST-001]'
      );
      expect(
        confirmation.requiredCommands.find((row: any) => row.id === 'CMD-001')?.targetFiles
      ).toEqual([
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
      ]);
      for (const [group, id] of [
        ['failurePaths', 'FAIL-001'],
        ['targetModificationPaths', 'TARGET-MOD-001'],
        ['artifactAutomationPlan', 'ART-001'],
        ['requiredCommands', 'CMD-001'],
      ]) {
        expect(
          confirmation[group].find((row: any) => (row.id ?? row.artifactId) === id)
            ?.derivedFromMustRef,
          `${group}.${id} derivedFromMustRef`
        ).toBe('MUST-001');
      }
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const afterInitialRepairHash = sha256Text(readFileSync(source, 'utf8'));
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
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(afterInitialRepairHash);
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const afterInitialRepairHash = sha256Text(readFileSync(source, 'utf8'));
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
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(afterInitialRepairHash);
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const afterInitialRepairHash = sha256Text(readFileSync(source, 'utf8'));
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
            message:
              'source packet projection metadata drift is a blocker, not audit incompleteness.',
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
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(afterInitialRepairHash);
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const afterInitialRepairHash = sha256Text(readFileSync(source, 'utf8'));
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
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(afterInitialRepairHash);
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const afterInitialRepairHash = sha256Text(readFileSync(source, 'utf8'));
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
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(afterInitialRepairHash);
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const afterInitialRepairHash = sha256Text(readFileSync(source, 'utf8'));
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
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(afterInitialRepairHash);
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

  it('resynchronizes stale packet projection metadata without changing semantic hashes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-packet-metadata-resync-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const paths = authoringPaths(root, recordId);
      const confirmation = readInlineConfirmation(source);
      confirmation.status = 'user_confirmed';
      delete confirmation.failurePaths[0].derivedFromMustRef;
      rewriteInlineConfirmation(source, confirmation);
      writePromotionReceipt(root, source, recordId, `${recordId}-SET`, {
        statusValue: 'user_confirmed',
        promotionStage: 'current-source-receipt-refresh',
      });
      const beforeText = readFileSync(source, 'utf8');
      const beforeExtraction = extractImplementationConfirmationForHash(beforeText);
      const beforeSourceHash = sourceDocumentHashForContract(
        beforeText,
        beforeExtraction.blockText,
        beforeExtraction.confirmation
      );
      const beforeConfirmationHash = implementationConfirmationHashForContract(
        beforeExtraction.confirmation
      );
      const oldPacketHash = confirmation.failurePaths[0].derivedFromPacketHash;

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });

      expect(result.blockingStage).toBe('critical_auditor_round_required');
      expect(result.packetHash).toEqual(expect.stringMatching(/^sha256:[a-f0-9]{64}$/u));
      expect(result.packetHash).not.toBe(oldPacketHash);
      const afterText = readFileSync(source, 'utf8');
      const afterExtraction = extractImplementationConfirmationForHash(afterText);
      expect(
        sourceDocumentHashForContract(
          afterText,
          afterExtraction.blockText,
          afterExtraction.confirmation
        )
      ).toBe(beforeSourceHash);
      expect(implementationConfirmationHashForContract(afterExtraction.confirmation)).toBe(
        beforeConfirmationHash
      );
      expect(afterExtraction.confirmation.failurePaths[0]).toMatchObject({
        derivedFromPacketHash: result.packetHash,
        projectionStatus: 'synchronized',
      });
      const dryRun = readJson(
        path.join(paths.dir, 'pre-render-must-decomposition-gate-dry-run-round-1.json')
      );
      expect(
        dryRun.blockingIssues?.map((issue: Record<string, unknown>) => issue.code) ?? []
      ).not.toContain('source_row_independently_invented');
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
                reason:
                  'The materializer must reject target fields that do not match the action type.',
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
      const existingConfirmation = readInlineConfirmation(source);
      const repairIds = {
        must: [
          nextNumericId(canonicalMustRefs(request), 'MUST-FR'),
          nextNumericId(canonicalMustRefs(request), 'MUST-FR', 2),
        ],
        negative: nextNumericId(
          existingConfirmation.notDone.map((row: any) => row.id),
          'NEG'
        ),
        outOfScope: nextNumericId(
          existingConfirmation.mustNot.map((row: any) => row.id),
          'OUT'
        ),
        evidence: nextNumericId(
          existingConfirmation.evidence.map((row: any) => row.id),
          'EVD'
        ),
        trace: nextNumericId(
          existingConfirmation.traceRows.map((row: any) => row.id),
          'TRACE'
        ),
        acceptance: nextNumericId(
          existingConfirmation.acceptanceTests.map((row: any) => row.id),
          'ACC'
        ),
        e2e: nextNumericId(
          existingConfirmation.e2eSuites.map((row: any) => row.id),
          'E2E'
        ),
        businessView: nextNumericId(
          (existingConfirmation.businessViews ?? []).map((row: any) => row.id),
          'BUSINESS-VIEW'
        ),
        target: nextNumericId(
          existingConfirmation.targetModificationPaths.map((row: any) => row.id),
          'TARGET-MOD'
        ),
        command: nextNumericId(
          existingConfirmation.requiredCommands.map((row: any) => row.id),
          'CMD'
        ),
      };
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
                newValue: { id: repairIds.must[0], text: 'Repair adds a business MUST.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-SPLIT-MUST',
                type: 'split_must',
                targetField: 'implementationConfirmation.must',
                newValue: { id: repairIds.must[1], text: 'Repair splits a broad MUST.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-NEG',
                type: 'add_neg',
                targetField: 'implementationConfirmation.negativeRequirements',
                newValue: { id: repairIds.negative, text: 'Repair adds a negative requirement.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-OUT',
                type: 'add_out',
                targetField: 'implementationConfirmation.outOfScope',
                newValue: {
                  id: repairIds.outOfScope,
                  text: 'Repair adds an out-of-scope boundary.',
                },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-EVD',
                type: 'add_evidence',
                targetField: 'implementationConfirmation.evidence',
                newValue: { id: repairIds.evidence, text: 'Repair adds evidence.' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-TRACE',
                type: 'add_trace',
                targetField: 'implementationConfirmation.traceRows',
                newValue: { id: repairIds.trace, covers: [repairIds.must[0]] },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-ACC',
                type: 'add_acc',
                targetField: 'implementationConfirmation.acceptanceCriteria',
                newValue: {
                  id: repairIds.acceptance,
                  file: 'tests/acceptance/repair.test.ts',
                },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-E2E',
                type: 'add_e2e',
                targetField: 'implementationConfirmation.e2eScenarios',
                newValue: { id: repairIds.e2e, file: 'tests/e2e/repair.e2e.ts' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-ADD-BUSINESS',
                type: 'add_business_view',
                targetField: 'implementationConfirmation.businessViews',
                newValue: { id: repairIds.businessView, title: 'Repair business view' },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-TARGET',
                type: 'replace_target_path',
                targetField: 'implementationConfirmation.targetModificationPaths',
                newValue: {
                  id: repairIds.target,
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
                  id: repairIds.command,
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
        expect.arrayContaining(repairIds.must)
      );
      expect(confirmation.notDone.map((row: any) => row.id)).toContain(repairIds.negative);
      expect(confirmation.negativeRequirements.map((row: any) => row.id)).toContain(
        repairIds.negative
      );
      expect(confirmation.mustNot.map((row: any) => row.id)).toContain(repairIds.outOfScope);
      expect(confirmation.outOfScope.map((row: any) => row.id)).toContain(repairIds.outOfScope);
      expect(confirmation.evidence.map((row: any) => row.id)).toContain(repairIds.evidence);
      expect(confirmation.traceRows.map((row: any) => row.id)).toContain(repairIds.trace);
      expect(confirmation.acceptanceTests.map((row: any) => row.id)).toContain(
        repairIds.acceptance
      );
      expect(confirmation.acceptanceCriteria.map((row: any) => row.id)).toContain(
        repairIds.acceptance
      );
      expect(confirmation.e2eSuites.map((row: any) => row.id)).toContain(repairIds.e2e);
      expect(confirmation.e2eScenarios.map((row: any) => row.id)).toContain(repairIds.e2e);
      expect(confirmation.businessViews.map((row: any) => row.id)).toContain(
        repairIds.businessView
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
      expect(result.artifacts.some((artifact: string) => artifact.includes('/archive/'))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('marks a confirmed source reconfirm_required when a validated gap changes semantics', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-confirmed-gap-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      markSourceUserConfirmed(source);
      writePromotionReceipt(root, source, recordId, `${recordId}-SET`, {
        statusValue: 'user_confirmed',
        promotionStage: 'current-source-receipt-refresh',
      });
      const paths = authoringPaths(root, recordId);

      const initial = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      expect(initial.blockingStage).toBe('critical_auditor_round_required');
      const repair = writeSingleMustRepairResponse(paths.request(1), paths.response(1));

      const repaired = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(repaired).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'critical_auditor_round_required',
        nextRequiredAction: 'write_critical_auditor_round_response',
      });
      const confirmation = readInlineConfirmation(source);
      expect(confirmation.status).toBe('reconfirm_required');
      expect(confirmation.must.map((row: any) => row.id)).toContain(repair.mustId);
      expect(confirmation.reconfirmationRequest).toMatchObject({
        required: true,
        reasonCode: 'controlled_authoring_repair_changed_confirmed_scope',
        persuasiveRationale: {
          whyReconfirmNow: expect.any(String),
          riskIfSkipped: expect.any(String),
          whyEvidenceIsSufficient: expect.any(String),
        },
        evidenceBundle: {
          sufficiencyVerdict: 'sufficient',
          items: expect.arrayContaining([
            expect.objectContaining({
              sourceRefs: expect.any(Array),
              proofRefs: expect.any(Array),
            }),
          ]),
        },
        diffSummary: expect.any(Array),
        allowedUserActions: expect.arrayContaining(['confirm_current_version']),
      });
      expect(
        confirmation.reconfirmationRequest.evidenceBundle.items[0]
      ).not.toHaveProperty('id');
      expect(
        confirmation.reconfirmationRequest.diffSummary.every(
          (item: Record<string, unknown>) => !Object.hasOwn(item, 'id')
        )
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before drafting when confirmed-scope repair lacks authoritative source refs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-reconfirm-source-refs-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-RECONFIRM-SOURCE-REFS';
      const source = writeRichSource(root, recordId);
      markSourceUserConfirmed(source);
      writePromotionReceipt(root, source, recordId, `${recordId}-SET`, {
        statusValue: 'user_confirmed',
        promotionStage: 'current-source-receipt-refresh',
      });
      const paths = authoringPaths(root, recordId);

      const initial = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      expect(initial.blockingStage).toBe('critical_auditor_round_required');
      const sourceBeforeRepair = readFileSync(source, 'utf8');
      const repairDraftPath = path.join(paths.dir, 'authoring-repair-draft-source.md');
      expect(existsSync(repairDraftPath)).toBe(false);

      writeNewValidGapResponse(paths.request(1), paths.response(1), {
        validatedGaps: [
          {
            id: 'VALID-GAP-RECONFIRM-SOURCE-REFS',
            status: 'open',
            repairActions: [
              {
                actionId: 'REPAIR-RECONFIRM-SOURCE-REFS',
                type: 'add_business_view',
                sourceSpan: { startLine: 1, endLine: 1 },
                sourceText: 'Add a business view without inventing requirement authority.',
                targetField: 'implementationConfirmation.businessViews',
                newValue: {
                  id: 'BUSINESS-VIEW-RECONFIRM-SOURCE-REFS',
                  title: 'Source-bound reconfirmation evidence',
                  summary: 'Only authoritative source references may justify reconfirmation.',
                },
                reason: 'The confirmed source needs an additional business projection.',
                mustRefs: ['UNREGISTERED-MUST-REF'],
                requirementIds: ['UNREGISTERED-REQUIREMENT-REF'],
              },
            ],
          },
        ],
      });

      const repaired = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(repaired).toMatchObject({
        ok: false,
        status: 'blocked',
      });
      expect(repaired.blockingIssues.map((issue: any) => issue.code)).toContain(
        'controlled_authoring_reconfirmation_source_refs_missing'
      );
      expect(readFileSync(source, 'utf8')).toBe(sourceBeforeRepair);
      expect(existsSync(repairDraftPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('materializes business failure, edge-case, and existing trace closure repairs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-business-failure-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-BUSINESS-FAILURE';
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const confirmation = readInlineConfirmation(source);
      const existingFailure = confirmation.failurePaths.find((row: any) => row.id === 'FAIL-001');
      const existingEdge = confirmation.edgeCases.find((row: any) => row.id === 'EDGE-001');
      const existingTrace = confirmation.traceRows.find((row: any) => row.id === 'TRACE-001');
      const actionBase = {
        sourceSpan: { startLine: 20, endLine: 24 },
        sourceText: 'Close consumer business failure behavior without authoring-governance prose.',
        reason: 'Critical Auditor found missing business failure closure.',
        mustRefs: ['MUST-001'],
        requirementIds: ['MUST-001', 'TRACE-001'],
      };
      writeNewValidGapResponse(paths.request(1), paths.response(1), {
        validatedGaps: [
          {
            id: 'VALID-GAP-BUSINESS-FAILURE-CLOSURE',
            status: 'open',
            repairActions: [
              {
                actionId: 'REPAIR-FAIL-001',
                type: 'upsert_failure_path',
                targetField: 'implementationConfirmation.failurePaths',
                newValue: {
                  ...existingFailure,
                  trigger: 'Consumer runtime dependency becomes unavailable.',
                  expectedBehavior: 'The affected business lane fails closed without hot-path blocking.',
                },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-FAIL-050',
                type: 'upsert_failure_path',
                targetField: 'implementationConfirmation.failurePaths',
                newValue: {
                  id: 'FAIL-050',
                  title: 'Active-symbol quote polling CPU budget breach',
                  trigger: 'Active-symbol quote polling exceeds the confirmed CPU budget.',
                  expectedBehavior: 'The product rejects or degrades the affected polling lane.',
                  forbiddenBehavior: 'Continue unbounded polling on the hot path.',
                  blocksCompletionWhenViolated: true,
                  linkedNegIds: ['NEG-001'],
                  linkedEvidenceIds: ['EVD-001'],
                },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-EDGE-001',
                type: 'upsert_edge_case',
                targetField: 'implementationConfirmation.edgeCases',
                newValue: {
                  ...existingEdge,
                  category: 'runtime_dependency_failure',
                  condition: 'The consumer runtime dependency becomes unavailable mid-session.',
                  expectedBehavior: 'The affected business lane fails closed and remains observable.',
                  linkedFailurePathIds: ['FAIL-001'],
                },
                ...actionBase,
              },
              {
                actionId: 'REPAIR-TRACE-001',
                type: 'upsert_trace',
                targetField: 'implementationConfirmation.traceRows',
                newValue: {
                  ...existingTrace,
                  failurePathRefs: ['FAIL-001', 'FAIL-050'],
                  edgeCaseRefs: ['EDGE-001'],
                },
                ...actionBase,
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

      expect(result.blockingStage).toBe('critical_auditor_round_required');
      const repaired = readInlineConfirmation(source);
      expect(repaired.failurePaths.find((row: any) => row.id === 'FAIL-001')).toMatchObject({
        trigger: 'Consumer runtime dependency becomes unavailable.',
        expectedBehavior: 'The affected business lane fails closed without hot-path blocking.',
      });
      expect(repaired.failurePaths.map((row: any) => row.id)).toContain('FAIL-050');
      expect(repaired.edgeCases.find((row: any) => row.id === 'EDGE-001')).toMatchObject({
        category: 'runtime_dependency_failure',
        linkedFailurePathIds: ['FAIL-001'],
      });
      expect(repaired.traceRows.find((row: any) => row.id === 'TRACE-001')).toMatchObject({
        failurePathRefs: ['FAIL-001', 'FAIL-050'],
        edgeCaseRefs: ['EDGE-001'],
      });
      expect(repaired.acceptanceTests.find((row: any) => row.id === 'ACC-001')).toMatchObject({
        failurePathRefs: ['FAIL-001', 'FAIL-050'],
        edgeCaseRefs: ['EDGE-001'],
      });
      expect(repaired.e2eSuites.find((row: any) => row.id === 'E2E-001')).toMatchObject({
        failurePathRefs: ['FAIL-001', 'FAIL-050'],
        edgeCaseRefs: ['EDGE-001'],
      });
      expect(repaired.sourceGapFixes.at(-1).appliedActions).toHaveLength(4);
      expect(repaired.sourceGapFixes.at(-1).targetFieldsChanged).toEqual(
        expect.arrayContaining(['failurePaths', 'edgeCases', 'traceRows'])
      );
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

  it('reuses source-owned atomic tasks and projections without cartesian relabeling', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-owned-projections-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const confirmation = readInlineConfirmation(source);
      const packetHash = fixedHash('a');
      const owned = (mustRef: string) => ({
        derivedFromMustRef: mustRef,
        derivedFromPacketHash: packetHash,
        projectionStatus: 'synchronized',
      });

      confirmation.must = [
        confirmation.must[0],
        {
          id: 'MUST-002',
          text: 'Persist the second independently verifiable product behavior.',
          evidenceRefs: ['EVD-002'],
          coveredByTraceRows: ['TRACE-002'],
          coveredBySequenceViews: ['SEQ-001'],
          ...owned('MUST-002'),
        },
      ];
      confirmation.notDone = [
        confirmation.notDone[0],
        {
          id: 'NEG-002',
          text: 'Telemetry exporter success must not control product hot-path safety.',
          evidenceRefs: ['EVD-001'],
          whyItBlocksCompletion: 'Exporter coupling would block product hot paths.',
          negativeAssertionRequired: true,
          coveredByTraceRows: ['TRACE-NEG-002'],
          coveredByFailurePath: ['FAIL-NEG-002'],
        },
      ];
      confirmation.atomicImplementationTaskList = [
        {
          id: 'TASK-001-A',
          text: 'Implement the first product behavior.',
          targetFiles: ['src/first.ts'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          primaryObservableBehaviors: ['First behavior is observable.'],
          primaryAcceptanceOracles: ['ACC-001 proves the first behavior.'],
          ...owned('MUST-001'),
        },
        {
          id: 'TASK-001-B',
          text: 'Handle the first product failure boundary.',
          targetFiles: ['src/first-failure.ts'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          primaryObservableBehaviors: ['First failure boundary is observable.'],
          primaryAcceptanceOracles: ['FAIL-001 is rejected safely.'],
          ...owned('MUST-001'),
        },
        {
          id: 'TASK-002-A',
          text: 'Implement the second product behavior.',
          targetFiles: ['src/second.ts'],
          traceRows: ['TRACE-002'],
          evidenceRefs: ['EVD-002'],
          primaryObservableBehaviors: ['Second behavior is observable.'],
          primaryAcceptanceOracles: ['ACC-002 proves the second behavior.'],
          ...owned('MUST-002'),
        },
      ];
      confirmation.mustExecutionDecompositionMatrix = [
        {
          id: 'MDM-001',
          mustRef: 'MUST-001',
          atomicTaskRefs: ['TASK-001-A', 'TASK-001-B'],
          ...owned('MUST-001'),
        },
        {
          id: 'MDM-002',
          mustRef: 'MUST-002',
          atomicTaskRefs: ['TASK-002-A'],
          ...owned('MUST-002'),
        },
      ];
      confirmation.evidence = [
        confirmation.evidence[0],
        {
          id: 'EVD-002',
          covers: ['MUST-002'],
          text: 'Second behavior evidence.',
          gate: 'npm run test:second',
          oracle: 'The second behavior is independently verified.',
          requiredCommandRefs: ['CMD-002'],
          artifactRefs: ['ART-001'],
          ...owned('MUST-002'),
        },
      ];
      confirmation.traceRows = [
        { ...confirmation.traceRows[0], covers: ['MUST-001'], ...owned('MUST-001') },
        {
          id: 'TRACE-002',
          covers: ['MUST-002'],
          taskRefs: ['TASK-002-A'],
          evidenceRefs: ['EVD-002'],
          contractValidationCommandRefs: ['CMD-002'],
          deliveryEvidenceCommandRefs: ['CMD-002'],
          acceptanceRefs: ['ACC-002', 'E2E-002'],
          artifactRefs: ['ART-001'],
          status: 'PENDING',
          ...owned('MUST-002'),
        },
      ];
      confirmation.acceptanceTests = [
        confirmation.acceptanceTests[0],
        {
          id: 'ACC-002',
          file: 'tests/second.test.ts',
          covers: ['MUST-002'],
          traceRows: ['TRACE-002'],
          evidenceRefs: ['EVD-002'],
          commandRefs: ['CMD-002'],
          oracle: 'Second acceptance oracle.',
          ...owned('MUST-002'),
        },
      ];
      confirmation.e2eSuites = [
        confirmation.e2eSuites[0],
        {
          id: 'E2E-002',
          file: 'tests/second.e2e.ts',
          covers: ['MUST-002'],
          traceRows: ['TRACE-002'],
          evidenceRefs: ['EVD-002'],
          commandRefs: ['CMD-002'],
          oracle: 'Second end-to-end oracle.',
          ...owned('MUST-002'),
        },
      ];
      confirmation.failurePaths = [
        {
          ...confirmation.failurePaths[0],
          ownerMustRefs: ['MUST-001'],
          traceRows: ['TRACE-001'],
          ...owned('MUST-001'),
        },
        {
          id: 'FAIL-002',
          title: 'Second behavior fails',
          trigger: 'The second behavior cannot persist.',
          expectedBehavior: 'Fail closed without partial state.',
          forbiddenBehavior: 'Do not report success.',
          ownerMustRefs: ['MUST-002'],
          linkedEvidenceIds: ['EVD-002'],
          traceRows: ['TRACE-001', 'TRACE-002'],
          ...owned('MUST-002'),
        },
      ];
      confirmation.edgeCases = [
        { ...confirmation.edgeCases[0], ...owned('MUST-001') },
        {
          id: 'EDGE-002',
          category: 'second_boundary',
          condition: 'Second behavior receives boundary input.',
          expectedBehavior: 'Preserve deterministic state.',
          forbiddenBehavior: 'Do not silently truncate.',
          linkedFailurePathIds: ['FAIL-002'],
          linkedEvidenceIds: ['EVD-002'],
          traceRows: ['TRACE-002'],
          ...owned('MUST-002'),
        },
      ];
      confirmation.targetModificationPaths = [
        {
          ...confirmation.targetModificationPaths[0],
          id: 'TARGET-MOD-001',
          path: 'src/first.ts',
          requirementRefs: ['MUST-001'],
          traceRefs: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          ...owned('MUST-001'),
        },
        {
          id: 'TARGET-MOD-002',
          path: 'src/second.ts',
          changeType: 'modify',
          coverageRole: 'modify',
          requirementRefs: ['MUST-002'],
          traceRefs: ['TRACE-002'],
          evidenceRefs: ['EVD-002'],
          ...owned('MUST-002'),
        },
      ];
      confirmation.requiredCommands = [
        {
          ...confirmation.requiredCommands[0],
          id: 'CMD-001',
          targetFiles: ['src/first.ts', 'src/second.ts'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          perMustRows: [{ mustRef: 'MUST-001', assertion: 'First behavior passes.' }],
          ...owned('MUST-001'),
        },
        {
          id: 'CMD-002',
          command: 'npm run test:second',
          purpose: 'Validate the second behavior.',
          targetFiles: ['src/second.ts'],
          traceRows: ['TRACE-001', 'TRACE-002'],
          evidenceRefs: ['EVD-002'],
          perMustRows: [{ mustRef: 'MUST-002', assertion: 'Second behavior passes.' }],
          ...owned('MUST-002'),
        },
      ];
      confirmation.currentTargetMap.currentSummary = [
        {
          id: 'CT-GLOBAL-001',
          title: 'Shared current-state context',
          detail: 'This row is global context, not a per-MUST projection.',
          requirementRefs: ['MUST-001', 'MUST-002'],
          traceRows: ['TRACE-001', 'TRACE-002'],
          evidenceRefs: ['EVD-001', 'EVD-002'],
        },
      ];
      confirmation.currentTargetMap.diffRows = [
        {
          id: 'CT-MUST-001',
          dimension: 'First behavior',
          currentState: 'Missing',
          targetState: 'Implemented',
          requirementRefs: ['MUST-001'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
        {
          id: 'CT-MUST-002',
          dimension: 'Second behavior',
          currentState: 'Missing',
          targetState: 'Implemented',
          requirementRefs: ['MUST-002'],
          traceRows: ['TRACE-002'],
          evidenceRefs: ['EVD-002'],
        },
      ];
      rewriteInlineConfirmation(source, confirmation);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      expect(result.blockingStage).toBe('critical_auditor_round_required');

      const packet = readJson(paths.packet).must_decomposition_packet;
      const first = packet.mustPackets.find((row: any) => row.mustRef === 'MUST-001');
      const second = packet.mustPackets.find((row: any) => row.mustRef === 'MUST-002');

      expect(first.mustAtomicTasks.map((row: any) => row.id)).toEqual(['TASK-001-A', 'TASK-001-B']);
      expect(second.mustAtomicTasks.map((row: any) => row.id)).toEqual(['TASK-002-A']);
      expect(first.atomicityCompleteness).toMatchObject({
        expectedTaskCount: 2,
        actualTaskCount: 2,
      });
      expect(second.atomicityCompleteness).toMatchObject({
        expectedTaskCount: 1,
        actualTaskCount: 1,
      });
      expect(first.mustEvidenceProjection.map((row: any) => row.id)).toEqual(['EVD-001']);
      expect(second.mustEvidenceProjection.map((row: any) => row.id)).toEqual(['EVD-002']);
      expect(first.mustTraceProjection.map((row: any) => row.id)).toEqual(['TRACE-001']);
      expect(second.mustTraceProjection.map((row: any) => row.id)).toEqual(['TRACE-002']);
      expect(first.mustFailureEdgeProjection.map((row: any) => row.id)).toEqual([
        'FAIL-001',
        'EDGE-001',
      ]);
      expect(second.mustFailureEdgeProjection.map((row: any) => row.id)).toEqual([
        'FAIL-002',
        'EDGE-002',
      ]);
      expect(first.mustTargetPathProjection.map((row: any) => row.id)).toEqual(['TARGET-MOD-001']);
      expect(second.mustTargetPathProjection.map((row: any) => row.id)).toEqual(['TARGET-MOD-002']);
      expect(first.mustCommandProjection.map((row: any) => row.id)).toEqual(['CMD-001']);
      expect(second.mustCommandProjection.map((row: any) => row.id)).toEqual(['CMD-002']);
      expect(first.mustCurrentTargetProjection.map((row: any) => row.id)).toContain('CT-MUST-001');
      expect(first.mustCurrentTargetProjection.map((row: any) => row.id)).not.toContain(
        'CT-GLOBAL-001'
      );
      expect(second.mustCurrentTargetProjection.map((row: any) => row.id)).toContain('CT-MUST-002');
      expect(second.mustCurrentTargetProjection.map((row: any) => row.id)).not.toContain(
        'CT-GLOBAL-001'
      );
      expect(first.questionCoverage.questions.length).toBeGreaterThan(0);
      expect(first.questionCoverage.answers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            answer: expect.any(String),
            evidenceRefs: expect.arrayContaining([expect.any(String)]),
          }),
        ])
      );
      expect(new Set(first.questionCoverage.answers.map((row: any) => row.category))).toEqual(
        new Set(first.questionCoverage.answeredCategories)
      );
      expect(first.questionCoverage.answers.map((row: any) => row.category)).toEqual(
        expect.arrayContaining(['scope_boundary', 'mental_model_progression'])
      );
      expect(
        first.mustAtomicTasks.every(
          (row: any) => !String(row.primaryObservableBehaviors).includes('artifact synchronization')
        )
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('splits compound behavior oracles and removes semantic projection overassignment', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-semantic-scope-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const confirmation = readInlineConfirmation(source);
      const primaryMustRef = String(confirmation.must[0].id);
      const secondaryMustRef = nextNumericId(
        confirmation.must.map((row: any) => row.id),
        primaryMustRef.replace(/-[0-9]{3}$/u, '')
      );
      const primaryNegRef = String(confirmation.notDone[0].id);
      const secondaryNegRef = nextNumericId(
        confirmation.notDone.map((row: any) => row.id),
        primaryNegRef.replace(/-[0-9]{3}$/u, '')
      );
      const primaryTraceRef = String(confirmation.traceRows[0].id);
      const secondaryTraceRef = nextNumericId(
        confirmation.traceRows.map((row: any) => row.id),
        primaryTraceRef.replace(/-[0-9]{3}$/u, '')
      );
      const primaryEvidenceRef = String(confirmation.traceRows[0].evidenceRefs[0]);
      const primaryCommandRef = String(
        confirmation.traceRows[0].contractValidationCommandRefs[0]
      );
      const secondaryCommandRef = nextNumericId(
        confirmation.requiredCommands.map((row: any) => row.id),
        primaryCommandRef.replace(/-[0-9]{3}$/u, '')
      );
      const primaryAcceptanceRef = String(confirmation.traceRows[0].acceptanceRefs[0]);
      const primaryArtifactRef = String(confirmation.traceRows[0].artifactRefs[0]);
      const primaryFailurePathRef = String(confirmation.failurePaths[0].id);
      const ordinalFor = (ref: string) => {
        const match = ref.match(/([0-9]{3})$/u);
        if (!match) throw new Error(`numeric identity suffix missing: ${ref}`);
        return match[1];
      };
      const primaryAtomicTaskRef = `TASK-${ordinalFor(primaryMustRef)}-001`;
      const secondaryAtomicTaskRef = `TASK-${ordinalFor(secondaryMustRef)}-001`;
      const primaryDecompositionRef = `MDM-${ordinalFor(primaryMustRef)}`;
      const secondaryDecompositionRef = `MDM-${ordinalFor(secondaryMustRef)}`;
      const primaryNegTraceRef = `TRACE-${primaryNegRef}`;
      const secondaryNegTraceRef = `TRACE-${secondaryNegRef}`;
      const primaryNegAcceptanceRef = `ACC-${primaryNegRef}`;
      const secondaryNegAcceptanceRef = `ACC-${secondaryNegRef}`;
      const secondaryFailurePathRef = `FAIL-${secondaryNegRef}`;
      const secondaryEdgeCaseRef = `EDGE-${secondaryMustRef}`;
      const secondaryTargetModificationRef = `TARGET-MOD-${ordinalFor(secondaryMustRef)}-SCOPE`;
      const generatedPrimaryTaskPattern = new RegExp(
        `^${primaryAtomicTaskRef.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}-A[0-9A-F]{12}$`,
        'u'
      );
      const packetHash = fixedHash('a');
      const owned = (mustRef: string) => ({
        derivedFromMustRef: mustRef,
        derivedFromPacketHash: packetHash,
        projectionStatus: 'synchronized',
      });
      const compoundOracle =
        'Given a queue reaches its backlog limit, when work is submitted, then diagnostic state is recoverable from the latest snapshot, mutating commands are rejected with queue_backpressure, OrderIntent handoff requires ack or unsafe_paused timeout, and no tick payload is moved through the queue.';
      const originalTargets = [
        'src/unrelated_alpha.ts',
        'src/unrelated_beta.ts',
        'src/unrelated_gamma.ts',
        'src/unrelated_delta.ts',
        'src/unrelated_epsilon.ts',
        'src/unrelated_zeta.ts',
        'src/queue_snapshot.ts',
        'src/control_queue.ts',
        'src/order_intent.ts',
        'src/tick_databus.ts',
      ];
      const authorityOnlyTargets = [
        'src/runtime_bootstrap.ts',
        'src/application_engine.ts',
      ];

      confirmation.must = [
        {
          ...confirmation.must[0],
          text: 'Queue overflow preserves independent recovery, rejection, handoff, and tick isolation outcomes.',
        },
        {
          id: secondaryMustRef,
          text: 'DataService metadata failure returns metadata_unavailable without creating MainTrading quote context.',
          evidenceRefs: [primaryEvidenceRef],
          coveredByTraceRows: [secondaryTraceRef],
          ...owned(secondaryMustRef),
        },
      ];
      confirmation.notDone = [
        confirmation.notDone[0],
        {
          id: secondaryNegRef,
          text: 'Telemetry exporter success must not control product hot-path safety.',
          evidenceRefs: [primaryEvidenceRef],
          whyItBlocksCompletion: 'Exporter coupling would block product hot paths.',
          negativeAssertionRequired: true,
          coveredByTraceRows: [secondaryNegTraceRef],
          coveredByFailurePath: [],
        },
      ];
      confirmation.atomicImplementationTaskList = [
        {
          id: primaryAtomicTaskRef,
          text: `Implement and prove ${primaryMustRef} atomic behavior 1: ${compoundOracle}`,
          targetFiles: originalTargets,
          traceRows: [primaryTraceRef],
          evidenceRefs: [primaryEvidenceRef],
          primaryObservableBehaviors: [compoundOracle],
          primaryAcceptanceOracles: [compoundOracle],
          ...owned(primaryMustRef),
        },
        {
          id: secondaryAtomicTaskRef,
          text: 'Implement metadata unavailable behavior.',
          targetFiles: [
            'src/metadata.ts',
            'src/queue_snapshot.ts',
            'src/tick_databus.ts',
            'tests/metadata.test.ts',
          ],
          traceRows: [secondaryTraceRef],
          evidenceRefs: [primaryEvidenceRef],
          primaryObservableBehaviors: ['Metadata failure returns metadata_unavailable.'],
          primaryAcceptanceOracles: ['MainTrading quote context is not created.'],
          ...owned(secondaryMustRef),
        },
      ];
      confirmation.mustExecutionDecompositionMatrix = [
        {
          id: primaryDecompositionRef,
          mustRef: primaryMustRef,
          atomicTaskRefs: [primaryAtomicTaskRef],
          ...owned(primaryMustRef),
        },
        {
          id: secondaryDecompositionRef,
          mustRef: secondaryMustRef,
          atomicTaskRefs: [secondaryAtomicTaskRef],
          ...owned(secondaryMustRef),
        },
      ];
      confirmation.traceRows = [
        {
          ...confirmation.traceRows[0],
          covers: [primaryMustRef],
          taskRefs: [primaryAtomicTaskRef],
          ...owned(primaryMustRef),
        },
        {
          id: secondaryTraceRef,
          covers: [secondaryMustRef],
          taskRefs: [secondaryAtomicTaskRef],
          evidenceRefs: [primaryEvidenceRef],
          contractValidationCommandRefs: [primaryCommandRef],
          deliveryEvidenceCommandRefs: [primaryCommandRef],
          acceptanceRefs: [primaryAcceptanceRef],
          artifactRefs: [primaryArtifactRef],
          status: 'PENDING',
          ...owned(secondaryMustRef),
        },
        {
          id: primaryNegTraceRef,
          covers: [primaryNegRef],
          evidenceRefs: [primaryEvidenceRef],
          contractValidationCommandRefs: [primaryCommandRef],
          deliveryEvidenceCommandRefs: [primaryCommandRef],
          acceptanceRefs: [primaryNegAcceptanceRef],
          artifactRefs: [primaryArtifactRef],
          status: 'PENDING',
          ...owned(primaryMustRef),
        },
        {
          id: secondaryNegTraceRef,
          covers: [secondaryNegRef],
          evidenceRefs: [primaryEvidenceRef],
          contractValidationCommandRefs: [primaryCommandRef],
          deliveryEvidenceCommandRefs: [primaryCommandRef],
          acceptanceRefs: [secondaryNegAcceptanceRef],
          artifactRefs: [primaryArtifactRef],
          status: 'PENDING',
          ...owned(primaryMustRef),
        },
      ];
      confirmation.acceptanceTests = [
        confirmation.acceptanceTests[0],
        {
          id: primaryNegAcceptanceRef,
          file: 'tests/negative-isolation.test.ts',
          covers: [primaryNegRef],
          traceRows: [primaryNegTraceRef],
          evidenceRefs: [primaryEvidenceRef],
          commandRefs: [primaryCommandRef],
          oracle: 'Exporter failure never blocks product hot paths.',
          ...owned(primaryMustRef),
        },
        {
          id: secondaryNegAcceptanceRef,
          file: 'tests/exporter-isolation.test.ts',
          covers: [secondaryNegRef],
          traceRows: [secondaryNegTraceRef],
          evidenceRefs: [primaryEvidenceRef],
          commandRefs: [primaryCommandRef],
          oracle: 'Exporter failure never blocks product hot paths.',
          ...owned(primaryMustRef),
        },
      ];
      confirmation.failurePaths = [
        {
          ...confirmation.failurePaths[0],
          title: 'DataService metadata unavailable',
          trigger: 'DataService metadata is unavailable.',
          expectedBehavior:
            'Return metadata_unavailable without creating MainTrading quote context.',
          ownerMustRefs: [primaryMustRef, secondaryMustRef],
          traceRows: [primaryTraceRef, secondaryTraceRef],
          linkedEvidenceIds: [primaryEvidenceRef],
          ...owned(primaryMustRef),
        },
        {
          id: secondaryFailurePathRef,
          title: 'Telemetry exporter failure',
          trigger: 'Telemetry exporter delivery fails.',
          expectedBehavior: 'Product hot paths continue without waiting on exporter recovery.',
          forbiddenBehavior: 'Exporter state must not control product hot-path progress.',
          blocksCompletionWhenViolated: true,
          linkedNegIds: [secondaryNegRef],
          traceRows: [secondaryNegTraceRef],
          acceptanceRefs: [secondaryNegAcceptanceRef],
          linkedEvidenceIds: [primaryEvidenceRef],
          derivedFromPacketHash: packetHash,
          projectionStatus: 'synchronized',
        },
      ];
      confirmation.edgeCases = [
        confirmation.edgeCases[0],
        {
          id: secondaryEdgeCaseRef,
          category: 'metadata_failure_boundary',
          condition: 'DataService metadata is unavailable before quote context creation.',
          expectedBehavior: 'Return metadata_unavailable without creating quote context.',
          forbiddenBehavior: 'Do not infer success from unrelated negative boundaries.',
          linkedFailurePathIds: [primaryFailurePathRef, secondaryFailurePathRef],
          linkedNegIds: [primaryNegRef, secondaryNegRef],
          traceRows: [secondaryTraceRef],
          linkedEvidenceIds: [primaryEvidenceRef],
          derivedFromPacketHash: packetHash,
          projectionStatus: 'synchronized',
        },
      ];
      confirmation.targetModificationPaths = [
        ...confirmation.targetModificationPaths,
        ...authorityOnlyTargets.map((targetPath, index) => ({
          ...confirmation.targetModificationPaths[0],
          id: `TARGET-MOD-AUTHORITY-${index + 1}`,
          path: targetPath,
          changeType: 'modify',
          coverageRole: 'modify',
          requirementRefs: [primaryMustRef],
          traceRefs: [primaryTraceRef],
          evidenceRefs: [primaryEvidenceRef],
          ...owned(primaryMustRef),
        })),
        {
          ...confirmation.targetModificationPaths[0],
          id: secondaryTargetModificationRef,
          path: 'src/metadata.ts',
          traceRefs: [secondaryTraceRef],
          evidenceRefs: [primaryEvidenceRef],
          ...owned(secondaryMustRef),
        },
      ];
      confirmation.requiredCommands = [
        ...confirmation.requiredCommands,
        {
          ...confirmation.requiredCommands[0],
          id: secondaryCommandRef,
          command: 'npx vitest run tests/metadata.test.ts',
          targetFiles: ['tests/metadata.test.ts'],
          traceRows: [secondaryTraceRef],
          evidenceRefs: [primaryEvidenceRef],
          ...owned(secondaryMustRef),
        },
      ];
      rewriteInlineConfirmation(source, confirmation);
      writePromotionReceipt(root, source, recordId);

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });

      expect(result.blockingStage).toBe('critical_auditor_round_required');
      const repaired = readInlineConfirmation(source);
      const queueTasks = repaired.atomicImplementationTaskList.filter(
        (row: any) => row.derivedFromMustRef === primaryMustRef
      );
      expect(queueTasks).toHaveLength(5);
      expect(queueTasks[0].id).toBe(primaryAtomicTaskRef);
      expect(queueTasks.slice(1).map((row: any) => row.id)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(generatedPrimaryTaskPattern),
          expect.stringMatching(generatedPrimaryTaskPattern),
          expect.stringMatching(generatedPrimaryTaskPattern),
          expect.stringMatching(generatedPrimaryTaskPattern),
        ])
      );
      expect(new Set(queueTasks.map((row: any) => row.id)).size).toBe(queueTasks.length);
      expect(
        queueTasks.every(
          (row: any) =>
            row.primaryObservableBehaviors.length === 1 &&
            row.primaryAcceptanceOracles.length === 1 &&
            row.targetFiles.length < originalTargets.length
        ),
        JSON.stringify(queueTasks.map((row: any) => ({ id: row.id, targetFiles: row.targetFiles })))
      ).toBe(true);
      const queueTasksByOutcome = Object.fromEntries(
        [
          'diagnostic state',
          'mutating commands',
          'requires ack',
          'unsafe_paused timeout',
          'tick payload',
        ].map((outcome) => [
          outcome,
          queueTasks.find((row: any) => row.primaryObservableBehaviors[0].includes(outcome)),
        ])
      );
      expect(
        Object.values(queueTasksByOutcome).every(Boolean),
        JSON.stringify(queueTasks.map((row: any) => row.primaryObservableBehaviors[0]))
      ).toBe(true);
      expect(queueTasksByOutcome['diagnostic state'].targetFiles).toContain(
        'src/queue_snapshot.ts'
      );
      expect(queueTasksByOutcome['mutating commands'].targetFiles).toContain(
        'src/control_queue.ts'
      );
      expect(queueTasksByOutcome['requires ack'].targetFiles).toContain('src/order_intent.ts');
      expect(queueTasksByOutcome['unsafe_paused timeout'].targetFiles).toContain(
        'src/order_intent.ts'
      );
      expect(queueTasksByOutcome['tick payload'].targetFiles).toContain('src/tick_databus.ts');
      expect(
        [...new Set(queueTasks.flatMap((row: any) => row.targetFiles))]
      ).toEqual(expect.arrayContaining(authorityOnlyTargets));
      expect(
        repaired.atomicImplementationTaskList.find((row: any) => row.id === secondaryAtomicTaskRef)
          .targetFiles
      ).toEqual(['src/metadata.ts', 'tests/metadata.test.ts']);
      expect(
        repaired.mustExecutionDecompositionMatrix.find(
          (row: any) => row.mustRef === primaryMustRef
        )
          .atomicTaskRefs
      ).toEqual(queueTasks.map((row: any) => row.id));
      expect(
        repaired.traceRows.find((row: any) => row.id === primaryTraceRef).taskRefs
      ).toEqual(queueTasks.map((row: any) => row.id));
      expect(
        repaired.acceptanceTests.find((row: any) => row.id === primaryNegAcceptanceRef)
          .derivedFromMustRef
      ).toBe(secondaryMustRef);
      expect(
        repaired.traceRows.find((row: any) => row.id === primaryNegTraceRef).derivedFromMustRef
      ).toBe(secondaryMustRef);
      expect(
        repaired.acceptanceTests.find((row: any) => row.id === secondaryNegAcceptanceRef)
      ).toMatchObject({
        derivedFromRequirementRef: secondaryNegRef,
      });
      expect(
        repaired.acceptanceTests.find((row: any) => row.id === secondaryNegAcceptanceRef)
          .derivedFromMustRef
      ).toBeUndefined();
      expect(
        repaired.traceRows.find((row: any) => row.id === secondaryNegTraceRef)
      ).toMatchObject({
        derivedFromRequirementRef: secondaryNegRef,
      });
      expect(
        repaired.traceRows.find((row: any) => row.id === secondaryNegTraceRef).derivedFromMustRef
      ).toBeUndefined();
      expect(repaired.failurePaths[0].ownerMustRefs).toEqual([secondaryMustRef]);
      expect(repaired.failurePaths[0].derivedFromMustRef).toBe(secondaryMustRef);
      expect(
        repaired.failurePaths.find((row: any) => row.id === secondaryFailurePathRef)
      ).toMatchObject({
        derivedFromRequirementRef: secondaryNegRef,
      });
      expect(
        repaired.failurePaths.find((row: any) => row.id === secondaryFailurePathRef)
          .derivedFromMustRef
      ).toBeUndefined();
      expect(repaired.edgeCases.find((row: any) => row.id === secondaryEdgeCaseRef)).toMatchObject({
        derivedFromMustRef: secondaryMustRef,
      });
      expect(
        repaired.edgeCases.find((row: any) => row.id === secondaryEdgeCaseRef)
          .derivedFromRequirementRef
      ).toBeUndefined();

      const packet = readJson(authoringPaths(root, recordId).packet).must_decomposition_packet;
      expect(
        packet.mustPackets.flatMap((mustPacket: any) =>
          mustPacket.mustAcceptanceProjection.map((row: any) => row.id)
        )
      ).not.toContain(primaryNegAcceptanceRef);
      expect(
        packet.mustPackets.flatMap((mustPacket: any) =>
          mustPacket.mustTraceProjection.map((row: any) => row.id)
        )
      ).not.toContain(primaryNegTraceRef);
      expect(
        packet.mustPackets.flatMap((mustPacket: any) =>
          mustPacket.mustFailureEdgeProjection.map((row: any) => row.id)
        )
      ).not.toContain(secondaryFailurePathRef);
      expect(
        packet.mustPackets
          .find((mustPacket: any) => mustPacket.mustRef === secondaryMustRef)
          .mustFailureEdgeProjection.map((row: any) => row.id)
      ).toContain(secondaryEdgeCaseRef);
      const reconciliation = readJson(authoringPaths(root, recordId).reconciliation);
      const ownershipProjectionRefs = [
        secondaryNegAcceptanceRef,
        secondaryNegTraceRef,
        secondaryFailurePathRef,
        secondaryEdgeCaseRef,
      ];
      expect(
        reconciliation.issues.filter((issue: any) =>
          ownershipProjectionRefs.some((id) => issue.refs?.includes(id))
        )
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses the controlled MUST text to repair partial single-task atomic coverage and stale convergence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-must-text-atomicity-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const confirmation = readInlineConfirmation(source);
      const packetHash = fixedHash('a');
      const owned = {
        derivedFromMustRef: 'MUST-001',
        derivedFromPacketHash: packetHash,
        projectionStatus: 'synchronized',
      };
      confirmation.must[0].text =
        'Main Trading Process can accept, reject, or submit OrderIntent after risk and idempotency checks.';
      confirmation.atomicImplementationTaskList = [
        {
          id: 'TASK-001',
          text: 'Reject invalid OrderIntent with a stable reason.',
          targetFiles: ['docs/requirements/rich-source.md'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          primaryObservableBehaviors: [
            'Given a risk-invalid intent, when processed, then it is rejected with a stable reason.',
          ],
          primaryAcceptanceOracles: [
            'Given a risk-invalid intent, when processed, then it is rejected with a stable reason.',
          ],
          ...owned,
        },
      ];
      confirmation.mustExecutionDecompositionMatrix = [
        {
          id: 'MDM-001',
          mustRef: 'MUST-001',
          atomicTaskRefs: ['TASK-001'],
          ...owned,
        },
      ];
      confirmation.traceRows[0].taskRefs = ['TASK-001'];
      confirmation.targetModificationPaths = [
        ...confirmation.targetModificationPaths,
        {
          ...confirmation.targetModificationPaths[0],
          id: 'TARGET-MOD-ORDER-INTENT',
          path: 'vnpy/trader/order_intent_processor.py',
          requirementRefs: ['MUST-001'],
          ...owned,
        },
      ];
      confirmation.requiredCommands = [
        ...confirmation.requiredCommands,
        {
          ...confirmation.requiredCommands[0],
          id: 'CMD-ORDER-INTENT',
          command: 'pytest tests/trader/test_order_intent_processor.py',
          targetFiles: ['tests/trader/test_order_intent_processor.py'],
          ...owned,
        },
      ];
      confirmation.preConfirmationDrilldown.criticalAuditor = {
        minimumRounds: 3,
        consecutiveNoNewGapRounds: 3,
        latestReceiptHash: fixedHash('f'),
        convergenceVerdict: 'bounded_no_new_gap',
      };
      rewriteInlineConfirmation(source, confirmation);
      writePromotionReceipt(root, source, recordId);

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });

      expect(result.blockingStage).toBe('critical_auditor_round_required');
      const repaired = readInlineConfirmation(source);
      const tasks = repaired.atomicImplementationTaskList.filter(
        (row: any) => row.derivedFromMustRef === 'MUST-001'
      );
      expect(tasks).toHaveLength(3);
      expect(tasks.map((row: any) => row.primaryObservableBehaviors[0])).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/\baccept\b/iu),
          expect.stringMatching(/\breject\b/iu),
          expect.stringMatching(/\bsubmit\b/iu),
        ])
      );
      expect(tasks.every((row: any) => row.targetFiles.length > 0)).toBe(true);
      expect(
        tasks.every((row: any) =>
          row.targetFiles.every((targetFile: string) => !targetFile.startsWith('docs/'))
        )
      ).toBe(true);
      expect(repaired.preConfirmationDrilldown.criticalAuditor).toMatchObject({
        minimumRounds: 3,
        consecutiveNoNewGapRounds: 0,
        latestReceiptHash: null,
        convergenceVerdict: 'audit_not_run',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fully decomposes compound task oracles in one repair pass and remains idempotent', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-atomic-fixed-point-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const confirmation = readInlineConfirmation(source);
      const packetHash = fixedHash('a');
      const owned = {
        derivedFromMustRef: 'MUST-001',
        derivedFromPacketHash: packetHash,
        projectionStatus: 'synchronized',
      };
      const compoundOracle =
        'Given a stop-loss/take-profit line create or drag reaches an immediately closeable price, when the user selects 确认立即平仓, then Chart submits ConfirmedImmediateCloseIntent to MainTrading, previous LineRuleGraph revision remains active until MainTrading acceptance, TriggerService never evaluates the draft line, MainTrading validates market-data state、trade-context state、quote freshness、position availability、active close orders、LineRuleGraph revision、idempotency key、risk and trading session, accepted intents flow through OrderIntentProcessor, rejected intents return stable immediate_close reason and restore previous line price, and Chart send_order count remains 0.';
      const visibleStateOracle =
        'Given fault injection, when status is queried, then state and reason are visible.';
      const visibleStateWithoutLogsOracle =
        'Given fault injection, when status is queried, then state and reason are visible without reading raw logs.';
      const hotPathWithoutExporterOracle =
        'Given collector/exporter failure, when services continue, then hot paths continue under local safety state without waiting on exporter.';
      const hotPathOracle =
        'Given collector/exporter failure, when services continue, then hot paths continue under local safety state.';
      confirmation.must[0].text = compoundOracle;
      confirmation.atomicImplementationTaskList = [
        {
          id: 'TASK-001',
          text: compoundOracle,
          targetFiles: [
            'vnpy/trader/subprocess_price_line_handlers.py',
            'vnpy/trader/order_intent_processor.py',
            'vnpy/trader/trigger_service/line_rule_graph.py',
          ],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          primaryObservableBehaviors: [compoundOracle],
          primaryAcceptanceOracles: [compoundOracle],
          ...owned,
        },
        {
          id: 'TASK-002',
          text: visibleStateOracle,
          targetFiles: ['vnpy/trader/runtime_supervisor.py'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          primaryObservableBehaviors: [visibleStateOracle],
          primaryAcceptanceOracles: [visibleStateOracle],
          ...owned,
        },
        {
          id: 'TASK-003',
          text: visibleStateWithoutLogsOracle,
          targetFiles: ['vnpy/trader/runtime_supervisor.py'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          primaryObservableBehaviors: [visibleStateWithoutLogsOracle],
          primaryAcceptanceOracles: [visibleStateWithoutLogsOracle],
          ...owned,
        },
        {
          id: 'TASK-004',
          text: hotPathWithoutExporterOracle,
          targetFiles: ['vnpy/trader/runtime_supervisor.py'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          primaryObservableBehaviors: [hotPathWithoutExporterOracle],
          primaryAcceptanceOracles: [hotPathWithoutExporterOracle],
          ...owned,
        },
        {
          id: 'TASK-005',
          text: hotPathOracle,
          targetFiles: ['vnpy/trader/runtime_supervisor.py'],
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          primaryObservableBehaviors: [hotPathOracle],
          primaryAcceptanceOracles: [hotPathOracle],
          ...owned,
        },
      ];
      confirmation.mustExecutionDecompositionMatrix = [
        {
          id: 'MDM-001',
          mustRef: 'MUST-001',
          atomicTaskRefs: ['TASK-001', 'TASK-002', 'TASK-003'],
          ...owned,
        },
      ];
      confirmation.traceRows[0].taskRefs = ['TASK-001', 'TASK-002', 'TASK-003'];
      const initialTaskIds = ['TASK-001', 'TASK-002', 'TASK-003', 'TASK-004', 'TASK-005'];
      confirmation.mustToAtomicTaskMap = {
        'MUST-001': ['TASK-001', 'TASK-002', 'TASK-003'],
      };
      confirmation.atomicTaskToTraceMap = Object.fromEntries(
        initialTaskIds.map((taskId) => [taskId, ['TRACE-001']])
      );
      confirmation.atomicTaskToAcceptanceMap = Object.fromEntries(
        initialTaskIds.map((taskId) => [taskId, ['ACC-001']])
      );
      confirmation.atomicTaskToEvidenceMap = Object.fromEntries(
        initialTaskIds.map((taskId) => [taskId, ['EVD-001']])
      );
      confirmation.atomicTaskToTargetPathMap = Object.fromEntries(
        initialTaskIds.map((taskId) => [
          taskId,
          [
            taskId === 'TASK-002'
              ? 'TARGET-MOD-002'
              : taskId === 'TASK-003'
                ? 'TARGET-MOD-003'
                : 'TARGET-MOD-001',
          ],
        ])
      );
      confirmation.atomicTaskToCommandMap = Object.fromEntries(
        initialTaskIds.map((taskId) => [taskId, ['CMD-001']])
      );
      confirmation.aiTddContractExecutionManifestProjection = {
        ...confirmation.aiTddContractExecutionManifestProjection,
        atomicImplementationTaskLineage: {
          mustToAtomicTaskMap: {
            'MUST-001': ['TASK-001', 'TASK-002', 'TASK-003'],
          },
          atomicTaskToTraceMap: confirmation.atomicTaskToTraceMap,
          atomicTaskToAcceptanceMap: confirmation.atomicTaskToAcceptanceMap,
          atomicTaskToEvidenceMap: confirmation.atomicTaskToEvidenceMap,
          atomicTaskToTargetPathMap: confirmation.atomicTaskToTargetPathMap,
          atomicTaskToCommandMap: confirmation.atomicTaskToCommandMap,
        },
      };
      rewriteInlineConfirmation(source, confirmation);
      writePromotionReceipt(root, source, recordId);
      const paths = authoringPaths(root, recordId);

      const firstResult = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      expect(firstResult.blockingStage).toBe('critical_auditor_round_required');
      const firstSourceHash = sha256Text(readFileSync(source, 'utf8'));
      const firstRequestHash = readJson(paths.request(1)).requestHash;
      const firstConfirmation = readInlineConfirmation(source);
      const firstTasks = firstConfirmation.atomicImplementationTaskList.filter(
        (row: any) => row.derivedFromMustRef === 'MUST-001'
      );
      const firstTaskIds = firstTasks.map((row: any) => row.id);
      const firstOracles = firstTasks.map((row: any) => row.primaryAcceptanceOracles[0]);
      expect(firstTasks.length).toBeGreaterThan(3);
      expect(firstOracles).not.toContain(hotPathWithoutExporterOracle);
      const collectorExporterHotPathOracles = firstOracles.filter((oracle: string) =>
        oracle.includes('hot paths')
      );
      expect(collectorExporterHotPathOracles).toEqual(
        expect.arrayContaining([
          'Given collector failure, when services continue, then hot paths continue under local safety state.',
          'Given exporter failure, when services continue, then hot paths continue under local safety state.',
          'Given collector failure, when services continue, then hot paths must not wait on exporter.',
          'Given exporter failure, when services continue, then hot paths must not wait on exporter.',
        ])
      );
      expect(collectorExporterHotPathOracles).toHaveLength(4);
      expect(
        firstConfirmation.mustExecutionDecompositionMatrix.find(
          (row: any) => row.mustRef === 'MUST-001'
        ).atomicTaskRefs
      ).toEqual(firstTaskIds);
      expect(firstConfirmation.mustToAtomicTaskMap['MUST-001']).toEqual(firstTaskIds);
      expect(
        firstConfirmation.aiTddContractExecutionManifestProjection.atomicImplementationTaskLineage
          .mustToAtomicTaskMap['MUST-001']
      ).toEqual(firstTaskIds);
      const firstPacketMust = readJson(paths.packet).must_decomposition_packet.mustPackets.find(
        (row: any) => row.mustRef === 'MUST-001'
      );
      expect(firstPacketMust.atomicityCompleteness).toEqual({
        splitRule: 'one_task_per_independent_behavior_surface_oracle',
        completenessVerdict: 'complete',
        expectedTaskCount: firstTaskIds.length,
        actualTaskCount: firstTaskIds.length,
      });
      expect(firstPacketMust.mustExecutionDecompositionMatrix[0].atomicTaskRefs).toEqual(
        firstTaskIds
      );
      expect(firstConfirmation.traceRows[0].taskRefs).toEqual(firstTaskIds);
      for (const field of [
        'atomicTaskToTraceMap',
        'atomicTaskToAcceptanceMap',
        'atomicTaskToEvidenceMap',
        'atomicTaskToTargetPathMap',
        'atomicTaskToCommandMap',
      ]) {
        expect(Object.keys(firstConfirmation[field])).toEqual(firstTaskIds);
        expect(
          Object.keys(
            firstConfirmation.aiTddContractExecutionManifestProjection
              .atomicImplementationTaskLineage[field]
          )
        ).toEqual(firstTaskIds);
      }
      expect(firstConfirmation.atomicTaskToTargetPathMap['TASK-002']).toEqual([
        'TARGET-MOD-002',
        'TARGET-MOD-003',
      ]);
      const withoutRawLogsTask = firstTasks.find((row: any) =>
        row.primaryAcceptanceOracles[0].includes('without reading raw logs')
      );
      expect(withoutRawLogsTask).toBeTruthy();
      expect(firstConfirmation.atomicTaskToTargetPathMap[withoutRawLogsTask.id]).toEqual([
        'TARGET-MOD-003',
      ]);

      const secondResult = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });
      const secondTasks = readInlineConfirmation(source).atomicImplementationTaskList.filter(
        (row: any) => row.derivedFromMustRef === 'MUST-001'
      );
      const secondConfirmation = readInlineConfirmation(source);
      const changedProjectionKeys = [
        ...new Set([...Object.keys(firstConfirmation), ...Object.keys(secondConfirmation)]),
      ]
        .filter(
          (key) =>
            JSON.stringify(firstConfirmation[key]) !== JSON.stringify(secondConfirmation[key])
        )
        .sort();

      expect({
        changedProjectionKeys,
        rawSourceStable: sha256Text(readFileSync(source, 'utf8')) === firstSourceHash,
        sourceHashStable: secondResult.sourceDocumentHash === firstResult.sourceDocumentHash,
        confirmationHashStable:
          secondResult.implementationConfirmationHash ===
          firstResult.implementationConfirmationHash,
        packetHashStable: secondResult.packetHash === firstResult.packetHash,
        requestHashStable: readJson(paths.request(1)).requestHash === firstRequestHash,
        tasksStable: JSON.stringify(secondTasks) === JSON.stringify(firstTasks),
        secondIssueCodes: secondResult.blockingIssues.map((issue: any) => issue.code),
      }).toEqual({
        changedProjectionKeys: [],
        rawSourceStable: true,
        sourceHashStable: true,
        confirmationHashStable: true,
        packetHashStable: true,
        requestHashStable: true,
        tasksStable: true,
        secondIssueCodes: [],
      });
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
      const repair = writeSingleMustRepairResponse(paths.request(1), paths.response(1));

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

      expect(repairedConfirmation.must.map((row: any) => row.id)).toContain(repair.mustId);
      expect(rebuiltPacket.mustRefs).toContain(repair.mustId);
      expect(rebuiltPacket.packetHash).not.toBe(originalRequest.packetHash);
      expect(rebuiltPacket.implementationConfirmationHash).toBe(
        result.implementationConfirmationHash
      );
      expect(restartedRequest.packetHash).toBe(rebuiltPacket.packetHash);
      expect(restartedRequest.mustRefs).toContain(repair.mustId);
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

      const archiveArtifact = result.artifacts.find((artifact: string) =>
        artifact.includes('/archive/')
      );
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

  it('resumes pending validated-gap source promotion before rebuilding the old-source dry-run', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-pending-promotion-'));
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
      const sourceBeforeGap = readFileSync(source, 'utf8');
      const promotionReceiptBeforeGap = readFileSync(paths.promotionReceipt, 'utf8');
      const requestBeforeGap = readFileSync(paths.request(1), 'utf8');
      const requestBeforeGapObject = JSON.parse(requestBeforeGap);
      const frozenGateArtifactContents = Object.fromEntries(
        ['reportPath', 'receiptPath', 'reconciliationReportPath'].map((field) => {
          const artifactPath = path.resolve(root, requestBeforeGapObject.gateDryRun[field]);
          return [artifactPath, readFileSync(artifactPath, 'utf8')];
        })
      );
      const repair = writeSingleMustRepairResponse(paths.request(1), paths.response(1));

      const completed = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      const archiveArtifact = completed.artifacts.find((artifact: string) =>
        artifact.includes('/archive/')
      );
      expect(archiveArtifact).toBeTruthy();
      const archivedRequest = readFileSync(
        path.join(root, archiveArtifact as string, path.basename(paths.request(1))),
        'utf8'
      );
      const archivedResponse = readFileSync(
        path.join(root, archiveArtifact as string, path.basename(paths.response(1))),
        'utf8'
      );
      const archivedReceipt = readFileSync(
        path.join(root, archiveArtifact as string, path.basename(paths.receipt(1))),
        'utf8'
      );
      const repairDraftPath = path.join(paths.dir, 'authoring-repair-draft-source.md');
      const sourceMutationDecisionPath = path.join(paths.dir, 'source-mutation-decision.json');
      expect(existsSync(repairDraftPath)).toBe(true);
      expect(readJson(sourceMutationDecisionPath)).toMatchObject({
        finalDecision: 'allow_source_materialization',
        sourceMutationPerformed: false,
        sourceDocumentHashBefore: sha256Text(sourceBeforeGap),
        sourceDocumentHashAfter: sha256Text(readFileSync(repairDraftPath, 'utf8')),
      });

      // Recreate the durable state left when execution stops after the allow decision
      // and before the promotion helper replaces the authoritative source.
      writeFileSync(source, sourceBeforeGap, 'utf8');
      writeFileSync(paths.promotionReceipt, promotionReceiptBeforeGap, 'utf8');
      writeFileSync(paths.request(1), archivedRequest, 'utf8');
      writeFileSync(paths.response(1), archivedResponse, 'utf8');
      writeFileSync(paths.receipt(1), archivedReceipt, 'utf8');
      for (const [artifactPath, contents] of Object.entries(frozenGateArtifactContents)) {
        writeFileSync(artifactPath, contents as string, 'utf8');
      }
      const restoredRequest = readJson(paths.request(1));
      const restoredResponse = readJson(paths.response(1));
      const restoredReceipt = readJson(paths.receipt(1)).criticalAuditorReceipt;
      const { receiptHash, ...receiptPayload } = restoredReceipt;
      const currentSourceText = readFileSync(source, 'utf8');
      const currentSourceExtraction = extractImplementationConfirmationForHash(currentSourceText);
      const currentSourceDocumentHash = sourceDocumentHashForContract(
        currentSourceText,
        currentSourceExtraction.blockText,
        currentSourceExtraction.confirmation
      );
      const currentImplementationConfirmationHash = implementationConfirmationHashForContract(
        currentSourceExtraction.confirmation
      );
      const auditBindingChecks = {
        receiptHash:
          receiptHash === sha256Json(receiptPayload) ||
          receiptHash ===
            sha256Json({
              ...receiptPayload,
              transactionId: receiptPayload.transactionId,
              namespaceVersion: receiptPayload.namespaceVersion,
            }),
        verdict:
          restoredResponse.verdict === 'new_valid_gap' &&
          restoredReceipt.convergenceDecision.verdict === 'new_valid_gap',
        requestHash:
          restoredResponse.requestHash === restoredRequest.requestHash &&
          restoredReceipt.requestHash === restoredRequest.requestHash,
        gateDryRunHash:
          restoredResponse.gateDryRunHash === restoredRequest.gateDryRun.gateDryRunHash &&
          restoredReceipt.gateDryRunHash === restoredRequest.gateDryRun.gateDryRunHash,
        sourceDocumentHash:
          restoredResponse.sourceDocumentHash === currentSourceDocumentHash &&
          restoredRequest.sourceDocumentHash === currentSourceDocumentHash &&
          restoredReceipt.sourceDocumentHash === currentSourceDocumentHash,
        implementationConfirmationHash:
          restoredResponse.implementationConfirmationHash ===
            currentImplementationConfirmationHash &&
          restoredRequest.implementationConfirmationHash ===
            currentImplementationConfirmationHash &&
          restoredReceipt.implementationConfirmationHash === currentImplementationConfirmationHash,
        packetHash:
          restoredResponse.packetHash === restoredRequest.packetHash &&
          restoredReceipt.packetHash === restoredRequest.packetHash,
        validatedGaps:
          sha256Json(restoredReceipt.validatedGaps) ===
          sha256Json(restoredResponse.validatedGaps),
      };
      expect(auditBindingChecks).toEqual(
        Object.fromEntries(Object.keys(auditBindingChecks).map((key) => [key, true]))
      );
      makeCheckpointReceiptsStale(paths);

      const resumed = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(resumed, JSON.stringify(resumed.blockingIssues, null, 2)).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'critical_auditor_round_required',
        nextRequiredAction: 'write_critical_auditor_round_response',
        consecutiveNoNewGapRounds: 0,
      });
      expect(readInlineConfirmation(source).must.map((row: any) => row.id)).toContain(
        repair.mustId
      );
      expect(readJson(paths.request(1))).toMatchObject({
        roundIndex: 1,
        sourceDocumentHash: resumed.sourceDocumentHash,
        implementationConfirmationHash: resumed.implementationConfirmationHash,
        packetHash: resumed.packetHash,
        previousReceipts: [],
      });
      expect(resumed.blockingIssues.map((issue: any) => issue.code)).not.toContain(
        'critical_auditor_response_gate_dry_run_hash_mismatch'
      );
      expect(existsSync(paths.response(1))).toBe(false);
      expect(existsSync(paths.receipt(1))).toBe(false);
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
      expect(existsSync(paths.gate)).toBe(true);
      const repairedSource = readFileSync(source, 'utf8');
      expect(repairedSource).not.toBe(original);
      expect(repairedSource).toContain('CUSTOM-SECTION-MUST-STAY');
      expect(repairedSource).toContain('requiredCommands:');
      expect(repairedSource).toContain('currentTargetMap:');
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
      const afterInitialRepairHash = sha256Text(readFileSync(source, 'utf8'));

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
      expect(existsSync(paths.gate)).toBe(true);

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
      expect(existsSync(paths.gate)).toBe(true);

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
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(afterInitialRepairHash);
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
      expect(
        result,
        JSON.stringify(
          result.blockingIssues.map((issue: any) => ({
            code: issue.code,
            refs: issue.refs,
          })),
          null,
          2
        )
      ).toMatchObject({
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
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'authoring-repair-checkpoint-receipt-refresh-')
    );
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
      expect(
        result,
        JSON.stringify(
          result.blockingIssues.map((issue: any) => ({
            code: issue.code,
            refs: issue.refs,
          })),
          null,
          2
        )
      ).toMatchObject({
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
      expect(checkpointEvidence.checkpointPersistenceSatisfiedCandidate).toBe(false);
      const passedCheckpointReceipts = [0, 1].map((index) =>
        readJson(paths.checkpointReceipt(index))
      );
      expect(checkpointEvidence.checkpointPersistenceRef.completedCheckpointIds).toEqual(
        passedCheckpointReceipts.map((receipt) => receipt.checkpointId)
      );
      for (const checkpointReceipt of passedCheckpointReceipts) {
        expect(checkpointReceipt).toMatchObject({
          sourceDocumentHash: result.sourceDocumentHash,
          implementationConfirmationHash: result.implementationConfirmationHash,
          persistenceStatus: 'committed',
          semanticValidationStatus: 'pass',
          decision: 'pass',
        });
      }
      const deferredCheckpointReceipt = readJson(paths.checkpointReceipt(2));
      expect(deferredCheckpointReceipt).toMatchObject({
        sourceDocumentHash: result.sourceDocumentHash,
        implementationConfirmationHash: result.implementationConfirmationHash,
        persistenceStatus: 'committed',
        semanticValidationStatus: 'block',
        decision: 'block',
      });
      expect(
        deferredCheckpointReceipt.blockers.every((blocker: any) =>
          checkpointEvidence.checkpointPersistenceRef.preRenderGatePolicy.deferredCriticalAuditorBlockers
            .map((policyBlocker: any) => policyBlocker.code)
            .includes(blocker.code)
        )
      ).toBe(true);
      for (let index = 3; index < 9; index += 1) {
        expect(existsSync(paths.checkpointReceipt(index))).toBe(false);
      }
      for (let index = 0; index < 3; index += 1) {
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

  it('fails closed before stale-receipt refresh artifacts when controlled MUST candidates are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-empty-must-refresh-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-EMPTY-MUST-REFRESH';
      const source = writeRichSource(root, recordId);
      const confirmation = readInlineConfirmation(source);
      rewriteInlineConfirmation(source, {
        ...confirmation,
        must: [],
      });
      const receiptPath = writePromotionReceipt(root, source, recordId);
      writeSinglePassScaleArtifacts(root, source, recordId);
      makePromotionReceiptStale(receiptPath);
      const paths = authoringPaths(root, recordId);
      const sourceBeforeRefresh = readFileSync(source, 'utf8');
      const authoringSnapshotBefore = snapshotTextFileHashes(paths.dir);

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
      });

      expect(result).toMatchObject({
        ok: false,
        status: 'blocked',
        blockingStage: 'semantic_kernel_required',
        nextRequiredAction: 'author_controlled_must_candidates',
      });
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'controlled_must_candidates_missing'
      );
      expect(readFileSync(source, 'utf8')).toBe(sourceBeforeRefresh);
      expect(existsSync(paths.kernel)).toBe(false);
      expect(existsSync(paths.packet)).toBe(false);
      expect(existsSync(paths.request(1))).toBe(false);
      expect(snapshotTextFileHashes(paths.dir)).toEqual(authoringSnapshotBefore);
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
        nextRequiredAction:
          'rerun_skill_local_current_source_promotion_or_fix_promotion_gate_blockers',
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

  it('refreshes a published round request when the current gate dry-run binding changes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-stale-gate-request-'));
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
      const currentRequest = readJson(paths.request(1));
      const staleRequest = structuredClone(currentRequest);
      staleRequest.gateDryRun = {
        ...staleRequest.gateDryRun,
        gateDryRunHash: fixedHash('e'),
        actionableBlockingIssueCount: 1,
        actionableBlockingIssues: [
          {
            code: 'source_row_independently_invented',
            message: 'A projection row still carries stale packet metadata.',
            refs: ['failurePaths', 'FAIL-001'],
          },
        ],
        reconciliation: {
          ...staleRequest.gateDryRun.reconciliation,
          verdict: 'fail',
          issueCount: 1,
        },
      };
      staleRequest.requestHash = sha256Json({ ...staleRequest, requestHash: null });
      writeFileSync(paths.request(1), `${JSON.stringify(staleRequest, null, 2)}\n`, 'utf8');
      writeNoNewGapResponse(paths.request(1), paths.response(1));

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        requirementSetId: `${recordId}-SET`,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });

      expect(result.blockingStage).toBe('critical_auditor_response_invalid');
      expect(result.nextRequiredAction).toBe('write_current_critical_auditor_round_response');
      const refreshedRequest = readJson(paths.request(1));
      expect(refreshedRequest.requestHash).not.toBe(staleRequest.requestHash);
      expect(refreshedRequest.gateDryRun.gateDryRunHash).not.toBe(fixedHash('e'));
      expect(refreshedRequest.gateDryRun.actionableBlockingIssueCount).toBe(0);
      expect(refreshedRequest.gateDryRun.reconciliation.issueCount).toBe(0);
      expect(result.artifacts).toContain(rootRelative(root, paths.request(1)));
      expect(existsSync(paths.receipt(1))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('derives projection backrefs through explicit negative failure ownership and command targets', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-negative-owner-chain-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const sourceText = readFileSync(source, 'utf8')
        .replace(
          '      linkedNegIds: ["NEG-001"]\n      linkedEvidenceIds: ["EVD-001"]',
          [
            '      linkedNegIds: ["NEG-001"]',
            '      linkedEvidenceIds: ["EVD-001"]',
            '      ownerMustRefs: ["MUST-001"]',
          ].join('\n')
        )
        .replace(
          '      covers: ["MUST-001", "NEG-001"]\n      taskRefs: ["TASK-001"]',
          '      covers: ["NEG-001"]\n      taskRefs: ["TASK-001"]'
        )
        .replace(
          /( {4}- id: TRACE-001\n[\s\S]*? {6}status: PENDING\n) {6}derivedFromMustRef: MUST-001\n/u,
          '$1'
        )
        .replace(
          /( {4}- id: TARGET-MOD-002\n[\s\S]*? {6}ownerModel: acceptance_tests\n)[\s\S]*?( {6}derivedFromMustRef: MUST-001\n)/u,
          [
            '$1',
            '      requirementRefs: []',
            '      traceRefs: []',
            '      evidenceRefs: []',
            '      artifactRefs: []',
          ].join('\n') + '\n'
        )
        .replace(
          '      targetFiles: ["packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts"]',
          '      targetFiles: ["tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts"]'
        )
        .replace(
          /( {4}- id: CMD-001\n[\s\S]*? {6}evidenceRefs: \["EVD-001"\]\n) {6}derivedFromMustRef: MUST-001\n/u,
          '$1'
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
      const confirmation = readInlineConfirmation(source);
      expect(confirmation.traceRows.find((row: any) => row.id === 'TRACE-001')).toMatchObject({
        derivedFromMustRef: 'MUST-001',
      });
      expect(confirmation.requiredCommands.find((row: any) => row.id === 'CMD-001')).toMatchObject({
        derivedFromMustRef: 'MUST-001',
      });
      expect(
        confirmation.targetModificationPaths.find((row: any) => row.id === 'TARGET-MOD-002')
      ).toMatchObject({
        derivedFromMustRef: 'MUST-001',
      });
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
        .replace(/^ {6,8}projectionStatus: synchronized\n/gm, '')
        .replace(
          '  failurePaths:\n',
          [
            '  failurePaths:',
            '    - id: FAIL-ORPHAN-001',
            '      title: "Orphan failure path"',
            '      trigger: "No requirement or trace ownership exists."',
            '      expectedBehavior: "Remain blocked until ownership is explicit."',
            '      forbiddenBehavior: "Do not infer ownership without an existing relationship."',
            '      blocksCompletionWhenViolated: true',
          ].join('\n') + '\n'
        );
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
      const resultCodes = result.blockingIssues.map((issue: any) => issue.code);
      expect(resultCodes, JSON.stringify(resultCodes)).toContain(
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
      const requirementSetId = `${recordId}-SET`;
      const source = writeRichSource(root, recordId);
      writePromotionReceipt(root, source, recordId);
      ensureCriticalAuditorProviderConfig(root);
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
        requirementSetId,
        '--implementation-attempt-id',
        authoringRepairAttemptId(root, recordId, requirementSetId),
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
