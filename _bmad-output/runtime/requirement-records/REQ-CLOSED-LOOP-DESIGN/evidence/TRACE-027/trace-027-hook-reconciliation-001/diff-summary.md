# TRACE-027 Hook Reconciliation Evidence

## Scope

- Added requirement-record schema support for `hookReconciliation`.
- Added controlled ingest validation and persistence for hook/no-hook reconciliation state.
- Added Delivery Closeout Gate blocking checks for hook trust gaps, missing receipts, sequence ledger gaps, hash mismatches, unreconciled fallback state, and missing no-hook fallback references.
- Added acceptance tests proving unreconciled hook gaps block closeout and bounded replay/no-hook fallback evidence can satisfy closeout.

## Files Changed

- `_bmad/_schemas/requirement-record.schema.json`
- `scripts/ingest-implementation-evidence.ts`
- `scripts/main-agent-delivery-closeout-gate.ts`
- `tests/acceptance/implementation-evidence-ingest.test.ts`
- `tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts`
- `tests/acceptance/requirement-record-schema.test.ts`

## Requirement Links

- TRACE: `TRACE-027`
- Task: `TASK-GOVERNANCE-TRANSPORT-HOOKS`
- Must: `MUST-034`
- Negative: `NEG-022`
- Out of scope: `OUT-020`
- Evidence: `EVD-004`, `EVD-005`, `EVD-034`
