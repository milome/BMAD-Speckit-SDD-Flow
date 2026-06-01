# AI-TDD Runtime Navigator Workflow

This workflow is internal to `bmads` and `bmad-speckit`. It is not a public skill, command, or agent entry.

## Purpose

- Render the AI-TDD Six Mental Models panorama for the current RequirementRecord runtime state.
- Show the user's current location, blocking reason, and next safe action.
- Cross-reference `bmad-help` without replacing the BMAD upstream workflow catalog.

## Read-Only Inputs

- `_bmad/_config/ai-tdd-six-model-manifest.csv`
- `_bmad/_config/ai-tdd-six-model-action-matrix.csv`
- `_bmad/_config/ai-tdd-six-model-skill-routes.csv`
- `_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv`
- `_bmad-output/runtime/requirement-records/index.json`
- `_bmad-output/runtime/requirement-records/<recordId>/requirement-record.json`
- Current delivery closeout, render report, and acceptance-request artifacts when present.

## Hard Boundaries

- Never write RequirementRecord control state.
- Never treat CSV, parser, renderer, or workflow text as authority to advance a mental model.
- Never expose `record_closed` as a user-executable primary route.
- Only controlled ingest and main-agent orchestration may advance current runtime state.
- Precedence is safety first: awaiting user acceptance, open reconfirmation, stale hash, stale attempt, delivery blocker, and readiness blocker outrank explicit user selection.

## Output Shape

1. Status Summary
2. Recommended Next Steps
3. Active Requirement Records
4. Six Mental Model Panorama
5. Runtime Workflow Guidance
6. Command Hints
7. See also: bmad-help

## Display Budgets

- `compact`: show the primary safety route and minimal secondary details.
- `route`: show route, blocking reason, and next safe action.
- `expanded`: show all active records and projection rows relevant to the current route.
- `full`: show all projection references and diagnostics.

Display budgets may compress projection rows, skill detail, non-primary records, and cross-entry blocks. They must not compress the owning entry's primary output or hide the primary safety route.
