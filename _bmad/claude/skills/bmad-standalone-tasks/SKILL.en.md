<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-standalone-tasks
description: |
  Claude Code CLI / OMC adapter entry for BMAD Standalone Tasks.
  Uses Cursor bmad-standalone-tasks as the semantic baseline: parse unfinished work → subagent implementation → post-implementation audit for TASKS/BUGFIX-driven execution.
  When the main Agent starts any subtask, it **must** copy the full prompt template for that phase and fill placeholders—no omission, summary, or paraphrase.
  The main Agent must not edit production code; implementation uses Agent tool subagents (`subagent_type: general-purpose`).
  Prefer `.claude/agents/auditors/auditor-implement`; follow the fallback chain.
  Follows ralph-method (`prd.{stem}.json` / `progress.{stem}.txt`), TDD red–green–refactor, and speckit-workflow.
  Use when: the user provides a TASKS/BUGFIX document and asks to execute unfinished items.
when_to_use: |
  Use when: the user says to implement unfinished items from TASKS_*.md / BUGFIX_*.md or supplies a TASKS/BUGFIX document path to execute.

> **Orphan standalone closeout contract**: when the TASKS / BUGFIX document lives under `_orphan/`, the structured audit report must explicitly provide `stage=standalone_tasks`, `artifactDocPath`, and `reportPath`. `stage=document` is no longer a valid orphan closeout return value. Missing any field, or relying on prose-only `PASS`, must fail closeout conservatively.
references:
  - auditor-tasks-doc: Pre-implementation TASKS audit executor; `.claude/agents/auditors/auditor-tasks-doc.md`
  - auditor-implement: Post-implementation audit executor; `.claude/agents/auditors/auditor-implement.md`
  - speckit-implement: Implementation executor; `.claude/agents/speckit-implement.md`
  - audit-post-impl-rules: `.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`
  - audit-document-iteration-rules: `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - ralph-method: prd + progress files, US order
  - speckit-workflow: no pseudo-impl, run acceptance commands, architecture fidelity
  - prompt-templates: `.claude/skills/bmad-standalone-tasks/references/prompt-templates.md`
---

# Claude adapter: bmad-standalone-tasks

## Purpose

This skill is the unified Claude Code CLI / OMC entry for Cursor `bmad-standalone-tasks`.

The goal is **not** to blindly copy the Cursor skill, but to:

1. **Inherit validated standalone execution semantics** (extract unfinished items from TASKS/BUGFIX → subagent implement → post-implementation audit)
2. **Map executors to `.claude/agents/`** (audit → `auditor-implement`, `auditor-tasks-doc`; implement → `speckit-implement` or generic executor)
3. **Integrate** handoff, scoring, and commit gate
4. **Ensure** Claude Code CLI can run the standalone task flow end-to-end

---

## Core acceptance criteria

The Claude variant must:

- Act as the **standalone task entry** for Claude Code CLI, unifying parse → implement → audit
- Keep executor selection, fallback, and scoring write aligned with the validated Cursor flow
- Fully integrate:
  - `auditor-tasks-doc`, `auditor-implement`
  - Scoring write (`parse-and-write-score.ts`)
  - Handoff protocol
- **Not** mix Cursor Canonical Base, Claude Runtime Adapter, and Repo Add-ons into unclear rewrites
- **Main Agent must not edit production code** (FR20a)

---

## Cursor canonical base

The following inherits Cursor `bmad-standalone-tasks` as the business baseline; do not rewrite intent arbitrarily.

Execute unfinished work from a **single TASKS or BUGFIX document** in a single session. Implementation and code edits are **only** done by subagents; the main Agent orchestrates and audits.

### When to use

- User says: **"/bmad implement unfinished items in {document}"** or equivalent (e.g. implement per `BUGFIX_xxx.md`, `TASKS_xxx.md`).
- Input: one **document path** (`TASKS_*.md`, `BUGFIX_*.md`, or similar list with clear items and acceptance).

### Optional inputs and multi-document convention

- **Working directory**: defaults to project root; if the user specifies one, resolve `DOC_PATH` relative to that directory or as absolute.
- **Branch name**: if ralph-method `prd` needs `branchName`, infer from doc/env or ask the user.
- **Multiple docs**: if several TASKS/BUGFIX docs are mentioned, use the **first explicitly named single document**; `prd`/`progress` names follow that document’s stem only.

### Prerequisite: parse unfinished task list

Before starting the implementation subtask, the main Agent must parse the document and list unfinished items: task tables (e.g. §7), unchecked items, sections marked TODO/incomplete. If nothing is explicitly marked, compare document order with the co-located `progress` file—**treat as unfinished** anything not logged in `progress` and not `passes` in `prd`. Pass that list into the Step 1 prompt. Progress file name: `progress.{stem}.txt` (ralph-method).

### Hard constraints (non-negotiable)

1. **Implementation only via subagent**  
   All production and test code changes go through Agent tool (`subagent_type: general-purpose`). The main Agent **must not** use `search_replace`, `write`, or `edit` on production code.

2. **ralph-method**  
   - Create and maintain **prd** and **progress** beside the reference document (`prd.{stem}.json`, `progress.{stem}.txt` for e.g. `BUGFIX_foo.md`).  
   - After **each** completed US: update prd (`passes=true`), append progress (timestamped story log).  
   - Execute US in order.

3. **TDD red–green–refactor**  
   Per US: tests first (red) → implement until green → refactor. Do not mark done without passing tests.

4. **speckit-workflow**  
   No placeholders or pseudo-implementation; run acceptance commands from the document; stay faithful to the BUGFIX/TASKS doc.

5. **Forbidden**  
   - Do not add defer-to-later phrasing in task text (Chinese specs often forbid literals like deferred-to-next-iteration wording; match your TASKS/BUGFIX language).  
   - Do not mark complete if behavior is not invoked or verified.

### Main Agent prompt rules (mandatory)

For every subagent (Agent tool) launch:

1. **Use the full template** for that phase; **no** summary, abbreviation, or paraphrase.
2. **Copy the entire template** into the subtask `prompt`; **no** “bullet points only” or “see below”.
3. **Replace all placeholders** (e.g. `{DOC_PATH}`, `{TASK_LIST}`) before sending.
4. **Self-check first**: if the phase has a pre-flight checklist, confirm each item before launch.
5. **No summarization**: the subtask prompt must contain the full template body with placeholders filled.
6. **Bad examples**: “execute per bmad-standalone-tasks template”; “see Step 1 in the skill”; “constraints above”.
7. **Good example**: full template text in the prompt, placeholders replaced, pre-flight checklist printed before launch.
8. **Self-check is mandatory**: do not launch without printing self-check results, e.g. a line stating Step 1 template was copied in full and placeholders were replaced.

---

## Claude/OMC runtime adapter

### Executor tiers and fallback

Two families: **implementation** and **audit**.

#### Implementation executor (Step 1)

| Tier | Executor | Note |
|------|----------|------|
| L1 | `.claude/agents/speckit-implement.md` → Agent tool (`subagent_type: general-purpose`) | Primary: pass full agent markdown as prompt |
| L2 | Generic Agent tool + inline implementation prompt | If `speckit-implement` missing |
| L3 | Main Agent direct | Only if L1/L2 unavailable |

#### Audit executor (Step 2: post-implementation audit)

| Tier | Executor | Note |
|------|----------|------|
| L1 | `.claude/agents/auditors/auditor-implement.md` → Agent tool | Primary |
| L2 | oh-my-claudecode `code-reviewer` | OMC fallback |
| L3 | `code-review` skill under speckit-workflow | Skill fallback |
| L4 | Main Agent runs the same three-layer prompt | Last resort |

#### Optional pre-doc audit (Step 0)

| Tier | Executor | Note |
|------|----------|------|
| L1 | `.claude/agents/auditors/auditor-tasks-doc.md` | Primary |
| L2 | Generic Agent tool + audit prompt | Fallback |
| L3 | Main Agent direct | Last resort |

**Fallback notice (FR26)**: when downgrading L1→L2/L3/L4, print which tier is active, e.g. “downgraded from L1 (auditor-implement) to L2 (OMC code-reviewer) for audit”.

### Runtime contracts

- Before each subagent call, output **CLI Calling Summary** (5 fields):

```yaml
=== CLI Calling Summary ===
Input: {args / document path}
Template: {prompt template name}
Output: {expected artifact}
Fallback: {downgrade plan}
Acceptance: {acceptance criteria}
```

- After each step, output **YAML Handoff**:

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_impl|standalone_audit
  batch: {current batch}
artifacts:
  tasks_doc: {TASKS document path}
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
next_steps:
  - {next action}
handoff:
  next_action: implement_next_batch|post_batch_audit|commit_gate|revise_tasks_doc
  next_agent: bmad-standalone-tasks|auditor-implement|bmad-master|auditor-tasks-doc
  ready: true|false
```

### Main Agent responsibilities

- **Do**: resolve path, read tasks, **launch Agent tool subagents** for implement and audit, pass context, **summarize** results.
- **Do**: if incomplete, **resume** Agent tool with same agent id or continuation context; do **not** implement code yourself.
- **Do not**: edit production/test code (including paths listed as implementation targets in the TASKS/BUGFIX doc).
- **Do not**: directly edit `prd.{stem}.json` or `progress.{stem}.txt` (subagent maintains them per ralph-method).

---

## Step 1: Implementation sub-task

**Tool**: Agent tool  
**subagent_type**: `general-purpose`

### Pre-flight checklist

- [ ] `DOC_PATH` set (absolute or repo-relative)
- [ ] `TASK_LIST` parsed from document
- [ ] CLI Calling Summary printed
- [ ] Full template copied (not a summary)

### CLI Calling Summary example

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={path}, TASK_LIST={scope}
Template: Step 1 Implementation Prompt
Output: completed US ids, verification, prd/progress updates
Fallback: L2 generic Agent tool + inline prompt
Acceptance: all US passes=true and TDD log complete
```

### Prompt template (copy in full; replace placeholders)

```
**前置（必须）**：请先读取并遵循以下技能再执行下方任务：
- **ralph-method**：prd/progress 命名与 schema（与当前文档同目录、prd.{stem}.json / progress.{stem}.txt）、每完成一 US 更新 prd 与 progress。
- **speckit-workflow**：TDD 红绿灯、15 条铁律、验收命令、架构忠实；禁止伪实现与占位。
（技能可从当前环境可用技能中加载；若无法定位则按本 prompt 下列约束执行。）

你正在按 **TASKS/BUGFIX 文档** 执行未完成任务。必须严格遵循以下约束，不得违反。

## 文档与路径
- **TASKS/BUGFIX 文档路径**：{DOC_PATH}（请使用绝对路径或相对项目根的路径进行读写，勿依赖当前工作目录。）
- **任务清单**：{TASK_LIST}

## 强制约束
1. **ralph-method**：在本文档同目录创建并维护 prd 与 progress 文件（文档为 BUGFIX_xxx.md 时使用 prd.BUGFIX_xxx.json、progress.BUGFIX_xxx.txt）；每完成一个 US 必须更新 prd（对应 passes=true）、progress（追加一条带时间戳的 story log）；按 US 顺序执行。**prd 须符合 ralph-method schema**：涉及生产代码的 US 含 `involvesProductionCode: true` 与 `tddSteps`（RED/GREEN/REFACTOR 三阶段）；仅文档/配置的含 `tddSteps`（DONE 单阶段）。**progress 预填 TDD 槽位**：生成 progress 时，对每个 US 预填 `[TDD-RED] _pending_`、`[TDD-GREEN] _pending_`、`[TDD-REFACTOR] _pending_` 或 `[DONE] _pending_`，涉及生产代码的 US 含三者，仅文档/配置的含 [DONE]；执行时将 `_pending_` 替换为实际结果。
2. **TDD 红绿灯**：**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现。每个 US 执行前先写/补测试（红灯）→ 实现使通过（绿灯）→ 重构。
   **【TDD 红绿灯阻塞约束】** 每个涉及生产代码的任务执行顺序为：① 先写/补测试并运行验收 → 必须得到失败结果（红灯）；② 立即在 progress 追加 [TDD-RED] <任务ID> <验收命令> => N failed；③ 再实现并通过验收 → 得到通过结果（绿灯）；④ 立即在 progress 追加 [TDD-GREEN] <任务ID> <验收命令> => N passed；⑤ **无论是否有重构**，在 progress 追加 [TDD-REFACTOR] <任务ID> <内容>（无具体重构时写「无需重构 ✓」）。禁止在未完成步骤 1–2 之前执行步骤 3。禁止所有任务完成后集中补写 TDD 记录。**交付前自检**：涉及生产代码的每个 US，progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 须在 [TDD-GREEN] 之前；缺任一项则补充后再交付。
3. **speckit-workflow**：禁止伪实现、占位、TODO 式实现；必须运行文档中的验收命令；架构忠实于 BUGFIX/TASKS 文档；禁止在任务描述中添加「将在后续迭代」；禁止标记完成但功能未实际调用。
4. **验收**：每批任务完成后运行文档中给出的 pytest 或验收命令，并将结果写入 progress。

请读取上述路径下的文档，按未完成任务逐项实施，并输出：已完成的 US/任务编号、验收命令运行结果、以及更新后的 prd/progress 状态摘要。
```

### Placeholder notes

- **DOC_PATH**: absolute path or repo-relative path to the TASKS/BUGFIX doc (main Agent resolves from user input; absolute recommended).
- **TASK_LIST**: unfinished items parsed by the main Agent (e.g. §7 T7a-1…). For resume, use the “Resume implementation subtask” template in `references/prompt-templates.md` with “already completed” and “this batch” scopes.

Main Agent only: invoke Agent tool with this prompt, then collect and summarize (resume if needed).

### YAML Handoff (after Step 1)

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_impl
  batch: {current batch}
  completed_us: [{completed US ids}]
artifacts:
  tasks_doc: {DOC_PATH}
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
next_steps:
  - Start Step 2 post-implementation audit
handoff:
  next_action: post_batch_audit
  next_agent: auditor-implement
  ready: true
```

---

## Step 2: Audit sub-task (after implementation)

**Tool**: Agent tool  
**subagent_type**: `general-purpose` (pass full `.claude/agents/auditors/auditor-implement.md` or inline prompt below)

### Auditor selection (fallback)

1. **L1**: Read `.claude/agents/auditors/auditor-implement.md` in full → Agent tool  
2. **L2**: OMC `code-reviewer`  
3. **L3**: speckit-workflow `code-review` skill  
4. **L4**: Main Agent runs the audit prompt below  

Print downgrade notice on fallback (FR26).

### Requirements

- Use **audit-prompts.md §5** (implementation-stage audit): verify each item; no placeholders; actionable; conclusion must use the pass phrasing required by the audit template (category α: often Chinese literals in repo templates).
- **Critical Auditor required**, share **>70%**; adversarial check for omissions, line drift, acceptance mismatch.
- **Convergence**: one **round** = one full audit subtask; **three consecutive no-gap rounds** = three passes in a row with the template’s required pass wording and Critical Auditor stating no new gap in the template’s required language; any fail verdict or reported gap resets the count.

### Pre-flight checklist

- [ ] `DOC_PATH` filled
- [ ] Implementation artifacts identified
- [ ] CLI Calling Summary printed
- [ ] Audit prompt template copied in full

### CLI Calling Summary example

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={path}, round={N}
Template: Step 2 Audit Prompt (§5 + Critical Auditor)
Output: audit report (pass / fail)
Fallback: L2 OMC code-reviewer → L3 code-review skill → L4 main Agent
Acceptance: three consecutive no-gap rounds
```

### Prompt template (copy in full; replace placeholders)

```
对 **实施完成后的结果** 执行 **audit-prompts §5 执行阶段审计**。必须引入 **批判审计员（Critical Auditor）** 视角，且批判审计员发言占比须 **>70%**。

## 被审对象
- 实施依据文档：{DOC_PATH}
- 实施产物：代码变更、prd、progress、以及文档中要求的验收命令输出

## §5 审计项
1. 任务是否真正实现（无预留/占位/假完成）
2. 生产代码是否在关键路径中被使用
3. 需实现的项是否均有实现与测试/验收覆盖
4. 验收表/验收命令是否已按实际执行并填写
5. 是否遵守 ralph-method（prd/progress 更新、US 顺序）；涉及生产代码的每个 US 是否含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行（[TDD-REFACTOR] 允许写「无需重构 ✓」；[TDD-RED] 须在 [TDD-GREEN] 之前）
6. 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用
7. 项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须作为未通过项；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」豁免。

## 批判审计员
从对抗视角检查：遗漏任务、行号或路径失效、验收命令未跑、§5/验收误伤或漏网。
**可操作要求**：报告须包含独立段落「## 批判审计员结论」，且该段落字数或条目数不少于报告其余部分的 70%（即占比 >70%）；结论须明确「本轮无新 gap」或「本轮存在 gap」及具体项。若主 Agent 传入了本轮次序号，请在结论中注明「第 N 轮」。

## 输出与收敛
- 结论须明确：**「完全覆盖、验证通过」** 或 **「未通过」**（并列 gap 与修改建议）。
- 若通过且批判审计员无新 gap：注明「本轮无新 gap，第 N 轮；建议累计至 3 轮无 gap 后收敛」。
- 若未通过：注明「本轮存在 gap，不计数」，修复后再次发起本审计，直至连续 3 轮无 gap 收敛。
```

Main Agent: run after Step 1 (and any resume). You may print “round N passed, continuing verification…” between rounds. If the audit verdict is fail, launch implementation subagent (or resume) to fix code/prd/progress; the main Agent may edit explanatory/docs-only files only, not `prd.*`, `progress.*`, or production code. Re-audit until three consecutive no-gap rounds.

### YAML Handoff (after Step 2)

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_audit
  round: {N}
  critic_ratio: "{Critical Auditor share}"
  gap_count: {count}
  convergence_status: in_progress|converged
artifacts:
  report: {audit report path}
  tasks_doc: {DOC_PATH}
next_steps:
  - {if pass: next batch or commit gate}
  - {if fail: fix and re-audit}
handoff:
  next_action: implement_next_batch|commit_gate|revise_and_reaudit
  next_agent: bmad-standalone-tasks|bmad-master|auditor-implement
  ready: true|false
```

---

## Step 3: Main Agent prohibitions (reminder)

- **Do not** use `search_replace`, `write`, or `edit` on production code (including paths listed as implementation targets). **Do not** edit `prd.{stem}.json` or `progress.{stem}.txt` (subagent maintains them).
- **Do not** replace the subagent by implementing yourself; use Agent tool **resume** or a new call with “already completed” / “this batch” in the prompt.
- **May** edit explanatory/docs-only files (README, this skill, artifact `.md`) to reflect audit outcomes or notes.

---

## Integration with ralph-method / speckit-workflow

- **Standalone mode**: this skill uses the current TASKS/BUGFIX doc as the single source; no prior speckit `tasks.md` required. US and prd come from the document. If ralph-method elsewhere requires prd aligned with `tasks.md`, **this skill’s convention wins** for standalone runs. Subagents may synthesize prd/progress without plan/GAPS/tasks.md gates from ralph-method skill.
- **No US structure**: map each verifiable item to US-001, US-002, … (or doc-native ids), valid prd.json schema, consistent progress ids.
- **Skill loading**: the Step 1 prompt already tells the subagent to load ralph-method and speckit-workflow first.

---

## Repo add-ons

### Handoff / state

- YAML Handoff at end of each step (templates above)
- Final commit via `bmad-master` gate
- Subagents must not commit on their own

### Scoring

- Audit reports must include parseable scoring blocks for `parse-and-write-score.ts`
- Format per `.claude/skills/bmad-code-reviewer-lifecycle/SKILL.md`

### Forbidden / vague wording

- Do not use defer-to-later or “implement later” phrasing in task text (mirror whatever forbidden list your TASKS/BUGFIX or audit template requires).
- Audits should flag such wording as gaps

---

## References

- **ralph-method**: prd + progress naming/schema; see ralph-method skill.
- **speckit-workflow**: TDD, 15 rules, acceptance commands, architecture fidelity; audits should invoke code-review where applicable.
- **audit-prompts §5**: implementation-stage audit; Step 2’s seven items mirror §5. If `_bmad/references/audit-prompts.md` exists, cross-check §5. Critical Auditor, three no-gap rounds.
- **audit-post-impl-rules**: aligned with speckit-workflow and bmad-story-assistant; Step 2 satisfies 3-round no-gap and Critical Auditor >50%. Path: `.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`.
- **audit-document-iteration-rules**: for TASKS/BUGFIX **document** audit (not post-impl), audit subagent edits the doc when gaps are found. **Step 2 audits code after implementation**—implementation subagent fixes code, not this document rule.
- **Prompt templates**: `references/prompt-templates.md`.

---

## Errors and edge cases

- **Missing path**: after resolving `DOC_PATH`, if the file does not exist, error to the user with the resolved path; do not start implementation subtask.
- **Subagent failure / timeout**: **resume** once if agent id returned; else new Agent tool with “continue from progress / checkpoint below”; do not edit production code as substitute.
- **Main Agent must not** edit `prd.*.json` or `progress.*.txt` “to fix progress”—only the subagent.

<!-- ADAPTATION_COMPLETE: 2026-03-16 -->
