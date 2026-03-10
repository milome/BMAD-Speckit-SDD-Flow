# IMPLEMENTATION_GAPS-E9-S3：Epic 级仪表盘聚合

**Epic**：E9 feature-scoring-full-pipeline  
**Story**：9.3  
**输入**：spec-E9-S3.md、plan-E9-S3.md、Story 9.3、TASKS_Epic级仪表盘聚合.md、当前实现（scoring/dashboard/compute.ts、format.ts、scripts/dashboard-generate.ts）

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.1, AC-1 | GAP-1.1 | aggregateByEpicOnly(records, epicId, windowHours) | 未实现 | compute.ts 仅有 aggregateByEpicStoryTimeWindow（epic+story），无 epic-only 筛选函数 |
| spec §3.2, AC-2 | GAP-1.2 | getEpicAggregateRecords(records, epicId, windowHours) | 未实现 | 无按 Story 分组取最新完整 run 并合并的逻辑 |
| spec §3.3, AC-3 | GAP-1.3 | computeEpicHealthScore(epicRecords) | 未实现 | 仅有 computeHealthScore（单 run），无 Per-Story 后简单平均 |
| spec §3.4, AC-4 | GAP-1.4 | getEpicDimensionScores(epicRecords) | 未实现 | 仅有 getDimensionScores（单 run），无 Story 级维度平均 |
| spec §3.5, AC-5 | GAP-2.1 | getLatestRunRecordsV2 epic-only 分支 | 未实现 | getLatestRunRecordsV2 在 epic!=null && story==null 时走「全库 best run」分支，epic 被忽略；无调用 getEpicAggregateRecords |
| spec §3.6, AC-6 | GAP-3.1 | dashboard-generate epic-only 调用路径 | 未实现 | 无 epic-only 分支；未调用 computeEpicHealthScore、getEpicDimensionScores；无空数据提示 |
| spec §3.7, AC-7 | GAP-3.2 | formatDashboardMarkdown 扩展 | 未实现 | formatDashboardMarkdown 无 viewMode、epicId、storyIds、excludedStories；无 Epic 聚合标题、已排除列表 |
| spec §3.8 | GAP-3.3 | CLI 文档化「epic/story 过滤仅 epic_story_window 有效」 | 未实现 | commands/、scripts 中未查到该约定 |
| spec §4, AC-8 | GAP-4.1 | compute-epic-aggregate.test.ts | 未实现 | scoring/dashboard/__tests__/ 下无 compute-epic-aggregate.test.ts |
| spec §4 | GAP-4.2 | Epic 聚合 fixture 与集成测试 | 未实现 | 无 E9.S1、E9.S2 多 Story fixture；无集成测试覆盖 epic 聚合、部分不完整、run_id 时 epic 忽略 |

---

## 2. 需求映射清单（Gaps ↔ spec/plan）

| Gap ID | spec 章节 | plan 对应 | 覆盖状态 |
|--------|----------|----------|----------|
| GAP-1.1～1.4 | §3.1～§3.4 | Phase 1 | ✅ |
| GAP-2.1 | §3.5 | Phase 2 | ✅ |
| GAP-3.1～3.3 | §3.6～§3.8 | Phase 3 | ✅ |
| GAP-4.1～4.2 | §4 | Phase 4 | ✅ |

---

## 3. plan §4 集成测试与 E2E 计划 ↔ 当前实现

| plan §4 测试项 | 当前实现状态 | 缺失/偏差说明 |
|----------------|-------------|---------------|
| §4.1 Epic 聚合核心逻辑单测 | 未实现 | 无 compute-epic-aggregate.test.ts |
| §4.2 getLatestRunRecordsV2 epic-only 单测 | 未实现 | getLatestRunRecordsV2 无 epic-only 分支，无法单测 |
| §4.3 dashboard-generate E2E（--epic 9、无完整 Story、已排除、单 Story） | 未实现 | epic-only 路径未打通 |
| §4.4 生产代码关键路径验证 | 部分 | compute、format 已有生产入口；epic-only 路径未打通 |

---

## 4. spec §4 非功能需求 ↔ 实现状态

| 非功能需求 | 实现状态 | 说明 |
|------------|----------|------|
| 向后兼容 | 部分 | 单 Story、run_id 现有逻辑不变；epic-only 为新增路径 |
| 单测覆盖 | 未实现 | 需 Phase 1～4 实施后补齐 |
| 集成测试 | 未实现 | 需 fixture 与 Phase 3、4 实施后补齐 |

---

## 5. 范围排除（与 spec §5、TASKS §4 一致）

以下项**不实施**：aggregateByBranch、时间衰减、方案 B（record 合并再算）、run_id 下 epic 过滤、Epic 自定义 Story 权重。

Deferred（TASKS §6）：DG-1～DG-4（时间衰减、方案 B 可选视图、Story 权重、run_id 下 epic 预过滤）。

---

## 6. 实施优先级（依赖顺序）

1. **Phase 1**：GAP-1.1～1.4（aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores）
2. **Phase 2**：GAP-2.1（getLatestRunRecordsV2 epic-only 分支）——依赖 GAP-1.2
3. **Phase 3**：GAP-3.1～3.3（dashboard-generate epic-only、format 扩展、CLI 文档化）——依赖 Phase 2
4. **Phase 4**：GAP-4.1～4.2（compute-epic-aggregate.test.ts、fixture、集成测试）

<!-- AUDIT: PASSED by code-reviewer -->
