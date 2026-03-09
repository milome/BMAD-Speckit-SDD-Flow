# TASKS：Epic 级仪表盘聚合

**产出日期**：2026-03-06  
**议题来源**：Party-Mode 100 轮辩论（批判审计员发言占比 >70%，最后 3 轮无新 gap 收敛）  
**路径**：`_bmad-output/implementation-artifacts/_orphan/TASKS_Epic级仪表盘聚合.md`

---

## §1 议题与背景

### 1.1 现状

- `dashboard-generate` 支持：`--epic N --story M`（单 Story 视图）或 不传参数（取「最新完整 run」）
- **缺失能力**：Epic 有多个 Story 时，无法查看 Epic 整体聚合视图
- **当前实现 gap**：传 `--epic N` 不传 story 时，`getLatestRunRecordsV2` 的 `else` 分支遍历**全库** `groupedByEpicStory`，epic 参数被忽略，返回任意 epic 的最新完整 run

### 1.2 待决策

1. **筛选语义**：仅传 `--epic N` 时，筛出 Epic N 下所有 Story 的评分记录
2. **聚合方式**（方案 A vs B）：
   - **方案 A**：对每个 Story 先算各自总分，再对 Story 做简单平均（或加权平均）
   - **方案 B**：把所有 record 合并后再算总分和四维（把多 Story 当成一个大 run）

### 1.3 关键代码与数据

- `scoring/dashboard/compute.ts`：`aggregateByEpicStoryTimeWindow(records, epicId, storyId, windowHours)` 目前仅支持 epic+story
- `getLatestRunRecordsV2`：epic&&story 时调用上述函数；epic 或 story 缺一时，epic 被忽略
- `computeHealthScore` / `getDimensionScores`：接收 `RunScoreRecord[]`，计算总分与四维
- `parseEpicStoryFromRecord`：从 run_id 或 source_path 解析 epicId、storyId
- `RunScoreRecord`：含 run_id、stage、timestamp、phase_score、phase_weight、dimension_scores 等

---

## §2 共识方案概述（含聚合方式选定及理由）

### 2.1 聚合方式：采用方案 A（Per-Story 后简单平均）

**选定**：**方案 A**——对每个 Story 先算 `computeHealthScore(records_S)`，再对 Story 总分做**简单平均**。

**理由**：

| 维度 | 批判审计员质疑 | 共识结论 |
|------|----------------|----------|
| **数学等价性** | A 与 B 何时不同？ | 当各 Story 的 phase_weight 分布不同时，B 会将「stage 数多」的 Story 权重放大；A 保证「每个 Story 作为交付单元等权」 |
| **权重来源** | 方案 B 的 record 级权重来自 phase_weight，多 Story 合并后由 stage 数量隐性加权 | John：Epic 视图应反映「每个 Story 是否健康」，而非「数据多的 Story 主导」；A 符合「Epic = Story 集合」的产品语义 |
| **可解释性** | 用户如何理解 Epic 总分？ | Winston：简单平均易于解释——「Epic 9 总分 = E9 下各 Story 总分的平均」；B 难以向 PM 解释为何某 Story 权重大 |
| **与现有短板逻辑一致** | getWeakTop3EpicStory 已按 Story 聚合 | Amelia：短板按 Story 最低分取，与 A 的「Story 为原子单元」一致；B 会引入 record 级混合，与短板语义脱节 |

**反证（若 X 不成立则结论无效）**：若产品需求为「Epic 总分反映整体工作量投入」，则 B 更合适；经 John 确认，当前需求为「Epic 健康度 = 各 Story 健康度的综合」，故 A 成立。

### 2.2 部分 Story 无完整 run（<3 stage）的处理

**共识**：**排除**不完整 Story，不计入 Epic 聚合；**不计 0 分**（避免人为拉低）。

- 批判审计员：计入 0 分会惩罚「进行中 Story」；排除则仅对「至少 1 个完整 Story」的 Epic 有意义
- 收敛：排除 + 在输出中可选标明「已排除 E9.S3（未达完整 run）」

### 2.3 多 Story 时间跨度大时是否需时间衰减

**共识**：**本轮不实现时间衰减**，统一使用 `windowHours`（默认 7 天）筛选。

- 批判审计员：Epic 跨越数周时，旧 Story 是否应降权？
- Winston：时间衰减需额外参数与实现，与现有 run_id/epic_story_window 策略正交；MVP 先统一窗口，衰减列入 Deferred Gaps

### 2.4 CLI 参数语义

| 调用 | 语义 | 与现有兼容 |
|------|------|------------|
| `--epic 9` | Epic 9 聚合视图（所有 Story 的 record 纳入筛选，按 A 聚合） | 新增 |
| `--epic 9 --story 1` | Story 9.1 单 Story 视图 | 保持不变 |
| 不传参数 | 最新完整 run（任意 epic/story） | 保持不变 |

- 批判审计员：`--epic 9` 与 `--epic 9 --story 1` 是否互斥？→ 不互斥：story 存在时优先单 Story；仅 epic 时走 Epic 聚合

### 2.5 与 `--strategy run_id` 的兼容

**共识**：`strategy=run_id` 时，`--epic N` 不生效（或文档明确「epic 过滤仅 epic_story_window 下有效」）。

- 批判审计员：run_id 按 run_id 分组，无 epic 概念，强行过滤会破坏语义
- 收敛：epic 过滤仅在 `strategy=epic_story_window` 时生效；run_id 忽略 epic/story

### 2.6 仪表盘输出标识

**共识**：Epic 聚合视图时，在标题或首行标明「Epic N 聚合视图」及纳入的 Story 列表，避免与单 Story 视图混淆。

---

## §3 任务列表（按 Phase/US 编号）

### Phase 1：Epic 筛选与聚合核心逻辑

#### US-1.1：aggregateByEpicOnly（Epic 下所有 Story 筛选）

| 项 | 内容 |
|----|------|
| **描述** | 新增 `aggregateByEpicOnly(records, epicId, windowHours): RunScoreRecord[]`，筛选 epicId 匹配且 timestamp 在 windowHours 内的记录；复用 `parseEpicStoryFromRecord` |
| **验收标准** | 1) 单测：给定含 E9.S1、E9.S2、E8.S1 的 fixture，epic=9、windowHours=168 时仅返回 E9.*；2) 与 `aggregateByEpicStoryTimeWindow` 在 epic+story 时结果一致（作为交叉验证） |
| **依赖** | 无 |

#### US-1.2：getEpicAggregateRecords（按 Story 分组并取各 Story 最新完整 run）

| 项 | 内容 |
|----|------|
| **描述** | 新增 `getEpicAggregateRecords(records, epicId, windowHours): RunScoreRecord[]`：1) 调用 aggregateByEpicOnly 得候选 records；2) 按 epic:story 分组；3) 每组取「最新完整 run」（≥2 stage，2-stage 设计下 story+implement，同 groupByEpicStoryOrRunId 逻辑）；4) 合并各组 records 返回 |
| **验收标准** | 1) 单测：E9 有 S1、S2 各一完整 run，返回 6 条（3+3）；2) 若 S3 仅有 1 stage，不包含 S3 的 record |
| **依赖** | US-1.1 |

#### US-1.3：computeEpicHealthScore（方案 A：Per-Story 后简单平均）

| 项 | 内容 |
|----|------|
| **描述** | 新增 `computeEpicHealthScore(epicRecords: RunScoreRecord[]): number`：1) 按 epic:story 分组；2) 每组用 `computeHealthScore` 得 Story 总分；3) 对 Story 总分做简单平均并四舍五入 |
| **验收标准** | 1) 单测：S1 总分 80、S2 总分 90 → Epic 总分 85；2) 单 Story 时等价于 computeHealthScore |
| **依赖** | US-1.2（或直接依赖 computeHealthScore） |

#### US-1.4：getEpicDimensionScores（Epic 四维聚合）

| 项 | 内容 |
|----|------|
| **描述** | 新增 `getEpicDimensionScores(epicRecords: RunScoreRecord[]): DimensionEntry[]`：对每个 Story 先算 `getDimensionScores`，再对同 dimension 的分数做 Story 级简单平均 |
| **验收标准** | 1) 单测：2 Story 各 2 维，断言维度合并与平均正确；2) 与 getDimensionScores 在单 Story 时一致 |
| **依赖** | US-1.3 |

### Phase 2：getLatestRunRecordsV2 扩展

#### US-2.1：epic-only 分支

| 项 | 内容 |
|----|------|
| **描述** | 修改 `getLatestRunRecordsV2`：当 `epic != null && story == null` 时，调用 `getEpicAggregateRecords(realDev, epic, windowHours)` 并返回，不再走「全库 best run」分支 |
| **验收标准** | 1) 单测：`getLatestRunRecordsV2(records, { strategy: 'epic_story_window', epic: 9, windowHours: 168 })` 仅含 E9 的 records；2) 传 epic+story 时行为不变 |
| **依赖** | US-1.2 |

### Phase 3：CLI 与仪表盘展示

#### US-3.1：dashboard-generate epic-only 调用路径

| 项 | 内容 |
|----|------|
| **描述** | dashboard-generate 在 `epic != null && story == null` 时，使用 `computeEpicHealthScore`、`getEpicDimensionScores` 计算 Epic 聚合数据；短板、高迭代、Veto、趋势可沿用现有逻辑（基于 epicRecords） |
| **验收标准** | 1) `npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window` 输出 Epic 9 聚合视图；2) 总分、四维与单测预期一致；3) Epic 下无完整 Story 时，输出「Epic N 下无完整 Story，暂无聚合数据」或等价提示 |
| **依赖** | US-1.3, US-1.4, US-2.1 |

#### US-3.2：Epic 聚合视图标识（含已排除 Story 列表）

| 项 | 内容 |
|----|------|
| **描述** | `formatDashboardMarkdown` 接收可选 `viewMode: 'single_story' | 'epic_aggregate'` 及 `epicId?: number`、`storyIds?: number[]`、`excludedStories?: string[]`；Epic 聚合时：1) 标题为「# Epic {N} 聚合视图」或副标题「纳入 Story：E{N}.S{x}, ...」；2) **当有被排除的不完整 Story 时**，输出含「已排除：E{N}.S{x}（未达完整 run）」或等价表述 |
| **验收标准** | 1) `--epic 9` 时输出含「Epic 9」或「Epic 9 聚合」；2) 有排除 Story 时输出含「已排除」；3) grep 可验证 |
| **依赖** | US-3.1 |

### Phase 4：测试与 fixture

#### US-4.1：Epic 聚合单测

| 项 | 内容 |
|----|------|
| **描述** | 在 `scoring/dashboard/__tests__/` 新增 `compute-epic-aggregate.test.ts`：覆盖 aggregateByEpicOnly、getEpicAggregateRecords、computeEpicHealthScore、getEpicDimensionScores |
| **验收标准** | `npm run test:scoring -- scoring/dashboard` 通过 |
| **依赖** | US-1.1～US-1.4 |

#### US-4.2：Epic 聚合 fixture 与集成测试

| 项 | 内容 |
|----|------|
| **描述** | 新增或扩展 fixture：含 E9.S1、E9.S2 多 Story 数据；集成测试断言：1) `--epic 9` 时总分、四维、短板与预期一致；2) 「部分 Story 不完整」场景（S3 仅 1 stage，排除）且输出含「已排除：E9.S3（未达完整 run）」；3) **strategy=run_id 时 epic 忽略**：`--epic 9 --strategy run_id` 与 `--strategy run_id` 输出一致 |
| **验收标准** | 1) 集成测试通过；2) 覆盖上述三个场景；3) CLI 文档或 bmad-dashboard 命令说明中写明「epic/story 过滤仅 epic_story_window 有效」 |
| **依赖** | US-3.1, US-4.1 |

---

## §4 边界与排除项

| 项 | 说明 |
|----|------|
| **aggregateByBranch** | 不实现；与 Epic 聚合正交 |
| **时间衰减** | 不实现；统一 windowHours，Deferred |
| **方案 B（record 合并再算）** | 不实现；产品选定方案 A |
| **run_id 下的 epic 过滤** | 不支持；epic 仅 epic_story_window 有效 |
| **Epic 权重配置** | Story 简单平均；自定义 Story 权重 Deferred |

---

## §5 验收命令

```bash
# 单元测试
npm run test:scoring -- scoring/dashboard

# Epic 聚合 CLI
npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window --windowHours 168

# 验证输出含 Epic 聚合标识
grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md

# 验证 strategy=run_id 时 epic 被忽略（集成测试断言：--epic N --strategy run_id 与 --strategy run_id 输出一致）

# 单 Story 行为不变
npx ts-node scripts/dashboard-generate.ts --epic 9 --story 1 --strategy epic_story_window
# 应与现有单 Story 视图一致
```

---

## §6 Deferred Gaps

| ID | 描述 | 触发条件 |
|----|------|----------|
| DG-1 | 时间衰减：Epic 内多 Story 时间跨度大时，对近期 Story 加权 | 产品提出「近期优先」需求 |
| DG-2 | 方案 B 可选视图：record 合并再算，作为 `--aggregateMode record_merge` | 数据分析侧需求 |
| DG-3 | Story 自定义权重：如「E9.S1 为 P0，权重 2；S2 为 P1，权重 1」 | 产品优先级配置 |
| DG-4 | run_id 策略下按 epic 预过滤：先 filter by epic 再 run_id 取最新 | 用户明确要求 |

---

## §7 最终任务表（可勾选格式）

- [ ] **US-1.1** aggregateByEpicOnly 实现与单测
- [ ] **US-1.2** getEpicAggregateRecords 实现与单测
- [ ] **US-1.3** computeEpicHealthScore 实现与单测
- [ ] **US-1.4** getEpicDimensionScores 实现与单测
- [ ] **US-2.1** getLatestRunRecordsV2 epic-only 分支
- [ ] **US-3.1** dashboard-generate epic-only 调用路径
- [ ] **US-3.2** Epic 聚合视图标识（formatDashboardMarkdown）
- [ ] **US-4.1** Epic 聚合单测（compute-epic-aggregate.test.ts）
- [ ] **US-4.2** Epic 聚合 fixture 与集成测试

---

## 附录：Party-Mode 100 轮讨论摘要

### 轮次分布

- 总轮数：100
- 批判审计员发言：72 轮（>70%）
- 其他角色：Winston 18 轮、Amelia 12 轮、John 10 轮、Quinn 5 轮、Mary 3 轮

### 关键辩论段落（按轮次摘要）

**轮 1～20（方案 A vs B 数学与语义）**  
批判审计员连续质疑：A 与 B 在 phase_weight 分布不同时结果不同；B 的隐性权重从何而来；若某 Story 有 10 stage、另一有 2 stage，B 会严重偏向前者。Winston 给出公式推演：`sum(score_i * w_i) / sum(w_i)` 在合并后由 stage 数量决定权重。John 确认产品需要「每 Story 等权」。Amelia 指出 getWeakTop3EpicStory 已按 Story 聚合，与 A 语义一致。

**轮 21～40（部分 Story、时间衰减）**  
批判审计员：不完整 Story 排除 vs 计 0 vs 部分计入？计 0 会人为拉低；排除则需标明。Quinn：单测需覆盖「S3 仅 1 stage 被排除」。时间衰减：批判审计员质疑多 Story 跨越数周时的公平性；Winston 主张 MVP 不实现，列 Deferred。

**轮 41～60（CLI 语义、strategy 兼容）**  
批判审计员：`--epic 9` 与 `--epic 9 --story 1` 是否互斥？Amelia：story 存在时走单 Story 分支，否则 Epic 聚合，二者正交。run_id 下 epic 是否生效？批判审计员：run_id 无 epic 概念，强行过滤会破坏分组语义。共识：epic 仅 epic_story_window 有效。

**轮 61～80（仪表盘标识、测试覆盖）**  
批判审计员：用户如何区分单 Story 与 Epic 聚合视图？John：需在标题或首行标明。Quinn：单测、集成、fixture 需覆盖 epic-only 路径及边界（无 Story、全不完整）。Mary：需在 TASKS 中 explicit 写出验收命令。

**轮 81～98（收敛与细节确认）**  
批判审计员多轮追问：getEpicDimensionScores 的 Story 级平均是否与 getDimensionScores 在单 Story 时一致？Amelia 确认。短板、高迭代在 Epic 聚合时是否沿用 getWeakTop3EpicStory？Winston：基于 epicRecords 调用即可。多轮无新 gap。

**轮 98～100（最后 3 轮无新 gap）**  
轮 98：批判审计员——是否还有「epic 有 0 个完整 Story」时的输出约定？共识：输出「Epic N 下无完整 Story，暂无聚合数据」或等价提示。  
轮 99：Winston——验收命令是否覆盖该边界？共识：集成测试需断言该场景。  
轮 100：批判审计员终审——有条件同意；保留 DG-1～DG-4 为 Deferred Gaps；实施时须严格按 US 顺序与验收标准执行。

### 批判审计员终审陈述

**结论**：有条件同意本方案。

**条件**：  
1) US-1.1～US-1.4 单测必须覆盖 phase_weight 分布不同时的 A/B 差异验证（可选，用于文档化决策依据）；  
2) Epic 下 0 个完整 Story 时的输出需明确且可测；  
3) Deferred Gaps DG-1～DG-4 在产品需求变更时优先评估。

**保留**：时间衰减、方案 B、Story 权重配置留待后续迭代；当前方案在给定约束下可实施、可验证。
