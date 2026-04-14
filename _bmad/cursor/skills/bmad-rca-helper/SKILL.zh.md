---
name: bmad-rca-helper
description: |
  Use Party-Mode to perform deep root cause analysis (RCA) and design optimal solutions from user-provided topics, issue descriptions, or screenshots. Party-mode gate, recovery, snapshot, evidence, and exit semantics are sourced from `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`; the current hard gate for the designated challenger is `>60%`, not a local override. For the "final solution + final task list" scenario, require 100 rounds of discussion and no new gap in the last 3 rounds before convergence; then produce a final solution description and final task list with no vague/optional wording. After that, run a strict audit sub-task (code-reviewer, audit-prompts §4 / TASKS-doc style) and re-audit until "完全覆盖、验证通过". Use when: user requests RCA, "根因分析", "议题/问题深度分析", "最优方案+任务列表", or "RCA 后审计任务文档".
---

# BMAD RCA 助手

基于 Party-Mode 对用户提供的**议题/问题描述/截图/问题**进行深度根因分析与最优方案讨论，产出**最终方案描述**与**最终任务列表**；随后对产出的任务文档发起严格审计并迭代至「完全覆盖、验证通过」。

## 适用场景

- 用户提供议题、问题描述、截图或具体问题，要求深度根因分析
- 需要多角色辩论挖掘最优方案并生成可执行任务列表
- 产出文档需经严格审计（批判审计员 >70%、连续 3 轮无 gap）后交付

> Party-mode 规则源：`{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`
> 说明：轮次分级、`designated_challenger_id`、`challenger_ratio > 0.60`、session/meta/snapshot/evidence、恢复与退出门禁都以 core step-02 为准。本技能不得自定义第二套 party-mode gate 语义。

## 强制约束

| 约束 | 说明 |
|------|------|
| Party-Mode 轮次 | **至少 100 轮**（产出最终方案 + 任务列表场景） |
| 批判审计员 | 必须引入；party-mode 发言占比以 core step-02 为准（当前 designated challenger 硬门禁：`challenger_ratio > 0.60`） |
| 收敛条件 | **最后 3 轮无新 gap** 才能结束辩论 |
| 方案与任务描述 | **禁止**模糊表述；**禁止**「可选、可考虑、后续、酌情」等不确定用语；**禁止**遗漏 |
| 审计子任务 | 辩论收敛并产出文档后**必须**发起审计子任务 |
| 审计收敛 | 审计须**连续 3 轮无 gap**；未通过时**审计子代理直接修改被审文档**，禁止仅输出建议 |

## 工作流

### 阶段一：Party-Mode 根因分析与方案讨论

1. **输入**：用户提供的议题/问题描述/截图/问题（主 Agent 归纳为统一议题描述）。
2. **执行**：**必须读取** `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` 及 `steps/step-02-discussion-orchestration.md`，并**严格遵循** step-02 中的 Response Structure 与 gate/recovery/evidence 规则编排多角色讨论。
3. **角色**：**必须**引入 ⚔️ **批判性审计员**；可包含 🏗️ Winston 架构师、💻 Amelia 开发、📋 John 产品经理等（展示名与 `_bmad/_config/agent-manifest.csv` 一致）；批判审计员发言占比以 core step-02 为准，不在本技能中另立阈值。
3b. **发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`、`⚔️ **批判性审计员**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv`，禁止省略。
4. **轮次与收敛**：
   - 讨论 **至少 100 轮**；
   - **收敛条件**：**最后 3 轮无新 gap** 才能结束（如第 98、99、100 轮均无新 gap）；
   - 禁止凑轮次：每轮须有实质角色发言。
5. **产出**：
   - 最终方案描述：高质量、准确、无模糊表述、无「可选/可考虑/后续/酌情」、无遗漏；
   - 最终任务列表：可执行、可验收、与方案一一对应。

产出文档建议命名与路径：若与 Story 关联则置于 `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/`，否则置于 `_bmad-output/implementation-artifacts/_orphan/`；如 `RCA_{议题slug}.md` 或 `TASKS_RCA_{议题slug}.md`（含 §1 问题简述、§2 约束、§3 根因与方案、§4 任务列表、§5 验收等）。

### 阶段二：审计子任务（必做）

1. **触发**：阶段一收敛并生成最终方案 + 任务列表文档后，主 Agent **必须**发起审计子任务。
2. **子代理**：优先 **code-reviewer**（Cursor Task）；若不可用则 `mcp_task` + `subagent_type: generalPurpose`。
3. **审计依据**：使用 [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) 中的完整 prompt 模板（audit-prompts §4 精神 + TASKS 文档适配）；或项目内 `.cursor/skills/speckit-workflow/references/audit-prompts.md` §4 的适配版本。
4. **审计要求**：
   - **批判审计员必须出场**，发言占比 **>70%**；
   - **收敛条件**：**连续 3 轮无 gap**（针对被审文档）；
   - **未通过时**：**审计子代理须在本轮内直接修改被审文档**以消除 gap，修改完成后输出报告并注明已修改内容；主 Agent 收到报告后发起下一轮审计；**禁止**仅输出修改建议而不修改文档。详见 [audit-document-iteration-rules](references/audit-document-iteration-rules.md) 或 `{project-root}/.cursor/skills/speckit-workflow/references/audit-document-iteration-rules.md`。
5. **迭代**：重复审计直至报告结论为「**完全覆盖、验证通过**」且连续 3 轮无 gap。
6. **报告落盘**：每轮审计报告（无论通过与否）均须保存至约定路径，如 `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_RCA_{slug}_§4_round{N}.md`。

## 引用与依赖

| 资源 | 路径/说明 |
|------|-----------|
| **party-mode** | `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`；所有 rounds / challenger ratio / recovery / evidence / exit gate 规则以 core step-02 为准 |
| **批判审计员** | `{project-root}/_bmad/core/agents/critical-auditor-guide.md`（若存在）；step-02 中批判性审计员为必选挑战者 |
| **audit-prompts §4** | `{project-root}/.cursor/skills/speckit-workflow/references/audit-prompts.md` §4（tasks 审计）；本技能审计 prompt 与之精神一致 |
| **audit-document-iteration-rules** | `{project-root}/.cursor/skills/speckit-workflow/references/audit-document-iteration-rules.md`；发现 gap 时审计子代理直接修改文档、3 轮无 gap 收敛 |
| **本技能审计模板** | [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) |

## § 禁止词表（方案与任务描述）

以下词不得出现在最终方案描述与任务列表中。审计时若发现任一词，结论为未通过。

| 禁止词/短语 | 替代方向 |
|-------------|----------|
| 可选、可考虑、可以考虑 | 明确写「采用方案 A」并简述理由 |
| 后续、后续迭代、待后续 | 若本阶段不做则不在文档中写；若做则写清本阶段完成范围 |
| 待定、酌情、视情况 | 改为明确条件与对应动作（如「若 X 则 Y」） |
| 技术债、先这样后续再改 | 单独开 Story 或不在本次范围；不在 RCA 产出中留技术债 |

## 主 Agent 发起审计时的必守规则

- 将 **references/audit-prompt-rca-tasks.md** 中的完整 prompt **整段复制**到审计子任务，替换 `{文档路径}`、`{需求依据路径}`、`{项目根}`、`{报告路径}`、`{轮次}`。
- **报告保存**：模板中须为「每轮报告（无论通过与否）均须保存至 {报告路径}」。
- 若使用 code-reviewer，确保其可访问项目内 `audit-document-iteration-rules.md` 及 audit-prompts §4 精神说明（可在 prompt 中粘贴关键段落或路径）。
