---
name: bmad-standalone-tasks
description: |
  Claude Code CLI / OMC 版 BMAD Standalone Tasks 适配入口。
  以 Cursor bmad-standalone-tasks 为语义基线，按「TASKS/BUGFIX 文档前置审计 → 解析未完成任务 → 子代理实施 → 实施后审计」执行 TASKS/BUGFIX 文档驱动的实施流程。
  主 Agent 发起任一子任务时**必须**将本 skill 内该阶段的「完整 prompt 模板」整段复制并填入占位符后传入，禁止省略、概括或自行改写提示词；
  主 Agent 禁止直接修改生产代码，实施须通过 Agent tool 子代理（subagent_type: general-purpose）。
  `auditor-tasks-doc` 属于 TASKS/BUGFIX 文档前置审计，必须先于实施执行通过；实施后审计优先 `.claude/agents/auditors/auditor-implement`，按 Fallback 链降级。
  遵循 ralph-method（prd.{stem}.json / progress.{stem}.txt）、TDD 红绿灯、speckit-workflow。
  适用场景：用户提供 TASKS/BUGFIX 文档并要求执行未完成任务。全程中文。
when_to_use: |
  Use when: 用户说「按 TASKS_xxx.md 中的未完成任务实施」「按 BUGFIX_xxx.md 实施」或提供 TASKS/BUGFIX 文档路径要求执行。
references:
  - auditor-tasks-doc: TASKS 文档前置审计执行体；`.claude/agents/auditors/auditor-tasks-doc.md`
  - auditor-implement: 实施后审计执行体；`.claude/agents/auditors/auditor-implement.md`
  - speckit-implement: 实施执行体；`.claude/agents/speckit-implement.md`
  - audit-post-impl-rules: 实施后审计规则；`.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`
  - audit-document-iteration-rules: 文档审计迭代规则；`.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - ralph-method: prd、progress 文件，按 US 顺序执行
  - speckit-workflow: 禁止伪实现、必须运行验收命令、架构忠实
  - prompt-templates: `.claude/skills/bmad-standalone-tasks/references/prompt-templates.md`
---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 术语收紧：本文件中“完成 / 通过 / 可进入下一阶段”一律指 `runAuditorHost` 返回 `closeout approved`。审计报告 `PASS` 仅表示可以进入 host close-out，单独的 `PASS` 不得视为完成、准入或放行。

# Claude Adapter: bmad-standalone-tasks

## Purpose

本 skill 是 Cursor `bmad-standalone-tasks` 在 Claude Code CLI / OMC 环境下的统一适配入口。

目标不是简单复制 Cursor skill，而是：

1. **继承 Cursor 已验证的 standalone 任务执行语义**（从 TASKS/BUGFIX 文档前置审计 → 提取未完成任务 → 子代理实施 → 实施后审计）
2. **在 Claude/OMC 运行时中将执行体映射到 `.claude/agents/` 系列**（审计 → `auditor-implement`、`auditor-tasks-doc`；实施 → `speckit-implement` 或通用执行体）
3. **接入仓库中已开发完成的 handoff、scoring、commit gate 机制**
4. **确保在 Claude Code CLI 中能完整、连续、正确地执行 standalone 任务流程**

---

## 核心验收标准

Claude 版 `bmad-standalone-tasks` 必须满足：

- 能作为 Claude Code CLI 的 **standalone 任务执行入口**，统一管理解析→实施→审计闭环
- 各阶段的执行器选择、fallback、评分写入均与 Cursor 已验证流程语义一致
- 完整接入本仓新增的：
  - auditor-tasks-doc、auditor-implement 执行体
  - 评分写入（`parse-and-write-score.ts`）
  - handoff 协议
- 不得将 Cursor Canonical Base、Claude Runtime Adapter、Repo Add-ons 混写为来源不明的重写版 prompt
- **主 Agent 禁止直接修改生产代码**（FR20a）

---

## Cursor Canonical Base

以下内容继承自 Cursor `bmad-standalone-tasks`，属于业务语义基线，Claude 版不得擅自重写其意图。

Execute unfinished work from a **single TASKS or BUGFIX document** in a single session. Implementation and code edits are **only** done by subagents; the main Agent orchestrates and audits.

**实施前的 `auditor-tasks-doc` 属于 TASKS/BUGFIX 文档前置审计，且必须先于任何实施执行。** 不允许把前置审计降级成建议项、可选步骤或实施后补做项。

### When to use

- User says: **"/bmad 按 {用户输入的文档} 中的未完成任务实施"** or equivalent (e.g. "按 BUGFIX_xxx.md 实施", "按 TASKS_xxx.md 执行").
- Input: one **document path** (TASKS_*.md, BUGFIX_*.md, or similar task list with clear items and acceptance).

### 可选输入与多文档约定

- **工作目录**：未指定时默认为项目根；若用户指定工作目录，主 Agent 将 DOC_PATH 解析为该目录下的相对或绝对路径。
- **分支名**：若 ralph-method 的 prd 需要 branchName，可由子代理从文档或环境推断，或由用户显式提供。
- **多文档并存**：若用户同时提及多份 TASKS/BUGFIX 文档，以用户**首次明确指定的单份文档**为准；prd/progress 命名仅随该文档 stem，避免同目录多任务交叉导致文件覆盖。

### 前置：解析未完成任务清单

主 Agent 在发起实施子任务前须解析文档并确定未完成项：从文档中识别任务列表（如 §7 任务表、未勾选项、标注 TODO/未完成的节）；若文档无显式未完成标记，则按文档内任务/US 顺序与同目录 progress 文件对比，**未在 progress 中出现且未在 prd 中标记 passes 的视为未完成**，并将该清单传入 Step 1 的 prompt。progress 文件命名与文档 stem 一致：`progress.{stem}.txt`，与 ralph-method 约定相同。

### Hard constraints (non-negotiable)

1. **Implementation only via subagent**
   All production and test code changes must be done through Agent tool subagent（`subagent_type: general-purpose`）. 主 Agent 禁止直接编辑生产代码——不得对生产代码执行 `search_replace`、`write`、`edit`。

2. **ralph-method**
   - Create and maintain **prd** and **progress** in the same directory as the reference document (naming: `prd.{stem}.json`, `progress.{stem}.txt` when document is e.g. `BUGFIX_foo.md`).
   - After **each** completed User Story (US): update prd (`passes=true` for that US), append to progress (timestamped story log).
   - Execute US in order.

3. **TDD 红绿灯（red–green–refactor）**
   For each US: write or extend tests first (红灯/red) → implement until tests pass (绿灯/green) → refactor. No marking done without passing tests.

4. **speckit-workflow**
   No placeholders or pseudo-implementation; run acceptance commands from the document; architecture must stay faithful to the BUGFIX/TASKS document.

5. **Forbidden**
   - Do not add "将在后续迭代" (or similar) in task descriptions.
   - Do not mark a task complete if the behavior is not actually invoked or verified.
6. **TASKS/BUGFIX 文档前置审计是实施前硬门槛**
   `auditor-tasks-doc` 的职责是 **TASKS/BUGFIX 文档前置审计**。只要该审计尚未通过、尚未执行或结论不明，**禁止**进入任何实施执行、代码修改、测试实现或“先做再补审计”的路径。

### 主 Agent 传递提示词规则（必守）

每次发起子任务（Agent tool）时，主 Agent **必须**遵守以下规则，否则子代理易因提示词不完整而偏离本 skill 要求：

1. **使用完整模板**：使用本 skill 中该阶段提供的「完整 prompt 模板」；**禁止**自行概括、缩写或改写。
2. **整段复制**：将模板**整段复制**到子任务的 `prompt` 参数中，**禁止**只传「要点」或「参考下方」。
3. **替换占位符**：将模板中的占位符（如 `{DOC_PATH}`、`{TASK_LIST}`）**全部**替换为实际内容后再传入。
4. **自检后再发起**：若该阶段有「发起前自检清单」，主 Agent 在发起前**必须**逐项确认后再发起。
5. **禁止概括**：主 Agent 不得将模板概括为要点或「参考技能某节」；子任务 prompt 中必须包含该阶段模板的完整正文（占位符已替换）。若未整段复制导致子任务产出不符合技能要求，主 Agent 须重新发起并整段复制。
6. **错误示例**（均不符合整段复制要求）：prompt 中仅写「请按 bmad-standalone-tasks 实施模板执行」；「请参考 standalone-tasks 技能 Step 1 部分」；「约束见上文」。
7. **正确示例**：prompt 中包含该阶段完整 prompt 模板全文（含所有段落），且占位符已全部替换；发起前已按该阶段「发起前自检清单」逐项确认并输出自检结果。
8. **自检强制**：未完成该阶段全部自检项且未在发起前输出自检结果时，不得发起子任务；禁止先发起后补自检。自检结果须按统一格式输出，例如：「【自检完成】Step 1：已整段复制实施模板；占位符 [已替换/列出]；可以发起。」

---

## Claude/OMC Runtime Adapter

### 执行体层级与 Fallback Strategy

本 skill 涉及两类执行体调用：**实施执行体**和**审计执行体**。Claude/OMC 环境下的执行器选择按以下 4 层优先级：

#### 实施执行体（Step 1）

| 层级 | 执行体 | 说明 |
|------|--------|------|
| L1 | `.claude/agents/speckit-implement.md` prompt → Agent tool (`subagent_type: general-purpose`) | 主路径：整段传入 speckit-implement agent 作为完整 prompt |
| L2 | 通用 Agent tool (`subagent_type: general-purpose`) + 内联实施 prompt | 回退：无 speckit-implement 时直接传入本 skill Step 1 prompt |
| L3 | 主 Agent 直接执行 | 最终回退：仅当 L1/L2 均不可用时 |

#### 审计执行体（Step 2：实施后审计）

| 层级 | 执行体 | 说明 |
|------|--------|------|
| L1 | `.claude/agents/auditors/auditor-implement.md` prompt → Agent tool (`subagent_type: general-purpose`) | 主路径 |
| L2 | oh-my-claudecode `code-reviewer` | OMC 审计回退 |
| L3 | `.claude/skills/speckit-workflow/` 中 `code-review` skill | skill 级回退 |
| L4 | 主 Agent 直接执行同一份三层结构 prompt | 最终回退 |

#### 前置文档审计执行体（实施前必做 Step 0）

| 层级 | 执行体 | 说明 |
|------|--------|------|
| L1 | `.claude/agents/auditors/auditor-tasks-doc.md` prompt → Agent tool (`subagent_type: general-purpose`) | 主路径；**必须先于实施执行通过** |
| L2 | 通用 Agent tool + 审计 prompt | 回退 |
| L3 | 主 Agent 直接执行 | 最终回退 |

**Fallback 降级通知**（FR26）：当执行体从 L1 降级到 L2/L3/L4 时，主 Agent **必须**向用户输出降级通知，说明当前使用的执行体层级。例如：
- 「⚠️ 已从 L1 (auditor-implement) 降级到 L2 (OMC code-reviewer) 执行审计」
- 「⚠️ 已从 L1 (speckit-implement) 降级到 L2 (通用 Agent tool) 执行实施」

### Runtime Contracts

- 每次调用子代理前输出 **CLI Calling Summary**（5 字段）：

```yaml
=== CLI Calling Summary ===
Input: {输入参数/文档路径}
Template: {使用的 prompt 模板名}
Output: {预期产出}
Fallback: {降级方案}
Acceptance: {验收标准}
```

- 每个 step 结束输出 **YAML Handoff**：

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_impl|standalone_audit
  batch: {当前批次}
artifacts:
  tasks_doc: {TASKS 文档路径}
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
next_steps:
  - {下一步操作}
handoff:
  next_action: implement_next_batch|post_batch_audit|commit_gate|revise_tasks_doc
  next_agent: bmad-standalone-tasks|auditor-implement|bmad-master|auditor-tasks-doc
  ready: true|false
```

### Main Agent responsibilities

- **Do**: Before any implementation sub-task, ensure `auditor-tasks-doc` has audited the TASKS/BUGFIX document and passed.
- **Do**: Resolve document path, read task list, **launch Agent tool subagent** (implementation and audit), pass full context, **collect and summarize** subagent output.
- **Do**: If subagent returns incomplete, launch a **resume** Agent tool with the same agent ID or a new invocation with continuation context; do **not** replace the subagent by editing code yourself.
- **Do not**: Edit production or test code (including any path listed in the TASKS/BUGFIX document as implementation target).
- **Do not**: Directly edit `prd.{stem}.json` or `progress.{stem}.txt` (maintained by subagent per ralph-method).

---

## Step 0: Pre-Implementation Document Audit

**Mandatory gate**: Before Step 1, the main Agent **must** launch `auditor-tasks-doc` and obtain PASS. This pre-audit is not optional and cannot be deferred until after implementation.

### 发起前自检清单

- [ ] DOC_PATH 已填入（绝对路径或相对项目根）
- [ ] 已明确被执行文档是 TASKS 还是 BUGFIX
- [ ] 已输出 CLI Calling Summary
- [ ] 已准备完整审计 prompt 或完整 auditor-tasks-doc 执行体正文

### CLI Calling Summary 示例

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={文档路径}
Template: Step 0 Pre-Implementation Document Audit
Output: TASKS/BUGFIX 文档前置审计报告
Fallback: L2 通用 Agent tool + 审计 prompt → L3 主 Agent 直接执行
Acceptance: auditor-tasks-doc 结论为 PASS，方可进入 Step 1
```

### Mandatory rules

1. `auditor-tasks-doc` 的语义是 **TASKS/BUGFIX 文档前置审计**。
2. 只要 Step 0 未通过、未执行或结论不明，**禁止**进入 Step 1。
3. Step 0 失败时必须先修正文档或回到用户补充信息阶段，不得“先实施后补审计”。

---

## Step 1: Implementation sub-task

**Tool**: Agent tool
**subagent_type**: `general-purpose`

**Implementation precondition**: `auditor-tasks-doc` must have passed the TASKS/BUGFIX document pre-audit before this step starts.

### 发起前自检清单

- [ ] `auditor-tasks-doc` 已完成 **TASKS/BUGFIX 文档前置审计** 且结论为 PASS；若未通过，已先返回文档修正流程
- [ ] DOC_PATH 已填入（绝对路径或相对项目根）
- [ ] TASK_LIST 已从文档解析并填入
- [ ] 已输出 CLI Calling Summary
- [ ] 模板已整段复制（非摘要）

### CLI Calling Summary 示例

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={文档路径}, TASK_LIST={任务范围}
Template: Step 1 Implementation Prompt
Output: 已完成 US、验收结果、prd/progress 更新
Fallback: L2 通用 Agent tool + 内联 prompt
Acceptance: 所有 US passes=true + TDD 记录完整
```

### Prompt template（整段复制，替换占位符后传入）

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

### 占位符说明

- **DOC_PATH**：TASKS/BUGFIX 文档的绝对路径或相对项目根的路径（主 Agent 解析用户输入后填写；建议传绝对路径）。
- **TASK_LIST**：主 Agent 从文档提取的未完成项，格式示例：§7 T7a-1～T7a-9、§3 第 2～5 条。Resume 或断点续跑时，必须使用 `references/prompt-templates.md` 中的「Resume 实施子任务」模板，并填写「上一批已完成」与「本批待执行」范围。

Main Agent only: invoke Agent tool, pass this prompt, then collect and summarize the subagent's output (and resume if needed).

### YAML Handoff（Step 1 完成后输出）

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_impl
  batch: {当前批次}
  completed_us: [{已完成 US 列表}]
artifacts:
  tasks_doc: {DOC_PATH}
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
next_steps:
  - 发起 Step 2 实施后审计
handoff:
  next_action: post_batch_audit
  next_agent: auditor-implement
  ready: true
```

---

## Step 2: Audit sub-task (after implementation)

**Tool**: Agent tool
**subagent_type**: `general-purpose`（整段传入 `.claude/agents/auditors/auditor-implement.md` 或以下内联 prompt）

### 审计执行体选择（按 Fallback Strategy）

1. **L1**（主路径）：读取 `.claude/agents/auditors/auditor-implement.md` 全文作为 prompt，传入 Agent tool（`subagent_type: general-purpose`）
2. **L2**：oh-my-claudecode `code-reviewer`
3. **L3**：`.claude/skills/speckit-workflow/` 中 code-review skill
4. **L4**：主 Agent 直接执行以下审计 prompt

降级时须向用户输出降级通知（FR26）。

### Requirements

- Use **audit-prompts.md §5** (执行阶段审计): 逐项验证、无占位、无模糊表述、可落地实施、完全覆盖、验证通过.
- **批判审计员必须出场，发言占比 >70%**；从对抗视角检查遗漏、行号漂移、验收一致性、误伤/漏网.
- **收敛条件**：**一轮** = 一次完整审计子任务调用；**连续 3 轮无 gap** = 连续 3 次结论均为「完全覆盖、验证通过」且该 3 次报告中批判审计员结论段均注明「本轮无新 gap」；若任一轮为「未通过」或「存在 gap」，则从下一轮重新计数。否则根据报告修改后再次发起审计.

### 发起前自检清单

- [ ] DOC_PATH 已填入
- [ ] 实施产物路径已确认
- [ ] 已输出 CLI Calling Summary
- [ ] 审计 prompt 模板已整段复制

### CLI Calling Summary 示例

```yaml
=== CLI Calling Summary ===
Input: DOC_PATH={文档路径}, round={轮次}
Template: Step 2 Audit Prompt (§5 + 批判审计员)
Output: 审计报告（完全覆盖/未通过）
Fallback: L2 OMC code-reviewer → L3 code-review skill → L4 主 Agent 直接执行
Acceptance: 连续 3 轮无 gap 收敛
```

### Prompt template（整段复制，替换占位符后传入）

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

Main Agent: launch this Agent tool after Step 1 (and after any resume). 主 Agent 在发起第 2、3 轮审计前，可输出「第 N 轮审计通过，继续验证…」以提示用户。If the report is "未通过"，主 Agent 通过再次发起实施子任务（或 resume）由子代理修复代码与 prd/progress；主 Agent 仅可做说明性/文档类编辑，不得编辑 prd.*.json、progress.*.txt 或生产代码。然后重新发起审计直至连续 3 轮无 gap 收敛。

### YAML Handoff（Step 2 完成后输出）

```yaml
=== YAML Handoff ===
execution_summary:
  status: passed|failed
  stage: standalone_audit
  round: {轮次}
  critic_ratio: "{批判审计员占比}"
  gap_count: {gap 数}
  convergence_status: in_progress|converged
artifacts:
  report: {审计报告路径}
  tasks_doc: {DOC_PATH}
next_steps:
  - {若通过: 进入下一批或 commit gate}
  - {若未通过: 修复后重新审计}
handoff:
  next_action: implement_next_batch|commit_gate|revise_and_reaudit
  next_agent: bmad-standalone-tasks|bmad-master|auditor-implement
  ready: true|false
```

---

## Step 3: Main Agent prohibitions (reminder)

- **禁止** 对生产代码执行 `search_replace`、`write`、`edit`（生产代码含 TASKS/BUGFIX 文档中列为实现目标的路径）；**禁止**直接编辑 `prd.{stem}.json` 与 `progress.{stem}.txt`（由子代理按 ralph-method 维护）.
- **禁止** 用主 Agent 直接实现任务以替代 subagent；若 subagent 返回不完整，只能通过 Agent tool **resume** 或再次发起新的 Agent tool 继续，并在 prompt 中显式传入「上一批已完成」与「本批待执行」范围，不得自行改代码.
- **允许** 主 Agent 仅编辑说明性/文档类文件（如 README、本 SKILL.md、artifact 目录下 .md），以配合审计结论或记录进度.

---

## 与 ralph-method / speckit-workflow 的衔接

- **Standalone 用法**：本技能为 standalone 模式：以当前 TASKS/BUGFIX 文档为唯一任务来源，不要求先存在 speckit 产出的 tasks.md。US 与 prd 来源为当前文档。与 ralph-method 中「prd 与 tasks.md 一致」并存时，以本技能约定为准。子代理在无 US 结构时按本技能约定生成 prd/progress，无需满足 ralph-method 技能的前置（plan/IMPLEMENTATION_GAPS/tasks.md）检查。
- **无 US 结构时**：若文档仅有扁平任务列表，子代理须将每条可验收任务映射为 US-001、US-002…（或采用文档原有编号），生成符合 ralph-method prd.json schema 的 prd，并保持 progress 与 prd 的 id 一致。
- **技能加载**：实施子任务 prompt 开头已要求子代理先读取并遵循 ralph-method 与 speckit-workflow 再执行，确保 prd 结构与 TDD/验收约束一致。

---

## Repo Add-ons

以下为仓库级扩展，不属于 Cursor Canonical Base，由本仓新增。

### Handoff / State 协议

- 每个 step 结束输出 YAML Handoff（见上方各 step 末尾模板）
- 最终提交通过 `bmad-master` 门控
- 禁止子代理自行 commit

### Scoring / AuditIndex 集成

- 审计报告须包含可解析评分块（供统一 auditor host runner 自动触发 score 写入）
- `reportPath`、`artifactDocPath`、`stage` 必须完整，以便统一 auditor host runner 自动触发评分写入与 registry auditIndex 更新
- 主 Agent **不得**在 standalone 路径里手工分别调用 `bmad-speckit score` 或 `update-runtime-audit-index`；统一通过 `runAuditorHost` / 统一 auditor host runner 承接

### 禁止词与模糊表述

- 本仓约定禁止出现在任务描述中的表述：「将在后续迭代」「待后续处理」「暂不实现」等延迟性语言
- 审计须检查并标记此类表述为 gap

---

## References

- **ralph-method**: Create/maintain prd + progress; naming and schema see ralph-method skill.
- **speckit-workflow**: TDD 红绿灯、15 条铁律、验收命令、架构忠实；审计须调用 code-review 技能.
- **audit-prompts §5**: 执行阶段审计；本技能内置的 7 项即为 §5 审计项。若项目存在 `_bmad/references/audit-prompts.md`，可对照其 §5 执行。逐项验证、完全覆盖、验证通过；批判审计员、3 轮无 gap 收敛.
- **audit-post-impl-rules**: 与 speckit-workflow、bmad-story-assistant 的实施后审计规则对齐。本技能 Step 2 已符合 audit-post-impl-rules（3 轮无 gap、批判审计员 >50%）。规则文件路径：`.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`。
- **audit-document-iteration-rules**: 当对 TASKS/BUGFIX **文档**进行审计（非实施后审计）时，须遵循 `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`：审计子代理在发现 gap 时须直接修改被审文档。**本技能 Step 2 为实施后审计（审计代码）**，修改由实施子代理完成，不适用文档迭代规则。
- **Prompt templates**: See `references/prompt-templates.md` for copy-paste prompts with placeholders.

---

## 错误与边界处理

- **文档路径不存在**：主 Agent 解析用户输入得到路径后，若该路径不存在，应向用户报错并列出已解析路径，不发起实施子任务。
- **子代理错误或超时**：若有返回的 agent ID，主 Agent 可发起 **resume**（最多重试 1 次）；若仍失败或无 agent ID，则重新发起新的 Agent tool，并在 prompt 中注明「上次未完成，请从同目录 progress 文件或下列断点继续」，不替代子代理直接改生产代码。
- **主 Agent 禁止编辑**：prd.*.json、progress.*.txt 仅由子代理维护；主 Agent 不得为「补写 progress」等理由直接编辑上述文件。

<!-- ADAPTATION_COMPLETE: 2026-03-16 -->

