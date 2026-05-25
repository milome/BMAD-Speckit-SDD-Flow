# Matrix Compiler Rules

Use these rules to validate human-readable diagrams, `implementationConfirmation`, and `traceRows` inside an implementation source document. Diagrams and trace rows are views over confirmation IDs; they are not separate requirement sources.

## Mapping Rules

The complete source-materialization lineage is:

```text
MUST -> packet -> projections -> source rows
```

The old shortcut `MUST -> TRACE -> EVD` is insufficient for source documents authored by this skill. Each `MUST-*` first becomes a row in `must_decomposition_packet.json`; packet projection rows then materialize into `implementationConfirmation` rows.

Packet/source reconciliation is bidirectional:

- packet projection -> implementationConfirmation row
- implementationConfirmation row -> packet projection

Any source row independently invented outside synchronized packet projections is a blocker. Any packet projection not materialized into the source is a blocker. These blockers must be reported as `source row independently invented` and `packet projection not materialized`.

| Mermaid Element | Required Confirmation Link |
|---|---|
| Message (`A->>B`) | References one or more `must` or `notDone` IDs |
| Response (`B-->>A`) | References the same expected observable confirmation ID |
| `alt/else` | Each branch references a `notDone` or blocking question ID |
| `opt` | References a confirmed `must` ID or remains unconfirmed |
| `loop` | References retry/recovery `notDone` and evidence IDs |
| `par` | References concurrency/race `notDone` and evidence IDs |
| `break` | References abort/cancel/fatal failure `notDone` IDs |
| State transition | References `must`/`notDone` IDs and evidence IDs |
| Note containing invariant | References a confirmed invariant-style `notDone` ID |
| File/db/artifact write | References `must`/`notDone` and `evidence` IDs |
| External service call | References timeout/failure `notDone` IDs |
| Script or hook execution | References `must`/`notDone`, `evidence`, and artifact plan IDs |
| Dashboard, score, SFT, or report output | References `evidence` or read-model artifact IDs; does not directly close requirements |

## Row Quality Rules

A `traceRows` row is valid only if it answers:

- Which existing `must` / `notDone` IDs it covers.
- Which `must_decomposition_packet.json` projection row produced it.
- Which existing `evidence` IDs prove the covered behavior.
- Which task references will implement the covered IDs, if tasks exist.
- Which diagram, command, and artifact references support the row, if those views exist.
- Which current status applies.

If any answer is missing, keep the row `PENDING`, add an `openQuestions` item, or mark the row `MISSING_TESTABILITY`. Do not invent new requirement semantics in trace rows.

Every row in these source arrays must have a packet projection back-reference or equivalent synchronized packet hash:

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

## Reverse Coverage Checklist

- `implementationConfirmation` exists.
- `implementationConfirmation.status` is `user_confirmed` before implementation readiness.
- Every requirement-bearing diagram message or business step references confirmation IDs.
- Every `traceRows[].covers` ID exists in `must` or `notDone`.
- Every `traceRows[].evidenceRefs` ID exists in `evidence`.
- Every implementation task is bound to `MUST`, `NEG`, `OUT`, `EVD`, or `TRACE`.
- Mandatory sequence, flow, edge-case, current-vs-target, and artifact automation views exist before HTML confirmation.
- Every failure, timeout, retry, permission, config, idempotency, and recovery path is represented by `notDone` or blocking questions.
- No `openQuestions` item with `blocksImplementation: true` remains.
- No acceptance evidence relies only on smoke assertions.
- Reports, dashboards, scores, SFT, and legacy script outputs are evidence/read-model artifacts unless controlled ingest writes a gate decision.

## Mandatory Reverse Audit Closeout

Before using the source document for readiness or implementation, create a `Reverse Audit Report` section and give it a `PASS` or `FAIL` verdict.

The report is valid only if it covers:

- `implementationConfirmation` findings.
- ID reference findings for diagrams, business steps, and traceRows.
- Branch, state, and invariant findings.
- Row quality findings for evidence expectations and independent oracle.
- E2E anti-smoke findings.
- Open findings mapped to `openQuestions` or `MISSING_TESTABILITY`.

If a local file exists, run `scripts/reverse_audit_contract.js` and include the command output or summary. If the script reports `FAIL`, revise the source document before implementation unless the user explicitly requested a partial draft.

## Anti-Happy-Path Checks

Add or verify rows for:

- Invalid input
- Missing configuration
- Permission denied
- Duplicate request or rerun
- Partial artifact already exists
- External command/service failure
- Timeout
- Retry exhaustion
- Resume after interruption
- Rollback or cleanup
- Concurrent requests or lock conflict
- Audit/trace evidence emission
- Schema or contract mismatch

## Status Semantics

- `PENDING`: required but not implemented/proven.
- `PASS`: implemented and proven by evidence.
- `BLOCKED`: cannot proceed due to dependency or decision.
- `MISSING_EVIDENCE`: implemented claim without proof.
- `MISSING_TESTABILITY`: row cannot yet be tested as written.
- `SCOPE_CHANGE_REQUIRED`: would reduce or change approved scope.
