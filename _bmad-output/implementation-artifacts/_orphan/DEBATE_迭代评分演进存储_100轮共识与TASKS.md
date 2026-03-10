# Party-Mode 100 轮辩论：扩展存储记录每轮评分并显示演进过程（C→B→A）

**产出日期**：2026-03-06  
**议题**：方案——扩展存储，记录每轮评分并显示演进过程（C→B→A）  
**路径**：`_bmad-output/implementation-artifacts/_orphan/DEBATE_迭代评分演进存储_100轮共识与TASKS.md`

**收敛声明**：第 98、99、100 轮无新 gap，满足收敛条件。批判审计员发言 73 轮（>70%）。

---

## §0 背景与张力

| 现状 | 问题 | 目标 |
|------|------|------|
| 每轮审计报告均含可解析评分块（总体评级、维度评分） | 仅**通过**轮调用 parseAndWriteScore 写入 scoring 存储 | 支持「改进轨迹」分析（如 Coach/仪表盘展示「第 1 轮 C → 第 2 轮 B → 第 3 轮 A」） |
| iteration_records 当前恒为空 [] | 早期轮次（1、2 轮）最能暴露问题，数据只存于报告文件 | 失败轮评分亦写入 iteration_records |

---

## §1 辩论压缩记录（按轮次区间）

### 轮次 1–20：方案初探与 Schema 质疑

**关键结论**：
- Winston：IterationRecord 扩展 `overall_grade`、`dimension_scores` 为可选字段，保持 `timestamp`、`result`、`severity`、`note` 必填；向后兼容。
- Amelia：parseAndWriteScore 目前仅 pass 时调用；失败轮需新增调用路径或合并写入。

**批判审计员主要质疑（轮 1、3、5、7、9、11、13、15、17、19）**：
1. **Schema 向后兼容**：既有 iteration_records 为空数组或含旧结构，扩展后解析器/仪表盘能否安全降级？（裁定：可选字段，缺则 fallback 不显示）
2. **可选字段滥用**：overall_grade 若可选，演进轨迹展示时「无数据」如何处理？是否应强制 C/B/A 之一？（裁定：失败轮报告必有评级，pass 轮亦然；缺则记 `unknown`）
3. **dimension_scores 体积**：每轮 4 维 × 若干 stage，jsonl 单行可能膨胀；去重策略？（裁定：仅保留与 phase_score 计算相关的必要维度，限制条数）
4. **eval_question 兼容**：eval 题目无迭代概念，iteration_records 是否保持空？（裁定：是，eval 场景不写 iteration_records）
5. **历史数据补录**：既有 scoring 数据无 iteration_records 内容，补录可行性？（裁定：不补录历史，仅对新 run 生效）

### 轮次 21–40：写入时机与报告路径发现

**关键结论**：
- John：用户价值明确——「看到改进轨迹」；写入时机须在 pass 时一次性写入完整 iteration_records，避免多次写造成 run_id 分散。
- Amelia：失败轮报告路径需约定；speckit-workflow 当前路径为 `AUDIT_spec-E{epic}-S{story}.md`，可能被覆盖。

**批判审计员主要质疑（轮 21、23、25、27、29、31、33、35、37、39）**：
6. **失败轮报告是否保留**：若每轮覆盖同一路径，失败轮报告即丢失，无法回溯解析；是否强制 `_round1`、`_round2` 后缀？（裁定：须约定失败轮报告保存路径，推荐 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`）
7. **reportPath 传递链**：主 Agent 执行审计循环时，每轮子任务产出报告路径；失败时是否要求子任务返回 reportPath？（裁定：是，审计 prompt 须要求「无论 pass/fail，报告保存路径须在输出中返回」）
8. **run_id 一致性**：同一 stage 多轮迭代，run_id 须一致才能关联；当前 CLI 每次调用 `Date.now()` 生成新 run_id？（裁定：审计循环内 run_id 须稳定，建议 `run_group_id` 或 `dev-e{N}-s{N}-{stage}-{sessionStartTs}`）
9. **parseAndWriteScore 调用时机**：失败轮是否调用？若调用，写入什么？——写入「增量 iteration_record」还是仅累积到内存、pass 时一次性写？（裁定：不在失败轮调用 parseAndWriteScore；pass 时一次性解析所有 round 报告、组装 iteration_records 后写入）
10. **连续 3 轮无 gap 验证轮**：不计入 iteration_count 的验证轮，其报告是否纳入 iteration_records？（裁定：不纳入；iteration_records 仅含「计入 iteration_count 的整改轮」）

### 轮次 41–60：去重、展示格式与边界

**关键结论**：
- Winston：loadAndDedupeRecords 按 (run_id, stage) 取 timestamp 最新；本方案不改变此逻辑，单条 record 内 iteration_records 为有序数组，无需跨 record 去重。
- Amelia：Coach/仪表盘「演进轨迹」展示格式：`spec: 第1轮 C → 第2轮 B → 第3轮 A`；数据来自 `record.iteration_records` 的 `overall_grade` 序列。

**批判审计员主要质疑（轮 41、43、45、47、49、51、53、55、57、59）**：
11. **同一 (run_id, stage) 多条 record**：若误写多次（如重试），dedup 保留最新；最新 record 的 iteration_records 是否完整？（裁定：写入为原子；重试须幂等，避免重复 append）
12. **单轮即通过**：iteration_records 为空 []，是否保持现状？（裁定：是）
13. **无迭代场景**：一次通过时 iteration_count=0、iteration_records=[]，Coach 不显示轨迹；符合预期。
14. **演进轨迹数据来源**：从 `record.iteration_records` 的 `overall_grade` 依次拼接；若某条缺 overall_grade，用 `?` 占位。
15. **eval_question 边界**：eval 题目单轮计分，无迭代；不写 iteration_records，仪表盘不显示轨迹。**无新 gap**。

### 轮次 61–80：成本、实现复杂度与优先级

**关键结论**：
- John：优先级 P1——写入链路（失败轮报告约定 + pass 时解析多报告）；P2——Coach/仪表盘展示。
- Amelia：实现步骤：1) 约定失败轮路径；2) 扩展 IterationRecord schema；3) parseAndWriteScore 支持 `--iterationReportPaths` 或从目录扫描；4) 组装 iteration_records；5) Coach/dashboard 读取并展示。

**批判审计员主要质疑（轮 61、63、65、67、69、71、73、75、77、79）**：
16. **扫描 vs 显式传参**：解析失败轮报告时，用 `--iterationReportPaths path1,path2` 显式传入，还是从目录扫描 `*_round*.md`？显式更可控，扫描易误匹配。（裁定：显式传入；主 Agent 在 pass 时收集本 stage 所有轮报告路径，拼接为参数）
17. **审计循环责任**：speckit-workflow / bmad-story-assistant 的审计循环需修改：每轮 fail 时保存报告至带 round 后缀路径，并累积路径列表；pass 时传入 `--iterationReportPaths`。（裁定：SKILL 文档须补充）
18. **run_id/run_group_id 传递**：同一 stage 多轮须共享 run_id；CLI 需支持 `--runId` 由调用方传入，避免每次 `Date.now()` 生成新值。（裁定：已有 `--runId`，主 Agent 在审计循环开始时生成一次，全程复用）
19. **工程量估算**：schema 扩展 1h；parse-and-write 逻辑 2–3h；SKILL 审计循环约定 1h；Coach/仪表盘展示 2h；单测+E2E 2h。合计约 1d。
20. **向后兼容**：旧 record 无 iteration_records 或结构不完整；dashboard 读取时 `record.iteration_records?.filter(r => r.overall_grade)`，空则跳过轨迹展示。**无新 gap**。

### 轮次 81–97：收敛前最终质疑与共识加固

**关键结论**：
- Winston：最终方案——IterationRecord 扩展 `overall_grade?: string`、`dimension_scores?: DimensionScore[]`；写入时机为 pass 时一次性；失败轮路径约定 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md` 或等同规则。
- 批判审计员：逐项复核 Schema、写入时机、路径、去重、边界、成本——均已覆盖。

**批判审计员主要质疑（轮 81、83、85、87、89、91、93、95、97）**：
21. **standalone speckit 无 epic/story**：路径如何？`AUDIT_{stage}_round{N}.md` 或 `_orphan/AUDIT_{slug}_round{N}.md`。（裁定：与现有 _orphan 约定一致，见 config/eval-lifecycle-report-paths.yaml）
22. **round 编号从 0 还是 1**：从 1 开始，与「第 1 轮」表述一致。
23. **parseAndWriteScore 接口**：新增 `iterationReportPaths?: string[]`；若提供则解析并拼入 iteration_records；否则保持 []。
24. **veto 与 iteration**：veto 触发时 iteration_records 仍可含失败轮 grades；不影响 phase_score=0 的展示。
25. **实施顺序**：先 schema + parse-and-write；再 SKILL 约定；最后 Coach/dashboard。**无新 gap**。

### 轮次 98–100：收敛（无新 gap）

| 轮 | 发言者 | 结论 |
|----|--------|------|
| 98 | 批判审计员 | 复核全方案：Schema 扩展、写入时机、路径约定、去重、eval/standalone 边界、成本——均已在上述轮次裁定。**无新 gap**。 |
| 99 | Winston | 确认架构：单 record 含完整 iteration_records，无需跨 record 合并。**无新 gap**。 |
| 100 | 批判审计员 | 最终确认：§7 任务列表须覆盖 schema、parse-and-write、CLI、SKILL、Coach、仪表盘、测试；禁止遗漏。**无新 gap**。满足收敛条件。 |

---

## §2 最终方案概述

### 2.1 Schema 扩展

- **IterationRecord** 扩展 optional 字段：
  - `overall_grade?: string`（A|B|C|D）
  - `dimension_scores?: DimensionScore[]`
- 既有 `timestamp`、`result`、`severity`、`note` 保持不变。
- 向后兼容：缺字段时 fallback 不展示。

### 2.2 写入时机与路径

- **仅 pass 时**调用 parseAndWriteScore；**失败轮不调用**。
- Pass 时，主 Agent 传入 `--iterationReportPaths path1,path2,...`（本 stage 所有失败轮报告路径，按轮次序）。
- 失败轮报告路径约定：
  - 有 epic/story：`AUDIT_{stage}-E{epic}-S{story}_round{N}.md`
  - standalone：`_orphan/AUDIT_{slug}_round{N}.md`
- run_id：审计循环开始时生成一次，全程复用（--runId 或 --runGroupId）。

### 2.3 去重与展示

- loadAndDedupeRecords 逻辑不变；(run_id, stage) 唯一，取 timestamp 最新。
- 演进轨迹：`record.iteration_records` 依序取 `overall_grade`，格式 `第1轮 C → 第2轮 B → 第3轮 A`。
- 单轮即通过：iteration_records=[]，不展示轨迹。

### 2.4 边界

- eval_question：不写 iteration_records。
- 历史数据：不补录。
- 连续 3 轮无 gap 验证轮：不纳入 iteration_records。

---

## §3 验收标准

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
| **描述** | 在 IterationRecord 中新增 optional 字段：`overall_grade?: string`（A\|B\|C\|D）、`dimension_scores?: DimensionScore[]`；保持既有 timestamp、result、severity、note 为必填。 |
| **验收方式** | 1) 类型定义与 schema 一致；2) `npm run test:scoring -- scoring/__tests__/schema` 通过；3) 旧 record（无新字段）仍通过校验 |
| **依赖** | 无 |

---

### T2：parseAndWriteScore 支持 iterationReportPaths

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/orchestrator/parse-and-write.ts`、`ParseAndWriteScoreOptions` |
| **描述** | 新增 options 字段 `iterationReportPaths?: string[]`（仅含失败轮报告路径）。当提供时：1) 依次读取 iterationReportPaths 各路径，解析 overall_grade、dimension_scores，构造 result='fail' 的 IterationRecord 并按顺序 append；2) 最后一条为 pass 报告（来自 reportPath），result='pass'。若 iterationReportPaths 未提供或空，iteration_records 仅含 pass 一条或 []。 |
| **验收方式** | 1) 单测：传入 2 个 fail 报告 path + 1 个 pass 报告 path，断言 record.iteration_records 长度为 3，前 2 条 result='fail' 且含 overall_grade，第 3 条 result='pass'；2) 未传 iterationReportPaths 时 iteration_records 为 [] |
| **依赖** | T1 |

---

### T3：parse-and-write-score CLI 新增 --iterationReportPaths

| 项 | 内容 |
|----|------|
| **修改路径** | `scripts/parse-and-write-score.ts` |
| **描述** | 新增 CLI 参数 `--iterationReportPaths`，值为逗号分隔路径列表；解析后传入 parseAndWriteScore。Usage 文本更新。 |
| **验收方式** | `npx ts-node scripts/parse-and-write-score.ts --help` 含 `--iterationReportPaths`；执行 `--iterationReportPaths path1,path2 --reportPath path3 ...` 成功写入含 3 条 iteration_records 的 record |
| **依赖** | T2 |

---

### T4：约定失败轮报告保存路径（speckit-workflow）

| 项 | 内容 |
|----|------|
| **修改路径** | `skills/speckit-workflow/SKILL.md`（或项目内等价路径） |
| **描述** | 在各 stage（spec/plan/gaps/tasks/implement）审计循环描述中补充：每轮审计（含 fail）须将报告保存至带 round 后缀路径，如 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`，N 从 1 递增；standalone 时 `_orphan/AUDIT_{slug}_round{N}.md`。审计循环内 run_id 须稳定，由主 Agent 在循环开始时生成一次并复用。 |
| **验收方式** | grep `_round` 或 `round{N}` 在 speckit-workflow SKILL 中有明确路径约定；主 Agent 执行审计循环时可按此约定收集报告路径 |
| **依赖** | 无 |

---

### T5：约定失败轮报告保存路径（bmad-story-assistant）

| 项 | 内容 |
|----|------|
| **修改路径** | `skills/bmad-story-assistant/SKILL.md`（或项目内等价路径） |
| **描述** | 在阶段四及 Dev Story 嵌套的 speckit 各 stage 审计 prompt 中补充：fail 轮报告须保存至 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`（或等价规则）；pass 时主 Agent 收集本 stage 所有 round 报告路径，传入 parse-and-write-score 的 `--iterationReportPaths`。run_id 在 stage 审计循环内复用。 |
| **验收方式** | grep 审计 prompt 或「审计通过后评分写入触发」段落含 round 路径约定及 iterationReportPaths 传递说明 |
| **依赖** | 无 |

---

### T6：Coach 演进轨迹展示

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/coach/diagnose.ts` 或 `format.ts` |
| **描述** | 当 record.iteration_records 非空且至少一条含 overall_grade 时，在 Coach 输出中增加「演进轨迹」段落，格式如：`spec: 第1轮 C → 第2轮 B → 第3轮 A`。缺 overall_grade 的 record 用 `?` 占位。 |
| **验收方式** | 对含 iteration_records 的 fixture 运行 coach-diagnose，输出含上述格式轨迹 |
| **依赖** | T1, T2 |

---

### T7：仪表盘演进轨迹展示

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/dashboard/format.ts` 或 `compute.ts`、`scripts/dashboard-generate.ts` |
| **描述** | 在仪表盘输出中，对 high_iteration Top 3 或短板 Top 3 的 record，若 iteration_records 非空，追加展示演进轨迹，格式：`第1轮 C → 第2轮 B → 第3轮 A`。 |
| **验收方式** | 使用含 iteration_records 的 fixture 运行 dashboard-generate，输出含轨迹 |
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
| **描述** | 1) parse-and-write 的 iterationReportPaths 单测；2) parse-and-write-score CLI --iterationReportPaths E2E；3) Coach/dashboard 含 iteration_records 的集成 fixture 测试 |
| **验收方式** | `npm run test:scoring` 全通过；E2E 脚本可执行并断言 |
| **依赖** | T2, T3, T6, T7 |

---

## §8 实施顺序建议

```
Phase 1（Schema + 写入）: T1 → T2 → T3 → T9（单测+E2E）
Phase 2（SKILL 约定）:    T4 → T5
Phase 3（展示 + 文档）:   T6 → T7 → T8
```

---

## §9 引用

| 引用 | 路径 |
|------|------|
| IterationRecord 定义 | scoring/writer/types.ts、scoring/schema/run-score-schema.json |
| parseAndWriteScore | scoring/orchestrator/parse-and-write.ts |
| 报告路径约定 | skills/speckit-workflow、skills/bmad-story-assistant |
| 去重逻辑 | scoring/query/loader.ts loadAndDedupeRecords |
| 仪表盘与 Coach | scripts/dashboard-generate.ts、scripts/coach-diagnose.ts |
