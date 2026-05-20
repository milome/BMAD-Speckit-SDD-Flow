TRACE-038 implementation delta

- Added the skill-local architecture confirmation artifact producer:
  `_bmad/skills/requirements-contract-authoring/scripts/generate-architecture-confirmation-artifact.ts`.
- Added the skill-local user-facing architecture confirmation prepare entry:
  `_bmad/skills/requirements-contract-authoring/scripts/prepare-architecture-confirmation-page.ts`.
- Added the skill-local architecture confirmation HTML renderer:
  `_bmad/skills/requirements-contract-authoring/scripts/render-architecture-confirmation-html.ts`.
- Updated `requirements-contract-authoring` skill documentation and renderer spec so architecture confirmation page preparation is a skill-owned workflow, not a temporary command sequence.
- Added acceptance coverage for producer hash recipe consistency, automatic stale check, fail-closed missing input behavior, read-only renderer behavior, architecture ingest integration, and no hardcoded source document assumptions.
- Generated and confirmed the current requirement-scoped architecture confirmation artifact for `REQ-CLOSED-LOOP-DESIGN`, then recorded it through controlled architecture confirmation ingest.
