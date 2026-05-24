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

## Relationships

- A **Current Mental Model** is exactly one member of the **Six Mental Models**.
- **Record Closed** is a **Record Lifecycle State**, not a **Current Mental Model**.
- **Record Lifecycle State** is derived from `status`, `lastEventType`, `requirementClosures`, and terminal close events; it is not a required top-level field.
- **Delivery Confirmation** can lead to **Record Closed** only through a controlled terminal close event.
- **Post-Close Defect Intake** never uses the closed record as the new execution carrier.
- A **Bugfix Requirement Record** links back to the original **Record Closed** record.
- A **Closure Integrity Incident** challenges the closeout proof itself, not the delivered scope.

## Example Dialogue

> **Dev:** "Should inspect put a closed requirement into the Current Mental Model field?"
> **Domain expert:** "No. It should show the **Current Mental Model** as delivery confirmation and derive the **Record Lifecycle State** as record closed."

> **Dev:** "If we find a real bug after closure, do we reopen the original record?"
> **Domain expert:** "No. Use **Post-Close Defect Intake** and create a linked **Bugfix Requirement Record**, unless the closeout proof itself is under a **Closure Integrity Incident**."

## Flagged Ambiguities

- "record_closed" was previously used as if it could be a **Current Mental Model**; resolved: it is only a derived **Record Lifecycle State** or terminal close event.
- "reopen" was previously ambiguous between fixing a delivered defect and challenging closeout integrity; resolved: delivered defects create linked **Bugfix Requirement Records**, while closeout proof defects create **Closure Integrity Incidents**.
