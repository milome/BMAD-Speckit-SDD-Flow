# Phase Planning

## Separate Stable Design From Execution

Keep the design spec stable across phases. It owns the feature goal, contracts, invariants, compatibility promises, non-goals, phase map, and allowed successor signals. Hash it when frozen.

Create one implementation plan per phase. It owns:

- the phase outcome and prerequisites
- the scope manifest path/hash reference and phase-local scope rationale; it does not own or duplicate path authorization
- RED acceptance behavior
- implementation tasks and dependency order
- stop-gate commands and expected evidence
- review and PR boundary
- the exact next action after merge

Do not use completion checkboxes in the stable design as runtime state. The checkpoint is the runtime state.

## Planning Sequence

1. Resolve design ambiguity with `superpowers:brainstorming`.
2. Store the successor and authority policies separately, compute their canonical hashes, and obtain an external receipt binding the successor policy to `specHash` and an allowlisted design-freeze authority.
3. Define phase boundaries around independently reviewable outcomes.
4. Write only the active phase plan with `superpowers:writing-plans`.
5. Create one scope manifest as the sole path authority. It declares positive Git pathspecs for allowed/protected/forbidden paths and the complete input list for each gate kind. Record `phasePlanHash` and `scopeHash` before RED acceptance.
6. Execute with `superpowers:executing-plans`.

Changing implementation detail updates the phase plan hash. This skill never revises a frozen contract or invariant in place: halt the active delivery, record the design impact, and use the repository-defined replacement-delivery process with a new feature identity, spec, policies, receipt, and downstream plans.

## Successor Policy

Define an allowlist in a separate JSON authority file:

```json
{
  "allowedCodes": {
    "<exact-code>": "<target-phase-or-RELEASED>"
  }
}
```

Only an exact allowlisted code signed by a repository-defined authority can move execution upstream. Human prose such as "stale", "recheck", or "restart" is diagnostic context, not a transition authority.
