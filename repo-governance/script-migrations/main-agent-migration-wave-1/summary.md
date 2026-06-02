# Script Migration Summary: main-agent-migration-wave-1

## Migrated

- `scripts/main-agent-orchestration.ts` consumer-facing CLI entry was migrated to package-local runtime facade files under `packages/bmad-speckit/src/main-agent/`.
- Legacy public commands `main-agent-orchestration`, `confirm-scope`, and `main-agent:confirm-scope` now call `packages/bmad-speckit/src/main-agent/index.js` instead of root TypeScript dispatch.
- Stable grouped commands are exposed as `bmad-speckit main-agent inspect`, `bmad-speckit main-agent confirm-scope`, `bmad-speckit main-agent dispatch-plan`, and `bmad-speckit main-agent run-loop`.

## Strategy

`package_runtime_module`

## Evidence

- `repo-governance/script-migrations/main-agent-migration-wave-1/evidence.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/save-dev-bmads.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/save-dev-bmad-help.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/save-dev-main-agent-inspect.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/npx-package-bmads.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/npx-package-bmad-help.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/npx-package-main-agent-inspect.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/tgz-bmads.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/tgz-bmad-help.json`
- `.tmp/main-agent-migration-wave-1/install-matrix/tgz-main-agent-inspect.json`

## CMD-11 Test Migration Classification

`CMD-11` produced 104 hits. Classification is by file; every hit in a listed file inherits that file classification unless the note states that the file is a mixed guard. No hit is deletion-ready.

### Consumer Runtime

- `packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js`: package CLI renderer surface guard; `runRepoScript` references are negative assertions for consumer package runtime.
- `packages/bmad-speckit/tests/main-agent-no-root-ts-dispatch.test.js`: package Main Agent dispatch guard; root script existence check is a source-dev retention guard, not a consumer runtime dependency.
- `packages/bmad-speckit/tests/main-agent-runtime-facade.test.js`: package Main Agent runtime facade and legacy alias compatibility test.
- `tests/acceptance/bmad-help-renderer.test.ts`: acceptance guard for package-level `confirm-scope` and Main Agent alias routing through package runtime.
- `tests/acceptance/main-agent-codex-consumer-five-layer-e2e.test.ts`: consumer-facing package CLI compatibility path for legacy `main-agent-orchestration` commands.

### Install Matrix

- `tests/acceptance/accept-install-consumer-cli.test.ts`: save-dev, `npx --package`, and `.tgz` consumer install evidence writer.

### Source Dev Only

- `tests/acceptance/confirmation-projection-hash-policy.test.ts`: direct source import of root orchestration helpers.
- `tests/acceptance/main-agent-audit-review-dispatch-profile.test.ts`: direct source import of root orchestration helpers.
- `tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts`: direct source import and source materialization fixture for root orchestration.
- `tests/acceptance/main-agent-child-result-e2e.test.ts`: source-repo Main Agent e2e coverage.
- `tests/acceptance/main-agent-churn-routing-score.test.ts`: source-repo route scoring and `ts-node` source command fixture coverage.
- `tests/acceptance/main-agent-closeout-e2e.test.ts`: source-repo Main Agent e2e coverage.
- `tests/acceptance/main-agent-codex-worker-adapter-e2e.test.ts`: source-repo Main Agent worker adapter coverage.
- `tests/acceptance/main-agent-drift-surface-e2e.test.ts`: source-repo Main Agent e2e coverage.
- `tests/acceptance/main-agent-e2e-bugfix.test.ts`: source-repo Main Agent e2e coverage.
- `tests/acceptance/main-agent-e2e-standalone.test.ts`: source-repo Main Agent e2e coverage.
- `tests/acceptance/main-agent-e2e-story.test.ts`: source-repo Main Agent e2e coverage.
- `tests/acceptance/main-agent-gates-loop-e2e.test.ts`: source-repo Main Agent e2e coverage.
- `tests/acceptance/main-agent-host-parity-e2e.test.ts`: source-repo Main Agent e2e coverage.
- `tests/acceptance/main-agent-orchestration-consumer.test.ts`: source-repo orchestration behavior and governance-chain coverage retained outside package runtime tests.
- `tests/acceptance/main-agent-packet-lifecycle-e2e.test.ts`: source-repo Main Agent packet lifecycle coverage.
- `tests/acceptance/main-agent-post-close-defect-intake.test.ts`: source-repo Main Agent defect intake coverage.
- `tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts`: source-repo Main Agent drilldown and authoring repair coverage.
- `tests/acceptance/main-agent-readiness-auto-remediation.test.ts`: source-repo Main Agent readiness remediation coverage.
- `tests/acceptance/main-agent-reconfirmation-runtime.test.ts`: source-repo Main Agent reconfirmation runtime coverage.
- `tests/acceptance/main-agent-run-loop-e2e.test.ts`: source-repo Main Agent run-loop regression coverage.
- `tests/acceptance/main-agent-source-materialization-before-audit.test.ts`: source-repo materialization-before-audit coverage.
- `tests/acceptance/main-agent-state-idempotency.test.ts`: source-repo Main Agent state idempotency coverage.
- `tests/acceptance/main-agent-state-matrix-authority.test.ts`: source-repo Main Agent state matrix coverage.
- `tests/acceptance/main-agent-unified-ingress-e2e.test.ts`: source-repo unified ingress regression coverage.
- `tests/acceptance/requirements-confirmation-ingest.test.ts`: source-repo confirmation ingest helper coverage.
- `tests/acceptance/resolve-active-requirement.test.ts`: source-repo active requirement helper coverage.
- `tests/acceptance/six-mental-model-decision-matrix.test.ts`: source-repo six-model decision matrix coverage.

### Internal Governance

- `tests/acceptance/accept-bmad-protocols.test.ts`: protocol surface text governance.
- `tests/acceptance/accept-extensions.test.ts`: extension surface text governance.
- `tests/acceptance/architecture-confirmation-ingest.test.ts`: governance fixture target-path assertion.
- `tests/acceptance/auxiliary-skill-main-agent-orchestration-contract.test.ts`: skill routing contract governance.
- `tests/acceptance/bmad-auto-deprecation-guard.test.ts`: deprecated skill and command surface governance.
- `tests/acceptance/consumer-governance-validation-skill.test.ts`: skill reference governance.
- `tests/acceptance/cursor-ralph-audit-continuation-contract.test.ts`: Cursor/Ralph continuation surface governance.
- `tests/acceptance/helper-skill-variant-main-agent-contract.test.ts`: helper skill routing contract governance.
- `tests/acceptance/how-to-main-agent-cleanup.test.ts`: documentation cleanup governance.
- `tests/acceptance/main-agent-doc-cleanup.test.ts`: documentation cleanup governance.
- `tests/acceptance/main-agent-doc-surfaces.test.ts`: documentation and skill surface governance.
- `tests/acceptance/ralph-method-uninterrupted-execution-contract.test.ts`: Ralph method surface governance.
- `tests/acceptance/render-requirements-confirmation-html.test.ts`: rendered requirements HTML fixture governance.
- `tests/acceptance/requirements-contract-authoring-skill-contract.test.ts`: skill contract governance.
- `tests/acceptance/reverse-audit-contract.test.ts`: reverse audit rendered fixture governance.
- `tests/acceptance/script-migration-registry-contract.test.ts`: script migration registry governance.
- `tests/acceptance/speckit-workflow-live-smoke-contract.test.ts`: workflow smoke surface governance.
- `tests/acceptance/speckit-workflow-main-agent-orchestration-contract.test.ts`: workflow orchestration routing governance.

## Old Path Disposition

`scripts/main-agent-orchestration.ts` is retained as `retained_source_dev_only`. Deletion is not approved.

## Residual Risks

- Other `main-agent:*` diagnostic or governance commands still call root scripts and remain outside wave 1 unless separately classified and migrated.
- Source-dev tests may continue to cover root TypeScript orchestration, but consumer runtime evidence for this wave is tied to package CLI commands and install-matrix receipts.
