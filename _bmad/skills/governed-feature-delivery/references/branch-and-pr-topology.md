# Branch And PR Topology

## Invariants

- One phase owns one branch and at most one PR.
- The PR description names the phase, authorized scope, non-goals, stop-gate evidence, and checkpoint generation.
- Later-phase code never enters the active PR.
- Shared prerequisites belong to the earliest phase that truly requires them, after an authorized plan delta.
- Repository instructions choose base branches, merge strategy, required checks, and synchronization policy.

## Lifecycle

1. Create the phase branch or isolated worktree from the repository-approved base and capture one baseline.
2. Keep phase commits buildable and bind verification to the exact receipt HEAD and unchanged working-tree fingerprint. A dirty baseline may remain through PR readiness when its original paths, hashes, and modes are unchanged and no phase residual work remains.
3. For `continuation=commit`, record `COMMITTED`, then seal `NEXT_PHASE` on the old phase. Create a different phase branch at the exact `successor.baseSha` and initialize it with `run-phase.mjs --action start --previous <next-receipt>`. If PRs are opened later, use a stacked PR whose base is the preceding phase branch; merge in phase order.
4. For `continuation=merge`, push the committed phase and bind `PR_GREEN` to the phase commit. This is the final live phase-worktree seal: it checks the phase branch/HEAD, inputs, ignored-governed baseline, bound PASS output, frozen commit paths, and residual work. Then record a distinct local merge commit from a full `refs/heads/...` or `refs/remotes/...` integration ref using the `integrationRefs` allowlist frozen in the baseline receipt. The ref cannot be the phase branch or a remote-tracking alias, and the merge first parent must not already contain the reviewed phase commit. Merge and merge-successor actions validate the frozen receipt and named ref/object without requiring the integration checkout's mutable plan, scope, policy, or worktree to match the phase. Create the next phase from the exact merge SHA on a different branch. Squash/fast-forward merges require repository-external evidence and are not represented by this local receipt.
5. For `continuation=pause`, seal `PAUSED`; after an explicit decision, run `--action resume` from that receipt at the unchanged phase commit with no residual phase work. The resulting `NEXT_PHASE` receipt is the only allowed successor source.
6. Existing v1 checkpoints keep the original merge-only lifecycle and initialize with `--previous <NEXT_PHASE checkpoint>`. `MERGED` status validates the live named integration ref without requiring checkout of the old phase branch or HEAD. `NEXT_PHASE` status additionally requires `HEAD` to equal the recorded merge SHA and the current non-detached branch to differ from the previous phase branch. Advancing `MERGED` to `NEXT_PHASE` or `RELEASED` rechecks that live ref before writing the successor. A v2 risk upgrade persists its `sourcePhaseReceipt` bridge across strict revisions and later generations.

## Prohibited Shortcuts

- Expanding the current PR because the next phase is small.
- Using separate commits inside one PR as a substitute for phase separation.
- Reusing review or CI from a different head SHA. This checkpoint schema has no equivalence-proof representation.
- Passing `HEAD`, a raw SHA, the phase branch, or an alias ref pointing directly at the phase commit as merge evidence.
- Creating a new strict merge receipt with the historical `{commitSha, mergedAt}` shape. That form is accepted only when reading legacy v1 evidence; new receipts bind `sha`, full `ref`, `containsReviewedSha`, and `mergedAt`.
- Mixing release changes into a feature phase. Use the repository release workflow after feature delivery closes; `npm-public-release` is optional when installed.
