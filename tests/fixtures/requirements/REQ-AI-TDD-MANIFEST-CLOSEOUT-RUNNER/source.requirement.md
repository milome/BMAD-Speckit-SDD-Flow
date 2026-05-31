# AI TDD Manifest Closeout Runner Requirement Fixture

This fixture is the tracked source for req-trace compiler tests. Tests copy it into a temporary `docs/requirements/**` path and materialize the matching runtime record before invoking the real generator.

```yaml
implementationConfirmation:
  contractSchemaVersion: 1
  status: user_confirmed
  recordId: REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER
  requirementSetId: REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: direct
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  requiredViewPacks:
    - currentTargetMap
  optionalViewPacks: []
  confirmedAt: '2026-05-26T17:21:58.718Z'
  confirmedBy: user
  sourceDocumentHash: fixture-populated-by-runtime-helper
  implementationConfirmationHash: fixture-populated-by-runtime-helper
  reconfirmationRequest: null
  confirmationRender:
    htmlPath: _bmad-output/runtime/requirement-records/REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER/confirmation/confirmation.html
    summaryPath: _bmad-output/runtime/requirement-records/REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER/confirmation/confirmation-summary.json
    reportPath: _bmad-output/runtime/requirement-records/REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER/confirmation/confirmation-render-report.json
    htmlHash: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    confirmationPhrase: |-
      确认以上范围进入下一阶段
  applicability:
    aiTddContractGate:
      applies: true
      reasonCode: fixture_requires_ai_tdd_manifest
    currentTargetMap:
      applies: true
      reasonCode: fixture_requires_current_target_map
    governanceEvents:
      applies: true
      reasonCode: fixture_records_requirement_runtime
  preConfirmationDrilldown:
    semanticKernelRef:
      path: ../authoring/semantic-kernel.json
    mustDecompositionPacketRef:
      path: ../authoring/must-decomposition-packet.json
    criticalAuditorReceiptRefs:
      - ../authoring/auditor-round-1.json
      - ../authoring/auditor-round-2.json
      - ../authoring/auditor-round-3.json
    packetSourceReconciliation:
      reportPath: ../authoring/packet-source-reconciliation-report.json
      verdict: pass
    reconciliationReportRef:
      path: ../authoring/packet-source-reconciliation-report.json
      decision: pass
      status: pass
    preRenderGateReportRef:
      path: ../authoring/pre-render-gate-report.json
  must:
    - id: MUST-001
      text: Manifest runner is the only required-command executor.
      evidenceRefs:
        - EVD-001
      coveredByTraceRows:
        - TRACE-001
  notDone:
    - id: NEG-001
      text: Legacy runner output must not close delivery.
      evidenceRefs:
        - EVD-002
      whyItBlocksCompletion: Legacy evidence can be stale or unrelated.
      negativeAssertionRequired: true
      coveredByFailurePath:
        - FAIL-001
  mustNot:
    - id: OUT-001
      text: Do not treat human prompt text as delivery proof.
      boundaryRefs:
        - TRACE-001
  evidence:
    - id: EVD-001
      text: Required command output and model packet prove manifest execution.
      gate: npx vitest run tests/acceptance/ai-tdd-contract-gate.test.ts
      oracle: Command output is current-attempt and artifact-bound.
      requiredCommandRefs:
        - CMD-VERIFY-AI-TDD-GATE
      artifactRefs:
        - ART-001
    - id: EVD-002
      text: Legacy denial is explicitly enforced.
      oracle: Legacy runner cannot act as closeout authority.
      requiredCommandRefs:
        - CMD-VERIFY-AI-TDD-GATE
      artifactRefs:
        - ART-LEGACY-001
  failurePaths:
    - id: FAIL-001
      linkedNegIds:
        - NEG-001
      linkedEvidenceIds:
        - EVD-002
      expectedBehavior: Legacy closeout proof remains blocked.
  edgeCases:
    - id: EDGE-001
      linkedFailurePathIds:
        - FAIL-001
      linkedEvidenceIds:
        - EVD-002
      expectedBehavior: Stale proof cannot satisfy current attempt.
  acceptanceTests:
    - id: ACC-001
      file: tests/acceptance/ai-tdd-contract-gate.test.ts
      commandRefs:
        - CMD-VERIFY-AI-TDD-GATE
      covers:
        - MUST-001
      failurePathRefs:
        - FAIL-001
      edgeCaseRefs:
        - EDGE-001
      traceRows:
        - TRACE-001
      evidenceRefs:
        - EVD-001
      expectedPreImplementationState: expected_red
      redProofPlan: Remove required command evidence and verify closeout blocks.
      oracle: Closeout gate reports missing current-attempt evidence.
  e2eSuites:
    - id: E2E-001
      file: tests/acceptance/main-agent-ai-tdd-closeout-remediation-adapter.test.ts
      commandRefs:
        - CMD-VERIFY-AI-TDD-GATE
      covers:
        - MUST-001
        - NEG-001
      failurePathRefs:
        - FAIL-001
      edgeCaseRefs:
        - EDGE-001
      traceRows:
        - TRACE-001
      evidenceRefs:
        - EVD-001
        - EVD-002
      expectedPreImplementationState: expected_red
      redProofPlan: Run without current-attempt deliveryEvidence.requiredCommands.
      oracle: Remediation must rerun manifest commands before closeout.
  atomicImplementationTaskList:
    - id: TASK-001
      text: Compile manifest-driven prompt and command evidence contract.
      traceRows:
        - TRACE-001
  mustToAtomicTaskMap:
    MUST-001:
      - TASK-001
    NEG-001:
      - TASK-001
  atomicTaskToTraceMap:
    TASK-001:
      - TRACE-001
  targetModificationPaths:
    - id: TARGET-001
      path: scripts/run-required-commands-from-ai-tdd-manifest.ts
      traceRows:
        - TRACE-001
      evidenceRefs:
        - EVD-001
      artifactRefs:
        - ART-001
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closeout-runner-fixture
    currentSummary:
      - id: CUR-001
        text: Legacy closeout runner is not delivery authority.
    targetSummary:
      - id: TGT-001
        text: Manifest runner owns required-command evidence.
    diffRows:
      - id: DIFF-001
        current: Legacy proof can be stale.
        target: Current-attempt manifest proof is required.
    process:
      - id: PROC-001
        text: Compile prompt, run command, record evidence, then closeout.
    artifactPaths:
      - id: ART-001
        path: scripts/run-required-commands-from-ai-tdd-manifest.ts
        traceRows:
          - TRACE-001
        evidenceRefs:
          - EVD-001
    canonicalArtifacts:
      - id: ART-001
        targetPathOrField: scripts/run-required-commands-from-ai-tdd-manifest.ts
        traceRows:
          - TRACE-001
        evidenceRefs:
          - EVD-001
        linkedRequirementIds:
          - MUST-001
    existingArtifacts:
      - id: ART-LEGACY-001
        currentPath: scripts/run-confirmed-final-required-commands.js
        completionProofPolicy: legacy_only
        traceRows:
          - TRACE-001
        evidenceRefs:
          - EVD-002
        linkedRequirementIds:
          - NEG-001
  requiredCommands:
    - id: CMD-VERIFY-AI-TDD-GATE
      command: npx vitest run tests/acceptance/ai-tdd-contract-gate.test.ts
      traceRows:
        - TRACE-001
      evidenceRefs:
        - EVD-001
        - EVD-002
      files:
        - tests/acceptance/ai-tdd-contract-gate.test.ts
      expectedMode: pass_after_implementation
  closeoutReadinessPreview:
    requiredCommands:
      - CMD-VERIFY-AI-TDD-GATE
    orphanPolicy: fail_closed
    currentAttemptPolicy: required
    recordClosedPolicy: terminal_event_required
  traceRows:
    - id: TRACE-001
      covers:
        - MUST-001
        - NEG-001
      evidenceRefs:
        - EVD-001
        - EVD-002
      taskRefs:
        - TASK-001
      acceptanceRefs:
        - ACC-001
        - E2E-001
      e2eRefs:
        - E2E-001
      failurePathRefs:
        - FAIL-001
      edgeCaseRefs:
        - EDGE-001
      contractValidationCommandRefs:
        - CMD-VERIFY-AI-TDD-GATE
      deliveryEvidenceCommandRefs:
        - CMD-VERIFY-AI-TDD-GATE
      artifactRefs:
        - ART-001
      targetModificationPaths:
        - TARGET-001
      currentTargetMapRefs:
        - ART-001
      canonicalSurfaceRefs:
        - ART-001
      legacyDenialRefs:
        - ART-LEGACY-001
      expectedRedProofs:
        - ACC-001
      allowedRuntimeWrites:
        - deliveryEvidence.requiredCommands
      forbiddenProofTypes:
        - exitCode_only
  aiTddContractExecutionManifestProjection:
    applies: true
    requiredSections:
      - preConfirmationDrilldownInputs
      - atomicImplementationTaskLineage
      - errorCaseCoverage
      - commandTargets
      - traceClosureAssertions
      - currentTargetMap
      - canonicalSurfaceReconciliation
      - legacyDenial
      - finalGateMatrix
      - executionLoopProtocol
      - semanticGapPolicy
      - hostExecutionHints
      - closeoutProof
      - evidenceTrustStates
    preConfirmationDrilldownInputs:
      semanticKernelRef: ../authoring/semantic-kernel.json
      mustDecompositionPacketRef: ../authoring/must-decomposition-packet.json
    atomicImplementationTaskLineage:
      requiredMaps:
        - mustToAtomicTaskMap
        - atomicTaskToTraceMap
    errorCaseCoverage:
      applies: true
    commandTargets:
      rows:
        - id: CMD-VERIFY-AI-TDD-GATE
          command: npx vitest run tests/acceptance/ai-tdd-contract-gate.test.ts
          files:
            - tests/acceptance/ai-tdd-contract-gate.test.ts
          traceRefs:
            - TRACE-001
          evidenceRefs:
            - EVD-001
    finalGateMatrix:
      gates:
        - id: GATE-001
          commandRef: CMD-VERIFY-AI-TDD-GATE
          required: true
    executionLoopProtocol:
      tddOrder:
        - RED
        - GREEN
        - REFACTOR
        - CLOSEOUT
      currentAttemptEvidenceRequired: true
    semanticGapPolicy:
      semanticChangeAction: reconfirm_required
      nonSemanticChangeAction: repair_and_rerun
    hostExecutionHints:
      codexCapable:
        goalModeAllowed: true
        goalObjectiveTemplate: Execute REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER by following goal_execution.md and model_packet.json until closeout evidence passes or reconfirm_required.
      codex:
        goalModeAllowed: true
        goalObjectiveTemplate: Execute REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER by following goal_execution.md and model_packet.json until closeout evidence passes or reconfirm_required.
        fallbackDirective: continue nonstop
      claudeCode:
        goalModeAllowed: true
        goalObjectiveTemplate: Execute REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER by following goal_execution.md and model_packet.json until closeout evidence passes or reconfirm_required.
      cursorIde:
        instruction: Cursor IDE Agent mode
      cursorCli:
        commandTemplate: cursor-agent -p --force --output-format stream-json
      nonCodex:
        instruction: Use model_packet.json as execution authority; continue repair loops without goal-mode commands.
    closeoutProof:
      requiredCommands:
        - CMD-VERIFY-AI-TDD-GATE
      allowedAuthorities:
        - AI_TDD_gate_report
        - delivery_verification_report
      forbiddenAuthorities:
        - exitCode_only
        - stdout_only
        - prompt_text
      policies:
        - current_attempt_required
      targetRefs:
        - ART-001
    evidenceTrustStates:
      applies: true
```
