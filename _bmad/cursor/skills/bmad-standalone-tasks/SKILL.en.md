<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-standalone-tasks
description: |
  Execute unfinished tasks from a user-provided TASKS/BUGFIX document via subagents only.
  Use when the user asks to implement unfinished items from a named TASKS or BUGFIX markdown file.
  Enforces mcp_task for implementation, ralph-method (prd + progress, TDD), speckit-workflow (no pseudo-implementation, run acceptance commands),
  and code-reviewer-style audit with Critical Auditor >50% and three consecutive no-gap rounds.
  The main Agent must NOT edit production code.
---

# BMAD Standalone Tasks

Execute unfinished work from a **single TASKS or BUGFIX document** in a single session. Implementation and code edits are **only** done by subagents; the main Agent orchestrates and audits.

## When to use

- User says: **"/bmad implement unfinished items in {document}"** or equivalent (e.g. implement per `BUGFIX_xxx.md`, `TASKS_xxx.md`).
- Input: one **document path** (`TASKS_*.md`, `BUGFIX_*.md`, or similar task list with clear items and acceptance).

### Optional inputs and multi-document convention

- **Working directory**: defaults to project root; if the user specifies one, resolve `DOC_PATH` under that directory (relative or absolute).
- **Branch name**: if ralph-method `prd` needs `branchName`, infer from document/environment or ask the user.
- **Multiple documents**: if several TASKS/BUGFIX files are mentioned, use the **first explicitly named** document; `prd`/`progress` filenames follow that document’s stem only.

## Prerequisite: parse unfinished task list

Before starting the implementation subtask, the main Agent must parse the document: task tables (e.g. §7), unchecked items, TODO/incomplete sections. If nothing is explicitly marked, compare with the co-located `progress` file—**treat as unfinished** anything absent from `progress` and not marked `passes` in `prd`. Pass that list into Step 1. Progress naming: `progress.{stem}.txt` (ralph-method).

## Hard constraints (non-negotiable)

1. **Implementation only via subagent**  
   All production and test code changes must be done through **mcp_task** (subagent). The main Agent **must not** use `search_replace` or `write` on production code.

2. **ralph-method**  
   - Create and maintain **prd** and **progress** beside the reference document (`prd.{stem}.json`, `progress.{stem}.txt` for e.g. `BUGFIX_foo.md`).  
   - After **each** completed US: update prd (`passes=true`), append progress (timestamped story log).  
   - Execute US in order.

3. **TDD red–green–refactor**  
   Per US: tests first (red) → implement until green → refactor. Do not mark done without passing tests.

4. **speckit-workflow**  
   No placeholders or pseudo-implementation; run acceptance commands from the document; stay faithful to the BUGFIX/TASKS document.

5. **Forbidden**  
   - Do not add defer-to-later phrasing in task descriptions (Chinese TASKS docs often ban deferred-to-next-iteration wording; follow the document).  
   - Do not mark a task complete if the behavior is not actually invoked or verified.

## Main Agent responsibilities

- **Do**: Resolve document path, read task list, **launch mcp_task** (implementation and audit), pass full context, **collect and summarize** subagent output.  
- **Do**: If subagent returns incomplete, launch a **resume** mcp_task with the same agent ID; do **not** replace the subagent by editing code yourself.  
- **Do not**: Edit production or test code (including any path listed in the TASKS/BUGFIX document as an implementation target).

---

## Step 1: Implementation sub-task

**Tool**: `mcp_task`  
**subagent_type**: `generalPurpose`

**Prompt template** (fill placeholders; pass full TASKS path and constraints):

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

**Placeholder notes**:

- **DOC_PATH**: absolute path or repo-relative path (main Agent resolves; absolute recommended).
- **TASK_LIST**: unfinished items from the document (e.g. §7 ranges). For resume, use `references/prompt-templates.md` “Resume implementation subtask” with “already completed” and “this batch”.

Main Agent only: invoke mcp_task with this prompt, then collect and summarize (and resume if needed).

---

## Step 2: Audit sub-task (after implementation)

**Tool**: **Prefer** Cursor Task with **code-reviewer** if `.cursor/agents/code-reviewer.md` or `.claude/agents/code-reviewer.md` exists. **If only mcp_task** is available and it has no `code-reviewer` subtype, use `generalPurpose` with the full audit prompt below (§5, Critical Auditor >50%, three no-gap rounds) and state at the top of the report that code-reviewer subtype was not used.

**Requirements**:

- Use **audit-prompts.md §5** (implementation-stage audit): verify each item; no placeholders; actionable; use the pass phrasing required by the template (often Chinese literals in this repo—category α).  
- **Critical Auditor must appear**, speaking share **>70%**; adversarial check for omissions, line drift, acceptance consistency, false positives/negatives.  
- **Convergence**: one **round** = one full audit subtask; **three consecutive no-gap rounds** = three passes in a row with the template’s required pass wording and Critical Auditor stating no new gap in the required language; any fail or gap resets the count.

**Prompt template**:

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

Main Agent: run this mcp_task after Step 1 (and any resume). You may print “round N passed, continuing…” between rounds. If the audit verdict is fail, launch implementation (or resume) so the subagent fixes code/prd/progress; the main Agent may edit docs-only files, not `prd.*`, `progress.*`, or production code. Repeat audit until three consecutive no-gap rounds.

---

## Step 3: Main Agent prohibitions (reminder)

- **Do not** use `search_replace`, `write`, or `edit` on production code (including paths listed as implementation targets). **Do not** edit `prd.{stem}.json` or `progress.{stem}.txt` (subagent maintains them).  
- **Do not** substitute your own implementation for the subagent; use **mcp_task resume** or a new task with explicit “already completed” / “this batch” in the prompt.  
- **May** edit explanatory/docs-only files (README, this skill, artifact `.md`) for audit notes or progress narration.

---

## Integration with ralph-method / speckit-workflow

- **Standalone**: this skill uses the current TASKS/BUGFIX doc as the only task source; no prior speckit `tasks.md` required. US/prd come from the document. If ralph-method elsewhere requires alignment with `tasks.md`, **this skill wins** for standalone runs. Subagents may build prd/progress without plan/GAPS/tasks.md prerequisites from the ralph-method skill.  
- **Flat task lists**: map to US-001, US-002, … (or doc ids), valid prd schema, consistent progress ids.  
- **Skill loading**: the Step 1 preamble already requires loading ralph-method and speckit-workflow first.

## References

- **ralph-method**: Create/maintain prd + progress; naming/schema in ralph-method skill.  
- **speckit-workflow**: TDD, 15 rules, acceptance commands, architecture fidelity; audits should use code-review where applicable.  
- **audit-prompts §5**: implementation-stage audit; the six built-in items here map to §5. Cross-check `_bmad/references/audit-prompts.md` §5 if present. Critical Auditor, three no-gap rounds.  
- **audit-post-impl-rules**: aligned with speckit-workflow and bmad-story-assistant; Step 2 matches (three no-gap rounds, Critical Auditor >50%). Path: `.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md`.  
- **audit-document-iteration-rules**: for TASKS/BUGFIX **document** audit (not post-implementation), follow `.cursor/skills/speckit-workflow/references/audit-document-iteration-rules.md` (audit subagent edits the doc). **Step 2 is post-implementation (code)**—implementation subagent fixes code.  
- **Prompt templates**: `references/prompt-templates.md`.

## Errors and edge cases

- **Missing path**: if resolved `DOC_PATH` does not exist, report error with path; do not start implementation subtask.  
- **Subagent error / timeout**: **resume** once if agent id exists; else new mcp_task with “continue from progress or checkpoint”; do not edit production code as substitute.  
- **Main Agent must not** edit `prd.*.json` or `progress.*.txt` to “patch progress”—only the subagent.
