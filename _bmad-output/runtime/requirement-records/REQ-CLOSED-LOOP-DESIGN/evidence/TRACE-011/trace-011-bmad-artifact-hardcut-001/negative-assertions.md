# TRACE-011 Negative Assertions

The hardcut acceptance test covers these failure modes:

- `legacy_runtime_artifact_still_active`: an active artifact under `_bmad-output/runtime/gates/**` cannot be accepted as target-state pass evidence.
- `docs_reference_cannot_be_completion_evidence`: a `docs/reference/**` schema path cannot be accepted with `sourceOfTruthRole=evidence`.
- `bmad-native-workflow-preserved`: missing native `bmad-help` workflow sources block the report instead of silently replacing BMAD routing with requirement projections.

Validation command:

`npx vitest run tests/acceptance/main-agent-bmad-artifact-hardcut.test.ts`
