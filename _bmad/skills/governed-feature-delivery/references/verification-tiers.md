# Verification And Evidence Currentness

## Lightweight Phase Evidence

Fast/phase mode captures one baseline and normally runs phase-close verification once. Baseline and verification fingerprints include each changed path's content identity and Git tree mode; deletions retain an exact changed path with `null` blob and mode, so rename source and destination are both bound. The baseline also binds a bounded fingerprint of ignored files under declared and finite built-in risk roots by path, content hash, type, mode, and size. Each verification record binds the command's post-execution tree, exact command and command hash, current HEAD, completion time, optional output path and `outputHash`, plus `inputHashes` for the plan, scope, risk policy, ignored-governed baseline, and cumulative v2 `scopeExtensions` hash. A matching `(headSha, treeHash, commandHash, inputHashes, outputPath, outputHash)` result is reused without executing the command; when it predates a later FAIL, the existing PASS is appended as the latest commit binding. Historical v2 receipts without the ignored-governed baseline remain status/lineage-readable but cannot create new evidence; establish a new baseline. Historical verification without extension fields may migrate only when its receipt has the ignored-governed baseline: a fresh verification adds the canonical empty extension hash. A commit is permitted only while the verified fingerprint, extension set, ignored-governed state, and optional output remain unchanged; its receipt binds the new commit SHA, verification count, verification tree hash, scope hash, and extension hash.

Development ledger writes are best-effort. A failure emits `ledger write warning` and implementation may continue. A verified receipt is required before commit, and commit/PR/merge/next/release boundary writes are blocking. Verification failure remains `IMPLEMENTING` and blocks commit. After Git hooks return, commit and interrupted-commit recovery recheck current HEAD/branch, bound inputs, persisted extension containment, ignored-governed state, and residual work before emitting a commit receipt.

Every receipt is limited to 4 MiB on both read and write. Before a new lightweight verification command runs, the orchestrator projects the complete evidence record already implied by the current command, inputs, scope extensions, changed paths, filtered blob OIDs, tree modes, and optional output binding, then reserves another 128 KiB in both the per-record and lineage budgets for changes introduced by the command. The final serialized receipt may not grow beyond that reserve. Requested verification output is written only after post-command risk/scope/currentness checks and final receipt admissibility succeed; if the receipt cannot be persisted, only the output created by that attempt is removed. `outputPath` and `outputHash` are either both bound or both absent, and a bound path is non-empty.

`run-phase.mjs --action status` validates the complete receipt lineage, then applies state-specific currentness for the next legal action. Pre-seal states compare the applicable inputs, branch, HEAD, ignored-governed baseline, bound PASS output, and residual phase work. `STRICT_REQUIRED` mirrors strict-init's unchanged clean boundary; `MERGED` validates its named ref/object; `NEXT_PHASE` validates the recorded successor base and branch separation. A merge receipt at or beyond `PR_GREEN` does not attribute the current integration checkout's plan, scope, risk policy, or worktree to the sealed phase. Historical warnings remain visible but do not alone set `receiptCurrent=false`. Strict status performs the historical structure pass and a current top-checkpoint pass. Status never rewrites evidence.

## Strict Evidence Binding

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
Strict evidence creation requires a clean worktree; otherwise tracked or untracked content would not be bound to `headSha`. This clean-worktree requirement does not apply to a fast/phase development baseline because v2 binds a working-tree fingerprint.

## Decision Matrix

| Condition | Action |
|---|---|
| HEAD, command, inputs, optional output, and receipt hash match | Reuse; do not rerun |
| Only one bound input changed | Rerun affected gates |
| HEAD changed | Rerun the affected gate; this checkpoint schema has no equivalence-proof representation |
| Receipt is missing from the checkpoint | Search canonical CI/artifact stores before rerunning |
| Receipt hash or lineage is invalid | Reject evidence and rerun affected gates |
| Strict worktree has tracked or untracked changes | Do not claim currentness for PR readiness |
| v2 working-tree fingerprint differs from verification | Rerun phase-close verification before commit |
| v2 verification output hash differs | Reject reuse and rerun or recover the canonical output |
| A necessary, minimal, phase-local low-risk path is outside base `allowedPaths` | The agent supplies a concrete rationale and appends one exact `scopeExtensions` event without user confirmation; protected/forbidden/high-risk paths still upgrade or fail |
| An ignored file is added, modified, or deleted under declared or built-in governed risk roots after baseline | Reject verification/cache reuse/commit; the directed fingerprint does not enumerate unrelated ignored paths |

Use `verify-evidence-currentness.mjs` for deterministic checks. The script never runs a gate; it returns `reuse` or `rerun_affected_gate` with reasons.

The script first validates the complete checkpoint and evidence/state
relationship. Exit `0` means reuse, exit `3` means rerun the affected gate, and
exit `2` means invalid input or checkpoint.

Through `PR_GREEN`, the latest checkpoint validation recomputes the input hashes for the gate that
authorizes its current state. `MERGED`, `NEXT_PHASE`, and `RELEASED` retain those gate hashes as frozen evidence, read spec/plan/scope/authority/successor/risk artifacts from the phase commit's Git blobs, and use the merge object/ref for live currentness. Pure historical validation uses the same stable artifact source. Historical parent revisions are validated for shape, receipt integrity, append-only lineage, and transition semantics without pretending their old input hashes describe the current worktree.

Strict validator diagnostics retain the full issue count and original byte count while bounding each reported issue and the aggregate issue payload; CLI output remains small, structured JSON even when an invalid field name is very large.

For a strict checkpoint bridged from v2, every action that can create or rely on
new strict evidence explicitly enforces the live source receipt's ignored-governed
baseline. `--historical true` suppresses ordinary live checkpoint checks only; strict
action callers also pass `--enforce-source-baseline true`. Pure historical lineage
reads leave that option disabled so old filesystem state is not treated as current.

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

Commit recovery is equally evidence-bound. It reconstructs the expected intent from the latest verification and compares parent receipt hash, previous HEAD, branch, message hash, extension hash, changed paths, blobs, and tree modes with the actual commit. A pending intent cannot weaken a current verification by omitting tree modes.

## Review Currentness

Bind review to the reviewed HEAD. A no-findings review on an older commit is stale for changed files. After committing a review-driven in-scope edit, run `reset-execution-gates.mjs` from the latest checkpoint in `GREEN_CONFIRMED` through `PR_GREEN`, then replay RED, GREEN, the phase stop gate, scope attestation, and review on the new HEAD. If the plan or scope must change, reset first and then use the authorized scope-delta path before replaying gates.

## No Duplicate Gates

Do not rerun a current gate because the session restarted, the operator wants reassurance, or a summary is old. Conversely, do not reuse a result merely because it is recent or says "passed"; verify its bindings.
