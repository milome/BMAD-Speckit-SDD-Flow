# AUDIT spec-E9-S3：Epic 级仪表盘聚合 spec 审计

**Story**：9.3 Epic 级仪表盘聚合  
**审计阶段**：spec（audit-prompts §1）  
**审计日期**：2026-03-07  
**审计依据**：Story 9.3、TASKS_Epic级仪表盘聚合.md、spec-E9-S3.md

---

## 1. 逐条检查与验证

### 1.1 需求覆盖检查

| 原始文档章节 | 需求要点 | spec 对应 | 验证方式 | 验证结果 |
|-------------|----------|-----------|----------|----------|
| Story 9.3 | Epic 下多 Story 聚合健康度视图 | §1 概述、§3 功能规格 | 逐条对照 | ✅ 完全覆盖 |
| AC-1 | aggregateByEpicOnly 单测 | §3.1 | 签名、逻辑、验收明确 | ✅ |
| AC-2 | getEpicAggregateRecords 单测 | §3.2 | 完整 run 定义、排除规则 | ✅ |
| AC-3 | computeEpicHealthScore 单测 | §3.3 | 方案 A（简单平均）明确 | ✅ |
| AC-4 | getEpicDimensionScores 单测 | §3.4 | 维度合并与平均规则 | ✅ |
| AC-5 | getLatestRunRecordsV2 epic-only | §3.5 | 条件、约束、strategy 语义 | ✅ |
| AC-6 | dashboard-generate --epic 9 | §3.6 | 空数据提示、验收命令 | ✅ |
| AC-7 | Epic 聚合视图标识 | §3.7 | viewMode、excludedStories | ✅ |
| AC-8 | 单测与集成测试 | §4 | 验收命令汇总 | ✅ |
| TASKS §2.1～2.6 | 聚合方式、排除、CLI、过滤策略 | §3.2～§3.8 | 需求映射清单 | ✅ |

### 1.2 模糊表述检查

- **术语**：`完整 run` 在 §3.2 明确定义为「至少 3 个不同 effective stage」，与 compute.ts 的 MIN_STAGES_COMPLETE_RUN 一致。无歧义。
- **边界**：`epic != null && story == null`、`strategy=epic_story_window` 条件明确；run_id 时 epic 忽略已说明。
- **验收可量化**：各 AC 均有单测 fixture 描述或命令可执行，可验证。

**结论**：spec 无模糊表述，无需触发 clarify。

---

## 2. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块（前置文档）、伪实现（spec 为设计文档不适用）、术语歧义、需求映射完整性。

**每维度结论**：

- **遗漏需求点**：已逐条对照 Story 9.3、TASKS_Epic级仪表盘聚合.md §1～§7。AC-1～AC-8、TASKS §2.1～2.6、US-4.2 验收 3) 均已在 spec 中覆盖。需求映射清单 §2 完整列出原始文档章节与 spec 对应。无遗漏。

- **边界未定义**：完整 run 定义（≥3 effective stage）在 §3.2 明确；不完整 Story 排除逻辑在 §3.2、§3.7 说明；epic/story 过滤仅在 epic_story_window 有效、run_id 时 epic 忽略在 §3.5、§3.8 明确；空数据提示在 §3.6 含关键词约定。无边界缺口。

- **验收不可执行**：§4 验收命令为可执行命令：`npm run test:scoring -- scoring/dashboard`、`npx ts-node scripts/dashboard-generate.ts --epic 9 --strategy epic_story_window`、`grep -E "Epic 9|Epic 9 聚合"`、`grep -r "epic_story_window\|epic.*过滤"`。各 §3.x 验收项均有 fixture 或命令描述，可量化验证。无不可执行项。

- **与前置文档矛盾**：spec 与 Story 9.3、TASKS 描述一致；方案 A（Per-Story 后简单平均）与 TASKS §2.1 一致；范围排除 §5 与 TASKS §4 一致。无矛盾。

- **孤岛模块（前置文档）**：spec 为设计文档，不涉及实现。各函数（aggregateByEpicOnly、getEpicAggregateRecords 等）均标明被调用链（getEpicAggregateRecords 被 getLatestRunRecordsV2 调用，最终由 dashboard-generate 使用）。设计上无孤岛风险。

- **术语歧义**：`effective stage`、`epic_story_window`、`run_id`、`MIN_STAGES_COMPLETE_RUN` 在 spec 或引用文档中可追溯。无歧义。

- **需求映射完整性**：§2 需求映射清单覆盖 Story、AC-1～AC-8、TASKS §2.1～2.6、US-4.2 验收 3)，且每行有 spec 对应位置与覆盖状态。完整。

**本轮结论**：本轮无新 gap。建议累计至连续 3 轮无 gap 后收敛；本审计为单次 spec 文档审计，结论为完全覆盖、验证通过。

---

## 3. 结论

**完全覆盖、验证通过。**

spec-E9-S3.md 完全覆盖 Story 9.3、TASKS_Epic级仪表盘聚合.md 所有章节；需求映射清单完整；功能规格 §3.1～§3.8 明确；非功能需求 §4 含验收命令；范围排除 §5 与 TASKS 一致。无模糊表述，无遗漏，无矛盾。

**报告保存路径**：`specs/epic-9-feature-scoring-full-pipeline/story-3-epic-dashboard-aggregate/AUDIT_spec-E9-S3.md`  
**iteration_count**：0（一次通过）

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 93/100
- 可追溯性: 94/100
