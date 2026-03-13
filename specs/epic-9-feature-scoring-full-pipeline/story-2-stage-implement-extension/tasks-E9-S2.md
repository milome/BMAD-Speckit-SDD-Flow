# Tasks E9-S2：stage=implement 扩展

**Input**: spec-E9-S2.md、plan-E9-S2.md、IMPLEMENTATION_GAPS-E9-S2.md、Story 9.2  
**Prerequisites**: plan.md ✓、spec.md ✓、IMPLEMENTATION_GAPS.md ✓

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.7 | Story 9.2, spec, plan | §3.1, AC-1, AC-3, GAP-1.x | AuditStage implement、parseGenericReport、weights、CLI |
| T2 | spec, plan | §3.2, AC-2, GAP-2.x | run-score-schema、RunScoreRecord 确认 |
| T3 | spec, plan | §3.3, AC-4, GAP-3.x | audit-item-mapping implement 段 |
| T4 | spec, plan | §3.4, AC-5, GAP-4.x | compute 完整 run、仪表盘区分 implement/tasks |
| T5 | spec, plan | §3.5, AC-6, GAP-5.1 | speckit-workflow §5.2 --stage implement |
| T6 | spec, plan | §3.6, AC-7, Task 6.2, GAP-6.x | implement_audit_pass、文档化约定 |

---

## 2. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| §3.1 | GAP-1.1～1.5 | ✓ 有 | T1.1～T1.7 |
| §3.2 | GAP-2.1, 2.2 | ✓ 有 | T2 |
| §3.3 | GAP-3.1, 3.2 | ✓ 有 | T3 |
| §3.4 | GAP-4.1, 4.2 | ✓ 有 | T4 |
| §3.5 | GAP-5.1 | ✓ 有 | T5 |
| §3.6 | GAP-6.1, 6.2 | ✓ 有 | T6 |

---

## Phase 1：parse-and-write-score 与配置扩展（T1–T6）

**执行顺序**：T3.1、T3.2（audit-item-mapping implement 段）须先于 T1.6、T1.7；T4.3（implement 报告 fixture）须先于 T1.6、T1.7、T4.2 E2E 验收。

### T1.1 [x] audit-index.ts AuditStage + 'implement'（GAP-1.1）

- **修改**：`scoring/parsers/audit-index.ts`
- **内容**：`AuditStage` 类型增加 `'implement'`
- **验收**：TypeScript 编译通过；grep `'implement'` audit-index.ts 有匹配

### T1.2 [x] audit-index switch case 'implement'（GAP-1.2）

- **修改**：`scoring/parsers/audit-index.ts`
- **内容**：switch 增加 `case 'implement'`，调用 `parseGenericReport(..., stage: 'implement', phaseWeight: PHASE_WEIGHT_IMPLEMENT)`
- **验收**：parseAuditReport({ stage: 'implement', ... }) 不抛错，返回 record

### T1.3 [x] weights.ts PHASE_WEIGHT_IMPLEMENT（GAP-1.3）

- **修改**：`scoring/constants/weights.ts`
- **内容**：新增 `export const PHASE_WEIGHT_IMPLEMENT = 0.25`
- **验收**：grep `PHASE_WEIGHT_IMPLEMENT` 有匹配；值 0.25

### T1.4 [x] audit-generic.ts GenericAuditStage 含 implement（GAP-1.4）

- **修改**：`scoring/parsers/audit-generic.ts`
- **内容**：`GenericAuditStage` 扩展包含 `'implement'`（修改 Extract 或 MappingStage）
- **验收**：parseGenericReport 接受 stage: 'implement'；TypeScript 编译通过

### T1.5 [x] parse-and-write-score.ts stage 类型与 usage（GAP-1.5）

- **修改**：`scripts/parse-and-write-score.ts`
- **内容**：stage 类型含 implement（由 AuditStage 推导）；usage 文本增加 implement
- **验收**：`npx ts-node scripts/parse-and-write-score.ts --help` 或 usage 含 implement；`--stage implement` 可解析

### T1.6 [x] 单测 parseAuditReport stage=implement（plan §4.1）

- **测试文件**：`scoring/parsers/__tests__/audit-index.test.ts` 或 `audit-generic.test.ts`
- **内容**：单测 parseAuditReport({ stage: 'implement', ... }) 返回 record.stage === 'implement'、phase_weight === 0.25
- **验收**：单测通过；需 implement 报告 fixture（含可解析块：总体评级、维度评分）

### T1.7 [x] E2E parse-and-write-score --stage implement（plan §4.1）

- **内容**：准备 implement 报告 fixture；执行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <fixture> --stage implement --epic 9 --story 2`
- **验收**：scoring/data 下 record 含 stage: "implement"

### T2 [x] run-score-schema 与 RunScoreRecord 确认（GAP-2.1, 2.2）

- **检查**：`scoring/schema/run-score-schema.json` stage enum 已含 "implement"；`scoring/writer/types.ts` stage 类型兼容
- **验收**：schema 与 types 无需修改或已兼容；既有 record 不受影响

### T3.1 [x] audit-item-mapping.yaml implement 段（GAP-3.1）

- **修改**：`config/audit-item-mapping.yaml`
- **内容**：新增 implement 段；结构同 prd/arch（dimensions、checks、empty_overall、empty_dimensions）；checks 与 implement-scoring.yaml items 对应（func_correct、code_standards、exception_handling、security、perf_maintain 等）
- **验收**：YAML 解析无错；grep `implement:` audit-item-mapping.yaml 有匹配

### T3.2 [x] audit-item-mapping.ts AuditStage、loadMapping（GAP-3.2）

- **修改**：`scoring/parsers/audit-item-mapping.ts`
- **内容**：`AuditStage` 增加 `'implement'`；loadMapping 迭代列表增加 `'implement'`
- **验收**：resolveItemId('implement', ...)、resolveEmptyItemId('implement', ...) 可用；单测覆盖

### T4.1 [x] compute.ts 完整 run 与 implement 识别（GAP-4.1）

- **修改**：`scoring/dashboard/compute.ts`
- **内容**：完整 run 定义已基于 stages = Set(records.map(r => r.stage))；|stages| >= 3；stage=implement 自然计入；需确认 implement 与 trigger_stage=speckit_5_2 双识别（展示 implement 得分时两者均计入）
- **验收**：单测含 stage=implement fixture；聚合与短板计算正确

### T4.2 [x] 仪表盘按 stage/trigger_stage 区分 implement 与 tasks（GAP-4.2）

- **修改**：`scoring/dashboard/` 的 format 或 compute 输出
- **内容**：仪表盘输出能区分 implement 与 tasks 的 phase_score；按 stage 或 trigger_stage 展示
- **验收**：（1）**生产路径验证**：grep `compute` 或 `getLatestRunRecordsV2` scripts/dashboard-generate.ts 有匹配，确认 compute 被 dashboard-generate 导入；（2）dashboard-generate 输出含 implement 与 tasks 分别的得分；（3）E2E：先用 T4.3 准备含 stage=implement 的 fixture 至 scoring/data（或 --dataPath），再执行 `npx ts-node scripts/dashboard-generate.ts --epic 9 --story 2 --strategy epic_story_window` 断言输出能区分

### T4.3 [x] implement 报告 fixture（plan §5.2）

- **内容**：创建 scoring/data/__fixtures-implement/ 或内联 fixture；含可解析块（总体评级、维度评分、问题清单）；用于 T1.6、T1.7、T4.2 验收
- **执行顺序**：须先于 T1.6、T1.7、T4.2 E2E 执行
- **验收**：fixture 存在且含可解析块；T1.6、T1.7、T4.2 验收可执行

### T5 [x] speckit-workflow §5.2 改用 --stage implement（GAP-5.1）

- **修改**：`C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md` 或项目内 speckit-workflow
- **内容**：§5.2「审计通过后评分写入触发」段落：CLI 改为 `--stage implement`，移除 `--triggerStage speckit_5_2`；保持报告路径 `AUDIT_implement-E{epic}-S{story}.md`
- **验收**：grep §5.2 含 `--stage implement`，不含 `--triggerStage speckit_5_2`

### T6.1 [x] scoring-trigger-modes implement_audit_pass（GAP-6.1）

- **修改**：`config/scoring-trigger-modes.yaml`
- **内容**：call_mapping 新增 `implement_audit_pass: event: stage_audit_complete, stage: implement`
- **验收**：`npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage implement --event stage_audit_complete --epic 9 --story 2` 不因 trigger 校验失败退出

### T6.2 [x] 文档化 triggerStage 与 stage 一致可省略约定（GAP-6.2）

- **修改**：`审计报告格式与解析约定文档` 或 `scoring/docs/` 或 `config/README`
- **内容**：补充「当 triggerStage 与 stage 一致时可省略 --triggerStage；--stage implement 时默认 triggerStage=implement，由 implement_audit_pass 匹配」
- **验收**：grep 可查到约定

---

## 3. 集成测试与 E2E 任务（必须）

| 任务 | 测试类型 | 验收 |
|------|----------|------|
| T1.6 | 单元 | parseAuditReport stage=implement 返回正确 record |
| T1.7 | 集成/E2E | CLI --stage implement 写入 scoring/data |
| T3.2 | 单元 | resolveItemId/resolveEmptyItemId implement |
| T4.1 | 单元 | compute 含 stage=implement 聚合、短板 |
| T4.2 | 集成/E2E | dashboard-generate 输出区分 implement 与 tasks |
| T6.1 | 集成 | trigger 校验 --stage implement 通过 |
| plan §4.3 | 生产路径 | T4.2 验收(1) grep compute/dashboard-generate；parse-and-write-score 被 speckit-workflow §5.2 调用 |

---

## 4. 验收表头（按 GAP 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|--------------|----------|----------|
| GAP-1.1 | T1.1 | AuditStage + implement | 编译、grep | [ ] | [ ] |
| GAP-1.2 | T1.2 | case implement | parseAuditReport 单测 | [ ] | [ ] |
| GAP-1.3 | T1.3 | PHASE_WEIGHT_IMPLEMENT | grep | [ ] | [ ] |
| GAP-1.4 | T1.4 | GenericAuditStage implement | 编译 | [ ] | [ ] |
| GAP-1.5 | T1.5 | CLI stage、usage | CLI 执行 | [ ] | [ ] |
| GAP-2.1, 2.2 | T2 | schema、types 确认 | 无修改或已兼容 | [ ] | [ ] |
| GAP-3.1 | T3.1 | audit-item-mapping.yaml implement | YAML 解析 | [ ] | [ ] |
| GAP-3.2 | T3.2 | audit-item-mapping.ts implement | resolveItemId 单测 | [ ] | [ ] |
| GAP-4.1 | T4.1 | compute 完整 run、implement 识别 | 单测 fixture | [ ] | [ ] |
| GAP-4.2 | T4.2 | 仪表盘区分 implement/tasks | dashboard-generate E2E | [ ] | [ ] |
| GAP-5.1 | T5 | speckit-workflow §5.2 | grep | [ ] | [ ] |
| GAP-6.1 | T6.1 | implement_audit_pass | CLI trigger 校验 | [ ] | [ ] |
| GAP-6.2 | T6.2 | 文档化约定 | grep | [ ] | [ ] |
