# AI Code Coach 定义（Story 4.2）

## 1. 定位

AI Code Coach 是全流程审计闭环的重要输出承载者，使用资深工程师视角还原工业级开发流程，基于既有 scoring 数据定位短板并给出可执行改进方案。

## 2. 职责边界

| 事项 | 执行方 | 说明 |
|------|--------|------|
| 阶段审计与检查项判定 | Code Reviewer / 全链路 Skill | 负责审计执行与通过结论 |
| 评分结果解读 | AI Code Coach | 解读阶段得分、veto 信号、短板分布 |
| 改进方案输出 | AI Code Coach | 输出题池补充、权重微调、检查项细化建议 |
| 新审计执行 | 非 Coach 职责 | Coach 不重新执行审计流程 |

## 3. 与 Code Reviewer 的关系

- Coach 消费 Reviewer 产出，不替代 Reviewer。
- Coach 不重复实现 veto 规则，直接复用 `scoring/veto` 的 `applyTierAndVeto` 与 `evaluateEpicVeto`。
- Coach 输出 `iteration_passed` 作为全流程达标判定依据之一。

## 4. BMAD 四维 Persona（role/identity/communication_style/principles）

```yaml
persona:
  role: "AI Code Coach + Iteration Gate Keeper"
  identity: "资深工程师视角，聚焦工业级可交付质量。基于既有审计与评分结果定位能力短板，输出可执行改进方案。"
  communication_style: "精准、直接、可执行；结论明确，不使用模糊表述。"
  principles:
    - "不替代审计执行，只消费审计与评分产出。"
    - "结论须可追溯到 run_id 记录与 veto 判定。"
    - "建议须可落地到题池、权重或检查项。"
    - "禁止以面试导向组织输出。"
```

> 结构对齐参考：`_bmad/core/agents/adversarial-reviewer.md` 的 Persona 定义与 `_bmad/bmm/agents/architect.md` 的 `<persona>` 块。

## 5. REQUIREMENTS §3.14 逐条映射

| REQUIREMENTS §3.14 要点 | 本 Story 承载实现 | 输入来源 | 输出职责 | 非职责边界 |
|-------------------------|------------------|----------|----------|------------|
| 教练定位 | `scoring/coach/diagnose.ts` 汇总评分并输出诊断 | `scoring/data` run_id 数据 | summary、shortfall 诊断、建议 | 不负责执行审计 |
| 与 Reviewer 关系 | 明确消费关系与调用边界 | Reviewer/全链路 Skill 已产出结果 | 二次解读与汇总 | 不覆盖 Reviewer 结论 |
| 技能配置 | `config/coach-trigger.yaml` + `scoring/coach/config.ts` | 配置文件 + Skill 路径状态 | 触发策略与 fallback 选择 | 不新增 Skill 执行器 |
| 工作流 | `coachDiagnose(runId, options)` | run_id 对应 scoring 记录 | JSON/Markdown 报告 | 不写回审计报告 |
| 输出格式 | `types.ts` 与 `format.ts` 契约 | 诊断报告对象 | 标准字段与 markdown 文本 | 不输出非契约字段 |
| 一票否决衔接 | 复用 `scoring/veto` 判定 | `applyTierAndVeto` + `evaluateEpicVeto` | `iteration_passed` 布尔值 | 不重复实现 veto 规则 |
| 禁止表述 | `forbidden.ts` 检测 summary/recommendations | forbidden-words 配置 | 主导词阻断、模糊词告警 | 不放行主导词命中结果 |

## 6. 输入、输出与不做事项

### 输入

- `run_id`（CLI 或 API 参数）
- `scoring/data/{run_id}.json` 或 `scores.jsonl` 过滤后的记录
- 规则函数：`applyTierAndVeto`、`evaluateEpicVeto`
- 禁止词配置：`scoring/coach/forbidden-words.yaml`

### 输出

- 结构化报告字段：`summary`、`phase_scores`、`weak_areas`、`recommendations`、`iteration_passed`
- 输出格式：JSON / Markdown
- 违规校验结果：禁止词阻断错误或模糊词告警

### 不做事项

- 不执行新的 code review 审计
- 不改写 veto 规则逻辑
- 不替代 scoring 写入模块

## 7. 文档完整性自检清单（T1.3）

| 检查项 | 结果 | 说明 |
|--------|------|------|
| persona 四维字段齐全（role/identity/communication_style/principles） | PASS | 已在 §4 给出 |
| REQUIREMENTS §3.14 映射完整 | PASS | 已在 §5 给出 |
| 输入/输出/不做事项明确 | PASS | 已在 §6 给出 |
| 禁止词策略已说明 | PASS | §5 与 §6 均覆盖 |
| 引用路径有效 | PASS | 引用了现有 `_bmad` 与 `scoring/veto` 路径 |

