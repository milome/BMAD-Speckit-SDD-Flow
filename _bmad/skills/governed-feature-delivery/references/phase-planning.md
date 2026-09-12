# Phase Planning

## Separate Stable Design From Execution

Keep the design spec stable across phases. It owns the feature goal, contracts, invariants, compatibility promises, non-goals, and phase map. Hash and externally freeze it only in strict mode.

Create one implementation plan per phase. It owns:

- the phase outcome and prerequisites
- the scope manifest path/hash reference and phase-local scope rationale; it does not own or duplicate path authorization
- RED acceptance behavior when TDD or strict risk requires it
- implementation tasks and dependency order
- stop-gate commands and expected evidence
- verification and commit boundary
- the selected continuation after commit: `commit`, `merge`, or `pause`

Do not use completion checkboxes in the stable design as runtime state. The v2 phase receipt is runtime state for fast/phase; the v1 hash-linked checkpoint remains runtime state for strict.

## Planning Sequence

1. Resolve material ambiguity with the available brainstorming workflow; do not require it for an already explicit plan.
2. Select continuation once. Default to `commit`, use `merge` when repository policy requires PR merge, or `pause` when each phase needs a decision gate.
3. Define independently reviewable phase boundaries and write only the active phase plan.
4. Capture one baseline with `run-phase.mjs`. A dirty baseline is legal and records changed-path hashes plus Git tree modes so later phase commits exclude pre-existing content-only and mode-only changes. It also records a bounded path/content/type/mode/size fingerprint for ignored files under declared roots and finite built-in risk candidates, plus the normalized `integrationRefs` accepted by the selected risk policy; the built-in candidates use the same classifier as tracked paths but exclude installed dependency and build-cache trees. Those values are reused through the applicable live seals and frozen for merge consumption. A phase may not modify a baseline-dirty file; isolate or deliberately re-baseline first because hunk-level ownership is not inferred.
5. Use a scope manifest for phase/strict work. `allowedPaths` authorizes the phase; overlap with `protectedPaths` or repository risk policy latches strict before implementation.
6. Execute the plan from the baseline-bound branch and HEAD and run phase-close verification once. New verification evidence binds the command's post-execution tree, input hashes, changed paths, filtered Git blob OIDs, Git tree modes, and the optional verification-output path/hash. If implementation or the verification command adds, deletes, or renames a concrete path outside `allowedPaths`, the agent decides whether it is the active phase's necessary and smallest low-risk prerequisite. When it is, the agent supplies a specific `--scope-rationale` and v2 appends a bounded exact-path `scopeExtensions` event without asking the user or pausing the workflow; otherwise defer it or upgrade according to risk. Strict mode requires an explicit scope delta. Add RED only for TDD, high-risk behavior, or strict policy. After commit, classify risk from frozen phase commit paths so unrelated integration work is not attributed to the phase. Commit/pause continuation keeps phase inputs, ignored state, bound PASS output, and residual checks live through its successor seal. Merge continuation performs those checks for the last time at `PR_GREEN`; `MERGED` and merge `NEXT_PHASE` consume frozen phase/policy evidence and the named integration ref instead of the integration checkout's mutable plan, scope, policy, or worktree.
7. In strict mode only, store and hash successor/authority policies and obtain external freeze receipts before protected work.

Changing implementation detail updates the phase plan hash. Re-baseline before further implementation. Strict mode never revises a frozen contract or invariant in place: halt and use the repository-defined replacement-delivery process.

## Successor Policy

Fast ends at `COMMITTED`. A v2 phase receipt persists one continuation:

```text
commit: VERIFIED -> COMMITTED -> NEXT_PHASE
merge:  VERIFIED -> COMMITTED -> PR_GREEN -> MERGED -> NEXT_PHASE
pause:  VERIFIED -> COMMITTED -> PAUSED -> (resume) NEXT_PHASE
```

The selected continuation defines the final live phase seal. Fast terminates at `COMMITTED`; phase commit closes its last live seal at `NEXT_PHASE`, pause closes it at `(resume) NEXT_PHASE`, and merge closes the phase-worktree seal at `PR_GREEN`. Later merge/successor records validate frozen phase evidence plus the named integration ref instead of re-reading the old phase worktree.

The original user selection authorizes phase continuation. Continuation remains immutable in one v2 phase chain. Resume requires the unchanged paused phase commit and no phase residual work. Either lightweight mode may upgrade to `STRICT_REQUIRED`; a commit/pause continuation must pass `--confirm-continuation merge` when consuming it with `strict-init` because the compatible v1 backend is merge-only. Strict mode additionally defines an allowlist in a separate JSON authority file:

```json
{
  "allowedCodes": {
    "<exact-code>": "<target-phase-or-RELEASED>"
  }
}
```

Only strict mode requires an exact allowlisted code signed by a repository-defined authority. When v2 upgrades after lightweight extensions, strict initialization remains at `PHASE_PLANNED`; an authorized strict scope delta must add every source extension as an exact allowed path before RED can be confirmed. Existing v1 policies are interpreted as `mode=strict`, `continuation=merge` and remain read-only.
