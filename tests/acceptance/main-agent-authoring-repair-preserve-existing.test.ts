import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mainMainAgentOrchestration,
  runMainAgentAuthoringRepair,
} from '../../scripts/main-agent-orchestration';

function fixedHash(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(file, 'utf8'));
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
  const indentedBackRef = [
    `        derivedFromMustRef: MUST-001`,
    `        derivedFromPacketHash: ${packetHash}`,
    `        projectionStatus: synchronized`,
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
      '      coverageRole: validate',
      '      intent: "Validate request/response/receipt repair loop."',
      '      ownerModel: acceptance_tests',
      '      requirementRefs: ["MUST-001"]',
      '      traceRefs: ["TRACE-001"]',
      '      evidenceRefs: ["EVD-001"]',
      '      artifactRefs: ["ART-001"]',
      ...backRef.split('\n'),
      '    - id: TARGET-MOD-003',
      '      path: _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts',
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
  const dir = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
  return {
    dir,
    kernel: path.join(dir, 'semantic-kernel.json'),
    packet: path.join(dir, 'must_decomposition_packet.json'),
    request: (round: number) => path.join(dir, `critical-auditor-round-request-${round}.json`),
    response: (round: number) => path.join(dir, `critical-auditor-round-response-${round}.json`),
    receipt: (round: number) => path.join(dir, `critical-auditor-receipt-round-${round}.json`),
    gate: path.join(dir, 'pre-render-must-decomposition-gate-report.json'),
    reconciliation: path.join(dir, 'must_packet_source_reconciliation_report.json'),
    progress: path.join(dir, 'semantic-checkpoint-progress.json'),
  };
}

function rootRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function writeNoNewGapResponse(requestPath: string, responsePath: string, overrides: Record<string, unknown> = {}) {
  const request = readJson(requestPath);
  const projectionRefs = request.packetProjectionSummary?.projectionRefs ?? [];
  const checkedProjectionGroups = request.packetProjectionSummary?.projectionGroups ?? [];
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
    rejectedGapCandidates: [{ id: `REJ-${request.roundIndex}`, reason: 'no new valid gap detected' }],
    validatedGaps: [],
    rationale: `Round ${request.roundIndex} found no new valid gap.`,
    ...overrides,
  };
  writeFileSync(responsePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return responsePath;
}

describe('main-agent authoring-repair preserve-existing lane', () => {
  it('preserves a rich implementationConfirmation and blocks with a Critical Auditor request when no response exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-preserve-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
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
      const original = readFileSync(source, 'utf8');
      const paths = authoringPaths(root, recordId);

      let result = runMainAgentAuthoringRepair(root, { source, recordId, mode: 'preserve-existing' });
      expect(result.blockingStage).toBe('critical_auditor_round_required');
      expect(readJson(paths.request(1)).roundPerspective.id).toBe('round_1_must_atomicity');
      expect(readJson(paths.request(1)).gateDryRun.gateDryRunHash).toMatch(/^sha256:/);

      writeNoNewGapResponse(paths.request(1), paths.response(1));
      result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
        mode: 'preserve-existing',
        criticalAuditorResponse: paths.response(1),
      });
      expect(result.status).toBe('blocked');
      expect(result.consecutiveNoNewGapRounds).toBe(1);
      expect(existsSync(paths.receipt(1))).toBe(true);
      expect(existsSync(paths.request(2))).toBe(true);
      expect(readJson(paths.request(2)).roundPerspective.id).toBe('round_2_projection_materialization');
      expect(existsSync(paths.gate)).toBe(false);

      writeNoNewGapResponse(paths.request(2), paths.response(2));
      result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, { source, recordId, mode: 'preserve-existing' });
      writeNoNewGapResponse(paths.request(1), paths.response(1));
      writeFileSync(source, `${readFileSync(source, 'utf8')}\nStale hash mutation.\n`, 'utf8');

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
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
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_critical_auditor_round_request_1_json_sourceDocumentHash_stale'
      );
      expect(existsSync(paths.receipt(1))).toBe(false);
      expect(existsSync(paths.request(1))).toBe(true);
      expect(readJson(paths.request(1)).sourceDocumentHash).toBe(result.sourceDocumentHash);
      expect(result.artifacts.some((artifact) => artifact.includes('stale-critical-auditor-'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires gate dry-run binding fields and non-empty reviewedProjectionRefs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'authoring-repair-schema-tight-'));
    try {
      const recordId = 'REQ-AUTHORING-REPAIR-PRESERVE';
      const source = writeRichSource(root, recordId);
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, { source, recordId, mode: 'preserve-existing' });
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, { source, recordId, mode: 'preserve-existing' });
      const request = readJson(paths.request(1));
      expect(request.gateDryRun.actionableBlockingIssueCount).toBeGreaterThan(0);
      writeNoNewGapResponse(paths.request(1), paths.response(1));

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
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
      const paths = authoringPaths(root, recordId);

      runMainAgentAuthoringRepair(root, { source, recordId, mode: 'preserve-existing' });
      writeNoNewGapResponse(paths.request(1), paths.response(1), {
        reviewedProjectionRefs: ['UNKNOWN-PROJECTION-REF'],
      });

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
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
      const exitCode = mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'authoring-repair',
        '--source',
        source,
        '--record-id',
        recordId,
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
      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId,
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
