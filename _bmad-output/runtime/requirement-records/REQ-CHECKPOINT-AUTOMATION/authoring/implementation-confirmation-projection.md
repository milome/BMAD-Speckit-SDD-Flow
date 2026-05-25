# Runtime implementationConfirmation Projection

Source: docs/requirements/2026-05-25-requirements-contract-checkpoint-automation.md

```yaml
implementationConfirmation:
  contractSchemaVersion: 1
  status: user_confirmed
  recordId: REQ-CHECKPOINT-AUTOMATION
  requirementSetId: REQSET-CHECKPOINT-AUTOMATION
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: bmad
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  requiredViewPacks:
    - currentTargetMap
  optionalViewPacks: []
  confirmedAt: '2026-05-25T06:47:28.573Z'
  confirmedBy: user
  sourceDocumentHash: sha256:405e440bedbb7498774f4200d9ebb377bad782d64c0d87dc2e565e1f722a14ad
  implementationConfirmationHash: sha256:f150f22376bc2aa942a030fe8c7b3e91361f27f0d9255824b92648015b0087c8
  confirmationRender:
    htmlPath: >-
      D:/Dev/BMAD-Speckit-SDD-Flow/_bmad-output/runtime/requirement-records/REQ-CHECKPOINT-AUTOMATION/confirmation/confirmation.html
    summaryPath: >-
      D:/Dev/BMAD-Speckit-SDD-Flow/_bmad-output/runtime/requirement-records/REQ-CHECKPOINT-AUTOMATION/confirmation/confirmation-summary.json
    reportPath: >-
      D:/Dev/BMAD-Speckit-SDD-Flow/_bmad-output/runtime/requirement-records/REQ-CHECKPOINT-AUTOMATION/confirmation/confirmation-render-report.json
    htmlHash: sha256:6e1cb3c3424a88dbfb035b60b66b6bdfce8cc36e0bbeadf8fca0bf45d2ab3b67
    confirmationPhrase: "确认以上范围进入下一阶段\nsourceDocumentHash=sha256:405e440bedbb7498774f4200d9ebb377bad782d64c0d87dc2e565e1f722a14ad\nimplementationConfirmationHash=sha256:f150f22376bc2aa942a030fe8c7b3e91361f27f0d9255824b92648015b0087c8\nconfirmationPageHash=sha256:6e1cb3c3424a88dbfb035b60b66b6bdfce8cc36e0bbeadf8fca0bf45d2ab3b67\r\n"
  applicability:
    governanceEvents:
      applies: true
      reasonCode: controlled_record_closed_event_required_for_closeout_integrity
    runtimeRecovery:
      applies: false
      reasonCode: no_runtime_resume_or_recovery_runtime_changes
      requiresFunctionalResumeFailureCaseRegistry: false
      activeRequirementResolutionRequired: false
      retiredContextSurfaceForbidden: true
    scoringDashboardSft:
      applies: false
      reasonCode: no_scoring_dashboard_sft_dataset_or_read_model_changes
    currentTargetMap:
      applies: true
      reasonCode: requirements_contract_docs_must_expose_current_target_map
    aiTddContractGate:
      applies: true
      reasonCode: requirements_contract_docs_must_use_ai_tdd_contract_execution_manifest
    scriptsAndHooks:
      applies: true
      reasonCode: new_authoring_scale_assessment_checkpoint_runner_and_stage_specific_reverse_audit_scripts
  targetModificationPaths:
    - id: TARGET-MOD-001
      path: _bmad/skills/requirements-contract-authoring/scripts/assess_contract_authoring_scale.js
      changeType: add
      intent: Add read-only scale assessment before large source-document authoring.
      ownerModel: requirements_contract_authoring
      requirementRefs:
        - MUST-001
        - MUST-018
      traceRefs:
        - TRACE-001
        - TRACE-018
      evidenceRefs:
        - EVD-001
        - EVD-018
      artifactRefs:
        - ART-001
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-002
      path: _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js
      changeType: add_or_modify
      intent: Automate checkpoint planning, run/resume, per-checkpoint commit receipts, and pre-render global consistency.
      ownerModel: requirements_contract_authoring
      requirementRefs:
        - MUST-002
        - MUST-003
        - MUST-004
        - MUST-007
        - MUST-019
        - MUST-020
      traceRefs:
        - TRACE-002
        - TRACE-003
        - TRACE-004
        - TRACE-007
        - TRACE-019
        - TRACE-020
      evidenceRefs:
        - EVD-002
        - EVD-003
        - EVD-004
        - EVD-007
        - EVD-019
        - EVD-020
      artifactRefs:
        - ART-002
        - ART-003
        - ART-004
        - ART-007
        - ART-019
        - ART-020
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-003
      path: _bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown.js
      changeType: add_or_modify
      intent: Run deterministic pre-render definition drilldown before HTML confirmation.
      ownerModel: requirements_contract_authoring
      requirementRefs:
        - MUST-005
        - MUST-007
      traceRefs:
        - TRACE-005
        - TRACE-007
      evidenceRefs:
        - EVD-005
        - EVD-007
      artifactRefs:
        - ART-005
        - ART-007
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-004
      path: _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts
      changeType: modify
      intent: Render current/target comparison and target modification paths as confirmation-page hard surfaces.
      ownerModel: requirements_contract_authoring
      requirementRefs:
        - MUST-010
        - MUST-023
        - MUST-024
      traceRefs:
        - TRACE-010
        - TRACE-023
        - TRACE-024
      evidenceRefs:
        - EVD-010
        - EVD-023
        - EVD-024
      artifactRefs:
        - ART-010
        - ART-023
        - ART-024
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-005
      path: tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      changeType: add_or_modify
      intent: Cover scale routing, checkpoint ordering, commit gates, global consistency, and semantic-kernel-first flows.
      ownerModel: verification
      requirementRefs:
        - MUST-001
        - MUST-002
        - MUST-003
        - MUST-004
        - MUST-007
        - MUST-018
        - MUST-019
        - MUST-020
      traceRefs:
        - TRACE-001
        - TRACE-002
        - TRACE-003
        - TRACE-004
        - TRACE-007
        - TRACE-018
        - TRACE-019
        - TRACE-020
      evidenceRefs:
        - EVD-001
        - EVD-002
        - EVD-003
        - EVD-004
        - EVD-007
        - EVD-018
        - EVD-019
        - EVD-020
      artifactRefs:
        - ART-001
        - ART-002
        - ART-003
        - ART-004
        - ART-007
        - ART-018
        - ART-019
        - ART-020
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-006
      path: tests/acceptance/render-requirements-confirmation-html.test.ts
      changeType: modify
      intent: Prevent confirmable pages that hide current/target comparison or target modification paths.
      ownerModel: verification
      requirementRefs:
        - MUST-010
        - MUST-023
        - MUST-024
      traceRefs:
        - TRACE-010
        - TRACE-023
        - TRACE-024
      evidenceRefs:
        - EVD-010
        - EVD-023
        - EVD-024
      artifactRefs:
        - ART-010
        - ART-023
        - ART-024
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-007
      path: docs/requirements/2026-05-25-requirements-contract-checkpoint-automation.md
      changeType: modify
      intent: Keep the source document, implementationConfirmation, current/target map, and target modification paths aligned.
      ownerModel: requirements_contract_authoring
      requirementRefs:
        - MUST-009
        - MUST-010
        - MUST-018
        - MUST-020
        - MUST-021
        - MUST-022
        - MUST-023
        - MUST-024
      traceRefs:
        - TRACE-009
        - TRACE-010
        - TRACE-018
        - TRACE-020
        - TRACE-021
        - TRACE-022
        - TRACE-023
        - TRACE-024
      evidenceRefs:
        - EVD-009
        - EVD-010
        - EVD-018
        - EVD-020
        - EVD-021
        - EVD-022
        - EVD-023
        - EVD-024
      artifactRefs:
        - ART-009
        - ART-010
        - ART-018
        - ART-020
        - ART-021
        - ART-022
        - ART-023
        - ART-024
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-008
      path: _bmad/skills/requirements-contract-authoring/scripts/audit_contract_confirmability.js
      changeType: add
      intent: >-
        Add the single-responsibility contract confirmability audit CLI for render report, hash, blocking issue, and
        confirmation phrase checks.
      ownerModel: contract_confirmability_audit
      requirementRefs:
        - MUST-021
      traceRefs:
        - TRACE-021
      evidenceRefs:
        - EVD-021
      artifactRefs:
        - ART-021
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-009
      path: _bmad/skills/requirements-contract-authoring/scripts/audit_implementation_readiness.js
      changeType: add
      intent: Add the single-responsibility implementation readiness audit CLI with notValidForCloseout semantics.
      ownerModel: implementation_readiness_audit
      requirementRefs:
        - MUST-021
      traceRefs:
        - TRACE-021
      evidenceRefs:
        - EVD-021
      artifactRefs:
        - ART-021
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-010
      path: _bmad/skills/requirements-contract-authoring/scripts/audit_delivery_verification.js
      changeType: add
      intent: >-
        Add the delivery verification audit CLI that validates deliveryReadiness, current-pass trace closure, command
        targets, canonical surfaces, and legacy substitution denial.
      ownerModel: delivery_verification_audit
      requirementRefs:
        - MUST-011
        - MUST-012
        - MUST-013
        - MUST-014
        - MUST-015
        - MUST-017
        - MUST-021
        - MUST-023
      traceRefs:
        - TRACE-011
        - TRACE-012
        - TRACE-013
        - TRACE-014
        - TRACE-015
        - TRACE-017
        - TRACE-021
        - TRACE-023
      evidenceRefs:
        - EVD-011
        - EVD-012
        - EVD-013
        - EVD-014
        - EVD-015
        - EVD-017
        - EVD-021
        - EVD-023
      artifactRefs:
        - ART-011
        - ART-012
        - ART-013
        - ART-014
        - ART-015
        - ART-017
        - ART-021
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-011
      path: _bmad/skills/requirements-contract-authoring/scripts/audit_closeout_integrity.js
      changeType: add
      intent: >-
        Add the closeout integrity audit CLI that accepts only current delivery_verification=verified and controls
        record_closed authorization.
      ownerModel: closeout_integrity_gate
      requirementRefs:
        - MUST-016
        - MUST-017
        - MUST-021
        - MUST-023
      traceRefs:
        - TRACE-016
        - TRACE-017
        - TRACE-021
        - TRACE-023
      evidenceRefs:
        - EVD-016
        - EVD-017
        - EVD-021
        - EVD-023
      artifactRefs:
        - ART-016
        - ART-017
        - ART-021
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-012
      path: _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js
      changeType: modify
      intent: >-
        Convert the legacy reverse audit entry into a compatibility wrapper with deprecatedGenericPass and
        notValidForCloseout metadata.
      ownerModel: reverse_audit_compatibility_wrapper
      requirementRefs:
        - MUST-022
        - MUST-023
      traceRefs:
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-022
        - EVD-023
      artifactRefs:
        - ART-022
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-013
      path: _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_stage_common.js
      changeType: add
      intent: Share parsing and issue helpers without sharing stage verdict authority or generic PASS semantics.
      ownerModel: reverse_audit_stage_boundary_gate
      requirementRefs:
        - MUST-021
        - MUST-022
        - MUST-023
      traceRefs:
        - TRACE-021
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-021
        - EVD-022
        - EVD-023
      artifactRefs:
        - ART-021
        - ART-022
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-014
      path: _bmad/skills/requirements-contract-authoring/references/reverse-audit-gate.md
      changeType: modify
      intent: >-
        Document stage-specific reverse audit responsibilities, verdict vocabularies, exit semantics, and wrapper
        deprecation rules.
      ownerModel: requirements_contract_authoring
      requirementRefs:
        - MUST-021
        - MUST-022
        - MUST-023
      traceRefs:
        - TRACE-021
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-021
        - EVD-022
        - EVD-023
      artifactRefs:
        - ART-021
        - ART-022
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-015
      path: _bmad/skills/requirements-contract-authoring/SKILL.md
      changeType: modify
      intent: >-
        Make the skill invoke stage-specific audit CLIs instead of treating reverse_audit_contract.js as one global
        authority.
      ownerModel: requirements_contract_authoring
      requirementRefs:
        - MUST-021
        - MUST-022
        - MUST-023
      traceRefs:
        - TRACE-021
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-021
        - EVD-022
        - EVD-023
      artifactRefs:
        - ART-021
        - ART-022
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-016
      path: tests/acceptance/reverse-audit-contract.test.ts
      changeType: modify
      intent: >-
        Add regression coverage for stage-specific audit CLI verdicts, wrapper deprecation metadata, and non-closeout
        semantics.
      ownerModel: verification
      requirementRefs:
        - MUST-021
        - MUST-022
        - MUST-023
      traceRefs:
        - TRACE-021
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-021
        - EVD-022
        - EVD-023
      artifactRefs:
        - ART-021
        - ART-022
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-017
      path: tests/acceptance/requirements-contract-authoring-skill-contract.test.ts
      changeType: modify
      intent: >-
        Assert the skill contract names stage-specific reverse audit commands and rejects global generic PASS closeout
        semantics.
      ownerModel: verification
      requirementRefs:
        - MUST-021
        - MUST-022
        - MUST-023
      traceRefs:
        - TRACE-021
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-021
        - EVD-022
        - EVD-023
      artifactRefs:
        - ART-021
        - ART-022
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-018
      path: scripts/main-agent-implementation-readiness-gate.ts
      changeType: modify
      intent: >-
        Consume implementation readiness audit output only for implementation readiness and mark it invalid for
        closeout.
      ownerModel: implementation_readiness_gate
      requirementRefs:
        - MUST-021
        - MUST-022
        - MUST-023
      traceRefs:
        - TRACE-021
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-021
        - EVD-022
        - EVD-023
      artifactRefs:
        - ART-021
        - ART-022
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-019
      path: scripts/main-agent-delivery-closeout-gate.ts
      changeType: modify
      intent: Require delivery verification and closeout integrity reports before allowing delivery closeout decisions.
      ownerModel: delivery_closeout_gate
      requirementRefs:
        - MUST-011
        - MUST-016
        - MUST-021
        - MUST-023
      traceRefs:
        - TRACE-011
        - TRACE-016
        - TRACE-021
        - TRACE-023
      evidenceRefs:
        - EVD-011
        - EVD-016
        - EVD-021
        - EVD-023
      artifactRefs:
        - ART-011
        - ART-016
        - ART-021
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-020
      path: scripts/strict-closeout-proof-gate.ts
      changeType: modify
      intent: Reject confirmability, readiness, wrapper PASS, self-certification, and non-current evidence as closeout proof.
      ownerModel: closeout_integrity_gate
      requirementRefs:
        - MUST-011
        - MUST-016
        - MUST-017
        - MUST-022
        - MUST-023
      traceRefs:
        - TRACE-011
        - TRACE-016
        - TRACE-017
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-011
        - EVD-016
        - EVD-017
        - EVD-022
        - EVD-023
      artifactRefs:
        - ART-011
        - ART-016
        - ART-017
        - ART-022
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-021
      path: scripts/requirement-record-control-store.ts
      changeType: modify
      intent: Restrict record_closed writes to closeout integrity after current delivery verification.
      ownerModel: requirement_record_control_store
      requirementRefs:
        - MUST-016
        - MUST-021
        - MUST-023
      traceRefs:
        - TRACE-016
        - TRACE-021
        - TRACE-023
      evidenceRefs:
        - EVD-016
        - EVD-021
        - EVD-023
      artifactRefs:
        - ART-016
        - ART-021
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-022
      path: _bmad/_schemas/requirement-record.schema.json
      changeType: modify
      intent: Add schema support for delivery verification, closeout integrity, and stage-specific audit event metadata.
      ownerModel: requirement_record_schema
      requirementRefs:
        - MUST-016
        - MUST-021
        - MUST-023
      traceRefs:
        - TRACE-016
        - TRACE-021
        - TRACE-023
      evidenceRefs:
        - EVD-016
        - EVD-021
        - EVD-023
      artifactRefs:
        - ART-016
        - ART-021
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-023
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-stage-cli-capability-report.json
      changeType: generate
      intent: Record stage CLI capability checks for confirmability, readiness, delivery verification, and closeout integrity.
      ownerModel: reverse_audit_stage_boundary_gate
      requirementRefs:
        - MUST-021
      traceRefs:
        - TRACE-021
      evidenceRefs:
        - EVD-021
      artifactRefs:
        - ART-021
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-024
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-wrapper-compatibility-report.json
      changeType: generate
      intent: Record wrapper deprecation and non-closeout compatibility evidence.
      ownerModel: reverse_audit_stage_boundary_gate
      requirementRefs:
        - MUST-022
      traceRefs:
        - TRACE-022
      evidenceRefs:
        - EVD-022
      artifactRefs:
        - ART-022
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-025
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/stage-boundary-regression-report.json
      changeType: generate
      intent: Record regression checks proving wrong-stage verdicts cannot satisfy delivery verification or closeout.
      ownerModel: delivery_verification_audit
      requirementRefs:
        - MUST-023
      traceRefs:
        - TRACE-023
      evidenceRefs:
        - EVD-023
      artifactRefs:
        - ART-023
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-026
      path: scripts/ai-tdd-contract-gate.ts
      changeType: modify
      intent: >-
        Add ContractExecutionManifest.errorCaseCoverage and fail-closed completeness checks for every FAIL-* and EDGE-*
        mapping.
      ownerModel: ai_tdd_contract_gate
      requirementRefs:
        - MUST-025
        - NEG-015
      traceRefs:
        - TRACE-025
      evidenceRefs:
        - EVD-025
      artifactRefs:
        - ART-025
      requiresReconfirmationOnChange: true
    - id: TARGET-MOD-027
      path: tests/acceptance/ai-tdd-contract-gate.test.ts
      changeType: modify
      intent: >-
        Add regression coverage proving missing FAIL/EDGE NEG, acceptance, and edge linkage mappings block AI-TDD
        contract completeness.
      ownerModel: verification
      requirementRefs:
        - MUST-025
        - NEG-015
      traceRefs:
        - TRACE-025
      evidenceRefs:
        - EVD-025
      artifactRefs:
        - ART-025
      requiresReconfirmationOnChange: true
  governanceEventTypeRegistryPolicy:
    controlFieldVocabulary:
      - closeoutState
      - requirementLifecycleState
      - recordClosedEvents
    payloadKindContracts:
      - payloadKind: controlled_closeout_record
        requiredFields:
          - eventType
          - decision
          - sourceDocumentHash
          - implementationConfirmationHash
          - deliverySealReportHash
          - closeoutReportHash
          - requirementRecordHash
          - closeoutAttemptId
          - verifiedTraceRowIds
          - commandRunRefs
          - evidenceArtifactHashes
          - writtenBy
          - writtenAt
        forbiddenFields:
          - genericPass
          - contractConfirmable
          - readyForImplementation
          - runtimePacketOnly
          - completionPacketOnly
        allowedControlWriteModes:
          - append_only_terminal_event
    controlWriteModePolicies:
      - allowedControlWriteMode: append_only_terminal_event
        allowedWritesControlFields:
          - closeoutState
          - requirementLifecycleState
          - recordClosedEvents
    eventSpecificRequirements:
      - eventType: record_closed
        payloadKind: controlled_closeout_record
        requiredSourceRefs: true
        requiredFields:
          - eventType
          - decision
          - sourceDocumentHash
          - implementationConfirmationHash
          - deliverySealReportHash
          - closeoutReportHash
          - requirementRecordHash
          - closeoutAttemptId
          - verifiedTraceRowIds
          - commandRunRefs
          - evidenceArtifactHashes
          - writtenBy
          - writtenAt
        forbiddenFields:
          - genericPass
          - contractConfirmable
          - readyForImplementation
          - runtimePacketOnly
          - completionPacketOnly
        allowedControlWriteMode: append_only_terminal_event
  governanceEventTypeRegistry:
    - eventType: record_closed
      ownerModel: closeout_integrity_gate
      payloadKind: controlled_closeout_record
      canAffectControlFlow: true
      description: >-
        Terminal closeout event written only after current delivery_verification=verified and
        closeout_integrity=accepted.
      writesControlFields:
        - closeoutState
        - requirementLifecycleState
        - recordClosedEvents
      payloadContract:
        requiredFields:
          - eventType
          - decision
          - sourceDocumentHash
          - implementationConfirmationHash
          - deliverySealReportHash
          - closeoutReportHash
          - requirementRecordHash
          - closeoutAttemptId
          - verifiedTraceRowIds
          - commandRunRefs
          - evidenceArtifactHashes
          - writtenBy
          - writtenAt
        forbiddenFields:
          - genericPass
          - contractConfirmable
          - readyForImplementation
          - runtimePacketOnly
          - completionPacketOnly
        requiredSourceRefs: true
        allowedControlWriteMode: append_only_terminal_event
  controlledIngestWriterRegistry:
    - writerId: closeout-integrity-record-closed-writer
      scriptPath: _bmad/skills/requirements-contract-authoring/scripts/audit_closeout_integrity.js
      scriptContentHash: PENDING_IMPLEMENTATION_HASH
      ownerModel: closeout_integrity_gate
      allowedWriteApis:
        - appendControlEventAndReplay
      allowedPaths:
        - _bmad-output/runtime/requirement-records/<requirementSetId>/requirement-record.json
        - _bmad-output/runtime/requirement-records/<requirementSetId>/events/closeout-events.jsonl
        - _bmad-output/runtime/requirement-records/<requirementSetId>/receipts/record-closed-<attemptId>.receipt.json
      allowedEventTypes:
        - record_closed
      payloadContractRefs:
        - record_closed
      writesControlFields:
        - closeoutState
        - requirementLifecycleState
        - recordClosedEvents
      receiptPath: _bmad-output/runtime/requirement-records/<requirementSetId>/receipts/record-closed-<attemptId>.receipt.json
      beforeAfterHashRequired: true
      canModifyWriterRegistry: false
      registryHash: PENDING_IMPLEMENTATION_HASH
      architectureConfirmationHash: PENDING_CONFIRMATION_HASH
  must:
    - id: MUST-001
      text: >-
        The authoring workflow runs a read-only scale assessment before requirements contract source generation and
        returns either single_pass or checkpoint_required.
      textZh: 编写流程必须在生成需求契约源文档前运行只读规模评估，并返回 single_pass 或 checkpoint_required。
      evidenceRefs:
        - EVD-001
      coveredByTraceRows:
        - TRACE-001
      coveredBySequenceViews:
        - SEQ-001
    - id: MUST-002
      text: >-
        When the assessment returns checkpoint_required, the workflow generates the source document through ordered
        semantic checkpoints instead of one full-document generation pass.
      textZh: 当评估返回 checkpoint_required 时，流程必须通过有序语义 checkpoints 生成源文档，而不是一次性完整文档生成。
      evidenceRefs:
        - EVD-002
      coveredByTraceRows:
        - TRACE-002
      coveredBySequenceViews:
        - SEQ-001
    - id: MUST-003
      text: >-
        Each completed checkpoint in checkpoint_required mode stages only the target requirements document and creates a
        single-file Git commit before the next checkpoint starts.
      textZh: checkpoint_required 模式下，每个完成的 checkpoint 只暂存目标需求文档，并在下一个 checkpoint 开始前创建单文件 Git commit。
      evidenceRefs:
        - EVD-003
      coveredByTraceRows:
        - TRACE-003
      coveredBySequenceViews:
        - SEQ-002
    - id: MUST-004
      text: >-
        The checkpoint runner writes a progress record containing checkpoint status, commit hash, document hash,
        validation status, blockers, and next checkpoint, with fail-closed write failure behavior, idempotent updates
        per checkpoint and commit hash, and recovery from the latest valid progress record.
      textZh: >-
        checkpoint runner 必须写入进度记录，包含 checkpoint 状态、commit hash、文档 hash、校验状态、blocker 和下一个 checkpoint；写入失败必须 fail
        closed，同一 checkpoint 与 commit hash 的更新必须幂等，并能从最新有效进度记录恢复。
      evidenceRefs:
        - EVD-004
      coveredByTraceRows:
        - TRACE-004
      coveredBySequenceViews:
        - SEQ-002
    - id: MUST-005
      text: >-
        Before HTML render, the workflow verifies checkpoint completion and runs deterministic definition drilldown with
        previous report, resolution ledger, changed-only filtering, and decision packet output.
      textZh: >-
        HTML render 前，流程必须校验 checkpoint 完成状态，并运行确定性的 definition drilldown，消费 previous report、解决记录、changed-only filtering
        和 decision packet 输出。
      evidenceRefs:
        - EVD-005
      coveredByTraceRows:
        - TRACE-005
      coveredBySequenceViews:
        - SEQ-003
    - id: MUST-006
      text: >-
        Final cleanup can remove generated requirements contract documents from Git index while preserving local files
        after the retention strategy is confirmed.
      textZh: 最终清理可以在保留本地文件的同时，从 Git index 移除生成的需求契约文档，但必须先确认保留策略。
      evidenceRefs:
        - EVD-006
      coveredByTraceRows:
        - TRACE-006
      coveredBySequenceViews:
        - SEQ-004
    - id: MUST-007
      text: >-
        After all pre-render checkpoints complete, the runner must execute a whole-document global consistency gate and
        may return pre_render_ready only when ID uniqueness, reciprocal MUST/NEG trace coverage, evidence references,
        command references, failure/edge/view references, and deterministic definition drilldown all pass.
      textZh: >-
        所有 pre-render checkpoints 完成后，runner 必须执行整篇文档 global consistency gate；只有 ID 唯一性、MUST/NEG 双向 trace 覆盖、evidence
        引用、command 引用、failure/edge/view 引用和 deterministic definition drilldown 全部通过时，才可返回 pre_render_ready。
      evidenceRefs:
        - EVD-007
      coveredByTraceRows:
        - TRACE-007
      coveredBySequenceViews:
        - SEQ-003
    - id: MUST-008
      text: >-
        Reverse audit outputs must be stage-specific and must not expose a generic PASS that can be reused across
        contract authoring, confirmability, implementation readiness, delivery verification, and closeout stages.
      textZh: >-
        Reverse audit 输出必须按阶段区分，不得暴露可在 contract authoring、confirmability、implementation readiness、delivery verification
        和 closeout 阶段复用的 generic PASS。
      evidenceRefs:
        - EVD-008
      coveredByTraceRows:
        - TRACE-008
      coveredBySequenceViews:
        - SEQ-005
    - id: MUST-009
      text: >-
        Generated EVD/TRACE matrices must be authored to final product-grade standards with real gate commands,
        independent oracles, target control-flow assertions, state/file/event assertions, negative proof expectations,
        artifact links, and current-attempt binding requirements.
      textZh: >-
        生成的 EVD/TRACE 矩阵必须按最终产品级标准编写，包含真实 gate commands、独立 oracle、目标控制流断言、状态/文件/事件断言、负向证明预期、artifact links 和
        current-attempt 绑定要求。
      evidenceRefs:
        - EVD-009
      coveredByTraceRows:
        - TRACE-009
      coveredBySequenceViews:
        - SEQ-005
    - id: MUST-010
      text: >-
        When current/target comparison applies, the source document must map current and target canonical fields,
        schemas, reducers, writer registries, events, scripts, tests, evidence artifacts, user-visible behavior, and
        legacy surfaces that must not remain authoritative; when applicability.currentTargetMap.applies=true, the
        confirmation page must be blocked unless requiredViewPacks includes currentTargetMap, displayProfile is
        closed_loop_current_target_map, and currentTargetCoverage meets the first-class confirmation thresholds.
      textZh: >-
        当现状/目标态对比适用时，源文档必须映射 current 与 target 的 canonical fields、schemas、reducers、writer
        registries、events、scripts、tests、evidence artifacts、用户可见行为以及不得继续作为权威的 legacy surfaces；当
        applicability.currentTargetMap.applies=true 时，确认页必须阻断，除非 requiredViewPacks 包含 currentTargetMap、displayProfile 为
        closed_loop_current_target_map，且 currentTargetCoverage 达到一级确认门槛。
      evidenceRefs:
        - EVD-010
      coveredByTraceRows:
        - TRACE-010
      coveredBySequenceViews:
        - SEQ-006
    - id: MUST-011
      text: >-
        Delivery verification audit and closeout integrity gate must fail closed unless current implementation evidence
        proves deliveryReadiness.ready=true, every trace row is current_pass, missingEvidenceCount is zero, required
        test/script files exist, and tests exercise the target control flow declared by the confirmed contract.
      textZh: >-
        交付核验 audit 和 closeout integrity gate 必须 fail closed，除非当前实现证据证明 deliveryReadiness.ready=true、每个 trace row 都是
        current_pass、missingEvidenceCount 为零、必需测试/脚本文件存在，且测试覆盖确认契约声明的目标控制流。
      evidenceRefs:
        - EVD-011
      coveredByTraceRows:
        - TRACE-011
      coveredBySequenceViews:
        - SEQ-006
    - id: MUST-012
      text: >-
        Before any required command output or exit code can count as evidence, a command target collection gate must
        verify explicitly named test files, script files, config files, evidence inputs, and runner-collected test
        manifests for the current command run.
      textZh: >-
        任何 required command 的输出或 exit code 能成为证据前，command target collection gate 必须校验当前命令运行中显式点名的测试文件、脚本文件、配置文件、证据输入和
        runner 实际收集到的测试清单。
      evidenceRefs:
        - EVD-012
      coveredByTraceRows:
        - TRACE-012
      coveredBySequenceViews:
        - SEQ-007
    - id: MUST-013
      text: >-
        Every trace row that can become current_pass must declare and pass closure assertions for target schema fields,
        reducer behavior, writer registry ownership, event types, state transitions, target test files, artifacts,
        negative legacy behavior, and current-attempt binding.
      textZh: >-
        每个可变为 current_pass 的 trace row 都必须声明并通过目标 schema 字段、reducer 行为、writer registry ownership、event types、state
        transitions、目标测试文件、artifacts、负向 legacy 行为和 current-attempt 绑定的 closure assertions。
      evidenceRefs:
        - EVD-013
      coveredByTraceRows:
        - TRACE-013
      coveredBySequenceViews:
        - SEQ-007
    - id: MUST-014
      text: >-
        Delivery verification must reconcile confirmed target canonical surfaces against actual schema, reducer, writer
        registry, event, test, artifact, and state-transition implementation surfaces before verifying delivery.
      textZh: >-
        交付核验通过前，必须把已确认的目标 canonical surfaces 与实际 schema、reducer、writer registry、event、test、artifact 和 state-transition
        实现面逐项对账。
      evidenceRefs:
        - EVD-014
      coveredByTraceRows:
        - TRACE-014
      coveredBySequenceViews:
        - SEQ-008
    - id: MUST-015
      text: >-
        Legacy events, fields, reducers, old gate checks, old closeout branches, and diagnostic-only checks must be
        rejected as substitutes for target canonical control flow unless the confirmed currentTargetMap explicitly
        declares and verifies that migration.
      textZh: >-
        除非已确认的 currentTargetMap 明确声明并验证迁移，否则 legacy events、fields、reducers、old gate checks、old closeout branches 和
        diagnostic-only checks 必须被拒绝作为目标 canonical control flow 的替代品。
      evidenceRefs:
        - EVD-015
      coveredByTraceRows:
        - TRACE-015
      coveredBySequenceViews:
        - SEQ-008
    - id: MUST-016
      text: >-
        The record_closed event must be written only by closeout integrity after current delivery_verification=verified,
        and its payload must bind source hash, implementationConfirmation hash, delivery verification report hash,
        closeout report hash, requirement record hash, attempt id, verified trace row ids, command run refs, and
        evidence artifact hashes.
      textZh: >-
        record_closed 事件只能由 closeout integrity 在当前 delivery_verification=verified 之后写入，且 payload 必须绑定 source
        hash、implementationConfirmation hash、delivery verification report hash、closeout report hash、requirement record
        hash、attempt id、verified trace row ids、command run refs 和 evidence artifact hashes。
      evidenceRefs:
        - EVD-016
      coveredByTraceRows:
        - TRACE-016
      coveredBySequenceViews:
        - SEQ-009
    - id: MUST-017
      text: >-
        Evidence must move through planned, observed, assertion_validated, and delivery_verified trust states, and
        closeout may consume only delivery_verified evidence bound to the current confirmed contract and closeout
        attempt.
      textZh: >-
        Evidence 必须经过 planned、observed、assertion_validated、delivery_verified 信任状态流转，closeout 只能消费绑定到当前已确认契约和 closeout
        attempt 的 delivery_verified evidence。
      evidenceRefs:
        - EVD-017
      coveredByTraceRows:
        - TRACE-017
      coveredBySequenceViews:
        - SEQ-009
    - id: MUST-018
      text: >-
        Large-document authoring must create a compact semantic-kernel.json through one global semantic pass before
        checkpoint materialization starts, and scale assessment must route documents to single_pass,
        kernel_then_checkpoint, or kernel_then_checkpoint_with_amendment.
      textZh: >-
        大文档编写必须在 checkpoint materialization 开始前，通过一次全局语义 pass 创建紧凑的 semantic-kernel.json；scale assessment 必须把文档路由到
        single_pass、kernel_then_checkpoint 或 kernel_then_checkpoint_with_amendment。
      evidenceRefs:
        - EVD-018
      coveredByTraceRows:
        - TRACE-018
      coveredBySequenceViews:
        - SEQ-010
    - id: MUST-019
      text: >-
        The semantic kernel must pass completeness audit and ID registry freeze before checkpoints materialize long-form
        source content, and each checkpoint must pass fail-closed, idempotent kernel drift checks with source hash
        assertions before it can be considered complete.
      textZh: >-
        semantic kernel 必须先通过 completeness audit 和 ID registry freeze，checkpoints 才能物化长篇源内容；每个 checkpoint 必须通过带 source
        hash assertions 的 fail-closed、幂等 kernel drift checks，才能视为完成。
      evidenceRefs:
        - EVD-019
      coveredByTraceRows:
        - TRACE-019
      coveredBySequenceViews:
        - SEQ-010
    - id: MUST-020
      text: >-
        Before HTML render, full-contract reconciliation must prove the source document is a complete, non-drifting
        materialization of the semantic kernel, and any core requirement change discovered during checkpointing must go
        through kernel amendment and impacted checkpoint re-materialization.
      textZh: >-
        HTML render 前，full-contract reconciliation 必须证明源文档是 semantic kernel 的完整且无漂移物化结果；checkpointing 过程中发现的任何核心需求变化都必须走
        kernel amendment 和受影响 checkpoint re-materialization。
      evidenceRefs:
        - EVD-020
      coveredByTraceRows:
        - TRACE-020
      coveredBySequenceViews:
        - SEQ-011
    - id: MUST-021
      text: >-
        Reverse audit must expose single-responsibility CLI entry points for contract confirmability, implementation
        readiness, delivery verification, and closeout integrity, with each CLI owning only its stage-specific verdict,
        allowed next actions, blocked next actions, and exit semantics.
      textZh: >-
        Reverse audit 必须提供 contract confirmability、implementation readiness、delivery verification 和 closeout integrity
        的单一职责 CLI 入口；每个 CLI 只拥有本阶段的 verdict、allowed next actions、blocked next actions 和 exit semantics。
      evidenceRefs:
        - EVD-021
      coveredByTraceRows:
        - TRACE-021
      coveredBySequenceViews:
        - SEQ-012
    - id: MUST-022
      text: >-
        The legacy reverse_audit_contract.js entry may remain only as a compatibility wrapper that delegates to
        stage-specific CLIs, marks generic PASS as deprecated, and marks all non-delivery-verification outputs as
        notValidForCloseout.
      textZh: >-
        legacy reverse_audit_contract.js 入口只能作为兼容 wrapper 保留，必须委托给阶段专属 CLI，标记 generic PASS 已废弃，并把所有非
        delivery-verification 输出标记为 notValidForCloseout。
      evidenceRefs:
        - EVD-022
      coveredByTraceRows:
        - TRACE-022
      coveredBySequenceViews:
        - SEQ-012
    - id: MUST-023
      text: >-
        Stage-boundary regression tests must prove contract_confirmable, ready_for_implementation, generic PASS,
        deliveryReadiness=false, missing command targets, incomplete trace closure, missing evidence, legacy
        substitution, and completion packet self-certification cannot satisfy delivery verification or closeout.
      textZh: >-
        阶段边界回归测试必须证明 contract_confirmable、ready_for_implementation、generic PASS、deliveryReadiness=false、missing command
        targets、incomplete trace closure、missing evidence、legacy substitution 和 completion packet self-certification
        都不能满足 delivery verification 或 closeout。
      evidenceRefs:
        - EVD-023
      coveredByTraceRows:
        - TRACE-023
      coveredBySequenceViews:
        - SEQ-013
    - id: MUST-024
      text: >-
        Confirmation HTML must render targetModificationPaths as a first-class target modification path section, and
        confirmability must be blocked when explicit targetModificationPaths are missing for scripts, hooks, governance,
        current/target, runtime recovery, or implementation artifact changes.
      textZh: >-
        确认页 HTML 必须把 targetModificationPaths 渲染为一级目标修改路径清单；当 scripts、hooks、governance、current/target、runtime recovery 或
        implementation artifacts 涉及修改但缺少显式 targetModificationPaths 时，confirmability 必须阻断。
      evidenceRefs:
        - EVD-024
      coveredByTraceRows:
        - TRACE-024
      coveredBySequenceViews:
        - SEQ-014
    - id: MUST-025
      text: >-
        AI-TDD ContractExecutionManifest must expose errorCaseCoverage as a first-class manifest field, and every FAIL-*
        / EDGE-* must have explicit NEG, EVD, TRACE, ACC or E2E, and view coverage before implementation readiness or
        closeout gates can pass.
      textZh: >-
        AI-TDD ContractExecutionManifest 必须把 errorCaseCoverage 作为一级 manifest 字段输出；每个 FAIL-* / EDGE-* 在 implementation
        readiness 或 closeout gates 通过前，都必须有显式 NEG、EVD、TRACE、ACC 或 E2E 以及 view 覆盖。
      evidenceRefs:
        - EVD-025
      coveredByTraceRows:
        - TRACE-025
      coveredBySequenceViews:
        - SEQ-015
  notDone:
    - id: NEG-001
      text: >-
        The workflow must not proceed to HTML render while required checkpoints are incomplete or while unresolved
        pre-render definition blockers remain.
      textZh: 当 required checkpoints 未完成或 pre-render definition blockers 尚未解决时，流程不得进入 HTML render。
      evidenceRefs:
        - EVD-005
      whyItBlocksCompletion: >-
        Rendering before source structure and semantic blockers are resolved recreates the timeout and repeated repair
        loop.
      whyItBlocksCompletionZh: 在源结构和语义 blocker 解决前渲染，会重新制造超时和反复修补循环。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-001
    - id: NEG-002
      text: >-
        The checkpoint runner must not create a checkpoint commit if the staged set contains any file other than the
        active target requirements document.
      textZh: 如果 staged set 包含 active target requirements document 之外的任何文件，checkpoint runner 不得创建 checkpoint commit。
      evidenceRefs:
        - EVD-003
      whyItBlocksCompletion: Checkpoint commits are recovery points and must not capture unrelated work.
      whyItBlocksCompletionZh: Checkpoint commits 是恢复点，不能捕获无关工作。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-002
    - id: NEG-003
      text: >-
        The workflow must not silently overwrite manual edits when the current document hash differs from the latest
        checkpoint progress record; it must fail closed, preserve the current file, and require an explicit recovery
        decision.
      textZh: 当当前文档 hash 与最新 checkpoint progress record 不一致时，流程不得静默覆盖手工修改；必须 fail closed，保留当前文件，并要求明确恢复决策。
      evidenceRefs:
        - EVD-004
      whyItBlocksCompletion: Silent overwrite can lose user changes made after the last checkpoint.
      whyItBlocksCompletionZh: 静默覆盖会丢失最后一个 checkpoint 之后的用户修改。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-003
    - id: NEG-004
      text: >-
        The runner must not treat completion of checkpoint logs, checkpoint count, or trace row count as proof of global
        trace/evidence consistency.
      textZh: runner 不得把 checkpoint 日志完成、checkpoint 数量或 trace row 数量当成全局 trace/evidence 一致性的证明。
      evidenceRefs:
        - EVD-007
      whyItBlocksCompletion: >-
        Checkpoint splitting can otherwise produce false positive acceptance for documents whose traceRows reference
        missing evidence or undefined commands.
      whyItBlocksCompletionZh: 否则 checkpoint 切分会让 traceRows 引用缺失 evidence 或未定义 commands 的文档产生假阳性验收。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-004
    - id: NEG-005
      text: >-
        The workflow must not use contract confirmability, implementation readiness, or any generic PASS as delivery
        verification or closeout approval.
      textZh: >-
        流程不得把 contract confirmability、implementation readiness 或任何 generic PASS 当作 delivery verification 或 closeout
        approval。
      evidenceRefs:
        - EVD-008
        - EVD-011
      whyItBlocksCompletion: Stage confusion can turn a scope-confirmation pass into false delivery acceptance.
      whyItBlocksCompletionZh: 阶段混淆会把范围确认通过误转成虚假的交付验收。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-005
    - id: NEG-006
      text: The workflow must not treat planned EVD/TRACE proof as executed current_pass evidence.
      textZh: 流程不得把 planned EVD/TRACE proof 当作已经执行的 current_pass evidence。
      evidenceRefs:
        - EVD-009
        - EVD-011
      whyItBlocksCompletion: >-
        Planned proof describes future acceptance shape; only delivery verification audit may mark evidence as
        current_pass.
      whyItBlocksCompletionZh: Planned proof 只描述未来验收形状；只有 delivery verification audit 可以把 evidence 标记为 current_pass。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-006
    - id: NEG-007
      text: >-
        The workflow must not treat exitCode=0 as evidence when any named command target is missing, uncollected,
        expanded from an empty glob, or unbound to the current command run.
      textZh: 当任何点名的 command target 缺失、未被收集、从空 glob 展开或未绑定到当前 command run 时，流程不得把 exitCode=0 当成证据。
      evidenceRefs:
        - EVD-012
      whyItBlocksCompletion: Successful process exit can hide missing test files and unrelated test execution.
      whyItBlocksCompletionZh: 进程成功退出可能掩盖缺失测试文件和无关测试执行。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-007
    - id: NEG-008
      text: >-
        The workflow must not let runtime packets, completion packets, summary files, or implementation-authored reports
        close trace rows without independent target-state assertion verification.
      textZh: >-
        流程不得让 runtime packets、completion packets、summary files 或 implementation-authored reports 在没有独立 target-state
        assertion verification 的情况下关闭 trace rows。
      evidenceRefs:
        - EVD-013
      whyItBlocksCompletion: Implementation self-certification can close traces without proving target behavior.
      whyItBlocksCompletionZh: 实现自证可能在未证明目标行为的情况下关闭 traces。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-008
    - id: NEG-009
      text: >-
        The workflow must not let legacy control flow, legacy events, legacy fields, or old closeout branches satisfy
        target canonical assertions.
      textZh: 流程不得让 legacy control flow、legacy events、legacy fields 或 old closeout branches 满足 target canonical assertions。
      evidenceRefs:
        - EVD-015
      whyItBlocksCompletion: Legacy substitution can make old behavior appear to satisfy the new confirmed contract.
      whyItBlocksCompletionZh: Legacy substitution 会让旧行为看起来满足新的已确认契约。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-009
    - id: NEG-010
      text: >-
        The workflow must not write record_closed from implementation runners, tests, summary writers, completion packet
        writers, or delivery evidence writers.
      textZh: >-
        流程不得由 implementation runners、tests、summary writers、completion packet writers 或 delivery evidence writers 写入
        record_closed。
      evidenceRefs:
        - EVD-016
      whyItBlocksCompletion: record_closed is a terminal state transition and must be controlled by closeout integrity only.
      whyItBlocksCompletionZh: record_closed 是终态转换，只能由 closeout integrity 控制。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-010
    - id: NEG-011
      text: >-
        Checkpoint materialization must not introduce core requirements, IDs, completion semantics, or delivery/closeout
        applicability that are absent from the frozen semantic kernel.
      textZh: Checkpoint materialization 不得引入 frozen semantic kernel 中不存在的核心需求、ID、完成语义或 delivery/closeout 适用性。
      evidenceRefs:
        - EVD-019
        - EVD-020
      whyItBlocksCompletion: Checkpoint-local reasoning recreates the fragmented authoring failure mode.
      whyItBlocksCompletionZh: Checkpoint-local reasoning 会重现碎片化编写失败模式。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-011
    - id: NEG-012
      text: >-
        The workflow must not directly patch long-form prose to change core requirements after kernel freeze; it must
        use kernel amendment, re-audit, impacted checkpoint re-materialization, and reconciliation.
      textZh: >-
        kernel freeze 之后，流程不得直接 patch 长篇正文来改变核心需求；必须使用 kernel amendment、re-audit、impacted checkpoint re-materialization
        和 reconciliation。
      evidenceRefs:
        - EVD-020
      whyItBlocksCompletion: Direct prose patches can bypass ID freeze, drift checks, and global semantic reconciliation.
      whyItBlocksCompletionZh: 直接 prose patches 会绕过 ID freeze、drift checks 和全局语义 reconciliation。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-012
    - id: NEG-013
      text: >-
        The workflow must not use one global reverse audit CLI verdict as evidence across confirmability, readiness,
        delivery verification, and closeout stages.
      textZh: 流程不得把一个 global reverse audit CLI verdict 跨 confirmability、readiness、delivery verification 和 closeout 阶段复用为证据。
      evidenceRefs:
        - EVD-021
        - EVD-023
      whyItBlocksCompletion: Cross-stage verdict reuse is the root cause of false positive closeout.
      whyItBlocksCompletionZh: 跨阶段 verdict 复用是假阳性 closeout 的根因。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-013
    - id: NEG-014
      text: >-
        The workflow must not let legacy reverse_audit_contract.js PASS, contract_confirmable, or
        ready_for_implementation satisfy delivery verification or closeout.
      textZh: >-
        流程不得让 legacy reverse_audit_contract.js PASS、contract_confirmable 或 ready_for_implementation 满足 delivery
        verification 或 closeout。
      evidenceRefs:
        - EVD-022
        - EVD-023
      whyItBlocksCompletion: >-
        Legacy compatibility output must remain non-closeout evidence unless it delegates to delivery verification and
        receives verified.
      whyItBlocksCompletionZh: Legacy compatibility output 必须保持为非 closeout 证据，除非它委托交付核验并收到 verified。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-014
    - id: NEG-015
      text: >-
        The workflow must not treat generic requirement coverage, a single broad ACC row, or implementation-authored
        closeout proof as sufficient coverage for FAIL-* and EDGE-* error cases.
      textZh: >-
        流程不得把泛化 requirement coverage、单个宽泛 ACC 行或 implementation-authored closeout proof 当作 FAIL-* 和 EDGE-* error cases
        的充分覆盖。
      evidenceRefs:
        - EVD-025
      whyItBlocksCompletion: Error-case coverage hidden inside generic rows recreates false-positive readiness and closeout.
      whyItBlocksCompletionZh: error-case coverage 藏在泛化行里会重新制造假阳性 readiness 和 closeout。
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-016
  mustNot:
    - id: OUT-001
      text: This requirement does not authorize setting implementationConfirmation.status to user_confirmed.
      textZh: 本需求不授权把 implementationConfirmation.status 设置为 user_confirmed。
      scopeBoundary: User confirmation remains a separate explicit chat confirmation and controlled ingest step.
      scopeBoundaryZh: 用户确认仍然是单独的显式 chat confirmation 和 controlled ingest 步骤。
      userApprovalRequiredIfChanged: true
    - id: OUT-002
      text: This requirement does not replace the read-only HTML renderer with an authoring orchestrator.
      textZh: 本需求不允许用 authoring orchestrator 替代只读 HTML renderer。
      scopeBoundary: Renderer remains a projection layer and must not own checkpoint execution.
      scopeBoundaryZh: Renderer 仍然只是 projection layer，不得拥有 checkpoint execution。
      userApprovalRequiredIfChanged: true
    - id: OUT-003
      text: This requirement does not allow checkpoint commits to include unrelated files.
      textZh: 本需求不允许 checkpoint commits 包含无关文件。
      scopeBoundary: Checkpoint commits are limited to the target requirements source document.
      scopeBoundaryZh: Checkpoint commits 仅限目标 requirements source document。
      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: Scale assessment returns deterministic routing output for small and large fixture documents.
      textZh: Scale assessment 对小型和大型 fixture documents 返回确定性路由输出。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Small fixtures return single_pass; large or interrupted fixtures return checkpoint_required with explicit
        signals.
      oracleZh: 小型 fixtures 返回 single_pass；大型或已中断 fixtures 返回 checkpoint_required，并带有明确信号。
      requiredCommandRefs:
        - CMD-TEST-001
      artifactRefs:
        - ART-001
      acceptanceType: acceptance_unit
    - id: EVD-002
      text: Checkpoint plan lists semantic checkpoints in the required order.
      textZh: Checkpoint plan 按要求顺序列出 semantic checkpoints。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: Plan mode emits ordered checkpoint IDs and allowed semantic sections without editing source files.
      oracleZh: Plan mode 输出有序 checkpoint IDs 和允许的 semantic sections，且不编辑源文件。
      requiredCommandRefs:
        - CMD-TEST-001
      artifactRefs:
        - ART-002
      acceptanceType: acceptance_unit
    - id: EVD-003
      text: Checkpoint commit gate rejects unrelated staged files and records the single-file commit hash.
      textZh: Checkpoint commit gate 拒绝无关 staged files，并记录 single-file commit hash。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: The runner stops before commit when staged files include any path other than the target source document.
      oracleZh: 当 staged files 包含目标源文档之外的任何路径时，runner 在 commit 前停止。
      requiredCommandRefs:
        - CMD-TEST-001
      artifactRefs:
        - ART-003
      acceptanceType: acceptance_unit
    - id: EVD-004
      text: Resume mode compares current document hash with progress record and latest checkpoint state.
      textZh: Resume mode 比较当前 document hash 与 progress record 及最新 checkpoint state。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: Matching hashes continue from next checkpoint; mismatched hashes produce a blocked resume report without edits.
      oracleZh: Hash 匹配时从下一个 checkpoint 继续；hash 不匹配时输出 blocked resume report，且不编辑文件。
      requiredCommandRefs:
        - CMD-TEST-001
      artifactRefs:
        - ART-004
      acceptanceType: acceptance_unit
    - id: EVD-005
      text: >-
        Pre-render gate blocks HTML render until checkpoint completion and definition drilldown blockers are resolved or
        converted.
      textZh: Pre-render gate 会阻断 HTML render，直到 checkpoint completion 和 definition drilldown blockers 被解决或转换。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: Incomplete checkpoints or unresolved definition blockers prevent render and emit a decision packet.
      oracleZh: 未完成 checkpoints 或未解决 definition blockers 会阻止 render，并输出 decision packet。
      requiredCommandRefs:
        - CMD-TEST-002
      artifactRefs:
        - ART-005
      acceptanceType: acceptance_e2e
    - id: EVD-006
      text: Final cleanup removes the generated requirements document from Git index without deleting the local file.
      textZh: Final cleanup 从 Git index 移除生成的 requirements document，但不删除本地文件。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: Cleanup planning reports git rm --cached behavior and requires retention confirmation before execution.
      oracleZh: Cleanup planning 报告 git rm --cached 行为，并在执行前要求 retention confirmation。
      requiredCommandRefs:
        - CMD-TEST-001
      artifactRefs:
        - ART-006
      acceptanceType: acceptance_unit
    - id: EVD-007
      text: Global consistency gate blocks false-positive pre_render_ready results after checkpoint splitting.
      textZh: Global consistency gate 在 checkpoint splitting 之后阻断 false-positive pre_render_ready 结果。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        A fixture with eighteen trace rows referencing missing evidence fails pre-render-gate, while a complete
        reciprocal trace/evidence/command fixture passes and returns pre_render_ready only after the gate report is
        PASS.
      oracleZh: >-
        一个含十八个 trace rows 且引用缺失 evidence 的 fixture 必须 pre-render-gate 失败；完整双向 trace/evidence/command fixture 只有在 gate
        report 为 PASS 后才返回 pre_render_ready。
      requiredCommandRefs:
        - CMD-TEST-001
      artifactRefs:
        - ART-007
      acceptanceType: acceptance_e2e
    - id: EVD-008
      text: Reverse audit emits stage-specific decisions and marks contract confirmability results as invalid for closeout.
      textZh: Reverse audit 输出阶段专属 decisions，并把 contract confirmability results 标记为不能用于 closeout。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-authoring-skill-contract.test.ts
      oracle: >-
        Tests verify that confirmation-stage PASS is not accepted as closeout evidence and that deliveryReadiness=false
        is preserved as a later-stage blocker.
      oracleZh: 测试验证 confirmation-stage PASS 不会被接受为 closeout evidence，且 deliveryReadiness=false 会保留为后续阶段 blocker。
      requiredCommandRefs:
        - CMD-TEST-002
      artifactRefs:
        - ART-008
      acceptanceType: acceptance_e2e
    - id: EVD-009
      text: Contract authoring rejects low-standard EVD/TRACE matrices and preserves planned-vs-executed proof separation.
      textZh: Contract authoring 拒绝低标准 EVD/TRACE matrices，并保持 planned-vs-executed proof 分离。
      gate: >-
        npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
        tests/acceptance/reverse-audit-contract.test.ts
      oracle: >-
        Fixtures with smoke-only evidence, missing independent oracle, missing split command refs, or trace status
        pretending current_pass before delivery verification are blocked.
      oracleZh: >-
        包含 smoke-only evidence、缺失 independent oracle、缺失 split command refs，或在交付核验前伪装 current_pass trace status 的
        fixtures 必须被阻断。
      requiredCommandRefs:
        - CMD-TEST-002
      artifactRefs:
        - ART-009
      acceptanceType: acceptance_e2e
    - id: EVD-010
      text: >-
        Current/target map strictness covers canonical fields, schemas, reducers, writer registries, events, tests,
        scripts, evidence artifacts, behavior, legacy surface retirement, and HTML confirmation visibility when
        currentTargetMap.applies=true.
      textZh: >-
        Current/target map strictness 覆盖 canonical fields、schemas、reducers、writer
        registries、events、tests、scripts、evidence artifacts、behavior、legacy surface retirement，以及
        currentTargetMap.applies=true 时的 HTML confirmation visibility。
      gate: >-
        npx vitest run tests/acceptance/render-requirements-confirmation-html.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
        tests/acceptance/reverse-audit-contract.test.ts
      oracle: >-
        Fixtures missing current or target canonical mapping fail before implementation readiness; fixtures with
        currentTargetMap.applies=true but missing requiredViewPacks currentTargetMap, missing
        closed_loop_current_target_map displayProfile, or insufficient currentTargetCoverage fail before user
        confirmation.
      oracleZh: >-
        缺失 current 或 target canonical mapping 的 fixtures 在 implementation readiness 前失败；currentTargetMap.applies=true 但缺
        requiredViewPacks currentTargetMap、缺 closed_loop_current_target_map displayProfile 或 currentTargetCoverage 不足的
        fixtures 在用户确认前失败。
      requiredCommandRefs:
        - CMD-CURRENT-TARGET-001
      artifactRefs:
        - ART-010
      acceptanceType: acceptance_e2e
    - id: EVD-011
      text: >-
        Delivery verification and closeout integrity gates fail closed on not-ready delivery, incomplete trace closure,
        missing evidence, missing required tests, wrong control-flow coverage, stale hashes, or closeout attempt
        mismatch.
      textZh: >-
        交付核验和 closeout integrity gates 在 delivery not ready、trace closure incomplete、evidence missing、required tests
        missing、control-flow coverage wrong、hashes stale 或 closeout attempt mismatch 时 fail closed。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Delivery verification fixtures require deliveryReadiness.ready=true, currentPassTraceRows=totalTraceRows,
        missingEvidenceCount=0, existing command targets, canonical implementation matches, and current closeout attempt
        evidence.
      oracleZh: >-
        交付核验 fixtures 要求 deliveryReadiness.ready=true、currentPassTraceRows=totalTraceRows、missingEvidenceCount=0、command
        targets 存在、canonical implementation 匹配，以及当前 closeout attempt evidence。
      requiredCommandRefs:
        - CMD-TEST-002
      artifactRefs:
        - ART-011
      acceptanceType: acceptance_e2e
    - id: EVD-012
      text: >-
        Command target collection gate rejects missing files, empty globs, uncollected tests, and unbound command runs
        before exit code is accepted.
      textZh: >-
        Command target collection gate 在接受 exit code 前拒绝 missing files、empty globs、uncollected tests 和 unbound command
        runs。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures prove a mixed Vitest command with a missing explicit test file fails even if other tests would pass,
        and prove collected-target manifests are required for evidence binding.
      oracleZh: Fixtures 证明 mixed Vitest command 即使其他测试通过，只要显式测试文件缺失也会失败，并证明 evidence binding 前必须存在 collected-target manifest。
      requiredCommandRefs:
        - CMD-COMMAND-TARGET-001
      artifactRefs:
        - ART-012
      acceptanceType: acceptance_e2e
    - id: EVD-013
      text: >-
        Trace closure integrity gate rejects current_pass when closure assertions are absent, stale, smoke-only,
        self-certified, or matched to a different control flow.
      textZh: Trace closure integrity gate 会拒绝缺失、过期、smoke-only、自证或匹配到不同控制流的 closure assertions 所产生的 current_pass。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures require target schema, reducer, writer registry, event, state, test file, artifact, negative legacy,
        and current-attempt assertions before trace closure.
      oracleZh: >-
        Fixtures 要求 target schema、reducer、writer registry、event、state、test file、artifact、negative legacy 和
        current-attempt assertions 全部满足后才能 trace closure。
      requiredCommandRefs:
        - CMD-TRACE-CLOSURE-001
      artifactRefs:
        - ART-013
      acceptanceType: acceptance_e2e
    - id: EVD-014
      text: >-
        Canonical surface reconciliation gate proves actual implementation surfaces match confirmed target canonical
        surfaces before delivery verification.
      textZh: Canonical surface reconciliation gate 在交付核验前证明实际 implementation surfaces 与已确认 target canonical surfaces 匹配。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures fail when schema fields, reducer handling, writer registry ownership, target event types, tests,
        artifacts, or state transitions are missing or mismatched.
      oracleZh: >-
        当 schema fields、reducer handling、writer registry ownership、target event types、tests、artifacts 或 state
        transitions 缺失或不匹配时，fixtures 必须失败。
      requiredCommandRefs:
        - CMD-CANONICAL-SURFACE-001
      artifactRefs:
        - ART-014
      acceptanceType: acceptance_e2e
    - id: EVD-015
      text: >-
        Legacy substitution denial gate rejects legacy events, fields, reducers, gate checks, closeout branches, or
        diagnostic checks as target evidence.
      textZh: >-
        Legacy substitution denial gate 拒绝 legacy events、fields、reducers、gate checks、closeout branches 或 diagnostic
        checks 作为 target evidence。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: Fixtures fail when a target canonical event is absent but a legacy event or legacy closeout branch is present.
      oracleZh: 当 target canonical event 缺失但 legacy event 或 legacy closeout branch 存在时，fixtures 必须失败。
      requiredCommandRefs:
        - CMD-LEGACY-DENIAL-001
      artifactRefs:
        - ART-015
      acceptanceType: acceptance_e2e
    - id: EVD-016
      text: >-
        Controlled record_closed write accepts only current closeout integrity approval based on current
        delivery_verification=verified.
      textZh: Controlled record_closed write 只接受基于当前 delivery_verification=verified 的 current closeout integrity approval。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures prove implementation runners, tests, summary writers, completion packet writers, and delivery evidence
        writers cannot directly write record_closed.
      oracleZh: >-
        Fixtures 证明 implementation runners、tests、summary writers、completion packet writers 和 delivery evidence writers
        不能直接写 record_closed。
      requiredCommandRefs:
        - CMD-RECORD-CLOSED-001
      artifactRefs:
        - ART-016
      acceptanceType: acceptance_e2e
    - id: EVD-017
      text: >-
        Evidence trust state model keeps planned, observed, assertion_validated, and delivery_verified states distinct
        and allows closeout only from delivery_verified evidence.
      textZh: >-
        Evidence trust state model 保持 planned、observed、assertion_validated 和 delivery_verified 状态互相独立，并且 closeout 只能来自
        delivery_verified evidence。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures prove planned proof, observed command output, and assertion_validated-but-not-delivery_verified
        evidence are rejected by closeout integrity.
      oracleZh: >-
        Fixtures 证明 planned proof、observed command output 以及 assertion_validated-but-not-delivery_verified evidence 会被
        closeout integrity 拒绝。
      requiredCommandRefs:
        - CMD-EVIDENCE-TRUST-001
      artifactRefs:
        - ART-017
      acceptanceType: acceptance_e2e
    - id: EVD-018
      text: >-
        Semantic kernel first routing creates a compact semantic-kernel.json before checkpoint materialization for large
        documents.
      textZh: Semantic kernel first routing 在大型文档 checkpoint materialization 前创建紧凑的 semantic-kernel.json。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures verify scale assessment can route to single_pass, kernel_then_checkpoint, or
        kernel_then_checkpoint_with_amendment, and large documents require semantic-kernel.json before materialization.
      oracleZh: >-
        Fixtures 验证 scale assessment 可路由到 single_pass、kernel_then_checkpoint 或
        kernel_then_checkpoint_with_amendment，且大型文档在 materialization 前必须有 semantic-kernel.json。
      requiredCommandRefs:
        - CMD-SEMANTIC-KERNEL-001
      artifactRefs:
        - ART-018
      acceptanceType: acceptance_e2e
    - id: EVD-019
      text: Kernel completeness, ID freeze, and checkpoint drift checks prevent fragmented checkpoint reasoning.
      textZh: Kernel completeness、ID freeze 和 checkpoint drift checks 防止碎片化 checkpoint reasoning。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures fail when a checkpoint adds unregistered core IDs, changes frozen ID meaning, omits kernel IDs,
        converts planned proof to executed proof, or confuses confirmability with delivery readiness.
      oracleZh: >-
        当 checkpoint 添加未登记核心 IDs、改变 frozen ID meaning、遗漏 kernel IDs、把 planned proof 转成 executed proof，或混淆 confirmability
        与 delivery readiness 时，fixtures 必须失败。
      requiredCommandRefs:
        - CMD-KERNEL-DRIFT-001
      artifactRefs:
        - ART-019
      acceptanceType: acceptance_e2e
    - id: EVD-020
      text: >-
        Full-contract reconciliation and kernel amendment controls ensure final documents are complete non-drifting
        kernel materializations before HTML render.
      textZh: Full-contract reconciliation 和 kernel amendment controls 确保最终文档在 HTML render 前是完整且无漂移的 kernel materialization。
      gate: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures verify prose, implementationConfirmation, Mermaid, tables, reports, boundaries, EVD, TRACE, CMD, and
        ART reconcile with the kernel; direct prose requirement mutation after freeze fails until a kernel amendment is
        recorded.
      oracleZh: >-
        Fixtures 验证 prose、implementationConfirmation、Mermaid、tables、reports、boundaries、EVD、TRACE、CMD 和 ART 必须与 kernel
        对账；freeze 后直接 prose requirement mutation 会失败，直到记录 kernel amendment。
      requiredCommandRefs:
        - CMD-FULL-RECONCILIATION-001
      artifactRefs:
        - ART-020
      acceptanceType: acceptance_e2e
    - id: EVD-021
      text: Reverse audit stage CLIs emit single-responsibility verdicts and cannot share one generic PASS across stages.
      textZh: Reverse audit stage CLIs 输出单一职责 verdicts，并且不能在多个阶段共享一个 generic PASS。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures verify audit_contract_confirmability.js, audit_implementation_readiness.js,
        audit_delivery_verification.js, and audit_closeout_integrity.js emit stage-specific verdicts with
        allowedNextActions and blockedNextActions.
      oracleZh: >-
        Fixtures 验证 audit_contract_confirmability.js、audit_implementation_readiness.js、audit_delivery_verification.js 和
        audit_closeout_integrity.js 输出阶段专属 verdicts，并包含 allowedNextActions 与 blockedNextActions。
      requiredCommandRefs:
        - CMD-AUDIT-STAGE-CLI-001
      artifactRefs:
        - ART-021
      acceptanceType: acceptance_e2e
    - id: EVD-022
      text: >-
        Legacy reverse_audit_contract.js compatibility wrapper marks generic PASS as deprecated and not valid for
        closeout.
      textZh: Legacy reverse_audit_contract.js compatibility wrapper 标记 generic PASS 已废弃且不能用于 closeout。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures verify reverse_audit_contract.js --mode implementation and --mode readiness produce non-closeout
        evidence and include deprecatedGenericPass or notValidForCloseout metadata when applicable.
      oracleZh: >-
        Fixtures 验证 reverse_audit_contract.js --mode implementation 和 --mode readiness 输出非 closeout evidence，并在适用时包含
        deprecatedGenericPass 或 notValidForCloseout metadata。
      requiredCommandRefs:
        - CMD-AUDIT-WRAPPER-001
      artifactRefs:
        - ART-022
      acceptanceType: acceptance_e2e
    - id: EVD-023
      text: >-
        Stage-boundary regression tests block confirmability, readiness, generic PASS, deliveryReadiness=false, missing
        command targets, incomplete traces, legacy substitution, and self-certification from closing requirements.
      textZh: >-
        Stage-boundary regression tests 阻断 confirmability、readiness、generic PASS、deliveryReadiness=false、missing command
        targets、incomplete traces、legacy substitution 和 self-certification 关闭 requirements。
      gate: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures verify only delivery_verification=verified can enter closeout integrity and only closeout_accepted can
        write record_closed.
      oracleZh: Fixtures 验证只有 delivery_verification=verified 能进入 closeout integrity，且只有 closeout_accepted 能写 record_closed。
      requiredCommandRefs:
        - CMD-AUDIT-STAGE-REGRESSION-001
      artifactRefs:
        - ART-023
      acceptanceType: acceptance_e2e
    - id: EVD-024
      text: HTML renderer exposes target modification paths and blocks confirmability when the explicit list is missing.
      textZh: HTML renderer 会展示目标修改路径清单，并在缺少显式清单时阻断 confirmability。
      gate: npx vitest run tests/acceptance/render-requirements-confirmation-html.test.ts
      oracle: >-
        Fixtures verify the HTML contains a dedicated target modification paths section, report.targetModificationPaths
        is populated, and scripts/hooks/governance/current-target or implementation changes fail when
        targetModificationPaths[] is absent.
      oracleZh: >-
        Fixtures 验证 HTML 包含独立目标修改路径区，report.targetModificationPaths 有数据，并且 scripts/hooks/governance/current-target 或
        implementation changes 在缺少 targetModificationPaths[] 时失败。
      requiredCommandRefs:
        - CMD-TARGET-MODIFICATION-PATHS-001
      artifactRefs:
        - ART-024
      acceptanceType: acceptance_e2e
    - id: EVD-025
      text: >-
        AI-TDD contract gate exposes errorCaseCoverage and blocks missing FAIL/EDGE mappings before readiness or
        closeout.
      textZh: AI-TDD contract gate 输出 errorCaseCoverage，并在 readiness 或 closeout 前阻断缺失 FAIL/EDGE 映射。
      gate: >-
        npx vitest run tests/acceptance/ai-tdd-contract-gate.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      oracle: >-
        Fixtures verify every FAIL-* and EDGE-* has explicit NEG, EVD, TRACE, ACC or E2E, and view coverage, and verify
        generic ACC-001 coverage alone is insufficient.
      oracleZh: Fixtures 验证每个 FAIL-* 和 EDGE-* 都有显式 NEG、EVD、TRACE、ACC 或 E2E 以及 view 覆盖，并验证仅有泛化 ACC-001 覆盖不充分。
      requiredCommandRefs:
        - CMD-AI-TDD-ERROR-CASE-001
      artifactRefs:
        - ART-025
      acceptanceType: acceptance_e2e
  openQuestions: []
  failurePaths:
    - id: FAIL-001
      title: Render attempted before pre-render readiness
      titleZh: pre-render readiness 前尝试 render
      trigger: >-
        A caller requests HTML render while checkpoint progress is incomplete or definition drilldown has active
        blockers.
      triggerZh: 调用方在 checkpoint progress 未完成或 definition drilldown 仍有 active blockers 时请求 HTML render。
      expectedBehavior: Block render and return checkpoint or decision-packet details.
      expectedBehaviorZh: 阻断 render，并返回 checkpoint 或 decision-packet 详情。
      forbiddenBehavior: Do not render HTML from an incomplete or semantically blocked source document.
      forbiddenBehaviorZh: 不得从未完成或语义阻断的源文档渲染 HTML。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-001
      linkedEvidenceIds:
        - EVD-005
      requiredAssertions:
        - Render is blocked.
        - The blocking checkpoint or remaining definition cluster is visible.
    - id: FAIL-002
      title: Unrelated staged path during checkpoint commit
      titleZh: checkpoint commit 时存在无关 staged path
      trigger: The staged set contains any path other than the target requirements source document.
      triggerZh: staged set 包含目标 requirements source document 之外的任何路径。
      expectedBehavior: Stop before commit and report the unexpected staged paths.
      expectedBehaviorZh: 在 commit 前停止，并报告 unexpected staged paths。
      forbiddenBehavior: Do not create a checkpoint commit that includes unrelated files.
      forbiddenBehaviorZh: 不得创建包含无关文件的 checkpoint commit。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-002
      linkedEvidenceIds:
        - EVD-003
      requiredAssertions:
        - Commit is not created.
        - Unexpected staged paths are reported.
    - id: FAIL-003
      title: Resume detects document hash drift
      titleZh: Resume 检测到 document hash drift
      trigger: The current document hash differs from the latest checkpoint progress record.
      triggerZh: 当前 document hash 与最新 checkpoint progress record 不一致。
      expectedBehavior: Stop before editing and require diff review or user decision.
      expectedBehaviorZh: 在编辑前停止，并要求 diff review 或用户决策。
      forbiddenBehavior: Do not overwrite manual edits or restart from scratch silently.
      forbiddenBehaviorZh: 不得静默覆盖手工修改或从头重启。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-003
      linkedEvidenceIds:
        - EVD-004
      requiredAssertions:
        - Resume status is blocked.
        - The diff state is visible.
    - id: FAIL-004
      title: Checkpoint completion without global consistency
      titleZh: checkpoint 完成但缺少全局一致性
      trigger: >-
        All eight checkpoint logs exist, but the whole document has unresolved trace, evidence, command, failure, edge,
        or view reference gaps.
      triggerZh: 八个 checkpoint logs 都存在，但整篇文档仍有 unresolved trace、evidence、command、failure、edge 或 view reference gaps。
      expectedBehavior: Return blocked status, write pre-render-global-consistency-report.json, and prevent HTML render.
      expectedBehaviorZh: 返回 blocked status，写入 pre-render-global-consistency-report.json，并阻止 HTML render。
      forbiddenBehavior: Do not return pre_render_ready from checkpoint count or trace row count alone.
      forbiddenBehaviorZh: 不得仅凭 checkpoint count 或 trace row count 返回 pre_render_ready。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-004
      linkedEvidenceIds:
        - EVD-007
      requiredAssertions:
        - A source with eighteen trace rows pointing at missing evidence fails the gate.
        - A complete reciprocal source passes the gate before pre_render_ready.
    - id: FAIL-005
      title: Generic PASS reused as closeout approval
      titleZh: Generic PASS 被复用为 closeout approval
      trigger: >-
        A caller uses contract confirmability PASS, implementation readiness PASS, or reverse audit PASS as closeout
        evidence.
      triggerZh: 调用方把 contract confirmability PASS、implementation readiness PASS 或 reverse audit PASS 用作 closeout evidence。
      expectedBehavior: >-
        Fail closed and require a delivery_verification=verified decision from the current confirmed contract and
        current closeout attempt.
      expectedBehaviorZh: fail closed，并要求来自当前已确认契约和当前 closeout attempt 的 delivery_verification=verified decision。
      forbiddenBehavior: Do not allow closeout from generic PASS or contract_confirmable results.
      forbiddenBehaviorZh: 不得允许 generic PASS 或 contract_confirmable results 触发 closeout。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-005
      linkedEvidenceIds:
        - EVD-008
        - EVD-011
      requiredAssertions:
        - contract_confirmable output includes notValidForCloseout=true.
        - closeout_integrity_gate rejects any non-delivery-verification decision.
    - id: FAIL-006
      title: Planned proof treated as executed proof
      titleZh: Planned proof 被当作 executed proof
      trigger: >-
        Generated EVD/TRACE rows are complete but no current delivery evidence exists for the confirmed source and
        closeout attempt.
      triggerZh: 生成的 EVD/TRACE rows 完整，但当前已确认 source 和 closeout attempt 没有 current delivery evidence。
      expectedBehavior: Keep proof state planned or pending until delivery verification audit records current_pass evidence.
      expectedBehaviorZh: 保持 proof state 为 planned 或 pending，直到 delivery verification audit 记录 current_pass evidence。
      forbiddenBehavior: Do not mark traceRows closed, current_pass, verified, or closeout-ready from planned proof.
      forbiddenBehaviorZh: 不得从 planned proof 标记 traceRows closed、current_pass、verified 或 closeout-ready。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-006
      linkedEvidenceIds:
        - EVD-009
        - EVD-011
      requiredAssertions:
        - Generated source rows remain planned or pending before delivery evidence.
        - Delivery verification requires current controlled evidence before current_pass.
    - id: FAIL-007
      title: Command success without target collection
      titleZh: Command success 缺少 target collection
      trigger: >-
        A required command exits 0 while an explicitly named test or script file is missing, not collected, expanded
        from an empty glob, or unbound to the current command run.
      triggerZh: required command 退出 0，但显式点名的测试或脚本文件缺失、未收集、由空 glob 展开或未绑定到当前 command run。
      expectedBehavior: >-
        Fail before evidence acceptance and write command-target-collection-report.json with missing or uncollected
        targets.
      expectedBehaviorZh: 在 evidence acceptance 前失败，并写入包含 missing 或 uncollected targets 的 command-target-collection-report.json。
      forbiddenBehavior: Do not accept exitCode=0 as evidence without target collection.
      forbiddenBehaviorZh: 不得在没有 target collection 的情况下接受 exitCode=0 为证据。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-007
      linkedEvidenceIds:
        - EVD-012
      requiredAssertions:
        - Missing explicit test files fail the gate.
        - Collected-target manifest is required before command evidence is accepted.
    - id: FAIL-008
      title: Trace closure self-certified by implementation packet
      titleZh: Trace closure 由 implementation packet 自证
      trigger: >-
        A runtime packet, completion packet, summary file, or implementation-authored report marks trace rows closed
        without independent target-state verification.
      triggerZh: >-
        runtime packet、completion packet、summary file 或 implementation-authored report 在没有独立 target-state verification
        的情况下标记 trace rows closed。
      expectedBehavior: Keep affected trace rows non-current_pass and require trace closure integrity verification.
      expectedBehaviorZh: 保持受影响 trace rows 为 non-current_pass，并要求 trace closure integrity verification。
      forbiddenBehavior: Do not close trace rows from implementation self-certification.
      forbiddenBehaviorZh: 不得通过 implementation self-certification 关闭 trace rows。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-008
      linkedEvidenceIds:
        - EVD-013
      requiredAssertions:
        - Trace closure requires target-state assertions.
        - Self-authored completion evidence is rejected without independent verification.
    - id: FAIL-009
      title: Legacy control flow substitutes for target canonical flow
      titleZh: Legacy control flow 替代 target canonical flow
      trigger: >-
        A target canonical event, field, reducer, writer, or closeout branch is absent, but a legacy surface is present
        and used as proof.
      triggerZh: target canonical event、field、reducer、writer 或 closeout branch 缺失，但 legacy surface 存在并被用作 proof。
      expectedBehavior: Fail delivery verification with a legacy-substitution blocker.
      expectedBehaviorZh: 交付核验以 legacy-substitution blocker 失败。
      forbiddenBehavior: Do not allow legacy control flow to satisfy target assertions.
      forbiddenBehaviorZh: 不得允许 legacy control flow 满足 target assertions。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-009
      linkedEvidenceIds:
        - EVD-015
      requiredAssertions:
        - Target event absence is a blocker even when legacy event exists.
        - Old closeout branches cannot write or justify delivery verification.
    - id: FAIL-010
      title: record_closed written outside closeout integrity
      titleZh: record_closed 在 closeout integrity 外被写入
      trigger: >-
        An implementation runner, test, summary writer, completion packet writer, or delivery evidence writer attempts
        to write record_closed.
      triggerZh: >-
        implementation runner、test、summary writer、completion packet writer 或 delivery evidence writer 尝试写入
        record_closed。
      expectedBehavior: Reject the write and require closeout_integrity_gate approval from a current delivery verification report.
      expectedBehaviorZh: 拒绝写入，并要求来自 current delivery verification report 的 closeout_integrity_gate approval。
      forbiddenBehavior: Do not treat record_closed as a packaging or self-certification event.
      forbiddenBehaviorZh: 不得把 record_closed 当作 packaging 或 self-certification event。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-010
      linkedEvidenceIds:
        - EVD-016
      requiredAssertions:
        - Only closeout integrity can write record_closed.
        - >-
          record_closed payload includes current hashes, attempt id, verified trace ids, command run refs, and evidence
          hashes.
    - id: FAIL-011
      title: Checkpoint introduces semantic drift
      titleZh: Checkpoint 引入 semantic drift
      trigger: >-
        A checkpoint materializes a requirement, ID, completion semantic, delivery readiness claim, or closeout
        applicability that is absent from the frozen semantic kernel.
      triggerZh: >-
        checkpoint 物化了 frozen semantic kernel 中不存在的 requirement、ID、completion semantic、delivery readiness claim 或
        closeout applicability。
      expectedBehavior: Fail the checkpoint, preserve the source, and require kernel amendment or checkpoint correction.
      expectedBehaviorZh: checkpoint 失败，保留 source，并要求 kernel amendment 或 checkpoint correction。
      forbiddenBehavior: Do not accept checkpoint-local requirement invention as valid source content.
      forbiddenBehaviorZh: 不得接受 checkpoint-local requirement invention 作为有效 source content。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-011
      linkedEvidenceIds:
        - EVD-019
        - EVD-020
      requiredAssertions:
        - Unregistered IDs are rejected.
        - Frozen ID meaning changes are rejected.
        - New completion semantics require kernel amendment.
    - id: FAIL-012
      title: Direct prose mutation bypasses kernel amendment
      titleZh: Direct prose mutation 绕过 kernel amendment
      trigger: >-
        A requirement definition issue is discovered after kernel freeze and the workflow patches long-form prose
        without updating and re-auditing the kernel.
      triggerZh: kernel freeze 后发现 requirement definition issue，流程未更新并 re-audit kernel，而是直接 patch long-form prose。
      expectedBehavior: >-
        Fail closed and keep HTML render blocked until kernel amendment, re-audit, impacted checkpoint
        re-materialization, and reconciliation pass.
      expectedBehaviorZh: >-
        fail closed，并保持 HTML render blocked，直到 kernel amendment、re-audit、impacted checkpoint re-materialization 和
        reconciliation 全部通过。
      forbiddenBehavior: Do not let direct prose edits become authoritative requirements.
      forbiddenBehaviorZh: 不得让直接 prose edits 成为 authoritative requirements。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-012
      linkedEvidenceIds:
        - EVD-020
      requiredAssertions:
        - Amendment receipt is required for core requirement changes.
        - Impacted checkpoints are re-materialized before reconciliation.
    - id: FAIL-013
      title: Global reverse audit verdict reused across stages
      titleZh: Global reverse audit verdict 被跨阶段复用
      trigger: >-
        A caller consumes one reverse audit CLI PASS as if it were valid for confirmability, readiness, delivery
        verification, and closeout.
      triggerZh: 调用方消费一个 reverse audit CLI PASS，好像它同时适用于 confirmability、readiness、delivery verification 和 closeout。
      expectedBehavior: Fail closed and require the stage-specific audit CLI for the requested action.
      expectedBehaviorZh: fail closed，并要求为请求动作使用阶段专属 audit CLI。
      forbiddenBehavior: Do not allow one global reverse audit verdict to authorize multiple lifecycle stages.
      forbiddenBehaviorZh: 不得允许一个 global reverse audit verdict 授权多个 lifecycle stages。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-013
      linkedEvidenceIds:
        - EVD-021
        - EVD-023
      requiredAssertions:
        - Confirmability output cannot enter closeout.
        - Readiness output cannot enter closeout.
        - Delivery verification requires delivery_verification stage output.
    - id: FAIL-014
      title: Legacy wrapper PASS consumed as closeout evidence
      titleZh: Legacy wrapper PASS 被消费为 closeout evidence
      trigger: >-
        A caller feeds reverse_audit_contract.js PASS, contract_confirmable, or ready_for_implementation into closeout
        integrity.
      triggerZh: 调用方把 reverse_audit_contract.js PASS、contract_confirmable 或 ready_for_implementation 输入 closeout integrity。
      expectedBehavior: Reject the input and report notValidForCloseout or deprecatedGenericPass.
      expectedBehaviorZh: 拒绝输入，并报告 notValidForCloseout 或 deprecatedGenericPass。
      forbiddenBehavior: Do not treat compatibility wrapper output as terminal delivery or closeout proof.
      forbiddenBehaviorZh: 不得把 compatibility wrapper output 当作 terminal delivery 或 closeout proof。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-014
      linkedEvidenceIds:
        - EVD-022
        - EVD-023
      requiredAssertions:
        - Legacy wrapper PASS includes deprecation metadata.
        - Closeout accepts only delivery_verification=verified.
    - id: FAIL-015
      title: Confirmation hides target modification paths
      titleZh: 确认页隐藏目标修改路径
      trigger: >-
        The confirmation source applies scripts, hooks, current/target mapping, governance, runtime recovery, or
        implementation artifacts but has no explicit targetModificationPaths rows.
      triggerZh: >-
        确认源文档适用 scripts、hooks、current/target mapping、governance、runtime recovery 或 implementation artifacts，但没有显式
        targetModificationPaths rows。
      expectedBehavior: Block confirmability and show the missing target modification path issue before user confirmation.
      expectedBehaviorZh: 在用户确认前阻断 confirmability，并显示缺失目标修改路径的问题。
      forbiddenBehavior: Do not let artifactAutomationPlan or currentTargetMap hide the planned modification surface.
      forbiddenBehaviorZh: 不得让 artifactAutomationPlan 或 currentTargetMap 隐藏计划修改面。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-015
      linkedEvidenceIds:
        - EVD-024
      requiredAssertions:
        - Confirmation HTML contains a target modification paths section.
        - Missing explicit targetModificationPaths[] blocks confirmability.
    - id: FAIL-016
      title: Error-case coverage hidden inside generic acceptance
      titleZh: error-case coverage 被隐藏在泛化验收里
      trigger: >-
        FAIL-* or EDGE-* rows rely only on broad requirement coverage, a single generic ACC row, or
        implementation-authored closeout proof instead of explicit error-case mapping.
      triggerZh: >-
        FAIL-* 或 EDGE-* rows 只依赖宽泛 requirement coverage、单个泛化 ACC 行或 implementation-authored closeout proof，而没有显式
        error-case mapping。
      expectedBehavior: >-
        AI-TDD contract completeness blocks readiness and closeout, and ContractExecutionManifest.errorCaseCoverage
        lists the missing mappings.
      expectedBehaviorZh: AI-TDD contract completeness 阻断 readiness 和 closeout，并由 ContractExecutionManifest.errorCaseCoverage 列出缺失映射。
      forbiddenBehavior: Do not infer error-case coverage from broad MUST/NEG coverage or command exit code.
      forbiddenBehaviorZh: 不得从宽泛 MUST/NEG 覆盖或 command exit code 推断 error-case coverage。
      blocksCompletionWhenViolated: true
      linkedNegIds:
        - NEG-015
      linkedEvidenceIds:
        - EVD-025
      requiredAssertions:
        - Missing failurePathRefs or edgeCaseRefs in ACC/E2E rows blocks contract completeness.
        - Missing FAIL linkedNegIds blocks contract completeness.
        - Missing EDGE linkedFailurePathIds or linkedNegIds blocks contract completeness.
  edgeCases:
    - id: EDGE-001
      category: scale_boundary
      condition: The source document is medium-sized and close to the single-pass threshold.
      conditionZh: 源文档为中等规模，接近 single-pass threshold。
      expectedBehavior: The assessment reports score and signals so the routing decision is explainable.
      expectedBehaviorZh: assessment 报告 score 和 signals，让 routing decision 可解释。
      forbiddenBehavior: Do not hide why single_pass or checkpoint_required was chosen.
      forbiddenBehaviorZh: 不得隐藏选择 single_pass 或 checkpoint_required 的原因。
      linkedFailurePathIds:
        - FAIL-016
      linkedEvidenceIds:
        - EVD-001
    - id: EDGE-002
      category: interrupted_generation
      condition: A progress record exists but the last checkpoint commit is not the current working tree state.
      conditionZh: 存在 progress record，但最后一个 checkpoint commit 不是当前 working tree state。
      expectedBehavior: Resume mode blocks and reports mismatch.
      expectedBehaviorZh: Resume mode 阻断并报告 mismatch。
      forbiddenBehavior: Do not continue generation over a changed file.
      forbiddenBehaviorZh: 不得在文件已变化的情况下继续 generation。
      linkedFailurePathIds:
        - FAIL-003
      linkedEvidenceIds:
        - EVD-004
    - id: EDGE-003
      category: existing_staged_files
      condition: The user has unrelated staged files before checkpoint commit.
      conditionZh: checkpoint commit 前用户已有无关 staged files。
      expectedBehavior: The runner detects the staged set and stops before adding or committing.
      expectedBehaviorZh: runner 检测 staged set，并在 add 或 commit 前停止。
      forbiddenBehavior: Do not unstage or commit unrelated user work.
      forbiddenBehaviorZh: 不得 unstage 或 commit 无关用户工作。
      linkedFailurePathIds:
        - FAIL-002
      linkedEvidenceIds:
        - EVD-003
    - id: EDGE-004
      category: trace_count_false_positive
      condition: A document contains many traceRows but at least one trace row references missing evidence or undefined commands.
      conditionZh: 文档包含很多 traceRows，但至少一个 trace row 引用缺失 evidence 或未定义 commands。
      expectedBehavior: The global consistency gate fails closed before HTML render.
      expectedBehaviorZh: global consistency gate 在 HTML render 前 fail closed。
      forbiddenBehavior: Do not accept trace row count as proof of trace closure.
      forbiddenBehaviorZh: 不得接受 trace row count 作为 trace closure proof。
      linkedFailurePathIds:
        - FAIL-004
      linkedEvidenceIds:
        - EVD-007
    - id: EDGE-005
      category: reverse_audit_stage_confusion
      condition: The reverse audit reports contract_confirmable while deliveryReadiness is false.
      conditionZh: reverse audit 报告 contract_confirmable，但 deliveryReadiness 为 false。
      expectedBehavior: >-
        Allow user scope confirmation only; block implementation readiness, delivery verification, and closeout until
        later-stage gates pass.
      expectedBehaviorZh: 只允许用户确认 scope；implementation readiness、delivery verification 和 closeout 必须等后续阶段 gates 通过。
      forbiddenBehavior: Do not treat contract_confirmable as delivery verified.
      forbiddenBehaviorZh: 不得把 contract_confirmable 当作 delivery verificationed。
      linkedFailurePathIds:
        - FAIL-005
      linkedEvidenceIds:
        - EVD-008
        - EVD-011
    - id: EDGE-006
      category: planned_vs_executed_proof
      condition: The generated contract has a complete product-grade EVD/TRACE proof plan but no executed evidence.
      conditionZh: 生成的 contract 有完整产品级 EVD/TRACE proof plan，但没有 executed evidence。
      expectedBehavior: Keep rows planned or pending and require delivery verification audit for current_pass.
      expectedBehaviorZh: rows 保持 planned 或 pending，并要求 delivery verification audit 产生 current_pass。
      forbiddenBehavior: Do not convert planned proof into executed proof.
      forbiddenBehaviorZh: 不得把 planned proof 转换成 executed proof。
      linkedFailurePathIds:
        - FAIL-006
      linkedEvidenceIds:
        - EVD-009
        - EVD-011
    - id: EDGE-007
      category: mixed_test_command_false_positive
      condition: A command runs multiple tests and exits 0 while one explicitly named target test file is absent or uncollected.
      conditionZh: command 运行多个 tests 并退出 0，但一个显式点名的 target test file 缺失或未收集。
      expectedBehavior: Command target collection gate fails and prevents evidence binding.
      expectedBehaviorZh: Command target collection gate 失败，并阻止 evidence binding。
      forbiddenBehavior: Do not let unrelated passing tests satisfy the missing target.
      forbiddenBehaviorZh: 不得让无关 passing tests 满足缺失 target。
      linkedFailurePathIds:
        - FAIL-007
      linkedEvidenceIds:
        - EVD-012
    - id: EDGE-008
      category: implementation_self_certification
      condition: >-
        The implementation produces a completion packet that claims all trace rows closed without target-state
        reconciliation.
      conditionZh: implementation 产出 completion packet，声称所有 trace rows 都已 closed，但没有 target-state reconciliation。
      expectedBehavior: Trace closure remains blocked until independent trace closure integrity passes.
      expectedBehaviorZh: Trace closure 保持 blocked，直到独立 trace closure integrity 通过。
      forbiddenBehavior: Do not accept completion packet claims as trace closure.
      forbiddenBehaviorZh: 不得接受 completion packet claims 作为 trace closure。
      linkedFailurePathIds:
        - FAIL-008
      linkedEvidenceIds:
        - EVD-013
    - id: EDGE-009
      category: legacy_substitution
      condition: The legacy event or old closeout branch exists while the target canonical event or branch is absent.
      conditionZh: legacy event 或 old closeout branch 存在，但 target canonical event 或 branch 缺失。
      expectedBehavior: Delivery verification fails with a legacy-substitution blocker.
      expectedBehaviorZh: 交付核验以 legacy-substitution blocker 失败。
      forbiddenBehavior: Do not upcast legacy behavior into target evidence.
      forbiddenBehaviorZh: 不得把 legacy behavior 升格为 target evidence。
      linkedFailurePathIds:
        - FAIL-009
      linkedEvidenceIds:
        - EVD-015
    - id: EDGE-010
      category: premature_record_closed
      condition: record_closed is attempted before closeout integrity consumes current delivery_verification=verified.
      conditionZh: record_closed 在 closeout integrity 消费 current delivery_verification=verified 之前被尝试写入。
      expectedBehavior: Reject the terminal write and preserve the requirement as not closed.
      expectedBehaviorZh: 拒绝 terminal write，并保持 requirement 为 not closed。
      forbiddenBehavior: Do not close from summary, test, runtime packet, or completion packet.
      forbiddenBehaviorZh: 不得从 summary、test、runtime packet 或 completion packet 关闭。
      linkedFailurePathIds:
        - FAIL-010
      linkedEvidenceIds:
        - EVD-016
    - id: EDGE-011
      category: checkpoint_fragmented_reasoning
      condition: >-
        A later checkpoint invents a new core requirement because it sees a local gap in the partially materialized
        source.
      conditionZh: 后续 checkpoint 因为看到 partially materialized source 中的局部缺口而发明新核心需求。
      expectedBehavior: Kernel drift gate blocks the checkpoint and requires kernel amendment.
      expectedBehaviorZh: Kernel drift gate 阻断该 checkpoint，并要求 kernel amendment。
      forbiddenBehavior: Do not let local checkpoint reasoning override the global semantic pass.
      forbiddenBehaviorZh: 不得让 local checkpoint reasoning 覆盖 global semantic pass。
      linkedFailurePathIds:
        - FAIL-011
      linkedEvidenceIds:
        - EVD-019
    - id: EDGE-012
      category: amendment_required
      condition: A valid new requirement definition issue is found during checkpoint materialization.
      conditionZh: checkpoint materialization 期间发现有效的新 requirement definition issue。
      expectedBehavior: >-
        Record kernel amendment, re-audit the kernel, re-materialize impacted checkpoints, and rerun full
        reconciliation.
      expectedBehaviorZh: 记录 kernel amendment，re-audit kernel，re-materialize 受影响 checkpoints，并重新运行 full reconciliation。
      forbiddenBehavior: Do not patch prose or YAML directly as the first source of truth.
      forbiddenBehaviorZh: 不得直接 patch prose 或 YAML 作为第一事实源。
      linkedFailurePathIds:
        - FAIL-012
      linkedEvidenceIds:
        - EVD-020
    - id: EDGE-013
      category: global_audit_pass_misuse
      condition: A runner sees PASS from a reverse audit command and does not inspect stage-specific verdict metadata.
      conditionZh: runner 看到 reverse audit command 的 PASS，却没有检查 stage-specific verdict metadata。
      expectedBehavior: Stage-boundary gate rejects the PASS for any action outside its declared allowedNextActions.
      expectedBehaviorZh: Stage-boundary gate 针对其 declared allowedNextActions 之外的任何动作拒绝该 PASS。
      forbiddenBehavior: Do not infer lifecycle stage from exit code or generic PASS.
      forbiddenBehaviorZh: 不得从 exit code 或 generic PASS 推断 lifecycle stage。
      linkedFailurePathIds:
        - FAIL-013
      linkedEvidenceIds:
        - EVD-021
        - EVD-023
    - id: EDGE-014
      category: compatibility_wrapper_misuse
      condition: A caller uses reverse_audit_contract.js --mode implementation or --mode readiness as closeout evidence.
      conditionZh: 调用方把 reverse_audit_contract.js --mode implementation 或 --mode readiness 当作 closeout evidence。
      expectedBehavior: Closeout integrity rejects the wrapper output as notValidForCloseout.
      expectedBehaviorZh: Closeout integrity 拒绝 wrapper output，并标记为 notValidForCloseout。
      forbiddenBehavior: Do not treat compatibility wrapper output as delivery verification.
      forbiddenBehaviorZh: 不得把 compatibility wrapper output 当作交付核验。
      linkedFailurePathIds:
        - FAIL-014
      linkedEvidenceIds:
        - EVD-022
        - EVD-023
    - id: EDGE-015
      category: missing_target_modification_paths
      condition: >-
        Scripts, hooks, current/target, governance, runtime recovery, or implementation artifacts apply, but
        implementationConfirmation.targetModificationPaths[] is empty.
      conditionZh: >-
        scripts、hooks、current/target、governance、runtime recovery 或 implementation artifacts 适用，但
        implementationConfirmation.targetModificationPaths[] 为空。
      expectedBehavior: Confirmation HTML is blocked and shows target_modification_paths_missing.
      expectedBehaviorZh: 确认页 HTML 被阻断，并显示 target_modification_paths_missing。
      forbiddenBehavior: Do not let artifactAutomationPlan-derived paths substitute for explicit targetModificationPaths.
      forbiddenBehaviorZh: 不得让 artifactAutomationPlan 派生路径替代显式 targetModificationPaths。
      linkedFailurePathIds:
        - FAIL-015
      linkedEvidenceIds:
        - EVD-024
    - id: EDGE-016
      category: generic_error_case_acceptance
      condition: >-
        A contract has many FAIL/EDGE rows but only one broad ACC row that covers MUST/NEG IDs without failurePathRefs
        or edgeCaseRefs.
      conditionZh: contract 有很多 FAIL/EDGE rows，但只有一个覆盖 MUST/NEG IDs 的宽泛 ACC 行，没有 failurePathRefs 或 edgeCaseRefs。
      expectedBehavior: AI-TDD errorCaseCoverage reports the uncovered FAIL/EDGE IDs and blocks contract completeness.
      expectedBehaviorZh: AI-TDD errorCaseCoverage 报告未覆盖的 FAIL/EDGE IDs，并阻断 contract completeness。
      forbiddenBehavior: Do not mark the manifest complete because requirements coverage exists.
      forbiddenBehaviorZh: 不得因为 requirements coverage 存在就把 manifest 标记为 complete。
      linkedFailurePathIds:
        - FAIL-016
      linkedEvidenceIds:
        - EVD-025
  acceptanceTests:
    - id: ACC-001
      file: tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      covers:
        - MUST-001
        - MUST-002
        - MUST-003
        - MUST-004
        - MUST-005
        - MUST-006
        - MUST-007
        - MUST-008
        - MUST-009
        - MUST-010
        - MUST-011
        - MUST-012
        - MUST-013
        - MUST-014
        - MUST-015
        - MUST-016
        - MUST-017
        - MUST-018
        - MUST-019
        - MUST-020
        - MUST-021
        - MUST-022
        - MUST-023
        - MUST-024
        - MUST-025
        - NEG-001
        - NEG-002
        - NEG-003
        - NEG-004
        - NEG-005
        - NEG-006
        - NEG-007
        - NEG-008
        - NEG-009
        - NEG-010
        - NEG-011
        - NEG-012
        - NEG-013
        - NEG-014
        - NEG-015
      traceRows:
        - TRACE-001
        - TRACE-002
        - TRACE-003
        - TRACE-004
        - TRACE-005
        - TRACE-006
        - TRACE-007
        - TRACE-008
        - TRACE-009
        - TRACE-010
        - TRACE-011
        - TRACE-012
        - TRACE-013
        - TRACE-014
        - TRACE-015
        - TRACE-016
        - TRACE-017
        - TRACE-018
        - TRACE-019
        - TRACE-020
        - TRACE-021
        - TRACE-022
        - TRACE-023
        - TRACE-024
        - TRACE-025
      evidenceRefs:
        - EVD-001
        - EVD-002
        - EVD-003
        - EVD-004
        - EVD-005
        - EVD-006
        - EVD-007
        - EVD-008
        - EVD-009
        - EVD-010
        - EVD-011
        - EVD-012
        - EVD-013
        - EVD-014
        - EVD-015
        - EVD-016
        - EVD-017
        - EVD-018
        - EVD-019
        - EVD-020
        - EVD-021
        - EVD-022
        - EVD-023
        - EVD-024
        - EVD-025
      commandRefs:
        - CMD-TEST-001
        - CMD-TEST-002
        - CMD-CURRENT-TARGET-001
        - CMD-TARGET-MODIFICATION-PATHS-001
      expectedPreImplementationState: expected_red
      oracle: >-
        Acceptance fixtures prove checkpoint automation, current/target visibility, target modification path visibility,
        and audit-stage fail-closed behavior.
    - id: ACC-ERROR-001
      file: tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      covers:
        - NEG-001
        - NEG-002
        - NEG-003
        - NEG-004
      failurePathRefs:
        - FAIL-001
        - FAIL-002
        - FAIL-003
        - FAIL-004
      edgeCaseRefs:
        - EDGE-002
        - EDGE-003
        - EDGE-004
      traceRows:
        - TRACE-003
        - TRACE-004
        - TRACE-005
        - TRACE-007
      evidenceRefs:
        - EVD-003
        - EVD-004
        - EVD-005
        - EVD-007
      commandRefs:
        - CMD-TEST-001
      expectedPreImplementationState: expected_red
      oracle: >-
        Checkpoint interruption, staged-file, pre-render blocker, and trace-count false-positive fixtures fail closed
        with explicit blockers.
    - id: ACC-ERROR-002
      file: tests/acceptance/reverse-audit-contract.test.ts
      covers:
        - NEG-005
        - NEG-006
        - NEG-013
        - NEG-014
      failurePathRefs:
        - FAIL-005
        - FAIL-006
        - FAIL-013
        - FAIL-014
      edgeCaseRefs:
        - EDGE-005
        - EDGE-006
        - EDGE-013
        - EDGE-014
      traceRows:
        - TRACE-011
        - TRACE-021
        - TRACE-022
        - TRACE-023
      evidenceRefs:
        - EVD-008
        - EVD-009
        - EVD-011
        - EVD-021
        - EVD-022
        - EVD-023
      commandRefs:
        - CMD-REVERSE-STAGE-001
        - CMD-PROOF-MATRIX-001
        - CMD-AUDIT-STAGE-REGRESSION-001
      expectedPreImplementationState: expected_red
      oracle: >-
        Reverse-audit stage confusion, planned-vs-executed proof, wrapper misuse, and generic PASS misuse are rejected
        as readiness or closeout evidence.
    - id: ACC-ERROR-003
      file: tests/acceptance/reverse-audit-contract.test.ts
      covers:
        - NEG-007
        - NEG-008
        - NEG-009
        - NEG-010
      failurePathRefs:
        - FAIL-007
        - FAIL-008
        - FAIL-009
        - FAIL-010
      edgeCaseRefs:
        - EDGE-007
        - EDGE-008
        - EDGE-009
        - EDGE-010
      traceRows:
        - TRACE-012
        - TRACE-013
        - TRACE-015
        - TRACE-016
      evidenceRefs:
        - EVD-012
        - EVD-013
        - EVD-015
        - EVD-016
      commandRefs:
        - CMD-COMMAND-TARGET-001
        - CMD-TRACE-CLOSURE-001
        - CMD-LEGACY-DENIAL-001
        - CMD-RECORD-CLOSED-001
      expectedPreImplementationState: expected_red
      oracle: >-
        Command target, trace self-certification, legacy substitution, and premature record_closed cases are blocked by
        target-state gates.
    - id: ACC-ERROR-004
      file: tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      covers:
        - NEG-011
        - NEG-012
      failurePathRefs:
        - FAIL-011
        - FAIL-012
      edgeCaseRefs:
        - EDGE-011
        - EDGE-012
      traceRows:
        - TRACE-019
        - TRACE-020
      evidenceRefs:
        - EVD-019
        - EVD-020
      commandRefs:
        - CMD-KERNEL-DRIFT-001
        - CMD-FULL-RECONCILIATION-001
      expectedPreImplementationState: expected_red
      oracle: Kernel drift and direct prose mutation cases require kernel amendment and re-materialization before render.
    - id: ACC-ERROR-005
      file: tests/acceptance/render-requirements-confirmation-html.test.ts
      covers:
        - NEG-015
      failurePathRefs:
        - FAIL-015
      edgeCaseRefs:
        - EDGE-015
      traceRows:
        - TRACE-024
      evidenceRefs:
        - EVD-024
      commandRefs:
        - CMD-TARGET-MODIFICATION-PATHS-001
      expectedPreImplementationState: expected_red
      oracle: Missing explicit targetModificationPaths blocks confirmability and is visible in render report.
    - id: ACC-ERROR-006
      file: tests/acceptance/ai-tdd-contract-gate.test.ts
      covers:
        - NEG-015
      failurePathRefs:
        - FAIL-016
      edgeCaseRefs:
        - EDGE-001
        - EDGE-016
      traceRows:
        - TRACE-001
        - TRACE-025
      evidenceRefs:
        - EVD-001
        - EVD-025
      commandRefs:
        - CMD-AI-TDD-ERROR-CASE-001
      expectedPreImplementationState: expected_red
      oracle: >-
        AI-TDD ContractExecutionManifest.errorCaseCoverage blocks missing FAIL/EDGE NEG linkage, missing edge linkage,
        and generic-only acceptance coverage.
  e2eSuites:
    - id: E2E-001
      file: tests/acceptance/render-requirements-confirmation-html.test.ts
      covers:
        - MUST-010
        - MUST-024
        - MUST-025
        - NEG-001
        - NEG-004
        - NEG-005
        - NEG-006
        - NEG-013
        - NEG-014
        - NEG-015
      failurePathRefs:
        - FAIL-001
        - FAIL-004
        - FAIL-005
        - FAIL-006
        - FAIL-013
        - FAIL-014
        - FAIL-015
        - FAIL-016
      edgeCaseRefs:
        - EDGE-001
        - EDGE-004
        - EDGE-005
        - EDGE-006
        - EDGE-013
        - EDGE-014
        - EDGE-015
        - EDGE-016
      traceRows:
        - TRACE-010
        - TRACE-011
        - TRACE-021
        - TRACE-022
        - TRACE-023
        - TRACE-024
        - TRACE-025
      evidenceRefs:
        - EVD-010
        - EVD-011
        - EVD-021
        - EVD-022
        - EVD-023
        - EVD-024
        - EVD-025
      commandRefs:
        - CMD-CURRENT-TARGET-001
        - CMD-TARGET-MODIFICATION-PATHS-001
      negativeControls:
        - NEG-001
        - NEG-004
        - NEG-005
        - NEG-006
        - NEG-013
        - NEG-014
        - NEG-015
      expectedPreImplementationState: expected_red
      oracle: >-
        Renderer fixtures block confirmability when current/target or target modification path hard surfaces are
        missing.
    - id: E2E-ERROR-001
      file: tests/acceptance/ai-tdd-contract-gate.test.ts
      covers:
        - MUST-025
        - NEG-015
      failurePathRefs:
        - FAIL-016
      edgeCaseRefs:
        - EDGE-001
        - EDGE-016
      traceRows:
        - TRACE-001
        - TRACE-025
      evidenceRefs:
        - EVD-001
        - EVD-025
      commandRefs:
        - CMD-AI-TDD-ERROR-CASE-001
      negativeControls:
        - NEG-015
      expectedPreImplementationState: expected_red
      oracle: >-
        End-to-end AI-TDD gate report contains contractExecutionManifest.errorCaseCoverage and blocks readiness when any
        FAIL/EDGE mapping is missing.
  traceRows:
    - id: TRACE-001
      covers:
        - MUST-001
      taskRefs:
        - TASK-001
      evidenceRefs:
        - EVD-001
      contractValidationCommandRefs:
        - CMD-TEST-001
      deliveryEvidenceCommandRefs:
        - CMD-TEST-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-006
        - E2E-ERROR-001
      sequenceViewRefs:
        - SEQ-001
      boundaryViewRefs: []
      artifactRefs:
        - ART-001
      status: PENDING
    - id: TRACE-002
      covers:
        - MUST-002
      taskRefs:
        - TASK-002
      evidenceRefs:
        - EVD-002
      contractValidationCommandRefs:
        - CMD-TEST-001
      deliveryEvidenceCommandRefs:
        - CMD-TEST-001
      acceptanceRefs:
        - ACC-001
      sequenceViewRefs:
        - SEQ-001
      boundaryViewRefs: []
      artifactRefs:
        - ART-002
      status: PENDING
    - id: TRACE-003
      covers:
        - MUST-003
        - NEG-002
      taskRefs:
        - TASK-003
      evidenceRefs:
        - EVD-003
      contractValidationCommandRefs:
        - CMD-TEST-001
      deliveryEvidenceCommandRefs:
        - CMD-TEST-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-001
      sequenceViewRefs:
        - SEQ-002
      boundaryViewRefs:
        - BOUNDARY-001
      artifactRefs:
        - ART-003
      status: PENDING
    - id: TRACE-004
      covers:
        - MUST-004
        - NEG-003
      taskRefs:
        - TASK-004
      evidenceRefs:
        - EVD-004
      contractValidationCommandRefs:
        - CMD-TEST-001
      deliveryEvidenceCommandRefs:
        - CMD-TEST-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-001
      sequenceViewRefs:
        - SEQ-002
      boundaryViewRefs: []
      artifactRefs:
        - ART-004
      status: PENDING
    - id: TRACE-005
      covers:
        - MUST-005
        - NEG-001
      taskRefs:
        - TASK-005
      evidenceRefs:
        - EVD-005
      contractValidationCommandRefs:
        - CMD-TEST-002
      deliveryEvidenceCommandRefs:
        - CMD-TEST-002
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-001
      sequenceViewRefs:
        - SEQ-003
      boundaryViewRefs: []
      artifactRefs:
        - ART-005
      status: PENDING
    - id: TRACE-006
      covers:
        - MUST-006
      taskRefs:
        - TASK-006
      evidenceRefs:
        - EVD-006
      contractValidationCommandRefs:
        - CMD-TEST-001
      deliveryEvidenceCommandRefs:
        - CMD-TEST-001
      acceptanceRefs:
        - ACC-001
      sequenceViewRefs:
        - SEQ-004
      boundaryViewRefs:
        - BOUNDARY-001
      artifactRefs:
        - ART-006
      status: PENDING
    - id: TRACE-007
      covers:
        - MUST-007
        - NEG-004
      taskRefs:
        - TASK-007
      evidenceRefs:
        - EVD-007
      contractValidationCommandRefs:
        - CMD-TEST-001
      deliveryEvidenceCommandRefs:
        - CMD-TEST-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-001
      sequenceViewRefs:
        - SEQ-003
      boundaryViewRefs: []
      artifactRefs:
        - ART-007
      status: PENDING
    - id: TRACE-008
      covers:
        - MUST-008
        - NEG-005
      taskRefs:
        - TASK-008
      evidenceRefs:
        - EVD-008
      contractValidationCommandRefs:
        - CMD-REVERSE-STAGE-001
      deliveryEvidenceCommandRefs:
        - CMD-DELIVERY-SEAL-001
      acceptanceRefs:
        - ACC-001
      sequenceViewRefs:
        - SEQ-005
      boundaryViewRefs:
        - BOUNDARY-002
      artifactRefs:
        - ART-008
      status: PENDING
    - id: TRACE-009
      covers:
        - MUST-009
        - NEG-006
      taskRefs:
        - TASK-009
      evidenceRefs:
        - EVD-009
      contractValidationCommandRefs:
        - CMD-PROOF-MATRIX-001
      deliveryEvidenceCommandRefs:
        - CMD-DELIVERY-SEAL-001
      acceptanceRefs:
        - ACC-001
      sequenceViewRefs:
        - SEQ-005
      boundaryViewRefs:
        - BOUNDARY-002
      artifactRefs:
        - ART-009
      status: PENDING
    - id: TRACE-010
      covers:
        - MUST-010
      taskRefs:
        - TASK-010
      evidenceRefs:
        - EVD-010
      contractValidationCommandRefs:
        - CMD-CURRENT-TARGET-001
      deliveryEvidenceCommandRefs:
        - CMD-DELIVERY-SEAL-001
      acceptanceRefs:
        - ACC-001
        - E2E-001
      sequenceViewRefs:
        - SEQ-006
      boundaryViewRefs:
        - BOUNDARY-003
      artifactRefs:
        - ART-010
      status: PENDING
    - id: TRACE-011
      covers:
        - MUST-011
        - NEG-005
        - NEG-006
      taskRefs:
        - TASK-011
      evidenceRefs:
        - EVD-011
      contractValidationCommandRefs:
        - CMD-DELIVERY-SEAL-001
      deliveryEvidenceCommandRefs:
        - CMD-CLOSEOUT-INTEGRITY-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-002
        - E2E-001
      sequenceViewRefs:
        - SEQ-006
      boundaryViewRefs:
        - BOUNDARY-002
        - BOUNDARY-003
      artifactRefs:
        - ART-011
      status: PENDING
    - id: TRACE-012
      covers:
        - MUST-012
        - NEG-007
      taskRefs:
        - TASK-012
      evidenceRefs:
        - EVD-012
      contractValidationCommandRefs:
        - CMD-COMMAND-TARGET-001
      deliveryEvidenceCommandRefs:
        - CMD-COMMAND-TARGET-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-003
      sequenceViewRefs:
        - SEQ-007
      boundaryViewRefs:
        - BOUNDARY-004
      artifactRefs:
        - ART-012
      status: PENDING
      closureAssertions:
        targetTestFiles:
          - tests/acceptance/reverse-audit-contract.test.ts
          - tests/acceptance/requirements-contract-checkpoint-automation.test.ts
        targetArtifacts:
          - ART-012
        targetStateAssertions:
          - explicit command targets exist
          - runner collection manifest contains every named target
          - empty globs are blockers
        negativeLegacyAssertions:
          - exitCode=0 alone is never evidence
        currentAttemptBinding: true
    - id: TRACE-013
      covers:
        - MUST-013
        - NEG-008
      taskRefs:
        - TASK-013
      evidenceRefs:
        - EVD-013
      contractValidationCommandRefs:
        - CMD-TRACE-CLOSURE-001
      deliveryEvidenceCommandRefs:
        - CMD-TRACE-CLOSURE-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-003
      sequenceViewRefs:
        - SEQ-007
      boundaryViewRefs:
        - BOUNDARY-004
      artifactRefs:
        - ART-013
      status: PENDING
      closureAssertions:
        targetSchemaRefs:
          - traceRows[].closureAssertions
        targetReducerRefs:
          - delivery verification trace state reducer
        targetWriterRegistryRefs:
          - delivery_verification_audit
        targetEventRefs:
          - trace_closure_verified
        targetStateAssertions:
          - current_pass requires independent target-state verification
        negativeLegacyAssertions:
          - runtime packets and completion packets cannot close traces directly
        currentAttemptBinding: true
    - id: TRACE-014
      covers:
        - MUST-014
      taskRefs:
        - TASK-014
      evidenceRefs:
        - EVD-014
      contractValidationCommandRefs:
        - CMD-CANONICAL-SURFACE-001
      deliveryEvidenceCommandRefs:
        - CMD-CANONICAL-SURFACE-001
      acceptanceRefs:
        - ACC-001
      sequenceViewRefs:
        - SEQ-008
      boundaryViewRefs:
        - BOUNDARY-005
      artifactRefs:
        - ART-014
      status: PENDING
      closureAssertions:
        targetSchemaRefs:
          - confirmed target canonical fields
        targetReducerRefs:
          - target state transition reducers
        targetWriterRegistryRefs:
          - target writer registry entries
        targetEventRefs:
          - target canonical event types
        targetStateAssertions:
          - actual implementation surfaces match confirmed currentTargetMap
        negativeLegacyAssertions:
          - mismatched canonical surfaces block delivery verification
        currentAttemptBinding: true
    - id: TRACE-015
      covers:
        - MUST-015
        - NEG-009
      taskRefs:
        - TASK-015
      evidenceRefs:
        - EVD-015
      contractValidationCommandRefs:
        - CMD-LEGACY-DENIAL-001
      deliveryEvidenceCommandRefs:
        - CMD-LEGACY-DENIAL-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-003
      sequenceViewRefs:
        - SEQ-008
      boundaryViewRefs:
        - BOUNDARY-005
      artifactRefs:
        - ART-015
      status: PENDING
      closureAssertions:
        targetEventRefs:
          - target canonical event types
        targetStateAssertions:
          - legacy surfaces cannot satisfy target assertions
        negativeLegacyAssertions:
          - >-
            legacy events, fields, reducers, gate checks, closeout branches, and diagnostic-only checks are
            non-authoritative
        currentAttemptBinding: true
    - id: TRACE-016
      covers:
        - MUST-016
        - NEG-010
      taskRefs:
        - TASK-016
      evidenceRefs:
        - EVD-016
      contractValidationCommandRefs:
        - CMD-RECORD-CLOSED-001
      deliveryEvidenceCommandRefs:
        - CMD-RECORD-CLOSED-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-003
      sequenceViewRefs:
        - SEQ-009
      boundaryViewRefs:
        - BOUNDARY-006
      artifactRefs:
        - ART-016
      status: PENDING
      closureAssertions:
        targetWriterRegistryRefs:
          - closeout_integrity_gate
        targetEventRefs:
          - record_closed
        targetStateAssertions:
          - >-
            record_closed payload binds current hashes, verified trace rows, command run refs, artifact hashes, and
            attempt id
        negativeLegacyAssertions:
          - implementation, test, summary, completion, and evidence writers cannot write record_closed
        currentAttemptBinding: true
    - id: TRACE-017
      covers:
        - MUST-017
      taskRefs:
        - TASK-017
      evidenceRefs:
        - EVD-017
      contractValidationCommandRefs:
        - CMD-EVIDENCE-TRUST-001
      deliveryEvidenceCommandRefs:
        - CMD-EVIDENCE-TRUST-001
      acceptanceRefs:
        - ACC-001
      sequenceViewRefs:
        - SEQ-009
      boundaryViewRefs:
        - BOUNDARY-006
      artifactRefs:
        - ART-017
      status: PENDING
      closureAssertions:
        targetSchemaRefs:
          - evidenceTrustState
        targetReducerRefs:
          - evidence trust state reducer
        targetStateAssertions:
          - planned to observed to verified to verified transitions are distinct
        negativeLegacyAssertions:
          - planned, observed, and assertion_validated-but-not-delivery_verified evidence cannot close out
        currentAttemptBinding: true
    - id: TRACE-018
      covers:
        - MUST-018
      taskRefs:
        - TASK-018
      evidenceRefs:
        - EVD-018
      contractValidationCommandRefs:
        - CMD-SEMANTIC-KERNEL-001
      deliveryEvidenceCommandRefs:
        - CMD-SEMANTIC-KERNEL-001
      acceptanceRefs:
        - ACC-001
      sequenceViewRefs:
        - SEQ-010
      boundaryViewRefs:
        - BOUNDARY-007
      artifactRefs:
        - ART-018
      status: PENDING
    - id: TRACE-019
      covers:
        - MUST-019
        - NEG-011
      taskRefs:
        - TASK-019
      evidenceRefs:
        - EVD-019
      contractValidationCommandRefs:
        - CMD-KERNEL-DRIFT-001
      deliveryEvidenceCommandRefs:
        - CMD-KERNEL-DRIFT-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-004
      sequenceViewRefs:
        - SEQ-010
      boundaryViewRefs:
        - BOUNDARY-007
      artifactRefs:
        - ART-019
      status: PENDING
    - id: TRACE-020
      covers:
        - MUST-020
        - NEG-011
        - NEG-012
      taskRefs:
        - TASK-020
      evidenceRefs:
        - EVD-020
      contractValidationCommandRefs:
        - CMD-FULL-RECONCILIATION-001
      deliveryEvidenceCommandRefs:
        - CMD-FULL-RECONCILIATION-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-004
      sequenceViewRefs:
        - SEQ-011
      boundaryViewRefs:
        - BOUNDARY-007
      artifactRefs:
        - ART-020
      status: PENDING
    - id: TRACE-021
      covers:
        - MUST-021
        - NEG-013
      taskRefs:
        - TASK-021
      evidenceRefs:
        - EVD-021
      contractValidationCommandRefs:
        - CMD-AUDIT-STAGE-CLI-001
      deliveryEvidenceCommandRefs:
        - CMD-AUDIT-STAGE-CLI-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-002
        - E2E-001
      sequenceViewRefs:
        - SEQ-012
      boundaryViewRefs:
        - BOUNDARY-008
      artifactRefs:
        - ART-021
      status: PENDING
    - id: TRACE-022
      covers:
        - MUST-022
        - NEG-014
      taskRefs:
        - TASK-022
      evidenceRefs:
        - EVD-022
      contractValidationCommandRefs:
        - CMD-AUDIT-WRAPPER-001
      deliveryEvidenceCommandRefs:
        - CMD-AUDIT-WRAPPER-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-002
        - E2E-001
      sequenceViewRefs:
        - SEQ-012
      boundaryViewRefs:
        - BOUNDARY-008
      artifactRefs:
        - ART-022
      status: PENDING
    - id: TRACE-023
      covers:
        - MUST-023
        - NEG-013
        - NEG-014
      taskRefs:
        - TASK-023
      evidenceRefs:
        - EVD-023
      contractValidationCommandRefs:
        - CMD-AUDIT-STAGE-REGRESSION-001
      deliveryEvidenceCommandRefs:
        - CMD-AUDIT-STAGE-REGRESSION-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-002
        - E2E-001
      sequenceViewRefs:
        - SEQ-013
      boundaryViewRefs:
        - BOUNDARY-008
      artifactRefs:
        - ART-023
      status: PENDING
    - id: TRACE-024
      covers:
        - MUST-024
      taskRefs:
        - TASK-024
      evidenceRefs:
        - EVD-024
      contractValidationCommandRefs:
        - CMD-TARGET-MODIFICATION-PATHS-001
      deliveryEvidenceCommandRefs:
        - CMD-TARGET-MODIFICATION-PATHS-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-005
        - E2E-001
      sequenceViewRefs:
        - SEQ-014
      boundaryViewRefs:
        - BOUNDARY-009
      artifactRefs:
        - ART-024
      status: PENDING
    - id: TRACE-025
      covers:
        - MUST-025
        - NEG-015
      taskRefs:
        - TASK-025
      evidenceRefs:
        - EVD-025
      contractValidationCommandRefs:
        - CMD-AI-TDD-ERROR-CASE-001
      deliveryEvidenceCommandRefs:
        - CMD-AI-TDD-ERROR-CASE-001
      acceptanceRefs:
        - ACC-001
        - ACC-ERROR-006
        - E2E-001
        - E2E-ERROR-001
      sequenceViewRefs:
        - SEQ-015
      boundaryViewRefs:
        - BOUNDARY-010
      artifactRefs:
        - ART-025
      status: PENDING
  requirementBoundary:
    business:
      description: Authoring workflow behavior visible to users who ask for large requirements contract generation.
      requirementIds:
        - MUST-001
        - MUST-002
        - MUST-003
        - MUST-004
        - MUST-005
        - MUST-007
        - MUST-009
        - MUST-010
        - MUST-012
        - MUST-013
        - MUST-014
        - MUST-018
        - MUST-019
        - MUST-020
        - MUST-024
        - MUST-025
        - NEG-001
        - NEG-002
        - NEG-003
        - NEG-004
        - NEG-006
        - NEG-007
        - NEG-008
        - NEG-011
        - NEG-012
        - NEG-015
      viewRefs:
        - SEQ-001
        - SEQ-002
        - SEQ-003
        - SEQ-005
        - SEQ-006
        - SEQ-007
        - SEQ-008
        - SEQ-010
        - SEQ-011
        - SEQ-014
        - SEQ-015
        - FLOW-001
        - FLOW-002
        - FLOW-003
        - FLOW-004
        - EDGEVIEW-001
        - EDGEVIEW-002
        - EDGEVIEW-003
        - EDGEVIEW-004
        - EDGEVIEW-007
      diagramRefs:
        - MERMAID-001
        - MERMAID-002
        - MERMAID-003
        - MERMAID-005
        - MERMAID-006
        - MERMAID-007
        - MERMAID-008
        - MERMAID-010
        - MERMAID-011
        - MERMAID-014
        - MERMAID-015
    governance:
      description: >-
        Process boundaries for confirmation status, renderer responsibility, checkpoint commit isolation, final index
        cleanup, reverse-audit stage separation, delivery verification, and closeout integrity.
      requirementIds:
        - MUST-006
        - MUST-008
        - MUST-011
        - MUST-015
        - MUST-016
        - MUST-017
        - MUST-021
        - MUST-022
        - MUST-023
        - NEG-005
        - NEG-009
        - NEG-010
        - NEG-013
        - NEG-014
        - OUT-001
        - OUT-002
        - OUT-003
      viewRefs:
        - BOUNDARY-001
        - BOUNDARY-002
        - BOUNDARY-003
        - BOUNDARY-004
        - BOUNDARY-005
        - BOUNDARY-006
        - BOUNDARY-007
        - BOUNDARY-008
        - SEQ-004
        - SEQ-005
        - SEQ-006
        - SEQ-008
        - SEQ-009
        - SEQ-012
        - SEQ-013
      diagramRefs:
        - MERMAID-004
        - MERMAID-005
        - MERMAID-006
        - MERMAID-008
        - MERMAID-009
        - MERMAID-011
        - MERMAID-012
        - MERMAID-013
  sequenceViews:
    - id: SEQ-001
      title: Scale assessment routes authoring mode
      scope: business
      covers:
        - MUST-001
        - MUST-002
      mermaidRef: MERMAID-001
    - id: SEQ-002
      title: Checkpoint commit and resume safety
      scope: business
      covers:
        - MUST-003
        - MUST-004
        - NEG-002
        - NEG-003
      mermaidRef: MERMAID-002
    - id: SEQ-003
      title: Pre-render gate blocks unresolved source issues
      scope: business
      covers:
        - MUST-005
        - MUST-007
        - NEG-001
        - NEG-004
      mermaidRef: MERMAID-003
    - id: SEQ-004
      title: Final index cleanup after retention decision
      scope: governance
      covers:
        - MUST-006
        - OUT-001
        - OUT-002
        - OUT-003
      mermaidRef: MERMAID-004
    - id: SEQ-005
      title: Reverse audit stage separation and proof plan authoring
      scope: governance
      covers:
        - MUST-008
        - MUST-009
        - NEG-005
        - NEG-006
        - EVD-008
        - EVD-009
      mermaidRef: MERMAID-005
    - id: SEQ-006
      title: Current-target strictness to delivery verification and closeout
      scope: governance
      covers:
        - MUST-010
        - MUST-011
        - NEG-005
        - NEG-006
        - EVD-010
        - EVD-011
      mermaidRef: MERMAID-006
    - id: SEQ-007
      title: Command target collection and trace closure integrity
      scope: business
      covers:
        - MUST-012
        - MUST-013
        - NEG-007
        - NEG-008
        - EVD-012
        - EVD-013
        - TRACE-012
        - TRACE-013
      mermaidRef: MERMAID-007
    - id: SEQ-008
      title: Canonical surface reconciliation and legacy denial
      scope: governance
      covers:
        - MUST-014
        - MUST-015
        - NEG-009
        - EVD-014
        - EVD-015
        - TRACE-014
        - TRACE-015
      mermaidRef: MERMAID-008
    - id: SEQ-009
      title: Controlled record_closed and evidence trust states
      scope: governance
      covers:
        - MUST-016
        - MUST-017
        - NEG-010
        - EVD-016
        - EVD-017
        - TRACE-016
        - TRACE-017
      mermaidRef: MERMAID-009
    - id: SEQ-010
      title: Semantic kernel first and ID freeze
      scope: business
      covers:
        - MUST-018
        - MUST-019
        - NEG-011
        - EVD-018
        - EVD-019
        - TRACE-018
        - TRACE-019
      mermaidRef: MERMAID-010
    - id: SEQ-011
      title: Full contract reconciliation and kernel amendment
      scope: business
      covers:
        - MUST-020
        - NEG-011
        - NEG-012
        - EVD-020
        - TRACE-020
      mermaidRef: MERMAID-011
    - id: SEQ-012
      title: Single-responsibility reverse audit CLI split
      scope: governance
      covers:
        - MUST-021
        - MUST-022
        - NEG-013
        - NEG-014
        - EVD-021
        - EVD-022
        - TRACE-021
        - TRACE-022
      mermaidRef: MERMAID-012
    - id: SEQ-013
      title: Stage-boundary regression gate
      scope: governance
      covers:
        - MUST-023
        - NEG-013
        - NEG-014
        - EVD-023
        - TRACE-023
      mermaidRef: MERMAID-013
    - id: SEQ-014
      title: Target modification paths confirmation gate
      scope: business
      covers:
        - MUST-024
        - EVD-024
        - TRACE-024
        - FAIL-015
        - EDGE-015
      mermaidRef: MERMAID-014
    - id: SEQ-015
      title: AI-TDD error-case coverage manifest gate
      scope: business
      covers:
        - MUST-025
        - NEG-015
        - EVD-025
        - TRACE-025
        - FAIL-016
        - EDGE-001
        - EDGE-016
      mermaidRef: MERMAID-015
  flowViews:
    - id: FLOW-001
      title: Authoring mode decision flow
      scope: business
      covers:
        - MUST-001
        - MUST-002
        - MUST-005
    - id: FLOW-002
      title: Proof state promotion flow
      scope: governance
      covers:
        - MUST-008
        - MUST-009
        - MUST-011
        - NEG-005
        - NEG-006
        - TRACE-008
        - TRACE-009
        - TRACE-011
    - id: FLOW-003
      title: Evidence trust boundary flow
      scope: governance
      covers:
        - MUST-012
        - MUST-013
        - MUST-016
        - MUST-017
        - NEG-007
        - NEG-008
        - NEG-010
        - TRACE-012
        - TRACE-013
        - TRACE-016
        - TRACE-017
    - id: FLOW-004
      title: Semantic kernel materialization flow
      scope: business
      covers:
        - MUST-018
        - MUST-019
        - MUST-020
        - NEG-011
        - NEG-012
        - TRACE-018
        - TRACE-019
        - TRACE-020
    - id: FLOW-005
      title: Stage-specific audit verdict flow
      scope: governance
      covers:
        - MUST-021
        - MUST-022
        - MUST-023
        - NEG-013
        - NEG-014
        - TRACE-021
        - TRACE-022
        - TRACE-023
  edgeCaseViews:
    - id: EDGEVIEW-001
      title: Checkpoint interruption and staged-file edge cases
      scope: business
      covers:
        - NEG-002
        - NEG-003
        - EVD-003
        - EVD-004
        - FAIL-002
        - FAIL-003
      cases:
        - EDGE-002
        - EDGE-003
    - id: EDGEVIEW-002
      title: False positive audit and planned-proof edge cases
      scope: governance
      covers:
        - EDGE-004
        - EDGE-005
        - EDGE-006
        - FAIL-004
        - FAIL-005
        - FAIL-006
      cases:
        - EDGE-004
        - EDGE-005
        - EDGE-006
    - id: EDGEVIEW-003
      title: Command, self-certification, legacy, and premature-closeout edge cases
      scope: governance
      covers:
        - EDGE-007
        - EDGE-008
        - EDGE-009
        - EDGE-010
        - FAIL-007
        - FAIL-008
        - FAIL-009
        - FAIL-010
      cases:
        - EDGE-007
        - EDGE-008
        - EDGE-009
        - EDGE-010
    - id: EDGEVIEW-004
      title: Semantic kernel drift and amendment edge cases
      scope: business
      covers:
        - EDGE-011
        - EDGE-012
        - FAIL-011
        - FAIL-012
      cases:
        - EDGE-011
        - EDGE-012
    - id: EDGEVIEW-005
      title: Reverse audit stage-boundary edge cases
      scope: governance
      covers:
        - EDGE-013
        - EDGE-014
        - FAIL-013
        - FAIL-014
      cases:
        - EDGE-013
        - EDGE-014
    - id: EDGEVIEW-006
      title: Target modification path visibility edge cases
      scope: business
      covers:
        - EDGE-015
        - FAIL-015
        - EVD-024
      cases:
        - EDGE-015
    - id: EDGEVIEW-007
      title: AI-TDD error-case coverage edge cases
      scope: business
      covers:
        - EDGE-001
        - EDGE-016
        - FAIL-016
        - NEG-015
        - EVD-025
      cases:
        - EDGE-001
        - EDGE-016
  boundaryViews:
    - id: BOUNDARY-001
      title: Checkpoint automation boundaries
      scope: governance
      covers:
        - OUT-001
        - OUT-002
        - OUT-003
        - FAIL-001
    - id: BOUNDARY-002
      title: Audit stage and proof-state boundaries
      scope: governance
      covers:
        - MUST-008
        - MUST-009
        - NEG-005
        - NEG-006
        - FAIL-005
        - FAIL-006
    - id: BOUNDARY-003
      title: Current-target and closeout boundaries
      scope: governance
      covers:
        - MUST-010
        - MUST-011
        - EVD-010
        - EVD-011
    - id: BOUNDARY-004
      title: Command target and trace closure boundaries
      scope: governance
      covers:
        - MUST-012
        - MUST-013
        - NEG-007
        - NEG-008
        - FAIL-007
        - FAIL-008
    - id: BOUNDARY-005
      title: Canonical surface and legacy denial boundaries
      scope: governance
      covers:
        - MUST-014
        - MUST-015
        - NEG-009
        - EVD-014
        - EVD-015
        - FAIL-009
    - id: BOUNDARY-006
      title: Terminal closeout and evidence trust boundaries
      scope: governance
      covers:
        - MUST-016
        - MUST-017
        - NEG-010
        - EVD-016
        - EVD-017
        - FAIL-010
    - id: BOUNDARY-007
      title: Semantic kernel and checkpoint materialization boundaries
      scope: governance
      covers:
        - MUST-018
        - MUST-019
        - MUST-020
        - NEG-011
        - NEG-012
        - EVD-018
        - EVD-019
        - EVD-020
        - FAIL-011
        - FAIL-012
    - id: BOUNDARY-008
      title: Single-responsibility reverse audit and closeout boundaries
      scope: governance
      covers:
        - MUST-021
        - MUST-022
        - MUST-023
        - NEG-013
        - NEG-014
        - EVD-021
        - EVD-022
        - EVD-023
        - FAIL-013
        - FAIL-014
    - id: BOUNDARY-009
      title: Target modification path confirmation boundary
      scope: governance
      covers:
        - MUST-024
        - EVD-024
        - FAIL-015
        - EDGE-015
    - id: BOUNDARY-010
      title: AI-TDD error-case coverage boundary
      scope: governance
      covers:
        - MUST-025
        - NEG-015
        - EVD-025
        - FAIL-016
        - EDGE-001
        - EDGE-016
  artifactAutomationPlan:
    - artifactId: ART-001
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/scale-assessment.json
      artifactType: assessment
      sourceOfTruthRole: control
      controlAuthorityRole: scale_assessment_decision
      ownerModel: requirements_contract_authoring
      producer: assess_contract_authoring_scale.js
      consumer: run_semantic_checkpoints.js
      inputArtifacts:
        - source-document.md
      outputArtifacts:
        - scale-assessment.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when missing or malformed
      idempotency: same source hash produces same decision and signal set
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-001
      linkedEvidenceIds:
        - EVD-001
    - artifactId: ART-002
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-checkpoint-plan.json
      artifactType: plan
      sourceOfTruthRole: control
      controlAuthorityRole: checkpoint_plan_control
      ownerModel: requirements_contract_authoring
      producer: run_semantic_checkpoints.js
      consumer: run_semantic_checkpoints.js
      inputArtifacts:
        - scale-assessment.json
      outputArtifacts:
        - semantic-checkpoint-plan.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when checkpoint order is incomplete
      idempotency: same assessment hash produces same checkpoint plan
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-002
      linkedEvidenceIds:
        - EVD-002
    - artifactId: ART-003
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/checkpoint-commit-receipt.json
      artifactType: receipt
      sourceOfTruthRole: control
      controlAuthorityRole: checkpoint_commit_gate_receipt
      ownerModel: requirements_contract_authoring
      producer: run_semantic_checkpoints.js
      consumer: user_and_resume_runner
      inputArtifacts:
        - target-source-document.md
        - git-index
      outputArtifacts:
        - checkpoint-commit-receipt.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when staged paths include unrelated files
      idempotency: receipt is keyed by checkpoint id and commit hash
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: medium
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-003
      linkedEvidenceIds:
        - EVD-003
    - artifactId: ART-004
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-checkpoint-progress.json
      artifactType: progress_record
      sourceOfTruthRole: control
      controlAuthorityRole: checkpoint_resume_state
      ownerModel: requirements_contract_authoring
      producer: run_semantic_checkpoints.js
      consumer: run_semantic_checkpoints.js
      inputArtifacts:
        - checkpoint-commit-receipt.json
      outputArtifacts:
        - semantic-checkpoint-progress.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when document hash differs from progress
      idempotency: latest completed checkpoint wins only when hashes match
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: medium
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-004
      linkedEvidenceIds:
        - EVD-004
    - artifactId: ART-005
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/grill-definition-decision-packet.json
      artifactType: decision_packet
      sourceOfTruthRole: control
      controlAuthorityRole: definition_drilldown_decision
      ownerModel: requirements_contract_authoring
      producer: pre_render_definition_drilldown.js
      consumer: user_and_authoring_runner
      inputArtifacts:
        - source-document.md
        - previous-grill-definition-report.json
        - grill-definition-resolutions.json
      outputArtifacts:
        - grill-definition-decision-packet.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when remaining blocking clusters exist
      idempotency: same source and resolution hashes produce same remaining clusters
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-005
      linkedEvidenceIds:
        - EVD-005
    - artifactId: ART-006
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/final-index-cleanup-plan.json
      artifactType: cleanup_plan
      sourceOfTruthRole: evidence
      ownerModel: requirements_contract_authoring
      producer: run_semantic_checkpoints.js
      consumer: user_and_cleanup_step
      inputArtifacts:
        - target-source-document.md
      outputArtifacts:
        - final-index-cleanup-plan.json
      recordEventTypes: []
      canAffectControlFlow: false
      failureBehavior: do not execute cleanup without retention confirmation
      idempotency: cleanup plan is advisory until confirmed
      userApprovalRequired: true
      retention: short_lived
      cleanupPolicy: remove_after_final_delivery_decision
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-006
      linkedEvidenceIds:
        - EVD-006
    - artifactId: ART-007
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/pre-render-global-consistency-report.json
      artifactType: gate_report
      sourceOfTruthRole: control
      controlAuthorityRole: pre_render_global_consistency_gate
      ownerModel: requirements_contract_authoring
      producer: run_semantic_checkpoints.js
      consumer: run_semantic_checkpoints.js
      inputArtifacts:
        - target-source-document.md
        - semantic-checkpoint-progress.json
      outputArtifacts:
        - pre-render-global-consistency-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when global trace, evidence, command, failure, edge, view, or definition consistency fails
      idempotency: same source hash and progress hash produce same gate report
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-007
      linkedEvidenceIds:
        - EVD-007
    - artifactId: ART-008
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-stage-decision-report.json
      artifactType: audit_report
      sourceOfTruthRole: control
      controlAuthorityRole: reverse_audit_stage_decision
      ownerModel: requirements_contract_authoring
      producer: reverse_audit_contract.js
      consumer: readiness_or_delivery_runner
      inputArtifacts:
        - target-source-document.md
        - confirmation-render-report.json
      outputArtifacts:
        - reverse-audit-stage-decision-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when a generic PASS is requested or a stage verdict is used outside allowedNextActions
      idempotency: >-
        same source hash, implementationConfirmation hash, render report hash, stage, and mode produce same stage
        decision
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-008
      linkedEvidenceIds:
        - EVD-008
    - artifactId: ART-009
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/product-grade-proof-matrix-audit-report.json
      artifactType: audit_report
      sourceOfTruthRole: control
      controlAuthorityRole: product_grade_proof_matrix_gate
      ownerModel: requirements_contract_authoring
      producer: reverse_audit_contract.js
      consumer: requirements_contract_authoring
      inputArtifacts:
        - target-source-document.md
      outputArtifacts:
        - product-grade-proof-matrix-audit-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when EVD or TRACE rows rely on smoke-only proof, missing oracle, missing split command refs, or
        premature current_pass
      idempotency: same implementationConfirmation hash produces same proof-matrix findings
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-009
      linkedEvidenceIds:
        - EVD-009
    - artifactId: ART-010
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/current-target-strictness-audit-report.json
      artifactType: audit_report
      sourceOfTruthRole: control
      controlAuthorityRole: current_target_strictness_gate
      ownerModel: requirements_contract_authoring
      producer: render-requirements-confirmation-html.ts + run_semantic_checkpoints.js + reverse_audit_contract.js
      consumer: html_confirmation_renderer, pre_render_global_consistency_gate, implementation_readiness_audit
      inputArtifacts:
        - target-source-document.md
        - currentTargetMap
        - confirmation-render-report.json
        - pre-render-global-consistency-report.json
      outputArtifacts:
        - current-target-strictness-audit-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when current or target canonical fields, schemas, reducers, registries, events, scripts, tests,
        evidence artifacts, behavior, legacy retirements, required currentTargetMap view pack,
        closed_loop_current_target_map displayProfile, or currentTargetCoverage thresholds are incomplete
      idempotency: same implementationConfirmation hash and currentTargetMap hash produce same strictness report
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-010
      linkedEvidenceIds:
        - EVD-010
    - artifactId: ART-011
      path: >-
        _bmad-output/runtime/requirement-records/<recordId>/authoring/delivery-verification-closeout-integrity-report.json
      artifactType: seal_report
      sourceOfTruthRole: control
      controlAuthorityRole: delivery_verification_closeout_decision
      ownerModel: delivery_verification_audit
      producer: delivery_verification_audit
      consumer: closeout_integrity_gate
      inputArtifacts:
        - target-source-document.md
        - confirmation-render-report.json
        - requirement-record.json
        - command-run-receipts
        - evidence-artifacts
      outputArtifacts:
        - delivery-verification-closeout-integrity-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed unless delivery_verification=verified for the current confirmed contract and current closeout
        attempt
      idempotency: >-
        same source hash, implementationConfirmation hash, requirement record hash, command run refs, evidence hashes,
        and closeout attempt id produce same verification decision
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-011
      linkedEvidenceIds:
        - EVD-011
    - artifactId: ART-012
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/command-target-collection-report.json
      artifactType: gate_report
      sourceOfTruthRole: control
      controlAuthorityRole: command_target_collection_gate
      ownerModel: command_target_collection_gate
      producer: command_target_collection_gate
      consumer: delivery_verification_audit
      inputArtifacts:
        - requiredCommands
        - test-runner-collection-manifest
      outputArtifacts:
        - command-target-collection-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when named files are missing, globs are empty, targets are uncollected, or command run refs are not
        current
      idempotency: same command, cwd, target set, collection manifest, and command run id produce same collection decision
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-012
      linkedEvidenceIds:
        - EVD-012
    - artifactId: ART-013
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/trace-closure-integrity-report.json
      artifactType: gate_report
      sourceOfTruthRole: control
      controlAuthorityRole: trace_closure_integrity_gate
      ownerModel: trace_closure_integrity_gate
      producer: trace_closure_integrity_gate
      consumer: delivery_verification_audit
      inputArtifacts:
        - traceRows
        - command-target-collection-report.json
        - evidence-artifacts
      outputArtifacts:
        - trace-closure-integrity-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when closure assertions are absent, stale, smoke-only, self-certified, or matched to the wrong
        control flow
      idempotency: same trace rows, closure assertions, evidence hashes, and attempt id produce same closure decision
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-013
      linkedEvidenceIds:
        - EVD-013
    - artifactId: ART-014
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/canonical-surface-reconciliation-report.json
      artifactType: gate_report
      sourceOfTruthRole: control
      controlAuthorityRole: canonical_surface_reconciliation_gate
      ownerModel: canonical_surface_reconciliation_gate
      producer: canonical_surface_reconciliation_gate
      consumer: delivery_verification_audit
      inputArtifacts:
        - currentTargetMap
        - implementation-surface-manifest
        - test-runner-collection-manifest
      outputArtifacts:
        - canonical-surface-reconciliation-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when schema, reducer, writer registry, event, test, artifact, or state-transition surfaces do not
        match the confirmed target
      idempotency: same currentTargetMap hash and implementation surface manifest hash produce same reconciliation decision
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-014
      linkedEvidenceIds:
        - EVD-014
    - artifactId: ART-015
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/legacy-substitution-denial-report.json
      artifactType: gate_report
      sourceOfTruthRole: control
      controlAuthorityRole: legacy_substitution_denial_gate
      ownerModel: legacy_substitution_denial_gate
      producer: legacy_substitution_denial_gate
      consumer: delivery_verification_audit
      inputArtifacts:
        - currentTargetMap
        - implementation-surface-manifest
        - canonical-surface-reconciliation-report.json
      outputArtifacts:
        - legacy-substitution-denial-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when legacy surfaces are used as target evidence without explicit confirmed migration authority
      idempotency: same currentTargetMap hash, legacy surface manifest, and target surface manifest produce same denial decision
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-015
      linkedEvidenceIds:
        - EVD-015
    - artifactId: ART-016
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/record-closed-write-receipt.json
      artifactType: controlled_write_receipt
      sourceOfTruthRole: control
      controlAuthorityRole: record_closed_terminal_write_receipt
      ownerModel: closeout_integrity_gate
      producer: closeout_integrity_gate
      consumer: requirement_record
      inputArtifacts:
        - delivery-verification-closeout-integrity-report.json
        - requirement-record.json
      outputArtifacts:
        - record-closed-write-receipt.json
      recordEventTypes:
        - record_closed
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when writer is not closeout_integrity_gate or payload lacks current hashes, verified trace ids,
        command refs, artifact hashes, or attempt id
      idempotency: same delivery verification report hash and closeout attempt id produce one append-only record_closed receipt
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-016
      linkedEvidenceIds:
        - EVD-016
    - artifactId: ART-017
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/evidence-trust-state-report.json
      artifactType: gate_report
      sourceOfTruthRole: control
      controlAuthorityRole: evidence_trust_state_gate
      ownerModel: evidence_trust_state_gate
      producer: evidence_trust_state_gate
      consumer: delivery_verification_audit
      inputArtifacts:
        - traceRows
        - evidence
        - command-target-collection-report.json
        - trace-closure-integrity-report.json
        - delivery-verification-closeout-integrity-report.json
      outputArtifacts:
        - evidence-trust-state-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when planned, observed, or assertion_validated evidence is consumed as delivery_verified closeout
        evidence
      idempotency: >-
        same evidence hashes, command run refs, trace closure report, delivery verification report, and attempt id
        produce same trust state
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-017
      linkedEvidenceIds:
        - EVD-017
    - artifactId: ART-018
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-kernel.json
      artifactType: semantic_kernel
      sourceOfTruthRole: control
      controlAuthorityRole: semantic_kernel_source_control
      ownerModel: requirements_contract_authoring
      producer: semantic_kernel_authoring_step
      consumer: run_semantic_checkpoints.js
      inputArtifacts:
        - source-document-request
        - scale-assessment.json
      outputArtifacts:
        - semantic-kernel.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when missing before checkpoint materialization in kernel_then_checkpoint mode
      idempotency: same source request, scale assessment hash, and amendment set produce same semantic kernel hash
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-018
      linkedEvidenceIds:
        - EVD-018
    - artifactId: ART-019
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/kernel-audit-and-drift-report.json
      artifactType: gate_report
      sourceOfTruthRole: control
      controlAuthorityRole: kernel_audit_and_drift_gate
      ownerModel: requirements_contract_authoring
      producer: kernel_drift_gate
      consumer: run_semantic_checkpoints.js
      inputArtifacts:
        - semantic-kernel.json
        - target-source-document.md
        - semantic-checkpoint-progress.json
      outputArtifacts:
        - kernel-audit-and-drift-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when kernel completeness, ID freeze, or checkpoint drift checks fail
      idempotency: same semantic kernel hash, source hash, checkpoint id, and amendment set produce same drift report
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-019
      linkedEvidenceIds:
        - EVD-019
    - artifactId: ART-020
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/full-contract-reconciliation-report.json
      artifactType: gate_report
      sourceOfTruthRole: control
      controlAuthorityRole: full_contract_reconciliation_gate
      ownerModel: requirements_contract_authoring
      producer: full_contract_reconciliation_gate
      consumer: html_confirmation_renderer
      inputArtifacts:
        - semantic-kernel.json
        - target-source-document.md
        - implementationConfirmation
        - semantic-checkpoint-progress.json
      outputArtifacts:
        - full-contract-reconciliation-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed before HTML render when source document is incomplete, drifting, or changed without kernel amendment
      idempotency: >-
        same semantic kernel hash, source hash, implementationConfirmation hash, and amendment set produce same
        reconciliation report
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-020
      linkedEvidenceIds:
        - EVD-020
    - artifactId: ART-021
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-stage-cli-capability-report.json
      artifactType: audit_report
      sourceOfTruthRole: control
      controlAuthorityRole: reverse_audit_stage_cli_capability_gate
      ownerModel: requirements_contract_authoring
      producer: stage_specific_reverse_audit_cli_tests
      consumer: reverse_audit_stage_boundary_gate
      inputArtifacts:
        - audit_contract_confirmability.js
        - audit_implementation_readiness.js
        - audit_delivery_verification.js
        - audit_closeout_integrity.js
      outputArtifacts:
        - reverse-audit-stage-cli-capability-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when any stage CLI exposes cross-stage PASS, missing stage metadata, missing allowedNextActions,
        missing blockedNextActions, or wrong exit semantics
      idempotency: same CLI versions and fixture set produce same capability report
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-021
      linkedEvidenceIds:
        - EVD-021
    - artifactId: ART-022
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-wrapper-compatibility-report.json
      artifactType: audit_report
      sourceOfTruthRole: control
      controlAuthorityRole: reverse_audit_wrapper_compatibility_gate
      ownerModel: requirements_contract_authoring
      producer: reverse_audit_wrapper_compatibility_tests
      consumer: reverse_audit_stage_boundary_gate
      inputArtifacts:
        - reverse_audit_contract.js
        - stage-specific audit CLI reports
      outputArtifacts:
        - reverse-audit-wrapper-compatibility-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when the compatibility wrapper emits a generic PASS without deprecatedGenericPass or when any
        non-delivery-verification wrapper output lacks notValidForCloseout
      idempotency: same wrapper version, delegated CLI versions, and fixture set produce same compatibility report
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-022
      linkedEvidenceIds:
        - EVD-022
    - artifactId: ART-023
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/stage-boundary-regression-report.json
      artifactType: regression_report
      sourceOfTruthRole: control
      controlAuthorityRole: stage_boundary_regression_gate
      ownerModel: requirements_contract_authoring
      producer: stage_boundary_regression_tests
      consumer: delivery_verification_audit
      inputArtifacts:
        - reverse-audit-stage-cli-capability-report.json
        - reverse-audit-wrapper-compatibility-report.json
        - delivery-verification-closeout-integrity-report.json
      outputArtifacts:
        - stage-boundary-regression-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: >-
        fail closed when confirmability, readiness, generic PASS, deliveryReadiness=false, missing command targets,
        incomplete traces, missing evidence, legacy substitution, or self-certification can satisfy delivery
        verification or closeout
      idempotency: same audit CLI versions, wrapper version, fixture set, and verification fixtures produce same regression report
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-023
      linkedEvidenceIds:
        - EVD-023
    - artifactId: ART-024
      path: >-
        _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation-render-report.json#targetModificationPaths
      artifactType: render_report_section
      sourceOfTruthRole: control
      controlAuthorityRole: target_modification_paths_confirmation_gate
      ownerModel: requirements_contract_authoring
      producer: render-requirements-confirmation-html.ts
      consumer: user_and_pre_implementation_gates
      inputArtifacts:
        - implementationConfirmation.targetModificationPaths
        - artifactAutomationPlan
      outputArtifacts:
        - confirmation.html
        - confirmation-render-report.json
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when explicit targetModificationPaths are missing for applicable modification surfaces
      idempotency: same source hash and implementationConfirmation hash produce the same target modification path projection
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-024
      linkedEvidenceIds:
        - EVD-024
    - artifactId: ART-025
      path: >-
        _bmad-output/runtime/requirement-records/<recordId>/authoring/ai-tdd-contract-gate-report.json#contractExecutionManifest.errorCaseCoverage
      artifactType: manifest_section
      sourceOfTruthRole: control
      controlAuthorityRole: ai_tdd_error_case_coverage_gate
      ownerModel: ai_tdd_contract_gate
      producer: ai-tdd-contract-gate.ts
      consumer: implementation_readiness_gate_and_closeout_gate
      inputArtifacts:
        - implementationConfirmation.failurePaths
        - implementationConfirmation.edgeCases
        - implementationConfirmation.acceptanceTests
        - implementationConfirmation.e2eSuites
      outputArtifacts:
        - contractExecutionManifest.errorCaseCoverage
        - contractCompletenessReport.issues
      recordEventTypes: []
      canAffectControlFlow: true
      failureBehavior: fail closed when any FAIL-* or EDGE-* lacks explicit NEG, EVD, TRACE, ACC or E2E, or view coverage
      idempotency: same implementationConfirmation hash produces the same error-case coverage summary and missing mappings
      userApprovalRequired: false
      retention: requirement_lifetime
      cleanupPolicy: keep_until_requirement_cleanup
      orphanRisk: low
      containsSensitiveData: false
      trainingDataEligible: false
      traceRows:
        - TRACE-025
      linkedEvidenceIds:
        - EVD-025
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    purpose: >-
      Prevent reverse-audit and delivery false positives after checkpoint authoring by binding planned contract proof to
      the exact current and target control surfaces.
    introduction: >-
      This source compares the current false-positive-prone authoring and audit lifecycle with the target product-grade
      lifecycle. The comparison is a requirement-scope view only: it does not claim implementation readiness, delivery
      verification, or closeout.
    currentTitle: 'Current state: fragmented authoring and ambiguous audit evidence'
    targetTitle: 'Target state: semantic-kernel-first authoring with stage-specific proof gates'
    sourceReferences:
      - path: docs/requirements/2026-05-25-requirements-contract-checkpoint-automation.md
        description: Authoritative implementation source document and inline implementationConfirmation block.
        sourceOfTruthRole: source_document
      - path: _bmad/skills/requirements-contract-authoring/SKILL.md
        description: >-
          Skill workflow that requires scope confirmation, current/target comparison when applicable, and separate
          delivery readiness semantics.
        sourceOfTruthRole: skill_contract
      - path: _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts
        description: >-
          Read-only confirmation renderer; when currentTargetMap.applies=true it blocks confirmability unless the
          currentTargetMap view pack is required, the display profile is valid, and coverage is visible.
        sourceOfTruthRole: renderer
      - path: _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js
        description: Checkpoint runner and pre-render global consistency gate to be productized by this requirement.
        sourceOfTruthRole: planned_executor
      - path: _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js
        description: Legacy compatibility audit entry that must stop being a terminal generic PASS authority.
        sourceOfTruthRole: legacy_wrapper
    metrics:
      - value: '24'
        label: target trace rows
        tone: gold
      - value: '62'
        label: planned requirement/evidence IDs requiring current evidence before delivery
        tone: red
      - value: 0/24
        label: current_pass trace rows before implementation
        tone: red
      - value: '4'
        label: target single-responsibility audit stages
        tone: green
      - value: '1'
        label: semantic kernel authority before checkpoint materialization
        tone: green
    currentSummary:
      - title: Authoring can still be checkpoint-local
        detail: >-
          Checkpoint steps may invent, reinterpret, or drift requirement semantics while writing long-form prose instead
          of only materializing a frozen global semantic kernel.
        tone: red
      - title: Current/target evidence can be shallow
        detail: >-
          The source may list currentState and targetState concepts, but without renderer-facing rows the confirmation
          page cannot show a detailed human-readable comparison.
        tone: red
      - title: Reverse audit can be semantically overloaded
        detail: >-
          A global reverse_audit_contract.js entry can emit PASS-like output for confirmability while also carrying
          delivery_not_ready signals that callers may ignore.
        tone: red
      - title: Evidence can be planned but misread as executed
        detail: >-
          EVD/TRACE/CMD rows can be syntactically complete while still lacking current implementation evidence, target
          command collection, trace closure, and delivery verification.
        tone: red
      - title: Closeout can be self-certified
        detail: >-
          Runtime packets, completion packets, command exitCode=0, or legacy events can be mistaken for closure evidence
          unless an independent closeout integrity gate rejects them.
        tone: red
    targetSummary:
      - title: Semantic kernel is the global semantic authority
        detail: >-
          Large requirements first produce semantic-kernel.json, freeze core IDs, then checkpoints only materialize
          kernel sections and pass drift checks.
        tone: green
      - title: Current/target comparison is explicit and rendered
        detail: >-
          The confirmation page must show source-owned currentSummary, targetSummary, diffRows, targetFlow, canonical
          artifacts, script convergence, and legacy treatment.
        tone: green
      - title: Audits are single-responsibility stages
        detail: >-
          Contract confirmability, implementation readiness, delivery verification, and closeout integrity each own a
          separate CLI, verdict vocabulary, next-action contract, and exit semantics.
        tone: green
      - title: Evidence has trust states
        detail: >-
          Planned proof stays planned until command target collection, trace closure, canonical surface reconciliation,
          legacy denial, and delivery verification promote it to current delivery_verified evidence.
        tone: green
      - title: record_closed is a controlled terminal transition
        detail: >-
          Only closeout_integrity_gate may write record_closed after consuming current delivery_verification=verified
          and closeout_integrity=accepted evidence.
        tone: green
    diffRows:
      - dimension: Generation strategy
        currentState: Large documents can be split into checkpoints that continue local requirement discovery.
        targetState: One compact global semantic kernel is authored and audited before checkpoint materialization.
        action: replace_local_discovery_with_kernel_materialization
        tone: green
      - dimension: Checkpoint semantics
        currentState: Checkpoint completion may mean a section was written and a progress marker advanced.
        targetState: >-
          Checkpoint completion means the section is a no-drift materialization of frozen kernel IDs, with validation
          receipt and single-file commit.
        action: add_kernel_drift_gate
        tone: green
      - dimension: Scope confirmation
        currentState: confirmability can be mistaken for readiness or delivery because PASS semantics are overloaded.
        targetState: confirmable only allows user scope confirmation and is always notValidForCloseout.
        action: split_stage_verdicts
        tone: green
      - dimension: Implementation readiness
        currentState: Readiness can rely on planned EVD/TRACE/CMD shape without proving target control-flow sufficiency.
        targetState: >-
          Readiness must prove the confirmed contract has strict current/target mapping, planned evidence oracles,
          command targets, and no blocking open questions.
        action: add_readiness_specific_audit
        tone: green
      - dimension: Delivery verification
        currentState: Command exitCode=0, runtime packets, trace counts, or completion packets can look like delivery proof.
        targetState: >-
          Delivery verification accepts only current evidence with command target collection, target-state trace
          closure, canonical surface reconciliation, and legacy substitution denial.
        action: fail_closed_delivery_verification
        tone: green
      - dimension: Closeout
        currentState: record_closed can be treated as a packaging event written by a non-terminal path.
        targetState: >-
          record_closed is written only by closeout_integrity_gate after current delivery_verified result and closeout
          acceptance.
        action: control_terminal_write
        tone: green
      - dimension: Renderer visibility
        currentState: >-
          The source can include currentState/targetState lists but leave currentTargetMap view pack disabled, hiding
          the comparison from HTML confirmation.
        targetState: >-
          The source enables currentTargetMap and provides structured rows that the renderer counts and shows before
          confirmation.
        action: make_current_target_view_mandatory
        tone: green
      - dimension: Legacy surfaces
        currentState: >-
          Legacy wrapper PASS, legacy events, legacy fields, and old closeout branches can be substituted for target
          behavior.
        targetState: >-
          Legacy surfaces are explicit negative assertions and fail delivery unless the confirmed target map declares a
          verified migration.
        action: deny_legacy_substitution
        tone: green
    targetFlow:
      - stepTitle: Assess scale
        description: >-
          assess_contract_authoring_scale.js decides single_pass, kernel_then_checkpoint, or
          kernel_then_checkpoint_with_amendment before authoring starts.
        output: scale-assessment.json
        ownerModel: requirements_contract_authoring
      - stepTitle: Author semantic kernel
        description: >-
          A compact global semantic pass captures goals, non-goals, business/governance requirements, registries,
          current/target summary, and blockers.
        output: semantic-kernel.json
        ownerModel: semantic_kernel_authoring_step
      - stepTitle: Audit and freeze IDs
        description: Kernel completeness and ID registry freeze must pass before any long-form checkpoint materializes source text.
        output: kernel-audit-and-drift-report.json
        ownerModel: kernel_drift_gate
      - stepTitle: Materialize checkpoints
        description: >-
          Each checkpoint writes only kernel-derived sections, validates drift, commits only the target source document,
          and records progress.
        output: semantic-checkpoint-progress.json
        ownerModel: run_semantic_checkpoints.js
      - stepTitle: Run full reconciliation
        description: >-
          The final source must prove prose, YAML, Mermaid, EVD, TRACE, CMD, and ART are a complete no-drift projection
          before HTML render.
        output: full-contract-reconciliation-report.json
        ownerModel: full_contract_reconciliation_gate
      - stepTitle: Render scope confirmation
        description: The HTML page renders current/target comparison and states that confirmability is not delivery readiness.
        output: confirmation.html
        ownerModel: render-requirements-confirmation-html.ts
      - stepTitle: Run stage-specific audits
        description: >-
          After confirmation, separate audit CLIs control implementation readiness, delivery verification, and closeout
          integrity without generic PASS reuse.
        output: stage-specific audit reports
        ownerModel: stage_specific_audit_cli
    canonicalArtifacts:
      - targetPathOrField: semantic-kernel.json
        functionDescription: Global semantic source for large requirements before checkpoint materialization.
        controlPlaneRole: authoring_semantic_source
        traceRows:
          - TRACE-018
        evidenceRefs:
          - EVD-018
      - targetPathOrField: implementationConfirmation.currentTargetMap
        functionDescription: >-
          Source-owned current/target comparison rendered in confirmation HTML and consumed by readiness/verification
          audits.
        controlPlaneRole: confirmed_target_map
        traceRows:
          - TRACE-010
        evidenceRefs:
          - EVD-010
      - targetPathOrField: reverse-audit-stage-decision-report.json
        functionDescription: >-
          Stage-specific audit decision with stage, verdict, allowedNextActions, blockedNextActions, and
          notValidForCloseout.
        controlPlaneRole: stage_decision
        traceRows:
          - TRACE-021
        evidenceRefs:
          - EVD-021
      - targetPathOrField: command-target-collection-report.json
        functionDescription: Proof that command evidence actually collected intended target files, globs, and tests.
        controlPlaneRole: command_evidence_gate
        traceRows:
          - TRACE-012
        evidenceRefs:
          - EVD-012
      - targetPathOrField: trace-closure-integrity-report.json
        functionDescription: Independent proof that trace rows close target-state assertions instead of completion packet claims.
        controlPlaneRole: trace_closure_gate
        traceRows:
          - TRACE-013
        evidenceRefs:
          - EVD-013
      - targetPathOrField: canonical-surface-reconciliation-report.json
        functionDescription: >-
          Proof that actual schema, reducer, writer, event, test, artifact, and state surfaces match the confirmed
          target map.
        controlPlaneRole: canonical_reconciliation_gate
        traceRows:
          - TRACE-014
        evidenceRefs:
          - EVD-014
      - targetPathOrField: legacy-substitution-denial-report.json
        functionDescription: >-
          Proof that legacy wrappers, events, fields, reducers, and old closeout branches cannot substitute for target
          behavior.
        controlPlaneRole: legacy_denial_gate
        traceRows:
          - TRACE-015
        evidenceRefs:
          - EVD-015
      - targetPathOrField: record-closed-write-receipt.json
        functionDescription: Controlled terminal receipt written only by closeout integrity after verified delivery.
        controlPlaneRole: terminal_control_receipt
        traceRows:
          - TRACE-016
        evidenceRefs:
          - EVD-016
    pathRegistry:
      - category: authoring_runtime
        fixedPath: _bmad-output/runtime/requirement-records/<recordId>/authoring/
        sourceOfTruthRole: authoring_intermediate_artifacts
        description: >-
          Scale assessment, checkpoint plans, progress, drift, reconciliation, and audit reports generated before or
          around authoring.
        traceRows:
          - TRACE-018
        evidenceRefs:
          - EVD-018
      - category: confirmation_record
        fixedPath: _bmad-output/runtime/requirement-records/<recordId>/confirmation/
        sourceOfTruthRole: scope_confirmation_artifacts
        description: Canonical confirmation HTML, summary, and render report consumed by confirm-scope.
        traceRows:
          - TRACE-024
        evidenceRefs:
          - EVD-024
      - category: controlled_record
        fixedPath: _bmad-output/runtime/requirement-records/<requirementSetId>/requirement-record.json
        sourceOfTruthRole: controlled_requirement_record
        description: Confirmed scope and later controlled runtime/delivery/closeout state.
        traceRows:
          - TRACE-016
        evidenceRefs:
          - EVD-016
      - category: event_log
        fixedPath: _bmad-output/runtime/requirement-records/<requirementSetId>/events/*.jsonl
        sourceOfTruthRole: append_only_control_events
        description: Confirmation, delivery verification, closeout integrity, and record_closed control events.
        traceRows:
          - TRACE-016
        evidenceRefs:
          - EVD-016
    existingArtifacts:
      - currentPath: legacy requirements-contract runtime confirmation root
        currentFunction: Previously used as an ad-hoc confirmation output path during authoring.
        targetTreatment: Invalid as user confirmation entry; regenerate confirmation under requirement-records canonical path.
        completionProofPolicy: not_completion_proof
        traceRows:
          - TRACE-024
        evidenceRefs:
          - EVD-024
      - currentPath: legacy requirements-contract runtime semantic-checkpoint-progress artifact
        currentFunction: Authoring resume and checkpoint status artifact.
        targetTreatment: Keep as authoring evidence only; it cannot confirm scope or close delivery.
        completionProofPolicy: not_completion_proof
        traceRows:
          - TRACE-004
        evidenceRefs:
          - EVD-004
      - currentPath: legacy requirements-contract runtime pre-render-global-consistency report
        currentFunction: Pre-render source consistency gate report.
        targetTreatment: May allow HTML render when PASS, but cannot become implementation or delivery proof.
        completionProofPolicy: not_completion_proof
        traceRows:
          - TRACE-007
        evidenceRefs:
          - EVD-007
      - currentPath: _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation-render-report.json
        currentFunction: Canonical render report for user scope confirmation.
        targetTreatment: >-
          Can support user confirmation only when confirmable and blockingIssues is empty; deliveryReadiness remains
          separate.
        completionProofPolicy: scope_only
      - currentPath: reverse_audit_contract.js
        currentFunction: Legacy wrapper or multipurpose audit entry.
        targetTreatment: >-
          Retain only as compatibility wrapper with deprecatedGenericPass and notValidForCloseout unless delegated
          delivery verification is verified.
        completionProofPolicy: not_completion_proof
        traceRows:
          - TRACE-022
        evidenceRefs:
          - EVD-022
    scriptConvergence:
      - scriptOrConfigPath: _bmad/skills/requirements-contract-authoring/scripts/assess_contract_authoring_scale.js
        currentFunction: Read-only size and interruption-risk assessment.
        targetOwnerModel: requirements_contract_authoring
        targetWritesOrOutputs: scale-assessment.json
        completionAuthority: authoring_route_only
      - scriptOrConfigPath: _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js
        currentFunction: Plan/status/run/resume checkpoint automation and pre-render gate.
        targetOwnerModel: requirements_contract_authoring
        targetWritesOrOutputs: semantic-checkpoint-plan.json, semantic-checkpoint-progress.json, pre-render-global-consistency-report.json
        completionAuthority: pre_render_only
      - scriptOrConfigPath: _bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown.js
        currentFunction: Definition-only drilldown before render.
        targetOwnerModel: requirements_contract_authoring
        targetWritesOrOutputs: grill-definition-decision-packet.json
        completionAuthority: definition_blocker_only
      - scriptOrConfigPath: _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts
        currentFunction: Read-only HTML confirmation projection.
        targetOwnerModel: html_confirmation_renderer
        targetWritesOrOutputs: confirmation.html, confirmation-summary.json, confirmation-render-report.json
        completionAuthority: scope_confirmation_only
      - scriptOrConfigPath: audit_contract_confirmability.js
        currentFunction: Not yet separated from legacy wrapper.
        targetOwnerModel: contract_confirmability_audit
        targetWritesOrOutputs: contract-confirmability-audit-report.json
        completionAuthority: scope_confirmation_only
      - scriptOrConfigPath: audit_implementation_readiness.js
        currentFunction: Not yet separated from legacy wrapper.
        targetOwnerModel: implementation_readiness_audit
        targetWritesOrOutputs: implementation-readiness-audit-report.json
        completionAuthority: implementation_start_only
      - scriptOrConfigPath: audit_delivery_verification.js
        currentFunction: Not yet separated from legacy wrapper.
        targetOwnerModel: delivery_verification_audit
        targetWritesOrOutputs: delivery-verification-closeout-integrity-report.json
        completionAuthority: delivery_verification_only
      - scriptOrConfigPath: audit_closeout_integrity.js
        currentFunction: Not yet separated from legacy wrapper.
        targetOwnerModel: closeout_integrity_gate
        targetWritesOrOutputs: record-closed-write-receipt.json
        completionAuthority: closeout_only
    requirementGeneration:
      - dimension: Complex reasoning
        currentState: Long-form document generation and checkpoint writing can happen before a frozen global semantic model exists.
        targetState: A compact semantic kernel captures the full reasoning first; checkpoints only materialize and verify it.
      - dimension: Iteration depth
        currentState: Definition drilldown can keep rediscovering issues across many manual rounds.
        targetState: >-
          Definition drilldown emits a decision packet, resolution record, changed-only filtering, duplicate
          suppression, and escalation instead of endless loop churn.
      - dimension: Recovery
        currentState: >-
          Checkpoint commits protect against rewrite failures, but they do not by themselves guarantee global semantic
          consistency.
        targetState: >-
          Each checkpoint keeps single-file commit recovery while global reconciliation prevents false pre-render
          readiness.
    facts:
      - currentState: A syntactically complete EVD/TRACE matrix can still be planned proof with no current implementation evidence.
        targetState: >-
          EVD/TRACE remains planned until current command target collection, trace closure, canonical reconciliation,
          and delivery verification verifies evidence.
      - currentState: HTML render success can be confused with delivery progress.
        targetState: HTML render confirms only scope and displays delivery_ready=false until controlled current evidence exists.
      - currentState: Legacy wrapper output can look terminal to callers.
        targetState: Legacy wrapper output is non-closeout evidence by default and must expose deprecation metadata.
    process:
      - phase: authoring
        currentState: Scale assessment and checkpoints exist, but semantic kernel and current/target rendering can be bypassed.
        targetState: >-
          Scale assessment routes to semantic kernel first, currentTargetMap is mandatory when applicable, and
          checkpoint drift is fail-closed.
      - phase: scope_confirmation
        currentState: HTML can be confirmable while hiding detailed current/target comparison if the view pack is disabled.
        targetState: HTML confirmation must render the detailed current/target comparison before the user is asked to confirm.
      - phase: implementation_readiness
        currentState: Readiness can be inferred from document completeness.
        targetState: Readiness is a separate audit that validates confirmed source sufficiency and remains notValidForCloseout.
      - phase: delivery_verification
        currentState: Delivery can be falsely inferred from exitCode=0, trace count, or packet claims.
        targetState: >-
          Delivery verification requires current evidence, target test collection, trace closure, canonical
          reconciliation, and legacy denial.
      - phase: closeout
        currentState: record_closed can be treated as evidence packaging.
        targetState: >-
          record_closed is a controlled event written only after closeout integrity accepts current delivery_verified
          result.
    artifactPaths:
      - path: _bmad-output/runtime/requirement-records/<recordId>/authoring/scale-assessment.json
        targetRole: authoring_input
      - path: _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-kernel.json
        targetRole: semantic_authority
      - path: _bmad-output/runtime/requirement-records/<recordId>/authoring/full-contract-reconciliation-report.json
        targetRole: pre_render_gate
      - path: _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation.html
        targetRole: scope_confirmation_view
      - path: _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation-render-report.json
        targetRole: scope_confirmation_report
      - path: _bmad-output/runtime/requirement-records/<requirementSetId>/requirement-record.json
        targetRole: controlled_record
      - path: >-
          _bmad-output/runtime/requirement-records/<recordId>/authoring/delivery-verification-closeout-integrity-report.json
        targetRole: delivery_verification_evidence
      - path: _bmad-output/runtime/requirement-records/<recordId>/authoring/record-closed-write-receipt.json
        targetRole: terminal_closeout_receipt
    architecture:
      - dimension: Semantic source of truth
        currentState: Long prose, trace tables, diagrams, and audit report can compete as parallel semantic sources.
        targetState: >-
          implementationConfirmation plus semantic-kernel.json are the controlled semantic sources; diagrams and prose
          are projections.
      - dimension: Audit responsibility
        currentState: A single global reverse audit can blur confirmability, readiness, delivery, and closeout.
        targetState: Four stage-specific audit CLIs own one verdict each and callers cannot reuse a generic PASS.
      - dimension: Runtime control
        currentState: Runtime packet or completion packet can claim closure without independent target-state proof.
        targetState: Only delivery verification and closeout integrity can promote current evidence and terminal state.
      - dimension: Path authority
        currentState: Authoring artifacts and confirmation artifacts can be mixed under separate runtime roots.
        targetState: >-
          requirement-records/<recordId>/authoring holds authoring intermediates;
          requirement-records/<recordId>/confirmation holds canonical confirmation;
          requirement-records/<requirementSetId> holds controlled records.
    currentState:
      canonicalFields:
        - reverse audit currently reports a generic PASS-like verdict for confirmability.
        - deliveryReadiness can be present as informational data without always becoming closeout-blocking evidence.
        - EVD/TRACE rows can be syntactically present while still relying on planned or smoke-only evidence.
        - Command exitCode can be observed without proving named target files existed or were collected.
        - >-
          Trace closed state can be written by runtime or completion packets without independent target-state
          reconciliation.
        - record_closed can be treated as evidence packaging instead of a controlled terminal transition.
        - >-
          Checkpoint steps can still perform local requirement discovery instead of materializing a global semantic
          kernel.
        - Core IDs can drift when generated incrementally across checkpoints.
        - >-
          reverse_audit_contract.js currently remains the dominant entry point and can be called with modes instead of
          separate stage-specific CLIs.
        - >-
          A caller can still mistake legacy wrapper output for the stage-specific delivery verification or closeout
          verdict unless deprecation metadata is enforced.
      schemas:
        - confirmation-render-report.json exposes blockingIssues, confirmability, and deliveryReadiness.
        - >-
          pre-render-global-consistency-report.json checks shallow ID, evidence, command, failure, edge, and view
          references.
        - No mandatory command-target collection manifest is required before command evidence.
        - >-
          No mandatory evidence trust state schema separates planned, observed, assertion_validated, and
          delivery_verified evidence.
        - No compact semantic-kernel.json is required before checkpoint materialization.
        - No full-contract reconciliation report proves the final document is a non-drifting kernel projection.
        - >-
          No mandatory reverse-audit stage CLI capability report proves contract confirmability, readiness, delivery
          verification, and closeout entry points are independent.
        - >-
          No mandatory wrapper compatibility report proves reverse_audit_contract.js output is non-closeout evidence by
          default.
      reducers:
        - pre-render checkpoint runner updates progress validation and blockers.
        - reverse audit consumes renderer authority and adds reverse-audit-only checks.
        - Trace closure and closeout can be inferred from packet contents rather than independent target-state gates.
        - >-
          Checkpoint runner can treat checkpoint progress as authoring progress even when kernel drift has not been
          checked.
        - >-
          Reverse audit stage selection can be represented as script options rather than separate reducers with
          independent verdict semantics.
      writerRegistries:
        - checkpoint runner writes assessment, plan, progress, receipt, and global gate reports.
        - confirmation renderer writes render artifacts but remains read-only for confirmation status.
        - record_closed writer authority is not restricted to closeout_integrity_gate in the requirement model.
        - Kernel amendment authority is not separated from direct prose mutation.
        - Compatibility wrapper authority is not explicitly separated from delivery verification and closeout authority.
      events:
        - contract_authoring_audit
        - contract_confirmability_audit
        - implementation_readiness_audit
        - delivery_verification_audit
        - closeout_integrity_gate
        - record_closed
        - semantic_kernel_created
        - kernel_drift_blocked
        - kernel_amendment_recorded
        - full_contract_reconciled
        - reverse_audit_stage_cli_checked
        - reverse_audit_wrapper_deprecated
        - stage_boundary_regression_checked
      scripts:
        - _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js
        - _bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown.js
        - _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js
        - _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts
      tests:
        - tests/acceptance/requirements-contract-checkpoint-automation.test.ts
        - tests/acceptance/reverse-audit-contract.test.ts
        - tests/acceptance/requirements-contract-authoring-skill-contract.test.ts
      evidenceArtifacts:
        - confirmation-render-report.json
        - pre-render-global-consistency-report.json
        - grill-definition-decision-packet.json
      userVisibleBehavior:
        - User can confirm scope only when contract confirmability passes.
        - User must not see scope confirmability presented as delivery completion.
      legacySurfaces:
        - generic reverse-audit PASS
        - single global reverse-audit CLI authority
        - reverse_audit_contract.js mode output as delivery verification evidence
        - trace row count as evidence closure
        - checkpoint count as pre-render readiness
        - planned proof as current_pass
        - exitCode=0 as delivery evidence
        - runtime packet as trace closure authority
        - completion packet as closeout authority
        - legacy event as canonical target event
        - checkpoint-local requirement invention
        - direct prose mutation after kernel freeze
    targetState:
      canonicalFields:
        - >-
          Every audit result declares stage, verdict, allowedNextActions, blockedNextActions, notValidForCloseout when
          applicable, and current hashes.
        - >-
          Every EVD declares gate command, independent oracle, target control flow, state/file/event assertions,
          negative assertion expectation, artifact refs, and current-attempt binding.
        - >-
          Every TRACE declares contractValidationCommandRefs and deliveryEvidenceCommandRefs, and remains planned or
          pending until delivery verification writes current_pass evidence.
        - >-
          Every required command evidence record binds explicit target files, collected-target manifest, commandRunRef,
          cwd, expanded globs, and artifact hashes.
        - Every current_pass trace row binds closureAssertions and an independent trace-closure report.
        - >-
          Every record_closed payload binds source hash, implementationConfirmation hash, delivery verification report
          hash, closeout report hash, requirement record hash, attempt id, verified trace row ids, command run refs, and
          evidence artifact hashes.
        - Every evidence item carries a trust state of planned, observed, assertion_validated, or delivery_verified.
        - Every large-document authoring run starts from a compact semantic kernel before checkpoint materialization.
        - >-
          Every checkpoint materialization step carries kernel hash, frozen ID registry hash, checkpoint id, and drift
          verdict.
        - Every final source document carries a full reconciliation report hash before HTML render.
        - >-
          Every reverse audit CLI result comes from one single-responsibility stage entry point with a unique stage and
          verdict vocabulary.
        - >-
          Every compatibility wrapper result declares deprecatedGenericPass when applicable and notValidForCloseout
          unless it delegates to a verified delivery verification result.
        - >-
          Every closeout input is rejected unless it is current delivery_verification=verified followed by
          closeout_integrity=accepted.
      schemas:
        - reverse-audit-stage-decision-report.json
        - product-grade-proof-matrix-audit-report.json
        - current-target-strictness-audit-report.json
        - delivery-verification-closeout-integrity-report.json
        - command-target-collection-report.json
        - trace-closure-integrity-report.json
        - canonical-surface-reconciliation-report.json
        - legacy-substitution-denial-report.json
        - record-closed-write-receipt.json
        - evidence-trust-state-report.json
        - semantic-kernel.json
        - kernel-audit-and-drift-report.json
        - full-contract-reconciliation-report.json
        - reverse-audit-stage-cli-capability-report.json
        - reverse-audit-wrapper-compatibility-report.json
        - stage-boundary-regression-report.json
        - confirmation-render-report.json#targetModificationPaths
      reducers:
        - contract confirmability reducer can only allow user scope confirmation.
        - >-
          implementation readiness reducer can only allow implementation when deliveryReadiness blockers are resolved
          for readiness stage.
        - >-
          delivery verification reducer can only mark verified when all trace rows are current_pass and
          missingEvidenceCount is zero.
        - closeout reducer can only accept delivery_verification=verified for the current closeout attempt.
        - command evidence reducer can only promote command output to observed after target collection passes.
        - trace state reducer can only promote rows to current_pass after trace closure integrity passes.
        - >-
          evidence trust reducer can only promote assertion_validated evidence to delivery_verified through delivery
          verification.
        - checkpoint materialization reducer can only mark checkpoints passed when kernel drift verdict is PASS.
        - kernel amendment reducer can only change frozen semantics through an amendment record followed by re-audit.
        - >-
          contract confirmability audit reducer can only emit contract_confirmable or not_confirmable and is always
          notValidForCloseout.
        - >-
          implementation readiness audit reducer can only emit ready_for_implementation or not_ready_for_implementation
          and is always notValidForCloseout.
        - >-
          delivery verification audit reducer can only emit verified or not_verified after current implementation
          evidence and target control-flow reconciliation.
        - >-
          closeout integrity reducer can only emit closeout_accepted from a current delivery verification report and
          must reject all wrapper, confirmability, readiness, and generic PASS results.
      writerRegistries:
        - Only delivery verification audit may promote planned or pending proof to current_pass.
        - Only closeout integrity gate may consume delivery_verified evidence as closeout approval.
        - Only closeout_integrity_gate may write record_closed.
        - >-
          Implementation runners, tests, summary writers, completion packet writers, and delivery evidence writers are
          forbidden from writing record_closed.
        - >-
          Checkpoint writers may materialize kernel content but cannot become semantic authority for new core
          requirements.
        - Kernel amendment writer is the only authority for post-freeze core requirement changes.
        - Only audit_contract_confirmability.js may produce contract confirmability verdicts.
        - Only audit_implementation_readiness.js may produce implementation readiness verdicts.
        - Only audit_delivery_verification.js may produce delivery verification verdicts.
        - Only audit_closeout_integrity.js may produce closeout acceptance verdicts and authorize record_closed.
        - reverse_audit_contract.js may only delegate or wrap and must never become terminal closeout authority.
      events:
        - contract_confirmable_not_valid_for_closeout
        - product_grade_proof_plan_validated
        - current_target_strictness_validated
        - command_targets_collected
        - trace_closure_verified
        - canonical_surface_reconciled
        - legacy_substitution_rejected
        - delivery_verification_blocked
        - delivery_verification_verified
        - closeout_integrity_blocked
        - closeout_integrity_accepted
        - record_closed
        - semantic_kernel_created
        - kernel_audit_passed
        - kernel_drift_detected
        - kernel_amendment_recorded
        - full_contract_reconciled
        - reverse_audit_stage_cli_checked
        - reverse_audit_wrapper_deprecated
        - stage_boundary_regression_checked
      scripts:
        - >-
          audit_contract_confirmability.js --source <source-document.md> --render-report
          <confirmation-render-report.json> --json
        - audit_implementation_readiness.js --source <source-document.md> --record <requirement-record.json> --json
        - >-
          audit_delivery_verification.js --source <source-document.md> --record <requirement-record.json> --evidence
          <evidence-artifacts> --json
        - >-
          audit_closeout_integrity.js --verification-report <delivery-verification-closeout-integrity-report.json>
          --json
        - reverse_audit_contract.js --mode implementation|readiness|delivery-verification --json
        - command_target_collection_gate --commands <requiredCommands.json> --json
        - trace_closure_integrity_gate --source <source-document.md> --evidence <evidence-artifacts> --json
        - >-
          canonical_surface_reconciliation_gate --source <source-document.md> --implementation <surface-manifest.json>
          --json
        - legacy_substitution_denial_gate --source <source-document.md> --implementation <surface-manifest.json> --json
        - delivery_verification_audit --source <source-document.md> --record <requirement-record.json> --json
        - closeout_integrity_gate --verification-report <delivery-verification-closeout-integrity-report.json> --json
        - >-
          evidence_trust_state_gate --source <source-document.md> --verification-report
          <delivery-verification-closeout-integrity-report.json> --json
        - semantic_kernel_authoring --source <source-document.md> --out <semantic-kernel.json> --json
        - >-
          kernel_drift_gate --kernel <semantic-kernel.json> --source <source-document.md> --checkpoint <checkpoint-id>
          --json
        - full_contract_reconciliation_gate --kernel <semantic-kernel.json> --source <source-document.md> --json
      tests:
        - Stage-specific reverse audit tests reject generic PASS for closeout.
        - Proof-matrix tests reject smoke-only and premature current_pass rows.
        - Current-target tests reject missing canonical mapping.
        - >-
          Delivery-verification tests reject missing tests, wrong control-flow coverage, stale hashes, incomplete trace
          closure, and missing evidence.
        - Command target tests reject missing named files and uncollected targets despite exitCode=0.
        - Trace closure tests reject completion packets without target-state assertions.
        - >-
          Canonical reconciliation tests reject missing schema, reducer, writer, event, test, artifact, or state
          transition surfaces.
        - Legacy denial tests reject legacy substitution for target canonical flow.
        - record_closed tests reject writers other than closeout_integrity_gate.
        - >-
          Evidence trust tests reject planned, observed, and assertion_validated-but-not-delivery_verified evidence for
          closeout.
        - >-
          Semantic kernel tests require large-document authoring to produce semantic-kernel.json before checkpoint
          materialization.
        - Kernel drift tests reject checkpoint-local semantic invention and frozen ID reinterpretation.
        - Full reconciliation tests reject final source documents that drift from or omit semantic kernel content.
        - Stage CLI tests reject any audit entry point that emits a generic PASS without stage-specific metadata.
        - >-
          Wrapper compatibility tests reject reverse_audit_contract.js as closeout evidence unless it delegates to
          delivery verification and receives verified.
        - >-
          Stage-boundary regression tests reject confirmability, readiness, generic PASS, deliveryReadiness=false,
          missing command targets, incomplete traces, missing evidence, legacy substitution, and self-certification for
          delivery verification and closeout.
        - >-
          Target modification path tests require explicit targetModificationPaths[] and reject
          artifactAutomationPlan-derived rows as substitutes.
      evidenceArtifacts:
        - ART-008
        - ART-009
        - ART-010
        - ART-011
        - ART-012
        - ART-013
        - ART-014
        - ART-015
        - ART-016
        - ART-017
        - ART-018
        - ART-019
        - ART-020
        - ART-021
        - ART-022
        - ART-023
        - ART-024
      userVisibleBehavior:
        - Confirmation HTML separates confirmability from deliveryReadiness near the top of the page.
        - Closeout can be presented only after a current delivery verification result exists.
        - >-
          Audit command names make the lifecycle stage explicit so users and runners do not infer delivery completion
          from scope confirmability.
        - Confirmation HTML shows the target modification path list before the user confirms implementation scope.
      legacySurfaces:
        - generic PASS becomes invalid as closeout evidence.
        - smoke-only execution becomes invalid as delivery evidence.
        - planned EVD/TRACE proof becomes invalid as executed proof.
        - exitCode=0 becomes invalid until command target collection passes.
        - runtime and completion packets become invalid as trace closure authority.
        - legacy events and old closeout branches become invalid as target canonical evidence.
        - checkpoint-local requirement invention becomes invalid as core semantic authority.
        - direct prose mutation after kernel freeze becomes invalid without kernel amendment.
        - single reverse_audit_contract.js authority becomes invalid as the productized audit interface.
        - wrapper mode output becomes invalid as delivery verification or closeout evidence by default.
    migrationAssertions:
      - id: MAP-001
        text: Generic PASS must be replaced by stage-specific verdicts.
        requirementRefs:
          - MUST-008
          - NEG-005
        evidenceRefs:
          - EVD-008
        traceRefs:
          - TRACE-008
        commandRefs:
          - CMD-REVERSE-STAGE-001
      - id: MAP-002
        text: >-
          Product-grade proof plan must be validated before HTML render and cannot become executed proof before delivery
          verification.
        requirementRefs:
          - MUST-009
          - NEG-006
        evidenceRefs:
          - EVD-009
        traceRefs:
          - TRACE-009
        commandRefs:
          - CMD-PROOF-MATRIX-001
      - id: MAP-003
        text: Current and target canonical surfaces must be complete before implementation readiness.
        requirementRefs:
          - MUST-010
        evidenceRefs:
          - EVD-010
        traceRefs:
          - TRACE-010
        commandRefs:
          - CMD-CURRENT-TARGET-001
      - id: MAP-004
        text: Closeout must consume only current delivery_verification=verified evidence.
        requirementRefs:
          - MUST-011
          - NEG-005
          - NEG-006
        evidenceRefs:
          - EVD-011
        traceRefs:
          - TRACE-011
        commandRefs:
          - CMD-DELIVERY-SEAL-001
          - CMD-CLOSEOUT-INTEGRITY-001
      - id: MAP-005
        text: Command evidence must be preceded by target existence and collection proof.
        requirementRefs:
          - MUST-012
          - NEG-007
        evidenceRefs:
          - EVD-012
        traceRefs:
          - TRACE-012
        commandRefs:
          - CMD-COMMAND-TARGET-001
      - id: MAP-006
        text: Trace closure must be independently verified against target-state assertions.
        requirementRefs:
          - MUST-013
          - NEG-008
        evidenceRefs:
          - EVD-013
        traceRefs:
          - TRACE-013
        commandRefs:
          - CMD-TRACE-CLOSURE-001
      - id: MAP-007
        text: Canonical implementation surfaces must reconcile with confirmed target surfaces before delivery verification.
        requirementRefs:
          - MUST-014
        evidenceRefs:
          - EVD-014
        traceRefs:
          - TRACE-014
        commandRefs:
          - CMD-CANONICAL-SURFACE-001
      - id: MAP-008
        text: Legacy control flow must be denied as target canonical evidence.
        requirementRefs:
          - MUST-015
          - NEG-009
        evidenceRefs:
          - EVD-015
        traceRefs:
          - TRACE-015
        commandRefs:
          - CMD-LEGACY-DENIAL-001
      - id: MAP-009
        text: record_closed must be written only by closeout integrity after current delivery verification.
        requirementRefs:
          - MUST-016
          - NEG-010
        evidenceRefs:
          - EVD-016
        traceRefs:
          - TRACE-016
        commandRefs:
          - CMD-RECORD-CLOSED-001
      - id: MAP-010
        text: >-
          Evidence trust states must prevent planned, observed, or assertion_validated-but-not-delivery_verified
          evidence from closing requirements.
        requirementRefs:
          - MUST-017
        evidenceRefs:
          - EVD-017
        traceRefs:
          - TRACE-017
        commandRefs:
          - CMD-EVIDENCE-TRUST-001
      - id: MAP-011
        text: Large-document authoring must create semantic-kernel.json before checkpoint materialization.
        requirementRefs:
          - MUST-018
        evidenceRefs:
          - EVD-018
        traceRefs:
          - TRACE-018
        commandRefs:
          - CMD-SEMANTIC-KERNEL-001
      - id: MAP-012
        text: Kernel completeness, frozen IDs, and checkpoint drift must be gated before checkpoint completion.
        requirementRefs:
          - MUST-019
          - NEG-011
        evidenceRefs:
          - EVD-019
        traceRefs:
          - TRACE-019
        commandRefs:
          - CMD-KERNEL-DRIFT-001
      - id: MAP-013
        text: >-
          Final source documents must reconcile with the semantic kernel, and core requirement changes must use kernel
          amendment.
        requirementRefs:
          - MUST-020
          - NEG-011
          - NEG-012
        evidenceRefs:
          - EVD-020
        traceRefs:
          - TRACE-020
        commandRefs:
          - CMD-FULL-RECONCILIATION-001
      - id: MAP-014
        text: Reverse audit must migrate from one global script authority to single-responsibility stage CLIs.
        requirementRefs:
          - MUST-021
          - NEG-013
        evidenceRefs:
          - EVD-021
        traceRefs:
          - TRACE-021
        commandRefs:
          - CMD-AUDIT-STAGE-CLI-001
      - id: MAP-015
        text: >-
          reverse_audit_contract.js must become a compatibility wrapper with deprecated generic PASS and non-closeout
          semantics.
        requirementRefs:
          - MUST-022
          - NEG-014
        evidenceRefs:
          - EVD-022
        traceRefs:
          - TRACE-022
        commandRefs:
          - CMD-AUDIT-WRAPPER-001
      - id: MAP-016
        text: >-
          Stage-boundary regression tests must prevent confirmability, readiness, generic PASS, and wrapper output from
          satisfying delivery verification or closeout.
        requirementRefs:
          - MUST-023
          - NEG-013
          - NEG-014
        evidenceRefs:
          - EVD-023
        traceRefs:
          - TRACE-023
        commandRefs:
          - CMD-AUDIT-STAGE-REGRESSION-001
  requiredCommands:
    - id: CMD-TEST-001
      command: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
    - id: CMD-TEST-002
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
    - id: CMD-ENCODING-001
      command: node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
      traceRows:
        - TRACE-020
      evidenceRefs:
        - EVD-020
    - id: CMD-REVERSE-STAGE-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-authoring-skill-contract.test.ts
      purpose: Validate stage-specific reverse audit outputs and reject generic PASS for closeout.
    - id: CMD-PROOF-MATRIX-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate product-grade EVD/TRACE proof-plan requirements and planned-vs-executed separation.
    - id: CMD-CURRENT-TARGET-001
      command: >-
        npx vitest run tests/acceptance/render-requirements-confirmation-html.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
        tests/acceptance/reverse-audit-contract.test.ts
      purpose: >-
        Validate strict current/target canonical mapping, HTML confirmation hard gate visibility, pre-render
        currentTargetMap blocking, and implementation-readiness mapping before implementation readiness.
    - id: CMD-DELIVERY-SEAL-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: >-
        Validate delivery verification fail-closed behavior for deliveryReadiness, trace closure, evidence, command
        targets, and target control-flow coverage.
    - id: CMD-CLOSEOUT-INTEGRITY-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate closeout accepts only current delivery_verified evidence after delivery_verification=verified.
    - id: CMD-COMMAND-TARGET-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: >-
        Validate command target existence, glob expansion, runner collection manifest, and commandRunRef binding before
        exit code can become evidence.
    - id: CMD-TRACE-CLOSURE-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: >-
        Validate trace closure assertions and reject implementation self-certification without independent target-state
        proof.
    - id: CMD-CANONICAL-SURFACE-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate canonical schema, reducer, writer registry, event, test, artifact, and state-transition reconciliation.
    - id: CMD-LEGACY-DENIAL-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: >-
        Validate legacy events, fields, reducers, gate checks, closeout branches, and diagnostic checks cannot
        substitute for target canonical flow.
    - id: CMD-RECORD-CLOSED-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate record_closed is written only by closeout integrity with current delivery verification payload.
    - id: CMD-EVIDENCE-TRUST-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: >-
        Validate planned, observed, assertion_validated, and delivery_verified evidence trust states and closeout-only
        delivery_verified consumption.
    - id: CMD-SEMANTIC-KERNEL-001
      command: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate semantic-kernel-first routing and semantic-kernel.json creation before checkpoint materialization.
    - id: CMD-KERNEL-DRIFT-001
      command: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate kernel completeness, frozen ID registry, and checkpoint drift blocking.
    - id: CMD-FULL-RECONCILIATION-001
      command: npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate final source document reconciliation against semantic-kernel.json and kernel amendment controls.
    - id: CMD-AUDIT-STAGE-CLI-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: >-
        Validate single-responsibility reverse audit CLI entry points, stage-specific verdicts, allowedNextActions,
        blockedNextActions, and exit semantics.
    - id: CMD-AUDIT-WRAPPER-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate reverse_audit_contract.js compatibility wrapper deprecation metadata and non-closeout semantics.
    - id: CMD-AUDIT-STAGE-REGRESSION-001
      command: >-
        npx vitest run tests/acceptance/reverse-audit-contract.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: >-
        Validate stage-boundary regressions so confirmability, readiness, generic PASS, not-ready delivery, missing
        command targets, incomplete traces, missing evidence, legacy substitution, and self-certification cannot close
        requirements.
    - id: CMD-TARGET-MODIFICATION-PATHS-001
      command: npx vitest run tests/acceptance/render-requirements-confirmation-html.test.ts
      purpose: >-
        Validate targetModificationPaths rendering, report projection, and fail-closed behavior when explicit target
        modification paths are missing.
    - id: CMD-AI-TDD-ERROR-CASE-001
      command: >-
        npx vitest run tests/acceptance/ai-tdd-contract-gate.test.ts
        tests/acceptance/requirements-contract-checkpoint-automation.test.ts
      purpose: Validate ContractExecutionManifest.errorCaseCoverage and fail-closed behavior for missing FAIL/EDGE mappings.
  suggestedCommands:
    - id: CMD-DRILLDOWN-001
      command: >-
        node _bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown.js --source
        <source-document.md> --json
    - id: CMD-GLOBAL-GATE-001
      command: >-
        node _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js --source
        <source-document.md> --progress <semantic-checkpoint-progress.json> --mode pre-render-gate --json
  closeoutReadinessPreview:
    requiredCommands:
      - CMD-TEST-001
      - CMD-TEST-002
      - CMD-ENCODING-001
      - CMD-REVERSE-STAGE-001
      - CMD-PROOF-MATRIX-001
      - CMD-CURRENT-TARGET-001
      - CMD-DELIVERY-SEAL-001
      - CMD-CLOSEOUT-INTEGRITY-001
      - CMD-COMMAND-TARGET-001
      - CMD-TRACE-CLOSURE-001
      - CMD-CANONICAL-SURFACE-001
      - CMD-LEGACY-DENIAL-001
      - CMD-RECORD-CLOSED-001
      - CMD-EVIDENCE-TRUST-001
      - CMD-SEMANTIC-KERNEL-001
      - CMD-KERNEL-DRIFT-001
      - CMD-FULL-RECONCILIATION-001
      - CMD-AUDIT-STAGE-CLI-001
      - CMD-AUDIT-WRAPPER-001
      - CMD-AUDIT-STAGE-REGRESSION-001
      - CMD-TARGET-MODIFICATION-PATHS-001
      - CMD-AI-TDD-ERROR-CASE-001
    orphanPolicy: >-
      Generated assessment, progress, receipt, and decision-packet artifacts must be requirement-scoped and cleaned
      according to retention strategy.
    currentAttemptPolicy: >-
      Only current source hash, implementationConfirmation hash, context hash, checkpoint commit hash, current
      resolution ledger, current requirement record hash, current command run refs, current evidence hashes, and current
      closeout attempt id may satisfy the gate.
  architectureImpacts:
    - component: requirements contract authoring skill workflow
      currentState: >-
        Large source-document authoring can mix global reasoning, checkpoint materialization, and render repair in one
        ambiguous flow.
      targetState: >-
        Scale assessment, semantic kernel, checkpoint materialization, drift checks, and full reconciliation become
        explicit staged control surfaces.
      impactType: workflow_architecture
      risk: high
      requiredDecision: >-
        Confirm that checkpoint automation is an execution strategy only and cannot reduce scope or bypass full
        reconciliation.
      linkedRequirements:
        - MUST-001
        - MUST-002
        - MUST-018
        - MUST-019
        - MUST-020
        - NEG-011
        - NEG-012
      linkedEvidence:
        - EVD-001
        - EVD-002
        - EVD-018
        - EVD-019
        - EVD-020
      ownerModel: requirements_contract_authoring
    - component: confirmation renderer and render report schema
      currentState: >-
        Confirmation HTML can become confirmable while critical current/target, targetModificationPaths, or AI-TDD
        manifest projections are missing or hidden.
      targetState: >-
        Renderer blocks confirmability when mandatory current/target map, target modification paths, or AI-TDD manifest
        sections are missing or have zero coverage.
      impactType: renderer_contract
      risk: high
      requiredDecision: >-
        Confirm renderer output remains scope-confirmation only and must expose mandatory projection coverage before
        user confirmation.
      linkedRequirements:
        - MUST-010
        - MUST-024
        - MUST-025
        - NEG-005
        - NEG-015
      linkedEvidence:
        - EVD-010
        - EVD-024
        - EVD-025
      ownerModel: html_confirmation_renderer
    - component: AI-TDD ContractExecutionManifest
      currentState: >-
        Readiness and closeout checks can define local completeness checklists that drift from the source document and
        renderer.
      targetState: >-
        Implementation readiness, delivery verification, closeout, renderer stage checks, and reverse audit consume the
        same ContractExecutionManifest sections.
      impactType: shared_schema
      risk: high
      requiredDecision: >-
        Confirm command targets, trace closure assertions, canonical surfaces, legacy denial, closeout proof, evidence
        trust, current/target map, and error cases are first-class manifest sections.
      linkedRequirements:
        - MUST-012
        - MUST-013
        - MUST-014
        - MUST-015
        - MUST-016
        - MUST-017
        - MUST-025
        - NEG-007
        - NEG-008
        - NEG-009
        - NEG-010
        - NEG-015
      linkedEvidence:
        - EVD-012
        - EVD-013
        - EVD-014
        - EVD-015
        - EVD-016
        - EVD-017
        - EVD-025
      ownerModel: ai_tdd_contract_gate
    - component: stage-specific reverse audit CLI boundary
      currentState: A legacy generic reverse audit PASS can be confused with implementation readiness or delivery completion.
      targetState: >-
        Contract confirmability, implementation readiness, delivery verification, and closeout integrity have separate
        reports, exit semantics, and allowed next actions.
      impactType: audit_boundary
      risk: high
      requiredDecision: >-
        Confirm generic PASS cannot close delivery and wrapper compatibility must be marked deprecated or not valid for
        closeout.
      linkedRequirements:
        - MUST-021
        - MUST-022
        - MUST-023
        - NEG-013
        - NEG-014
      linkedEvidence:
        - EVD-021
        - EVD-022
        - EVD-023
      ownerModel: requirements_contract_authoring
    - component: requirement record and control event lifecycle
      currentState: >-
        Record closeout can be over-trusted when evidence packets, command exits, or render reports self-certify
        completion.
      targetState: >-
        record_closed is written only by the closeout integrity gate after current delivery_verification=verified and
        all current attempt proof gates pass.
      impactType: runtime_control
      risk: high
      requiredDecision: >-
        Confirm requirement-record writes remain append-only controlled events with before/after hashes and cannot be
        driven by projections.
      linkedRequirements:
        - MUST-011
        - MUST-016
        - MUST-017
        - NEG-006
        - NEG-010
      linkedEvidence:
        - EVD-011
        - EVD-016
        - EVD-017
      ownerModel: closeout_integrity_gate
    - component: artifact path and control authority map
      currentState: >-
        Generated reports, compatibility paths, and historical output folders can be mistaken for canonical evidence or
        completion proof.
      targetState: >-
        requirement-records canonical paths, control authority roles, legacy denial rows, and target modification paths
        define what may be used as source, projection, evidence, or control.
      impactType: artifact_governance
      risk: medium
      requiredDecision: >-
        Confirm legacy paths and generated projections are visible but cannot substitute for canonical controlled
        records or delivery evidence.
      linkedRequirements:
        - MUST-010
        - MUST-015
        - MUST-024
        - NEG-009
        - NEG-015
      linkedEvidence:
        - EVD-010
        - EVD-015
        - EVD-024
      ownerModel: requirements_contract_authoring
  reconfirmationRequest: null
```
