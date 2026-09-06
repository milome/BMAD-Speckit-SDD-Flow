# <Feature> / <Phase> Implementation Plan

## Outcome

<One independently reviewable result.>

## Mode And Continuation

- Mode: `<phase | strict>` (`fast` does not require a stored phase plan)
- Continuation: `<commit | merge | pause>`
- Risk policy: `<path or built-in defaults>`

## Inputs

- Plan: `<path>` / `<sha256>`
- Prior phase receipt: `<path>` / `<sha256 or none>`
- Strict-only design, successor, authority, and freeze inputs: `<paths/hashes or not applicable>`

## Authorized Scope

- Scope manifest: `<path based on assets/authorized-scope-template.json>` / `<sha256>`
- Shared surfaces: `<explicitly included in allowedPaths or none>`

## Non-Goals

- <Later phase or unrelated work excluded from this PR.>

## Acceptance

- WHEN `<condition>` THEN `<observable result>`.
- RED command: `<focused failing test command or not required>`

## Implementation Steps

1. <Minimal implementation step and owned files.>
2. <Next dependent step.>

## Verification

- Commands: `<exact phase tests, build, lint, consumer checks>`
- Expected result: `<observable pass condition>`
- Receipt directory: `<repository-approved, repository-relative directory>`
- Expected terminal state: `<COMMITTED | MERGED | PAUSED>`

## Review And PR Boundary

- Reviewer: `<role or name>`
- PR contains: `<this phase only>`
- PR excludes: `<later phases and release work>`

## Next Exact Action

Use the v2 receipt's `progress.next`. Strict v1 delivery uses `nextActionCode` and `nextExactAction`.
