# Partition Protocol

## Input Contract

The input must be a successor Goal Execution Contract with `contractMode: frozen` and `rewritePolicy: forbidden`. Its Source Plan and bound receipts must exist and match their recorded SHA-256 values.

Do not partition a merge/update plan, an unfrozen draft, or a predecessor contract when a successor is required.

## Immutable Sequence

```text
freeze parent authority
compile partition plan
generate pending child candidates
validate child compilation receipts
finalize partition manifest v2
emit final membership receipts
validate coverage and receipt reachability
activate standalone pointer or controlled RequirementRecord authority
```

The final v2 manifest contains child hashes. It cannot be finalized before pending children exist.

## Authority Placement

The intended governed runtime layout is:

```text
_bmad-output/runtime/goal-contract-partition-bootstrap/<sourceHash>/
  active-generation.json
  generations/<generationKey>/

_bmad-output/runtime/requirement-records/<requirementSetId>/goal-contract/
  active-partition-run.json
  partition-runs/<partitionRunId>/
```

Each immutable generation/run contains `partition-plan.json`, `partition-manifest.json`, `children/`, `receipts/`, `evidence/`, and `lifecycle/`.

Use this layout only after the ER-GH-004 resolver is implemented. The current raw `--out` command is diagnostic compatibility only.

## Required Rejections

Reject missing or stale parent hashes, raw output as governed authority, absolute or relative governed overrides, path escape, root overlap, cross-requirement writes, conflicting existing bytes, orphaned receipts, direct RequirementRecord writes, unauthorized controlled events, and any request to write legacy `contracts/`.
