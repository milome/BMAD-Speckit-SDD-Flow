# Branch And PR Topology

## Invariants

- One phase owns one branch and one PR.
- The PR description names the phase, authorized scope, non-goals, stop-gate evidence, and checkpoint generation.
- Later-phase code never enters the active PR.
- Shared prerequisites belong to the earliest phase that truly requires them, after an authorized plan delta.
- Repository instructions choose base branches, merge strategy, required checks, and synchronization policy.

## Lifecycle

1. Create the phase branch or isolated worktree from the repository-approved base.
2. Verify branch, HEAD, plan hash, and scope before the first edit.
3. Keep phase commits buildable; do not force artificial commit splits across shared files.
4. Push only after phase verification and review evidence are bound to HEAD.
5. Treat CI as evidence for the pushed SHA. Fix failures on the same phase branch.
6. Merge using repository policy.
7. Record merge evidence in a new `MERGED` revision, then use an exact authorized successor signal to create `NEXT_PHASE` or `RELEASED`.
8. Start the exact signaled next phase from the latest accepted base with `--previous <NEXT_PHASE checkpoint>`; generation increments and revision resets to 1.

## Prohibited Shortcuts

- Expanding the current PR because the next phase is small.
- Using separate commits inside one PR as a substitute for phase separation.
- Reusing review or CI from a different head SHA. This checkpoint schema has no equivalence-proof representation.
- Mixing release changes into a feature phase. Delegate public npm release to `npm-public-release` after feature delivery closes.
