# plan-E9-S3：Epic 级仪表盘聚合 实现方案

**Epic**：E9 feature-scoring-full-pipeline  
**Story ID**：9.3  
**输入**：spec-E9-S3.md、Story 9.3、TASKS_Epic级仪表盘聚合.md

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story | Epic 聚合健康度视图 | Phase 1～4 | ✅ |
| AC-1 | spec §3.1 | Phase 1.1 | ✅ |
| AC-2 | spec §3.2 | Phase 1.2 | ✅ |
| AC-3 | spec §3.3 | Phase 1.3 | ✅ |
| AC-4 | spec §3.4 | Phase 1.4 | ✅ |
| AC-5 | spec §3.5 | Phase 2 | ✅ |
| AC-6 | spec §3.6 | Phase 3.1 | ✅ |
| AC-7 | spec §3.7 | Phase 3.2 | ✅ |
| AC-8 | spec §4 | Phase 4 | ✅ |
| TASKS US-1.1～1.4 | spec §3.1～§3.4 | Phase 1 | ✅ |
| TASKS US-2.1 | spec §3.5 | Phase 2 | ✅ |
| TASKS US-3.1～3.2 | spec §3.6～§3.7 | Phase 3 | ✅ |
| TASKS US-4.1～4.2 | spec §4、§3.8 | Phase 4、Phase 3.3 | ✅ |

---

## 2. 目标与约束

- **Phase 1**：Epic 筛选与聚合核心逻辑（aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores）
- **Phase 2**：getLatestRunRecordsV2 epic-only 分支
- **Phase 3**：CLI 与仪表盘展示（dashboard-generate epic-only、formatDashboardMarkdown 扩展、CLI 文档化）
- **Phase 4**：单测与集成测试
- **必须包含**：集成测试与 E2E（Epic 聚合 CLI、部分不完整、run_id 时 epic 忽略）

**范围排除（与 spec §5、TASKS §4 一致）**：本 plan 不实施以下排除项——aggregateByBranch、时间衰减、方案 B（record 合并再算）、run_id 下 epic 过滤、Epic 自定义 Story 权重。

---

## 3. 实施分期

### Phase 1：Epic 筛选与聚合核心逻辑

#### Phase 1.1：aggregateByEpicOnly（US-1.1, AC-1）

1. **scoring/dashboard/compute.ts**：新增 `aggregateByEpicOnly(records, epicId, windowHours)`，筛选 epicId 匹配且 timestamp 在 windowHours 内的记录，复用 `parseEpicStoryFromRecord`
2. **验收**：单测 fixture 含 E9.S1、E9.S2、E8.S1，epic=9、windowHours=168 时仅返回 E9.*；与 aggregateByEpicStoryTimeWindow 在 epic+story 时结果一致

#### Phase 1.2：getEpicAggregateRecords（US-1.2, AC-2）

1. **scoring/dashboard/compute.ts**：新增 `getEpicAggregateRecords(records, epicId, windowHours)`：调用 aggregateByEpicOnly → 按 epic:story 分组 → 每组取最新完整 run（≥3 effective stage）→ 合并
2. **验收**：单测 E9 有 S1、S2 各一完整 run 返回 6 条；S3 仅 1 stage 不包含

#### Phase 1.3：computeEpicHealthScore（US-1.3, AC-3）

1. **scoring/dashboard/compute.ts**：新增 `computeEpicHealthScore(epicRecords)`：按 epic:story 分组 → 每组 computeHealthScore → Story 总分简单平均并四舍五入
2. **验收**：单测 S1 80、S2 90 → Epic 85；单 Story 等价于 computeHealthScore

#### Phase 1.4：getEpicDimensionScores（US-1.4, AC-4）

1. **scoring/dashboard/compute.ts**：新增 `getEpicDimensionScores(epicRecords)`：每 Story getDimensionScores → 同 dimension 做 Story 级简单平均
2. **验收**：单测 2 Story 各 2 维，断言合并与平均正确；单 Story 与 getDimensionScores 一致

### Phase 2：getLatestRunRecordsV2 扩展（US-2.1, AC-5）

1. **scoring/dashboard/compute.ts**：在 `getLatestRunRecordsV2` 中，当 `epic != null && story == null && strategy === 'epic_story_window'` 时，调用 `getEpicAggregateRecords(realDev, epic, windowHours)` 并返回
2. **约束**：strategy=run_id 时 epic 被忽略（保持现有分支）
3. **验收**：单测 getLatestRunRecordsV2(records, { strategy: 'epic_story_window', epic: 9, windowHours: 168 }) 仅含 E9；epic+story 时行为不变

### Phase 3：CLI 与仪表盘展示

#### Phase 3.1：dashboard-generate epic-only 调用路径（US-3.1, AC-6）

1. **scripts/dashboard-generate.ts**：当 `epic != null && story == null && strategy === 'epic_story_window'` 时，使用 `getEpicAggregateRecords` 获取 records，然后 `computeEpicHealthScore`、`getEpicDimensionScores` 计算；短板、高迭代、Veto、趋势沿用现有逻辑（基于 epicRecords）
2. **空数据**：Epic 下无完整 Story 时，输出「Epic N 下无完整 Story，暂无聚合数据」
3. **验收**：`npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window` 输出 Epic 9 聚合视图

#### Phase 3.2：Epic 聚合视图标识（US-3.2, AC-7）

1. **scoring/dashboard/format.ts**：`formatDashboardMarkdown` 扩展，接收可选 `viewMode`、`epicId`、`storyIds`、`excludedStories`；Epic 聚合时标题「# Epic {N} 聚合视图」、纳入 Story 列表、有排除时输出「已排除：E{N}.S{x}（未达完整 run）」
2. **scripts/dashboard-generate.ts**：调用 formatDashboardMarkdown 时传入上述参数
3. **验收**：`--epic 9` 时输出含「Epic 9」或「Epic 9 聚合视图」；有排除 Story 时含「已排除」

#### Phase 3.3：CLI 文档化（US-4.2 验收 3), spec §3.8）

1. **commands/bmad-dashboard.md** 或 **scripts/dashboard-generate.ts** 注释或相关文档：写明「epic/story 过滤仅 epic_story_window 有效」
2. **验收**：grep -r "epic_story_window\|epic.*过滤" commands/ scripts/dashboard-generate.ts 可查到

### Phase 4：测试（US-4.1, US-4.2, AC-8）

1. **scoring/dashboard/__tests__/compute-epic-aggregate.test.ts**：新增，覆盖 aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores
2. **集成测试**：fixture 含 E9.S1、E9.S2 多 Story；断言 (1) --epic 9 总分、四维、短板与预期一致；(2) 部分 Story 不完整（S3 仅 1 stage）排除且输出含「已排除：E9.S3（未达完整 run）」；(3) strategy=run_id 时 epic 忽略：--epic 9 --strategy run_id 与 --strategy run_id 输出一致
3. **验收**：`npm run test:scoring -- scoring/dashboard` 通过；集成测试三个场景覆盖

---

## 4. 集成测试与端到端功能测试计划（必须）

### 4.1 Epic 聚合核心逻辑

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | aggregateByEpicOnly | compute-epic-aggregate.test.ts | epic=9 仅返回 E9.* |
| 单元 | getEpicAggregateRecords | 同上 | 6 条（S1+S2 各完整 run）；S3 不完整 excluded |
| 单元 | computeEpicHealthScore | 同上 | S1 80、S2 90 → 85 |
| 单元 | getEpicDimensionScores | 同上 | 2 Story 维度合并与平均正确 |

### 4.2 getLatestRunRecordsV2 epic-only 分支

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | epic-only 分支 | compute.test.ts 或 compute-epic-aggregate.test.ts | epic=9、story=null 时仅含 E9 records |
| 单元 | epic+story 不变 | 同上 | epic=9、story=1 时行为与现有 aggregateByEpicStoryTimeWindow 一致 |
| 单元 | run_id 时 epic 忽略 | 同上 | strategy=run_id 时 epic 参数不生效 |

### 4.3 dashboard-generate 与 format E2E

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 集成/E2E | --epic 9 聚合 | `npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window` | 输出 Epic 9 聚合视图；总分、四维正确 |
| 集成/E2E | 无完整 Story | 同上（fixture 全不完整） | 输出「Epic N 下无完整 Story，暂无聚合数据」 |
| 集成/E2E | 已排除列表 | fixture 含 S3 仅 1 stage | 输出含「已排除：E9.S3（未达完整 run）」 |
| 集成/E2E | 单 Story 不变 | `--epic 9 --story 1 --strategy epic_story_window` | 与现有单 Story 视图一致 |

### 4.4 生产代码关键路径验证

- **compute.ts**：dashboard-generate 调用 getLatestRunRecordsV2；epic-only 时 getLatestRunRecordsV2 调用 getEpicAggregateRecords；验收：grep 确认 compute 被 dashboard-generate 导入
- **format.ts**：dashboard-generate 调用 formatDashboardMarkdown；验收：Epic 聚合时传入 viewMode、excludedStories 等
- **dashboard-generate.ts**：CLI 入口；epic-only 分支调用 computeEpicHealthScore、getEpicDimensionScores

---

## 5. 模块与文件改动设计

### 5.1 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| scoring/dashboard/compute.ts | 新增 aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores；修改 getLatestRunRecordsV2 | Phase 1、2 |
| scoring/dashboard/format.ts | formatDashboardMarkdown 扩展 viewMode、epicId、storyIds、excludedStories | Phase 3.2 |
| scripts/dashboard-generate.ts | epic-only 分支；调用 computeEpicHealthScore、getEpicDimensionScores；传入 format 扩展参数；空数据提示 | Phase 3.1、3.2 |
| commands/bmad-dashboard.md 或 scripts 注释 | 写明 epic/story 过滤仅 epic_story_window 有效 | Phase 3.3 |

### 5.2 新增文件

| 文件 | 责任 |
|------|------|
| scoring/dashboard/__tests__/compute-epic-aggregate.test.ts | Epic 聚合单测 |
| scoring/dashboard/__tests__/fixtures/epic-aggregate.ts 或内联 | Epic 聚合 fixture（E9.S1、E9.S2、E8.S1 等） |

---

## 6. 验收命令汇总

| Phase | 验收命令 | 预期 |
|-------|----------|------|
| 1 | `npm run test:scoring -- scoring/dashboard`（含 compute-epic-aggregate） | 通过 |
| 2 | 单测 getLatestRunRecordsV2 epic-only | 仅含 E9 records |
| 3.1 | `npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window --windowHours 168` | Epic 9 聚合输出 |
| 3.2 | `grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md` | 有匹配 |
| 3.3 | `grep -r "epic_story_window\|epic.*过滤" commands/ scripts/dashboard-generate.ts` | 有匹配 |
| 4 | 集成测试三个场景 | 通过 |

<!-- AUDIT: PASSED by code-reviewer -->
