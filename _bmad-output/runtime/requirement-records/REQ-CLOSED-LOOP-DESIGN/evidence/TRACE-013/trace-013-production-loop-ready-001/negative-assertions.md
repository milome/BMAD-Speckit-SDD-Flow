# TRACE-013 Negative Assertions

- `onlySftFile` fixture proves SFT JSONL alone is insufficient and produces `dataset_release_report_missing` plus `dataset_manifest_missing`.
- Missing `extensionRefs` in the controlled RequirementRecord produces `observability_extension_ref_missing`.
- Incomplete observability/subsystem extension produces `observability_rollbackConditions_missing` and `subsystem_missing:prompt_packet_generation`.
- Passing path asserts the RequirementRecord remains unmutated by the checker; control writes must go through `scripts/ingest-implementation-evidence.ts`.
