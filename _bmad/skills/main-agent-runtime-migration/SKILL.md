---
name: "main-agent-runtime-migration"
description: "Migrate Main Agent consumer runtime from root scripts or compiled fallback into package source, dist runtime, CLI dispatch, registry evidence, package JS tests, and install-matrix proof."
---

# Main Agent Runtime Migration

Use this skill when migrating Main Agent consumer-visible commands away from root `scripts/*.ts`, `tsx`, `ts-node`, or compiled fallback dispatch and into `packages/bmad-speckit`.

## Non-Negotiable Guardrails

- root scripts/* deletion requires explicit per-script approval.
- Do not delete root `scripts/*` as part of runtime migration.
- Do not mark root scripts deletion-ready without classification, caller switching, tests, install-matrix evidence, proof that no internal chain still depends on the file, and explicit approval.
- Do not make `repo-governance/**` or this skill a consumer runtime dependency.
- Do not require consumer projects to install `tsx` or `ts-node`.

## Target Architecture

- Source authority belongs under `packages/bmad-speckit/src/main-agent/**`.
- Consumer runtime output belongs under `packages/bmad-speckit/dist/main-agent/**`.
- Package CLI dispatch belongs to the installed package binary exposed as `bmad-speckit`; consumer projects should invoke it through `npx --no-install bmad-speckit ...` or an npm script.
- Covered consumer commands must require package-local `../dist/main-agent/index.js`.
- Root package shims may forward to the package CLI, but must not implement Main Agent behavior.
- Compiled fallback may remain only as a bounded compatibility path for unmigrated legacy actions.

## Required Registry Work

- Add or update the wave in `repo-governance/script-migration-registry.yaml`.
- Use `script-migration-registry` as the migration record authority.
- Record original path, target source paths, target dist paths, caller switch status, validation status, evidence refs, old path disposition, and deletion approval state.
- If a new wave refines an older wave for the same original path, declare `refinesWaveId` and keep `deletionAllowed: false`.

## Test Requirements

- Package runtime tests belong in `packages/bmad-speckit/tests/*.test.js`.
- Package runtime tests must be plain JavaScript.
- Package runtime tests must not import root `scripts/*.ts`.
- Package runtime tests must not require `tsx` or `ts-node`.
- Acceptance tests belong in `tests/acceptance/*.test.ts` when they validate source-repo governance, CI, regression, or install matrix behavior.
- Consumer-visible CLI tests must call the package CLI, not root TypeScript orchestration scripts.

## Evidence Requirements

- Run package targeted tests for source authority, dist dispatch, and fallback boundary.
- Run the package dist build.
- Run a static dispatch guard that proves covered commands use `../dist/main-agent/index.js`.
- Run consumer install modes and write install-matrix evidence.
- Run full package tests.
- Run the registry validator and registry contract test.
- Write `repo-governance/script-migrations/<wave-id>/evidence.json` with command rows, exit codes, and `sha256:` hashes.
- Write `repo-governance/script-migrations/<wave-id>/summary.md` with old path disposition and residual risks.

## Install Matrix

The install-matrix must prove package runtime behavior from a consumer project that does not depend on a source repository checkout.

Required install modes:

- `npm install --save-dev <package-or-tgz>`
- `npx --package <package-or-tgz> bmad-speckit ...`
- `npm install --no-save <tgz>` followed by `npx --no-install bmad-speckit ...`

Each evidence record should prove:

- `usedRootScript: false`
- `usedTsx: false`
- `usedTsNode: false`
- `usedCompiledFallback: false` for covered actions

## Closeout

- Keep root scripts retained unless a separate approved cleanup contract exists.
- Update registry status only after evidence exists.
- Run the final encoding gate after evidence, registry, summary, and skill files are written.
- Report changed files, command evidence, install-matrix evidence, root script disposition, and residual risks.
