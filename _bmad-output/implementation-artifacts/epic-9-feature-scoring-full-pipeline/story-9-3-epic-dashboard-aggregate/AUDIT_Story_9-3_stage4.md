# Story 9-3 实施后审计报告（§5）

**Story**：9.3 Epic 级仪表盘聚合  
**审计类型**：audit-prompts §5 执行 tasks 后审计  
**审计日期**：2026-03-07  
**审计依据**：Story 文档、spec/plan/GAPS/tasks、prd/progress、实施产出

---

## 1. 需求与实现逐条对照

### 1.1 Story / spec / plan / GAPS 覆盖

| 需求章节 | 需求要点 | 实施状态 | 验证方式 |
|----------|----------|----------|----------|
| spec §3.1 AC-1 | aggregateByEpicOnly | ✅ | compute.ts L35-46；compute-epic-aggregate.test.ts 覆盖 |
| spec §3.2 AC-2 | getEpicAggregateRecords | ✅ | compute.ts L48-84；单测 S1+S2 6 条、S3 排除 |
| spec §3.3 AC-3 | computeEpicHealthScore | ✅ | compute.ts L86-105；单测 S1 80+S2 90→85 |
| spec §3.4 AC-4 | getEpicDimensionScores | ✅ | compute.ts L107-150；单测 2 Story 维度平均 |
| spec §3.5 AC-5 | getLatestRunRecordsV2 epic-only | ✅ | compute.ts L220-222；单测 epic=9 仅 E9、run_id 忽略 |
| spec §3.6 AC-6 | dashboard-generate epic-only | ✅ | dashboard-generate.ts L84-88, 108-116；CLI 输出 Epic 聚合 |
| spec §3.7 AC-7 | formatDashboardMarkdown 扩展 | ✅ | format.ts L21-48；输出「Epic N 聚合视图」「已排除」 |
| spec §3.8 | CLI 文档化 | ✅ | commands/bmad-dashboard.md L15；scripts/dashboard-generate.ts L4 |
| spec §4 AC-8 | 单测与集成测试 | ✅ | compute-epic-aggregate.test.ts 11 项；dashboard-epic-aggregate.test.ts 7 项 |
| GAP-1.1～4.2 | 全部 GAP | ✅ | 逐项已实现 |

### 1.2 架构与范围遵从

- **架构**：沿用 scoring/dashboard 既有模式；compute.ts 聚合逻辑，format.ts Markdown 输出；复用 parseEpicStoryFromRecord、groupByEpicStoryOrRunId。✅
- **范围排除**：未实现 aggregateByBranch、时间衰减、方案 B、run_id 下 epic 过滤、Epic 权重。✅
- **共识方案**：方案 A（Per-Story 后简单平均）；不完整 Story 排除；CLI 语义 `--epic 9` 聚合、`--epic 9 --story 1` 单 Story。✅

---

## 2. 集成测试与端到端验证

### 2.1 已执行测试

| 测试类型 | 文件/入口 | 覆盖内容 | 结果 |
|----------|-----------|----------|------|
| 单元 | compute-epic-aggregate.test.ts | aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores、getLatestRunRecordsV2 epic-only | 11 passed |
| 集成 | dashboard-epic-aggregate.test.ts | (1) --epic 9 总分/四维/短板；(2) 部分不完整 excludedStories 含 E9.S3；(3) run_id 时 epic 忽略；(4) 无完整 Story 返回空；(5) CLI 无完整输出「Epic N 下无完整 Story」；(6) CLI epic 聚合输出含 Epic 9 聚合、已排除；(7) 单 Story --epic 9 --story 1 行为 | 7 passed |
| E2E | `npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window` | 实际 CLI 调用 | 输出 Epic 9 聚合视图 |

验收命令执行结果：
- `npm run test:scoring -- scoring/dashboard`：384 passed（含 scoring/dashboard 与 integration）✅
- `npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window --windowHours 168`：输出 Epic 9 聚合视图 ✅
- `grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md`：有匹配 ✅
- `grep -r "epic_story_window\|epic.*过滤" commands/ scripts/dashboard-generate.ts`：commands/bmad-dashboard.md、scripts/dashboard-generate.ts 可查到 ✅

---

## 3. 生产代码关键路径与孤岛检查

| 模块 | 导入位置 | 调用链 | 孤岛风险 |
|------|----------|--------|----------|
| compute.ts | dashboard-generate.ts L12-27 | getLatestRunRecordsV2 → getEpicAggregateRecords；computeEpicHealthScore、getEpicDimensionScores 在 epic-only 分支被调用 | 无 |
| format.ts | dashboard-generate.ts L26 | formatDashboardMarkdown 在 epic-only 时传入 viewMode、epicId、storyIds、excludedStories | 无 |
| aggregateByEpicOnly | dashboard-generate.ts L24、L127 | epic-only 时计算 excludedStories | 无 |

所有新增函数均在 CLI 关键路径中被导入并调用，无孤岛模块。

---

## 4. ralph-method 追踪

### 4.1 prd / progress 存在性

- `prd.tasks-E9-S3.json`：已创建 ✅
- `progress.tasks-E9-S3.txt`：已创建 ✅
- 每 US 有更新：prd 中 10 个 US 均为 passes=true ✅

### 4.2 TDD 三项标记（涉及生产代码的 US）

| US | 涉及生产代码 | progress 中 [TDD-RED] | [TDD-GREEN] | [TDD-REFACTOR] | 结论 |
|----|--------------|------------------------|-------------|----------------|------|
| US-1.1～1.4 | compute.ts | ✅ 有（与 US-2.1 同段） | ✅ 有 | ✅ 有 | 通过 |
| US-2.1 | compute.ts | ✅ 有 | ✅ 有 | ✅ 有 | 通过 |
| US-3.1 | dashboard-generate.ts | ❌ 无 | ❌ 无 | ❌ 无 | **未通过** |
| US-3.2 | format.ts、dashboard-generate.ts | ❌ 无 | ❌ 无 | ❌ 无 | **未通过** |
| US-3.3 | 文档 | N/A | N/A | N/A | — |
| US-4.1 | 单测文件 | 测试代码 | — | — | 非生产代码 US |
| US-4.2 | 集成测试 | 测试代码 | — | — | 非生产代码 US |

progress.tasks-E9-S3.txt 当前内容：
```
US-3.1~3.3 dashboard-generate epic-only、format 扩展、CLI 文档化 ✓
```
该段落**无** [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 任一项。

audit-prompts §5 明确要求：「涉及生产代码的**每个 US** 须在其对应段落内各含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 至少一行」「审计不得豁免：不得以『tasks 规范』『可选』『可后续补充』『非 §5 阻断』为由豁免 TDD 三项检查；涉及生产代码的 US 缺任一项即判未通过」。

US-3.1、US-3.2 均涉及生产代码（dashboard-generate.ts、format.ts），缺 TDD 三项标记，**判未通过**。

---

## 5. §5 专项检查 (5)～(8)（本 Story 适用性）

- (5) branch_id、call_mapping、scoring_write_control：本 Story 为仪表盘聚合，不涉及审计报告评分写入流程。**N/A**
- (6) parseAndWriteScore 参数证据：同上。**N/A**
- (7) scenario=eval_question、question_version：同上。**N/A**
- (8) 评分写入失败 non_blocking：同上。**N/A**

---

## 6. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、TDD 未执行、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：已逐条对照 Story、spec、plan、GAPS、tasks，US-1.1～US-4.2 均已在代码中实现。aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores、getLatestRunRecordsV2 epic-only 分支、dashboard-generate epic-only 路径、formatDashboardMarkdown 扩展、CLI 文档化、单测与集成测试均覆盖。无遗漏。

- **边界未定义**：完整 run 定义（≥3 effective stage）在 compute.ts MIN_STAGES_COMPLETE_RUN 中实现；不完整 Story 排除逻辑正确；windowHours 时间窗口、epic/story 过滤策略与 spec 一致。无边界缺口。

- **验收不可执行**：验收命令 `npm run test:scoring -- scoring/dashboard`、`npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window`、`grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md`、`grep -r "epic_story_window\|epic.*过滤"` 均已执行且通过。无不可验证项。

- **与前置文档矛盾**：实现与 spec §3.1～§3.8、plan Phase 1～4、GAPS、tasks 一致。无矛盾。

- **孤岛模块**：compute.ts、format.ts 均被 dashboard-generate.ts 导入并调用；epic-only 分支为 CLI 关键路径。无孤岛。

- **伪实现/占位**：未发现 TODO、占位、假完成。实现为完整逻辑。

- **TDD 未执行**：**未通过**。US-3.1（dashboard-generate epic-only）、US-3.2（formatDashboardMarkdown 扩展）涉及生产代码，progress 中对应段落仅有「US-3.1~3.3 … ✓」，无 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 任一项。§5 要求涉及生产代码的每个 US 须含 TDD 三项，且审计不得豁免。缺项即判未通过。

- **行号/路径漂移**：报告引用的 compute.ts、format.ts、dashboard-generate.ts 路径与实现一致；集成测试位于 scoring/__tests__/integration/dashboard-epic-aggregate.test.ts，与 plan §4、tasks US-4.2 描述一致。fixture 路径 __fixtures-epic-aggregate、__fixtures-epic-no-complete 存在且被引用。无漂移。

- **验收一致性**：已执行验收命令，单元测试 384 通过、CLI 输出含「Epic 9 聚合视图」「已排除」、grep 可查到 epic_story_window/过滤约定。结果与宣称一致。

**本轮结论**：本轮存在 gap。具体项：1) US-3.1、US-3.2 涉及生产代码，progress 中缺 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 至少各一行，违反 audit-prompts §5 与 ralph-method 要求；审计不得豁免。不计数，修复后重新发起审计。

---

## 7. 结论

**未通过**。原因：ralph-method TDD 三项标记未满足——US-3.1、US-3.2 涉及生产代码修改，progress.tasks-E9-S3.txt 中其对应段落未包含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]，违反 §5 强制要求。

需求覆盖、架构遵从、集成/E2E 测试、生产路径与孤岛检查均通过，唯 TDD 追踪不完整导致未通过。

**修复建议**：在 progress.tasks-E9-S3.txt 中为 US-3.1、US-3.2 分别补充含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 的段落（可写「无需重构 ✓」），满足逐 US TDD 三项要求后重新发起 §5 审计。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: C

维度评分:
- 需求完整性: 95/100
- 可测试性: 90/100
- 一致性: 88/100
- 可追溯性: 72/100
