# Story 9.1: 评分全链路写入与仪表盘聚合

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** BMAD 工作流编排者与评分消费方，  
**I want** bmad-story-assistant 阶段四与 speckit-workflow 各 stage 审计通过后自动执行 parse-and-write-score、Story 完成时自检 scoring/data 是否已写入、仪表盘按 epic/story 聚合计算总分与短板，  
**so that** 评分数据全链路可追溯、仪表盘能正确反映完整 Story 的多 stage 综合得分。

## 实施范围说明

本 Story 实施 `_bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md` 中的 **T1、T2、T3、T4、T5、T6、T7、T8、T9、T11**。

**不在本 Story 范围**（Phase 0 已完成）：
- **T10**：speckit-workflow 各 stage 审计通过后强制 parse-and-write-score，已在 Phase 0 bootstrap 完成。
- **T12**：audit-prompts §1、§2、§3、§5 可解析评分块强制要求，已在 Phase 0 bootstrap 完成。

**任务依赖关系**（按 TASKS §3）：
- Phase 1 写入链路：T1 → T2 → T3 → T4 → T10 → T11（T10 已完成，本 Story 实施 T1、T2、T3、T4、T11）
- Phase 2 收尾自检：T5 → T6（依赖 T3、T4）
- Phase 3 聚合与仪表盘：T7 → T8 → T9（T7 无依赖；T8 依赖 T7；T9 依赖 T8）

## Acceptance Criteria

| # | 需求 | 对应任务 | 验收标准 |
|---|------|----------|----------|
| AC-1 | bmad-story-assistant 阶段四插入 parse-and-write-score 显式步骤 | T1 | SKILL.md 中含「步骤 4.2：运行 parse-and-write-score」；含完整 CLI 示例；含报告路径模板 `AUDIT_Story_{epic}-{story}_stage4.md` |
| AC-2 | 审计子任务 prompt 约定报告保存路径 | T2 | STORY-A4-POSTAUDIT 模板中含报告保存路径约定 |
| AC-3 | 主 Agent 收到审计通过后自动解析 reportPath | T3 | SKILL 文档明确自动化逻辑及边界条件（reportPath 不存在时记录 SCORE_WRITE_SKIP_REPORT_MISSING，不阻断） |
| AC-4 | parse-and-write-score 支持 trigger_stage 区分 | T4 | `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage tasks --triggerStage speckit_5_2 ...` 执行后，scoring/data 下 record 含 `trigger_stage: "speckit_5_2"`；单测覆盖 |
| AC-5 | Story 完成时检查 scoring/data 是否已写入 | T5 | `npx ts-node scripts/check-story-score-written.ts --epic 8 --story 1` 可运行，输出有/无记录；SKILL 流程中嵌入检查步骤 |
| AC-6 | 检查逻辑与路径约定文档化 | T6 | grep `Story 完成自检` docs/BMAD/审计报告格式与解析约定.md 有匹配；该章节含检查逻辑、scoring/data 路径、run_id 与 epic/story 对应关系 |
| AC-7 | 聚合逻辑：按时间窗口与 epic/story 聚合 | T7 | 单测覆盖 aggregateByEpicStoryTimeWindow；getLatestRunRecordsV2(strategy: 'epic_story_window', epic, story, windowHours) 返回预期 record 子集 |
| AC-8 | 仪表盘按 epic/story 聚合计算总分与四维 | T8 | `npx ts-node scripts/dashboard-generate.ts --strategy epic_story_window` 可执行；对已知 fixture 断言总分与四维与预期一致（±1 舍入误差） |
| AC-9 | 跨 run 聚合与短板计算 | T9 | 单测覆盖 getWeakTop3 按 epic/story 聚合；仪表盘输出含跨 run 短板信息 |
| AC-10 | run_id 共享策略 | T11 | RUN_ID_CONVENTION 文档更新；--runGroupId 或等效机制可用 |

## Tasks / Subtasks

- [ ] **Task 1（AC-1）**：bmad-story-assistant 阶段四插入「parse-and-write-score」显式步骤
  - [ ] 1.1 定位 skills/bmad-story-assistant/SKILL.md 或 ~/.cursor/skills/bmad-story-assistant/SKILL.md（项目内优先）
  - [ ] 1.2 在「审计结论处理」→「通过（A/B 级）」→「审计通过后评分写入触发」段落之前插入步骤 4.2
  - [ ] 1.3 步骤 4.2 含：确定报告路径模板、完整 CLI 示例（含 --iteration-count）、non_blocking 失败处理
- [ ] **Task 2（AC-2）**：审计子任务 prompt 约定报告保存路径
  - [ ] 2.1 在 STORY-A4-POSTAUDIT 模板中增加报告保存路径约定
  - [ ] 2.2 锚点：`审计通过后请将报告保存至` 或 `AUDIT_Story_`
- [ ] **Task 3（AC-3）**：主 Agent 收到审计通过后自动解析 reportPath
  - [ ] 3.1 在阶段四「审计结论处理」增加：从约定路径或子任务输出解析 reportPath
  - [ ] 3.2 明确：reportPath 不存在时记录 SCORE_WRITE_SKIP_REPORT_MISSING，不阻断
- [ ] **Task 4（AC-4）**：parse-and-write-score 支持 trigger_stage
  - [ ] 4.1 RunScoreRecord 类型新增 `trigger_stage?: string`（scoring/writer/types.ts）
  - [ ] 4.2 run-score-schema.json 扩展 schema
  - [ ] 4.3 parse-and-write 在 options 中支持 triggerStage，写入时传入
  - [ ] 4.4 parse-and-write-score CLI 新增 --triggerStage 参数
  - [ ] 4.5 单测覆盖 trigger_stage 写入
- [ ] **Task 5（AC-5）**：Story 完成时检查 scoring/data 是否已写入
  - [ ] 5.1 新建 scripts/check-story-score-written.ts --epic N --story N [--dataPath path]
  - [ ] 5.2 检查逻辑：parseEpicStoryFromRecord 或 run_id 正则 `dev-e{N}-s{N}-`
  - [ ] 5.3 在 bmad-story-assistant 阶段四通过后、提供完成选项前嵌入检查
  - [ ] 5.4 补跑决策：默认仅提醒；若报告路径存在则执行 parse-and-write-score 补跑
- [ ] **Task 6（AC-6）**：检查逻辑与路径约定文档化
  - [ ] 6.1 在 docs/BMAD/审计报告格式与解析约定.md 新增「Story 完成自检」章节
  - [ ] 6.2 含：检查逻辑、scoring/data 路径、run_id 与 epic/story 对应关系
- [ ] **Task 7（AC-7）**：聚合逻辑按时间窗口与 epic/story
  - [ ] 7.1 新增 aggregateByEpicStoryTimeWindow(records, epic, story, windowHours)
  - [ ] 7.2 新增 getLatestRunRecordsV2(options: { strategy, epic?, story?, windowHours? })
  - [ ] 7.3 单测覆盖
- [ ] **Task 8（AC-8）**：仪表盘按 epic/story 聚合
  - [ ] 8.1 dashboard-generate 支持 --strategy epic_story_window（默认）或 run_id
  - [ ] 8.2 默认策略：按 epic/story 分组，时间窗口内取最新「完整 run」
  - [ ] 8.3 验收用例：已知 fixture 断言总分与四维
- [ ] **Task 9（AC-9）**：跨 run 聚合与短板计算
  - [ ] 9.1 getWeakTop3 扩展支持按 epic/story 聚合后计算
  - [ ] 9.2 同一 Story 下各 stage 取最低分作为短板得分，Top 3 升序
  - [ ] 9.3 单测覆盖
- [ ] **Task 10（AC-10）**：run_id 共享策略
  - [ ] 10.1 parse-and-write-score 新增 --runGroupId 参数，或约定 dev-e{epic}-s{story}-{ts} 格式
  - [ ] 10.2 scoring/docs/RUN_ID_CONVENTION.md 补充同一 Story 多 stage 共享 run_id 约定

## Dev Notes

### 架构模式与约束

- **写入链路**：bmad-story-assistant 阶段四、speckit-workflow 各 stage 审计通过后，主 Agent 或子代理执行 parse-and-write-score；reportPath 优先从约定路径推断，次从子任务输出提取。
- **聚合键**：同一 Story 的 spec+plan+gaps+tasks+implement 组合为一次「完整 run」；按 (epic, story, time_window) 或 run_group_id 聚合。
- **trigger_stage 短期方案**：implement 阶段传入 --stage tasks、--triggerStage speckit_5_2；record 写入 `trigger_stage: "speckit_5_2"` 区分。阶段扩展 stage=implement 为中期增强，由 Story 9.2 负责（epics.md 已定义 Story 9.2 scope 含该描述）。

### 涉及源文件

| 模块 | 路径 | 修改内容 |
|------|------|----------|
| bmad-story-assistant | ~/.cursor/skills/bmad-story-assistant/SKILL.md 或项目内 | T1、T2、T3、T5 流程修改 |
| scoring/writer | scoring/writer/types.ts | T4 trigger_stage 类型 |
| scoring/schema | scoring/schema/run-score-schema.json | T4 schema 扩展 |
| scoring/orchestrator | scoring/orchestrator/parse-and-write.ts | T4 triggerStage 透传 |
| scripts | scripts/parse-and-write-score.ts | T4 --triggerStage、T11 --runGroupId |
| scripts | scripts/check-story-score-written.ts | T5 新建 |
| scoring/dashboard | scoring/dashboard/compute.ts | T7、T8、T9 |
| scoring/query | scoring/query/loader.ts | T7 |
| scripts | scripts/dashboard-generate.ts | T8 |
| docs | docs/BMAD/审计报告格式与解析约定.md | T6 |
| scoring/docs | scoring/docs/RUN_ID_CONVENTION.md | T11 |

### 测试标准

- **T4**：单测覆盖 trigger_stage 写入，assert record.trigger_stage === "speckit_5_2"
- **T5**：check-story-score-written 集成验证
- **T7**：aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 单测
- **T8**：已知 fixture 执行 dashboard-generate，断言总分与四维
- **T9**：getWeakTop3 按 epic/story 聚合单测

### Project Structure Notes

- scoring/data/ 为评分存储目录；单文件模式为 {run_id}.json，JSONL 为 scores.jsonl
- run_id 正则 `dev-e{N}-s{N}-` 用于 epic/story 解析；parseEpicStoryFromRecord 位于 scoring/query/parse-epic-story.ts
- bmad-story-assistant SKILL：项目内 skills/ 优先于 ~/.cursor/skills/，以便 git 追踪

### References

- [Source: _bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md] 完整任务定义与验收标准
- [Source: scoring/query/parse-epic-story.ts] parseEpicStoryFromRecord、run_id 正则
- [Source: scoring/coach/filter-epic-story.ts] run_id 解析与 epic/story 过滤
- [Source: scripts/parse-and-write-score.ts] CLI 参数与 parseEpicStoryFromPath
- [Source: scoring/docs/RUN_ID_CONVENTION.md] run_id 约定
- [Source: C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md] 禁止词表、阶段四流程、STORY-A4-POSTAUDIT

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
