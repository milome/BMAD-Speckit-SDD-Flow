# plan-E5-S2：eval-scoring-rules-expansion 实现方案

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.2  
**输入**：`spec-E5-S2.md`、Story 5.2、`epics.md`、`TASKS_gaps功能补充实现.md` v2.1（B03/B11）

---

## 1. 目标与约束

- 仅实现 B03 + B11，不扩展到 B05/B06/B07/B08/B09。
- 三阶段评分规则从占位符升级为可执行 YAML，解析入口统一收敛到 `parseAuditReport`。
- 四维加权评分以 `config/code-reviewer-config.yaml` 为权重权威来源。
- 必须保持向后兼容：无维度分时沿用等级映射，不阻断写入链路。
- 每个功能点均需有对应测试任务与验收命令，禁止“后续补充”。

---

## 2. 实施分期

### Phase 1：B03 规则文件与路由扩展

1. 重写三阶段 YAML：`spec-scoring.yaml`、`plan-scoring.yaml`、`tasks-scoring.yaml`。
2. 扩展 `AuditStage` 与 `parseAuditReport` 路由分支。
3. 升级 CLI stage 类型为 `AuditStage`，支持 `spec|plan|tasks` 参数。
4. 固化三阶段 `phase_weight=0.2` 常量并接入解析调用。

### Phase 2：B03 通用解析器落地

1. 新增 `audit-generic.ts` 承接通用等级与检查项提取逻辑。
2. 将 `audit-prd.ts` 中可复用逻辑迁移到通用解析器并保持兼容导入。
3. 对缺失总体评级场景返回 `ParseError`，覆盖 spec/plan/tasks 三阶段。

### Phase 3：B11 维度加权接入

1. 新增 `dimension-parser.ts`，实现 `stageToMode` 与 `parseDimensionScores`。
2. 扩展 `RunScoreRecord` 与 schema，新增 `dimension_scores` 字段。
3. 在 `parse-and-write.ts` 中接入“有维度则覆盖分数、无维度则回退”的流程。

### Phase 4：测试与回归

1. 新增 4 个 fixture（spec/plan/tasks + prd 维度样例）。
2. 新增 `audit-generic.test.ts`（9 用例）与 `dimension-parser.test.ts`（6 用例）。
3. 补充 `parse-and-write.test.ts`、`apply-tier-and-veto.test.ts` 的集成断言。
4. 执行分模块测试命令与全量 `npm run test:scoring` 回归。

---

## 3. 模块与文件改动设计

### 3.1 新增文件

| 文件 | 责任 | 对应需求 | 对应任务 |
| ------ | ------ | ---------- | ---------- |
| `scoring/parsers/audit-generic.ts` | 三阶段通用解析 | B03 | T2.1-T2.4 |
| `scoring/parsers/dimension-parser.ts` | 维度解析与权重映射 | B11 | T3.1-T3.3 |
| `scoring/parsers/__tests__/audit-generic.test.ts` | B03 解析测试 | B03 | T4.3 |
| `scoring/parsers/__tests__/dimension-parser.test.ts` | B11 维度测试 | B11 | T4.4 |
| `scoring/parsers/__tests__/fixtures/sample-spec-report.md` | spec 样例报告 | B03 | T4.1 |
| `scoring/parsers/__tests__/fixtures/sample-plan-report.md` | plan 样例报告 | B03 | T4.1 |
| `scoring/parsers/__tests__/fixtures/sample-tasks-report.md` | tasks 样例报告 | B03 | T4.1 |
| `scoring/parsers/__tests__/fixtures/sample-prd-report-with-dimensions.md` | 维度报告样例 | B11 | T4.2 |

### 3.2 修改文件

| 文件 | 变更 | 对应需求 | 对应任务 |
| ------ | ------ | ---------- | ---------- |
| `scoring/rules/spec-scoring.yaml` | 从占位符升级为完整规则 | B03 | T1.1 |
| `scoring/rules/plan-scoring.yaml` | 从占位符升级为完整规则 | B03 | T1.2 |
| `scoring/rules/tasks-scoring.yaml` | 从占位符升级为完整规则 | B03 | T1.3 |
| `scoring/parsers/audit-index.ts` | 扩展 stage 与分发 | B03 | T1.4 |
| `scoring/parsers/index.ts` | 导出扩展后的类型 | B03 | T1.5 |
| `scripts/parse-and-write-score.ts` | stage 类型升级为 `AuditStage` | B03 | T1.6 |
| `scoring/constants/weights.ts` | 新增 spec/plan/tasks 权重常量 | B03 | T1.7 |
| `scoring/parsers/audit-prd.ts` | 复用 `audit-generic` 公共函数 | B03 | T2.2 |
| `scoring/writer/types.ts` | 增加 `dimension_scores` 类型 | B11 | T3.4 |
| `scoring/schema/run-score-schema.json` | 增加 `dimension_scores` schema | B11 | T3.5 |
| `scoring/orchestrator/parse-and-write.ts` | 维度加权覆盖逻辑 + fallback | B11 | T3.6-T3.7 |

---

## 4. 详细技术方案

### 4.1 B03 解析链路

1. `parseAuditReport(stage)` 增加 `spec|plan|tasks` 分支。
2. 每个分支调用 `parseGenericReport({ stage, phaseWeight: 0.2 })`。
3. `parseGenericReport` 输出统一 `RunScoreRecord`，字段与 prd/arch/story 记录结构一致。
4. `audit-prd.ts` 的等级与问题提取逻辑上移到 `audit-generic.ts`，减少重复实现。

### 4.2 B11 加权链路

1. `stageToMode` 统一 stage 到维度 mode 的映射。
2. `parseDimensionScores(content, mode)` 从报告提取 `维度名: 分数/100`，按配置补足权重。
3. `parse-and-write.ts` 中：
   - 先解析基础记录；
   - 再尝试维度解析；
   - 维度存在则覆盖 `phase_score` 并写入 `dimension_scores`；
   - 维度缺失则保留等级映射分。

### 4.3 向后兼容策略

- 旧报告无维度分：保持原有写入语义，不抛异常。
- 配置文件缺失或维度不匹配：返回空数组，回退等级映射。
- 不改变 `required` 字段集合，`dimension_scores` 保持可选。

---

## 5. 测试计划（单元 + 集成 + 端到端）

### 5.1 单元测试

| 测试文件 | 覆盖点 | 命令 |
| ---------- | -------- | ------ |
| `scoring/parsers/__tests__/audit-generic.test.ts` | 三阶段解析、check_items、缺失等级异常 | `npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts` |
| `scoring/parsers/__tests__/dimension-parser.test.ts` | 维度提取、映射、加权计算、空结果 fallback | `npm run test:scoring -- scoring/parsers/__tests__/dimension-parser.test.ts` |

### 5.2 集成测试

| 测试文件 | 覆盖点 | 命令 |
| ---------- | -------- | ------ |
| `scoring/orchestrator/__tests__/parse-and-write.test.ts` | 维度覆盖分数与等级回退两条路径 | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts` |
| `scoring/veto/__tests__/apply-tier-and-veto.test.ts` | spec 阶段规则与 veto 路径有效性 | `npm run test:scoring -- scoring/veto/__tests__/apply-tier-and-veto.test.ts` |

### 5.3 端到端回归

| 场景 | 验证目标 | 命令 |
| ------ | ---------- | ------ |
| scoring 全链路回归 | 新增阶段与维度逻辑不破坏既有流程 | `npm run test:scoring` |

---

## 6. 需求追溯与任务映射（plan ↔ spec ↔ tasks）

| 需求 ID / AC | spec 章节 | plan 章节 | 任务段落 |
| -------------- | ----------- | ----------- | ---------- |
| B03 / AC-B03-1 | spec §3.1.2, §3.1.3 | plan §2 Phase 1, §4.1 | tasks T1, T2, T4.3 |
| B03 / AC-B03-2 | spec §3.1.2, §3.1.3 | plan §2 Phase 1, §4.1 | tasks T1, T2, T4.3 |
| B03 / AC-B03-3 | spec §3.1.2, §3.1.3 | plan §2 Phase 1, §4.1 | tasks T1, T2, T4.3 |
| B03 / AC-B03-4 | spec §3.1.1 | plan §2 Phase 1, §5.2 | tasks T1, T4.6, T5.4 |
| B03 / AC-B03-5 | spec §3.1.4 | plan §2 Phase 2, §5.1 | tasks T2.3, T4.3 |
| B11 / AC-B11-1 | spec §3.2.1-§3.2.3 | plan §2 Phase 3, §4.2 | tasks T3, T4.4 |
| B11 / AC-B11-2 | spec §3.2.3 | plan §4.2, §5.2 | tasks T3.6-T3.7, T4.5 |
| B11 / AC-B11-3 | spec §3.2.1 | plan §4.2 | tasks T3.2, T4.4 |
| B11 / AC-B11-4 | spec §3.2.4 | plan §3.2, §4.2 | tasks T3.4-T3.5, T4.5 |

---

## 7. 执行准入标准

- `tasks-E5-S2.md` 中所有任务必须具备明确文件路径与验收命令。
- 至少完成 9 + 6 个新增测试，并通过 2 组集成测试命令。
- 通过 `npm run test:scoring` 后方可进入 Story 5.2 实施收尾。

<!-- AUDIT: PASSED by code-reviewer -->
