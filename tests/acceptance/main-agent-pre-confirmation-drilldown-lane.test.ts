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
} from '../../scripts/main-agent-orchestration';

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

function writeDraftSourceWithoutMust(root: string, name = 'source-without-must.md'): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Draft Requirement Without Controlled MUST',
      '',
      'The main agent should prepare a confirmation page only after atomic drilldown converges.',
      'This intentionally lacks explicit MUST: rows and has no implementationConfirmation block.',
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

function writeSourceMaterializationReceipt(
  root: string,
  source: string,
  recordId: string,
  requirementSetId: string
): string {
  const hashes = currentSourceHashes(source);
  const receiptPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'authoring',
    'source-materialization-receipt.json'
  );
  const receipt: Record<string, unknown> = {
    schemaVersion: 'source-materialization-receipt/v1',
    sourcePath: path.relative(root, source).replace(/\\/g, '/'),
    requirementSetId,
    recordId,
    sourceDocumentHashBefore: hashes.sourceDocumentHash,
    sourceDocumentHashAfter: hashes.sourceDocumentHash,
    implementationConfirmationHash: hashes.implementationConfirmationHash,
    writtenIdRanges: ['ACC-900', 'ART-900', 'CMD-900', 'EVD-900', 'TRACE-900'],
    draftStatus: 'confirmation_ready',
    nextAuditCommand:
      'pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-source-materialization-before-audit.test.ts }"',
    createdAt: '2026-06-01T00:00:00.000Z',
    createdBy: 'main-agent-source-materialization',
    receiptHash: null,
  };
  receipt.receiptHash = sha256Json({ ...receipt, receiptHash: null });
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
    artifact.contentHash ?? artifact.receiptHash ?? artifact.kernelHash ?? artifact.packetHash,
    `${file} content or receipt hash`
  ).toMatch(/^sha256:/);
  expect(artifact.createdBy, `${file} createdBy`).toBeTruthy();
  expect(artifact.createdAt, `${file} createdAt`).toBeTruthy();
  expect(Array.isArray(artifact.inputRefs), `${file} inputRefs`).toBe(true);
  expect(artifact.inputRefs.length, `${file} inputRefs length`).toBeGreaterThan(0);
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
    scaleAssessmentInitial: path.join(authoring, 'scale-assessment-initial.json'),
    scaleAssessmentPostPacket: path.join(authoring, 'scale-assessment-post-packet.json'),
    scaleAssessmentPostMaterialization: path.join(
      authoring,
      'scale-assessment-post-materialization.json'
    ),
    scaleRoutingDecision: path.join(authoring, 'scale-routing-decision.json'),
    checkpointPersistenceEvidence: path.join(authoring, 'checkpoint-persistence-evidence.json'),
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
  it('drives a draft source to user_confirmable without leaving requirement_confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-'));
    try {
      const source = writeDraftSource(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-E2E',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-E2E',
        confirmationLanguage: 'zh-CN',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-E2E', 'REQSET-PRE-CONFIRMATION-E2E');
      expect(result.currentMentalModel).toBe('requirement_confirmation');
      expect(result.lane).toBe('pre_confirmation_drilldown');
      expect(result.substate, JSON.stringify(result.blockingIssues, null, 2)).toBe(
        'user_confirmable'
      );
      expect(result.nextMentalModel).toBeNull();
      expect(result.deliveryReadiness.ready).toBe(false);
      expect(result.receiptPath).toBe(
        '_bmad-output/runtime/requirement-records/REQSET-PRE-CONFIRMATION-E2E/authoring/source-materialization-receipt.json'
      );
      expect(result.finalStandards).toMatchObject({
        newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: true,
        singlePassCannotSkipAtomicDecompositionLoop: true,
        threeConsecutiveNoNewValidGapRoundsRequired: true,
        mustDecompositionPacketSynchronizedBeforeMaterialization: true,
        sourceRowsMaterializedOnlyFromPacketProjections: true,
        packetSourceReconciliationPassesBidirectionally: true,
        preRenderGateBlocksMissingCoreSurfaces: true,
        rendererShowsFullDrilldownInteraction: true,
        confirmabilityBlocksOnMissingDrilldownSurfaces: true,
        controlledIngestRequiredBeforeMentalModelProgression: true,
      });

      for (const file of [
        paths.semanticKernel,
        paths.packet,
        paths.scaleAssessmentInitial,
        paths.scaleAssessmentPostPacket,
        paths.scaleAssessmentPostMaterialization,
        paths.scaleRoutingDecision,
        paths.checkpointPersistenceEvidence,
        paths.receipt1,
        paths.receipt2,
        paths.receipt3,
        paths.reconciliation,
        paths.progress,
        paths.mustGate,
        paths.globalGate,
        paths.html,
        paths.summary,
        paths.renderReport,
      ]) {
        expect(existsSync(file), file).toBe(true);
      }

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
        paths.summary,
        paths.renderReport,
      ]) {
        expectArtifactContract(file, 'REQ-PRE-CONFIRMATION-E2E');
      }

      const packet = readJson(paths.packet).must_decomposition_packet;
      const initialAssessment = readJson(paths.scaleAssessmentInitial);
      const postPacketAssessment = readJson(paths.scaleAssessmentPostPacket);
      const postMaterializationAssessment = readJson(paths.scaleAssessmentPostMaterialization);
      const scaleRoutingDecision = readJson(paths.scaleRoutingDecision);
      const checkpointPersistenceEvidence = readJson(paths.checkpointPersistenceEvidence);
      const mustGate = readJson(paths.mustGate);
      const globalGate = readJson(paths.globalGate);
      const reconciliation = readJson(paths.reconciliation);
      const progress = readJson(paths.progress);
      const renderReport = readJson(paths.renderReport);
      const sourceMaterializationReceipt = readJson(paths.sourceMaterializationReceipt);
      const html = readFileSync(paths.html, 'utf8');

      expect(sourceMaterializationReceipt.schemaVersion).toBe('source-materialization-receipt/v1');
      expect(sourceMaterializationReceipt.sourcePath).toBe('docs/requirements/source.md');
      expect(sourceMaterializationReceipt.requirementSetId).toBe('REQSET-PRE-CONFIRMATION-E2E');
      expect(sourceMaterializationReceipt.recordId).toBe('REQ-PRE-CONFIRMATION-E2E');
      expect(sourceMaterializationReceipt.sourceDocumentHashAfter).toBe(result.sourceDocumentHash);
      expect(sourceMaterializationReceipt.implementationConfirmationHash).toBe(
        result.implementationConfirmationHash
      );
      expect(sourceMaterializationReceipt.draftStatus).toBe('confirmation_ready');
      expect(sourceMaterializationReceipt.createdBy).toBe('main-agent-source-materialization');
      expect(sourceMaterializationReceipt.receiptHash).toBe(result.receiptHash);
      expect(packet.status).toBe('synchronized');
      expect(initialAssessment.phase).toBe('initial_assessment');
      expect(initialAssessment.provisionalDecision).toBe('provisional_single_pass_allowed');
      expect(postPacketAssessment.phase).toBe('post_packet_assessment');
      expect(postPacketAssessment.signals.conditionalDomainCount).toBe(
        postPacketAssessment.signals.applicableConditionalDomains.length
      );
      expect(postMaterializationAssessment.phase).toBe('post_materialization_assessment');
      expect(scaleRoutingDecision.decision).toBe('single_pass_final_allowed');
      expect(scaleRoutingDecision.decisionSource).toBe('checkpoint_persistence_satisfied');
      expect(scaleRoutingDecision.latestCompletedPhase).toBe('post_materialization_assessment');
      expect(scaleRoutingDecision.checkpointPersistenceSatisfied).toBe(true);
      expect(checkpointPersistenceEvidence.checkpointPersistenceSatisfiedCandidate).toBe(true);
      expect(checkpointPersistenceEvidence.checkpointPersistenceRef.routeDecisionHash).toBe(
        checkpointPersistenceEvidence.routeDecisionHash
      );
      expect(scaleRoutingDecision.checkpointPersistenceRef.routeDecisionHash).toBe(
        checkpointPersistenceEvidence.routeDecisionHash
      );
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
      expect(renderReport.confirmability).toBe('confirmable');
      expect(renderReport.deliveryReadiness.ready).toBe(false);
      expect(renderReport.renderedSections).toContain('pre-confirmation-semantic-drilldown');
      expect(html).toContain('Pre-Confirmation Semantic Drilldown');
      expect(html).toContain('Semantic Kernel Summary');
      expect(html).toContain('MUST Decomposition Packet');
      expect(html).toContain('Critical Auditor Convergence');

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId: 'REQ-PRE-CONFIRMATION-E2E',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-E2E',
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(surface.preConfirmationDrilldownLane).toMatchObject({
        currentMentalModel: 'requirement_confirmation',
        lane: 'pre_confirmation_drilldown',
        substate: 'user_confirmable',
        controlledIngestRequiredBeforeProgression: true,
      });
      expect(surface.preConfirmationDrilldownLane?.nextMentalModel).toBeNull();
      expect(surface.mainAgentNextAction).toBe('await_user');
      expect(surface.mainAgentReady).toBe(false);
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
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-MISSING-MUST');
      expect(result.substate).toBe('blocked_by_semantic_gap');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'controlled_must_candidates_missing'
      );
      expect(existsSync(paths.semanticKernel)).toBe(false);
      expect(existsSync(paths.packet)).toBe(false);
      expect(existsSync(paths.receipt1)).toBe(false);
      expect(existsSync(paths.renderReport)).toBe(false);
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

  it('fails closed instead of synthesizing clean Critical Auditor receipts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-no-auditor-'));
    try {
      const source = writeDraftSource(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-NO-AUDITOR',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-NO-AUDITOR',
        confirmationLanguage: 'zh-CN',
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-NO-AUDITOR');
      expect(result.substate).toBe('blocked_by_render_gate');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_round_provider_missing'
      );
      expect(existsSync(paths.receipt1)).toBe(false);
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
      writeSourceMaterializationReceipt(
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

      expect(result.substate, JSON.stringify(result.blockingIssues, null, 2)).toBe(
        'user_confirmable'
      );
      expect(result.confirmability).toBe('confirmable');
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
      const confirmation = readImplementationConfirmation(source);
      const kernel = readJson(paths.semanticKernel).semanticKernel;
      const packet = readJson(paths.packet).must_decomposition_packet;
      const mustGate = readJson(paths.mustGate);
      const sourceText = readFileSync(source, 'utf8');

      expect(result.substate, JSON.stringify(result.blockingIssues, null, 2)).toBe(
        'user_confirmable'
      );
      expect(result.confirmability).toBe('confirmable');
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

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-CONTROLLED-INGEST',
        confirmationLanguage: 'zh-CN',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      expect(result.substate).toBe('user_confirmable');

      const recordPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST',
        'requirement-record.json'
      );
      const record = readJson(recordPath);
      writeFileSync(
        recordPath,
        `${JSON.stringify({ ...record, status: 'user_confirmed' }, null, 2)}\n`,
        'utf8'
      );

      const forgedSurface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId: 'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-CONTROLLED-INGEST',
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
                sourceDocumentHash: record.sourceDocumentHash,
                implementationConfirmationHash: record.implementationConfirmationHash,
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
        recordId: 'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-CONTROLLED-INGEST',
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
        skipDrilldownArtifacts: true,
      });
      expect(missing.substate).toBe('blocked_by_render_gate');
      expect(missing.confirmability).toBe('blocked');
      expect(missing.blockingIssues.map((issue) => issue.code)).toContain(
        'missing_semantic_kernel'
      );

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

  it('blocks render on missing confirmation language after authoring materialization', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-authoring-language-boundary-'));
    try {
      const source = writeDraftSource(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-AUTHORING-LANGUAGE-BOUNDARY',
        requirementSetId: 'REQSET-AUTHORING-LANGUAGE-BOUNDARY',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const confirmation = readImplementationConfirmation(source);
      const paths = artifacts(root, 'REQ-AUTHORING-LANGUAGE-BOUNDARY');

      expect(result.substate).toBe('pre_render_ready');
      expect(result.confirmability).toBe('blocked');
      expect(result.status).toBe('draft_updated_not_confirmation_ready');
      expect(result.confirmationLanguage).toBeNull();
      expect(confirmation.confirmationLanguage).toBe('not_selected');
      expect(result.currentBlockingReason).toBe('confirmation_language_not_selected');
      expect(result.nextRequiredAction).toBe('select_confirmation_language_then_render_confirmation');
      expect(result.nextUserPrompt).toBe('请选择确认页语言：中文 / English / 中英双语');
      expect((result.changedSections ?? []).length).toBeGreaterThan(0);
      expect((result.updatedSourceSections ?? []).length).toBeGreaterThan(0);
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'language_required_before_render'
      );
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
        const source = writeDraftSource(root);
        const recordId = `REQ-PRE-CONFIRMATION-${surface.slice(1).toUpperCase()}-SKILL`;

        const result = runMainAgentPreConfirmationDrilldown(root, {
          source,
          recordId,
          requirementSetId: `${recordId}-SET`,
          confirmationLanguage: 'zh-CN',
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
        ).toBe('user_confirmable');
        expect(existsSync(skillArtifacts.renderReport)).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
