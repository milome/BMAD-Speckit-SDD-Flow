---
name: governed-feature-delivery
description: Use when a feature spans multiple phases or pull requests, resumes after interruption, has expensive validation evidence, or risks scope drift, stale handoffs, upstream regression, or later-phase work entering the current PR.
---

# Governed Feature Delivery

## Overview

Coordinate phased delivery with a lightweight default and an auditable strict path. Use `run-phase.mjs` as the user-facing mode router and fast/phase orchestrator; `strict-init` consumes `STRICT_REQUIRED` and initializes the legacy checkpoint backend. Recover by replaying canonical evidence, not conversation memory; keep stable design separate from phase plans; keep one phase in one branch/PR.

## Route

Use for multi-phase or multi-PR work, shared contracts or protected surfaces, interruption recovery, expensive gates, scope drift, or uncertain next actions. For a local low-risk change, `fast` is the default. `phase` is selected when a plan/scope or multiple phases are present. `strict` is selected explicitly or latched automatically when protected/shared/schema/migration/CI/permission/release paths are detected.

Runtime prerequisites: Node.js `18.17.0+` and Git `2.31.0+`. Every CLI checks these minimums before delivery work proceeds; the skill has no online package dependency.

## Required Sub-Skills

Invoke only the applicable workflow: brainstorming for ambiguity, writing-plans for a phase plan, executing-plans for implementation, and TDD/review/verification when risk requires them. Strict mode may additionally require worktrees and authority receipts. If a named skill is unavailable, continue with the equivalent repository workflow; do not block fast/phase delivery on a fallback ledger.

## Mode Decision

| Mode | Select when | Evidence | Blocking boundary |
|---|---|---|---|
| `fast` | One low-risk phase with direct verification | Lightweight progress receipt; no full checkpoint or successor | Commit (terminal) |
| `phase` | Multiple ordinary phases or an explicit plan/scope | One baseline, phase-close verification, commit receipt | Commit/PR/merge/next |
| `strict` | Explicit request or protected/shared/schema/migration/CI/permission/release/recovery risk | Existing hash-linked v1 checkpoint and gates | Before protected edit and every boundary |

## Workflow

1. **Choose once for a phased delivery.** Ask: continue after this phase by commit, merge, or pause. `continuation` is immutable within a phase chain; lightweight `fast` and `phase` may only upgrade to `strict`, never downgrade. Fast is single-phase and ends at its verified commit unless risk first latches `STRICT_REQUIRED`. Because the compatible strict v1 backend is merge-only, a commit/pause delivery that upgrades requires explicit `--confirm-continuation merge` before strict initialization.
2. **Plan and baseline.** `run-phase.mjs --action start` captures branch, HEAD, dirty/clean status, status hash, changed-file hashes and Git tree modes, plan hash, scope hash, risk reasons, and a bounded fingerprint of ignored files under declared and built-in risk roots once. Dirty worktrees are allowed, but a baseline-dirty file cannot also be edited or committed by the phase; isolate it or establish a deliberate new baseline first.
3. **Preflight, implement, and verify.** Before the first edit, provide each concrete planned target with repeated `--target-path` on `start`, or create an `IMPLEMENTING` receipt with `run-phase.mjs --action preflight --target-path <path>`. Every target and every persisted extension is canonicalized to one exact repository-relative spelling and checked against the real repository path, including existing symlink/junction components. Concrete targets are not pathspecs: `*` and `?` are rejected, while legal names containing bracket characters remain exact. When a path outside `allowedPaths` is necessary, minimal, phase-local, and not forbidden, protected, or otherwise high-risk, the agent supplies a concrete `--scope-rationale` and the orchestrator appends an exact v2 `scopeExtensions` event without asking the user, pausing, or interrupting implementation. The CLI mechanically rejects missing, very short, and known placeholder rationales; the agent remains responsible for the semantic necessity/minimality/phase-locality judgment. Uncertainty is not authority to absorb future-phase or unrelated work. Extensions are exact paths, append-only, and bounded; they never authorize strict work. Re-run preflight before touching a newly discovered target. Preflight and verification require the receipt's exact branch and HEAD; an unexplained commit requires the canonical successor/recovery path or a new baseline. `run-phase.mjs --action verify` applies the same rule to additions, deletions, and both rename sides, then records exact command/tree bindings with each changed path's filtered Git blob OID and tree mode (`null` for a deletion). Lightweight delivery rejects changed symlink (`120000`) and gitlink (`160000`) entries; restore the clean bound HEAD and enter strict rather than recursively trusting linked content. Directional membership is used for concrete targets, so sibling glob prefixes do not imply authorization. The command's post-execution tree is classified again. Tracked targets and ignored built-in candidates use the same risk classifier. Before verification/cache reuse, after the command, and through the last live boundary for the selected continuation, the orchestrator compares the baseline fingerprint of ignored governed files by path, content hash, type, mode, and size; additions, modifications, and deletions under declared protected/forbidden/strict roots or finite built-in CI/auth/security/schema/migration/release/dependency-manifest candidates fail closed. Installed dependency and build-cache trees such as `node_modules`, `.pnpm`, `.yarn/cache`, virtual environments, `.gradle`, `target`, and `vendor` are excluded from built-in ignored discovery unless a declared governed pattern names them. Canonical managed ledger roots are excluded in the Git query and again after enumeration so receipts do not govern themselves. Plain scope patterns retain supported Git pathspec spelling semantics; exact-path identity follows repository `core.ignorecase`, while Git metadata and managed ledger roots are rejected case-insensitively. Unrelated ignored trees are not scanned. Git metadata and `.artifacts/governed-feature-delivery{,-fallback}/**` are reserved internal paths and cannot be target/scope/evidence entries; other `.artifacts/**` paths are normal governed work and remain eligible for ignored risk detection. When `--verify-output` is used, the cache key and record bind its path and hash; a request for a new output executes the command instead of reusing an output-less result, and later output drift blocks reuse before the selected live seal. A reusable older PASS is promoted as the latest evidence binding after an intervening FAIL without rerunning the command. For commit/pause continuation, inputs, ignored state, bound PASS output, residual work, and frozen phase commit paths remain live through `NEXT_PHASE` or `PAUSED -> resume`. For merge continuation, `COMMITTED -> PR_GREEN` is the last live phase-worktree seal; `PR_GREEN -> MERGED -> NEXT_PHASE` consumes frozen phase and policy evidence and does not attribute integration-checkout plan, scope, policy, or worktree changes to the phase. RED is only required in strict/TDD flows. Verification failure returns a bounded exit/signal/error summary, remains visible in progress, and blocks commit, not editing. If risk is first discovered after an edit, restore the clean bound HEAD and start a new strict handoff; `strict-init` never absorbs the dirty edit into its baseline.
4. **Commit and continue.** `run-phase.mjs --action commit` creates a commit-bound receipt and rejects pre-commit hook mutations of the verified path/blob/mode set. It writes a bound pre-commit intent before invoking Git, then rechecks HEAD, branch, bound inputs, extension containment, ignored governed state, and residual work after hooks complete and before writing the receipt. After interruption, recovery reconstructs the same expected intent from the latest verification, performs the same live boundary checks, and accepts it only when parent receipt, previous HEAD, branch, message, extension hash, changed paths, blobs, and tree modes all match the actual commit. Legacy omission of the extension hash is accepted only for an empty extension set; omission of tree modes is accepted only when the source verification also predates tree-mode evidence. Fast ends here. In phase mode, `continuation=commit` lets `--action next` create `NEXT_PHASE` without waiting for PR merge (stacked PRs are allowed). For `merge`, `PR_GREEN` seals the live phase branch, commit, inputs, ignored-governed baseline, bound PASS output, and residual check. `MERGED` then binds the frozen baseline `integrationRefs` policy to a full non-phase integration branch ref and a distinct local merge commit whose first parent did not already contain the reviewed phase commit; it does not require the integration checkout to resemble the phase worktree. `pause` seals `PAUSED`, then an explicit `--action resume` seals `NEXT_PHASE` from the unchanged phase commit.
5. **Upgrade strict.** Risk classification runs at start/preflight and each lightweight action through its live seal; sealed merge actions use the frozen phase and `integrationRefs` evidence. A protected/shared/release reason latches `STRICT_REQUIRED`; consume that receipt with `run-phase.mjs --action strict-init` and the six repository authority inputs. Existing lightweight extensions remain hash-bound in `sourcePhaseReceipt`: `strict-init` creates the original-scope v1 checkpoint at `PHASE_PLANNED`, but the strict validator blocks `RED_CONFIRMED` and every later state until an authorized `apply-scope-delta.mjs` revision adds every source extension as an exact allowed path. Parent/child or prefix overlap is not approval. The command persists the source path/hash, source phase, confirmed merge continuation, clean branch/HEAD/tree boundary, and input hashes. The bridge remains immutable across later strict revisions and generations. Every live strict action enforces the source v2 ignored-governed baseline even when it also requests historical lineage validation; pure historical reads do not reinterpret old filesystem state as current. Failed strict boundary checks block the action. Development ledger failures remain warnings only when the independent fallback receipt succeeds; commit/PR/merge/next ledger failures block.
6. **Compatibility.** Existing v1 checkpoints are read as strict/merge mode and are never rewritten. Historical v2 receipts may omit optional `scopeExtensions` and ignored-governed fields for status and lineage reads. A legacy receipt that still has an ignored-governed baseline may migrate an empty extension set through a fresh verification; one without that baseline cannot create new delivery evidence or enter strict and requires a new baseline. The old `{commitSha, mergedAt}` merge shape is historical-read compatibility only; new strict merges require `{sha, ref, containsReviewedSha, mergedAt}`. Direct legacy scripts are strict-only or internal APIs; new work starts through `run-phase.mjs`.
7. **Show progress.** After every action, render `progress.stage`, `progress.completed`, `progress.next`, and warnings as `Plan -> Baseline -> Implement -> Verify -> Commit -> Next`. Use `--action status` after a resume. It validates lineage first, then computes `receiptCurrent` from the live checks relevant to the next legal action: phase inputs and worktree seals before successor/PR readiness, strict-init readiness for `STRICT_REQUIRED`, the named merge ref/object for `MERGED`, and the recorded successor base for `NEXT_PHASE`. Historical warnings remain visible but do not by themselves make a receipt stale. Status never rewrites the receipt.

## State Machine

```text
fast: PLAN -> BASELINE -> IMPLEMENTING -> VERIFIED -> COMMITTED
phase base: PLAN -> BASELINE -> IMPLEMENTING -> VERIFIED -> COMMITTED
phase commit: COMMITTED -> NEXT_PHASE
phase merge: COMMITTED -> PR_GREEN -> MERGED -> NEXT_PHASE
phase pause: COMMITTED -> PAUSED -> (resume) NEXT_PHASE
strict:
DISCOVERED
-> SPEC_FROZEN
-> PHASE_PLANNED
-> RED_CONFIRMED
-> GREEN_CONFIRMED
-> STOP_GATE_GREEN
-> REVIEWED
-> PR_GREEN
-> MERGED
-> NEXT_PHASE | RELEASED

Scope delta: PHASE_PLANNED | RED_CONFIRMED | GREEN_CONFIRMED | STOP_GATE_GREEN -> PHASE_PLANNED
Committed gate replay: GREEN_CONFIRMED | STOP_GATE_GREEN | REVIEWED | PR_GREEN -> PHASE_PLANNED
```

Fast has no successor transition. In phase mode, the persisted continuation choice authorizes the matching transition and cannot change in place. In strict mode, move upstream only on an exact code in the frozen, hash-bound `successorPolicy.allowedCodes`. Each strict phase has one generation; every write creates a new hash-linked revision.

## Checkpoint Commands

```powershell
node <skill>/scripts/run-phase.mjs --action start --out .artifacts/governed-feature-delivery/<feature>/<phase>/baseline.json --feature-id <id> --phase-id <id> --mode auto --continuation commit --plan <plan.md> --scope <scope.json> --repo <repo>
node <skill>/scripts/run-phase.mjs --action preflight --receipt <baseline.json> --out <implementing.json> --target-path <repo-relative-path> --scope-rationale "<phase-local necessity and minimality>" --repo <repo>
node <skill>/scripts/run-phase.mjs --action verify --receipt <baseline.json> --out <verified.json> --verify-command "<exact command>" [--scope-rationale "<required when verification adds a low-risk path>"] --repo <repo>
node <skill>/scripts/run-phase.mjs --action commit --receipt <verified.json> --out <committed.json> --commit-message "<message>" --repo <repo>
node <skill>/scripts/run-phase.mjs --action next --receipt <committed-or-merged.json> --out <next.json> --next-phase <id> --repo <repo>
node <skill>/scripts/run-phase.mjs --action resume --receipt <paused.json> --out <next.json> --next-phase <id> --repo <repo>
node <skill>/scripts/run-phase.mjs --action strict-init --receipt <strict-required.json> --out <strict-checkpoint.json> --spec <design.md> --freeze-receipt <freeze.json> --plan <plan.md> --scope <scope.json> --successor-policy <policy.json> --authority-policy <authority.json> [--confirm-continuation merge] --repo <repo>

# Strict v1 backend and compatibility commands
node <skill>/scripts/hash-checkpoint-input.mjs --kind file --input <design.md> --repo <repo>
node <skill>/scripts/hash-checkpoint-input.mjs --kind policy --input <successor-policy.json> --repo <repo>
node <skill>/scripts/hash-checkpoint-input.mjs --kind authority --input <authority-policy.json> --repo <repo>
node <skill>/scripts/init-execution-checkpoint.mjs --out <checkpoint-r1.json> --feature-id <id> --phase-id <id> --spec <design.md> --freeze-receipt <freeze.json> --plan <phase-plan.md> --scope <scope.json> --successor-policy <policy.json> --authority-policy <authority.json> --repo <repo>
node <skill>/scripts/prepare-execution-checkpoint.mjs --checkpoint <discovered.json> --out <frozen.json> --to-state SPEC_FROZEN --spec <design.md> --successor-policy <policy.json> --freeze-receipt <freeze.json> --authority-policy <authority.json> --repo <repo>
node <skill>/scripts/validate-execution-checkpoint.mjs --checkpoint <checkpoint-r1.json> --repo <repo>
node <skill>/scripts/record-gate-evidence.mjs --checkpoint <checkpoint-r1.json> --out <red.json> --id <id> --kind acceptance-red --status confirmed --command "<exact command>" --receipt <receipt.log> --repo <repo>
node <skill>/scripts/advance-execution-checkpoint.mjs --checkpoint <checkpoint-r1.json> --out <checkpoint-r2.json> --to-state RED_CONFIRMED --evidence <red.json> --repo <repo>
node <skill>/scripts/attest-scope.mjs --checkpoint <stop-green.json> --out <scope-attestation.json> --repo <repo>
node <skill>/scripts/advance-execution-checkpoint.mjs --checkpoint <stop-green.json> --out <reviewed.json> --to-state REVIEWED --scope-attestation <scope-attestation.json> --reviewer <reviewer.json> --repo <repo>
node <skill>/scripts/apply-scope-delta.mjs --checkpoint <checkpoint.json> --out <next.json> --scope <scope.json> --plan <plan.md> --delta <approved-delta.json> --repo <repo>
node <skill>/scripts/reset-execution-gates.mjs --checkpoint <stale-green-or-later.json> --out <replay-planned.json> --repo <repo>
node <skill>/scripts/verify-evidence-currentness.mjs --checkpoint <checkpoint.json> --evidence <evidence-id> --repo <repo>
```

Run each script with `--help`. `assets/phase-receipt.schema.json` defines v2 fast/phase receipts and is enforced by the bundled offline validator. `assets/execution-checkpoint.schema.json` and `validate-execution-checkpoint.mjs` jointly define the v1 strict acceptance authority; the CLI applies the bundled schema before semantic and lineage checks. New v2 and strict receipt lineages are limited to 64 records and 64 MiB of cumulative JSON, and each JSON record is limited to 4 MiB on both read and write. Before running a new lightweight verification command, the orchestrator reserves 128 KiB for its evidence record. One CLI process has an aggregate hash budget of 2048 files and 256 MiB with a 64 MiB per-file cap; every ignored-governed fingerprint also has a child cap of 2048 files and 1 MiB that consumes the aggregate budget. Git filtered hashing is non-interactive and times out after 30 seconds. Exceeding any budget or filter timeout fails closed. Never hand-edit either form.

## Non-Negotiable Boundaries

- Keep one phase in one branch/PR. Authorization, reviewer agreement, small size, separate commits, or slow CI never authorize later-phase mixing.
- For an ordinary omitted path, classify it first, record a concrete phase-local necessity/minimality rationale, and continue without a user confirmation. Use a plan/scope delta or stop only when the change is high-risk, changes the base contract, cannot be justified as the active phase's smallest prerequisite, or belongs to a future phase.
- In strict mode, the scope manifest is the sole path and gate-input authority. In v2 phase mode, the scope manifest remains the base authority and exact-path `scopeExtensions` record justified low-risk prerequisites without rewriting the manifest. A phase plan references its hash but does not duplicate or override it.
- `allowedPaths`, `protectedPaths`, and `forbiddenWork` contain only positive repository-relative patterns in the supported plain Git pathspec subset: repository root `.`, literals, `*`, `?`, simple bracket classes, and segment-aligned `**`. Matcher and Git enumeration use the same plain-pathspec spelling semantics; in particular, `.` covers every ordinary repository path and leading or middle `**/` does not match a zero-directory path. Exact concrete-path identity follows repository `core.ignorecase`; explicit `.git` and managed-ledger identities are always rejected case-insensitively, and managed ledger paths remain mechanically excluded even when the scope uses `.`. Exclusion/pathspec magic, POSIX bracket classes, malformed brackets, non-segment `**`, absolute paths, `..`, reserved internal paths, and symlink escapes are rejected.
- Every `evidenceInputs` entry is a canonical repository-relative file path. Absolute paths, `..`, `.git`, managed ledger roots, and symlink escapes are rejected before planning completes. A future implementation output may be declared before it exists, but it must exist and be hash-bound when its strict gate is recorded or reused.
- Never move upstream because of reboot, elapsed time, unchecked plans, stale handoffs, or ordinary stale status.
- Restart does not stale hash-bound evidence. Search canonical evidence before rerunning; reuse current evidence and rerun only affected gates.
- Keep repository branch names, integration refs, required checks, domain authorities, and release policy outside this skill. Configure accepted local integration refs with `risk-policy.integrationRefs`; an empty list accepts any full named non-phase branch ref.
- In strict mode, repository policy names the design-freeze, recovery, scope-delta, review, successor, and release authorities. An unknown or conflicting authority halts strict boundary actions; it does not block fast/phase implementation.
- Authority strings are trusted-runner governance identities, not cryptographic signatures. If untrusted actors can write receipts or checkpoint files, repository policy must add signed receipts or an external identity verifier before using this skill as a security boundary.
- All CLI artifact paths are repository-relative, contain no symlink/junction component below the repository root, and remain inside the real repository root. Repo-external artifacts are not supported.
- Treat the repository and its local filesystem as owned by the trusted runner for each CLI action. File identity and output-parent checks detect ordinary concurrent changes, but these portable Node scripts are not an OS sandbox against a hostile process racing filesystem operations.
- Verification commands are operator-authored shell commands. Never interpolate untrusted repository data into them.

## References

- Read `references/phase-planning.md` when defining phase boundaries or continuation.
- Read `references/scope-change-control.md` when a required path was omitted or strict scope must change.
- Read `references/verification-tiers.md` when deciding reuse, replay, recovery, or evidence currentness.
- Read `references/branch-and-pr-topology.md` for stacked phases, merge evidence, and branch isolation.

## Templates

- `assets/design-spec-template.md`: stable design source.
- `assets/phase-plan-template.md`: one-phase executable plan.
- `assets/plan-delta-template.md`: authorized scope expansion.
- `assets/authorized-scope-template.json`: path and complete gate-input authority.
- `assets/authority-policy-template.json`: repository role allowlists for every signed decision.
- `assets/design-freeze-receipt-template.json`: external spec/policy freeze authority.
- `assets/gate-evidence-template.json`: gate evidence shape.
- `assets/recovery-receipt-template.json`: field-level recovery provenance.
- `assets/successor-policy-template.json`: exact successor allowlist.
- `assets/risk-policy-template.json`: repository strict-path and PR policy discovery surface.
- `assets/phase-receipt.schema.json`: v2 fast/phase receipt and progress shape.
- `assets/execution-checkpoint.schema.json`: read-only-compatible v1 strict checkpoint shape.
