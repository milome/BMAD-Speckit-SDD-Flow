# Script Migration Summary: main-agent-runtime-migration-wave-3.5

## Scope

Wave 3.5 is an installation-surface hardening wave for kbase-style consumer installs. It does not migrate, delete, move, rename, or mark deletion-ready any root `scripts/*` file.

## Result

- BMADS/package runtime main entrance remains callable through `npx --no-install bmad-speckit ...` after local project installation.
- Registry-declared source `scripts/*.ts` paths are treated as source provenance, not consumer-root executable paths.
- Consumer-runnable rows must use package CLI/runtime or a declared consumer-installed helper route.
- Skill-local CommonJS helpers are protected by local CommonJS package boundaries when retaining existing `.js` entrypoints.
- Platform skill frontmatter parity covers Codex, Claude, Cursor, `_bmad`, and package `_bmad` surfaces.

## Evidence

- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.5/registry-invocation-contract.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.5/skill-helper-hardening.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.5/skill-sync-parity.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.5/evidence.json

## Required Statements

- No root script deletion
- No consumer root scripts/*.ts dependency
- No user-global skill write
- npx --no-install bmad-speckit

## Residual Risks

- This wave proves installed-surface semantics and helper compatibility; it does not claim that every source repository script is directly callable from a consumer project.
- Source-only rows remain source-repository maintenance assets until a later migration wave proves they are consumer-runnable.
