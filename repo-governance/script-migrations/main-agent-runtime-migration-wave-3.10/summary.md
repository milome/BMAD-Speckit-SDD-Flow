# Main Agent Runtime Migration Wave 3.10

## Purpose

Wave 3.10 is a classification correction wave for the consumer reachable closure audit.

It removes fourteen scripts from the broad `repo_internal_reclassify_possible` bucket and records narrower consumer-closure classifications. This wave does not claim that all scripts are migrated, deletion-ready, or directly runnable from a consumer project.

## Corrected Classifications

| Script | Corrected classification | Registry strategy |
| --- | --- | --- |
| `scripts/host-runtime-mode.ts` | `package_runtime_module` | `package_runtime_module` |
| `scripts/supervised-worker-runtime.ts` | `package_runtime_module` | `package_runtime_module` |
| `scripts/bmad-help-renderer.ts` | `already_migrated_package_runtime_deprecated_root_path` | `public_cli_de_surface` |
| `scripts/bmad-state-reader.ts` | `package_local_helper` | `durable_helper_copy` |
| `scripts/bmads-renderer.ts` | `already_migrated_package_runtime_deprecated_root_path` | `public_cli_de_surface` |
| `scripts/check-story-score-written.ts` | `public_cli_package_action_existing_root_legacy` | `public_cli_de_surface` |
| `scripts/create-second-story.ts` | `repo_internal_test_seed_only` | `repo_internal_reclassify` |
| `scripts/diagnose-bmad-state.ts` | `package_runtime_module` | `package_runtime_module` |
| `scripts/e2e-verify-paths.ts` | `package_local_helper` | `durable_helper_copy` |
| `scripts/parallel-mission-control.ts` | `package_runtime_module` | `package_runtime_module` |
| `scripts/query-validate.ts` | `package_local_helper` | `durable_helper_copy` |
| `scripts/runtime-step-state.ts` | `package_local_helper` | `durable_helper_copy` |
| `scripts/verify-agent-files.ts` | `package_local_helper` | `durable_helper_copy` |
| `scripts/verify-score-auto-scoped-bundle.cjs` | `repo_internal_verification_harness` | `repo_internal_reclassify` |

## Narrow Claims

- The audit generator now carries explicit correction overrides for these fourteen scripts.
- The generated audit report records `correctionReclassifications` at the top level.
- The registry records these entries in `main-agent-runtime-migration-wave-3.10`.
- The wave status remains `in_progress`; entries use `validationStatus: partial`.
- Root script deletion remains disallowed for every entry.

## Non-Claims

- This wave does not claim package runtime migration is complete for the planned runtime/helper entries.
- This wave does not claim every consumer command can run directly from the package.
- This wave does not claim any root `scripts/*` path is deletion-ready.
- This wave does not introduce consumer runtime dependency on `repo-governance`.

## Evidence

Primary evidence is recorded in:

- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.10/classification-evidence.json`
- `repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json`

Required validation after this wave:

- `node tools/script-migration/audit-consumer-reachable-closure.cjs --write --pretty`
- `node tools/script-migration/validate-registry.cjs`
- `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js`
