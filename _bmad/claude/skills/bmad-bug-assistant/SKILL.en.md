<!-- BLOCK_LABEL_POLICY=B -->

---
name: bmad-bug-assistant
description: |
  Claude Code CLI/OMC version BMAD Bug Assistant adaptation entry.
  Using Cursor bmad-bug-assistant as the semantic baseline, execute the entire BUG repair process according to "Root Cause Analysis → BUGFIX Document → Audit → Task List Supplement → Implementation → Post-Implementation Audit".
  When the main agent initiates any subtask, the master agent must copy the entire "complete prompt template" of this stage in the skill and fill in the placeholders before passing it in. It is prohibited to omit, summarize or rewrite the prompt words by yourself;
  The main Agent is prohibited from directly modifying the production code, and implementation must be through the Agent tool sub-agent (subagent_type: general-purpose).
  The Claude-side party-mode main path is now fixed as the formal specialized subtype: `.claude/agents/party-mode-facilitator.md` / `subagent_type: party-mode-facilitator`.
  Use party-mode to conduct **at least 100 rounds** of multi-role debate (BUGFIX produces the final plan and §7 task list, which belongs to the party-mode step-02 "Generate the final plan and final task list" scenario),
  End after meeting the convergence conditions (consensus + no new gaps in the past 2–3 rounds); audit priority `.claude/agents/auditors/auditor-bugfix`, and downgrade according to the Fallback chain.
  Follow ralph-method, TDD traffic light, speckit-workflow.
  Applicable scenarios: user-reported bugs, root cause analysis, generating or updating BUGFIX docs, supplementing the §7 task list, implementing BUGFIX. Deliverables and subtask prompts remain in Chinese per workflow rules.
when_to_use: |
  Use when: User reports bugs, requirements root cause analysis, generate/update BUGFIX documentation, supplement §7 task list, implement BUGFIX.
references:
  - auditor-bugfix: bugfix document audit execution body; `.claude/agents/auditors/auditor-bugfix.md`
  - auditor-implement: post-implementation audit execution body; `.claude/agents/auditors/auditor-implement.md`
  - audit-prompts-section5: §5 audit prompt word reference; `.claude/skills/bmad-bug-assistant/references/audit-prompts-section5.md`
  - audit-document-iteration-rules: document audit iteration rules; `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - party-mode: `{project-root}/_bmad/core/workflows/party-mode/`
  - party-mode-facilitator: party-mode specialized subtype; `.claude/agents/party-mode-facilitator.md`
  - ralph-method: prd, progress files, executed in US order
  - speckit-workflow: Fake implementation is prohibited, acceptance command must be run, architecture is faithful
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.

# Claude Adapter: bmad-bug-assistant

## Purpose

This skill is the unified adaptation entrance of Cursor `bmad-bug-assistant` in Claude Code CLI / OMC environment.

The goal is not to simply copy the Cursor skill, but to:

1. **Inherit Cursor’s verified BUG repair process semantics** (Root cause analysis → BUGFIX document → Audit → Implementation → Post-implementation audit)
2. **Map the audit execution body to `.claude/agents/auditors/auditor-bugfix` etc. in Claude/OMC runtime**
3. **Access to the handoff, scoring, and commit gate mechanisms that have been developed in the warehouse**
4. **Ensure that the entire bug fixing process can be executed completely, continuously, and correctly in Claude Code CLI**

---

## Core Acceptance Criteria

The Claude version of `bmad-bug-assistant` must satisfy:

- Can be used as the **BUG repair whole process entrance** of Claude Code CLI, unified management of root cause analysis → BUGFIX document → audit → implementation → post-implementation audit closed loop
- The executor selection, fallback, and score writing at each stage are consistent with the Cursor verified process semantics.
- Complete access to the new additions to this warehouse:
  - auditor-bugfix, auditor-implement execution body
  - Unified auditor host runner (`runAuditorHost`)
  - handoff protocol
- Cursor Canonical Base, Claude Runtime Adapter, and Repo Add-ons must not be mixed into a rewritten version of prompt from unknown sources.
- **The main agent is prohibited from directly modifying the production code** (FR20a)

---

## Cursor Canonical Base

The following content is inherited from Cursor `bmad-bug-assistant` and belongs to the business semantics baseline. Claude version shall not rewrite its intention without authorization.

This skill defines the complete workflow **Root Cause Analysis → BUGFIX documentation → audit → (optional) information updates → task-list supplement → implementation → post-implementation audit**. **Post-implementation audit is mandatory, not optional.** If it fails, apply the audit’s change requests and re-audit until it passes.

### Mandatory constraints (must be observed)

1. **Chinese is used throughout**: All outputs (BUGFIX documents, task lists, audit reports, subtask prompts) and interactions with users are in Chinese.
2. **party-mode sub-agent**: When using party-mode, you **must** use an appropriate BMAD sub-agent (see "BMAD Agent display name and command comparison" below and "Recommended Agents" at each stage); if the current environment cannot schedule the corresponding sub-agent, downgrade according to the Fallback Strategy (see Runtime Adapter), and you must not skip the multi-role debate or switch to a single role.
3. **The main agent is prohibited from directly changing the production code**: The repair must be performed through the sub-agent; the main agent only initiates sub-tasks, passes in the document path, and collects output.
4. **The main Agent is prohibited from directly generating BUGFIX documents**: The BUGFIX documents in Phases 1 and 2 (including §1–§5) must be produced by party-mode or sub-agents; the main Agent shall not skip sub-agents and write BUGFIX documents by itself on the grounds of "existing analysis documents" or "root cause has been agreed upon".
5. **Every update must be audited**: Whenever a BUGFIX document (including §4 and §7) is produced or updated, **start an audit subtask after completion** and iterate until it passes; **do not** skip the audit. Whether or not there was debate, the audit loop is mandatory.

### Master Agent’s rules for delivering prompt words (must be followed)

Each time a subtask (party-mode or Agent tool) is initiated, the main Agent **must** comply with the following rules, otherwise the sub-agent will easily deviate from the requirements of this skill due to incomplete prompt words:

1. **Use the complete template**: Use the "complete prompt template" provided at this stage of this skill; **It is prohibited** to summarize, abbreviate or rewrite it by yourself.
2. **Copy the entire section**: Copy the **entire section** of the template into the `prompt` parameter of the subtask. **Prohibit** only passing "key points" or "reference below".
3. **Replace placeholders**: Replace **all** the placeholders in the template (such as `{Main Agent filled in}`, `{project-root}`, `{User-provided BUG phenomenon...}`) with actual content before passing it in.
4. **Self-check before launching**: If there is a "self-check list before launching" at this stage, the main Agent must confirm each item before initiating it.
5. **Summary is prohibited**: The main agent must not summarize the template into key points or "refer to a section of skills"; the subtask prompt must contain the complete text of the template at this stage (placeholders have been replaced). If the subtask output does not meet the skill requirements due to incomplete copying, the master agent must re-initiate and copy the entire process.
6. **Error examples** (none of them meet the entire copy requirement): The prompt only says "Please execute according to the bmad-bug-assistant stage one audit template"; "Please refer to the bmad-bug-assistant skill stage one audit part"; "See the audit requirements above"; "Do BUGFIX document audit according to the skill requirements".
7. **Correct example**: The prompt contains the full text of the complete prompt template of this stage (including template ID, all paragraphs within the boundary), and all placeholders have been replaced; before initiating, the self-test results have been confirmed one by one according to the "Pre-initiation self-test list" of this stage and the self-test results have been output.
8. **Self-test mandatory**: If any item on this stage’s “Pre-initiation self-test list” is incomplete or self-test results were not printed before launch, **do not** start the subtask; do not launch first and backfill self-test later. Self-test output must use a consistent form, for example: `[Self-test completed] Stage X: full template copied [template ID]; placeholders [replaced / listed]; [other required items for this stage]. OK to launch.`

**Placeholder List**:

| Stage | Placeholder | Meaning | Example value | Consequences of not replacing |
|------|--------|------|--------|------------|
| Phase 1 | {BUG phenomenon, reproduction steps, and environmental information provided by the user} | User description or main Agent summary | A paragraph | No input for sub-agent |
| Phase 2 | {User-supplemented phenomena, steps, environment, etc.} | User-supplemented content | A paragraph | No supplementary information for sub-agents |
| Phase 2 | {Main Agent fills in the path} | Full path of BUGFIX document | _bmad-output/BUGFIX_xxx_2026-02-27.md | Subagent cannot locate the document |
| Phase 3 | {Master Agent fills in the BUGFIX document path} | BUGFIX document full path | Same as above | Same as above |
| Phase 3 | {project-root} | Absolute path to the project root directory, excluding the trailing / | d:\Dev\my-project | The subagent cannot locate the project |
| Phase 3 Audit | {Main Agent fills in the BUGFIX document path} | Same as above | Same as above | Subagent cannot locate the document |
| Phase 4 | {Main Agent filled in} | Full path of BUGFIX document | Same as above | Same as above |
| Phase 4 | {project-root} | Same as above | Same as above | Same as above |

### Dependencies and references

| Resources | Path/Description |
| ---- | --------- |
| **party-mode** | `{project-root}/_bmad/core/workflows/party-mode/`; For rounds and convergence, see step-02 (BUGFIX produces the final solution and §7 task list: at least 100 rounds; others: 50 rounds; end after convergence conditions). |
| **auditor-bugfix executable** | `.claude/agents/auditors/auditor-bugfix.md`; if not found, press Fallback Strategy to downgrade |
| **audit-prompts §5** | `references/audit-prompts-section5.md` (within this skill) or `{project-root}/docs/speckit/skills/speckit-workflow/references/audit-prompts.md`; **Only for other workflow reference, not used for BUGFIX document auditing of this skill**. |
| **audit-document-iteration-rules** | `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`; BUGFIX **document** audits for phases one, two and three must follow: The audit subagent must directly modify the BUGFIX document when a gap is discovered. Phase four is post-implementation audit (code), not applicable. |
| **ralph-method** | Use ralph-method skill: prd, progress files, execute in US order |
| **speckit-workflow** | Fake implementation is prohibited, acceptance command must be run, architecture is faithful |
| **Improvement instructions (this skill)** | {project-root}/_bmad-output/BMAD_BUG_Assistant skill prompt words and audit improvement instructions.md |
| **Main Agent prompt word deviation 20 rounds of optimization** | {project-root}/_bmad-output/Main Agent prompt word deviation_20 rounds of detailed optimization discussion.md |

### § Banned word list (BUGFIX documentation)

The following words must not appear in §4, §7, etc. program and task descriptions of BUGFIX documents. If any word is found during the audit, the conclusion is failure.

| Prohibited words/phrases | Alternate directions |
|-------------|----------|
| Optional, can be considered, can be considered | Clearly write "Adopt Option A" and briefly describe the reasons. |
| Follow-up, subsequent iterations, to be followed | If not done at this stage, it will not be written in the document; if it is done, the completion scope of this stage will be clearly stated. |
| To be determined, at discretion, depending on the situation | Change to clear conditions and corresponding actions (such as "If X then Y"). |
| Technical debt, do this first and then change | Do not leave technical debt in the BUGFIX document; opening a story separately may not be within the scope of this article. |
| Existing problems can be eliminated, have nothing to do with this time, historical issues will not be dealt with for the time being, and environmental issues can be ignored | Prohibited when appearing in acceptance/audit conclusions, task completion instructions and **no formal exclusion record**; if there is a formal exclusion record, an objective description can be made in the record but must have objective basis (such as issue number, reproduction steps). |

**Instructions for use**: Any prompt template that produces or updates §4/§7 in Phases 1, 2, and 3 must quote this table or post a simplified version of the above table in the output requirements; the Phase 1 audit template and the Phase 4 post-implementation audit template must write "If any word in the above table appears in §4/§7, the conclusion is that it has not passed." The audit template after the implementation of Stage 4 must write "If the acceptance/audit conclusion appears with the prohibition words "failure exclusion" in the table above and there is no corresponding formal exclusion record, the conclusion is failure."

### Provisions for formally excluding failed use cases

**Principle**: Any failed use cases that appear in this acceptance/regression must be **fixed** or **included in a formal exclusion list** and audited within this round; failures must not be ignored for any unrecorded or unaudited reasons.

**Disable automatic generation**: Audit subagent, enforcement subagent **Disable** automatic creation or update of EXCLUDED_TESTS_*.md or similar exclusion manifest files.

**The user must be asked first**: When there is a failed use case in acceptance/regression and it is to be included in the formal exclusion list, the main agent or sub-agent must **first ask** the user** "whether to approve the inclusion of the following use cases in the formal exclusion list". After the user explicitly approves, the exclusion list can be created or updated; if the user refuses, the repair process must be entered and the exclusion list must not be created.

**Exclude record path and naming**: `{Same directory as BUGFIX document}/EXCLUDED_TESTS_{stem}.md`, stem is the BUGFIX file name without extension (such as BUGFIX_foo_2026-02-26).

**Required fields**: use case ID (or test path + name), reason for exclusion (one sentence), objective basis (such as proof of reproduction steps not introduced this time or issue number), this BUG identification, audit conclusion (passed/failed).

**Acceptable Exclusion**: The record exists, the path conforms to the agreement, and each record contains a use case ID, reason, objective basis, and this BUG identification; this round of audit has checked the record and concluded that it is "acceptable to exclude".

**Unacceptable**: There is no exclusion record, there are missing items in the record, there is only a general description of "existing problems" without basis, or the audit is passed without checking the exclusion record.

**Minimal Example**:

| Use Case ID / Test Path | Reason for Exclusion | Objective Basis | Audit |
|-------------------|----------|----------|------|
| test_foo::test_bar | Existing preload problem, see issue #N | Reappears when this patch is not applied | Passed |

### BMAD Agent display name and command comparison

In scenarios such as subtask calls, Party Mode multi-round conversations, and workflow guidance, the following **display names** should be used to refer to each Agent to maintain contextual consistency and user experience.

| Agent display name | Command name | Module |
|--------------|--------|------|
| BMad Master | `bmad-agent-bmad-master` | core |
| Mary Analyst | `bmad-agent-bmm-analyst` | bmm |
| John Product Manager | `bmad-agent-bmm-pm` | bmm |
| Winston Architect | `bmad-agent-bmm-architect` | bmm |
| Amelia Development | `bmad-agent-bmm-dev` | bmm |
| Bob Scrum Master | `bmad-agent-bmm-sm` | bmm |
| Quinn test | `bmad-agent-bmm-qa` | bmm |
| Paige Technical Writing | `bmad-agent-bmm-tech-writer` | bmm |
| Sally UX | `bmad-agent-bmm-ux-designer` | bmm |
| Barry Quick Flow | `bmad-agent-bmm-quick-flow-solo-dev` | bmm |
| Bond Agent Build | `bmad-agent-bmb-agent-builder` | bmb |
| Morgan Module Build | `bmad-agent-bmb-module-builder` | bmb |
| Wendy Workflow Build | `bmad-agent-bmb-workflow-builder` | bmb |
| Victor Innovation Strategy | `bmad-agent-cis-innovation-strategist` | cis |
| Dr. Quinn Problem Solving | `bmad-agent-cis-creative-problem-solver` | cis |
| Maya Design Thinking | `bmad-agent-cis-design-thinking-coach` | cis |
| Carson brainstorming | `bmad-agent-cis-brainstorming-coach` | cis |
| Sophia Storyteller | `bmad-agent-cis-storyteller` | cis |
| Caravaggio presentation | `bmad-agent-cis-presentation-master` | cis |
| Murat test architecture | `bmad-agent-tea-tea` | tea |

**Instructions for use**:
- **Subtask context**: Use the display name when referencing the BMAD workflow or recommending next steps in the prompt (e.g. "can be handed over to Winston architect for architecture review").
- **Party Mode multiple rounds of dialogue**: When Facilitator introduces and speaks, the role must be marked with a display name (such as "🏗️ **Winston Architect**:..." "💻 **Amelia Developer**:..."), which is consistent with the `displayName` of `_bmad/_config/agent-manifest.csv` and the above table.

### Pre-check: new worktree and _bmad custom migration prompts

**Trigger time**: When the user uses this skill for the first time in this project or worktree.

**Check logic**: If it is detected that the current worktree is a new one (for example, cwd is a worktree directory at the same level as the project root such as `my-project-{branch}`, or `_bmad` is a new installation), and `_bmad-output/bmad-customization-backups/` has a backup, the user will be prompted:

> A new worktree has been detected. If you need to restore _bmad customization, you can run: `python {SKILLS_ROOT}/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{latest backup path}" --project-root "{current project root}"`. The latest backup path is the latest directory sorted by timestamp under `_bmad-output/bmad-customization-backups/`.

If there is no backup, no prompt will be given. This check does not block subsequent stages.

### Output path convention

**BUGFIX with story context**:
| Output | Path |
|------|------|
| BUGFIX Documentation | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/TASKS_BUGFIX_{slug}.md` |
| prd, progress | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.BUGFIX_{slug}.json`, `progress.BUGFIX_{slug}.txt` |

**BUGFIX without story context**:
| Output | Path |
|------|------|
| BUGFIX Documentation | `_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/_orphan/TASKS_BUGFIX_{slug}.md` |

**Forbidden**: Place BMAD output in the spec subdirectory. The spec subdirectory only stores speckit-workflow output.

---

## Claude/OMC Runtime Adapter

### Primary Executor

Each stage schedules its subtask according to executor type:

| Stage | Execution Body | Agent File |
|------|--------|-----------|
| Phase 1/2 Root Cause Debate | party-mode-facilitator | `.claude/agents/party-mode-facilitator.md` / Agent tool `subagent_type: party-mode-facilitator` |
| Phase 1/2/3 Audit | auditor-bugfix | `.claude/agents/auditors/auditor-bugfix.md` |
| Phase 4 Implementation | general-purpose dev | Agent tool `subagent_type: general-purpose` |
| Phase 4 Post-implementation audit | auditor-implement | `.claude/agents/auditors/auditor-implement.md` |

The main Agent passes in the entire markdown content of the corresponding agent as prompt.

### Fallback Strategy

4-tier fallback chain (in descending order of priority):

1. **`.claude/agents/auditors/auditor-bugfix`** (or `auditor-implement`): dedicated audit execution body (Primary) of the corresponding stage
2. **OMC reviewer** (`oh-my-claudecode` code-reviewer subagent_type)
3. **code-review skill** (general code-review skill, executed according to the corresponding chapter of audit-prompts)
4. **Direct execution by the main agent**: The main agent reads the audit template of the corresponding stage in this skill, checks the audit list item by item and outputs the audit report

**Fallback downgrade notification (FR26)**: When Fallback is triggered, the currently used execution body level must be displayed to the user. Format:
```
⚠️ Fallback 降级通知：当前审计使用执行体层级 {N}（{执行体名称}），原因：{层级 N-1 不可用原因}
```
Example:
- `⚠️ Fallback downgrade notification: The current audit uses executive level 2 (OMC reviewer), reason: auditor-bugfix does not exist or is unavailable`
- `⚠️ Fallback downgrade notification: The current audit uses execution body level 4 (direct execution by the main Agent), reason: the first three levels of execution bodies are not available`

### Runtime Contracts

- Must read: `.claude/protocols/audit-result-schema.md`
- Must read: `.claude/state/bmad-progress.yaml`
- Explicit reference: `.claude/agents/auditors/auditor-bugfix.md`
- Explicit reference: `.claude/agents/auditors/auditor-implement.md`
- The return must contain: `execution_summary`, `artifacts`, `handoff`
- Audit subtask types are executed according to `code-reviewer` semantics
- Only after PASS can you enter the next stage.
- After the repair is completed, post-audit and `bmad-master` commit gate still need to be implemented

### CLI Calling Summary (Architecture Pattern 2)

Before each call to a subagent, the main Agent **must** output the following structured summary:
```yaml
# CLI Calling Summary
Input: phase={当前阶段}, bugfixDocPath={BUGFIX 文档路径}
Template: {使用的 prompt 模板 ID，如 BUG-A1-ROOT}
Agent: {使用的执行体，如 auditor-bugfix / general-purpose}
Output: {预期产出——BUGFIX 文档或审计报告路径}
Fallback: {当前使用的执行体层级及降级方案}
Acceptance: {验收标准——报告结论为"完全覆盖、验证通过"}
```
### YAML Handoff (Architecture Pattern 4)

After each phase, the main Agent **must** output the following handoff structure:
```yaml
execution_summary:
  status: passed|failed
  phase: {当前阶段，如 phase_1_rca / phase_2_update / phase_3_tasks / phase_4_impl}
  iteration_count: {累计轮次}
artifacts:
  bugfixDocPath: {BUGFIX 文档路径}
  reportPath: {审计报告路径}
next_steps:
  - {下一步操作描述}
handoff:
  next_action: phase_2_update|phase_3_tasks|phase_4_impl|post_audit|commit_gate|iterate_audit
  next_agent: auditor-bugfix|auditor-implement|bmad-master|general-purpose
  ready: true|false
```
---

## Repo Add-ons

### Rating writing

Unified host close-out after the audit passes (mandatory): After the post-implementation audit conclusion is "complete coverage, verification passed", the main Agent **must not** hand-run `parseAndWriteScore` or any audit-index CLI. It must call `runAuditorHost` as the single post-audit entry. When a BUGFIX document exists, the host/runner must receive `artifactDocPath=<BUGFIX document path>` so both score records and registry audit index bind to the BUGFIX document rather than the audit report.

**Host call example** (executed in the project root directory):
```bash
npx ts-node scripts/run-auditor-host.ts \
  --projectRoot <projectRoot> \
  --stage bugfix \
  --artifactPath <BUGFIX document path> \
  --reportPath <audit report path> \
  --iterationCount <cumulative failed rounds, 0 means first-pass success>
```

### State Updates

```yaml
layer: bugfix
stage: fix_passed
bug_id: string
root_cause_status: identified | fixed
artifacts:
  rca: rca/.../rca.md
  fix: fix/.../fix.md
```
### Constraints

- **Self-commit is prohibited**
- Must pass the bugfix stage audit (using the three-layer structure of Cursor Canonical Base / Claude / OMC Runtime Adapter / Repo Add-ons)
- You must write a recurrence test first, and then write the repair implementation.
- Must undergo post-implementation audit
- Must be Master gated

---

## Phase 1: Root cause analysis and BUGFIX document generation (Architect mode)

**Recommended BMAD Agents (display name)**: **Winston Architect** (leading root causes and solutions), **Mary Analyst** (phenomenon and data), **Amelia Development** (implementation and code path), **Quinn Test** (reproduction and acceptance), **John Product Manager** (impact and priority). In Party Mode, the speaking role must be marked with the above display name.

**Process**:

1. Based on the BUG information provided by the user, use **party-mode** to introduce the roles above and conduct **at least 100 rounds** of mutual questioning and debate (BUGFIX belongs to the "generate final plan and final task list" scenario), then end only after the convergence conditions are met (root-cause consensus + no new gaps in the last 2–3 rounds). The primary route must schedule `.claude/agents/party-mode-facilitator.md` through the Agent tool with `subagent_type: party-mode-facilitator`. Only when the specialized facilitator is unavailable may the flow degrade according to the Fallback Strategy and use `subagent_type: general-purpose` with an explicit multi-role simulation prompt.
2. Conduct an in-depth analysis of the root cause until a consensus on the root cause is reached.
3. Generate **BUGFIX document** and complete the BUG report (save to `_bmad-output/` or `bugfix/`).
4. Initiate the **audit subtask**:
   - Subagent: schedule `.claude/agents/auditors/auditor-bugfix.md` through Agent tool (`subagent_type: general-purpose`), if not found, press Fallback Strategy to downgrade
   - Prompt word: **Must** copy the entire "Phase 1 Audit Complete Prompt Template" in this skill to the prompt of the audit subtask (see below)
   - Iterate until the audit conclusion is **"fully covered and verified"**

### Phase 1: Steps that the master Agent must perform

1. Copy the entire section of the template **BUG-A1-ROOT** (stage one debate complete prompt template) into the `prompt` parameter of the Agent tool.
2. Replace the placeholder `{BUG phenomenon, reproduction steps, and environment information provided by the user}` with the user's actual description (if the user does not write it clearly, it can be summarized into a paragraph). It is **not allowed** to leave it blank or write "see above".
3. Initiate the subtask; after the subtask returns, if a BUGFIX document is generated, initiate the audit subtask (use the template **BUG-A1-AUDIT** (phase one audit complete prompt template) to copy the entire section).

### Stage root debate complete prompt template (the main agent must copy it completely and replace the placeholder before passing it in)

**Template ID**: BUG-A1-ROOT. **Template Boundary**: Starting from "Please use BMAD multi-role debate" in the code block and ending with "Use Chinese throughout."
```
【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段一根因辩论完整 prompt 模板（ID BUG-A1-ROOT）整段复制并替换占位符后重新发起。

本任务以以下 BMAD 角色进行多角色辩论（**至少 100 轮**，BUGFIX 产出最终方案与 §7 任务列表；满足根因共识且近 2–3 轮无新 gap 再结束）。请对以下 BUG 进行根因分析并达成共识。

**BUG 描述**（由主 Agent 填入用户反馈）：
{用户提供的 BUG 现象、复现步骤、环境信息}

**角色与展示名**：请以以下展示名标注每次发言——🏗️ Winston 架构师（主导根因与方案）、📊 Mary 分析师（现象与数据）、💻 Amelia 开发（实现与代码路径）、🧪 Quinn 测试（复现与验收）、📋 John 产品经理（影响与优先级）。每人从自身视角质疑现象、提出根因假设、反驳或补充，直至达成根因共识。

**发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv`，禁止省略 Icon 或展示名。

**产出要求**：
1. 根因结论（一段话，无歧义）。
2. 生成 BUGFIX 文档，包含：§1 问题描述、§2 根因分析、§3 影响范围、§4 修复方案（须为明确描述，禁止使用本 skill「§ 禁止词表」中的词：可选、可考虑、后续、待定、酌情、视情况、后续迭代）、§5 验收标准。保存至 _bmad-output/ 或 bugfix/。
3. 全程使用中文。
```
### Phase 1 audit complete prompt template (the main Agent must be completely copied to the prompt of the audit subtask)

**Template ID**: BUG-A1-AUDIT. **Template Boundary**: Starting from the first line in the code block "You are a very strict..." to the last sentence of the report end format paragraph specified in Task 1.3 Modification 2 (including "The conclusion format of this report meets the requirements of this paragraph"); the master Agent must include the entire content of this paragraph when copying.

Audit subtask: schedule `.claude/agents/auditors/auditor-bugfix.md` through Agent tool (`subagent_type: general-purpose`). If not found, press Fallback Strategy to downgrade. **Must** copy the entire paragraph below into the prompt of the audit subtask and cannot be omitted.
```
【必读】本 prompt 须为完整审计模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段一审计完整 prompt 模板（ID BUG-A1-AUDIT）整段复制并替换占位符后重新发起。

你是一位非常严苛的代码/文档审计员（对应 BMAD 工作流中的 code-reviewer 审计职责）。请对「已生成的 BUGFIX 文档」进行审计。

审计依据：用户 BUG 描述、根因辩论共识、实际代码/行为（若可查）。

审计内容（逐项验证）：
1. §1 问题描述是否完整、可复现。
2. §2 根因分析是否与共识一致、是否有证据或代码引用。
3. §4 修复方案必须为明确描述。若存在本 skill「§ 禁止词表」中任一词（如可选、可考虑、后续、待定、酌情、视情况、后续迭代），一律判为未通过，并在修改建议中注明：删除该词及所在句，改为明确描述。
4. §5 验收标准是否可执行、可验证。
5. 全文是否使用中文、无技术债占位。

报告结尾必须按以下格式输出：结论：通过 / 未通过。必达子项：① §1 完整可复现；② §2 与共识一致且有证据；③ §4 明确无禁止词；④ §5 可执行可验证；⑤ 全文中文无技术债；⑥ 本报告结论格式符合本段要求。若任一项不满足则结论为未通过，并列出不满足项及每条对应的修改建议（含「删除可选项」或「将某段改为明确描述」）。

**审计未通过时**：你（审计子代理）须在本轮内**直接修改 BUGFIX 文档**以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后再次发起审计。禁止仅输出修改建议而不修改文档。详见 `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`。
```
---

## Phase 2: Update the BUGFIX document after adding information

**Recommended BMAD Agent (display name)**: Same stage one (Winston Architect, Mary Analyst, Amelia Development, Quinn Tester, John Product Manager). Party Mode must be marked with the display name.

**Trigger**: The user adds more information or questions.

**Process**:

1. Use **party-mode** again (or downgrade according to Fallback Strategy), introduce the above-mentioned multiple roles for **at least 100 rounds** of debate (BUGFIX belongs to the "generate final plan and final task list" scenario, and end after meeting the convergence conditions).
2. Reach a consensus on root cause analysis updates.
3. Update BUGFIX documentation.
4. Initiate the audit subtask (same as stage 1):
   - Subagent: `.claude/agents/auditors/auditor-bugfix.md` or downgrade by Fallback Strategy
   - Prompt words: **Must** use the "Phase 1 audit complete prompt template" (template ID BUG-A1-AUDIT) in this skill and copy the entire section into the audit subtask prompt. Audit-prompts §5 or other general audit prompt words must not be used.
   - Iterate to "complete coverage and verification passed"

### Phase 2: Steps that the master Agent must perform

1. Copy the entire section of the template **BUG-A2-UPDATE** (Phase 2 Information Supplementary Debate Complete Prompt Template) into the `prompt` parameter of the Agent tool.
2. Replace the placeholder: `{User-supplied phenomena, steps, environment, etc.}` → User’s actual supplementary content; `{Main Agent filled in path}` → Full path of BUGFIX document (such as `_bmad-output/BUGFIX_xxx_2026-02-27.md`).
3. Initiate the debate subtask; after the subtask returns, update the BUGFIX document based on the output (if the main agent directly updates the document based on analysis, this step can be merged into the output of step 2).
4. **[Required]** Initiate the audit subtask: Use the template ID **BUG-A1-AUDIT** (phase one audit complete prompt template) to copy the entire section. The subagent is `.claude/agents/auditors/auditor-bugfix.md` or downgrade according to the Fallback Strategy.
5. **[Required]** If the audit conclusion is failed, **the audit sub-agent must directly modify the BUGFIX document** in this round to eliminate the gap; the main Agent will initiate the audit again after receiving the report. It is prohibited to only output modification suggestions without modifying the document. For document audit iteration rules, see `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`. Repeat until the conclusion is "complete coverage, verification passed". **Prohibited** Only one round of audit will be completed if it fails.

**Simplified path**: If the supplementary information provided by the user is sufficient (such as a root cause analysis document), the main agent can directly update the BUGFIX document according to the analysis, **but it must** initiate the audit subtask (BUG-A1-AUDIT) after the update and iterate until it passes. Debates can be omitted, but audits cannot.

**Template ID**: BUG-A2-UPDATE. Phase 2 Information Supplementary Debate Complete prompt template (the master Agent must copy it completely and replace the placeholders before passing it in)
```
【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段二信息补充辩论完整 prompt 模板（ID BUG-A2-UPDATE）整段复制并替换占位符后重新发起。

本任务以以下 BMAD 角色进行多角色辩论（**至少 100 轮**，BUGFIX 产出最终方案与 §7 任务列表；满足共识且近 2–3 轮无新 gap 再结束）。

用户对 BUG 补充了以下信息，请基于原 BUGFIX 文档再次进行多角色辩论（至少 100 轮），更新根因与文档。

**补充信息**（由主 Agent 填入）：
{用户补充的现象、步骤、环境等}

**原 BUGFIX 文档路径**：{主 Agent 填入路径}

**角色与展示名**：🏗️ Winston 架构师、📊 Mary 分析师、💻 Amelia 开发、🧪 Quinn 测试、📋 John 产品经理。

**发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv`，禁止省略 Icon 或展示名。

**产出**：更新后的 BUGFIX 文档（覆盖 §1–§5）。§4 修复方案须为明确描述，禁止使用本 skill「§ 禁止词表」中的词。保存至原路径。全程中文。
```
---

## Phase 3: Supplementing the final task list

**Recommended BMAD Agent (display name)**: **Winston Architect** (solution selection and architectural consistency), **Dr. Quinn Problem Solving** (solution comparison and tradeoff), **Amelia Development** (task implementability), **Quinn Testing** (acceptance and use cases). Party Mode must be marked with the display name.

**Trigger**: User request to supplement the final task list for the BUGFIX documentation.

**Process**:

1. Use **party-mode** (or downgrade according to Fallback Strategy), introduce the above-mentioned multiple roles to conduct **at least 100 rounds** of debate (BUGFIX belongs to the "generating the final plan and final task list" scenario, and ends after meeting the convergence conditions).
2. Conduct comparative analysis and tradeoff from multiple solutions until the **final and optimal solution** is selected for all problems.
3. Documentation must:
   - Clearly describe **the rationale for selecting the final solution**
   - Clearly describe **each task** (recommended to be placed in BUGFIX §7): modify the path, modify the line number and content, and acceptance criteria
   - **Prohibited** Vague descriptions such as "optional", "can be considered", "follow-up" etc.
   - **BANNED** Technical Debt
4. Initiate the **audit subtask** (same as stages 1 and 2):
   - Subagent: `.claude/agents/auditors/auditor-bugfix.md` or downgrade by Fallback Strategy
   - Prompt word: **Must** use the "Phase 3 §7 Audit complete prompt template" (template ID BUG-A3-AUDIT) in this skill and copy the entire section into the audit subtask prompt
   - Iterate until the audit conclusion is **"passed"**

### Phase 3: Steps that the master Agent must perform

1. Copy the entire section of the template **BUG-A3-TASKS** (the phase three task list supplements the complete prompt template) into the `prompt` parameter of the Agent tool, and replace the placeholder: `{Main Agent fills in the BUGFIX document path}` → the actual BUGFIX document full path; `{project-root}` → the absolute path to the project root directory; if BUGFIX For specific code locations, fill in the file path and line number or positionable fragment in the "Key Code Location Reference".
2. Carry out the pre-launch self-check list (see below) and confirm each item.
3. Output the self-test results (for the format, see the self-test result example in "Main Agent Passing Prompt Word Rules").
4. Initiate the subtask; the subagent should produce the updated BUGFIX document (including §7) and write the original file path.
5. **[Required]** After the subtask returns, initiate the audit subtask: use the template **BUG-A3-AUDIT** (Phase 3 §7 Audit complete prompt template) to copy the entire section. The subagent is `.claude/agents/auditors/auditor-bugfix.md` or downgrade according to the Fallback Strategy.
6. **[Required]** If the audit conclusion is failed, **the audit sub-agent must directly modify the BUGFIX document** in this round; the main Agent will initiate the audit again after receiving the report. It is prohibited to only output modification suggestions without modifying the document. For document audit iteration rules, see `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`. Repeat until the conclusion is "Passed". **Prohibited** Only one round of audit will be completed if it fails.

**DO NOT **: Do not perform step 4 without completing steps 2 and 3. Steps 5 and 6 must not be omitted after step 4 has produced §7.

**Self-check before launching**: Confirm that the prompt contains the BUGFIX document path and project root directory; confirm that requirements such as "at least 100 rounds" and "complete copy" are not omitted.

### The phase three task list is supplemented with a complete prompt template (the master Agent must completely copy and replace the placeholder before passing it in)

**Template ID**: BUG-A3-TASKS. **Template Boundary**: Starting from the first line in the code block "Please do the following BUGFIX..." and ending with "...Use Chinese throughout."
```
【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段三任务列表补充完整 prompt 模板（ID BUG-A3-TASKS）整段复制并替换占位符后重新发起。

本任务以以下 BMAD 角色进行多角色辩论（**至少 100 轮**，BUGFIX 产出最终方案与 §7 任务列表；满足单一方案共识且近 2–3 轮无新 gap 再结束）。

请为以下 BUGFIX 文档补充「最终任务列表」（建议作为 §7）。

**BUGFIX 文档路径**：{主 Agent 填入 BUGFIX 文档路径}
**项目根目录**：{project-root}

**角色与展示名**：🏗️ Winston 架构师（方案选择与架构一致性）、🔬 Dr. Quinn 问题解决（方案对比与 tradeoff）、💻 Amelia 开发（任务可实施性）、🧪 Quinn 测试（验收与用例）。

**发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv`，禁止省略 Icon 或展示名。

**要求**：
1. 先读取上述 BUGFIX 文档全文，理解 §1–§5 及 §4 中的修复方案。
2. 进行至少 100 轮多角色辩论（BUGFIX 产出最终方案与 §7 任务列表），对多种实现方案做对比与 tradeoff，选定最终方案并写明选择理由；满足共识且近 2–3 轮无新 gap 再结束。
3. §7 中每一项任务须包含：修改路径、修改行号及内容、验收标准；禁止「可选」「可考虑」「后续」及技术债。**若任务包含运行全量或回归测试，验收标准须写明「失败数为 0，或所有失败已列入正式排除清单并符合正式排除规定」**。
4. §7 中涉及生产代码的任务，须拆为两子步并在验收标准中写明：（1）子步骤一：新增或修改测试/验收，验收命令运行结果应为失败（红灯）；（2）子步骤二：实现生产代码，验收命令运行结果应为通过（绿灯）。不涉及生产代码的任务可仅写出该任务的验收标准。
5. 产出更新后的 BUGFIX 文档（含 §7），直接写入原文件路径。
6. 全程使用中文。

**关键代码位置参考**（若 BUGFIX 涉及具体代码位置，主 Agent 可在此填入文件路径与行号或可定位片段，便于子代理写出含行号的任务）：
{主 Agent 按需填入：如 engine.py L5814 附近、indicator_worker.py L1432–1449 等}
```
### Phase 3 §7 Audit complete prompt template (the main Agent must be completely copied to the prompt of the audit subtask)

**Template ID**: BUG-A3-AUDIT. **Template Boundary**: Starting from the first line of the code block "You are a very strict..." to the last sentence of the format section at the end of the report.

Audit subtask: schedule `.claude/agents/auditors/auditor-bugfix.md` through Agent tool (`subagent_type: general-purpose`). If not found, press Fallback Strategy to downgrade. **Must** copy the entire paragraph below into the prompt of the audit subtask and cannot be omitted. The placeholder `{Master Agent fills in BUGFIX document path}` must be replaced with the actual BUGFIX document full path.
```
【必读】本 prompt 须为完整审计模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段三审计完整 prompt 模板（ID BUG-A3-AUDIT）整段复制并替换占位符后重新发起。

你是一位非常严苛的代码/文档审计员（对应 BMAD 工作流中的 code-reviewer 审计职责）。请对「已补充 §7 任务列表的 BUGFIX 文档」进行阶段三审计。

**待审计 BUGFIX 文档路径**：{主 Agent 填入 BUGFIX 文档路径}

审计依据：§4 修复方案、bmad-bug-assistant 技能 §7 要求（修改路径、行号、内容、验收标准；禁止词；TDD 子步骤）、§4 与 §7 一致性。

审计内容（逐项验证，任一项不满足则结论为未通过）：
1. §7 中每一项任务是否包含：修改路径、修改行号及内容、验收标准。
2. §7 中涉及生产代码的任务是否拆为两子步：子步骤一（红灯）、子步骤二（绿灯）。
3. §7 与 §4 是否一致：方案 A/B/E/C 的 §7 任务是否完整覆盖 §4 描述；若 §4 对某实现方式有明确规定（如「preloadComplete 信号 + QueuedConnection」），§7 须与之一致，否则判为未通过。
4. §7 是否无禁止词（可选、可考虑、后续、待定、酌情、视情况、技术债）。
5. **§7 中涉及全量/回归测试的任务**，其验收标准是否包含「失败数为 0 或所有失败已列入正式排除清单」；若实际执行了回归，实施后审计须按同一标准检查失败与排除清单。**禁止自动生成 exclude**：审计员**禁止**在审计过程中创建或更新 EXCLUDED_TESTS_*.md；可输出「建议排除清单」作为修改建议，但不得创建文件。若审计员产出了排除清单文件，结论为未通过。
6. §6 辩论纪要是否与 §7 一致；若有冲突以 §4 为准。

报告结尾必须按以下格式输出：结论：通过 / 未通过。必达子项 1–6 如上；若任一项不满足则结论为未通过，并列出不满足项及每条对应的修改建议。

**审计未通过时**：你（审计子代理）须在本轮内**直接修改 BUGFIX 文档**以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后再次发起审计。禁止仅输出修改建议而不修改文档。详见 `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`。
```
---

## Phase 4: Implement the fix (development mode)

**Recommended BMAD Agent (display name)**: **Amelia Development** (implementation); use `.claude/agents/auditors/auditor-implement.md` during the audit phase (or downgrade by Fallback Strategy).

**Mandatory constraints**:
- Implementation must be through **subagent** (Agent tool `subagent_type: general-purpose`)
- Main Agent **Direct modification of production code is prohibited**
- Strictly adhere to **ralph-method**, **TDD traffic light**, **speckit-workflow**
- **Fully in Chinese**

### 4.1 Initiate implementation subtask

| Item | Content |
| -- | ---- |
| Subagent | Agent tool (`subagent_type: general-purpose`) |
| prompt | **Must copy** template **BUG-A4-IMPL** in full (detailed prompts for phase four implementation), fill in the BUGFIX path and project root directory; **It is prohibited to omit** any mandatory compliance items |
| Main Agent Responsibilities | Initiate subtasks, pass in complete prompts, and collect subagent output |

#### Main Agent self-check list before launching

Before initiating a subtask, you must confirm that the prompt contains all of the following content, otherwise the subagent cannot comply with ralph-method and TDD traffic lights:

- [ ] ralph-method: prd/progress creation and update rules (including naming rules, updated after each US is completed)
- [ ] TDD traffic light: first change test (red light) → implement (green light) → refactor; each step is run and accepted; progress must contain [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] format records (see bmad-story-assistant §3.2)
- [ ] "Please read ralph-method and speckit-workflow skills" or equivalent **inline constraints** (see template below)
- [ ] BUGFIX document path, chapter where the task list is located (§7 or §8.1, etc.), project root directory
- [ ] The section in which the task list is located is clearly written (§7 or §8.1).
- [ ] If BUGFIX §7 contains a regression task and a failure is known and the user refuses to exclude, confirm that the subagent is informed in the prompt that [TDD-RED] and the user's decision must be recorded in progress.

#### Stage 4 implements detailed prompt words (the main Agent must copy the entire paragraph into the prompt of the subtask and cannot be omitted)

**Template ID**: BUG-A4-IMPL.

**Main Agent operation**: Copy the entire paragraph from "Please do the following BUGFIX document" to "Inline constraint execution." **to the `prompt` parameter of the Agent tool; only replace `{Main Agent fill in}` with the BUGFIX document path, and replace `{project-root}` with the absolute path to the project root directory; **Do not** delete any mandatory compliance items.
```
你是一位非常资深的开发专家 Amelia 开发（对应 BMAD 开发职责），负责按 BUGFIX 文档与任务列表执行实施。请按以下规范执行。

【必做】TDD 红绿灯记录：每完成一个涉及生产代码的任务的绿灯后，**立即**在 progress 追加三行：
`[TDD-RED] <任务ID> <验收命令> => N failed`
`[TDD-GREEN] <任务ID> <验收命令> => N passed`
`[TDD-REFACTOR] <任务ID> <内容> | 无需重构 ✓`
交付前自检：对照 §7 逐项检查——若该任务涉及生产代码，progress 中是否有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 在 [TDD-GREEN] 之前？若否，补充后再交付。

**BUGFIX 文档路径**：{主 Agent 填入}
**任务列表**：见上述文档的 §7（任务列表）或 §8.1（实施步骤），请根据文档实际结构确定章节。
**项目根目录**：{project-root}

**Amelia 开发规范（可执行定义，须与下方 ralph-method/TDD/speckit 同时满足）**：
① 按 §7（或 §8.1）任务顺序执行，不跳过。
② 每项完成须运行对应验收并通过后再进行下一项。
③ 不得标记完成但未实现或未运行验收。
④ 禁止在任务描述或代码注释中添加「将在后续迭代」。
⑤ 注释与提交使用中文。

**上述 Amelia 规范与下方 ralph-method、TDD 红绿灯、speckit-workflow 两类约束均须满足，不可只遵守其中一类。**

**强制遵守（必须逐条执行，不得跳过）**：

1. **ralph-method**：
   - 实施开始前，在 BUGFIX 文档同目录创建 `prd.{stem}.json` 与 `progress.{stem}.txt`（stem 为 BUGFIX 文件名无扩展名，如 BUGFIX_foo_2026-02-26）。
   - 将任务列表中的每项映射为 prd 中的 user story，初始 passes=false。**prd 须符合 ralph-method schema**：涉及生产代码的 US 含 `involvesProductionCode: true` 与 `tddSteps`（RED/GREEN/REFACTOR 三阶段）；仅文档/配置的含 `tddSteps`（DONE 单阶段）。
   - **progress 预填 TDD 槽位**：生成 progress 时，对每个 US 预填 `[TDD-RED] _pending_`、`[TDD-GREEN] _pending_`、`[TDD-REFACTOR] _pending_` 或 `[DONE] _pending_`，涉及生产代码的 US 含三者，仅文档/配置的含 [DONE]；执行时将 `_pending_` 替换为实际结果。
   - 每完成一项任务（US），必须：① 将对应 story 的 passes 设为 true；② 在 progress 中追加时间戳与完成说明。
   - 按 US 顺序执行，不得跳过。

2. **TDD 红绿灯**（必须严格按顺序执行，不可跳过）：**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现。
   - **红灯**：对当前 US 涉及的生产行为，先新增或修改测试/验收（如 pytest、验收命令），使验收**失败**（红灯），并记录或输出失败结果。
   - **绿灯**：再实现或修改生产代码，使上述验收**通过**（绿灯），并运行验收命令确认。
   - **重构**：若实现后代码可读性或结构可改进，在验收仍通过的前提下进行重构，并再次运行验收确认。
   - 若当前 US 不涉及生产代码（仅文档、配置等），仅运行该 US 规定的验收命令并通过即可。
   - **progress 必须包含**每子步骤的验收命令与结果，格式：`[TDD-RED] <任务ID> <验收命令> => N failed`、`[TDD-GREEN] <任务ID> <验收命令> => N passed`、`[TDD-REFACTOR] <任务ID> <内容> | 无需重构 ✓`。手动验收可用 `[TDD-RED] 手动：…`、`[TDD-GREEN] 手动：…`。完成红灯子步骤后**立即**在 progress 追加 `[TDD-RED] ...`；完成绿灯子步骤后**立即**追加 `[TDD-GREEN] ...`；**无论是否有重构**，须追加 `[TDD-REFACTOR]`（无具体重构时写「无需重构 ✓」）。禁止用「最终回归全部通过」替代逐任务的 TDD 记录。实施时须在 progress 中按 bmad-story-assistant §3.2 要求记录 TDD 红灯→绿灯→重构。**回归失败且用户拒绝排除时**：当回归/验收命令执行后存在失败用例，且用户**拒绝**批准排除时，须在 progress 中**立即**追加 [TDD-RED] 记录，格式：`[TDD-RED] <任务ID> <验收命令> => N failed, M passed（用户拒绝批准排除，N 个失败用例须修复）`。该记录须在进入修复流程**之前**写入。必备字段：任务 ID、验收命令、失败数、通过数、用户决策。

3. **speckit-workflow**：禁止伪实现与占位；必须运行验收命令；架构忠实于 BUGFIX 文档。

4. 禁止在任务描述中添加「将在后续迭代」；禁止标记完成但功能未实际调用。

5. **失败用例必须修或记**：执行验收/回归命令后，若存在失败用例，必须① 输出完整失败列表；② **询问用户**「是否批准将上述用例列入正式排除清单」；③ 仅当用户**明确批准**时，方可创建或更新正式排除清单（路径与格式见本技能「正式排除失败用例的规定」）；④ 若用户**拒绝**，必须进入修复流程，不得创建排除清单，并在 progress 中记录 [TDD-RED] 及用户决策（见上方 TDD 强化要求）。不得以「既有问题」「与本次无关」等未记录理由跳过；未完成此项不得将相关任务标为完成。

6. **pytest 执行约束**：执行 pytest 时必须在项目根目录运行，使用 `pytest <path> -v`，不得在子目录或隔离环境中运行导致 conftest 未加载；若验收命令包含 `-n auto` 等，需确认 conftest 的 session 钩子在 worker 中生效。

7. 全程使用中文撰写注释、提交与进度说明。

**交付前自检**：对照 BUGFIX §7，逐项检查：若该任务涉及生产代码，progress 中是否有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 在 [TDD-GREEN] 之前？若否，补充后再交付。

请读取 ralph-method 与 speckit-workflow 技能（若可访问），严格按其中规则执行；若无法访问技能，则按上述内联约束执行。

Amelia 开发 的规范已在上方 5 条中列出，子代理按内联执行即可，无需再加载 dev 技能。
```
#### 4.1.5 Cleanup after the subtask returns (mandatory step for the main Agent)

After the subtask returns or times out, you **must** check `_bmad-output/current_pytest_session_pid.txt`; if the file exists, you **must** execute the following command and delete the file; it is **not allowed** to skip this step.

- **Windows (PowerShell)**: `python tools/cleanup_test_processes.py --only-from-file --session-pid (Get-Content _bmad-output/current_pytest_session_pid.txt)`
- **Linux/macOS**: `python tools/cleanup_test_processes.py --only-from-file --session-pid $(cat _bmad-output/current_pytest_session_pid.txt)`

Delete `_bmad-output/current_pytest_session_pid.txt` after execution is completed.

### 4.2 Initiate audit subtask (post-implementation audit)

| Item | Content |
| -- | ---- |
| Subagent | Schedule `.claude/agents/auditors/auditor-implement.md` through Agent tool (`subagent_type: general-purpose`), if not found, press Fallback Strategy to downgrade |
| Prompt word | **Must** copy the entire template **BUG-A4-POSTAUDIT** (phase four post-implementation audit complete prompt template) to the prompt of the audit subtask, and fill in the BUGFIX document path and §7 task list path |
| Goal | Iterate to "complete coverage and verification passed" |

**Must be done when it fails (it is forbidden to run for only one round and end)**: If the audit conclusion is "**Failed**" or the audit report lists failed items and modification suggestions, the main Agent **must** execute according to the modification suggestions (entrust the sub-agent to modify the code or update BUGFIX/documentation), and then **initiate** the post-implementation audit again (using the same template BUG-A4-POSTAUDIT); repeat "Audit → If it fails, modify according to the suggestions → Re-audit" until the conclusion is "**fully covered and verified**". It is prohibited to complete only one round of auditing or report completion to the user when the conclusion is that it has failed.

**Unified host close-out after passing the audit (must be executed)**: After the post-implementation audit conclusion is "complete coverage, verification passed", the main Agent **must not** hand-run `parseAndWriteScore` or any audit-index CLI. It must call `runAuditorHost` as the single post-audit entry. When a BUGFIX document is present, the host/runner must receive `artifactDocPath=<BUGFIX document path>` to ensure `record.source_path` and registry audit index both point to the BUGFIX document instead of the audit report path.

**Path Convention**: The value of `artifactDocPath` is consistent with the "Output Path Convention" - when there is story: `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md`; without story When: `_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md`.

**Template ID**: BUG-A4-POSTAUDIT. **Complete audit prompt template after the implementation of Phase 4** (the main Agent must be completely copied to the prompt of the audit subtask):
```
你是一位非常严苛的代码审计员（对应 BMAD 工作流中的 code-reviewer 审计职责）。请对「已执行完成的 BUGFIX §7 任务列表」进行执行阶段审计。

审计依据：
1. BUGFIX 文档（§1–§5、§7）
2. 实际产出的生产代码与测试代码

审计内容（必须逐项验证，任一项不满足则结论为未通过）：
1. 任务列表（§7 或 §8.1）中每一项是否已真正实现（无预留、占位、假完成）。
2. 生产代码是否在关键路径中被使用。
3. 验收标准是否已按实际运行结果验证通过（若 §7 中写了验收命令，审计员必须执行该命令并报告通过/失败）。
4. **Amelia 开发规范**：① 是否按任务顺序执行；② 每项是否均有运行验收并通过；③ 是否无标记完成但未实现；④ 是否无「将在后续迭代」表述；⑤ 注释与提交是否中文。
5. **ralph-method**：是否存在 prd.{stem}.json 与 progress.{stem}.txt，progress 中是否按 US 有完成时间戳与说明。
6. 项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须作为未通过项；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」豁免。
7. **TDD 红绿灯**：对 §7（或 §8.1）中涉及生产代码的每一项，是否先有失败验收（红灯）再实现并通过验收（绿灯）；**progress 是否包含**每任务的 `[TDD-RED]`、`[TDD-GREEN]`、`[TDD-REFACTOR]` 记录（含验收命令与结果）；若无则判不通过。**TDD 三项验证**：涉及生产代码的每个 US 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行（[TDD-REFACTOR] 允许写「无需重构 ✓」，禁止省略）。**TDD 顺序验证**：对每个任务的 progress 记录，[TDD-RED] 须在 [TDD-GREEN] 之前出现；若同一任务下 [TDD-GREEN] 在 [TDD-RED] 之前或缺少 [TDD-RED]，判为「事后补写」，结论未通过。验证方式：`grep -E "\[TDD-(RED|GREEN|REFACTOR)\]" progress.*.txt` 或目视检查；禁止用「最终回归通过」替代逐任务记录。不满足项⑦的修改建议：在 progress 中按 bmad-story-assistant §3.2 格式补充 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录；**须针对每个缺失任务写出可复制的具体示例**，如「Task 3 应补充：[TDD-RED] T3 pytest tests/xxx -v => 1 failed；[TDD-GREEN] T3 pytest tests/xxx -v => 1 passed；[TDD-REFACTOR] T3 无需重构 ✓」。**回归失败且用户拒绝排除**：若 §7 中存在回归任务，且实际执行时存在失败用例，且用户拒绝批准排除，则 progress 中**必须**包含对应的 [TDD-RED] 记录，格式须含：任务 ID、验收命令、失败数、通过数、「用户拒绝批准排除」。验证方式：`grep -E "\[TDD-RED\].*用户拒绝" progress.*.txt` 或目视检查。若无则判不通过，修改建议：在 progress 中补充，例如「[TDD-RED] US-003 pytest vnpy_datamanager/ -v => 16 failed, 46 passed（用户拒绝批准排除，16 个失败用例须修复）」。
8. **speckit-workflow**：是否无伪实现、是否运行验收命令、是否架构忠实。
9. 是否无「将在后续迭代」等延迟表述。
10. **回归/验收失败用例**：**【回归判定强制规则】** 任何在本 Story 实施前已存在的测试用例，若实施后失败，一律视为回归，须在本轮修复或经用户批准后列入正式排除清单。禁止以「与 Story X 相关」「与本 Story 无关」「来自前置 Story」等理由排除失败用例。判定标准：实施前全量测试通过清单 ∩ 实施后失败清单 = 回归用例集。**强制步骤**：执行全量/回归测试，获取完整通过/失败列表；对每个失败用例核对是否存在于「实施前已存在」的用例集，若存在则标记为回归，须在审计结论中列为「须修复」或「已列入正式排除清单（附用户批准依据）」；禁止以「非本 Story 范围」为由排除。**结论绑定**：若审计结论或验收说明中出现「与 Story X 相关」「与本 Story 无关」「来自 Story 11.1」等表述且用于排除失败用例，且无对应正式排除记录（EXCLUDED_TESTS_*.md 经用户批准），结论为未通过。回归或验收命令执行结果中，失败用例数为 0，或所有失败已列入正式排除清单且清单路径、格式与理由符合本技能「正式排除失败用例的规定」并经本轮审计通过；禁止存在未记录或未审计通过的排除。**禁止自动生成 exclude**：若审计员或实施子代理在本次审计/实施过程中产出了 EXCLUDED_TESTS_*.md 或类似排除清单文件，且**未经用户明确批准**，结论为未通过。排除清单的创建/更新必须经用户明确批准。
11. **主 Agent 兜底 cleanup**：若子任务涉及运行 pytest（§7 或验收命令含 pytest），主 Agent 是否在子任务返回或超时后执行了 4.1.5 规定的兜底 cleanup（检查 `_bmad-output/current_pytest_session_pid.txt`，若存在则执行 `cleanup_test_processes.py --only-from-file --session-pid` 并删除该文件）；若未执行且子任务涉及 pytest，结论为未通过。

验证方式：阅读代码、grep 关键符号、**执行 §7 或文档规定的验收/回归命令并获取完整通过/失败列表**；若存在失败，**核对正式排除清单（若有）并确认每项符合「正式排除」规定**；运行 pytest 等验收命令、核对 §7 验收；**对审计项⑦**：`grep -E "\[TDD-(RED|GREEN|REFACTOR)\]" progress.*.txt` 或目视检查 progress 是否含每任务的 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录；**对审计项⑪**：若 §7 或验收涉及 pytest，确认主 Agent 在子任务返回后执行了兜底 cleanup。

报告结尾必须按以下格式输出：结论：通过 / 未通过。必达子项 1–11 如上；⑪ 主 Agent 兜底 cleanup（若涉及 pytest）；若任一项不满足则结论为未通过，并列出不满足项及每条对应的修改建议。
```
### 4.3 Main Agent Prohibitions

- Direct editing of production code is prohibited
- Implementation tasks must be delegated to subagents
- If the subagent returns incomplete, you can initiate a second subtask, and you are not allowed to directly change the code instead of the subagent.

---

## Usage example

In the following example, when initiating a subtask, the main Agent must use the complete prompt template of this stage in this skill and fill in the placeholders, and cannot be omitted or summarized.

### Example 1: New BUG Report

User: "You cannot see "Synchronize GDS from Chart" when you right-click on the main chart of a multi-period chart. Please analyze the root cause and generate a BUGFIX document. "

Main Agent: Execute Phase 1 - Copy the entire "Phase 1 root-cause debate prompt template" and fill in the user description, then initiate the subtask through the Agent tool with `subagent_type: party-mode-facilitator`; only if the facilitator is unavailable may the flow fall back to `general-purpose`. After the subtask returns, copy the entire "Phase 1 audit prompt template" and initiate the audit subtask; iterate until the audit passes.

### Example 2: Update after supplementary information

User: "Let me add that the multi-period chart appears only after restarting the program and opening the multi-period chart."

Main Agent: Execute Phase 2 - Copy the entire "Phase 2 Information Supplementary Debate Complete Prompt Template", replace the supplementary information and BUGFIX document path and initiate the subtask; then initiate an audit (Phase 1 Audit Template) and iterate until passed.

### Example 3: Supplementary task list

User: "Add final task list to BUGFIX documentation."

Main Agent: Execute Phase 3 - Copy the entire section of "Stage 3 Task List Supplement Complete Prompt Template", fill in the BUGFIX document path and project root directory, and initiate the subtask through the Agent tool; after the sub-agent produces an updated document containing §7, copy the entire section of "Phase 3 §7 Audit Complete Prompt Template" and initiate the audit subtask; if the audit fails, the **audit sub-agent must directly modify the BUGFIX document** in this round, and the main Agent After receiving the report, the audit will be initiated again until passed.

### Example 4: Implementing a fix

User: "Implement fix as per BUGFIX documentation."

Main Agent: Execute Phase 4 - Copy the entire "Phase 4 Implementation Detailed Prompt Word", replace only the BUGFIX document path and project root directory, and initiate a subtask through the Agent tool (`subagent_type: general-purpose`); after the implementation is completed, copy the entire "Phase 4 Post-implementation Audit Complete Prompt Template" and initiate the audit subtask; if the audit conclusion is failed, you must entrust the sub-agent to modify it according to the modification suggestions and initiate the audit again until the conclusion is "complete coverage, verification passed." Direct modification of production code is prohibited.

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->


