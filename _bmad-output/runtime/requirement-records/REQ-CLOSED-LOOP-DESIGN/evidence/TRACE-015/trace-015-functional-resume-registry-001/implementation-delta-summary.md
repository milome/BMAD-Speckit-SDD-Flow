# TRACE-015 Implementation Delta Summary

## Scope

- Added source-driven `functionalResumeFailureCaseRegistry` validation to `scripts/main-agent-functional-resume-check.ts`.
- Added CLI support for `--source` and `--registry` so the checker reads contractized source documents or explicit registry fixtures without hardcoding a requirement document.
- Added `resumeFailureCaseRegistryCoverage` to resume packets and functional resume proof artifacts.
- Extended acceptance coverage in `tests/acceptance/main-agent-functional-resume-check.test.ts`.

## Contract IDs Closed

- MUST-022
- NEG-010
- OUT-008
- EVD-001
- EVD-004
- EVD-022
- TRACE-015

## Behavior

The functional resume checker now fails closed when the source contract lacks a functional resume failure registry, when groups are implicit, when failure cases lack `expectedRecoveryActions[]`, when recovery actions reference undefined actions or event types, and when action event types are not backed by global `governanceEventTypeRegistry[].payloadContract`.

## Evidence

The current run parsed the source registry and produced a passing resume proof with 6 groups, 27 failure cases, 17 recovery actions, 27 global event types, and 24 controlled record event type projections. The current deterministic executable subset covers `sourceDocumentHash_changed`; all other registry cases remain explicitly listed as unexercised coverage matrix items rather than being claimed complete by inference.
