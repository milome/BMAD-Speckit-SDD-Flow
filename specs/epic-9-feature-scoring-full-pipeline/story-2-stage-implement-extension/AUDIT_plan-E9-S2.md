# plan-E9-S2 审计报告：需求覆盖与集成/E2E 测试专项

**审计对象**：`specs/epic-9/story-2-stage-implement-extension/plan-E9-S2.md`  
**原始需求**：`_bmad-output/implementation-artifacts/epic-9-feature-scoring-full-pipeline/story-9-2-stage-implement-extension/9-2-stage-implement-extension.md`  
**Spec**：`specs/epic-9/story-2-stage-implement-extension/spec-E9-S2.md`  
**审计日期**：2026-03-06  
**第二轮审计**：2026-03-06（Gap 1 修订验证）

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 原始需求文档逐章节对照

### 1.1 Story（用户故事）

| 原始需求章节 | 需求要点 | plan 对应 | 验证方式 | 验证结果 |
|-------------|----------|-----------|----------|----------|
| Story | parse-and-write-score 原生支持 stage=implement | plan §1 需求映射清单、Phase 1 | 对照 | ✅ 已覆盖 |
| Story | 仪表盘能区分 tasks 审计与 implement 审计 | plan Phase 2、§4.2 | 对照 | ✅ 已覆盖 |
| Story | 摆脱 trigger_stage 短期方案的语义混用 | plan Phase 3 speckit-workflow §5.2 更新 | 对照 | ✅ 已覆盖 |

### 1.2 Scope

| 原始需求章节 | 需求要点 | plan 对应 | 验证结果 |
|-------------|----------|-----------|----------|
| Scope | 扩展 AuditStage 与 RunScoreRecord 支持 stage='implement' | Phase 1.1、1.2、1.4 | ✅ |
| Scope | parse-and-write-score 新增 --stage implement | Phase 1.1、§4.1 | ✅ |
| Scope | 仪表盘将 stage=implement 纳入「完整 run」定义 | Phase 2、§4.2 | ✅ |
| Scope | speckit-workflow 改用 --stage implement 调用 | Phase 3 | ✅ |
| Scope | Epic 级仪表盘聚合归属 Story 9.3，本 Story 不涉及 | plan §1 映射表、无 Epic 级聚合 | ✅ |

### 1.3 Acceptance Criteria（AC-1～AC-7）

| AC | 原始需求要点 | plan 对应 | 验证结果 |
|----|-------------|-----------|----------|
| AC-1 | parse-and-write-score 支持 --stage implement；单测覆盖 | Phase 1.1、§4.1 单元+集成测试 | ✅ |
| AC-2 | run-score-schema stage 支持 "implement"；既有 record 不受影响 | Phase 1.2 | ✅ |
| AC-3 | implement 专用解析规则：implement-scoring.yaml、PHASE_WEIGHT_IMPLEMENT=0.25 | Phase 1.1、1.3 | ✅ |
| AC-4 | audit-item-mapping 支持 implement | Phase 1.4 | ✅ |
| AC-5 | 仪表盘完整 run 定义：至少 3 个 stage，stage=implement 或 trigger_stage=speckit_5_2 计入；区分 implement 与 tasks | Phase 2、§4.2 | ✅ |
| AC-6 | speckit-workflow §5.2 改用 --stage implement；报告路径 AUDIT_implement-E{epic}-S{story}.md | Phase 3 | ✅ |
| AC-7 | scoring-trigger-modes 中 --stage implement 可通过校验 | Phase 1.5、§4.1 集成测试 | ✅ |

### 1.4 Tasks（Task 1～6 及子任务）

| Task | 原始需求子任务 | plan 对应 | 验证结果 |
|------|---------------|-----------|----------|
| Task 1 | 1.1 audit-index.ts AuditStage + 'implement' | Phase 1.1 | ✅ |
| Task 1 | 1.2 audit-item-mapping.ts AuditStage + 'implement' | Phase 1.4（plan 将 1.2 合并到 1.4） | ✅ |
| Task 1 | 1.3 weights.ts PHASE_WEIGHT_IMPLEMENT | Phase 1.1 | ✅ |
| Task 1 | 1.4 audit-index switch case 'implement' | Phase 1.1 | ✅ |
| Task 1 | 1.5 audit-generic.ts GenericAuditStage 含 implement | Phase 1.1 | ✅ |
| Task 1 | 1.6 parse-and-write-score.ts CLI stage 类型 | Phase 1.1 | ✅ |
| Task 1 | 1.7 单测 parseAuditReport(stage='implement') | Phase 1.1 验收、§4.1 | ✅ |
| Task 2 | 2.1 run-score-schema stage 接受 "implement" | Phase 1.2 | ✅ |
| Task 2 | 2.2 RunScoreRecord stage 类型 | Phase 1.2 | ✅ |
| Task 3 | 3.1 audit-item-mapping.yaml implement 段 | Phase 1.4 | ✅ |
| Task 3 | 3.2 loadMapping 迭代列表增加 'implement' | Phase 1.4 | ✅ |
| Task 4 | 4.1 compute.ts 完整 run 定义、implement 识别 | Phase 2 | ✅ |
| Task 4 | 4.2 仪表盘按 stage/trigger_stage 区分 implement 与 tasks | Phase 2 | ✅ |
| Task 4 | 4.3 单测含 stage=implement fixture | Phase 2 验收、§4.2 | ✅ |
| Task 5 | 5.1 定位 speckit-workflow SKILL | Phase 3 | ✅ |
| Task 5 | 5.2 §5.2 段落改为 --stage implement | Phase 3 | ✅ |
| Task 5 | 5.3 报告路径约定 | Phase 3 | ✅ |
| Task 6 | 6.1 scoring-trigger-modes implement 校验 | Phase 1.5 | ✅ |
| Task 6 | 6.2 文档化「triggerStage 与 stage 一致可省略」约定 | Phase 1.6 | ✅ |

### 1.5 Dev Notes

| 章节 | 内容 | plan 对应 | 验证结果 |
|------|------|-----------|----------|
| 架构模式 | 复用 parseGenericReport、implement-scoring.yaml | Phase 1.1、1.3 | ✅ |
| 向后兼容 | stage=implement 与 trigger_stage=speckit_5_2 双识别 | Phase 2 | ✅ |
| 环节权重 | 环节 2 为 25% | Phase 1.1 PHASE_WEIGHT_IMPLEMENT | ✅ |
| 涉及源文件 | 10 个模块路径 | plan §5.1 修改文件表 | ✅ |
| 测试标准 | 单测、E2E parse-and-write-score --stage implement | plan §4 集成/E2E 计划 | ✅ |
| Project Structure | implement 报告路径、implement-scoring.yaml 已存在 | Phase 3、Phase 1.3 | ✅ |

**§1 结论**：原始需求文档全部章节在 plan 中均有对应，无遗漏。

---

## 2. spec-E9-S2 逐章节对照

| spec 章节 | 内容摘要 | plan 对应 | 验证结果 |
|-----------|----------|-----------|----------|
| §1 概述 | 6 项范围、输入来源、排除 Epic 级聚合 | plan §1、§2 目标与约束 | ✅ |
| §3.1.1 AuditStage 与 CLI | audit-index、CLI stage 含 implement | Phase 1.1 | ✅ |
| §3.1.2 audit-index case implement | switch case 'implement' | Phase 1.1 | ✅ |
| §3.1.3 implement 专用解析规则 | PHASE_WEIGHT_IMPLEMENT、implement-scoring.yaml | Phase 1.1、1.3 | ✅ |
| §3.2 run-score-schema 与 RunScoreRecord | stage enum、types | Phase 1.2 | ✅ |
| §3.3 audit-item-mapping implement 段 | dimensions、checks、empty_overall 等 | Phase 1.4 | ✅ |
| §3.4 仪表盘完整 run | stages≥3、implement 识别、展示区分 | Phase 2 | ✅ |
| §3.5 speckit-workflow §5.2 | --stage implement、移除 --triggerStage | Phase 3 | ✅ |
| §3.6 trigger 衔接 | implement_audit_pass、文档化约定 | Phase 1.5、1.6 | ✅ |
| §4 非功能需求 | 向后兼容、单测覆盖、E2E | plan §4、§6 | ✅ |

**§2 结论**：spec 全部章节在 plan 中已覆盖。

---

## 3. 专项审查：集成测试与端到端功能测试计划

### 3.1 审计要求对照

- 覆盖模块间协作、生产代码关键路径、用户可见功能流程
- 禁止仅依赖单元测试而缺少集成/E2E 计划
- 识别模块内部实现完整但未被生产路径导入调用的风险

### 3.2 plan §4 现有测试计划摘要

| 类型 | plan 描述 | 覆盖点 |
|------|-----------|--------|
| 单元 | parseAuditReport stage=implement | audit-index / audit-generic |
| 单元 | resolveItemId('implement', ...) | audit-item-mapping |
| 单元 | getLatestRunRecordsV2 含 stage=implement | compute.ts |
| 单元 | getWeakTop3 含 stage=implement | compute.ts |
| 集成 | CLI --stage implement 执行 | parse-and-write-score → scoring/data |
| 集成 | trigger 校验 + --event stage_audit_complete | 不因 trigger 失败退出 |

### 3.3 逐项验证

#### 3.3.1 parse-and-write-score --stage implement 链路

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| 单元测试计划 | plan §4.1 表 | ✅ 有 |
| 集成测试计划 | plan §4.1 集成行 | ✅ 有 |
| 验收命令明确 | plan §6 Phase 1.1 | ✅ `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage implement ...` |
| implement 报告 fixture | plan §5.2 可选 scoring/data/__fixtures-implement/ | ⚠️ **可选**：fixture 路径未强制，实施时需确保有可用 fixture |

#### 3.3.2 仪表盘完整 run 与 implement 识别

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| 单元测试计划 | plan §4.2 表 | ✅ 有 |
| **集成/E2E 计划** | plan §4.2 | ⚠️ **第一轮**：仅单测；**第二轮已修订**：plan §4.2 已增加 dashboard-generate 集成/E2E 行 |
| 生产路径验证 | plan §4.3「compute.ts：dashboard-generate 调用 getLatestRunRecordsV2」 | ✅ 有「grep 确认 compute.ts 被 dashboard 入口导入」 |

**Gap 1（第一轮）**：plan §4.2 仪表盘部分仅规划单测。建议在 §4.2 或 §6 补充 dashboard-generate CLI E2E。  
**Gap 1 修订验证**：见下文 §7。

#### 3.3.3 生产代码关键路径与孤岛风险

| 模块 | 生产入口 | plan 验收 | 结果 |
|------|----------|-----------|------|
| parse-and-write-score | speckit-workflow §5.2 审计通过后调用 | plan §4.3、Phase 3 grep | ✅ 闭环 |
| compute.ts | dashboard-generate 导入 getLatestRunRecordsV2 | plan §4.3 grep 确认 | ✅ 闭环 |
| audit-item-mapping | parseGenericReport 调用 resolveItemId | Phase 1.3、1.4 单测 | ✅ 闭环 |
| scoring-trigger-modes | parse-and-write-score 读取 trigger 校验 | Phase 1.5 集成测试 | ✅ 闭环 |

**结论**：无孤岛模块风险；各修改均在既有生产链路上。

#### 3.3.4 compute.ts「完整 run」定义与 plan 一致性

当前 `compute.ts` L48 注释：「implement 以 trigger_stage=speckit_5_2 计入」；L117 使用 `stages = new Set(runRecs.map((x) => x.stage))`。plan Phase 2 要求：
- stages = Set(records.map(r => r.stage))；|stages| >= 3
- stage=implement 的 record 直接计入；stage=tasks 且 trigger_stage=speckit_5_2 亦计入

**验证**：当前 compute.ts 的「完整 run」判定基于 `stages.size >= MIN_STAGES_COMPLETE_RUN`，stage 来自 `x.stage`。实施 Story 9.2 后，stage=implement 将作为独立 stage 出现在 Set 中，与 plan 一致。**通过**。

---

## 4. plan 内部一致性检查

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| §1 需求映射表与 Phase 1～3 对应 | 逐行对照 | ✅ 一致 |
| §5.1 修改文件表与 Phase 描述一致 | 10 个文件与 Phase 1.1～3 对应 | ✅ |
| §6 验收命令与 Phase 验收一致 | 8 行验收与 Phase 1.1～3 对应 | ✅ |
| Task 编号与 plan Phase 对应 | Task 1～6 与 Phase 1.1～1.6、2、3 映射 | ✅ |

---

## 5. 批判审计员专项检查

### 5.1 可操作性质疑

**质疑 1**：plan Phase 1.3 要求「implement 使用 implement-scoring.yaml 的 items、veto_items（通过 audit-item-mapping 的 implement 段衔接）」。若 audit-item-mapping.yaml 的 implement 段 checks 与 implement-scoring.yaml 的 items 名称不完全一致，parseGenericReport 在 stage='implement' 时如何正确解析？

**复核**：spec §3.3 已给出示例结构（func_correct、code_standards 等），plan Phase 1.4 要求「checks 与 implement-scoring.yaml 的 items 对应」。实施时需在 audit-item-mapping implement 段中显式建立映射。**可接受**：规格已指明对应关系，实施可执行。**本轮无新 gap。**

### 5.2 边界与遗漏质疑

**质疑 2**：plan Phase 2 仅写「仪表盘展示：按 stage 或 trigger_stage 区分 implement 与 tasks 的 phase_score」。当前 format.ts、formatDashboardMarkdown 是否已有「按 stage 展示」能力？若需修改 format 层，plan 是否遗漏？

**复核**：grep 显示 dashboard-generate 调用 formatDashboardMarkdown；compute.ts 提供 getDimensionScores、getWeakTop3 等。仪表盘「区分」可能通过 (1) compute 层在聚合时区分 implement/tasks 的 record，或 (2) format 层输出时标注。Story 9.2 的 AC-5 与 Task 4.2 要求「仪表盘输出能区分 implement 与 tasks 得分」，plan Phase 2 的「按 stage 或 trigger_stage 区分」涵盖该语义。若 format 层当前无 stage 维度的展示逻辑，实施 Task 4 时需在 format 或 compute 输出结构中增加该信息。**结论**：plan 将「展示区分」归于 Phase 2 修改 compute.ts 及「仪表盘展示」，未细化 format.ts 修改点。spec §3.4.2 仅写「按 stage 或 trigger_stage 区分」。建议在 tasks 细化时明确：若 format 需扩展，则增加相应子任务。**Minor 建议**，不构成 plan 级阻断。**本轮无新 gap。**

### 5.3 集成/E2E 覆盖质疑

**质疑 3**：plan §4.2 仪表盘部分仅列单测（getLatestRunRecordsV2、getWeakTop3），未列 dashboard-generate CLI 的 E2E。audit-prompts §2 要求「用户可见功能流程」覆盖。是否构成遗漏？

**复核**：用户可见流程为：`/bmad-dashboard` 或 `npx ts-node scripts/dashboard-generate.ts` 输出仪表盘。plan §4.3 有「compute.ts：dashboard-generate 调用...；验收：grep 确认 compute.ts 被 dashboard 入口导入」，这是**集成验证**（确认调用关系），非**功能 E2E**（从 CLI 执行到输出正确内容的端到端流程）。**结论**：存在「仅依赖单测 + grep 集成验证、缺少 CLI 功能 E2E」的**轻微缺口**。建议在 plan §4.2 或 §6 补充：给定含 stage=implement 的 scoring/data fixture，执行 `dashboard-generate --epic 9 --story 2` 后，输出文件中能区分 implement 与 tasks 的得分。**记作 Gap 1（建议级）**。

### 5.4 依赖与顺序质疑

**质疑 4**：Phase 1.4 的 audit-item-mapping 依赖 Phase 1.3 的 parseGenericReport 传入 stage='implement'。Phase 1.3 又依赖「implement 使用 implement-scoring.yaml」与 audit-item-mapping 的 implement 段。是否存在循环依赖？

**复核**：Phase 1.3 的职责是 parseGenericReport 在 stage='implement' 时加载 implement-scoring.yaml 与 audit-item-mapping 的 implement 段；Phase 1.4 的职责是提供 audit-item-mapping 的 implement 段。逻辑顺序应为：先有 implement 段（1.4）→ parseGenericReport 才能解析。plan 将 1.4 与 1.3 分开列出，实施时 1.4（audit-item-mapping.yaml + .ts）应先于 1.3 的 parseGenericReport 修改完成。**无循环**。**本轮无新 gap。**

### 5.5 speckit-workflow 路径质疑

**质疑 5**：plan Phase 3 写「定位：C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md 或项目内 _bmad 下」。原始需求 Task 5.1 写「skills/speckit-workflow/SKILL.md 或 ~/.cursor/skills/speckit-workflow/SKILL.md（项目内优先）」。plan 的「项目内 _bmad 下」与「项目内」是否一致？项目内可能为 `skills/speckit-workflow/` 或 `.cursor/skills/` 等。

**复核**：spec §3.5 写「skills/speckit-workflow/SKILL.md 或 ~/.cursor/skills/speckit-workflow/SKILL.md（项目内优先）」。plan 的「项目内 _bmad 下」可能指 `_bmad` 目录下若有 speckit-workflow 副本；通常 speckit-workflow 为 Cursor 全局 skills，项目内可能通过 .cursor/skills 或子模块引用。**结论**：plan 与 spec 的路径描述略有差异，但均为「项目内优先、全局备选」的语义。实施时按 spec 优先查找项目内路径即可。**不构成 gap**。**本轮无新 gap。**

### 5.6 批判审计员本轮结论

**Gap 汇总**：
- **Gap 1（建议级）**：plan §4.2 仪表盘部分未明确 dashboard-generate CLI 的 E2E 验收。建议在 §4.2 或 §6 补充该验收命令。

**其余质疑**：可操作性、format 层细化、依赖顺序、路径表述经复核均为可接受或已有覆盖，**无新 gap**。

---

## 6. 第二轮审计：Gap 1 修订验证（2026-03-06）

### 6.1 修订内容确认

| 修订位置 | 第一轮建议 | 修订后 plan 实际内容 | 验证结果 |
|----------|------------|----------------------|----------|
| plan §4.2 | 增加 dashboard-generate 集成/E2E 行 | 第 106 行：`\| 集成/E2E \| dashboard-generate 区分 implement 与 tasks \| npx ts-node scripts/dashboard-generate.ts --epic 9 --story 2 --strategy epic_story_window（scoring/data 含 stage=implement fixture） \| 输出能区分 implement 与 tasks 的 phase_score \|` | ✅ 完全符合 |
| plan §6 Phase 2 | 验收增加 E2E dashboard-generate 命令 | 第 152 行 Phase 2 验收命令含：单测 compute.ts fixture；E2E dashboard-generate --epic 9 --story 2；预期：聚合、短板正确；输出区分 implement 与 tasks | ✅ 已补充 |

### 6.2 Gap 1 闭环检查

| 检查项 | audit-prompts §2 要求 | 修订后 plan 覆盖 | 结果 |
|--------|------------------------|------------------|------|
| 用户可见功能流程 | 覆盖 dashboard 输出流程 | §4.2 集成/E2E 行明确 CLI 命令、fixture 条件、预期 | ✅ |
| 验收命令可执行 | 有明确 E2E 验收命令 | §6 Phase 2 含 `E2E dashboard-generate --epic 9 --story 2` | ✅ |
| 与 spec §3.4.2 一致 | 仪表盘输出能区分 implement 与 tasks | 预期「输出能区分 implement 与 tasks 的 phase_score」 | ✅ |

**结论**：Gap 1 已完全闭环。修订后的 plan-E9-S2.md 在 §4.2 与 §6 均已覆盖 dashboard-generate E2E 验收。

---

## 7. 结论

### 7.1 需求覆盖结论

| 维度 | 结果 |
|------|------|
| 原始需求 Story、Scope、AC、Tasks、Dev Notes | ✅ 完全覆盖 |
| spec-E9-S2 全部章节 | ✅ 完全覆盖 |
| plan 内部一致性 | ✅ 通过 |

### 7.2 集成/E2E 与孤岛风险结论

| 维度 | 结果 |
|------|------|
| parse-and-write-score 集成 + E2E | ✅ 已覆盖 |
| compute.ts 单测 | ✅ 已覆盖 |
| 仪表盘 CLI E2E（用户可见流程） | ✅ **Gap 1 已闭环**：plan §4.2、§6 均已补充 dashboard-generate E2E |
| 孤岛模块风险 | ✅ 无 |

### 7.3 最终结论

**是否「完全覆盖、验证通过」**：**完全覆盖、验证通过**。

- **通过项**：原始需求与 spec 全部章节在 plan 中已覆盖；parse-and-write-score 集成/E2E 计划完整；**dashboard-generate E2E 验收已在 §4.2 与 §6 Phase 2 补充**；无孤岛模块风险；Phase 与验收命令对应清晰。
- **Gap 1 已闭环**：修订后的 plan 在 §4.2 增加 `集成/E2E | dashboard-generate 区分 implement 与 tasks` 行，在 §6 Phase 2 增加 `E2E dashboard-generate --epic 9 --story 2` 验收命令，满足 audit-prompts §2「用户可见功能流程」覆盖要求。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 90/100
- 可追溯性: 93/100
