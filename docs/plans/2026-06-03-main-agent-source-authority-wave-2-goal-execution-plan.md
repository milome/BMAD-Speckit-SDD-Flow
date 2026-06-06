# Goal Execution Contract

---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 2.0.0
goalContractProfileHash: sha256:b67ad6fb7f8c3ea903f03c5b51331fd530252ece0d9b629bf8c11ee93d5c4b70
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: conversation://2026-06-03-main-agent-source-authority-wave-2
sourcePlanHash: sha256:d3535412717ecf09d022b6c1394de57f10b0198e075de0cc2277bb5ab515142b
runtimeRecordId: none
entryFlow: main_agent_source_authority_wave_2
taskRange: G001-G012
acceptanceRange: ACC001-ACC036
completionGate: all_acceptance_items_and_required_commands_pass
repairPolicy: fix_package_source_authority_then_rerun_dist_registry_and_install_matrix
stopPolicy: stop_on_scope_expansion_root_script_deletion_or_consumer_runtime_source_dev_dependency
generatedBy: goal-execution-contract-generator
generatedAt: 2026-06-03T00:00:00+08:00
---

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Claude /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Cursor /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

```text
/goal docs/plans/2026-06-03-main-agent-source-authority-wave-2-goal-execution-plan.md
```

The full execution contract is this document, not the command text.

## Contract Freeze Rules

- `/goal` must not rewrite this contract.
- `/goal` must not replace this contract with a different task list, acceptance matrix, completion gate, or authority model.
- `/goal` must not convert this template into a JSON-generates-Markdown design.
- `/goal` must not convert a consumer compiler into a hardcoded local Markdown string that bypasses shared template slots.
- If this contract is incomplete, `/goal` must stop with `contract_amendment_required` and list the missing fields.
- If acceptance criteria are insufficient, `/goal` must stop with `contract_amendment_required`; it must not silently add stricter acceptance criteria while executing.
- If a task requires files outside its declared write scope, `/goal` must stop with `scope_amendment_required` unless this contract explicitly allows scope expansion.
- If a requirement semantic decision is missing, `/goal` must stop with `semantic_decision_required`.
- If a validation command is unavailable, ambiguous, and not produced by a declared earlier or current task in this contract, `/goal` must stop with `validation_contract_required`.

## Contract Completeness Gate

Before editing files, verify this contract has all required sections:

- `/goal Entry`
- `Contract Freeze Rules`
- `Contract Completeness Gate`
- `Non-Negotiable Execution Rules`
- `Authority Model`
- `Root Cause To Fix`
- `Domain-Specific Contract Addenda`
- `Implementation Tasks`
- `Strict Acceptance Checklist`
- `Acceptance Traceability Matrix`
- `Required Test Commands`
- `Manual Verification Scenarios`
- `Completion Evidence Packet`
- `Stop Conditions`

Before editing files, verify the frozen front matter has no unresolved placeholders and that every required slot was rendered.

Fail closed when any required section, field, task ID, acceptance ID, evidence command, matrix row, slot, or invariant fragment is missing.

## Non-Negotiable Execution Rules

- Use `pwsh.exe` for shell commands on Windows.
- Use `apply_patch` for manual code and documentation edits.
- Run `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` before and after Markdown, JSON, YAML, skill, command, generated-surface, or package-surface edits.
- Inspect `git status --short --branch` before editing and do not revert unrelated dirty worktree changes.
- Do not mark a task complete without fresh command output or direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Run the regression tests associated with every changed file and keep fresh passing evidence before claiming completion.
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, or audit prose alone.
- Do not weaken the declared machine-readable authority.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, tests, CLI code, or runtime modules.
- Do not delete `scripts/main-agent-orchestration.ts`.
- Do not delete any root `scripts/*` file.
- Do not classify any root `scripts/*` file as deletion-ready.
- Do not migrate all root `scripts/*` files in this wave.
- Do not rewrite all `packages/bmad-speckit` CLI commands in this wave.
- Do not treat the existence of `packages/bmad-speckit/dist/**` as completion proof.
- Do not require consumer projects to install `tsx` or `ts-node`.
- Do not let package tests import root `scripts/*.ts`.
- Do not make `_bmad/skills/main-agent-runtime-migration/SKILL.md` or `.codex/skills/main-agent-runtime-migration/SKILL.md` a consumer runtime dependency.

## Authority Model

- `conversation://2026-06-03-main-agent-source-authority-wave-2` is the human requirement source for this contract.
- `sourcePlanHash=sha256:d3535412717ecf09d022b6c1394de57f10b0198e075de0cc2277bb5ab515142b` binds this contract to the discussed Wave 2 migration requirement.
- `packages/bmad-speckit/src/main-agent/**` is the source authority for the Wave 2 covered Main Agent actions after G005 completes.
- `packages/bmad-speckit/dist/main-agent/**` is the consumer runtime output for the Wave 2 covered Main Agent actions after G004 and G005 complete.
- `packages/bmad-speckit/bin/bmad-speckit.js` is the package CLI facade authority for consumer-visible command dispatch.
- `scripts/bmad-speckit-cli.js` remains the root package bin shim and may only forward to `node_modules/bmad-speckit/bin/bmad-speckit.js` or `packages/bmad-speckit/bin/bmad-speckit.js`; it is not allowed to implement covered Main Agent behavior or call root Main Agent scripts.
- `repo-governance/script-migration-registry.yaml` is the machine-readable source repository migration registry.
- `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json` is the machine-readable validation receipt for this wave after G009 creates it.
- `repo-governance/script-migrations/main-agent-source-authority-wave-2/summary.md` is the human-readable validation summary for this wave after G009 creates it.
- `_bmad/skills/main-agent-runtime-migration/SKILL.md` is the source repository skill authority for repeating this migration pattern after G010 creates it.
- `.codex/skills/main-agent-runtime-migration/SKILL.md` is the project-local Codex skill projection after G010 syncs it.
- `scripts/main-agent-orchestration.ts` remains source repository development authority only and is not consumer runtime authority for the Wave 2 covered actions after G006 completes.
- `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` remains an explicitly bounded compatibility fallback for legacy actions that are not covered by Wave 2.
- `inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop` are the only actions covered by Wave 2.
- `model_packet.json is the machine-readable execution authority` only after a generated Main Agent execution packet exists.
- `goal_execution.md is not execution authority`; this document is the frozen implementation contract for Wave 2.
- `/goal completion is not closeout proof`; completion proof requires changed files, source authority checks, dist runtime checks, registry evidence, install-matrix evidence, skill sync evidence, and encoding gate output.

## Root Cause To Fix

Wave 1 removed the most direct public consumer dispatch dependency on `runRepoScript('scripts/*.ts')`, but it did not finish moving Main Agent source authority. The covered package runtime still uses package-local JavaScript facades plus `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` as a compatibility fallback. That structure proves a consumer can run package-local JavaScript, but it does not establish `packages/bmad-speckit/src/main-agent/**` as the true source of the covered Main Agent behavior.

The target state for Wave 2 is that `inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop` are implemented as package source under `packages/bmad-speckit/src/main-agent/**`, built into `packages/bmad-speckit/dist/main-agent/**`, and dispatched by `packages/bmad-speckit/bin/bmad-speckit.js` through package-local `dist` runtime. The consumer path must not execute root `scripts/*.ts`, must not resolve `tsx`, must not resolve `ts-node`, and must not enter `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` for covered actions.

This wave must not clean up root scripts. Root `scripts/*` contains internal development, CI, release, fixture, source-development, and six-mental-model tooling. Deletion requires a separate per-script contract with classification, caller switching, tests, install-matrix evidence, proof that no CI or internal chain depends on the file, and explicit per-script approval.

## Domain-Specific Contract Addenda

### Addendum D001: Covered Public Command Contract

- The covered grouped command `bmad-speckit main-agent inspect` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- The covered grouped command `bmad-speckit main-agent confirm-scope` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- The covered grouped command `bmad-speckit main-agent dispatch-plan` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- The covered grouped command `bmad-speckit main-agent run-loop` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- The compatibility command `bmad-speckit main-agent-orchestration --action inspect` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- The compatibility command `bmad-speckit main-agent-orchestration --action confirm-scope` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- The compatibility command `bmad-speckit main-agent-orchestration --action dispatch-plan` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- The compatibility command `bmad-speckit main-agent-orchestration --action run-loop` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- The compatibility command `bmad-speckit confirm-scope` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js` with action `confirm-scope`.
- The compatibility command `bmad-speckit main-agent:confirm-scope` MUST dispatch through `packages/bmad-speckit/dist/main-agent/index.js` with action `confirm-scope`.
- When consumer install tests enter through the root package bin shim `scripts/bmad-speckit-cli.js`, the shim MUST forward into the package CLI and the covered action MUST still dispatch through `packages/bmad-speckit/dist/main-agent/index.js`.
- Every command listed in D001 MUST accept `--json`.
- Every command listed in D001 MUST return a numeric process exit code.
- Every command listed in D001 MUST NOT call `runRepoScript(...)`.
- Every command listed in D001 MUST NOT execute root `scripts/main-agent-orchestration.ts`.
- Every command listed in D001 MUST NOT resolve or execute `tsx`.
- Every command listed in D001 MUST NOT resolve or execute `ts-node`.
- Every command listed in D001 MUST NOT dispatch covered actions through `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.

### Addendum D002: Package Source Authority Contract

- `packages/bmad-speckit/src/main-agent/index.js` MUST export `mainAgentRuntimeCommand`.
- `packages/bmad-speckit/src/main-agent/runtime.js` MUST implement action selection for `inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop`.
- `packages/bmad-speckit/src/main-agent/actions/inspect.js` MUST contain the package source implementation for `inspect`.
- `packages/bmad-speckit/src/main-agent/actions/confirm-scope.js` MUST contain the package source implementation for `confirm-scope`.
- `packages/bmad-speckit/src/main-agent/actions/dispatch-plan.js` MUST contain the package source implementation for `dispatch-plan`.
- `packages/bmad-speckit/src/main-agent/actions/run-loop.js` MUST contain the package source implementation for `run-loop`.
- Covered action modules MUST NOT import root `scripts/*.ts`.
- Covered action modules MUST NOT import `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.
- Covered action modules MUST NOT depend on a source repository checkout path.
- Covered action modules MUST resolve consumer runtime state relative to the selected consumer project root.
- The selected consumer project root MUST be `process.cwd()` unless the CLI receives `--cwd` followed by a concrete filesystem path.
- JSON output for covered actions MUST include `schemaVersion`, `action`, `cwd`, `status`, `exitCode`, and `errors`.
- Unknown actions MUST return `unsupported_main_agent_action` and a non-zero exit code.
- Missing required runtime state for actions that require state MUST return `runtime_state_missing` and a non-zero exit code.

### Addendum D003: Minimal Dist Runtime Contract

- `packages/bmad-speckit/package.json` MUST define a deterministic build command named `build:main-agent-dist`.
- `packages/bmad-speckit/package.json` `prepack` MUST invoke `build:main-agent-dist` before package validation so standalone `npm pack` cannot publish a package without `dist/main-agent/**`.
- `packages/bmad-speckit/package.json` MUST include `dist/` in the package `files` array.
- The build command `build:main-agent-dist` MUST create `packages/bmad-speckit/dist/main-agent/index.js`.
- The build command `build:main-agent-dist` MUST create `packages/bmad-speckit/dist/main-agent/runtime.js`.
- The build command `build:main-agent-dist` MUST create dist files for all four covered action modules.
- The build command `build:main-agent-dist` MUST NOT copy root `scripts/*.ts` into `packages/bmad-speckit/dist/**`.
- The build command `build:main-agent-dist` MUST NOT copy `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` as the implementation path for covered actions.
- `packages/bmad-speckit/dist/main-agent/**` MUST be generated from `packages/bmad-speckit/src/main-agent/**`.
- Consumer CLI dispatch for covered actions MUST require `../dist/main-agent/index.js`.
- `packages/bmad-speckit/dist/main-agent/**` is runtime output, not source authority.
- The package is allowed to retain `packages/bmad-speckit/src/**` in the package `files` array only when CMD-03 and CMD-05 prove covered consumer commands use `dist`.

### Addendum D004: Fallback Boundary Contract

- `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` MUST NOT be used for `inspect`.
- `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` MUST NOT be used for `confirm-scope`.
- `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` MUST NOT be used for `dispatch-plan`.
- `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` MUST NOT be used for `run-loop`.
- Unmigrated legacy actions are allowed to remain in the compiled fallback only when `repo-governance/script-migration-registry.yaml` records them as fallback or source-development entries in this wave or a previous validated wave.
- Wave 2 MUST NOT add new consumer-visible dispatch paths into the compiled fallback for unmigrated legacy actions.
- A package test MUST fail when covered action dispatch enters `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.
- A package test MUST fail when `packages/bmad-speckit/bin/bmad-speckit.js` routes covered actions to source `src/main-agent/**` instead of `dist/main-agent/**`.

### Addendum D005: Registry And Evidence Contract

- `repo-governance/script-migration-registry.yaml` MUST contain a wave with `waveId: main-agent-source-authority-wave-2`.
- The Wave 2 registry wave MUST use `contractPath: docs/plans/2026-06-03-main-agent-source-authority-wave-2-goal-execution-plan.md`.
- The Wave 2 registry wave MUST declare `refinesWaveId: main-agent-migration-wave-1` so the same `originalPath` can be refined without being treated as an unrelated active-wave conflict.
- The Wave 2 registry wave MUST contain an entry with `entryId: main-agent-orchestration`.
- The Wave 2 registry entry MUST use `originalPath: scripts/main-agent-orchestration.ts`.
- The Wave 2 registry entry MUST use `originalPathStatus: retained`.
- The Wave 2 registry entry MUST use `originalClassBeforeMigration: package_runtime_source_authority_incomplete`.
- The Wave 2 registry entry MUST use `migrationStrategy: package_runtime_module`.
- The Wave 2 registry entry MUST include target paths under `packages/bmad-speckit/src/main-agent/`.
- The Wave 2 registry entry MUST include target paths under `packages/bmad-speckit/dist/main-agent/`.
- The Wave 2 registry entry MUST include `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json` in `evidenceRefs`.
- The Wave 2 registry entry MUST use `oldPathDisposition: retained_source_dev_only`.
- The Wave 2 registry entry MUST use `deletionAllowed: false`.
- The Wave 2 registry entry MUST use `deletionApprovalRef: null`.
- `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json` MUST contain command evidence for CMD-03 through CMD-10.
- CMD-11 MUST run after final evidence and registry writes; its output MUST be reported in the completion evidence packet instead of being self-referentially written back into `evidence.json`.
- `repo-governance/script-migrations/main-agent-source-authority-wave-2/summary.md` MUST state that no root `scripts/*` deletion is approved.
- `tools/script-migration/validate-registry.cjs` MUST allow sequential refinement waves for the same `originalPath` only when the later wave explicitly declares `refinesWaveId` and keeps `deletionAllowed: false`.
- `tools/script-migration/validate-registry.cjs` MUST still reject unrelated active-wave conflicts for the same `originalPath`.
- `tests/acceptance/script-migration-registry-contract.test.ts` MUST cover the positive refinement case and the negative unrelated conflict case.

### Addendum D006: Skill Capture Contract

- `_bmad/skills/main-agent-runtime-migration/SKILL.md` MUST be created or updated after Wave 2 validation commands pass.
- `.codex/skills/main-agent-runtime-migration/SKILL.md` MUST be created or updated after `_bmad/skills/main-agent-runtime-migration/SKILL.md` is created or updated.
- The two skill files MUST describe how to migrate Main Agent consumer runtime from root scripts or compiled fallback into package source and dist runtime.
- The skill files MUST include a warning that root scripts cannot be deleted without per-script approval.
- The skill files MUST include registry update requirements.
- The skill files MUST include package JS test requirements.
- The skill files MUST include install-matrix evidence requirements.
- The skill files MUST NOT tell consumers to read `repo-governance/script-migration-registry.yaml`.
- The skill files MUST NOT become part of the package consumer runtime path.

### Addendum D007: Test Ownership Contract

- `packages/bmad-speckit/tests/*.test.js` MUST prove published package runtime behavior.
- `packages/bmad-speckit/tests/*.test.js` MUST be plain JavaScript.
- `packages/bmad-speckit/tests/*.test.js` MUST NOT import root `scripts/*.ts`.
- `packages/bmad-speckit/tests/*.test.js` MUST NOT require `tsx`.
- `packages/bmad-speckit/tests/*.test.js` MUST NOT require `ts-node`.
- `packages/bmad-speckit/tests/*.test.js` MUST NOT depend on `D:\Dev\BMAD-Speckit-SDD-Flow` or any other source checkout absolute path.
- `tests/acceptance/*.test.ts` MUST prove source repository governance, CI, regression, and install-matrix behavior.
- Tests that prove consumer-visible CLI stability MUST call the package CLI.
- Consumer-visible CLI tests MUST NOT call `node scripts/main-agent-orchestration.ts --action inspect`.
- Source repository internal behavior tests are allowed to keep calling root TypeScript scripts only when the test classifies that path as `source_dev_only` or `internal_governance`.

### Addendum D008: Deterministic Not-Done Scope

- NOT DONE: Do not delete `scripts/main-agent-orchestration.ts`; reason: Wave 2 requires source-dev retention and no per-script deletion approval exists.
- NOT DONE: Do not delete any root `scripts/*` file; reason: root scripts require per-script classification, caller switching, validation, and explicit approval.
- NOT DONE: Do not migrate the full set of changed root scripts from 2026-05-27 onward; reason: Wave 2 covers only `inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop`.
- NOT DONE: Do not rewrite the entire `packages/bmad-speckit` CLI into `dist/cli.js`; reason: Wave 2 requires only covered Main Agent entries to use `dist/main-agent`.
- NOT DONE: Do not make `repo-governance/**` or `main-agent-runtime-migration` skill files consumer runtime dependencies; reason: both are source repository governance surfaces.

## Implementation Tasks

### G001 - Establish Preflight, Scope, And Baseline

Purpose: Prove the executor starts from a known worktree and preserves unrelated dirty paths.

Files:

- `docs/plans/2026-06-03-main-agent-source-authority-wave-2-goal-execution-plan.md`
- `scripts/bmad-speckit-cli.js`
- `packages/bmad-speckit/package.json`
- `packages/bmad-speckit/bin/bmad-speckit.js`
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`
- `packages/bmad-speckit/src/main-agent/index.js`
- `packages/bmad-speckit/src/main-agent/runtime.js`
- `packages/bmad-speckit/src/main-agent/actions/inspect.js`
- `packages/bmad-speckit/src/main-agent/actions/confirm-scope.js`
- `packages/bmad-speckit/src/main-agent/actions/dispatch-plan.js`
- `packages/bmad-speckit/src/main-agent/actions/run-loop.js`
- `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`
- `packages/bmad-speckit/dist/main-agent/index.js`
- `packages/bmad-speckit/dist/main-agent/runtime.js`
- `packages/bmad-speckit/dist/main-agent/actions/inspect.js`
- `packages/bmad-speckit/dist/main-agent/actions/confirm-scope.js`
- `packages/bmad-speckit/dist/main-agent/actions/dispatch-plan.js`
- `packages/bmad-speckit/dist/main-agent/actions/run-loop.js`
- `packages/bmad-speckit/tests/main-agent-dist-runtime-facade.test.js`
- `packages/bmad-speckit/tests/main-agent-dist-no-root-ts-dispatch.test.js`
- `packages/bmad-speckit/tests/main-agent-compiled-fallback-boundary.test.js`
- `packages/bmad-speckit/tests/main-agent-build-dist.test.js`
- `tests/acceptance/main-agent-dist-consumer-runtime.test.ts`
- `tests/acceptance/script-migration-registry-contract.test.ts`
- `repo-governance/script-migration-registry.yaml`
- `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json`
- `repo-governance/script-migrations/main-agent-source-authority-wave-2/summary.md`
- `tools/script-migration/validate-registry.cjs`
- `_bmad/skills/main-agent-runtime-migration/SKILL.md`
- `.codex/skills/main-agent-runtime-migration/SKILL.md`
- `.tmp/main-agent-source-authority-wave-2/`

Steps:

1. Run CMD-01.
2. Run CMD-02.
3. Inspect `packages/bmad-speckit/bin/bmad-speckit.js` and list every covered command route from D001.
4. Inspect `packages/bmad-speckit/src/main-agent/**` and identify covered action implementation gaps.
5. Inspect `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` and identify covered action fallback exposure.
6. Inspect `repo-governance/script-migration-registry.yaml` and confirm `main-agent-migration-wave-1` is validated.
7. Inspect `scripts/bmad-speckit-cli.js` and confirm it is only a root bin shim into the package CLI.
8. Stop with `scope_amendment_required` before editing any file outside the G001 file list.

Validation:

- CMD-01 proves this task.
- CMD-02 proves this task.

Acceptance:

- ACC001
- ACC002
- ACC003

### G002 - Register Wave 2 Planned Entries

Purpose: Record the Wave 2 source-authority migration before implementation begins.

Files:

- `repo-governance/script-migration-registry.yaml`
- `tools/script-migration/validate-registry.cjs`
- `tests/acceptance/script-migration-registry-contract.test.ts`

Steps:

1. Add `waveId: main-agent-source-authority-wave-2`.
2. Set the wave `contractPath` to `docs/plans/2026-06-03-main-agent-source-authority-wave-2-goal-execution-plan.md`.
3. Set `refinesWaveId: main-agent-migration-wave-1`.
4. Add entry `entryId: main-agent-orchestration`.
5. Set `originalPath: scripts/main-agent-orchestration.ts`.
6. Set `migrationStrategy: package_runtime_module`.
7. Set `migrationStatus: planned`.
8. Set `validationStatus: pending`.
9. Set `oldPathDisposition: retained_source_dev_only`.
10. Set `deletionAllowed: false`.
11. Set `deletionApprovalRef: null`.
12. Add all source, dist, evidence, and summary target paths required by D005.
13. Update `tools/script-migration/validate-registry.cjs` so `main-agent-source-authority-wave-2` can refine `main-agent-migration-wave-1` without weakening active-wave conflict checks.
14. Update `tests/acceptance/script-migration-registry-contract.test.ts` to prove the validator accepts an explicit refinement wave and rejects an unrelated active-wave conflict for the same `originalPath`.

Validation:

- CMD-09 proves this task.

Acceptance:

- ACC004
- ACC005
- ACC006

### G003 - Add Package Runtime And Dist Boundary Tests

Purpose: Lock the target behavior before changing source authority, build output, and CLI dispatch.

Files:

- `packages/bmad-speckit/tests/main-agent-dist-runtime-facade.test.js`
- `packages/bmad-speckit/tests/main-agent-dist-no-root-ts-dispatch.test.js`
- `packages/bmad-speckit/tests/main-agent-compiled-fallback-boundary.test.js`
- `packages/bmad-speckit/tests/main-agent-build-dist.test.js`

Steps:

1. Create or update `packages/bmad-speckit/tests/main-agent-dist-runtime-facade.test.js`.
2. Assert `dist/main-agent/index.js` exports `mainAgentRuntimeCommand`.
3. Assert `mainAgentRuntimeCommand` supports `inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop`.
4. Assert covered action JSON output includes `schemaVersion`, `action`, `cwd`, `status`, `exitCode`, and `errors`.
5. Create or update `packages/bmad-speckit/tests/main-agent-dist-no-root-ts-dispatch.test.js`.
6. Assert covered public commands do not contain `runRepoScript(...)`, `scripts/main-agent-orchestration.ts`, `tsx`, or `ts-node` in their dispatch path.
7. Create or update `packages/bmad-speckit/tests/main-agent-compiled-fallback-boundary.test.js`.
8. Assert covered actions do not require or execute `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.
9. Create or update `packages/bmad-speckit/tests/main-agent-build-dist.test.js`.
10. Assert `build:main-agent-dist` creates the required dist files from source files.
11. Run CMD-03 and capture the expected failure before G004 through G006 satisfy the new tests.
12. Treat final passing CMD-03 output as proof that this task is satisfied.

Validation:

- Expected failing CMD-03 output during G003 proves the tests are active.
- Final passing CMD-03 output proves this task.

Acceptance:

- ACC007
- ACC008
- ACC009
- ACC010
- ACC011
- ACC012
- ACC013
- ACC014
- ACC015
- ACC016

### G004 - Create Minimal Main Agent Dist Build

Purpose: Create package-local dist runtime infrastructure without rewriting the full CLI package.

Files:

- `packages/bmad-speckit/package.json`
- `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`
- `packages/bmad-speckit/dist/main-agent/index.js`
- `packages/bmad-speckit/dist/main-agent/runtime.js`
- `packages/bmad-speckit/dist/main-agent/actions/inspect.js`
- `packages/bmad-speckit/dist/main-agent/actions/confirm-scope.js`
- `packages/bmad-speckit/dist/main-agent/actions/dispatch-plan.js`
- `packages/bmad-speckit/dist/main-agent/actions/run-loop.js`

Steps:

1. Add `build:main-agent-dist` to `packages/bmad-speckit/package.json`.
2. Add `build:main-agent-dist` into the `packages/bmad-speckit/package.json` `prepack` chain before validation.
3. Add `dist/` to the `packages/bmad-speckit/package.json` `files` array when it is absent.
4. Create `packages/bmad-speckit/scripts/build-main-agent-dist.cjs`.
5. Make the build script copy or emit only package-local Main Agent runtime files from `src/main-agent` into `dist/main-agent`.
6. Make the build script exclude root `scripts/*.ts`.
7. Make the build script exclude `src/main-agent/compiled/main-agent-orchestration.cjs` as the implementation path for covered actions.
8. Run CMD-04.

Validation:

- CMD-04 proves this task.
- CMD-03 proves this task after G005 and G006.

Acceptance:

- ACC009
- ACC010
- ACC011
- ACC012
- ACC013

### G005 - Move Covered Action Source Authority Into Package Source

Purpose: Make `packages/bmad-speckit/src/main-agent/**` the true source authority for covered actions.

Files:

- `packages/bmad-speckit/src/main-agent/index.js`
- `packages/bmad-speckit/src/main-agent/runtime.js`
- `packages/bmad-speckit/src/main-agent/actions/inspect.js`
- `packages/bmad-speckit/src/main-agent/actions/confirm-scope.js`
- `packages/bmad-speckit/src/main-agent/actions/dispatch-plan.js`
- `packages/bmad-speckit/src/main-agent/actions/run-loop.js`

Steps:

1. Implement `mainAgentRuntimeCommand` in `packages/bmad-speckit/src/main-agent/index.js`.
2. Implement covered action selection in `packages/bmad-speckit/src/main-agent/runtime.js`.
3. Implement package source behavior for `inspect` in `packages/bmad-speckit/src/main-agent/actions/inspect.js`.
4. Implement package source behavior for `confirm-scope` in `packages/bmad-speckit/src/main-agent/actions/confirm-scope.js`.
5. Implement package source behavior for `dispatch-plan` in `packages/bmad-speckit/src/main-agent/actions/dispatch-plan.js`.
6. Implement package source behavior for `run-loop` in `packages/bmad-speckit/src/main-agent/actions/run-loop.js`.
7. Preserve JSON output fields required by D002.
8. Preserve `unsupported_main_agent_action` for unknown actions.
9. Preserve `runtime_state_missing` for required runtime state failures.
10. Do not import root `scripts/*.ts`.
11. Do not import `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` from covered action modules.
12. Run CMD-04 after source edits.

Validation:

- CMD-03 proves this task.
- CMD-04 proves this task.

Acceptance:

- ACC007
- ACC008
- ACC014
- ACC015
- ACC016
- ACC017

### G006 - Route Covered CLI Entries To Dist Runtime

Purpose: Make public covered consumer commands execute package-local dist runtime.

Files:

- `packages/bmad-speckit/bin/bmad-speckit.js`

Steps:

1. Change `bmad-speckit main-agent inspect` dispatch to require `../dist/main-agent/index.js`.
2. Change `bmad-speckit main-agent confirm-scope` dispatch to require `../dist/main-agent/index.js`.
3. Change `bmad-speckit main-agent dispatch-plan` dispatch to require `../dist/main-agent/index.js`.
4. Change `bmad-speckit main-agent run-loop` dispatch to require `../dist/main-agent/index.js`.
5. Change `bmad-speckit main-agent-orchestration --action inspect` compatibility dispatch to require `../dist/main-agent/index.js`.
6. Change `bmad-speckit main-agent-orchestration --action confirm-scope` compatibility dispatch to require `../dist/main-agent/index.js`.
7. Change `bmad-speckit main-agent-orchestration --action dispatch-plan` compatibility dispatch to require `../dist/main-agent/index.js`.
8. Change `bmad-speckit main-agent-orchestration --action run-loop` compatibility dispatch to require `../dist/main-agent/index.js`.
9. Change `bmad-speckit confirm-scope` dispatch to require `../dist/main-agent/index.js`.
10. Change `bmad-speckit main-agent:confirm-scope` dispatch to require `../dist/main-agent/index.js`.
11. Preserve non-covered CLI command behavior unless a non-covered command blocks D001.
12. Do not add one public command per internal root script.
13. Run CMD-05.

Validation:

- CMD-03 proves this task.
- CMD-05 proves this task.

Acceptance:

- ACC018
- ACC019
- ACC020
- ACC021

### G007 - Enforce Compiled Fallback Boundary

Purpose: Keep legacy fallback explicitly bounded and prevent covered action regression.

Files:

- `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`
- `packages/bmad-speckit/src/main-agent/runtime.js`
- `packages/bmad-speckit/tests/main-agent-compiled-fallback-boundary.test.js`
- `repo-governance/script-migration-registry.yaml`

Steps:

1. Ensure covered actions do not call `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.
2. Ensure covered action dispatch does not require `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.
3. Keep unmigrated legacy fallback only for entries registered as fallback or source-development surfaces.
4. Add or update registry fields that record the fallback boundary for Wave 2.
5. Run CMD-03.
6. Run CMD-09.

Validation:

- CMD-03 proves this task.
- CMD-09 proves this task.

Acceptance:

- ACC022
- ACC023
- ACC024

### G008 - Add Consumer Runtime Acceptance And Install Matrix

Purpose: Prove installed package runtime works without the source repository checkout.

Files:

- `tests/acceptance/main-agent-dist-consumer-runtime.test.ts`
- `tests/acceptance/script-migration-registry-contract.test.ts`
- `.tmp/main-agent-source-authority-wave-2/install-matrix/`

Steps:

1. Create or update `tests/acceptance/main-agent-dist-consumer-runtime.test.ts`.
2. Add a save-dev install scenario that runs `bmad-speckit main-agent inspect --json`.
3. Add an `npx --package` scenario that runs `bmad-speckit main-agent inspect --json`.
4. Add a `.tgz` install scenario that runs `bmad-speckit main-agent inspect --json`.
5. In every scenario, prove the command did not execute root `scripts/main-agent-orchestration.ts`.
6. In every scenario, prove the command did not execute `tsx`.
7. In every scenario, prove the command did not execute `ts-node`.
8. Write install evidence files under `.tmp/main-agent-source-authority-wave-2/install-matrix/`.
9. Keep install-matrix tests in `tests/acceptance/*.test.ts`.
10. Run CMD-06.
11. Run CMD-07.

Validation:

- CMD-06 proves this task.
- CMD-07 proves this task.

Acceptance:

- ACC025
- ACC026
- ACC027
- ACC028

### G009 - Write Wave 2 Evidence And Update Registry Status

Purpose: Create durable validation receipts and mark the migration state accurately.

Files:

- `repo-governance/script-migration-registry.yaml`
- `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json`
- `repo-governance/script-migrations/main-agent-source-authority-wave-2/summary.md`

Steps:

1. Run CMD-03.
2. Run CMD-04.
3. Run CMD-05.
4. Run CMD-06.
5. Run CMD-07.
6. Run CMD-08.
7. Run CMD-09.
8. Create `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json` with provisional command rows for CMD-03 through CMD-09.
9. Set each provisional command row `exitCode` to the actual exit code.
10. Set each provisional command row `stdoutHash` with a `sha256:` prefix.
11. Set each provisional command row `stderrHash` with a `sha256:` prefix.
12. Set evidence entry `result: partial` until G011 records final CMD-03 through CMD-10 rows.
13. Create `repo-governance/script-migrations/main-agent-source-authority-wave-2/summary.md`.
14. State in the summary that root `scripts/main-agent-orchestration.ts` is retained as `retained_source_dev_only`.
15. State in the summary that no root `scripts/*` deletion is approved.
16. Keep the Wave 2 registry wave at `status: in_progress` until G011 finalizes evidence.
17. Keep the Wave 2 registry entry at `migrationStatus: caller_switched` or `migrationStatus: in_progress` until G011 finalizes evidence.
18. Keep the Wave 2 registry entry at `validationStatus: partial` until G011 finalizes evidence.
19. Run CMD-09 after provisional evidence and registry updates.

Validation:

- CMD-08 proves this task.
- CMD-09 proves this task.

Acceptance:

- ACC004
- ACC005
- ACC006
- ACC030

### G010 - Capture The Migration Pattern As A Skill

Purpose: Preserve Wave 2 lessons as a reusable local workflow skill after validation succeeds.

Files:

- `_bmad/skills/main-agent-runtime-migration/SKILL.md`
- `.codex/skills/main-agent-runtime-migration/SKILL.md`

Steps:

1. Create or update `_bmad/skills/main-agent-runtime-migration/SKILL.md` after CMD-03 through CMD-09 pass.
2. Include a trigger description for migrating consumer-visible Main Agent runtime from root scripts or compiled fallback into package source and dist.
3. Include a source authority step for `packages/bmad-speckit/src/main-agent/**`.
4. Include a dist runtime step for `packages/bmad-speckit/dist/main-agent/**`.
5. Include a CLI dispatch step for `packages/bmad-speckit/bin/bmad-speckit.js`.
6. Include package JavaScript test requirements.
7. Include acceptance install-matrix requirements.
8. Include registry and evidence requirements.
9. Include a hard warning that root `scripts/*` deletion requires explicit per-script approval.
10. Copy the skill to `.codex/skills/main-agent-runtime-migration/SKILL.md`.
11. Ensure neither skill file is referenced by package runtime code.
12. Run CMD-10.

Validation:

- CMD-10 proves this task.
- CMD-02 and CMD-11 prove encoding safety around skill text.

Acceptance:

- ACC031
- ACC032
- ACC033

### G011 - Run Final Validation Suite

Purpose: Prove implementation, registry, evidence, skill sync, package runtime, and consumer matrix are all valid together.

Files:

- all files listed in G001

Steps:

1. Run CMD-03.
2. Run CMD-04.
3. Run CMD-05.
4. Run CMD-06.
5. Run CMD-07.
6. Run CMD-08.
7. Run CMD-10.
8. Update `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json` with final command rows for CMD-03 through CMD-10.
9. Set final evidence entry `result: passed` only when all recorded CMD-03 through CMD-10 rows have `exitCode: 0`.
10. Update the Wave 2 registry wave to `status: validated` only when final evidence result is `passed`.
11. Update the Wave 2 registry entry to `migrationStatus: validated` only when final evidence result is `passed`.
12. Update the Wave 2 registry entry to `validationStatus: passed` only when final evidence result is `passed`.
13. Run CMD-09 after final evidence and registry updates.
14. Run CMD-11 after all evidence, registry, skill, package, and documentation writes.
15. Fix only contract-owned files when failures are caused by Wave 2 implementation.
16. Stop with `scope_amendment_required` when a failure requires editing a path outside G001.

Validation:

- CMD-03 through CMD-11 prove this task.

Acceptance:

- ACC001
- ACC002
- ACC007
- ACC008
- ACC018
- ACC025
- ACC029
- ACC031
- ACC034
- ACC035

### G012 - Produce Completion Evidence And Closeout

Purpose: Produce completion evidence without hiding residual risk or implying root script deletion.

Files:

- `docs/plans/2026-06-03-main-agent-source-authority-wave-2-goal-execution-plan.md`
- all files changed by G002 through G011

Steps:

1. Run CMD-12.
2. List every changed file owned by this contract.
3. State that covered consumer commands now run through package-local `dist/main-agent`.
4. State that `packages/bmad-speckit/src/main-agent/**` is source authority for covered actions.
5. State that root `scripts/main-agent-orchestration.ts` is retained as source-development surface.
6. State that no root `scripts/*` file was deleted.
7. State that no root `scripts/*` deletion was approved.
8. List evidence files under `repo-governance/script-migrations/main-agent-source-authority-wave-2/`.
9. List install-matrix evidence files under `.tmp/main-agent-source-authority-wave-2/install-matrix/`.
10. List skill paths created or updated by G010.

Validation:

- CMD-12 proves this task.

Acceptance:

- ACC001
- ACC002
- ACC003
- ACC030
- ACC031
- ACC034
- ACC035
- ACC036

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

- [ ] ACC001: `git status --short --branch` was captured before implementation, and `git status --short` was captured after implementation.
- [ ] ACC002: `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` passed before implementation and after implementation.
- [ ] ACC003: Every edited file is listed in G001 `Files`, or execution stopped with `scope_amendment_required`.
- [ ] ACC004: `repo-governance/script-migration-registry.yaml` contains `waveId: main-agent-source-authority-wave-2` with `refinesWaveId: main-agent-migration-wave-1`, and CMD-09 proves the validator/test suite accepts this explicit refinement while still rejecting unrelated active-wave conflicts.
- [ ] ACC005: The Wave 2 registry entry uses `originalPath: scripts/main-agent-orchestration.ts`, `oldPathDisposition: retained_source_dev_only`, `deletionAllowed: false`, and `deletionApprovalRef: null`.
- [ ] ACC006: The Wave 2 registry entry records both `packages/bmad-speckit/src/main-agent/**` target paths and `packages/bmad-speckit/dist/main-agent/**` target paths.
- [ ] ACC007: `packages/bmad-speckit/src/main-agent/index.js` exports `mainAgentRuntimeCommand`.
- [ ] ACC008: `packages/bmad-speckit/src/main-agent/runtime.js` supports `inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop`.
- [ ] ACC009: `packages/bmad-speckit/package.json` defines `build:main-agent-dist` and invokes it from `prepack` before package validation.
- [ ] ACC010: `packages/bmad-speckit/package.json` includes `dist/` in the package `files` array.
- [ ] ACC011: `packages/bmad-speckit/scripts/build-main-agent-dist.cjs` exists.
- [ ] ACC012: CMD-04 creates `packages/bmad-speckit/dist/main-agent/index.js`, `runtime.js`, and covered action module files.
- [ ] ACC013: `packages/bmad-speckit/dist/main-agent/**` does not contain root `scripts/*.ts`.
- [ ] ACC014: Covered package source modules do not import root `scripts/*.ts`.
- [ ] ACC015: Covered package source modules do not import `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.
- [ ] ACC016: Covered action JSON output includes `schemaVersion`, `action`, `cwd`, `status`, `exitCode`, and `errors`.
- [ ] ACC017: Unknown covered runtime action failures return `unsupported_main_agent_action` with a non-zero exit code.
- [ ] ACC018: `bmad-speckit main-agent inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop` dispatch through `../dist/main-agent/index.js`.
- [ ] ACC019: `bmad-speckit main-agent-orchestration --action inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop` dispatch through `../dist/main-agent/index.js`.
- [ ] ACC020: `bmad-speckit confirm-scope` and `bmad-speckit main-agent:confirm-scope` dispatch through `../dist/main-agent/index.js`.
- [ ] ACC021: Covered public command dispatch, including the root bin shim path, does not call `runRepoScript(...)`, root `scripts/main-agent-orchestration.ts`, `tsx`, or `ts-node`.
- [ ] ACC022: Covered action dispatch does not enter `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.
- [ ] ACC023: `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs` remains bounded to registered legacy fallback behavior.
- [ ] ACC024: The registry records fallback or source-development classification for any retained compiled fallback behavior touched by Wave 2.
- [ ] ACC025: Save-dev consumer install evidence proves `bmad-speckit main-agent inspect --json` runs without source repository checkout, root script execution, `tsx`, or `ts-node`.
- [ ] ACC026: `npx --package` consumer evidence proves `bmad-speckit main-agent inspect --json` runs without source repository checkout, root script execution, `tsx`, or `ts-node`.
- [ ] ACC027: `.tgz` consumer install evidence proves `bmad-speckit main-agent inspect --json` runs without source repository checkout, root script execution, `tsx`, or `ts-node`.
- [ ] ACC028: Install-matrix evidence files exist under `.tmp/main-agent-source-authority-wave-2/install-matrix/`.
- [ ] ACC029: `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json` exists and records CMD-03 through CMD-10 command rows with exit codes and `sha256:` hashes.
- [ ] ACC030: `repo-governance/script-migrations/main-agent-source-authority-wave-2/summary.md` exists and states that root `scripts/main-agent-orchestration.ts` is retained and no root `scripts/*` deletion is approved.
- [ ] ACC031: `_bmad/skills/main-agent-runtime-migration/SKILL.md` exists after successful validation.
- [ ] ACC032: `.codex/skills/main-agent-runtime-migration/SKILL.md` exists and matches the project-local skill projection required by G010.
- [ ] ACC033: Main Agent runtime migration skill files contain root script deletion approval warnings, registry requirements, package JS test requirements, and install-matrix requirements.
- [ ] ACC034: CMD-03 through CMD-11 exit with code `0` after implementation.
- [ ] ACC035: `scripts/main-agent-orchestration.ts` still exists and no root `scripts/*` file was deleted.
- [ ] ACC036: Final completion evidence states that no root `scripts/*` deletion was performed and no root `scripts/*` deletion was approved.

## Acceptance Traceability Matrix

| Acceptance | Tasks | Evidence |
|---|---|---|
| ACC001 | G001, G012 | CMD-01, CMD-12 |
| ACC002 | G001, G010, G011 | CMD-02, CMD-11 |
| ACC003 | G001, G012 | CMD-01, CMD-12 |
| ACC004 | G002, G009 | CMD-09 |
| ACC005 | G002, G009, G012 | CMD-09, CMD-12 |
| ACC006 | G002, G009 | CMD-09 |
| ACC007 | G003, G005 | CMD-03 |
| ACC008 | G003, G005 | CMD-03 |
| ACC009 | G004 | CMD-04 |
| ACC010 | G004 | CMD-04 |
| ACC011 | G004 | CMD-04 |
| ACC012 | G004 | CMD-04 |
| ACC013 | G004 | CMD-04, CMD-05 |
| ACC014 | G003, G005 | CMD-03, CMD-05 |
| ACC015 | G003, G005 | CMD-03 |
| ACC016 | G003, G005 | CMD-03, CMD-06 |
| ACC017 | G005 | CMD-03 |
| ACC018 | G006 | CMD-03, CMD-05 |
| ACC019 | G006 | CMD-03, CMD-05 |
| ACC020 | G006 | CMD-03, CMD-05 |
| ACC021 | G006 | CMD-05 |
| ACC022 | G007 | CMD-03, CMD-05 |
| ACC023 | G007 | CMD-03, CMD-09 |
| ACC024 | G007 | CMD-09 |
| ACC025 | G008 | CMD-06, `.tmp/main-agent-source-authority-wave-2/install-matrix/save-dev-*.json` |
| ACC026 | G008 | CMD-06, `.tmp/main-agent-source-authority-wave-2/install-matrix/npx-package-*.json` |
| ACC027 | G008 | CMD-07, `.tmp/main-agent-source-authority-wave-2/install-matrix/tgz-*.json` |
| ACC028 | G008 | CMD-06, CMD-07 |
| ACC029 | G009 | `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json`, CMD-08, CMD-09 |
| ACC030 | G009, G012 | `repo-governance/script-migrations/main-agent-source-authority-wave-2/summary.md`, CMD-12 |
| ACC031 | G010, G012 | CMD-10, CMD-12 |
| ACC032 | G010 | CMD-10 |
| ACC033 | G010 | CMD-10 |
| ACC034 | G011 | CMD-03, CMD-04, CMD-05, CMD-06, CMD-07, CMD-08, CMD-09, CMD-10, CMD-11 |
| ACC035 | G012 | CMD-12 |
| ACC036 | G012 | CMD-12 |

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment.

### CMD-01 Preflight Worktree Status

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { git status --short --branch }"
```

Pass condition: output is captured, and unrelated dirty paths are not reverted.

### CMD-02 Pre-Implementation Encoding Gate

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js }"
```

Pass condition: command exits with code `0` and reports `findings=0`.

### CMD-03 Package Main Agent Dist Targeted Tests

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit -- main-agent-dist-runtime-facade.test.js main-agent-dist-no-root-ts-dispatch.test.js main-agent-compiled-fallback-boundary.test.js main-agent-build-dist.test.js }"
```

Pass condition: command exits with code `0`.

### CMD-04 Main Agent Dist Build

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit }"
```

Pass condition: command exits with code `0` and writes all files under `packages/bmad-speckit/dist/main-agent/` listed in G004.

### CMD-05 Static Covered Dispatch Guard

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { `$script = @'
const fs = require('node:fs');
const source = fs.readFileSync('packages/bmad-speckit/bin/bmad-speckit.js', 'utf8');
const rootShim = fs.readFileSync('scripts/bmad-speckit-cli.js', 'utf8');
const covered = [
  'main-agent',
  'main-agent-orchestration',
  'confirm-scope',
  'main-agent:confirm-scope',
];
function commandBlock(command) {
  const patterns = [
    `.command('${command}'`,
    `.command("${command}"`,
    `.command('${command} '`,
    `.command("${command} `,
  ];
  const starts = patterns
    .map((pattern) => source.indexOf(pattern))
    .filter((index) => index !== -1);
  const start = starts.length === 0 ? -1 : Math.min(...starts);
  if (start === -1) {
    console.error(`missing covered command ${command}`);
    process.exit(1);
  }
  const next = source.indexOf('\nprogram', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}
for (const command of covered) {
  const block = commandBlock(command);
  if (!block.includes('../dist/main-agent/index.js')) {
    console.error(`covered command ${command} does not use dist runtime`);
    process.exit(1);
  }
  if (/runRepoScript\(|scripts[\\\\/]main-agent-orchestration\.ts|\btsx\b|ts-node/.test(block)) {
    console.error(`covered command ${command} still uses source-dev runtime`);
    process.exit(1);
  }
}
if (!rootShim.includes('node_modules') || !rootShim.includes('bmad-speckit') || !rootShim.includes('bin')) {
  console.error('root bin shim does not forward to package CLI');
  process.exit(1);
}
if (/runRepoScript\(|scripts[\\\\/]main-agent-orchestration\.ts|\btsx\b|ts-node/.test(rootShim)) {
  console.error('root bin shim still exposes source-dev Main Agent runtime');
  process.exit(1);
}
'@; node -e `$script }"
```

Pass condition: command exits with code `0`.

### CMD-06 Consumer Dist Runtime Acceptance

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-dist-consumer-runtime.test.ts }"
```

Pass condition: command exits with code `0`, and save-dev plus `npx --package` evidence files exist under `.tmp/main-agent-source-authority-wave-2/install-matrix/`.

### CMD-07 Package Tarball Dist Install Matrix

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit; if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }; New-Item -ItemType Directory -Force '.tmp/main-agent-source-authority-wave-2' | Out-Null; npm pack --pack-destination .tmp/main-agent-source-authority-wave-2; if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }; npx vitest run tests/acceptance/main-agent-dist-consumer-runtime.test.ts; if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE } }"
```

Pass condition: command exits with code `0`, and `.tgz` evidence files exist under `.tmp/main-agent-source-authority-wave-2/install-matrix/`.

### CMD-08 Full Package Test Suite

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit }"
```

Pass condition: command exits with code `0`.

### CMD-09 Registry Validator And Contract Test

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-registry.cjs; if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }; npx vitest run tests/acceptance/script-migration-registry-contract.test.ts; if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE } }"
```

Pass condition: both commands exit with code `0`.

### CMD-10 Skill Sync Static Check

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { `$a = Get-Content -Raw '_bmad/skills/main-agent-runtime-migration/SKILL.md'; `$b = Get-Content -Raw '.codex/skills/main-agent-runtime-migration/SKILL.md'; if (`$a -ne `$b) { Write-Error 'skill projection mismatch'; exit 1 }; if (-not `$a.Contains('root scripts/* deletion requires explicit per-script approval')) { Write-Error 'missing deletion approval warning'; exit 1 }; if (-not `$a.Contains('script-migration-registry')) { Write-Error 'missing registry requirement'; exit 1 }; if (-not `$a.Contains('install-matrix')) { Write-Error 'missing install matrix requirement'; exit 1 } }"
```

Pass condition: command exits with code `0`.

### CMD-11 Post-Implementation Encoding Gate

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js }"
```

Pass condition: command exits with code `0` and reports `findings=0`.

### CMD-12 Final Worktree Status

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { git status --short }"
```

Pass condition: output is captured, goal-owned changed files are identified, and unrelated dirty paths are not reverted.

## Manual Verification Scenarios

Produce explicit evidence for every scenario.

### MV-01 Package Dist Source Authority Inspection

1. Open `packages/bmad-speckit/src/main-agent/runtime.js`.
2. Verify `inspect`, `confirm-scope`, `dispatch-plan`, and `run-loop` are implemented through package source action modules.
3. Open `packages/bmad-speckit/dist/main-agent/runtime.js`.
4. Verify dist runtime was generated from package source.
5. Verify no covered action module imports root `scripts/*.ts`.

Evidence: CMD-03 output and CMD-04 output.

### MV-02 Covered CLI Dispatch Inspection

1. Open `packages/bmad-speckit/bin/bmad-speckit.js`.
2. Verify commands listed in D001 route to `../dist/main-agent/index.js`.
3. Verify covered command dispatch does not call `runRepoScript(...)`.
4. Verify covered command dispatch does not mention `tsx`.
5. Verify covered command dispatch does not mention `ts-node`.

Evidence: CMD-05 output.

### MV-03 Consumer Install Runtime Inspection

1. Run CMD-06.
2. Run CMD-07.
3. Open `.tmp/main-agent-source-authority-wave-2/install-matrix/save-dev-*.json`.
4. Open `.tmp/main-agent-source-authority-wave-2/install-matrix/npx-package-*.json`.
5. Open `.tmp/main-agent-source-authority-wave-2/install-matrix/tgz-*.json`.
6. Verify each file records `usedRootScript: false`, `usedTsx: false`, and `usedTsNode: false`.

Evidence: install-matrix JSON files.

### MV-04 Registry And Deletion Boundary Inspection

1. Open `repo-governance/script-migration-registry.yaml`.
2. Verify Wave 2 uses `oldPathDisposition: retained_source_dev_only`.
3. Verify Wave 2 uses `deletionAllowed: false`.
4. Verify `scripts/main-agent-orchestration.ts` exists.
5. Verify no root `scripts/*` file was deleted by this wave.

Evidence: CMD-09 output and CMD-12 output.

### MV-05 Skill Capture Inspection

1. Open `_bmad/skills/main-agent-runtime-migration/SKILL.md`.
2. Open `.codex/skills/main-agent-runtime-migration/SKILL.md`.
3. Verify both files contain the same content.
4. Verify the skill describes package source authority, dist runtime, CLI dispatch, registry evidence, package tests, install matrix, and deletion approval guard.

Evidence: CMD-10 output.

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

- `contractPath`: `docs/plans/2026-06-03-main-agent-source-authority-wave-2-goal-execution-plan.md`
- `sourcePlanPath`: `conversation://2026-06-03-main-agent-source-authority-wave-2`
- `sourcePlanHash`: `sha256:d3535412717ecf09d022b6c1394de57f10b0198e075de0cc2277bb5ab515142b`
- `changedFiles`: list every changed file path owned by G001.
- `coveredActions`: `inspect`, `confirm-scope`, `dispatch-plan`, `run-loop`
- `sourceAuthorityPath`: `packages/bmad-speckit/src/main-agent/`
- `consumerRuntimePath`: `packages/bmad-speckit/dist/main-agent/`
- `cliFacadePath`: `packages/bmad-speckit/bin/bmad-speckit.js`
- `registryPath`: `repo-governance/script-migration-registry.yaml`
- `evidenceReceiptPath`: `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json`
- `summaryPath`: `repo-governance/script-migrations/main-agent-source-authority-wave-2/summary.md`
- `skillSourcePath`: `_bmad/skills/main-agent-runtime-migration/SKILL.md`
- `skillCodexProjectionPath`: `.codex/skills/main-agent-runtime-migration/SKILL.md`
- `rootMainAgentScriptDisposition`: must equal `retained_source_dev_only`.
- `rootScriptsDeleted`: must equal `false`.
- `rootScriptDeletionApproved`: must equal `false`.
- `coveredCommandsUseDist`: must equal `true`.
- `coveredCommandsUseRootScripts`: must equal `false`.
- `coveredCommandsUseCompiledFallback`: must equal `false`.
- `coveredCommandsUseTsx`: must equal `false`.
- `coveredCommandsUseTsNode`: must equal `false`.
- `installMatrixEvidence`: list `.tmp/main-agent-source-authority-wave-2/install-matrix/*.json` paths.
- `commandsRun`: list CMD-01 through CMD-12 with exit code and output summary.
- `acceptanceStatus`: list ACC001 through ACC036 as `pass` or `blocked`.
- `residualRisks`: list any failed command, unavailable install mode, or blocked acceptance item.

## Stop Conditions

- Stop with `scope_amendment_required` if implementation needs to edit a path not listed in G001 `Files`.
- Stop with `contract_amendment_required` if a required command in CMD-01 through CMD-12 is unavailable and no earlier task in this contract creates it.
- Stop with `root_script_deletion_approval_required` if any implementation step proposes deleting a root `scripts/*` file.
- Stop with `root_script_bulk_migration_scope_violation` if implementation proposes migrating the full root `scripts/*` set in this wave.
- Stop with `consumer_runtime_source_dev_dependency_detected` if any covered consumer command executes root `scripts/*.ts`.
- Stop with `tsx_dependency_detected` if any covered consumer command executes `tsx`.
- Stop with `ts_node_dependency_detected` if any covered consumer command executes `ts-node`.
- Stop with `compiled_fallback_boundary_violation` if any covered action dispatch enters `packages/bmad-speckit/src/main-agent/compiled/main-agent-orchestration.cjs`.
- Stop with `dist_build_strategy_decision_required` if `build:main-agent-dist` cannot produce package-local JavaScript from `src/main-agent/**`.
- Stop with `cli_surface_entropy_regression` if implementation adds one public command per internal root script.
- Stop with `registry_evidence_missing` if Wave 2 registry status is `validated` or validation status is `passed` without `repo-governance/script-migrations/main-agent-source-authority-wave-2/evidence.json`.
- Stop with `skill_capture_blocked` if `_bmad/skills/main-agent-runtime-migration/SKILL.md` or `.codex/skills/main-agent-runtime-migration/SKILL.md` cannot be written after validation succeeds.
