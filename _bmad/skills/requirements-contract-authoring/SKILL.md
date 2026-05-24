---
name: requirements-contract-authoring
description: Create or update implementation source documents with an inline implementationConfirmation block, mandatory HTML confirmation view, ID-bound sequence/flow/artifact views, traceRows, evidence expectations, and reverse-audit checks. Use when preparing PRD/BUGFIX/TASKS/story documents for implementation, converting session requirements into a source document draft, auditing happy-path-only specs, or preventing MVP/toy/stub/mock-only delivery. Do not use as a separate authoritative requirements contract generator.
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
- Bind every implementation task to existing `MUST` / `NEG` / `OUT` / `EVD` / `TRACE` IDs before implementation readiness.
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
- Keep ordinary business/functional failure paths separate from the conditional `functionalResumeFailureCaseRegistry`.
- Use `contractValidationCommandRefs[]` and `deliveryEvidenceCommandRefs[]` in `traceRows[]`; do not use legacy `commandRefs[]` as the sole command authority.
- When governance events apply, require `governanceEventTypeRegistryPolicy` plus `governanceEventTypeRegistry[]`; every event type needs a `payloadContract` that passes the policy.
- `governanceEventTypeRegistryPolicy` must define `controlFieldVocabulary[]`, `payloadKindContracts[]`, `controlWriteModePolicies[]`, and `eventSpecificRequirements[]`; renderer, ingest, gates, hooks, workers, and tests must not keep a second hardcoded event or payload rule list.
- `controlFieldVocabulary[]` is the only policy-level vocabulary for control-shaped fields. A transport envelope that carries any vocabulary field at top level or under `payload` must be rejected unless the current event type lists that field in `writesControlFields[]`.
- When governance events or controlled ingest apply, require `controlledIngestWriterRegistry[]` as the only machine-readable authority for which writer may write control records. Event existence in `governanceEventTypeRegistry[]` is not enough to authorize any script.
- `controlledIngestWriterRegistry[]` entries must bind `writerId`, `scriptPath`, `scriptContentHash`, `allowedWriteApis[]`, `allowedPaths[]`, `allowedEventTypes[]`, `payloadContractRefs[]`, `writesControlFields[]`, `receiptPath`, `beforeAfterHashRequired: true`, `canModifyWriterRegistry: false`, `registryHash`, and `architectureConfirmationHash`.
- A writer that receives a registered but unowned event type must fail closed; it must not fall through to a default branch or reinterpret the event as gate, rerun, artifact, or closeout evidence.
- When runtime recovery applies or requires functional resume coverage, require source-defined `functionalResumeFailureCaseRegistry` groups, actions, failure cases, expected recovery actions, and record event types.
- When runtime governance or recovery applies, require active requirement/run resolution through `requirement-records/index.json` or explicit `recordId` / `requirementSetId` / `runId`; never rely on `_bmad-output/runtime/context/project.json`.
- Score, dashboard, SFT, report, summary, and hook receipt outputs are read models or evidence only; they do not close requirements unless a controlled gate writes `decision`.

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
  requiredViewPacks: []
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
      applies: false
      reasonCode: no_current_target_migration_or_governance_comparison_needed
    scriptsAndHooks:
      applies: false
      reasonCode: no_script_hook_report_or_generated_artifact_changes
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
      sequenceViewRefs: []
      boundaryViewRefs: []
      artifactRefs: []
      status: PENDING
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

Authoring order is mandatory:

1. Write core fields: status, entryFlow, IDs, `must`, `notDone`, `mustNot`, `evidence`, `failurePaths`, `edgeCases`, `traceRows`, views, artifact plan, commands, and closeout preview.
2. Declare every `applicability.*` domain with `applies` and `reasonCode`.
3. Expand only the conditional domains whose `applies` value is `true`.

Never omit an applicability domain to imply it is irrelevant. Use `applies: false` plus a concrete `reasonCode`.

Conditional expansion rules:

- `governanceEvents.applies=true`: define or reference `governanceEventTypeRegistryPolicy`, `governanceEventTypeRegistry[]`, and `controlledIngestWriterRegistry[]`; every event type needs `payloadContract` and every control field vocabulary / payload kind / control write mode / event-specific rule must be declared in the policy. Every event type that writes control fields must be covered by at least one registered writer.
- `runtimeRecovery.applies=true` or `requiresFunctionalResumeFailureCaseRegistry=true`: define `functionalResumeFailureCaseRegistry` with source-defined groups, failure cases, recovery actions, expected recovery actions, and record event types.
- `runtimeRecovery.applies=true`: define `activeRequirementResolution` or reference the project-standard Active Requirement Resolver; startup must locate the current requirement through explicit IDs or `_bmad-output/runtime/requirement-records/index.json`, then verify `requirement-record.json`, `runtimePolicySnapshotRef`, `recoveryContextRef`, trace checkpoint, and bmad workflow projection hashes.
- `scoringDashboardSft.applies=true`: define score/dashboard/SFT read-model boundaries and state why they cannot reverse-drive closeout.
- `currentTargetMap.applies=true`: define source-driven current/target rows; do not rely on renderer hardcoded rows.
- `scriptsAndHooks.applies=true`: define visible script/hook/artifact outputs, ownerModel, input/output artifacts, event types, fallback, and control/evidence role.

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
node _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts \
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
node _bmad/skills/requirements-contract-authoring/scripts/prepare-architecture-confirmation-page.ts \
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

Use the script output as evidence. If it reports `FAIL`, revise the source document before using it for implementation.

## Output Structure

Use [contract-template.md](references/contract-template.md) as the source-document confirmation template.

Use [html-confirmation-renderer-spec.md](references/html-confirmation-renderer-spec.md) when implementing or invoking `_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts`.

Use [matrix-rules.md](references/matrix-rules.md) when validating diagrams, traceRows, and evidence coverage.

Use [e2e-dod.md](references/e2e-dod.md) when designing acceptance E2E and Definition of Done.

Use [reverse-audit-gate.md](references/reverse-audit-gate.md) when writing or evaluating the reverse audit report.

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
