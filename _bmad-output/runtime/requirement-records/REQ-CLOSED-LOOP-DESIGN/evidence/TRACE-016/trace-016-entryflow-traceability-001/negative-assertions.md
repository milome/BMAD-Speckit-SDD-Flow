# TRACE-016 Negative Assertions

- `speckit_story`, `speckit_tasks`, `speckit_implement`, and `bmad-story-assistant` are rejected as top-level `entryFlow` values.
- `contractAuthoringRequired` must be `true`; false or missing values are rejected by controlled ingest and schema validation.
- `story`, `bugfix`, and `standalone_tasks` must bind to their expected entryFlowClass values.
- `standalone_tasks` cannot add a dedicated runtime control fact artifact under a standalone task path.
- The checker is read-only and writes only a projection/report artifact; state changes happen through controlled ingest.
