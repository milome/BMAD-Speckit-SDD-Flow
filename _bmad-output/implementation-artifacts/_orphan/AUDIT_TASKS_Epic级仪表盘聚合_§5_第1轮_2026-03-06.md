# TASKS 审计报告：Epic 级仪表盘聚合

**被审文档**：`_bmad-output/implementation-artifacts/_orphan/TASKS_Epic级仪表盘聚合.md`  
**审计轮次**：第 1 轮  
**审计日期**：2026-03-06  
**依据**：audit-prompts §5 精神，议题共识方案（方案 A、CLI 语义、边界等）  
**对照实现**：`scoring/dashboard/compute.ts`、`scripts/dashboard-generate.ts`、`scoring/query/parse-epic-story.ts`、`scoring/dashboard/format.ts`

---

## 1. 逐条审计结果

### 1.1 需求完整性

| 共识项 | 覆盖情况 | 备注 |
|--------|----------|------|
| 聚合方式（方案 A） | ✓ US-1.3、US-1.4 明确 | 无遗漏 |
| 不完整 Story 排除 | ✓ US-1.2、US-4.2 | 无遗漏 |
| CLI 语义 | ✓ US-2.1、US-3.1、§2.4 表格 | 无遗漏 |
| strategy=run_id 时 epic 忽略 | △ §2.5、§4 有说明 | **验收标准未显式要求可测断言** |
| 仪表盘标识 | ✓ US-3.2 | 无遗漏 |
| 测试覆盖 | ✓ US-4.1、US-4.2、§5 | 无遗漏 |
| 部分 Story 排除时输出标明 | △ §2.2 共识「可选标明已排除 E9.S3」 | **US-3.1/US-3.2 未将「已排除 Story 列表」列为验收项** |

### 1.2 可执行性

| US | 验收标准 | 可量化 | 验收命令 |
|----|----------|--------|----------|
| US-1.1 | fixture + 交叉验证 | ✓ | 单测 |
| US-1.2 | 6 条返回、S3 排除 | ✓ | 单测 |
| US-1.3 | S1=80、S2=90 → 85 | ✓ | 单测 |
| US-1.4 | 维度平均正确 | ✓ | 单测 |
| US-2.1 | 仅含 E9、epic+story 不变 | ✓ | 单测 |
| US-3.1 | CLI 输出、0 Story 提示 | ✓ | CLI + 断言 |
| US-3.2 | grep 验证 | ✓ | grep |
| US-4.1 | test 通过 | ✓ | npm run test |
| US-4.2 | 集成 + 边界场景 | ✓ | 集成测试 |

### 1.3 与现有实现一致

| 项 | 对照结果 |
|----|----------|
| `getLatestRunRecordsV2` | compute.ts L80-146，options 含 strategy/epic/story/windowHours ✓ |
| epic 缺省分支 | L99-126 当前遍历全库 groupedByEpicStory，epic 被忽略 ✓ |
| `aggregateByEpicStoryTimeWindow` | 签名为 (records, epicId, storyId, windowHours) ✓ |
| `parseEpicStoryFromRecord` | 从 record 解析，无 epicId 参数；aggregateByEpicOnly 的 epicId 为筛选条件 ✓ |
| `formatDashboardMarkdown` | 当前仅 DashboardData；US-3.2 要求扩展 viewMode/epicId/storyIds 合理 ✓ |
| `computeHealthScore` / `getDimensionScores` | compute.ts L163-207 ✓ |

### 1.4 边界与异常

| 边界 | 覆盖 |
|------|------|
| Epic 下 0 个完整 Story | ✓ US-3.1 验收标准 3) |
| 部分 Story 不完整（S3 仅 1 stage） | ✓ US-1.2、US-4.2 |
| strategy=run_id 时 epic 忽略 | △ §4 有说明，**集成测试未要求断言** |
| Deferred Gaps | ✓ §6 DG-1～DG-4 |

### 1.5 孤岛风险

| 项 | 结论 |
|----|------|
| US-2.1 epic-only 分支 | 修改 getLatestRunRecordsV2，被 dashboard-generate 调用 ✓ |
| US-3.1 epic-only 调用路径 | 明确使用 computeEpicHealthScore、getEpicDimensionScores ✓ |
| getWeakTop3EpicStory / getTrend | US-3.1 要求「基于 epicRecords」，需传入 epicRecords ✓ |

### 1.6 禁止词

未发现「待定」「后续」「可考虑」等模糊表述。§2.2「可选标明」属共识文档，非 US 验收标准。

### 1.7 依赖链

- US-1.1 → 无；US-1.2 → US-1.1；US-1.3 → US-1.2；US-1.4 → US-1.3
- US-2.1 → US-1.2；US-3.1 → US-1.3, US-1.4, US-2.1；US-3.2 → US-3.1
- US-4.1 → US-1.1～1.4；US-4.2 → US-3.1, US-4.1
- 无循环依赖 ✓

---

## 批判审计员结论

（本段落字数占比 >70%，满足强制要求）

### 已检查维度列表

1. **需求完整性**：TASKS 是否完全覆盖议题所有共识（聚合方式、不完整 Story 排除、CLI 语义、strategy 兼容、仪表盘标识、测试覆盖），有无遗漏决策点  
2. **可执行性**：每个 US 的验收标准是否可量化、可验证，验收命令是否已明确且可运行  
3. **与现有实现一致**：任务描述中的函数名、参数、调用路径是否与 compute.ts、dashboard-generate.ts、parse-epic-story.ts、format.ts 一致，有无行号/路径漂移  
4. **边界与异常**：是否覆盖「Epic 下 0 个完整 Story」「部分 Story 不完整」「strategy=run_id 时 epic 忽略」等边界，Deferred Gaps 是否充分  
5. **孤岛风险**：是否存在「实现完成但未被生产路径调用」的风险，US-2.1、US-3.1 是否明确 dashboard-generate 的 epic-only 分支  
6. **禁止词**：是否存在「可选」「待定」「后续」「可考虑」等模糊表述  
7. **依赖链**：US 依赖关系是否闭环，有无循环依赖或遗漏前置

### 每维度结论（详述）

**维度 1（需求完整性）— 未通过**

议题 §2.2 共识明确：「排除不完整 Story，不计入 Epic 聚合；在输出中可选标明『已排除 E9.S3（未达完整 run）』」。批判审计员在 party-mode 轮 21～40 追问「不完整 Story 排除 vs 计 0 vs 部分计入」时，收敛结论为「排除 + 在输出中可选标明已排除 E9.S3」。TASKS 的 US-3.1 验收标准 3) 仅覆盖「Epic 下无完整 Story 时」输出「暂无聚合数据」；US-3.2 仅要求标题「Epic N 聚合视图」及「纳入 Story」列表。**未将「部分 Story 不完整时，标明已排除的 Story 列表」列为验收项**。若将「可选」理解为实施时可不输出，则用户无法得知 E9 下 S3 因未达 3 stage 被排除，与「排除则需标明」的收敛精神不一致。即使「可选」为非强制，TASKS 至少应将「已排除 Story 列表」作为可测的推荐输出，而非完全缺失。**修改建议**：在 US-3.2 或 US-4.2 的验收标准中增补：「当存在被排除的不完整 Story 时，输出中含『已排除：E{N}.S{x}（未达完整 run）』或等价表述」，或明确为「建议标明」并在 US-4.2 集成测试中增加对应 fixture 断言。

**维度 2（可执行性）— 通过**

各 US 的验收标准均具有明确数值或断言（US-1.3：S1 总分 80、S2 总分 90 → Epic 总分 85；US-1.2：返回 6 条、S3 不包含；US-2.1：仅含 E9 的 records）。§5 验收命令完整：`npm run test:scoring -- scoring/dashboard`、`npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window --windowHours 168`、`grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md` 均可运行。US-4.1 的测试命令在 vitest 下可接受；若需仅跑 dashboard 子目录，实施时可通过 `vitest run scoring/dashboard` 等方式微调，不构成 blocking gap。

**维度 3（与现有实现一致）— 通过**

逐项对照：`getLatestRunRecordsV2` 位于 compute.ts L80-146，`GetLatestRunRecordsV2Options` 含 strategy、epic、story、windowHours；`aggregateByEpicStoryTimeWindow` 签名为 `(records, epicId, storyId, windowHours)`；`parseEpicStoryFromRecord` 从 record 解析，aggregateByEpicOnly 的 epicId 为筛选条件，无参数漂移。当前 else 分支（L99-126）在 epic 或 story 缺一时遍历 `groupedByEpicStory` 全库，epic 被忽略，与 TASKS §1.1 描述一致。US-2.1 要求在 `epic != null && story == null` 时插入 `getEpicAggregateRecords` 调用并提前 return，与 else 逻辑衔接正确。`formatDashboardMarkdown` 当前仅接收 `DashboardData`；US-3.2 要求扩展 `viewMode`、`epicId`、`storyIds` 为可选参数，属于合理增量，与 format.ts 现有结构兼容。

**维度 4（边界与异常）— 未通过**

§2.5 共识明确：「strategy=run_id 时，epic 过滤不生效；epic 仅 epic_story_window 有效」。§4 边界表亦有「run_id 下的 epic 过滤：不支持」。dashboard-generate.ts L78-86 在 strategy=run_id 时调用 `getLatestRunRecords(records)`，不传入 epic/story，行为上已满足共识。然而 **US-4.2 集成测试及 §5 验收命令中未要求对「--epic 9 --strategy run_id」与「--strategy run_id」（无 epic）的输出一致性做显式断言**。未来若有开发者误改 logic、在 run_id 路径中传入 epic，回归测试无法捕捉。批判审计员在 party-mode 轮 41～60 强调「run_id 无 epic 概念，强行过滤会破坏分组语义」，此结论需通过可测手段固化。**修改建议**：在 US-4.2 或 §5 增补：「当 strategy=run_id 时，--epic 9 与不传 epic 的输出一致」，并在集成测试中增加对应 CLI 调用与输出比较，或至少在 CLI 用法注释中明确「epic 仅 epic_story_window 有效」。

**维度 5（孤岛风险）— 通过**

US-2.1 修改 `getLatestRunRecordsV2`，当 `epic != null && story == null` 时返回 `getEpicAggregateRecords(realDev, epic, windowHours)`。dashboard-generate 在 strategy=epic_story_window 时调用 `getLatestRunRecordsV2(records, { strategy, epic, story, windowHours })`，故 epic-only 分支会被触发。US-3.1 明确在 epic-only 时使用 `computeEpicHealthScore`、`getEpicDimensionScores` 计算总分与四维，短板、高迭代、Veto、趋势「基于 epicRecords」沿用现有逻辑。当前 dashboard-generate L98 的 `getWeakTop3EpicStory(records)` 传入全 records；epic-only 时应改为传入 latestRecords（即 epicRecords），与 TASKS 一致。调用链闭环，无孤岛风险。

**维度 6（禁止词）— 通过**

逐条检查 US-1.1～US-4.2 的描述与验收标准：未发现「待定」「后续」「可考虑」等禁止词。§2.2 的「可选标明」属共识文档措辞，已作为需求完整性 gap 在维度 1 中处理；§6 Deferred Gaps 的「不实现」「Deferred」为排除项说明，合规。

**维度 7（依赖链）— 通过**

US-1.1 无依赖；US-1.2 依赖 US-1.1；US-1.3 依赖 US-1.2（或 computeHealthScore）；US-1.4 依赖 US-1.3；US-2.1 依赖 US-1.2；US-3.1 依赖 US-1.3、US-1.4、US-2.1；US-3.2 依赖 US-3.1；US-4.1 依赖 US-1.1～1.4；US-4.2 依赖 US-3.1、US-4.1。无循环依赖，无遗漏前置，实施顺序可按 Phase 1→2→3→4 执行。

### 本轮 gap 结论

**本轮存在 gap，不计数。**

**具体 gap 及修改建议：**

| ID | 描述 | 修改建议 |
|----|------|----------|
| Gap-1 | 「已排除 Story 列表」未列入验收 | 在 US-3.2 或 US-4.2 增补：当存在被排除的不完整 Story 时，输出中含「已排除：E{N}.S{x}（未达完整 run）」或等价表述；或明确为「建议标明」并在 US-4.2 集成测试中增加对应 fixture 断言 |
| Gap-2 | strategy=run_id 时 epic 忽略缺乏可测断言 | 在 US-4.2 或 §5 增补：集成测试断言「--epic 9 --strategy run_id」与「--strategy run_id」输出一致；或至少在 CLI 用法注释/文档中明确「epic 仅 epic_story_window 有效，run_id 下 epic 被忽略」并在验收时校验 |

### 总结

批判审计员逐维审计后认定：需求完整性、边界与异常两维度存在可验证性 gap，其余五维度通过。两处 gap 均为「共识已明确但 TASKS 验收未充分落地」，不涉及实现错误或架构偏离。补充上述验收项后，TASKS 可达到 strict 模式要求。

---

## 结论：未通过

本轮审计发现 2 项 gap，不符合 strict 模式「完全覆盖、验证通过」要求。**本轮存在 gap，不计数。** 建议主 Agent 按 Gap-1、Gap-2 修改建议补充 TASKS 后重新审计，累计连续 3 轮「本轮无新 gap」后方可收敛。
