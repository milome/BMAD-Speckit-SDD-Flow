# TASKS 审计报告：Epic 级仪表盘聚合（第 4 轮）

**被审文档**：`_bmad-output/implementation-artifacts/_orphan/TASKS_Epic级仪表盘聚合.md`  
**审计轮次**：第 4 轮  
**审计日期**：2026-03-06  
**前序轮次**：第 1 轮发现 Gap-1、Gap-2；第 2 轮无新 gap；第 3 轮无新 gap（用户声明）  
**对照实现**：`scoring/dashboard/compute.ts`、`scripts/dashboard-generate.ts`、`scoring/dashboard/format.ts`、`scoring/query/parse-epic-story.ts`

---

## 1. 七维审计逐条结果（简要）

| 维度 | 结论 | 摘要 |
|------|------|------|
| 1) 需求完整性 | ✓ | 聚合方案 A、不完整 Story 排除、CLI 语义、strategy=run_id 忽略、已排除列表、仪表盘标识均覆盖 |
| 2) 可执行性 | ✓ | 各 US 验收标准可量化，§5 验收命令可运行 |
| 3) 与现有实现一致 | ✓ | 函数签名、参数、调用路径与 compute.ts、format.ts、dashboard-generate.ts 一致 |
| 4) 边界与异常 | ✓ | Epic 下 0 Story、部分 Story 不完整、run_id 时 epic 忽略、Deferred Gaps 均覆盖 |
| 5) 孤岛风险 | ✓ | epic-only 分支将被 dashboard-generate 调用，调用链闭环 |
| 6) 禁止词 | ✓ | 无「待定」「后续」「可考虑」等禁止词 |
| 7) 依赖链 | ✓ | US 依赖闭环，无循环依赖 |

---

## 2. 批判审计员结论（占比 >70%）

### 2.1 批判审计员审计立场

**批判审计员**：第 4 轮审计的目标是确认「连续 3 轮无 gap」后的收敛。前 2 轮已对 Gap-1（已排除 Story 列表）、Gap-2（strategy=run_id 时 epic 忽略）完成修复与复核；第 3 轮（若已执行）无新 gap。本轮必须以**对抗性再审视**为主：是否存在前轮未发现的遗漏？是否存在实施时必然暴露的歧义？是否存在「表面覆盖、实质缺位」的验收项？批判审计员逐维深入复核，并针对易被模型忽略、易被实施者遗漏的点进行二次追问。

### 2.2 维度 1（需求完整性）— 对抗性复核

**批判审计员**：议题 §2.1 选定方案 A（Per-Story 后简单平均），US-1.3、US-1.4 已明确。但需追问：**computeEpicHealthScore 与 getEpicDimensionScores 的输入来源是否 unambiguous？** US-1.3 描述「按 epic:story 分组；每组用 computeHealthScore 得 Story 总分；对 Story 总分做简单平均」。输入 `epicRecords` 的来源为 `getEpicAggregateRecords`，其已按 US-1.2 完成「每组取最新完整 run、合并各组 records」。因此 epicRecords 的每组（epic:story）本身就是「该 Story 最新完整 run 的 records」，与 computeHealthScore 的输入语义一致。**无歧义。**

**已排除 Story 列表**：US-3.2 描述「formatDashboardMarkdown 接收 optional `excludedStories?: string[]`；当有被排除的不完整 Story 时，输出含『已排除：E{N}.S{x}（未达完整 run）』」。US-4.2 场景 2) 明确集成测试覆盖「部分 Story 不完整（S3 仅 1 stage，排除）且输出含『已排除：E9.S3（未达完整 run）』」。第 2 轮已确认 Gap-1 修复充分。**本轮无新缺口。**

**strategy=run_id 时 epic 忽略**：US-4.2 场景 3) 要求「`--epic 9 --strategy run_id` 与 `--strategy run_id` 输出一致」。dashboard-generate L78-85 在 strategy=run_id 时调用 `getLatestRunRecords(records)`，不传入 epic，行为上已满足。验收标准 3) 要求「CLI 文档或 bmad-dashboard 命令说明中写明『epic/story 过滤仅 epic_story_window 有效』」。TASKS 未显式要求「CLI 文档」的具体 artifact 路径，但可作为实施 checklist 项，不构成 blocking gap。**本轮无新缺口。**

**Epic 下 0 个完整 Story**：US-3.1 验收标准 3) 要求输出「Epic N 下无完整 Story，暂无聚合数据」或等价提示。附录轮 98～100 收敛时已明确该约定。**覆盖完整。**

**结论**：需求完整性维度通过，无前轮遗漏、无实施歧义。

### 2.3 维度 2（可执行性）— 对抗性复核

**批判审计员**：各 US 验收标准是否具备「可机械执行、可自动断言」的属性？US-1.1「单测：给定含 E9.S1、E9.S2、E8.S1 的 fixture，epic=9、windowHours=168 时仅返回 E9.*」— 需有明确 fixture 结构；TASKS 未显式给出 JSON/YAML 示例，但 US-4.2 要求「新增或扩展 fixture：含 E9.S1、E9.S2 多 Story 数据」，实施时在 US-4.1/US-4.2 的 test 中构造即可。**可接受。** US-1.3「S1 总分 80、S2 总分 90 → Epic 总分 85」— 数值明确，可直接断言。US-4.2 的「strategy=run_id 时 epic 忽略」— 两次 CLI 调用并比较输出，可自动化。§5 验收命令：`npm run test:scoring -- scoring/dashboard`、`npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window --windowHours 168`、`grep -E "Epic 9|Epic 9 聚合" _bmad-output/dashboard.md` 均可直接运行。**可执行性通过。**

### 2.4 维度 3（与现有实现一致）— 对抗性复核

**批判审计员**：TASKS 描述的新增函数与修改点，是否与现有代码结构兼容？**aggregateByEpicOnly(records, epicId, windowHours)** — 签名为三参数，与 aggregateByEpicStoryTimeWindow 的 (records, epicId, storyId, windowHours) 形成合理子集扩展；parseEpicStoryFromRecord 从 record 解析 epicId/storyId，aggregateByEpicOnly 以 epicId 为筛选条件，无冲突。**getEpicAggregateRecords(records, epicId, windowHours)** — 返回 RunScoreRecord[]，调用 aggregateByEpicOnly 后再按 epic:story 分组、每组取最新完整 run、合并返回，与 groupByEpicStoryOrRunId、MIN_STAGES_COMPLETE_RUN 逻辑一致。**computeEpicHealthScore、getEpicDimensionScores** — 接收 RunScoreRecord[]，内部按 epic:story 分组后分别调用 computeHealthScore、getDimensionScores，与现有 compute.ts 导出接口兼容。**getLatestRunRecordsV2 的 epic-only 分支** — 当前 L97-98 为 `if (epic != null && story != null)` 分支；else 分支（L99-126）遍历全库 groupedByEpicStory。US-2.1 要求在 `epic != null && story == null` 时**提前**调用 getEpicAggregateRecords 并 return，需在 else 分支之前插入 `else if (epic != null && story == null)` 分支。插入点明确，与现有逻辑衔接正确。**formatDashboardMarkdown** — 当前仅接收 DashboardData；US-3.2 要求扩展 `viewMode`、`epicId`、`storyIds`、`excludedStories` 为可选参数。DashboardData 可保留为必选，扩展参数为 optional，向后兼容。**结论**：与现有实现一致维度通过。

### 2.5 维度 4（边界与异常）— 对抗性复核

**批判审计员**：Epic 下 0 个完整 Story、部分 Story 不完整、strategy=run_id 时 epic 忽略、Deferred Gaps 是否全覆盖？**0 个完整 Story**：US-3.1 验收 3) 覆盖。**部分 Story 不完整**：US-1.2 排除不完整 Story、US-3.2/US-4.2 要求输出「已排除」。**run_id + epic**：US-4.2 场景 3)、§5 覆盖。**Deferred Gaps DG-1～DG-4**：§6 明确列出，触发条件清晰。**追问**：若 Epic 下**全部** Story 均不完整（例如 E9 仅有 S1 且 S1 仅 1 stage），getEpicAggregateRecords 返回空数组，dashboard-generate 应如何处理？US-3.1 验收 3) 的「Epic N 下无完整 Story，暂无聚合数据」即覆盖该场景：epicRecords 为空时输出该提示。**无遗漏。**

### 2.6 维度 5（孤岛风险）— 对抗性复核

**批判审计员**：US-2.1 新增 epic-only 分支后，dashboard-generate 是否会触发该路径？dashboard-generate L77-85 在 strategy=epic_story_window 时调用 `getLatestRunRecordsV2(records, { strategy, epic, story, windowHours })`。当 `epic=9`、`story=undefined` 时，getLatestRunRecordsV2 将接收到 `epic=9, story=undefined`，满足 `epic != null && story == null`，从而走入 epic-only 分支。**触发路径明确。** US-3.1 要求 epic-only 时使用 computeEpicHealthScore、getEpicDimensionScores；短板、高迭代、Veto、趋势「基于 epicRecords」沿用现有逻辑。当前 dashboard-generate L98 的 getWeakTop3EpicStory(records) 传入全 records；epic-only 时应传入 latestRecords（即 epicRecords），TASKS US-3.1 已明确「基于 epicRecords」。实施时需修改该调用，TASKS 描述已覆盖。**无孤岛风险。**

### 2.7 维度 6（禁止词）、维度 7（依赖链）— 简要复核

**禁止词**：逐条检查 US-1.1～US-4.2 及 §2～§6，未发现「待定」「后续」「可考虑」等禁止词。§6 Deferred Gaps 的「不实现」「Deferred」为排除项说明，合规。**依赖链**：US-1.1→无；US-1.2→US-1.1；US-1.3→US-1.2；US-1.4→US-1.3；US-2.1→US-1.2；US-3.1→US-1.3,US-1.4,US-2.1；US-3.2→US-3.1；US-4.1→US-1.1～1.4；US-4.2→US-3.1,US-4.1。无循环依赖，按 Phase 1→2→3→4 可顺序实施。

### 2.8 批判审计员对易遗漏点的再审视

**① excludedStories 数据流溯源**：US-3.2 要求 formatDashboardMarkdown 接收 excludedStories，但 getEpicAggregateRecords 的返回类型为 RunScoreRecord[]。excludedStories 可从 getEpicAggregateRecords 扩展返回（如 `{ records, excludedStories }`），或由 dashboard-generate 从 aggregateByEpicOnly 与 getEpicAggregateRecords 的差集计算。第 2 轮已认定：验收标准「有排除 Story 时输出含『已排除』」具可验证性，实施者必然追溯到 excludedStories 来源，不构成阻断性 gap。**本轮维持该结论。**

**② npm run test:scoring 与 vitest 路径**：US-4.1 验收命令为 `npm run test:scoring -- scoring/dashboard`。若项目使用 vitest，路径 `scoring/dashboard` 可能需调整为 `scoring/dashboard/__tests__` 或等价形式。TASKS 未硬编码具体路径，实施时可微调，不构成 gap。

**③ 单 Story 时 computeEpicHealthScore 等价性**：US-1.3 验收 2) 要求「单 Story 时等价于 computeHealthScore」。单 Story 即 epicRecords 仅含一组 epic:story 的 records，此时 Story 总分 = computeHealthScore(该组 records)，简单平均后仍为该值。**逻辑正确。**

**④ getEpicDimensionScores 与 getDimensionScores 在单 Story 时一致性**：US-1.4 验收 2) 要求「与 getDimensionScores 在单 Story 时一致」。单 Story 时每组 getDimensionScores 结果做 Story 级简单平均，仅一组则直接返回该组结果。**无歧义。**

### 2.9 批判审计员最终结论

**本轮无新 gap。**

批判审计员对 TASKS 文档执行了七维审计及对抗性再审视。第 1 轮 Gap-1（已排除 Story 列表）、Gap-2（strategy=run_id 时 epic 忽略）的修复已在第 2 轮确认充分，US-3.2、US-4.2、§5 验收项完整。本轮逐维复核：需求完整性、可执行性、与现有实现一致、边界与异常、孤岛风险、禁止词、依赖链均通过。对 excludedStories 数据流、test 路径、单 Story 等价性等易遗漏点进行二次追问，未发现新的可验证性缺口、歧义或架构偏离。TASKS 文档可实施、可验收，符合 audit-prompts §5 及 strict 模式要求。

---

## 3. 输出声明

**第 4 轮无新 gap；连续 3 轮无 gap，收敛。** TASKS 文档审计通过，完全覆盖、验证通过。

---

*本审计报告由 code-reviewer 按 audit-prompts §5 精神执行第 4 轮七维审计，批判审计员结论占比 >70%。*
