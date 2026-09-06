# <Feature> / <Phase> Implementation Plan

## Outcome

<One independently reviewable result.>

## Frozen Inputs

- Design spec: `<path>` / `<sha256>`
- Successor policy: `<path>` / `<sha256>`
- Authority policy: `<path>` / `<sha256>`
- Design freeze receipt: `<path>` / `<sha256>`
- Prior checkpoint: `<path>` / `<sha256 or none>`

## Authorized Scope

- Scope manifest: `<path based on assets/authorized-scope-template.json>` / `<sha256>`
- Shared surfaces: `<explicitly included in allowedPaths or none>`

## Non-Goals

- <Later phase or unrelated work excluded from this PR.>

## RED Acceptance

- WHEN `<condition>` THEN `<observable result>`.
- Command: `<focused failing test command>`

## Implementation Steps

1. <Minimal implementation step and owned files.>
2. <Next dependent step.>

## Stop Gate

- Commands: `<exact phase tests, build, lint, consumer checks>`
- Evidence inputs: `<exact manifest entries for each gate kind>`
- Receipt directory: `<repository-approved, repository-relative directory>`
- Expected terminal state: `<pre-next-phase state>`

## Review And PR Boundary

- Reviewer: `<role or name>`
- PR contains: `<this phase only>`
- PR excludes: `<later phases and release work>`

## Next Exact Action

Use the `nextActionCode` and derived `nextExactAction` in the validated checkpoint.
