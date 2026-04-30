# PR Topology Contract

Every parallel mission batch emits a PR topology DAG.
The canonical implementation is `scripts/parallel-mission-control.ts`.

Required fields:

- `version`
- `batch_id`
- `required_nodes[]`
- `required_nodes[].node_id`
- `required_nodes[].target_pr`
- `required_nodes[].depends_on[]`
- `required_nodes[].state`
- `all_affected_stories_passed`

Release gate rule:

`all_affected_stories_passed` may be `true` only when every required node state is `merged` or `closed_not_needed`.
