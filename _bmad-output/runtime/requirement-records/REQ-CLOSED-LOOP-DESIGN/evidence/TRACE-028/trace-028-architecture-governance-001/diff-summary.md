# TRACE-028 Architecture Confirmation Governance Evidence

## Scope

- Added `_bmad/_config/architecture-confirmation-hash-recipe.contract.yaml` as the machine-readable architecture hash recipe authority.
- Added `resolveArchitectureConfirmationHashRecipe()` and shared canonical hash helpers.
- Updated architecture confirmation ingest to reject private hash logic, require recipe snapshots, and persist `staleInputs`.
- Added `architecture_confirmation_state_checked` as a controlled event that can mark stale architecture confirmations and write gate checks.
- Updated Implementation Readiness Gate and Delivery Closeout Gate to require an active architecture confirmation, current `resolvedRecipeHash`, and the latest pass/active state check.
- Extended requirement-record schema with `architectureConfirmations[]` and `architectureConfirmationStateChecks[]`.

## Real Drift Found

When the new state check ran against `REQ-CLOSED-LOOP-DESIGN`, it correctly marked the older architecture confirmation as `stale` because it did not have `staleInputs` or the current `resolvedRecipeHash`. A new requirement-scoped architecture confirmation was generated, ingested, and then verified by a pass state check.

## Files Changed

- `_bmad/_config/architecture-confirmation-hash-recipe.contract.yaml`
- `_bmad/_schemas/requirement-record.schema.json`
- `scripts/architecture-confirmation-hash-recipe.ts`
- `scripts/ingest-architecture-confirmation.ts`
- `scripts/main-agent-implementation-readiness-gate.ts`
- `scripts/main-agent-delivery-closeout-gate.ts`
- `tests/acceptance/architecture-confirmation-ingest.test.ts`
- `tests/acceptance/main-agent-implementation-readiness-gate-record.test.ts`
- `tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts`
- `tests/acceptance/requirement-record-schema.test.ts`

## Requirement Links

- TRACE: `TRACE-028`
- Task: `TASK-ARCHITECTURE-CONFIRMATION-GOVERNANCE`
- Must: `MUST-035`, `MUST-036`, `MUST-037`
- Negative: `NEG-023`, `NEG-024`, `NEG-025`
- Out of scope: `OUT-004`
- Evidence: `EVD-036`, `EVD-037`
