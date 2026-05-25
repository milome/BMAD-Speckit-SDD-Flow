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
  must: []
  notDone: []
  mustNot: []
  evidence: []
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
