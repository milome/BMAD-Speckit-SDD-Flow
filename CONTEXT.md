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
The independent lifecycle state of a requirement record, separate from the current mental model.
_Avoid_: model status, dashboard status

## Relationships

- A **Current Mental Model** is exactly one member of the **Six Mental Models**.
- **Record Closed** is a **Record Lifecycle State**, not a **Current Mental Model**.
- **Delivery Confirmation** can lead to **Record Closed** only through a controlled terminal close event.

## Example Dialogue

> **Dev:** "Should inspect put a closed requirement into the Current Mental Model field?"
> **Domain expert:** "No. It should show the **Current Mental Model** as delivery confirmation and the **Record Lifecycle State** as record closed."

## Flagged Ambiguities

- "record_closed" was previously used as if it could be a **Current Mental Model**; resolved: it is only a **Record Lifecycle State** or terminal close event.
