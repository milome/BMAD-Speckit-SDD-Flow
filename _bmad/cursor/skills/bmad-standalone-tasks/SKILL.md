---
name: bmad-standalone-tasks
description: |
  Execute unfinished tasks from a user-provided TASKS/BUGFIX document via subagents only. Use when the user says "/bmad 按 {文档} 中的未完成任务实施" or "按 BUGFIX_xxx.md / TASKS_xxx.md 实施". Enforces **TASKS/BUGFIX 文档前置审计先于实施执行**、mcp_task subagent for implementation, ralph-method (prd + progress, TDD), speckit-workflow (no pseudo-impl, acceptance commands), and code-reviewer audit with 批判审计员 >50% and 3 rounds no-gap convergence. Standalone implementation-entry gating must prefer **auto-remediation loop** over user-facing pause: if readiness facts are incomplete but auto-repairable, the host/main Agent should repair facts and immediately continue the same execution. Main Agent must NOT edit production code.
---

# BMAD Standalone Tasks

## Main Agent Orchestration Surface

在 interactive main-agent 模式下，主 Agent 在发起、继续或收口 `standalone_tasks` 链路前，必须优先读取：

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action inspect
```

如需生成正式派发计划，则读取：

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan
```

`mainAgentNextAction / mainAgentReady` 仍保留为 handoff compatibility 字段，但不再是唯一 runtime truth。

Execute unfinished work from a **single TASKS or BUGFIX document** in a single session. Implementation and code edits are **only** done by subagents; the main Agent orchestrates and audits.

**实施前的 `auditor-tasks-doc` 属于 TASKS/BUGFIX 文档前置审计，且必须先于任何实施执行。** 不允许把文档前置审计降级成建议项、可选步骤或实施后补做项。

**Orphan standalone closeout contract**：当 TASKS / BUGFIX 文档位于 `_orphan/` 路径时，结构化审计报告必须显式提供 `stage=standalone_tasks`、`artifactDocPath`、`reportPath`；不得继续使用 `stage=document` 作为 orphan closeout 返回值。缺失任一字段或仅有 PASS 文本时，主 Agent 不得进入实现执行，host closeout 必须 fail-closed。

**统一 closeout 硬门禁（适用于本技能全部审计闭环）**：
- 主 Agent 在每个阶段的完整 prompt 模板结尾、resume 指令结尾、以及审计通过后的 host 收口指令结尾，必须原样追加下列固定句；同时必须自动写入评分数据与本技能要求的交接文档（handoff / state / progress / 审计收口文档），禁止留给用户手动完成。
- 未执行 `runAuditorHost` 并验证评分写入成功前，禁止结束、禁止交还用户手动操作。
- 只有 `runAuditorHost` 返回 `closeout approved` 才算完成；其余都算未完成。
- 禁止给“你可以手动做下一步”的建议，除非用户明确要求。
- `runAuditorHost` 失败时必须自动重试，并在每次重试时记录失败原因与修复动作；未成功前不得退出当前闭环。
- 最终回复必须显式包含以下 4 行，缺一视为未完成：
  - `runAuditorHost 调用参数`
  - `runAuditorHost 返回结果`
  - `评分写入结果（成功/失败码）`
  - `closeout 状态（approved/未approved）`

## When to use

- User says: **"/bmad 按 {用户输入的文档} 中的未完成任务实施"** or equivalent (e.g. "按 BUGFIX_xxx.md 实施", "按 TASKS_xxx.md 执行").
- Input: one **document path** (TASKS_*.md, BUGFIX_*.md, or similar task list with clear items and acceptance).

### 可选输入与多文档约定

- **工作目录**：未指定时默认为项目根；若用户指定工作目录，主 Agent 将 DOC_PATH 解析为该目录下的相对或绝对路径。
- **分支名**：若 ralph-method 的 prd 需要 branchName，可由子代理从文档或环境推断，或由用户显式提供。
- **多文档并存**：若用户同时提及多份 TASKS/BUGFIX 文档，以用户**首次明确指定的单份文档**为准；prd/progress 命名仅随该文档 stem，避免同目录多任务交叉导致文件覆盖。

## 前置：解析未完成任务清单

主 Agent 在发起实施子任务前须解析文档并确定未完成项：从文档中识别任务列表（如 §7 任务表、未勾选项、标注 TODO/未完成的节）；若文档无显式未完成标记，则按文档内任务/US 顺序与同目录 progress 文件对比，**未在 progress 中出现且未在 prd 中标记 passes 的视为未完成**，并将该清单传入 Step 1 的 prompt。progress 文件命名与文档 stem 一致：`progress.{stem}.txt`，与 ralph-method 约定相同。

## Hard constraints (non-negotiable)

1. **Implementation only via subagent**  
   All production and test code changes must be done through **mcp_task** (subagent). Main Agent **must not** use `search_replace` or `write` on production code.

2. **ralph-method**  
   - Create and maintain **prd** and **progress** in the same directory as the reference document (naming: `prd.{stem}.json`, `progress.{stem}.txt` when document is e.g. `BUGFIX_foo.md`).  
   - After **each** completed User Story (US): update prd (`passes=true` for that US), append to progress (timestamped story log).  
   - Execute US in order.

3. **TDD red–green–refactor**  
   For each US: write or extend tests first (red) → implement until tests pass (green) → refactor. No marking done without passing tests.

4. **speckit-workflow**  
   No placeholders or pseudo-implementation; run acceptance commands from the document; architecture must stay faithful to the BUGFIX/TASKS document.

5. **Forbidden**  
   - Do not add "将在后续迭代" (or similar) in task descriptions.  
   - Do not mark a task complete if the behavior is not actually invoked or verified.
6. **TASKS/BUGFIX 文档前置审计是实施前硬门槛**
   `auditor-tasks-doc` 的职责是 **TASKS/BUGFIX 文档前置审计**。只要该审计尚未通过、尚未执行或结论不明，**禁止**进入任何实施执行、代码修改、测试实现或“先做再补审计”的路径。

## Main Agent responsibilities

- **Do**: Before any implementation sub-task, ensure `auditor-tasks-doc` has audited the TASKS/BUGFIX document and passed.

- **Do**: Resolve document path, read task list, **launch mcp_task** (implementation and audit), pass full context, **collect and summarize** subagent output.  
- **Do**: If subagent returns incomplete, launch a **resume** mcp_task with the same agent ID; do **not** replace the subagent by editing code yourself.  
- **Do not**: Edit production or test code (including any path listed in the TASKS/BUGFIX document as implementation target).

---

## Step 0: Pre-Implementation Document Audit

**Mandatory gate**: Before Step 1, the main Agent **must** launch a TASKS/BUGFIX document pre-audit and obtain PASS. This pre-audit is not optional and cannot be deferred until after implementation.

**Mandatory gate 2**: After `auditor-tasks-doc` PASS and before Step 1 starts, the main Agent **must** execute the unified `implementation-readiness` gate assertion. Only `decision=pass` may enter Step 1. `decision=block` means **repair facts first via auto-remediation loop and then immediately re-run the same gate**; do not bounce the user back for routine fact repair. `decision=reroute` means `standalone_tasks` may not continue directly and must switch to the recommended flow.

**Auto-remediation preference (critical UX rule)**:
- For `standalone_tasks`, `implementation-readiness` is **not** a user-facing pause by default.
- If the gate is blocked because implementation-entry facts are incomplete but can be normalized from the current TASKS/BUGFIX artifact set (for example: authoritative `auditor-tasks-doc` closeout exists but the unified gate still lacks enough machine-readable evidence), the host/main Agent must **repair those facts automatically**, re-run the gate, and continue the same execution.
- Only escalate to the user when the gate returns a **real blocker** that cannot be repaired from current project facts, or when the gate returns `reroute`.
- The desired behavior is analogous to a **rerun gate loop**: repair facts -> re-evaluate gate -> continue Ralph / implementation / audit loop without adding user burden.

**Tool**: 优先 Cursor Task 调度 `code-reviewer`；若不可用，则 `mcp_task` + `generalPurpose`

**Audit target**:
- TASKS 文档是否可执行、任务边界是否明确
- BUGFIX 文档是否已具备可实施的 §7 / §8.1 任务列表
- 文档中的验收命令、产出路径、范围限制是否足以支撑实施

**Rule**:
- PASS before implementation
- FAIL or missing audit means **do not start Step 1**

---

## Step 1: Implementation sub-task

**Tool**: `mcp_task`  
**subagent_type**: `generalPurpose`

**Implementation precondition**: `auditor-tasks-doc` must have passed the TASKS/BUGFIX document pre-audit before this step starts, **and** the unified `implementation-readiness` gate assertion must currently return `decision=pass` after any required auto-remediation loop has been completed.

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

**占位符说明**：
- **DOC_PATH**：TASKS/BUGFIX 文档的绝对路径或相对项目根的路径（主 Agent 解析用户输入后填写；建议传绝对路径）。
- **TASK_LIST**：主 Agent 从文档提取的未完成项，格式示例：§7 T7a-1～T7a-9、§3 第 2～5 条。Resume 或断点续跑时，必须使用 `references/prompt-templates.md` 中的「Resume 实施子任务」模板，并填写「上一批已完成」与「本批待执行」范围。

- Main Agent only: invoke mcp_task, pass this prompt, then collect and summarize the subagent’s output (and resume if needed).

---

## Step 2: Audit sub-task (after implementation)

**Tool**: **优先**使用 Cursor Task 调度 code-reviewer（若存在 `.cursor/agents/code-reviewer.md` 或 `.claude/agents/code-reviewer.md`）；**若仅能使用 mcp_task**，因当前 mcp_task 可能不支持 code-reviewer 子类型，则使用 `generalPurpose` 并传入完整审计 prompt（含 §5、批判审计员占比 >50%、3 轮无 gap），在报告开头注明「未使用 code-reviewer 子类型，使用 generalPurpose + 审计 prompt」。

**Requirements**:
- Use **audit-prompts.md §5** (执行阶段审计): 逐项验证、无占位、无模糊表述、可落地实施、完全覆盖、验证通过.  
- **批判审计员必须出场，发言占比 >70%**；从对抗视角检查遗漏、行号漂移、验收一致性、误伤/漏网.  
- **收敛条件**：**一轮** = 一次完整审计子任务调用；**连续 3 轮无 gap** = 连续 3 次结论均为「完全覆盖、验证通过」且该 3 次报告中批判审计员结论段均注明「本轮无新 gap」；若任一轮为「未通过」或「存在 gap」，则从下一轮重新计数。否则根据报告修改后再次发起审计.

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

- Main Agent: launch this mcp_task after Step 1 (and after any resume). 主 Agent 在发起第 2、3 轮审计前，可输出「第 N 轮审计通过，继续验证…」以提示用户。If the report is "未通过"，主 Agent 通过再次发起实施子任务（或 resume）由子代理修复代码与 prd/progress；主 Agent 仅可做说明性/文档类编辑，不得编辑 prd.*.json、progress.*.txt 或生产代码。然后重新发起审计直至连续 3 轮无 gap 收敛。

- **不中断执行 contract**：实施子代理必须从当前批次的第一项开始，连续完成当前作用域内的全部剩余 US/任务，不得在单项完成、批中 milestone 或“先等你确认”节点暂停。控制权仅可在以下三种情况下返回主 Agent：① 当前作用域任务全部完成且进入 post-audit / closeout；② 出现真实 blocker，需要 reroute / remediation；③ 本技能显式定义的审计边界或 resume checkpoint 到达。

---

## Step 3: Main Agent prohibitions (reminder)

- **禁止** 对生产代码执行 `search_replace`、`write`、`edit`（生产代码含 TASKS/BUGFIX 文档中列为实现目标的路径）；**禁止**直接编辑 `prd.{stem}.json` 与 `progress.{stem}.txt`（由子代理按 ralph-method 维护）.  
- **禁止** 用主 Agent 直接实现任务以替代 subagent；若 subagent 返回不完整，只能通过 **mcp_task resume** 或再次发起新的 mcp_task 继续，并在 prompt 中显式传入「上一批已完成」与「本批待执行」范围，不得自行改代码.  
- **允许** 主 Agent 仅编辑说明性/文档类文件（如 README、本 SKILL.md、artifact 目录下 .md），以配合审计结论或记录进度.

---

## 与 ralph-method / speckit-workflow 的衔接

- **Standalone 用法**：本技能为 standalone 模式：以当前 TASKS/BUGFIX 文档为唯一任务来源，不要求先存在 speckit 产出的 tasks.md。US 与 prd 来源为当前文档。与 ralph-method 中「prd 与 tasks.md 一致」并存时，以本技能约定为准。子代理在无 US 结构时按本技能约定生成 prd/progress，无需满足 ralph-method 技能的前置（plan/IMPLEMENTATION_GAPS/tasks.md）检查。
- **无 US 结构时**：若文档仅有扁平任务列表，子代理须将每条可验收任务映射为 US-001、US-002…（或采用文档原有编号），生成符合 ralph-method prd.json schema 的 prd，并保持 progress 与 prd 的 id 一致。
- **技能加载**：实施子任务 prompt 开头已要求子代理先读取并遵循 ralph-method 与 speckit-workflow 再执行，确保 prd 结构与 TDD/验收约束一致。

## References

- **ralph-method**: Create/maintain prd + progress; naming and schema see ralph-method skill.  
- **speckit-workflow**: TDD 红绿灯、15 条铁律、验收命令、架构忠实；审计须调用 code-review 技能.  
- **audit-prompts §5**: 执行阶段审计；本技能内置的 6 项即为 §5 审计项。若项目存在 `_bmad/references/audit-prompts.md`，可对照其 §5 执行。逐项验证、完全覆盖、验证通过；批判审计员、3 轮无 gap 收敛.  
- **audit-post-impl-rules**: 与 speckit-workflow、bmad-story-assistant 的实施后审计规则对齐。本技能 Step 2 已符合 audit-post-impl-rules（3 轮无 gap、批判审计员 >50%）。规则文件路径：`.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md`。
- **audit-document-iteration-rules**: 当对 TASKS/BUGFIX **文档**进行审计（非实施后审计）时，须遵循 `.cursor/skills/speckit-workflow/references/audit-document-iteration-rules.md`：审计子代理在发现 gap 时须直接修改被审文档。**本技能 Step 2 为实施后审计（审计代码）**，修改由实施子代理完成，不适用文档迭代规则。  
- **Prompt templates**: See `references/prompt-templates.md` for copy-paste prompts with placeholders.

## 错误与边界处理

- **文档路径不存在**：主 Agent 解析用户输入得到路径后，若该路径不存在，应向用户报错并列出已解析路径，不发起实施子任务。
- **子 agent 错误或超时**：若有返回的 agent ID，主 Agent 可发起 **resume**（最多重试 1 次）；若仍失败或无 agent ID，则重新发起新的 mcp_task，并在 prompt 中注明「上次未完成，请从同目录 progress 文件或下列断点继续」，不替代子 agent 直接改生产代码。
- **主 Agent 禁止编辑**：prd.*.json、progress.*.txt 仅由子代理维护；主 Agent 不得为「补写 progress」等理由直接编辑上述文件。
