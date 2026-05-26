---
name: requirements-contract-authoring
description: Create or update confirmation-ready implementation source documents with an inline implementationConfirmation block, mandatory HTML confirmation view, ID-bound sequence/flow/artifact views, traceRows, evidence expectations, and reverse-audit checks. Use when preparing PRD/BUGFIX/TASKS/story documents for implementation, converting session requirements into a source document draft, auditing happy-path-only specs, or preventing MVP/toy/stub/mock-only delivery. Do not use as a separate authoritative requirements contract generator.
---

# Requirements Contract Authoring

## Purpose

Use this skill to create or update an implementation source document:

```text
implementation source document = human-readable context + machine-readable implementationConfirmation block
```

The source document itself is authoritative. Do not create a separate authoritative requirements contract, sidecar confirmation file, amendment file, or conversation-only implementation prompt.

If older project material says "requirements contract", treat it as a legacy alias for the inline `implementationConfirmation` block inside the implementation source document.

## Required Mindset

- Prevent MVP, toy demo, stub, mock-only, smoke-only, and happy-path-only specs.
- Do not let AI freely extract, rewrite, merge, shrink, summarize, or reinterpret requirements from prose.
- Keep requirement semantics in one place: `implementationConfirmation`.
- Use diagrams, steps, matrices, and trace rows only as views over `implementationConfirmation` IDs.
- Do not set `status: user_confirmed`; only explicit user confirmation may do that.
- Require `contractAuthoringRequired: true` for every `entryFlow`; bugfix and standalone task flows may bypass the full BMAD chain, but never user confirmation or traceRows.
- Bind every implementation task to existing `MUST` / `NEG` / `OUT` / `EVD` / `TRACE` / `ACC` / `E2E` IDs before implementation readiness.
- Before asking for confirmation, require the user to choose the confirmation language unless the user already explicitly selected it for this source document.
- Do not infer confirmation language from the conversation language, repository language, or document language.
- Render the confirmation page as mandatory HTML in the selected language; there is no Markdown/chat fallback.
- Treat HTML render failure, missing renderer, missing render report, or hash mismatch as a confirmation gate failure.
- Require the user to confirm in chat with the exact confirmation phrase plus current hashes from the HTML render report.
- Keep renderer output read-only for confirmation: it may show scope and hashes, but it must not mutate requirements or mark confirmation.
- Separate scope confirmation from delivery readiness. `confirmable` / `blockingIssues: []` means only that the requirements scope can be confirmed; it must never be presented or interpreted as implementation complete, launch ready, merge ready, or closeout ready.
- The confirmation page and render report must expose a distinct `deliveryReadiness` state. If there is no controlled requirement record, any missing current evidence, any stale evidence, any trace row that is not `current_pass`, or any required command/evidence is unavailable, delivery readiness must be `delivery_ready=false` with blocking reasons visible near the top of the HTML.
- Separate consumer/business requirements from governance/control requirements in the source document and in the confirmation HTML. A consuming project user must be able to see which IDs describe product behavior, user-facing flows, data/domain behavior, launch behavior, safety/abuse behavior, and which IDs describe confirmation governance, controlled ingest, evidence, gates, scripts, hooks, recovery, dashboards, or closeout mechanics.
- Do not let governance diagrams substitute for consumer/business diagrams. If the source document only renders inherited governance workflow, current/target governance maps, closeout gates, or confirmation machinery, it is not enough for a consumer project.
- Author the schema in this order: core fields first, `applicability.*` declarations second, then expand only the conditional domains marked `applies: true`.
- Treat `failurePaths[]` and `edgeCases[]` as core mandatory fields for every source document; they are not optional advanced runtime sections.
- Treat `currentTargetMap` as a mandatory first-class confirmation surface for every new or updated source document authored by this skill. `requiredViewPacks[]` must include `currentTargetMap`, `applicability.currentTargetMap.applies` must be `true`, `currentTargetMap.displayProfile` must be `closed_loop_current_target_map`, and the HTML confirmation page must show the current/target section before the user can confirm.
- Treat AI-TDD contract completeness as mandatory for every new or updated source document authored by this skill. `applicability.aiTddContractGate.applies` must be `true`; implementation readiness, delivery verification, closeout, renderer stage checks, and reverse-audit stage checks must consume the AI-TDD `ContractExecutionManifest` rather than inventing local checklist standards.
- `currentTargetMap` is also a first-class section of `ContractExecutionManifest`. It must be validated together with error-case coverage, command targets, trace closure, canonical surfaces, legacy denial, closeout proof, and evidence trust.
- Keep ordinary business/functional failure paths separate from the conditional `functionalResumeFailureCaseRegistry`.
- Use `contractValidationCommandRefs[]` and `deliveryEvidenceCommandRefs[]` in `traceRows[]`; do not use legacy `commandRefs[]` as the sole command authority.
- Treat `acceptanceTests[]` and `e2eSuites[]` as first-class contract rows. `CMD-*` says how to run, `ACC-*` / `E2E-*` says what is being accepted, `EVD-*` says why the result is trusted, and `TRACE-*` binds the slice.
- A `MUST-*` is not allowed to be only a sentence-level claim. Every `MUST-*` must first enter `must_decomposition_packet.json`, where it is split into atomic tasks, atomicity drivers, question coverage, and projection rows.
- `EVD-*`, `TRACE-*`, `ACC-*`, `E2E-*`, `failurePaths[]`, `edgeCases[]`, `currentTargetMap`, and `aiTddContractExecutionManifestProjection` must be same-origin projections from the synchronized `must_decomposition_packet.json`; they must not be independently invented in the source document.
- Critical Auditor is mandatory for confirmation-ready authoring. The convergence condition is `3` consecutive no-new-valid-gap receipts bound to the current input hash, plus deterministic `pre_render_must_decomposition_gate` `PASS`, plus packet/source reconciliation `pass`. Receipt count alone is not convergence.
- Every Critical Auditor round must consume a current deterministic gate dry-run before the request is written. The request must include the dry-run report path, dry-run hash, actionable blocker count, failed checks, reconciliation issue count, checked projection groups, and packet projection refs. If the dry-run exposes actionable blockers, a `no_new_*` response is forbidden unless `falsePositiveProofs[]` covers every blocker with machine-verifiable evidence.
- Critical Auditor rounds must use fixed attack perspectives instead of repeating the same generic prompt: round 1 checks MUST atomicity, over-broad tasks, and missing decomposition; round 2 checks EVD / TRACE / ACC / E2E / FAIL / EDGE / artifact / command / AI-TDD projection materialization; round 3 checks stale hash, authority bypass, negative boundary, reconfirmation, and delivery-vs-confirmation confusion.
- Critical Auditor responses are fail-closed. A no-new-gap response must include non-empty `reviewedProjectionRefs`, the current `gateDryRunHash`, the dry-run `reconciliationIssueCount`, all required `checkedProjectionGroups`, and `priorFindingsDisposition[]` entries classified only as `new`, `resolved`, `unchanged`, or `rejected`.
- If the source document, inline `implementationConfirmation`, semantic kernel, or packet hash changes, `authoring-repair` must automatically archive stale Critical Auditor requests, responses, receipts, and dry-run artifacts, then restart the three-round loop from round 1. Do not ask the user to manually delete or move stale audit artifacts.
- If the user asks to update an existing implementation source document and the edit changes `implementationConfirmation.must[]`, `notDone[]`, `evidence[]`, `traceRows[]`, `acceptanceTests[]`, `requiredCommands[]`, `currentTargetMap`, `aiTddContractExecutionManifestProjection`, governance event semantics, controlled ingest semantics, or closeout semantics, the agent MUST run `main-agent-orchestration --action authoring-repair --mode preserve-existing --source <source> --json` before reporting completion, unless the user explicitly requested draft-only editing.
- Draft-only output after a semantic source edit must be labeled exactly as not confirmation-ready:
  - `status: draft_updated_not_confirmation_ready`
  - `missing: pre-confirmation drilldown artifacts`
  - `next: main-agent-orchestration --action authoring-repair --mode preserve-existing --source <source> --json`
- Scripts may generate Critical Auditor round requests and validate response artifacts, but they must not fabricate no-new-gap receipts without a main-agent/LLM `critical-auditor-round-response-<n>.json` artifact.
- When governance events apply, require `governanceEventTypeRegistryPolicy` plus `governanceEventTypeRegistry[]`; every event type needs a `payloadContract` that passes the policy.
- `governanceEventTypeRegistryPolicy` must define `controlFieldVocabulary[]`, `payloadKindContracts[]`, `controlWriteModePolicies[]`, and `eventSpecificRequirements[]`; renderer, ingest, gates, hooks, workers, and tests must not keep a second hardcoded event or payload rule list.
- `controlFieldVocabulary[]` is the only policy-level vocabulary for control-shaped fields. A transport envelope that carries any vocabulary field at top level or under `payload` must be rejected unless the current event type lists that field in `writesControlFields[]`.
- When governance events or controlled ingest apply, require `controlledIngestWriterRegistry[]` as the only machine-readable authority for which writer may write control records. Event existence in `governanceEventTypeRegistry[]` is not enough to authorize any script.
- `controlledIngestWriterRegistry[]` entries must bind `writerId`, `scriptPath`, `scriptContentHash`, `allowedWriteApis[]`, `allowedPaths[]`, `allowedEventTypes[]`, `payloadContractRefs[]`, `writesControlFields[]`, `receiptPath`, `beforeAfterHashRequired: true`, `canModifyWriterRegistry: false`, `registryHash`, and `architectureConfirmationHash`.
- A writer that receives a registered but unowned event type must fail closed; it must not fall through to a default branch or reinterpret the event as gate, rerun, artifact, or closeout evidence.
- When runtime recovery applies or requires functional resume coverage, require source-defined `functionalResumeFailureCaseRegistry` groups, actions, failure cases, expected recovery actions, and record event types.
- When runtime governance or recovery applies, require active requirement/run resolution through `requirement-records/index.json` or explicit `recordId` / `requirementSetId` / `runId`; never rely on `_bmad-output/runtime/context/project.json`.
- Score, dashboard, SFT, report, summary, and hook receipt outputs are read models or evidence only; they do not close requirements unless a controlled gate writes `decision`.

## Operating Modes

Default to `author-confirmation-ready-source` when the user asks to generate a requirements contract document, requirement contract, or source document confirmation block.

- `author-confirmation-ready-source`: create or update the implementation source document with a complete inline `implementationConfirmation`, ID-bound views, artifact plan, evidence, failure paths, edge cases, trace rows, and applicable governance/runtime modules. This mode must first complete the pre-confirmation atomic decomposition loop; it must not directly write a long source document, must not directly write by chapter checkpoint, and single_pass also cannot skip the pre-confirmation atomic decomposition loop. Stop after draft quality checks unless the user already selected a confirmation language or explicitly asked to render.
- `render-confirmation`: render the HTML confirmation page only after the user selected a confirmation language.
- `ingest-confirmation`: ingest exact user confirmation text and hashes through the controlled confirm-scope path.
- `readiness-or-prompt`: run reverse audit, readiness gates, or prompt generation only after controlled confirmation ingest succeeds.

Do not collapse these modes into one long execution chain. "Generate requirements contract document" means author the confirmation-ready source document; it does not imply user confirmation, confirmation ingest, readiness, prompt generation, or closeout.

Internal stages are mandatory workflow phases, not user-facing manual commands:

- `semantic-kernel-authoring`: produce `_bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-kernel.json`.
- `atomic-decomposition-loop`: produce `_bmad-output/runtime/requirement-records/<recordId>/authoring/must_decomposition_packet.json`, invoke Critical Auditor with a current gate dry-run and the fixed round attack perspective, and iterate until current-hash `consecutiveNoNewGapRounds: 3` is reached.
- `packet-source-materialization`: materialize only synchronized packet projections into inline `implementationConfirmation`.
- `pre-render-drilldown-gate`: run `pre_render_must_decomposition_gate.js` after three bound no-new-gap receipts and block HTML rendering until the gate returns `PASS` and packet/source reconciliation returns `pass`.

## Confirmation-Ready Authoring Target

The target is not a loose draft. The target is a source document that is ready to render a confirmation page with minimal or no renderer repair.

Before writing long prose, design the renderer-facing structure:

- `must`, `notDone`, `mustNot`
- `evidence`
- `failurePaths`
- `edgeCases`
- `traceRows`
- `requirementBoundary`
- `sequenceViews`, `flowViews`, `edgeCaseViews`, and `boundaryViews`
- `artifactAutomationPlan`
- `requiredCommands`
- `closeoutReadinessPreview`
- conditional modules required by `applicability.*`

Human-readable prose, diagrams, tables, and summaries must explain these IDs. They must not introduce behavior, scope, evidence, or completion semantics absent from `implementationConfirmation`.

## Fact Collection Discipline

Use authority-first, expand-on-signal fact collection.

For each critical claim, identify at least one source:

- explicit user requirement
- existing source document
- authoritative implementation file
- acceptance/unit test or gate
- previously confirmed requirement source
- repository rule

Do not run broad repository searches before authoring. Prefer exact-symbol searches and narrow file reads. Expand search only when a key fact is missing, sources contradict each other, a renderer/validator reports a blocking issue, or the requirement changes shared contract, schema, runtime control, scoring, closeout, or controlled ingest behavior.

For repeated or interrupted authoring, reuse the already collected facts unless relevant files changed. Do not restart with broad discovery after every interruption.

## Skill Directory Resolution

Treat `<skill-dir>` as the directory that contains the `SKILL.md` loaded for this invocation. Resolve all skill-local scripts, references, fixtures, and assets from that directory at execution time.

Do not assume the skill is installed under `_bmad/skills`, `.codex/skills`, `~/.codex/skills`, or any other fixed root. Do not write a fixed local installation root into `implementationConfirmation.requiredCommands[]`, `controlledIngestWriterRegistry[].scriptPath`, receipts, or generated templates. Use `<skill-dir>/scripts/...` for executable command examples, or use a logical reference such as:

```yaml
commandRef:
  skill: requirements-contract-authoring
  script: scripts/render-requirements-confirmation-html.ts
```

Scripts inside this skill must locate sibling files with `__dirname` or the ESM equivalent `import.meta.url`. Runtime artifacts may keep repository-relative output paths such as `_bmad-output/...`; only the skill installation path must remain unresolved until execution.

## Chunked Authoring And Resume

Large or high-risk source documents must follow [semantic-checkpoint-workflow.md](references/semantic-checkpoint-workflow.md). That reference is part of this skill and is the normative checkpoint workflow for splitting source-document authoring before HTML render.

When scale assessment returns `checkpoint_required`, prefer the skill-local checkpoint runner over manual repetition:

```bash
node <skill-dir>/scripts/run_semantic_checkpoints.js \
  --source <source-document.md> \
  --assessment _bmad-output/runtime/requirement-records/<recordId>/authoring/scale-assessment.json \
  --progress _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-checkpoint-progress.json \
  --mode run \
  --until pre-render-ready \
  --json
```

Checkpoint automation is an execution strategy only. It must not reduce scope, omit required registries, omit negative assertions, omit renderer-facing views, or defer trace/evidence coverage.

Checkpointing is only persistence, recovery, single-file commit, and receipt strategy. Complex reasoning happens in the pre-confirmation atomic decomposition loop, not in chapter checkpoints.

Every checkpoint remains a bounded source-document edit followed by validation, a forced single-file commit, and a receipt. The runner may automate repeated steps, but it must not collapse checkpoint commits into one commit, stage unrelated files, or degrade checkpoint work into status-only progress markers when required source content is missing.

The semantic checkpoint sequence is:

- cp-00 semantic kernel
- cp-01 must_decomposition_packet
- cp-02 atomic decomposition loop convergence
- cp-03 packet-to-source materialization
- cp-04 ID freeze
- cp-05 implementationConfirmation core
- cp-06 EVD/TRACE/ACC/E2E/failure/edge/currentTarget/AI-TDD
- cp-07 human-readable views
- cp-08 pre-render global reconciliation

Checkpoint does not perform segmented reasoning; it persists and resumes the semantic-layer authoring artifacts.

If the runner behavior changes, update [semantic-checkpoint-workflow.md](references/semantic-checkpoint-workflow.md) in the same change so future skill executions do not follow stale process documentation.

## Authoritative Block

Every implementation source document must contain this inline block:

```yaml
implementationConfirmation:
  contractSchemaVersion: 1
  status: draft | user_confirmed | reconfirm_required
  recordId: REQ-...
  requirementSetId: REQ-...
  entryFlow: story | bugfix | standalone_tasks
  entryFlowClass: full_story_entry | corrective_entry | task_packet_entry
  workflowAdapter: bmad | speckit | direct | legacy
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN | en-US | bilingual
  confirmationProfile: implementation_confirmation
  requiredViewPacks: ["currentTargetMap"]
  optionalViewPacks: []
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  confirmationRender:
    htmlPath: null
    summaryPath: null
    reportPath: null
    htmlHash: null
    confirmationPhrase: null
  preConfirmationDrilldown:
    semanticKernelRef:
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-kernel.json
      hash: sha256:...
    mustDecompositionPacketRef:
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/must_decomposition_packet.json
      hash: sha256:...
      status: synchronized
    criticalAuditor:
      minimumRounds: 3
      consecutiveNoNewGapRounds: 3
      latestReceiptHash: sha256:...
      convergenceVerdict: bounded_no_new_gap
    packetSourceReconciliation:
      reportPath: _bmad-output/runtime/requirement-records/<recordId>/authoring/must_packet_source_reconciliation_report.json
      verdict: pass
    preRenderGateReportPath: _bmad-output/runtime/requirement-records/<recordId>/authoring/pre-render-must-decomposition-gate-report.json
  applicability:
    governanceEvents:
      applies: false
      reasonCode: no_governance_event_or_control_envelope_changes
    runtimeRecovery:
      applies: false
      reasonCode: no_resume_rerun_closeout_hook_ingest_or_trace_checkpoint_changes
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
      applies: false
      reasonCode: no_script_hook_report_or_generated_artifact_changes
    aiTddContractGate:
      applies: true
      reasonCode: requirements_contract_authoring_requires_ai_tdd_contract_execution_manifest
  must:
    - id: MUST-001
      text: "..."
      evidenceRefs: ["EVD-001"]
      coveredByTraceRows: ["TRACE-001"]
      coveredBySequenceViews: ["SEQ-001"]
  notDone:
    - id: NEG-001
      text: "..."
      evidenceRefs: ["EVD-002"]
      whyItBlocksCompletion: "..."
      negativeAssertionRequired: true
      coveredByFailurePath: ["FAIL-001"]
  mustNot:
    - id: OUT-001
      text: "..."
      scopeBoundary: "..."
      userApprovalRequiredIfChanged: true
  evidence:
    - id: EVD-001
      text: "..."
      gate: "..."
      oracle: "..."
      requiredCommandRefs: ["CMD-DELIVERY-001"]
      artifactRefs: ["ART-EVD-001"]
  openQuestions:
    - id: Q-001
      text: "..."
      blocksImplementation: true
  failurePaths:
    - id: FAIL-001
      title: "..."
      trigger: "..."
      expectedBehavior: "..."
      forbiddenBehavior: "..."
      blocksCompletionWhenViolated: true
      linkedNegIds: ["NEG-001"]
      linkedEvidenceIds: ["EVD-002"]
      requiredAssertions: ["..."]
  edgeCases:
    - id: EDGE-001
      category: invalid_input
      condition: "..."
      expectedBehavior: "..."
      forbiddenBehavior: "..."
      linkedFailurePathIds: ["FAIL-001"]
      linkedEvidenceIds: ["EVD-002"]
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: []
      evidenceRefs: ["EVD-001", "EVD-002"]
      contractValidationCommandRefs: ["CMD-CONTRACT-001"]
      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001"]
      acceptanceRefs: ["ACC-001"]
      sequenceViewRefs: []
      boundaryViewRefs: []
      artifactRefs: []
      status: PENDING
  acceptanceTests:
    - id: ACC-001
      file: "tests/acceptance/example.test.ts"
      covers: ["MUST-001", "NEG-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001", "EVD-002"]
      commandRefs: ["CMD-DELIVERY-001"]
      expectedPreImplementationState: expected_red
      oracle: "Acceptance behavior fails on old implementation and passes with current-attempt evidence."
      positiveControl: true
      negativeControls: ["NEG-001"]
      mockOnly: false
  e2eSuites:
    - id: E2E-001
      file: "tests/e2e/example.spec.ts"
      covers: ["MUST-001"]
      traceRows: ["TRACE-001"]
      evidenceRefs: ["EVD-001"]
      commandRefs: ["CMD-E2E-001"]
      expectedPreImplementationState: expected_red
      oracle: "End-to-end user-visible flow proves the acceptance path."
      positiveControl: true
      negativeControls: []
      mockOnly: false
  requirementBoundary:
    business:
      description: "..."
      requirementIds: []
      viewRefs: []
      diagramRefs: []
    governance:
      description: "..."
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
    orphanPolicy: "..."
    currentAttemptPolicy: "..."
```

Allowed status transitions:

```text
draft -> user_confirmed
user_confirmed -> reconfirm_required
reconfirm_required -> user_confirmed
```

If any ID text changes, any ID is deleted, IDs are merged/split, or scope/proof semantics change, reset `status` to `draft` or `reconfirm_required`.

## Workflow

### 1. Identify The Source

Use one of two inputs:

- Existing PRD / BUGFIX / TASKS source document path.
- Current session requirement description with no source document.

When there is no source document, create a source document draft first:

- PRD-like source for feature/product requirements.
- BUGFIX-like source for bugs.
- TASKS-like source for standalone work.

Conversation requirements must not go directly to implementation or prompt generation.

### 2. Create Or Update `implementationConfirmation`

Work only inside the implementation source document.

Before writing the source document body, build the ID matrix:

- `MUST-*`: positive behavior that must exist.
- `NEG-*`: negative assertion or missing behavior that blocks completion.
- `OUT-*`: explicit scope boundary or forbidden expansion.
- `EVD-*`: evidence and oracle.
- `FAIL-*`: failure path.
- `EDGE-*`: edge case.
- `TRACE-*`: implementation slice.
- `CMD-*`: validation command.
- `ART-*`: artifact or automation output.
- `ACC-*`: acceptance, integration, or contract test suite that proves requirement behavior.
- `E2E-*`: end-to-end test suite that proves user-visible or cross-boundary behavior.

Every `MUST-*` and `NEG-*` must have evidence, trace coverage, at least one view, and at least one `ACC-*` or `E2E-*` coverage row. Every `NEG-*` must have a failure path and a negative-control assertion. `OUT-*` must not appear in `traceRows[].covers`; bind it through `boundaryViews[]`, `boundaryViewRefs[]`, or `boundaryRefs[]`.

Authoring order is mandatory:

1. Write core fields: status, entryFlow, IDs, `must`, `notDone`, `mustNot`, `evidence`, `failurePaths`, `edgeCases`, `traceRows`, views, artifact plan, commands, and closeout preview.
2. Declare every `applicability.*` domain with `applies` and `reasonCode`.
3. Expand only the conditional domains whose `applies` value is `true`.

Never omit an applicability domain to imply it is irrelevant. Use `applies: false` plus a concrete `reasonCode` only for domains that are not mandatory for this skill. For this skill, `currentTargetMap` and `aiTddContractGate` are mandatory and must be authored with `applies: true`.

Conditional expansion rules:

- `governanceEvents.applies=true`: define or reference `governanceEventTypeRegistryPolicy`, `governanceEventTypeRegistry[]`, and `controlledIngestWriterRegistry[]`; every event type needs `payloadContract` and every control field vocabulary / payload kind / control write mode / event-specific rule must be declared in the policy. Every event type that writes control fields must be covered by at least one registered writer.
- `runtimeRecovery.applies=true` or `requiresFunctionalResumeFailureCaseRegistry=true`: define `functionalResumeFailureCaseRegistry` with source-defined groups, failure cases, recovery actions, expected recovery actions, and record event types.
- `runtimeRecovery.applies=true`: define `activeRequirementResolution` or reference the project-standard Active Requirement Resolver; startup must locate the current requirement through explicit IDs or `_bmad-output/runtime/requirement-records/index.json`, then verify `requirement-record.json`, `runtimePolicySnapshotRef`, `recoveryContextRef`, trace checkpoint, and bmad workflow projection hashes.
- `scoringDashboardSft.applies=true`: define score/dashboard/SFT read-model boundaries and state why they cannot reverse-drive closeout.
- `currentTargetMap.applies=true`: define source-driven current/target rows; do not rely on renderer hardcoded rows. This is mandatory for this skill, not an optional view. Include `schemaVersion: current-target-map/v1`, `displayProfile: closed_loop_current_target_map`, `currentSummary[]`, `targetSummary[]`, at least three `diffRows[]`, `process[]`, `artifactPaths[]`, `canonicalArtifacts[]`, and `existingArtifacts[]` with trace/evidence bindings where they describe proof or target implementation surfaces.
- `scriptsAndHooks.applies=true`: define visible script/hook/artifact outputs, ownerModel, input/output artifacts, event types, fallback, and control/evidence role.
- `aiTddContractGate.applies=true`: define enough data for the AI-TDD `ContractExecutionManifest`: `errorCaseCoverage`, `commandTargetCollection`, `traceClosureAssertions`, `currentTargetMap`, `canonicalSurfaceReconciliation`, `legacyDenial`, `closeoutProof`, and `evidenceTrustStates`. Do not define separate readiness or closeout completeness lists outside the manifest.

For an existing source document:

- Read the whole source document.
- Create or update the inline `implementationConfirmation` block in the same document.
- Leave `status: draft` unless the user explicitly confirms the final confirmation page.
- If a previously confirmed block changes semantically, set `status: reconfirm_required`.

For session-only input:

- Create a new implementation source document draft.
- Add the inline `implementationConfirmation` block with `status: draft`.
- Do not create a separate requirements contract.
- Do not set `status: user_confirmed` until explicit user confirmation.

### 3. Add Human-Readable Views

Human-readable views are mandatory confirmation surfaces. They must include:

- Happy-path sequence view.
- Failure/negative-path sequence view.
- State or flow view.
- Edge case view.
- Evidence overview.
- E2E acceptance overview.
- Requirement boundary overview that separates consumer/business scope from governance/control scope.
- Business requirement views for the consuming project's actual product behavior, not just inherited governance workflow.
- Governance requirement views for confirmation, controlled ingest, evidence, gates, scripts, hooks, recovery, dashboard, scoring, SFT, and closeout behavior.
- Artifact and automation plan view.
- Current-vs-target comparison when the source concerns workflow, governance, scripts, hooks, reports, dashboard, scoring, or SFT behavior.

Every requirement-bearing diagram message, business step, state transition, failure path, or evidence statement must reference one or more IDs from `implementationConfirmation`.

Example:

```mermaid
sequenceDiagram
  actor User
  participant System
  User->>System: Upload valid file [MUST-001]
  System-->>User: File appears in list [MUST-001]
  User->>System: Upload empty file [NEG-001]
  System-->>User: Show error and persist nothing [NEG-001]
```

If a diagram or prose introduces behavior without a confirmation ID, either add it to `implementationConfirmation` as `draft` and ask for confirmation, or mark it as a blocking question. Do not silently implement it.

Diagrams are views only. They must not introduce requirement semantics that are absent from `implementationConfirmation`. Every diagram node, edge, branch, business transition, artifact write, script call, hook observation, and failure path must map to `MUST`, `NEG`, `OUT`, or `EVD` IDs.

Business/governance separation rules:

- `requirementBoundary.business.requirementIds[]` must list the IDs a consuming project user should read to understand product behavior and acceptance boundaries.
- `requirementBoundary.governance.requirementIds[]` must list IDs that exist to control the implementation process, confirmation, gates, evidence, automation, or runtime governance.
- `sequenceViews[]`, `flowViews[]`, `edgeCaseViews[]`, and `boundaryViews[]` should set `scope: business | governance | mixed` when the boundary is not obvious.
- A view with product behavior, user-visible behavior, corpus/domain behavior, ingest/chat domain flow, security/abuse behavior, or launch behavior belongs in the business group even if CI or Worker participants appear in the diagram.
- A view about confirmation state, requirement record control, controlled ingest writers, governance event payloads, current/target governance migration, closeout evidence, score/dashboard/SFT read models, or hook/recovery mechanics belongs in the governance group.
- `scope: mixed` is allowed only when the view deliberately shows the interface between business behavior and governance controls; the title or description must state that boundary.
- The confirmation HTML must render a dedicated boundary section plus separate business and governance diagram sections. A single combined "business visuals" bucket is not sufficient.
- Business diagrams must be present and independently visible; governance diagrams cannot substitute for product-behavior coverage.
- Business-scoped failure paths and edge cases stay in the business bucket even if they mention `gate`, `failure`, `budget`, `rate limit`, `origin`, or `recovery`; do not promote a consumer behavior diagram into governance just because it uses `NEG` / `OUT` IDs.
- If business IDs exist, the business visual section must contain at least one product-behavior Mermaid view, and business failure / edge diagrams must remain visible there even when the source also contains governance diagrams.
- Explicit `scope` or view metadata wins over title keywords. Keyword heuristics are fallback-only and must never collapse business visuals into governance visuals.
- If a source document only renders inherited governance workflow, current/target governance maps, closeout gates, or confirmation machinery, it does not satisfy consumer-project confirmation.
- If business IDs exist but no business-scoped diagram or view exists, the confirmation page must show a blocking issue before confirmation.
- If governance IDs exist but no governance boundary view exists, the confirmation page must show a blocking issue before implementation readiness.
- If the source document contains both business and governance views, the renderer must preserve both buckets instead of collapsing them into inferred-governance-only output.

The Artifact and Automation Plan View must make planned outputs visible before implementation. Include each planned artifact, script, hook, report, dashboard, score, SFT output, producer, consumer, path, `ownerModel`, `sourceOfTruthRole`, `inputArtifacts`, `outputArtifacts`, `recordEventTypes`, whether it may affect control flow, retention/cleanup rule, and orphan risk. Old script outputs may be evidence/context/projection/compatibility/schema/derived artifacts only; they must not directly control main-agent state.

When planned work touches runtime governance, hooks, no-hook execution, recovery, bmad-help routing, dashboard, scoring, or SFT, the artifact plan must also show:

- `scripts/resolve-active-requirement.ts` or the equivalent skill/project resolver as the startup locator.
- `_bmad-output/runtime/requirement-records/index.json` as locator projection only.
- `_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json` as the reloaded control record.
- `_bmad-output/runtime/requirement-records/<requirement-set-id>/recovery/runtime-policy-snapshot.json`.
- `_bmad-output/runtime/requirement-records/<requirement-set-id>/recovery/recovery-context.json`.
- A hard rule that `_bmad-output/runtime/context/**` is not read, written, migrated, or used as fallback.

### 4. Build `traceRows`

`traceRows` are execution mapping rows, not another requirements expression.

Rules:

- Preserve the source document's confirmation IDs.
- Reference `must`, `notDone`, and `evidence` IDs.
- `traceRows[].covers` must only contain `MUST-*` and `NEG-*` IDs. Do not put `OUT-*` / `mustNot` boundary IDs in `covers`.
- For `mustNot` boundary verification, keep `traceRows[].covers` empty if the row is boundary-only, put the proof in `evidenceRefs[]`, and bind the boundary through `boundaryViewRefs[]` or `boundaryRefs[]` that point to `boundaryViews[].covers`.
- A boundary-only trace row is valid when it has `boundaryViewRefs[]` / `boundaryRefs[]`, `evidenceRefs[]`, `taskRefs[]`, and command refs. The renderer must derive `OUT-*` trace coverage from `boundaryViewRefs[] -> boundaryViews[].covers`.
- Do not restate new requirement semantics in trace rows.
- Do not invent requirements to make trace rows look complete.
- Keep rows `PENDING` until implementation evidence exists.
- Split commands into `contractValidationCommandRefs[]` and `deliveryEvidenceCommandRefs[]`.
- `contractValidationCommandRefs[]` prove that the contract, views, trace rows, and renderer output are valid.
- `deliveryEvidenceCommandRefs[]` prove the implemented behavior in the current closeout attempt.
- Legacy `commandRefs[]` may be read for compatibility by older reports, but it must not be the only command field in newly authored source documents.

### 4a. Pre-Render Completeness Check

Before rendering HTML, verify the source document against confirmation-page blocking rules:

Run the pre-confirmation atomic decomposition loop first. This loop produces `semantic-kernel.json`, `must_decomposition_packet.json`, Critical Auditor requests/responses/receipts, per-round deterministic gate dry-run reports, packet/source reconciliation, and a deterministic pre-render MUST decomposition gate report. The loop is mandatory for both checkpoint and single_pass scale decisions.

Run the deterministic definition drilldown first:

When authoring a source document, run scale assessment before deciding whether to use a single authoring pass or semantic checkpoint authoring:

```bash
node <skill-dir>/scripts/assess_contract_authoring_scale.js \
  --source <source-document.md> \
  --out _bmad-output/runtime/requirement-records/<recordId>/authoring/scale-assessment.json \
  --json
```

If the decision is `checkpoint_required`, use the semantic checkpoint runner before HTML render. Checkpoint mode must create a single-file Git commit for each completed checkpoint and write a progress record for resume:

```bash
node <skill-dir>/scripts/run_semantic_checkpoints.js \
  --source <source-document.md> \
  --assessment _bmad-output/runtime/requirement-records/<recordId>/authoring/scale-assessment.json \
  --progress _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-checkpoint-progress.json \
  --mode plan|status|run|resume \
  --until pre-render-ready \
  --json
```

The runner must stop before commit if staged files contain any path other than the active target requirements document.

Before the HTML renderer can produce a confirmable page, run:

```bash
node <skill-dir>/scripts/pre_render_must_decomposition_gate.js \
  --source <source-document.md> \
  --authoring-dir _bmad-output/runtime/requirement-records/<recordId>/authoring \
  --json
```

The gate reads `semantic-kernel.json`, `must_decomposition_packet.json`, `critical-auditor-receipt-round-*.json`, inline `implementationConfirmation`, and packet/source reconciliation state. The final gate writes `must_decomposition_receipt.json`, `must_packet_source_reconciliation_report.json`, and `pre-render-must-decomposition-gate-report.json`. Per-round Critical Auditor dry-runs must write round-scoped dry-run files and must not be treated as final confirmation readiness.

The gate is deterministic and fail-closed. It verifies schema, source hashes, task split, question coverage, packet projection materialization, Critical Auditor convergence, and two-way packet/source reconciliation. It must block on missing semantic kernel, missing packet, stale packet hash, missing Critical Auditor receipt, fewer than three no-new-gap rounds, unresolved validated gap, incomplete question coverage, `actualTaskCount < expectedTaskCount`, over-broad atomic task, missing packet projection, source row independently invented, packet projection not materialized, missing packet/source reconciliation, or any stale gate report.

Each Critical Auditor request must embed the current dry-run summary:

- `gateDryRunHash`
- dry-run `verdict`, `failedChecks`, `actionableBlockingIssueCount`, and blocker refs
- reconciliation `verdict`, `issueCount`, and `checkedGroups`
- all packet projection groups and projection refs
- the fixed round attack perspective

Each response must echo the dry-run binding and checked surfaces. The response is invalid if `reviewedProjectionRefs[]` is empty, `gateDryRunHash` does not match the request, `reconciliationIssueCount` differs from the dry-run, any required projection group is missing from `checkedProjectionGroups[]`, or `priorFindingsDisposition[]` is absent or uses a value outside `new/resolved/unchanged/rejected`.

Do not count stale or unbound receipts. When source, `implementationConfirmation`, semantic kernel, or packet hash changes, archive existing `critical-auditor-round-request-*.json`, `critical-auditor-round-response-*.json`, `critical-auditor-receipt-round-*.json`, and round dry-run artifacts under a stale Critical Auditor archive directory, then restart at round 1.

```bash
node <skill-dir>/scripts/pre_render_definition_drilldown.js \
  --source <source-document.md> \
  --out _bmad-output/runtime/requirement-records/<recordId>/confirmation/grill-definition-report.json \
  --previous-report _bmad-output/runtime/requirement-records/<recordId>/confirmation/grill-definition-report.previous.json \
  --resolutions _bmad-output/runtime/requirement-records/<recordId>/confirmation/grill-definition-resolutions.json \
  --changed-only \
  --max-new-blockers 10 \
  --emit-decision-packet _bmad-output/runtime/requirement-records/<recordId>/confirmation/grill-definition-decision-packet.json \
  --json
```

Treat unresolved blocking findings as authoring blockers before HTML render. This is the deterministic automation equivalent of a `grill-with-docs` pass: it checks root/source-local/`CONTEXT-MAP.md` glossary conflicts, vague terms, unresolved command authority refs, direct contradiction matrix findings, and external side effects that lack timeout/failure/idempotency/recovery/evidence semantics.

Do not increase drilldown rounds to chase the same blocker repeatedly. The pre-render gate must converge by stable finding fingerprints, a resolution ledger, blocker clusters, and explicit stop reasons:

- Every finding and question has a stable `fingerprint` and `clusterId`.
- `--previous-report` plus `--changed-only` reports only newly discovered blockers and suppresses unchanged fingerprints from the previous report.
- `--resolutions` may suppress a finding only when its status is `resolved`, `waived`, `converted_to_open_question`, or `converted_to_out_boundary`, and the ledger entry includes the current source, implementationConfirmation, and context hashes.
- `--max-new-blockers` limits emitted blockers for review load while preserving total/new/suppressed/truncated counts in `convergence`.
- `--emit-decision-packet` writes `remainingBlockingClusters` and recommended actions (`convert_to_open_question`, `add_out_boundary`, `split_requirement`, `add_evidence_oracle`) so the loop stops at a decision packet instead of continuing to ask forever.
- Stop reasons must distinguish `no_new_blockers`, `blocking_definition_questions_found`, `warning_only`, and `no_blocking_definition_questions`.

Ask the user only for remaining decision-packet clusters that cannot be resolved from existing source, glossary, ADR, code, tests, or repository rules.

- `implementationConfirmation` is valid YAML.
- Core arrays are present and non-empty: `must`, `notDone`, `mustNot`, `evidence`, `failurePaths`, `edgeCases`, and `traceRows`.
- Every `MUST-*` and `NEG-*` has evidence and trace coverage.
- Every `MUST-*` and `NEG-*` has `acceptanceTests[]` or `e2eSuites[]` coverage.
- Every `NEG-*` has a linked failure path.
- Every evidence item has an oracle and command refs.
- `traceRows[].covers` contains only `MUST-*` and `NEG-*`.
- Every `traceRows[].acceptanceRefs[]` resolves to `ACC-*` or `E2E-*`.
- `OUT-*` is bound only through boundary views or boundary refs.
- Applicability domains are all declared.
- Conditional modules exist when `applies: true`.
- Governance event types that write control fields have controlled writers.
- Runtime recovery has functional resume failure cases when required.
- Mermaid diagrams reference only declared IDs and use renderer-compatible labels.
- Business and governance views are both present when both requirement groups exist.
- Read models, dashboard green, score green, stdout, HTTP 200, page render, and mock calls are not treated as acceptance evidence.
- Every source row follows `MUST -> packet -> projections -> source rows`.
- Packet/source reconciliation checks `packet projection -> implementationConfirmation row` and `implementationConfirmation row -> packet projection`.
- A source row independently invented outside packet projections blocks confirmation.
- A packet projection not materialized into the source blocks confirmation.

If a pre-render check fails, fix the source document before invoking the renderer. If the user already selected a confirmation language, render immediately after this check and repair renderer blocking issues until the page is confirmable or a real blocker is found.

### 5. Select Confirmation Language

Before rendering the HTML confirmation page, ask the user to choose the confirmation language unless the user already explicitly selected it for this source document.

Use a short choice prompt:

```text
请选择确认页语言：
1. 中文
2. English
3. 中英双语
```

Rules:

- Do not proceed to confirmation page display until the user chooses a language or explicitly states an equivalent choice.
- Do not treat the user's normal conversation language as an implicit language selection.
- Preserve the selected language for this source document's confirmation flow.
- If the implementation source document is later changed semantically and confirmation must be regenerated, reuse the previously selected language unless the user asks to change it.

### 6. Render The HTML Confirmation Page

Before readiness or prompt generation, render a low-burden HTML confirmation page. Use the skill-local renderer:

```bash
node <skill-dir>/scripts/render-requirements-confirmation-html.ts \
  --source <source-document.md> \
  --out _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation.html \
  --language zh-CN \
  --record-id <recordId> \
  --entry-flow <story|bugfix|standalone_tasks> \
  --mode confirmation
```

The renderer is part of this skill. Do not create or call a root-level `scripts/render-requirements-confirmation-html.ts` wrapper.

If the consuming project does not yet contain the skill-local renderer, do not fall back to chat confirmation. Instead, mark readiness as blocked by `confirmation_html_renderer_missing` and ask to install, sync, or provide the skill renderer.

If the renderer reports missing core fields, missing `applicability`, missing `failurePaths[]`, missing `edgeCases[]`, missing or invalid `governanceEventTypeRegistryPolicy`, missing or invalid `controlledIngestWriterRegistry[]`, invalid `payloadContract`, missing conditional runtime recovery registry, invalid trace command split, missing Mermaid runtime, or any blocking issue, stop before readiness. Do not proceed to implementation prompt generation.

Required outputs:

- `confirmation.html`
- `confirmation-summary.json`
- `confirmation-render-report.json`

The renderer must follow [html-confirmation-renderer-spec.md](references/html-confirmation-renderer-spec.md). It is a read-only renderer and must not modify the source document, set `status: user_confirmed`, write gate decisions, or create control events.

The HTML must answer:

- What am I confirming?
- What is explicitly not done or cannot count as done?
- Which requirements are consumer/business requirements, and which are governance/control requirements?
- Which diagrams describe the consuming project's business behavior, and which diagrams describe governance machinery?
- Is business logic complete, including failure paths?
- How will each requirement be verified?
- What files, scripts, hooks, reports, dashboards, score outputs, and SFT outputs will AI generate or touch?
- Which artifacts affect control flow and which are evidence/read-model only?
- What is the gap between current and target state?
- After confirmation, what may the agent do and what is forbidden?

### 6a. Prepare Architecture Confirmation Page When Architecture Confirmation Applies

When the current requirement needs full architecture confirmation or an existing `architectureConfirmationState` is stale, use the skill-local prepare entry. Do not ask the user to run `architecture_confirmation_state_checked`, manually generate architecture JSON, or call the renderer directly as the normal workflow.

```bash
node <skill-dir>/scripts/prepare-architecture-confirmation-page.ts \
  --source <source-document.md> \
  --requirement-record _bmad-output/runtime/requirement-records/<recordId>/requirement-record.json \
  --run-id <runId> \
  --target-paths <json-array-or-file> \
  --consumer-impact-scan <json-array-or-file> \
  --governance-impact-scan <json-array-or-file> \
  --full-architecture-trigger-matrix <json-array-or-file> \
  --out _bmad-output/runtime/requirement-records/<recordId>/architecture/architecture-confirmation-<runId>.html \
  --language zh-CN \
  --json
```

The prepare entry is part of this skill. It must automatically:

- record `architecture_confirmation_state_checked` through controlled ingest before rendering,
- generate requirement-scoped `architecture-confirmation-<runId>.json`,
- render the user-facing architecture confirmation HTML,
- write a prepare report with the internal step results and the user-facing confirmation instruction.

The user-facing next step is only to open the architecture confirmation HTML and confirm the hashes in chat. Do not expose stale check or JSON producer commands as manual user steps.

The architecture JSON producer and renderer are also part of this skill. Do not create temporary scripts, hand-written HTML, or root-level wrappers to generate or render architecture confirmation pages.

Required outputs:

- `architecture-confirmation-<runId>.json`
- `architecture-confirmation-<runId>.html`
- `architecture-confirmation-<runId>.summary.json`
- `architecture-confirmation-<runId>.render-report.json`
- `architecture-confirmation-<runId>.prepare-report.json`

The architecture JSON producer must only generate the evidence artifact. It must not write `architectureConfirmationState`, append `architectureConfirmations[]`, write `confirmationHistory[]`, or mark architecture confirmation active.

The architecture renderer is a read-only projection over `architecture-confirmation-<runId>.json`. It must not write `requirement-record.json`, change `architectureConfirmationState`, append `architectureConfirmations[]`, write `confirmationHistory[]`, or mark architecture confirmation active.

The page must show the requirement-scoped decision, consumer impact scan, governance impact scan, full architecture trigger matrix, target paths, hash recipe, stale input hashes, risk statement, rollback plan, evidence refs, exact confirmation phrase, and artifact metadata.

If the prepare entry, producer, or architecture renderer reports missing core fields, hash mismatch, recipe mismatch, missing impact scans, missing trigger matrix, or missing target paths, stop before Implementation Readiness. Do not use an older architecture HTML projection or a manually assembled fallback page.

### 7. Confirm In Chat With Hashes

Do not treat silence, opening the HTML, lack of objection, or clicking inside HTML as confirmation.

The user must reply in chat with the exact phrase shown in the render report plus the current source and HTML hashes, for example:

```text
确认以上范围进入实施准备 sourceDocumentHash=<sha256> confirmationHtmlHash=<sha256>
```

Rules:

- The confirmation phrase and hashes must match `confirmation-render-report.json`.
- The HTML must be generated from the current source document hash.
- `confirmability=confirmable` or `blockingIssues: []` confirms only the requirements scope. Before any claim of completion, merge readiness, release readiness, or launch readiness, `deliveryReadiness.ready` must be true in the current render report and the page must show `delivery_ready=true`.
- If source content, confirmation IDs, traceRows, diagrams, artifact plan, or evidence expectations change, regenerate HTML and require confirmation again.
- Only after exact chat confirmation may the source document be updated to `status: user_confirmed`.
- Immediately after exact chat confirmation, the agent must run the high-level confirmation ingest action. Do not ask the user to manually assemble the ingest command, and do not proceed to reverse audit, readiness, prompt generation, implementation, or closeout until it exits 0 and writes `confirmation_recorded` to `requirement-record.json`.
- When English or bilingual output is selected, the renderer may display an English phrase, but the Chinese phrase above remains accepted if hashes match.

### 7a. Run Controlled Confirmation Ingest

The normal post-confirmation entry is the highest-level `bmad-speckit` CLI command:

```bash
bmad-speckit confirm-scope \
  --source <source-document.md> \
  --render-report _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation-render-report.json \
  --confirmation-text "<exact confirmation text from chat>" \
  --confirmed-by <user-or-agent-label> \
  --json
```

This entry must automatically call `scripts/main-agent-orchestration.ts --action confirm-scope`, which in turn calls the skill-local `confirm-requirements-scope.js`, which in turn calls `ingest-confirmation-event.js`, updates the source bookkeeping, writes the requirement-scoped `requirement-record.json`, appends the confirmation event log and artifact index, and returns the generated paths. `bmad-speckit main-agent:confirm-scope` remains a compatibility alias, but agents should not need to remember the lower-level wrapper during normal confirmation or orchestration. `render-requirements-confirmation-html.ts` remains read-only and must not absorb this responsibility.

If controlled ingest fails, the requirement remains unconfirmed for execution purposes even when the source document contains `status: user_confirmed`. Treat the failure as a blocker and do not generate a trace execution prompt.

### 8. Handle Gaps

If the user finds a gap:

1. Stop progression.
2. Update the source document and inline `implementationConfirmation`.
3. Regenerate the human-readable views and HTML confirmation page.
4. Require explicit confirmation again.
5. Point to the regenerated HTML path and render report hashes.

Do not patch only the diagram, only the trace row, or only the task list.

### 9. Reverse Audit

Before the source document can be used for readiness or implementation prompt generation, audit it:

- `implementationConfirmation` exists.
- `status: user_confirmed` before implementation readiness.
- No open question with `blocksImplementation: true` remains.
- All diagrams and business steps reference confirmation IDs.
- Every trace row references existing confirmation IDs.
- Trace rows do not introduce new requirement semantics.
- Mandatory HTML confirmation outputs exist and match the current source hash.
- `confirmationRender` fields point to the current HTML, summary, and report.
- Sequence, flow, edge-case, and artifact automation plan views exist and are ID-bound.
- Failure paths, state transitions, invariants, idempotency, recovery, permissions, configuration, and evidence are covered.
- `deliveryReadiness.ready` is false until every trace row is `current_pass` for the current hashes and current closeout attempt; missing `requirement-record.json`, `no_controlled_record`, `no_controlled_execution`, `current_evidence_recorded` without pass, stale hash evidence, stale attempt evidence, and missing current evidence all block delivery readiness.
- Smoke tests are not counted as acceptance evidence.

When a local file is produced, run:

```bash
node <skill-dir>/scripts/reverse_audit_contract.js <source-document.md>
```

Prefer the stage-specific CLIs when the caller has a stage intent:

```bash
node <skill-dir>/scripts/audit_contract_confirmability.js <source-document.md> --render-report <confirmation-render-report.json> --json
node <skill-dir>/scripts/audit_implementation_readiness.js <source-document.md> --render-report <confirmation-render-report.json> --json
node <skill-dir>/scripts/audit_delivery_verification.js <source-document.md> --render-report <confirmation-render-report.json> --json
node <skill-dir>/scripts/audit_closeout_integrity.js <source-document.md> --render-report <confirmation-render-report.json> --json
```

`reverse_audit_contract.js` remains a compatibility wrapper for legacy callers. Do not use its generic `PASS` as delivery verification or closeout proof; stage CLIs force their stage mode and emit `stageAudit` metadata.
The stage CLIs share `reverse_audit_stage_common.js` so mode forcing and `stageAudit` metadata stay consistent.

Use the script output as evidence. If it reports `FAIL`, revise the source document before using it for implementation.

## Output Structure

Use [contract-template.md](references/contract-template.md) as the source-document confirmation template.

Use [html-confirmation-renderer-spec.md](references/html-confirmation-renderer-spec.md) when implementing or invoking `<skill-dir>/scripts/render-requirements-confirmation-html.ts`.

Use [matrix-rules.md](references/matrix-rules.md) when validating diagrams, traceRows, and evidence coverage.

Use [e2e-dod.md](references/e2e-dod.md) when designing acceptance E2E and Definition of Done.

Use [reverse-audit-gate.md](references/reverse-audit-gate.md) when writing or evaluating the reverse audit report.

Use [semantic-checkpoint-workflow.md](references/semantic-checkpoint-workflow.md) when scale assessment selects `checkpoint_required`, when resuming interrupted authoring, or when implementing/checking checkpoint automation.

## Scope Change

If a requested update would reduce, replace, or reinterpret confirmed scope, output this and stop:

```text
Scope Change Request
Original confirmed IDs:
Proposed change:
Reason:
Impact on users:
Impact on implementationConfirmation:
Alternative:
Required user decision:
```

Do not silently reduce scope to MVP.
