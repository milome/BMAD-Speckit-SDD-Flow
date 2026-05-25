# Req Trace Matrix AI-TDD Execution Packet Compiler

Date: 2026-05-25
Status: Implementation Source Draft
Source request: Upgrade `req-trace-matrix-prompt-generator` from a prompt-only generator into a confirmed `implementationConfirmation` to AI-TDD Contract Execution Packet compiler.

## Scope Summary

This source document defines the confirmed-scope draft for upgrading `req-trace-matrix-prompt-generator` so AI execution receives a machine-readable execution packet, a human-readable prompt projection, and a generator audit receipt.

The target is not a looser natural-language prompt. The target is a productized compiler:

```text
confirmed implementationConfirmation
-> source/record validation
-> ContractExecutionManifest validation
-> execution packet compilation
-> model_packet.json + human_prompt.txt + audit_receipt.json
```

## Current Problem

The current generator emits a single natural-language execution prompt. It validates the confirmed inline `implementationConfirmation`, requirement-record confirmation history, semantic hashes, trace references, and command references, but the output still lets an execution model infer too much from prose and prompt text.

That creates four product risks:

1. Error cases can be omitted while happy-path traces still look complete.
2. `TRACE-*` rows can be executed without a structured RED/GREEN/REFACTOR state machine.
3. A completion packet, command exit code, stale evidence, or mock-only proof can be mistaken for closeout evidence by downstream execution.
4. Bugfix, standalone task, and story flows can still use old prompt templates when a confirmed `implementationConfirmation` exists.

## Target State

`req-trace-matrix-prompt-generator` becomes an AI-TDD Contract Execution Packet compiler. The compiler consumes only a confirmed implementation source document plus its controlled requirement record, then emits three synchronized outputs:

- `model_packet.json`: the machine-readable execution authority for AI execution.
- `human_prompt.txt`: the readable prompt projection over `model_packet.json`.
- `audit_receipt.json`: the generator self-audit receipt proving that source, record, hashes, trace coverage, acceptance coverage, AI-TDD manifest coverage, and current/target mapping passed.

Execution models must treat `model_packet.json` as the primary execution authority. `human_prompt.txt` helps the model and user read the plan, but it must not introduce, remove, shrink, or reinterpret anything absent from the packet.

## Non-Goals

- Do not make the generator execute implementation commands.
- Do not let the generator write runtime PASS, close trace rows, or write `record_closed`.
- Do not make `human_prompt.txt` the primary authority when `model_packet.json` exists.
- Do not make `audit_receipt.json` a delivery proof; it proves generator input/output validity only.
- Do not allow exit-code-only, mock-only, stale attempt, self-certification, legacy proof, smoke-only proof, or completion-packet self proof to satisfy closeout.
- Do not keep independent readiness or closeout completeness checklists that diverge from AI-TDD `ContractExecutionManifest`.
- Do not require real RED execution proof at generation time; the compiler only requires an `expected_red` declaration and a `redProofPlan`.

## Frozen Decisions

- The implementation source document remains the source authority through inline `implementationConfirmation`.
- The generator must require `status=user_confirmed` and a matching requirement-record confirmation history before producing execution artifacts.
- `model_packet.json` is mandatory and is the execution authority.
- `human_prompt.txt` is mandatory and is a projection over `model_packet.json`.
- `audit_receipt.json` is mandatory and records generator self-audit, not delivery verification.
- AI-TDD `ContractExecutionManifest` is mandatory whenever `applicability.aiTddContractGate.applies=true`.
- `currentTargetMap` is mandatory and must be projected into both the model packet and human prompt.
- Every `TRACE-*` slice must carry ACC/E2E/error-case/current-target/canonical/legacy/evidence-trust bindings.
- RED/GREEN/REFACTOR/CLOSEOUT is a structured state machine, not prose guidance.
- Bugfix, standalone tasks, and story skills must route confirmed `implementationConfirmation` sources through this compiler before implementation.

## Checkpoint Authoring Record

Scale assessment selected `checkpoint_required` with `authoringMode=kernel_then_checkpoint`. This document is authored through the semantic checkpoint sequence below before HTML render:

1. `cp-01-header-scope-decisions`
2. `cp-02-confirmation-core-applicability`
3. `cp-03-must-neg-out-evidence`
4. `cp-04-failure-edge-trace`
5. `cp-05-views`
6. `cp-06-artifacts-commands-closeout`
7. `cp-07-conditional-modules`
8. `cp-08-human-readable-views-dod-reverse-audit`

## Applicability Decisions

This requirement is a standalone task packet because it upgrades an existing local skill and generator script. It does not change a consuming product feature, database schema, external runtime service, dashboard scoring model, or SFT dataset.

`scriptsAndHooks.applies=true` because `_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js`, its Python compatibility launcher, generated host skill surfaces, and related acceptance tests must change.

`aiTddContractGate.applies=true` because the compiler must consume the latest AI-TDD `ContractExecutionManifest` standard and must not define separate readiness or closeout checklists.

`currentTargetMap.applies=true` because the user explicitly treats current/target comparison as a primary confirmation and anti-false-positive surface. The compiler must make the target execution surface visible in `model_packet.json`, `human_prompt.txt`, and `audit_receipt.json`.

`governanceEvents.applies=false` for this source document because the implementation does not add new controlled event types or writer permissions. It only defines generator outputs and prompt/compiler behavior. Runtime closeout remains delegated to existing AI-TDD gate, delivery verification, and closeout integrity controlled reports.

`runtimeRecovery.applies=false` because no resume, rerun, hook, active requirement resolver, or recovery context behavior is changed by this compiler upgrade.

## implementationConfirmation Draft

```yaml
implementationConfirmation:
  contractSchemaVersion: 1
  status: draft
  recordId: REQ-REQ-TRACE-AI-TDD-PACKET-COMPILER
  requirementSetId: REQ-REQ-TRACE-AI-TDD-PACKET-COMPILER
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: direct
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmationProfile: implementation_confirmation
  requiredViewPacks:
    - currentTargetMap
  optionalViewPacks: []
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  implementationConfirmationHash: null
  confirmationRender:
    htmlPath: null
    summaryPath: null
    reportPath: null
    htmlHash: null
    confirmationPhrase: null
  applicability:
    governanceEvents:
      applies: false
      reasonCode: no_new_control_event_type_required_for_prompt_compiler
    runtimeRecovery:
      applies: false
      reasonCode: no_resume_rerun_closeout_hook_ingest_or_trace_checkpoint_runtime_change
      requiresFunctionalResumeFailureCaseRegistry: false
      activeRequirementResolutionRequired: false
      retiredContextSurfaceForbidden: true
    scoringDashboardSft:
      applies: false
      reasonCode: no_scoring_dashboard_sft_dataset_or_read_model_changes
    currentTargetMap:
      applies: true
      reasonCode: requirements_contract_authoring_requires_visible_current_target_map
    scriptsAndHooks:
      applies: true
      reasonCode: req_trace_generator_scripts_and_skill_surfaces_change
    aiTddContractGate:
      applies: true
      reasonCode: compiler_must_emit_ai_tdd_contract_execution_packet
  must:
    - id: MUST-001
      text: "The generator must compile three synchronized outputs for every confirmed source: model_packet.json, human_prompt.txt, and audit_receipt.json."
      textZh: "生成器必须为每个已确认源文档编译三份同步产物：model_packet.json、human_prompt.txt 和 audit_receipt.json。"
      evidenceRefs: [EVD-001, EVD-009]
      coveredByTraceRows: [TRACE-001]
      acceptanceRefs: [ACC-001, E2E-001]
      coveredBySequenceViews: [SEQ-001]
      riskLevel: critical
    - id: MUST-002
      text: "model_packet.json must be the primary machine-readable execution authority, and human_prompt.txt must be only a readable projection over the packet."
      textZh: "model_packet.json 必须是机器可读主执行权威，human_prompt.txt 只能是该执行包的可读投影。"
      evidenceRefs: [EVD-001, EVD-002, EVD-009]
      coveredByTraceRows: [TRACE-001]
      acceptanceRefs: [ACC-001, E2E-001]
      coveredBySequenceViews: [SEQ-001]
      riskLevel: critical
    - id: MUST-003
      text: "audit_receipt.json must record the generator self-audit for source, requirement record, hashes, trace references, acceptance coverage, AI-TDD manifest coverage, currentTargetMap coverage, and emitted artifact hashes."
      textZh: "audit_receipt.json 必须记录生成器自审：source、requirement record、hash、trace 引用、验收覆盖、AI-TDD manifest 覆盖、currentTargetMap 覆盖和输出工件 hash。"
      evidenceRefs: [EVD-003, EVD-009]
      coveredByTraceRows: [TRACE-001]
      acceptanceRefs: [ACC-002, E2E-001]
      coveredBySequenceViews: [SEQ-001]
      riskLevel: critical
    - id: MUST-004
      text: "Source/Record Validator must require inline implementationConfirmation, status=user_confirmed, requirement-record confirmationHistory, matching semantic source and implementationConfirmation hashes, no blocking open questions, valid trace refs, and valid command refs."
      textZh: "Source/Record Validator 必须要求 inline implementationConfirmation、status=user_confirmed、requirement-record confirmationHistory、语义 source 和 implementationConfirmation hash 匹配、无阻断 open questions、trace refs 有效、command refs 有效。"
      evidenceRefs: [EVD-004, EVD-009]
      coveredByTraceRows: [TRACE-002]
      acceptanceRefs: [ACC-003, E2E-001]
      coveredBySequenceViews: [SEQ-002]
      riskLevel: critical
    - id: MUST-005
      text: "ContractExecutionManifest Validator must fail closed unless applicability.aiTddContractGate.applies=true, applicability.currentTargetMap.applies=true, failurePaths[], edgeCases[], acceptanceTests[], and e2eSuites[] are non-empty and closed over the confirmed IDs."
      textZh: "ContractExecutionManifest Validator 必须在 aiTddContractGate/currentTargetMap 适用声明、failurePaths、edgeCases、acceptanceTests、e2eSuites 非空且与确认 ID 闭环时才放行。"
      evidenceRefs: [EVD-005, EVD-009]
      coveredByTraceRows: [TRACE-003]
      acceptanceRefs: [ACC-004, E2E-001]
      coveredBySequenceViews: [SEQ-003]
      riskLevel: critical
    - id: MUST-006
      text: "Every MUST-* and NEG-* must have TRACE, EVD, ACC or E2E, and CMD coverage before packet generation succeeds."
      textZh: "每个 MUST-* 和 NEG-* 在执行包生成成功前必须具备 TRACE、EVD、ACC 或 E2E、CMD 覆盖。"
      evidenceRefs: [EVD-005, EVD-009]
      coveredByTraceRows: [TRACE-003]
      acceptanceRefs: [ACC-004]
      coveredBySequenceViews: [SEQ-003]
      riskLevel: critical
    - id: MUST-007
      text: "Every FAIL-* and EDGE-* must have NEG, EVD, TRACE, ACC or E2E, and CMD coverage before packet generation succeeds."
      textZh: "每个 FAIL-* 和 EDGE-* 在执行包生成成功前必须具备 NEG、EVD、TRACE、ACC 或 E2E、CMD 覆盖。"
      evidenceRefs: [EVD-005, EVD-009]
      coveredByTraceRows: [TRACE-003]
      acceptanceRefs: [ACC-004, ACC-005]
      coveredBySequenceViews: [SEQ-004]
      riskLevel: critical
    - id: MUST-008
      text: "Execution Packet Compiler must emit a structured model_packet.json containing execution metadata, source authority, immutable contract snapshot, AI-TDD manifest projection, TDD state machine, trace slice registry, error case matrix, acceptance/e2e matrix, currentTargetMap surface, canonical surfaces, legacy denial, evidence trust, runtime write policy, final gate matrix, blocking decision table, and completion evidence packet schema."
      textZh: "Execution Packet Compiler 必须输出结构化 model_packet.json，包含执行元数据、source authority、不可变契约快照、AI-TDD manifest 投影、TDD 状态机、trace slice 注册表、错误用例矩阵、ACC/E2E 矩阵、currentTargetMap、canonical surfaces、legacy denial、evidence trust、runtime write policy、final gate matrix、blocking decision table 和 completion evidence packet schema。"
      evidenceRefs: [EVD-001, EVD-006, EVD-009]
      coveredByTraceRows: [TRACE-004]
      acceptanceRefs: [ACC-001, ACC-006, E2E-001]
      coveredBySequenceViews: [SEQ-005]
      riskLevel: critical
    - id: MUST-009
      text: "Every trace slice in model_packet.json must include traceId, requirementRefs, negativeRequirementRefs, failurePathRefs, edgeCaseRefs, acceptanceRefs, e2eRefs, delivery command refs, artifactRefs, targetModificationPaths, currentTargetMapRefs, canonicalSurfaceRefs, legacyDenialRefs, expectedRedProofs, greenExitCriteria, refactorGuards, allowedRuntimeWrites, and forbiddenProofTypes."
      textZh: "model_packet.json 中每个 trace slice 必须包含 traceId、requirementRefs、negativeRequirementRefs、failurePathRefs、edgeCaseRefs、acceptanceRefs、e2eRefs、delivery command refs、artifactRefs、targetModificationPaths、currentTargetMapRefs、canonicalSurfaceRefs、legacyDenialRefs、expectedRedProofs、greenExitCriteria、refactorGuards、allowedRuntimeWrites 和 forbiddenProofTypes。"
      evidenceRefs: [EVD-006, EVD-009]
      coveredByTraceRows: [TRACE-004]
      acceptanceRefs: [ACC-006, E2E-001]
      coveredBySequenceViews: [SEQ-005]
      riskLevel: critical
    - id: MUST-010
      text: "The generated RED/GREEN/REFACTOR/CLOSEOUT state machine must require expected_red and redProofPlan at generation time, then require real current-attempt RED/GREEN/REFACTOR proof during execution."
      textZh: "生成的 RED/GREEN/REFACTOR/CLOSEOUT 状态机必须在生成阶段要求 expected_red 和 redProofPlan，并在执行阶段要求真实 current-attempt RED/GREEN/REFACTOR 证据。"
      evidenceRefs: [EVD-007, EVD-009]
      coveredByTraceRows: [TRACE-005]
      acceptanceRefs: [ACC-007, E2E-001]
      coveredBySequenceViews: [SEQ-006]
      riskLevel: critical
    - id: MUST-011
      text: "The generator must emit explicit BLOCK codes for missing applicability declarations, missing AI-TDD gate applicability, invalid trace acceptance binding, incomplete ContractExecutionManifest, missing target modification trace binding, missing closeout proof policy, missing red proof plan, invalid proof policy, and control store not ready for execution."
      textZh: "生成器必须为缺失 applicability、缺失 AI-TDD gate 适用声明、trace acceptance 绑定无效、ContractExecutionManifest 不完整、目标修改路径 trace 绑定缺失、closeout proof policy 缺失、red proof plan 缺失、proof policy 无效、control store 未准备好执行输出明确 BLOCK。"
      evidenceRefs: [EVD-008, EVD-009]
      coveredByTraceRows: [TRACE-006]
      acceptanceRefs: [ACC-008]
      coveredBySequenceViews: [SEQ-007]
      riskLevel: high
    - id: MUST-012
      text: "Bugfix, standalone tasks, and story skills must call the compiler when a confirmed implementationConfirmation exists, and legacy hand-written prompts may only be used as fallback when no confirmed implementationConfirmation exists."
      textZh: "bugfix、standalone tasks 和 story 技能在发现已确认 implementationConfirmation 时必须调用该编译器；旧手写提示词只能在没有已确认 implementationConfirmation 时作为 legacy fallback。"
      evidenceRefs: [EVD-011, EVD-012]
      coveredByTraceRows: [TRACE-008]
      acceptanceRefs: [ACC-010]
      coveredBySequenceViews: [SEQ-008]
      riskLevel: high
  notDone:
    - id: NEG-001
      text: "A single natural-language prompt must not be the only generated artifact for confirmed execution."
      textZh: "单一自然语言 prompt 不能作为已确认执行的唯一生成产物。"
      evidenceRefs: [EVD-001, EVD-002]
      whyItBlocksCompletion: "Prompt-only output leaves execution authority ambiguous and allows model inference drift."
      whyItBlocksCompletionZh: "仅输出 prompt 会让执行权威不清晰，并允许模型推断漂移。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-001]
      acceptanceRefs: [ACC-001]
    - id: NEG-002
      text: "Completion Evidence Packet, audit_receipt.json, command exit code, stdout, report render, or dashboard/read-model state must not be accepted as PASS or closeout authority."
      textZh: "Completion Evidence Packet、audit_receipt.json、命令退出码、stdout、报告渲染、dashboard/read-model 状态不得作为 PASS 或 closeout 权威。"
      evidenceRefs: [EVD-010]
      whyItBlocksCompletion: "These are evidence indexes or diagnostics, not delivery verification."
      whyItBlocksCompletionZh: "这些只是证据索引或诊断信号，不是交付核验。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-002]
      acceptanceRefs: [ACC-009]
    - id: NEG-003
      text: "Mock-only, self-certification, stale attempt evidence, legacy proof, smoke-only proof, and exitCode-only proof must not close any TRACE, NEG, FAIL, EDGE, ACC, E2E, or closeout state."
      textZh: "mock-only、self-certification、stale attempt evidence、legacy proof、smoke-only proof 和 exitCode-only proof 不得关闭任何 TRACE、NEG、FAIL、EDGE、ACC、E2E 或 closeout 状态。"
      evidenceRefs: [EVD-010]
      whyItBlocksCompletion: "Invalid proof types caused previous false-positive delivery risks."
      whyItBlocksCompletionZh: "无效证明类型会导致假阳性交付风险。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-003]
      acceptanceRefs: [ACC-009]
    - id: NEG-004
      text: "taskRefs completion must not equal requirement PASS."
      textZh: "taskRefs 完成不得等同于 requirement PASS。"
      evidenceRefs: [EVD-006, EVD-010]
      whyItBlocksCompletion: "Task completion can happen without oracle-bound requirement evidence."
      whyItBlocksCompletionZh: "任务完成可能没有绑定 oracle 的需求证据。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-002]
      acceptanceRefs: [ACC-006, ACC-009]
    - id: NEG-005
      text: "The executor must not rewrite confirmed source traceRows.status or source evidence fields to represent runtime PASS or MISSING_EVIDENCE."
      textZh: "执行器不得改写已确认源文档 traceRows.status 或源 evidence 字段来表示 runtime PASS 或 MISSING_EVIDENCE。"
      evidenceRefs: [EVD-006, EVD-010]
      whyItBlocksCompletion: "Confirmed trace rows are contract projection only."
      whyItBlocksCompletionZh: "已确认 trace rows 只是契约投影。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-004]
      acceptanceRefs: [ACC-009]
    - id: NEG-006
      text: "Any uncovered NEG, FAIL, or EDGE row must block packet closeout instructions."
      textZh: "任何未覆盖的 NEG、FAIL 或 EDGE 行必须阻断执行包 closeout 指令。"
      evidenceRefs: [EVD-005, EVD-008]
      whyItBlocksCompletion: "Error-case gaps are the primary happy-path-only false-positive source."
      whyItBlocksCompletionZh: "错误用例缺口是假阳性 happy-path-only 的主要来源。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-005]
      acceptanceRefs: [ACC-004, ACC-005, ACC-008]
    - id: NEG-007
      text: "A trace row without acceptanceRefs[] must not be compiled into an executable trace slice."
      textZh: "缺少 acceptanceRefs[] 的 trace row 不得被编译成可执行 trace slice。"
      evidenceRefs: [EVD-005, EVD-008]
      whyItBlocksCompletion: "Without acceptance binding, command execution can look complete without an oracle."
      whyItBlocksCompletionZh: "没有验收绑定时，命令执行可能看起来完成但没有 oracle。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-006]
      acceptanceRefs: [ACC-004, ACC-008]
    - id: NEG-008
      text: "An ACC-* or E2E-* row without expectedPreImplementationState=expected_red or redProofPlan must not be accepted for implementation execution."
      textZh: "缺少 expectedPreImplementationState=expected_red 或 redProofPlan 的 ACC-* 或 E2E-* 行不得被接受用于实施执行。"
      evidenceRefs: [EVD-007, EVD-008]
      whyItBlocksCompletion: "The generator must not ask the executor to fake red proof after implementation."
      whyItBlocksCompletionZh: "生成器不得要求执行器在实现后伪造红灯证明。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-007]
      acceptanceRefs: [ACC-007, ACC-008]
    - id: NEG-009
      text: "Legacy bugfix, standalone, or story prompts must not bypass the compiler when a confirmed implementationConfirmation exists."
      textZh: "存在已确认 implementationConfirmation 时，旧 bugfix、standalone 或 story prompt 不得绕过该编译器。"
      evidenceRefs: [EVD-011, EVD-012]
      whyItBlocksCompletion: "Bypass paths reintroduce prose-driven execution and inconsistent TDD coverage."
      whyItBlocksCompletionZh: "绕过路径会重新引入 prose-driven execution 和不一致的 TDD 覆盖。"
      negativeAssertionRequired: true
      coveredByFailurePath: [FAIL-008]
      acceptanceRefs: [ACC-010]
  mustNot:
    - id: OUT-001
      text: "This requirement does not authorize implementation execution, delivery verification, or closeout."
      textZh: "本需求不授权实施执行、交付核验或 closeout。"
      scopeBoundary: "source_document_authoring_only"
      userApprovalRequiredIfChanged: true
      coveredByBoundaryView: [BOUNDARY-001]
    - id: OUT-002
      text: "This requirement does not replace the existing confirmation ingest, AI-TDD gate, delivery verification, or closeout integrity writer."
      textZh: "本需求不替换现有 confirmation ingest、AI-TDD gate、交付核验或 closeout integrity writer。"
      scopeBoundary: "compiler_consumes_or_references_existing_gates"
      userApprovalRequiredIfChanged: true
      coveredByBoundaryView: [BOUNDARY-001]
    - id: OUT-003
      text: "This requirement does not make generated model_packet.json, human_prompt.txt, or audit_receipt.json valid closeout evidence by themselves."
      textZh: "本需求不使生成的 model_packet.json、human_prompt.txt 或 audit_receipt.json 自身成为有效 closeout 证据。"
      scopeBoundary: "generated_artifacts_are_execution_inputs_or_generator_receipts"
      userApprovalRequiredIfChanged: true
      coveredByBoundaryView: [BOUNDARY-002]
  evidence:
    - id: EVD-001
      text: "Acceptance tests prove the compiler writes model_packet.json, human_prompt.txt, and audit_receipt.json together for a confirmed source."
      textZh: "验收测试证明编译器会为已确认源文档同时写出 model_packet.json、human_prompt.txt 和 audit_receipt.json。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts"
      oracle: "The test asserts all three files exist, are hash-linked, and represent the same source/record/trace order."
      requiredCommandRefs: [CMD-TEST-001]
      artifactRefs: [ART-001, ART-002, ART-003, ART-004]
      acceptanceType: acceptance_contract
    - id: EVD-002
      text: "Tests prove human_prompt.txt is a projection over model_packet.json and cannot introduce unpacketized requirements."
      textZh: "测试证明 human_prompt.txt 是 model_packet.json 的投影，不能引入执行包外的需求。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts"
      oracle: "Prompt audit compares prompt sections against model packet sections and rejects extra authority."
      requiredCommandRefs: [CMD-TEST-001]
      artifactRefs: [ART-002, ART-004]
      acceptanceType: acceptance_contract
    - id: EVD-003
      text: "Tests prove audit_receipt.json records source/record/hash/coverage/manifest/currentTargetMap validations and emitted artifact hashes."
      textZh: "测试证明 audit_receipt.json 记录 source、record、hash、coverage、manifest、currentTargetMap 校验和输出工件 hash。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts"
      oracle: "Receipt contains validator decisions and outputHashes for all generated artifacts."
      requiredCommandRefs: [CMD-TEST-001]
      artifactRefs: [ART-003, ART-004]
      acceptanceType: acceptance_contract
    - id: EVD-004
      text: "Tests prove Source/Record Validator preserves current confirmed source, requirement-record, hash, open question, trace ref, and command ref blocking semantics."
      textZh: "测试证明 Source/Record Validator 保留当前已确认源文档、requirement-record、hash、open question、trace ref、command ref 阻断语义。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts tests/acceptance/requirements-confirmation-ingest.test.ts"
      oracle: "Existing confirmation-block regressions continue to pass and new packet output appears only after controlled ingest."
      requiredCommandRefs: [CMD-TEST-002]
      artifactRefs: [ART-001, ART-003]
      acceptanceType: regression_contract
    - id: EVD-005
      text: "Tests prove ContractExecutionManifest Validator blocks missing applicability, currentTargetMap, failurePaths, edgeCases, acceptanceTests, e2eSuites, and missing MUST/NEG/FAIL/EDGE closure."
      textZh: "测试证明 ContractExecutionManifest Validator 会阻断缺失 applicability、currentTargetMap、failurePaths、edgeCases、acceptanceTests、e2eSuites，以及缺失 MUST/NEG/FAIL/EDGE 闭环。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts tests/acceptance/ai-tdd-contract-gate.test.ts"
      oracle: "Each missing manifest section or broken mapping returns the expected BLOCK code."
      requiredCommandRefs: [CMD-TEST-003]
      artifactRefs: [ART-003, ART-006]
      acceptanceType: adversarial_contract
    - id: EVD-006
      text: "Tests prove model_packet.json includes full trace slice registry fields and runtime write policy."
      textZh: "测试证明 model_packet.json 包含完整 trace slice registry 字段和 runtime write policy。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts"
      oracle: "Every compiled trace slice contains required refs, guard fields, allowed writes, and forbidden proof types."
      requiredCommandRefs: [CMD-TEST-001]
      artifactRefs: [ART-001, ART-004]
      acceptanceType: acceptance_contract
    - id: EVD-007
      text: "Tests prove RED/GREEN/REFACTOR/CLOSEOUT state machine contains expected_red, redProofPlan, unexpected_green, and current-attempt proof requirements."
      textZh: "测试证明 RED/GREEN/REFACTOR/CLOSEOUT 状态机包含 expected_red、redProofPlan、unexpected_green 和 current-attempt 证据要求。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts tests/acceptance/ai-tdd-contract-gate.test.ts"
      oracle: "Missing redProofPlan blocks generation, while real red proof remains an execution-stage runtime/control-store responsibility."
      requiredCommandRefs: [CMD-TEST-003]
      artifactRefs: [ART-001, ART-002, ART-003]
      acceptanceType: adversarial_contract
    - id: EVD-008
      text: "Tests prove every new BLOCK case is emitted for its matching missing or invalid contract condition."
      textZh: "测试证明每个新增 BLOCK case 都会在对应缺失或无效契约条件下输出。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts"
      oracle: "BLOCK code snapshots match APPLICABILITY_DECLARATION_REQUIRED, AI_TDD_CONTRACT_GATE_REQUIRED, TRACE_ACCEPTANCE_BINDING_INVALID, CONTRACT_EXECUTION_MANIFEST_INCOMPLETE, TARGET_MODIFICATION_TRACE_BINDING_REQUIRED, CLOSEOUT_PROOF_POLICY_REQUIRED, PRE_IMPLEMENTATION_RED_PROOF_PLAN_REQUIRED, INVALID_PROOF_POLICY, and CONTROL_STORE_NOT_READY_FOR_EXECUTION."
      requiredCommandRefs: [CMD-TEST-001]
      artifactRefs: [ART-003]
      acceptanceType: adversarial_contract
    - id: EVD-009
      text: "End-to-end regression proves a valid confirmed source produces synchronized model packet, prompt, and receipt without reducing scope."
      textZh: "端到端回归证明有效已确认源文档会生成同步的 model packet、prompt 和 receipt，且不缩减范围。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts"
      oracle: "Output artifact hashes, trace order, source authority, and manifest sections are consistent across the three generated files."
      requiredCommandRefs: [CMD-TEST-001]
      artifactRefs: [ART-001, ART-002, ART-003, ART-004]
      acceptanceType: e2e_contract
    - id: EVD-010
      text: "Tests prove false-positive proof types cannot appear as allowed closeout proof in model_packet.json or human_prompt.txt."
      textZh: "测试证明假阳性证明类型不能在 model_packet.json 或 human_prompt.txt 中作为允许 closeout proof 出现。"
      gate: "npx vitest run tests/acceptance/req-trace-confirmation-block-generator.test.ts tests/acceptance/strict-closeout-proof-gate.test.ts"
      oracle: "The packet lists invalid proof taxonomy and routes closeout to AI-TDD gate, delivery verification, and closeout integrity reports only."
      requiredCommandRefs: [CMD-TEST-004]
      artifactRefs: [ART-001, ART-002, ART-003]
      acceptanceType: adversarial_contract
    - id: EVD-011
      text: "Skill contract tests prove bugfix, standalone tasks, and story flows call the compiler when a confirmed implementationConfirmation exists."
      textZh: "技能契约测试证明 bugfix、standalone tasks 和 story 流程在存在已确认 implementationConfirmation 时会调用该编译器。"
      gate: "npx vitest run tests/acceptance/requirements-contract-authoring-skill-contract.test.ts tests/acceptance/setup-global-skill-sync-contract.test.ts"
      oracle: "Skill docs and generated surfaces contain the confirmed-source routing rule and do not present legacy prompts as primary."
      requiredCommandRefs: [CMD-TEST-005]
      artifactRefs: [ART-005, ART-007, ART-008]
      acceptanceType: skill_contract
    - id: EVD-012
      text: "Encoding and sync checks prove the updated skill and script surfaces are UTF-8 clean and mirrored to installed surfaces."
      textZh: "编码和同步检查证明更新后的 skill 与 script surfaces UTF-8 干净并同步到安装 surfaces。"
      gate: "node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js"
      oracle: "Encoding integrity scan reports zero findings after edits."
      requiredCommandRefs: [CMD-ENCODING-001]
      artifactRefs: [ART-005, ART-007, ART-008]
      acceptanceType: encoding_integrity
  openQuestions: []
  failurePaths: []
  edgeCases: []
  traceRows: []
  acceptanceTests: []
  e2eSuites: []
  requirementBoundary:
    business:
      description: "No consuming-product behavior is changed; this is an execution-governance compiler upgrade."
      requirementIds: []
      viewRefs: []
      diagramRefs: []
    governance:
      description: "Prompt generation, execution packet compilation, AI-TDD manifest projection, and anti-false-positive execution governance."
      requirementIds: []
      viewRefs: []
      diagramRefs: []
  sequenceViews: []
  flowViews: []
  edgeCaseViews: []
  boundaryViews: []
  artifactAutomationPlan: []
  requiredCommands: []
  suggestedCommands: []
  closeoutReadinessPreview:
    requiredCommands: []
    orphanPolicy: "No generated packet, prompt, or receipt may count as closeout proof by itself."
    currentAttemptPolicy: "Delivery verification and closeout integrity must consume current-attempt controlled reports."
```
