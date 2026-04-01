# Speckit Workflow Assets

`_bmad/speckit` is the Speckit workflow asset **single source of truth** in this repository.

## What Is Canonical Here

These directories are authored here first and then projected elsewhere:

- `commands/`
- `templates/`
- `workflows/`
- `scripts/`

If a Speckit workflow command, template, workflow, or gate script changes, the source edit belongs here.

## Mirrors And Projections

- `.specify/` is a generated **runtime mirror** for upstream/spec-kit style compatibility.
- `.specify/` is not an authoring source. Do not hand-edit it and leave `_bmad/speckit` stale.
- When `_bmad/speckit` changes, the corresponding `.specify/` files must be re-synced.

## What Does Not Belong Here

The following may be Speckit-related, but they are not canonical workflow assets for this module:

- `packages/bmad-speckit/` - installer / packaging / sync implementation
- `scripts/` - repo-level setup, deploy, wrapper, and bridge entrypoints
- `docs/reference/speckit-*` - human-facing reference docs
- `specs/`, `_bmad-output/`, `outputs/` - generated or runtime artifacts

## Alignment Rules

- Edit `_bmad/speckit/*` first.
- Keep root user entrypoints as thin wrappers when a stable project-root path is needed.
- Treat drift between `_bmad/speckit` and `.specify` as a bug.
- If source and mirror disagree, `_bmad/speckit` wins and the mirror must be regenerated.
