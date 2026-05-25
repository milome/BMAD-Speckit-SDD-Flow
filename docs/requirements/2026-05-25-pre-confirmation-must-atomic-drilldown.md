# Pre-Confirmation Semantic Drilldown Policy

Date: 2026-05-25
Status: Draft
Source request: Add a pre-confirmation semantic drilldown policy so requirements cannot pass confirmation with abstract placeholder `MUST-*` rows, shallow task lists, or independently hand-filled EVD/TRACE/ACC/E2E projections.

## Problem

The current requirements confirmation flow can prove that required fields exist, but it does not reliably prove that the model has understood the requirement deeply enough to decompose it into executable, testable, auditable work.

This creates a source-quality failure mode:

- A `MUST-*` can contain one abstract sentence such as "integrate skill routing" or "support audit loop preservation".
- `targetModificationPaths[]` can list paths without saying what must change in each file.
- `ACC-*` / `E2E-*` can name test files without defining the concrete scenario, oracle, RED expectation, or negative control.
- Render and reverse audit can pass structure checks while the actual implementation surface is under-specified.
- Later AI-TDD gates and delivery audits cannot guarantee quality if the confirmed source itself is low-granularity.

The missing layer is not another structure-only validator. The missing layer is a confirmation-before-render semantic drilldown protocol that forces the model to understand requirements, self-question, detect under-specified surfaces, and separate semantic changes from execution-plan refinements before the user is asked to confirm scope.

Checkpoint authoring made this risk more visible. Splitting a long requirements document into section checkpoints solves timeout, stream interruption, recovery, and forced commit safety, but it can degrade complex reasoning when the model starts writing local sections instead of first building a global semantic model. A section-complete document can still be semantically shallow.

## Target Outcome

Before HTML confirmation render, the source must have a visible and machine-readable semantic drilldown packet that explains what is being confirmed, what is still uncertain, what the initial execution plan is, and what evidence would prove the implementation later.

```text
semantic contract
-> compact semantic kernel
-> MUST drilldown packets
-> synchronized EVD/TRACE/ACC/E2E/currentTarget/AI-TDD projections
-> initial atomic execution baseline
-> semantic gap policy
-> bounded no-new-gap receipt
-> section materialization
-> final semantic reconciliation
```

The confirmation page must let the user confirm not only "what is required", but also "how the model understood the requirement, what it asked itself, what gaps remain, which execution plan is currently derived, how each requirement will be tested, and what cannot count as done."

The confirmed source is the semantic contract. The atomic task list is an initial construction baseline, not final closeout authority. Execution may discover non-semantic implementation gaps and update the execution plan, but any change to confirmed requirement meaning, boundary, evidence principle, acceptance oracle, or target behavior must move the source to `reconfirm_required`.

## Policy Principles

- Model reasoning is the primary quality mechanism. Scripts and renderers are bottom-line fail-closed checks; they cannot replace semantic understanding.
- Do not equate field presence with requirement quality. A filled matrix can still hide an unexamined `MUST-*`.
- Non-semantic gaps may be converted into updated execution-plan rows and continued without user reconfirmation.
- Semantic changes require `reconfirm_required` and a regenerated confirmation page.
- `atomicImplementationTaskList[]` is never closeout authority. It is a model-derived initial execution baseline for Ralph/story/standalone planning.
- `EVD/TRACE/ACC/E2E/currentTargetMap/AI-TDD manifest` are synchronized projections of drilldown reasoning. They must not be independently hand-filled tables.
- `gap=0` is not truth. The strongest valid claim before confirmation is bounded, evidence-backed no-new-gap convergence under a stated audit scope.

## Productized Interaction Flow

This requirement productizes the `requirements-contract-authoring` interaction for generating confirmation-ready source documents. It does not define the whole BMAD-Speckit-SDD-Flow implementation, delivery verification, or closeout lifecycle.

The productized interaction is:

```text
user requirement or source document
-> source identification
-> scale assessment
-> semantic kernel
-> atomic decomposition loop
-> three consecutive no-new-valid-gap rounds
-> source materialization
-> packet/source reconciliation
-> pre-render gates
-> HTML confirmation page
-> user confirms scope only
```

### Interaction State Machine

The authoring flow must expose these states:

```text
idle
-> source_identified
-> scale_assessed
-> semantic_kernel_ready
-> atomic_decomposition_in_progress
-> gap_resolution_required
-> atomic_decomposition_converged
-> source_materialized
-> pre_render_ready
-> confirmation_rendered
-> user_confirmable
```

Blocking states:

```text
blocked_by_semantic_gap
blocked_by_unresolved_user_decision
blocked_by_critical_auditor_gap
blocked_by_under_split_task
blocked_by_missing_projection
blocked_by_packet_source_drift
blocked_by_render_gate
```

### User Interaction Rules

The agent must not ask the user about every internal gap candidate. It should ask the user only when the answer changes confirmed semantics or requires an explicit user decision.

User-facing interruptions are allowed for:

- semantic scope decisions,
- converting a gap to an `OUT-*` boundary,
- keeping a blocking open question,
- explicit waiver decisions,
- confirmation language selection,
- final HTML confirmation phrase and hashes.

The agent should resolve without user interruption:

- non-semantic execution plan refinements,
- target path discovery,
- projection synchronization,
- under-split task repair,
- stale packet regeneration,
- missing receipt regeneration,
- packet/source reconciliation repairs that preserve confirmed semantics.

### Productized Round Summary

Every atomic decomposition loop round should produce a concise user-facing progress summary:

```text
Round 1: 5 validated gaps, 3 auto-fixed, 2 require semantic decisions.
Round 2: 1 new validated gap, auto-fixed.
Round 3: no new valid gap.
Round 4: no new valid gap.
Round 5: no new valid gap.
Result: atomic decomposition loop converged after three consecutive no-new-valid-gap rounds.
```

The user-facing summary must distinguish:

- validated gaps,
- rejected gap candidates,
- non-semantic repairs,
- semantic decisions,
- current convergence counter,
- next action.

### Productized Artifacts

The flow must write stable artifacts under the requirement record authoring runtime directory:

```text
semantic-kernel.json
must_decomposition_packet.json
critical-auditor-receipt-round-<n>.json
must_packet_source_reconciliation_report.json
semantic-checkpoint-progress.json
pre-render-global-consistency-report.json
confirmation.html
confirmation-summary.json
confirmation-render-report.json
```

Each artifact must include `schemaVersion`, `recordId`, `sourceDocumentHash`, `implementationConfirmationHash` when available, and its own content hash or receipt hash.

### Resume Interaction

If authoring is interrupted, resume must not restart broad reasoning from scratch. It must reload:

- `semantic-kernel.json`,
- `must_decomposition_packet.json`,
- Critical Auditor receipt history,
- checkpoint progress,
- current source hash,
- packet/source reconciliation status.

The resume summary should state:

```text
Recovered state: atomic_decomposition_in_progress
Latest Critical Auditor round: 3
Convergence counter: 1/3
Next action: resolve GAP-007 and continue round 4.
```

### Confirmation Page Interaction

The HTML confirmation page must make the productized interaction visible to the user. It must show:

- semantic kernel summary,
- MUST decomposition packet summary,
- atomic tasks,
- atomicity drivers and expected/actual task counts,
- EVD/TRACE/ACC/E2E projection coverage,
- failure and edge coverage,
- current/target comparison,
- AI-TDD manifest projection,
- Critical Auditor rounds,
- validated gaps and rejected gap candidates,
- packet/source reconciliation,
- what cannot count as done,
- exact confirmation phrase and hashes.

The page must state that confirmation means scope confirmation only. It must not imply implementation completion, delivery readiness, or closeout readiness.

## Semantic Kernel First Checkpoint Model

Checkpoint mode must not split thinking by final document sections. It must split durable authoring by semantic layers first, then materialize final sections.

Required checkpoint shape:

```text
cp-00 semantic kernel
cp-01 MUST atomic drilldown and derived projections
cp-02 ID freeze
cp-03+ implementationConfirmation and human-readable section materialization
final semantic reconciliation
```

`semantic kernel` is not the full requirements document. It is a compact, machine-readable, recoverable global reasoning artifact containing:

- goal and non-goals,
- current and target state,
- `MUST/NEG/OUT` candidates,
- failure and edge topology,
- target surfaces,
- evidence principles,
- ACC/E2E oracle principles,
- AI-TDD manifest coverage plan,
- open questions and blockers.

If even the semantic kernel is too large for one stable model pass, it may be split into semantic micro-checkpoints:

```text
cp-00a global goal and boundaries
cp-00b current/target surface map
cp-00c MUST/NEG/FAIL/EDGE skeleton
cp-00d evidence and oracle strategy
cp-00e AI-TDD manifest projection plan
cp-00f adversarial gap audit
```

These micro-checkpoints update the same semantic object. They are not final-document chapters. Each step must read the full current kernel state, update a bounded part of it, and preserve global invariants.

## MUST-Derived Projection Model

Semantic drilldown must not produce only a final task list. The drilldown packet must be the semantic source for every MUST-derived confirmation artifact.

For each `MUST-*`, drilldown must synchronously generate or repair these projections:

- `mustExecutionDecompositionMatrix[]`
- `atomicImplementationTaskList[]`
- `evidence[]`
- `traceRows[]`
- `acceptanceTests[]`
- `e2eSuites[]`
- `failurePaths[]`
- `edgeCases[]`
- `targetModificationPaths[]`
- `currentTargetMap`
- `aiTddContractExecutionManifestProjection`
- `artifactAutomationPlan[]`
- `requiredCommands[]`
- `closeoutReadinessPreview`

These projections must not be authored independently. If `evidence[]`, `traceRows[]`, `ACC/E2E`, target paths, current/target rows, or AI-TDD manifest sections are filled separately from the MUST drilldown packet, the source can still become structurally complete but semantically inconsistent.

The intended generation order is:

```text
compact semantic kernel
-> MUST drilldown
-> must_decomposition_packet.json
-> synchronized projection draft
-> implementationConfirmation materialization
-> pre-render gate
-> HTML confirmation page
```

The source document remains the final confirmation authority, but before render the synchronized projection draft is the construction source for all MUST-derived sections.

## MUST Drilldown Packet As Pre-Render Derivation Authority

`must_decomposition_packet.json` is the pre-render derivation authority for MUST-derived projections. It is not a second confirmed requirements contract, and it is not delivery or closeout evidence.

Authority boundaries:

- Before HTML render, the packet is the construction authority for deriving `implementationConfirmation` sections from semantic drilldown.
- At user confirmation time, the source document's inline `implementationConfirmation` remains the confirmation authority.
- After confirmation, the packet remains an audit receipt and derivation record only.
- Delivery verification and closeout integrity must never treat the packet, atomic task completion, render output, or completion evidence packets as requirement PASS.

Required packet shape:

```yaml
must_decomposition_packet:
  schemaVersion: must-decomposition-packet/v1
  sourceDocument: docs/requirements/example.md
  sourceDocumentHash: sha256:...
  semanticKernelHash: sha256:...
  packetHash: sha256:...
  status: draft | synchronized | stale | blocked
  generatedAt: null
  generatedBy: requirements-contract-authoring
  materializationTarget: implementationConfirmation
  mustPackets:
    - mustRef: MUST-001
      mustIntent: "Intent copied from implementationConfirmation.must[].text."
      semanticClassification:
        kind: product_behavior | governance_control | workflow_rule | evidence_rule
        riskLevel: low | medium | high | critical
      decompositionBasis:
        observableBehaviors: []
        affectedEntryFlows: []
        targetSurfaces: []
        stateTransitions: []
        externalSideEffects: []
        failureModes: []
        edgeConditions: []
        evidenceOracles: []
        invalidProofTypes: []
      atomicityDrivers:
        behaviorSurfaceOracleUnits: []
        entryFlowVariants: []
        failureModeVariants: []
        stateTransitionVariants: []
        sideEffectVariants: []
        auditLoopVariants: []
      questionCoverage:
        requiredCategories: []
        answeredCategories: []
        missingCategories: []
        coverageVerdict: complete | incomplete
      openQuestionDisposition:
        blockingOpenQuestions: []
        nonBlockingAssumptions: []
        convertedToOutBoundaries: []
        noOpenQuestionJustification: ""
      atomicityCompleteness:
        splitRule: one_task_per_independent_behavior_surface_oracle
        expectedTaskCount: 0
        actualTaskCount: 0
        completenessVerdict: complete | incomplete | over_broad | under_split
      selfQuestions:
        - question: "Which legacy path could bypass this MUST?"
          answer: "Concrete answer based on source, repo files, or explicit assumption."
          gapRefs: []
      mustAtomicTasks: []
      mustEvidenceProjection: []
      mustTraceProjection: []
      mustAcceptanceProjection: []
      mustFailureEdgeProjection: []
      mustTargetPathProjection: []
      mustCurrentTargetProjection: []
      mustAiTddManifestProjection: []
      mustArtifactProjection: []
      mustCommandProjection: []
      mustCloseoutBoundaryProjection: []
      gaps: []
```

This schema is not a minimum-count checklist. `openQuestionDisposition` may contain zero blocking open questions only when `questionCoverage.coverageVerdict=complete` and `noOpenQuestionJustification` explains why no remaining semantic question blocks confirmation. `mustAtomicTasks[]` may not use a single placeholder task unless the atomicity driver analysis proves the MUST has exactly one independent behavior/surface/oracle unit.

### Atomicity Driver Method

For each `MUST-*`, the model must derive atomic tasks from atomicity drivers, not from a fixed minimum count.

Atomicity drivers are independent reasons the implementation may need a separate task:

- each distinct observable behavior,
- each affected entry flow,
- each target surface or file responsibility,
- each state transition,
- each failure mode or edge condition,
- each external side effect,
- each independent evidence oracle,
- each negative control or legacy bypass denial,
- each audit loop or closeout boundary that could be bypassed independently.

The required task count is not "at least one". It is:

```text
expectedTaskCount = count(independent behavior/surface/oracle units after deduplication)
```

A task is valid only when it has exactly one primary observable behavior, one primary target surface group, one primary acceptance oracle, and one clear reason to exist. If a task has multiple independent RED proofs, multiple unrelated target surfaces, or multiple unrelated failure modes, it must be split.

### Required Self-Question Coverage

Every `mustPackets[]` row must answer required question categories. The required set depends on risk, but high and critical risk MUSTs require all categories:

- intent_boundary: what exactly is required and what is not required,
- current_state: how the current system behaves,
- target_state: what must change,
- entry_flow: which entry flows invoke or bypass the behavior,
- target_surface: which files, fields, commands, records, views, or manifests must change,
- state_transition: which state or lifecycle transition is affected,
- failure_edge: which failure paths and edge cases prove the behavior is complete,
- legacy_bypass: which old path could still make shallow tests pass,
- evidence_oracle: what evidence proves behavior, not just execution,
- red_proof: what should fail before implementation,
- negative_control: what must remain forbidden or fail closed,
- integration_side_effect: which external or generated artifact side effects matter,
- audit_loop: which Ralph/TDD/auditor/checkpoint loop must be preserved,
- closeout_boundary: what cannot count as delivery or closeout proof.

The packet must block when any required category is missing, answered with vague text, or answered only by referencing a field name without concrete behavior.

Each projection row must include derivation metadata:

```yaml
derivedFromMustRef: MUST-001
derivedFromPacketHash: sha256:...
projectionStatus: synchronized | stale | missing | conflicting
materializedTo:
  - implementationConfirmation.evidence[EVD-001]
  - implementationConfirmation.traceRows[TRACE-001]
```

Required projection groups:

- `mustAtomicTasks`: materializes to `atomicImplementationTaskList[]`.
- `mustEvidenceProjection`: materializes to `evidence[]`.
- `mustTraceProjection`: materializes to `traceRows[]`.
- `mustAcceptanceProjection`: materializes to `acceptanceTests[]` and `e2eSuites[]`.
- `mustFailureEdgeProjection`: materializes to `failurePaths[]` and `edgeCases[]`.
- `mustTargetPathProjection`: materializes to `targetModificationPaths[]`.
- `mustCurrentTargetProjection`: materializes to `currentTargetMap`.
- `mustAiTddManifestProjection`: materializes to `aiTddContractExecutionManifestProjection` or the source's AI-TDD manifest section.
- `mustArtifactProjection`: materializes to `artifactAutomationPlan[]`.
- `mustCommandProjection`: materializes to `requiredCommands[]`.
- `mustCloseoutBoundaryProjection`: materializes to `closeoutReadinessPreview`.

Packet synchronization rules:

- Every `MUST-*` must have exactly one `mustPackets[]` row.
- Every `mustPackets[]` row must have complete `decompositionBasis`, `atomicityDrivers`, `questionCoverage`, and `atomicityCompleteness`.
- Every `MUST-*` with implementation impact must have `actualTaskCount === expectedTaskCount`; the expected count is derived from independent atomicity drivers, not from a fixed minimum.
- A `mustPackets[]` row with `actualTaskCount < expectedTaskCount` is under-split and blocked.
- A `mustPackets[]` row with one task that covers multiple independent entry flows, target surfaces, failure modes, or evidence oracles is over-broad and blocked.
- A `mustPackets[]` row with `questionCoverage.coverageVerdict !== complete` is blocked.
- A `mustPackets[]` row with blocking open questions is blocked unless they are converted to `openQuestions[]` with `blocksImplementation=true` or to explicit `OUT-*` boundaries before render.
- Every packet projection must materialize into the source document or explicitly declare why it is not applicable.
- Every materialized EVD/TRACE/ACC/E2E/failure/edge/target/current-target/AI-TDD/artifact/command/closeout row must map back to a packet projection.
- Source document rows that cannot be traced back to a packet projection are blocked as independently invented content.
- Packet projections that are not materialized into `implementationConfirmation` are blocked as incomplete materialization.
- If `sourceDocumentHash`, `semanticKernelHash`, or `packetHash` is stale, HTML render is blocked.

Self-rebuttal controls:

- To avoid creating a second requirements contract, the packet is scoped to pre-render derivation and must be fully materialized into `implementationConfirmation` before user confirmation.
- To avoid mechanical table filling, each `mustPackets[]` row must include `selfQuestions[]`, invalid proof analysis, legacy bypass analysis, and gap classification.
- To avoid projection drift, pre-render gate must compare packet projections against materialized source rows by ID, hash, and back-reference.
- To avoid false closeout, delivery and closeout gates must reject packet completion, task completion, or render presence as proof of implementation.

## Non-Goals

- Do not replace `implementationConfirmation.must[]`, `traceRows[]`, `acceptanceTests[]`, or `e2eSuites[]`.
- Do not make generated decomposition packets delivery proof.
- Do not let the model freely change confirmed requirement semantics during drilldown.
- Do not require absolute proof that no gaps exist; require bounded, evidence-backed no-new-gap convergence.
- Do not replace Ralph Method, Story Assistant, standalone task audit, AI-TDD delivery verification, or closeout integrity gates.
- Do not make scripts responsible for deciding whether a requirement is semantically complete. Scripts may detect obvious incompleteness, but the model workflow must perform the semantic questioning and decomposition.
- Do not freeze the initial atomic task list as the only valid implementation path when later execution discovers non-semantic integration gaps.

## Core Definitions

### Atomic Implementation Task

An atomic task is the smallest implementation unit that can be executed and verified independently by one Ralph user story or one trace slice.

It is not atomic if it uses vague verbs such as "support", "integrate", "improve", "optimize", "align", "handle", "ensure", or "complete" without concrete observable behavior and file-level responsibilities.

### Bounded No-New-Gap

`gap=0` is not an absolute truth. It only means the current method did not find new gaps. The correct convergence state is `bounded_no_new_gap`, which requires:

- explicit audit scope,
- file discovery evidence,
- adversarial review,
- gap delta tracking,
- mutation/deletion pressure tests,
- and at least three consecutive no-new-confirmation-blocking-gap rounds.

### Pre-Confirmation Decomposition Audit

This is a new audit stage before HTML render. It audits requirement definition quality, not implementation completion.

It must not be merged with post-implementation audit or delivery closeout audit.

### Semantic Gap

A semantic gap changes what the user is being asked to confirm. Examples:

- a `MUST-*` needs a different target behavior,
- a `NEG-*` or `OUT-*` boundary is missing,
- a failure path changes accepted behavior,
- an ACC/E2E oracle changes what counts as success,
- a current/target row reveals a new product or governance scope,
- an AI-TDD manifest section needs a new first-class proof category.

Semantic gaps must set `status: reconfirm_required` or block initial confirmation when discovered before confirmation.

### Non-Semantic Execution Gap

A non-semantic execution gap changes how the confirmed behavior will be implemented, not what behavior is confirmed. Examples:

- a target file path needs to be split into two implementation tasks,
- a test needs an additional fixture while preserving the same oracle,
- a command target needs a validation-only classification,
- a Ralph story needs finer-grained progress rows for the same confirmed trace.

Non-semantic execution gaps may update the execution plan and continue, provided they remain inside confirmed `MUST/NEG/OUT/EVD/TRACE/ACC/E2E/currentTargetMap/AI-TDD` semantics.

## New `implementationConfirmation` Fields

### `mustExecutionDecompositionMatrix[]`

Each row decomposes one `MUST-*` into observable behavior and coverage surfaces.

Required fields:

```yaml
mustExecutionDecompositionMatrix:
  - mustRef: MUST-001
    mustIntent: "Short intent copied from the MUST row."
    observableBehaviors:
      - "Concrete behavior visible in code, output, report, UI, CLI, or controlled record."
    affectedEntryFlows:
      - entryFlow: standalone_tasks
        currentBehavior: "How the flow works before this requirement."
        targetBehavior: "How the flow must work after implementation."
        bypassRisks:
          - "Known legacy path or fallback that could skip the new behavior."
    targetSurfaces:
      - surfaceId: SURFACE-001
        pathOrField: ".codex/skills/example/SKILL.md"
        discoveryStatus: confirmed_by_file_scan
        currentRole: "Current responsibility."
        targetRole: "Target responsibility."
    perFileChangeResponsibilities:
      - path: ".codex/skills/example/SKILL.md"
        changeResponsibility: "Exact content or behavior this file must change."
        forbiddenChange: "What this file must not absorb or reinterpret."
    integrationPoints:
      - "Compiler invocation before worker dispatch."
    errorAndFallbackCases:
      - failurePathRef: FAIL-001
        expectedBehavior: "Fail closed instead of using legacy prompt."
    acceptanceAndE2eProof:
      acceptanceRefs: [ACC-001]
      e2eRefs: [E2E-001]
      redProofPlan: "Old implementation must fail because the routing hook is absent."
    auditLoopPreservation:
      requiredLoops:
        - ralph_prd_progress
        - tdd_red_green_refactor
        - critical_auditor_no_gap
      bypassMustFail: true
    gapRefs: []
    atomicTaskRefs: [AIT-001]
    decompositionStatus: bounded_no_new_gap
```

### `atomicImplementationTaskList[]`

This is the initial execution baseline derived before implementation. Ralph Method may consume it to create `prd/progress`, but it must not invent a new task list that changes confirmed semantics.

The list is not closeout authority. A task can be complete while the requirement remains unproven. Closeout authority remains the delivery verification and closeout integrity chain over current-attempt evidence.

If execution discovers a non-semantic implementation gap, the list may be amended with a new or split task while preserving the same confirmed requirement semantics. If execution discovers a semantic gap, the source must move to `reconfirm_required`.

Required fields:

```yaml
atomicImplementationTaskList:
  - id: AIT-001
    title: "Short executable task title."
    sourceMustRefs: [MUST-001]
    negativeRefs: [NEG-001]
    traceRefs: [TRACE-001]
    targetFiles:
      - ".codex/skills/example/SKILL.md"
    perFileChangePlan:
      - path: ".codex/skills/example/SKILL.md"
        plannedChange: "Add confirmed-source compiler routing before legacy prompt fallback."
        successSignal: "Skill contract text contains compiler-first routing and legacy fallback boundary."
        forbiddenChange: "Do not remove existing Ralph/TDD/audit loop requirements."
    acceptanceRefs: [ACC-001]
    e2eRefs: [E2E-001]
    failurePathRefs: [FAIL-001]
    edgeCaseRefs: [EDGE-001]
    redProofPlan: "Before implementation, fixture with confirmed source still routes to legacy prompt and test fails."
    greenExitCriteria: "Confirmed source routes through compiler and still reaches existing audit loop."
    auditChecks:
      - "Critical auditor verifies no entry flow bypasses compiler when source is confirmed."
      - "Audit verifies Ralph progress and post-implementation no-gap loop remain required."
    gapRefs: []
    blockedIfMissing:
      - "targetFiles"
      - "perFileChangePlan"
      - "redProofPlan"
      - "acceptanceRefs"
    nonGoals:
      - "Do not implement delivery closeout writer changes in this task."
    estimatedAtomicity: one_ralph_us_or_trace_slice
```

### `mustDecompositionGaps[]`

Every gap discovered during drilldown must be tracked explicitly.

Required fields:

```yaml
mustDecompositionGaps:
  - gapId: GAP-001
    sourceMustRef: MUST-001
    gapType: definition_gap
    description: "The source does not identify which story skill surface owns this flow."
    discoveredInPass: adversarial_gap_pass
    status: open
    blocksConfirmation: true
    blocksImplementation: true
    blocksCloseout: true
    requiredResolution: "Add target surface row and atomic task for the missing story entry."
    resolutionEvidenceRefs: []
```

Allowed `gapType` values:

- `definition_gap`
- `target_path_gap`
- `test_gap`
- `audit_gap`
- `integration_gap`
- `entry_flow_gap`
- `legacy_bypass_gap`
- `host_capability_gap`
- `external_decision_gap`

Allowed `status` values:

- `open`
- `resolved`
- `converted_to_open_question`
- `converted_to_out_boundary`
- `waived_by_explicit_user_decision`

`blocksConfirmation=true` must block HTML render confirmability.

### `mustDerivedProjectionMap`

Each `MUST-*` must declare the projections produced by its drilldown packet.

Required fields:

```yaml
mustDerivedProjectionMap:
  - mustRef: MUST-001
    decompositionRefs: [AIT-001]
    evidenceRefs: [EVD-001]
    traceRefs: [TRACE-001]
    acceptanceRefs: [ACC-001]
    e2eRefs: [E2E-001]
    failurePathRefs: [FAIL-001]
    edgeCaseRefs: [EDGE-001]
    targetModificationPathRefs: [TARGET-MOD-001]
    currentTargetMapRefs: [CTM-001, SURFACE-001]
    artifactRefs: [ART-001]
    commandRefs: [CMD-TEST-001]
    aiTddManifestRefs:
      errorCaseCoverage: [FAIL-001, EDGE-001]
      commandTargets: [CMD-TEST-001]
      traceClosureAssertions: [TRACE-001]
      currentTargetMap: [CTM-001]
      canonicalSurfaceReconciliation: [SURFACE-001]
      legacyDenial: [LEGACY-001]
      closeoutProof: [CLOSEOUT-001]
      evidenceTrustStates: [EVD-001]
    projectionStatus: synchronized
```

Allowed `projectionStatus` values:

- `synchronized`
- `missing_projection`
- `stale_projection`
- `conflicting_projection`

Only `synchronized` can be confirmable.

### `mustDrilldownAuditPolicy`

Required fields:

```yaml
mustDrilldownAuditPolicy:
  requiredBeforeHtmlRender: true
  minimumPasses:
    - expansion_pass
    - adversarial_gap_pass
    - atomicity_pass
    - closure_proof_pass
  minimumNoNewGapRounds: 3
  requiresFileDiscoveryEvidence: true
  requiresMutationPressureTests: true
  allowedConvergenceVerdicts:
    - blocked
    - conditional
    - bounded_no_new_gap
    - high_confidence_ready_for_confirmation
  confirmationAllowedVerdicts:
    - bounded_no_new_gap
    - high_confidence_ready_for_confirmation
```

## Drilldown Iteration Protocol

### Pass 0: Semantic Kernel Pass

Before expanding individual `MUST-*` rows, the model must create or update the compact semantic kernel.

The model must answer:

- What is the user's actual target outcome?
- What is explicitly out of scope?
- What is the current system behavior?
- What must become true in the target state?
- Which entry flows, skills, scripts, records, renderers, gates, or manifests can affect the outcome?
- Which old path could still satisfy a shallow test while violating the target behavior?
- Which proof would be invalid because it is smoke-only, mock-only, exit-code-only, stale, or self-certified?
- Which uncertainties are semantic blockers instead of implementation details?

The output must update the semantic kernel and classify each uncertainty as a semantic gap, non-semantic execution gap, open question, or explicit OUT boundary candidate.

### Pass 1: Expansion Pass

For each `MUST-*`, the model must expand:

- observable behavior,
- affected entry flows,
- old behavior,
- target behavior,
- target files and fields,
- integration points,
- tests and acceptance oracles,
- failure and fallback cases,
- audit and closeout implications,
- invalid proof types.

The output must update `mustExecutionDecompositionMatrix[]`.

### Pass 2: Adversarial Gap Pass

This pass must actively search for omissions. It must ask:

- Which entry flow could still bypass this MUST?
- Which legacy fallback could still become the default?
- Which target file is inferred but not discovered from real repository files?
- Which test can pass while still exercising the old path?
- Which audit loop could be skipped after compiler or runner integration?
- Which host capability assumption is unproven?
- Which `NEG-*`, `FAIL-*`, or `EDGE-*` lacks a negative test?
- Which target path has no file-level change responsibility?
- Which task is still too broad?
- Which EVD/TRACE/ACC/E2E/currentTarget/AI-TDD projection was authored independently from the drilldown packet?
- Which "valid-looking" table row would still pass if the important implementation behavior were deleted?

The output must create or update `mustDecompositionGaps[]`.

### Pass 3: Atomicity Pass

This pass must split any task that is too broad.

A task is too broad when:

- it touches unrelated entry flows,
- it changes more than one independent behavior,
- it has multiple independent RED proofs,
- it cannot be completed in one Ralph user story or trace slice,
- it uses vague verbs without file-level responsibilities,
- or it cannot be audited by one focused acceptance or E2E assertion.

The output must update `atomicImplementationTaskList[]`.

### Pass 4: Closure Proof Pass

This pass must classify every gap:

- resolved,
- converted to an open question,
- converted to an OUT boundary,
- waived by explicit user decision,
- or still blocking.

It must not report `gap=0` as absolute truth. It must report one of:

- `blocked`,
- `conditional`,
- `bounded_no_new_gap`,
- `high_confidence_ready_for_confirmation`.

## Adaptive Execution Plan Policy

Pre-confirmation drilldown produces a model-derived initial execution plan, not a fixed implementation script. The plan must be strict enough to prevent shallow confirmation, but adaptive enough to let implementation discover better non-semantic decomposition.

Allowed adaptive changes after confirmation:

- split an atomic task into smaller tasks without changing requirement semantics,
- add validation-only test files for an existing ACC/E2E oracle,
- refine target path classifications when the confirmed target behavior is unchanged,
- add implementation notes or Ralph progress rows that map back to existing IDs,
- add non-semantic command receipts or evidence collection steps for the same confirmed evidence oracle.

Forbidden adaptive changes without reconfirmation:

- changing `MUST/NEG/OUT` meaning,
- adding new product or governance scope,
- replacing an ACC/E2E oracle,
- changing what counts as evidence,
- removing a failure path, edge case, negative control, target surface, or current/target difference,
- treating task completion as requirement pass,
- treating generated packets, render output, or completion evidence packets as closeout authority.

When a gap is discovered during implementation, the executor must classify it first:

```text
semantic gap -> reconfirm_required
non-semantic execution gap -> amend execution plan and continue
evidence gap -> keep trace open until current-attempt evidence exists
closeout gap -> block delivery verification or closeout integrity
```

## Pre-Confirmation Decomposition Audit Prompt

The existing post-implementation audit prompt style can be reused, but the audit object and verdict semantics must change.

### Audit Object

The prompt audits:

- `mustExecutionDecompositionMatrix[]`,
- `atomicImplementationTaskList[]`,
- `mustDecompositionGaps[]`,
- `targetModificationPaths[]`,
- `acceptanceTests[]`,
- `e2eSuites[]`,
- `failurePaths[]`,
- `edgeCases[]`,
- `currentTargetMap`,
- `aiTddContractExecutionManifestProjection` or equivalent AI-TDD manifest data.

### Required Auditor Roles

The audit must separate at least three views:

- `author`: explains the decomposition.
- `critical auditor`: finds missing entry flows, bypasses, error paths, fake coverage, over-broad tasks, missing projections, invalid proof types, and premature convergence.
- `implementation mapper`: checks target files and surfaces against actual repository files.

The same model may perform the roles only if each role uses a separate prompt section, separate checklist, and separate evidence table.

### Critical Auditor Role Contract

The Critical Auditor role is mandatory. Existing Cursor, Claude Code, or Codex CLI critical-auditor agents may implement this role when they satisfy the input/output contract below. If the host cannot invoke a separate agent, the flow may use `inline_role_fallback`, but the receipt schema and convergence rules remain mandatory.

```yaml
criticalAuditorRole:
  required: true
  purpose: pre_confirmation_semantic_gap_attack
  stage: before_html_render
  allowedImplementations:
    - cursor_agent
    - claude_code_agent
    - codex_cli_agent
    - inline_role_fallback
  notResponsibleFor:
    - implementation_completion
    - delivery_verification
    - closeout_integrity
    - replacing_source_authority
```

The invocation must record:

```yaml
criticalAuditorInvocation:
  implementationName: cursor_agent | claude_code_agent | codex_cli_agent | inline_role_fallback
  agentVersionOrPromptHash: sha256:...
  inputHash: sha256:...
  outputHash: sha256:...
  roundIndex: 1
  previousGapHistoryHash: sha256:...
```

The input must include the full semantic and materialization context:

```yaml
inputMustInclude:
  - semanticKernel
  - must_decomposition_packet
  - implementationConfirmation
  - mustExecutionDecompositionMatrix
  - atomicImplementationTaskList
  - evidence
  - traceRows
  - acceptanceTests
  - e2eSuites
  - failurePaths
  - edgeCases
  - targetModificationPaths
  - currentTargetMap
  - aiTddContractExecutionManifestProjection
  - artifactAutomationPlan
  - requiredCommands
  - closeoutReadinessPreview
  - priorGapHistory
  - discoveredFiles
```

Each round must emit a structured receipt:

```yaml
criticalAuditorReceipt:
  schemaVersion: critical-auditor-receipt/v1
  roundIndex: 1
  inputHash: sha256:...
  attackVectors: []
  gapCandidates: []
  validatedGaps: []
  rejectedGapCandidates: []
  mutationPressureFindings: []
  overBroadTaskFindings: []
  missingProjectionFindings: []
  invalidProofFindings: []
  legacyBypassFindings: []
  sourceMaterializationFindings: []
  noNewGapRationale: ""
  convergenceDecision:
    verdict: new_gap_found | no_new_confirmation_blocking_gap | blocked | insufficient_audit
    resetsConvergenceCounter: true
```

The Critical Auditor must have higher review weight than the Author. This is a coverage requirement, not a word-count requirement:

```yaml
criticalAuditorPolicy:
  minimumReviewWeight: 0.5
  authorClaimChallengeRequired: true
  everyAuthorClaimMustHaveCriticDisposition: true
```

Every author-derived claim about a `MUST-*`, atomic task, evidence row, trace row, acceptance row, target path, current/target row, AI-TDD manifest row, or closeout boundary must receive one Critical Auditor disposition: accepted, rejected, gap_candidate, validated_gap, or not_applicable_with_reason.

Each Critical Auditor round must attack the source even when it finds no valid gap. The correct output is not "must always invent a gap"; it is "must always attempt attacks and record what happened." A round with no valid gap must include rejected gap candidates and a no-new-gap rationale.

Required attack categories:

- intent_boundary,
- current_target_gap,
- entry_flow_bypass,
- target_surface_missing,
- over_broad_atomic_task,
- missing_failure_path,
- missing_edge_case,
- weak_evidence_oracle,
- missing_red_proof,
- invalid_proof_type,
- legacy_bypass,
- missing_negative_control,
- missing_evd_trace_acc_e2e_projection,
- missing_ai_tdd_manifest_projection,
- missing_closeout_boundary,
- task_completion_misused_as_requirement_pass.

### Critical Auditor Convergence

The drilldown cannot converge until the Critical Auditor produces three consecutive rounds with no new confirmation-blocking gap.

```yaml
drilldownConvergencePolicy:
  minimumRounds: 3
  closeCondition: three_consecutive_rounds_without_new_confirmation_blocking_gap
  gapTypesThatResetCounter:
    - semantic_gap
    - target_path_gap
    - test_gap
    - trace_gap
    - evidence_oracle_gap
    - current_target_gap
    - ai_tdd_manifest_gap
    - legacy_bypass_gap
    - over_broad_task_gap
    - missing_projection_gap
```

Round outcome semantics:

- `new validated gap`: repair required and convergence counter resets to zero.
- `gap candidate rejected`: keep the audit record, do not block by itself.
- `no new confirmation-blocking gap`: increment the convergence counter.
- `insufficient_audit`: block render; the round does not count.

### Prompt Skeleton

```text
You are auditing pre-confirmation MUST decomposition quality, not implementation completion.

Source:
- sourceDocument: <path>
- implementationConfirmation: <inline block or extracted JSON>
- discoveredFiles: <file discovery evidence>

Audit objects:
- mustExecutionDecompositionMatrix[]
- atomicImplementationTaskList[]
- mustDecompositionGaps[]
- targetModificationPaths[]
- ACC/E2E/failure/edge rows
- currentTargetMap
- AI-TDD manifest projection

Critical rules:
1. Do not accept field presence as completeness.
2. For every MUST, verify observable behavior, entry flows, target surfaces, per-file change plan, error/fallback cases, RED proof, and audit checks.
3. Mark vague tasks as gaps unless concrete observable behavior and file-level change responsibilities exist.
4. Treat "path listed but no planned change" as a target_path_gap.
5. Treat "test file listed but no scenario/oracle/RED plan" as a test_gap.
6. Treat missing Ralph/TDD/no-gap preservation as audit_gap.
7. Treat missing legacy bypass negative test as legacy_bypass_gap.
8. Run mutation/deletion pressure reasoning: if deleting a target path, test, or audit loop would not fail a gate, report a gap.

Verdict:
- blocked
- conditional
- bounded_no_new_gap
- high_confidence_ready_for_confirmation

Return:
- criticalAuditorReceipt
- attackVectors[]
- gapCandidates[]
- validatedGaps[]
- rejectedGapCandidates[]
- newGaps[]
- closedGaps[]
- unresolvedConfirmationGaps[]
- unresolvedImplementationGaps[]
- atomicityFailures[]
- overBroadTaskFindings[]
- missingProjectionFindings[]
- mutationPressureFindings[]
- noNewGapRationale
- convergenceDecision
- recommendedSourceEdits[]
```

### Audit Verdict Rules

- `blocked`: any `blocksConfirmation=true` gap remains.
- `conditional`: no confirmation blocker remains, but implementation assumptions are unresolved.
- `bounded_no_new_gap`: no confirmation blocker remains, at least three Critical Auditor rounds found no new confirmation-blocking gap, and mutation pressure tests pass.
- `high_confidence_ready_for_confirmation`: `bounded_no_new_gap` plus file discovery evidence and implementation mapper review are complete.

## Script And Renderer Boundary

Scripts, renderer checks, and reverse-audit gates must remain bottom-line fail-closed mechanisms. They must not become the primary reasoning engine.

Scripts are responsible for deterministic checks:

- required fields exist,
- IDs parse and references resolve,
- trace/evidence/ACC/E2E references close,
- `mustDerivedProjectionMap.projectionStatus` is synchronized,
- `must_decomposition_packet.json` hashes match the current source and semantic kernel,
- packet projections reconcile with materialized `implementationConfirmation` rows,
- Critical Auditor receipts exist, match current inputs, and satisfy convergence policy,
- open semantic gaps block confirmation,
- renderer report contains required sections,
- forbidden vague terms appear without observable behavior,
- task completion is not treated as requirement pass,
- delivery or closeout claims are not derived from source packets or render output.

Scripts are not responsible for proving that the model has fully understood the product or governance intent. That responsibility belongs to the skill workflow and the model self-questioning protocol. If scripts alone become the main quality mechanism, the model will learn to fill fields instead of thinking through the requirement.

## Pre-Render Gate Requirements

A new pre-render gate, `cp-must-atomic-decomposition`, must run before HTML confirmation render.

It must block when:

- `must_decomposition_packet.json` is missing,
- `must_decomposition_packet.status` is not `synchronized`,
- the packet `sourceDocumentHash`, `semanticKernelHash`, or `packetHash` is stale,
- any `MUST-*` lacks a `mustExecutionDecompositionMatrix[]` row,
- any `MUST-*` lacks at least one `atomicImplementationTaskList[]` row,
- any `mustPackets[]` row lacks complete `decompositionBasis`,
- any `mustPackets[]` row lacks complete `atomicityDrivers`,
- any `mustPackets[]` row lacks required self-question categories for its risk level,
- any `mustPackets[]` row has `questionCoverage.coverageVerdict` other than `complete`,
- any `mustPackets[]` row has `atomicityCompleteness.completenessVerdict` other than `complete`,
- any `mustPackets[]` row has `actualTaskCount < expectedTaskCount`,
- any atomic task covers more than one independent behavior/surface/oracle unit,
- any atomic task lacks `targetFiles[]`,
- any target file lacks `perFileChangePlan[]`,
- any task lacks `acceptanceRefs[]` or `e2eRefs[]`,
- any task lacks `failurePathRefs[]` or `edgeCaseRefs[]` when the MUST is high risk,
- any task lacks `redProofPlan`,
- any task has `estimatedAtomicity` broader than one Ralph user story or trace slice,
- any confirmation-blocking gap is open,
- any vague verb appears without observable behavior and file-level plan,
- the decomposition audit verdict is not `bounded_no_new_gap` or `high_confidence_ready_for_confirmation`.
- Critical Auditor receipts are missing,
- any Critical Auditor receipt input hash is stale,
- any Author claim lacks Critical Auditor disposition,
- any Critical Auditor round reports `insufficient_audit`,
- three consecutive no-new-confirmation-blocking-gap rounds have not been reached,
- any validated Critical Auditor gap remains unresolved.

The gate must emit:

- `must_decomposition_packet.json`,
- `must_decomposition_receipt.json`,
- `must_packet_source_reconciliation_report.json`,
- and blocking codes suitable for renderer and reverse-audit consumption.

The gate must also verify synchronized packet-to-source projections. It must block when:

- any `MUST-*` lacks exactly one `mustPackets[]` row in the packet,
- any `MUST-*` lacks a `mustDerivedProjectionMap` row,
- any source EVD/TRACE/ACC/E2E/failure/edge/target/current-target/AI-TDD/artifact/command/closeout row lacks `derivedFromPacketHash` or equivalent packet back-reference,
- any packet projection lacks `materializedTo[]` and does not explicitly declare non-applicability,
- any packet projection points to a missing source row,
- any source row points to a missing or stale packet projection,
- any `MUST-*` has atomic tasks but no evidence projection,
- any `MUST-*` has evidence but no trace projection,
- any `MUST-*` has trace rows but no ACC/E2E projection,
- any high-risk `MUST-*` has no failure/edge projection,
- any target path is not linked through `mustDerivedProjectionMap.targetModificationPathRefs[]`,
- any `currentTargetMap` row is not linked to the relevant `MUST-*`,
- any AI-TDD manifest section lacks back-reference to `mustDerivedProjectionMap`,
- any projection status is `missing_projection`, `stale_projection`, or `conflicting_projection`.

## Renderer Requirements

The confirmation HTML must display:

- packet metadata, hashes, and status,
- packet-to-source reconciliation status,
- Critical Auditor implementation, rounds, receipts, validated gaps, rejected gap candidates, and convergence counter,
- a MUST-to-atomic-task table,
- per-file change plan rows,
- gaps grouped by confirmation / implementation / closeout impact,
- decomposition audit verdict,
- drilldown pass history,
- MUST-derived projection coverage,
- mutation pressure findings,
- and the relationship between atomic tasks and Ralph/trace execution.

If decomposition data is missing or blocked, `confirmability=blocked`.

If the packet is stale, missing, not synchronized, or not fully materialized into `implementationConfirmation`, `confirmability=blocked`.

If a MUST-derived projection is missing or stale, `confirmability=blocked` even when the raw target section exists.

## AI-TDD Manifest Requirements

AI-TDD `ContractExecutionManifest` must treat decomposition as first-class input to implementation execution.

Required additions:

- `mustDecompositionPacketRef`,
- `mustPacketSourceReconciliationReport`,
- `mustExecutionDecompositionMatrix`,
- `atomicImplementationTaskList`,
- `mustDecompositionGaps`,
- `mustDerivedProjectionMap`,
- `decompositionAuditReceipt`,
- `atomicTaskToTraceMap`,
- `atomicTaskToCommandMap`,
- `atomicTaskToTargetPathMap`,
- `mustToEvidenceMap`,
- `mustToAcceptanceMap`,
- `mustToCurrentTargetMap`,
- `mustToAiTddManifestMap`,
- `auditLoopPreservation`.

The AI-TDD gate must fail closed when a trace slice, command target, evidence row, acceptance row, current/target row, canonical surface, legacy denial row, or closeout proof row cannot be mapped back to both a `MUST-*` and an atomic task.

The AI-TDD gate must also fail closed when a mapped row cannot be traced back to a synchronized `must_decomposition_packet.json` projection. This does not make the packet delivery proof; it only proves the execution manifest was derived from the same pre-confirmation semantic drilldown.

## Ralph / Story / Standalone Integration

Ralph Method remains the execution continuity mechanism.

Rules:

- `atomicImplementationTaskList[]` is the source for Ralph `userStories[]`.
- Ralph `prd/progress` records execution state; it must not invent new scope.
- Story, bugfix, and standalone task flows must preserve existing TDD, Critical Auditor, no-gap, and closeout loops.
- If implementation discovers that atomic tasks are incomplete or too broad, the source must move to `reconfirm_required`.
- `continue nonstop` is allowed as a Codex optimization, but it must not replace Ralph progress, resume checkpoints, or audit loops.

## Acceptance Criteria

- The authoring flow exposes productized states from `source_identified` through `user_confirmable`.
- The authoring flow resumes from semantic kernel, packet, Critical Auditor receipt history, checkpoint progress, and source hash instead of restarting broad reasoning.
- The confirmation page shows the semantic kernel summary, packet summary, atomicity drivers, Critical Auditor convergence, packet/source reconciliation, and confirmation-only scope warning.
- A source authored through checkpoint mode is blocked before HTML render if it skipped the semantic kernel layer and went directly to final document section materialization.
- A source is blocked before HTML render if `must_decomposition_packet.json` is missing, stale, blocked, or not synchronized.
- A source is blocked before HTML render if packet projections are not fully materialized into `implementationConfirmation`.
- A source is blocked before HTML render if `implementationConfirmation` contains EVD/TRACE/ACC/E2E/failure/edge/target/current-target/AI-TDD/artifact/command/closeout rows that cannot be traced back to packet projections.
- A source is blocked before HTML render if any `MUST-*` has incomplete question coverage for its risk level.
- A source is blocked before HTML render if any `MUST-*` has `actualTaskCount < expectedTaskCount` based on atomicity drivers.
- A source is blocked before HTML render if a single atomic task covers multiple independent behavior/surface/oracle units.
- A source is blocked before HTML render if Critical Auditor receipts are missing, stale, insufficient, or not tied to the current packet/source hashes.
- A source is blocked before HTML render if any Author claim lacks Critical Auditor disposition.
- A source is blocked before HTML render if fewer than three consecutive Critical Auditor rounds have no new confirmation-blocking gap.
- A source with a one-sentence `MUST-*` and no decomposition is blocked before HTML render.
- A source with target paths but no per-file change plan is blocked.
- A source with ACC/E2E files but no scenario, oracle, or RED proof plan is blocked.
- A source with `gap=0` but no adversarial pass history is blocked.
- A source with atomic tasks but missing EVD/TRACE/ACC/E2E projections is blocked.
- A source with EVD/TRACE/ACC/E2E rows that were authored independently from the MUST drilldown packet is blocked unless `mustDerivedProjectionMap.projectionStatus=synchronized`.
- A source with AI-TDD manifest sections that cannot map back to `MUST-*` and atomic tasks is blocked.
- A source with an open `blocksConfirmation=true` gap is blocked.
- A source with three consecutive no-new-gap Critical Auditor rounds, file discovery evidence, mutation pressure findings, and complete atomic task mapping can render as confirmable.
- Ralph `prd/progress` generation consumes atomic tasks without redefining scope.
- Implementation prompt generation uses atomic task IDs and refuses trace slices without atomic task bindings.
- Runtime execution may amend non-semantic execution tasks while preserving confirmed semantics.
- Runtime execution must move the source to `reconfirm_required` when a semantic gap is discovered.
- Delivery closeout cannot be derived from `atomicImplementationTaskList[]`, `must_decomposition_packet.json`, render output, or a completion evidence packet.

## Suggested Target Paths

The implementation of this requirement is expected to touch these source surfaces:

- `_bmad/skills/requirements-contract-authoring/SKILL.md`
- `_bmad/skills/requirements-contract-authoring/references/contract-template.md`
- `_bmad/skills/requirements-contract-authoring/references/html-confirmation-renderer-spec.md`
- `_bmad/skills/requirements-contract-authoring/references/semantic-checkpoint-workflow.md`
- `_bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js`
- `_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts`
- `_bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown.js`
- `scripts/ai-tdd-contract-gate.ts`
- `.codex/skills/bmad-standalone-tasks/references/prompt-templates.md`
- `.codex/skills/ralph-method/SKILL.md`
- `.codex/skills/bmad-story-assistant/SKILL.md`
- `tests/acceptance/requirements-contract-checkpoint-automation.test.ts`
- `tests/acceptance/render-requirements-confirmation-html.test.ts`
- `tests/acceptance/ai-tdd-contract-gate.test.ts`
- `tests/acceptance/requirements-contract-authoring-skill-contract.test.ts`

These paths are a planning surface, not implementation proof. The final source document for implementing this requirement must bind them to `targetModificationPaths[]`, `atomicImplementationTaskList[]`, ACC/E2E rows, and AI-TDD manifest command targets.

## Open Risks

- A model may still produce plausible but incomplete decomposition unless adversarial and implementation-mapper passes are enforced.
- Mutation pressure tests must be deterministic enough to become useful gates instead of prose-only review.
- Existing render and AI-TDD schema may need careful migration to avoid treating decomposition as optional.
- Generated decomposition packets must not become another self-certification artifact.

## Summary

The confirmation phase must graduate from "schema-complete requirements" to "semantic contract confirmed by the user, with a model-derived adaptive execution baseline".

The key change is semantic drilldown before section materialization:

```text
abstract request
-> compact semantic kernel
-> MUST drilldown
-> must_decomposition_packet.json
-> synchronized EVD/TRACE/ACC/E2E/target/currentTarget/manifest projections
-> initial atomic execution baseline
-> gaps classified
-> Critical Auditor attacks until three-round bounded no-new-gap convergence
-> section materialization
-> packet-to-source reconciliation
-> confirmation page
```

Without this layer, downstream gates can only validate a weak source definition. With it, the user confirms a semantic contract and an explicit execution baseline while preserving the ability to adapt non-semantic implementation details during execution.

The final truth chain remains:

```text
confirmed semantic contract
+ failure/edge coverage
+ current/target reconciliation
+ oracle-bound ACC/E2E
+ AI-TDD manifest gate
+ delivery verification
+ closeout integrity
```

The initial task list helps execution begin. It never proves delivery by itself.

## Implementation Addendum: Strict Productized Delivery Loop

This addendum defines the strict implementation loop for `$requirements-contract-authoring`. The scope is limited to requirements source authoring and productized confirmation-page interaction. It does not expand this requirement into full BMAD implementation, delivery verification, release readiness, or closeout readiness.

The core upgrade is that the skill must not move directly from user input or a source document into long-form source writing. It must first complete a recoverable, auditable, packet-driven pre-confirmation semantic drilldown, then materialize the inline `implementationConfirmation` and HTML confirmation page from that drilldown.

### Final Productized Flow

The final flow must be:

```text
user requirement or source document
-> source identification
-> scale assessment
-> semantic kernel authoring
-> MUST atomic decomposition loop
-> Critical Auditor adversarial rounds
-> three consecutive no_new_valid_gap rounds
-> must_decomposition_packet synchronized
-> packet projections materialized into implementationConfirmation
-> packet/source reconciliation
-> pre-render MUST decomposition gate
-> renderer drilldown gate
-> HTML confirmation page
-> user scope confirmation
```

If any core stage is missing, the renderer may generate a blocked page, but it must not generate `confirmability=confirmable`.

### Authority Model

`implementationConfirmation` remains the final user confirmation authority.

`semantic-kernel.json` is the pre-confirmation global semantic model. It is not the final confirmed contract.

`must_decomposition_packet.json` is the pre-confirmation derivation authority. It proves that `MUST-*` rows were decomposed, self-questioned, projected, attacked by a Critical Auditor, and converged. It is not a second requirements contract, implementation proof, delivery proof, or closeout proof.

`atomicImplementationTaskList[]` is the initial execution baseline only. It may seed Ralph, story, bugfix, or standalone execution planning, but it must never prove requirement completion, delivery readiness, or closeout readiness.

`EVD/TRACE/ACC/E2E/currentTargetMap/AI-TDD manifest` rows must be synchronized projections from `must_decomposition_packet.json`. Any source row that cannot be traced back to a packet projection is independently invented content and must block confirmation.

### Productized Interaction State Machine

The authoring flow must expose these states:

```text
idle
-> source_identified
-> scale_assessed
-> semantic_kernel_ready
-> atomic_decomposition_in_progress
-> gap_resolution_required
-> atomic_decomposition_converged
-> packet_synchronized
-> source_materialized
-> packet_source_reconciled
-> pre_render_ready
-> confirmation_rendered
-> user_confirmable
```

Blocking states must be explicit:

```text
blocked_by_missing_source
blocked_by_unresolved_user_decision
blocked_by_missing_scale_assessment
blocked_by_stale_scale_assessment
blocked_by_missing_semantic_kernel
blocked_by_stale_semantic_kernel
blocked_by_missing_packet
blocked_by_stale_packet
blocked_by_packet_not_synchronized
blocked_by_critical_auditor_gap
blocked_by_missing_critical_auditor_receipt
blocked_by_less_than_three_no_new_gap_rounds
blocked_by_unresolved_validated_gap
blocked_by_incomplete_question_coverage
blocked_by_under_split_task
blocked_by_over_broad_atomic_task
blocked_by_missing_projection
blocked_by_projection_not_materialized
blocked_by_source_row_invented
blocked_by_packet_source_drift
blocked_by_missing_reconciliation
blocked_by_render_gate
```

### Stage 0: Baseline Capability Audit

Implementation must start with a read-only baseline audit. Do not edit code before this audit is complete.

The fixed audit surface is:

```text
.codex/skills/requirements-contract-authoring/SKILL.md
_bmad/skills/requirements-contract-authoring/references/semantic-checkpoint-workflow.md
_bmad/skills/requirements-contract-authoring/references/contract-template.md
_bmad/skills/requirements-contract-authoring/references/html-confirmation-renderer-spec.md
_bmad/skills/requirements-contract-authoring/references/matrix-rules.md
_bmad/skills/requirements-contract-authoring/references/reverse-audit-gate.md
_bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js
_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts
```

The capability matrix must contain these columns:

| Current capability | Required capability | Gap | Documentation gap | Script gap | Renderer gap | Reverse audit gap | Test gap |
|---|---|---|---|---|---|---|---|

The audit must distinguish existing field-presence capabilities from the new semantic drilldown and synchronized projection capabilities. Existing `confirmability`, `deliveryReadiness`, checkpoint runner, or stage-specific reverse audit CLIs do not by themselves satisfy this requirement.

### Stage 1: Source Identification

Allowed inputs are:

```text
current-session user requirement
existing PRD / BUGFIX / TASKS / requirement source document
```

Required output:

```text
source_identified
recordId
requirementSetId
sourceDocument path
sourceDocumentHash
source type
entryFlow
entryFlowClass
workflowAdapter
```

Blocking rules:

```text
missing requirement source -> blocked_by_missing_source
source document conflicts with current user requirement and cannot be resolved from context -> blocked_by_unresolved_user_decision
requested update reduces or reinterprets confirmed scope -> Scope Change Request
```

### Stage 2: Scale Assessment

Scale assessment must run before deciding between single-pass materialization and checkpoint authoring.

Allowed decisions:

```text
single_pass_allowed
checkpoint_required
checkpoint_required_with_amendment
```

`single_pass_allowed` means final document materialization may not need multiple checkpoint commits. It must not skip semantic kernel authoring, atomic decomposition loop, Critical Auditor convergence, packet/source reconciliation, or the pre-render gate.

Required artifact:

```text
scale-assessment.json
```

Required shape:

```yaml
schemaVersion: contract-authoring-scale-assessment/v1
recordId: REQ-...
sourceDocument: docs/requirements/...
sourceDocumentHash: sha256:...
decision: single_pass_allowed | checkpoint_required | checkpoint_required_with_amendment
authoringMode: semantic_kernel_then_packet | kernel_then_checkpoint | kernel_then_checkpoint_with_amendment
riskSignals: []
recommendedNextAction: ""
```

Blocking rules:

```text
scale assessment missing -> blocked_by_missing_scale_assessment
scale assessment source hash stale -> blocked_by_stale_scale_assessment
```

### Stage 3: Semantic Kernel Authoring

A compact semantic kernel must be generated before long-form document writing, `implementationConfirmation` materialization, or HTML rendering.

`semantic-kernel.json` is the global semantic model and must include at least:

```yaml
semanticKernel:
  schemaVersion: semantic-kernel/v1
  recordId: REQ-...
  sourceDocument: docs/requirements/example.md
  sourceDocumentHash: sha256:...
  goal: ""
  nonGoals: []
  currentState: []
  targetState: []
  mustCandidates: []
  negativeCandidates: []
  outBoundaryCandidates: []
  failureTopology: []
  edgeTopology: []
  targetSurfaces: []
  evidencePrinciples: []
  acceptanceOraclePrinciples: []
  aiTddManifestCoveragePlan: []
  openQuestions: []
  blockers: []
  kernelHash: sha256:...
```

Semantic kernel responsibilities:

```text
build the global semantic model
identify MUST/NEG/OUT candidates
identify current/target deltas
identify failure paths and boundary conditions
identify target files, scripts, records, commands, views, or manifest surfaces
define evidence oracle and ACC/E2E oracle principles
define the AI-TDD manifest coverage plan
record semantic questions requiring user decisions
```

Blocking rules:

```text
semantic-kernel.json missing -> blocked_by_missing_semantic_kernel
sourceDocumentHash stale -> blocked_by_stale_semantic_kernel
kernelHash missing or malformed -> blocked_by_stale_semantic_kernel
goal/currentState/targetState missing core content -> blocked_by_missing_semantic_kernel
```

### Stage 4: MUST Atomic Decomposition Loop

Every `MUST-*` must enter `must_decomposition_packet.json`. A `MUST-*` must not remain only a one-sentence requirement, and the workflow must not copy prose directly into `implementationConfirmation.must[]` without decomposition.

Each `mustPackets[]` row must include at least:

```yaml
mustRef: MUST-001
mustIntent: ""
semanticClassification:
  kind: product_behavior | governance_control | workflow_rule | evidence_rule
  riskLevel: low | medium | high | critical
decompositionBasis:
  observableBehaviors: []
  affectedEntryFlows: []
  targetSurfaces: []
  stateTransitions: []
  externalSideEffects: []
  failureModes: []
  edgeConditions: []
  evidenceOracles: []
  invalidProofTypes: []
atomicityDrivers:
  behaviorSurfaceOracleUnits: []
  entryFlowVariants: []
  failureModeVariants: []
  stateTransitionVariants: []
  sideEffectVariants: []
  auditLoopVariants: []
questionCoverage:
  requiredCategories: []
  answeredCategories: []
  missingCategories: []
  coverageVerdict: complete | incomplete
openQuestionDisposition:
  blockingOpenQuestions: []
  nonBlockingAssumptions: []
  convertedToOutBoundaries: []
  noOpenQuestionJustification: ""
atomicityCompleteness:
  splitRule: one_task_per_independent_behavior_surface_oracle
  expectedTaskCount: 0
  actualTaskCount: 0
  completenessVerdict: complete | incomplete | over_broad | under_split
selfQuestions: []
mustAtomicTasks: []
mustEvidenceProjection: []
mustTraceProjection: []
mustAcceptanceProjection: []
mustFailureEdgeProjection: []
mustTargetPathProjection: []
mustCurrentTargetProjection: []
mustAiTddManifestProjection: []
mustArtifactProjection: []
mustCommandProjection: []
mustCloseoutBoundaryProjection: []
gaps: []
```

Required self-question categories:

```text
intent_boundary
current_state
target_state
entry_flow
target_surface
state_transition
failure_edge
legacy_bypass
evidence_oracle
red_proof
negative_control
integration_side_effect
audit_loop
closeout_boundary
```

High-risk and critical `MUST-*` rows must cover all categories. Low-risk and medium-risk rows may narrow the category set only with explicit rationale.

Atomic task validity rules:

```text
one task has one primary observable behavior
one task has one primary target surface group
one task has one primary acceptance oracle
one task has a clear redProofPlan
one task binds targetFiles[] or explicitly proves no file modification is needed
one target file has perFileChangePlan[]
one task must not span multiple independent entry flows, failure modes, or evidence oracles
```

Blocking rules:

```text
must_decomposition_packet missing -> blocked_by_missing_packet
MUST lacks mustPackets row -> blocked_by_missing_projection
questionCoverage incomplete -> blocked_by_incomplete_question_coverage
actualTaskCount < expectedTaskCount -> blocked_by_under_split_task
atomic task covers multiple independent behavior/surface/oracle units -> blocked_by_over_broad_atomic_task
target path lacks per-file change plan -> blocked_by_missing_projection
ACC/E2E lacks scenario, oracle, or RED proof plan -> blocked_by_missing_projection
open confirmation-blocking gap remains -> blocked_by_unresolved_validated_gap
```

### Stage 5: Critical Auditor Receipt Loop

Critical Auditor is mandatory. The skill workflow owns auditor invocation. Node scripts validate receipts only and must not directly depend on Cursor, Claude, Codex, or other agent APIs.

Each round must emit:

```yaml
criticalAuditorReceipt:
  schemaVersion: critical-auditor-receipt/v1
  roundIndex: 1
  inputHash: sha256:...
  attackVectors: []
  gapCandidates: []
  validatedGaps: []
  rejectedGapCandidates: []
  mutationPressureFindings: []
  overBroadTaskFindings: []
  missingProjectionFindings: []
  invalidProofFindings: []
  legacyBypassFindings: []
  sourceMaterializationFindings: []
  noNewGapRationale: ""
  convergenceDecision:
    verdict: new_gap_found | no_new_valid_gap | blocked | insufficient_audit
    resetsConvergenceCounter: true
```

Each auditor input must include:

```text
semanticKernel
must_decomposition_packet
implementationConfirmation when available
mustExecutionDecompositionMatrix
atomicImplementationTaskList
evidence
traceRows
acceptanceTests
e2eSuites
failurePaths
edgeCases
targetModificationPaths
currentTargetMap
aiTddContractExecutionManifestProjection
artifactAutomationPlan
requiredCommands
closeoutReadinessPreview
priorGapHistory
discoveredFiles
```

Convergence rules:

```text
new_gap_found -> repair gap and reset convergence counter to 0
blocked -> stop and do not render confirmable HTML
insufficient_audit -> does not count as a round and blocks
no_new_valid_gap -> increment convergence counter by 1
three consecutive no_new_valid_gap rounds -> atomic_decomposition_converged
```

Blocking rules:

```text
receipt missing -> blocked_by_missing_critical_auditor_receipt
receipt inputHash stale -> blocked_by_missing_critical_auditor_receipt
less than 3 no-new-gap rounds -> blocked_by_less_than_three_no_new_gap_rounds
validated gap unresolved -> blocked_by_unresolved_validated_gap
Author claim lacks critic disposition -> blocked_by_critical_auditor_gap
```

### Stage 6: Packet Synchronization

`must_decomposition_packet.json` may be marked synchronized only after all `MUST-*` rows complete decomposition, projection, and Critical Auditor convergence.

Required top-level packet shape:

```yaml
must_decomposition_packet:
  schemaVersion: must-decomposition-packet/v1
  recordId: REQ-...
  sourceDocument: docs/requirements/example.md
  sourceDocumentHash: sha256:...
  semanticKernelHash: sha256:...
  packetHash: sha256:...
  status: draft | synchronized | stale | blocked
  generatedAt: null
  generatedBy: requirements-contract-authoring
  materializationTarget: implementationConfirmation
  mustPackets: []
  mustDerivedProjectionMap: []
  gapHistory: []
  criticalAuditorReceiptRefs: []
```

Blocking rules:

```text
packet status != synchronized -> blocked_by_packet_not_synchronized
semanticKernelHash mismatch -> blocked_by_stale_packet
sourceDocumentHash mismatch -> blocked_by_stale_packet
packetHash missing or stale -> blocked_by_stale_packet
mustDerivedProjectionMap missing -> blocked_by_missing_projection
```

### Stage 7: implementationConfirmation Materialization

Only this stage may materialize inline `implementationConfirmation`.

Materialization scope:

```text
preConfirmationDrilldown
mustExecutionDecompositionMatrix[]
atomicImplementationTaskList[]
must[]
notDone[]
mustNot[]
evidence[]
traceRows[]
acceptanceTests[]
e2eSuites[]
failurePaths[]
edgeCases[]
targetModificationPaths[]
currentTargetMap
aiTddContractExecutionManifestProjection
artifactAutomationPlan[]
requiredCommands[]
closeoutReadinessPreview
```

`preConfirmationDrilldown` must exist as source metadata:

```yaml
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
```

Materialization rules:

```text
source rows must not be independently invented
EVD/TRACE/ACC/E2E/currentTarget/AI-TDD must come from packet projections
each materialized row must have derivedFromMustRef and derivedFromPacketHash or an equivalent back-reference
inline implementationConfirmation remains the final user confirmation authority
preConfirmationDrilldown is drilldown metadata only
```

### Stage 8: Packet/Source Reconciliation

Reconciliation must be bidirectional.

Direction one:

```text
packet projection -> implementationConfirmation row
```

Direction two:

```text
implementationConfirmation row -> packet projection
```

Required check scope:

```text
mustExecutionDecompositionMatrix[]
atomicImplementationTaskList[]
evidence[]
traceRows[]
acceptanceTests[]
e2eSuites[]
failurePaths[]
edgeCases[]
targetModificationPaths[]
currentTargetMap
aiTddContractExecutionManifestProjection
artifactAutomationPlan[]
requiredCommands[]
closeoutReadinessPreview
```

Required artifact:

```text
must_packet_source_reconciliation_report.json
```

Blocking rules:

```text
packet projection not materialized -> blocked_by_projection_not_materialized
source row independently invented -> blocked_by_source_row_invented
source row stale packet hash -> blocked_by_packet_source_drift
projection status missing/stale/conflicting -> blocked_by_packet_source_drift
reconciliation verdict != pass -> blocked_by_missing_reconciliation
```

### Stage 9: Pre-Render MUST Decomposition Gate

Add this gate:

```text
_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js
```

Inputs:

```text
source document
semantic-kernel.json
must_decomposition_packet.json
critical-auditor-receipt-round-*.json
implementationConfirmation
must_packet_source_reconciliation_report.json
```

Outputs:

```text
must_decomposition_receipt.json
must_packet_source_reconciliation_report.json
pre-render-must-decomposition-gate-report.json
```

This gate is deterministic and fail-closed. It must not replace model reasoning.

Required checks:

```text
kernel exists and hash matches
packet exists and synchronized
packet source/kernel hashes match
Critical Auditor receipts exist
three consecutive no_new_valid_gap rounds exist
validated gaps are resolved
Author claims have critic disposition
question coverage is complete
expectedTaskCount equals actualTaskCount
no over-broad atomic task exists
all projections are materialized
no independently invented source rows exist
reconciliation passes
```

Blocking rules:

```text
any core artifact missing -> blocked
any hash stale -> blocked
any schema invalid -> blocked
any task split invalid -> blocked
any question coverage incomplete -> blocked
any projection missing or stale -> blocked
any critic convergence invalid -> blocked
any reconciliation invalid -> blocked
```

### Stage 10: Semantic Checkpoint Workflow

Checkpoint order must become semantic-layer based:

```text
cp-00 semantic kernel
cp-01 must_decomposition_packet
cp-02 atomic decomposition loop convergence
cp-03 packet-to-source materialization
cp-04 ID freeze
cp-05 implementationConfirmation core
cp-06 EVD/TRACE/ACC/E2E/failure/edge/currentTarget/AI-TDD
cp-07 human-readable views
cp-08 pre-render global reconciliation
```

Checkpoint rules:

```text
checkpoints do not perform segmented thinking
checkpoints only persist, resume, commit one file, and write receipts
complex reasoning happens in atomic decomposition loop
each checkpoint has a separate commit
unrelated files must not be staged
manual edits must not be overwritten
corrupt progress must recover from backup or git checkpoint when possible
source hash mismatch with progress must fail closed
```

`run_semantic_checkpoints.js plan/status` must display:

```text
semantic kernel status
packet status
Critical Auditor rounds
convergence counter
packet/source reconciliation
next action
```

`run_semantic_checkpoints.js run/resume` must guarantee:

```text
does not overwrite manual edits
does not stage unrelated files
creates one commit per checkpoint
recovers corrupt progress when possible
fails closed when source hash differs from progress
loads kernel/packet/receipts/progress on resume instead of restarting broad reasoning
```

### Stage 11: Renderer Drilldown Display

The HTML confirmation page must add these first-class sections:

```text
Pre-Confirmation Semantic Drilldown
Semantic Kernel Summary
MUST Decomposition Packet
Atomicity Drivers
Atomic Task Baseline
Projection Coverage
Critical Auditor Convergence
Gap History
Packet-To-Source Reconciliation
```

The page must answer:

```text
how the model understood the requirement
how the model self-questioned
how MUST rows were decomposed into atomic tasks
whether expectedTaskCount and actualTaskCount match
which gaps were found, rejected, repaired, converted to OUT, or converted to open questions
whether Critical Auditor reached three no-new-valid-gap rounds
whether all EVD/TRACE/ACC/E2E/currentTarget/AI-TDD rows are synchronized projections
that the user confirms requirements scope only
```

Renderer blocking rules:

```text
missing drilldown section -> confirmability=blocked
missing semantic kernel -> confirmability=blocked
missing packet -> confirmability=blocked
stale packet -> confirmability=blocked
less than 3 critic rounds -> confirmability=blocked
unresolved validated gap -> confirmability=blocked
missing projection coverage -> confirmability=blocked
missing reconciliation -> confirmability=blocked
deliveryReadiness incorrectly represented as ready -> confirmability=blocked
```

### Stage 12: Reverse Audit

`audit_contract_confirmability.js` must consume:

```text
confirmation-render-report.json
pre-render-must-decomposition-gate-report.json
must_packet_source_reconciliation_report.json
```

The confirmability stage only judges:

```text
whether requirements are confirmable
whether HTML was generated from the current source
whether drilldown sections are fully shown
whether packet/source reconciliation passed
whether Critical Auditor convergence is satisfied
whether all source rows came from packet projections
```

The confirmability stage must not judge:

```text
implementation complete
delivery ready
closeout ready
merge ready
release ready
```

Reverse audit must be layered:

```text
contract confirmability audit
implementation readiness audit
delivery verification audit
closeout integrity audit
```

This requirement changes only the contract confirmability stage. Delivery verification must not be mixed into confirmation-page confirmability.

Blocking rules:

```text
missing kernel -> blocked
missing packet -> blocked
missing critic convergence -> blocked
missing reconciliation -> blocked
renderer did not show drilldown sections -> blocked
deliveryReadiness incorrectly represented as ready -> blocked
shallow source without packet projections -> blocked
```

### Stage 13: Matrix Rules

`matrix-rules.md` must add this same-source projection chain:

```text
MUST -> packet -> projections -> source rows
```

The older chain:

```text
MUST -> TRACE -> EVD
```

is only a local reference-closure check. It is not sufficient proof of confirmation quality.

Every matrix row must trace back to a packet projection. Any row that proves only field presence, ID presence, or reference presence, but cannot prove packet projection origin, must block confirmation.

### Stage 14: Fixtures

Valid fixtures must include at least:

```text
small valid source
large checkpoint-required valid source
```

Blocked fixtures must include at least:

```text
missing packet
stale packet
under-split MUST
over-broad atomic task
missing critic receipt
less than 3 rounds
source invented trace row
projection not materialized
missing packet/source reconciliation
renderer missing drilldown sections
```

### Stage 15: Regression Tests

Regression tests must be written before implementation to prevent this feature from degrading into field-presence validation.

Required coverage:

```text
missing semantic kernel -> blocked
missing must_decomposition_packet -> blocked
stale packet hash -> blocked
missing Critical Auditor receipt -> blocked
less than 3 no-new-gap rounds -> blocked
unresolved validated gap -> blocked
questionCoverage incomplete -> blocked
actualTaskCount < expectedTaskCount -> blocked
over-broad atomic task -> blocked
missing packet projection -> blocked
source row independently invented -> blocked
packet projection not materialized -> blocked
missing packet/source reconciliation -> blocked
renderer missing drilldown sections -> confirmability=blocked
complete kernel + packet + critic + reconciliation -> confirmable
resume loads kernel/packet/receipts/progress instead of restarting
```

Recommended test files:

```text
tests/acceptance/requirements-contract-authoring-skill-contract.test.ts
tests/acceptance/requirements-contract-checkpoint-automation.test.ts
tests/acceptance/render-requirements-confirmation-html.test.ts
tests/acceptance/reverse-audit-contract.test.ts
```

### Stage 16: Final Acceptance Commands

Minimum commands:

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
npx vitest run tests/acceptance/requirements-contract-authoring-skill-contract.test.ts
npx vitest run tests/acceptance/requirements-contract-checkpoint-automation.test.ts
npx vitest run tests/acceptance/render-requirements-confirmation-html.test.ts
npx vitest run tests/acceptance/reverse-audit-contract.test.ts
```

If the AI-TDD manifest projection schema changes, also run:

```powershell
npx vitest run tests/acceptance/ai-tdd-contract-gate.test.ts
```

Recommended dry-run acceptance:

```powershell
node _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js --source docs/requirements/2026-05-25-pre-confirmation-must-atomic-drilldown.md --mode plan --json
node _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js --source docs/requirements/2026-05-25-pre-confirmation-must-atomic-drilldown.md --mode status --json
node _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js --source docs/requirements/2026-05-25-pre-confirmation-must-atomic-drilldown.md --mode pre-render-gate --json
node _bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js --source docs/requirements/2026-05-25-pre-confirmation-must-atomic-drilldown.md --json
node _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts --source docs/requirements/2026-05-25-pre-confirmation-must-atomic-drilldown.md --out _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation.html --language zh-CN --record-id <recordId> --entry-flow standalone_tasks --mode confirmation
node _bmad/skills/requirements-contract-authoring/scripts/audit_contract_confirmability.js docs/requirements/2026-05-25-pre-confirmation-must-atomic-drilldown.md --render-report _bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation-render-report.json --drilldown-gate-report _bmad-output/runtime/requirement-records/<recordId>/authoring/pre-render-must-decomposition-gate-report.json --json
```

### Stage 17: Complete Delivery Definition

This requirement is not complete merely because documentation changed or a script can run.

Completion requires:

```text
new skill flow enters atomic decomposition loop before materialization
single_pass cannot skip atomic decomposition loop
checkpoint only persists, resumes, commits one file, and writes receipts
loop converges only after three consecutive no-new-valid-gap rounds
must_decomposition_packet.status=synchronized before source materialization
source rows are materialized only from packet projections
EVD/TRACE/ACC/E2E/currentTarget/AI-TDD are synchronized projections
packet/source reconciliation passes bidirectionally
pre-render gate blocks on any missing core surface
renderer shows the full productized drilldown interaction
confirmability blocks on any missing core surface
reverse audit does not mark shallow sources as confirmable
resume preserves kernel, packet, Critical Auditor receipts, and progress
tests cover both success and failure paths
dry run proves the full chain behavior
```

Allowed completion language:

```text
requirements-contract-authoring requirements source authoring and confirmation-page productized interaction loop is complete and verified.
```

Forbidden completion language:

```text
BMAD development loop complete
implementation ready
delivery ready
closeout ready
merge ready
release ready
```
