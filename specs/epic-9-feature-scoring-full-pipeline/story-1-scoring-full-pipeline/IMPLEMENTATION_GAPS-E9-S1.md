# IMPLEMENTATION_GAPS-E9-S1：评分全链路写入与仪表盘聚合

**Epic**：E9 feature-scoring-full-pipeline  
**Story**：9.1  
**输入**：spec-E9-S1.md、plan-E9-S1.md、Story 9.1、TASKS、当前实现

<!-- AUDIT: PASSED by code-reviewer -->

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.1.1, T1 | GAP-1.1a | 步骤 4.2 显式 checklist 插入 | 部分实现 | SKILL 有 stage4 的 parse-and-write-score 触发描述，但未找到「步骤 4.2：运行 parse-and-write-score（强制）」显式 checklist；需在「审计通过后评分写入触发」**之前**插入 |
| spec §3.1.1, T1 | GAP-1.1b | 完整 CLI 示例（含 --triggerStage bmad_story_stage4、--iteration-count） | 部分实现 | stage4 段落有 parse-and-write-score 要求，但 CLI 示例是否含完整参数需核对 |
| spec §3.1.1, T1 | GAP-1.1c | 报告路径模板 AUDIT_Story_{epic}-{story}_stage4.md | 部分实现 | stage4 路径有提及，是否与 T2 路径约定一致需核对 |
| spec §3.1.2, T2 | GAP-1.2 | STORY-A4-POSTAUDIT 约定报告保存路径 | 部分实现 | stage2 有「审计通过后请将报告保存至」；stage4 段落需新增 stage4 路径 `AUDIT_Story_{epic}-{story}_stage4.md` |
| spec §3.2.1, T3 | GAP-1.3 | 主 Agent 解析 reportPath、SCORE_WRITE_SKIP_REPORT_MISSING | 未实现 | SKILL 阶段四有 parse-and-write-score 触发，但未明确「从约定路径或子任务输出解析 reportPath」「reportPath 不存在时记录 SCORE_WRITE_SKIP_REPORT_MISSING 不阻断」 |
| spec §3.2.2, T4 | GAP-2.1 | RunScoreRecord.trigger_stage | 未实现 | scoring/writer/types.ts 无 trigger_stage 字段；parse-and-write-score 有 --triggerStage 参数但未传入 parseAndWriteScore、未写入 record |
| spec §3.2.2, T4 | GAP-2.2 | run-score-schema.json 扩展 | 未实现 | schema 未含 trigger_stage |
| spec §3.2.2, T4 | GAP-2.3 | parse-and-write options.triggerStage 透传 | 未实现 | ParseAndWriteScoreOptions 无 triggerStage；writeScoreRecordSync 未接收 trigger_stage |
| spec §3.2.2, T4 | GAP-2.3b | trigger_stage 写入单测覆盖 | 未实现 | 需单测 assert record.trigger_stage === "speckit_5_2" |
| spec §3.2.3, T11 | GAP-2.4 | run_id 共享、--runGroupId 或 dev-e{epic}-s{story}-{ts} | 未实现 | parse-and-write-score 无 --runGroupId；runId 每次生成新 ts；RUN_ID_CONVENTION 未补充多 stage 共享约定 |
| spec §3.3.1, T5 | GAP-3.1 | check-story-score-written.ts | 未实现 | 脚本不存在 |
| spec §3.3.1, T5 | GAP-3.2 | bmad-story-assistant 嵌入检查步骤 | 未实现 | 阶段四无「提供完成选项前执行 check-story-score-written」 |
| spec §3.3.2, T6 | GAP-3.3 | Story 完成自检文档章节 | 未实现 | 审计报告格式文档无「Story 完成自检」章节 |
| spec §3.4.1, T7 | GAP-4.1 | aggregateByEpicStoryTimeWindow | 未实现 | scoring/dashboard/compute.ts 无此函数 |
| spec §3.4.1, T7 | GAP-4.2 | getLatestRunRecordsV2 | 未实现 | 仅有 getLatestRunRecords；无 strategy、epic、story、windowHours 参数 |
| spec §3.4.2, T8 | GAP-4.3 | dashboard-generate --strategy epic_story_window | 未实现 | 脚本无 --strategy 参数；固定使用 getLatestRunRecords；无完整 run 定义、退化逻辑 |
| spec §3.4.2, T8 | GAP-4.4 | 验收 fixture | 未实现 | 无 scoring/data/__fixtures-dashboard-epic-story/ 或 --dataPath |
| spec §3.4.3, T9 | GAP-4.5 | getWeakTop3 按 epic/story 聚合 | 部分实现 | getWeakTop3 存在，但按 run 内 phase_score 升序；需扩展支持按 epic/story 跨 run 聚合、同一 Story 各 stage 取最低分 |
| spec §3.4.3, T9 | GAP-4.6 | 仪表盘输出跨 run 短板 | 未实现 | 当前 getWeakTop3 输出为单 run；需跨 run 聚合后计算 |

---

## 2. 需求映射清单（Gaps ↔ spec/plan）

| Gap ID | spec 章节 | plan 对应 | 覆盖状态 |
|--------|----------|----------|----------|
| GAP-1.1a～1.1c | §3.1.1 | Phase 1.1 T1 | ✅ |
| GAP-2.3b | §3.2.2 | Phase 1.2 T4 单测 | ✅ |
| GAP-1.2 | §3.1.2 | Phase 1.1 T2 | ✅ |
| GAP-1.3 | §3.2.1 | Phase 1.1 T3 | ✅ |
| GAP-2.1～2.4 | §3.2.2, §3.2.3 | Phase 1.2 T4、T11 | ✅ |
| GAP-3.1～3.3 | §3.3 | Phase 2 T5、T6 | ✅ |
| GAP-4.1～4.6 | §3.4 | Phase 3 T7、T8、T9 | ✅ |

---

## 3. plan §4 集成测试与 E2E 计划 ↔ 当前实现

| plan §4 测试项 | 当前实现状态 | 缺失/偏差说明 |
|----------------|-------------|---------------|
| §4.1 parse-and-write-score 单元/集成 | 部分 | 有 orchestrator 单测；trigger_stage 写入集成测试因 GAP-2.1～2.3 未落地而无法执行 |
| §4.2 check-story-score-written 集成 | 未实现 | 脚本不存在，无有/无数据集成测试 |
| §4.3 聚合与仪表盘单测/集成 | 部分 | getWeakTop3 有单测；aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2、dashboard --strategy 均未实现 |
| §4.4 生产路径验证、getLatestRunRecordsV2 调用验证 | 未实现 | dashboard-generate 未调用 getLatestRunRecordsV2；check-story SKILL 嵌入、E2E 均未落地 |

---

## 4. spec §4 成功标准 ↔ 实现状态

| 成功标准 | 实现状态 | 说明 |
|----------|----------|------|
| 写入链路闭环 | 部分 | speckit 各 stage 可写入；bmad-story-assistant 步骤 4.2、T3 reportPath 解析、trigger_stage 未完整 |
| 自检可用 | 未实现 | check-story-score-written 不存在 |
| 聚合正确 | 未实现 | epic_story_window 策略、完整 run、退化逻辑未实现 |
| trigger_stage 区分 | 未实现 | record 无 trigger_stage 字段 |
| run_id 共享 | 未实现 | 无 --runGroupId，RUN_ID_CONVENTION 未更新 |

---

## 5. spec §1/§5、plan §5/§6 简要分析

| 章节 | 分析结论 |
|------|----------|
| spec §1 概述 | 实施范围 T1–T9、T11 已在 §1 Gaps 中逐条对应 |
| spec §5 涉及源文件 | 与 GAP 表格中的修改路径一致；无额外遗漏 |
| plan §5 文件改动 | 新增 check-story-score-written、fixture 目录；修改文件列表与 GAP 一致 |
| plan §6 验收命令 | 各 Phase 验收命令依赖 GAP 落地；当前无法执行 T5、T7、T8、T9 验收 |
| Story Dev Notes | 架构模式、涉及源文件与 spec/plan 一致 |
| TASKS §1 REQ | REQ-1～REQ-7 均通过 T1–T9、T11 映射到 GAP |

---

## 6. 实施优先级（依赖顺序）

1. **Phase 1 先行**：GAP-2.1～2.3（T4 trigger_stage）→ GAP-2.4（T11 run_id）→ GAP-1.1～1.3（T1～T3 SKILL）
2. **Phase 2**：GAP-3.1（T5 脚本）→ GAP-3.2（SKILL 嵌入）→ GAP-3.3（T6 文档）
3. **Phase 3**：GAP-4.1～4.2（T7 聚合）→ GAP-4.3～4.4（T8 仪表盘）→ GAP-4.5～4.6（T9 短板）
