# TASKS：Story 9.4 迭代评分演进存储（C→B→A）

**产出日期**：2026-03-06  
**Epic**：9 feature-scoring-full-pipeline  
**Story**：9.4 iteration-score-evolution  
**路径**：`_bmad-output/implementation-artifacts/epic-9-feature-scoring-full-pipeline/story-9-4-iteration-score-evolution/TASKS_9-4-iteration-score-evolution.md`  
**原始来源**：`_orphan/TASKS_迭代评分演进存储.md`（Party-Mode 100 轮，批判审计员 >70%，最后 3 轮无 gap 收敛）  
**关联文档**：`_orphan/DEBATE_迭代评分演进存储_100轮共识与TASKS.md`

---

## §1 背景与目标

- **现状**：每轮审计报告均含可解析评分块（总体评级、维度评分），但仅**通过**轮调用 parseAndWriteScore 写入 scoring 存储；iteration_records 恒为空 []。
- **问题**：早期轮次（第 1、2 轮）最能暴露问题，但数据只存于报告文件，未写入 scoring。
- **目标**：支持「改进轨迹」分析，Coach/仪表盘可展示「第 1 轮 C → 第 2 轮 B → 第 3 轮 A」。

---

## §2 需求/范围

| 需求 ID | 描述 |
|---------|------|
| REQ-1 | IterationRecord 扩展 optional overall_grade、dimension_scores，向后兼容 |
| REQ-2 | 失败轮报告路径约定（_round{N} 后缀），主 Agent 可收集并传入 parse-and-write-score |
| REQ-3 | parseAndWriteScore 支持 iterationReportPaths，pass 时一次性解析并写入 iteration_records |
| REQ-4 | Coach 与仪表盘展示演进轨迹（有数据时） |
| REQ-5 | eval_question、单轮通过、历史数据、验证轮均按边界处理，无回归 |

---

## §3 方案概述

- **Schema**：IterationRecord 新增 `overall_grade?: string`、`dimension_scores?: DimensionScore[]`。
- **写入时机**：仅 pass 时调用 parseAndWriteScore；主 Agent 传入 `--iterationReportPaths path1,path2,...`（本 stage 所有失败轮报告路径）；一次性解析并组装 iteration_records。
- **路径约定**：失败轮 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`；standalone `_orphan/AUDIT_{slug}_round{N}.md`。
- **展示**：Coach/仪表盘从 `record.iteration_records` 取 overall_grade 序列，格式 `第1轮 C → 第2轮 B → 第3轮 A`。

---

## §4 验收标准

| ID | 验收项 | 验证方式 |
|----|--------|----------|
| AC-1 | IterationRecord 含 optional overall_grade、dimension_scores | Schema 校验、单测 |
| AC-2 | parseAndWriteScore 支持 --iterationReportPaths，解析并写入 iteration_records | 单元测试 + E2E |
| AC-3 | 失败轮报告路径约定写入 speckit-workflow / bmad-story-assistant | grep 验收 |
| AC-4 | Coach/仪表盘可展示演进轨迹（有数据时） | 手工或 E2E |
| AC-5 | 单轮通过、eval_question 场景 iteration_records 为空，无回归 | 现有单测通过 |

---

## §7 任务列表

### T1：扩展 IterationRecord schema（overall_grade、dimension_scores）

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/writer/types.ts`、`scoring/schema/run-score-schema.json` |
| **描述** | 在 IterationRecord 中新增 optional 字段：`overall_grade?: string`（A\|B\|C\|D）、`dimension_scores?: DimensionScore[]`；保持既有 timestamp、result、severity 为必填，note 为 optional。 |
| **验收方式** | 1) 类型定义与 schema 一致；2) `npm run test:scoring -- scoring/__tests__/schema` 通过；3) 旧 record（无新字段）仍通过校验 |
| **依赖** | 无 |

---

### T2：parseAndWriteScore 支持 iterationReportPaths

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/orchestrator/parse-and-write.ts`、`ParseAndWriteScoreOptions` |
| **描述** | 新增 options 字段 `iterationReportPaths?: string[]`（**仅含失败轮**报告路径，**不含验证轮**报告）。**scenario=eval_question 时忽略 iterationReportPaths**，iteration_records 保持 []。当 scenario=real_dev 且提供时：1) 依次读取各路径，解析 overall_grade、dimension_scores，构造 result='fail' 的 IterationRecord 并按顺序 append；2) **severity**：从报告问题清单解析最高严重等级（fatal>serious>normal>minor），缺失时用 `normal`；3) **timestamp**：用报告文件 mtime（ISO 8601）或报告内可解析时间，否则用当前写入时间；4) 最后一条为 pass（来自 reportPath），result='pass'。**若 iterationReportPaths 未提供或空，iteration_records 保持 []**。pass 的 phase_score、check_items 仍由主流程计算。 |
| **验收方式** | 1) 单测：2 fail + 1 pass → 3 条 iteration_records，前 2 条 result='fail' 且含 overall_grade；2) 未传 iterationReportPaths 时 iteration_records 为 []；3) scenario=eval_question 时传入 iterationReportPaths，iteration_records 仍为 [] |
| **依赖** | T1 |

---

### T3：parse-and-write-score CLI 新增 --iterationReportPaths

| 项 | 内容 |
|----|------|
| **修改路径** | `scripts/parse-and-write-score.ts` |
| **描述** | 新增 CLI 参数 `--iterationReportPaths`，值为逗号分隔路径列表；解析后传入 parseAndWriteScore。Usage 文本更新。 |
| **验收方式** | `npx ts-node scripts/parse-and-write-score.ts --help` 含 `--iterationReportPaths`；执行时 path1/path2 为 fail 报告、path3 为 pass 报告（可复用 `scoring/parsers/__tests__/fixtures/` 下样本报告，复制为 round1/round2 等），成功写入含 3 条 iteration_records 的 record |
| **依赖** | T2 |

---

### T4：约定失败轮报告保存路径（speckit-workflow）

| 项 | 内容 |
|----|------|
| **修改路径** | `skills/speckit-workflow/SKILL.md` |
| **描述** | 在各 stage（spec/plan/gaps/tasks/implement）审计循环描述中补充：每轮审计（含 fail）须将报告保存至带 round 后缀路径，如 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`，N 从 1 递增；standalone 时 `_orphan/AUDIT_{slug}_round{N}.md`。**验证轮（连续 3 轮无 gap 的确认轮）报告不列入 iterationReportPaths**，仅 fail 轮及最终 pass 轮参与收集。审计循环内 run_id 须稳定，由主 Agent 在循环开始时生成一次并复用。 |
| **验收方式** | grep `_round` 或 `round{N}` 在 speckit-workflow SKILL 中有明确路径约定；grep「验证轮」「iterationReportPaths」含排除验证轮的说明 |
| **依赖** | 无 |

---

### T5：约定失败轮报告保存路径（bmad-story-assistant）

| 项 | 内容 |
|----|------|
| **修改路径** | `skills/bmad-story-assistant/SKILL.md` |
| **描述** | 在阶段四及 Dev Story 嵌套的 speckit 各 stage 审计 prompt 中补充：fail 轮报告须保存至 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`（或等价规则）；**验证轮报告不列入 iterationReportPaths**；pass 时主 Agent 收集本 stage 所有 fail 轮报告路径，传入 `--iterationReportPaths`。run_id 在 stage 审计循环内复用。 |
| **验收方式** | grep 审计 prompt 或「审计通过后评分写入触发」段落含 round 路径约定、iterationReportPaths 传递说明及验证轮排除规则 |
| **依赖** | 无 |

---

### T6：Coach 演进轨迹展示

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/coach/diagnose.ts` 或 `format.ts` |
| **描述** | 当 record.iteration_records 非空且至少一条含 overall_grade 时，在 Coach 输出中增加「演进轨迹」段落，格式如：`spec: 第1轮 C → 第2轮 B → 第3轮 A`。缺 overall_grade 的 record 用 `?` 占位。 |
| **验收方式** | 对含 iteration_records 的 fixture 运行 coach-diagnose，输出含上述格式轨迹；**fixture 要求**：iteration_records 至少含 2 条，其中至少 1 条含 overall_grade（可新建或改 `scoring/data/__fixtures-coach/` 等） |
| **依赖** | T1, T2 |

---

### T7：仪表盘演进轨迹展示

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/dashboard/format.ts` 或 `compute.ts`、`scripts/dashboard-generate.ts` |
| **描述** | 在仪表盘输出中，对 high_iteration Top 3 或短板 Top 3 的 record，若 iteration_records 非空，追加展示演进轨迹，格式：`第1轮 C → 第2轮 B → 第3轮 A`。 |
| **验收方式** | 使用含 iteration_records 的 fixture 运行 dashboard-generate，输出含轨迹；**fixture 要求**：iteration_records 至少含 2 条，其中至少 1 条含 overall_grade（可复用 `__fixtures-dashboard-epic-story/` 并修改或新增） |
| **依赖** | T1, T2 |

---

### T8：文档更新（仪表盘健康度说明）

| 项 | 内容 |
|----|------|
| **修改路径** | `docs/BMAD/仪表盘健康度说明与数据分析指南.md` |
| **描述** | 在数据源/加载/去重章节补充：iteration_records 可含 overall_grade、dimension_scores；演进轨迹展示规则；单轮通过时 iteration_records 为空。 |
| **验收方式** | 文档含 iteration_records 扩展说明及演进轨迹展示约定 |
| **依赖** | T6, T7 |

---

### T9：单元测试与 E2E 覆盖

| 项 | 内容 |
|----|------|
| **描述** | 1) parse-and-write 的 iterationReportPaths 单测；2) parse-and-write-score CLI --iterationReportPaths E2E（fixture 可复用 `scoring/parsers/__tests__/fixtures/` 下样本报告，复制为 round1/round2 等）；3) Coach/dashboard 含 iteration_records 的集成 fixture 测试（iteration_records 至少 2 条且至少 1 条含 overall_grade） |
| **验收方式** | `npm run test:scoring` 全通过；E2E 脚本可执行并断言 |
| **依赖** | T2, T3, T6, T7 |

---

## §8 实施顺序建议

```
Phase 1（Schema + 写入）: T1 → T2 → T3 → T9（单测+E2E）
Phase 2（SKILL 约定）:    T4 → T5
Phase 3（展示 + 文档）:   T6 → T7 → T8
```
