# Story 9.3: Epic 级仪表盘聚合

Status: ready-for-dev

## Story

**As a** 技术负责人（TechLead），  
**I want** 运行 `/bmad-dashboard --epic 9` 时看到 Epic 9 下所有 Story 的聚合健康度视图（总分、四维、短板），  
**so that** 多 Story 的 Epic 能有一页整体健康度概览，而不限于单 Story 视图。

## 实施范围说明

本 Story 实施同目录 **TASKS_9-3-epic-dashboard-aggregate.md**（或 `_orphan/TASKS_Epic级仪表盘聚合.md`）中的 **US-1.1～US-4.2**。

**共识方案**（Party-Mode 100 轮）：
- **聚合方式**：方案 A——对每个 Story 先算 `computeHealthScore`，再对 Story 总分做简单平均
- **不完整 Story**：排除（不计 0 分）；有排除时输出含「已排除：E{N}.S{x}（未达完整 run）」
- **CLI**：`--epic 9` = Epic 聚合；`--epic 9 --story 1` = 单 Story（story 优先时走单 Story）
- **strategy**：epic 过滤仅 `epic_story_window` 有效；`run_id` 时 `--epic` 被忽略

## Acceptance Criteria

| # | 需求 | 对应 US | 验收标准 |
|---|------|---------|----------|
| AC-1 | Epic 下多 Story 筛选 | US-1.1 | aggregateByEpicOnly 单测：E9.S1、E9.S2、E8.S1 中 epic=9 仅返回 E9.* |
| AC-2 | 各 Story 最新完整 run 聚合 | US-1.2 | getEpicAggregateRecords 单测：E9 有 S1、S2 各完整 run 返回 6 条；S3 仅 1 stage 不包含 |
| AC-3 | Epic 总分（Per-Story 简单平均） | US-1.3 | computeEpicHealthScore 单测：S1 80、S2 90 → Epic 85 |
| AC-4 | Epic 四维聚合 | US-1.4 | getEpicDimensionScores 单测：2 Story 各 2 维，断言合并与平均正确 |
| AC-5 | getLatestRunRecordsV2 epic-only 分支 | US-2.1 | epic != null && story == null 时调用 getEpicAggregateRecords |
| AC-6 | dashboard-generate --epic 9 | US-3.1 | `--epic 9 --strategy epic_story_window` 输出 Epic 9 聚合；无完整 Story 时提示「Epic N 下无完整 Story，暂无聚合数据」 |
| AC-7 | Epic 聚合视图标识与已排除列表 | US-3.2 | 输出含「Epic 9 聚合」；有排除 Story 时含「已排除」 |
| AC-8 | 单测与集成测试 | US-4.1, US-4.2 | compute-epic-aggregate.test.ts 通过；集成测试覆盖 epic 聚合、部分不完整、run_id 时 epic 忽略 |

## Tasks（引用 TASKS §7）

- [ ] **US-1.1** aggregateByEpicOnly 实现与单测
- [ ] **US-1.2** getEpicAggregateRecords 实现与单测
- [ ] **US-1.3** computeEpicHealthScore 实现与单测
- [ ] **US-1.4** getEpicDimensionScores 实现与单测
- [ ] **US-2.1** getLatestRunRecordsV2 epic-only 分支
- [ ] **US-3.1** dashboard-generate epic-only 调用路径
- [ ] **US-3.2** Epic 聚合视图标识（formatDashboardMarkdown）
- [ ] **US-4.1** Epic 聚合单测（compute-epic-aggregate.test.ts）
- [ ] **US-4.2** Epic 聚合 fixture 与集成测试

## 验收命令

```bash
npm run test:scoring -- scoring/dashboard
npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window --windowHours 168
grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md
```

## 依赖

- Story 9.1（getLatestRunRecordsV2、epic_story_window 策略已落地）

## Dev Notes

- **架构与约束**：沿用 scoring/dashboard 模块既有模式；`compute.ts` 负责聚合逻辑，`format.ts` 负责 Markdown 输出；复用 `parseEpicStoryFromRecord`、`groupByEpicStoryOrRunId` 等现有函数
- **涉及文件**：`scoring/dashboard/compute.ts`（aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores）、`scoring/dashboard/format.ts`（formatDashboardMarkdown 扩展）、`scripts/dashboard-generate.ts`（epic-only 分支）
- **测试**：`scoring/dashboard/__tests__/compute-epic-aggregate.test.ts` 新增；`npm run test:scoring -- scoring/dashboard` 必须全部通过

### Project Structure Notes

- `scoring/dashboard/`：compute.ts、format.ts、index.ts；`__tests__/` 下现有 compute.test.ts、format.test.ts，新增 compute-epic-aggregate.test.ts
- 与既有 `aggregateByEpicStoryTimeWindow`、`getLatestRunRecordsV2` 保持接口一致；不修改 RunScoreRecord 结构

## 参考

- **TASKS 文档**：同目录 `TASKS_9-3-epic-dashboard-aggregate.md`
- **原始 TASKS**：`_orphan/TASKS_Epic级仪表盘聚合.md`
- **审计报告**：AUDIT_TASKS_Epic级仪表盘聚合_第2～4轮（连续 3 轮无 gap 收敛）
- **[Source: TASKS_Epic级仪表盘聚合.md §1.3]** 关键代码：compute.ts、getLatestRunRecordsV2、RunScoreRecord

## Dev Agent Record

### Agent Model Used

（实施时填写）

### Debug Log References

（实施时填写）

### Completion Notes List

（实施时填写）

### File List

（实施时填写）
