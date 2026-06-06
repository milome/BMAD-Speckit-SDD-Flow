# Script Migration Summary: main-agent-source-authority-wave-2

## Migrated

- `scripts/main-agent-orchestration.ts` consumer-facing covered actions now use package source authority under `packages/bmad-speckit/src/main-agent/`.
- Covered actions are `inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop`.
- Consumer CLI dispatch for covered commands now uses `packages/bmad-speckit/dist/main-agent/index.js`.

## Strategy

`package_runtime_module`

## Evidence

- `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json`
- `.tmp/main-agent-source-authority-wave-2/install-matrix/save-dev-main-agent-inspect.json`
- `.tmp/main-agent-source-authority-wave-2/install-matrix/npx-package-main-agent-inspect.json`
- `.tmp/main-agent-source-authority-wave-2/install-matrix/tgz-main-agent-inspect.json`

## Old Path Disposition

`scripts/main-agent-orchestration.ts` is retained as `retained_source_dev_only`.

No root `scripts/*` deletion is approved.

## Residual Risks

- Unmigrated Main Agent diagnostic and governance actions may still rely on source-repository paths and remain outside Wave 2.
- `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` remains only as a bounded compatibility fallback for legacy actions not covered by this wave.
- `.tmp/main-agent-source-authority-wave-2/install-matrix/` evidence is generated validation output and is not a consumer runtime dependency.
