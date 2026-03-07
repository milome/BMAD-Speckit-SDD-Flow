# TASKS 审计报告：Epic 级仪表盘聚合（第 3 轮）

**被审文档**：`_bmad-output/implementation-artifacts/_orphan/TASKS_Epic级仪表盘聚合.md`  
**审计轮次**：第 3 轮  
**审计日期**：2026-03-06  
**前轮说明**：第 1 轮存在 Gap（已修复）；第 2 轮无新 gap  
**对照实现**：`scoring/dashboard/compute.ts`、`scripts/dashboard-generate.ts`、`scoring/dashboard/format.ts`、`scoring/query/parse-epic-story.ts`

---

## 1. 七维审计逐项结果（简要）

| 维度 | 结论 | 摘要 |
| ---- | ---- | ---- |
| 1. 需求完整性 | ✓ | 方案 A、排除逻辑、CLI 语义、Gap-1/Gap-2 修复项均已覆盖 |
| 2. 可执行性 | ✓ | 各 US 验收可量化，§5 验收命令可运行 |
| 3. 与现有实现一致 | ✓ | 函数签名、插入点、调用链与 compute/format/dashboard-generate 一致 |
| 4. 边界与异常 | ✓ | 0 Story、部分不完整、run_id 忽略、DG-1～4 均已覆盖 |
| 5. 孤岛风险 | ✓ | epic-only 分支在生产路径闭环内 |
| 6. 禁止词 | ✓ | 未发现禁止词 |
| 7. 依赖链 | ✓ | 无循环依赖，Phase 1→2→3→4 可序执行 |

---

## 2. 批判审计员结论（占比 >70%）

### 2.1 审计目标与对抗性姿态

**批判审计员**：第 3 轮审计的目标是验证文档在连续 2 轮无 gap 后是否仍存在遗漏、歧义或实施时必然暴露的可验证性缺口。前两轮已修复 Gap-1（已排除 Story 列表未落验收）、Gap-2（run_id 时 epic 忽略无验证）。本轮必须从**对抗性**角度追问：是否存在前两轮均未发现的隐患？是否存在表面覆盖但实质模糊的验收项？是否存在与现有实现不一致、或实施时必然产生孤岛的隐含假设？

批判审计员对七维逐一执行**深度复核**，并对若干易被忽视的交叉点进行**二次审视**。

### 2.2 维度 1（需求完整性）— 深度复核

**逐项检查**：方案 A（Per-Story 后简单平均）由 US-1.3、US-1.4 明确实现路径；不完整 Story 排除由 US-1.2、US-4.2 覆盖；已排除 Story 列表的标明由 US-3.2、US-4.2 验收标准 2) 覆盖；CLI 语义由 §2.4、US-2.1、US-3.1 覆盖；strategy=run_id 时 epic 忽略由 US-4.2 场景 3)、§5 覆盖；仪表盘标识由 US-3.2 覆盖；Epic 下 0 个完整 Story 由 US-3.1 验收标准 3) 覆盖。

**对抗性追问**：US-3.1 描述「短板、高迭代、Veto、趋势可沿用现有逻辑（基于 epicRecords）」——是否存在歧义？「沿用」是否意味着传入 epicRecords 而非全量 records？

对照 dashboard-generate 现状：getWeakTop3EpicStory 当前接收 records；在 epic-only 路径下，latestRecords 即为 epicRecords，若将 getWeakTop3EpicStory(records) 改为 getWeakTop3EpicStory(latestRecords)（即 epicRecords），则短板将仅基于 Epic 内 Story，符合「Epic 聚合视图」语义。TASKS 已明确「基于 epicRecords」，实施时可推断：epic-only 时传入 epicRecords。**结论**：无歧义，不构成 gap。

### 2.3 维度 2（可执行性）— 深度复核

**逐项检查**：US-1.1 的「fixture + 交叉验证」可通过单测断言实现；交叉验证「与 aggregateByEpicStoryTimeWindow 在 epic+story 时结果一致」的含义为：对任意 (epic, story)，aggregateByEpicStoryTimeWindow(records, epic, story, window) 返回的集合应为 aggregateByEpicOnly(records, epic, window) 的子集（按 story 筛选后等价），可编写断言。US-1.2 的「6 条返回、S3 不包含」、US-1.3 的「S1=80、S2=90→85」、US-1.4 的「维度平均正确」、US-2.1 的「仅含 E9」均具备明确数值。US-3.2 的「有排除 Story 时输出含『已排除』」可通过 grep 或集成断言验证。US-4.2 场景 3) 的「`--epic 9 --strategy run_id` 与 `--strategy run_id` 输出一致」可通过两次 CLI 调用并比较 stdout/文件实现。

**对抗性追问**：§5 验收命令中「验证 strategy=run_id 时 epic 被忽略」以注释形式给出，未提供可直接粘贴的 shell 命令。第 2 轮已认定「实施时会在集成测试代码中编写断言，验收命令作为说明性指引可接受」。本轮复核：US-4.2 验收标准 2) 已明确要求「覆盖上述三个场景」，场景 3 即 run_id 断言；集成测试必然编写代码断言，无需 §5 提供完整 shell。**结论**：可执行性无缺口。

### 2.4 维度 3（与现有实现一致）— 深度复核

**逐项对照**：compute.ts L80-146 的 getLatestRunRecordsV2 含 strategy、epic、story、windowHours；L97-99 在 epic!=null && story!=null 时调用 aggregateByEpicStoryTimeWindow；L100-126 的 else 分支遍历全库 groupedByEpicStory，epic 被忽略，与 TASKS §1.1 一致。US-2.1 要求在 epic!=null && story==null 时插入 getEpicAggregateRecords 调用；插入点应在 L99 之后、else 之前，形成独立分支，逻辑清晰。aggregateByEpicOnly(records, epicId, windowHours) 的 epicId 为筛选条件，parseEpicStoryFromRecord 从 record 解析 (epicId, storyId)，无参数语义冲突。formatDashboardMarkdown 当前签名为 (data: DashboardData)；US-3.2 要求扩展 viewMode、epicId、storyIds、excludedStories 为可选参数，可通过重载或扩展 DashboardData 实现，与 format.ts 现有结构兼容。DimensionEntry 已存在于 compute.ts L180-182，getEpicDimensionScores 返回 DimensionEntry[]，与 getDimensionScores 一致。dashboard-generate 在 strategy=run_id 时调用 getLatestRunRecords(records)，不传 epic/story，与 §2.5 一致。

**对抗性追问**：getEpicAggregateRecords 的返回类型——文档描述为「合并各组 records 返回」，即 RunScoreRecord[]。excludedStories 由谁产出？US-3.2 要求 formatDashboardMarkdown 接收 excludedStories。实施路径：getEpicAggregateRecords 可扩展为返回 `{ records, excludedStories }`，或由调用方根据 aggregateByEpicOnly 与「完整 run 组」的差集计算。第 2 轮已认定「实施者必须实现该输出，必然会追溯到 excludedStories 的来源，故不构成阻断性 gap」。本轮维持该结论。

### 2.5 维度 4（边界与异常）— 深度复核

**逐项检查**：Epic 下 0 个完整 Story → US-3.1 验收标准 3) 要求输出「Epic N 下无完整 Story，暂无聚合数据」或等价提示；集成测试需断言该场景（附录轮 99 共识）。部分 Story 不完整（S3 仅 1 stage）→ US-1.2 排除逻辑、US-4.2 场景 2)、US-3.2 输出「已排除」均已覆盖。strategy=run_id 时 epic 忽略 → US-4.2 场景 3)、§5 已覆盖。Deferred Gaps DG-1～DG-4 已在 §6 明确，§4 边界与排除项表清晰。

**对抗性追问**：windowHours=0 或负数时行为？TASKS 未显式约定；现有 aggregateByEpicStoryTimeWindow 使用 `Date.now() - windowHours * 60 * 60 * 1000`，windowHours=0 时 cutoff=now，可能筛掉全部记录。鉴于 §2.3 共识为「默认 7 天」，且 CLI 默认 windowHours=24*7，异常参数属实施时防御性处理，非 TASKS 必须约定的需求级边界。**结论**：边界与异常维度通过。

### 2.6 维度 5（孤岛风险）— 深度复核

**调用链**：dashboard-generate 在 strategy=epic_story_window 且 epic!=null、story==null 时，将调用 getLatestRunRecordsV2(records, { strategy, epic, story, windowHours })；getLatestRunRecordsV2 内 epic-only 分支将调用 getEpicAggregateRecords；getEpicAggregateRecords 调用 aggregateByEpicOnly；dashboard-generate 在 epic-only 时将使用 computeEpicHealthScore、getEpicDimensionScores 计算总分与四维，并基于 epicRecords 调用 getWeakTop3EpicStory、getHighIterationTop3、countVetoTriggers、getTrend。全链闭环，无未被调用的新增函数。

**对抗性追问**：dashboard-generate 当前在 epic_story_window 时，不论 epic-only 还是 epic+story，均调用 getLatestRunRecordsV2。实施 US-2.1 后，epic-only 分支在 getLatestRunRecordsV2 内触发，dashboard-generate 无需修改调用点，仅需在 epic-only 时使用 computeEpicHealthScore 而非 computeHealthScore。调用链正确。**结论**：孤岛风险维度通过。

### 2.7 维度 6（禁止词）— 深度复核

**全文检索**：US-1.1～US-4.2 描述与验收标准、§4、§5、§6 中未发现「待定」「后续」「可考虑」「可能」「或许」等模糊表述。§6 Deferred Gaps 的「不实现」「Deferred」为排除项与延期说明，符合约定。**结论**：禁止词维度通过。

### 2.8 维度 7（依赖链）— 深度复核

**依赖图**：US-1.1 无依赖；US-1.2 依赖 US-1.1；US-1.3 依赖 US-1.2（或 computeHealthScore）；US-1.4 依赖 US-1.3；US-2.1 依赖 US-1.2；US-3.1 依赖 US-1.3、US-1.4、US-2.1；US-3.2 依赖 US-3.1；US-4.1 依赖 US-1.1～1.4；US-4.2 依赖 US-3.1、US-4.1。无循环依赖；US-4.2 依赖 US-3.1 与 US-4.1，实施时需先完成 US-3.1 与 US-4.1，顺序正确。**结论**：依赖链维度通过。

### 2.9 前两轮未覆盖点的再审视

批判审计员对以下潜在盲点进行再审视：

**① US-1.1 交叉验证的精确含义**：文档写「与 aggregateByEpicStoryTimeWindow 在 epic+story 时结果一致（作为交叉验证）」。aggregateByEpicOnly 仅取 epic，无 story 参数；aggregateByEpicStoryTimeWindow 取 epic+story。交叉验证的合理理解为：对 fixture 中每个 (epic, story)，aggregateByEpicStoryTimeWindow(r, epic, story, w) 的结果应等于 aggregateByEpicOnly(r, epic, w) 按 story 筛选后的子集。即：aggregateByEpicOnly 筛选出的 E9 记录中，按 story 分组后，每组与 aggregateByEpicStoryTimeWindow 对应该 story 的结果一致。可编写单测验证。**不构成 gap**。

**② getEpicDimensionScores 的维度并集**：当不同 Story 的 dimension_scores 维度集合不同时（如 S1 有「功能性」「代码质量」，S2 有「功能性」「测试覆盖」），简单平均应对「同 dimension」做平均；未出现的维度在单 Story 中可能为「无数据」。getDimensionScores 已处理 fallbackDims，getEpicDimensionScores 可按「各 Story 的 dimension 并集」再对同维做 Story 级平均，实施逻辑可推断。**不构成 gap**。

**③ Epic 下仅有 1 个 Story 时的退化**：US-1.3 验收标准 2) 已要求「单 Story 时等价于 computeHealthScore」。退化路径已覆盖。**不构成 gap**。

### 2.10 批判审计员最终结论

**本轮无新 gap。**

批判审计员对 TASKS 文档执行了七维审计及对抗性二次审视。需求完整性、可执行性、与现有实现一致、边界与异常、孤岛风险、禁止词、依赖链七维均通过。第 1 轮 Gap-1、Gap-2 的修复在第 2 轮已确认充分，本轮复核未发现新的可验证性缺口、遗漏决策点或架构偏离。前两轮未覆盖的交叉验证语义、维度并集、退化路径等经审视后均不构成阻断性 gap。文档可实施、可验收，符合 audit-prompts §5 精神。

---

## 3. 轮次与收敛声明

**第 3 轮无新 gap**；连续 2 轮无 gap（第 2 轮、第 3 轮），累计至 3 轮后收敛。

**轮次说明**：

- 第 1 轮：存在 Gap-1（已排除 Story 列表未落验收）、Gap-2（run_id 时 epic 忽略无验证），未通过
- 第 2 轮：Gap-1、Gap-2 已修复，七维通过，**无新 gap**
- 第 3 轮：七维审计及对抗性再审视通过，**无新 gap**

满足「连续 3 轮无 gap」收敛条件，TASKS 文档可进入实施阶段。

---

*本审计报告由 code-reviewer 按 audit-prompts §5 精神执行，批判审计员结论占比 >70%。*
