# Story 5.2：eval-scoring-rules-expansion

Status: done

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.2  
**Slug**：eval-scoring-rules-expansion  
**包含 GAP**：B03（spec/plan/tasks 三阶段评分规则）、B11（四维加权评分）  
**前置依赖**：E2.1（已完成）、Story 5.1（已完成）

---

## 0. Party-Mode 决议摘要（100 轮）

本 Story 涉及解析架构选择、评分口径统一、向后兼容边界，属于多方案设计决策场景，已执行 party-mode 多角色辩论并收敛。

- **参与角色**：批判性审计员、Winston 架构师、Amelia 开发、John 产品经理、Quinn 测试
- **总轮次**：100 轮
- **收敛状态**：第 98-100 轮无新增 gap，批判性审计员完成终审陈述并同意进入执行
- **单一方案**：
  1. 新增 `audit-generic.ts` 统一承接 spec/plan/tasks 解析，不复用 `audit-prd.ts` 私有函数实现
  2. 新增 `dimension-parser.ts`，以 `code-reviewer-config.yaml` 作为权重权威来源
  3. 维度分解析失败时保持等级映射路径，保证旧报告格式持续可写入
  4. 明确 `stageToMode` 映射，spec/plan/tasks 统一映射到 `prd` mode

### 0.1 关键分歧与闭合记录

| 轮次区间 | 分歧焦点 | 闭合结论 |
| --- | --- | --- |
| 1-24 | spec/plan/tasks 是否复用 `audit-prd.ts` | 采用新文件 `audit-generic.ts`，避免 PRD 语义耦合 |
| 25-49 | 维度权重来源是否硬编码在 parser | 统一读取 `config/code-reviewer-config.yaml`，禁止硬编码 |
| 50-73 | 无维度分时是否直接报错 | 维持 `GRADE_TO_SCORE` 路径，解析器返回空数组并继续 |
| 74-97 | `stageToMode` 映射边界与 schema 兼容 | 固化映射规则并扩展 `run-score-schema.json` |
| 98-100 | 风险复核 | 无新增风险项，进入 Story 任务分解 |

---

## 1. Story

As a Scoring 系统的审计触发方，  
I want spec/plan/tasks 三阶段具备完整的百分制评分规则，且审计报告支持四维加权评分，  
so that 全流程节点都有程序化评分标准，并由统一配置驱动维度权重计算。

---

## 2. Scope（范围）

### 2.1 本 Story 实现范围

1. **B03 三阶段评分规则落地**
   - 完整实现 `scoring/rules/spec-scoring.yaml`、`scoring/rules/plan-scoring.yaml`、`scoring/rules/tasks-scoring.yaml`
   - 新增 `scoring/parsers/audit-generic.ts`，提供 `extractOverallGrade`、`extractCheckItems`、`parseGenericReport`
   - 扩展 `scoring/parsers/audit-index.ts` 的 `AuditStage`，支持 `spec|plan|tasks`
   - 更新 `scripts/parse-and-write-score.ts` 的 `stage` 类型，允许三阶段输入

2. **B11 四维加权评分落地**
   - 新增 `scoring/parsers/dimension-parser.ts`，提供 `stageToMode` 与 `parseDimensionScores`
   - 扩展 `RunScoreRecord`：新增 `dimension_scores` 字段
   - 扩展 `run-score-schema.json` 对 `dimension_scores` 的 schema 定义
   - 在 `parse-and-write.ts` 中接入维度加权总分覆盖逻辑

### 2.2 不在本 Story 范围但属于本 Epic 的功能闭环

| 功能 | 归属 |
| --- | --- |
| LLM 结构化提取容错（B05） | **由 Story 5.3 负责**：在 `scoring/parsers/llm-fallback.ts` 实现 `llmStructuredExtract`，并接入 `audit-prd.ts`、`audit-arch.ts`、`audit-story.ts`、`audit-generic.ts` |
| 能力短板聚类分析（B06） | **由 Story 5.4 负责**：在 `scoring/analytics/cluster-weaknesses.ts` 实现 `clusterWeaknesses`，并集成至 `scoring/coach/diagnose.ts` |
| SFT 提取、Prompt 建议、规则建议（B07/B08/B09） | **由 Story 5.5 负责**：实现 `sft-extractor.ts`、`prompt-optimizer.ts`、`rule-suggestion.ts` 与对应 CLI/测试 |
| 版本锁定、触发加载、回写、回退建议（B02/B04/B10/B12/B13） | **由 Story 5.1 负责并已完成**：以 `source_hash`、`trigger-loader`、`writeback`、`rollback` 为基线能力输入 |

---

## 3. 需求追溯

| 来源需求 | 本 Story 覆盖点 | 对应 AC |
| --- | --- | --- |
| `epics.md` Story 5.2（B03） | 三阶段 YAML 规则 + 通用解析入口 | AC-B03-1 ~ AC-B03-5 |
| `epics.md` Story 5.2（B11） | 维度分提取 + 加权总分 + schema 扩展 | AC-B11-1 ~ AC-B11-4 |
| `TASKS_gaps功能补充实现.md` GAP-B03 | `audit-generic.ts`、`AuditStage` 扩展、fixtures+9 测试 | AC-B03-1 ~ AC-B03-5 |
| `TASKS_gaps功能补充实现.md` GAP-B11 | `dimension-parser.ts`、`stageToMode`、6 测试 | AC-B11-1 ~ AC-B11-4 |
| `architecture.ai-code-eval-system.md` §2/§9 | `code-reviewer-config` 引用关系与 YAML 规则一致性 | AC-B03-4、AC-B11-1 |

---

## 4. Acceptance Criteria（验收标准）

| AC ID | 验收标准 | 验证方式 |
| --- | --- | --- |
| AC-B03-1 | `parseGenericReport` 能解析 spec 报告，记录 `stage='spec'` 且 `phase_weight=0.2` | `audit-generic.test.ts` |
| AC-B03-2 | `parseGenericReport` 能解析 plan 报告，记录 `stage='plan'` 且 `phase_weight=0.2` | `audit-generic.test.ts` |
| AC-B03-3 | `parseGenericReport` 能解析 tasks 报告，记录 `stage='tasks'` 且 `phase_weight=0.2` | `audit-generic.test.ts` |
| AC-B03-4 | 三阶段 YAML 文件含完整 `weights/items/veto_items`，且 `applyTierAndVeto` 对 spec 记录可执行 veto 判定 | `audit-generic.test.ts` + `apply-tier-and-veto.test.ts` |
| AC-B03-5 | 三阶段报告缺失等级时返回 ParseError | `audit-generic.test.ts` |
| AC-B11-1 | 报告含 `维度名: 分数/100` 时，`parseDimensionScores` 返回 `DimensionScore[]` 且可计算加权总分 | `dimension-parser.test.ts` |
| AC-B11-2 | 报告不含维度分时返回空数组，系统继续使用等级映射分数 | `dimension-parser.test.ts` + `parse-and-write.test.ts` |
| AC-B11-3 | `stageToMode('spec'/'plan'/'tasks')` 返回 `prd` | `dimension-parser.test.ts` |
| AC-B11-4 | `RunScoreRecord` 和 `run-score-schema.json` 同步新增 `dimension_scores` 定义 | schema 校验测试 + writer/orchestrator 断言 |

---

## 5. Tasks / Subtasks

### Task 1：B03 规则文件与阶段扩展（AC: AC-B03-1,2,3,4）

- [x] 1.1 完整重写 `scoring/rules/spec-scoring.yaml`
- [x] 1.2 完整重写 `scoring/rules/plan-scoring.yaml`
- [x] 1.3 完整重写 `scoring/rules/tasks-scoring.yaml`
- [x] 1.4 修改 `scoring/parsers/audit-index.ts`：扩展 `AuditStage` 与 `switch` 分发
- [x] 1.5 修改 `scoring/parsers/index.ts`：导出扩展后的 `AuditStage`
- [x] 1.6 修改 `scripts/parse-and-write-score.ts`：`stage` 参数类型改为 `AuditStage`

### Task 2：B03 通用解析器实现（AC: AC-B03-1,2,3,5）

- [x] 2.1 新增 `scoring/parsers/audit-generic.ts`
- [x] 2.2 将 `extractOverallGrade` 从 `audit-prd.ts` 抽离到 `audit-generic.ts`
- [x] 2.3 在 `audit-prd.ts` 中改为复用 `audit-generic.ts` 的导出函数
- [x] 2.4 在 `scoring/constants/weights.ts` 新增 spec/plan/tasks 的权重常量（0.2）

### Task 3：B11 维度加权实现（AC: AC-B11-1,2,3,4）

- [x] 3.1 新增 `scoring/parsers/dimension-parser.ts`
- [x] 3.2 实现 `stageToMode`：`prd|spec|plan|tasks -> prd`，`arch -> arch`，`story|implement|post_impl -> code`，`pr_review -> pr`
- [x] 3.3 实现 `parseDimensionScores`：按 `code-reviewer-config.yaml` 读取维度权重
- [x] 3.4 修改 `scoring/writer/types.ts`：新增 `dimension_scores?: DimensionScore[]`
- [x] 3.5 修改 `scoring/schema/run-score-schema.json`：新增 `dimension_scores` schema
- [x] 3.6 修改 `scoring/orchestrator/parse-and-write.ts`：接入维度总分覆盖逻辑

### Task 4：测试与夹具（AC: 全部）

- [x] 4.1 新增 fixtures：`sample-spec-report.md`、`sample-plan-report.md`、`sample-tasks-report.md`
- [x] 4.2 新增 fixture：`sample-prd-report-with-dimensions.md`
- [x] 4.3 新增 `scoring/parsers/__tests__/audit-generic.test.ts`（9 用例）
- [x] 4.4 新增 `scoring/parsers/__tests__/dimension-parser.test.ts`（6 用例）
- [x] 4.5 补充 `scoring/orchestrator/__tests__/parse-and-write.test.ts` 对维度加权路径与回退路径的断言

### Task 5：执行验收命令（AC: 全部）

- [x] 5.1 `npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts`
- [x] 5.2 `npm run test:scoring -- scoring/parsers/__tests__/dimension-parser.test.ts`
- [x] 5.3 `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts`
- [x] 5.4 `npm run test:scoring -- scoring/veto/__tests__/apply-tier-and-veto.test.ts`
- [x] 5.5 `npm run test:scoring`

---

## 6. Dev Notes

### 6.1 Technical Requirements

- 三阶段审计报告必须可被统一解析并写入 `RunScoreRecord`
- `run-score-schema.json` 的 `stage` 枚举必须加入 `spec`，保持 `plan/tasks` 兼容
- 维度加权计算公式固定为：`Σ(score × weight / 100)`，分值区间 0-100
- 维度数据缺失时保持等级映射路径，确保旧报告不阻塞评分写入

### 6.2 Architecture Compliance

- `scoring/rules` 规则项与 `code-reviewer-config` 的 `items/veto_items` 通过 `ref` 关联
- Stage 映射须对齐 `architecture.ai-code-eval-system.md` 的阶段-环节关系
- 扩展必须遵守 `scoring/parsers` 统一导出约定，避免侧向入口

### 6.3 Library / Framework Requirements

- 使用现有依赖 `js-yaml@^4.1.1` 读取 YAML 规则与权重，不引入替代 YAML 库
- 复用现有测试框架 `vitest`，统一放置在 `scoring/parsers/__tests__`
- 解析正则必须支持半角 `/` 与全角 `／` 斜杠格式

### 6.4 File Structure Requirements

#### 新增文件

- `scoring/parsers/audit-generic.ts`
- `scoring/parsers/dimension-parser.ts`
- `scoring/parsers/__tests__/audit-generic.test.ts`
- `scoring/parsers/__tests__/dimension-parser.test.ts`
- `scoring/parsers/__tests__/fixtures/sample-spec-report.md`
- `scoring/parsers/__tests__/fixtures/sample-plan-report.md`
- `scoring/parsers/__tests__/fixtures/sample-tasks-report.md`
- `scoring/parsers/__tests__/fixtures/sample-prd-report-with-dimensions.md`

#### 修改文件

- `scoring/rules/spec-scoring.yaml`
- `scoring/rules/plan-scoring.yaml`
- `scoring/rules/tasks-scoring.yaml`
- `scoring/parsers/audit-index.ts`
- `scoring/parsers/index.ts`
- `scoring/parsers/audit-prd.ts`
- `scoring/constants/weights.ts`
- `scoring/writer/types.ts`
- `scoring/schema/run-score-schema.json`
- `scoring/orchestrator/parse-and-write.ts`
- `scripts/parse-and-write-score.ts`

### 6.5 Testing Requirements

- 新增 15 个测试：`audit-generic` 9 个 + `dimension-parser` 6 个
- 覆盖点必须包含：正常路径、空维度路径、等级缺失异常路径、schema 同步路径
- 执行命令与结果需记录在本 Story 对应的 progress 文件

---

## 7. Previous Story Intelligence（来自 Story 5.1）

- `RunScoreRecord` 已包含 `base_commit_hash`、`content_hash`、`source_hash`，本 Story 扩展字段必须保持向后兼容
- `parse-and-write.ts` 已形成「解析 -> veto/tier -> 写入」流水，本 Story 维度加权逻辑插入点必须在写入之前
- `scripts/parse-and-write-score.ts` 已接入 trigger 机制，新增 `stage` 类型不改变 trigger 入口参数命名

---

## 8. Git Intelligence Summary

最近提交显示 Epic 5 基础能力已落地，当前 Story 重点是在已稳定的写入链路上增加三阶段规则和维度加权：

- `3b2a132`：完成 Story 5.1 并更新 `parse-and-write.ts`、`types.ts`、`run-score-schema.json`
- 该提交已创建 Epic 5 的 Story 文档目录结构，可直接沿用命名与测试组织模式

---

## 9. Latest Tech Information

- `package.json` 当前依赖为 `js-yaml@^4.1.1`，与本 Story 的 YAML 解析方案一致
- 项目使用 `@types/node@^25.3.3`，说明 Node API 处于现代版本基线；本 Story 无新增运行时平台门槛

---

## 10. Project Context Reference

未发现 `project-context.md`，本 Story 以以下工件作为执行上下文：

- `_bmad-output/planning-artifacts/dev/epics.md`
- `_bmad-output/planning-artifacts/dev/prd.ai-code-eval-system.md`
- `_bmad-output/planning-artifacts/dev/architecture.ai-code-eval-system.md`
- `_bmad-output/patent/TASKS_gaps功能补充实现.md`

---

## 11. References

- [Source: `_bmad-output/planning-artifacts/dev/epics.md`（Epic 5 / Story 5.2）]
- [Source: `_bmad-output/patent/TASKS_gaps功能补充实现.md`（GAP-B03, GAP-B11）]
- [Source: `_bmad-output/planning-artifacts/dev/architecture.ai-code-eval-system.md`（§2、§4、§9）]
- [Source: `_bmad-output/planning-artifacts/dev/prd.ai-code-eval-system.md`（REQ-2.2, REQ-3.2, REQ-3.12, REQ-3.14）]
- [Source: `config/code-reviewer-config.yaml`]
- [Source: `scoring/parsers/audit-index.ts`]
- [Source: `scoring/orchestrator/parse-and-write.ts`]

---

## 12. Story Completion Status

- B03（T1/T2）与 B11（T3）已按任务顺序完成实现，相关测试与验收命令已执行通过
- T4 测试与夹具已补全：`audit-generic` 9 用例、`dimension-parser` 7 用例（新增无列表前缀维度分场景）、orchestrator/veto 断言增强完成
- 当前状态更新为 `done`，阶段四实施后审计已通过

---

## 13. Dev Agent Record

### Agent Model Used

gpt-5.3-codex-xhigh

### Debug Log References

- party-mode 100 轮收敛纪要已写入本 Story 的「0. Party-Mode 决议摘要」

### Change Log

- 2026-03-05：完成 B03 三阶段规则落地（rules YAML、AuditStage 扩展、audit-generic 解析与路由）
- 2026-03-05：完成 B11 四维加权评分（dimension-parser、stageToMode、dimension_scores 写入与 fallback）
- 2026-03-05：执行 T5 验收命令（T5.1~T5.5）与 `npm test` 全量回归，全部通过

### Completion Notes List

- 2026-03-05：Create Story 重生成，覆盖 B03/B11、跨 Story 责任闭环、测试命令与架构约束
- 2026-03-05：Dev Story 实施完成（仅 B03 + B11），tasks 勾选完成并进入 review

### File List

- `_bmad-output/implementation-artifacts/5-2-eval-scoring-rules-expansion/5-2-eval-scoring-rules-expansion.md`
- `_bmad-output/implementation-artifacts/5-2-eval-scoring-rules-expansion/prd.5-2-eval-scoring-rules-expansion.json`
- `_bmad-output/implementation-artifacts/5-2-eval-scoring-rules-expansion/progress.5-2-eval-scoring-rules-expansion.txt`
- `specs/epic-5/story-2-eval-scoring-rules-expansion/tasks-E5-S2.md`
- `scripts/parse-and-write-score.ts`
- `scoring/constants/weights.ts`
- `scoring/parsers/audit-index.ts`
- `scoring/parsers/audit-prd.ts`
- `scoring/parsers/audit-item-mapping.ts`
- `scoring/parsers/audit-generic.ts`
- `scoring/parsers/dimension-parser.ts`
- `scoring/parsers/index.ts`
- `scoring/parsers/rules.ts`
- `scoring/parsers/__tests__/audit-generic.test.ts`
- `scoring/parsers/__tests__/dimension-parser.test.ts`
- `scoring/parsers/__tests__/fixtures/sample-spec-report.md`
- `scoring/parsers/__tests__/fixtures/sample-plan-report.md`
- `scoring/parsers/__tests__/fixtures/sample-tasks-report.md`
- `scoring/parsers/__tests__/fixtures/sample-prd-report-with-dimensions.md`
- `scoring/orchestrator/parse-and-write.ts`
- `scoring/orchestrator/__tests__/parse-and-write.test.ts`
- `scoring/veto/veto.ts`
- `scoring/veto/__tests__/apply-tier-and-veto.test.ts`
- `scoring/writer/types.ts`
- `scoring/schema/run-score-schema.json`
- `scoring/rules/spec-scoring.yaml`
- `scoring/rules/plan-scoring.yaml`
- `scoring/rules/tasks-scoring.yaml`
