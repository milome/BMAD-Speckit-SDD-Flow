# Goal Execution Contract

---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 2.0.0
goalContractProfileHash: sha256:b67ad6fb7f8c3ea903f03c5b51331fd530252ece0d9b629bf8c11ee93d5c4b70
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: conversation://2026-06-02-bmads-available-next-actions
sourcePlanHash: sha256:37b3afd35162e4c1c1978b3875b1b88bf6abec75420d80c811f35a1d27aa4a67
runtimeRecordId: none
entryFlow: bmads_runtime_renderer_ux_contract
taskRange: G001-G008
acceptanceRange: ACC001-ACC016
completionGate: all_acceptance_items_and_required_commands_pass
repairPolicy: fix_source_then_rerun_targeted_tests
stopPolicy: stop_on_contract_ambiguity_or_scope_expansion
generatedBy: goal-execution-contract-generator
generatedAt: 2026-06-02T00:00:00+08:00
---

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Claude /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Cursor /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

```text
/goal docs/plans/2026-06-02-bmads-available-next-actions-goal-execution-plan.md
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
- Run `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` before and after Markdown, JSON, skill, command, or generated-surface edits.
- Inspect `git status --short` before editing and do not revert unrelated dirty worktree changes.
- Do not mark a task complete without fresh command output or direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Run the regression tests associated with every changed file and keep fresh passing evidence before claiming completion.
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, or audit prose alone.
- Do not weaken the declared machine-readable authority.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, or tests.

## Authority Model

- `packages/bmad-speckit/src/runtime/bmads-renderer.js` is the runtime renderer authority for `$bmads` and `$bmad-speckit` stdout.
- `packages/bmad-speckit/src/runtime/markdown-sections.js` is the heading schema authority when a new renderer section or heading key is needed.
- `_bmad/_config/ai-tdd-six-model-*.csv` files remain display projection data only; they must not write RequirementRecord control state.
- `_bmad-output/runtime/requirement-records/**/requirement-record.json` remains RequirementRecord runtime state authority.
- `$bmad-help` remains BMAD upstream workflow and catalog help; it must not expand the RequirementRecord six-model panorama.
- `$bmads` and `$bmad-speckit` stdout must remain identical for the same command options and runtime state.
- `model_packet.json is the machine-readable execution authority` applies only to generated execution packets; this renderer change must not create a packet authority.
- `goal_execution.md is not execution authority`; this contract is the frozen implementation plan only.
- `/goal completion is not closeout proof`; delivery closeout remains governed by the existing closeout gate and controlled acceptance flow.

## Root Cause To Fix

The current `$bmads` runtime output highlights internal technical tokens with inline code styling while it lacks a dedicated user-facing panel that lists actionable skills, commands, and copyable prompts. `record_closed` is a terminal event, but it is rendered as inline code in runtime guidance and decision copy, which makes it look like a runnable command. At the same time, high-value user skills such as `requirements-contract-authoring`, `req-trace-matrix-prompt-generator`, `goal-execution-contract-generator`, `grill-with-docs`, and `docs-review` are not grouped into an immediately usable action panel.

The fix must make the visual language deterministic: inline code styling means a user can copy or invoke the token as a skill, command, or controlled command-like action. Internal routes, schema states, runtime states, and terminal events must remain plain text unless the field is a literal data field inside a machine diagnostic surface.

## Domain-Specific Contract Addenda

### Addendum D001: Action Display Model

The renderer must define or materialize an action display model with these exact fields for every displayed action row:

- `kind`: one of `skill`, `skill_action`, `cli_command`, `suggested_prompt`, `runtime_route`, `internal_state`, or `terminal_event`.
- `executable`: boolean value that is `true` only for user-invokable skills, CLI commands, controlled command-like actions, and copyable suggested prompts.
- `label`: non-empty human-facing label.
- `ownerSkill`: skill name string or `null`.
- `actionToken`: action, route, command, or state token string or `null`.
- `suggestedPrompt`: prompt text string or `null`.
- `renderAsCode`: boolean value that is `true` only when `kind` is `skill` or `cli_command`.

### Addendum D002: Highlighting Semantics

The renderer must wrap only executable skill names and CLI command strings in Markdown inline code. The renderer must not wrap `record_closed`, `prepare_architecture_confirmation`, `author-confirmation-ready-source`, `current_actionable`, `not_established`, `terminalEvent`, or schema status values in inline code when those values are presented as explanatory runtime state. The renderer must show a suggested prompt as a plain text copy block under a label that says `Suggested prompt:` or `推荐提示词：` when the active route has no dedicated public skill.

### Addendum D003: Available Next Actions Section

The `$bmads` and `$bmad-speckit` default output must contain an action section immediately after `Recommended Next Steps` and immediately before `Current Actionable Requirement Records`.

The English section must use these headings:

- `## Available Next Actions`
- `### Recommended Now`
- `### Core Skills`
- `### Navigation`

The zh-CN section must use these headings:

- `## 可用下一步`
- `### 当前推荐`
- `### 核心技能`
- `### 导航`

For the `architecture_confirmation` route with next safe action `prepare_architecture_confirmation`, the English `Recommended Now` subsection must contain these exact logical lines:

- `Current route: architecture_confirmation`
- `Next safe action: prepare_architecture_confirmation`
- `This route has no dedicated public skill. Use the suggested prompt below.`
- `Suggested prompt:`
- `Please analyze the current RequirementRecord architecture_confirmation state and produce the architecture confirmation questions, affected systems, risk confirmations, evidence requirements, and blocking issues. Do not proceed to implementation until architecture confirmation is complete.`

For the `architecture_confirmation` route with next safe action `prepare_architecture_confirmation`, the zh-CN `当前推荐` subsection must contain these exact logical lines:

- `当前 route：architecture_confirmation`
- `下一安全动作：prepare_architecture_confirmation`
- `这个 route 没有专属公开技能，请复制下面提示词执行。`
- `推荐提示词：`
- `请根据当前 RequirementRecord 的 architecture_confirmation 状态，生成架构确认问题清单、影响系统、风险确认项、证据要求和阻塞项。不要进入实现，直到架构确认完成。`

### Addendum D004: Core Skills Panel

The Core Skills panel must list these skills with inline code styling and deterministic usage copy:

- `requirements-contract-authoring`
- `req-trace-matrix-prompt-generator`
- `goal-execution-contract-generator`
- `grill-with-docs`
- `docs-review`

The panel must identify `author-confirmation-ready-source` as a typical action or lane under `requirements-contract-authoring`, not as a skill.

The English Core Skills panel must include these exact skill rows:

- The first row must render label `Skill:`, skill token `requirements-contract-authoring` as inline code, usage line `Use when: creating or updating a requirement contract source document.`, and action line `Typical action: author-confirmation-ready-source`.
- The second row must render label `Skill:`, skill token `req-trace-matrix-prompt-generator` as inline code, usage line `Use when: compiling requirement trace into prompt / model packet / execution input.`, and output line `Typical output: prompt packet, trace matrix, model packet.`.
- The third row must render label `Skill:`, skill token `goal-execution-contract-generator` as inline code, usage line `Use when: generating a strict goal execution contract document.`, output label `Typical output:`, and output token `docs/plans/...goal-execution-plan.md` as inline code.
- The fourth row must render label `Skill:`, skill token `grill-with-docs` as inline code, and usage line `Use when: running deep document grilling against a requirement, plan, or spec.`.
- The fifth row must render label `Skill:`, skill token `docs-review` as inline code, and usage line `Use when: auditing document clarity, completeness, contradictions, and acceptance readiness.`.

The zh-CN Core Skills panel must include these exact skill rows:

- The first row must render label `技能：`, skill token `requirements-contract-authoring` as inline code, usage line `适用：创建或更新需求契约源文档。`, and action line `常用动作：author-confirmation-ready-source`.
- The second row must render label `技能：`, skill token `req-trace-matrix-prompt-generator` as inline code, usage line `适用：把需求 trace 编译成 prompt / model packet / execution input。`, and output line `常见产出：prompt packet、trace matrix、model packet。`.
- The third row must render label `技能：`, skill token `goal-execution-contract-generator` as inline code, usage line `适用：生成严格 goal 执行合同文档。`, output label `常见产出：`, and output token `docs/plans/...goal-execution-plan.md` as inline code.
- The fourth row must render label `技能：`, skill token `grill-with-docs` as inline code, and usage line `适用：对需求、计划或规格文档做深度质询。`.
- The fifth row must render label `技能：`, skill token `docs-review` as inline code, and usage line `适用：审计文档清晰度、完整性、矛盾和验收就绪度。`.

### Addendum D005: Route Recommendation Semantics

The Recommended Now panel must derive its text from the active runtime route and next safe action. When a route has no dedicated public skill, the panel must display a suggested prompt. When a route has a dedicated skill, the panel must display the skill and its action or usage. When the route is delivery acceptance, `confirm-closeout-acceptance` must be displayed as a controlled command-like action, not as a skill. When the route is document review or grilling, `grill-with-docs` and `docs-review` must be prioritized.

## Implementation Tasks

### G001 - Inspect Current Renderer And Tests

Purpose: Establish the exact current implementation surface before editing.

Files:

- `packages/bmad-speckit/src/runtime/bmads-renderer.js`
- `packages/bmad-speckit/src/runtime/markdown-sections.js`
- `packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js`
- `packages/bmad-speckit/tests/bmads-heading-contract.test.js`
- `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`
- `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`

Steps:

1. Run `git status --short`.
2. Read the listed files and identify the current heading schema, runtime workflow guidance strings, decision-copy strings, and tests that assert inline code around `record_closed`.
3. Record whether any unrelated dirty changes exist and leave them untouched.

Validation:

- `git status --short`
- `rg -n -e 'record_closed' -e 'Runtime Workflow Guidance' -e 'Current Actionable Requirement Records' -e 'Six Mental Model Panorama' -- 'packages/bmad-speckit/src/runtime/bmads-renderer.js' 'packages/bmad-speckit/tests'`

Acceptance:

- ACC001
- ACC002

### G002 - Add Heading Schema Entries

Purpose: Add stable section headings for the new action panel without hardcoding ad hoc heading strings.

Files:

- `packages/bmad-speckit/src/runtime/markdown-sections.js`

Steps:

1. Add English heading schema entries for `availableNextActions`, `recommendedNow`, `coreSkills`, and `navigation`.
2. Add zh-CN heading schema entries for `availableNextActions`, `recommendedNow`, `coreSkills`, and `navigation`.
3. Insert `availableNextActions`, `recommendedNow`, `coreSkills`, and `navigation` into the BMADS core heading sequence after `recommendedNextSteps` and before `currentActionableRequirementRecords`.

Validation:

- `node --test packages/bmad-speckit/tests/bmads-heading-contract.test.js`

Acceptance:

- ACC003
- ACC004
- ACC015

### G003 - Implement Action Display Model And Render Helpers

Purpose: Create deterministic renderer logic for skills, CLI commands, suggested prompts, routes, internal state, and terminal events.

Files:

- `packages/bmad-speckit/src/runtime/bmads-renderer.js`

Steps:

1. Add a local action display builder that emits objects with `kind`, `executable`, `label`, `ownerSkill`, `actionToken`, `suggestedPrompt`, and `renderAsCode`.
2. Add rendering helpers that wrap labels in inline code only when `renderAsCode` is `true`.
3. Add English and zh-CN label copy for `Available Next Actions`, `Recommended Now`, `Core Skills`, `Navigation`, `Suggested prompt`, skill usage, typical action, and typical output.
4. Add the five required core skills and their deterministic usage copy in English and zh-CN.

Validation:

- `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js`

Acceptance:

- ACC005
- ACC006
- ACC007
- ACC008
- ACC009

### G004 - Render Available Next Actions In The Correct Position

Purpose: Make the default `$bmads` and `$bmad-speckit` page answer what the user can do now.

Files:

- `packages/bmad-speckit/src/runtime/bmads-renderer.js`

Steps:

1. Render `Available Next Actions` immediately after `Recommended Next Steps`.
2. Render `Current Actionable Requirement Records` immediately after `Available Next Actions`.
3. Render English output with `## Available Next Actions`, `### Recommended Now`, `### Core Skills`, and `### Navigation`.
4. Render zh-CN output with `## 可用下一步`, `### 当前推荐`, `### 核心技能`, and `### 导航`.
5. Keep `$bmads` and `$bmad-speckit` stdout identical for identical options and runtime state.

Validation:

- `node --test packages/bmad-speckit/tests/bmads-heading-contract.test.js packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js`

Acceptance:

- ACC003
- ACC004
- ACC010
- ACC015

### G005 - Implement Route-Specific Recommended Now Copy

Purpose: Prevent runtime routes from being mislabeled as skills while still giving the user a direct next step.

Files:

- `packages/bmad-speckit/src/runtime/bmads-renderer.js`

Steps:

1. For `architecture_confirmation` with `prepare_architecture_confirmation`, display the current route and next safe action as plain text and include the architecture confirmation suggested prompt.
2. For requirement contract authoring routes, display `requirements-contract-authoring` as the skill and `author-confirmation-ready-source` as an action or lane.
3. For goal contract routes, display `goal-execution-contract-generator` as the skill.
4. For trace or model packet routes, display `req-trace-matrix-prompt-generator` as the skill.
5. For document review or grilling routes, display `grill-with-docs` and `docs-review` as skills.
6. For delivery acceptance, display `confirm-closeout-acceptance` as a controlled command-like action and not as a skill.
7. Do not display `prepare_architecture_confirmation` as a skill.

Validation:

- `node --test packages/bmad-speckit/tests/bmads-six-model-panorama.test.js packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js`

Acceptance:

- ACC011
- ACC012
- ACC013
- ACC014

### G006 - Remove Misleading Code Styling From Terminal Events

Purpose: Stop making internal terminal events look executable.

Files:

- `packages/bmad-speckit/src/runtime/bmads-renderer.js`
- `packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js`
- `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`

Steps:

1. Replace guidance copy that wraps `record_closed` in Markdown inline code with plain `record_closed`.
2. Replace decision-copy strings that wrap `record_closed` in Markdown inline code with plain `record_closed`.
3. Update tests that require inline code around `record_closed`.
4. Add tests that fail when `` `record_closed` `` appears in `$bmads` default stdout or zh-CN stdout.

Validation:

- `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`

Acceptance:

- ACC008
- ACC009
- ACC014

### G007 - Update Content Fidelity And Heading Tests

Purpose: Upgrade tests from section-existence checks to user-action fidelity checks.

Files:

- `packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js`
- `packages/bmad-speckit/tests/bmads-heading-contract.test.js`
- `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`
- `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`

Steps:

1. Assert that default `$bmads` output includes `Available Next Actions`.
2. Assert that zh-CN `$bmads --lang zh-CN` output includes `可用下一步`.
3. Assert that `Available Next Actions` is after `Recommended Next Steps` and before `Current Actionable Requirement Records`.
4. Assert that the Core Skills panel includes all five required skills.
5. Assert that `author-confirmation-ready-source` is displayed only as an action or lane and never as a skill.
6. Assert that `prepare_architecture_confirmation` is displayed only as a route or next safe action and never as a skill.
7. Assert that `confirm-closeout-acceptance` is displayed only as a command or controlled action and never as a skill.
8. Assert that `$bmads` and `$bmad-speckit` output remain identical for the same fixture.
9. Keep existing tests that prove `Current Actionable Requirement Records` full fields and `Six Mental Model Panorama` full 1/6 through 6/6 entries remain intact.

Validation:

- `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js packages/bmad-speckit/tests/bmads-heading-contract.test.js packages/bmad-speckit/tests/bmads-six-model-panorama.test.js packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`

Acceptance:

- ACC003
- ACC004
- ACC005
- ACC006
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

### G008 - Run Full Related Verification

Purpose: Prove the renderer, package CLI, content fidelity, i18n, and encoding integrity are current.

Files:

- `packages/bmad-speckit/src/runtime/bmads-renderer.js`
- `packages/bmad-speckit/src/runtime/markdown-sections.js`
- `packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js`
- `packages/bmad-speckit/tests/bmads-heading-contract.test.js`
- `packages/bmad-speckit/tests/bmads-six-model-panorama.test.js`
- `packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js`
- `packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js`
- `packages/bmad-speckit/tests/bmad-help-display-budget.test.js`

Steps:

1. Run all required test commands in the order listed in this contract.
2. Run actual `$bmads`, `$bmad-speckit`, and `$bmads --lang zh-CN` package CLI checks.
3. Run the encoding integrity gate after all edits.
4. Capture stdout evidence showing the action panel, core skills, absence of inline-code `record_closed`, and alias equality.

Validation:

- All commands in `Required Test Commands`.

Acceptance:

- ACC001 through ACC016

## Strict Acceptance Checklist

- [ ] ACC001: `git status --short` output is captured before implementation and unrelated dirty files are not reverted.
- [ ] ACC002: The implementation identifies existing `record_closed` inline-code occurrences in `packages/bmad-speckit/src/runtime/bmads-renderer.js` and updates the renderer rather than only changing tests.
- [ ] ACC003: English `$bmads` default stdout contains `## Available Next Actions`.
- [ ] ACC004: zh-CN `$bmads --lang zh-CN` stdout contains `## 可用下一步`.
- [ ] ACC005: English Available Next Actions contains `### Recommended Now`, `### Core Skills`, and `### Navigation`.
- [ ] ACC006: zh-CN Available Next Actions contains `### 当前推荐`, `### 核心技能`, and `### 导航`.
- [ ] ACC007: Core Skills contains inline-code skill entries for `requirements-contract-authoring`, `req-trace-matrix-prompt-generator`, `goal-execution-contract-generator`, `grill-with-docs`, and `docs-review`.
- [ ] ACC008: `$bmads` default stdout does not contain `` `record_closed` ``.
- [ ] ACC009: `$bmads --lang zh-CN` stdout does not contain `` `record_closed` ``.
- [ ] ACC010: `Available Next Actions` appears after `Recommended Next Steps` and before `Current Actionable Requirement Records`.
- [ ] ACC011: `prepare_architecture_confirmation` appears as a route or next safe action and does not appear in any line that starts with `- Skill:` or `- 技能：`.
- [ ] ACC012: `author-confirmation-ready-source` appears as a typical action, common action, lane, or 常用动作 and does not appear in any line that starts with `- Skill:` or `- 技能：`.
- [ ] ACC013: `confirm-closeout-acceptance` appears as a command or controlled action and does not appear in any line that starts with `- Skill:` or `- 技能：`.
- [ ] ACC014: When the current route is `architecture_confirmation`, Recommended Now includes a suggested prompt that says not to proceed to implementation until architecture confirmation is complete.
- [ ] ACC015: `$bmads` and `$bmad-speckit` package CLI stdout are byte-identical for the same cwd, language, and budget.
- [ ] ACC016: Existing content fidelity remains intact: `Current Actionable Requirement Records` keeps full fields, and `Six Mental Model Panorama` keeps all 1/6 through 6/6 entries.

## Acceptance Traceability Matrix

| Acceptance ID | Task IDs | Evidence command or artifact | Pass condition |
|---|---|---|---|
| ACC001 | G001 | `git status --short` | Output is captured and no unrelated dirty file is reverted. |
| ACC002 | G001, G006 | `rg -n -e 'record_closed' -- 'packages/bmad-speckit/src/runtime/bmads-renderer.js' 'packages/bmad-speckit/tests'` | Renderer occurrences no longer use inline-code formatting for `record_closed`; tests assert the new behavior. |
| ACC003 | G002, G004, G007 | `node packages/bmad-speckit/bin/bmad-speckit.js bmads` | Output contains `## Available Next Actions`. |
| ACC004 | G002, G004, G007 | `node packages/bmad-speckit/bin/bmad-speckit.js bmads --lang zh-CN` | Output contains `## 可用下一步`. |
| ACC005 | G003, G004, G007 | `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js` | English action subsection assertions pass. |
| ACC006 | G003, G004, G007 | `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js` | zh-CN action subsection assertions pass. |
| ACC007 | G003, G007 | `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js` | All five core skill inline-code assertions pass. |
| ACC008 | G006, G007 | `node packages/bmad-speckit/bin/bmad-speckit.js bmads` | Output does not contain `` `record_closed` ``. |
| ACC009 | G006, G007 | `node packages/bmad-speckit/bin/bmad-speckit.js bmads --lang zh-CN` | Output does not contain `` `record_closed` ``. |
| ACC010 | G004, G007 | `node --test packages/bmad-speckit/tests/bmads-heading-contract.test.js` | Heading order assertion passes. |
| ACC011 | G005, G007 | `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js` | `prepare_architecture_confirmation` is not rendered as a skill. |
| ACC012 | G005, G007 | `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js` | `author-confirmation-ready-source` is not rendered as a skill. |
| ACC013 | G005, G007 | `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js` | `confirm-closeout-acceptance` is not rendered as a skill. |
| ACC014 | G005, G006, G007 | `node --test packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` | Architecture confirmation suggested-prompt assertion passes. |
| ACC015 | G002, G004, G008 | `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js` | `$bmads` and `$bmad-speckit` equality assertion passes. |
| ACC016 | G004, G007, G008 | `node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js packages/bmad-speckit/tests/bmads-six-model-panorama.test.js` | Full record fields and six-model entries remain present. |

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment.

### CMD001 - Pre-edit Encoding Gate

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

Working directory: repository root.

Expected pass condition: exit code `0` and `findings=0`.

Acceptance IDs: ACC001.

### CMD002 - Targeted Renderer Contract Tests

```powershell
node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js packages/bmad-speckit/tests/bmads-heading-contract.test.js packages/bmad-speckit/tests/bmads-six-model-panorama.test.js packages/bmad-speckit/tests/bmad-help-bmads-fusion-contract.test.js
```

Working directory: repository root.

Expected pass condition: exit code `0`.

Acceptance IDs: ACC003, ACC004, ACC005, ACC006, ACC007, ACC010, ACC011, ACC012, ACC013, ACC014, ACC015, ACC016.

### CMD003 - Related Entry Surface Tests

```powershell
node --test packages/bmad-speckit/tests/bmad-help-entry-surface-contract.test.js packages/bmad-speckit/tests/bmad-help-display-budget.test.js
```

Working directory: repository root.

Expected pass condition: exit code `0`.

Acceptance IDs: ACC015, ACC016.

### CMD004 - Actual English Runtime Output Check

```powershell
node packages/bmad-speckit/bin/bmad-speckit.js bmads
```

Working directory: repository root.

Expected pass condition: stdout contains `## Available Next Actions`, all five core skills, and no `` `record_closed` ``.

Acceptance IDs: ACC003, ACC005, ACC007, ACC008, ACC010, ACC011, ACC012, ACC014, ACC016.

### CMD005 - Actual zh-CN Runtime Output Check

```powershell
node packages/bmad-speckit/bin/bmad-speckit.js bmads --lang zh-CN
```

Working directory: repository root.

Expected pass condition: stdout contains `## 可用下一步`, all five core skills, and no `` `record_closed` ``.

Acceptance IDs: ACC004, ACC006, ACC007, ACC009, ACC010, ACC011, ACC012, ACC014, ACC016.

### CMD006 - Alias Equality Check

```powershell
node --test packages/bmad-speckit/tests/runtime-entry-content-fidelity.test.js
```

Working directory: repository root.

Expected pass condition: exit code `0` and the alias equality assertion passes.

Acceptance IDs: ACC015.

### CMD007 - Post-edit Encoding Gate

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

Working directory: repository root.

Expected pass condition: exit code `0` and `findings=0`.

Acceptance IDs: ACC001 through ACC016.

### CMD008 - Diff Whitespace Check

```powershell
git diff --check
```

Working directory: repository root.

Expected pass condition: exit code `0`.

Acceptance IDs: ACC001 through ACC016.

## Manual Verification Scenarios

### MV001 - English Default User Journey

Run `node packages/bmad-speckit/bin/bmad-speckit.js bmads`. Verify the output first gives status, recommended next steps, and then `Available Next Actions`. Verify a reader can identify what to do now, which skills are available, and which navigation commands are available before reading detailed RequirementRecord fields.

### MV002 - zh-CN User Journey

Run `node packages/bmad-speckit/bin/bmad-speckit.js bmads --lang zh-CN`. Verify the output uses Chinese headings and Chinese action copy for the new section while keeping skill and command names unchanged.

### MV003 - No False Skill Affordance

Inspect the rendered `Available Next Actions` section. Verify `prepare_architecture_confirmation`, `author-confirmation-ready-source`, and `confirm-closeout-acceptance` are not rendered as skills. Verify `record_closed` is plain text when present.

### MV004 - Existing Runtime Fidelity

Inspect the rendered `Current Actionable Requirement Records` and `Six Mental Model Panorama` sections. Verify the new action panel did not remove full record fields or six-model rows.

## Completion Evidence Packet

The final implementation response must include these fields:

- Contract path: `docs/plans/2026-06-02-bmads-available-next-actions-goal-execution-plan.md`.
- Changed files: exact list from `git diff --name-only`.
- Commands run: exact command list with exit codes.
- Runtime stdout evidence: summary of markers from CMD004 and CMD005.
- Acceptance evidence: ACC001 through ACC016 marked pass with direct command or artifact evidence.
- Encoding evidence: pre-edit and post-edit encoding gate outputs.
- Residual risks: `none` when every acceptance item passes; otherwise list exact blocked condition names from Stop Conditions.

## Stop Conditions

- `blocked_by_contract_ambiguity:public_skill_mapping` when a route-specific public skill mapping cannot be derived from this contract or existing skill names.
- `blocked_by_contract_ambiguity:render_position` when existing renderer structure cannot place `Available Next Actions` after `Recommended Next Steps` and before `Current Actionable Requirement Records` without changing unrelated sections.
- `blocked_by_contract_ambiguity:i18n_copy` when English or zh-CN copy cannot be made deterministic for the new section.
- `scope_amendment_required:additional_public_command` when implementation requires adding a new public command, bin, or root `scripts/*` file.
- `scope_amendment_required:bmad_help_behavior_change` when implementation requires expanding `$bmad-help` into RequirementRecord or six-model detail.
- `validation_contract_required:test_command_unavailable` when any required test command cannot run and no declared task creates the missing test.
- `encoding_integrity_blocked` when the encoding gate reports findings.
