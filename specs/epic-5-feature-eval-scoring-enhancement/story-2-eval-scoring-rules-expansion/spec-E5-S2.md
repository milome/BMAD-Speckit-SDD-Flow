# Spec E5-S2：eval-scoring-rules-expansion

*Story 5.2 技术规格*  
*Epic E5 feature-eval-scoring-enhancement*

---

## 1. 概述

本 spec 将 Story 5.2 的实现范围固化为可执行技术规格，仅覆盖 B03（spec/plan/tasks 三阶段评分规则）与 B11（四维加权评分）。  
输入来源如下：

- `_bmad-output/planning-artifacts/dev/epics.md`（Story 5.2 与 AC）
- `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1（GAP-B03、GAP-B11）
- `_bmad-output/implementation-artifacts/5-2-eval-scoring-rules-expansion/5-2-eval-scoring-rules-expansion.md`

---

## 2. 范围与边界

### 2.1 In Scope：B03（三阶段评分规则）

| 需求要点 | 技术规格 |
| ---------- | ---------- |
| spec/plan/tasks 规则不可再是占位符 | 完整落地 `scoring/rules/spec-scoring.yaml`、`plan-scoring.yaml`、`tasks-scoring.yaml`，包含 `weights`、`items`、`veto_items` |
| 三阶段报告可解析为统一记录 | 新增 `scoring/parsers/audit-generic.ts`，提供 `extractOverallGrade`、`extractCheckItems`、`parseGenericReport` |
| 审计入口支持三阶段 | 扩展 `scoring/parsers/audit-index.ts` 的 `AuditStage`，在 `parseAuditReport` 中分发 `spec/plan/tasks` |
| CLI 可接收三阶段参数 | `scripts/parse-and-write-score.ts` 的 `stage` 类型升级为 `AuditStage` |
| 评分环节权重一致 | 为 spec/plan/tasks 固定 `phase_weight=0.2` 并接入 `audit-index.ts` |

### 2.2 In Scope：B11（四维加权评分）

| 需求要点 | 技术规格 |
| ---------- | ---------- |
| 维度评分按配置加权 | 新增 `scoring/parsers/dimension-parser.ts`，读取 `config/code-reviewer-config.yaml` 权重 |
| 支持 stage 到 mode 映射 | `stageToMode` 规则：`prd/spec/plan/tasks -> prd`，`arch -> arch`，`story/implement/post_impl -> code`，`pr_review -> pr` |
| 保留旧报告兼容 | 无维度分时返回空数组，维持 `GRADE_TO_SCORE` 路径 |
| 记录维度子分 | `RunScoreRecord` 与 `run-score-schema.json` 增加 `dimension_scores` |
| 写入前覆盖分数 | `parse-and-write.ts` 中解析维度分，非空时用加权总分覆盖原等级映射分 |

### 2.3 Out of Scope

- B05（LLM 结构化提取 fallback）由 Story 5.3 负责
- B06/B07/B08/B09 的分析与优化能力由 Story 5.4/5.5 负责
- 本文档不包含生产代码提交与测试执行结果，仅定义实现规格

---

## 3. 功能规格

### 3.1 B03：三阶段规则与通用解析

#### 3.1.1 YAML 规则文件

1. `spec-scoring.yaml`、`plan-scoring.yaml`、`tasks-scoring.yaml` 必须从占位符升级为可执行规则。
2. 每个文件必须包含：`version`、`stage`、`link_stage`、`link_环节`、`weights.base`、`items[]`、`veto_items[]`。
3. `veto_items` 支持 `ref: code-reviewer-config#...` 的引用方式，保持与 `code-reviewer-config.yaml` 一致。

#### 3.1.2 通用解析器接口

```ts
export function extractOverallGrade(content: string): string | null;
export function extractCheckItems(content: string, stage: string): CheckItem[];
export async function parseGenericReport(input: {
  content: string;
  stage: 'spec' | 'plan' | 'tasks';
  runId: string;
  scenario: 'real_dev' | 'eval_question';
  phaseWeight: number;
}): Promise<RunScoreRecord>;
```

#### 3.1.3 解析路由与权重

1. `AuditStage` 扩展为：`'prd' | 'arch' | 'story' | 'spec' | 'plan' | 'tasks'`。
2. `parseAuditReport` 中新增 3 个分支调用 `parseGenericReport`。
3. 三阶段解析结果均写入：
   - `stage=spec|plan|tasks`
   - `phase_weight=0.2`
   - `check_items` 可用于后续 veto/tier 处理。

#### 3.1.4 异常处理

- 报告无法提取总体评级时，`parseGenericReport` 必须抛出 `ParseError`。
- 抛错信息需包含阶段信息，便于定位输入报告问题。

### 3.2 B11：维度加权与记录扩展

#### 3.2.1 维度解析接口

```ts
export interface DimensionScore {
  dimension: string;
  weight: number;
  score: number;
}

export function stageToMode(stage: string): 'code' | 'prd' | 'arch' | 'pr';
export function parseDimensionScores(
  content: string,
  mode: 'code' | 'prd' | 'arch' | 'pr',
  configPath?: string
): DimensionScore[];
```

#### 3.2.2 解析规则

1. 使用正则 `[-*]\\s*(.+?):\\s*(\\d+)\\s*[\\/／]\\s*100` 提取维度分。
2. 维度权重来源固定为 `config/code-reviewer-config.yaml` 的对应 mode 下 `dimensions`。
3. 仅对成功匹配权重的维度生成 `DimensionScore` 项。

#### 3.2.3 分数覆盖规则

1. 维度分非空时：加权总分 `Σ(score × weight / 100)`，写回 `phase_score`。
2. 维度分为空时：保持 `GRADE_TO_SCORE` 映射分数，且不写 `dimension_scores`。
3. 维度解析失败或配置缺失时：返回空数组，不中断评分流水线。

#### 3.2.4 数据结构与 schema

- `scoring/writer/types.ts`：新增 `dimension_scores?: DimensionScore[]`。
- `scoring/schema/run-score-schema.json`：新增 `dimension_scores` 数组定义（`dimension`、`weight`、`score`）。

---

## 4. 验收标准映射（AC）

| AC ID | 验收标准 | spec 对应章节 | 验证方式 |
| ------ | ---------- | --------------- | ---------- |
| AC-B03-1 | spec 报告可解析并写入 `stage=spec`、`phase_weight=0.2` | §3.1.2, §3.1.3 | `audit-generic.test.ts` |
| AC-B03-2 | plan 报告可解析并写入 `stage=plan`、`phase_weight=0.2` | §3.1.2, §3.1.3 | `audit-generic.test.ts` |
| AC-B03-3 | tasks 报告可解析并写入 `stage=tasks`、`phase_weight=0.2` | §3.1.2, §3.1.3 | `audit-generic.test.ts` |
| AC-B03-4 | 三阶段 YAML 与 veto 路径可执行 | §3.1.1 | `audit-generic.test.ts` + `apply-tier-and-veto.test.ts` |
| AC-B03-5 | 缺失等级时报 ParseError | §3.1.4 | `audit-generic.test.ts` |
| AC-B11-1 | 可提取维度分并计算加权总分 | §3.2.1, §3.2.2, §3.2.3 | `dimension-parser.test.ts` |
| AC-B11-2 | 无维度分时回退等级映射 | §3.2.3 | `dimension-parser.test.ts` + `parse-and-write.test.ts` |
| AC-B11-3 | `stageToMode(spec/plan/tasks)=prd` | §3.2.1 | `dimension-parser.test.ts` |
| AC-B11-4 | 记录类型与 schema 同步扩展 `dimension_scores` | §3.2.4 | schema + writer/orchestrator 断言测试 |

---

## 5. 需求追溯清单（来源 -> spec）

| 来源 | 来源条目 | spec 章节 | 覆盖状态 |
| ------ | ---------- | ----------- | ---------- |
| `epics.md` Story 5.2 | B03 三阶段评分规则 | §2.1, §3.1, §4 | 已覆盖 |
| `epics.md` Story 5.2 | B11 四维加权评分 | §2.2, §3.2, §4 | 已覆盖 |
| `TASKS_gaps功能补充实现.md` v2.1 | GAP-B03 方案与测试（9 用例） | §3.1, §4 | 已覆盖 |
| `TASKS_gaps功能补充实现.md` v2.1 | GAP-B11 方案与测试（6 用例） | §3.2, §4 | 已覆盖 |
| Story 5.2 文档 | Task 1~5 与 AC 列表 | §4, §5 | 已覆盖 |

---

## 6. 与后续文档的映射约定

- `plan-E5-S2.md` 必须基于本 spec 的 AC 与接口继续细化为模块级实施步骤。
- `IMPLEMENTATION_GAPS-E5-S2.md` 必须逐条对照 §3 与 §4，给出现状差距与任务映射。
- `tasks-E5-S2.md` 必须按 AC-B03-1~5、AC-B11-1~4 提供可执行任务与测试命令。

<!-- AUDIT: PASSED by code-reviewer -->
