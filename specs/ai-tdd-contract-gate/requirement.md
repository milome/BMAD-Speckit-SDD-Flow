# AI-TDD Contract Gate

Date: 2026-05-25
Status: Implementation Source Draft
Canonical path: `specs/ai-tdd-contract-gate/requirement.md`
Legacy local draft: `docs/requirements/2026-05-25-ai-tdd-contract-gate.md`
Source request: Implement a universal Contract-Level AI-TDD Gate / Contract Execution Manifest capability.

## 1. Objective

Build a general gate for any confirmed `implementationConfirmation` so AI execution follows:

```text
confirmed implementationConfirmation
-> ContractExecutionManifest
-> acceptance/e2e/negative controls red proof
-> implementation iteration red/green matrix
-> current-attempt evidence green proof
-> closeout hard gate
```

This is not a six-mental-model-only gate. Existing spike scripts become sub-gates or compatibility surfaces.

## 2. Scope

- Add `scripts/ai-tdd-contract-gate.ts`.
- Emit one `AiTddContractGateReport` containing `ContractExecutionManifest`, `AI-TDD Red/Green Matrix`, `Missing Test Plan`, `Acceptance/E2E Test Plan`, `Target Artifact Plan`, `Negative Control Plan`, `Closeout Readiness Report`, and `Sub-gate Reports`.
- Treat `acceptanceTests` and `e2eSuites` as first-class manifest entries.
- Reuse existing target artifact, schema/reducer, event registry, reverse audit, strict proof, and pre-rerun spike logic where possible.
- Keep the new gate read-only unless an explicit future writer is confirmed.

## 3. Full-Version Requirements

- `MUST-001`: The gate must parse a source document with `implementationConfirmation` and produce a complete `ContractExecutionManifest`.
- `MUST-002`: The manifest must include requirements, evidence, trace rows, required commands, acceptance/e2e suites, target artifacts, negative controls, and closeout gates.
- `MUST-003`: `acceptanceTests[]` and `e2eSuites[]` must be formally schemaized with `ACC-*` and `E2E-*` IDs, files, covered IDs, command refs, evidence refs, oracle, expected pre-implementation state, and controlled proof policy.
- `MUST-004`: Renderer, reverse audit, and requirements-contract-authoring must recognize `ACC/E2E` as first-class dimensions rather than hiding them inside `CMD`.
- `MUST-005`: `pre-implementation` must block unless the source is confirmed, acceptance/e2e coverage exists for every `MUST-*` and `NEG-*`, negative controls have oracles, and old implementation red proof is valid.
- `MUST-006`: Old implementation red proof must come from controlled evidence ingest by default, with real command execution allowed only through an explicit CLI opt-in.
- `MUST-007`: `pre-rerun` must aggregate anti-false-positive checks for required command files, target artifacts, schema/reducer, event registry, reverse audit readiness, target control flow, and external boundary.
- `MUST-008`: `iteration` must refresh a row-level matrix for every `MUST/NEG/EVD/TRACE/CMD/ACC/E2E/ART/GATE` item and allow only partial closure for specific rows with current-attempt evidence.
- `MUST-009`: `closeout` must block unless all `MUST/NEG/EVD/TRACE/CMD/ACC/E2E/ART/GATE` rows are green and sub-gates for reverse audit, strict proof, target artifact realization, current attempt binding, required command evidence, acceptance/e2e evidence, and negative controls pass.
- `MUST-010`: The legacy `pre-rerun-anti-false-positive-gate` CLI must remain usable while delegating to the new `pre-rerun` mode.
- `MUST-011`: Delivery closeout must enforce `ai-tdd-contract-gate --mode closeout` by default for confirmed requirement records with a resolvable source, not only when an opt-in flag is present.
- `MUST-012`: Requirement, plan, and vibe receipts must live under a tracked canonical path; ignored runtime/doc copies cannot be the only evidence.

## 4. Negative Requirements

- `NEG-001`: Missing acceptance/e2e coverage for a `MUST-*` or `NEG-*` must block implementation and closeout.
- `NEG-002`: A missing test file referenced by an acceptance/e2e row or required command must not be hidden by an aggregate command exit code.
- `NEG-003`: An old implementation green result in `pre-implementation` must be reported as `unexpected_green` and must block.
- `NEG-004`: A failing test caused by missing file, syntax failure, runner crash, or unbound oracle must be `invalid_red`, not valid TDD red proof.
- `NEG-005`: `exitCode-only`, `mock-only`, stale attempt evidence, legacy proof, and runtime closure packet self-certification must not count as closeout proof.
- `NEG-006`: Reverse audit `deliveryReadiness.ready=false` must remain blocking even when an outer runner exits 0.
- `NEG-007`: `ACC/E2E` IDs must not be treated as comments, optional prose, or inferred from command text when explicit rows are required.

## 5. Evidence And Commands

- `EVD-001`: Acceptance tests demonstrate manifest generation and missing acceptance/e2e blocking.
- `EVD-002`: Acceptance tests demonstrate expected red, unexpected green, and invalid red classification.
- `EVD-003`: Acceptance tests demonstrate iteration partial green and closeout stale/mock/exitCode-only blocking.
- `EVD-004`: Compatibility wrapper tests demonstrate old pre-rerun CLI behavior.
- `EVD-005`: Renderer/reverse-audit/authoring tests demonstrate `ACC/E2E` first-class support.
- `EVD-006`: Closeout tests demonstrate default AI-TDD enforcement for confirmed records.
- `CMD-001`: `npx vitest run tests/acceptance/ai-tdd-contract-gate.test.ts tests/acceptance/pre-rerun-anti-false-positive-gate.test.ts tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts tests/acceptance/render-requirements-confirmation-html.test.ts tests/acceptance/requirements-contract-authoring-skill-contract.test.ts`
- `CMD-002`: `npx tsc --project tsconfig.node.json --noEmit`
- `CMD-003`: `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js`

## 6. Trace Rows

- `TRACE-001`: Covers `MUST-001`, `MUST-002`, `MUST-003`, `NEG-001`, `NEG-002`, and `NEG-007`; evidence `EVD-001`, `EVD-005`; acceptance `ACC-001`, `E2E-001`.
- `TRACE-002`: Covers `MUST-005`, `MUST-006`, `NEG-003`, and `NEG-004`; evidence `EVD-002`; acceptance `ACC-001`.
- `TRACE-003`: Covers `MUST-007` and `MUST-010`; evidence `EVD-004`; acceptance `ACC-002`.
- `TRACE-004`: Covers `MUST-008`, `MUST-009`, `MUST-011`, `NEG-005`, and `NEG-006`; evidence `EVD-003`, `EVD-006`; acceptance `ACC-001`.
- `TRACE-005`: Covers `MUST-012`; evidence `EVD-005`; acceptance `ACC-003`.

## 7. Acceptance And E2E Suites

- `ACC-001`: `tests/acceptance/ai-tdd-contract-gate.test.ts` covers manifest, red proof, matrix, and closeout invalid proof behavior.
- `ACC-002`: `tests/acceptance/pre-rerun-anti-false-positive-gate.test.ts` covers compatibility wrapper delegation.
- `ACC-003`: tracked spec package under `specs/ai-tdd-contract-gate/` covers canonical requirement/plan/receipt tracking.
- `E2E-001`: `tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts` covers confirmed requirement closeout runner integration.

## 8. Closeout Rule

Completion can only be claimed after targeted tests, TypeScript check, and encoding gate are run and reported. If broader existing tests fail for unrelated dirty-worktree changes, final language must state the residual risk and the exact failing command.

