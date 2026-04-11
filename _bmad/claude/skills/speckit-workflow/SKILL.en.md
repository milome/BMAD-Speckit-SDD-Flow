<!-- BLOCK_LABEL_POLICY=B -->
---
name: speckit-workflow
description: |
  Claude Code CLI / OMC version Speckit development process adaptation entrance.
  Using Cursor speckit-workflow as the semantic baseline, fully orchestrate constitution → specify → plan → GAPS → tasks → implement,
  Requirement mapping and auditing closed loops are mandatory at each stage, and TDD traffic light mode (red light-green light-refactoring) development is mandatory in the execution stage.
  After executing /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks, /speckit.implement (or .speckit.* equivalent); the enhanced command clarify/checklist/analyze **must be embedded in the corresponding audit closed-loop iteration for execution**: §1.2 spec audit report states that "there is an ambiguous statement" → clarify (within §1.2 iteration); §2.2 plan within the audit closed-loop, when plan When involving multiple modules or complex architecture → checklist as part of the §2.2 audit step; §4.2 tasks In the audit closed loop, when tasks ≥ 10 or across multiple artifacts → analyze as part of the §4.2 audit step; cannot be skipped in scenarios that should be executed on the grounds of "optional";
  Or when the model automatically generates IMPLEMENTATION_GAPS through in-depth analysis, or the user requests "generate tasks" or "execute tasks",
  The requirements mapping list must be added according to the rules of this skill and **call the code-review skill** for audit until passed.
  This skill **depends on the code-review skill**, which must be explicitly called in the audit closed-loop step and cannot be skipped or declared passed on its own.
  When a user asks to perform an outstanding task in tasks.md (or tasks-v*.md),
  You must develop according to the TDD traffic light mode execution rules of this skill, and use TodoWrite to track progress.
  Strictly abide by 15 iron rules such as architectural fidelity, prohibition of false implementations, and active regression testing.
  Comply with the QA_Agent execution rules and ralph-wiggum rules at the same time.
---

# Claude Adapter: Speckit development process is improved

## Purpose

This skill is the unified adaptation entrance of Cursor `speckit-workflow` in the Claude Code CLI / OMC environment.

The goal is not to simply copy the Cursor skill, but to:

1. **Inherit the verified process semantics of Cursor** (constitution → specify → plan → GAPS → tasks → implement mandatory steps in each stage)
2. **Select the correct executor and define fallback in Claude/OMC runtime**
3. **Access to the audit execution body, state machine, handoff, and score writing mechanism that have been developed in the warehouse**
4. **Ensure that the audit closed loop and TDD implementation of Speckit at each stage can be completed, continuously, and correctly executed in Claude Code CLI**

## Runtime Governance for this round (JSON)

Before executing any stage task of this skill in each round, there must be a governance JSON block injected into the context by **hook + `emit-runtime-policy`** (`scripts/emit-runtime-policy.ts` / `.claude|cursor/hooks/emit-runtime-policy-cli.js`); see `docs/reference/runtime-policy-emit-schema.md` for the contract. **Prohibited** Hand-written sample policies that are inconsistent with `resolveRuntimePolicy` are prohibited; if there is no such block in the context, `.bmad/runtime-context.json` and hook must be repaired first, and fields must not be made up.

---

## Core Acceptance Criteria

Claude version of `speckit-workflow` must meet:

- Can be used as the **unified entrance** of Claude Code CLI to continuously arrange constitution → specify → plan → GAPS → tasks → implement each stage
- The audit closed loop, executor selection, fallback, and score writing at each stage are semantically consistent with the Cursor verified process
- Complete access to the new additions to this warehouse:
  - Multiple auditor agents (auditor-spec, auditor-plan, auditor-gaps, auditor-tasks, auditor-implement)
  - Layer 4 execution body (bmad-layer4-speckit-specify/plan/gaps/tasks/implement)
  - Unified auditor host runner (`runAuditorHost`)
  - handoff protocol
- Cursor Canonical Base, Claude Runtime Adapter, and Repo Add-ons must not be mixed into a rewritten version of prompt from unknown sources.

## Deferred Gaps Governance Addendum

This distributed English variant must preserve the same Deferred Gaps contract as `SKILL.md`.

- `specify` must import inherited gaps into `Inherited Deferred Gaps` and `Deferred Gap Intake Mapping`, and maintain `deferred-gap-register.yaml`.
- `plan` must map every active gap to architecture/work items/journeys/production paths in `Deferred Gap Architecture Mapping`.
- `IMPLEMENTATION_GAPS` must classify inherited and newly discovered gaps explicitly.
- `tasks` must keep `Deferred Gap Task Binding` and `Journey -> Task -> Test -> Closure`, including `Smoke Task Chain` and `Closure Task ID`.
- `implement` / `dev-story` must read `deferred-gap-register.yaml`, `journey-ledger`, `trace-map`, and `closure-notes`, then write `closure_evidence` or `carry_forward_evidence`.
- Completion claims are invalid when the module is complete but the journey is not runnable.

---

## Cursor Canonical Base

The following content is inherited from Cursor `speckit-workflow` and belongs to the business semantic baseline. The Claude version is not allowed to rewrite its intention without authorization:

### Stage model

> 🚨 **Mandatory constraints - cannot be skipped**
> Must be executed in order: constitution → specify → plan → GAPS → tasks → execute. Each stage must pass the code-review audit before entering the next stage. Skipping any stage or audit is strictly prohibited!

This skill defines **constitution → spec.md → plan.md → IMPLEMENTATION_GAPS.md → tasks.md → tasks execution** Mandatory steps in each phase: constitution establishes project principles; the documentation phase is **requirements mapping form** + **code-review audit cycle** (until the audit is passed); the execution phase is **TDD red light-green light-refactoring cycle** + **15 iron rules** (until all tasks are completed).

### Quick Decision Guide

#### When to use this skill
- The technical implementation plan has been clarified and a detailed execution plan is required
- Existing Story document needs to be converted into technical specifications
- Requires TDD traffic light model to guide development

#### When to use bmad-story-assistant
- The complete process needs to start with Product Brief
- Requires PRD/Architecture depth generation
- Requires Epic/Story planning and splitting
- Not sure about the technical solution and need to discuss the solution selection

#### The relationship between the two
This skill is the technical implementation layer nesting process of bmad-story-assistant.
When bmad-story-assistant is executed to "Phase 3: Dev Story Implementation", the complete process of this skill will be triggered.

### Baseline semantics that must be preserved

- The master agent must not bypass any stage
- The output of each stage must pass the audit before entering the next stage
- constitution must be completed before specifying
- The code-review skill must be explicitly called in the audit closed loop
- It is prohibited to self-declare that the audit has passed
- TDD sequence (red light → green light → refactoring) cannot be skipped
- Enhanced commands must be embedded in the corresponding audit closed-loop iteration for execution
- ralph-method (prd/progress file) forced fronting

### Content that does not belong to Cursor Canonical Base
The following content is prohibited from being written to Cursor Base and should be placed in Runtime Adapter or Repo Add-ons:
- Specific agent name of Claude/OMC
- `auditor-spec` / `auditor-plan` / `auditor-gaps` / `auditor-tasks` / `auditor-implement`
- Warehouse local scoring, forbidden words, critical auditor format, state update details

---

## Claude/OMC Runtime Adapter

This section defines how Cursor semantics are implemented in Claude Code CLI/OMC.

### Stage Routing Map

| Cursor stage | Claude entry/execution body | Description |
|------|------|------|
| constitution | Main Agent executes directly | No independent sub-agent requirements |
| specify (§1.2 Audit) | `.claude/agents/auditors/auditor-spec.md` | primary |
| plan (§2.2 Auditing) | `.claude/agents/auditors/auditor-plan.md` | primary |
| GAPS (§3.2 Auditing) | `.claude/agents/auditors/auditor-gaps.md` | primary |
| tasks (§4.2 Auditing) | `.claude/agents/auditors/auditor-tasks.md` | primary |
| implement (§5.2 Auditing) | `.claude/agents/auditors/auditor-implement.md` | primary |
| Layer 4 specify | `.claude/agents/layers/bmad-layer4-speckit-specify.md` | Optional executable |
| Layer 4 plan | `.claude/agents/layers/bmad-layer4-speckit-plan.md` | Optional executable |
| Layer 4 gaps | `.claude/agents/layers/bmad-layer4-speckit-gaps.md` | Optional executable |
| Layer 4 tasks | `.claude/agents/layers/bmad-layer4-speckit-tasks.md` | Optional executable |
| Layer 4 implement | `.claude/agents/layers/bmad-layer4-speckit-implement.md` | Optional executable body |
| speckit-implement | `.claude/agents/speckit-implement.md` | Dev Story implementation |

### Primary Executors

- During the audit phase, the auditor agent defined by the warehouse is preferred:
  - spec audit → `auditor-spec`
  - plan audit → `auditor-plan`
  - GAPS audit → `auditor-gaps`
  - tasks audit → `auditor-tasks`
  - implement audit → `auditor-implement`
- Layer 4 execution body is used for document generation at each stage
- Use `speckit-implement.md` during the implementation phase

### Execution body calling specification (Architecture D2)

All execution bodies use `subagent_type: general-purpose`, and the main Agent passes in the entire `.claude/agents/*.md` as the complete prompt.

#### CLI Calling Summary (must be output before each call to the subagent)

Before each call to a subagent, the master Agent must output the following 5-field summary:
```yaml
cli_calling_summary:
  input: <输入参数说明>
  template: <使用的模板/agent 文件路径>
  output: <预期产出>
  fallback: <降级方案>
  acceptance: <验收标准>
```
#### YAML Handoff (output at the end of each stage)

After each stage, the main Agent must output YAML Handoff:
```yaml
handoff:
  execution_summary: <本阶段执行结果摘要>
  artifacts:
    - path: <产出文件路径>
      status: <created/updated/verified>
  next_steps:
    - <下一步操作描述>
```
### Fallback Strategy

Unified fallback strategy (4-layer Fallback, audit type):

1. **Layer 1 — Primary Executor**: Use the auditor agent defined by the warehouse (such as `.claude/agents/auditors/auditor-spec.md`), call it through the Agent tool + `subagent_type: general-purpose`, and pass the entire main Agent into the agent file as a complete prompt
2. **Layer 2 — OMC Reviewer**: If the primary executor is unavailable, fall back to `oh-my-claudecode:code-reviewer` or OMC reviewer
3. **Layer 3 — Code-Review Skill**: If OMC reviewer is unavailable, fall back to `code-review` skill or equivalent capabilities
4. **Layer 4 — Main Agent directly executes**: If none of the above are available, the main Agent directly executes the audit, using the corresponding chapter in `references/audit-prompts.md` as a checklist

#### Fallback Downgrade Notice (FR26)

**When Fallback is triggered, the main Agent must display the currently used execution body level to the user** in the following format:
```
⚠️ Fallback 降级通知：当前审计使用 Layer N 执行体（{执行体名称}）
   原因：{降级原因}
   影响：审计标准不变，仅执行器不同
```
Example:
- `⚠️ Fallback downgrade notification: The current audit uses Layer 2 executor (OMC reviewer)`
- `⚠️ Fallback downgrade notification: The current audit uses Layer 4 execution body (directly executed by the main Agent)`

### Fallback constraints

fallback is only allowed to change the executor, not:
- Cursor Canonical Base
-Repo Add-ons
- Output format
- Rating block
- Auditing standards
- handoff / state update rules

### Runtime Contracts

All stages must adhere to the following runtime contracts:

- Handoff information must be maintained:
  - `artifactDocPath`
  - `reportPath`
  - `iteration_count`
  - `next_action`
- Must be triggered after passing the audit:
  - `run-auditor-host.ts`
  - Audit pass mark
  - Status updates
- execution_summary must contain:
  - current stage
  - Audit results
  - Output file path
  - Next steps

---

## Repo Add-ons

The following content is an additional enhancement to the warehouse and does not belong to the original semantics of Cursor.

### Audit enhancement
- Forbidden word check
- Critique auditor output format
- `No new gap in this round / There is a gap in this round`
- strict convergence (such as implement 3 consecutive rounds without gaps)

### Rating and storage enhancements
- `run-auditor-host.ts`
- `iteration_count`
- `iterationReportPaths`
- Parsable scoring block requirements

### Configure system integration
- `_bmad/_config/scoring-trigger-modes.yaml`
- `_bmad/_config/code-reviewer-config.yaml`
- `_bmad/_config/eval-lifecycle-report-paths.yaml`

---

## §0.5 After executing constitution (project principles)

**Commands that must be executed**: `/speckit.constitution` or `.speckit.constitution` (executed in the project or function directory, **must be completed before specify**)

### 0.5.1 must be completed

- Establish **Project Principles**: technology stack, coding standards, architectural constraints, prohibited matters, etc.
- Outputs **constitution.md** or **.specify/memory/constitution.md** or **.speckit.constitution**.
- Ensure that each stage of specify, plan, and tasks refers to the principles in the constitution as the basis for constraints.

### 0.5.2 Audit closed loop

- After the constitution is generated, it is **recommended** to call the code-review skill according to the §0 convention to check whether it contains project principles, technology stacks, constraints, etc.; **If the project does not have a special constitution audit prompt word, you can use a general document integrity check**.
- If it fails: iteratively modify the constitution based on the audit report until the integrity requirements of the project principles are met.

---

## §0 Skill dependency: code-review calling convention (must be followed for audit closed loop)

**This skill depends on the code-review skill**. All audit closed-loop steps (§0.5.2, §1.2, §2.2, §3.2, §4.2, §5.2) must **explicitly call the code-review skill** and may not be replaced by self-review or announced in advance. §0.5.2 General document integrity checks are optional.

### 0.1 Calling method

### Code-Review calling strategy

**Priority Strategy (Claude Code CLI)**:
1. Check whether there is an auditor agent for the corresponding stage under `.claude/agents/auditors/`
2. If it exists, use the Agent tool + `subagent_type: general-purpose` to schedule the corresponding auditor for auditing
3. Prompt words use `references/audit-prompts.md` corresponding to the chapter

**Fallback strategy (4 layers Fallback)**:
1. If the auditor agent is unavailable, fall back to the OMC reviewer
2. If OMC reviewer is unavailable, fall back to `code-review` skill
3. If the code-review skill is unavailable, the main Agent executes it directly
4. Each downgrade must output a Fallback downgrade notification (FR26) to inform the user of the current execution body level.

### 0.1.1 Skill binding rules when sub-Agent executes code-review

When initiating a code-review audit via the Agent tool, **must** be observed:

1. **Check available skills**: Before initiating a sub-Agent, check whether there are skills named `code-review`, `code-reviewer`, `requesting-code-review` or the function description contains "code review" or "code review" in the current environment.
2. **Forced binding of skills**: If there is a skill with the same name or similar function as mentioned above, the sub-Agent's prompt must clearly instruct it to read and follow the workflow of the skill (for example, add "Please read and follow the workflow of the code-review skill first" at the beginning of the prompt or attach the skill through `@code-review`).
3. **Naked auditing is prohibited**: **Prohibited** When the code-review skill is available, the sub-agent only performs auditing based on its own capabilities without loading the skill - this will lead to inconsistent audit standards and the omission of audit check items defined in the skill.
4. **Downgrade when no skills are available**: If the current environment does not have any code-review related skills, the sub-Agent can independently perform the audit according to the prompt words in audit-prompts.md, but **must** indicate "code-review skills not detected, use built-in audit standards" at the beginning of the audit report.

### 0.2 Prohibited matters
- **Prohibited** self-declaring "complete coverage and verification passed" without calling the code-review skill.
- **It is prohibited** to combine "review + modification" into one step and directly give a passing conclusion; it must first **audit → report → modify if it fails → audit again**.
- **Disabled** In the case where the code-review (or the skill with the same name/similar function) is available, the sub-Agent performs auditing without loading the skill (see §0.1.1).

### 0.3 Iteration rules

- If the conclusion of the code-review audit report is **failed**: **The audit sub-agent must directly modify the audited document** in this round to eliminate the gap. After the modification is completed, a report will be output and the modified content will be noted; the main Agent will initiate the next round of audit after receiving the report. It is prohibited to only output modification suggestions without modifying the document. See [audit-document-iteration-rules.md](references/audit-document-iteration-rules.md) for details.
- **Only when** the code-review audit report clearly states "complete coverage, verification passed", this step can be ended.

---

## 1. After executing specify (spec.md)

**Commands that must be executed**: `/speckit.specify` or `.speckit.specify` (executed in the function directory or specs directory; **Precondition**: constitution has been generated)

### 1.0 spec directory path convention (BMAD and standalone dual-track system)

**BMAD process** (when speckit is triggered by bmad-story-assistant nesting):
- Path format: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/`
- **epic-slug is required**, source: the Title of `### Epic N: Title` in epics.md is converted to kebab-case, or derived from create-new-feature.ps1; it is forbidden to use `specs/epic-{epic}/` without slug path.
- **story slug is required** to ensure the readability of the directory; if omitted, it will result in pure numeric names such as `specs/epic-4/story-1/`, which has poor readability.
- Example: `specs/epic-11-speckit-template-offline/story-1-template-fetch/`
- Output file names: `spec-E{epic}-S{story}.md`, `plan-E{epic}-S{story}.md`, `tasks-E{epic}-S{story}.md`, `IMPLEMENTATION_GAPS-E{epic}-S{story}.md`

**Slug source rules** (by priority, if it cannot be deduced, the user is required to provide it explicitly):
| Priority | Source | Example |
|--------|------|------|
| 1 | Story document title (take the first few words and convert to kebab-case) | "Implement base cache class" → `implement-base-cache` |
| 2 | Epic name (remove `feature-` prefix) | `feature-metrics-cache` → `metrics-cache` |
| 3 | Story scope Keywords in the first sentence (redirected to kebab-case) | "Basic implementation of cache service" → `cache-service-base` |
| 4 | Back to top | `E4-S1` as slug (guaranteed to be unique, least readable) |

**standalone process** (the user executes speckit directly without going through BMAD):
- Path format: `specs/{index}-{feature-name}/`
- index is derived from Get-HighestNumberFromSpecs in create-new-feature.ps1
- Example: `specs/015-indicator-system-refactor/`

**fallback rules**: Without `--mode bmad` or `--epic`/`--story` parameters, use standalone behavior; with `--mode bmad`, `--slug` must be provided or derived from the Story document.

### 1.0.1 speckit-workflow output path convention

**All speckit-workflow related output must be placed in the spec subdirectory**:

| output | path | command |
|------|------|------|
| spec.md | `specs/{index}-{name}/spec.md` or `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | speckit.specify |
| plan.md | Same directory as above | speckit.plan |
| tasks.md | Same directory as above | speckit.tasks |
| IMPLEMENTATION_GAPS.md | Same directory as above | speckit.gaps |
| checklists/ | Same directory as above | speckit.specify |
| research.md, data-model.md, contracts/ | Same directory as above | speckit.plan |

**Forbidden**: Place speckit output in `_bmad-output` or elsewhere in the project root. For BMAD process output, see bmad-story-assistant and bmad-bug-assistant skill conventions.

### 1.0.3 Audit report path convention (failure round and iterationReportPaths, Story 9.4)

In each stage (spec/plan/gaps/tasks/implement) audit cycle, **each round of audit (including fail) must save the report to a path with round suffix**:
- **BMAD path**: `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`, N increasing from 1; example `AUDIT_spec-E9-S4_round1.md`
- **standalone**: `_orphan/AUDIT_{slug}_round{N}.md`
- **Verification round** (3 consecutive confirmation rounds without gaps) report** is not included in iterationReportPaths**, only the fail round and the final pass round participate in the collection
- **run_id** must be stable within the stage audit cycle. It is generated once by the main Agent at the beginning of the cycle and reused.
- **pass**: The main agent collects all fail round report paths of this stage and passes in `--iterationReportPaths path1, path2,...` (comma separated); it is not passed when it passes once or there is no fail round.

### 1.0.4 BMAD output corresponds to the _bmad-output subdirectory
The speckit output is in the spec subdirectory; the BMAD output is in `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`.
When the spec path is `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/`, the corresponding BMAD subdirectory is `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`.

### 1.1 Must be completed

- Compare **original requirements/design document** with generated **spec.md**.
- Add **Requirements Mapping List Table** in **spec.md** according to the original requirements document **chapter by chapter, item by item**. For fixed templates of table headers and column names, see [references/mapping-tables.md](references/mapping-tables.md) §1.

- Ensure that **each chapter and each item** of the original requirements document has a clear correspondence in spec.md and is marked with coverage status.

### 1.2 Audit closed loop

**Strength**: **standard** (single + critical auditor), see [references/audit-prompts-critical-auditor-appendix.md](references/audit-prompts-critical-auditor-appendix.md).

- After generating or updating spec.md, **the code-review skill** must be called according to the convention in §0, using the **fixed audit prompt word**: [references/audit-prompts.md](references/audit-prompts.md) §1.

**Claude execution body call**:
1. Read `.claude/agents/auditors/auditor-spec.md`
2. Use Agent tool + `subagent_type: general-purpose` to initiate audit subtask
3. Pass in the full text of auditor-spec.md as prompt, and append: audit object path, report saving path after the audit passes
4. If auditor-spec is unavailable, press Fallback Strategy to downgrade and output the downgrade notification.

- **This step can only be ended** when** the code-review audit report conclusion is "fully covered and verified".
- #### Unified host close-out after the audit passes (mandatory)
  - **Report Path**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md` (epic/story/epic-slug is resolved from the current spec path).
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **Unified entry**: after the audit passes, the main Agent must not hand-run `bmad-speckit score` or `update-runtime-audit-index`; it must call `runAuditorHost` as the single post-audit entry.
  - **Separation of responsibilities**: the code-review sub-agent only persists the audit report to the agreed path; the main Agent invokes `runAuditorHost` after receiving the passing conclusion. Read `scoring_write_control.enabled` from `_bmad/_config/scoring-trigger-modes.yaml`; execute when enabled. **iteration_count passing (mandatory)** remains the same as §1.2: pass the cumulative number of failed rounds for this stage; first-pass success uses 0; verification rounds in the “3 consecutive no-gap” check do not increment `iteration_count`; omit nothing; when `eval_question` lacks `question_version`, record `SCORE_WRITE_INPUT_INVALID` and do not call; host failure is non-blocking and the resultCode must be recorded in audit evidence.
- If it fails: **Iteratively modify spec.md** (complete mapping table, complete missing chapters) based on the audit report, **call code-review** again until the report conclusion is passed.

---

## 2. After executing plan (plan.md)

**Commands that must be executed**: `/speckit.plan` or `.speckit.plan` (in the function directory, execute after spec.md has been generated)

**Pre-step (anchored §1.2 spec audit closed loop)**: When the §1.2 spec audit report indicates that "spec has ambiguous expressions", `/speckit.clarify` or `.speckit.clarify` must be executed within the **§1.2 iteration** to clarify → update spec.md → **call §1.2 audit** again, and then execute it until it passes plan; cannot be skipped in scenarios that should be executed on the grounds of "optional".

### 2.1 Must be completed

- Compare the **original requirements design document**, **spec.md** and the generated **plan.md**.
- Add **Requirements Mapping List Table** in **plan.md** according to the original requirements document and spec.md **chapter by chapter, item by item**. For fixed templates of table headers and column names, see [references/mapping-tables.md](references/mapping-tables.md) §2.
- Ensure that the requirements document clearly corresponds to each chapter and item of spec.md in plan.md.

**Integration and end-to-end test plan (required)**

- plan.md **must** contain **complete integration testing and end-to-end functional testing plans**, covering inter-module collaboration, production code critical paths, and user-visible functional processes.
- **Strictly Prohibited** The test plan only contains unit tests; unit tests are a necessary supplement, but must not be used as the only means of verification.
- **It is strictly prohibited** to have a situation where "the module's internal implementation is complete and can pass unit tests, but it has never been imported, instantiated or called in the production code critical path" - the test plan must verify that each module is indeed imported and called by the production code critical path.

### 2.2 Audit closed loop

**Strength**: **standard** (single + critical auditor), see [references/audit-prompts-critical-auditor-appendix.md](references/audit-prompts-critical-auditor-appendix.md).

- After generating or updating plan.md, **the code-review skill** must be called according to the convention in §0, using the **fixed audit prompt word**: [references/audit-prompts.md](references/audit-prompts.md) §2.

**Claude execution body call**:
1. Read `.claude/agents/auditors/auditor-plan.md`
2. Use Agent tool + `subagent_type: general-purpose` to initiate audit subtask
3. Pass in the full text of auditor-plan.md as prompt
4. If auditor-plan is unavailable, press Fallback Strategy to downgrade and output the downgrade notification.

- **This step can only be ended** when** the code-review audit report conclusion is "fully covered and verified".
- #### Unified host close-out after the audit passes (mandatory)
  - **Report Path**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md`.
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **Unified entry**: after the audit passes, the main Agent calls `runAuditorHost`; it no longer hand-builds a plan-stage score / auditIndex CLI sequence.
  - **Separation of responsibilities**: the code-review sub-agent produces the report and persists it; the main Agent invokes `runAuditorHost` after the passing conclusion. Same `iteration_count` rule and non-blocking failure handling as §1.2.
- If it fails: **iterately modify plan.md** based on the audit report, **call code-review** again, until the report conclusion is passed.
- **Embedding step (must be executed when the plan involves multiple modules or complex architecture)**: After the plan audit passes and before the end of this step, **must execute `/speckit.checklist` or `.speckit.checklist` as part of the §2.2 audit step** - generate a quality checklist to verify the completeness, clarity and consistency of requirements; if the checklist finds problems, plan.md must be iteratively modified and **execute the code-review audit** again until the checklist Verification passed; cannot be skipped in scenarios that should be executed on the grounds of "optional".

### Plan stage optional Party-Mode

Party-mode can be started in the plan phase when the following situations occur:
1. Users clearly request in-depth discussion of technical solutions
2. Technical disputes that were not fully resolved during the Create Story stage
3. Involving major architectural decisions (such as database selection, service splitting)

**Start command**:
```
进入 party-mode 讨论技术方案，建议 50 轮
```
**Character setting**:
- Winston (Architect)
- Amelia (Developer)
- Quinn (test)
- Critical Auditor (new, mandatory participation)

**Convergence conditions**:
1. All roles reach consensus
2. No new technology gaps have been proposed in the past three rounds.
3. Meet the minimum number of debate rounds (50 rounds)

---

## 3. Before generating tasks (IMPLEMENTATION_GAPS.md)

**Triggering method**: No independent command. After plan.md has passed the audit, the **model must automatically perform in-depth analysis**: compare plan.md, the original requirements document and the current implementation, compare the differences chapter by chapter, and generate IMPLEMENTATION_GAPS.md. It is also triggered when the user requests "Generate IMPLEMENTATION_GAPS" or "Generate GAPS".

### 3.1 Must be completed

- Based on **current implementation** and **original requirements design document**, analyze the differences **chapter by chapter and item by item** to generate **IMPLEMENTATION_GAPS.md**.
- **If the user explicitly provides more reference documents** (such as separate architectural design documents, design instructions, etc.), **must** analyze the differences **chapter by chapter, item by item** at the same time to ensure that all given reference documents** are used as valid inputs to participate in gap analysis.
- The document structure must list each Gap according to requirements document (and all reference documents) chapters, and indicate: requirements/design chapters, current implementation status, and description of missing/deviations. For the Gap list header template, see [references/mapping-tables.md](references/mapping-tables.md) §3.

### 3.2 Audit closed loop

**Strength**: **standard** (single + critical auditor), see [references/audit-prompts-critical-auditor-appendix.md](references/audit-prompts-critical-auditor-appendix.md).

- After generating or updating IMPLEMENTATION_GAPS.md, **the code-review skill** must be called according to the convention in §0, using the **fixed audit prompt word**: [references/audit-prompts.md](references/audit-prompts.md) §3.

**Claude execution body call**:
1. Read `.claude/agents/auditors/auditor-gaps.md`
2. Use Agent tool + `subagent_type: general-purpose` to initiate audit subtask
3. Pass in the full text of auditor-gaps.md as prompt
4. If auditor-gaps is unavailable, press Fallback Strategy to downgrade and output the downgrade notification.

- **This step can only be ended** when** the code-review audit report conclusion is "fully covered and verified".
- #### Unified host close-out after the audit passes (mandatory)
  - **Report Path**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_GAPS-E{epic}-S{story}.md`.
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **Unified entry**: after the audit passes, the main Agent calls `runAuditorHost`; it no longer hand-builds a gaps-stage score / auditIndex CLI sequence.
  - **Separation of responsibilities**: the code-review sub-agent produces the report and persists it; the main Agent invokes `runAuditorHost` after the passing conclusion. The GAPS report format remains compatible, but the host now routes it as `stage=gaps`. Same `iteration_count` rule and non-blocking failure handling as §1.2.
- If it fails: **iterately modify IMPLEMENTATION_GAPS.md** based on the audit report, **call code-review** again, until the report conclusion is passed.

---

## 4. When executing tasks or generating tasks-related md (tasks.md)

**Commands that must be executed**: `/speckit.tasks` or `.speckit.tasks` or the user explicitly requests "Generate tasks" "Generate tasks.md" (executed after IMPLEMENTATION_GAPS.md has been generated)

### 4.1 Must be completed

- Generate **tasks.md** against **original requirements design document**, **plan.md**, **IMPLEMENTATION_GAPS.md**.
- Use the project **tasks template**: `docs/speckit/tasks-template/tasks-template.md` (or the template path agreed within the project).
- Add **Requirements Mapping List Table** in **tasks.md** according to the original requirements document, plan.md, IMPLEMENTATION_GAPS.md **chapter by chapter, item by item**; see [references/mapping-tables.md](references/mapping-tables.md) for headers and column names §4–§8; see Agent execution rules, requirements traceability format, acceptance standards and acceptance execution rules [references/tasks-acceptance-templates.md](references/tasks-acceptance-templates.md).

**Integration and end-to-end test cases (required)**

- tasks.md **must** contain **integration testing and end-to-end functional testing tasks and use cases** for each functional module/Phase to verify the integrity of inter-module collaboration and user-visible functional processes on the critical path of production code.
- It is **strictly prohibited** for acceptance criteria to rely solely on unit tests; each module's acceptance **must** also include integrated verification that "the module is imported, instantiated, and called in the critical path of the production code."
- **Strictly Prohibit** Tasks that "the module's internal implementation is complete and can pass unit tests, but has never been imported, instantiated, or called in the production code critical path" are marked as completed.

### 4.2 Audit closed loop

**Strength**: **standard** (single + critical auditor), see [references/audit-prompts-critical-auditor-appendix.md](references/audit-prompts-critical-auditor-appendix.md).

- After generating or updating tasks.md, **the code-review skill** must be called according to the convention in §0, using the **fixed audit prompt word**: [references/audit-prompts.md](references/audit-prompts.md) §4.

**Claude execution body call**:
1. Read `.claude/agents/auditors/auditor-tasks.md`
2. Use Agent tool + `subagent_type: general-purpose` to initiate audit subtask
3. Pass in the full text of auditor-tasks.md as prompt
4. If auditor-tasks are unavailable, press Fallback Strategy to downgrade and output the downgrade notification.

- **This step can only be ended** when** the code-review audit report conclusion is "fully covered and verified".
- #### Unified host close-out after the audit passes (mandatory)
  - **Report Path**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md`.
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **Unified entry**: after the audit passes, the main Agent calls `runAuditorHost`; it no longer hand-builds a tasks-stage score / auditIndex CLI sequence.
  - **Separation of responsibilities**: the code-review sub-agent produces the report and persists it; the main Agent invokes `runAuditorHost` after the passing conclusion. Same `iteration_count` rule and non-blocking failure handling as §1.2.
- If it fails: **iterately modify tasks.md** based on the audit report, **call code-review** again, until the report conclusion is passed.
- **Embedded step (must be executed when the number of tasks is ≥10 or spans multiple artifacts)**: After the tasks audit is passed and before the end of this step, **must execute `/speckit.analyze` or `.speckit.analyze` as part of the §4.2 audit step** - do cross-artifact consistency analysis (alignment report of spec, plan, tasks, etc.); if analyze finds problems, tasks.md must be iteratively modified and **execute code-review again Audit** until the analyze verification is passed; it cannot be skipped in scenarios where it should be executed on the grounds of "optional".

### Task batch execution mechanism

When the number of tasks in tasks-E{epic}-S{story}.md exceeds 20, they must be executed in batches: (20 is the experience threshold, taking into account single-batch manageability and audit cost; it can be overridden through configuration)

**Batching Rules**:
- Maximum of 20 tasks per batch
- Conduct code-review audit after each batch execution
- The next batch can only start after the audit is passed.

**Execution Process**:
```
Batch 1: Task 1-20 → 执行 → code-review 审计 → 通过
Batch 2: Task 21-40 → 执行 → code-review 审计 → 通过
...
Batch N: Task ... → 执行 → code-review 审计 → 通过
```
**Checkpoint audit content**:
1. Are all tasks in this batch completed?
2. Are all tests passed?
3. Are there any remaining issues that will affect the next batch?
4. Whether subsequent batch plans need to be adjusted

**Exception handling**:
- If a batch fails to pass the audit, re-audit the batch after repair
- If two consecutive batches of audits fail, pause and evaluate the overall plan

### Audit quality rating (A/B/C/D)

Since party-mode is not mandatory at all stages of speckit, quality assurance is compensated through audit quality ratings:

| Rating | Meaning | Treatment |
|-----|------|---------|
| **Grade A** | Excellent, fully meets the requirements | Go directly to the next stage |
| **Level B** | Good, minor problem | Record the problem, **complete the repair within the audit closed loop at this stage** and then enter the next stage; it is prohibited to use vague expressions such as "follow-up" and "to be determined" |
| **Level C** | Passed, needs to be revised | Must be revised and re-audited |
| **Grade D** | Failed, serious problem | Return to the previous stage for redesign |

**Rating Dimensions**:
1. Completeness (30%): Whether all demand points are covered
2. Correctness (30%): Is the technical solution correct?
3. Test verification (25%): production code integration test verification, new code coverage ≥85%
4. Quality (15%): Is the code/document quality up to standard?

**Forced upgrade rules**:
- Rated C level for two consecutive stages, and forced to enter party-mode in the third stage
- If any stage is rated D, you must review it and consider returning to Layer 3 to create Story again.

---

## 5. Execute tasks in tasks.md (TDD traffic light mode)

**Commands that must be executed**: `/speckit.implement` or `.speckit.implement` or the user explicitly requests "execute tasks.md", "execute tasks" and "complete the tasks in tasks"

When a user requests execution of an unfinished task in tasks.md (or tasks-v*.md), **must** progress through the TDD red light-green light-refactoring cycle, task by task.

**[Execution Sequence]** Each task involving production code: first write/make up the test and run the acceptance test if it fails (red light); then write the production code and make it pass (green light); finally refactor and record. It is forbidden to write production code first and then add tests.

### 5.1 Execution process

1. **Read tasks.md** (or tasks-v*.md) and identify all outstanding tasks (`[ ]` checkbox).
2. **【ralph-method forced prefix】Create prd and progress tracking files**:
   - If `prd.{stem}.json` and `progress.{stem}.txt` do not exist in the same directory as tasks or in `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`, they **must** be created before starting any task;
   - stem is the tasks document stem (such as tasks-E1-S1 → `tasks-E1-S1`; when there is no BMAD context, use the tasks file name stem);
   - The prd structure must conform to the ralph-method schema, mapping the acceptable tasks in tasks to US-001, US-002... (or one-to-one correspondence with the tasks number);
   - **progress pre-fills TDD slots**: When generating progress, the following placeholder lines are pre-filled for each US; US involving production code is pre-filled `[TDD-RED] _pending_`, `[TDD-GREEN] _pending_`, `[TDD-REFACTOR] _pending_`; US only for documentation/configuration is pre-filled `[DONE] _pending_`. Replace `_pending_` with the actual result when executing (e.g. `[TDD-RED] T1 pytest ... => N failed`);
   - Output path: the same directory as tasks, or `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/` (in BMAD process);
   - **DO NOT** start coding or perform tasks involving production code without creating the above files.
3. **Read the pre-requisite documents**: requirements document, plan.md, IMPLEMENTATION_GAPS.md, and understand the technical architecture and demand scope.
4. **Use TodoWrite** to create a task tracking list, and the first task is marked `in_progress`.
5. **Execute TDD loop task by task** (**Each US must be executed independently**, it is prohibited to only execute TDD on the first US and then skip the red light for subsequent US directly):
   - **Red light**: Write/supplement test cases covering the current task acceptance criteria, and run to confirm **test failure** (verify test validity).
   - **Green Light**: Write the minimum amount of production code to make the test pass.
   - **Refactoring**: Check and optimize code quality (SOLID, naming, decoupling, performance) under test protection. **Regardless of whether there is a specific refactoring action, the `[TDD-REFACTOR]` line must be recorded in progress**; if there is no specific refactoring, write "No need to refactor ✓", and for integration tasks, write "No new production code, the independence of each module has been verified, and no cross-module refactoring ✓".
6. **Update immediately after completion** Checkbox `[ ]` → `[x]` in tasks.md, TodoWrite marks `completed`.
7. **Checkpoint verification**: When a checkpoint is encountered, verify that all prerequisite tasks have been completed and perform regression testing.
7.1. **lint (required)**: Every time a batch of tasks is completed or before all tasks are completed, the project must execute Lint according to the technology stack (see lint-requirement-matrix); if a mainstream language is used but Lint is not configured, it must be repaired; configured ones must be executed without errors or warnings. Exemptions on the grounds of "not relevant to this mission" are prohibited.
8. **Loop** until all tasks are completed, early stopping is prohibited.

### 5.1.1 Mapping convention between tasks and prd

- When tasks use T1, T2, T1.1, T1.2 and other formats: T1 can be mapped to US-001, T1.1–T1.n as subtasks of US-001; or top-level tasks T1–T5 can be mapped to US-001–US-005;
- The userStories of prd must correspond one-to-one with the acceptable tasks in tasks or be traceable;
- The specific mapping strategy is determined by the execution agent when generating prd, but it must be ensured that each acceptable task in tasks has a corresponding US in prd and the acceptance criteria are consistent.

### TDD traffic light record format (unified with bmad-story-assistant)

**Uniform format template**:
```markdown
## Task X: 实现 YYY 功能

**红灯阶段（YYYY-MM-DD HH:MM）**
[TDD-RED] TX pytest tests/test_xxx.py -v => N failed
[错误信息摘要]

**绿灯阶段（YYYY-MM-DD HH:MM）**
[TDD-GREEN] TX pytest tests/test_xxx.py -v => N passed
[实现要点摘要]

**重构阶段（YYYY-MM-DD HH:MM）**
[TDD-REFACTOR] TX [重构操作描述 | 无需重构 ✓ | 集成任务: 无新增生产代码，各模块独立性已验证 ✓]
[优化点摘要]

**更新 ralph-method 进度**
- prd.md: US-00X passes=true
- progress.md: 添加 TDD 记录链接
```
**Required fields**:
1. `[TDD-RED]` - marks the beginning of the red light phase
2. `[TDD-GREEN]` - marks the completion of the green light phase
3. `[TDD-REFACTOR]` - marks the reconstruction phase (the judgment results must be recorded, regardless of whether there is a specific reconstruction action; it is prohibited to omit this line)
4. `TX` - timestamp prefix
5. Test commands and results
6. ralph-method progress update

**Prohibited Matters**:
- Skip the red light stage and go directly to the green light
- Omit the refactoring phase
- Do not update ralph-method progress

### 5.2 Audit closed loop

**Strength rating** (reference [references/audit-post-impl-rules.md](references/audit-post-impl-rules.md)):
- **Inter-batch audit** (intermediate checkpoint after each batch of tasks is completed): **standard** (single + critical auditor), no need for 3 rounds.
- **Final §5.2 Audit** (total audit after all tasks have been performed): **strict**, must have 3 consecutive rounds with no gap + critical auditor >50%.

- After executing the tasks in tasks.md (TDD traffic light mode), **the code-review skill** must be called according to the convention in §0, using the **fixed audit prompt word**: [references/audit-prompts.md](references/audit-prompts.md) §5.

**Claude execution body call**:
1. Read `.claude/agents/auditors/auditor-implement.md`
2. Use Agent tool + `subagent_type: general-purpose` to initiate audit subtask
3. Pass in the full text of auditor-implement.md as prompt
4. If auditor-implement is unavailable, press Fallback Strategy to downgrade and output the downgrade notification.

- **batch time**: A single pass is enough and the critical auditor section is qualified; **Final audit**: 3 consecutive rounds of convergence without gaps are required. For details, see audit-post-impl-rules.
- Before initiating the second and third rounds of audits, the main Agent can output "Nth round of audit passed, continue verification..." to prompt the user.
- #### Unified host close-out after the audit passes (mandatory)
  - **Report Paths**: `{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/AUDIT_implement-E{epic}-S{story}.md` (consistent with _bmad/_config/eval-lifecycle-report-paths.yaml); stage=implement (Story 9.2 extension).
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **Unified entry**: after the audit passes, the main Agent calls `runAuditorHost`; it no longer hand-builds an implement-stage score / auditIndex CLI sequence.
- **Separation of responsibilities**: The code-review sub-agent produces and persists the audit report; the main Agent invokes `runAuditorHost` after the passing conclusion; failure remains non-blocking and the resultCode must be recorded as audit evidence. **iteration_count passing (mandatory)** stays unchanged: pass the cumulative number of failed rounds for this stage; pass 0 on first-pass success. In the **standalone speckit** process (without epic/story), the main Agent still passes `--iteration-count {cumulative value}` to the host runner.
- If it fails: **Iteratively execute the tasks in tasks.md** that have not passed the audit according to the audit report, **call code-review** again until the report conclusion is passed.

**Integration and end-to-end test execution (required)**

- The execution phase **must** run integration tests and end-to-end functional tests to verify that inter-module collaboration and user-visible functional processes work properly on the critical path of the production code. **Strictly Prohibited** Simply run unit tests and declare completion.
- **Must** verify that each newly added or modified module** is indeed imported, instantiated and called** by the production code critical path (for example: grep the production code import path, check whether the UI entry is mounted, check whether the Engine/main process is actually called).
- When a module is found that is internally complete and unit-testable, but has never been imported, instantiated, or called in the production code critical path, it must be reported and fixed as a failure rather than marked as passing.

### 5.3 Key constraints (summary of 15 iron laws)

The complete constraint rules must be followed during execution, see [references/task-execution-tdd.md](references/task-execution-tdd.md) for details. Core points:

**Architecture and Requirements Fidelity**
- Implementation shall be strictly carried out in accordance with the documented technical architecture and selection. Unauthorized modifications are strictly prohibited.
- Implement strictly in accordance with the documented requirements and functional scope, and it is **prohibited** to deviate from the requirements on the grounds of minimum implementation.

**Fake implementation prohibited**
- **Prohibit** false completion, false implementation, and placeholder implementation.
- **forbidden** marks completion but the function is not actually called or used in the critical path.

**Testing and Regression**
- Actively repair test scripts, and avoid evading them on the grounds that they are irrelevant.
- Proactively conduct regression testing and avoid covering up functional rollback issues.

**Process Integrity**
- Long-running scripts such as pytest use `block_until_ms: 0` and poll `terminals/` to check the results.
- For reference design, view the pre-requirements document/plan document/IMPLEMENTATION_GAPS document.
- Stopping development work until all outstanding tasks are actually implemented and completed is **prohibited**.

---

## 6. Agent execution rules (plan.md / tasks.md must comply)

When generating plan.md and tasks.md, in addition to the above mapping and auditing, the following Agent execution rules must be followed (consistent with QA_Agent task execution best practices §397–409):

**Prohibited Matters**

1. It is forbidden to add "Note: Will be in subsequent iterations..." in the task description.
2. It is forbidden to mark the task as completed but the function is not actually called.
3. It is forbidden to just initialize an object without using it in the critical path.
4. It is prohibited to use words such as "reserved" and "placeholder" to circumvent implementation.
5. **BANNED** Modules whose internal implementation is complete and can pass unit tests, but have never been imported, instantiated, or called in the production code critical path ("island module" anti-pattern).
6. **Prohibited** Only use unit test acceptance tasks; integration testing and end-to-end functional testing are required acceptance items.

**Required**

1. The integration task must modify the production code path.
2. A verification command must be run to confirm that the feature is enabled.
3. When encountering a situation that cannot be completed, you should report blocking instead of delaying yourself.
4. Before implementing functions/configuration/UI related tasks, you must first retrieve and read the relevant chapters of the requirements document (§9 Requirements Traceability and Closed Loop).
5. Requirements traceability (required before implementation): question keywords, search scope, relevant chapters, summary of existing agreements, and whether the plan is consistent with the requirements.

### Enforcement description (responsibility for checking prohibited items)

**Prohibited items at each stage and person responsible for inspection**:

| Stage | Prohibited matters | Person responsible for inspection | Inspection method |
|-----|---------|-----------|---------|
| specify | pseudo-implementation | auditor-spec | code review |
| specify | scope creep | auditor-spec | compare Story documentation |
| plan | no test plan | auditor-plan | inspect plan-E{epic}-S{story}.md |
| plan | over-design | auditor-plan | architectural rationality assessment |
| GAPS | Missing critical gaps | auditor-gaps | Sanity check |
| tasks | task not executable | auditor-tasks | feasibility assessment |
| Execute | Skip TDD red light | bmad-story-assistant | Check TDD records |
| Execute | Omit refactoring | bmad-story-assistant | Check TDD records |

**Violation handling**:
1. First violation: warning and request for immediate correction
2. Repeated violations: suspend execution and return to the previous stage
3. Serious violations: record and report to BMad Master

**Exemption conditions**:
- By consensus in party-mode discussion
- Have clear reasons for ADR recording decisions
- Obtain critical auditor approval

**Ralph-Wiggum Law**

- It is forbidden to pretend to complete the task, to cover up the fact of pseudo-realization, and to avoid the task on the grounds that it takes too long.
- Exiting is prohibited until all tasks have been truly accepted and marked as completed.

For the complete Agent execution rules and requirements traceability format, see [references/qa-agent-rules.md](references/qa-agent-rules.md).

---

## 7. Process summary

**【Dev Story complete process - no steps can be skipped】**
```
Layer 3: Create Story
    →
Layer 4: speckit-workflow（constitution → specify → plan → GAPS → tasks → implement）
    →
Layer 5: 收尾与集成
```
| speckit stage | output | audit basis | bmad corresponding stage | Claude executor | description |
|----------------|------|---------|-------------|-------------|------|
| specify | spec-E{epic}-S{story}.md | audit-prompts.md §1 | Layer 4 start | auditor-spec | Technical specification Story content |
| plan | plan-E{epic}-S{story}.md | audit-prompts.md §2 | Layer 4 Continue | auditor-plan | Develop implementation plan |
| GAPS | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | audit-prompts.md §3 | Layer 4 continued | auditor-gaps | Identify implementation gaps |
| tasks | tasks-E{epic}-S{story}.md | audit-prompts.md §4 | Layer 4 Continue | auditor-tasks | Disassemble execution tasks |
| Execution | Runnable code | audit-prompts.md §5 | Layer 4 end | auditor-implement | TDD traffic light development |

**Document naming rules**: The output file name must contain the Epic serial number and Story serial number; the Epic name (such as feature-metrics-cache) is reflected in the path or document metadata. Example: Epic 4 Story 1 → spec-E4-S1.md, plan-E4-S1.md.

Each "iteration" is: **Call code-review skills according to the convention in §0** → Obtain the audit report → Modify the corresponding document if it fails → **Call code-review again** → Until the report conclusion is complete coverage and verification is passed. The same goes for the tasks execution phase: TDD traffic light cycle → task-by-task completion → checkpoint verification → **Press §0 to call the code-review skill** → until the report conclusion is passed.

---

## 8. Speckit process command index (must be executed)

| Stage | Commands that must be executed | Preconditions | Output | Audit basis | Claude executor |
|------|----------------|----------|------|----------|-------------|
| **0.constitution** | `/speckit.constitution` or `.speckit.constitution` | None (entry stage) | constitution.md or .specify/memory/constitution.md | Project customization or general document integrity | Main Agent direct execution |
| **1. specify** | `/speckit.specify` or `.speckit.specify` | constitution produced | spec.md | audit-prompts.md §1 | auditor-spec |
| **2. plan** | `/speckit.plan` or `.speckit.plan` | spec.md passed audit | plan.md | audit-prompts.md §2 | auditor-plan |
| **3. GAPS** | No independent commands; model automatic in-depth analysis or user requirements | plan.md passed audit | IMPLEMENTATION_GAPS.md | audit-prompts.md §3 | auditor-gaps |
| **4. tasks** | `/speckit.tasks` or `.speckit.tasks` or user request "generate tasks" | IMPLEMENTATION_GAPS.md passed audit | tasks.md | audit-prompts.md §4 | auditor-tasks |
| **5. Execute** | `/speckit.implement` or `.speckit.implement` or user request "Execute tasks" | tasks.md passed audit | Runnable code + test | audit-prompts.md §5 | auditor-implement |

**Command execution sequence**: 0 → 1 → 2 → 3 → 4 → 5, cannot be skipped. constitution must be completed before specify; the output of each stage must pass the code-review audit (§0) before entering the next stage.

**Enhanced command (must be embedded in the corresponding audit closed-loop iteration and executed as part of the audit step, and cannot be skipped as "optional")**:

| Command | Embed link | Trigger condition | Purpose |
|------|----------|----------|------|
| `/speckit.clarify` | **§1.2 spec audit within closed-loop iteration** | §1.2 The audit report pointed out that "there is a vague statement in the spec" | Clarify → Update spec → §1.2 Audit again |
| `/speckit.checklist` | **§2.2 plan within the audit closed loop** | plan involves multiple modules or complex architecture | as part of the §2.2 audit step; if problems are found, iterate the plan → audit again |
| `/speckit.analyze` | **§4.2 tasks within the audit closed loop** | tasks≥10 or across multiple artifacts | As part of the §4.2 audit step; if problems are found, iterate tasks → audit again |

**Command format description**:
- `/speckit.xxx`: Cursor/Claude slash commands (constitution, specify, plan, tasks, implement, clarify, analyze, checklist)
- `.speckit.xxx`: Triggered by point command or `.speckit.xxx` file in the project
- **GAPS has no independent command**: the model is automatically generated by in-depth analysis after the plan is passed; or triggered when the user requests "Generate IMPLEMENTATION_GAPS"

---

## 9. Fixed templates and reference files

| Purpose | Documentation |
|------|------|
| **Skill dependency** | **code-review** (or requesting-code-review): The audit loop must be called explicitly, see §0 |
| Audit prompt words (can be copied) | [references/audit-prompts.md](references/audit-prompts.md) |
| Mapping table column names and structures | [references/mapping-tables.md](references/mapping-tables.md) |
| Tasks acceptance and execution template | [references/tasks-acceptance-templates.md](references/tasks-acceptance-templates.md) |
| Agent execution rules (complete) | [references/qa-agent-rules.md](references/qa-agent-rules.md) |
| **Tasks execution TDD rules (complete)** | **[references/task-execution-tdd.md](references/task-execution-tdd.md)** |
| Post-implementation audit rules (strict) | [references/audit-post-impl-rules.md](references/audit-post-impl-rules.md) |
| audit_convergence configuration | [references/audit-config-schema.md](references/audit-config-schema.md) |
| **Speckit Command Index** | See §8 |

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
