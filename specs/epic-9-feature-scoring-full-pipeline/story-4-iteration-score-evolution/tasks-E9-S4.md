# Tasks E9-S4：迭代评分演进存储

**Input**: spec-E9-S4.md、plan-E9-S4.md、IMPLEMENTATION_GAPS-E9-S4.md、Story 9.4、TASKS_9-4-iteration-score-evolution.md  
**Prerequisites**: plan.md ✓、spec.md ✓、IMPLEMENTATION_GAPS.md ✓

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 9.4, spec §3.1 | AC-1, REQ-1, GAP-1.1 | IterationRecord schema 扩展 overall_grade、dimension_scores |
| T2 | spec §3.2 | AC-2, AC-5, REQ-3, REQ-5, GAP-2.x | parseAndWriteScore iterationReportPaths |
| T3 | spec §3.3 | GAP-6.1 | CLI --iterationReportPaths |
| T4 | spec §3.4 | AC-3, REQ-2, GAP-3.1 | speckit-workflow 失败轮路径约定 |
| T5 | spec §3.4 | AC-3, REQ-2, GAP-3.2 | bmad-story-assistant 失败轮路径约定 |
| T6 | spec §3.5 | AC-4, REQ-4, GAP-4.1 | Coach 演进轨迹展示 |
| T7 | spec §3.6 | AC-4, REQ-4, GAP-4.2 | 仪表盘演进轨迹展示 |
| T8 | spec §3.7 | AC-6, GAP-5.1 | 文档更新 |
| T9 | spec §3.8 | GAP-7.1 | 单元测试与 E2E |

---

## 2. Gaps → 任务映射

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Schema | GAP-1.1 | ✓ 有 | T1 |
| parseAndWrite | GAP-2.1, 2.2, 2.3 | ✓ 有 | T2 |
| CLI | GAP-6.1 | ✓ 有 | T3 |
| SKILL | GAP-3.1, 3.2 | ✓ 有 | T4, T5 |
| Coach/Dashboard | GAP-4.1, 4.2 | ✓ 有 | T6, T7 |
| 文档 | GAP-5.1 | ✓ 有 | T8 |
| 测试 | GAP-7.1 | ✓ 有 | T9 |

---

## Phase 1：Schema + 写入（T1–T3）

### T1 [x] 扩展 IterationRecord schema（GAP-1.1）

- **修改**：`scoring/writer/types.ts`、`scoring/schema/run-score-schema.json`
- **内容**：IterationRecord 新增 optional `overall_grade?: string`（A|B|C|D）、`dimension_scores?: DimensionScore[]`；保持 timestamp、result、severity 必填
- **验收**：`npm run test:scoring -- scoring/__tests__/schema` 通过；旧 record 无新字段仍通过校验

### T2 [x] parseAndWriteScore 支持 iterationReportPaths（GAP-2.1, 2.2, 2.3）

- **修改**：`scoring/orchestrator/parse-and-write.ts`、`ParseAndWriteScoreOptions`
- **内容**：新增 `iterationReportPaths?: string[]`；scenario=eval_question 时忽略；未提供或空时 iteration_records 保持 []；scenario=real_dev 且提供时：依次解析各路径（overall_grade、dimension_scores、severity、timestamp），构造 result='fail' 的 IterationRecord 按序 append；最后一条为 pass（来自 reportPath）
- **验收**：单测 2 fail+1 pass → 3 条；未传/空 → []；eval_question → []

### T3 [x] parse-and-write-score CLI --iterationReportPaths（GAP-6.1）

- **修改**：`scripts/parse-and-write-score.ts`
- **内容**：新增 `--iterationReportPaths`，逗号分隔解析为 string[]；传入 parseAndWriteScore；usage 更新
- **验收**：`npx ts-node scripts/parse-and-write-score.ts --help` 含该参数；E2E 写入含 3 条 iteration_records

---

## Phase 2：SKILL 约定（T4–T5）

### T4 [x] speckit-workflow 失败轮路径约定（GAP-3.1）

- **修改**：`.cursor/skills/speckit-workflow/SKILL.md`
- **内容**：各 stage 审计循环描述补充：失败轮报告保存至 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md` 或 `_orphan/AUDIT_{slug}_round{N}.md`；验证轮不列入 iterationReportPaths；run_id 在 stage 内复用
- **验收**：grep `_round`、`round{N}`、`验证轮`、`iterationReportPaths` 有匹配

### T5 [x] bmad-story-assistant 失败轮路径约定（GAP-3.2）

- **修改**：`.cursor/skills/bmad-story-assistant/SKILL.md`
- **内容**：阶段四及 Dev Story 嵌套 speckit 各 stage 审计 prompt 补充：fail 轮保存至 round 路径；验证轮不列入；pass 时收集 fail 轮路径传入 --iterationReportPaths
- **验收**：grep 含 round 路径、iterationReportPaths、验证轮排除

---

## Phase 3：展示 + 文档 + 测试（T6–T9）

### T6 [x] Coach 演进轨迹展示（GAP-4.1）

- **修改**：`scoring/coach/diagnose.ts` 或 `format.ts`
- **内容**：当 iteration_records 非空且至少一条含 overall_grade 时，增加「演进轨迹」段落，格式 `spec: 第1轮 C → 第2轮 B → 第3轮 A`；缺 overall_grade 用 `?`
- **验收**：fixture 含 iteration_records 运行 coach-diagnose，输出含轨迹

### T7 [x] 仪表盘演进轨迹展示（GAP-4.2）

- **修改**：`scoring/dashboard/format.ts` 或 `compute.ts`、`scripts/dashboard-generate.ts`
- **内容**：对 high_iteration/短板 Top 3 的 record，若 iteration_records 非空，追加展示 `第1轮 C → 第2轮 B → 第3轮 A`
- **验收**：fixture 含 iteration_records 运行 dashboard-generate，输出含轨迹

### T8 [x] 文档更新（GAP-5.1）

- **修改**：`docs/仪表盘健康度说明与数据分析指南.md`
- **内容**：补充 iteration_records 可含 overall_grade、dimension_scores；演进轨迹展示规则；单轮通过时 iteration_records 为空
- **验收**：grep "iteration_records" 可查

### T9 [x] 单元测试与 E2E（GAP-7.1）

- **内容**：1) parse-and-write iterationReportPaths 单测；2) CLI --iterationReportPaths E2E；3) Coach/dashboard 含 iteration_records 的集成 fixture 测试
- **验收**：`npm run test:scoring` 全通过；E2E 可执行并断言
