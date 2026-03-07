# Spec E9-S3：Epic 级仪表盘聚合

*Story 9.3 技术规格*  
*Epic 9 feature-scoring-full-pipeline*

---

## 1. 概述

本 spec 将 Story 9.3（Epic 级仪表盘聚合）的实施范围固化为可执行技术规格，覆盖：

1. **Epic 下多 Story 筛选与聚合**：`aggregateByEpicOnly`、`getEpicAggregateRecords`
2. **Epic 总分与四维**：`computeEpicHealthScore`、`getEpicDimensionScores`（方案 A：Per-Story 后简单平均）
3. **getLatestRunRecordsV2 epic-only 分支**：`epic != null && story == null` 时调用 Epic 聚合
4. **CLI 与仪表盘展示**：`dashboard-generate --epic 9`、`formatDashboardMarkdown` 扩展

**输入来源**：

- Story 9.3（9-3-epic-dashboard-aggregate.md）
- TASKS_Epic级仪表盘聚合.md（§1～§7）
- scoring/dashboard/compute.ts、format.ts、scripts/dashboard-generate.ts

**依赖**：Story 9.1（getLatestRunRecordsV2、epic_story_window 策略已落地）。

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story | Epic 下多 Story 聚合健康度视图 | spec §1, §3 | ✅ |
| AC-1 | aggregateByEpicOnly 单测：E9.S1、E9.S2、E8.S1 中 epic=9 仅返回 E9.* | spec §3.1 | ✅ |
| AC-2 | getEpicAggregateRecords 单测：E9 有 S1、S2 各完整 run 返回 6 条；S3 仅 1 stage 不包含 | spec §3.2 | ✅ |
| AC-3 | computeEpicHealthScore 单测：S1 80、S2 90 → Epic 85 | spec §3.3 | ✅ |
| AC-4 | getEpicDimensionScores 单测：2 Story 各 2 维，断言合并与平均正确 | spec §3.4 | ✅ |
| AC-5 | getLatestRunRecordsV2 epic-only 分支 | spec §3.5 | ✅ |
| AC-6 | dashboard-generate --epic 9 输出 Epic 9 聚合 | spec §3.6 | ✅ |
| AC-7 | Epic 聚合视图标识与已排除列表 | spec §3.7 | ✅ |
| AC-8 | 单测与集成测试 | spec §4 | ✅ |
| TASKS §2.1 | 聚合方式：方案 A（Per-Story 后简单平均） | spec §3.3 | ✅ |
| TASKS §2.2 | 不完整 Story 排除（不计 0 分） | spec §3.2 | ✅ |
| TASKS §2.4 | CLI 语义：--epic 9 聚合，--epic 9 --story 1 单 Story | spec §3.5, §3.6 | ✅ |
| TASKS §2.5 | epic 过滤仅 epic_story_window 有效；run_id 时 epic 忽略 | spec §3.5 | ✅ |
| TASKS §2.6 | 仪表盘输出标识：Epic N 聚合视图、纳入 Story、已排除 | spec §3.7 | ✅ |
| TASKS US-4.2 验收 3) | CLI 文档或 bmad-dashboard 命令说明写明 epic/story 过滤仅 epic_story_window 有效 | spec §3.8 | ✅ |

---

## 3. 功能规格

### 3.1 aggregateByEpicOnly（AC-1）

| 项 | 规格 |
|------|------|
| 签名 | `aggregateByEpicOnly(records: RunScoreRecord[], epicId: number, windowHours: number): RunScoreRecord[]` |
| 逻辑 | 筛选 epicId 匹配且 timestamp 在 windowHours 内的记录；复用 `parseEpicStoryFromRecord` |
| 验收 | 单测：含 E9.S1、E9.S2、E8.S1 的 fixture，epic=9、windowHours=168 时仅返回 E9.* |
| 交叉验证 | 与 `aggregateByEpicStoryTimeWindow` 在 epic+story 时结果一致 |

### 3.2 getEpicAggregateRecords（AC-2）

| 项 | 规格 |
|------|------|
| 签名 | `getEpicAggregateRecords(records: RunScoreRecord[], epicId: number, windowHours: number): RunScoreRecord[]` |
| 逻辑 | 1) 调用 aggregateByEpicOnly 得候选；2) 按 epic:story 分组；3) 每组取「最新完整 run」（完整 run 定义：至少 3 个不同 effective stage，同 compute.ts 的 MIN_STAGES_COMPLETE_RUN 与 groupByEpicStoryOrRunId）；4) 合并各组 records 返回；**排除不完整 Story**（<3 stage） |
| 验收 | 单测：E9 有 S1、S2 各一完整 run，返回 6 条（3+3）；S3 仅有 1 stage 时不包含 S3 的 record |
| 依赖 | US-1.1 |

### 3.3 computeEpicHealthScore（AC-3，方案 A）

| 项 | 规格 |
|------|------|
| 签名 | `computeEpicHealthScore(epicRecords: RunScoreRecord[]): number` |
| 逻辑 | 1) 按 epic:story 分组；2) 每组用 `computeHealthScore` 得 Story 总分；3) 对 Story 总分做简单平均并四舍五入 |
| 验收 | 单测：S1 总分 80、S2 总分 90 → Epic 总分 85；单 Story 时等价于 computeHealthScore |
| 依赖 | US-1.2、computeHealthScore |

### 3.4 getEpicDimensionScores（AC-4）

| 项 | 规格 |
|------|------|
| 签名 | `getEpicDimensionScores(epicRecords: RunScoreRecord[]): DimensionEntry[]` |
| 逻辑 | 对每个 Story 先算 `getDimensionScores`，再对同 dimension 的分数做 Story 级简单平均 |
| 验收 | 单测：2 Story 各 2 维，断言维度合并与平均正确；单 Story 时与 getDimensionScores 一致 |
| 依赖 | US-1.3 |

### 3.5 getLatestRunRecordsV2 epic-only 分支（AC-5）

| 项 | 规格 |
|------|------|
| 修改位置 | `scoring/dashboard/compute.ts` 的 `getLatestRunRecordsV2` |
| 条件 | 当 `epic != null && story == null` 且 `strategy === 'epic_story_window'` 时 |
| 行为 | 调用 `getEpicAggregateRecords(realDev, epic, windowHours)` 并返回 |
| 约束 | `strategy=run_id` 时 `--epic` 被忽略 |
| 验收 | 单测：`getLatestRunRecordsV2(records, { strategy: 'epic_story_window', epic: 9, windowHours: 168 })` 仅含 E9 的 records；传 epic+story 时行为不变 |

### 3.6 dashboard-generate epic-only 调用路径（AC-6）

| 项 | 规格 |
|------|------|
| 修改位置 | `scripts/dashboard-generate.ts` |
| 条件 | `epic != null && story == null` 且 `strategy === 'epic_story_window'` |
| 行为 | 使用 `computeEpicHealthScore`、`getEpicDimensionScores` 计算 Epic 聚合数据；短板、高迭代、Veto、趋势沿用现有逻辑（基于 epicRecords） |
| 空数据 | Epic 下无完整 Story 时，输出「Epic N 下无完整 Story，暂无聚合数据」；等价提示需含「无完整 Story」「暂无聚合」或「Epic N」关键词 |
| 验收 | `npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window` 输出 Epic 9 聚合视图 |

### 3.7 Epic 聚合视图标识（AC-7）

| 项 | 规格 |
|------|------|
| 修改位置 | `scoring/dashboard/format.ts` 的 `formatDashboardMarkdown` |
| 扩展 | 接收可选 `viewMode: 'single_story' | 'epic_aggregate'`、`epicId?: number`、`storyIds?: number[]`、`excludedStories?: string[]` |
| Epic 聚合时 | 1) 标题为「# Epic {N} 聚合视图」或副标题「纳入 Story：E{N}.S{x}, ...」；2) 有被排除的不完整 Story 时，输出含「已排除：E{N}.S{x}（未达完整 run）」 |
| 验收 | `--epic 9` 时输出含「Epic 9」或「Epic 9 聚合」或「Epic 9 聚合视图」；有排除 Story 时输出含「已排除」 |

### 3.8 CLI 文档化（TASKS US-4.2 验收 3)）

| 项 | 规格 |
|------|------|
| 要求 | CLI 文档或 bmad-dashboard 命令说明中写明「epic/story 过滤仅 epic_story_window 有效」 |
| 验收 | `grep -r "epic_story_window\|epic.*过滤" commands/ scripts/dashboard-generate.ts 2>/dev/null` 或等价命令可查到该约定 |

---

## 4. 非功能需求

- **向后兼容**：单 Story 视图（`--epic 9 --story 1`）行为不变；不传参数或 strategy=run_id 行为不变
- **单测覆盖**：`scoring/dashboard/__tests__/compute-epic-aggregate.test.ts` 新增；`npm run test:scoring -- scoring/dashboard` 必须全部通过
- **集成测试**：覆盖 epic 聚合、部分不完整、run_id 时 epic 忽略三个场景

**验收命令**（与 TASKS §5 一致）：

```bash
npm run test:scoring -- scoring/dashboard
npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window --windowHours 168
grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md
npx ts-node scripts/dashboard-generate.ts --epic 9 --story 1 --strategy epic_story_window  # 单 Story 行为不变
# strategy=run_id 时 epic 忽略：--epic 9 --strategy run_id 与 --strategy run_id 输出一致（集成测试断言）
```

---

## 5. 范围排除（与 TASKS §4 一致）

| 项 | 说明 |
|----|------|
| aggregateByBranch | 不实现；与 Epic 聚合正交 |
| 时间衰减 | 不实现；统一 windowHours |
| 方案 B（record 合并再算） | 不实现 |
| run_id 下的 epic 过滤 | 不支持；epic 仅 epic_story_window 有效 |
| Epic 权重配置 | Story 简单平均；自定义 Story 权重 Deferred |

---

## 6. Reference Documents

- [Story 9.3](d:/Dev/BMAD-Speckit-SDD-Flow/_bmad-output/implementation-artifacts/epic-9-feature-scoring-full-pipeline/story-9-3-epic-dashboard-aggregate/9-3-epic-dashboard-aggregate.md)
- [TASKS_Epic级仪表盘聚合.md](d:/Dev/BMAD-Speckit-SDD-Flow/_bmad-output/implementation-artifacts/_orphan/TASKS_Epic级仪表盘聚合.md)
- [scoring/dashboard/compute.ts](d:/Dev/BMAD-Speckit-SDD-Flow/scoring/dashboard/compute.ts)

<!-- AUDIT: PASSED by code-reviewer -->
