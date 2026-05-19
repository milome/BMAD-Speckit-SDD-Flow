# TRACE-012 Negative Assertions

The functional resume acceptance test covers these failure modes:

- `resume-authority-hashes-current`: source document hash drift blocks resume.
- `resume-open-blockers-clear`: pending rerun loops and open RCA actions block resume.
- `resume-required-artifacts-indexed`: required command artifacts must be present in `artifactIndex` with matching hashes.
- Latest closure semantics: a historical blocked closure does not override a later pass closure for the same requirement ID.

Validation command:

`npx vitest run tests/acceptance/main-agent-functional-resume-check.test.ts tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts`
