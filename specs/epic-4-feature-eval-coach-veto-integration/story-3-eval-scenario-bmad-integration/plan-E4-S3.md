# plan-E4-S3：eval-scenario-bmad-integration 实现方案

**Epic**：E4 feature-eval-coach-veto-integration  
**Story ID**：4.3  
**输入**：spec-E4-S3.md、Story 4-3

---

## 1. 目标与约束

- 本 Story 以**文档产出与校验逻辑**为主，不新增核心业务模块。
- 产出：scoring/docs/ 下 5 份文档 + 校验逻辑扩展（eval_question 时 question_version 必填）。
- 消费：config/scoring-trigger-modes.yaml（Story 3.3）；scoring/schema、scoring/writer（既有）。
- 与 Story 4.2 衔接：本 Story 产出满足 4.2 审计推迟闭环。

---

## 2. 产出物与实施顺序

### 2.1 文档产出（T1–T5）

| 顺序 | 文档 | 路径 | 内容要点 |
|------|------|------|----------|
| 1 | SCENARIO_AND_PATH_RULES | scoring/docs/SCENARIO_AND_PATH_RULES.md | real_dev/eval_question 定义；Layer 1→5 完整路径约束；path_type、question_version 要求 |
| 2 | ITERATION_END_CRITERIA | scoring/docs/ITERATION_END_CRITERIA.md | Layer 1–5 各 stage 迭代结束标准，与 REQUIREMENTS §2.2 逐项对照；与 Story 4.2 教练 iteration_passed 衔接 |
| 3 | LIGHTWEIGHT_PRINCIPLES | scoring/docs/LIGHTWEIGHT_PRINCIPLES.md | 同机执行、按配置启用、最小侵入的释义与可验证检查项 |
| 4 | DATA_POLLUTION_PREVENTION | scoring/docs/DATA_POLLUTION_PREVENTION.md | 四条防护的操作要点、触发条件、建议阈值；与 §3.7、architecture §7.4 对照 |
| 5 | BMAD_INTEGRATION_POINTS | scoring/docs/BMAD_INTEGRATION_POINTS.md | speckit-workflow、bmad-story-assistant、全链路 Skill 触发时机与调用方式；与 scoring-trigger-modes.yaml、architecture §7.3 衔接 |

### 2.2 校验逻辑（T1.2）

| 组件 | 动作 |
|------|------|
| scoring/writer/validate.ts | 扩展：在写入前增加 `validateScenarioConstraints(record)`；scenario=eval_question 且 question_version 为空/未定义时抛错 |
| scoring/writer/index 或 write-score | 写入前调用 validateScenarioConstraints；或 integrate 到现有 validateRunScoreRecord 流程 |

**校验规则**：
- scenario ∈ { real_dev, eval_question }
- scenario = eval_question 时，question_version 必填（非空字符串）
- path_type 若未提供则默认 `full`

---

## 3. 模块设计

### 3.1 新增/修改文件

| 文件 | 类型 | 说明 |
|------|------|------|
| scoring/docs/SCENARIO_AND_PATH_RULES.md | 新增 | T1 产出 |
| scoring/docs/ITERATION_END_CRITERIA.md | 新增 | T2 产出 |
| scoring/docs/LIGHTWEIGHT_PRINCIPLES.md | 新增 | T3 产出 |
| scoring/docs/DATA_POLLUTION_PREVENTION.md | 新增 | T4 产出 |
| scoring/docs/BMAD_INTEGRATION_POINTS.md | 新增 | T5 产出 |
| scoring/writer/validate.ts | 修改 | 增加 validateScenarioConstraints |
| scoring/writer/validate.ts 或 writer 入口 | 修改 | 写入前调用场景约束校验 |

### 3.2 依赖关系

```
本 Story 产出
  ├── scoring/writer/validate (扩展校验)
  ├── config/scoring-trigger-modes.yaml (只读，文档引用)
  └── scoring/schema (只读，question_version 已支持)
```

---

## 4. 校验逻辑详细设计

### 4.1 validateScenarioConstraints

```ts
/**
 * 校验 record 符合场景约束（spec §2.1）。
 * - scenario 必为 real_dev | eval_question
 * - scenario=eval_question 时 question_version 必填
 * - path_type 若为空则建议默认 full（可在调用方补全）
 * @throws 若违反约束
 */
export function validateScenarioConstraints(record: RunScoreRecord): void
```

**实现要点**：
- scenario 不在 enum 内 → 抛错
- scenario === 'eval_question' && (!record.question_version || record.question_version.trim() === '') → 抛错，错误信息明确
- 不修改 record；path_type 默认由调用方（write-score 或 parse-and-write）补全

### 4.2 与现有 validateRunScoreRecord 的关系

- validateRunScoreRecord：校验 schema 合规（run_id、stage、phase_score 等）
- validateScenarioConstraints：业务规则校验（场景约束）
- 建议顺序：先 schema 校验，再场景约束校验；或合并为一次校验流程

---

## 5. 集成测试与端到端测试计划

### 5.1 单元测试

| 模块 | 用例 | 命令 |
|------|------|------|
| scoring/writer/validate | validateScenarioConstraints：eval_question 无 question_version → 抛错 | `npm test -- scoring/writer` |
| scoring/writer/validate | validateScenarioConstraints：eval_question 有 question_version → 不抛错 | 同上 |
| scoring/writer/validate | validateScenarioConstraints：real_dev 无 question_version → 不抛错 | 同上 |
| scoring/writer/validate | validateScenarioConstraints：scenario 非法值 → 抛错 | 同上 |

### 5.2 集成测试

| 场景 | 验证方式 |
|------|----------|
| 写入前校验 | parseAndWriteScore 或 write-score 传入 scenario=eval_question、question_version 为空时，拒绝写入并抛出明确错误 |
| 文档存在性 | test -f 或 Node fs 检查 5 份文档均存在 |
| 禁止词校验 | grep 或脚本：对 5 份文档全文检索禁止词，无命中（禁止词表定义节除外） |

### 5.3 端到端验收

| 脚本 | 验收内容 |
|------|----------|
| scripts/accept-e4-s3.ts 或 npm run accept:e4-s3 | 1) 5 份文档存在；2) 调用 validateScenarioConstraints，给定 scenario、question_version 组合，断言通过/失败符合预期；3) 至少一个 BMAD 集成点可调用（如执行 accept-e3-s3 或等效） |

**严禁**：仅依赖单元测试；文档产出无验收脚本验证。

---

## 6. 文档内容模板（与 spec 对应）

### 6.1 SCENARIO_AND_PATH_RULES.md

- §1 场景定义：real_dev、eval_question 表化
- §2 路径约束：Layer 1→5 完整路径；path_type full；eval_question 时 question_version 必填
- §3 校验规则：与 validateScenarioConstraints 行为一致

### 6.2 ITERATION_END_CRITERIA.md

- 表：stage → 迭代结束标准，与 REQUIREMENTS §2.2 逐项对照
- §2 与 Story 4.2 教练 iteration_passed 衔接说明

### 6.3 LIGHTWEIGHT_PRINCIPLES.md

- 三原则释义表
- 可验证检查项
- 按配置启用：scoring-trigger-modes.yaml 说明；不调用 parseAndWriteScore 即关闭的文档说明

### 6.4 DATA_POLLUTION_PREVENTION.md

- 四条防护表：操作要点、触发条件、建议阈值
- 与 REQUIREMENTS §3.7、architecture §7.4 对照

### 6.5 BMAD_INTEGRATION_POINTS.md

- 集成点表：speckit-workflow、bmad-story-assistant、全链路 Skill
- 触发时机与调用方式
- 与 config/scoring-trigger-modes.yaml、architecture §7.3 衔接
- 至少一个集成点可调用验证说明

---

## 7. 需求映射清单（plan.md ↔ spec.md + Story）

| Story §3 Task | spec 对应 | plan 对应 | 覆盖状态 |
|---------------|----------|----------|----------|
| T1 场景区分与路径约束 | §2.1 | plan §2.1 文档1、§2.2 校验、§4、§5.1 | ✅ |
| T2 各阶段迭代结束标准 | §2.2 | plan §2.1 文档2、§6.2 | ✅ |
| T3 轻量化三原则 | §2.3 | plan §2.1 文档3、§6.3 | ✅ |
| T4 数据污染防护 | §2.4 | plan §2.1 文档4、§6.4 | ✅ |
| T5 BMAD 集成点 | §2.5 | plan §2.1 文档5、§6.5、§5.3 | ✅ |
| T6 禁止词表校验 | §2.6 | plan §5.2、§5.3 | ✅ |

---

*本 plan 实现 Story 4.3 文档化与校验逻辑，满足 spec 与 AC。*
