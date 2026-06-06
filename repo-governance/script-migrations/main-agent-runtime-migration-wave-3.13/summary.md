# Main Agent Runtime Migration Wave 3.13

## Purpose

Wave 3.13 is a narrow closeout for the two Wave 3.10 renderer records that were already caller-switched but still had `validationStatus: partial`.

This wave does not migrate additional root scripts. It records direct package CLI evidence for the package-local renderer surfaces:

- `scripts/bmad-help-renderer.ts` -> `bmad-speckit bmad-help`
- `scripts/bmads-renderer.ts` -> `bmad-speckit bmads` and `bmad-speckit bmad-speckit`

## Narrow Claims

- The single package CLI entry dispatches `bmad-help`, `bmads`, and the `bmad-speckit` alias to package-local runtime renderer modules.
- The renderer entry-surface contract passes and asserts no dispatch to `scripts/bmad-help-renderer.ts` or `scripts/bmads-renderer.ts`.
- The two renderer registry entries are now `migrationStatus: validated` and `validationStatus: passed`.

## Non-Claims

- Root scripts are not deletion-ready.
- This wave does not claim every root `scripts/**` file is directly executable from a consumer project.
- This wave does not introduce a consumer runtime dependency on `repo-governance`.

## Evidence

Primary evidence is recorded in:

- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.13/evidence.json`

Commands captured in evidence:

- `node --test packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js`
- `node packages/bmad-speckit/bin/bmad-speckit.js bmad-help --cwd . --budget route`
- `node packages/bmad-speckit/bin/bmad-speckit.js bmads --cwd . --budget route`
- `node packages/bmad-speckit/bin/bmad-speckit.js bmad-speckit --cwd . --budget route`

## Root Path Disposition

The original renderer root paths remain `source_history_only`. Deletion remains disallowed.
