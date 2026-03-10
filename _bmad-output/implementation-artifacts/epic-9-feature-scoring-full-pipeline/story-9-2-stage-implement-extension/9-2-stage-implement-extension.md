# Story 9.2: stage=implement 扩展（中期增强）

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** 评分消费方与仪表盘用户，  
**I want** parse-and-write-score 原生支持 stage=implement，配套 implement 专用解析规则与 scoring 规则，  
**so that** 仪表盘能区分 tasks 审计与 implement 审计，实现完整的 stage 维度评分，摆脱 trigger_stage 短期方案的语义混用。

## Scope

本 Story 承接 Story 9.1 的 trigger_stage 短期方案（T4）后的架构演进：

- 扩展 `AuditStage` 与 `RunScoreRecord` 支持 `stage='implement'`
- parse-and-write-score 新增 `--stage implement`，配套 implement 专用解析与 scoring 规则
- 仪表盘与查询层将 `stage=implement` 作为独立 stage 纳入「完整 run」定义
- speckit-workflow implement 阶段审计通过后改用 `--stage implement` 调用（替代当前 `--stage tasks --triggerStage speckit_5_2`）

**Epic 内范围划分**：
- Epic 级仪表盘聚合（仅传 `--epic N` 时展示 Epic 下多 Story 聚合视图）由 **Story 9.3** 负责；本 Story 不涉及 Epic 级聚合逻辑。
- 本 Story 完成后，仪表盘「完整 run」定义将同时支持 `stage=implement` 与既有 `trigger_stage=speckit_5_2` 两种标识（向后兼容）。

## Acceptance Criteria

| # | 需求 | 验收标准 |
|---|------|----------|
| AC-1 | parse-and-write-score 支持 --stage implement | `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage implement --epic N --story N` 执行成功后，scoring/data 下 record 含 `stage: "implement"`；单测覆盖 |
| AC-2 | scoring 存储 schema 兼容 implement stage | run-score-schema.json 的 stage 枚举或描述支持 "implement"；现有 record（含 trigger_stage）不受影响 |
| AC-3 | implement 专用解析规则 | 使用 scoring/rules/default/implement-scoring.yaml 的 items、veto_items；环节 2 权重 0.25（PHASE_WEIGHT_IMPLEMENT）；parseGenericReport 扩展支持 stage='implement' |
| AC-4 | audit-item-mapping 支持 implement | config/audit-item-mapping.yaml 含 implement 段（若无则新增）；resolveItemId、resolveEmptyItemId 支持 AuditStage='implement' |
| AC-5 | 仪表盘正确展示 implement 阶段评分 | dashboard-generate 的「完整 run」定义：含 spec/plan/gaps/tasks 至少 3 个 stage 基础上，将 `stage=implement` 或 `trigger_stage=speckit_5_2` 计入；仪表盘输出能区分 implement 与 tasks 得分 |
| AC-6 | speckit-workflow 启用 stage=implement 调用 | speckit-workflow SKILL §5.2 implement 阶段「审计通过后评分写入触发」段落改为使用 `--stage implement`（替代 `--stage tasks --triggerStage speckit_5_2`）；保持报告路径 `AUDIT_implement-E{epic}-S{story}.md` 约定 |
| AC-7 | 触发模式表注册 implement | config/scoring-trigger-modes.yaml 的 call_mapping 中，speckit_5_2_audit_pass 触发时，CLI 传入 `--stage implement` 可通过 trigger 校验（或等效机制） |

## Tasks / Subtasks

- [ ] **Task 1（AC-1、AC-3）**：扩展 AuditStage 与 parse-and-write-score
  - [ ] 1.1 修改 scoring/parsers/audit-index.ts：`AuditStage` 增加 `'implement'`
  - [ ] 1.2 修改 scoring/parsers/audit-item-mapping.ts：`AuditStage` 增加 `'implement'`
  - [ ] 1.3 修改 scoring/constants/weights.ts：新增 `PHASE_WEIGHT_IMPLEMENT = 0.25`
  - [ ] 1.4 修改 scoring/parsers/audit-index.ts：switch 增加 `case 'implement'`，调用 `parseGenericReport(..., stage: 'implement', phaseWeight: PHASE_WEIGHT_IMPLEMENT)`
  - [ ] 1.5 修改 scoring/parsers/audit-generic.ts：`GenericAuditStage` 扩展为包含 `'implement'`（当 `GenericAuditStage` 类型定义不包含 `implement` 时扩展）；确保 implement 使用 implement-scoring.yaml 的规则
  - [ ] 1.6 修改 scripts/parse-and-write-score.ts：CLI usage 与 stage 类型包含 implement
  - [ ] 1.7 单测：parseAuditReport(stage='implement') 返回 record.stage === 'implement'；phase_weight === 0.25
- [ ] **Task 2（AC-2）**：run-score-schema 与 RunScoreRecord
  - [ ] 2.1 确认 run-score-schema.json 的 stage 字段接受 "implement"（string 类型已兼容；enum 类型则扩展 enum 列表）
  - [ ] 2.2 确认 RunScoreRecord 的 stage 类型包含 'implement'
- [ ] **Task 3（AC-4）**：audit-item-mapping implement 段
  - [ ] 3.1 检查 config/audit-item-mapping.yaml 是否存在；存在则增加 implement 段（dimensions、checks、empty_overall、empty_dimensions）；不存在则新建并含 implement 段
  - [ ] 3.2 修改 audit-item-mapping.ts 的 loadMapping 迭代列表，增加 'implement'
- [ ] **Task 4（AC-5）**：仪表盘完整 run 定义
  - [ ] 4.1 修改 scoring/dashboard/compute.ts：完整 run 定义中，将 `stage=implement` 与 `trigger_stage=speckit_5_2` 均计为 implement 阶段（满足其一即可）
  - [ ] 4.2 仪表盘展示时能区分 implement 与 tasks 的 phase_score（按 stage 或 trigger_stage 展示）
  - [ ] 4.3 单测覆盖：给定含 stage=implement 的 record，聚合与短板计算正确
- [ ] **Task 5（AC-6）**：speckit-workflow SKILL 更新
  - [ ] 5.1 定位 skills/speckit-workflow/SKILL.md 或 ~/.cursor/skills/speckit-workflow/SKILL.md（项目内优先）
  - [ ] 5.2 修改 §5.2 implement 阶段「审计通过后评分写入触发」段落：CLI 调用改为 `--stage implement`，移除 `--triggerStage speckit_5_2`
  - [ ] 5.3 保持报告路径约定 `AUDIT_implement-E{epic}-S{story}.md`
- [ ] **Task 6（AC-7）**：trigger 与 implement 衔接
  - [ ] 6.1 确认 config/scoring-trigger-modes.yaml 中 speckit_5_2_audit_pass 在 `--stage implement` 调用时能通过 shouldWriteScore 校验
  - [ ] 6.2 当 trigger 逻辑依赖 stage 参数时，扩展对 implement 的识别；当 trigger 不依赖 stage 时，文档化「triggerStage 与 stage 一致时省略 --triggerStage」的约定

## Dev Notes

### 架构模式与约束

- **演进路径**：Story 9.1 T4 采用 trigger_stage 短期方案，implement 阶段以 `--stage tasks --triggerStage speckit_5_2` 写入。本 Story 为中期增强：原生 `stage=implement`，不再混用 tasks 解析器。
- **复用策略**：implement 报告格式与 tasks 一致（表格+结论+可解析块：总体评级、维度评分），故复用 `parseGenericReport`；规则从 scoring/rules/default/implement-scoring.yaml 加载。
- **向后兼容**：既有的 trigger_stage=speckit_5_2 记录继续有效；仪表盘完整 run 定义同时识别 stage=implement 与 trigger_stage=speckit_5_2。
- **环节权重**：Architecture §3.2 六环节权重，环节 2（implement）为 25%，故 PHASE_WEIGHT_IMPLEMENT = 0.25。

### 涉及源文件

| 模块 | 路径 | 修改内容 |
|------|------|----------|
| parsers | scoring/parsers/audit-index.ts | AuditStage 扩展、case implement |
| parsers | scoring/parsers/audit-item-mapping.ts | AuditStage 扩展、loadMapping |
| parsers | scoring/parsers/audit-generic.ts | GenericAuditStage 扩展（若需） |
| constants | scoring/constants/weights.ts | PHASE_WEIGHT_IMPLEMENT |
| schema | scoring/schema/run-score-schema.json | stage 枚举/描述（若为 enum） |
| config | config/audit-item-mapping.yaml | implement 段 |
| scripts | scripts/parse-and-write-score.ts | --stage implement |
| dashboard | scoring/dashboard/compute.ts | 完整 run 定义 |
| skills | speckit-workflow/SKILL.md | §5.2 CLI 调用 |
| config | config/scoring-trigger-modes.yaml | implement 触发校验扩展（当 trigger 依赖 stage 时） |

### 测试标准

- **Task 1**：单测 `parseAuditReport({ stage: 'implement', ... })` 返回 record.stage === 'implement'、phase_weight === 0.25；使用 implement 报告 fixture（含可解析块）
- **Task 4**：单测完整 run 定义含 stage=implement；短板计算正确
- **E2E**：`npx ts-node scripts/parse-and-write-score.ts --reportPath <implement报告> --stage implement --epic N --story N` 执行后，scoring/data 下 record 含 stage: "implement"

### Project Structure Notes

- implement 报告约定路径：`AUDIT_implement-E{epic}-S{story}.md`（与 config/eval-lifecycle-report-paths.yaml 一致）
- implement-scoring.yaml 已存在：scoring/rules/default/implement-scoring.yaml，含 items、veto_items、weights
- bmad-code-reviewer-lifecycle Skill 引用 parseAndWriteScore，本 Story 不修改该 Skill，仅扩展解析与 CLI

### References

- [Source: _bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md] 议题 5 共识、T4 注「中期扩展 stage=implement 归属 Story 9.2」
- [Source: scoring/rules/default/implement-scoring.yaml] implement 环节 2 规则
- [Source: scoring/parsers/audit-index.ts] parseAuditReport 与 AuditStage
- [Source: scoring/parsers/audit-generic.ts] parseGenericReport、extractOverallGrade
- [Source: docs/BMAD/审计报告格式与解析约定.md] 可解析块格式
- [Source: C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md] 禁止词表、Story 文档规范

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
