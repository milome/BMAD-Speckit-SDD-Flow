# SFT Production-Like Pilot Report

## Scope

This report records the first production-like `preview -> validate -> bundle` run executed after the Batch E training-gate changes.

The pilot used the repository's current `packages/scoring/data` dataset as the input surface and wrote outputs under:

- [batch-f-pilot](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot)

## Commands

Run:

```bash
node packages/bmad-speckit/bin/bmad-speckit.js sft-preview --target openai_chat
node packages/bmad-speckit/bin/bmad-speckit.js sft-validate --target openai_chat
node packages/bmad-speckit/bin/bmad-speckit.js sft-bundle --target openai_chat --bundle-dir outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot
```

Artifacts:

- [preview-openai_chat.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot/preview-openai_chat.json)
- [validate-openai_chat.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot/validate-openai_chat.json)
- [bundle-openai_chat.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot/bundle-openai_chat.json)
- [manifest.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot/openai_chat-4bd5082ec65e/manifest.json)
- [validation-report.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot/openai_chat-4bd5082ec65e/validation-report.json)
- [validation-report.md](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot/openai_chat-4bd5082ec65e/validation-report.md)
- [rejection-report.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-pilot/openai_chat-4bd5082ec65e/rejection-report.json)

## Result

Status: `needs_work`

Bundle id: `openai_chat-4bd5082ec65e`

Summary:

- total candidates: `65`
- accepted: `25`
- rejected: `40`
- downgraded: `0`
- blocked: `0`
- train split rows: `21`
- validation split rows: `1`
- test split rows: `3`

Validation:

- `schema_valid = true`
- `privacy_gate_passed = true`
- `trace_quality_passed = false`
- `provider_compatibility_passed = true`
- `training_ready_passed = false`

Threshold failures:

- `accepted_ratio_below_threshold`
- `training_ready_ratio_below_threshold`
- `host_kind_coverage_below_threshold`

## Interpretation

This pilot proves that the training-ready bundle chain can run end-to-end on a non-trivial dataset and produce stable artifacts, but it is not yet signoff-ready for production training use.

What worked:

- canonical sample extraction succeeded
- validation report was generated with threshold-level output
- bundle manifest and report artifacts were produced under a stable bundle id

What is still missing:

- host provenance coverage is currently `0`
- provider fact coverage is currently `0`
- accepted ratio is `0.3846`, below the current threshold of `0.5`
- trace quality still fails for the current repo dataset

## Consumer Impact

If a consumer project used a dataset with the same quality profile today:

- it could generate a bundle
- it could archive validation and rejection reports
- it could not honestly claim the dataset is training-ready

This is exactly the intended behavior after Batch E:

- structure-valid data can still fail training-grade validation
- the failure reasons are now machine-readable and reportable

## Follow-up

The next actions are:

1. complete Batch G de-placeholderization so host/provider coverage is no longer zero
2. improve source dataset quality so accepted and training-ready ratios exceed threshold
3. rerun this pilot and compare the new validation report against this baseline

---

## Fresh Data Re-Run

After the new provenance write path was added to `parseAndWriteScore`, a fresh dataset was generated under:

- [batch-f-fresh-data](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-fresh-data)

Commands:

```bash
npx ts-node --project tsconfig.node.json scripts/parse-and-write-score.ts --reportPath <fresh-report> --stage implement --runId fresh-run-001 --scenario real_dev --writeMode single_file --dataPath <fresh-dataPath> --artifactDocPath <fresh-doc> --host claude --hostKind claude --providerId dashscope-coding-kimi --providerMode openai-compatible --toolTraceRef <sha256> --toolTracePath <tool-trace-path> --skipTriggerCheck true
node packages/bmad-speckit/bin/bmad-speckit.js sft-preview --dataPath <fresh-dataPath> --target openai_chat
node packages/bmad-speckit/bin/bmad-speckit.js sft-validate --dataPath <fresh-dataPath> --target openai_chat
node packages/bmad-speckit/bin/bmad-speckit.js sft-bundle --dataPath <fresh-dataPath> --target openai_chat --bundle-dir <fresh-bundle-root>
```

Fresh outputs:

- [preview-openai_chat.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-fresh-data/preview-openai_chat.json)
- [validate-openai_chat.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-fresh-data/validate-openai_chat.json)
- [bundle-openai_chat.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-fresh-data/bundle-openai_chat.json)
- [manifest.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-fresh-data/_bmad-output/datasets/openai_chat-b0cf3bfc0ac5/manifest.json)
- [validation-report.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-fresh-data/_bmad-output/datasets/openai_chat-b0cf3bfc0ac5/validation-report.json)

Fresh result:

- total candidates: `1`
- accepted: `1`
- rejected: `0`
- `trace_quality_passed = true`
- `training_ready_passed = true`
- `host_kind_coverage = 1`
- `provider_fact_coverage = 1`

Interpretation:

- the earlier failure was primarily a legacy data-quality / legacy provenance problem
- the new data path can now produce a training-ready sample with complete host/provider/tool-trace provenance
- this does **not** erase the historical dataset problem; it proves the new generation path is materially healthier than the old repository data

## Future Target Contract

Batch H requires that future target support does not fork the canonical data chain.

The formal extension contract now lives at:

- [2026-04-09-sft-future-target-extension-contract.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/design/2026-04-09-sft-future-target-extension-contract.md)

The short version is:

- future targets extend exporter / compatibility decisions, not the canonical sample core
- readiness views (`assistant_only_ready`, `completion_only_ready`, `tool_calling_ready`) are facts for extension planning, not proof that a new target is already productized
- any new target must preserve existing `openai_chat` / `hf_conversational` / `hf_tool_calling` behavior and test coverage
