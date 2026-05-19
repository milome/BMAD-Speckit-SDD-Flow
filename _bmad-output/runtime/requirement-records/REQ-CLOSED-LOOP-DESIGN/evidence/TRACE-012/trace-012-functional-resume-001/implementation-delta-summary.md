# TRACE-012 Implementation Delta Summary

## Changed Files

- `scripts/main-agent-functional-resume-check.ts`
- `tests/acceptance/main-agent-functional-resume-check.test.ts`

## Behavior Delta

- Added a read-only functional resume checker that derives trace checkpoints, resume packets, and functional resume proof only from controlled `RequirementRecord` sources.
- Resume checks validate source/implementation/architecture hashes, active architecture confirmation, controlled record arrays, latest closure state, open blockers, pending rerun loops, open RCA actions, and required artifact hash/index consistency.
- Added acceptance tests for happy path resume, source hash drift fail-closed behavior, pending rerun/open RCA fail-closed behavior, and required artifact hash mismatch fail-closed behavior.

## Negative Assertions

- Historical non-terminal closures do not block resume if a later closure for the same requirement ID is `pass`.
- Hash drift blocks resume.
- Pending rerun and open RCA block resume.
- Missing or hash-mismatched required artifacts block resume.
