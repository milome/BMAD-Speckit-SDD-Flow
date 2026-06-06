# main-agent-runtime-migration-wave-3.12 Runtime Migration Evidence Summary

## Scope

- Universe command: `rg --files scripts`.
- Physical scripts total: 240.
- Registry coverage before this wave: 111 registered, 129 unregistered.
- Current registry coverage after this wave: 240 registered, 0 unregistered.
- Execution contract: `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md`.
- Audit contract retained for provenance: `docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md`.
- Evidence packet: `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/evidence.json`.

## New Registration Counts

```json
{
  "total": 129,
  "byCategory": {
    "consumer_runtime_reachable": 28,
    "package_runtime_helper": 65,
    "package_runtime_helper_existing_package_alias": 9,
    "public_cli": 9,
    "public_cli_package_bin_compatibility_alias": 1,
    "repo_internal_ci_release_or_source_fixture": 4,
    "repo_internal_pack_fixture_extractor": 1,
    "repo_internal_scripts_documentation": 1,
    "repo_internal_test_harness": 5,
    "repo_internal_test_seed_only": 1,
    "repo_internal_type_declaration": 1,
    "repo_source_generation_i18n_bilingual_tooling": 4
  },
  "byStrategy": {
    "compatibility_alias": 10,
    "durable_helper_copy": 65,
    "package_runtime_module": 28,
    "public_cli_de_surface": 9,
    "repo_internal_reclassify": 17
  },
  "byMigrationStatus": {
    "validated": 129
  },
  "byValidationStatus": {
    "passed": 129
  }
}
```

## Consumer-Reachable Migration Queue

Count: 102

- Status: `validated/passed`.
- Scope: ledger-covered consumer runtime reachable, public CLI, and package runtime helper records validated through package runtime modules, public CLI surfaces, or durable helper copies.
- Important: this does not claim the original root `scripts/**` files are direct consumer execution surfaces. Root scripts remain retained source-repository files with `deletionAllowed=false`.

- scripts/analytics-cluster.ts
- scripts/analytics-prompt-optimize.ts
- scripts/analytics-rule-suggest.ts
- scripts/analytics-sft-extract.ts
- scripts/architecture-confirmation-hash-recipe.ts
- scripts/architecture-drift-check.ts
- scripts/assert-implementation-entry.ts
- scripts/bmad-config.ts
- scripts/bmad-help-five-layer-progress-marker.ts
- scripts/bmad-help-routing-state.ts
- scripts/bmad-state.ts
- scripts/bmad-sync-from-v6.ps1
- scripts/bmad-sync-from-v6.sh
- scripts/check-sprint-ready.ps1
- scripts/check-sprint-ready.sh
- scripts/cleanup-packed-bmad.js
- scripts/coach-diagnose.ts
- scripts/continue-state-contract.ts
- scripts/control-event-log-rebaseline.ts
- scripts/controlled-ingest-atomic-committer.ts
- scripts/dashboard-generate.ts
- scripts/dashboard-projection-mapping.ts
- scripts/deferred-gap-governance.cjs
- scripts/emit-runtime-policy.ts
- scripts/ensure-runtime-dashboard-server.cjs
- scripts/evidence-provenance.ts
- scripts/execution-discipline-profiles.ts
- scripts/execution-intent-schema.ts
- scripts/execution-strategy-selection.ts
- scripts/facilitator-registry.ts
- scripts/facilitator-runtime-definition.ts
- scripts/generate-codex-agents-from-claude.js
- scripts/governance-execution-result-ingestor.ts
- scripts/governance-hook-types.ts
- scripts/governance-provider-adapter.ts
- scripts/governance-runtime-queue.ts
- scripts/governance-stage-event-emitter.ts
- scripts/governance-transport-envelope.ts
- scripts/i18n/agent-manifest.ts
- scripts/i18n/detect-language.ts
- scripts/i18n/field-meta-types.ts
- scripts/i18n/language-policy.ts
- scripts/i18n/materialize-facilitator-definition.ts
- scripts/i18n/placeholder-types.ts
- scripts/i18n/protected-token-check.ts
- scripts/i18n/render-field-view.ts
- scripts/i18n/render-template.ts
- scripts/i18n/resolve-for-session-cli.ts
- scripts/i18n/resolve-for-session.ts
- scripts/i18n/resolve-localized-markdown-path.ts
- scripts/i18n/sync-party-mode-mirrors.ts
- scripts/i18n/validate-template-manifest.ts
- scripts/ingest-architecture-confirmation.ts
- scripts/init-to-root.js
- scripts/live-smoke-speckit-workflow.ts
- scripts/long-run-runtime-policy.ts
- scripts/mcp/consumer/install-consumer-mcp.ps1
- scripts/mcp/consumer/install-consumer-mcp.sh
- scripts/mcp/consumer/verify-consumer-mcp.ps1
- scripts/mcp/consumer/verify-consumer-mcp.sh
- scripts/model-governance-hint-resolver.ts
- scripts/model-governance-hints-schema.ts
- scripts/monitor-push.sh
- scripts/parse-and-write-score.ts
- scripts/prepublish-check.js
- scripts/real-development-tick-worker.js
- scripts/requirement-record-event-reducer.ts
- scripts/reviewer-shared-core.ts
- scripts/run-confirmed-final-required-commands.js
- scripts/run-confirmed-trace-slice.js
- scripts/run-required-commands-from-ai-tdd-manifest.ts
- scripts/run-runtime-dashboard-forever.cjs
- scripts/runtime-context-registry.ts
- scripts/runtime-context.ts
- scripts/runtime-dashboard-server-state.cjs
- scripts/runtime-governance-registry.ts
- scripts/runtime-governance-template-schema.ts
- scripts/runtime-governance.ts
- scripts/scores-summary.ts
- scripts/sdd-artifact-manifest.ts
- scripts/setup.ps1
- scripts/setup.sh
- scripts/sft-extract.ts
- scripts/skill-semantic-features-config.ts
- scripts/speckit-cli.ts
- scripts/sprint-status-authorized-update.ts
- scripts/stable-runtime-policy-json.ts
- scripts/start-dashboard.ts
- scripts/start-runtime-dashboard-server.cjs
- scripts/strict-command-resolution-preflight.ts
- scripts/subagent-current-attempt-revalidation.ts
- scripts/subagent-surface-inventory.ts
- scripts/trace-closure-matrix.ts
- scripts/update-specify-passed.ts
- scripts/user-story-mapping.ts
- scripts/validate-consumer-governance.ps1
- scripts/validate-single-source-whitelist.ts
- scripts/verify-hooks-no-ts-node.js
- scripts/verify-story-mode.ts
- scripts/write-runtime-policy-snapshot-and-recovery-context.cjs
- scripts/write-runtime-policy-snapshot-and-recovery-context.ts
- scripts/write-runtime-registry.js

## Validated Non-Migration Records

Count: 27

- Status: `validated/passed`.
- Scope: evidence-backed records that do not enter the remaining migration queue for this wave.
- Important: the Ralph entries below are not repo-internal; they are root source-repo aliases for the already packaged `@bmad-speckit/ralph-method` runtime used by the package CLI.

### Package Runtime Helper Aliases

Count: 9

- scripts/ralph-method/pathing.ts
- scripts/ralph-method/progress-format.ts
- scripts/ralph-method/schema.ts
- scripts/ralph-method/speckit-implement.ts
- scripts/ralph-method/types.ts
- scripts/ralph-method/verify-pass-consistency.ts
- scripts/ralph-method/verify-ralph-compliance.ts
- scripts/ralph-method/verify-tdd-trace.ts
- scripts/ralph-method/write-tracking-files.ts

### Public CLI Package Bin Compatibility Alias

Count: 1

- Important: this entry is not repo-internal; it is the root package bin compatibility alias that forwards to the package CLI.

- scripts/bmad-speckit-cli.js

### Source Generation / Bilingual Skill Maintenance Tooling

Count: 4

- Scope: source-repository tooling for bilingual Skill file generation, translation, and audit maintenance.
- Important: these entries are not the consumer runtime bilingual path; runtime language support remains covered by the i18n package runtime helper queue and install-surface/runtime-emit closure.

- scripts/i18n/bootstrap-skill-bilingual-files.mjs
- scripts/i18n/han-outside-fences.mjs
- scripts/i18n/phase3-skill-en-transform.mjs
- scripts/i18n/phase3_translate_skill_en.py

### Evidence-Backed Repo Internal / Fixture / Documentation / Test Harness

Count: 13

- scripts/README.md
- scripts/compare-bmad-help-upstream.js
- scripts/create-test-story.ts
- scripts/deferred-gap-governance.d.cts
- scripts/ensure-governance-user-story-mapping-fixture.js
- scripts/extract-npm-pack-json.js
- scripts/normalize-pack-manifests.js
- scripts/render-upstream-bmad-help-baseline.js
- scripts/run-fresh-regression-matrix.ts
- scripts/test-locks.ts
- scripts/test-story-flow.ts
- scripts/verify-skill-architecture.sh
- scripts/verify-speckit-mirror-sync.js

## Residual Risk

- This wave closes registry visibility for physical scripts and validates the 102 ledger-covered package/runtime/CLI migration records.
- It does not claim every original root `scripts/**` file is directly executable by consumers; package/runtime/CLI targets are the validated consumption surfaces.
- `scripts/` is still included by the root package `files` list, so root package publication is tracked as a risk signal, not a migration-complete proof.
