# Scope Change Control

## Decision Rule

Before the first edit and whenever implementation needs a new path, run risk classification. Shared contract, schema, migration, CI, permission, release, a repository `strictPaths` match, or overlap with `protectedPaths` latches strict.

`run-phase.mjs` discovers `.governed-feature-delivery.json` at the repository root or accepts `--risk-policy <path>`. The policy uses `assets/risk-policy-template.json`. `strictPaths` are positive repository-relative patterns, `requirePullRequest=true` upgrades to strict, and optional `integrationRefs` restricts local merge evidence to full branch refs. New receipts normalize and freeze `integrationRefs` in the baseline risk snapshot; merge does not adopt later policy-file changes from an integration checkout. Missing policy falls back to built-in high-risk categories. Classification tokenizes camelCase names and recognizes common JavaScript, Python, Maven, Gradle, Go, Rust, Ruby, PHP, and Bun dependency/release manifests. After an upgrade, the `strictHandoff` output enumerates the authority inputs required by `strict-init`; the entrypoint never invents repository identities.

For an ordinary omitted path, do not interrupt delivery merely because the original manifest missed it:

1. Decide whether the path is necessary for an active-phase acceptance criterion, is the smallest local solution, and does not pull future-phase or unrelated work forward.
2. Supply that concrete reasoning through `--scope-rationale`. The CLI rejects missing, very short, and known placeholder values, while the agent remains responsible for judging whether the explanation actually establishes necessity, minimality, and phase locality.
3. Let `start`, `preflight`, or post-command `verify` append the exact path after mechanical forbidden/protected/risk and physical-containment checks. No user confirmation, external authority, plan rewrite, or new baseline is required.
4. Apply the same rule to a deletion and both sides of a rename. A deleted extension remains bound with `null` blob and tree mode.

If the agent cannot make that necessity/minimality judgment, defer the path instead of silently absorbing it. If the base plan or manifest truly changes, start a new v2 baseline. For high-risk or strict work:

1. Stop before editing the new protected surface and record the blocking state.
2. Write a plan delta from `assets/plan-delta-template.md` and state whether it changes stable design or only enables the active phase.
3. Obtain explicit authorization for the exact delta and update the plan, scope manifest, and machine hashes.
4. Require a clean worktree and run `apply-scope-delta.mjs`, then replay the affected strict gates.

`apply-scope-delta.mjs` verifies the parent HEAD is an ancestor of the current HEAD and rechecks every already-committed path from the parent base against the parent scope. A delta cannot retroactively authorize a protected, forbidden, or otherwise out-of-scope commit. It must preserve every parent `allowedPaths`, `protectedPaths`, `forbiddenWork`, and per-kind `evidenceInputs` entry; additions may tighten or extend authority, but a new allowed path cannot overlap parent forbidden work. Declared future evidence files may be absent at delta time, but strict evidence recording and currentness checks require them to exist and match their hashes. When strict mode is entered from a v2 receipt that already has lightweight extensions, `strict-init` creates the original-scope `PHASE_PLANNED` checkpoint and preserves the source receipt hash. The strict validator rejects `RED_CONFIRMED` and later states until an authorized delta adds every source extension as an exact `allowedPaths` entry; a parent, descendant, or merely overlapping glob is not approval.

An authorization is not transitive. Permission for a shared prerequisite does not authorize its later-phase consumer, unrelated cleanup, or a new PR scope.

## Phase Boundary Example

Phase B discovers a shared adapter that Phase C will also consume. Add the adapter to Phase B only when it is necessary for Phase B and the delta explicitly authorizes it. Keep the Phase C entry point in its own plan and PR, even if it is 30 lines, the reviewer agrees, and CI is slow.

## Delta Outcomes

- `active_phase_prerequisite`: update the active phase plan and remain in the current phase.
- `design_revision_required`: halt; do not apply a checkpoint delta. Start a replacement delivery under repository policy because this skill does not revise frozen design in place.
- `future_phase_only`: record the discovery but do not edit it in the active branch.
- `rejected`: preserve the blocked checkpoint and choose an in-scope alternative or stop.

Only `active_phase_prerequisite` produces the approved machine receipt consumed by `apply-scope-delta.mjs`. The other outcomes halt or defer without changing the checkpoint.

The scope manifest is the base scope authority. Plan prose may describe scope
but cannot add paths or evidence inputs. v2 `scopeExtensions` are the only
lightweight exception: they contain concrete canonical paths, a specific bounded
rationale, and timestamp, and are accepted only after directional forbidden/protected/risk
membership and physical-containment checks. Every later action revalidates persisted
extensions, so a parent directory replaced by a symlink or junction is rejected. The
baseline fingerprints ignored files under declared roots and finite built-in
CI/auth/security/schema/migration/release/dependency-manifest candidates using the same
risk classifier as tracked paths. Built-in discovery excludes installed dependency and
build-cache trees such as `node_modules`, `.pnpm`, `.yarn/cache`, virtual environments,
`.gradle`, `target`, and `vendor`; a declared governed pattern can still name them.
Verification, cache reuse, and the selected continuation's final live phase seal reject additions, modifications, or deletions relative to
that baseline. Later frozen merge/successor records rely on the sealed phase evidence and named integration ref instead of attributing the integration worktree to the old phase. Canonical managed ledger roots are excluded so receipts do not govern
themselves; ordinary `.artifacts/**` business paths remain eligible for ignored risk
detection, and unrelated ignored trees are not scanned. `.git` path segments and the
managed ledger roots are never valid target/scope/evidence entries, while other `.artifacts`
business paths remain ordinary governed work. Strict scope changes still use the approved
`scopeDeltas` path. Never edit `authorizedScope`, `scopeExtensions`, or `scopeDeltas`
directly in checkpoint JSON.

Lightweight phase evidence does not claim to bind changed symlink or gitlink content.
If a phase changes an entry with Git mode `120000` or `160000`, restore the clean bound
HEAD and enter strict. The lightweight orchestrator does not recursively hash a submodule
or dereference a link target.

Scope patterns intentionally support a constrained plain Git pathspec subset: repository root `.`, literals,
`*`, `?`, simple bracket classes, and segment-aligned `**`. POSIX bracket classes,
malformed classes, non-segment `**`, exclusion/pathspec magic, absolute paths, and `..`
are rejected rather than interpreted differently by preflight and Git. The local matcher
is differential-tested against Git; `.` covers every ordinary repository path while managed ledger paths remain mechanically excluded, and leading or middle `**/` requires at least one
directory level under these plain pathspec semantics.
Pattern spelling keeps those plain Git pathspec semantics. Exact concrete-path identity
uses repository `core.ignorecase` for deduplication, while `.git` and managed-ledger path
identities are conservatively reserved case-insensitively on every platform.
