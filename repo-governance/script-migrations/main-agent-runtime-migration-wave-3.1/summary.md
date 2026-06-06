# Script Migration Summary: main-agent-runtime-migration-wave-3.1

sourcePlanHash: sha256:8499ef2f50f850a690d0aae3cf5191f661cf719b3517f4e87e3037602fc18a82
rootScriptsDeleted: false
rootScriptDeletionApproved: false
nextWaveRecommendation: blocked_until_wave_3_1_acceptance_review_complete

## Migrated Package Runtime Modules

- scripts/main-agent-release-gate.ts -> packages/bmad-speckit/src/main-agent/actions/release-gate.js -> packages/bmad-speckit/dist/main-agent/actions/release-gate.js
- scripts/main-agent-quality-gate.ts -> packages/bmad-speckit/src/main-agent/actions/quality-gate.js -> packages/bmad-speckit/dist/main-agent/actions/quality-gate.js
- scripts/main-agent-delivery-truth-gate.ts -> packages/bmad-speckit/src/main-agent/actions/delivery-truth-gate.js -> packages/bmad-speckit/dist/main-agent/actions/delivery-truth-gate.js

## Runtime Emit CJS

- scripts/run-auditor-host.ts -> packages/bmad-speckit/src/main-agent/auditor-host/run-auditor-host.cjs -> packages/bmad-speckit/dist/main-agent/auditor-host/run-auditor-host.cjs

## Consumer-Installed Helper

- scripts/write-runtime-context.cjs -> packages/bmad-speckit/src/main-agent/helpers/write-runtime-context.cjs -> packages/bmad-speckit/dist/main-agent/helpers/write-runtime-context.cjs

## Public CLI De-Surface

- scripts/eval-questions-cli.ts -> bmad-speckit eval-questions deprecated compatibility alias
- scripts/main-agent-bmad-help-five-layer-matrix.ts -> bmad-speckit main-agent:bmad-help-five-layer-matrix deprecated compatibility alias
- scripts/main-agent-host-matrix-pr-orchestrator.ts -> bmad-speckit main-agent:host-matrix-pr-orchestrate deprecated compatibility alias
- scripts/bmads-auto-cli.ts -> bmad-speckit bmads-auto deprecated compatibility alias

## Evidence

- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/evidence.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/install-matrix/save-dev.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/install-matrix/npx-package.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/install-matrix/no-save.json

## Old Path Disposition

No root script deletion was performed or approved in Wave 3.1.

All nine original root scripts remain retained_source_dev_only:

- scripts/main-agent-release-gate.ts
- scripts/main-agent-quality-gate.ts
- scripts/main-agent-delivery-truth-gate.ts
- scripts/run-auditor-host.ts
- scripts/write-runtime-context.cjs
- scripts/eval-questions-cli.ts
- scripts/main-agent-bmad-help-five-layer-matrix.ts
- scripts/main-agent-host-matrix-pr-orchestrator.ts
- scripts/bmads-auto-cli.ts

## Residual Risks

- P1 through P5 runtime closure entries are explicitly out of scope for Wave 3.1.
- Root scripts are retained for source-repository maintenance and are not deletion-approved.
- Deprecated compatibility aliases remain public but no longer execute root scripts.
