# plan-E9-S4：迭代评分演进存储 实现方案

**Epic**：E9 feature-scoring-full-pipeline  
**Story ID**：9.4  
**输入**：spec-E9-S4.md、Story 9.4（9-4-iteration-score-evolution.md）、TASKS_9-4-iteration-score-evolution.md

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story | Coach/仪表盘演进轨迹 | Phase 3 | ✅ |
| AC-1 | spec §3.1 | Phase 1.1 | ✅ |
| AC-2 | spec §3.2 | Phase 1.2, 1.3 | ✅ |
| AC-3 | spec §3.4 | Phase 2 | ✅ |
| AC-4 | spec §3.5, §3.6 | Phase 3 | ✅ |
| AC-5 | spec §3.2.2 | Phase 1.2 | ✅ |
| AC-6 | spec §3.7 | Phase 3.4 | ✅ |
| REQ-1～5 | spec §3.1～3.8 | Phase 1～3 | ✅ |

---

## 2. 目标与约束

- **Phase 1**：Schema 扩展、parseAndWriteScore 支持 iterationReportPaths、CLI --iterationReportPaths
- **Phase 2**：speckit-workflow、bmad-story-assistant 路径约定
- **Phase 3**：Coach 演进轨迹、仪表盘演进轨迹、文档更新、单元测试与 E2E
- **必须包含**：集成测试与 E2E（parse-and-write iterationReportPaths 单测、CLI E2E、Coach/dashboard fixture 测试）

---

## 3. 实施分期

### Phase 1：Schema + 写入

#### Phase 1.1：IterationRecord schema 扩展（T1）

1. **scoring/writer/types.ts**：IterationRecord 新增 `overall_grade?: string`、`dimension_scores?: DimensionScore[]`
2. **scoring/schema/run-score-schema.json**：IterationRecord 定义新增 optional overall_grade、dimension_scores
3. **验收**：`npm run test:scoring -- scoring/__tests__/schema` 通过；旧 record 无新字段仍通过校验

#### Phase 1.2：parseAndWriteScore iterationReportPaths（T2）

1. **ParseAndWriteScoreOptions**：新增 `iterationReportPaths?: string[]`
2. **边界**：scenario=eval_question 时忽略；未提供或空时 iteration_records 保持 []
3. **主逻辑**：scenario=real_dev 且提供时，依次读取各路径；解析 overall_grade、dimension_scores、severity（从报告问题清单解析最高等级）、timestamp（mtime 或报告内时间）；构造 result='fail' 的 IterationRecord 按序 append；最后一条为 pass（来自 reportPath）
4. **验收**：单测 2 fail+1 pass → 3 条；未传/空 → []；eval_question → []

#### Phase 1.3：CLI --iterationReportPaths（T3）

1. **scripts/parse-and-write-score.ts**：解析 `--iterationReportPaths`（逗号分隔），传入 parseAndWriteScore
2. **Usage 更新**：help 文本含 --iterationReportPaths 说明
3. **验收**：--help 含该参数；E2E 写入含 3 条 iteration_records

### Phase 2：SKILL 路径约定

#### Phase 2.1：speckit-workflow（T4）

1. **.cursor/skills/speckit-workflow/SKILL.md**：各 stage 审计循环描述补充失败轮报告路径约定
2. 路径格式：`AUDIT_{stage}-E{epic}-S{story}_round{N}.md` 或 `_orphan/AUDIT_{slug}_round{N}.md`
3. 验证轮不列入 iterationReportPaths；run_id 在 stage 审计循环内复用
4. **验收**：grep 可查到路径约定、验证轮排除、iterationReportPaths

#### Phase 2.2：bmad-story-assistant（T5）

1. **.cursor/skills/bmad-story-assistant/SKILL.md**：阶段四及 Dev Story 嵌套 speckit 各 stage 审计 prompt 补充
2. fail 轮报告保存至 round 路径；验证轮不列入；pass 时收集 fail 轮路径传入 --iterationReportPaths
3. **验收**：grep 含 round 路径、iterationReportPaths、验证轮排除

### Phase 3：展示 + 文档 + 测试

#### Phase 3.1：Coach 演进轨迹（T6）

1. **scoring/coach/**：diagnose.ts 或 format.ts 中，当 iteration_records 非空且至少一条含 overall_grade 时，增加「演进轨迹」段落
2. 格式：`spec: 第1轮 C → 第2轮 B → 第3轮 A`；缺 overall_grade 用 `?`
3. **Fixture**：`scoring/data/__fixtures-coach/` 或新建含 iteration_records 的 fixture
4. **验收**：coach-diagnose 输出含轨迹

#### Phase 3.2：仪表盘演进轨迹（T7）

1. **scoring/dashboard/**：format.ts 或 compute.ts 中，对 high_iteration/短板 Top 3 的 record，若 iteration_records 非空，追加展示演进轨迹
2. 格式：`第1轮 C → 第2轮 B → 第3轮 A`
3. **Fixture**：复用或新建 `__fixtures-dashboard-epic-story/` 含 iteration_records
4. **验收**：dashboard-generate 输出含轨迹

#### Phase 3.3：文档更新（T8）

1. **docs/仪表盘健康度说明与数据分析指南.md**：补充 iteration_records 扩展说明、演进轨迹展示规则、单轮通过时为空
2. **验收**：grep "iteration_records" 可查

#### Phase 3.4：单元测试与 E2E（T9）

1. parse-and-write iterationReportPaths 单测
2. parse-and-write-score CLI --iterationReportPaths E2E（fixture 复用 scoring/parsers/__tests__/fixtures/）
3. Coach/dashboard 含 iteration_records 的集成 fixture 测试
4. **验收**：`npm run test:scoring` 全通过；E2E 可执行并断言

---

## 4. 集成测试与端到端功能测试计划（必须）

### 4.1 parse-and-write iterationReportPaths

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | 2 fail + 1 pass → 3 条 iteration_records | scoring/orchestrator/__tests__/ | iteration_records 含 3 条，前 2 条 result='fail' |
| 单元 | 未传 iterationReportPaths → [] | 同上 | iteration_records 为 [] |
| 单元 | scenario=eval_question 时传入 → [] | 同上 | iteration_records 仍为 [] |
| 集成 | CLI --iterationReportPaths | npx ts-node scripts/parse-and-write-score.ts ... | scoring/data 下 record 含 3 条 iteration_records |

### 4.2 Coach / Dashboard 演进轨迹展示

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 集成 | coach-diagnose 含 iteration_records fixture | npx ts-node scripts/coach-diagnose.ts | 输出含「第1轮 C → 第2轮 B → 第3轮 A」格式 |
| 集成 | dashboard-generate 含 iteration_records fixture | npx ts-node scripts/dashboard-generate.ts | 输出含演进轨迹 |
