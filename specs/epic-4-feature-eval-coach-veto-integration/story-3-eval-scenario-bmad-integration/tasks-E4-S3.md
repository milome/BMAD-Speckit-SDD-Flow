# Tasks: eval-scenario-bmad-integration (E4-S3)

**Input**: `spec-E4-S3.md`、`plan-E4-S3.md`、`IMPLEMENTATION_GAPS-E4-S3.md`、Story 4.3  
**Prerequisites**: Story 3.3 config/scoring-trigger-modes.yaml、parseAndWriteScore 可用；scoring/schema、scoring/writer 存在

---

## 本批任务 ↔ Story 4.3 需求追溯

| 任务 ID | Story 章节 | 对应 AC | 需求要点 |
|---------|-----------|---------|----------|
| T1 | Story 4.3 §3 T1 | AC-1, AC-2 | 场景区分与路径约束、question_version 校验 |
| T2 | Story 4.3 §3 T2 | AC-3 | 各阶段迭代结束标准文档化 |
| T3 | Story 4.3 §3 T3 | AC-4 | 轻量化三原则文档化与校验 |
| T4 | Story 4.3 §3 T4 | AC-5 | 数据污染防护落位 |
| T5 | Story 4.3 §3 T5 | AC-6 | BMAD 五层 workflows 集成点文档化 |
| T6 | Story 4.3 §3 T6 | 隐含 | 禁止词表校验 |

---

## Gaps → 任务映射

| Gap ID | 缺口说明 | 对应任务 |
|--------|----------|----------|
| GAP-1.1 | SCENARIO_AND_PATH_RULES.md 缺失 | T1.1 |
| GAP-1.2, GAP-1.3 | validateScenarioConstraints 及写入前调用 | T1.2 |
| GAP-1.4 | 单测 scenario、question_version 组合 | T1.3 |
| GAP-P1 | path_type 默认 full | T1.2 |
| GAP-P3 | question_version 入参 | T1.2 |
| GAP-2.1 | ITERATION_END_CRITERIA.md 缺失 | T2 |
| GAP-3.1, GAP-3.2 | LIGHTWEIGHT_PRINCIPLES.md 缺失 | T3 |
| GAP-4.1 | DATA_POLLUTION_PREVENTION.md 缺失 | T4 |
| GAP-5.1, GAP-5.2 | BMAD_INTEGRATION_POINTS.md、集成点验证 | T5 |
| GAP-6.1, GAP-P2 | 禁止词校验、accept-e4-s3 脚本 | T6 |

---

## Phase 1：场景区分与路径约束（T1）

**AC**: #1, #2  
**覆盖 Gap**: GAP-1.1, GAP-1.2, GAP-1.3, GAP-1.4, GAP-P1, GAP-P3

- [x] **T1.1** 产出 `scoring/docs/SCENARIO_AND_PATH_RULES.md`：real_dev 与 eval_question 定义、Layer 1→5 完整路径约束、path_type、question_version 要求。按 spec §2.1、plan §6.1 模板编写。
- [x] **T1.2** 实现或扩展现有校验：
  - [TDD-RED] 编写单测：scenario=eval_question、question_version 为空时校验失败；scenario=eval_question、question_version 有值时通过；scenario=real_dev 时 question_version 可空。
  - [TDD-GREEN] 在 scoring/writer/validate.ts 新增 `validateScenarioConstraints(record: RunScoreRecord): void`；scenario=eval_question 且 question_version 为空/未定义时抛错。path_type 若空则 writeScoreRecordSync 或调用方补全 `full`。parseAndWriteScoreOptions 增加 question_version；构建 record 时传入。writeScoreRecordSync 在 validateRunScoreRecord 之后调用 validateScenarioConstraints。
  - [TDD-REFACTOR] 若有重复逻辑则抽取；确保错误信息明确。
- [x] **T1.3** 单测或验收脚本：给定 scenario、question_version 组合，断言校验通过或失败符合预期。命令：`npm test -- scoring/writer` 或等效。

---

## Phase 2：各阶段迭代结束标准文档化（T2）

**AC**: #3  
**覆盖 Gap**: GAP-2.1

- [x] **T2.1** 产出 `scoring/docs/ITERATION_END_CRITERIA.md`（或 config/ 等价）：Layer 1–5 各 stage 的迭代结束标准，与 REQUIREMENTS §2.2 逐项对照。
- [x] **T2.2** 在文档中写入与 Story 4.2 教练的 iteration_passed 判定衔接说明。

---

## Phase 3：轻量化三原则文档化与校验（T3）

**AC**: #4  
**覆盖 Gap**: GAP-3.1, GAP-3.2

- [x] **T3.1** 产出 `scoring/docs/LIGHTWEIGHT_PRINCIPLES.md`：同机执行、按配置启用、最小侵入的释义与可验证检查项。
- [x] **T3.2** 在文档中说明 config/scoring-trigger-modes.yaml 支持按配置关闭评分的逻辑：不调用 parseAndWriteScore 即关闭；调用方按项目配置决定是否调用。

---

## Phase 4：数据污染防护落位（T4）

**AC**: #5  
**覆盖 Gap**: GAP-4.1

- [x] **T4.1** 产出 `scoring/docs/DATA_POLLUTION_PREVENTION.md` 或项目 checklist：四条防护的操作要点、触发条件、建议阈值。
- [x] **T4.2** 与 architecture §7.4、REQUIREMENTS §3.7 逐项对照，确保内容一致。

---

## Phase 5：BMAD 五层 workflows 集成点文档化（T5）

**AC**: #6  
**覆盖 Gap**: GAP-5.1, GAP-5.2

- [x] **T5.1** 产出 `scoring/docs/BMAD_INTEGRATION_POINTS.md` 或 INTEGRATION.md 扩展：speckit-workflow、bmad-story-assistant、全链路 Skill 各 stage 的触发时机与调用方式。
- [x] **T5.2** 与 config/scoring-trigger-modes.yaml、architecture §7.3 衔接；至少一个集成点可由脚本或 Cursor Task 调用并验证（如执行 accept-e3-s3 或 parseAndWriteScore）。

---

## Phase 6：禁止词表校验（T6）

**AC**: 隐含  
**覆盖 Gap**: GAP-6.1, GAP-P2

- [x] **T6.1** 本 Story 产出文档全文检索禁止词；若有则修正。禁止词：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。
- [x] **T6.2** 创建 `scripts/accept-e4-s3.ts`：1) 断言 5 份文档存在；2) 调用 validateScenarioConstraints，给定 scenario、question_version 组合断言通过/失败；3) 至少一个 BMAD 集成点可调用（如 accept-e3-s3）；4) 对 5 份文档全文 grep 禁止词，禁止词表定义节除外，有命中则退出码非 0。package.json 增加 `accept:e4-s3`。

---

## 验收汇总

| 任务 | 验收命令/方式 |
|------|---------------|
| T1 | test -f scoring/docs/SCENARIO_AND_PATH_RULES.md；npm test -- scoring/writer；validateScenarioConstraints 单测通过 |
| T2 | test -f scoring/docs/ITERATION_END_CRITERIA.md；与 §2.2 对照 |
| T3 | test -f scoring/docs/LIGHTWEIGHT_PRINCIPLES.md；含按配置关闭说明 |
| T4 | test -f scoring/docs/DATA_POLLUTION_PREVENTION.md；与 §3.7、§7.4 对照 |
| T5 | test -f scoring/docs/BMAD_INTEGRATION_POINTS.md；accept-e3-s3 或 parseAndWriteScore 可调用 |
| T6 | npm run accept:e4-s3 退出码 0；5 份文档无禁止词违规 |
