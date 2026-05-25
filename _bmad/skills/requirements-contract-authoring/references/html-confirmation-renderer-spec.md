# HTML Confirmation Renderer Spec

Use this reference when implementing or invoking `_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts`.

The renderer is a generic read-only confirmation view generator. It reads an implementation source document and its inline `implementationConfirmation`; it renders HTML plus machine-readable summaries. It must not create, infer, rewrite, merge, shrink, confirm, or mutate requirements.

The renderer must not produce confirmable HTML until the pre-confirmation atomic decomposition loop has completed. It must consume the `preConfirmationDrilldown` metadata and the current pre-render MUST decomposition gate report generated from `semantic-kernel.json`, `must_decomposition_packet.json`, Critical Auditor receipts, packet/source reconciliation, and `pre_render_must_decomposition_gate.js`.

The source-level `preConfirmationDrilldown` metadata must include `semanticKernelRef`, `mustDecompositionPacketRef`, `packetSourceReconciliation`, and `preRenderGateReportPath`. These references point to `semantic-kernel.json`, `must_decomposition_packet.json`, `must_packet_source_reconciliation_report.json`, and `pre-render-must-decomposition-gate-report.json`; the renderer treats stale or missing references as confirmation blockers.

The confirmation page belongs to the contract confirmability audit layer only. It may show implementation readiness audit, delivery verification audit, and closeout integrity audit states as blocked or not-yet-ready, but it must not mix those stages into scope confirmation.

Post-confirmation control writes are handled by the high-level confirmation ingest action, not by the renderer:

```bash
bmad-speckit confirm-scope \
  --source <source-document.md> \
  --render-report _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation-render-report.json \
  --confirmation-text "<exact confirmation text from chat>" \
  --confirmed-by <user-or-agent-label> \
  --json
```

After exact chat confirmation, agents must run this entry immediately. It calls the high-level orchestration action, which calls the skill-local controlled ingest wrapper, writes `confirmation_recorded` to `requirement-record.json`, and blocks readiness or prompt generation if the controlled record is missing or stale. `bmad-speckit main-agent:confirm-scope` remains a compatibility alias, but the stable user-facing entry is `bmad-speckit confirm-scope`.

Architecture confirmation has a skill-local prepare entry that is the normal user-facing workflow:

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

The prepare entry must automatically run the controlled `architecture_confirmation_state_checked` precheck, generate requirement-scoped `architecture-confirmation-<runId>.json`, and call the read-only renderer. The user-facing next step must only be to open the architecture confirmation HTML and confirm the hashes in chat. Do not expose stale check or JSON producer commands as manual user steps.

The renderer remains read-only. It renders an existing requirement-scoped `architecture-confirmation-<runId>.json`; it must not generate architecture decisions, infer target paths, write `requirement-record.json`, append `architectureConfirmations[]`, change `architectureConfirmationState`, or confirm architecture on behalf of the user. Do not replace the prepare entry, producer, or renderer with temporary scripts, hand-written HTML, or root-level wrappers.

## CLI Contract

```bash
node _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts \
  --source docs/path/source.md \
  --out _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation.html \
  --language zh-CN \
  --record-id <recordId> \
  --entry-flow story \
  --mode confirmation \
  --json
```

Required options:

- `--source`: path to PRD, BUGFIX, TASKS, or Story source document.
- `--out`: target `confirmation.html` path.
- `--language`: `zh-CN`, `en-US`, or `bilingual`.
- `--record-id`: stable requirement record ID.
- `--entry-flow`: `story`, `bugfix`, or `standalone_tasks`.
- `--mode`: `confirmation` by default.

Optional options:

- `--requirement-set-id`
- `--entry-flow-class`
- `--workflow-adapter`
- `--drilldown-gate-report`
- `--must-decomposition-gate-report`
- `--pre-render-must-decomposition-gate-report`
- `--artifact-plan`
- `--current-target-map`
- `--theme readable|compact|audit`
- `--strict true|false`
- `--mermaid-bundle`
- `--allow-mermaid-fallback`

The default Mermaid runtime must come from the skill asset `assets/mermaid/mermaid.min.js`. Consumer projects should not need to install Mermaid. ESM Mermaid bundles must fail closed because they cannot be inlined as browser classic scripts that initialize `window.mermaid`.

## Outputs

Write all runtime outputs under the same confirmation directory:

- `confirmation.html`
- `confirmation-summary.json`
- `confirmation-render-report.json`

`confirmation-render-report.json` must include:

```json
{
  "recordId": "REQ-...",
  "requirementSetId": "REQ-...",
  "sourcePath": "docs/path/source.md",
  "sourceType": "PRD|BUGFIX|TASKS|Story",
  "entryFlow": "story",
  "entryFlowClass": "full_story_entry",
  "workflowAdapter": "bmad",
  "sourceDocumentHash": "sha256:...",
  "implementationConfirmationHash": "sha256:...",
  "confirmationPageHash": "sha256:...",
  "actualHtmlFileHash": "sha256:...",
  "generatedAt": "ISO-8601",
  "language": "zh-CN",
  "confirmationProfile": "implementation_confirmation",
  "requiredViewPacks": [],
  "optionalViewPacks": [],
  "confirmability": "confirmable|blocked",
  "blockingIssues": [],
  "warnings": [],
  "diagramCoverage": {},
  "traceCoverage": {},
  "artifactAutomationCoverage": {},
  "currentTargetCoverage": {},
  "governanceEventTypeRegistry": {},
  "governanceEventTypeSchemaIssues": [],
  "resumeFailureCaseCoverage": {},
  "confirmInstruction": "确认以上范围进入下一阶段\nsourceDocumentHash=<sha256>\nimplementationConfirmationHash=<sha256>\nconfirmationPageHash=<sha256>",
  "artifactRef": {
    "artifactType": "confirmation_view",
    "sourceOfTruthRole": "projection",
    "path": "_bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation.html",
    "hash": "sha256:..."
  },
  "preConfirmationSemanticDrilldown": {
    "status": "pass|blocked|missing",
    "reportPath": "_bmad-output/runtime/requirement-records/<recordId>/authoring/pre-render-must-decomposition-gate-report.json",
    "requiredSections": [
      "Pre-Confirmation Semantic Drilldown",
      "Semantic Kernel Summary",
      "MUST Decomposition Packet",
      "Atomicity Drivers",
      "Atomic Task Baseline",
      "Projection Coverage",
      "Critical Auditor Convergence",
      "Gap History",
      "Packet-To-Source Reconciliation"
    ]
  },
  "renderedSections": ["pre-confirmation-semantic-drilldown"]
}
```

`confirmation-summary.json` must include compact counts for `must`, `notDone`, `mustNot`, `evidence`, `openQuestions`, `failurePaths`, `edgeCases`, `traceRows`, `sequenceViews`, `flowViews`, `resumeFailureCases`, and `artifactPlanItems`.

## Read-Only Boundary

The renderer must not:

- Modify the source document.
- Generate new requirement IDs or prose.
- Infer missing `MUST`, `NEG`, `OUT`, `EVD`, `failurePaths`, `edgeCases`, or trace rows from prose.
- Set `implementationConfirmation.status`.
- Write `confirmationHistory`.
- Write gate decisions, runtime state, score decisions, rerun loops, or closeout decisions.
- Treat HTML open/view/click events as confirmation.
- Render project-specific currentTargetMap rows unless they are present in the source document or explicit input.

If required data is missing, render a blocked page and set `confirmability: blocked`.

## Mandatory Schema Validation

Strict mode must block if any core field is missing:

- `contractAuthoringRequired: true`
- `confirmationLanguage`
- `must[]`
- `notDone[]`
- `mustNot[]`
- `evidence[]`
- `failurePaths[]`
- `edgeCases[]`
- `traceRows[]`
- `sequenceViews[]`
- `flowViews[]`
- `edgeCaseViews[]`
- `boundaryViews[]`
- `artifactAutomationPlan[]`
- `applicability.governanceEvents`
- `applicability.runtimeRecovery`
- `applicability.scoringDashboardSft`
- `applicability.currentTargetMap`
- `applicability.scriptsAndHooks`
- `activeRequirementResolution`

Every `applicability.*` domain must include:

- `applies: true|false`
- `reasonCode`

When `applies: false`, `reasonCode` is still mandatory. A silent omission is not equivalent to false.

## Conditional Module Validation

### Governance Events

When `applicability.governanceEvents.applies=true`, or any source field references `recordEventTypes[]`, strict mode must require both `governanceEventTypeRegistryPolicy` and `governanceEventTypeRegistry[]`.

`governanceEventTypeRegistryPolicy` must include:

- `controlFieldVocabulary[]`
- `payloadKindContracts[]`
- `controlWriteModePolicies[]`
- `eventSpecificRequirements[]`

`controlFieldVocabulary[]` defines the closed set of field names that carry control-shaped state. `payloadKindContracts[]` define required fields, forbidden fields, and allowed control write modes for each payload kind. `controlWriteModePolicies[]` define which control fields each write mode may write. `eventSpecificRequirements[]` define event-specific requirements such as required source refs, required fields, forbidden fields, payload kind, or write mode.

Transport validators and controlled ingest callers must receive both the policy and registry. They must bind and report both `registryPolicyHash` and `registryHash`; validating only `governanceEventTypeRegistry[]` is insufficient.

Each `governanceEventTypeRegistry[]` entry must include:

- `eventType`
- `ownerModel`
- `payloadKind`
- `writesControlFields`
- `canAffectControlFlow`
- `payloadContract`

`payloadContract` must include:

- `requiredFields[]`
- `forbiddenFields[]`
- `requiredSourceRefs`
- `allowedControlWriteMode`

Payload rules:

- payload-kind required fields, forbidden fields, and allowed write modes must come from `governanceEventTypeRegistryPolicy.payloadKindContracts[]`.
- event-specific sourceRef / field / payload-kind / write-mode requirements must come from `governanceEventTypeRegistryPolicy.eventSpecificRequirements[]`.
- Control writes must be allowed by `allowedControlWriteMode`.
- If a top-level envelope field or `payload` field matches `controlFieldVocabulary[]`, the current event type must list it in `writesControlFields[]`; otherwise validation fails closed.
- Transport validation must fail closed when a self-consistent event registry violates `governanceEventTypeRegistryPolicy`.
- `result` is legacy raw input only and must not be a new schema control field.

### Runtime Recovery

### Controlled Ingest Writers

When `applicability.governanceEvents.applies=true`, controlled ingest is in scope, or a source field references `recordEventTypes[]`, strict mode must require `controlledIngestWriterRegistry[]`.

Each `controlledIngestWriterRegistry[]` entry must include:

- `writerId`
- `scriptPath`
- `scriptContentHash`
- `ownerModel`
- `allowedWriteApis[]`
- `allowedPaths[]`
- `allowedEventTypes[]`
- `payloadContractRefs[]`
- `writesControlFields[]`
- `receiptPath`
- `beforeAfterHashRequired`
- `canModifyWriterRegistry`
- `registryHash`
- `architectureConfirmationHash`

Validation rules:

- `beforeAfterHashRequired` must be `true`.
- `canModifyWriterRegistry` must be `false`.
- `allowedPaths[]` must not grant broad cross-record authority such as `_bmad-output/runtime/requirement-records/**`.
- every `allowedEventTypes[]` value must exist in `governanceEventTypeRegistry[]`.
- `payloadContractRefs[]` must include every allowed event type.
- `writesControlFields[]` must be covered by the union of the allowed event types' `writesControlFields[]`.
- every governance event type that writes control fields must have at least one writer.

The confirmation HTML must render this registry in a dedicated user-visible section. The render report must include the normalized registry, `eventTypeToWriters`, `controlFieldToWriters`, `uncoveredEventTypes`, and schema issues.

`failurePaths[]` and `edgeCases[]` are ordinary functional/business fields and are always required.

`functionalResumeFailureCaseRegistry` is a conditional registry. It is required only when `applicability.runtimeRecovery.applies=true` or `applicability.runtimeRecovery.requiresFunctionalResumeFailureCaseRegistry=true`.

When required, it must include:

- source-defined `groups[]`
- `failureCases[]`
- `recoveryActionDefinitions[]`
- `expectedRecoveryActions[]` on each failure case
- `recordEventTypes[]` on recovery actions that write control fields
- event types that exist in `governanceEventTypeRegistry[]`

The renderer must not use regex or filename conventions as authoritative grouping. `functionalResumeFailureCaseRegistry.groupingAuthority` and source-defined groups are the authority.

### Active Requirement Resolution

When `activeRequirementResolution` is present, strict mode must show:

- explicit locator priority
- `index.json` as locator projection only
- `requirement-record.json` as the control source
- `runtimePolicySnapshot` and `recoveryContext` as requirement-scoped runtime inputs
- a hard prohibition on `_bmad-output/runtime/context/**` as control, fallback, or locator input

If the source document is about runtime governance, hooks, no-hook fallback, bmad-help routing, scoring, dashboard, SFT, recovery, or closeout, the confirmation view must surface this resolver section even if other optional packs are omitted.

### Trace Command Split

`traceRows[]` must show command semantics separately:

- `contractValidationCommandRefs[]`: commands that validate the contract/source/view.
- `deliveryEvidenceCommandRefs[]`: commands that prove implemented behavior in the current delivery attempt.

Legacy `commandRefs[]` may appear only as compatibility input and must not be the sole authoritative command field in new source documents.

### Current Target Map

`currentTargetMap` is rendered only when the source enables the view pack or provides explicit `--current-target-map` input. The renderer must not ship hardcoded project rows.

The supported v1 object rows include:

- `sourceReferences[]`
- `metrics[]`
- `currentSummary[]`
- `targetSummary[]`
- `diffRows[]`
- `targetFlow[]`
- `canonicalArtifacts[]`
- `pathRegistry[]`
- `existingArtifacts[]`
- `scriptConvergence[]`
- `hookConvergence[]`
- `noHookTargets[]`
- `retainedScriptTypes[]`
- `requirementGeneration[]`
- `facts[]`
- `process[]`
- `artifactPaths[]`
- `architecture[]`
- optional governance-only `mentalModels[]`
- optional governance-only `mentalModelSequence.lanes[]`
- optional governance-only `doubleGates.gates[]`
- optional governance-only `doubleGates.envelopeRules[]`

Governance-only sections appear only when `optionalViewPacks` explicitly includes their pack.

## Mandatory HTML Sections

Render every core section. If source data is missing, render the section with an explicit blocked or empty-state reason; do not silently omit it.

### 1. Confirmation Fingerprint

Show source path, source type, entry flow, record IDs, source hash, implementationConfirmation hash, confirmation page hash, generation time, confirmation language, status, and confirmability.

### 2. User Decision Summary

Answer what the user is confirming, what implementation may start, what cannot be claimed as done, which open questions block implementation, which scope changes require reconfirmation, and whether planned artifacts/scripts/hooks can affect control flow.

### 3. Exact Chat Confirmation Phrase

Display the exact phrase the user must paste into chat with `sourceDocumentHash`, `implementationConfirmationHash`, and `confirmationPageHash`. HTML must not include a button that changes confirmation state.

### 4. Requirement ID Panels

Render separate panels for:

- `MUST`
- `NEG`
- `OUT`
- `EVD`
- `failurePaths`
- `edgeCases`
- `Q`

Each item must show ID, text/trigger/condition, linked evidence IDs, trace rows, diagrams, and blocking implications.

### 5. Business Visuals

Render real Mermaid diagrams when Mermaid source exists or structured views can derive diagrams:

- Happy path sequence.
- Failure/negative path sequence.
- State or flow view.
- Edge case view.
- Boundary view when `OUT` IDs exist.

Every diagram node, edge, state transition, artifact write, script call, hook observation, and business branch must reference IDs.

### 6. Runtime Recovery Matrix

When `functionalResumeFailureCaseRegistry` exists, render:

- recovery action definitions.
- source-defined groups.
- failure case matrix.
- expected recovery actions.
- record event type references.
- grouped expandable diagrams.

When it is required by applicability but missing, strict mode must block.

### 7. Trace Matrix

Render every `traceRows[]` row with:

- `id`
- `covers`
- `taskRefs`
- `evidenceRefs`
- `contractValidationCommandRefs`
- `deliveryEvidenceCommandRefs`
- `sequenceViewRefs`
- `artifactRefs`
- `status`
- `blockingReason`

Highlight unknown references, missing task binding, missing evidence, missing diagrams, missing command categories, non-PENDING rows without evidence, and bare `DEFERRED` or `OUT_OF_SCOPE`.

### 8. Pre-Confirmation Semantic Drilldown

Render the productized pre-confirmation drilldown before the user can confirm scope. The section is required even when blocked; missing data must render as an explicit blocker, not as an omitted section.

Required top-level section headings:

- Pre-Confirmation Semantic Drilldown
- Semantic Kernel Summary
- MUST Decomposition Packet
- Atomicity Drivers
- Atomic Task Baseline
- Projection Coverage
- Critical Auditor Convergence
- Gap History
- Packet-To-Source Reconciliation

The section must answer:

- How the model understands the requirement through `semantic-kernel.json`.
- How the model self-questioned the requirement before materializing source rows.
- How each `MUST-*` was split into atomic tasks.
- Whether `expectedTaskCount` and `actualTaskCount` match.
- Which gaps were found, rejected, fixed, moved to `OUT-*`, or converted to blocking `openQuestions`.
- Whether Critical Auditor has `consecutiveNoNewGapRounds: 3`.
- Whether all `EVD-*`, `TRACE-*`, `ACC-*`, `E2E-*`, `currentTargetMap`, and AI-TDD rows are same-origin packet projections.
- Whether packet/source reconciliation passed in both directions.

Blocking examples:

- missing pre-confirmation semantic drilldown gate report -> confirmability=blocked
- stale packet -> confirmability=blocked
- less than 3 rounds -> confirmability=blocked
- unresolved gap -> confirmability=blocked
- missing coverage -> confirmability=blocked
- missing rendered drilldown section -> confirmability=blocked

### 9. Current Vs Target Comparison

Render only source-provided or explicit input rows. Do not use renderer constants as current/target authority.

### 10. Artifact And Automation Plan View

Render each planned or existing artifact/script/hook output with:

- `artifactId`
- `path`
- `artifactType`
- `sourceOfTruthRole`
- `ownerModel`
- `producer`
- `consumer`
- `inputArtifacts`
- `outputArtifacts`
- `recordEventTypes`
- `canAffectControlFlow`
- `userApprovalRequired`
- `retention`
- `cleanupPolicy`
- `orphanRisk`
- `containsSensitiveData`
- `trainingDataEligible`

Reports, summaries, dashboards, SFT datasets, score files, legacy script outputs, and hook receipts are evidence/read-model/projection artifacts unless a controlled gate ingests them and writes a `decision` field.

### 11. Architecture Impact View

Render affected modules, schema/types/contracts, adapters, scripts/hooks/no-hook fallback, runtime policy, scoring policy, dashboard/read model, SFT pipeline, migration, security/privacy, performance, observability, and rollback when source data provides it.

### 12. EntryFlow-Specific View

For `story`, show Product Brief, elicitation, PRD, Architecture, Epic/Story, Speckit lineage and upstream hash alignment where supplied.

For `bugfix`, show bug symptom, reproduction, expected/actual, fix boundary, regression assertions, and excluded test policy where supplied.

For `standalone_tasks`, show task packet path, task list provenance, missing acceptance criteria, required commands, and conversion to `implementationConfirmation` status.

All entry flows have the same hard gates: user confirmation, source hash, traceRows, task-to-ID binding, failure/edge coverage, and evidence expectations.

### 13. Scoring, Dashboard, And SFT Read-Model View

Render whether the source touches scoring, dashboard, SFT, dataset manifests, eval/holdout, redaction, contamination, or withdrawal.

State explicitly that score files, dashboards, and SFT outputs do not directly close requirements. Score materialization and score evaluation gates may write controlled `gateChecks[].decision`.

### 14. Closeout Readiness Preview

Render:

- required commands only.
- suggested commands separately.
- `closeoutAttemptId` requirement.
- current-attempt-only evidence policy.
- blocking orphan artifacts.
- open blocker, open RCA action, pending rerun, missing downstream link, stale lease, invalid resume packet, host parity mismatch when relevant.

### 15. Validation Panel

Render pass/fail/warning results for:

- source hash computed.
- `implementationConfirmation` exists.
- status is valid.
- mandatory core fields exist.
- `applicability.*` domains are declared.
- `failurePaths[]` and `edgeCases[]` exist.
- conditional registries are present only when required.
- `payloadContract` rules pass.
- no blocking open questions remain.
- diagrams bind to IDs.
- traceRows bind to IDs.
- trace command split is present.
- artifact plan exists.
- independent evidence oracles exist.
- HTML hash computed.
- render report written.
- no Markdown/chat fallback used.

## Confirmation Blocking Rules

Set `confirmability: blocked` if any of these is true:

- source file missing.
- `implementationConfirmation` missing.
- `contractAuthoringRequired` is not `true`.
- selected language missing.
- required ID arrays are missing.
- `failurePaths[]` missing.
- `edgeCases[]` missing.
- required `applicability.*` domain missing.
- `applicability.*.applies=false` lacks `reasonCode`.
- `governanceEvents.applies=true` but `governanceEventTypeRegistryPolicy` or `governanceEventTypeRegistry[]` is missing.
- `governanceEventTypeRegistryPolicy.controlFieldVocabulary[]`, `payloadKindContracts[]`, or `controlWriteModePolicies[]` is missing.
- a transport validator, ingest caller, hook, or worker validates only `governanceEventTypeRegistry[]` without `governanceEventTypeRegistryPolicy`.
- a governance event type lacks `payloadContract`.
- a governance event `payloadContract` conflicts with `payloadKind`.
- `controlledIngestWriterRegistry[]` is missing when governance events or controlled ingest apply.
- a controlled ingest writer has a broad `allowedPaths[]` glob.
- a controlled ingest writer references unknown `allowedEventTypes[]`.
- a controlled ingest writer omits matching `payloadContractRefs[]`.
- a controlled ingest writer declares `writesControlFields[]` not covered by its allowed event types.
- a controlled ingest writer sets `beforeAfterHashRequired` to anything other than `true`.
- a controlled ingest writer sets `canModifyWriterRegistry` to anything other than `false`.
- a control-writing governance event type has no registered writer.
- `runtimeRecovery.applies=true` or `requiresFunctionalResumeFailureCaseRegistry=true` but `functionalResumeFailureCaseRegistry` is missing.
- active requirement resolution is required but missing.
- `_bmad-output/runtime/context/**` appears as a control, fallback, or locator input in a source that touches runtime governance.
- recovery registry groups, action definitions, expected actions, or record event type references are invalid.
- traceRows missing.
- traceRows use only legacy `commandRefs[]`.
- mandatory sequence/flow/edge/boundary/artifact views are missing.
- blocking open questions exist.
- diagram or artifact plan references unknown IDs or event types.
- evidence lacks a gate command or independent oracle.
- HTML hash or source hash cannot be computed.
- renderer cannot write all required outputs.
- Mermaid runtime is missing or invalid and Mermaid blocks exist.
- missing semantic kernel.
- missing must_decomposition_packet.
- missing Critical Auditor convergence.
- missing packet/source reconciliation.
- pre-confirmation semantic drilldown gate report is missing or stale.
- renderer did not show drilldown sections.
- deliveryReadiness must not be represented as ready when the page is only confirming requirements scope.

## Styling And Usability

Optimize for fast human review:

- Left navigation with collapse.
- Filters for all/control/new artifacts.
- High-contrast status and blocker styling.
- Compact diff-style current/target rows.
- Negative and cannot-count-as-done criteria must be prominent.
- Mermaid source must be collapsible, but rendered diagrams must be visible when runtime is available.
- Tables must be readable offline and printable.
- No external CDN dependency.

## Core User Questions

The page must clearly answer:

1. What am I confirming?
2. What is explicitly not done or cannot count as done?
3. Is business logic complete, including failure paths?
4. How will each requirement be verified?
5. What files, scripts, hooks, reports, dashboards, score outputs, and SFT outputs will AI generate or touch?
6. Which artifacts affect control flow and which are evidence/read-model only?
7. What is the gap between current and target state?
8. After confirmation, what may the agent do and what is forbidden?
9. How did the model understand the requirement before writing the source?
10. How did the model self-question the requirement and resolve or expose gaps?
11. How was each `MUST-*` decomposed into atomic tasks?
12. Do `expectedTaskCount` and `actualTaskCount` match?
13. Did Critical Auditor reach three consecutive no-new-valid-gap rounds?
14. Are all EVD/TRACE/ACC/E2E/currentTarget/AI-TDD rows same-origin projections?

The user confirms only the requirements scope. The HTML must not imply implementation completion, delivery readiness, closeout readiness, or merge readiness unless separate stage-specific evidence proves those states. `deliveryReadiness must not be represented as ready` when the page is only proving contract confirmability audit.
