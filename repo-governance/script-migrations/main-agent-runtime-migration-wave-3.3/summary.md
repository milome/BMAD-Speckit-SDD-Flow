# Script Migration Summary: main-agent-runtime-migration-wave-3.3

## Migrated

- scripts/main-agent-codex-worker-adapter.ts -> packages/bmad-speckit/src/main-agent/actions/codex-worker-adapter.js
- scripts/main-agent-compiled-prompt-runner.ts -> packages/bmad-speckit/src/main-agent/actions/compiled-prompt-runner.js
- scripts/main-agent-implementation-readiness-gate.ts -> packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate.js

## Strategy

package_runtime_module

## Evidence

- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.3/evidence.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.3/install-matrix/save-dev.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.3/install-matrix/npx-package.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.3/install-matrix/no-save.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.3/install-matrix/init-codex.json

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
