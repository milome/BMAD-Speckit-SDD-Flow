# Tasks E9-S1：评分全链路写入与仪表盘聚合

**Input**: spec-E9-S1.md、plan-E9-S1.md、IMPLEMENTATION_GAPS-E9-S1.md、Story 9.1、TASKS  
**Prerequisites**: plan.md ✓、spec.md ✓、IMPLEMENTATION_GAPS.md ✓

<!-- AUDIT: PASSED by code-reviewer -->

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T3 | Story 9.1, TASKS, spec | §3.1, T1–T3 | bmad-story-assistant 步骤 4.2、路径约定、reportPath 解析 |
| T4–T4b | spec, TASKS | §3.2.2, T4 | trigger_stage 类型、schema、透传、CLI、单测 |
| T5 | spec, TASKS | §3.2.3, T11 | run_id 共享、--runGroupId、RUN_ID_CONVENTION |
| T6–T8 | spec, TASKS | §3.3, T5–T6 | check-story-score-written、SKILL 嵌入、Story 完成自检文档 |
| T9–T12 | spec, TASKS | §3.4, T7–T9 | 聚合、仪表盘、短板、fixture |

---

## 2. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| §3.1.1 | GAP-1.1a, 1.1b, 1.1c | ✓ 有 | T1 |
| §3.1.2 | GAP-1.2 | ✓ 有 | T2 |
| §3.2.1 | GAP-1.3 | ✓ 有 | T3 |
| §3.2.2 | GAP-2.1, 2.2, 2.3, 2.3b | ✓ 有 | T4, T4b |
| §3.2.3 | GAP-2.4 | ✓ 有 | T5 |
| §3.3 | GAP-3.1, 3.2, 3.3 | ✓ 有 | T6, T7, T8 |
| §3.4 | GAP-4.1–4.6 | ✓ 有 | T9, T10, T11, T12 |

---

## Phase 1：写入链路（T1–T5）

### T1 [x] bmad-story-assistant 阶段四插入步骤 4.2（GAP-1.1a/b/c）

- **修改路径**：`skills/bmad-story-assistant/SKILL.md`（项目内优先）
- **修改内容**：在「审计通过后评分写入触发」**之前**插入「步骤 4.2：运行 parse-and-write-score（强制）」；含完整 CLI 示例（**须显式写出 `--triggerStage bmad_story_stage4`**、`--iteration-count`）、报告路径模板 `AUDIT_Story_{epic}-{story}_stage4.md`、non_blocking 说明
- **验收**：grep `步骤 4.2`、`bmad_story_stage4`、`AUDIT_Story_` 有匹配；**最低可行 E2E**：人工验收清单——模拟 Dev Story 阶段四通过后，确认 parse-and-write-score 被触发（可选）

### T2 [x] STORY-A4-POSTAUDIT 约定报告保存路径（GAP-1.2）

- **修改路径**：`skills/bmad-story-assistant/SKILL.md`
- **修改内容**：在 stage4 审计 prompt 中增加「审计通过后请将报告保存至 `{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`」
- **验收**：grep `审计通过后请将报告保存至` 或 `AUDIT_Story_.*stage4` 有匹配；**最低可行 E2E**：人工验收——执行一次 stage4 审计，确认报告保存到约定路径（可选）

### T3 [x] 主 Agent 解析 reportPath 与 SCORE_WRITE_SKIP_REPORT_MISSING（GAP-1.3）

- **修改路径**：`skills/bmad-story-assistant/SKILL.md`
- **修改内容**：在「审计结论处理」增加：从约定路径或子任务输出解析 reportPath；reportPath 不存在时记录 `SCORE_WRITE_SKIP_REPORT_MISSING`，不阻断
- **验收**：SKILL 文档明确上述逻辑及边界条件；**最低可行 E2E**：人工验收——reportPath 不存在时确认 SCORE_WRITE_SKIP 被记录且不阻断（可选）

### T4 [x] parse-and-write-score 支持 trigger_stage（GAP-2.1, 2.2, 2.3）

- **修改文件**：`scoring/writer/types.ts`（RunScoreRecord.trigger_stage）、`scoring/schema/run-score-schema.json`、`scoring/orchestrator/parse-and-write.ts`、`scripts/parse-and-write-score.ts`
- **修改内容**：类型与 schema 扩展；options.triggerStage 透传至 record；CLI 已有 --triggerStage，需传入 parseAndWriteScore
- **验收**：`npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage tasks --triggerStage speckit_5_2 ...` 执行后，record 含 `trigger_stage: "speckit_5_2"`

### T4b [x] trigger_stage 写入单测（GAP-2.3b）

- **测试文件**：`scoring/orchestrator/__tests__/` 或 `scoring/writer/__tests__/`
- **验收**：单测 assert record.trigger_stage === "speckit_5_2"

### T5 [x] run_id 共享与 RUN_ID_CONVENTION（GAP-2.4）

- **修改**：`scripts/parse-and-write-score.ts` 新增 `--runGroupId`；或约定 dev-e{epic}-s{story}-{ts} 复用
- **文档**：`scoring/docs/RUN_ID_CONVENTION.md` 补充同一 Story 多 stage 共享 run_id
- **验收**：--runGroupId 可用或文档已更新

---

## Phase 2：Story 完成自检（T6–T8）

### T6 [x] 新建 check-story-score-written.ts（GAP-3.1）

- **新建**：`scripts/check-story-score-written.ts --epic N --story N [--dataPath path]`
- **逻辑**：loadAndDedupeRecords + parseEpicStoryFromRecord 或 run_id 正则 `dev-e{N}-s{N}-`；输出有/无记录
- **验收**：`npx ts-node scripts/check-story-score-written.ts --epic 8 --story 1` 可运行

### T7 [x] bmad-story-assistant 嵌入检查步骤（GAP-3.2）

- **修改路径**：`skills/bmad-story-assistant/SKILL.md`
- **修改内容**：阶段四通过后、提供完成选项前，执行 check-story-score-written；补跑参数：`--stage tasks --event story_status_change --triggerStage bmad_story_stage4`
- **验收**：SKILL 流程描述中含检查步骤；**最低可行 E2E**：人工验收清单——模拟阶段四通过后，确认 check-story-score-written 被执行（可选）

### T8 [x] Story 完成自检文档章节（GAP-3.3）

- **修改**：审计报告格式与解析约定文档新增「Story 完成自检」章节
- **内容**：检查逻辑、scoring/data 路径、run_id 与 epic/story 对应关系
- **验收**：grep `Story 完成自检` 有匹配

---

## Phase 3：聚合与仪表盘（T9–T12）

### T9 [x] aggregateByEpicStoryTimeWindow 与 getLatestRunRecordsV2（GAP-4.1, 4.2）

- **修改**：`scoring/dashboard/compute.ts`、`scoring/query/loader.ts`
- **函数**：aggregateByEpicStoryTimeWindow(records, epic, story, windowHours)；getLatestRunRecordsV2(options: { strategy, epic?, story?, windowHours? })
- **验收**：单测覆盖；getLatestRunRecordsV2(strategy: 'epic_story_window', epic, story, windowHours) 返回预期子集

### T10 [x] dashboard-generate --strategy epic_story_window（GAP-4.3）

- **修改**：`scripts/dashboard-generate.ts`
- **内容**：支持 --strategy epic_story_window（默认）或 run_id；**当 strategy=epic_story_window 时必须调用 getLatestRunRecordsV2**（或 aggregateByEpicStoryTimeWindow）；完整 run 定义（至少 3 stage）；退化逻辑（若无完整 run 显示「数据不足」）
- **验收**：① `npx ts-node scripts/dashboard-generate.ts --strategy epic_story_window` 可执行；② **grep `getLatestRunRecordsV2` 或 `aggregateByEpicStoryTimeWindow` scripts/dashboard-generate.ts 有匹配**（生产路径验证）

### T11 [x] 验收 fixture 与 --dataPath（GAP-4.4）

- **内容**：二选一实现：① dashboard-generate 新增 `--dataPath`，集成测试指定 fixture 路径；② fixture 置于 `scoring/data/__fixtures-dashboard-epic-story/`，测试前复制、**测试后清理**
- **验收**：对已知 fixture 断言总分、四维与预期一致（±1）；fixture 可执行（--dataPath 可用或 scoring/data 复制+清理流程明确）

### T12 [x] getWeakTop3 扩展与跨 run 短板（GAP-4.5, 4.6）

- **修改**：`scoring/dashboard/compute.ts`
- **内容**：getWeakTop3 支持按 epic/story 聚合；同一 Story 各 stage 取最低分；仪表盘输出含跨 run 短板
- **验收**：单测覆盖；仪表盘输出含短板信息

---

## 3. 集成测试与 E2E 任务（必须）

| 任务 | 测试类型 | 验收 |
|------|----------|------|
| T4/T4b | 单元+集成 | trigger_stage 写入、单测 assert |
| T6 | 集成 | 有/无数据时 CLI 输出正确 |
| T9 | 单元 | aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 单测 |
| T10/T11 | 集成 | dashboard-generate 对 fixture 断言 |
| T12 | 单元 | getWeakTop3 按 epic/story 单测 |
| §4.4 | 生产路径 | grep dashboard-generate 调用 getLatestRunRecordsV2；SKILL 含 check 步骤 |

---

## 4. 验收表头（按 GAP 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|--------------|----------|----------|
| GAP-1.1a～c | T1 | SKILL 步骤 4.2、CLI、路径 | grep 验收 | [ ] | [ ] |
| GAP-1.2 | T2 | STORY-A4-POSTAUDIT 路径 | grep | [ ] | [ ] |
| GAP-1.3 | T3 | reportPath 解析、SCORE_WRITE_SKIP | doc 检查 | [ ] | [ ] |
| GAP-2.1～2.3 | T4 | types、schema、orchestrator、CLI | CLI 执行+record 检查 | [ ] | [ ] |
| GAP-2.3b | T4b | 单测 | assert trigger_stage | [ ] | [ ] |
| GAP-2.4 | T5 | --runGroupId、RUN_ID_CONVENTION | CLI 或 doc | [ ] | [ ] |
| GAP-3.1 | T6 | check-story-score-written.ts | 有/无数据 CLI | [ ] | [ ] |
| GAP-3.2 | T7 | SKILL 嵌入 | doc 检查 | [ ] | [ ] |
| GAP-3.3 | T8 | 文档章节 | grep | [ ] | [ ] |
| GAP-4.1～4.2 | T9 | 聚合函数 | 单测；**生产路径**：dashboard-generate 调用 getLatestRunRecordsV2 | [ ] | [ ] |
| GAP-4.3～4.4 | T10, T11 | dashboard --strategy、fixture | 集成+fixture 断言；**grep getLatestRunRecordsV2 scripts/dashboard-generate.ts** | [ ] | [ ] |
| GAP-4.5～4.6 | T12 | getWeakTop3 扩展 | 单测+仪表盘输出 | [ ] | [ ] |
