# TRACE-016 Implementation Delta Summary

## Scope

- Added canonical RequirementRecord entry fields: `entryFlow`, `entryFlowClass`, `workflowAdapter`, and `contractAuthoringRequired`.
- Updated confirmation ingest so new controlled confirmation records persist those fields directly from `implementationConfirmation`.
- Updated implementation evidence ingest so pre-existing records can receive an `entryFlowState` update only through controlled evidence validation.
- Added `main-agent-entryflow-traceability-check.ts` as a read-only entryFlow adaptation matrix and traceability gate.
- Added acceptance tests for legal entry flows, forbidden internal flows, standalone artifact boundaries, schema validation, confirmation ingest, implementation ingest, and active requirement resolution.

## Contract IDs Closed

- MUST-023
- NEG-011
- OUT-009
- EVD-001
- EVD-004
- EVD-023
- TRACE-016

## Behavior

The top-level product entry flows are restricted to `story`, `bugfix`, and `standalone_tasks`. Internal adapters such as `bmad-story-assistant`, `speckit_story`, `speckit_tasks`, and `speckit_implement` cannot be used as top-level entry flows. `standalone_tasks` cannot create a dedicated runtime control fact artifact and must use the canonical RequirementRecord plus artifactIndex evidence.
