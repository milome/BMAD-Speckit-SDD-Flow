# Script Migration Summary: main-agent-runtime-migration-wave-3.6

## Migrated

- scripts/live-smoke-main-agent-runtime.ts -> packages/bmad-speckit/src/main-agent/actions/live-smoke-main-agent-runtime.js
- scripts/main-agent-ai-tdd-closeout-remediation-adapter.ts -> packages/bmad-speckit/src/main-agent/actions/ai-tdd-closeout-remediation-adapter.js
- scripts/main-agent-audit-review-gate.ts -> packages/bmad-speckit/src/main-agent/actions/audit-review-gate.js
- scripts/main-agent-bmad-artifact-hardcut.ts -> packages/bmad-speckit/src/main-agent/actions/bmad-artifact-hardcut.js
- scripts/main-agent-control-plane-isolation-check.ts -> packages/bmad-speckit/src/main-agent/actions/control-plane-isolation-check.js
- scripts/main-agent-data-governance-gate.ts -> packages/bmad-speckit/src/main-agent/actions/data-governance-gate.js
- scripts/main-agent-dataset-release-gate.ts -> packages/bmad-speckit/src/main-agent/actions/dataset-release-gate.js
- scripts/main-agent-decision-field-check.ts -> packages/bmad-speckit/src/main-agent/actions/decision-field-check.js
- scripts/main-agent-development-journey-matrix.ts -> packages/bmad-speckit/src/main-agent/actions/development-journey-matrix.js
- scripts/main-agent-entryflow-traceability-check.ts -> packages/bmad-speckit/src/main-agent/actions/entryflow-traceability-check.js
- scripts/main-agent-execution-closure-gate.ts -> packages/bmad-speckit/src/main-agent/actions/execution-closure-gate.js
- scripts/main-agent-functional-resume-check.ts -> packages/bmad-speckit/src/main-agent/actions/functional-resume-check.js
- scripts/main-agent-governed-data-products.ts -> packages/bmad-speckit/src/main-agent/actions/governed-data-products.js
- scripts/main-agent-production-loop-ready-check.ts -> packages/bmad-speckit/src/main-agent/actions/production-loop-ready-check.js
- scripts/main-agent-runtime-policy-snapshot-check.ts -> packages/bmad-speckit/src/main-agent/actions/runtime-policy-snapshot-check.js
- scripts/main-agent-scoring-gates-check.ts -> packages/bmad-speckit/src/main-agent/actions/scoring-gates-check.js
- scripts/main-agent-trace-status-policy-check.ts -> packages/bmad-speckit/src/main-agent/actions/trace-status-policy-check.js
- scripts/orchestration-dispatch-contract.ts -> packages/bmad-speckit/src/main-agent/actions/orchestration-dispatch-contract.js
- scripts/orchestration-governance-contract.ts -> packages/bmad-speckit/src/main-agent/actions/orchestration-governance-contract.js
- scripts/orchestration-state.ts -> packages/bmad-speckit/src/main-agent/actions/orchestration-state.js
- scripts/record-main-agent-inspect-readiness-closure.ts -> packages/bmad-speckit/src/main-agent/actions/record-main-agent-inspect-readiness-closure.js
- scripts/skill-orchestration-audit.ts -> packages/bmad-speckit/src/main-agent/actions/skill-orchestration-audit.js

## Strategy

package_runtime_module

## Evidence

- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/candidate-manifest.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/evidence.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.6/summary.md
- packages/bmad-speckit/tests/main-agent-wave-3-6-runtime-actions.test.js
- tests/acceptance/main-agent-runtime-migration-wave-3-6-contract.test.ts

## Old Path Disposition

All original root scripts are retained as source-development files. Deletion is not approved.

## Runtime Proof

- usedRootScript: false
- usedTsx: false
- usedTsNode: false
- usedCompiledFallback: false
- rootScriptsDeleted: false
- rootScriptDeletionApproved: false

## Scope Statement

Wave 3.6 proves P1 package runtime routes for the 22 manifest entries only. It does not claim that all scripts in the repository are directly runnable from consumer projects.

## Residual Risks

- Source repository tests may still exercise retained root TypeScript scripts for source-development behavior.
- Root script deletion requires a separate per-script approval contract.
