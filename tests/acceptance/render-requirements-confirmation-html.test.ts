import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'render-requirements-confirmation-html.ts'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-confirm-html-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeSource(overrides = ''): string {
  const file = path.join(tempDir, 'prd.md');
  const currentTargetMapBlock =
    overrides.includes('GOVERNANCE_VIEW_PACKS') || overrides.includes('CURRENT_TARGET_VIEW_PACK')
      ? `
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    introduction: "fixture-provided current target map"
    currentTitle: "Fixture current state"
    targetTitle: "Fixture target state"
    sourceReferences:
      - path: "fixture/current-target-source.md"
        description: "Fixture source for currentTargetMap"
    metrics:
      - value: "2"
        label: "fixture gates"
    currentSummary:
      - title: "Current fixture artifact"
        detail: "Scattered fixture output"
    targetSummary:
      - title: "Target fixture record"
        detail: "Governed fixture record"
    diffRows:
      - dimension: "Fixture diff"
        currentState: "current fixture"
        targetState: "target fixture"
        action: "source-provided action"
    targetFlow:
      - stepTitle: "Fixture source output"
        description: "Only appears because the fixture source provides currentTargetMap."
      - stepTitle: "Fixture governed record"
        description: "Rendered from source field."
    mentalModels:
      - name: "Fixture Model"
        question: "Is this source-provided?"
        status: "fixture-status"
    mentalModelSequence:
      lanes:
        - title: "1 Fixture lane"
          events:
            - title: "Fixture event"
              meta: "fixture_event"
              tone: "pass"
      legend:
        - text: "Fixture legend"
          tone: "green"
    doubleGates:
      gates:
        - gate: "Fixture Readiness"
          uniqueness: "fixture unique gate"
          inputs: "fixture inputs"
          outputs: "fixture outputs"
      envelopeRules:
        - title: "Fixture envelope"
          text: "fixture envelope text"
    canonicalArtifacts:
      - targetPathOrField: "fixture://record"
        functionDescription: "Fixture canonical record"
        controlPlaneRole: "fixture-control"
    pathRegistry:
      - category: "Fixture Record"
        fixedPath: "fixture://runtime/record.json"
        sourceOfTruthRole: "control"
        description: "Fixture path only"
      - category: "Fixture Sample Route"
        fixedPath: "fixture://runtime/sample-routes.jsonl"
        sourceOfTruthRole: "derived"
        description: "Fixture sample routing path"
    existingArtifacts:
      - currentPath: "fixture://legacy-report.md"
        currentFunction: "Fixture legacy report"
        targetTreatment: "source-provided evidence"
        completionProofPolicy: "否"
    scriptConvergence:
      - scriptOrConfigPath: "fixture/scripts/render.ts"
        currentFunction: "Fixture render"
        targetOwnerModel: "fixture_model"
        targetWritesOrOutputs: "fixture_event"
        completionAuthority: "evidence_only"
    hookConvergence:
      - layer: "Fixture hook"
        hostHookPaths: "fixture/hooks/source.cjs"
        sharedCore: "fixture/hooks/core.cjs"
        responsibility: "Fixture observe only"
        targetBoundary: "sensor_only"
        fallbackPolicy: "typed no-hook envelope"
    noHookTargets:
      - title: "Fixture no-hook"
        detail: "Fixture fallback is source-provided"
    retainedScriptTypes:
      - category: "Fixture retained"
        representativePaths: "fixture/scripts/*.ts"
        targetTreatment: "source-provided target"
        reason: "fixture reason"
    requirementGeneration:
      - dimension: "Fixture PRD"
        currentState: "fixture current"
        targetState: "fixture target"
    facts:
      - currentState: "fixture current fact"
        targetState: "fixture target fact"
    process:
      - phase: "Fixture phase"
        currentState: "fixture current phase"
        targetState: "fixture target phase"
    artifactPaths:
      - path: "fixture://artifact-path"
        targetRole: "fixture target role"
    architecture:
      - dimension: "Fixture layer"
        currentState: "fixture current architecture"
        targetState: "fixture target architecture"
    artifactIndexClarification: "Fixture artifact index clarification."
    sampleRoutesClarification: "Fixture sampleRoutes clarification."
`
      : '';
  const body = `# PRD: Upload Contract

implementationConfirmation:
  status: draft
  recordId: REQ-UPLOAD-001
  requirementSetId: REQSET-UPLOAD
  entryFlow: story
  entryFlowClass: full_story_entry
  workflowAdapter: bmad
  confirmationLanguage: zh-CN
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  confirmationProfile: implementation_confirmation
  requiredViewPacks: []
  optionalViewPacks: ${
    overrides.includes('GOVERNANCE_VIEW_PACKS')
      ? '["currentTargetMap", "sixMentalModels", "doubleGates"]'
      : overrides.includes('CURRENT_TARGET_VIEW_PACK')
        ? '["currentTargetMap"]'
        : '[]'
  }
  applicability:${overrides.includes('MISSING_APPLICABILITY') ? ' null' : ''}
${overrides.includes('MISSING_APPLICABILITY') ? '' : `    governanceEvents:
      applies: true
      reasonCode: "fixture_uses_governance_event_registry"
    runtimeRecovery:
      applies: true
      reasonCode: "fixture_uses_functional_resume_failure_case_registry"
      requiresFunctionalResumeFailureCaseRegistry: true
    scoringDashboardSft:
      applies: true
      reasonCode: "fixture_renders_scoring_dashboard_sft_read_model_boundaries"
    currentTargetMap:
      applies: ${overrides.includes('GOVERNANCE_VIEW_PACKS') || overrides.includes('CURRENT_TARGET_VIEW_PACK') ? 'true' : 'false'}
      reasonCode: "${overrides.includes('GOVERNANCE_VIEW_PACKS') || overrides.includes('CURRENT_TARGET_VIEW_PACK') ? 'fixture_current_target_pack_enabled' : 'fixture_current_target_pack_not_enabled'}"
    scriptsAndHooks:
      applies: true
      reasonCode: "fixture_artifact_plan_contains_scripts_and_hooks"
`}
  governanceEventTypeRegistryPolicy:
    controlFieldVocabulary: ["artifactIndex", "closeout", "confirmationHistory", "contractChecks", "executionIterations", "failureRecords", "gateChecks", "recoveryContext", "runtimePolicySnapshotRef"]
    payloadKindContracts:
      - payloadKind: decision
        requiredFields: ["eventType", "decision"]
        forbiddenFields: ["result", "status"]
        allowedControlWriteModes: ["control"]
      - payloadKind: status
        requiredFields: ["eventType", "status"]
        forbiddenFields: ["result", "decision"]
        allowedControlWriteModes: ["control"]
      - payloadKind: artifactRefs
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        allowedControlWriteModes: ["artifact_only", "context_update"]
    controlWriteModePolicies:
      - allowedControlWriteMode: control
        allowedWritesControlFields: ["confirmationHistory", "contractChecks", "gateChecks", "failureRecords", "closeout", "runtimePolicySnapshotRef", "recoveryContext", "executionIterations"]
      - allowedControlWriteMode: artifact_only
        allowedWritesControlFields: ["artifactIndex"]
      - allowedControlWriteMode: context_update
        allowedWritesControlFields: ["recoveryContext", "runtimePolicySnapshotRef"]
    eventSpecificRequirements: []
  must:
    - id: MUST-001
      text: "User uploads a valid file and sees it in the persisted file list."
      evidenceRefs: ["EVD-001"]
      upstreamRequirementIds: ["PRD-001"]
      riskLevel: high
  notDone:
    - id: NEG-001
      text: "Empty upload must not show success and must not create persistent side effects."
      evidenceRefs: ["EVD-002"]
      whyItBlocksCompletion: "Without this, a smoke-only upload can be misreported as complete."
      negativeAssertionRequired: true
  mustNot:
    - id: OUT-001
      text: "Batch upload is out of scope for this confirmation."
      scopeBoundary: "single file only"
      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: "Run positive upload acceptance with persisted state oracle."
      gate: "npm run test:e2e -- upload"
      oracle: "Independent storage query shows persisted file and UI/API list includes it."
      requiredCommandRefs: ["CMD-001"]
      artifactRefs: ["ART-EVD-001"]
      acceptanceType: acceptance_e2e
    - id: EVD-002
      text: "Run invalid upload acceptance and assert no record was created."
      gate: "npm run test:e2e -- upload-invalid"
      oracle: "Independent storage query shows no new file record."
      requiredCommandRefs: ["CMD-002"]
      artifactRefs: ["ART-EVD-002"]
      acceptanceType: adversarial_e2e
  openQuestions: []
  failurePaths:${overrides.includes('MISSING_FAILURE_PATHS') ? ' []' : ''}
${overrides.includes('MISSING_FAILURE_PATHS') ? '' : `    - id: FAIL-001
      title: "Empty upload rejected"
      trigger: "User submits an empty file."
      expectedBehavior: "Show validation error and persist nothing."
      forbiddenBehavior: "Do not show success, create a record, enqueue work, or mark requirement complete."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-002"]
      requiredAssertions:
        - "Empty file returns an actionable validation error."
        - "No file record is created."
`}
  edgeCases:${overrides.includes('MISSING_EDGE_CASES') ? ' []' : ''}
${overrides.includes('MISSING_EDGE_CASES') ? '' : `    - id: EDGE-001
      category: invalid_input
      condition: "Empty upload, missing config, duplicate execution, interrupted run, hash mismatch, orphan artifact, or pending rerun is observed."
      expectedBehavior: "Fail closed or require explicit recovery according to linked IDs."
      forbiddenBehavior: "Do not silently continue or claim completion from a read model."
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-002"]
      blocksImplementation: false
`}
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001", "OUT-001"]
      taskRefs: ["TASK-001"]
      evidenceRefs: ["EVD-001", "EVD-002"]
${overrides.includes('LEGACY_COMMAND_REFS_ONLY') ? '      commandRefs: ["CMD-001", "CMD-002"]' : '      contractValidationCommandRefs: ["CMD-001"]\n      deliveryEvidenceCommandRefs: ["CMD-002"]'}
      sequenceViewRefs: ["SEQ-001", "SEQ-002"]
      artifactRefs: ["ART-CODE-001", "ART-EVD-001", "ART-EVD-002"]
      status: PENDING
  sequenceViews:${overrides.includes('EMPTY_REQUIRED_VIEWS') ? ' []' : ''}
${overrides.includes('EMPTY_REQUIRED_VIEWS') ? '' : `
    - id: SEQ-001
      title: "Happy path upload"
      covers: ["MUST-001", "EVD-001"]
    - id: SEQ-002
      title: "Failure path empty upload and scope boundary"
      covers: ["NEG-001", "OUT-001", "EVD-002"]
`}
  flowViews:${overrides.includes('EMPTY_REQUIRED_VIEWS') ? ' []' : ''}
${overrides.includes('EMPTY_REQUIRED_VIEWS') ? '' : `
    - id: FLOW-001
      title: "Upload state and closeout flow"
      covers: ["MUST-001", "NEG-001"]
`}
  edgeCaseViews:${overrides.includes('EMPTY_REQUIRED_VIEWS') ? ' []' : ''}
${overrides.includes('EMPTY_REQUIRED_VIEWS') ? '' : `
    - id: EDGE-001
      title: "Permission/config/empty/duplicate/recovery/hash/orphan/rerun cases"
      covers: ["NEG-001"]
      cases: ["permission denied", "missing config", "empty data", "duplicate execution", "resume interruption", "hash mismatch", "orphan artifact", "pending rerun"]
`}
  boundaryViews:${overrides.includes('EMPTY_REQUIRED_VIEWS') ? ' []' : ''}
${overrides.includes('EMPTY_REQUIRED_VIEWS') ? '' : `
    - id: BOUNDARY-001
      title: "Single upload boundary"
      covers: ["OUT-001"]
`}
${currentTargetMapBlock}
  governanceEventTypeRegistry:
    - eventType: confirmation_recorded
      ownerModel: requirements_contract
      payloadKind: status
      writesControlFields: ["confirmationHistory"]
      allowedStatusValues: ["user_confirmed", "reconfirm_required"]
      payloadContract:
        requiredFields: ["eventType", "status"]
        forbiddenFields: ["result", "decision"]
        requiredSourceRefs: false
        allowedControlWriteMode: control
      canAffectControlFlow: true
    - eventType: contract_check_recorded
      ownerModel: requirements_contract
      payloadKind: decision
      writesControlFields: ["contractChecks"]
      allowedDecisionValues: ["pass", "fail", "blocked", "reconfirm_required", "not_applicable"]
      payloadContract:
        requiredFields: ["eventType", "decision"]
        forbiddenFields: ["result", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: control
      canAffectControlFlow: true
    - eventType: recovery_context_updated
      ownerModel: runtime_recovery
      payloadKind: artifactRefs
      writesControlFields: ["recoveryContext", "runtimePolicySnapshotRef"]
      payloadContract:
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: context_update
      canAffectControlFlow: true
    - eventType: gate_check_recorded
      ownerModel: runtime_governance
      payloadKind: decision
      writesControlFields: ["gateChecks"]
      allowedDecisionValues: ["pass", "fail", "blocked", "not_applicable", "skipped_by_policy"]
      payloadContract:
        requiredFields: ["eventType", "decision"]
        forbiddenFields: ["result", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: control
      canAffectControlFlow: true
    - eventType: failure_recorded
      ownerModel: rerun_governance
      payloadKind: status
      writesControlFields: ["failureRecords"]
      allowedStatusValues: ["open", "resolved", "blocked"]
      payloadContract:
        requiredFields: ["eventType", "status"]
        forbiddenFields: ["result", "decision"]
        requiredSourceRefs: true
        allowedControlWriteMode: control
      canAffectControlFlow: true
    - eventType: closeout_recorded
      ownerModel: delivery_closeout
      payloadKind: decision
      writesControlFields: ["closeout"]
      allowedDecisionValues: ["pass", "fail", "blocked"]
      payloadContract:
        requiredFields: ["eventType", "decision"]
        forbiddenFields: ["result", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: control
      canAffectControlFlow: true
    - eventType: fallback_mode_recorded
      ownerModel: hook_trust
      payloadKind: status
      writesControlFields: ["runtimePolicySnapshotRef", "recoveryContext"]
      allowedStatusValues: ["no_hooks", "bounded_replay", "blocked"]
      payloadContract:
        requiredFields: ["eventType", "status"]
        forbiddenFields: ["result", "decision"]
        requiredSourceRefs: true
        allowedControlWriteMode: control
      canAffectControlFlow: true
    - eventType: execution_iteration_recorded
      ownerModel: main_agent_orchestration
      payloadKind: status
      writesControlFields: ["executionIterations"]
      allowedStatusValues: ["started", "in_progress", "completed", "failed", "blocked"]
      payloadContract:
        requiredFields: ["eventType", "status"]
        forbiddenFields: ["result", "decision"]
        requiredSourceRefs: false
        allowedControlWriteMode: control
      canAffectControlFlow: true
    - eventType: confirmation_view_rendered
      ownerModel: requirements
      payloadKind: artifactRefs
      writesControlFields: ["artifactIndex"]
      payloadContract:
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: artifact_only
      canAffectControlFlow: false
    - eventType: confirmation_summary_rendered
      ownerModel: requirements
      payloadKind: artifactRefs
      writesControlFields: ["artifactIndex"]
      payloadContract:
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: artifact_only
      canAffectControlFlow: false
    - eventType: confirmation_render_reported
      ownerModel: requirements
      payloadKind: artifactRefs
      writesControlFields: ["artifactIndex"]
      payloadContract:
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: artifact_only
      canAffectControlFlow: false
    - eventType: implementation_delta
      ownerModel: implementation
      payloadKind: artifactRefs
      writesControlFields: ["artifactIndex"]
      payloadContract:
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: artifact_only
      canAffectControlFlow: true
    - eventType: hook_receipt
      ownerModel: runtime
      payloadKind: artifactRefs
      writesControlFields: ["artifactIndex"]
      payloadContract:
        requiredFields: ["eventType", "artifactRefs"]
        forbiddenFields: ["result", "decision", "status"]
        requiredSourceRefs: false
        allowedControlWriteMode: artifact_only
      canAffectControlFlow: false
  controlledIngestWriterRegistry:
    - writerId: requirements-confirmation-ingest
      scriptPath: "_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js"
      scriptContentHash: "sha256:fixture-confirmation-writer"
      ownerModel: requirement_confirmation
      allowedWriteApis: ["appendControlEvent", "atomicWriteRequirementRecord", "appendArtifactIndex"]
      allowedPaths:
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json"
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/events/control-events.jsonl"
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/artifact-index.jsonl"
        - "_bmad-output/runtime/requirement-records/artifact-index.jsonl"
      allowedEventTypes:
        - confirmation_recorded
        - contract_check_recorded
        - confirmation_view_rendered
        - confirmation_summary_rendered
        - confirmation_render_reported
      payloadContractRefs:
        - confirmation_recorded
        - contract_check_recorded
        - confirmation_view_rendered
        - confirmation_summary_rendered
        - confirmation_render_reported
      writesControlFields: ["confirmationHistory", "contractChecks", "artifactIndex"]
      receiptPath: "_bmad-output/runtime/requirement-records/<requirement-set-id>/receipts/requirements-confirmation-ingest/<receipt-id>.json"
      beforeAfterHashRequired: true
      canModifyWriterRegistry: false
      registryHash: "sha256:fixture-writer-registry"
      architectureConfirmationHash: "sha256:fixture-architecture"
    - writerId: implementation-evidence-ingest
      scriptPath: "scripts/ingest-implementation-evidence.ts"
      scriptContentHash: "sha256:fixture-implementation-writer"
      ownerModel: execution_closure
      allowedWriteApis: ["appendControlEvent", "atomicWriteRequirementRecord", "appendArtifactIndex"]
      allowedPaths:
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json"
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/events/control-events.jsonl"
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/artifact-index.jsonl"
        - "_bmad-output/runtime/requirement-records/artifact-index.jsonl"
      allowedEventTypes:
        - execution_iteration_recorded
        - gate_check_recorded
        - recovery_context_updated
        - fallback_mode_recorded
        - failure_recorded
        - implementation_delta
        - hook_receipt
      payloadContractRefs:
        - execution_iteration_recorded
        - gate_check_recorded
        - recovery_context_updated
        - fallback_mode_recorded
        - failure_recorded
        - implementation_delta
        - hook_receipt
      writesControlFields: ["executionIterations", "gateChecks", "recoveryContext", "runtimePolicySnapshotRef", "failureRecords", "artifactIndex"]
      receiptPath: "_bmad-output/runtime/requirement-records/<requirement-set-id>/receipts/implementation-evidence-ingest/<receipt-id>.json"
      beforeAfterHashRequired: true
      canModifyWriterRegistry: false
      registryHash: "sha256:fixture-writer-registry"
      architectureConfirmationHash: "sha256:fixture-architecture"
    - writerId: delivery-closeout-gate
      scriptPath: "scripts/main-agent-delivery-closeout-gate.ts"
      scriptContentHash: "sha256:fixture-closeout-writer"
      ownerModel: delivery_confirmation
      allowedWriteApis: ["appendControlEvent", "atomicWriteRequirementRecord", "appendArtifactIndex"]
      allowedPaths:
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json"
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/events/control-events.jsonl"
        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/artifact-index.jsonl"
        - "_bmad-output/runtime/requirement-records/artifact-index.jsonl"
      allowedEventTypes:
        - closeout_recorded
      payloadContractRefs:
        - closeout_recorded
      writesControlFields: ["closeout"]
      receiptPath: "_bmad-output/runtime/requirement-records/<requirement-set-id>/receipts/delivery-closeout-gate/<receipt-id>.json"
      beforeAfterHashRequired: true
      canModifyWriterRegistry: false
      registryHash: "sha256:fixture-writer-registry"
      architectureConfirmationHash: "sha256:fixture-architecture"
  artifactAutomationPlan:
    - artifactId: ART-CONFIRM-001
      path: "_bmad-output/runtime/requirements/REQ-UPLOAD-001/confirmation/confirmation.html"
      artifactType: confirmation_view
      sourceOfTruthRole: projection
      ownerModel: requirements
      producer: _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts
      consumer: user
      inputArtifacts: ["prd.md"]
      outputArtifacts: ["confirmation-summary.json", "confirmation-render-report.json"]
      recordEventTypes: ["confirmation_view_rendered"]
      canAffectControlFlow: false
      userApprovalRequired: false
      retention: short_lived
      cleanupPolicy: keep_until_reconfirmed
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      group: confirmation
      currentFunction: "render confirmation HTML"
      fallback: "blocked when renderer fails"
      linkedRequirements: ["MUST-001", "NEG-001", "OUT-001", "EVD-001", "EVD-002"]
    - artifactId: ART-CODE-001
      path: "src/upload.ts"
      artifactType: code
      sourceOfTruthRole: implementation
      ownerModel: implementation
      producer: dev agent
      consumer: tests
      inputArtifacts: ["prd.md"]
      outputArtifacts: ["upload behavior"]
      recordEventTypes: ["implementation_delta"]
      canAffectControlFlow: true
      userApprovalRequired: true
      retention: long_lived
      cleanupPolicy: source_controlled
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      group: executionEvidence
      currentFunction: "future implementation target"
      fallback: "do not implement before confirmation"
      linkedRequirements: ["MUST-001", "NEG-001"]
    - artifactId: ART-HOOK-001
      path: "_bmad/hooks/upload-confirmation-hook.js"
      artifactType: hook
      sourceOfTruthRole: evidence
      ownerModel: runtime
      producer: hook wrapper
      consumer: artifact index
      inputArtifacts: ["confirmation-render-report.json"]
      outputArtifacts: ["hook receipt"]
      recordEventTypes: ["hook_receipt"]
      canAffectControlFlow: false
      userApprovalRequired: false
      retention: short_lived
      cleanupPolicy: keep_receipt_only
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      group: hooks
      currentFunction: "observe only"
      fallback: "typed no-hook envelope"
      linkedRequirements: ["EVD-001"]
  requiredCommands:
    - id: CMD-001
      command: "npm run test:e2e -- upload"
    - id: CMD-002
      command: "npm run test:e2e -- upload-invalid"
  suggestedCommands:
    - id: CMD-SUG-001
      command: "npm run lint"
  architectureImpacts:
    - component: "upload module"
      currentState: "no confirmed contract"
      targetState: "confirmed contract with evidence"
      impactType: behavior
      risk: medium
      requiredDecision: "confirm upload scope"
      linkedRequirements: ["MUST-001", "NEG-001"]
      linkedEvidence: ["EVD-001", "EVD-002"]
      ownerModel: implementation
  scoringDashboardSft:
    scoreRequired: true
    scoringPolicyHash: "sha256:policy"
    scoreMaterializationGate: "score_materialization"
    scoreEvaluationGate: "score_evaluation"
    dashboardReadonly: true
    sftEligible: false
    evalHoldoutRedactionContaminationRequired: true
    noReverseCloseoutReason: "read models cannot close requirements"
${overrides.replace('EMPTY_REQUIRED_VIEWS', '')}

\`\`\`yaml
functionalResumeFailureCaseRegistry:
  status: frozen_in_P0
  p0ExecutableSubsetRequired: true
  p0RequiredFixtureCases:
    - resume_happy_path
    - sourceDocumentHash_changed
  groupingAuthority: source_document
  rendererGroupingPolicy: explicit_groups_only
  recoveryActionDefinitions:
    - actionId: require_user_reconfirmation
      label: "要求用户重新确认"
      ownerModel: requirements_contract
      automationLevel: user_required
      writesControlFields: ["confirmationHistory", "contractChecks"]
      recordEventTypes: ["confirmation_recorded", "contract_check_recorded"]
      outputArtifacts: ["confirmation.html", "confirmation-render-report.json"]
      createsNewCloseoutAttempt: false
      requiresUserConfirmation: true
    - actionId: rebuild_trace_checkpoint
      label: "重建 traceRows checkpoint"
      ownerModel: runtime_recovery
      automationLevel: agent_assisted
      writesControlFields: ["recoveryContext", "gateChecks"]
      recordEventTypes: ["recovery_context_updated", "gate_check_recorded"]
      outputArtifacts: ["trace-checkpoint.json"]
      createsNewCloseoutAttempt: false
      requiresUserConfirmation: false
    - actionId: block_closeout_until_resolved
      label: "阻断 closeout 直到解决"
      ownerModel: delivery_closeout
      automationLevel: automatic_block
      writesControlFields: ["gateChecks", "failureRecords", "closeout"]
      recordEventTypes: ["gate_check_recorded", "failure_recorded", "closeout_recorded"]
      outputArtifacts: ["closeout-blocker-report.json"]
      createsNewCloseoutAttempt: false
      requiresUserConfirmation: false
    - actionId: switch_to_no_hook_replay
      label: "切换到 no-hook replay"
      ownerModel: hook_trust
      automationLevel: agent_assisted
      writesControlFields: ["runtimePolicySnapshotRef", "gateChecks", "executionIterations"]
      recordEventTypes: ["fallback_mode_recorded", "gate_check_recorded", "execution_iteration_recorded"]
      outputArtifacts: ["no-hook-replay-report.json"]
      createsNewCloseoutAttempt: false
      requiresUserConfirmation: false
    - actionId: rerun_required_commands
      label: "重跑必要证据命令"
      ownerModel: delivery_closeout
      automationLevel: agent_assisted
      writesControlFields: ["executionIterations", "gateChecks"]
      recordEventTypes: ["execution_iteration_recorded", "gate_check_recorded"]
      outputArtifacts: ["command-run-ref.json"]
      createsNewCloseoutAttempt: false
      requiresUserConfirmation: false
  groups:
    - groupId: hash_and_trace_checkpoint
      label: "Hash / trace checkpoint 一致性"
      caseRefs:
        - sourceDocumentHash_changed
        - trace_checkpoint_missing
      ownerModel: runtime_recovery
      blockingBehavior: fail_closed_before_resume
      requiredEvidenceRefs: ["EVD-022"]
      requiredTraceRefs: ["TRACE-001"]
    - groupId: codex_hook_trust
      label: "Codex hook trust / no-hook fallback"
      caseRefs:
        - codexHookTrustReceipt_missing_or_invalid
      ownerModel: hook_trust
      blockingBehavior: fail_closed_or_degrade_to_no_hook_replay
      requiredEvidenceRefs: ["EVD-033"]
      requiredTraceRefs: ["TRACE-001"]
  failureCases:
    - id: sourceDocumentHash_changed
      groupId: hash_and_trace_checkpoint
      coveragePhase: P0 deterministic fixture
      p0Required: true
      triggerSignal: "sourceDocumentHash differs from confirmed source hash"
      detectionPoint: "traceRows checkpoint validation"
      failClosedGate: Functional Resume Gate
      failureRecordType: unsafe_resume_blocked
      expectedRecoveryActions:
        - require_user_reconfirmation
        - rebuild_trace_checkpoint
    - id: trace_checkpoint_missing
      groupId: hash_and_trace_checkpoint
      coveragePhase: Phase 4.5 coverage
      p0Required: false
      triggerSignal: "no stable traceRows checkpoint exists for resume"
      detectionPoint: "resume context load"
      failClosedGate: Functional Resume Gate
      failureRecordType: unsafe_resume_blocked
      expectedRecoveryActions:
        - rebuild_trace_checkpoint
        - block_closeout_until_resolved
    - id: codexHookTrustReceipt_missing_or_invalid
      groupId: codex_hook_trust
      coveragePhase: Phase 4.5 coverage
      p0Required: false
      triggerSignal: "Codex hook trust receipt missing or invalid"
      detectionPoint: "hook trust receipt validation"
      failClosedGate: Codex Hook Trust Probe Gate
      failureRecordType: hook_trust_receipt_invalid
      expectedRecoveryActions:
        - switch_to_no_hook_replay
        - rerun_required_commands
  phase4_5Coverage:
    - trace_checkpoint_missing
    - codexHookTrustReceipt_missing_or_invalid
\`\`\`

\`\`\`mermaid
sequenceDiagram
  actor User
  participant UI
  participant Store
  User->>UI: Upload valid file [MUST-001][EVD-001]
  UI->>Store: Persist file record [MUST-001][EVD-001]
  Store-->>UI: Return persisted state [MUST-001][EVD-001]
  UI-->>User: Show file in list [MUST-001][EVD-001]
  User->>UI: Upload empty file [NEG-001][EVD-002]
  UI-->>User: Show validation error [NEG-001][EVD-002]
  UI->>Store: No write occurs [NEG-001][EVD-002]
\`\`\`

\`\`\`mermaid
stateDiagram-v2
  [*] --> draft: source contract exists [MUST-001]
  draft --> confirmed: chat hash confirmation [MUST-001][EVD-001]
  draft --> blocked: empty upload success attempted [NEG-001]
  confirmed --> implementation_readiness: traceRows and evidence commands bound [MUST-001][EVD-001]
  confirmed --> boundary_blocked: batch upload requested [OUT-001]
\`\`\`
`;
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function runRenderer(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function writeMockMermaidBundle(): string {
  const file = path.join(tempDir, 'mock-mermaid.min.js');
  fs.writeFileSync(
    file,
    `window.mermaid={initialize:function(){},render:async function(id,source){return {svg:'<svg data-mock-mermaid="true" viewBox="0 0 640 320"><text x="0" y="24">'+String(source).slice(0,32).replace(/[<>&]/g,'')+'</text></svg>'};}};`,
    'utf8'
  );
  return file;
}

function writeEsmMermaidBundle(): string {
  const file = path.join(tempDir, 'mermaid.esm.min.mjs');
  fs.writeFileSync(
    file,
    `import chunk from './chunks/mermaid.esm.min/chunk.mjs';\nexport default { initialize(){}, render(){ return chunk; } };\n`,
    'utf8'
  );
  return file;
}

describe('render-requirements-confirmation-html', () => {
  it('renders current controlled execution state only when hashes and current attempt match', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const recordPath = path.join(tempDir, 'requirement-record.json');
    const firstOut = path.join(tempDir, 'confirmation-first.html');
    const firstResult = runRenderer([
      '--source',
      source,
      '--out',
      firstOut,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--architecture-confirmation-hash',
      'sha256:current-architecture',
      '--requirement-record',
      recordPath,
      '--json',
    ]);
    expect(firstResult.status).toBe(0);
    const firstReport = JSON.parse(
      fs.readFileSync(path.join(path.dirname(firstOut), 'confirmation-render-report.json'), 'utf8')
    );

    fs.writeFileSync(
      recordPath,
      JSON.stringify(
        {
          recordId: 'REQ-UPLOAD-001',
          requirementSetId: 'REQSET-UPLOAD',
          sourceDocumentHash: firstReport.sourceDocumentHash,
          implementationConfirmationHash: firstReport.implementationConfirmationHash,
          architectureConfirmationHash: 'sha256:current-architecture',
          closeout: {
            currentAttemptId: 'attempt-current-001',
            attempts: [{ closeoutAttemptId: 'attempt-current-001', decision: 'pass' }],
          },
          requirementClosures: [
            {
              eventType: 'requirement_closure_recorded',
              requirementId: 'MUST-001',
              status: 'pass',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001', 'EVD-002'],
              sourceDocumentHash: firstReport.sourceDocumentHash,
              implementationConfirmationHash: firstReport.implementationConfirmationHash,
              architectureConfirmationHash: 'sha256:current-architecture',
              commandRunRefs: [
                {
                  commandId: 'CMD-001',
                  runId: 'run-current-001',
                  closeoutAttemptId: 'attempt-current-001',
                  exitCode: 0,
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const out = path.join(tempDir, 'confirmation-current.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--architecture-confirmation-hash',
      'sha256:current-architecture',
      '--requirement-record',
      recordPath,
      '--json',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(html).toContain('Controlled Execution Status');
    expect(html).toContain('Current Validity');
    expect(html).toContain('confirmed contract projection');
    expect(html).toContain('controlled execution projection');
    expect(html).toContain('current_pass');
    expect(html).toContain('attempt-current-001');
    expect(report.traceExecutionState.rows['TRACE-001']).toMatchObject({
      status: 'current_pass',
      validity: 'current',
      currentAttemptId: 'attempt-current-001',
    });
  });

  it('does not require architecture hash or OUT evidence for non-architecture delivery readiness', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const recordPath = path.join(tempDir, 'requirement-record-no-architecture.json');
    const firstOut = path.join(tempDir, 'confirmation-no-architecture-first.html');
    const firstResult = runRenderer([
      '--source',
      source,
      '--out',
      firstOut,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--requirement-record',
      recordPath,
      '--json',
    ]);
    expect(firstResult.status).toBe(0);
    const firstReport = JSON.parse(
      fs.readFileSync(path.join(path.dirname(firstOut), 'confirmation-render-report.json'), 'utf8')
    );

    fs.writeFileSync(
      recordPath,
      JSON.stringify(
        {
          recordId: 'REQ-UPLOAD-001',
          requirementSetId: 'REQSET-UPLOAD',
          sourceDocumentHash: firstReport.sourceDocumentHash,
          implementationConfirmationHash: firstReport.implementationConfirmationHash,
          closeout: {
            currentAttemptId: 'attempt-current-no-architecture',
            attempts: [{ closeoutAttemptId: 'attempt-current-no-architecture', decision: 'pass' }],
          },
          requirementClosures: [
            {
              eventType: 'requirement_closure_recorded',
              requirementId: 'MUST-001',
              status: 'pass',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001', 'EVD-002'],
              sourceDocumentHash: firstReport.sourceDocumentHash,
              implementationConfirmationHash: firstReport.implementationConfirmationHash,
              commandRunRefs: [
                {
                  commandId: 'CMD-001',
                  runId: 'run-current-no-architecture',
                  closeoutAttemptId: 'attempt-current-no-architecture',
                  exitCode: 0,
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const out = path.join(tempDir, 'confirmation-no-architecture.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--requirement-record',
      recordPath,
      '--json',
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.traceExecutionState.rows['TRACE-001']).toMatchObject({
      status: 'current_pass',
      validity: 'current',
      currentAttemptId: 'attempt-current-no-architecture',
    });
    expect(report.progressDelta.idStatuses['OUT-001']).toMatchObject({
      proofState: 'scope_boundary_confirmed',
    });
    expect(report.deliveryReadiness.ready).toBe(true);
    expect(report.deliveryReadiness.currentPassTraceRows).toBe(1);
  });

  it('preserves id-badge mini as trusted HTML inside requirement boundary tables', () => {
    const source = writeSource();
    const out = path.join(tempDir, 'confirmation-id-badge-mini.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--mode',
      'confirmation',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('<span class="id-badge mini">OUT-001</span>');
    expect(html).toContain('<span class="id-badge mini">BOUNDARY-001</span>');
    expect(html).not.toContain('&lt;span class="id-badge mini"&gt;OUT-001&lt;/span&gt;');
    expect(html).not.toContain('&lt;span class="id-badge mini"&gt;BOUNDARY-001&lt;/span&gt;');
  });

  it('renders historical PASS as stale when hashes or current attempt do not match', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const recordPath = path.join(tempDir, 'requirement-record-stale.json');
    const out = path.join(tempDir, 'confirmation-stale.html');
    fs.writeFileSync(
      recordPath,
      JSON.stringify(
        {
          recordId: 'REQ-UPLOAD-001',
          requirementSetId: 'REQSET-UPLOAD',
          sourceDocumentHash: 'sha256:old-source',
          implementationConfirmationHash: 'sha256:old-implementation',
          architectureConfirmationHash: 'sha256:old-architecture',
          closeout: {
            currentAttemptId: 'attempt-current-002',
            attempts: [{ closeoutAttemptId: 'attempt-current-002', decision: 'blocked' }],
          },
          requirementClosures: [
            {
              eventType: 'requirement_closure_recorded',
              requirementId: 'MUST-001',
              status: 'pass',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001', 'EVD-002'],
              sourceDocumentHash: 'sha256:old-source',
              implementationConfirmationHash: 'sha256:old-implementation',
              architectureConfirmationHash: 'sha256:old-architecture',
              commandRunRefs: [
                {
                  commandId: 'CMD-001',
                  runId: 'run-old-001',
                  closeoutAttemptId: 'attempt-old-001',
                  exitCode: 0,
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--architecture-confirmation-hash',
      'sha256:current-architecture',
      '--requirement-record',
      recordPath,
      '--json',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(html).toContain('historical_stale_hash_mismatch');
    expect(html).toContain('stale');
    expect(report.traceExecutionState.rows['TRACE-001'].status).not.toBe('current_pass');
    expect(report.traceExecutionState.rows['TRACE-001']).toMatchObject({
      status: 'historical_stale_hash_mismatch',
      validity: 'stale',
      currentAttemptId: 'attempt-current-002',
    });
  });

  it('allows hash drift when a managed reconfirmation request is ready for user confirmation', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const drifted = original
      .replace('status: draft', 'status: reconfirm_required')
      .replace(
        'sourceDocumentHash: null',
        `sourceDocumentHash: sha256:old-source
  implementationConfirmationHash: sha256:old-confirmation
  reconfirmationRequest:
    required: true
    reason: sourceDocumentHash_changed
    previousSourceDocumentHash: sha256:old-source
    currentSourceDocumentHash: sha256:pending-render
    previousImplementationConfirmationHash: sha256:old-confirmation
    currentImplementationConfirmationHash: sha256:pending-render
    diffSummary:
      - id: DIFF-001
        summary: "MUST-001 evidence command was clarified."
    impactedIds: ["MUST-001", "EVD-001", "TRACE-001"]
    impactedTraceRows: ["TRACE-001"]
    affectedRequirementIds: ["MUST-001", "EVD-001"]
    affectedTraceRows: ["TRACE-001"]
    impactedArtifacts: ["ART-CONFIRM-001"]
    impactedGatesOrCommands: ["CMD-CONTRACT-001"]
    allowedUserActions:
      - confirm_current_version
      - reject_current_changes_restore_last_confirmed
      - accept_partial_changes_create_followup
      - regenerate_confirmation_view
`
      );
    fs.writeFileSync(source, drifted, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, '_bmad-output/runtime/requirements/REQ-UPLOAD-001/confirmation/reconfirm.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(
      fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8')
    );
    expect(html).toContain('重新确认请求');
    expect(html).toContain('id="progress-delta"');
    expect(html).toContain('class="review-flow"');
    expect(html).toContain('class="review-step"');
    expect(html).toContain('历史进度与本次差异');
    expect(html).toContain('本次确认变化');
    expect(html).toContain('重点验收焦点');
    expect(html).toContain('新增 / 变更');
    expect(html).toContain('userStatus');
    expect(html).toContain('检测到确认边界漂移');
    expect(html).toContain('sourceDocumentHash_changed');
    expect(html).toContain('confirm_current_version');
    expect(html).toContain('reject_current_changes_restore_last_confirmed');
    expect(html).toContain('accept_partial_changes_create_followup');
    expect(html).toContain('regenerate_confirmation_view');
    expect(html).toContain('用户只需要确认业务意图');
    expect(html).not.toContain('手工修改 hash、status 或 confirmationHistory。</p><p');
    const progressDeltaSection = html.slice(
      html.indexOf('id="progress-delta"'),
      html.indexOf('id="trace-matrix"')
    );
    expect(progressDeltaSection).toContain('class="review-flow"');
    expect(progressDeltaSection.match(/class="review-step"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(progressDeltaSection).not.toContain('class="split"');
    expect(report.confirmability).toBe('confirmable');
    expect(report.blockingIssues.map((issue: { code: string }) => issue.code)).not.toEqual(
      expect.arrayContaining([
        'sourceDocumentHash_changed',
        'implementationConfirmationHash_changed',
      ])
    );
    expect(report.reconfirmationRequest).toMatchObject({
      required: true,
      reason: 'sourceDocumentHash_changed',
      previousSourceDocumentHash: 'sha256:old-source',
      previousImplementationConfirmationHash: 'sha256:old-confirmation',
      allowedUserActions: expect.arrayContaining([
        'confirm_current_version',
        'reject_current_changes_restore_last_confirmed',
        'accept_partial_changes_create_followup',
        'regenerate_confirmation_view',
      ]),
    });
    expect(report.reconfirmationRequest.currentSourceDocumentHash).toMatch(/^sha256:/);
    expect(report.reconfirmationRequest.currentImplementationConfirmationHash).toMatch(/^sha256:/);
    expect(report.progressDelta).toMatchObject({
      affectedTraceRows: expect.arrayContaining(['TRACE-001']),
      newIds: expect.arrayContaining(['MUST-001', 'EVD-001']),
      reviewFocusIds: expect.arrayContaining(['TRACE-001', 'MUST-001', 'EVD-001']),
      counts: {
        newOrChangedIds: 2,
        totalTraceRows: 1,
      },
    });
  });

  it('renders the full instance confirmation HTML, summary, render report, hashes, and required views', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, '_bmad-output/runtime/requirements/REQ-UPLOAD-001/confirmation/confirmation.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--requirement-set-id',
      'REQSET-UPLOAD',
      '--entry-flow',
      'story',
      '--entry-flow-class',
      'full_story_entry',
      '--workflow-adapter',
      'bmad',
      '--theme',
      'audit',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(fs.readFileSync(source, 'utf8')).toBe(original);
    expect(fs.existsSync(out)).toBe(true);

    const summaryPath = path.join(path.dirname(out), 'confirmation-summary.json');
    const reportPath = path.join(path.dirname(out), 'confirmation-render-report.json');
    expect(fs.existsSync(summaryPath)).toBe(true);
    expect(fs.existsSync(reportPath)).toBe(true);

    const html = fs.readFileSync(out, 'utf8');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    expect(html).toContain('顶部确认指纹');
    expect(html).toContain('用户决策摘要');
    expect(html).toContain('确认口令区');
    expect(html).toContain('Must Do');
    expect(html).toContain('Not Done / Cannot Count As Complete');
    expect(html).toContain('Must Not Do / Out Of Scope');
    expect(html).toContain('业务需求可视化区');
    expect(html).toContain('治理 / 控制可视化区');
    expect(html).toContain('恢复失败路径矩阵');
    expect(html).toContain('可展开恢复失败路径分组图');
    expect(html).toContain('sourceDocumentHash_changed');
    expect(html).toContain('trace_checkpoint_missing');
    expect(html).toContain('codexHookTrustReceipt_missing_or_invalid');
    expect(html).toContain('Hash / trace checkpoint 一致性');
    expect(html).toContain('Codex hook trust / no-hook fallback');
    expect(html).toContain('expectedRecoveryActions');
    expect(html).toContain('recordEventTypes');
    expect(html).toContain('gate_check_recorded');
    expect(html).toContain('require_user_reconfirmation');
    expect(html).toContain('switch_to_no_hook_replay');
    expect(html).toContain('恢复动作权威注册表');
    expect(html).toContain('recoveryContext, gateChecks');
    expect(html).toContain('DERIVED-RESUME-FAILURE-001');
    expect(html).toContain('Trace Matrix');
    expect(html).toContain('Contract Validation Commands');
    expect(html).toContain('Delivery Evidence Commands');
    expect(html).toContain('现状 vs 目标态对比区');
    expect(html).toContain('工件与自动化计划视图');
    expect(html).toContain('Controlled Ingest Writer Registry');
    expect(html).toContain('controlledIngestWriterRegistry[]');
    expect(html).toContain('requirements-confirmation-ingest');
    expect(html).toContain('implementation-evidence-ingest');
    expect(html).toContain('delivery-closeout-gate');
    expect(html).toContain('架构影响视图');
    expect(html).toContain('EntryFlow 视图');
    expect(html).toContain('评分 / Dashboard / SFT 视图');
    expect(html).toContain('Closeout 准出预览');
    expect(html).toContain('8 个用户关键问题');
    expect(html).toContain('HTML 不能点击确认');
    expect(html).toContain('data-copy-target="confirm-text"');
    expect(html).toContain('data-sortable="true"');
    expect(html).toContain('只看控制层产物');
    expect(html).toContain('只看本次新增文件');
    expect(html).toContain('data-filter="new"');
    expect(html).toContain('data-new-artifact="true"');
    expect(html).toContain('data-new-artifact="false"');
    expect(html).toContain('data-control-artifact="true"');
    expect(html).toContain('function applyArtifactFilter(filter)');
    expect(html).toContain("document.querySelectorAll('.nav-filters button[data-filter]')");
    expect(html).toContain('data-filter-status');
    expect(html).toContain('data-artifact-group-section');
    expect(html).toContain('body[data-filter="new"] .artifact-plan-table tbody tr{display:none}');
    expect(html).toContain('body[data-filter="new"] .artifact-plan-table tbody tr:has([data-new-artifact="true"])');
    expect(html).toContain('data-nav-toggle');
    expect(html).toContain('data-nav-collapsed="false"');
    expect(html).toContain('收起侧栏');
    expect(html).toContain('grid-template-columns:280px minmax(0,1fr)');
    expect(html).toContain('--shadow:none');
    expect(html).toContain('main{padding:44px min(6vw,88px) 86px;min-width:0;max-width:100%;background:linear-gradient');
    expect(html).toContain('counter-reset:doc-section');
    expect(html).toContain('.card{background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;padding:36px 0 42px;box-shadow:none;margin:0;min-width:0;max-width:100%}');
    expect(html).toContain('.card>h2::before{counter-increment:doc-section;content:counter(doc-section,decimal-leading-zero)');
    expect(html).toContain('.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0;margin:22px 0;min-width:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}');
    expect(html).toContain('.table-wrap{overflow-x:auto;overflow-y:auto;border:1px solid var(--line);border-radius:0;min-width:0;max-width:100%;scrollbar-gutter:stable;background:#fff}');
    expect(html).toContain('.table-wrap table{width:max-content;min-width:100%;border-collapse:collapse;background:#fff;table-layout:auto}');
    expect(html).toContain('.table-wrap th,.table-wrap td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;min-width:140px;max-width:560px;overflow-wrap:break-word}');
    expect(html).toContain('.compact-map-table{min-width:1100px}');
    expect(html).toContain('核心设计摘要');
    expect(html).toContain('历史进度与本次差异');
    expect(html).toContain('建议继续起点');
    expect(html).toContain('userStatus');
    const progressDeltaSection = html.slice(
      html.indexOf('id="progress-delta"'),
      html.indexOf('id="trace-matrix"')
    );
    expect(progressDeltaSection).toContain('class="review-flow"');
    expect(progressDeltaSection.match(/class="review-step"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(progressDeltaSection).not.toContain('class="split"');
    expect(html).not.toContain('<section class="card current-target-map" id="current-target">');
    expect(html).not.toContain('current-target-split');
    expect(html).not.toContain('六个心智模型');
    expect(html).not.toContain('双唯一门禁与 typed envelope');
    expect(html).toContain('diagram-viewer');
    expect(html.match(/data-diagram-viewer/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('data-diagram-viewer');
    expect(html).toContain('data-diagram-mode="single"');
    expect(html).toContain('data-mermaid-runtime="embedded"');
    expect(html).toContain('data-diagram-prev');
    expect(html).toContain('data-diagram-next');
    expect(html).toContain('data-diagram-toggle');
    expect(html).toContain('上一张');
    expect(html).toContain('下一张');
    expect(html).toContain('展开全部');
    expect(html).toContain('diagram-grid');
    expect(html).toContain('mermaid-native-render');
    expect(html).toContain('data-mermaid-source');
    expect(html).toContain('data-mermaid-render');
    expect(html).toContain('data-mermaid-error');
    expect(html).toContain('Mermaid runtime embedded: sha256:');
    expect(html).toContain('preserveAspectRatio');
    expect(html).toContain('diagramMarginY: 20');
    expect(html).toContain("messageAlign: 'left'");
    expect(html).toContain('messageMargin: 34');
    expect(html).toContain('actorMargin: 42');
    expect(html).toContain('width: 126');
    expect(html).toContain('height: 38');
    expect(html).toContain('actorFontSize: 12');
    expect(html).toContain('messageFontSize: 12');
    expect(html).toContain('naturalWidth');
    expect(html).toContain("svg.setAttribute('width'");
    expect(html).toContain('svg.style.width = naturalWidth');
    expect(html).toContain('min-height:300px');
    expect(html).toContain('max-height:520px');
    expect(html).toContain('scrollbar-gutter:stable both-edges');
    expect(html).toContain('fallback-diagram');
    expect(html).toContain('Fallback 结构图（非确认图）');
    expect(html).toContain('Mermaid 源码和 diagramHash');
    expect(html).toContain('Happy Path 时序图');
    expect(html).toContain('Failure / Negative Path 时序图');
    expect(html).toContain('DERIVED-HAPPY-001');
    expect(html).toContain('DERIVED-FAILURE-NEG-001');
    expect(html).toContain('DERIVED-FAILURE-OUT-001');
    expect(html).toContain('DERIVED-FAILURE-EDGE-001');
    expect(html).toContain('DERIVED-FLOW-001');
    expect(html).toContain('DERIVED-EDGE-001');
    expect(html).not.toContain('<pre class="mermaid">');
    expect(html).not.toContain('<svg class="rendered-mermaid');
    expect(summary).toMatchObject({
      recordId: 'REQ-UPLOAD-001',
      language: 'zh-CN',
      counts: {
        must: 1,
        notDone: 1,
        mustNot: 1,
        evidence: 2,
        traceRows: 1,
        sequenceViews: 2,
        resumeFailureCases: 3,
        artifactPlanItems: 3,
      },
    });
    expect(summary.sourceDocumentHash).toMatch(/^sha256:/);
    expect(summary.implementationConfirmationHash).toMatch(/^sha256:/);
    expect(summary.confirmationPageHash).toMatch(/^sha256:/);
    expect(summary.blockingIssues).toEqual([]);
    expect(summary.mermaidRuntime.available).toBe(true);
    expect(summary.mermaidRuntime.hash).toMatch(/^sha256:/);
    expect(summary.progressDelta.counts.totalTraceRows).toBe(1);

    expect(report.confirmability).toBe('confirmable');
    expect(report.renderedSections).toContain('progress-delta');
    expect(report.mermaidRuntime.available).toBe(true);
    expect(report.mermaidRuntime.path).toBe(mermaidBundle.replace(/\\/g, '/'));
    expect(report.confirmationPageHashScope).toBe(
      'html_normalized_with_self_hash_placeholder_and_generated_at_excluded'
    );
    expect(report.actualHtmlFileHash).toMatch(/^sha256:/);
    expect(report.reconfirmationRequest.required).toBe(false);
    expect(report.confirmInstruction).toContain('确认以上范围进入下一阶段');
    expect(report.confirmInstruction).toContain('sourceDocumentHash=sha256:');
    expect(report.confirmInstruction).toContain('implementationConfirmationHash=sha256:');
    expect(report.confirmInstruction).toContain('confirmationPageHash=sha256:');
    expect(report.artifactRef).toMatchObject({
      artifactType: 'confirmation_view',
      sourceOfTruthRole: 'projection',
      path: out.replace(/\\/g, '/'),
      hashScope: 'html_normalized_with_self_hash_placeholder',
    });
    expect(report.artifactRef.actualFileHash).toMatch(/^sha256:/);
    expect(report.diagramCoverage['MUST-001'].sequenceViews).toContain('SEQ-001');
    expect(report.diagramCoverage['NEG-001'].sequenceViews).toContain('SEQ-002');
    expect(report.diagramCoverage['OUT-001'].boundaryViews).toContain('BOUNDARY-001');
    expect(report.traceCoverage['MUST-001']).toContain('TRACE-001');
    expect(report.artifactAutomationCoverage['MUST-001']).toContain('ART-CONFIRM-001');
    expect(report.confirmationProfile).toBe('implementation_confirmation');
    expect(report.requiredViewPacks).toEqual(
      expect.arrayContaining(['coreDesign', 'decisionSummary', 'businessVisuals', 'traceMatrix'])
    );
    expect(report.optionalViewPacks).toEqual([]);
    expect(report.renderedSections).not.toContain('current-target');
    expect(report.currentTargetCoverage.artifactPaths).toBe(0);
    expect(report.currentTargetCoverage.pathRegistry).toBe(0);
    expect(report.currentTargetSchemaVersion).toBe('');
    expect(report.currentTargetDisplayProfile).toBe('');
    expect(report.resumeFailureCaseCoverage).toMatchObject({
      status: 'frozen_in_P0',
      caseCount: 3,
      groupCount: 2,
      schemaIssueCount: 0,
      fullLinkExecutableSubsetRequired: true,
    });
    expect(report.resumeFailureCaseCoverage.schemaIssues).toEqual([]);
    expect(report.governanceEventTypeRegistry.gate_check_recorded).toMatchObject({
      ownerModel: 'runtime_governance',
      writesControlFields: ['gateChecks'],
      payloadContract: {
        requiredFields: ['eventType', 'decision'],
        forbiddenFields: ['result', 'status'],
        allowedControlWriteMode: 'control',
      },
    });
    expect(report.controlledIngestWriterRegistry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          writerId: 'requirements-confirmation-ingest',
          allowedEventTypes: expect.arrayContaining(['confirmation_recorded', 'contract_check_recorded']),
          writesControlFields: expect.arrayContaining(['confirmationHistory', 'contractChecks']),
          beforeAfterHashRequired: true,
          canModifyWriterRegistry: false,
        }),
      ])
    );
    expect(report.controlledIngestWriterCoverage.eventTypeToWriters.confirmation_recorded).toContain(
      'requirements-confirmation-ingest'
    );
    expect(report.controlledIngestWriterCoverage.uncoveredEventTypes).toEqual([]);
    expect(report.controlledIngestWriterSchemaIssues).toEqual([]);
    expect(report.resumeFailureCaseCoverage.governanceEventTypeRefs.gate_check_recorded).toMatchObject({
      ownerModel: 'runtime_governance',
      writesControlFields: ['gateChecks'],
    });
    expect(report.resumeFailureCaseCoverage.groupDefinitions.hash_and_trace_checkpoint).toMatchObject({
      label: 'Hash / trace checkpoint 一致性',
      ownerModel: 'runtime_recovery',
    });
    expect(report.resumeFailureCaseCoverage.recoveryActionDefinitions.require_user_reconfirmation).toMatchObject({
      ownerModel: 'requirements_contract',
      automationLevel: 'user_required',
      requiresUserConfirmation: true,
      recordEventTypes: ['confirmation_recorded', 'contract_check_recorded'],
    });
    expect(report.resumeFailureCaseCoverage.fullLinkRequiredFixtureCases).toContain(
      'sourceDocumentHash_changed'
    );
    expect(report.resumeFailureCaseCoverage.phase4_5Coverage).toEqual(
      expect.arrayContaining(['trace_checkpoint_missing', 'codexHookTrustReceipt_missing_or_invalid'])
    );
    expect(report.resumeFailureCaseCoverage.groups.hash_and_trace_checkpoint).toEqual(
      expect.arrayContaining(['sourceDocumentHash_changed', 'trace_checkpoint_missing'])
    );
    expect(report.resumeFailureCaseCoverage.groups.codex_hook_trust).toEqual([
      'codexHookTrustReceipt_missing_or_invalid',
    ]);
    expect(report.resumeFailureCaseCoverage.cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: 'sourceDocumentHash_changed',
          expectedRecoveryActions: ['require_user_reconfirmation', 'rebuild_trace_checkpoint'],
        }),
        expect.objectContaining({
          caseId: 'codexHookTrustReceipt_missing_or_invalid',
          expectedRecoveryActions: ['switch_to_no_hook_replay', 'rerun_required_commands'],
        }),
      ])
    );
  });

  it('fails closed when resume failure cases rely on renderer-inferred grouping', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const invalidRegistry = `\`\`\`yaml
functionalResumeFailureCaseRegistry:
  status: frozen_in_P0
  p0ExecutableSubsetRequired: true
  p0RequiredFixtureCases:
    - resume_happy_path
    - sourceDocumentHash_changed
  failureCases:
    - sourceDocumentHash_changed
    - codexHookTrustReceipt_missing_or_invalid
\`\`\``;
    const mutated = original.replace(
      /```yaml\nfunctionalResumeFailureCaseRegistry:[\s\S]*?```\n\n```mermaid/u,
      `${invalidRegistry}\n\n\`\`\`mermaid`
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-resume-invalid.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    const codes = report.blockingIssues.map((issue: any) => issue.code);
    expect(codes).toContain('resume_failure_groups_missing');
    expect(codes).toContain('resume_failure_case_missing_group_ref');
    expect(report.resumeFailureCaseCoverage.schemaIssueCount).toBeGreaterThan(0);
  });

  it('fails closed when a resume failure case has no expected recovery actions', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      /\n      expectedRecoveryActions:\n        - require_user_reconfirmation\n        - rebuild_trace_checkpoint/u,
      ''
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-resume-missing-actions.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain(
      'resume_failure_case_missing_recovery_actions'
    );
  });

  it('fails closed when an expected recovery action has no registry definition', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace('        - rebuild_trace_checkpoint', '        - undefined_recovery_action');
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-resume-unknown-action.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain(
      'resume_failure_case_unknown_recovery_action'
    );
  });

  it('fails closed when a recovery action writes control fields without record event types', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      /\n      recordEventTypes: \["confirmation_recorded", "contract_check_recorded"\]/u,
      ''
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-resume-missing-record-events.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain(
      'resume_failure_recovery_action_missing_record_event_types'
    );
  });

  it('fails closed when a recovery action references an unknown record event type', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      'recordEventTypes: ["confirmation_recorded", "contract_check_recorded"]',
      'recordEventTypes: ["confirmation_recorded", "unknown_event_type"]'
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-resume-unknown-record-event.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    const codes = report.blockingIssues.map((issue: any) => issue.code);
    expect(codes).toContain('resume_failure_recovery_action_unknown_event_type');
    expect(codes).toContain('resume_failure_recovery_action_uncovered_control_field');
  });

  it('fails closed when artifact automation references an event type outside the global registry', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      'recordEventTypes: ["confirmation_view_rendered"]',
      'recordEventTypes: ["unregistered_artifact_event"]'
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-artifact-unknown-record-event.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('artifact_plan_unknown_record_event_type');
  });

  it('fails closed when a governance event type is missing payloadContract', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      /\n      payloadContract:\n        requiredFields: \["eventType", "decision"\]\n        forbiddenFields: \["result", "status"\]\n        requiredSourceRefs: false\n        allowedControlWriteMode: control/u,
      ''
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-payload-contract.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('governance_event_type_missing_payload_contract');
  });

  it('fails closed when payloadContract conflicts with payloadKind', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      'requiredFields: ["eventType", "artifactRefs"]',
      'requiredFields: ["eventType", "decision"]'
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-conflicting-payload-contract.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    const codes = report.blockingIssues.map((issue: any) => issue.code);
    expect(codes).toContain('governance_event_type_payload_contract_missing_required_field');
    expect(codes).toContain('governance_event_type_payload_contract_forbids_payload_field');
  });

  it('fails closed when controlledIngestWriterRegistry is missing while governance events apply', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(/\n  controlledIngestWriterRegistry:\n[\s\S]*?(?=\n  artifactAutomationPlan:\n)/u, '\n');
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-controlled-ingest-writers.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('controlled_ingest_writer_registry_missing');
  });

  it('fails closed when a controlled ingest writer declares a broad allowedPath', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      '"_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json"',
      '"_bmad-output/runtime/requirement-records/**"'
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-broad-writer-path.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('controlled_ingest_writer_allowed_path_too_broad');
  });

  it('fails closed when a controlled ingest writer references an unknown event type', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      '        - closeout_recorded\n      payloadContractRefs:',
      '        - closeout_recorded\n        - unknown_event_recorded\n      payloadContractRefs:'
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-unknown-writer-event.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('controlled_ingest_writer_unknown_event_type');
  });

  it('fails closed when a writer declares control fields not covered by allowed event types', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      'writesControlFields: ["closeout"]\n      receiptPath: "_bmad-output/runtime/requirement-records/<requirement-set-id>/receipts/delivery-closeout-gate/<receipt-id>.json"',
      'writesControlFields: ["closeout", "confirmationHistory"]\n      receiptPath: "_bmad-output/runtime/requirement-records/<requirement-set-id>/receipts/delivery-closeout-gate/<receipt-id>.json"'
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-writer-uncovered-control-field.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain(
      'controlled_ingest_writer_control_field_not_covered'
    );
  });

  it('fails closed when a writer can modify the writer registry', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace('canModifyWriterRegistry: false', 'canModifyWriterRegistry: true');
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-writer-self-authorizing.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain(
      'controlled_ingest_writer_can_modify_registry_not_false'
    );
  });

  it('uses the selected language for page labels and confirmation phrase', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-en.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'en-US',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(html).toContain('Instance Requirements Confirmation');
    expect(html).toContain('Core Design Summary');
    expect(html).toContain('Progress And Delta');
    expect(html).toContain('Current Confirmation Changes');
    expect(html).toContain('Review Focus');
    expect(html).toContain('Suggested Continue Start');
    expect(html).toContain('No Controlled Record');
    expect(html).not.toContain('历史进度与本次差异');
    expect(html).not.toContain('本次确认变化');
    expect(html).toContain('Business Mermaid Diagram');
    expect(html).toContain('Governance Mermaid Diagram');
    expect(html).toContain('Mermaid source and diagramHash');
    expect(html).toContain('Confirm the above scope and enter the next stage');
    expect(report.confirmInstruction).toContain('Confirm the above scope and enter the next stage');
  });

  it('derives real Mermaid diagrams from structured views when the source has no fenced Mermaid blocks', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(source, original.replace(/```mermaid[\s\S]*?```\n\n```mermaid[\s\S]*?```\n?/u, ''), 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'derived-confirmation.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).not.toContain('No Mermaid blocks found.');
    expect(html).toContain('DERIVED-HAPPY-001');
    expect(html).toContain('DERIVED-FAILURE-NEG-001');
    expect(html).toContain('DERIVED-FAILURE-OUT-001');
    expect(html).toContain('DERIVED-FAILURE-EDGE-001');
    expect(html).toContain('DERIVED-FLOW-001');
    expect(html).toContain('DERIVED-EDGE-001');
    expect(html).toContain('sequenceDiagram');
    expect(html).toContain('stateDiagram-v2');
    expect(html).toContain('flowchart TD');
  });

  it('normalizes native Mermaid render source without changing displayed source hashes', () => {
    const source = writeSource('MERMAID_SAFE_RENDER_SOURCE');
    fs.appendFileSync(
      source,
      `

\`\`\`mermaid
flowchart TD
  A[Start ingest [MUST-001][EVD-001]] --> B{Launch gate [NEG-001]}
  B --> C(Write manifest/stats/evidence [TRACE-001])
\`\`\`
`,
      'utf8'
    );
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'safe-render-source.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('data-mermaid-normalized="true"');
    expect(html).toContain('A[&quot;Start ingest MUST-001 EVD-001&quot;]');
    expect(html).toContain('B{&quot;Launch gate NEG-001&quot;}');
    expect(html).toContain('C(&quot;Write manifest/stats/evidence TRACE-001&quot;)');
    expect(html).toContain('A[Start ingest [MUST-001][EVD-001]]');
  });

  it('fails strict mode when required views and bindings are missing, but still writes blocked artifacts', () => {
    const source = writeSource('EMPTY_REQUIRED_VIEWS');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    expect(fs.existsSync(out)).toBe(true);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.confirmability).toBe('blocked');
    expect(report.blockingIssues.map((issue: any) => issue.code)).toEqual(
      expect.arrayContaining([
        'must_missing_happy_or_flow_view',
        'neg_missing_failure_or_edge_view',
        'out_missing_boundary_view',
        'missing_sequence_views',
        'missing_flow_views',
        'missing_edge_case_views',
        'missing_boundary_views',
      ])
    );
  });

  it('fails closed when core failurePaths are missing', () => {
    const source = writeSource('MISSING_FAILURE_PATHS');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-failure-paths.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('missing_failurePaths');
  });

  it('fails closed when core edgeCases are missing', () => {
    const source = writeSource('MISSING_EDGE_CASES');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-edge-cases.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('missing_edgeCases');
  });

  it('fails closed when applicability domains are missing', () => {
    const source = writeSource('MISSING_APPLICABILITY');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-applicability.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('missing_applicability');
  });

  it('fails closed when applies=false lacks reasonCode', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(
      /\n    currentTargetMap:\n      applies: false\n      reasonCode: "fixture_current_target_pack_not_enabled"/u,
      '\n    currentTargetMap:\n      applies: false'
    );
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-applicability-reason.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('applicability_domain_missing_reason_code');
  });

  it('fails closed when runtimeRecovery applies but functional resume registry is missing', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(/```yaml\nfunctionalResumeFailureCaseRegistry:[\s\S]*?```\n\n```mermaid/u, '```mermaid');
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-runtime-registry.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain(
      'functional_resume_failure_case_registry_missing'
    );
  });

  it('fails closed when traceRows only use legacy commandRefs', () => {
    const source = writeSource('LEGACY_COMMAND_REFS_ONLY');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-legacy-command-refs.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    const codes = report.blockingIssues.map((issue: any) => issue.code);
    expect(codes).toContain('trace_missing_contract_validation_command');
    expect(codes).toContain('trace_legacy_command_refs_only');
  });

  it('supports external artifact plan input without mutating the source', () => {
    const source = writeSource();
    const original = fs.readFileSync(source, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const artifactPlan = path.join(tempDir, 'artifact-plan.json');
    fs.writeFileSync(
      artifactPlan,
      JSON.stringify({
        artifactAutomationPlan: [
          {
            artifactId: 'ART-SCRIPT-001',
            path: '_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts',
            artifactType: 'script',
            sourceOfTruthRole: 'projection',
            ownerModel: 'requirements',
            producer: 'renderer',
            consumer: 'user',
            inputArtifacts: ['prd.md'],
            outputArtifacts: ['confirmation.html'],
            recordEventTypes: ['confirmation_view_rendered'],
            canAffectControlFlow: false,
            userApprovalRequired: false,
            retention: 'long_lived',
            cleanupPolicy: 'source_controlled',
            orphanRisk: 'low',
            containsSensitiveData: false,
            trainingDataEligible: false,
            group: 'scripts',
            currentFunction: 'render instance confirmation page',
            fallback: 'blocked if unavailable',
            linkedRequirements: ['MUST-001'],
          },
        ],
      }),
      'utf8'
    );
    const out = path.join(tempDir, 'confirmation.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'bilingual',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--artifact-plan',
      artifactPlan,
    ]);

    expect(result.status).toBe(0);
    expect(fs.readFileSync(source, 'utf8')).toBe(original);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts');
    expect(html).not.toContain('<section class="card current-target-map" id="current-target">');
    const summary = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-summary.json'), 'utf8'));
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(summary.counts.artifactPlanItems).toBe(4);
    expect(report.currentTargetSchemaVersion).toBe('');
    expect(report.currentTargetDisplayProfile).toBe('');
    expect(report.currentTargetCoverage.pathRegistry).toBe(0);
    expect(report.currentTargetSchemaIssues).toEqual([]);
  });

  it('keeps current-target content out of the default instance when the source does not enable its pack', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-no-current-target.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(html).not.toContain('<section class="card current-target-map" id="current-target">');
    expect(html).not.toContain('六个心智模型');
    expect(html).not.toContain('双唯一门禁与 typed envelope');
    expect(report.currentTargetCoverage.pathRegistry).toBe(0);
    expect(report.currentTargetCoverage.artifactPaths).toBe(0);
    expect(report.currentTargetSchemaIssues).toEqual([]);
  });

  it('renders current-target comparison when the source enables the current-target view pack', () => {
    const source = writeSource('CURRENT_TARGET_VIEW_PACK');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-current-target.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(html).toContain('现状 vs 目标态对比区');
    expect(html).toContain('<section class="card current-target-map" id="current-target">');
    expect(html).not.toContain('六个心智模型');
    expect(html).not.toContain('双唯一门禁与 typed envelope');
    expect(html).toContain('fixture://runtime/sample-routes.jsonl');
    expect(report.renderedSections).toContain('current-target');
    expect(report.currentTargetCoverage.pathRegistry).toBeGreaterThan(0);
    expect(report.currentTargetSchemaVersion).toBe('current-target-map/v1');
    expect(report.currentTargetDisplayProfile).toBe('closed_loop_current_target_map');
  });

  it('renders governance-only sections when governance packs are explicitly enabled', () => {
    const source = writeSource('GOVERNANCE_VIEW_PACKS');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-governance.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(html).toContain('<section class="card current-target-map" id="current-target">');
    expect(html).toContain('六个心智模型');
    expect(html).toContain('六个心智模型时序图');
    expect(html).toContain('双唯一门禁与 typed envelope');
    expect(html).toContain('fixture unique gate');
    expect(report.renderedSections).toContain('current-target');
    expect(report.currentTargetCoverage.doubleGates).toBeGreaterThan(0);
    expect(report.currentTargetCoverage.mentalModels).toBeGreaterThan(0);
  });

  it('fails closed when governance view packs are enabled but the required content is missing', () => {
    const source = writeSource('GOVERNANCE_VIEW_PACKS');
    const original = fs.readFileSync(source, 'utf8');
    const mutated = original.replace(/\n  currentTargetMap:\n[\s\S]*?(?=\n  governanceEventTypeRegistry:\n)/u, '\n');
    fs.writeFileSync(source, mutated, 'utf8');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-current-target-invalid.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    const codes = report.blockingIssues.map((issue: any) => issue.code);
    expect(codes).toContain('required_view_pack_missing_data');
    expect(report.currentTargetSchemaIssues).toEqual([]);
  });

  it('rejects invalid CLI values and does not create confirmation output', () => {
    const source = writeSource();
    const out = path.join(tempDir, 'confirmation.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--language',
      'fr-FR',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(2);
    expect(fs.existsSync(out)).toBe(false);
    expect(result.stderr).toContain('invalid_language');
  });

  it('uses the skill-bundled Mermaid runtime by default without requiring consumer project dependencies', () => {
    const source = writeSource();
    const out = path.join(tempDir, 'confirmation.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(0);
    const summary = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-summary.json'), 'utf8'));
    const html = fs.readFileSync(out, 'utf8');
    expect(summary.blockingIssues).toEqual([]);
    expect(summary.mermaidRuntime.available).toBe(true);
    expect(summary.mermaidRuntime.format).toBe('classic-global');
    expect(summary.mermaidRuntime.path).toContain(
      '_bmad/skills/requirements-contract-authoring/assets/mermaid/mermaid.min.js'
    );
    expect(html).toContain('data-mermaid-runtime="embedded"');
    expect(html).toContain('Mermaid runtime embedded: sha256:');
  });

  it('blocks strict confirmation when an explicitly configured Mermaid runtime path is missing', () => {
    const source = writeSource();
    const out = path.join(tempDir, 'confirmation-missing-explicit-mermaid.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      path.join(tempDir, 'missing-mermaid.min.js'),
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('invalid_mermaid_bundle_path');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('can explicitly open fallback structure diagrams when Mermaid runtime is invalid, but they remain non-confirmation-grade', () => {
    const source = writeSource();
    const mermaidBundle = writeEsmMermaidBundle();
    const out = path.join(tempDir, 'confirmation-fallback-invalid-mermaid.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--allow-mermaid-fallback',
    ]);

    expect(result.status).toBe(3);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.confirmability).toBe('blocked');
    expect(report.mermaidRuntime.available).toBe(false);
    expect(report.mermaidRuntime.issues.map((issue: any) => issue.code)).toContain('invalid_mermaid_runtime_bundle');
    expect(html).toContain('data-mermaid-runtime="missing"');
    expect(html).toContain('Fallback 结构图（非确认图）');
    expect(html).not.toContain('Mermaid runtime embedded: sha256:');
  });

  it('fails closed when Mermaid bundle is ESM and cannot initialize window.mermaid as an embedded classic script', () => {
    const source = writeSource();
    const mermaidBundle = writeEsmMermaidBundle();
    const out = path.join(tempDir, 'confirmation-esm-mermaid.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    const html = fs.readFileSync(out, 'utf8');
    expect(report.confirmability).toBe('blocked');
    expect(report.mermaidRuntime.available).toBe(false);
    expect(report.mermaidRuntime.format).toBe('invalid');
    expect(report.mermaidRuntime.issues.map((issue: any) => issue.code)).toContain('invalid_mermaid_runtime_bundle');
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('invalid_mermaid_runtime_bundle');
    expect(html).toContain('data-mermaid-runtime="missing"');
    expect(html).not.toContain('data-mermaid-runtime="embedded"');
    expect(html).not.toContain('Mermaid runtime embedded: sha256:');
    expect(html).not.toContain("import chunk from './chunks/mermaid.esm.min/chunk.mjs'");
  });

  it('can explicitly open fallback structure diagrams alongside the skill-bundled native Mermaid runtime', () => {
    const source = writeSource();
    const out = path.join(tempDir, 'confirmation.html');
    const result = runRenderer([
      '--source',
      source,
      '--out',
      out,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--allow-mermaid-fallback',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.confirmability).toBe('confirmable');
    expect(report.mermaidRuntime.available).toBe(true);
    expect(html).toContain('<details class="fallback-diagram" open>');
    expect(html).toContain('Fallback 结构图（非确认图）');
  });

  it('can be invoked through the documented node CLI and prints machine-readable summary with --json', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation.html');
    const stdout = execFileSync(process.execPath, [
      SCRIPT,
      '--source',
      source,
      '--out',
      out,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
      '--mode',
      'confirmation',
      '--json',
    ], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    const summary = JSON.parse(stdout);
    expect(summary.recordId).toBe('REQ-UPLOAD-001');
    expect(summary.confirmationPageHash).toMatch(/^sha256:/);
    expect(fs.existsSync(out)).toBe(true);
  });
});
