# Parallel Mission Plan Contract

`ParallelMissionPlan` governs parallel execution batches and write-scope locking.
The canonical implementation is `scripts/parallel-mission-control.ts`.

Required fields:

- `batch_id`
- `nodes[]`
- `nodes[].node_id`
- `nodes[].story_key`
- `nodes[].packet_id`
- `nodes[].write_scope[]`
- `nodes[].protected_write_paths[]`
- `nodes[].depends_on[]`
- `nodes[].assigned_agent`
- `nodes[].target_branch`
- `nodes[].target_pr`
- `conflicts[]`
- `conflicts[].scope`
- `conflicts[].contenders[]`
- `conflicts[].resolution`
- `merge_order[]`
- `sprint_status_write_allowed=false`

Protected paths:

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad/_config/orchestration-governance.contract.yaml`
- `docs/reference/runtime-policy-index.md`
- `schemas/`
- `.github/workflows/`

Any write-scope overlap without an explicit dependency must be serialized. Any protected write path in a parallel node must be blocked.
