import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAuthoringRepair,
  mainMainAgentOrchestration,
  resolveMainAgentOrchestrationSurface,
  runMainAgentPreConfirmationDrilldown,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

function writeDraftSource(root: string, name = 'source.md'): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Draft Requirement',
      '',
      '- MUST: 主 Agent 的需求确认 lane 只能在原子拆解、投影同步、审计收敛和预渲染门禁通过后渲染确认页。',
      'The lane must not claim delivery readiness before controlled confirmation ingest.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writePlansDraftSource(root: string, name = 'source-plan.md'): string {
  const source = path.join(root, 'docs', 'plans', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Draft Plan Requirement',
      '',
      '- MUST: 正式 docs/plans 需求契约文档必须先通过 staging、scale、checkpoint、encoding、promotion 收据门禁再写回源文件。',
      'The CLI must not mutate this source before Critical Auditor convergence and promotion receipt generation.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeDraftSourceWithoutMust(root: string, name = 'source-without-must.md'): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Background Notes',
      '',
      'This note describes prior discussion and intentionally contains no normative requirement.',
      'It has no inline implementationConfirmation block and no executable behavior request.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writePlainSourceWithControlledCandidate(
  root: string,
  name = 'plain-controlled-candidate.md'
): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Plain Controlled Candidate Requirement',
      '',
      '## Behavior',
      '',
      'The authoring lane must persist a draft implementationConfirmation block without marking it user_confirmed.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeSourceDrivenRequirement(root: string, name = 'source-driven.md'): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Source Driven Requirement',
      '',
      'The source document intentionally starts without an implementationConfirmation block.',
      '',
      '## Requirements',
      '',
      '- MUST: Preserve the user-supplied requirement sentence as a first-class MUST row before rendering.',
      '- MUST: Split every authored MUST row into packet-backed atomic tasks before materialization.',
      '- MUST: Pass Critical Auditor only after the auditor can see all source-derived MUST references.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeRichPreserveExistingRequirement(
  root: string,
  name = 'rich-preserve-existing.md'
): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Rich Preserve Existing Requirement',
      '',
      'CUSTOM-PRESERVE-ANCHOR: this prose must not be overwritten by authoring repair.',
      '',
      'implementationConfirmation:',
      '  contractSchemaVersion: 1',
      '  status: draft',
      '  recordId: REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
      '  requirementSetId: REQSET-PRE-CONFIRMATION-PRESERVE-EXISTING',
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
      '  must:',
      '    - id: MUST-900',
      '      text: "Preserve rich implementationConfirmation rows before confirmation rendering."',
      '      evidenceRefs: ["EVD-900"]',
      '      coveredByTraceRows: ["TRACE-900"]',
      '      coveredBySequenceViews: ["SEQ-900"]',
      '  notDone:',
      '    - id: NEG-900',
      '      text: "Do not replace the existing contract with generated simplified YAML."',
      '      evidenceRefs: ["EVD-900"]',
      '      whyItBlocksCompletion: "Overwrite loses author intent."',
      '      negativeAssertionRequired: true',
      '  mustNot:',
      '    - id: OUT-900',
      '      text: "Confirmation renderability is not delivery readiness."',
      '      scopeBoundary: confirmation_only',
      '      userApprovalRequiredIfChanged: true',
      '  evidence:',
      '    - id: EVD-900',
      '      text: "Repair emits authoring artifacts without mutating source."',
      '      gate: "npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts"',
      '      oracle: "Source content remains unchanged."',
      '      requiredCommandRefs: ["CMD-900"]',
      '      artifactRefs: ["ART-900"]',
      '  traceRows:',
      '    - id: TRACE-900',
      '      covers: ["MUST-900", "NEG-900"]',
      '      taskRefs: []',
      '      evidenceRefs: ["EVD-900"]',
      '      contractValidationCommandRefs: ["CMD-900"]',
      '      deliveryEvidenceCommandRefs: ["CMD-900"]',
      '      acceptanceRefs: ["ACC-900"]',
      '      sequenceViewRefs: ["SEQ-900"]',
      '      boundaryViewRefs: []',
      '      artifactRefs: ["ART-900"]',
      '      status: PENDING',
      '  acceptanceTests:',
      '    - id: ACC-900',
      '      file: tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts',
      '      covers: ["MUST-900"]',
      '      traceRows: ["TRACE-900"]',
      '      evidenceRefs: ["EVD-900"]',
      '      commandRefs: ["CMD-900"]',
      '      positiveControl: true',
      '      expectedPreImplementationState: expected_red',
      '      oracle: "Preserve-existing repair blocks before response artifact."',
      '  requiredCommands:',
      '    - id: CMD-900',
      '      command: "npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts"',
      '      purpose: "Validate preserve-existing repair entry."',
      '      expected: "Targeted test passes."',
      '      targetFiles: ["scripts/main-agent-orchestration.ts"]',
      '      traceRows: ["TRACE-900"]',
      '      evidenceRefs: ["EVD-900"]',
      '  currentTargetMap:',
      '    schemaVersion: current-target-map/v1',
      '    displayProfile: closed_loop_current_target_map',
      '    currentSummary:',
      '      - title: "Existing source"',
      '        detail: "Rich source already exists."',
      '    targetSummary:',
      '      - title: "Repaired source"',
      '        detail: "Authoring artifacts are synchronized without source overwrite."',
      '    diffRows:',
      '      - dimension: "Authoring repair"',
      '        currentState: "pre-render gate missing"',
      '        targetState: "Critical Auditor request emitted"',
      '        action: "write response artifact"',
      '  customAuditRows:',
      '    - id: CUSTOM-ROW-900',
      '      text: "custom section must stay"',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256Json(value: unknown): string {
  return sha256Text(stableStringify(value));
}

function authorityForSource(root: string, source: string): {
  targetPath: string;
  requiredCommand: string;
} {
  const targetPath = path.relative(root, source).replace(/\\/g, '/');
  return {
    targetPath,
    requiredCommand: `npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts ${path.basename(targetPath)}`,
  };
}

function writeValidationAuthorityTarget(root: string): {
  targetPath: string;
  requiredCommand: string;
} {
  const targetPath = 'src/requirements-contract-authoring.ts';
  const absoluteTargetPath = path.join(root, targetPath);
  mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  writeFileSync(
    absoluteTargetPath,
    'export const requirementsContractAuthoringTarget = true;\n',
    'utf8'
  );
  return {
    targetPath,
    requiredCommand: `npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts ${targetPath}`,
  };
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  const bookkeeping = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
  ]);
  return Object.fromEntries(Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key)));
}

function currentSourceHashes(source: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const text = readFileSync(source, 'utf8');
  const match = text.match(/^implementationConfirmation:\n[\s\S]*$/m);
  expect(match, 'implementationConfirmation block').toBeTruthy();
  const confirmation = (yaml.load(match![0]) as any).implementationConfirmation;
  const semantic = semanticConfirmationForHash(confirmation);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256Text(text.replace(match![0], normalizedBlock)),
    implementationConfirmationHash: sha256Json(semantic),
  };
}

function writePromotionReceipt(
  root: string,
  source: string,
  recordId: string,
  requirementSetId: string
): string {
  const hashes = currentSourceHashes(source);
  const sourcePath = path.relative(root, source).replace(/\\/g, '/');
  const targetHash = sha256Text(readFileSync(source, 'utf8'));
  const receiptPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'promotion-receipt.json'
  );
  const receipt: Record<string, unknown> = {
    ok: true,
    dryRun: false,
    preflightOnly: false,
    draftPath: `_bmad-output/runtime/requirement-records/${recordId}/authoring/draft-source-preview.md`,
    targetPath: sourcePath,
    promotionStage: 'authoring-draft',
    allowedStatuses: ['draft', 'draft_updated_not_confirmation_ready', 'reconfirm_required'],
    statusValue: 'draft',
    confirmationReady: false,
    safePromotionAsDraft: true,
    requiresUserConfirmationBeforeExecution: true,
    manifestPath: `_bmad-output/runtime/requirement-records/${recordId}/authoring/draft-manifest.json`,
    targetHash,
    writeReceipt: {
      schemaVersion: 'large-document-writer-safe-write/v1',
      targetPath: sourcePath,
      finalHash: targetHash,
      mode: 'replace',
    },
    backupPath: `_bmad-output/runtime/requirement-records/${recordId}/authoring/promotion-backup.md`,
    preflight: {
      manifest: {
        targetPath: sourcePath,
        draftHash: targetHash,
        statusValue: 'draft',
        recordId,
        requirementSetId,
      },
    },
    authoringPromotionGate: {
      required: true,
      ok: true,
      decisions: {
        sourceMutation: {
          finalDecision: 'allow_source_materialization',
          sourceMutationAllowed: true,
          sourceDocumentExistedBefore: true,
          sourceDocumentHashBefore: hashes.sourceDocumentHash,
          sourceDocumentHashAfter: targetHash,
        },
      },
    },
    receiptPath: path.relative(root, receiptPath).replace(/\\/g, '/'),
    failureClass: null,
  };
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receiptPath;
}

function readImplementationConfirmation(source: string): any {
  const text = readFileSync(source, 'utf8');
  const match = text.match(/^implementationConfirmation:\n[\s\S]*$/m);
  expect(match, 'implementationConfirmation block').toBeTruthy();
  return (yaml.load(match![0]) as any).implementationConfirmation;
}

function readDraftPreviewImplementationConfirmation(paths: ReturnType<typeof artifacts>): any {
  expect(existsSync(paths.draftSourcePreview), 'draft source preview').toBe(true);
  return readImplementationConfirmation(paths.draftSourcePreview);
}

function unwrapArtifact(value: any): any {
  return (
    value.semanticKernel ?? value.must_decomposition_packet ?? value.criticalAuditorReceipt ?? value
  );
}

function expectArtifactContract(file: string, recordId: string): void {
  const artifact = unwrapArtifact(readJson(file));
  expect(artifact.schemaVersion, `${file} schemaVersion`).toBeTruthy();
  expect(artifact.recordId, `${file} recordId`).toBe(recordId);
  expect(artifact.sourceDocumentHash, `${file} sourceDocumentHash`).toMatch(/^sha256:/);
  expect(artifact.implementationConfirmationHash, `${file} implementationConfirmationHash`).toMatch(
    /^sha256:/
  );
  expect(
    artifact.contentHash ??
      artifact.receiptHash ??
      artifact.kernelHash ??
      artifact.packetHash ??
      artifact.progressHash ??
      artifact.reportHash ??
      artifact.reconciliationHash,
    `${file} content or receipt hash`
  ).toMatch(/^sha256:/);
  expect(artifact.createdBy, `${file} createdBy`).toBeTruthy();
  expect(artifact.createdAt, `${file} createdAt`).toBeTruthy();
  const inputRefs = Array.isArray(artifact.inputRefs)
    ? artifact.inputRefs
    : Array.isArray(artifact.resumeLedger?.checkpointReceiptRefs)
      ? artifact.resumeLedger.checkpointReceiptRefs
      : null;
  expect(Array.isArray(inputRefs), `${file} inputRefs`).toBe(true);
  expect(inputRefs?.length ?? 0, `${file} inputRefs length`).toBeGreaterThan(0);
}

function expectCheckpointAutoPromoted(
  result: any,
  paths: ReturnType<typeof artifacts>
): void {
  expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
    'checkpoint_required_before_source_materialization'
  );
  expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(true);
  expect(existsSync(paths.encodingReport)).toBe(true);
  expect(existsSync(paths.sourceMutationDecision)).toBe(true);
  const sourceMutationDecision = readJson(paths.sourceMutationDecision);
  expect(sourceMutationDecision).toMatchObject({
    finalDecision: 'allow_source_materialization',
    sourceMutationAllowed: true,
    sourceMutationPerformed: false,
    scaleRoutingDecision: 'single_pass_final_allowed',
  });
  const routeDecision = readJson(paths.scaleRoutingDecision);
  expect(routeDecision.decision).toBe('single_pass_final_allowed');
  expect(routeDecision.checkpointPersistenceSatisfied).toBe(true);
  const evidence = readJson(paths.checkpointPersistenceEvidence);
  expect(evidence.checkpointPersistenceSatisfiedCandidate).toBe(true);
  expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
  expect(existsSync(paths.promotionReceipt)).toBe(true);
  const promotionReceipt = readJson(paths.promotionReceipt);
  expect(promotionReceipt).toMatchObject({
    ok: true,
    promotionStage: 'authoring-draft',
    safePromotionAsDraft: true,
  });
}

function artifacts(root: string, recordId: string, requirementSetId = recordId) {
  const authoring = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring'
  );
  const confirmation = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'confirmation'
  );
  return {
    authoring,
    confirmation,
    semanticKernel: path.join(authoring, 'semantic-kernel.json'),
    packet: path.join(authoring, 'must_decomposition_packet.json'),
    controlledMustCandidates: path.join(authoring, 'controlled-must-candidates.json'),
    requirementCoverageLedger: path.join(authoring, 'requirement-coverage-ledger.json'),
    targetAuthorityReport: path.join(authoring, 'target-authority-report.json'),
    validationAuthorityReport: path.join(authoring, 'validation-authority-report.json'),
    projectionDomainSanityReport: path.join(authoring, 'projection-domain-sanity-report.json'),
    sourceMutationDecision: path.join(authoring, 'source-mutation-decision.json'),
    draftSourcePreview: path.join(authoring, 'draft-source-preview.md'),
    promotionReceipt: path.join(authoring, 'promotion-receipt.json'),
    draftImplementationConfirmation: path.join(authoring, 'draft-implementation-confirmation.json'),
    authoringMaterializationReceipt: path.join(authoring, 'authoring-materialization-receipt.json'),
    scaleAssessmentInitial: path.join(authoring, 'scale-assessment-initial.json'),
    scaleAssessmentPostPacket: path.join(authoring, 'scale-assessment-post-packet.json'),
    scaleAssessmentPostMaterialization: path.join(
      authoring,
      'scale-assessment-post-materialization.json'
    ),
    scaleRoutingDecision: path.join(authoring, 'scale-routing-decision.json'),
    checkpointPersistenceEvidence: path.join(authoring, 'checkpoint-persistence-evidence.json'),
    encodingReport: path.join(authoring, 'encoding-report.json'),
    receipt1: path.join(authoring, 'critical-auditor-receipt-round-1.json'),
    receipt2: path.join(authoring, 'critical-auditor-receipt-round-2.json'),
    receipt3: path.join(authoring, 'critical-auditor-receipt-round-3.json'),
    reconciliation: path.join(authoring, 'must_packet_source_reconciliation_report.json'),
    progress: path.join(authoring, 'semantic-checkpoint-progress.json'),
    sourceMaterializationReceipt: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requirementSetId,
      'authoring',
      'source-materialization-receipt.json'
    ),
    mustGate: path.join(authoring, 'pre-render-must-decomposition-gate-report.json'),
    globalGate: path.join(authoring, 'pre-render-global-consistency-report.json'),
    html: path.join(confirmation, 'confirmation.html'),
    summary: path.join(confirmation, 'confirmation-summary.json'),
    renderReport: path.join(confirmation, 'confirmation-render-report.json'),
  };
}

function cleanCriticalAuditorRound(input: any) {
  const { roundIndex, gateDryRun, packetProjectionSummary } = input;
  return {
    verdict: 'no_new_valid_gap' as const,
    gateDryRunHash: gateDryRun.hash,
    reconciliationIssueCount: gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups: packetProjectionSummary.projectionGroups,
    reviewedProjectionRefs: packetProjectionSummary.projectionRefs.slice(0, 1),
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${roundIndex}-BASELINE`,
        disposition: roundIndex === 1 ? 'new' : 'unchanged',
        evidenceRefs: [gateDryRun.reportPath],
      },
    ],
    rejectedGapCandidates: [{ id: `REJ-${roundIndex}`, reason: 'no new valid gap detected' }],
    falsePositiveProofs: (gateDryRun.actionableBlockingIssues ?? []).map((issue: any) => ({
      blockerCode: String(issue.code ?? ''),
      proofType: 'current_source_packet_hash_match',
      evidenceRefs: [gateDryRun.reportPath],
    })),
    rationale: `Round ${roundIndex} found no new valid gap.`,
  };
}

function captureMainAgentCli(args: string[]): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let stdout = '';
  let stderr = '';
  try {
    (process.stdout.write as any) = (chunk: unknown) => {
      stdout += String(chunk);
      return true;
    };
    (process.stderr.write as any) = (chunk: unknown) => {
      stderr += String(chunk);
      return true;
    };
    const exitCode = mainMainAgentOrchestration(args);
    return { exitCode, stdout, stderr };
  } finally {
    process.stdout.write = originalStdoutWrite as any;
    process.stderr.write = originalStderrWrite as any;
  }
}

describe('main-agent requirement_confirmation.pre_confirmation_drilldown lane', () => {
  it('auto-persists checkpoints and promotes through the authoring-draft source writer', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-'));
    try {
      const source = writeDraftSource(root);
      const beforeSourceText = readFileSync(source, 'utf8');

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-E2E',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-E2E',
        confirmationLanguage: 'zh-CN',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-E2E', 'REQSET-PRE-CONFIRMATION-E2E');
      expect(result.currentMentalModel).toBe('requirement_confirmation');
      expect(result.lane).toBe('pre_confirmation_drilldown');
      expectCheckpointAutoPromoted(result, paths);
      expect(readFileSync(source, 'utf8')).not.toBe(beforeSourceText);
      expect(result.nextMentalModel).toBeNull();
      expect(result.deliveryReadiness.ready).toBe(false);
      expect(existsSync(paths.promotionReceipt)).toBe(true);
      expect(result.finalStandards).toMatchObject({
        newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: true,
        singlePassCannotSkipAtomicDecompositionLoop: true,
        threeConsecutiveNoNewValidGapRoundsRequired: true,
        mustDecompositionPacketSynchronizedBeforeMaterialization: true,
        packetSourceReconciliationPassesBidirectionally: true,
        preRenderGateBlocksMissingCoreSurfaces: false,
        rendererShowsFullDrilldownInteraction: true,
      });

      for (const file of [
        paths.semanticKernel,
        paths.packet,
        paths.scaleAssessmentInitial,
        paths.scaleAssessmentPostPacket,
        paths.scaleAssessmentPostMaterialization,
        paths.scaleRoutingDecision,
        paths.sourceMutationDecision,
        paths.receipt1,
        paths.receipt2,
        paths.receipt3,
        paths.reconciliation,
        paths.progress,
        paths.mustGate,
        paths.globalGate,
      ]) {
        expect(existsSync(file), file).toBe(true);
      }
      expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(true);

      for (const file of [
        paths.semanticKernel,
        paths.packet,
        paths.receipt1,
        paths.receipt2,
        paths.receipt3,
        paths.reconciliation,
        paths.progress,
        paths.mustGate,
        paths.globalGate,
      ]) {
        expectArtifactContract(file, 'REQ-PRE-CONFIRMATION-E2E');
      }

      const packet = readJson(paths.packet).must_decomposition_packet;
      const initialAssessment = readJson(paths.scaleAssessmentInitial);
      const postPacketAssessment = readJson(paths.scaleAssessmentPostPacket);
      const postMaterializationAssessment = readJson(paths.scaleAssessmentPostMaterialization);
      const scaleRoutingDecision = readJson(paths.scaleRoutingDecision);
      const mustGate = readJson(paths.mustGate);
      const globalGate = readJson(paths.globalGate);
      const reconciliation = readJson(paths.reconciliation);
      const progress = readJson(paths.progress);
      expect(packet.status).toBe('synchronized');
      expect(initialAssessment.phase).toBe('initial_assessment');
      expect(initialAssessment.provisionalDecision).toBe('provisional_single_pass_allowed');
      expect(postPacketAssessment.phase).toBe('post_packet_assessment');
      expect(postPacketAssessment.signals.conditionalDomainCount).toBe(
        postPacketAssessment.signals.applicableConditionalDomains.length
      );
      expect(postMaterializationAssessment.phase).toBe('post_materialization_assessment');
      expect(scaleRoutingDecision.decision).toBe('single_pass_final_allowed');
      expect(scaleRoutingDecision.latestCompletedPhase).toBe('post_materialization_assessment');
      expect(scaleRoutingDecision.checkpointPersistenceSatisfied).toBe(true);
      expect(scaleRoutingDecision.routeDecisionHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(progress.documentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(progress.checkpoints.map((checkpoint: any) => checkpoint.id)).toEqual([
        'cp-00-semantic-kernel',
        'cp-01-must-decomposition-packet',
        'cp-02-atomic-decomposition-loop-convergence',
        'cp-03-packet-to-source-materialization',
        'cp-04-id-freeze',
        'cp-05-implementation-confirmation-core',
        'cp-06-projections',
        'cp-07-human-readable-views',
        'cp-08-pre-render-global-reconciliation',
      ]);
      expect(progress.checkpoints.every((checkpoint: any) => checkpoint.status === 'passed')).toBe(
        true
      );
      expect(packet.lifecycle.atomicDecompositionLoopEnteredBeforeMaterialization).toBe(true);
      expect(packet.lifecycle.singlePassBypassPrevented).toBe(true);
      expect(packet.lifecycle.materializedAfterStatus).toBe('synchronized');
      expect(packet.consecutiveNoNewValidGapRounds).toBe(3);
      expect(packet.mustPackets[0].mustAtomicTasks.length).toBeGreaterThanOrEqual(2);
      expect(mustGate.verdict).toBe('PASS');
      expect(mustGate.confirmability).toBe('confirmable');
      expect(mustGate.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);
      expect(globalGate.verdict).toBe('PASS');
      expect(reconciliation.verdict).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects single_pass because it would skip the atomic decomposition loop', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-single-pass-'));
    try {
      const source = writeDraftSource(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-SINGLE-PASS',
        ...authorityForSource(root, source),
        mode: 'single_pass',
      });

      expect(result.substate).toBe('blocked_by_under_split_task');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'single_pass_cannot_skip_atomic_decomposition_loop'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when no explicit MUST rows or inline implementationConfirmation.must entries exist', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-missing-must-'));
    try {
      const source = writeDraftSourceWithoutMust(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-MISSING-MUST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-MISSING-MUST',
        confirmationLanguage: 'zh-CN',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-MISSING-MUST');
      expect(result.substate).toBe('blocked_by_semantic_gap');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'controlled_must_candidates_missing'
      );
      expect(existsSync(paths.controlledMustCandidates)).toBe(true);
      expect(existsSync(paths.draftImplementationConfirmation)).toBe(true);
      expect(existsSync(paths.authoringMaterializationReceipt)).toBe(true);
      const candidates = readJson(paths.controlledMustCandidates);
      const draftProjection = readJson(paths.draftImplementationConfirmation);
      const receipt = readJson(paths.authoringMaterializationReceipt);
      expect(candidates).toMatchObject({
        schemaVersion: 'requirements-authoring-controlled-must-candidates/v1',
        sourcePath: 'docs/requirements/source-without-must.md',
        candidateCount: 0,
        acceptedCandidateCount: 0,
        mustCount: 0,
        failClosed: true,
        decision: 'controlled_must_candidates_missing',
      });
      expect(draftProjection).toMatchObject({
        schemaVersion: 'requirements-authoring-draft-implementation-confirmation/v1',
        candidateCount: 0,
        acceptedCandidateCount: 0,
        mustCount: 0,
        failClosed: true,
        decision: 'controlled_must_candidates_missing',
      });
      expect(receipt).toMatchObject({
        schemaVersion: 'requirements-authoring-materialization-receipt/v1',
        candidateCount: 0,
        acceptedCandidateCount: 0,
        mustCount: 0,
        failClosed: true,
        decision: 'controlled_must_candidates_missing',
        requiresUserConfirmationBeforeExecution: true,
      });
      expect(existsSync(paths.semanticKernel)).toBe(false);
      expect(existsSync(paths.packet)).toBe(false);
      expect(existsSync(paths.receipt1)).toBe(false);
      expect(existsSync(paths.renderReport)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('materializes controlled MUST candidates from plain source before draft confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-plain-candidate-'));
    try {
      const source = writePlainSourceWithControlledCandidate(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-PLAIN-CANDIDATE',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-PLAIN-CANDIDATE',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-PLAIN-CANDIDATE',
        'REQSET-PRE-CONFIRMATION-PLAIN-CANDIDATE'
      );
      const candidates = readJson(paths.controlledMustCandidates);
      const draftProjection = readJson(paths.draftImplementationConfirmation);
      const receipt = readJson(paths.authoringMaterializationReceipt);
      const confirmation = readDraftPreviewImplementationConfirmation(paths);
      const mustRow = confirmation.must[0];

      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'controlled_must_candidates_missing'
      );
      expect(existsSync(paths.controlledMustCandidates)).toBe(true);
      expect(existsSync(paths.draftImplementationConfirmation)).toBe(true);
      expect(existsSync(paths.authoringMaterializationReceipt)).toBe(true);
      expect(candidates).toMatchObject({
        schemaVersion: 'requirements-authoring-controlled-must-candidates/v1',
        candidateCount: 1,
        acceptedCandidateCount: 1,
        mustCount: 1,
        failClosed: false,
        decision: 'draft_materialization_allowed',
      });
      expect(candidates.candidates[0]).toMatchObject({
        candidateId: 'MUST-CAND-001',
        sourcePath: 'docs/requirements/plain-controlled-candidate.md',
        sourceSpan: { startLine: 5, endLine: 5 },
        headingPath: ['Plain Controlled Candidate Requirement', 'Behavior'],
        decision: 'accepted_for_draft',
        requiresHumanReview: true,
      });
      expect(candidates.candidates[0].sourceDocumentHash).toMatch(/^sha256:/u);
      expect(draftProjection).toMatchObject({
        schemaVersion: 'requirements-authoring-draft-implementation-confirmation/v1',
        status: 'draft',
        candidateCount: 1,
        acceptedCandidateCount: 1,
        mustCount: 1,
        failClosed: false,
        decision: 'draft_materialization_allowed',
      });
      expect(receipt).toMatchObject({
        schemaVersion: 'requirements-authoring-materialization-receipt/v1',
        candidateCount: 1,
        acceptedCandidateCount: 1,
        mustCount: 1,
        failClosed: false,
        decision: 'draft_materialization_allowed',
        requiresUserConfirmationBeforeExecution: true,
      });
      expect(mustRow).toMatchObject({
        text: 'The authoring lane must persist a draft implementationConfirmation block without marking it user_confirmed.',
        source: 'controlled_plain_source_candidate',
        sourceLine: 5,
        sourcePath: 'docs/requirements/plain-controlled-candidate.md',
        sourceSpan: { startLine: 5, endLine: 5 },
        candidateId: 'MUST-CAND-001',
      });
      expect(mustRow.id).toMatch(/^MUST-REQSET-PRE-CONFIRMATION-L5-001$/u);
      expect(mustRow.sourceDocumentHash).toBe(candidates.sourceDocumentHash);
      expect(confirmation.status).toBe('draft');
      expect(confirmation.status).not.toBe('user_confirmed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits initial scale assessment before returning controlled_must_candidates_missing', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-missing-must-scale-')
    );
    try {
      const source = writeDraftSourceWithoutMust(root);
      const authority = authorityForSource(root, source);

      const captured = captureMainAgentCli([
        '--cwd',
        root,
        '--action',
        'author-confirmation-ready-source',
        '--source',
        source,
        '--record-id',
        'REQ-PRE-CONFIRMATION-MISSING-MUST-SCALE',
        '--requirement-set-id',
        'REQSET-PRE-CONFIRMATION-MISSING-MUST-SCALE',
        '--target-path',
        authority.targetPath,
        '--required-command',
        authority.requiredCommand,
      ]);

      expect(captured.exitCode).toBe(1);
      expect(captured.stderr).toContain('[requirements-contract-authoring] scale assessment started');
      expect(captured.stderr).toContain('[requirements-contract-authoring] scale assessment result');
      expect(captured.stdout).toContain('controlled_must_candidates_missing');

      const parsed = JSON.parse(captured.stdout);
      expect(parsed.selectedAuthoringLane).toBe('author-confirmation-ready-source');
      expect(parsed.advisoryScan).toMatchObject({
        purpose: 'pre_materialization_advisory_scan',
        evidenceClass: 'not_audit_evidence',
        notAuditEvidence: true,
        readOnly: true,
        loopAllowed: false,
        artifactWriteAllowed: false,
      });
      expect(parsed.visibleAuthoringLaneMessage).toContain(
        'author-confirmation-ready-source lane selected'
      );
      expect(parsed.confirmationLanguage).toBeNull();
      expect(parsed.blockingIssues.map((issue: any) => issue.code)).toContain(
        'controlled_must_candidates_missing'
      );
      expect(existsSync(artifacts(root, 'REQ-PRE-CONFIRMATION-MISSING-MUST-SCALE').html)).toBe(
        false
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not create or mutate docs/plans source without Critical Auditor and promotion evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-plans-no-receipt-'));
    try {
      const source = writePlansDraftSource(root);
      const beforeSourceText = readFileSync(source, 'utf8');
      const beforeSourceHash = sha256Text(beforeSourceText);
      const authority = writeValidationAuthorityTarget(root);

      const captured = captureMainAgentCli([
        '--cwd',
        root,
        '--action',
        'author-confirmation-ready-source',
        '--source',
        source,
        '--record-id',
        'REQ-PRE-CONFIRMATION-PLANS-NO-RECEIPT',
        '--requirement-set-id',
        'REQSET-PRE-CONFIRMATION-PLANS-NO-RECEIPT',
        '--target-path',
        authority.targetPath,
        '--required-command',
        authority.requiredCommand,
      ]);
      const parsed = JSON.parse(captured.stdout);
      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-PLANS-NO-RECEIPT',
        'REQSET-PRE-CONFIRMATION-PLANS-NO-RECEIPT'
      );

      expect(captured.exitCode).toBe(1);
      expect(parsed.sourcePath).toBe('docs/plans/source-plan.md');
      expect(parsed.blockingStage).toBe('critical_auditor_provider_mode_required');
      expect(parsed.sourceMutationPerformed).toBe(false);
      expect(parsed.forbiddenArtifacts).toContain('promotion-receipt');
      expect(parsed.forbiddenArtifacts).toContain('source-materialization-receipt');
      expect(readFileSync(source, 'utf8')).toBe(beforeSourceText);
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(beforeSourceHash);
      expect(existsSync(paths.scaleAssessmentInitial)).toBe(true);
      expect(existsSync(paths.scaleRoutingDecision)).toBe(true);
      expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(false);
      expect(existsSync(paths.encodingReport)).toBe(false);
      expect(existsSync(paths.sourceMutationDecision)).toBe(true);
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(existsSync(paths.draftSourcePreview)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed instead of synthesizing clean Critical Auditor receipts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-no-auditor-'));
    try {
      const source = writeDraftSource(root);
      const authority = writeValidationAuthorityTarget(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-NO-AUDITOR',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-NO-AUDITOR',
        confirmationLanguage: 'zh-CN',
        ...authority,
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-NO-AUDITOR');
      expect(result.substate).toBe('critical_auditor_round_required');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(result.blockingStage).toBe('critical_auditor_provider_mode_required');
      expect(result.nextRequiredAction).toBe('run_main_session_critical_auditor_round');
      expect(result.criticalAuditorContinuation).toMatchObject({
        providerMode: 'main_session_inline',
        roundIndex: 1,
        nextRequiredAction: 'run_main_session_critical_auditor_round',
      });
      expect(existsSync(paths.receipt1)).toBe(false);
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
      expect(existsSync(paths.renderReport)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('authoring-repair preserve-existing keeps a rich implementationConfirmation and blocks with a repair command', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-preserve-existing-')
    );
    try {
      const source = writeRichPreserveExistingRequirement(root);
      writePromotionReceipt(
        root,
        source,
        'REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
        'REQSET-PRE-CONFIRMATION-PRESERVE-EXISTING'
      );
      const original = readFileSync(source, 'utf8');

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-PRESERVE-EXISTING',
        mode: 'preserve-existing',
      });

      expect(result.status).toBe('blocked');
      expect(result.blockingStage).toBe('critical_auditor_round_required');
      expect(result.nextRequiredAction).toBe('write_critical_auditor_round_response');
      expect(result.repairCommand).toContain(
        'main-agent-orchestration --action authoring-repair --mode preserve-existing'
      );
      expect(existsSync(path.join(root, result.paths.semanticKernel))).toBe(true);
      expect(existsSync(path.join(root, result.paths.mustDecompositionPacket))).toBe(true);
      expect(
        existsSync(
          path.join(
            root,
            '_bmad-output',
            'runtime',
            'requirement-records',
            'REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
            'authoring',
            'critical-auditor-round-request-1.json'
          )
        )
      ).toBe(true);
      expect(readFileSync(source, 'utf8')).toBe(original);
      expect(readFileSync(source, 'utf8')).toContain('CUSTOM-PRESERVE-ANCHOR');
      expect(readFileSync(source, 'utf8')).toContain('customAuditRows:');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('continues Critical Auditor rounds until three consecutive no-new-gap receipts', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-real-audit-loop-')
    );
    try {
      const source = writeDraftSource(root);
      const seenRounds: number[] = [];

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-REAL-AUDIT-LOOP',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-REAL-AUDIT-LOOP',
        confirmationLanguage: 'zh-CN',
        ...authorityForSource(root, source),
        criticalAuditorRound: (input) => {
          const { roundIndex } = input;
          seenRounds.push(roundIndex);
          if (roundIndex <= 2) {
            return {
              verdict: 'new_valid_gap',
              gateDryRunHash: input.gateDryRun.hash,
              reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
              checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
              reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
              priorFindingsDisposition: [
                {
                  findingRef: `ROUND-${roundIndex}-GAP`,
                  disposition: 'new',
                  evidenceRefs: [input.gateDryRun.reportPath],
                },
              ],
              gapCandidates: [{ id: `GAP-${roundIndex}`, status: 'resolved' }],
              validatedGaps: [{ id: `GAP-${roundIndex}`, status: 'resolved' }],
              rationale: `Round ${roundIndex} found a valid gap and reset convergence.`,
            };
          }
          return {
            verdict: 'no_new_valid_gap',
            gateDryRunHash: input.gateDryRun.hash,
            reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
            checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
            reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
            priorFindingsDisposition: [
              {
                findingRef: `ROUND-${roundIndex}-BASELINE`,
                disposition: 'unchanged',
                evidenceRefs: [input.gateDryRun.reportPath],
              },
            ],
            rejectedGapCandidates: [
              { id: `REJ-${roundIndex}`, reason: 'no new valid gap after repairs' },
            ],
            rationale: `Round ${roundIndex} found no new valid gap.`,
          };
        },
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-REAL-AUDIT-LOOP');
      const receipt4 = path.join(paths.authoring, 'critical-auditor-receipt-round-4.json');
      const receipt5 = path.join(paths.authoring, 'critical-auditor-receipt-round-5.json');
      const receipt6 = path.join(paths.authoring, 'critical-auditor-receipt-round-6.json');
      const mustGate = readJson(paths.mustGate);

      expectCheckpointAutoPromoted(result, paths);
      expect(seenRounds).toEqual([1, 2, 3, 4, 5]);
      expect(existsSync(paths.receipt1)).toBe(true);
      expect(existsSync(paths.receipt2)).toBe(true);
      expect(existsSync(paths.receipt3)).toBe(true);
      expect(existsSync(receipt4)).toBe(true);
      expect(existsSync(receipt5)).toBe(true);
      expect(readJson(paths.receipt1).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'new_valid_gap'
      );
      expect(readJson(paths.receipt2).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'new_valid_gap'
      );
      expect(readJson(paths.receipt3).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'no_new_valid_gap'
      );
      expect(readJson(receipt4).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'no_new_valid_gap'
      );
      expect(readJson(receipt5).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'no_new_valid_gap'
      );
      expect(existsSync(receipt6)).toBe(false);
      expect(mustGate.verdict).toBe('PASS');
      expect(mustGate.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('authors source-derived MUST rows into packet projections and audits until three clean rounds', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-source-driven-'));
    try {
      const source = writeSourceDrivenRequirement(root);
      const expectedMustTexts = [
        'Preserve the user-supplied requirement sentence as a first-class MUST row before rendering.',
        'Split every authored MUST row into packet-backed atomic tasks before materialization.',
        'Pass Critical Auditor only after the auditor can see all source-derived MUST references.',
      ];
      const seenAuditorInputs: any[] = [];

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-SOURCE-DRIVEN',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-SOURCE-DRIVEN',
        confirmationLanguage: 'en-US',
        ...authorityForSource(root, source),
        criticalAuditorRound: (input) => {
          seenAuditorInputs.push(input);
          if (input.roundIndex === 1) {
            return {
              verdict: 'new_valid_gap',
              gateDryRunHash: input.gateDryRun.hash,
              reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
              checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
              reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
              priorFindingsDisposition: [
                {
                  findingRef: 'GAP-SOURCE-ROUND-1',
                  disposition: 'new',
                  evidenceRefs: [input.gateDryRun.reportPath],
                },
              ],
              gapCandidates: [{ id: 'GAP-SOURCE-ROUND-1', status: 'resolved' }],
              validatedGaps: [{ id: 'GAP-SOURCE-ROUND-1', status: 'resolved' }],
              rationale: 'First audit round found a resolved source-driven decomposition gap.',
            };
          }
          return {
            verdict: 'no_new_valid_gap',
            gateDryRunHash: input.gateDryRun.hash,
            reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
            checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
            reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
            priorFindingsDisposition: [
              {
                findingRef: `ROUND-${input.roundIndex}-SOURCE`,
                disposition: 'unchanged',
                evidenceRefs: [input.gateDryRun.reportPath],
              },
            ],
            rejectedGapCandidates: [
              { id: `REJ-SOURCE-${input.roundIndex}`, reason: 'all source-derived MUSTs visible' },
            ],
            rationale: `Round ${input.roundIndex} found no new source-derived gap.`,
          };
        },
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-SOURCE-DRIVEN');
      const confirmation = readDraftPreviewImplementationConfirmation(paths);
      const kernel = readJson(paths.semanticKernel).semanticKernel;
      const packet = readJson(paths.packet).must_decomposition_packet;
      const mustGate = readJson(paths.mustGate);
      const sourceText = readFileSync(paths.draftSourcePreview, 'utf8');

      expectCheckpointAutoPromoted(result, paths);
      expect(seenAuditorInputs.map((input) => input.roundIndex)).toEqual([1, 2, 3, 4]);
      expect(mustGate.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);

      const mustRows = confirmation.must as Array<{ id: string; text: string }>;
      const mustTexts = mustRows.map((row) => row.text);
      expect(mustRows).toHaveLength(3);
      expect(mustTexts).toEqual(expectedMustTexts);
      expect(sourceText).toContain(expectedMustTexts[0]);
      expect(sourceText).toContain(expectedMustTexts[1]);
      expect(sourceText).toContain(expectedMustTexts[2]);

      const mustRefs = mustRows.map((row) => row.id);
      expect(kernel.mustCandidates).toEqual(mustRefs);
      expect(packet.mustPackets.map((row: any) => row.mustRef)).toEqual(mustRefs);
      expect(packet.mustPackets.map((row: any) => row.mustIntent)).toEqual(expectedMustTexts);

      for (const mustPacket of packet.mustPackets) {
        expect(mustPacket.sourceRequirementText).toBe(
          expectedMustTexts[mustRefs.indexOf(mustPacket.mustRef)]
        );
        expect(mustPacket.mustAtomicTasks.length).toBeGreaterThanOrEqual(2);
        expect(
          mustPacket.mustAtomicTasks.every(
            (task: any) => task.derivedFromMustRef === mustPacket.mustRef
          )
        ).toBe(true);
        expect(mustPacket.mustExecutionDecompositionMatrix[0].mustRef).toBe(mustPacket.mustRef);
      }

      expect(
        seenAuditorInputs.every((input) => input.mustRefs.join(',') === mustRefs.join(','))
      ).toBe(true);
      expect(seenAuditorInputs.every((input) => input.mustPacketCount === 3)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a controlled confirmation_recorded event before mental model progression', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-controlled-ingest-')
    );
    try {
      const source = writeDraftSource(root);
      const recordId = 'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST';
      const requirementSetId = 'REQSET-PRE-CONFIRMATION-CONTROLLED-INGEST';
      const sourceDocumentHash = sha256Text(readFileSync(source, 'utf8'));
      const implementationConfirmationHash = sha256Json({
        recordId,
        requirementSetId,
        status: 'draft',
      });
      const recordPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requirementSetId,
        'requirement-record.json'
      );
      mkdirSync(path.dirname(recordPath), { recursive: true });
      const record = {
        recordId,
        requirementSetId,
        status: 'draft',
        flow: 'standalone_tasks',
        stage: 'implement',
        sourcePath: path.relative(root, source).replace(/\\/g, '/'),
        sourceDocumentHash,
        implementationConfirmationHash,
        preConfirmationDrilldownLane: {
          currentMentalModel: 'requirement_confirmation',
          lane: 'pre_confirmation_drilldown',
          substate: 'user_confirmable',
          nextMentalModel: null,
          controlledIngestRequiredBeforeProgression: true,
        },
        architectureConfirmationState: {
          status: 'missing',
          reasonCode: 'blocked_until_controlled_requirement_confirmation_ingest',
        },
      };
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const forgedSurface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId,
        requirementSetId,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(forgedSurface.preConfirmationDrilldownLane?.currentSubstate).toBe('user_confirmable');
      expect(forgedSurface.preConfirmationDrilldownLane?.nextMentalModel).toBeNull();
      expect(
        forgedSurface.preConfirmationDrilldownLane?.controlledIngestRequiredBeforeProgression
      ).toBe(true);

      writeFileSync(
        recordPath,
        `${JSON.stringify(
          {
            ...record,
            status: 'user_confirmed',
            confirmationHistory: [
              {
                eventType: 'confirmation_recorded',
                sourceDocumentHash,
                implementationConfirmationHash,
              },
            ],
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      const controlledSurface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId,
        requirementSetId,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(controlledSurface.preConfirmationDrilldownLane?.currentSubstate).toBe(
        'user_confirmed'
      );
      expect(controlledSurface.preConfirmationDrilldownLane?.nextMentalModel).toBe(
        'architecture_confirmation'
      );
      expect(
        controlledSurface.preConfirmationDrilldownLane?.controlledIngestRequiredBeforeProgression
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when drilldown surfaces are missing and exposes the CLI action through main-agent orchestration', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-cli-'));
    try {
      const source = writeDraftSource(root);
      const missing = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-MISSING-SURFACES',
        ...authorityForSource(root, source),
        skipDrilldownArtifacts: true,
      });
      expect(missing.substate).toBe('critical_auditor_round_required');
      expect(missing.confirmability).toBe('blocked');
      expect(missing.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(readFileSync(source, 'utf8')).not.toContain('implementationConfirmation:');

      const exitCode = mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'pre-confirmation-drilldown',
        '--source',
        source,
        '--record-id',
        'REQ-PRE-CONFIRMATION-CLI',
        '--requirement-set-id',
        'REQSET-PRE-CONFIRMATION-CLI',
        '--confirmation-language',
        'zh-CN',
        '--target-path',
        authorityForSource(root, source).targetPath,
        '--required-command',
        authorityForSource(root, source).requiredCommand,
      ]);
      expect(exitCode).toBe(1);
      expect(existsSync(artifacts(root, 'REQ-PRE-CONFIRMATION-CLI').renderReport)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['author-confirmation-ready-source', 'author_confirmation_ready_source'])(
    'exposes %s as the visible authoring lane action',
    (action) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-authoring-lane-action-'));
      try {
        const source = writeDraftSourceWithoutMust(root);
        const authority = authorityForSource(root, source);

        const captured = captureMainAgentCli([
          '--cwd',
          root,
          '--action',
          action,
          '--source',
          source,
          '--record-id',
          `REQ-AUTHORING-LANE-${action.replace(/[^A-Z0-9]/giu, '-').toUpperCase()}`,
          '--requirement-set-id',
          `REQSET-AUTHORING-LANE-${action.replace(/[^A-Z0-9]/giu, '-').toUpperCase()}`,
          '--target-path',
          authority.targetPath,
          '--required-command',
          authority.requiredCommand,
        ]);

        expect(captured.exitCode).toBe(1);
        const parsed = JSON.parse(captured.stdout);
        expect(parsed.selectedAuthoringLane).toBe('author-confirmation-ready-source');
        expect(parsed.visibleAuthoringLaneMessage).toContain(
          'author-confirmation-ready-source lane selected'
        );
        expect(parsed.blockingIssues.map((issue: any) => issue.code)).toContain(
          'controlled_must_candidates_missing'
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('promotes source before render and then blocks rendering when confirmation language is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-authoring-language-boundary-'));
    try {
      const source = writeDraftSource(root);
      const beforeSourceText = readFileSync(source, 'utf8');

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-AUTHORING-LANGUAGE-BOUNDARY',
        requirementSetId: 'REQSET-AUTHORING-LANGUAGE-BOUNDARY',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-AUTHORING-LANGUAGE-BOUNDARY');
      const confirmation = readDraftPreviewImplementationConfirmation(paths);

      expectCheckpointAutoPromoted(result, paths);
      expect(readFileSync(source, 'utf8')).not.toBe(beforeSourceText);
      expect(result.status).toBe('draft_updated_not_confirmation_ready');
      expect(result.substate).toBe('pre_render_ready');
      expect(result.confirmationLanguage).toBeNull();
      expect(confirmation.confirmationLanguage).toBe('not_selected');
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'language_required_before_render'
      );
      expect(result.currentBlockingReason).toBe('confirmation_language_not_selected');
      expect(result.nextRequiredAction).toBe('select_confirmation_language_then_render_confirmation');
      expect(result.nextUserPrompt).toContain('确认页语言');
      expect(result.changedSections ?? []).toContain('TARGET-MOD-001');
      expect(result.updatedSourceSections ?? []).toContain('TARGET-MOD-001');
      expect(existsSync(paths.semanticKernel)).toBe(true);
      expect(existsSync(paths.packet)).toBe(true);
      expect(existsSync(paths.mustGate)).toBe(true);
      expect(existsSync(paths.globalGate)).toBe(true);
      expect(existsSync(paths.html)).toBe(false);
      expect(existsSync(paths.renderReport)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['.codex', '.cursor', '.claude'])(
    'resolves skill-local scripts from a consumer %s skill install without _bmad skills',
    (surface) => {
      const root = mkdtempSync(
        path.join(os.tmpdir(), `main-agent-pre-confirmation-${surface.slice(1)}-skill-`)
      );
      try {
        const sourceSkill = path.join(
          process.cwd(),
          '_bmad',
          'skills',
          'requirements-contract-authoring'
        );
        const targetSkill = path.join(root, surface, 'skills', 'requirements-contract-authoring');
        mkdirSync(path.dirname(targetSkill), { recursive: true });
        cpSync(sourceSkill, targetSkill, { recursive: true });
        cpSync(path.join(process.cwd(), '_bmad', 'shared'), path.join(root, surface, 'shared'), {
          recursive: true,
        });
        const source = writeDraftSource(root);
        const recordId = `REQ-PRE-CONFIRMATION-${surface.slice(1).toUpperCase()}-SKILL`;

        const result = runMainAgentPreConfirmationDrilldown(root, {
          source,
          recordId,
          requirementSetId: `${recordId}-SET`,
          confirmationLanguage: 'zh-CN',
          ...authorityForSource(root, source),
          criticalAuditorRound: cleanCriticalAuditorRound,
        });

        const skillArtifacts = artifacts(root, recordId);
        expect(
          result.substate,
          JSON.stringify(
            {
              blockingIssues: result.blockingIssues,
              renderReport: existsSync(skillArtifacts.renderReport)
                ? readJson(skillArtifacts.renderReport)
                : null,
              mustGate: existsSync(skillArtifacts.mustGate)
                ? readJson(skillArtifacts.mustGate)
                : null,
              globalGate: existsSync(skillArtifacts.globalGate)
                ? readJson(skillArtifacts.globalGate)
                : null,
            },
            null,
            2
          )
        ).toBe('blocked_by_render_gate');
        expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
          'checkpoint_required_before_source_materialization'
        );
        expect(existsSync(skillArtifacts.mustGate)).toBe(true);
        expect(existsSync(skillArtifacts.globalGate)).toBe(true);
        expect(existsSync(skillArtifacts.sourceMaterializationReceipt)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
