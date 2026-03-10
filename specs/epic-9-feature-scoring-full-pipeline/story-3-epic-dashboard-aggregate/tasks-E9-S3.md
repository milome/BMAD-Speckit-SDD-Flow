# Tasks E9-S3：Epic 级仪表盘聚合

**Input**: spec-E9-S3.md、plan-E9-S3.md、IMPLEMENTATION_GAPS-E9-S3.md、Story 9.3、TASKS_Epic级仪表盘聚合.md  
**Prerequisites**: plan.md ✓、spec.md ✓、IMPLEMENTATION_GAPS.md ✓

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| US-1.1 | Story 9.3, spec, TASKS | §3.1, AC-1, GAP-1.1 | aggregateByEpicOnly 实现与单测 |
| US-1.2 | Story 9.3, spec, TASKS | §3.2, AC-2, GAP-1.2 | getEpicAggregateRecords 实现与单测 |
| US-1.3 | Story 9.3, spec, TASKS | §3.3, AC-3, GAP-1.3 | computeEpicHealthScore 实现与单测 |
| US-1.4 | Story 9.3, spec, TASKS | §3.4, AC-4, GAP-1.4 | getEpicDimensionScores 实现与单测 |
| US-2.1 | Story 9.3, spec, TASKS | §3.5, AC-5, GAP-2.1 | getLatestRunRecordsV2 epic-only 分支 |
| US-3.1 | Story 9.3, spec, TASKS | §3.6, AC-6, GAP-3.1 | dashboard-generate epic-only 调用路径 |
| US-3.2 | Story 9.3, spec, TASKS | §3.7, AC-7, GAP-3.2 | Epic 聚合视图标识（formatDashboardMarkdown） |
| US-3.3 | spec, TASKS US-4.2 验收 3) | §3.8, GAP-3.3 | CLI 文档化 |
| US-4.1 | Story 9.3, spec, TASKS | §4, AC-8, GAP-4.1 | Epic 聚合单测（compute-epic-aggregate.test.ts） |
| US-4.2 | Story 9.3, spec, TASKS | §4, AC-8, GAP-4.2 | Epic 聚合 fixture 与集成测试 |

---

## 2. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| §3.1 | GAP-1.1 | ✓ 有 | US-1.1 |
| §3.2 | GAP-1.2 | ✓ 有 | US-1.2 |
| §3.3 | GAP-1.3 | ✓ 有 | US-1.3 |
| §3.4 | GAP-1.4 | ✓ 有 | US-1.4 |
| §3.5 | GAP-2.1 | ✓ 有 | US-2.1 |
| §3.6～§3.8 | GAP-3.1～3.3 | ✓ 有 | US-3.1～US-3.3 |
| §4 | GAP-4.1～4.2 | ✓ 有 | US-4.1～US-4.2 |

---

## Phase 1：Epic 筛选与聚合核心逻辑（US-1.1～US-1.4）

### US-1.1 [ ] aggregateByEpicOnly 实现与单测（GAP-1.1）

- **修改**：`scoring/dashboard/compute.ts`
- **内容**：新增 `aggregateByEpicOnly(records, epicId, windowHours)`，筛选 epicId 匹配且 timestamp 在 windowHours 内，复用 `parseEpicStoryFromRecord`
- **验收**：单测 fixture 含 E9.S1、E9.S2、E8.S1，epic=9、windowHours=168 时仅返回 E9.*；与 aggregateByEpicStoryTimeWindow 在 epic+story 时结果一致
- **集成验证**：该函数被 getEpicAggregateRecords 调用，最终由 dashboard-generate epic-only 路径使用

### US-1.2 [ ] getEpicAggregateRecords 实现与单测（GAP-1.2）

- **修改**：`scoring/dashboard/compute.ts`
- **内容**：新增 `getEpicAggregateRecords(records, epicId, windowHours)`：调用 aggregateByEpicOnly → 按 epic:story 分组 → 每组取最新完整 run（≥3 effective stage）→ 合并；排除不完整 Story
- **验收**：单测 E9 有 S1、S2 各一完整 run 返回 6 条；S3 仅 1 stage 不包含
- **集成验证**：该函数被 getLatestRunRecordsV2 epic-only 分支调用

### US-1.3 [ ] computeEpicHealthScore 实现与单测（GAP-1.3）

- **修改**：`scoring/dashboard/compute.ts`
- **内容**：新增 `computeEpicHealthScore(epicRecords)`：按 epic:story 分组 → 每组 computeHealthScore → Story 总分简单平均并四舍五入
- **验收**：单测 S1 80、S2 90 → Epic 85；单 Story 等价于 computeHealthScore
- **集成验证**：该函数被 dashboard-generate epic-only 路径调用

### US-1.4 [ ] getEpicDimensionScores 实现与单测（GAP-1.4）

- **修改**：`scoring/dashboard/compute.ts`
- **内容**：新增 `getEpicDimensionScores(epicRecords)`：每 Story getDimensionScores → 同 dimension 做 Story 级简单平均
- **验收**：单测 2 Story 各 2 维，断言合并与平均正确；单 Story 与 getDimensionScores 一致
- **集成验证**：该函数被 dashboard-generate epic-only 路径调用

---

## Phase 2：getLatestRunRecordsV2 扩展（US-2.1）

### US-2.1 [ ] getLatestRunRecordsV2 epic-only 分支（GAP-2.1）

- **修改**：`scoring/dashboard/compute.ts` 的 `getLatestRunRecordsV2`
- **内容**：当 `epic != null && story == null && strategy === 'epic_story_window'` 时，调用 `getEpicAggregateRecords(realDev, epic, windowHours)` 并返回
- **验收**：单测 getLatestRunRecordsV2(records, { strategy: 'epic_story_window', epic: 9, windowHours: 168 }) 仅含 E9 records；epic+story 时行为不变；strategy=run_id 时 epic 忽略
- **集成验证**：dashboard-generate --epic 9 时通过 getLatestRunRecordsV2 获取 epicRecords，该分支为生产代码关键路径

---

## Phase 3：CLI 与仪表盘展示（US-3.1～US-3.3）

### US-3.1 [ ] dashboard-generate epic-only 调用路径（GAP-3.1）

- **修改**：`scripts/dashboard-generate.ts`
- **内容**：当 `epic != null && story == null && strategy === 'epic_story_window'` 时，使用 getEpicAggregateRecords 获取 records，computeEpicHealthScore、getEpicDimensionScores 计算；短板、高迭代、Veto、趋势沿用现有逻辑；Epic 下无完整 Story 时输出「Epic N 下无完整 Story，暂无聚合数据」
- **验收**：`npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window` 输出 Epic 9 聚合视图；空数据时输出约定提示
- **集成验证**：CLI 为生产入口；epic-only 分支为关键路径

### US-3.2 [ ] Epic 聚合视图标识（formatDashboardMarkdown）（GAP-3.2）

- **修改**：`scoring/dashboard/format.ts`、`scripts/dashboard-generate.ts`
- **内容**：formatDashboardMarkdown 扩展 viewMode、epicId、storyIds、excludedStories；Epic 聚合时标题「# Epic {N} 聚合视图」、纳入 Story 列表、有排除时输出「已排除：E{N}.S{x}（未达完整 run）」；dashboard-generate 调用时传入上述参数
- **验收**：`--epic 9` 时输出含「Epic 9」或「Epic 9 聚合视图」；有排除 Story 时含「已排除」
- **集成验证**：formatDashboardMarkdown 被 dashboard-generate 调用，Epic 聚合时为关键路径

### US-3.3 [ ] CLI 文档化（GAP-3.3）

- **修改**：`commands/bmad-dashboard.md` 或 `scripts/dashboard-generate.ts` 注释
- **内容**：写明「epic/story 过滤仅 epic_story_window 有效」
- **验收**：`grep -r "epic_story_window\|epic.*过滤" commands/ scripts/dashboard-generate.ts` 可查到
- **集成验证**：N/A（文档任务）

---

## Phase 4：测试（US-4.1～US-4.2）

### US-4.1 [ ] Epic 聚合单测（compute-epic-aggregate.test.ts）（GAP-4.1）

- **新增**：`scoring/dashboard/__tests__/compute-epic-aggregate.test.ts`
- **内容**：覆盖 aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores
- **验收**：`npm run test:scoring -- scoring/dashboard` 通过
- **集成验证**：单测验证 compute.ts 新增函数；通过后由 Phase 2、3 集成测试验证生产路径

### US-4.2 [ ] Epic 聚合 fixture 与集成测试（GAP-4.2）

- **新增/扩展**：fixture 含 E9.S1、E9.S2 多 Story；集成测试
- **内容**：集成测试断言：(1) --epic 9 时总分、四维、短板与预期一致；(2) 部分 Story 不完整（S3 仅 1 stage）排除且输出含「已排除：E9.S3（未达完整 run）」；(3) strategy=run_id 时 epic 忽略：--epic 9 --strategy run_id 与 --strategy run_id 输出一致；(4) **无完整 Story**：fixture 中 Epic 下 0 个完整 Story 时，输出含「Epic N 下无完整 Story，暂无聚合数据」；(5) **单 Story 不变**：--epic 9 --story 1 --strategy epic_story_window 与现有单 Story 视图一致
- **验收**：集成测试通过；五个场景覆盖
- **集成验证**：E2E 验证 dashboard-generate --epic 9 在生产代码关键路径上工作正常

---

## 3. 集成测试与 E2E 任务（必须）

| 任务 | 测试类型 | 验收 |
|------|----------|------|
| US-1.1～1.4 | 单元 | 各函数单测通过 |
| US-2.1 | 单元 | getLatestRunRecordsV2 epic-only 单测通过 |
| US-3.1 | 集成/E2E | dashboard-generate --epic 9 输出 Epic 9 聚合 |
| US-3.2 | 集成/E2E | 输出含 Epic 聚合标识、已排除列表 |
| US-4.1 | 单元 | compute-epic-aggregate.test.ts 通过 |
| US-4.2 | 集成/E2E | 五场景（epic 聚合、部分不完整、run_id 忽略、无完整 Story、单 Story 不变）通过 |
| plan §4.4 | 生产路径 | grep 确认 compute 被 dashboard-generate 导入；epic-only 路径被调用 |

---

## 4. 验收表头（按 GAP 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|--------------|----------|----------|
| GAP-1.1 | US-1.1 | aggregateByEpicOnly | 单测 + 被 getEpicAggregateRecords 调用 | [ ] | [ ] |
| GAP-1.2 | US-1.2 | getEpicAggregateRecords | 单测 + 被 getLatestRunRecordsV2 调用 | [ ] | [ ] |
| GAP-1.3 | US-1.3 | computeEpicHealthScore | 单测 + 被 dashboard-generate 调用 | [ ] | [ ] |
| GAP-1.4 | US-1.4 | getEpicDimensionScores | 单测 + 被 dashboard-generate 调用 | [ ] | [ ] |
| GAP-2.1 | US-2.1 | getLatestRunRecordsV2 epic-only | 单测 + dashboard-generate E2E | [ ] | [ ] |
| GAP-3.1 | US-3.1 | dashboard-generate epic-only | CLI E2E | [ ] | [ ] |
| GAP-3.2 | US-3.2 | formatDashboardMarkdown 扩展 | CLI 输出验证 | [ ] | [ ] |
| GAP-3.3 | US-3.3 | CLI 文档化 | grep 验证 | [ ] | [ ] |
| GAP-4.1 | US-4.1 | compute-epic-aggregate.test.ts | npm run test:scoring | [ ] | [ ] |
| GAP-4.2 | US-4.2 | fixture + 集成测试 | 五场景 E2E | [ ] | [ ] |

---

## 5. 验收命令汇总

```bash
npm run test:scoring -- scoring/dashboard
npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window --windowHours 168
grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md
npx ts-node scripts/dashboard-generate.ts --epic 9 --story 1 --strategy epic_story_window
grep -r "epic_story_window\|epic.*过滤" commands/ scripts/dashboard-generate.ts
```

<!-- AUDIT: PASSED by code-reviewer -->
