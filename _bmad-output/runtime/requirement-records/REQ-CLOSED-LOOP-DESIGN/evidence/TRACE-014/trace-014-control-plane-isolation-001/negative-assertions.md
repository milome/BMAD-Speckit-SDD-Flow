# TRACE-014 Negative Assertions

- Root `dashboard`, `score`, `report` and `result` fields block control-plane isolation.
- `artifact_ref` / read model / projection source refs cannot be used as gate or contract authority.
- A closeout attempt cannot pass while orphan artifacts are present without orphan blocking reasons.
- `rerunLoops[]` cannot carry deprecated `result` or `decision` fields.
- The isolation checker itself is read-only and cannot mutate `requirement-record.json`.
