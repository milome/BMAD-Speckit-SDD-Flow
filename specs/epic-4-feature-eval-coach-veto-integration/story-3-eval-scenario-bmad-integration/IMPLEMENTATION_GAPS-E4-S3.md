# IMPLEMENTATION_GAPS-E4-S3：eval-scenario-bmad-integration

**对照**：plan-E4-S3.md、spec-E4-S3.md、Story 4-3、当前实现  
**生成日期**：2026-03-05

---

## 1. 现状摘要

- **已有**：scoring/docs/（VETO_AND_ITERATION_RULES.md、SCORING_CRITERIA_AUTHORITATIVE.md）；config/scoring-trigger-modes.yaml（Story 3.3）；scoring/schema（scenario、path_type、question_version 已支持）；scoring/writer/validate.ts（validateRunScoreRecord）；scoring/writer/write-score.ts；scoring/orchestrator/parse-and-write.ts。
- **缺失**：scoring/docs/SCENARIO_AND_PATH_RULES.md、ITERATION_END_CRITERIA.md、LIGHTWEIGHT_PRINCIPLES.md、DATA_POLLUTION_PREVENTION.md、BMAD_INTEGRATION_POINTS.md；validateScenarioConstraints 及其在写入前调用；parseAndWriteScore 的 question_version 入参与传递；scripts/accept-e4-s3.ts；package.json accept:e4-s3；scoring/writer 单测覆盖 validateScenarioConstraints。

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §3 T1 / spec §2.1 | GAP-1.1 | scoring/docs/SCENARIO_AND_PATH_RULES.md | 未实现 | 文档不存在 |
| Story §3 T1.2 / plan §4 | GAP-1.2 | validateScenarioConstraints：eval_question 时 question_version 必填 | 未实现 | scoring/writer/validate.ts 无此函数 |
| Story §3 T1.2 / plan §2.2 | GAP-1.3 | 写入前调用 validateScenarioConstraints | 未实现 | writeScoreRecordSync 仅调用 validateRunScoreRecord |
| Story §3 T1.3 / plan §5.1 | GAP-1.4 | 单测：scenario、question_version 组合断言 | 未实现 | scoring/writer 无 validateScenarioConstraints 单测 |
| Story §3 T2 / spec §2.2 | GAP-2.1 | scoring/docs/ITERATION_END_CRITERIA.md | 未实现 | 文档不存在 |
| Story §3 T3 / spec §2.3 | GAP-3.1 | scoring/docs/LIGHTWEIGHT_PRINCIPLES.md | 未实现 | 文档不存在 |
| Story §3 T3.2 / plan §6.3 | GAP-3.2 | 验证 scoring-trigger-modes 支持按配置关闭的文档说明 | 未实现 | LIGHTWEIGHT_PRINCIPLES 需含此说明 |
| Story §3 T4 / spec §2.4 | GAP-4.1 | scoring/docs/DATA_POLLUTION_PREVENTION.md | 未实现 | 文档不存在 |
| Story §3 T5 / spec §2.5 | GAP-5.1 | scoring/docs/BMAD_INTEGRATION_POINTS.md | 未实现 | 文档不存在 |
| Story §3 T5.2 / plan §5.3 | GAP-5.2 | 至少一个集成点可调用验证 | 部分 | accept-e3-s3 可验证 parseAndWriteScore；需 accept-e4-s3 验收 5 份文档存在与校验逻辑 |
| Story §3 T6 / plan §5.2 | GAP-6.1 | 禁止词表校验 | 未实现 | 无脚本或流程对 5 份文档全文检索禁止词 |
| plan §4.1 | GAP-P1 | path_type 默认 full | 未实现 | 写入路径未在 record.path_type 为空时补全 full |
| plan §5.3 | GAP-P2 | scripts/accept-e4-s3.ts、package.json accept:e4-s3 | 未实现 | 脚本与 npm script 不存在 |
| ParseAndWriteScoreOptions | GAP-P3 | question_version 入参 | 未实现 | parse-and-write 的 options 无 question_version；eval_question 时无法传入 |

---

## 3. 实现建议

### 3.1 GAP-1.x（场景与路径）

- **GAP-1.1**：创建 scoring/docs/SCENARIO_AND_PATH_RULES.md，按 spec §2.1、plan §6.1 模板编写。
- **GAP-1.2**：在 scoring/writer/validate.ts 新增 `validateScenarioConstraints(record: RunScoreRecord): void`；scenario=eval_question 且 question_version 为空时抛错。
- **GAP-1.3**：在 writeScoreRecordSync 中，validateRunScoreRecord 之后调用 validateScenarioConstraints(record)；若 record 为 unknown 则先断言为 RunScoreRecord。
- **GAP-1.4**：在 scoring/writer/__tests__/ 或 scoring/__tests__/writer/ 新增 validateScenarioConstraints 单测，覆盖 4 组合：eval_question+空、eval_question+有值、real_dev+空、scenario 非法。

### 3.2 GAP-2.1

- 创建 scoring/docs/ITERATION_END_CRITERIA.md，按 plan §6.2 模板；与 REQUIREMENTS §2.2 逐项对照；含与 Story 4.2 教练 iteration_passed 衔接说明。

### 3.3 GAP-3.x

- **GAP-3.1**：创建 scoring/docs/LIGHTWEIGHT_PRINCIPLES.md，按 plan §6.3。
- **GAP-3.2**：在 LIGHTWEIGHT_PRINCIPLES 中说明：不调用 parseAndWriteScore 即关闭评分；scoring-trigger-modes.yaml 为触发模式表，调用方可按项目配置决定是否调用。

### 3.4 GAP-4.1

- 创建 scoring/docs/DATA_POLLUTION_PREVENTION.md，按 plan §6.4；四条防护表；与 REQUIREMENTS §3.7、architecture §7.4 对照。

### 3.5 GAP-5.x

- **GAP-5.1**：创建 scoring/docs/BMAD_INTEGRATION_POINTS.md，按 plan §6.5。
- **GAP-5.2**：accept-e4-s3 验收脚本中含「至少一个集成点可调用」验证（如执行 accept-e3-s3 或直接调用 parseAndWriteScore）。

### 3.6 GAP-6.1

- accept-e4-s3 或独立脚本：对 5 份文档全文 grep 禁止词；禁止词表定义节（如 LIGHTWEIGHT_PRINCIPLES 中禁止词列表）除外；有命中则报错。

### 3.7 GAP-P1、GAP-P2、GAP-P3

- **GAP-P1**：在 writeScoreRecordSync 或 parseAndWriteScore 构建 record 时，若 path_type 为空则赋 `'full'`。
- **GAP-P2**：创建 scripts/accept-e4-s3.ts；package.json 增加 `accept:e4-s3`。
- **GAP-P3**：ParseAndWriteScoreOptions 增加 `question_version?: string`；parseAndWriteScore 构建 record 时，若 scenario=eval_question 则从 options 取 question_version 写入 record。

---

## 4. 闭合条件

- 5 份文档存在且与 spec/plan 内容一致；validateScenarioConstraints 实现且写入前调用；path_type 默认 full；question_version 入参传递；单测与 accept-e4-s3 通过；禁止词校验无命中。
