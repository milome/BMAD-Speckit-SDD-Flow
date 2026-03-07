# Story 9.4: 迭代评分演进存储

Status: ready-for-dev

## Story

**As a** 技术负责人（TechLead），  
**I want** Coach 与仪表盘能展示各 stage 的评分演进轨迹（如「spec: 第1轮 C → 第2轮 B → 第3轮 A」），  
**so that** 可量化审计迭代的改进过程，早期失败轮的质量数据被写入 scoring 存储并参与分析，而非仅存于报告文件。

## 实施范围说明

本 Story 实施同目录 **TASKS_9-4-iteration-score-evolution.md**（或 `_orphan/TASKS_迭代评分演进存储.md`）中的 **T1～T9**。

**共识方案**（Party-Mode 100 轮，AUDIT_TASKS §5 三轮无 gap 收敛）：
- **Schema**：IterationRecord 新增 optional `overall_grade?: string`、`dimension_scores?: DimensionScore[]`，向后兼容
- **写入时机**：仅 pass 时调用 parseAndWriteScore；主 Agent 传入 `--iterationReportPaths path1,path2,...`（本 stage 所有失败轮报告路径，不含验证轮）
- **路径约定**：失败轮 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`，standalone `_orphan/AUDIT_{slug}_round{N}.md`；验证轮报告不列入 iterationReportPaths
- **展示**：Coach/仪表盘从 `record.iteration_records` 取 overall_grade 序列，格式 `第1轮 C → 第2轮 B → 第3轮 A`
- **边界**：scenario=eval_question 时忽略 iterationReportPaths；未提供或空时 iteration_records 保持 []；单轮通过、历史数据无回归

## Acceptance Criteria

| # | 需求 | 对应任务 | 验收标准 | 验证方式 |
|---|------|----------|----------|----------|
| AC-1 | IterationRecord 含 optional overall_grade、dimension_scores | T1 | 类型与 schema 一致；旧 record 仍通过校验 | `npm run test:scoring -- scoring/__tests__/schema` |
| AC-2 | parseAndWriteScore 支持 iterationReportPaths，解析并写入 iteration_records | T2, T3 | 2 fail + 1 pass → 3 条；未传或 eval_question 时 iteration_records 为 [] | 单元测试 + E2E |
| AC-3 | 失败轮报告路径约定写入 speckit-workflow、bmad-story-assistant | T4, T5 | round 路径、验证轮排除、iterationReportPaths 传递均写明 | grep 验收 |
| AC-4 | Coach/仪表盘可展示演进轨迹（有数据时） | T6, T7 | 输出含 `第1轮 C → 第2轮 B → 第3轮 A` 格式 | fixture 运行 coach-diagnose、dashboard-generate |
| AC-5 | 单轮通过、eval_question 场景 iteration_records 为空，无回归 | T2, T9 | 现有单测通过；scenario=eval_question 时 iteration_records 仍为 [] | `npm run test:scoring` |
| AC-6 | 文档更新（仪表盘健康度说明） | T8 | 含 iteration_records 扩展说明及演进轨迹展示约定 | grep 验收 |

## Tasks（引用 TASKS §7）

- [x] **T1** 扩展 IterationRecord schema（overall_grade、dimension_scores）
- [x] **T2** parseAndWriteScore 支持 iterationReportPaths
- [x] **T3** parse-and-write-score CLI 新增 --iterationReportPaths
- [x] **T4** speckit-workflow 约定失败轮报告保存路径与验证轮排除
- [x] **T5** bmad-story-assistant 约定失败轮报告保存路径与验证轮排除
- [x] **T6** Coach 演进轨迹展示
- [x] **T7** 仪表盘演进轨迹展示
- [x] **T8** 文档更新（仪表盘健康度说明）
- [x] **T9** 单元测试与 E2E 覆盖

## 验收命令

```bash
npm run test:scoring -- scoring/__tests__/schema
npm run test:scoring -- scoring/orchestrator
npx ts-node scripts/parse-and-write-score.ts --help
grep -E "_round|round\{N\}|验证轮|iterationReportPaths" skills/speckit-workflow/SKILL.md
grep -E "_round|round\{N\}|验证轮|iterationReportPaths" skills/bmad-story-assistant/SKILL.md
npx ts-node scripts/coach-diagnose.ts
npx ts-node scripts/dashboard-generate.ts
grep "iteration_records" docs/BMAD/仪表盘健康度说明与数据分析指南.md
```

## 需求追溯

| 需求 ID | 描述 | 对应 AC | 对应任务 | 状态 |
|---------|------|---------|----------|------|
| REQ-1 | IterationRecord 扩展 optional overall_grade、dimension_scores，向后兼容 | AC-1 | T1 | 待实施 |
| REQ-2 | 失败轮报告路径约定（_round{N} 后缀），主 Agent 可收集并传入 parse-and-write-score | AC-3 | T4, T5 | 待实施 |
| REQ-3 | parseAndWriteScore 支持 iterationReportPaths，pass 时一次性解析并写入 iteration_records | AC-2 | T2, T3 | 待实施 |
| REQ-4 | Coach 与仪表盘展示演进轨迹（有数据时） | AC-4 | T6, T7 | 待实施 |
| REQ-5 | eval_question、单轮通过、历史数据、验证轮均按边界处理，无回归 | AC-5 | T2, T9 | 待实施 |

## 依赖

- Story 9.1（parseAndWriteScore、scoring 存储、coach-diagnose、dashboard-generate 已落地）

## Dev Notes

- **架构约束**：scoring 模块（scoring/writer/types.ts、scoring/schema/、scoring/orchestrator/、scoring/coach/、scoring/dashboard/）；IterationRecord 向后兼容，旧 record 无新字段仍通过校验
- **修改路径汇总**：`scoring/writer/types.ts`、`scoring/schema/run-score-schema.json`、`scoring/orchestrator/parse-and-write.ts`、`scripts/parse-and-write-score.ts`、`skills/speckit-workflow/SKILL.md`、`skills/bmad-story-assistant/SKILL.md`、`scoring/coach/diagnose.ts` 或 `format.ts`、`scoring/dashboard/format.ts` 或 `compute.ts`、`docs/BMAD/仪表盘健康度说明与数据分析指南.md`
- **Fixture 要求**：iteration_records 至少含 2 条、至少 1 条含 overall_grade；可复用 `scoring/parsers/__tests__/fixtures/`、`scoring/data/__fixtures-coach/`、`__fixtures-dashboard-epic-story/`
- **验收命令汇总**：见上文「验收命令」区块

### 参考

- **TASKS 文档**：同目录 `TASKS_9-4-iteration-score-evolution.md`
- **原始 TASKS**：`_orphan/TASKS_迭代评分演进存储.md`
- **关联文档**：`_orphan/DEBATE_迭代评分演进存储_100轮共识与TASKS.md`
- **审计报告**：AUDIT_TASKS_迭代评分演进存储_§5_第1～3轮（连续 3 轮无 gap 收敛）

## Dev Agent Record

| 项 | 内容 |
|----|------|
| Agent Model Used | 实施时填写 |
| Debug Log References | 实施时填写 |
| Completion Notes List | 实施时填写 |
| File List | 实施时填写 |
