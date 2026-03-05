# Tasks: eval-scoring-rules-expansion (E5-S2)

**Input**：`spec-E5-S2.md`、`plan-E5-S2.md`、`IMPLEMENTATION_GAPS-E5-S2.md`  
**Scope**：仅 B03 + B11  
**执行方式**：按 T1 -> T2 -> T3 -> T4 -> T5 顺序推进

---

## 1. 需求追溯与任务映射

| 任务组 | 来源需求 | AC | Gap |
| -------- | ---------- | ---- | ----- |
| T1 | B03 三阶段规则与路由 | AC-B03-1/2/3/4 | GAP-E5-S2-B03-1/2/3 |
| T2 | B03 通用解析器 | AC-B03-1/2/3/5 | GAP-E5-S2-B03-4 |
| T3 | B11 四维加权实现 | AC-B11-1/2/3/4 | GAP-E5-S2-B11-1/2/3/4 |
| T4 | B03+B11 测试与夹具 | AC-B03-1~5, AC-B11-1~4 | GAP-E5-S2-B03-5, GAP-E5-S2-B11-5 |
| T5 | 验收命令执行 | 全部 AC | 全部 Gap |

---

## 2. Phase 1：B03 规则文件与阶段扩展（T1）

**AC**：AC-B03-1、AC-B03-2、AC-B03-3、AC-B03-4

- [x] **T1.1** 重写 `scoring/rules/spec-scoring.yaml`，包含 `version/stage/link_stage/link_环节/weights/items/veto_items`，并定义 spec 阶段 item 与 veto 规则。
- [x] **T1.2** 重写 `scoring/rules/plan-scoring.yaml`，包含完整 `weights/items/veto_items`，覆盖 plan 阶段评分规则。
- [x] **T1.3** 重写 `scoring/rules/tasks-scoring.yaml`，包含完整 `weights/items/veto_items`，覆盖 tasks 阶段评分规则。
- [x] **T1.4** 修改 `scoring/parsers/audit-index.ts`：将 `AuditStage` 扩展为 `'prd' | 'arch' | 'story' | 'spec' | 'plan' | 'tasks'`，并在 `switch` 新增三阶段分支。
- [x] **T1.5** 修改 `scoring/parsers/index.ts`：导出扩展后的 `AuditStage` 与相关解析入口。
- [x] **T1.6** 修改 `scripts/parse-and-write-score.ts`：`stage` 类型从 `'prd' | 'arch' | 'story'` 升级为 `AuditStage`，同时更新 usage 提示中的 stage 列表。
- [x] **T1.7** 修改 `scoring/constants/weights.ts`：新增并导出 `PHASE_WEIGHTS_SPEC`、`PHASE_WEIGHTS_PLAN`、`PHASE_WEIGHTS_TASKS`，值均为 `0.2`。

---

## 3. Phase 2：B03 通用解析器实现（T2）

**AC**：AC-B03-1、AC-B03-2、AC-B03-3、AC-B03-5

- [x] **T2.1** 新增 `scoring/parsers/audit-generic.ts`，实现 `extractOverallGrade(content)`。
- [x] **T2.2** 在 `scoring/parsers/audit-generic.ts` 实现 `extractCheckItems(content, stage)`，支持 spec/plan/tasks 的 item 提取。
- [x] **T2.3** 在 `scoring/parsers/audit-generic.ts` 实现 `parseGenericReport({ content, stage, runId, scenario, phaseWeight })`，当等级缺失时抛出 `ParseError`。
- [x] **T2.4** 修改 `scoring/parsers/audit-prd.ts`：删除本地私有提取逻辑，改为 import `audit-generic.ts` 的公共函数。

---

## 4. Phase 3：B11 四维加权评分实现（T3）

**AC**：AC-B11-1、AC-B11-2、AC-B11-3、AC-B11-4

- [x] **T3.1** 新增 `scoring/parsers/dimension-parser.ts`，定义 `DimensionScore` 类型与导出接口。
- [x] **T3.2** 在 `dimension-parser.ts` 实现 `stageToMode`，映射规则严格为：`prd/spec/plan/tasks -> prd`，`arch -> arch`，`story/implement/post_impl -> code`，`pr_review -> pr`。
- [x] **T3.3** 在 `dimension-parser.ts` 实现 `parseDimensionScores(content, mode, configPath?)`，用正则提取 `维度名: 分数/100`，并按 `config/code-reviewer-config.yaml` 维度权重赋值。
- [x] **T3.4** 修改 `scoring/writer/types.ts`：新增 `dimension_scores?: DimensionScore[]` 字段定义。
- [x] **T3.5** 修改 `scoring/schema/run-score-schema.json`：新增 `dimension_scores` 数组 schema（`dimension`、`weight`、`score`）。
- [x] **T3.6** 修改 `scoring/orchestrator/parse-and-write.ts`：解析到维度分时，以 `Σ(score × weight / 100)` 覆盖 `phase_score`，并写入 `dimension_scores`。
- [x] **T3.7** 修改 `scoring/orchestrator/parse-and-write.ts`：当维度解析结果为空或配置加载失败时，保持原 `GRADE_TO_SCORE` 路径，不抛异常。

---

## 5. Phase 4：测试与夹具（T4）

**AC**：覆盖 AC-B03-1~5、AC-B11-1~4

- [x] **T4.1** 新增 fixture：`sample-spec-report.md`、`sample-plan-report.md`、`sample-tasks-report.md` 到 `scoring/parsers/__tests__/fixtures/`。
- [x] **T4.2** 新增 fixture：`sample-prd-report-with-dimensions.md` 到 `scoring/parsers/__tests__/fixtures/`。
- [x] **T4.3** 新增 `scoring/parsers/__tests__/audit-generic.test.ts`，实现 9 个用例：spec/plan/tasks 各 3 个（正常解析、check_items、缺失等级异常）。
- [x] **T4.4** 新增 `scoring/parsers/__tests__/dimension-parser.test.ts`，实现 6 个用例：维度提取、空维度回退、部分维度、权重读取、加权计算、配置缺失回退。
- [x] **T4.5** 修改 `scoring/orchestrator/__tests__/parse-and-write.test.ts`，补充维度覆盖路径与无维度回退路径断言。
- [x] **T4.6** 修改 `scoring/veto/__tests__/apply-tier-and-veto.test.ts`，补充 spec 阶段规则与 veto 行为断言。

---

## 6. Phase 5：验收命令执行（T5）

- [x] **T5.1** 执行：`npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts`
- [x] **T5.2** 执行：`npm run test:scoring -- scoring/parsers/__tests__/dimension-parser.test.ts`
- [x] **T5.3** 执行：`npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts`
- [x] **T5.4** 执行：`npm run test:scoring -- scoring/veto/__tests__/apply-tier-and-veto.test.ts`
- [x] **T5.5** 执行：`npm run test:scoring`

---

## 7. 完成判定标准

- T1~T5 全部任务完成并勾选。
- AC-B03-1~5、AC-B11-1~4 均有可追溯任务与测试结果。
- 不新增 “可选/后续/待定/酌情” 等模糊描述。

<!-- AUDIT: PASSED by code-reviewer -->
