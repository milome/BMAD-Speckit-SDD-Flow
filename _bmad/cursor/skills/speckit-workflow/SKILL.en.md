<!-- BLOCK_LABEL_POLICY=B -->
---
name: speckit-workflow
description: |
  Improve the Speckit development process: force requirement mapping and audit closed loop at each stage of specify/plan/gaps/tasks,
  and forcing TDD traffic light mode (red light-green light-refactor) development when executing tasks in tasks.md.
  After executing /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks, /speckit.implement (or .speckit.* equivalent); the enhanced command clarify/checklist/analyze **must be embedded in the corresponding audit closed-loop iteration for execution**: §1.2 spec audit report states that "there is an ambiguous statement" → clarify (within §1.2 iteration); §2.2 plan within the audit closed-loop, when plan When involving multiple modules or complex architecture → checklist as part of the §2.2 audit step; §4.2 tasks In the audit closed loop, when tasks ≥ 10 or across multiple artifacts → analyze as part of the §4.2 audit step; cannot be skipped in scenarios that should be executed on the grounds of "optional";
  Or when the model automatically generates IMPLEMENTATION_GAPS through in-depth analysis, or the user requests "generate tasks" or "execute tasks",
  The requirements mapping list must be added according to the rules of this skill and **call the code-review skill** for audit until passed.
  This skill **depends on the code-review skill**, which must be explicitly called in the audit closed-loop step and cannot be skipped or declared passed on its own.
  When a user asks to perform an outstanding task in tasks.md (or tasks-v*.md),
  You must develop according to the TDD traffic light mode execution rules of this skill, and use TodoWrite to track progress.
  Strictly abide by 15 iron rules such as architectural fidelity, prohibition of false implementations, and active regression testing.
  Comply with the QA_Agent execution rules and ralph-wiggum rules at the same time.
---

# Speckit development process is improved

> 🚨 **Mandatory constraints - cannot be skipped**
> Must be executed in order: specify → plan → GAPS → tasks → execute. Each stage must pass the code-review audit before entering the next stage. Skipping any stage or audit is strictly prohibited!

This skill defines **constitution → spec.md → plan.md → IMPLEMENTATION_GAPS.md → tasks.md → tasks execution** Mandatory steps in each phase: constitution establishes project principles; the documentation phase is **requirements mapping form** + **code-review audit cycle** (until the audit is passed); the execution phase is **TDD red light-green light-refactoring cycle** + **15 iron rules** (until all tasks are completed).

## Runtime Governance for this round (JSON)

Before executing any stage task of this skill in each round, there must be a governance JSON block injected into the context by **hook + `emit-runtime-policy`** (`scripts/emit-runtime-policy.ts` / `.claude|cursor/hooks/emit-runtime-policy-cli.js`); see `docs/reference/runtime-policy-emit-schema.md` for the contract. **Prohibited** Hand-written sample policies that are inconsistent with `resolveRuntimePolicy` are prohibited; if there is no such block in the context, `.bmad/runtime-context.json` and hook must be repaired first, and fields must not be made up.

## Quick Decision Guide

### When to use this skill
- The technical implementation plan has been clarified and a detailed execution plan is required
- There is already a Story document that needs to be converted into technical specifications.
- Need TDD traffic light model to guide development

### When to use bmad-story-assistant
- The complete process needs to start from Product Brief
- Requires PRD/Architecture depth generation
- Requires Epic/Story planning and splitting
- Not sure about the technical solution and need to discuss the solution selection

### The relationship between the two
This skill is the technical implementation layer nesting process of bmad-story-assistant.
When bmad-story-assistant is executed to "Phase 3: Dev Story Implementation", the complete process of this skill will be triggered.

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

**Priority Strategy**:
1. Check `.cursor/agents/code-reviewer.md` and `.claude/agents/code-reviewer.md`; **GAP-041 fix**: When both coexist, use `.cursor` first
2. If it exists, use Cursor Task to schedule code-reviewer for auditing
3. Use `audit-prompts.md` for prompt words corresponding to chapters; (**GAP-070 fix**: use audit-prompts.md §1–§5 for each stage of speckit audit; use the newly created audit-prompts-prd/arch/pr.md for PRD/Arch/PR audit)

**Fallback Strategy**:
1. If code-reviewer is not available, use `mcp_task` + `subagent_type: generalPurpose`
2. Pass in the corresponding chapter content of `audit-prompts.md` as prompt
3. Require the sub-agent to check item by item according to the audit checklist

**Note**: The subagent_type of mcp_task currently only supports generalPurpose, explore, and shell, and does not support code-reviewer.

### 0.1.1 Skill binding rules when sub-Agent executes code-review

When initiating a code-review audit via **Method B (subagent/task)**, **MUST** follow:

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
- **This step can only be ended** when** the code-review audit report conclusion is "fully covered and verified".
- #### Score writing is triggered after the audit is passed (mandatory)
  - **Report Path**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md` (epic/story/epic-slug is resolved from the current spec path).
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **Complete call example of parse-and-write-score** (including --iteration-count; add --iterationReportPaths when there is a fail round):
    ```bash
    npx bmad-speckit score --reportPath <上路径> --stage spec --event stage_audit_complete --triggerStage speckit_1_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md --iteration-count {累计值} [--iterationReportPaths path1,path2,...]
    ```
Among them, iterationReportPaths is the fail round report path (see §1.0.3); the verification round is not included.
  - **Separation of Responsibilities**: The code-review sub-agent produces an audit report and places it in the above path; the main Agent executes parse-and-write-score after receiving the passing conclusion. Read `scoring_write_control.enabled` of `_bmad/_config/scoring-trigger-modes.yaml`; execute if enabled; **iteration_count passing (mandatory)**: The Agent executing the audit cycle passes in the current cumulative value (the number of rounds of failed/failed audits at this stage); 0 is passed for one pass; 3 consecutive verification rounds without gaps are not counted. iteration_count; omission is prohibited; eval_question is missing, question_version is recorded and SCORE_WRITE_INPUT_INVALID is not called; failure does not block the main process, and the resultCode is recorded as audit evidence.
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
- **This step can only be ended** when** the code-review audit report conclusion is "fully covered and verified".
- #### Score writing is triggered after the audit is passed (mandatory)
  - **Report Path**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md`.
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **parse-and-write-score complete call example** (including --iteration-count):
    ```bash
    npx bmad-speckit score --reportPath <上路径> --stage plan --event stage_audit_complete --triggerStage speckit_2_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/plan-E{epic}-S{story}.md --iteration-count {累计值}
    ```
- **Division of Responsibilities**: The code-review sub-agent produces the report and places it on the market; the main Agent executes parse-and-write-score after receiving the passing conclusion. Same as §1.2 (including iteration_count transfer rule, failure record resultCode).
- If it fails: **iterately modify plan.md** based on the audit report, **call code-review** again, until the report conclusion is passed.
- **Embedding step (must be executed when the plan involves multiple modules or complex architecture)**: After the plan audit passes and before the end of this step, **must execute `/speckit.checklist` or `.speckit.checklist` as part of the §2.2 audit step** - generate a quality checklist to verify the completeness, clarity and consistency of requirements; if the checklist finds problems, plan.md must be iteratively modified and **execute the code-review audit** again until the checklist Verification passed; cannot be skipped in scenarios that should be executed on the grounds of "optional".

### Optional Party-Mode in Plan stage

Party-mode can be started in the planning phase when the following situations occur:
1. Users clearly request in-depth discussion of technical solutions
2. Technical disputes that were not fully resolved during the Create Story stage
3. Involving major architectural decisions (such as database selection, service splitting)

**Start command**:
```
进入party-mode讨论技术方案，建议50轮
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
- **This step can only be ended** when** the code-review audit report conclusion is "fully covered and verified".
- #### Score writing is triggered after the audit is passed (mandatory)
  - **Report Path**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_GAPS-E{epic}-S{story}.md`.
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **parse-and-write-score complete call example** (including --iteration-count):
    ```bash
    npx bmad-speckit score --reportPath <上路径> --stage gaps --event stage_audit_complete --triggerStage speckit_3_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/IMPLEMENTATION_GAPS-E{epic}-S{story}.md --iteration-count {累计值}
    ```
- **Division of Responsibilities**: The code-review sub-agent produces the report and places it on the market; the main Agent executes parse-and-write-score after receiving the passing conclusion. The GAPS report format is plan-compatible, stage=plan. Same as §1.2 (including iteration_count transfer rule, failure record resultCode).
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
- **This step can only be ended** when** the code-review audit report conclusion is "fully covered and verified".
- #### Score writing is triggered after the audit is passed (mandatory)
  - **Report Path**: `specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md`.
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **parse-and-write-score complete call example** (including --iteration-count):
    ```bash
    npx bmad-speckit score --reportPath <上路径> --stage tasks --event stage_audit_complete --triggerStage speckit_4_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md --iteration-count {累计值}
    ```
- **Division of Responsibilities**: The code-review sub-agent produces the report and places it on the market; the main Agent executes parse-and-write-score after receiving the passing conclusion. Same as §1.2 (including iteration_count transfer rule, failure record resultCode).
- If it fails: **iterately modify tasks.md** based on the audit report, **call code-review** again, until the report conclusion is passed.
- **Embedded step (must be executed when the number of tasks is ≥10 or spans multiple artifacts)**: After the tasks audit is passed and before the end of this step, **must execute `/speckit.analyze` or `.speckit.analyze` as part of the §4.2 audit step** - do cross-artifact consistency analysis (alignment report of spec, plan, tasks, etc.); if analyze finds problems, tasks.md must be iteratively modified and **execute code-review again Audit** until the analyze verification is passed; it cannot be skipped in scenarios where it should be executed on the grounds of "optional".

### Task batch execution mechanism

When the number of tasks in tasks-E{epic}-S{story}.md exceeds 20, they must be executed in batches: (**GAP-044 fix**: 20 is the experience threshold, taking into account single-batch manageability and audit cost; it can be overridden through configuration)

**Batching Rules**:
- Maximum of 20 tasks per batch
- Conduct code-review after each batch is executed
- The next batch can only start after the audit is passed.

**Execution Process**:
```
Batch 1: Task 1-20 → 执行 → code-review审计 → 通过
Batch 2: Task 21-40 → 执行 → code-review审计 → 通过
...
Batch N: Task ... → 执行 → code-review审计 → 通过
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

Since party-mode is not mandatory at each stage of speckit, quality assurance is compensated through audit quality ratings:

| Rating | Meaning | Treatment |
|-----|------|---------|
| **Grade A** | Excellent, fully meets the requirements | Go directly to the next stage |
| **Level B** | Good, minor problem | Record the problem, **complete the repair within the audit closed loop at this stage** and then enter the next stage; it is prohibited to use vague expressions such as "follow-up" and "to be determined" |
| **Level C** | Passed, needs to be revised | Must be revised and re-audited |
| **Grade D** | Failed, serious problem | Return to the previous stage for redesign |

**Rating Dimensions**:
1. Completeness (30%): Whether all demand points are covered
2. Correctness (30%): Is the technical solution correct?
3. Test verification (25%): Production code integration test verification, **GAP-087 fix**: "New code" = new/modified code for this Story or this batch of tasks; new code coverage ≥ 85%;
4. Quality (15%): Is the code/document quality up to standard?

**Forced upgrade rules**:
- Rated C level for two consecutive stages, and forced to enter party-mode in the third stage
- If any stage is rated D, you must review it and consider returning to Layer 3 to create the story again.

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
## Task X: 实现YYY功能

**红灯阶段（YYYY-MM-DD HH:MM）**
[TDD-RED] TX pytest tests/test_xxx.py -v => N failed
[错误信息摘要]

**绿灯阶段（YYYY-MM-DD HH:MM）**
[TDD-GREEN] TX pytest tests/test_xxx.py -v => N passed
[实现要点摘要]

**重构阶段（YYYY-MM-DD HH:MM）**
[TDD-REFACTOR] TX [重构操作描述 | 无需重构 ✓ | 集成任务: 无新增生产代码，各模块独立性已验证 ✓]
[优化点摘要]

**更新ralph-method进度**
- prd.md: US-00X passes=true
- progress.md: 添加TDD记录链接
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
- **batch time**: A single pass is enough and the critical auditor section is qualified; **Final audit**: 3 consecutive rounds of convergence without gaps are required. For details, see audit-post-impl-rules.
- Before initiating the second and third rounds of audits, the main Agent can output "Nth round of audit passed, continue verification..." to prompt the user.
- #### Score writing is triggered after the audit is passed (mandatory)
  - **Report path**: `{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/AUDIT_implement-E{epic}-S{story}.md` (consistent with _bmad/_config/eval-lifecycle-report-paths.yaml); stage=implement (Story 9.2 extension, replacing the original stage=tasks + triggerStage=speckit_5_2).
  - When initiating an audit subtask, the prompt sent to the sub-Agent must include: After passing the audit, please save the report to {agreed path}. The path will be filled in by the main Agent based on epic, story, and slug.
  - **parse-and-write-score complete call example** (including --iteration-count):
    ```bash
    npx bmad-speckit score --reportPath <上述路径> --stage implement --event stage_audit_complete --epic {epic} --story {story} --artifactDocPath <tasks 文档路径> --iteration-count {累计值}
    ```
- **Separation of Responsibilities**: The code-review sub-agent produces an audit report and places it in the above path; the main Agent executes parse-and-write-score after receiving the passing conclusion; failure does not block the main process and records the resultCode as audit evidence. **iteration_count passing (mandatory)**: The Agent executing the audit cycle passes in the current cumulative value (the number of rounds in which the audit failed/failed at this stage) when passing; pass 0 once. When using the **standalone speckit** process (without epic/story), the main Agent also passes in `--iteration-count {cumulative value}` when passing.
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
- For reference design, check the pre-requirements document/plan document/IMPLEMENTATION_GAPS document.
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

### Enforcement instructions (responsibility for checking prohibited items)

**Prohibited items at each stage and person responsible for inspection**:

| Stage | Prohibited matters | Person responsible for inspection | Inspection method |
|-----|---------|-----------|---------|
| specify | pseudo implementation | code-reviewer | code review |
| specify | scope creep | code-reviewer | compare Story documents |
| plan | no test plan | code-reviewer | check plan-E{epic}-S{story}.md |
| plan | over-design | code-reviewer | architectural rationality assessment |
| GAPS | Missing critical gaps | code-reviewer | Sanity check |
| tasks | Task is not executable | code-reviewer | Feasibility assessment |
| Execute | Skip TDD red light | bmad-story-assistant | Check TDD records |
| Execute | Omit refactoring | bmad-story-assistant | Check TDD records |

**Violation handling**:
1. First violation: warning and request for immediate correction
2. Repeated violations: suspend execution and return to the previous stage
3. Serious violations: record and report to BMad Master

**Exemption conditions**:
- unanimously agreed after party-mode discussion
- Have clear reasons for ADR recording decisions
- Obtain critical auditor approval

**Ralph-Wiggum Law**

- It is forbidden to pretend to complete the task, to cover up the fact of pseudo-realization, and to avoid the task on the grounds that it takes too long.
- Exiting is prohibited until all tasks have been truly accepted and marked as completed.

For the complete Agent execution rules and requirements traceability format, see [references/qa-agent-rules.md](references/qa-agent-rules.md).

---

## 7. Process summary

**[Dev Story complete process - no steps can be skipped]**
```
Layer 3: Create Story
    →
Layer 4: speckit-workflow（constitution → specify → plan → GAPS → tasks → implement）
    →
Layer 5: 收尾与集成
```
| speckit stage | output | audit basis | bmad corresponding stage | description |
|----------------|------|---------|-------------|------|
| specify | spec-E{epic}-S{story}.md | audit-prompts.md §1 | Starting from Layer 4 | Technically standardized Story content; the file name must contain the Epic/Story serial number |
| plan | plan-E{epic}-S{story}.md | audit-prompts.md §2 | Layer 4 continues | Develop an implementation plan; the file name must contain the Epic/Story serial number |
| GAPS | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | audit-prompts.md §3 | Layer 4 continues | Identify implementation gaps; the file name must contain the Epic/Story serial number |
| tasks | tasks-E{epic}-S{story}.md | audit-prompts.md §4 | Layer 4 continues | Disassemble and execute tasks; the file name must contain the Epic/Story serial number |
| Execution | Runnable code | audit-prompts.md §5 | End of Layer 4 | TDD traffic light development |

**Document naming rules**: The output file name must contain the Epic serial number and Story serial number; the Epic name (such as feature-metrics-cache) is reflected in the path or document metadata. Example: Epic 4 Story 1 → spec-E4-S1.md, plan-E4-S1.md.

Each "iteration" is: **Call code-review skills according to the convention in §0** → Obtain the audit report → Modify the corresponding document if it fails → **Call code-review again** → Until the report conclusion is complete coverage and verification is passed. The same goes for the tasks execution phase: TDD traffic light cycle → task-by-task completion → checkpoint verification → **Press §0 to call the code-review skill** → until the report conclusion is passed.

---

## 8. Speckit process command index (must be executed)

| Stage | Commands that must be executed | Preconditions | Output | Audit basis |
|------|----------------|----------|------|----------|
| **0.constitution** | `/speckit.constitution` or `.speckit.constitution` | None (entry stage) | constitution.md or .specify/memory/constitution.md | Project custom or universal documentation integrity |
| **1. specify** | `/speckit.specify` or `.speckit.specify` | constitution produced | spec.md | audit-prompts.md §1 |
| **2. plan** | `/speckit.plan` or `.speckit.plan` | spec.md passed audit | plan.md | audit-prompts.md §2 |
| **3. GAPS** | No independent command; automatic in-depth analysis of the model (compare plan + requirements + current implementation) or user request "Generate IMPLEMENTATION_GAPS" | plan.md has passed the audit | IMPLEMENTATION_GAPS.md | audit-prompts.md §3 |
| **4. tasks** | `/speckit.tasks` or `.speckit.tasks` or user request "generate tasks" | IMPLEMENTATION_GAPS.md passed audit | tasks.md | audit-prompts.md §4 |
| **5. Execution** | `/speckit.implement` or `.speckit.implement` or user request "execute tasks" "complete tasks in tasks" | tasks.md has passed audit | Runnable code + test | audit-prompts.md §5 |

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
| audit_convergence configuration | [references/audit-config-schema.md](references/audit-config-schema.md); Validation script `_bmad/speckit/scripts/powershell/validate-audit-config.ps1` |
| **Speckit Command Index** | See §8 |