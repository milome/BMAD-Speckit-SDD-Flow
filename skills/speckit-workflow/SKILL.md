---
name: speckit-workflow
description: |
  完善 Speckit 开发流程：在 specify/plan/gaps/tasks 各阶段强制需求映射与审计闭环，
  以及执行 tasks.md 中任务时强制 TDD 红绿灯模式（红灯-绿灯-重构）开发。
  在执行 /speckit.constitution、/speckit.specify、/speckit.plan、/speckit.tasks、/speckit.implement（或 .speckit.* 等价形式）后；增强命令 clarify/checklist/analyze **须嵌入相应审计闭环迭代内执行**：§1.2 spec 审计报告指出「存在模糊表述」→clarify（§1.2 迭代内）；§2.2 plan 审计闭环内，当 plan 涉及多模块或复杂架构时→checklist 作为 §2.2 审计步骤的一部分；§4.2 tasks 审计闭环内，当 tasks≥10 或跨多 artifact 时→analyze 作为 §4.2 审计步骤的一部分；不得以「可选」为由在应执行场景下跳过；
  或模型自动深度分析生成 IMPLEMENTATION_GAPS、用户要求「生成 tasks」「执行 tasks」时，
  必须按本 skill 的规则添加需求映射清单并**调用 code-review 技能**进行审计直至通过。
  本 skill **依赖 code-review 技能**，审计闭环步骤中必须显式调用该技能，不得跳过或自行宣布通过。
  在用户要求执行 tasks.md（或 tasks-v*.md）中的未完成任务时，
  必须按本 skill 的 TDD 红绿灯模式执行规则进行开发，使用 TodoWrite 追踪进度，
  严格遵守架构忠实性、禁止伪实现、主动回归测试等 15 条铁律。
  同时遵守 QA_Agent 执行规则与 ralph-wiggum 法则。
---

# Speckit 开发流程完善

> 🚨 **强制约束 - 不可跳过**
> 必须按顺序执行：specify → plan → GAPS → tasks → 执行。每个阶段必须通过 code-review 审计才能进入下一阶段。严禁跳过任何阶段或审计！

本 skill 定义 **constitution → spec.md → plan.md → IMPLEMENTATION_GAPS.md → tasks.md → tasks 执行** 各阶段的强制步骤：constitution 建立项目原则；文档阶段为 **需求映射表格** + **code-review 审计循环**（直至审计通过）；执行阶段为 **TDD 红灯-绿灯-重构循环** + **15 条铁律**（直至全部任务完成）。

## 快速决策指引

### 何时使用本技能
- 已明确技术实现方案，需要详细执行计划
- 已有Story文档，需要转换为技术规格
- 需要TDD红绿灯模式指导开发

### 何时使用bmad-story-assistant
- 需要从Product Brief开始完整流程
- 需要PRD/Architecture深度生成
- 需要Epic/Story规划和拆分
- 不确定技术方案，需要方案选择讨论

### 两者关系
本技能是bmad-story-assistant的技术实现层嵌套流程。
当bmad-story-assistant执行到"阶段三：Dev Story实施"时，会触发本技能的完整流程。

---

## §0.5 执行 constitution 之后（项目原则）

**必须执行的命令**：`/speckit.constitution` 或 `.speckit.constitution`（在项目或功能目录下执行，**须在 specify 之前完成**）

### 0.5.1 必须完成

- 建立 **项目原则**：技术栈、编码规范、架构约束、禁止事项等。
- 产出 **constitution.md** 或 **.specify/memory/constitution.md** 或 **.speckit.constitution**。
- 确保 specify、plan、tasks 各阶段**引用 constitution 中的原则**作为约束依据。

### 0.5.2 审计闭环

- constitution 产出后，**建议**按 §0 约定调用 code-review 技能，检查是否包含项目原则、技术栈、约束等；**若项目无专门 constitution 审计提示词，可选用通用文档完整性检查**。
- 若未通过：根据审计报告迭代修改 constitution，直至满足项目原则完整性要求。

---

## §0 技能依赖：code-review 调用约定（审计闭环必须遵守）

**本 skill 依赖 code-review 技能**。所有审计闭环步骤（§0.5.2、§1.2、§2.2、§3.2、§4.2、§5.2）均须**显式调用 code-review 技能**，不得以自审替代或提前宣布通过。§0.5.2 可选用通用文档完整性检查。

### 0.1 调用方式

### Code-Review调用策略

**优先策略**:
1. 检查 `.cursor/agents/code-reviewer.md` 与 `.claude/agents/code-reviewer.md`；**GAP-041 修复**：当两者并存时，优先使用 `.cursor`
2. 若存在，使用 Cursor Task调度code-reviewer进行审计
3. 提示词使用 `audit-prompts.md` 对应章节；（**GAP-070 修复**：speckit 各阶段审计用 audit-prompts.md §1–§5；PRD/Arch/PR 审计用新建的 audit-prompts-prd/arch/pr.md）

**回退策略**:
1. 若code-reviewer不可用，使用 `mcp_task` + `subagent_type: generalPurpose`
2. 将 `audit-prompts.md` 对应章节内容作为prompt传入
3. 要求子代理按审计清单逐项检查

**注意**: mcp_task的subagent_type目前仅支持generalPurpose、explore、shell，不支持code-reviewer。

### 0.1.1 子 Agent 执行 code-review 时的技能绑定规则

当通过**方式 B（子代理/任务）**发起 code-review 审计时，**必须**遵守：

1. **检查可用技能**：发起子 Agent 前，检查当前环境中是否存在名为 `code-review`、`code-reviewer`、`requesting-code-review` 或功能描述中包含「代码审查」「code review」的技能。
2. **强制绑定技能**：若存在上述同名或功能相近的技能，子 Agent 的 prompt 中**必须**明确指示其读取并遵循该技能的工作流（例如在 prompt 开头加入「请先阅读并遵循 code-review 技能的工作流」或通过 `@code-review` 附带技能）。
3. **禁止裸审计**：**禁止**在有可用 code-review 技能的情况下，子 Agent 仅凭自身能力执行审计而不加载该技能——这会导致审计标准不一致、遗漏技能中定义的审计检查项。
4. **无可用技能时的降级**：若当前环境确实无任何 code-review 相关技能，子 Agent 可按 audit-prompts.md 的提示词独立执行审计，但**必须**在审计报告开头注明「未检测到 code-review 技能，使用内置审计标准」。

### 0.2 禁止事项

- **禁止**在未调用 code-review 技能的情况下，自行宣布「完全覆盖、验证通过」。
- **禁止**将「审阅 + 修改」合并为一步后直接给出通过结论；必须先**审计 → 报告 → 若未通过则修改 → 再次审计**。
- **禁止**在有可用 code-review（或同名/功能相近）技能的情况下，子 Agent 不加载该技能即执行审计（见 §0.1.1）。

### 0.3 迭代规则

- 若 code-review 审计报告结论为**未通过**：根据报告逐条修改对应文档，修改完成后**必须再次调用 code-review**，不得在一次修改后自行宣布通过。
- **仅在** code-review 审计报告明确写出「完全覆盖、验证通过」时，方可结束该步骤。

---

## 1. 执行 specify 之后（spec.md）

**必须执行的命令**：`/speckit.specify` 或 `.speckit.specify`（在功能目录或 specs 目录下执行；**前置条件**：constitution 已产出）

### 1.0 spec 目录路径约定（BMAD 与 standalone 双轨制）

**BMAD 流程**（当 speckit 由 bmad-story-assistant 嵌套触发时）：
- 路径格式：`specs/epic-{epic}/story-{story}-{slug}/`
- **slug 必选**，保证目录可读性；若省略则导致 `specs/epic-4/story-1/` 等纯数字命名，可读性差。
- 示例：`specs/epic-4/story-1-implement-base-cache/`
- 产出文件名：`spec-E{epic}-S{story}.md`、`plan-E{epic}-S{story}.md`、`tasks-E{epic}-S{story}.md`、`IMPLEMENTATION_GAPS-E{epic}-S{story}.md`

**slug 来源规则**（按优先级，若无法推导则要求用户显式提供）：
| 优先级 | 来源 | 示例 |
|--------|------|------|
| 1 | Story 文档标题（取前若干词，转 kebab-case） | "Implement base cache class" → `implement-base-cache` |
| 2 | Epic 名称（去掉 `feature-` 前缀） | `feature-metrics-cache` → `metrics-cache` |
| 3 | Story scope 首句关键词（转 kebab-case） | "缓存服务基础实现" → `cache-service-base` |
| 4 | 兜底 | `E4-S1` 作为 slug（保证唯一，可读性最差） |

**standalone 流程**（用户直接执行 speckit，未走 BMAD）：
- 路径格式：`specs/{index}-{feature-name}/`
- index 由 create-new-feature.ps1 的 Get-HighestNumberFromSpecs 推导
- 示例：`specs/015-indicator-system-refactor/`

**fallback 规则**：无 `--mode bmad` 或 `--epic`/`--story` 参数时，使用 standalone 行为；有 `--mode bmad` 时，必须提供 `--slug` 或从 Story 文档推导。

### 1.0.1 speckit-workflow 产出路径约定

**所有 speckit-workflow 相关产出必须放在 spec 子目录下**：

| 产出 | 路径 | 命令 |
|------|------|------|
| spec.md | `specs/{index}-{name}/spec.md` 或 `specs/epic-{epic}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | speckit.specify |
| plan.md | 同上目录 | speckit.plan |
| tasks.md | 同上目录 | speckit.tasks |
| IMPLEMENTATION_GAPS.md | 同上目录 | speckit.gaps |
| checklists/ | 同上目录下 | speckit.specify |
| research.md、data-model.md、contracts/ | 同上目录 | speckit.plan |

**禁止**：将 speckit 产出放在 `_bmad-output` 或项目根其他位置。BMAD 流程产出见 bmad-story-assistant、bmad-bug-assistant 技能约定。

### 1.0.2 BMAD 产出与 _bmad-output 子目录对应

speckit 产出在 spec 子目录；BMAD 产出在 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`。
当 spec 路径为 `specs/epic-{epic}/story-{story}-{slug}/` 时，对应 BMAD 子目录为 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`。

### 1.1 必须完成

- 对照 **原始需求/设计文档** 与生成的 **spec.md**。
- 在 **spec.md** 中按原始需求文档 **逐章节、逐条** 增加 **需求映射清单表格**。表头与列名固定模板见 [references/mapping-tables.md](references/mapping-tables.md) §1。

- 确保原始需求文档的 **每一章、每一条** 在 spec.md 中有明确对应且标注覆盖状态。

### 1.2 审计闭环

- 生成或更新 spec.md 后，**必须按 §0 约定调用 code-review 技能**，使用 **固定审计提示词**：[references/audit-prompts.md](references/audit-prompts.md) §1。
- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。
- 若未通过：根据审计报告 **迭代修改 spec.md**（补全映射表、补全遗漏章节），**再次调用 code-review**，直至报告结论为通过。

---

## 2. 执行 plan 之后（plan.md）

**必须执行的命令**：`/speckit.plan` 或 `.speckit.plan`（在功能目录下，spec.md 已生成后执行）

**前置步骤（锚定 §1.2 spec 审计闭环）**：当 §1.2 spec 审计报告指出「spec 存在模糊表述」时，须在 **§1.2 迭代内** 执行 `/speckit.clarify` 或 `.speckit.clarify` 澄清 → 更新 spec.md → **再次调用 §1.2 审计**，直至通过后再执行 plan；不得以「可选」为由在应执行场景下跳过。

### 2.1 必须完成

- 对照 **原始需求设计文档**、**spec.md** 与生成的 **plan.md**。
- 在 **plan.md** 中按原始需求文档与 spec.md **逐章节、逐条** 增加 **需求映射清单表格**。表头与列名固定模板见 [references/mapping-tables.md](references/mapping-tables.md) §2。
- 确保需求文档与 spec.md 的 **每一章、每一条** 在 plan.md 中有明确对应。

**集成与端到端测试计划（必须）**

- plan.md **必须**包含**完整的集成测试与端到端功能测试计划**，覆盖模块间协作、生产代码关键路径、用户可见功能流程。
- **严禁**测试计划仅包含单元测试；单元测试为必要补充，但不得作为唯一验证手段。
- **严禁**出现「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的情况——测试计划必须验证每个模块**确实被生产代码关键路径导入并调用**。

### 2.2 审计闭环

- 生成或更新 plan.md 后，**必须按 §0 约定调用 code-review 技能**，使用 **固定审计提示词**：[references/audit-prompts.md](references/audit-prompts.md) §2。
- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。
- 若未通过：根据审计报告 **迭代修改 plan.md**，**再次调用 code-review**，直至报告结论为通过。
- **嵌入步骤（当 plan 涉及多模块或复杂架构时须执行）**：在 plan 审计通过后、本步骤结束前，**须将 `/speckit.checklist` 或 `.speckit.checklist` 作为 §2.2 审计步骤的一部分**执行——生成质量检查清单，验证需求完整性、清晰度与一致性；若 checklist 发现问题，须迭代修改 plan.md 并**再次执行 code-review 审计**，直至 checklist 验证通过；不得以「可选」为由在应执行场景下跳过。

### Plan阶段可选Party-Mode

当以下情况出现时，可在plan阶段启动party-mode：
1. 用户明确要求深入讨论技术方案
2. Create Story阶段未能充分解决的技术争议
3. 涉及重大架构决策（如数据库选型、服务拆分）

**启动命令**:
```
进入party-mode讨论技术方案，建议50轮
```

**角色设定**:
- Winston (架构师)
- Amelia (开发)
- Quinn (测试)
- 批判审计员 (新增，强制参与)

**收敛条件**:
1. 所有角色达成共识
2. 近3轮无新的技术gap提出
3. 辩论轮次达到最少要求（50轮）

---

## 3. 生成 tasks 之前（IMPLEMENTATION_GAPS.md）

**触发方式**：无独立命令。在 plan.md 已通过审计后，**模型必须自动执行深度分析**：对照 plan.md、原始需求文档与当前实现，逐章节逐条比较差异，生成 IMPLEMENTATION_GAPS.md。用户要求「生成 IMPLEMENTATION_GAPS」「生成 GAPS」时同样触发。

### 3.1 必须完成

- 根据 **当前实现** 与 **原始需求设计文档**，按 **逐章节、逐条** 分析差异，生成 **IMPLEMENTATION_GAPS.md**。
- **若用户明确给出更多参考文档**（例如单独的架构设计文档、设计说明书等），**必须**同时按 **逐章节、逐条** 对**所有给定参考文档**分析差异，确保全部作为有效输入参与 Gap 分析。
- 文档结构需按需求文档（及所有参考文档）章节列出每条 Gap，并注明：需求/设计章节、当前实现状态、缺失/偏差说明。Gap 列表表头模板见 [references/mapping-tables.md](references/mapping-tables.md) §3。

### 3.2 审计闭环

- 生成或更新 IMPLEMENTATION_GAPS.md 后，**必须按 §0 约定调用 code-review 技能**，使用 **固定审计提示词**：[references/audit-prompts.md](references/audit-prompts.md) §3。
- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。
- 若未通过：根据审计报告 **迭代修改 IMPLEMENTATION_GAPS.md**，**再次调用 code-review**，直至报告结论为通过。

---

## 4. 执行 tasks 或生成 tasks 相关 md 时（tasks.md）

**必须执行的命令**：`/speckit.tasks` 或 `.speckit.tasks` 或 用户明确要求「生成 tasks」「生成 tasks.md」（在 IMPLEMENTATION_GAPS.md 已生成后执行）

### 4.1 必须完成

- 对照 **原始需求设计文档**、**plan.md**、**IMPLEMENTATION_GAPS.md** 生成 **tasks.md**。
- 使用项目 **tasks 模板**：`docs/speckit/tasks-template/tasks-template.md`（或项目内约定的模板路径）。
- 在 **tasks.md** 中按原始需求文档、plan.md、IMPLEMENTATION_GAPS.md **逐章节、逐条** 增加 **需求映射清单表格**；表头与列名见 [references/mapping-tables.md](references/mapping-tables.md) §4–§8；Agent 执行规则、需求追溯格式、验收标准与验收执行规则见 [references/tasks-acceptance-templates.md](references/tasks-acceptance-templates.md)。

**集成与端到端测试用例（必须）**

- tasks.md **必须**为每个功能模块/Phase 包含**集成测试与端到端功能测试任务及用例**，验证模块间协作与用户可见功能流程在生产代码关键路径上的完整性。
- **严禁**验收标准仅依赖单元测试；每个模块的验收**必须**同时包含「该模块在生产代码关键路径中被导入、实例化并调用」的集成验证。
- **严禁**出现「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的任务被标记为完成。

### 4.2 审计闭环

- 生成或更新 tasks.md 后，**必须按 §0 约定调用 code-review 技能**，使用 **固定审计提示词**：[references/audit-prompts.md](references/audit-prompts.md) §4。
- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。
- 若未通过：根据审计报告 **迭代修改 tasks.md**，**再次调用 code-review**，直至报告结论为通过。
- **嵌入步骤（当 tasks 数量≥10 或跨多 artifact 时须执行）**：在 tasks 审计通过后、本步骤结束前，**须将 `/speckit.analyze` 或 `.speckit.analyze` 作为 §4.2 审计步骤的一部分**执行——做跨 artifact 一致性分析（spec、plan、tasks 等对齐报告）；若 analyze 发现问题，须迭代修改 tasks.md 并**再次执行 code-review 审计**，直至 analyze 验证通过；不得以「可选」为由在应执行场景下跳过。

### 任务分批执行机制

当tasks-E{epic}-S{story}.md中的任务数量超过20个时，必须分批执行：（**GAP-044 修复**：20 为经验阈值，兼顾单批可管理性与审计成本；可通过配置覆盖）

**分批规则**:
- 每批最多20个任务
- 每批执行完毕后进行code-review审计
- 审计通过后才能开始下一批

**执行流程**:
```
Batch 1: Task 1-20 → 执行 → code-review审计 → 通过
Batch 2: Task 21-40 → 执行 → code-review审计 → 通过
...
Batch N: Task ... → 执行 → code-review审计 → 通过
```

**检查点审计内容**:
1. 本批任务是否全部完成
2. 测试是否全部通过
3. 是否有遗留问题影响下一批
4. 是否需要调整后续批次计划

**异常处理**:
- 如果某批审计未通过，修复后重新审计该批
- 如果连续两批审计未通过，暂停并评估整体方案

### 审计质量评级（A/B/C/D）

由于speckit各阶段不强制要求party-mode，通过审计质量评级补偿质量保证：

| 评级 | 含义 | 处理方式 |
|-----|------|---------|
| **A级** | 优秀，完全符合要求 | 直接进入下一阶段 |
| **B级** | 良好，minor问题 | 记录问题，**在本阶段审计闭环内完成修复**后进入下一阶段；禁止使用「后续」「待定」等模糊表述 |
| **C级** | 及格，需修改 | 必须修改后重新审计 |
| **D级** | 不及格，严重问题 | 退回上一阶段重新设计 |

**评级维度**:
1. 完整性（30%）：是否覆盖所有需求点
2. 正确性（30%）：技术方案是否正确
3. 测试验证（25%）：生产代码集成测试验证、**GAP-087 修复**：「新增代码」= 本 Story 或本批任务新增/修改的代码；新增代码覆盖率≥85%；
4. 质量（15%）：代码/文档质量是否达标

**强制升级规则**:
- 连续两个阶段评为C级，第三阶段强制进入party-mode
- 任一阶段评为D级，必须复盘并考虑回到Layer 3重新Create Story

---

## 5. 执行 tasks.md 中的任务（TDD 红绿灯模式）

**必须执行的命令**：`/speckit.implement` 或 `.speckit.implement` 或 用户明确要求「执行 tasks.md」「执行 tasks」「完成 tasks 中的任务」

当用户要求执行 tasks.md（或 tasks-v*.md）中的未完成任务时，**必须**按 TDD 红灯-绿灯-重构循环逐任务推进。

### 5.1 执行流程

1. **读取 tasks.md**（或 tasks-v*.md），识别所有未完成任务（`[ ]` 复选框）。
2. **【ralph-method 强制前置】创建 prd 与 progress 追踪文件**：
   - 若与 tasks 同目录或 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/` 下不存在 `prd.{stem}.json` 与 `progress.{stem}.txt`，**必须**在开始执行任何任务前创建；
   - stem 为 tasks 文档 stem（如 tasks-E1-S1 → `tasks-E1-S1`；无 BMAD 上下文时用 tasks 文件名 stem）；
   - prd 结构须符合 ralph-method schema，将 tasks 中的可验收任务映射为 US-001、US-002…（或与 tasks 编号一一对应）；
   - 产出路径：与 tasks 同目录，或 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`（BMAD 流程时）；
   - **禁止**在未创建上述文件前开始编码或执行涉及生产代码的任务。
3. **阅读前置文档**：需求文档、plan.md、IMPLEMENTATION_GAPS.md，理解技术架构与需求范围。
4. **使用 TodoWrite** 创建任务追踪列表，首个任务标记 `in_progress`。
5. **逐任务执行 TDD 循环**：
   - **红灯**：编写/补充覆盖当前任务验收标准的测试用例，运行确认**测试失败**（验证测试有效性）。
   - **绿灯**：编写最少量生产代码使测试通过。
   - **重构**：在测试保护下检查并优化代码质量（SOLID、命名、解耦、性能）。**无论是否有具体重构动作，均须在 progress 中记录 `[TDD-REFACTOR]` 一行**；无具体重构时写"无需重构 ✓"，集成任务写"无新增生产代码，各模块独立性已验证，无跨模块重构 ✓"。
6. **完成后立即更新** tasks.md 中的复选框 `[ ]` → `[x]`，TodoWrite 标记 `completed`。
7. **检查点验证**：遇到检查点时验证所有前置任务已完成，执行回归测试。
8. **循环**直至所有任务完成，禁止提前停止。

### 5.1.1 tasks 与 prd 的映射约定

- tasks 使用 T1、T2、T1.1、T1.2 等格式时：可将 T1 映射为 US-001，T1.1–T1.n 作为 US-001 的子任务；或按顶层任务 T1–T5 映射为 US-001–US-005；
- prd 的 userStories 须与 tasks 中的可验收任务一一对应或可追溯；
- 具体映射策略由执行 Agent 在生成 prd 时确定，但须保证 tasks 中每条可验收任务在 prd 中有对应 US 且验收标准一致。

### TDD红绿灯记录格式（与bmad-story-assistant统一）

**统一格式模板**:
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

**必填字段**:
1. `[TDD-RED]` - 标记红灯阶段开始
2. `[TDD-GREEN]` - 标记绿灯阶段完成
3. `[TDD-REFACTOR]` - 标记重构阶段（必须记录判断结果，无论是否有具体重构动作；禁止省略此行）
4. `TX` - 时间戳前缀
5. 测试命令和结果
6. ralph-method进度更新

**禁止事项**:
- 跳过红灯阶段直接绿灯
- 省略重构阶段
- 不更新ralph-method进度

### 5.2 审计闭环

- 执行 tasks.md 中的任务（TDD 红绿灯模式）后，**必须按 §0 约定调用 code-review 技能**，使用 **固定审计提示词**：[references/audit-prompts.md](references/audit-prompts.md) §5。
- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。
- 若未通过：根据审计报告 **迭代执行 tasks.md 中审计未通过的任务**，**再次调用 code-review**，直至报告结论为通过。

**集成与端到端测试执行（必须）**

- 执行阶段**必须**运行集成测试与端到端功能测试，验证模块间协作与用户可见功能流程在生产代码关键路径上工作正常。**严禁**仅运行单元测试即宣布完成。
- **必须**验证每个新增或修改的模块**确实被生产代码关键路径导入、实例化并调用**（例如：grep 生产代码 import 路径、检查 UI 入口是否挂载、检查 Engine/主流程是否实际调用）。
- 发现「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的情况时，**必须**将其作为 **未通过项** 报告并修复，而非标记为通过。

### 5.3 关键约束（15 条铁律摘要）

执行时必须遵守完整约束规则，详见 [references/task-execution-tdd.md](references/task-execution-tdd.md)。核心要点：

**架构与需求忠实性**
- 严格按文档记录的技术架构和选型实施，**禁止**擅自修改。
- 严格按文档记录的需求范围和功能范围实施，**禁止**以最小实现为由偏离需求。

**禁止伪实现**
- **禁止**假完成、伪实现、占位实现。
- **禁止**标记完成但功能未实际调用或未在关键路径中使用。

**测试与回归**
- 主动修复测试脚本，禁止以无关为由逃避。
- 主动进行回归测试，禁止掩盖功能回退问题。

**流程完整性**
- pytest 等长时间脚本使用 `block_until_ms: 0`，轮询 `terminals/` 检查结果。
- 如需参考设计，查看前置需求文档/plan文档/IMPLEMENTATION_GAPS文档。
- 在所有未完成任务真正实现并完成之前**禁止**停止开发工作。

---

## 6. Agent 执行规则（plan.md / tasks.md 必须遵守）

生成 plan.md 与 tasks.md 时，除上述映射与审计外，**还必须** 遵守以下 Agent 执行规则（与 QA_Agent 任务执行最佳实践 §397–409 一致）：

**禁止事项**

1. 禁止在任务描述中添加「注: 将在后续迭代...」。
2. 禁止标记任务完成但功能未实际调用。
3. 禁止仅初始化对象而不在关键路径中使用。
4. 禁止用「预留」「占位」等词规避实现。
5. **禁止**模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用（「孤岛模块」反模式）。
6. **禁止**仅使用单元测试验收任务；集成测试与端到端功能测试为必须验收项。

**必须事项**

1. 集成任务必须修改生产代码路径。
2. 必须运行验证命令确认功能启用。
3. 遇到无法完成的情况，应报告阻塞而非自行延迟。
4. 功能/配置/UI 相关任务实施前必须先检索并阅读需求文档相关章节（§9 需求追溯与闭环）。
5. 需求追溯（实施前必填）：问题关键词、检索范围、相关章节、既有约定摘要、方案是否与需求一致。

### Enforcement说明（禁止事项检查责任）

**各阶段禁止事项及检查责任人**:

| 阶段 | 禁止事项 | 检查责任人 | 检查方式 |
|-----|---------|-----------|---------|
| specify | 伪实现 | code-reviewer | 代码审查 |
| specify | 范围蔓延 | code-reviewer | 对比Story文档 |
| plan | 无测试计划 | code-reviewer | 检查plan-E{epic}-S{story}.md |
| plan | 过度设计 | code-reviewer | 架构合理性评估 |
| GAPS | 遗漏关键差距 | code-reviewer | 完整性检查 |
| tasks | 任务不可执行 | code-reviewer | 可行性评估 |
| 执行 | 跳过TDD红灯 | bmad-story-assistant | 检查TDD记录 |
| 执行 | 省略重构 | bmad-story-assistant | 检查TDD记录 |

**违规处理**:
1. 首次违规：警告并要求立即修正
2. 重复违规：暂停执行，返回上一阶段
3. 严重违规：记录并上报给BMad Master

**豁免条件**:
- 经party-mode讨论一致同意
- 有明确的ADR记录决策理由
- 获得批判审计员认可

**Ralph-Wiggum 法则**

- 禁止假装完成，禁止掩盖伪实现的事实，禁止以时间过长为由逃避任务。
- 在所有任务被真正验收并标记为完成之前，禁止退出。

完整 Agent 执行规则与需求追溯格式见 [references/qa-agent-rules.md](references/qa-agent-rules.md)。

---

## 7. 流程小结

**【Dev Story完整流程 - 不可跳过任何步骤】**

```
Layer 3: Create Story
    →
Layer 4: speckit-workflow（constitution → specify → plan → GAPS → tasks → implement）
    →
Layer 5: 收尾与集成
```

| speckit阶段 | 产出 | 审计依据 | bmad对应阶段 | 说明 |
|------------|------|---------|-------------|------|
| specify | spec-E{epic}-S{story}.md | audit-prompts.md §1 | Layer 4开始 | 技术规格化Story内容；文件名必含Epic/Story序号 |
| plan | plan-E{epic}-S{story}.md | audit-prompts.md §2 | Layer 4继续 | 制定实现方案；文件名必含Epic/Story序号 |
| GAPS | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | audit-prompts.md §3 | Layer 4继续 | 识别实现差距；文件名必含Epic/Story序号 |
| tasks | tasks-E{epic}-S{story}.md | audit-prompts.md §4 | Layer 4继续 | 拆解执行任务；文件名必含Epic/Story序号 |
| 执行 | 可运行代码 | audit-prompts.md §5 | Layer 4结束 | TDD红绿灯开发 |

**文档命名规则**：产出文件名必须包含 Epic 序号、Story 序号；Epic 名称（如 feature-metrics-cache）在路径或文档元数据中体现。示例：Epic 4 Story 1 → spec-E4-S1.md、plan-E4-S1.md。

每次「迭代」均为：**按 §0 约定调用 code-review 技能** → 获得审计报告 → 若未通过则修改对应文档 → **再次调用 code-review** → 直至报告结论为完全覆盖、验证通过。tasks 执行阶段同理：TDD 红绿灯循环 → 逐任务完成 → 检查点验证 → **按 §0 调用 code-review 技能** → 直至报告结论为通过。

---

## 8. Speckit 流程命令索引（必须执行）

| 阶段 | 必须执行的命令 | 前置条件 | 产出 | 审计依据 |
|------|----------------|----------|------|----------|
| **0. constitution** | `/speckit.constitution` 或 `.speckit.constitution` | 无（入口阶段） | constitution.md 或 .specify/memory/constitution.md | 项目自定义或通用文档完整性 |
| **1. specify** | `/speckit.specify` 或 `.speckit.specify` | constitution 已产出 | spec.md | audit-prompts.md §1 |
| **2. plan** | `/speckit.plan` 或 `.speckit.plan` | spec.md 已通过审计 | plan.md | audit-prompts.md §2 |
| **3. GAPS** | 无独立命令；模型自动深度分析（对照 plan + 需求 + 当前实现）或 用户要求「生成 IMPLEMENTATION_GAPS」 | plan.md 已通过审计 | IMPLEMENTATION_GAPS.md | audit-prompts.md §3 |
| **4. tasks** | `/speckit.tasks` 或 `.speckit.tasks` 或 用户要求「生成 tasks」 | IMPLEMENTATION_GAPS.md 已通过审计 | tasks.md | audit-prompts.md §4 |
| **5. 执行** | `/speckit.implement` 或 `.speckit.implement` 或 用户要求「执行 tasks」「完成 tasks 中的任务」 | tasks.md 已通过审计 | 可运行代码 + 测试 | audit-prompts.md §5 |

**命令执行顺序**：0 → 1 → 2 → 3 → 4 → 5，不可跳过。constitution 须在 specify 之前完成；每阶段产出必须通过 code-review 审计（§0）后方可进入下一阶段。

**增强命令（须嵌入相应审计闭环迭代内执行，作为审计步骤的一部分，不得以「可选」为由跳过）**：

| 命令 | 嵌入环节 | 触发条件 | 用途 |
|------|----------|----------|------|
| `/speckit.clarify` | **§1.2 spec 审计闭环迭代内** | §1.2 审计报告指出「spec 存在模糊表述」 | 澄清 → 更新 spec → 再次 §1.2 审计 |
| `/speckit.checklist` | **§2.2 plan 审计闭环内** | plan 涉及多模块或复杂架构 | 作为 §2.2 审计步骤的一部分；若发现问题则迭代 plan → 再次审计 |
| `/speckit.analyze` | **§4.2 tasks 审计闭环内** | tasks≥10 或跨多 artifact | 作为 §4.2 审计步骤的一部分；若发现问题则迭代 tasks → 再次审计 |

**命令格式说明**：
- `/speckit.xxx`：Cursor/Claude 斜杠命令（constitution、specify、plan、tasks、implement、clarify、analyze、checklist）
- `.speckit.xxx`：点命令或项目内 `.speckit.xxx` 文件触发
- **GAPS 无独立命令**：模型在 plan 通过后自动深度分析生成；或用户要求「生成 IMPLEMENTATION_GAPS」时触发

---

## 9. 固定模板与参考文件

| 用途 | 文件 |
|------|------|
| **技能依赖** | **code-review**（或 requesting-code-review）：审计闭环必须显式调用，见 §0 |
| 审计提示词（可复制） | [references/audit-prompts.md](references/audit-prompts.md) |
| 映射表列名与结构 | [references/mapping-tables.md](references/mapping-tables.md) |
| Tasks 验收与执行模板 | [references/tasks-acceptance-templates.md](references/tasks-acceptance-templates.md) |
| Agent 执行规则（完整） | [references/qa-agent-rules.md](references/qa-agent-rules.md) |
| **Tasks 执行 TDD 规则（完整）** | **[references/task-execution-tdd.md](references/task-execution-tdd.md)** |
| **Speckit 命令索引** | 见 §8 |