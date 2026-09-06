# Verification And Evidence Currentness

## Evidence Binding

A reusable gate receipt binds:

- evidence id, kind, and pass status
- exact `headSha`
- normalized command and `commandHash`
- every relevant source, configuration, dependency, and authority input hash
- immutable receipt path and `receiptHash`
- completion time and execution environment when relevant

The scope manifest's `evidenceInputs.<kind>` list is authoritative. Evidence
must bind exactly that set: omissions and undeclared additions both fail
validation. Create the record with `record-gate-evidence.mjs`; do not assemble
its hashes by hand.

Time alone neither validates nor invalidates evidence. A session restart has no effect on currentness.
Evidence creation requires a clean worktree; otherwise tracked or untracked content would not be bound to `headSha`.

## Decision Matrix

| Condition | Action |
|---|---|
| HEAD, command, inputs, and receipt hash match | Reuse; do not rerun |
| Only one bound input changed | Rerun affected gates |
| HEAD changed | Rerun the affected gate; this checkpoint schema has no equivalence-proof representation |
| Receipt is missing from the checkpoint | Search canonical CI/artifact stores before rerunning |
| Receipt hash or lineage is invalid | Reject evidence and rerun affected gates |
| Worktree has tracked or untracked changes | Do not claim currentness for PR readiness |

Use `verify-evidence-currentness.mjs` for deterministic checks. The script never runs a gate; it returns `reuse` or `rerun_affected_gate` with reasons.

The script first validates the complete checkpoint and evidence/state
relationship. Exit `0` means reuse, exit `3` means rerun the affected gate, and
exit `2` means invalid input or checkpoint.

The latest checkpoint validation recomputes the input hashes for the gate that
authorizes its current state. Historical parent revisions are validated for
shape, receipt integrity, append-only lineage, and transition semantics without
pretending their old input hashes describe the current worktree.

## Recovery Authority

When no checkpoint exists, use this precedence:

1. Repository-defined recovery authority and immutable accepted Git refs.
2. Canonical CI receipts for the exact commit.
3. Hash-bound review and artifact-store receipts for that commit.

If sources disagree, halt for the repository authority; do not select the most
recent source. Create a receipt from `assets/recovery-receipt-template.json`.
Every source key is a repository-relative JSON artifact whose file hash is
verified. `fieldSources` must map exactly `featureId`, `currentPhase`, `headSha`,
and `branch` to those artifacts, whose field values must equal the reconstructed
checkpoint. Recovery always initializes `DISCOVERED`; freeze, planning, gates,
and later states are replayed through the normal immutable revision commands.
Never infer a state from a summary or skip an unproved precondition.

## Review Currentness

Bind review to the reviewed HEAD. A no-findings review on an older commit is stale for changed files. After committing a review-driven in-scope edit, run `reset-execution-gates.mjs` from the latest checkpoint in `GREEN_CONFIRMED` through `PR_GREEN`, then replay RED, GREEN, the phase stop gate, scope attestation, and review on the new HEAD. If the plan or scope must change, reset first and then use the authorized scope-delta path before replaying gates.

## No Duplicate Gates

Do not rerun a current gate because the session restarted, the operator wants reassurance, or a summary is old. Conversely, do not reuse a result merely because it is recent or says "passed"; verify its bindings.
