# Main Agent Runtime Migration Wave 3.13

## Purpose

Wave 3.13 is a narrow closeout for the two Wave 3.10 renderer records that were already caller-switched but still had `validationStatus: partial`. It also records a kbase fresh consumer install matrix as durable repo evidence for the covered package runtime and public CLI probes.

This wave does not migrate additional root scripts. It records direct package CLI evidence for the package-local renderer surfaces:

- `scripts/bmad-help-renderer.ts` -> `bmad-speckit bmad-help`
- `scripts/bmads-renderer.ts` -> `bmad-speckit bmads` and `bmad-speckit bmad-speckit`

## Narrow Claims

- The single package CLI entry dispatches `bmad-help`, `bmads`, and the `bmad-speckit` alias to package-local runtime renderer modules.
- The renderer entry-surface contract passes and asserts no dispatch to `scripts/bmad-help-renderer.ts` or `scripts/bmads-renderer.ts`.
- The two renderer registry entries are now `migrationStatus: validated` and `validationStatus: passed`.
- The kbase fresh consumer install matrix passed for `save-dev`, `no-save`, and `npx --package` install modes for the covered package runtime probes.

## Non-Claims

- Root scripts are not deletion-ready.
- This wave does not claim every root `scripts/**` file is directly executable from a consumer project.
- This wave does not introduce a consumer runtime dependency on `repo-governance`.

## Evidence

Primary evidence is recorded in:

- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.13/evidence.json`
- `repo-governance/script-migrations/main-agent-runtime-migration-wave-3.13/kbase-install-matrix.json`

Commands captured in evidence:

- `node --test packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js`
- `node packages/bmad-speckit/bin/bmad-speckit.js bmad-help --cwd . --budget route`
- `node packages/bmad-speckit/bin/bmad-speckit.js bmads --cwd . --budget route`
- `node packages/bmad-speckit/bin/bmad-speckit.js bmad-speckit --cwd . --budget route`
- kbase matrix runner: `node .tmp/bmad-speckit-install-matrix-20260607-045932/run-matrix.cjs`

## Kbase Install Matrix Closeout

The kbase matrix used a freshly packed `bmad-speckit-sdd-flow-2.0.1.tgz` and ran in isolated consumer sandboxes under `D:/Dev/kbase-content-engine/.tmp/bmad-speckit-install-matrix-20260607-045932`.

Results:

- `npm install --save-dev file:<fresh-tgz>`: 10/10 passed
- `npm install --no-save file:<fresh-tgz>` followed by `npx --no-install`: 10/10 passed
- `npx --package file:<fresh-tgz> bmad-speckit ...`: 7/7 passed

Runtime probes covered package resolution, `bmad-speckit --version`, `bmad-help --json --budget compact`, `bmads --json --budget compact`, `main-agent inspect`, `main-agent quality-gate`, `architecture-drift-check --json`, and `eval-question-generate`.

Important bounds:

- `bmad-help --json --budget compact` emitted valid JSON under 128MB and omitted `rawRecord` by default.
- The selected runtime entry files did not invoke `tsx`, `ts-node`, or `scripts/*.ts`.
- `architecture-drift-check --json` reported `usedRootScript=false`, `usedTsx=false`, `usedTsNode=false`, and `usedCompiledFallback=false`.

## Root Path Disposition

The original renderer root paths remain `source_history_only`. Deletion remains disallowed.
