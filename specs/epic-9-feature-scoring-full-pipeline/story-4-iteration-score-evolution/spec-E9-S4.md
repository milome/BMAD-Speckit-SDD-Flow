# Spec E9-S4：迭代评分演进存储

*Story 9.4 技术规格*  
*Epic 9 feature-scoring-full-pipeline*

---

## 1. 概述

本 spec 将 Story 9.4 的实施范围固化为可执行技术规格，覆盖：

1. **IterationRecord schema 扩展**：新增 optional `overall_grade`、`dimension_scores`，向后兼容
2. **parseAndWriteScore 扩展**：支持 `iterationReportPaths` 参数，pass 时一次性解析失败轮报告并组装 iteration_records
3. **CLI 扩展**：`--iterationReportPaths` 逗号分隔路径
4. **路径约定**：失败轮报告 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md` 或 `_orphan/AUDIT_{slug}_round{N}.md`；验证轮不列入
5. **Coach/仪表盘展示**：从 `record.iteration_records` 取 overall_grade 序列，格式 `第1轮 C → 第2轮 B → 第3轮 A`
6. **边界处理**：scenario=eval_question 时忽略 iterationReportPaths；未提供或空时 iteration_records 保持 []；单轮通过时 iteration_records 为 []

**输入来源**：
- Story 9.4（9-4-iteration-score-evolution.md）
- TASKS_9-4-iteration-score-evolution.md
- scoring/writer/types.ts、scoring/schema/run-score-schema.json、scoring/orchestrator/parse-and-write.ts

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story | Coach 与仪表盘展示评分演进轨迹 | spec §3.5, §3.6 | ✅ |
| AC-1 | IterationRecord 含 optional overall_grade、dimension_scores | spec §3.1 | ✅ |
| AC-2 | parseAndWriteScore 支持 iterationReportPaths，2 fail+1 pass → 3 条 | spec §3.2 | ✅ |
| AC-3 | 失败轮报告路径约定 speckit-workflow、bmad-story-assistant | spec §3.4 | ✅ |
| AC-4 | Coach/仪表盘演进轨迹格式 | spec §3.5, §3.6 | ✅ |
| AC-5 | 单轮通过、eval_question 时 iteration_records 为空 | spec §3.2.2 | ✅ |
| AC-6 | 文档更新 | spec §3.7 | ✅ |
| REQ-1 | IterationRecord 扩展，向后兼容 | spec §3.1 | ✅ |
| REQ-2 | 失败轮报告路径约定 | spec §3.4 | ✅ |
| REQ-3 | parseAndWriteScore iterationReportPaths | spec §3.2 | ✅ |
| REQ-4 | Coach 与仪表盘展示演进轨迹 | spec §3.5, §3.6 | ✅ |
| REQ-5 | 边界处理（eval_question、单轮通过） | spec §3.2.2 | ✅ |

---

## 3. 功能规格

### 3.1 IterationRecord schema 扩展（AC-1, REQ-1, T1）

| 项 | 规格 |
|------|------|
| 修改路径 | `scoring/writer/types.ts`、`scoring/schema/run-score-schema.json` |
| 新增字段 | `overall_grade?: string`（A\|B\|C\|D）、`dimension_scores?: DimensionScore[]` |
| 必填保持 | timestamp、result、severity 为必填；note 为 optional |
| 向后兼容 | 旧 record 无新字段仍通过 schema 校验 |
| 验收 | `npm run test:scoring -- scoring/__tests__/schema` 通过 |

### 3.2 parseAndWriteScore 支持 iterationReportPaths（AC-2, AC-5, REQ-3, REQ-5, T2）

#### 3.2.1 参数与时机

| 项 | 规格 |
|------|------|
| 新增 options | `iterationReportPaths?: string[]`，仅含失败轮报告路径，不含验证轮 |
| scenario=eval_question | 忽略 iterationReportPaths，iteration_records 保持 [] |
| 未提供或空 | iteration_records 保持 [] |
| 写入时机 | 仅 pass 时（主 reportPath 解析通过）调用；主 Agent 传入失败轮路径 |

#### 3.2.2 解析与组装逻辑

| 项 | 规格 |
|------|------|
| 顺序 | 依次读取 iterationReportPaths 各路径，解析 overall_grade、dimension_scores |
| IterationRecord 构造 | result='fail'；severity 从报告问题清单解析最高等级（fatal>serious>normal>minor），缺失用 `normal`；timestamp 用报告文件 mtime 或报告内可解析时间，否则用当前写入时间 |
| 最后一条 | 来自 reportPath 的 pass，result='pass' |
| pass 的 phase_score、check_items | 由主流程计算，不变 |

#### 3.2.3 验收

| 验收项 | 预期 |
|--------|------|
| 2 fail + 1 pass | 3 条 iteration_records，前 2 条 result='fail' 且含 overall_grade |
| 未传 iterationReportPaths | iteration_records 为 [] |
| scenario=eval_question 时传入 | iteration_records 仍为 [] |

### 3.3 CLI --iterationReportPaths（T3）

| 项 | 规格 |
|------|------|
| 修改路径 | `scripts/parse-and-write-score.ts` |
| 参数 | `--iterationReportPaths`，值为逗号分隔路径列表 |
| 传递 | 解析为 string[] 传入 parseAndWriteScore |
| 验收 | `npx ts-node scripts/parse-and-write-score.ts --help` 含 `--iterationReportPaths`；E2E 写入含 3 条 iteration_records |

### 3.4 失败轮报告路径约定（AC-3, REQ-2, T4, T5）

| 项 | 规格 |
|------|------|
| BMAD 路径 | `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`，N 从 1 递增 |
| standalone | `_orphan/AUDIT_{slug}_round{N}.md` |
| 验证轮排除 | 连续 3 轮无 gap 的确认轮报告不列入 iterationReportPaths |
| 修改位置 | speckit-workflow SKILL.md、bmad-story-assistant SKILL.md |
| 验收 | grep 含 `_round`、`round{N}`、`验证轮`、`iterationReportPaths` |

### 3.5 Coach 演进轨迹展示（AC-4, REQ-4, T6）

| 项 | 规格 |
|------|------|
| 修改路径 | `scoring/coach/diagnose.ts` 或 `format.ts` |
| 触发条件 | record.iteration_records 非空且至少一条含 overall_grade |
| 格式 | `spec: 第1轮 C → 第2轮 B → 第3轮 A`；缺 overall_grade 用 `?` 占位 |
| 验收 | fixture 含 iteration_records 运行 coach-diagnose，输出含上述格式 |

### 3.6 仪表盘演进轨迹展示（AC-4, REQ-4, T7）

| 项 | 规格 |
|------|------|
| 修改路径 | `scoring/dashboard/format.ts` 或 `compute.ts`、`scripts/dashboard-generate.ts` |
| 展示位置 | high_iteration Top 3 或短板 Top 3 的 record |
| 格式 | `第1轮 C → 第2轮 B → 第3轮 A` |
| 验收 | fixture 含 iteration_records 运行 dashboard-generate，输出含轨迹 |

### 3.7 文档更新（AC-6, T8）

| 项 | 规格 |
|------|------|
| 修改路径 | `docs/仪表盘健康度说明与数据分析指南.md` |
| 内容 | iteration_records 可含 overall_grade、dimension_scores；演进轨迹展示规则；单轮通过时 iteration_records 为空 |
| 验收 | grep "iteration_records" 可查 |

### 3.8 单元测试与 E2E（T9）

| 项 | 规格 |
|------|------|
| parse-and-write | iterationReportPaths 单测 |
| CLI | --iterationReportPaths E2E |
| Coach/dashboard | 含 iteration_records 的集成 fixture 测试 |
| 验收 | `npm run test:scoring` 全通过；E2E 可执行并断言 |
