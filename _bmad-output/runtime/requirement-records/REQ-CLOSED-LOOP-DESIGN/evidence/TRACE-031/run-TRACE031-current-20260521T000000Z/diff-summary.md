# TRACE-031 diff summary

- Enforced full functional resume failure-case coverage: unexercisedCases.length > 0 blocks resume.
- Added machine-readable case evidence, exercised counts, and failureCaseCoverageGate fields to resume proof.
- Switched functional resume blocker evaluation to latest-by-id semantics for failures, RCA actions, and rerun loops.
- Added delivery closeout failure-case coverage artifact gate; missing or incomplete coverage blocks closeout.
- Added acceptance coverage for unexercised cases, post-full-link coverage matrix, latest resolved blockers, missing coverage artifact, and incomplete coverage artifact.
