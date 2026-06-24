# Script Migration Summary: main-agent-runtime-migration-wave-3.2

## Scope

- rootMainAgentTotal=31
- settledEntriesExcludedFromWave3.2=6
- wave3.2TargetEntries=25
- rootScriptsDeleted=false
- implementationMigrated=false
- publicCliChanged=false
- No root script deletion was performed or approved.
- No package CLI, package Main Agent source, or package Main Agent dist implementation migration was performed.

## Classified Entries

### package_runtime_module

- scripts/main-agent-codex-worker-adapter.ts -> packages/bmad-speckit/src/main-agent/actions/codex-worker-adapter.ts, packages/bmad-speckit/dist/main-agent/actions/codex-worker-adapter.js; reachability=consumer_runtime_reachable; deletion=not_allowed
- scripts/main-agent-compiled-prompt-runner.ts -> packages/bmad-speckit/src/main-agent/actions/compiled-prompt-runner.ts, packages/bmad-speckit/dist/main-agent/actions/compiled-prompt-runner.js; reachability=consumer_runtime_reachable; deletion=not_allowed
- scripts/main-agent-implementation-readiness-gate.ts -> packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate.ts, packages/bmad-speckit/dist/main-agent/actions/implementation-readiness-gate.js; reachability=consumer_runtime_reachable; deletion=not_allowed
- scripts/main-agent-unified-ingress.ts -> packages/bmad-speckit/src/main-agent/actions/unified-ingress.ts, packages/bmad-speckit/dist/main-agent/actions/unified-ingress.js; reachability=installed_surface_reachable; deletion=not_allowed
- scripts/main-agent-delivery-closeout-gate.ts -> packages/bmad-speckit/src/main-agent/actions/delivery-closeout-gate.ts, packages/bmad-speckit/dist/main-agent/actions/delivery-closeout-gate.js; reachability=installed_surface_reachable; deletion=not_allowed
- scripts/main-agent-delivery-evidence-run.ts -> packages/bmad-speckit/src/main-agent/actions/delivery-evidence-run.ts, packages/bmad-speckit/dist/main-agent/actions/delivery-evidence-run.js; reachability=installed_surface_reachable; deletion=not_allowed
- scripts/main-agent-soak-runner.ts -> packages/bmad-speckit/src/main-agent/actions/soak-runner.ts, packages/bmad-speckit/dist/main-agent/actions/soak-runner.js; reachability=installed_surface_reachable; deletion=not_allowed
- scripts/main-agent-dual-host-pr-orchestrator.ts -> packages/bmad-speckit/src/main-agent/actions/dual-host-pr-orchestrator.ts, packages/bmad-speckit/dist/main-agent/actions/dual-host-pr-orchestrator.js; reachability=installed_surface_reachable; deletion=not_allowed
- scripts/main-agent-chaos-scenarios.ts -> packages/bmad-speckit/src/main-agent/actions/chaos-scenarios.ts, packages/bmad-speckit/dist/main-agent/actions/chaos-scenarios.js; reachability=installed_surface_reachable; deletion=not_allowed

### repo_internal_reclassify

- scripts/main-agent-execution-closure-gate.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-production-loop-ready-check.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-scoring-gates-check.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-runtime-policy-snapshot-check.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-trace-status-policy-check.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-data-governance-gate.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-dataset-release-gate.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-governed-data-products.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-functional-resume-check.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-entryflow-traceability-check.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-control-plane-isolation-check.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-decision-field-check.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-ai-tdd-closeout-remediation-adapter.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-audit-review-gate.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-bmad-artifact-hardcut.ts -> none; reachability=source_repo_only; deletion=not_allowed
- scripts/main-agent-development-journey-matrix.ts -> none; reachability=source_repo_only; deletion=not_allowed

## Evidence

- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/evidence.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/caller-inventory.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/classification-matrix.md

## Recommended Next Implementation Wave Order

1. Migrate entries with `consumer_runtime_reachable` because package runtime can directly reach them.
2. Migrate entries with `installed_surface_reachable` after confirming generated consumer surfaces need executable runtime behavior.
3. Keep `source_repo_only` entries retained as source-dev scripts unless a later wave proves consumer reachability.

## Residual Risks

- Wave 3.2 is a classification closure only; package runtime implementations are not migrated in this wave.
- `source_repo_only` decisions are based on current static references and must be revisited if installed surfaces or CLI dispatch changes.
