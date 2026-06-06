# Script Migration Summary: main-agent-runtime-migration-wave-3.4

## Migrated

- scripts/main-agent-unified-ingress.ts -> packages/bmad-speckit/src/main-agent/actions/unified-ingress.js
- scripts/main-agent-delivery-closeout-gate.ts -> packages/bmad-speckit/src/main-agent/actions/delivery-closeout-gate.js
- scripts/main-agent-delivery-evidence-run.ts -> packages/bmad-speckit/src/main-agent/actions/delivery-evidence-run.js
- scripts/main-agent-soak-runner.ts -> packages/bmad-speckit/src/main-agent/actions/soak-runner.js
- scripts/main-agent-dual-host-pr-orchestrator.ts -> packages/bmad-speckit/src/main-agent/actions/dual-host-pr-orchestrator.js
- scripts/main-agent-chaos-scenarios.ts -> packages/bmad-speckit/src/main-agent/actions/chaos-scenarios.js

## Strategy

package_runtime_module

## Evidence

- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.4/evidence.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.4/install-matrix/save-dev.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.4/install-matrix/npx-package.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.4/install-matrix/no-save.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.4/install-matrix/init-codex.json

## Old Path Disposition

All original root scripts are retained as source-development files. Deletion is not approved.

## Runtime Proof

- usedRootScript: false
- usedTsx: false
- usedTsNode: false
- usedCompiledFallback: false
- rootScriptsDeleted: false
- rootScriptDeletionApproved: false

## Residual Risks

- Source repository tests may still exercise retained root TypeScript scripts for source-dev behavior.
- Root script deletion requires a separate per-script approval contract.
