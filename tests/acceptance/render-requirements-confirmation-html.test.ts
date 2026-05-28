import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
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
const requireForRenderer = createRequire(import.meta.url);
const {
  extractImplementationConfirmation,
  sourceDocumentHashFor,
  implementationConfirmationHashFor,
} = requireForRenderer(path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'pre_render_definition_drilldown_lib.js'
));

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-confirm-html-'));
});

afterEach(() => {
  if (process.env.KEEP_REQ_CONFIRM_HTML_TEMP === '1') return;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeSource(overrides = ''): string {
  const includeChineseConfirmationText = !overrides.includes('ENGLISH_ONLY_CONFIRMATION_TEXT');
  const includeCloseoutReviewPolicy = overrides.includes('CLOSEOUT_REVIEW_POLICY_FIXTURE');
  const acceptanceTestPath = path.join(tempDir, 'tests', 'acceptance', 'upload.acceptance.test.ts');
  const e2eTestPath = path.join(tempDir, 'tests', 'e2e', 'upload-invalid.e2e.test.ts');
  fs.mkdirSync(path.dirname(acceptanceTestPath), { recursive: true });
  fs.mkdirSync(path.dirname(e2eTestPath), { recursive: true });
  fs.writeFileSync(acceptanceTestPath, 'import { it } from "vitest"; it("positive upload acceptance oracle", () => {});\n', 'utf8');
  fs.writeFileSync(e2eTestPath, 'import { it } from "vitest"; it("invalid upload e2e oracle", () => {});\n', 'utf8');
  const currentTargetViewPackEnabled = !overrides.includes('CURRENT_TARGET_APPLIES_WITHOUT_VIEW_PACK');
  const currentTargetApplies = true;
  const file = path.join(tempDir, 'prd.md');
  const currentTargetMapBlock =
    currentTargetApplies
      ? `
  currentTargetMap:
    schemaVersion: current-target-map/v1
    ${overrides.includes('CURRENT_TARGET_APPLIES_MISSING_DISPLAY_PROFILE') ? '' : 'displayProfile: closed_loop_current_target_map'}
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
      - id: DIFF-001
        dimension: "Fixture diff"
        currentState: "current fixture"
        targetState: "target fixture"
        action: "source-provided action"
      - id: DIFF-002
        dimension: "Fixture diff two"
        currentState: "current fixture two"
        targetState: "target fixture two"
        action: "source-provided action two"
      - id: DIFF-003
        dimension: "Fixture diff three"
        currentState: "current fixture three"
        targetState: "target fixture three"
        action: "source-provided action three"
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
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    pathRegistry:
      - category: "Fixture Record"
        fixedPath: "fixture://runtime/record.json"
        sourceOfTruthRole: "control"
        description: "Fixture path only"
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
      - category: "Fixture Sample Route"
        fixedPath: "fixture://runtime/sample-routes.jsonl"
        sourceOfTruthRole: "derived"
        description: "Fixture sample routing path"
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    existingArtifacts:
      - currentPath: "fixture://legacy-report.md"
        currentFunction: "Fixture legacy report"
        targetTreatment: "source-provided evidence"
        completionProofPolicy: "legacy_only"
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-002"]
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
      - id: PROCESS-001
        phase: "Fixture phase"
        currentState: "fixture current phase"
        targetState: "fixture target phase"
    artifactPaths:
      - path: "fixture://artifact-path"
        targetRole: "fixture target role"
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
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
  requiredViewPacks: ${
    currentTargetViewPackEnabled
      ? '["currentTargetMap"]'
      : '[]'
  }
  optionalViewPacks: ${
    overrides.includes('GOVERNANCE_VIEW_PACKS')
      ? '["sixMentalModels", "doubleGates"]'
      : overrides.includes('CURRENT_TARGET_APPLIES_WITHOUT_VIEW_PACK') || overrides.includes('CURRENT_TARGET_APPLIES_MISSING_DISPLAY_PROFILE')
        ? '[]'
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
      applies: true
      reasonCode: "requirements_contract_authoring_always_requires_current_target_map"
    scriptsAndHooks:
      applies: true
      reasonCode: "fixture_artifact_plan_contains_scripts_and_hooks"
    aiTddContractGate:
      applies: true
      reasonCode: "requirements_contract_authoring_always_requires_ai_tdd_gate"
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
${includeChineseConfirmationText ? '      textZh: "用户上传有效文件后，可以在持久化文件列表中看到该文件。"\n' : ''}      evidenceRefs: ["EVD-001"]
      upstreamRequirementIds: ["PRD-001"]
      riskLevel: high
  notDone:
    - id: NEG-001
      text: "Empty upload must not show success and must not create persistent side effects."
${includeChineseConfirmationText ? '      textZh: "空文件上传不得显示成功，也不得产生持久化副作用。"\n' : ''}      evidenceRefs: ["EVD-002"]
      whyItBlocksCompletion: "Without this, a smoke-only upload can be misreported as complete."
${includeChineseConfirmationText ? '      whyItBlocksCompletionZh: "如果缺少该约束，只有 smoke 级别的上传可能被误报为完成。"\n' : ''}      negativeAssertionRequired: true
  mustNot:
    - id: OUT-001
      text: "Batch upload is out of scope for this confirmation."
${includeChineseConfirmationText ? '      textZh: "批量上传不在本次确认范围内。"\n' : ''}      scopeBoundary: "single file only"
${includeChineseConfirmationText ? '      scopeBoundaryZh: "仅限单文件。"\n' : ''}      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: "Run positive upload acceptance with persisted state oracle."
${includeChineseConfirmationText ? '      textZh: "运行正向上传验收，并使用持久化状态作为判定 oracle。"\n' : ''}      gate: "npm run test:e2e -- upload"
      oracle: "Independent storage query shows persisted file and UI/API list includes it."
${includeChineseConfirmationText ? '      oracleZh: "独立存储查询能看到持久化文件，且 UI/API 列表包含该文件。"\n' : ''}      requiredCommandRefs: ["CMD-001"]
      artifactRefs: ["ART-EVD-001"]
      acceptanceType: acceptance_e2e
    - id: EVD-002
      text: "Run invalid upload acceptance and assert no record was created."
${includeChineseConfirmationText ? '      textZh: "运行无效上传验收，并断言没有创建任何记录。"\n' : ''}      gate: "npm run test:e2e -- upload-invalid"
      oracle: "Independent storage query shows no new file record."
${includeChineseConfirmationText ? '      oracleZh: "独立存储查询显示没有新增文件记录。"\n' : ''}      requiredCommandRefs: ["CMD-002"]
      artifactRefs: ["ART-EVD-002"]
      acceptanceType: adversarial_e2e
${includeCloseoutReviewPolicy ? `    - id: EVD-010
      text: "Unbound source projection gap fixture that must not be treated as runtime closeout missing evidence."
      textZh: "未绑定的源投影诊断证据，只能作为 source_projection_gap 展示，不能当作 closeout runtime 证据缺失。"
      gate: "diagnostic only"
      oracle: "Renderer labels this as source_projection_gap because no traceRows[].evidenceRefs row binds it."
      oracleZh: "渲染器应将该项标记为 source_projection_gap，因为没有 traceRows[].evidenceRefs 绑定它。"
      requiredCommandRefs: ["CMD-SUGGESTED-FULL-AI-TDD-CLOSEOUT"]
      artifactRefs: ["ART-EVD-010"]
      acceptanceType: diagnostic_projection
` : ''}
  openQuestions: []
  failurePaths:${overrides.includes('MISSING_FAILURE_PATHS') ? ' []' : ''}
${overrides.includes('MISSING_FAILURE_PATHS') ? '' : `    - id: FAIL-001
      title: "Empty upload rejected"
${includeChineseConfirmationText ? '      titleZh: "空文件上传被拒绝"\n' : ''}      trigger: "User submits an empty file."
${includeChineseConfirmationText ? '      triggerZh: "用户提交空文件。"\n' : ''}      expectedBehavior: "Show validation error and persist nothing."
${includeChineseConfirmationText ? '      expectedBehaviorZh: "显示校验错误，并且不持久化任何内容。"\n' : ''}      forbiddenBehavior: "Do not show success, create a record, enqueue work, or mark requirement complete."
${includeChineseConfirmationText ? '      forbiddenBehaviorZh: "不得显示成功、创建记录、入队任务或标记需求完成。"\n' : ''}      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-002"]
      viewRefs: ["SEQ-002"]
      requiredAssertions:
        - "Empty file returns an actionable validation error."
        - "No file record is created."
`}
  edgeCases:${overrides.includes('MISSING_EDGE_CASES') ? ' []' : ''}
${overrides.includes('MISSING_EDGE_CASES') ? '' : `    - id: EDGE-001
      category: invalid_input
      condition: "Empty upload, missing config, duplicate execution, interrupted run, hash mismatch, orphan artifact, or pending rerun is observed."
${includeChineseConfirmationText ? '      conditionZh: "出现空文件上传、配置缺失、重复执行、运行中断、hash 不匹配、孤儿工件或待重跑状态。"\n' : ''}      expectedBehavior: "Fail closed or require explicit recovery according to linked IDs."
${includeChineseConfirmationText ? '      expectedBehaviorZh: "按照关联 ID fail closed，或要求显式恢复决策。"\n' : ''}      forbiddenBehavior: "Do not silently continue or claim completion from a read model."
${includeChineseConfirmationText ? '      forbiddenBehaviorZh: "不得静默继续，也不得用只读模型声称完成。"\n' : ''}      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-002"]
      viewRefs: ["EDGEVIEW-001"]
      blocksImplementation: false
`}
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: ["TASK-001"]
      evidenceRefs: ["EVD-001", "EVD-002"]
${overrides.includes('LEGACY_COMMAND_REFS_ONLY') ? '      commandRefs: ["CMD-001", "CMD-002"]' : '      contractValidationCommandRefs: ["CMD-001"]\n      deliveryEvidenceCommandRefs: ["CMD-002"]'}
      acceptanceRefs: ["ACC-001", "E2E-001"]
      sequenceViewRefs: ["SEQ-001", "SEQ-002"]
      boundaryViewRefs: ["BOUNDARY-001"]
      artifactRefs: ["ART-CODE-001", "ART-EVD-001", "ART-EVD-002"]
      status: PENDING
  acceptanceTests:
    - id: ACC-001
      file: "${acceptanceTestPath.replace(/\\/gu, '/')}"
      covers: ["MUST-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
${overrides.includes('MISSING_AI_TDD_MANIFEST_PROJECTION') ? '' : '      failurePathRefs: ["FAIL-001"]\n      edgeCaseRefs: ["EDGE-001"]'}
      commandRefs: ["CMD-001"]
      positiveControl: true
      expectedPreImplementationState: expected_red
      oracle: "Independent storage query shows persisted file and UI/API list includes it."
  e2eSuites:
    - id: E2E-001
      file: "${e2eTestPath.replace(/\\/gu, '/')}"
      covers: ["NEG-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-002"]
${overrides.includes('MISSING_AI_TDD_MANIFEST_PROJECTION') ? '' : '      failurePathRefs: ["FAIL-001"]\n      edgeCaseRefs: ["EDGE-001"]'}
      commandRefs: ["CMD-002"]
      negativeControls: ["NEG-001"]
      expectedPreImplementationState: expected_red
      oracle: "Independent storage query shows no new file record."
  targetModificationPaths:${overrides.includes('MISSING_TARGET_MODIFICATION_PATHS') ? ' []' : ''}
${overrides.includes('MISSING_TARGET_MODIFICATION_PATHS') ? '' : `    - id: TARGET-MOD-001
      path: "src/upload.ts"
      coverageRole: modify
      intent: "Implement confirmed upload behavior."
      ownerModel: implementation
      requirementRefs: ["MUST-001", "NEG-001"]
      traceRefs: ["TRACE-001"]
      evidenceRefs: ["EVD-001", "EVD-002"]
      artifactRefs: ["ART-CODE-001"]
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-002
      path: "${acceptanceTestPath.replace(/\\/gu, '/')}"
      changeType: validation_only
      intent: "Run positive upload acceptance oracle without treating the test file as implementation scope."
      ownerModel: acceptance_tests
      requirementRefs: ["MUST-001"]
      traceRefs: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      artifactRefs: []
      requiresReconfirmationOnChange: false
    - id: TARGET-MOD-003
      path: "${e2eTestPath.replace(/\\/gu, '/')}"
      changeType: validation_only
      intent: "Run negative upload E2E oracle without treating the test file as implementation scope."
      ownerModel: e2e_tests
      requirementRefs: ["NEG-001"]
      traceRefs: ["TRACE-001"]
      evidenceRefs: ["EVD-002"]
      artifactRefs: []
      requiresReconfirmationOnChange: false
    - id: TARGET-MOD-004
      path: "fixture/scripts/render.ts"
      changeType: validation_only
      intent: "Classify currentTargetMap script convergence path as a validation-only target."
      ownerModel: current_target_map
      requirementRefs: ["MUST-001"]
      traceRefs: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      artifactRefs: []
      requiresReconfirmationOnChange: false
${includeCloseoutReviewPolicy ? `    - id: TARGET-MOD-005
      path: "scripts/main-agent-delivery-closeout-gate.ts"
      changeType: validation_only
      intent: "Fixture target for suggested closeout command policy projection."
      ownerModel: delivery_confirmation
      requirementRefs: ["MUST-001"]
      traceRefs: ["TRACE-001"]
      evidenceRefs: ["EVD-010"]
      artifactRefs: []
      requiresReconfirmationOnChange: false
` : ''}
`}
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
      cases: ["EDGE-001"]
    - id: EDGEVIEW-001
      title: "Explicit AI-TDD edge-case coverage"
      covers: ["NEG-001"]
      cases: ["permission denied", "missing config", "empty data", "duplicate execution", "resume interruption", "hash mismatch", "orphan artifact", "pending rerun"]
`}
  boundaryViews:${overrides.includes('EMPTY_REQUIRED_VIEWS') ? ' []' : ''}
${overrides.includes('EMPTY_REQUIRED_VIEWS') ? '' : `
    - id: BOUNDARY-001
      title: "Single upload boundary"
      covers: ["OUT-001"]
`}
${currentTargetMapBlock || `  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    introduction: "Default fixture current/target map required by requirements-contract-authoring."
    currentSummary:
      - title: "Current upload path"
        detail: "Upload behavior is not yet confirmed against target implementation evidence."
    targetSummary:
      - title: "Target upload path"
        detail: "Upload behavior is implemented only when target code, evidence, and negative paths match this map."
    diffRows:
      - id: DIFF-001
        dimension: "Positive upload"
        currentState: "Unconfirmed behavior or smoke-only proof."
        targetState: "Persisted file appears in the file list."
        action: "Implement and verify MUST-001."
      - id: DIFF-002
        dimension: "Empty upload"
        currentState: "May be falsely accepted by smoke-only proof."
        targetState: "Validation error with no persistent side effect."
        action: "Implement and verify NEG-001."
      - id: DIFF-003
        dimension: "Completion proof"
        currentState: "Legacy report may exist as diagnostic context."
        targetState: "Only current-attempt acceptance evidence can close traces."
        action: "Reject legacy completion proof."
    process:
      - id: PROCESS-001
        phase: "Confirm source"
        currentState: "Draft source document."
        targetState: "Confirmed source with visible current/target map."
    artifactPaths:
      - path: "src/upload.ts"
        targetRole: "Target implementation surface"
    canonicalArtifacts:
      - id: CANONICAL-001
        targetPathOrField: "src/upload.ts"
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-001"]
    pathRegistry: []
    existingArtifacts:
      - id: LEGACY-001
        currentPath: "legacy://upload-smoke-report"
        currentFunction: "Legacy smoke-only upload report"
        targetTreatment: "May remain as diagnostic context only."
        completionProofPolicy: "legacy_only"
        traceRows: ["TRACE-001"]
        evidenceRefs: ["EVD-002"]
`}
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
      ownerModel: delivery_confirmation
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
      scriptRef:
        skill: requirements-contract-authoring
        script: scripts/ingest-confirmation-event.js
      scriptPath: "<skill-dir>/scripts/ingest-confirmation-event.js"
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
      producer: skill://requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts
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
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
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
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
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
      command: "npx vitest run ${acceptanceTestPath.replace(/\\/gu, '/')}"
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
    - id: CMD-002
      command: "npx vitest run ${e2eTestPath.replace(/\\/gu, '/')}"
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-002"]
  suggestedCommands:
    - id: CMD-SUG-001
      command: "npm run lint"
${includeCloseoutReviewPolicy ? `    - id: CMD-SUGGESTED-FULL-AI-TDD-CLOSEOUT
      command: "node scripts/main-agent-delivery-closeout-gate.ts --record REQ-UPLOAD-001 --json"
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-010"]
` : ''}
  closeoutReadinessPreview:
${includeCloseoutReviewPolicy ? `    deliveryReady: false
    readinessState: "diagnostic_until_closeout_record_passes"
    requiredCommandAuthority: "deliveryEvidence.requiredCommands"
    requiredCommandsMirrorPolicy: "suggestedCommands are advisory and must mirror controlled required commands before closeout."
` : ''}
    requiredCommands: ["CMD-001", "CMD-002"]
    orphanPolicy: "No orphan command, evidence, artifact, or report may satisfy closeout."
    currentAttemptPolicy: "Only current-attempt evidence with current source and implementation hashes may close trace rows."
    recordClosedPolicy: "record_closed may be written only after delivery verification is verified."
${includeCloseoutReviewPolicy ? `    blockingConditions: ["missing_current_attempt_evidence", "unbound_source_projection_gap"]
  postCloseoutConfirmationReview:
    rendererMode: closeout-review
    preservesOriginalConfirmationState: true
    mustNotMutate: ["sourceDocument", "implementationConfirmation", "requirementRecord"]
    requiredColumns: ["originalConfirmationStatus", "preCloseoutRuntimeStatus", "postCloseoutRuntimeStatus", "finalAcceptanceStatus", "transitionLegality"]
    legalTransitionPolicy: "PENDING may become accepted_success only when current attempt is pass and record_closed proof exists."
  mustDerivedProjectionMap:
    - id: MDPM-AI-TDD-MANIFEST
      mustRefs: ["MUST-001"]
      projectionRefs: ["TRACE-001", "ACC-001", "E2E-001"]
      policy: "fixture ai-tdd manifest projection is source-derived"
    - id: MDPM-CURRENT-TARGET-MAP
      mustRefs: ["MUST-001"]
      projectionRefs: ["DIFF-001", "PROCESS-001"]
      policy: "current target map rows preserve source projection IDs"
    - id: MDPM-CLOSEOUT-PREVIEW
      mustRefs: ["MUST-001"]
      projectionRefs: ["CMD-SUGGESTED-FULL-AI-TDD-CLOSEOUT", "EVD-010"]
      policy: "closeout preview exposes source projection gaps as diagnostics"
  aiTddContractExecutionManifestProjection:
    schemaVersion: ai-tdd-contract-execution-manifest/v1
    applies: true
    requiredSections: ["atomicImplementationTaskLineage", "finalGateMatrix", "executionLoopProtocol"]
    atomicImplementationTaskLineage:
      - taskId: TASK-001
        mustRefs: ["MUST-001"]
        traceRows: ["TRACE-001"]
    finalGateMatrix:
      - gateId: GATE-FINAL-001
        required: true
        commandRefs: ["CMD-001", "CMD-002"]
    executionLoopProtocol:
      maxIterations: 15
      stopOnSemanticGap: true
    semanticGapPolicy:
      action: stop_and_require_reconfirmation
    hostExecutionHints:
      codex: "use /goal when available"
      cursor: "use IDE prompt execution"
    evidenceTrustStates:
      current_pass: "trusted"
      source_projection_gap: "diagnostic_only"
` : ''}
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
      ownerModel: delivery_confirmation
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
      ownerModel: delivery_confirmation
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

function fixedHash(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

function sourceArg(args: string[]): string {
  const index = args.indexOf('--source');
  return index >= 0 ? args[index + 1] : '';
}

function writeValidDrilldownGateReport(source: string, reportPath = path.join(tempDir, 'pre-render-must-decomposition-gate-report.json')) {
  const text = fs.readFileSync(source, 'utf8');
  const extracted = extractImplementationConfirmation(text);
  const sourceDocumentHash = sourceDocumentHashFor(text, extracted.blockText, extracted.confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(extracted.confirmation);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
        verdict: 'PASS',
        confirmability: 'confirmable',
        sourceDocumentHash,
        implementationConfirmationHash,
        semanticKernelRef: {
          path: path.join(tempDir, 'semantic-kernel.json'),
          hash: fixedHash('b'),
        },
        mustDecompositionPacketRef: {
          path: path.join(tempDir, 'must_decomposition_packet.json'),
          hash: fixedHash('a'),
          status: 'synchronized',
        },
        criticalAuditor: {
          minimumRounds: 3,
          consecutiveNoNewGapRounds: 3,
          latestReceiptHash: fixedHash('c'),
          convergenceVerdict: 'bounded_no_new_gap',
        },
        packetSourceReconciliation: {
          reportPath: path.join(tempDir, 'must_packet_source_reconciliation_report.json'),
          verdict: 'pass',
        },
        failedChecks: [],
        blockingIssues: [],
      },
      null,
      2
    ),
    'utf8'
  );
  return reportPath;
}

function runRenderer(args: string[], options: { drilldown?: boolean } = {}) {
  const finalArgs = [...args];
  const source = sourceArg(finalArgs);
  const hasExplicitDrilldown =
    finalArgs.includes('--drilldown-gate-report') ||
    finalArgs.includes('--must-decomposition-gate-report') ||
    finalArgs.includes('--pre-render-must-decomposition-gate-report');
  if (options.drilldown !== false && source && !hasExplicitDrilldown) {
    finalArgs.push('--drilldown-gate-report', writeValidDrilldownGateReport(source));
  }
  return spawnSync(process.execPath, [SCRIPT, ...finalArgs], {
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
    const originalConfirmationRenderReportText = fs.readFileSync(
      path.join(path.dirname(firstOut), 'confirmation-render-report.json'),
      'utf8'
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

  it('renders closeout review as final acceptance only after record_closed and current trace proof', () => {
    const source = writeSource('CLOSEOUT_REVIEW_POLICY_FIXTURE');
    const mermaidBundle = writeMockMermaidBundle();
    const recordPath = path.join(tempDir, 'requirement-record-closeout-review.json');
    const firstOut = path.join(tempDir, 'confirmation-closeout-review-first.html');
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
      '--strict',
      'false',
      '--json',
    ]);
    expect(firstResult.status).toBe(0);
    const firstReport = JSON.parse(
      fs.readFileSync(path.join(path.dirname(firstOut), 'confirmation-render-report.json'), 'utf8')
    );
    const originalConfirmationRenderReportText = fs.readFileSync(
      path.join(path.dirname(firstOut), 'confirmation-render-report.json'),
      'utf8'
    );

    fs.writeFileSync(
      recordPath,
      JSON.stringify(
        {
          recordId: 'REQ-UPLOAD-001',
          requirementSetId: 'REQSET-UPLOAD',
          sourceDocumentHash: firstReport.sourceDocumentHash,
          implementationConfirmationHash: firstReport.implementationConfirmationHash,
          confirmationPageHash: firstReport.confirmationPageHash,
          confirmationHistory: [
            {
              eventType: 'confirmation_recorded',
              sourceDocumentHash: firstReport.sourceDocumentHash,
              implementationConfirmationHash: firstReport.implementationConfirmationHash,
              confirmationPageHash: firstReport.confirmationPageHash,
            },
          ],
          lastEventType: 'confirmation_projection_refreshed',
          lastAppliedEventId: 'record_closed:fixture',
          closeout: {
            currentAttemptId: 'closeout-review-pass',
            decision: 'pass',
            attempts: [
              {
                eventType: 'closeout_check_recorded',
                closeoutAttemptId: 'closeout-review-blocked-001',
                decision: 'blocked',
                blockingReasons: ['open_rca_action_exists'],
                checks: [
                  { id: 'delivery-truth-gate-current', passed: true },
                  { id: 'rca-actions-closed', passed: false, openCount: 1 },
                ],
                reportPath: path.join(path.dirname(recordPath), 'delivery-closeout-report.json'),
                evaluatedAt: '2026-05-27T07:00:00.000Z',
              },
              {
                eventType: 'closeout_check_recorded',
                closeoutAttemptId: 'closeout-review-pass',
                decision: 'pass',
                blockingReasons: [],
                checks: [
                  { id: 'delivery-truth-gate-current', passed: true, issueCount: 0 },
                  { id: 'ai-tdd-contract-gate-closeout', passed: true, blockingReasons: [] },
                  { id: 'required-command:CMD-CLOSEOUT-REVIEW', passed: true, openCount: 0 },
                  { id: 'requirement-closures-terminal', passed: true, openCount: 0 },
                  { id: 'failure-records-closed', passed: true, openCount: 0 },
                  { id: 'rca-actions-closed', passed: true, openCount: 0 },
                ],
                reportPath: path.join(path.dirname(recordPath), 'delivery-closeout-report.json'),
                evaluatedAt: '2026-05-27T08:00:00.000Z',
              },
            ],
          },
          deliveryEvidence: {
            requiredCommands: [
              {
                commandId: 'CMD-CLOSEOUT-REVIEW',
                command: 'verify closeout review',
                blockingIfMissing: true,
                negativeOrRegression: true,
                closeoutAttemptId: 'closeout-review-pass',
                lastRunRef: {
                  commandId: 'CMD-CLOSEOUT-REVIEW',
                  runId: 'run-closeout-review-pass',
                  closeoutAttemptId: 'closeout-review-pass',
                },
                traceRows: ['TRACE-001'],
                evidenceRefs: ['EVD-001', 'EVD-002'],
                artifactRefs: [
                  {
                    artifactType: 'command_output',
                    sourceOfTruthRole: 'evidence',
                    path: 'evidence/closeout-review.txt',
                    hash: 'sha256:closeout-review',
                  },
                ],
              },
            ],
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
                  commandId: 'CMD-CLOSEOUT-REVIEW',
                  runId: 'run-closeout-review-pass',
                  closeoutAttemptId: 'closeout-review-pass',
                  exitCode: 0,
                },
              ],
            },
          ],
          executionIterations: [{ status: 'closed', closeoutAttemptId: 'closeout-review-pass' }],
          gateChecks: [{ status: 'pass', closeoutAttemptId: 'closeout-review-pass' }],
          contractChecks: [{ status: 'pass', closeoutAttemptId: 'closeout-review-pass' }],
          failureRecords: [{ status: 'closed', closeoutAttemptId: 'closeout-review-pass' }],
          rcaRecords: [{ status: 'closed', closeoutAttemptId: 'closeout-review-pass' }],
          rerunLoops: [{ status: 'closed', closeoutAttemptId: 'closeout-review-pass' }],
          artifactIndex: [{ path: 'evidence/closeout-review.txt', hash: 'sha256:closeout-review' }],
          readinessAuditRequests: [{ status: 'closed', auditId: 'readiness-request-001' }],
          readinessAuditResults: [{ status: 'pass', auditId: 'readiness-result-001' }],
          readinessScoringRecords: [{ status: 'pass', scoreId: 'readiness-score-001' }],
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(path.dirname(recordPath), 'delivery-closeout-report.json'),
      JSON.stringify(
        {
          currentAttemptId: 'closeout-review-pass',
          decision: 'pass',
          generatedAt: '2026-05-27T08:00:00.000Z',
          checks: [
            { id: 'delivery-truth-gate-current', passed: true, issueCount: 0, openCount: 0 },
            { id: 'ai-tdd-contract-gate-closeout', passed: true, blockingReasons: [] },
            { id: 'required-command:CMD-CLOSEOUT-REVIEW', passed: true, openCount: 0, missingEvidenceCount: 0 },
            { id: 'requirement-closures-terminal', passed: true, openCount: 0 },
            { id: 'failure-records-closed', passed: true, openCount: 0 },
            { id: 'rca-actions-closed', passed: true, openCount: 0 },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const out = path.join(tempDir, 'closeout-review.html');
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
      '--mode',
      'closeout-review',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const reportPath = path.join(path.dirname(out), 'closeout-review.render-report.json');
    const summaryPath = path.join(path.dirname(out), 'closeout-review.summary.json');
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.existsSync(summaryPath)).toBe(true);
    expect(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8')).toBe(
      originalConfirmationRenderReportText
    );
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(html).toContain('id="final-acceptance-review"');
    expect(html).toContain('Original Confirmation Status');
    expect(html).toContain('Pre-Closeout Runtime Status');
    expect(html).toContain('Post-Closeout Runtime Status');
    expect(html).toContain('Final Acceptance Status');
    expect(html).toContain('Transition Legality');
    expect(html).toContain('accepted_success');
    expect(html).toContain('legal_transition');
    expect(html).toContain('run-closeout-review-pass');
    expect(html).toContain('Closeout Delivery Verdict');
    expect(html).toContain('closeout-verdict-metrics');
    expect(html).toContain('final_acceptance_ready');
    expect(html).toContain('final-acceptance-metrics');
    expect(html).toContain('Pre-Closeout Diagnostic');
    expect(html).toContain('source_projection_gap');
    expect(html).toContain('EVD-010');
    expect(html).toContain('source evidence[] entry exists but no source traceRows[].evidenceRefs row binds it');
    expect(html).toContain('Closeout Gate Result Matrix');
    expect(html).toContain('delivery-truth-gate-current');
    expect(html).toContain('ai-tdd-contract-gate-closeout');
    expect(html).toContain('required-command:CMD-CLOSEOUT-REVIEW');
    expect(html).toContain('Closeout Attempt History');
    expect(html).toContain('closeout-review-blocked-001');
    expect(html).toContain('open_rca_action_exists');
    expect(html).toContain('Runtime Evidence Closure Summary');
    expect(html).toContain('requirementClosures');
    expect(html).toContain('readinessScoringRecords');
    expect(html).toContain('Source Closeout Policy');
    expect(html).toContain('rendererMode');
    expect(html).toContain('preservesOriginalConfirmationState');
    expect(html).toContain('requiredCommandsMirrorPolicy');
    expect(html).toContain('CMD-SUGGESTED-FULL-AI-TDD-CLOSEOUT');
    expect(html).toContain('MDPM-AI-TDD-MANIFEST');
    expect(html).toContain('atomicImplementationTaskLineage');
    expect(html).toContain('finalGateMatrix');
    expect(html).toContain('hostExecutionHints');
    expect(html).toContain('DIFF-001');
    expect(html).toContain('PROCESS-001');
    expect(html).toContain('class="tag green">accepted_success</span>');
    expect(html).toContain('class="tag green">current_pass</span>');
    expect(html).toContain('class="tag green">legal_transition</span>');
    expect(html).toContain('closeout-trace-acceptance-table');
    expect(html).toContain('确认最终验收并关闭需求');
    expect(html).toContain('closeoutAttemptId=closeout-review-pass');
    expect(html).toContain('closeoutConfirmationPageHash=sha256:');
    expect(html).toContain('deliveryCloseoutReportHash=sha256:');
    expect(html).toContain('目标态实现核实层');
    expect(html).toContain('source_target');
    expect(html).toContain('runtime_evidence');
    expect(html).toContain('verification_status');
    expect(html).toContain('evidence_refs');
    expect(html).toContain('legal_transition');
    expect(html).toContain('achieved');
    expect(report.mode).toBe('closeout-review');
    expect(report.confirmationPageHashScope).toBe('scope_confirmation_hash_compatibility_field_not_closeout_authority');
    expect(report.closeoutConfirmationPageHash).toMatch(/^sha256:/);
    expect(report.confirmationPageHash).toBe(firstReport.confirmationPageHash);
    expect(report.closeoutConfirmationPageHash).not.toBe(report.confirmationPageHash);
    expect(report.closeoutConfirmationHashScope).toBe(
      'closeout_html_normalized_with_self_hash_placeholder_and_generated_at_excluded'
    );
    expect(report.closeoutConfirmInstruction).toContain('确认最终验收并关闭需求');
    expect(report.closeoutConfirmInstruction).toContain('closeoutAttemptId=closeout-review-pass');
    expect(report.closeoutConfirmInstruction).toContain(`closeoutConfirmationPageHash=${report.closeoutConfirmationPageHash}`);
    expect(report.closeoutConfirmInstruction).toContain(`deliveryCloseoutReportHash=${report.deliveryCloseoutReportHash}`);
    expect(report.deliveryCloseoutReportHash).toMatch(/^sha256:/);
    expect(report.closeoutProjectionIdentity).toMatchObject({
      closeoutAttemptId: 'closeout-review-pass',
      currentAliasPath: '_bmad-output/runtime/requirement-records/REQ-UPLOAD-001/confirmation/closeout-confirmation-current.html',
      canonicalPath: '_bmad-output/runtime/requirement-records/REQ-UPLOAD-001/confirmation/closeout-confirmation-closeout-review-pass.html',
      preservesScopeConfirmation: true,
    });
    expect(report.renderedSectionOrder).toEqual(
      expect.arrayContaining([
        'closeout-gate-result-matrix',
        'closeout-attempt-history',
        'runtime-evidence-closure-summary',
        'source-closeout-policy',
      ])
    );
    expect(report.closeoutDeliveryVerdict).toMatchObject({
      applies: true,
      ready: true,
      status: 'final_acceptance_ready',
      label: 'final_acceptance_ready',
      closeoutReportDecision: 'pass',
      closeoutCheckCount: 6,
      closeoutFailedCheckCount: 0,
      sourceProjectionGapCount: 1,
    });
    expect(report.preCloseoutDiagnostic).toMatchObject({
      ready: true,
      missingEvidenceCount: 0,
    });
    expect(report.progressDelta.idStatuses['EVD-010']).toMatchObject({
      proofState: 'source_projection_gap',
      label: 'source_projection_gap',
      tone: 'gold',
    });
    expect(report.progressDelta.missingEvidenceIds).not.toContain('EVD-010');
    expect(report.sourceProjectionDiagnostics.unboundEvidence[0]).toMatchObject({
      id: 'EVD-010',
      diagnosticType: 'source_projection_gap',
      proofState: 'source_evidence_unbound_to_trace',
    });
    expect(report.closeoutGateMatrix.rows.map((row: any) => row.id)).toEqual(
      expect.arrayContaining([
        'delivery-truth-gate-current',
        'ai-tdd-contract-gate-closeout',
        'required-command:CMD-CLOSEOUT-REVIEW',
        'requirement-closures-terminal',
        'failure-records-closed',
        'rca-actions-closed',
      ])
    );
    expect(report.closeoutAttemptHistory).toMatchObject({
      totalCount: 2,
      blockedCount: 1,
      passedCount: 1,
    });
    expect(report.runtimeEvidenceClosureSummary.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'requirementClosures', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'gateChecks', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'contractChecks', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'failureRecords', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'rcaRecords', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'rerunLoops', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'artifactIndex', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'readinessAuditRequests', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'readinessAuditResults', totalCount: 1, openCount: 0 }),
        expect.objectContaining({ name: 'readinessScoringRecords', totalCount: 1, openCount: 0 }),
      ])
    );
    expect(report.sourceCloseoutPolicyCoverage).toMatchObject({
      suggestedCommandIds: expect.arrayContaining(['CMD-SUGGESTED-FULL-AI-TDD-CLOSEOUT']),
      mustDerivedProjectionMapIds: expect.arrayContaining(['MDPM-AI-TDD-MANIFEST']),
      aiTddContractExecutionManifestProjectionFields: expect.arrayContaining([
        'atomicImplementationTaskLineage',
        'finalGateMatrix',
        'executionLoopProtocol',
        'semanticGapPolicy',
        'hostExecutionHints',
        'evidenceTrustStates',
      ]),
    });
    expect(report.finalAcceptanceReview).toMatchObject({
      applies: true,
      ready: true,
      status: 'final_acceptance_ready',
      currentAttemptId: 'closeout-review-pass',
      recordClosed: true,
      attemptDecision: 'pass',
    });
    expect(report.finalAcceptanceReview.recordClosedProof).toMatchObject({
      recordClosed: true,
      proofKind: 'terminal_record_closed_proof',
    });
    expect(report.finalAcceptanceReview.lastEventType).toBe('confirmation_projection_refreshed');
    expect(report.finalAcceptanceReview.rows['TRACE-001']).toMatchObject({
      originalConfirmationStatus: 'PENDING',
      preCloseoutRuntimeStatus: 'open_before_closeout',
      postCloseoutRuntimeStatus: 'current_pass',
      finalAcceptanceStatus: 'accepted_success',
      transitionLegality: 'legal_transition',
      runId: 'run-closeout-review-pass',
      closeoutAttemptId: 'closeout-review-pass',
    });
    expect(report.finalAcceptanceReview.requiredCommandEvidence).toMatchObject({
      totalCount: 1,
      currentAttemptCount: 1,
      artifactBoundCount: 1,
    });
    expect(report.currentTargetRealization.summary).toMatchObject({
      achieved: expect.any(Number),
      not_achieved: 0,
      not_evaluable: 0,
    });
    expect(report.currentTargetRealization.rows[0]).toMatchObject({
      source_target: expect.any(String),
      verification_status: 'achieved',
      legal_transition: true,
    });
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.closeoutDeliveryVerdict).toMatchObject({ ready: true, status: 'final_acceptance_ready' });
    expect(summary.preCloseoutDiagnostic).toMatchObject({ ready: true, missingEvidenceCount: 0 });
    expect(summary.closeoutConfirmationPageHash).toBe(report.closeoutConfirmationPageHash);
    expect(summary.closeoutConfirmInstruction).toBe(report.closeoutConfirmInstruction);
    expect(summary.currentTargetRealization.summary.achieved).toBeGreaterThan(0);
    expect(summary.renderedSectionOrder).toContain('source-closeout-policy');
  });

  it('fails closed in closeout-review mode without a terminal record_closed event', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const recordPath = path.join(tempDir, 'requirement-record-closeout-review-blocked.json');
    const firstOut = path.join(tempDir, 'confirmation-closeout-review-blocked-first.html');
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
          lastEventType: 'closeout_check_recorded',
          closeout: {
            currentAttemptId: 'closeout-review-not-closed',
            decision: 'pass',
            attempts: [
              {
                closeoutAttemptId: 'closeout-review-not-closed',
                decision: 'pass',
                blockingReasons: [],
              },
            ],
          },
          deliveryEvidence: {
            requiredCommands: [
              {
                commandId: 'CMD-CLOSEOUT-REVIEW',
                negativeOrRegression: true,
                closeoutAttemptId: 'closeout-review-not-closed',
                lastRunRef: {
                  commandId: 'CMD-CLOSEOUT-REVIEW',
                  runId: 'run-closeout-review-not-closed',
                  closeoutAttemptId: 'closeout-review-not-closed',
                },
                traceRows: ['TRACE-001'],
                evidenceRefs: ['EVD-001', 'EVD-002'],
                artifactRefs: [{ path: 'evidence/closeout-review.txt', hash: 'sha256:closeout-review' }],
              },
            ],
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
                  commandId: 'CMD-CLOSEOUT-REVIEW',
                  runId: 'run-closeout-review-not-closed',
                  closeoutAttemptId: 'closeout-review-not-closed',
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

    const out = path.join(tempDir, 'closeout-review-blocked.html');
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
      '--mode',
      'closeout-review',
      '--json',
    ]);

    expect(result.status).toBe(3);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(
      fs.readFileSync(path.join(path.dirname(out), 'closeout-review-blocked.render-report.json'), 'utf8')
    );
    expect(html).toContain('final_acceptance_ready=false');
    expect(html).toContain('final_acceptance_record_closed_missing');
    expect(report.finalAcceptanceReview.ready).toBe(false);
    expect(report.finalAcceptanceReview.blockingIssues.map((issue: any) => issue.code)).toContain(
      'final_acceptance_record_closed_missing'
    );
  });

  it('keeps real missing runtime evidence blocking even when source projection gaps exist', () => {
    const source = writeSource('CLOSEOUT_REVIEW_POLICY_FIXTURE');
    const mermaidBundle = writeMockMermaidBundle();
    const recordPath = path.join(tempDir, 'requirement-record-closeout-review-missing-runtime.json');
    const firstOut = path.join(tempDir, 'confirmation-closeout-review-missing-runtime-first.html');
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
      '--strict',
      'false',
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
          lastEventType: 'record_closed',
          lastAppliedEventId: 'record_closed:closeout-review-missing-runtime',
          closeout: {
            currentAttemptId: 'closeout-review-missing-runtime',
            decision: 'pass',
            attempts: [
              {
                eventType: 'record_closed',
                closeoutAttemptId: 'closeout-review-missing-runtime',
                decision: 'pass',
                blockingReasons: [],
              },
            ],
          },
          deliveryEvidence: {
            requiredCommands: [
              {
                commandId: 'CMD-CLOSEOUT-REVIEW',
                closeoutAttemptId: 'closeout-review-missing-runtime',
                lastRunRef: {
                  commandId: 'CMD-CLOSEOUT-REVIEW',
                  runId: 'run-closeout-review-missing-runtime',
                  closeoutAttemptId: 'closeout-review-missing-runtime',
                },
                traceRows: ['TRACE-001'],
                evidenceRefs: ['EVD-001'],
                artifactRefs: [{ path: 'evidence/closeout-review.txt', hash: 'sha256:closeout-review' }],
              },
            ],
          },
          requirementClosures: [],
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(path.dirname(recordPath), 'delivery-closeout-report.json'),
      JSON.stringify(
        {
          currentAttemptId: 'closeout-review-missing-runtime',
          decision: 'pass',
          checks: [{ id: 'delivery-truth-gate-current', passed: true, issueCount: 0, openCount: 0 }],
        },
        null,
        2
      ),
      'utf8'
    );

    const out = path.join(tempDir, 'closeout-review-missing-runtime.html');
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
      '--mode',
      'closeout-review',
      '--json',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(
      fs.readFileSync(path.join(path.dirname(out), 'closeout-review-missing-runtime.render-report.json'), 'utf8')
    );
    expect(report.finalAcceptanceReview.ready).toBe(false);
    expect(report.finalAcceptanceReview.blockingIssues.map((issue: any) => issue.code)).toContain(
      'final_acceptance_trace_not_accepted'
    );
    expect(report.progressDelta.idStatuses['EVD-010']).toMatchObject({
      proofState: 'missing_evidence',
    });
    expect(report.progressDelta.missingEvidenceIds).toContain('EVD-010');
  });

  it('does not claim target realization achieved from source prose without runtime acceptance evidence', () => {
    const source = writeSource('CLOSEOUT_REVIEW_POLICY_FIXTURE');
    const mermaidBundle = writeMockMermaidBundle();
    const recordPath = path.join(tempDir, 'requirement-record-closeout-review-target-not-achieved.json');
    const firstOut = path.join(tempDir, 'confirmation-closeout-review-target-not-achieved-first.html');
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
      '--strict',
      'false',
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
          lastEventType: 'record_closed',
          lastAppliedEventId: 'record_closed:closeout-review-target-not-achieved',
          closeout: {
            currentAttemptId: 'closeout-review-target-not-achieved',
            decision: 'pass',
            attempts: [
              {
                eventType: 'record_closed',
                closeoutAttemptId: 'closeout-review-target-not-achieved',
                decision: 'pass',
                blockingReasons: [],
              },
            ],
          },
          deliveryEvidence: {
            requiredCommands: [
              {
                commandId: 'CMD-CLOSEOUT-REVIEW',
                closeoutAttemptId: 'closeout-review-target-not-achieved',
                lastRunRef: {
                  commandId: 'CMD-CLOSEOUT-REVIEW',
                  runId: 'run-closeout-review-target-not-achieved',
                  closeoutAttemptId: 'closeout-review-target-not-achieved',
                },
                traceRows: ['TRACE-001'],
                evidenceRefs: ['EVD-001'],
                artifactRefs: [{ path: 'evidence/closeout-review.txt', hash: 'sha256:closeout-review' }],
              },
            ],
          },
          requirementClosures: [
            {
              eventType: 'requirement_closure_recorded',
              requirementId: 'MUST-001',
              status: 'pass',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
              sourceDocumentHash: firstReport.sourceDocumentHash,
              implementationConfirmationHash: 'sha256:stale',
              commandRunRefs: [
                {
                  commandId: 'CMD-CLOSEOUT-REVIEW',
                  runId: 'run-closeout-review-target-not-achieved',
                  closeoutAttemptId: 'closeout-review-target-not-achieved',
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

    const out = path.join(tempDir, 'closeout-review-target-not-achieved.html');
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
      '--mode',
      'closeout-review',
      '--json',
    ]);

    expect(result.status).toBe(3);
    const report = JSON.parse(
      fs.readFileSync(path.join(path.dirname(out), 'closeout-review-target-not-achieved.render-report.json'), 'utf8')
    );
    expect(report.finalAcceptanceReview.ready).toBe(false);
    expect(report.currentTargetRealization.summary.achieved).toBe(0);
    expect(report.currentTargetRealization.summary.not_achieved).toBeGreaterThan(0);
    expect(report.currentTargetRealization.rows[0]).toMatchObject({
      verification_status: 'not_achieved',
      legal_transition: false,
    });
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
    reasonCode: source_hash_changed
    reason: sourceDocumentHash_changed
    userFacingTitle: "需要重新确认本次需求"
    userFacingSummary: "MUST-001 的证据命令说明发生语义变化，需要用户确认新边界。"
    persuasiveRationale:
      whyReconfirmNow: "当前语义 hash 已不同于上次确认，不能沿用历史确认。"
      riskIfSkipped: "跳过会把未确认的 MUST-001 证据命令变化当作已确认范围执行。"
      whyEvidenceIsSufficient: "差异摘要、MUST/EVD/TRACE 引用和命令引用共同指向同一变化。"
    evidenceBundle:
      sufficiencyVerdict: sufficient
      items:
        - id: RCEVD-001
          kind: evidence
          title: "MUST-001 evidence command clarification"
          summary: "MUST-001 的证据命令被澄清并绑定到 EVD-001 与 TRACE-001。"
          sourceRefs: ["MUST-001"]
          proofRefs: ["EVD-001", "TRACE-001", "CMD-CONTRACT-001"]
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
    expect(html.indexOf('id="reconfirmation-request"')).toBeLessThan(html.indexOf('id="core-design"'));
    expect(html).toContain('id="progress-delta"');
    expect(html).toContain('class="review-flow"');
    expect(html).toContain('class="review-step"');
    expect(html).toContain('历史进度与本次差异');
    expect(html).toContain('本次确认变化');
    expect(html).toContain('重点验收焦点');
    expect(html).toContain('新增 / 变更');
    expect(html).toContain('userStatus');
    expect(html).toContain('检测到确认边界语义漂移');
    expect(html).toContain('sourceDocumentHash_changed');
    expect(html).toContain('MUST-001 evidence command clarification');
    expect(html).toContain('当前语义 hash 已不同于上次确认');
    expect(html).toContain('跳过会把未确认的 MUST-001');
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
    expect(report.confirmationDriftClassification).toMatchObject({
      kind: 'semantic_reconfirmation_required',
      requiresUserReconfirmation: true,
    });
    expect(report.renderedSectionOrder.indexOf('reconfirmation-request')).toBeLessThan(
      report.renderedSectionOrder.indexOf('core-design')
    );
    expect(report.reconfirmationBannerRendered).toBe(true);
    expect(report.reconfirmationEvidenceVerdict).toBe('sufficient');
    expect(report.blockingIssues.map((issue: { code: string }) => issue.code)).not.toEqual(
      expect.arrayContaining([
        'sourceDocumentHash_changed',
        'implementationConfirmationHash_changed',
      ])
    );
    expect(report.reconfirmationRequest).toMatchObject({
      required: true,
      reason: 'source_hash_changed',
      reasonCode: 'source_hash_changed',
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
    expect(html).toContain('<section class="card current-target-map" id="current-target">');
    expect(html).toContain('fixture-provided current target map');
    expect(html).toContain('AI-TDD 契约执行清单');
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
    expect(report.renderedSections).toContain('current-target');
    expect(report.currentTargetCoverage.artifactPaths).toBeGreaterThan(0);
    expect(report.currentTargetCoverage.canonicalArtifacts).toBeGreaterThan(0);
    expect(report.currentTargetSchemaVersion).toBe('current-target-map/v1');
    expect(report.currentTargetDisplayProfile).toBe('closed_loop_current_target_map');
    expect(report.aiTddContractManifestCoverage.sections.currentTargetMap).toMatchObject({
      ready: true,
      decision: 'pass',
    });
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
      /\n {6}expectedRecoveryActions:\n {8}- require_user_reconfirmation\n {8}- rebuild_trace_checkpoint/u,
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
      /\n {6}recordEventTypes: \["confirmation_recorded", "contract_check_recorded"\]/u,
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
      /\n {6}payloadContract:\n {8}requiredFields: \["eventType", "decision"\]\n {8}forbiddenFields: \["result", "status"\]\n {8}requiredSourceRefs: false\n {8}allowedControlWriteMode: control/u,
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
    const mutated = original.replace(/\n {2}controlledIngestWriterRegistry:\n[\s\S]*?(?=\n {2}artifactAutomationPlan:\n)/u, '\n');
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

  it('blocks zh-CN confirmation when core confirmation text is English-only', () => {
    const source = writeSource('ENGLISH_ONLY_CONFIRMATION_TEXT');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'english-only-confirmation.html');
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
    expect(report.confirmability).toBe('blocked');
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain(
      'confirmation_language_content_english_only'
    );
    expect(report.blockingIssues.some((issue: any) => issue.refs.includes('MUST-001'))).toBe(true);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('confirmation_language_content_english_only');
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
  B -->|needs semantic proof [EVD-002]| C(Write manifest/stats/evidence [TRACE-001])
  C -->|"already quoted edge"| D[Done [MUST-001]]
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
    expect(html).toContain('--&gt;|&quot;needs semantic proof EVD-002&quot;|');
    expect(html).toContain('C(&quot;Write manifest/stats/evidence TRACE-001&quot;)');
    expect(html).toContain('--&gt;|&quot;already quoted edge&quot;|');
    expect(html).toContain('D[&quot;Done MUST-001&quot;]');
    expect(html).toContain('A[Start ingest [MUST-001][EVD-001]]');
  });

  it('normalizes sequence message labels with semicolons for native Mermaid rendering only', () => {
    const source = writeSource('MERMAID_SEQUENCE_SEMICOLON_RENDER_SOURCE');
    fs.appendFileSync(
      source,
      `

\`\`\`mermaid
sequenceDiagram
  participant Review
  participant Source
  Review-->>Source: Preserve traceRows.status; do not mutate confirmation state [NEG-001]
\`\`\`
`,
      'utf8'
    );
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'safe-sequence-render-source.html');
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
    expect(html).toContain(
      'Review--&gt;&gt;Source: Preserve traceRows.status and do not mutate confirmation state NEG-001'
    );
    expect(html).toContain(
      'Review--&gt;&gt;Source: Preserve traceRows.status; do not mutate confirmation state [NEG-001]'
    );
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
      /\n {4}scoringDashboardSft:\n {6}applies: true\n {6}reasonCode: "fixture_renders_scoring_dashboard_sft_read_model_boundaries"/u,
      '\n    scoringDashboardSft:\n      applies: false'
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

  it('blocks confirmability when aiTddContractGate applies but manifest projection coverage is missing', () => {
    const source = writeSource('MISSING_AI_TDD_MANIFEST_PROJECTION');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-ai-tdd-manifest-projection.html');
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
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    const blockingCodes = report.blockingIssues.map((issue: any) => issue.code);
    expect(report.confirmability).toBe('blocked');
    expect(report.aiTddContractManifestCoverage.required).toBe(true);
    expect(report.aiTddContractManifestCoverage.decision).toBe('blocked');
    expect(report.aiTddContractManifestCoverage.sections.errorCaseCoverage.decision).toBe('blocked');
    expect(blockingCodes).toEqual(
      expect.arrayContaining([
        'ai_tdd_manifest_failure_path_acceptance_coverage_missing',
        'ai_tdd_manifest_edge_case_acceptance_coverage_missing',
      ])
    );
    expect(html).toContain('AI-TDD 契约执行清单');
    expect(html).toContain('failure_path_acceptance_coverage_missing');
    expect(html).toContain('edge_case_acceptance_coverage_missing');
  });

  it('blocks confirmability when currentTargetMap applies but the required view pack is missing', () => {
    const source = writeSource('CURRENT_TARGET_APPLIES_WITHOUT_VIEW_PACK');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-current-target-hidden.html');
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
    expect(report.confirmability).toBe('blocked');
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('current_target_required_view_pack_missing');
    expect(report.currentTargetCoverage.diffRows).toBe(3);
    expect(report.renderedSections).not.toContain('current-target');
  });

  it('blocks confirmability when currentTargetMap applies but displayProfile is missing', () => {
    const source = writeSource('CURRENT_TARGET_APPLIES_MISSING_DISPLAY_PROFILE');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-current-target-missing-display-profile.html');
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
    expect(report.confirmability).toBe('blocked');
    expect(codes).toContain('current_target_required_display_profile_missing_or_invalid');
    expect(report.renderedSections).toContain('current-target');
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

  it('renders target modification paths and blocks when the explicit list is missing for implementation changes', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-target-modification-paths.html');
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
    expect(html).toContain('目标修改路径清单');
    expect(html).toContain('src/upload.ts');
    expect(report.renderedSections).toContain('target-modification-paths');
    expect(report.targetModificationPaths).toHaveLength(4);
    expect(report.targetModificationPathCoverage.counts.explicit).toBe(4);
    expect(report.targetModificationPathCoverage.ready).toBe(true);
    expect(report.targetModificationPathCoverage.counts.missingCoverage).toBe(0);
    expect(report.targetModificationPathCoverage.counts.unclassifiedCoverage).toBe(0);
    expect(report.targetModificationPaths.find((row: any) => row.path === 'src/upload.ts')?.coverageRole).toBe('modify');

    const missingSource = writeSource('MISSING_TARGET_MODIFICATION_PATHS');
    const missingOut = path.join(tempDir, 'confirmation-missing-target-modification-paths.html');
    const missingResult = runRenderer([
      '--source',
      missingSource,
      '--out',
      missingOut,
      '--mermaid-bundle',
      mermaidBundle,
      '--language',
      'zh-CN',
      '--record-id',
      'REQ-UPLOAD-001',
      '--entry-flow',
      'story',
    ]);
    const missingReport = JSON.parse(fs.readFileSync(path.join(path.dirname(missingOut), 'confirmation-render-report.json'), 'utf8'));
    expect(missingResult.status).toBe(3);
    expect(missingReport.confirmability).toBe('blocked');
    expect(missingReport.blockingIssues.map((issue: any) => issue.code)).toContain('target_modification_paths_missing');
  });

  it('blocks confirmability when targetModificationPaths omit artifact, command, or current-target coverage', () => {
    const source = writeSource('MISSING_TARGET_MODIFICATION_PATHS');
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-target-modification-path-coverage-missing.html');
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

    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    const codes = report.blockingIssues.map((issue: any) => issue.code);
    expect(result.status).toBe(3);
    expect(report.confirmability).toBe('blocked');
    expect(codes).toContain('target_modification_path_coverage_missing');
    expect(report.targetModificationPathCoverage.ready).toBe(false);
    expect(report.targetModificationPathCoverage.missingCoverage.map((row: any) => row.path)).toEqual(
      expect.arrayContaining(['src/upload.ts'])
    );
    expect(report.targetModificationPathCoverage.missingCoverage.some((row: any) => row.sources.includes('requiredCommands.targetFiles'))).toBe(
      true
    );
    expect(report.targetModificationPathCoverage.missingCoverage.some((row: any) => row.sources.includes('currentTargetMap.scriptConvergence'))).toBe(
      true
    );
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
            path: 'skill://requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts',
            artifactType: 'script',
            sourceOfTruthRole: 'evidence',
            ownerModel: 'requirements',
            producer: 'renderer',
            consumer: 'user',
            inputArtifacts: ['prd.md'],
            outputArtifacts: ['confirmation.html'],
            recordEventTypes: ['confirmation_view_rendered'],
            canAffectControlFlow: false,
            traceRows: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
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
    expect(html).toContain('skill://requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts');
    expect(html).toContain('<section class="card current-target-map" id="current-target">');
    const summary = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-summary.json'), 'utf8'));
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(summary.counts.artifactPlanItems).toBe(4);
    expect(report.currentTargetSchemaVersion).toBe('current-target-map/v1');
    expect(report.currentTargetDisplayProfile).toBe('closed_loop_current_target_map');
    expect(report.currentTargetCoverage.artifactPaths).toBeGreaterThan(0);
    expect(report.currentTargetSchemaIssues).toEqual([]);
  });

  it('renders current-target content in the default instance because AI-TDD gate requires it', () => {
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
    expect(html).toContain('<section class="card current-target-map" id="current-target">');
    expect(html).not.toContain('六个心智模型');
    expect(html).not.toContain('双唯一门禁与 typed envelope');
    expect(report.currentTargetCoverage.artifactPaths).toBeGreaterThan(0);
    expect(report.currentTargetCoverage.canonicalArtifacts).toBeGreaterThan(0);
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
    const mutated = original.replace(/\n {2}currentTargetMap:\n[\s\S]*?(?=\n {2}governanceEventTypeRegistry:\n)/u, '\n');
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

  it('blocks confirmability when the pre-confirmation semantic drilldown gate report is missing', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-missing-drilldown.html');
    const result = runRenderer(
      [
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
        '--drilldown-gate-report',
        path.join(tempDir, 'missing-drilldown-report.json'),
      ],
      { drilldown: false }
    );

    expect(result.status).toBe(3);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.confirmability).toBe('blocked');
    expect(report.renderedSections).toContain('pre-confirmation-semantic-drilldown');
    expect(report.blockingIssues.map((issue: any) => issue.code)).toContain('pre_confirmation_authoring_repair_required');
    expect(report.blockingIssues.find((issue: any) => issue.code === 'pre_confirmation_authoring_repair_required')).toMatchObject({
      repairAction: 'run_authoring_repair_preserve_existing',
    });
    expect(
      report.blockingIssues.find((issue: any) => issue.code === 'pre_confirmation_authoring_repair_required')?.repairCommand
    ).toContain('main-agent-orchestration --action authoring-repair --mode preserve-existing');
    expect(html).toContain('Pre-Confirmation Semantic Drilldown');
  });

  it('renders pre-confirmation semantic drilldown sections from a synchronized PASS gate report', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation-drilldown.html');
    const gateReport = writeValidDrilldownGateReport(source, path.join(tempDir, 'valid-drilldown-report.json'));
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
      '--drilldown-gate-report',
      gateReport,
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(out), 'confirmation-render-report.json'), 'utf8'));
    expect(report.confirmability).toBe('confirmable');
    expect(report.preConfirmationSemanticDrilldown.status).toBe('pass');
    expect(report.renderedSections).toContain('pre-confirmation-semantic-drilldown');
    for (const heading of [
      'Pre-Confirmation Semantic Drilldown',
      'Semantic Kernel Summary',
      'MUST Decomposition Packet',
      'Atomicity Drivers',
      'Atomic Task Baseline',
      'Projection Coverage',
      'Critical Auditor Convergence',
      'Gap History',
      'Packet-To-Source Reconciliation',
    ]) {
      expect(html).toContain(heading);
    }
  });

  it('can be invoked through the documented node CLI and prints machine-readable summary with --json', () => {
    const source = writeSource();
    const mermaidBundle = writeMockMermaidBundle();
    const out = path.join(tempDir, 'confirmation.html');
    const gateReport = writeValidDrilldownGateReport(source, path.join(tempDir, 'cli-drilldown-report.json'));
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
      '--drilldown-gate-report',
      gateReport,
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
