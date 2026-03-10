# IMPLEMENTATION_GAPS-E9-S4：迭代评分演进存储

**Epic**：E9 feature-scoring-full-pipeline  
**Story ID**：9.4  
**输入**：spec-E9-S4.md、plan-E9-S4.md、Story 9.4、当前实现

---

## Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| AC-1, REQ-1 | GAP-1.1 | IterationRecord 含 optional overall_grade、dimension_scores | 未实现 | types.ts 与 run-score-schema.json 中 IterationRecord 仅有 timestamp、result、severity、note |
| AC-2, REQ-3 | GAP-2.1 | parseAndWriteScore 支持 iterationReportPaths | 未实现 | ParseAndWriteScoreOptions 无 iterationReportPaths；parse-and-write.ts 始终写 iteration_records: [] |
| AC-2 | GAP-2.2 | 2 fail + 1 pass → 3 条 iteration_records | 未实现 | 无失败轮报告解析与组装逻辑 |
| AC-3, REQ-2 | GAP-3.1 | 失败轮报告路径约定 speckit-workflow | 未实现 | speckit-workflow SKILL.md 无 _round{N}、验证轮排除、iterationReportPaths 约定 |
| AC-3, REQ-2 | GAP-3.2 | 失败轮报告路径约定 bmad-story-assistant | 未实现 | bmad-story-assistant SKILL.md 无上述约定 |
| AC-4, REQ-4 | GAP-4.1 | Coach 演进轨迹展示 | 未实现 | diagnose.ts 传递 iteration_records 但不格式化展示 overall_grade 序列 |
| AC-4, REQ-4 | GAP-4.2 | 仪表盘演进轨迹展示 | 未实现 | dashboard format/compute 无 iteration_records 演进轨迹输出 |
| AC-5, REQ-5 | GAP-2.3 | eval_question、单轮通过时 iteration_records 为空 | 部分满足 | 当前恒为空，边界逻辑未显式实现 |
| AC-6 | GAP-5.1 | 文档更新 iteration_records 扩展 | 未实现 | 仪表盘健康度说明.md 无 iteration_records 扩展与演进轨迹约定 |
| T3 | GAP-6.1 | CLI --iterationReportPaths | 未实现 | parse-and-write-score.ts 无该参数 |
| T9 | GAP-7.1 | 单元测试与 E2E | 未实现 | 无 iterationReportPaths 单测、CLI E2E、Coach/dashboard fixture 测试 |

---

## Gaps → 任务映射

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Schema | GAP-1.1 | ✓ 有 | T1 |
| parseAndWrite | GAP-2.1, GAP-2.2, GAP-2.3 | ✓ 有 | T2 |
| CLI | GAP-6.1 | ✓ 有 | T3 |
| SKILL | GAP-3.1, GAP-3.2 | ✓ 有 | T4, T5 |
| Coach/Dashboard | GAP-4.1, GAP-4.2 | ✓ 有 | T6, T7 |
| 文档 | GAP-5.1 | ✓ 有 | T8 |
| 测试 | GAP-7.1 | ✓ 有 | T9 |
