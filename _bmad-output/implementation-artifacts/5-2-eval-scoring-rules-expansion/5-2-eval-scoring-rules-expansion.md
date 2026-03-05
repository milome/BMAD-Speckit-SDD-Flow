# Story 5.2：eval-scoring-rules-expansion

Status: ready-for-dev

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.2  
**Slug**：eval-scoring-rules-expansion  
**包含 GAP**：B03（spec/plan/tasks 三阶段评分规则）、B11（四维加权 dimension_scores 解析）  
**前置依赖**：E2.1（已完成）

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a Scoring 系统的审计触发方，  
I want spec/plan/tasks 三阶段具备完整的百分制评分规则，且审计报告支持四维加权评分，  
so that 全流程每个节点都有程序化的评分标准，且评分维度权重由配置驱动。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **B03 spec/plan/tasks 评分规则**：
   - `spec-scoring.yaml`、`plan-scoring.yaml`、`tasks-scoring.yaml` 完整 YAML（items、veto_items、weights）
   - `audit-generic.ts`：`parseGenericReport`、`extractOverallGrade`、`extractCheckItems`（从 audit-prd.ts 迁移）
   - `audit-index.ts`：扩展 `AuditStage` 为 `'prd' | 'arch' | 'story' | 'spec' | 'plan' | 'tasks'`，新增 spec/plan/tasks 三个 case 分支
   - `applyTierAndVeto` 可正确处理 spec 阶段记录

2. **B11 四维加权评分**：
   - `dimension-parser.ts`：`stageToMode`、`parseDimensionScores`
   - `RunScoreRecord` 新增 `dimension_scores?: DimensionScore[]`
   - 报告包含 `维度名: 分数/100` 时用加权总分替代 `GRADE_TO_SCORE`；无维度时 fallback 到等级映射

### 1.2 本 Story 不包含

| 功能 | 负责 Story | 说明 |
|------|-----------|------|
| LLM 结构化提取 fallback | Story 5.3 | B05 依赖本 Story 的 audit-generic.ts |
| 能力短板聚类分析 | Story 5.4 | B06 clusterWeaknesses |
| SFT 提取、Prompt 优化、规则建议 | Story 5.5 | B07/B08/B09 |

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-B03-1 | spec 阶段审计报告调用通用解析器 `parseGenericReport`；正确解析为 `RunScoreRecord`，stage='spec'，phaseWeight=0.2；check_items 包含 spec_demand_coverage、spec_ambiguity_free、spec_testable、spec_terminology 等 item_id | 单测：audit-generic.test.ts 用例 1、2 |
| AC-B03-2 | plan 阶段同理：stage='plan'，phaseWeight=0.2；check_items 包含 plan_module_coverage、plan_dependency_clear、plan_gaps_actionable、plan_test_integrated | 单测：audit-generic.test.ts 用例 4、5 |
| AC-B03-3 | tasks 阶段同理：stage='tasks'，phaseWeight=0.2；check_items 包含 tasks_executable、tasks_gaps_mapped、tasks_acceptance_defined、tasks_granularity_ok | 单测：audit-generic.test.ts 用例 7、8 |
| AC-B03-4 | spec-scoring.yaml 含 4 个 items 和 1 个 veto_item（veto_core_unmapped）；`applyTierAndVeto` 处理 spec 阶段记录时正确应用扣分和一票否决逻辑 | 单测或集成测试 |
| AC-B03-5 | 等级缺失时抛出 ParseError | 单测：audit-generic.test.ts 用例 3、6、9 |
| AC-B11-1 | 审计报告包含 `维度名: 分数/100` 格式；调用 `parseDimensionScores(content, mode)` 返回 `DimensionScore[]`；加权总分 = Σ(score × weight / 100) | 单测：dimension-parser.test.ts 用例 1、5 |
| AC-B11-2 | 报告无维度评分时返回空数组（fallback 到 GRADE_TO_SCORE 等级映射） | 单测：dimension-parser.test.ts 用例 2 |
| AC-B11-3 | `stageToMode('spec')`、`stageToMode('plan')`、`stageToMode('tasks')` 均返回 'prd' mode | 单测：dimension-parser.test.ts |

---

## 3. Tasks / Subtasks

### Task 1：B03 spec/plan/tasks 评分规则 YAML（AC: AC-B03-1 至 AC-B03-4）

- [ ] 1.1 修改 `scoring/rules/spec-scoring.yaml`：完整定义 version、stage、link_stage、weights、items（spec_demand_coverage、spec_ambiguity_free、spec_testable、spec_terminology）、veto_items（veto_core_unmapped）
- [ ] 1.2 修改 `scoring/rules/plan-scoring.yaml`：完整定义 items（plan_module_coverage、plan_dependency_clear、plan_gaps_actionable、plan_test_integrated）、veto_items（veto_plan_no_test_strategy）
- [ ] 1.3 修改 `scoring/rules/tasks-scoring.yaml`：完整定义 items（tasks_executable、tasks_gaps_mapped、tasks_acceptance_defined、tasks_granularity_ok）、veto_items（veto_tasks_no_acceptance）
- [ ] 1.4 新增 `scoring/parsers/audit-generic.ts`：实现 `extractOverallGrade(content)`、`extractCheckItems(content, stage)`、`parseGenericReport(input)`；从 `audit-prd.ts` 迁移 `extractOverallGrade` 和 `extractCheckItemsFromPrd` 并 export
- [ ] 1.5 修改 `scoring/parsers/audit-prd.ts`：移除 `extractOverallGrade`、`extractCheckItemsFromPrd` 实现，改为从 `audit-generic.ts` import 调用
- [ ] 1.6 修改 `scoring/parsers/audit-index.ts`：扩展 `AuditStage` 为 `'prd' | 'arch' | 'story' | 'spec' | 'plan' | 'tasks'`；switch 新增 `case 'spec':`、`case 'plan':`、`case 'tasks':`，分别调用 `parseGenericReport({ stage, phaseWeight: 0.2 })`
- [ ] 1.7 修改 `scoring/parsers/index.ts`：re-export 扩展后的 `AuditStage`
- [ ] 1.8 修改 `scoring/schema/run-score-schema.json`：stage enum 新增 `"spec"`（plan、tasks 已存在）
- [ ] 1.9 修改 `scoring/constants/weights.ts`：新增 `PHASE_WEIGHTS_SPEC`、`PHASE_WEIGHTS_PLAN`、`PHASE_WEIGHTS_TASKS`（均为 0.2）
- [ ] 1.10 修改 `scripts/parse-and-write-score.ts`：stage 类型断言更新为 `AuditStage`（import from parsers）
- [ ] 1.11 新增 fixtures：`sample-spec-report.md`、`sample-plan-report.md`、`sample-tasks-report.md`
- [ ] 1.12 新增 `scoring/parsers/__tests__/audit-generic.test.ts`：9 个测试用例（每阶段 3 个：正常解析、check_items、等级缺失→ParseError）

### Task 2：B11 四维加权评分（AC: AC-B11-1 至 AC-B11-3）

- [ ] 2.1 新增 `scoring/parsers/dimension-parser.ts`：实现 `stageToMode(stage): 'code'|'prd'|'arch'|'pr'`；实现 `parseDimensionScores(content, mode, configPath?): DimensionScore[]`
- [ ] 2.2 `stageToMode` 映射规则：prd|spec|plan|tasks→'prd'；arch→'arch'；story|implement|post_impl→'code'；pr_review→'pr'
- [ ] 2.3 `parseDimensionScores`：正则 `/[-*]\s*(.+?):\s*(\d+)\s*[\/／]\s*100/` 提取；从 `config/code-reviewer-config.yaml` 读取权重；加权总分 `Σ(score × weight / 100)`
- [ ] 2.4 修改 `scoring/writer/types.ts`：`RunScoreRecord` 新增 `dimension_scores?: DimensionScore[]`
- [ ] 2.5 修改 `scoring/schema/run-score-schema.json`：新增 `dimension_scores` 数组属性定义
- [ ] 2.6 修改 `scoring/orchestrator/parse-and-write.ts`：解析 record 后调用 `parseDimensionScores(content, stageToMode(stage))`；结果非空时用加权总分替代 GRADE_TO_SCORE，附加 dimension_scores
- [ ] 2.7 新增 fixture `sample-prd-report-with-dimensions.md`
- [ ] 2.8 新增 `scoring/parsers/__tests__/dimension-parser.test.ts`：6 个测试用例

---

## 4. Dev Notes

### 4.1 技术约束

- **B03**：`extractOverallGrade`、`extractCheckItems` 从 audit-prd.ts 迁移到 audit-generic.ts 并 export；B05 的 LLM fallback 接入点在 audit-generic.ts 的 `extractOverallGrade` 返回 null 时（本 Story 仅完成迁移，不实现 LLM）
- **B11**：维度解析结果为空时 fallback 到 GRADE_TO_SCORE，不抛异常；config 文件不存在时返回空数组；加权分数范围 0–100，不影响 applyTierAndVeto

### 4.2 实现参考

| 项目 | 路径 |
|------|------|
| 需求与实现方案 | `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1 §GAP-B03、§GAP-B11 |
| Epic/Story 定义 | `_bmad-output/planning-artifacts/dev/epics.md` §3 Story 5.2 |
| 现有解析器 | `scoring/parsers/audit-prd.ts`、`audit-arch.ts`、`audit-story.ts` |
| code-reviewer-config | `config/code-reviewer-config.yaml` |
| RunScoreRecord 类型 | `scoring/writer/types.ts` |

### 4.3 新增文件一览（8 个）

| 类型 | 路径 |
|------|------|
| 实现 | `scoring/parsers/audit-generic.ts` |
| 实现 | `scoring/parsers/dimension-parser.ts` |
| 测试 | `scoring/parsers/__tests__/audit-generic.test.ts` |
| 测试 | `scoring/parsers/__tests__/dimension-parser.test.ts` |
| fixture | `scoring/parsers/__tests__/fixtures/sample-spec-report.md` |
| fixture | `scoring/parsers/__tests__/fixtures/sample-plan-report.md` |
| fixture | `scoring/parsers/__tests__/fixtures/sample-tasks-report.md` |
| fixture | `scoring/parsers/__tests__/fixtures/sample-prd-report-with-dimensions.md` |

### 4.4 修改文件一览（9 个）

| 文件 | 变更 |
|------|------|
| `scoring/rules/spec-scoring.yaml` | 完整 YAML 定义 |
| `scoring/rules/plan-scoring.yaml` | 完整 YAML 定义 |
| `scoring/rules/tasks-scoring.yaml` | 完整 YAML 定义 |
| `scoring/parsers/audit-index.ts` | AuditStage 扩展、spec/plan/tasks case 分支 |
| `scoring/parsers/index.ts` | re-export AuditStage |
| `scoring/parsers/audit-prd.ts` | 迁移 extractOverallGrade、extractCheckItems 到 audit-generic |
| `scoring/schema/run-score-schema.json` | stage enum 新增 spec；dimension_scores 属性 |
| `scoring/writer/types.ts` | dimension_scores 新增 |
| `scoring/constants/weights.ts` | PHASE_WEIGHTS_SPEC/PLAN/TASKS |
| `scoring/orchestrator/parse-and-write.ts` | parseDimensionScores 调用、加权分数逻辑 |
| `scripts/parse-and-write-score.ts` | stage 类型为 AuditStage |

### 4.5 测试用例总数

- B03：9 个（audit-generic.test.ts）
- B11：6 个（dimension-parser.test.ts）  
**合计**：15 个

---

## 5. References

- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B03] spec/plan/tasks 评分规则实现方案（YAML 结构、audit-generic.ts 函数签名、9 个测试用例）
- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B11] 四维加权 dimension-parser.ts 实现方案（stageToMode、parseDimensionScores、6 个测试用例）
- [Source: _bmad-output/planning-artifacts/dev/epics.md#Story-5.2] Epic 5 Story 5.2 完整定义

---

## 6. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
