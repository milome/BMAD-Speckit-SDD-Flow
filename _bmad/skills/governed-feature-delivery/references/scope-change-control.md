# Scope Change Control

## Decision Rule

When implementation needs a path, shared contract, schema, dependency, migration, CI change, or public surface outside `authorizedScope`:

1. Stop before editing the new surface.
2. Record the blocking fact and current checkpoint state.
3. Write a plan delta from `assets/plan-delta-template.md`.
4. State whether the delta changes stable design or only enables the active phase.
5. Obtain explicit authorization for the exact delta.
6. Update the phase plan, scope manifest, and machine delta hashes.
7. Commit the already authorized in-scope work, require a clean worktree on the checkpoint branch, then run `apply-scope-delta.mjs` to create a new `PHASE_PLANNED` checkpoint revision. It binds the parent, current descendant HEAD, new `authorizedScope`, `scopeHash`, `scopeDeltas`, and `phasePlanHash`, and clears all gate, review, PR, merge, release, and scope-attestation evidence.
8. Replay RED, GREEN, stop gates, scope attestation, and review against the new scope before continuing.

`apply-scope-delta.mjs` verifies the parent HEAD is an ancestor of the current HEAD and rechecks every already-committed path from the parent base against the parent scope. A delta cannot retroactively authorize a protected, forbidden, or otherwise out-of-scope commit.

An authorization is not transitive. Permission for a shared prerequisite does not authorize its later-phase consumer, unrelated cleanup, or a new PR scope.

## Phase Boundary Example

Phase B discovers a shared adapter that Phase C will also consume. Add the adapter to Phase B only when it is necessary for Phase B and the delta explicitly authorizes it. Keep the Phase C entry point in its own plan and PR, even if it is 30 lines, the reviewer agrees, and CI is slow.

## Delta Outcomes

- `active_phase_prerequisite`: update the active phase plan and remain in the current phase.
- `design_revision_required`: halt; do not apply a checkpoint delta. Start a replacement delivery under repository policy because this skill does not revise frozen design in place.
- `future_phase_only`: record the discovery but do not edit it in the active branch.
- `rejected`: preserve the blocked checkpoint and choose an in-scope alternative or stop.

Only `active_phase_prerequisite` produces the approved machine receipt consumed by `apply-scope-delta.mjs`. The other outcomes halt or defer without changing the checkpoint.

The scope manifest is the sole scope authority. Plan prose may describe scope
but cannot add paths or evidence inputs. Never edit `authorizedScope` or
`scopeDeltas` directly in checkpoint JSON.
