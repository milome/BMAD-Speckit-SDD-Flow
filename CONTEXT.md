# BMAD Speckit SDD Flow Context

This context defines domain language for the BMAD Speckit SDD Flow control plane.

## Language

**Current Mental Model**:
The active one of the six Main Agent evaluation models that controls the next safe action.
_Avoid_: record_closed, lifecycle state, dashboard state

**Six Mental Models**:
The fixed ordered set of Main Agent evaluation models: requirement confirmation, architecture confirmation, implementation readiness, execution closure, audit review, and delivery confirmation.
_Avoid_: seven-model chain, record_closed as model

**Record Closed**:
The terminal lifecycle state of a requirement record after delivery confirmation and closeout have both passed.
_Avoid_: current mental model, seventh mental model

**Record Lifecycle State**:
A derived lifecycle meaning of a requirement record, separate from the current mental model.
_Avoid_: top-level recordLifecycleState field, model status, dashboard status

**Post-Close Defect Intake**:
The classification step for problems discovered after a requirement record is closed.
_Avoid_: automatic reopen, silent reconfirmation, dispatch from closed record

**Bugfix Requirement Record**:
A new linked requirement record that carries a confirmed defect against a previously closed record.
_Avoid_: mutating the closed record, reopening by default

**Closure Integrity Incident**:
A governance incident for a defective closeout, gate, evidence, hash, or provenance decision.
_Avoid_: ordinary bugfix, ordinary reconfirmation

**Canonical RequirementRecord Field**:
A top-level RequirementRecord field accepted by the schema and preserved by the control-store reducer.
_Avoid_: projection-only field, event-only fact, reducer-dropped field

**BMAD Association**:
A canonical RequirementRecord field that records a requirement record's controlled Epic/Story association and whether it is a sprint-status update candidate.
_Avoid_: path inference, external board status, dashboard grouping

**BMAD Association Revalidation**:
A recorded fact that a previous BMAD Association decision is stale and must be re-evaluated before readiness, closeout, or sprint-status updates can proceed.
_Avoid_: durable request event, outbox request, external board trigger

**BMAD Sprint Status File**:
The sprint tracking file addressed through `{implementation_artifacts}/sprint-status.yaml`.
_Avoid_: `docs/sprint-status.yaml`, external kanban status, GitHub/GitLab done state

**Sprint Status Update Authorization**:
A recorded authorization for one controlled update to the BMAD Sprint Status File after BMAD Association and delivery confirmation prove the target Story can be updated.
_Avoid_: association candidate flag, external board done state, implicit Story closeout

**Sprint Status Update Authorizations**:
The canonical RequirementRecord field that stores readable sprint status update authorizations.
_Avoid_: event-only authorization, artifact-only authorization, inferred write permission

**External Kanban Mirror**:
An external GitHub/GitLab board representation that mirrors BMAD-controlled Epic, Story, Issue, or sprint-status state.
_Avoid_: source of truth, intent intake, command intake, six-model progression trigger

**External Board Receipt**:
An evidence-only receipt for publish sync, webhook validation, or patch-back results from an External Kanban Mirror.
_Avoid_: closeout proof, sprint-status authorization, BMAD control-state mutation

**External Projection Event**:
An evidence-only outbox, webhook, validation, or patch-back event used to synchronize an External Kanban Mirror.
_Avoid_: canonical control event, BMAD transition event, record close event

**Controlled RequirementRecord Write**:
The only authorized way to change canonical RequirementRecord control state: append a control event, replay the canonical reducer, and commit the resulting snapshot atomically.
_Avoid_: direct snapshot patch, private record update, patch-only writer

**Control Event Journal**:
The canonical append-only journal that contains every control event used to derive a RequirementRecord snapshot.
_Avoid_: per-model control event source, isolated confirmation log, projection log as authority

**Canonical Control Event**:
A durable control fact that is allowed to derive authoritative RequirementRecord state.
_Avoid_: blocked micro-event, rejected micro-event, diagnostic-only marker, request-only marker

**Durable Request Event**:
A canonical control event that opens a persisted request, outbox item, or pending decision with dedupe, idempotency, response or receipt, and failure handling.
_Avoid_: action trigger marker, transient request flag, request word without lifecycle

**Mental Model Rollback**:
A controlled fact that moves the current mental model back to requirement or architecture confirmation because drift, blocker, or reconfirmation made downstream progress unsafe.
_Avoid_: normal forward transition, pass-based progression, silent rerun

**Foundation Record Event**:
A RequirementRecord event that records evidence, diagnostics, checks, failures, RCA, execution, or closure sub-records without deciding the six-model control flow by itself.
_Avoid_: control-plane transition, model result authority, terminal close authority

**Implementation Evidence Ingested Event**:
A Foundation Record Event that records current-attempt implementation evidence for later gate consumption.
_Avoid_: closeout authority, model transition event, record close event

**Legacy Closeout Runner Tombstone**:
A non-executing compatibility surface that explains a retired closeout runner and points to the manifest-driven replacement.
_Avoid_: legacy execution mode, fallback runner, historical closeout authority

**Manifest Required Command Executor**:
The single runner authority that resolves, executes, and records all required closeout commands from the ContractExecutionManifest.
_Avoid_: split executor, parallel final runner, parser-only manifest runner

**Gate-Enforced Current Target Map**:
A blocking current-to-target proof map whose strict readiness is decided by the AI TDD gate rather than by documentation or display alone.
_Avoid_: display-only map, advisory migration table, unchecked confirmation view

**Failed Evidence Packet**:
An evidence packet written after the first required command failure to preserve current-attempt failure provenance outside successful implementation-evidence ingest.
_Avoid_: partial success packet, best-effort closeout packet, ignored failure output, implementation evidence ingest event

**Model Evaluation Result**:
The plain-language result of one mental model evaluation, including pass/block/fail status, blocking reasons, source references, and next action.
_Avoid_: verdict, hidden gate conclusion, dashboard-only status

## Relationships

- A **Current Mental Model** is exactly one member of the **Six Mental Models**.
- A **Model Evaluation Result** records what a **Current Mental Model** concluded and why.
- **Record Closed** is a **Record Lifecycle State**, not a **Current Mental Model**.
- **Record Lifecycle State** is derived from `status`, `lastEventType`, `requirementClosures`, and terminal close events; it is not a required top-level field.
- **Delivery Confirmation** can lead to **Record Closed** only through a controlled terminal close event.
- **Post-Close Defect Intake** never uses the closed record as the new execution carrier.
- A **Bugfix Requirement Record** links back to the original **Record Closed** record.
- A **Closure Integrity Incident** challenges the closeout proof itself, not the delivered scope.
- **BMAD Association** is a **Canonical RequirementRecord Field**, so schema, reducer, and writer registry must evolve together.
- **BMAD Association Revalidation** is recorded with `bmad_association_revalidation_recorded`, not a requested event.
- **BMAD Sprint Status File** can be updated only after controlled BMAD association and delivery authorization.
- **Sprint Status Update Authorization** is separate from **BMAD Association** candidate status.
- **Sprint Status Update Authorization** is stored in **Sprint Status Update Authorizations** for consumers that need current readable authorization state.
- BMAD is the authority for an **External Kanban Mirror**; outbound sync is allowed, but reverse Kanban input is validation-only.
- An **External Board Receipt** is evidence only; accepted, rejected, or patch-back receipts do not prove BMAD completion.
- An **External Projection Event** can synchronize a mirror but cannot drive six-model progression or record closure.
- A **Controlled RequirementRecord Write** is required for any canonical RequirementRecord control-state change.
- The **Control Event Journal** is the event source for every **Controlled RequirementRecord Write**.
- A **Canonical Control Event** records an authoritative fact, while blocked, rejected, pending, and requested micro-states are captured as blocker reasons, reconfirmation requests, transition facts, model results, or the terminal close event.
- A **Durable Request Event** is a **Canonical Control Event** only when the request itself has a persisted lifecycle.
- A **Mental Model Rollback** is not a normal forward transition and does not require the current model to pass.
- A **Foundation Record Event** can feed evidence or diagnostics into the record, but a **Canonical Control Event** is required before that information can drive the six-model control flow.
- An **Implementation Evidence Ingested Event** is a **Foundation Record Event**; it may feed closeout gates but cannot directly advance the **Current Mental Model** or produce **Record Closed**.
- A **Legacy Closeout Runner Tombstone** can preserve discoverability for old callers, but it must not execute retired command sets or produce completion evidence.
- A **Manifest Required Command Executor** owns required-command resolution, execution, and evidence recording; other closeout runners may delegate to it but must not execute required commands in parallel.
- A **Gate-Enforced Current Target Map** must be blocked or passed by the AI TDD gate, not merely rendered for human review.
- A **Failed Evidence Packet** stops the command run at the first required-command failure and records failure provenance; it must not contain partial completion proof for unrun commands.
- A **Failed Evidence Packet** is not an **Implementation Evidence Ingested Event** and must not be used as current-attempt delivery proof.

## Example Dialogue

> **Dev:** "Should inspect put a closed requirement into the Current Mental Model field?"
> **Domain expert:** "No. It should show the **Current Mental Model** as delivery confirmation and derive the **Record Lifecycle State** as record closed."

> **Dev:** "If we find a real bug after closure, do we reopen the original record?"
> **Domain expert:** "No. Use **Post-Close Defect Intake** and create a linked **Bugfix Requirement Record**, unless the closeout proof itself is under a **Closure Integrity Incident**."

> **Dev:** "Can we keep BMAD association as a projection until implementation catches up?"
> **Domain expert:** "No. **BMAD Association** is a **Canonical RequirementRecord Field**, so schema, reducer, and writer registry must preserve it before it can be used as authority."

> **Dev:** "Can a controlled writer patch the record snapshot directly if it also writes hashes?"
> **Domain expert:** "No. It must use a **Controlled RequirementRecord Write** so the event chain and reducer replay remain the authority."

> **Dev:** "Can architecture confirmation keep its own control event log?"
> **Domain expert:** "No. Architecture confirmation must append to the **Control Event Journal** like every other control event."

> **Dev:** "Should architecture state checks and rejected architecture confirmations become control events?"
> **Domain expert:** "No. Only recorded architecture confirmation is a control event; checks are diagnostics and rejected states become blockers or reconfirmation."

> **Dev:** "What happens to old architecture state-check control events during implementation?"
> **Domain expert:** "They are migrated or upcast out of replay authority; they do not remain canonical control events."

> **Dev:** "Should we call the six-model outcome a verdict?"
> **Domain expert:** "No. Use **Model Evaluation Result** in language and `sixModelResults` as the canonical field."

> **Dev:** "Should model result events be named evaluated?"
> **Domain expert:** "No. Use result recorded event names because the event means the result was committed to the control record."

> **Dev:** "Should model result payloads say evaluatedAt and evaluatedBy?"
> **Domain expert:** "No. Use resultRecordedAt and resultRecordedBy because the authoritative fact is when the result was recorded."

> **Dev:** "Can we still say evaluation when describing the process?"
> **Domain expert:** "Yes. Evaluation is the process; result recorded is the control fact."

> **Dev:** "Should blocked transitions, rejected close attempts, and close requests each become their own control events?"
> **Domain expert:** "No. Those are statuses or reasons inside blockers, reconfirmation requests, transitions, model results, or the terminal record close event."

> **Dev:** "Should a failed delivery closeout write closeout_recorded as a control event?"
> **Domain expert:** "No. A failed delivery closeout records a delivery confirmation result and blockers; only record closed is the terminal close event."

> **Dev:** "Do foundation events like gate checks and failure records disappear when we add six-model control events?"
> **Domain expert:** "No. They remain foundation record events, but they cannot directly advance the current mental model or close the record."

> **Dev:** "Can `implementation_evidence_ingested` close the requirement if all command evidence is green?"
> **Domain expert:** "No. It is an **Implementation Evidence Ingested Event**; closeout gates consume it, then a separate controlled result or terminal close event decides progression."

> **Dev:** "Should the old final required commands script keep a `--legacy-six-model` mode for reproduction?"
> **Domain expert:** "No. Keep a **Legacy Closeout Runner Tombstone** only; historical reproduction belongs in archive/history, not an executable fallback."

> **Dev:** "Can final closeout parse the manifest and then execute required commands itself?"
> **Domain expert:** "No. Delegate to the **Manifest Required Command Executor** so command execution and evidence semantics have one authority."

> **Dev:** "Can a current/target map be accepted because the source document lists the right rows?"
> **Domain expert:** "No. It must be a **Gate-Enforced Current Target Map**, with strict readiness decided by the AI TDD gate."

> **Dev:** "Should the manifest executor keep running required commands after one fails?"
> **Domain expert:** "No. Write a **Failed Evidence Packet** for the first failure and stop, so the attempt cannot accumulate mixed partial proof."

> **Dev:** "Can a failed packet be submitted through `implementation_evidence_ingested` with a failed status?"
> **Domain expert:** "No. A **Failed Evidence Packet** is failure provenance outside the successful **Implementation Evidence Ingested Event** path."

> **Dev:** "Can any event ending in requested be canonical?"
> **Domain expert:** "Only if it is a **Durable Request Event** with pending or outbox lifecycle, idempotency, receipt or response, and failure handling."

> **Dev:** "Should Story adoption, Story promotion, and sprint-status authorization be requested events?"
> **Domain expert:** "No. Once written to the record, they are controlled facts, so use recorded event names."

> **Dev:** "Should a post-close bugfix carrier be recorded as requested?"
> **Domain expert:** "No. The control fact is that the closed record is linked to a bugfix requirement record."

> **Dev:** "Should a reconfirmation request directly write the current mental model rollback?"
> **Domain expert:** "No. The request records pending reconfirmation; a separate **Mental Model Rollback** records the safety rollback."

> **Dev:** "Should implementation_readiness_check_recorded remain a control event?"
> **Domain expert:** "No. Implementation readiness writes an implementation readiness result; old readiness check events are migration input only."

> **Dev:** "Should readiness_baseline_activation_requested remain a canonical requested event?"
> **Domain expert:** "No. Baseline activation is captured in the implementation readiness result or readiness baseline metadata unless a separate durable lifecycle is explicitly introduced."

> **Dev:** "Should BMAD association revalidation be recorded as a requested event?"
> **Domain expert:** "No. It is a fact that the association decision is stale and requires revalidation, so use `bmad_association_revalidation_recorded` plus blockers instead of a requested event."

> **Dev:** "Can Story adoption or promotion write reconfirmation requests directly?"
> **Domain expert:** "No. Adoption and promotion record association facts; scope or architecture changes open reconfirmation through a separate reconfirmation request."

> **Dev:** "Can sprintStatusUpdateCandidate itself authorize writing sprint-status.yaml?"
> **Domain expert:** "No. It only marks a candidate; the actual write requires a **Sprint Status Update Authorization**."

> **Dev:** "Can a sprint-status writer just scan the control event journal for the latest authorization event?"
> **Domain expert:** "No. It must read **Sprint Status Update Authorizations** so authorization is visible as canonical RequirementRecord state."

> **Dev:** "Can dragging a GitHub/GitLab card to Done advance the six-model control flow?"
> **Domain expert:** "No. The external board is an **External Kanban Mirror**. If the move matches BMAD authority, validate it as accepted; otherwise reject and patch it back."

## Flagged Ambiguities

- "record_closed" was previously used as if it could be a **Current Mental Model**; resolved: it is only a derived **Record Lifecycle State** or terminal close event.
- "reopen" was previously ambiguous between fixing a delivered defect and challenging closeout integrity; resolved: delivered defects create linked **Bugfix Requirement Records**, while closeout proof defects create **Closure Integrity Incidents**.
- "bmadAssociation" could have been read as a projection-only dashboard field; resolved: it is a **Canonical RequirementRecord Field** and requires schema/reducer/writer registry evolution.
- "sprint-status.yaml" path could have meant `docs/sprint-status.yaml`; resolved: use the BMAD **BMAD Sprint Status File** at `{implementation_artifacts}/sprint-status.yaml`.
- "controlled writer" could have allowed direct snapshot patching; resolved: canonical control-state changes require a **Controlled RequirementRecord Write**.
- "architecture confirmation event log" could have meant a separate source of control truth; resolved: architecture confirmation uses the same **Control Event Journal**.
- "architecture confirmation checked/rejected" could have meant additional control events; resolved: only recorded architecture confirmation is a control event.
- "architecture state-check migration" could have meant backward-compatible replay authority; resolved: old state-check events must be migrated or upcast out of replay authority.
- "verdict" was too legalistic and unclear; resolved: use **Model Evaluation Result** and the canonical field `sixModelResults`.
- "evaluated" event names could mean a check merely ran; resolved: model result events mean the result was recorded.
- "evaluatedAt/evaluatedBy" could mean a non-authoritative check time; resolved: use resultRecordedAt/resultRecordedBy for the canonical payload.
- "evaluation" as a process word is allowed; resolved: only canonical event and payload names avoid evaluated/evaluatedAt/evaluatedBy.
- "blocked/rejected/requested" micro-events could have inflated the control event model; resolved: only durable control facts are canonical events, while micro-states remain payload statuses or reasons.
- "*_requested" could have been banned or allowed globally; resolved: only **Durable Request Events** may use requested names as canonical events, and transient action requests must be result metadata, diagnostic artifacts, or fact-like recorded events.
- "bmad_story_adoption_requested", "bmad_story_promotion_requested", and "sprint_status_update_authorization_requested" could have sounded like pending requests; resolved: target-state names are fact-like recorded events.
- "bugfix_requirement_record_requested" could have sounded like pending creation; resolved: target-state name is `bugfix_requirement_record_linked` because the control fact is the link from the closed origin record to the bugfix carrier.
- "reconfirmation_requested" could have directly mutated the current mental model; resolved: reconfirmation request and **Mental Model Rollback** are separate control facts.
- "closeout_recorded" could have remained a failed-closeout control event; resolved: it is legacy input only, while target-state closeout failures are model results and blocker records.
- "allowedEventTypes" could have been read as replacing every existing RequirementRecord event; resolved: six-model canonical control events are layered on top of foundation record events, not a blanket deletion of evidence, diagnostic, check, failure, RCA, execution, or closure sub-record events.
- "implementation_evidence_ingested" could have been read as closeout authority; resolved: it is an **Implementation Evidence Ingested Event**, a foundation evidence event consumed by closeout gates.
- "legacy closeout mode" could have meant a still-executable fallback; resolved: retired hardcoded closeout runners become **Legacy Closeout Runner Tombstones** with no execution mode.
- "manifest runner" could have meant parser-only orchestration; resolved: the **Manifest Required Command Executor** is the sole required-command executor and evidence recorder.
- "currentTargetMap" could have meant a display-only confirmation view; resolved: it is a **Gate-Enforced Current Target Map** whose strict readiness is decided by the AI TDD gate.
- "failed evidence" could have meant a partial completion bundle or a failed implementation ingest; resolved: a **Failed Evidence Packet** records failure provenance only, blocks closeout, and is outside the **Implementation Evidence Ingested Event** path.
- "implementation_readiness_check_recorded" could have remained a target control event; resolved: it is legacy input only, while target-state readiness writes `implementation_readiness_result_recorded`.
- "readiness_baseline_activation_requested" could have remained a generic requested control event; resolved: readiness baseline activation is expressed inside `implementation_readiness_result_recorded` and `readinessBaselineMetadata` unless a future independent lifecycle is defined.
- "bmad_association_revalidation_requested" could have sounded like a durable request; resolved: target-state association revalidation is `bmad_association_revalidation_recorded`, with blocking represented by `decisionStatus='revalidation_required'` and `controlled_blocker_recorded`.
- "bmad_story_adoption_recorded" and "bmad_story_promotion_recorded" could have been used to write reconfirmation requests directly; resolved: they record association facts only, while reconfirmation uses a separate `reconfirmation_requested` event.
- "Allowed" style sprint-status field naming sounded like write authorization; resolved: use `sprintStatusUpdateCandidate` for candidate status, and require a **Sprint Status Update Authorization** stored in **Sprint Status Update Authorizations** for actual updates.
- "sprint_status_update_authorization_recorded" could have been treated as event-only authority; resolved: the readable authority is **Sprint Status Update Authorizations** after controlled replay.
- "External Kanban" could have been read as an external command surface; resolved: it is an **External Kanban Mirror**, with outbound BMAD projection sync and reverse validation-only webhook handling.
- "accepted validation receipt" could have been read as completion proof; resolved: it is an **External Board Receipt** with evidence-only authority.
