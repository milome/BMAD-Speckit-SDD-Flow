# 场景与路径规则

与 REQUIREMENTS §1.4、architecture §7.1/7.2、Story 4.3 一致。

---

## 1. 场景定义

| 场景 | 定义 | 触发条件 | writeMode | 校验规则 |
|------|------|----------|-----------|----------|
| **real_dev** | 自有真实需求开发；基于真实业务需求的全流程开发，产出为可交付项目 | 各 stage 审计通过后自动解析既有审计报告写入 | 见 config/scoring-trigger-modes.yaml | scenario 必填；path_type 默认 full |
| **eval_question** | 评测题目执行；基于预设评测题（题池）执行，用于模型横向对比、能力评估 | 每次题目执行产生独立 run_id，得分写入独立记录 | 同上 | scenario 必填；path_type 必为 full；**question_version 必填** |

---

## 2. 路径约束

**与 REQUIREMENTS §1.4.1 一致**：

- **real_dev** 与 **eval_question** 均须走 **BMAD Layer 1→2→3→4→5 完整路径**。
- 不得采用简化路径（如仅 Layer 4、Layer 3+4 等），否则评分无法全面基于五层审计闭环。
- path_type 记录 `full`，用于追溯与审计。
- eval_question 场景下 **question_version 必填**；未填则校验失败，拒绝写入。

---

## 3. 校验规则

| 规则 | 说明 |
|------|------|
| scenario ∈ { real_dev, eval_question } | scenario 必为两者之一，否则校验失败 |
| scenario = eval_question 时 question_version 必填 | 非空字符串；空或未定义则抛错 |
| path_type 默认 full | 若未提供则写入前补全为 `full` |

**实现位置**：`scoring/writer/validate.ts` 中的 `validateScenarioConstraints`。
