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
- Do not mark any `scripts/*` entry `migrationStatus: validated` or `validationStatus: passed` unless a package source equivalent set exists under `packages/bmad-speckit/src/main-agent/**` and passes the package source parity gate.
- Report-only actions, descriptor-only helpers, shared dispatchers, dist output, repo-governance evidence, tests, and compiled fallback files are not package source equivalents.

## Target Architecture

- Source authority belongs under `packages/bmad-speckit/src/main-agent/**`.
- Consumer runtime output belongs under `packages/bmad-speckit/dist/main-agent/**`.
- Package CLI dispatch belongs to the installed package binary exposed as `bmad-speckit`; consumer projects should invoke it through `npx --no-install bmad-speckit ...` or an npm script.
- Covered consumer commands must require package-local `../dist/main-agent/index.js`.
- Root package shims may forward to the package CLI, but must not implement Main Agent behavior.
- Compiled fallback may remain only as a bounded compatibility path for unmigrated legacy actions.

## Package Source Parity Gate

This gate applies before any retained `scripts/*` registry entry is marked complete with `migrationStatus: validated` or `validationStatus: passed`.

Required package source equivalent:

- Each completed root script must map to one package source file or a cohesive package source file set under `packages/bmad-speckit/src/main-agent/**`.
- The equivalent set must be explicitly listed in registry `targetPaths` and evidence. It cannot be inferred from dist files, package bin files, index/router files, repo-governance evidence, tests, or shared runtime plumbing.
- Count only files that implement entry-specific behavior. Shared framework files may count only when the evidence names the entry-specific functions they contain.
- Any `.cjs` target is runtime output or compatibility material and cannot satisfy package source parity.
- A target backed only by `createPackageRuntimeReportAction`, `createDurableHelperDescriptor`, `compiled/main-agent-orchestration.cjs`, or any compiled fallback bridge is incomplete and must stay `partial` or `blocked`.

Size parity rule:

- Compare the original root script against the package source equivalent set using normalized UTF-8 source bytes and normalized non-empty, non-comment LOC.
- Normalization removes line-ending differences, blank lines, shebangs, license headers, and comments. Do not count dist output, generated evidence, tests, package CLI wrappers, or duplicated shared infrastructure.
- Default completion threshold: absolute normalized byte delta must be no greater than `max(10% of the original normalized bytes, 1024 bytes)`.
- Mechanical copy or `runtime_emit_cjs` threshold: use `max(1% of the original normalized bytes, 1024 bytes)` only for non-CJS package source equivalents because those migrations should be near byte-equivalent after normalization. Emitted `.cjs` files may be runtime artifacts, but they do not count as parity source.
- Do not use plain `1%` as the general rule; it is too brittle for TypeScript-to-JavaScript migration, package decomposition, and removal of root-only bootstrap code.
- Do not use plain `1KiB` as the general rule; it is too loose for small scripts and too strict for large scripts.
- If a deliberate decomposition exceeds the default threshold, the entry cannot be `validated/passed` unless the evidence includes a capability ledger and a size-delta exception explaining every removed or relocated behavior. Without that evidence, use `partial` or `blocked`.
- If the package equivalent set is less than 70% of the original normalized bytes, treat the entry as `blocked` unless the evidence proves the removed sections were generated, obsolete, dead, or root-only bootstrap code.

## Required Registry Work

- Add or update the wave in `repo-governance/script-migration-registry.yaml`.
- Use `script-migration-registry` as the migration record authority.
- Record original path, target source paths, target dist paths, caller switch status, validation status, evidence refs, old path disposition, and deletion approval state.
- For completed `scripts/*` entries, record the package source equivalent set in `targetPaths`; target paths that only point at dist, reports, descriptors, compiled fallback, tests, or repo-governance artifacts are insufficient.
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
- Write package source parity evidence for every completed root script: original normalized bytes/LOC, package equivalent paths, package normalized bytes/LOC, byte delta, percent delta, excluded paths with reasons, and the final `passed`, `partial`, or `blocked` decision.
- When a size-delta exception is used, write a capability ledger that maps original capabilities to package implementation paths and explicitly lists removed root-only or obsolete sections.

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
- Before using `validated` or `passed`, confirm each completed root script has package source equivalent paths and size parity evidence within the correct threshold.
- Run the final encoding gate after evidence, registry, summary, and skill files are written.
- Report changed files, command evidence, install-matrix evidence, package source parity numbers, root script disposition, and residual risks.
