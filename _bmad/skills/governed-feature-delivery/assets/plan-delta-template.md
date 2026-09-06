# Plan Delta <delta-id>

## Trigger

- Active phase: `<phase-id>`
- Blocking fact: `<why approved scope is insufficient>`
- Checkpoint before delta: `<path>` / `<sha256>`

## Requested Change

- Outcome: `active_phase_prerequisite | design_revision_required | future_phase_only`
- Add scope: `<exact paths/contracts/schema/dependencies>`
- Remove scope: `<exact items or none>`
- Protected surfaces unchanged: `<list>`

## Phase And PR Disposition

- Current PR remains limited to: `<active phase>`
- Deferred later-phase work: `<explicit list>`
- Design spec impact: `none | revision required`

## Validation Delta

- Add or change: `<tests/gates/evidence inputs>`
- Existing reusable evidence: `<ids and currentness basis>`

## Authorization

- Decision: `pending | approved | rejected`
- Authority: `<user/owner>`
- Exact authorized scope: `<quote or structured decision>`
- Decided at: `<ISO-8601>`

## Machine Receipt

For `active_phase_prerequisite` only, create a JSON delta with exactly `id`, `decision`, `beforeScopeHash`,
`afterScopeHash`, `phasePlanHash`, `authority`, and `decidedAt`. Apply it with
`scripts/apply-scope-delta.mjs`; do not edit a checkpoint in place.
