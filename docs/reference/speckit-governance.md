# Speckit Governance 参考

> Speckit 治理规则的人类可读摘要。策略金源仍然是 [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml)。
> **Current path**: readiness / closure / exception 由统一治理语义定义，post-audit automation 由 `runAuditorHost` 收口
> **Legacy path**: 把 closure 之后的写分 / auditIndex / 后置动作拆成手工零散步骤

---

## 1. 目标

本治理层的目的不是增加一套新的 ceremony，而是把 Speckit 后半段流程收敛到一条明确主线：

- `P0 journey runnable` 是首要流转目标
- readiness 是 blocker gate，不是审批装饰
- tasks 必须是 runnable slice，而不是模块工作桶
- closure 必须带 smoke proof、trace、deferred gap 和 next gate
- silent assumption 与 silent scope growth 默认视为高风险信号

如果 reference 文档与 YAML 冲突，以 YAML 为准。

---

## 2. 默认策略

来自 [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml) 的默认值：

| 项               | 值                           |
| ---------------- | ---------------------------- |
| 默认 `risk tier` | `medium`                     |
| 主目标           | `P0 journey runnable`        |
| smoke gate 模式  | `pr`                         |
| full E2E 模式    | `nightly`                    |
| omission policy  | `block_on_silent_assumption` |

这意味着：

- 默认 feature 不是“文档齐了就算过”，而是至少要能证明 P0 journey 可跑
- smoke proof 是 PR 语境下的主要 gate
- full E2E 默认不做第一落地的 PR blocker，但必须有明确位置

---

## 3. Risk Tier Policy

## `low`

适用场景：

- 局部、小 blast radius 变更
- 不触及 permission boundary
- 不改 completion semantics

最少要求：

- artifacts：`prd`、`architecture`、`tasks`、`readiness`
- gates：`readiness`、`ambiguity_linter`、`smoke_skeleton_validation`
- sign-off：`feature_owner`

## `medium`

适用场景：

- 默认 feature 级工作
- 触及 `P0 journey`
- 跨模块协作但 blast radius 仍可控

最少要求：

- artifacts：`prd`、`architecture`、`tasks`、`readiness`、`journey_ledger`、`trace_map`、`closure_note`
- gates：`readiness`、`ambiguity_linter`、`smoke_proof_or_skeleton_validation`、`re_readiness_on_semantic_change`
- sign-off：`feature_owner` + `architect_or_tech_lead`

## `high`

适用场景：

- 高 blast radius 变更
- permission boundary / compliance / 多系统语义切换
- 需要更强的例外追责或更重验证

最少要求：

- artifacts：`prd`、`architecture`、`tasks`、`readiness`、`journey_ledger`、`trace_map`、`closure_note`、`exception_log_entry`、`full_e2e_plan`
- gates：`readiness`、`omission_focused_checklist`、`ambiguity_linter`、`smoke_proof`、`re_readiness_on_semantic_change`
- sign-off：`feature_owner` + `architect_or_tech_lead` + `qa_or_release_owner`

---

## 4. Owner Model

| Stage            | Owner                 | Support               |
| ---------------- | --------------------- | --------------------- |
| `deep_interview` | `pm_or_feature_owner` | `architect`           |
| `prd`            | `pm`                  | `feature_owner`       |
| `architecture`   | `architect`           | `tech_lead`           |
| `readiness`      | `architect`           | `pm`, `qa`            |
| `tasks`          | `tech_lead`           | `developer`, `qa`     |
| `implement`      | `developer`           | `tech_lead`           |
| `closure`        | `developer`           | `qa`, `feature_owner` |
| `exception`      | `feature_owner`       | `architect`, `qa`     |

解释：

- `owner` 负责最终收口，而不是只负责起草
- `support` 负责补全挑战、验证和对齐，不意味着可以替代 owner 承担 closure 责任

---

## 5. Stage Done Standards

阶段完成标准的详细解释见 [`./speckit-done-standards.md`](./speckit-done-standards.md)。

最重要的统一理解：

- PRD done：completion state、failure path、owner/permission boundary 已写清
- Architecture done：key path、testability、fixture strategy、re-readiness trigger 已落清
- Readiness done：blocker words 消除，journey/trace/closure 对齐，smoke path 可生成
- Tasks done：evidence、verification、closure path、gap separation 清楚
- Implement done：smoke proof 与 closure note 已落，`module complete but journey not runnable` 被禁止
- Closure done：deferred gap、next gate、verification commands、owners/signoffs 已显式记录

---

## 6. Exception Policy

Exception 不是隐式宽容，而是显式债务记录。

默认 exception log 路径：

- `docs/logs/speckit-exceptions.md`

模板：

- [`./speckit-exception-log-template.md`](./speckit-exception-log-template.md)

必须记录的字段：

- `exception_id`
- `risk_tier`
- `affected_stage`
- `owner`
- `reason`
- `mitigation`
- `expiry_or_next_gate`

默认触发条件：

- `risk_tier_override`
- `deferred_full_e2e`
- `waived_gate`
- `unresolved_definition_gap`
- `unresolved_implementation_gap`
- `owner_signoff_missing`

原则：

- 没有 exception log，就不算“允许跳过”
- `deferred` 不等于“以后再说”，必须带 next gate 或 expiry

---

## 7. 术语边界

### `silent assumption`

未被文档显式写出、却被流程默认成立的条件。

典型例子：

- 默认 fixture 已存在
- 默认权限入口正确
- 默认 full E2E 会有人补

### `silent scope growth`

未通过 risk tier、owner、tasks 或 exception 明确升级，却在执行阶段悄悄扩大范围。

### `re-readiness`

实现阶段若触及以下语义，必须回到 readiness 重新确认：

- completion semantics
- dependency semantics
- permission boundaries
- fixture / environment assumptions

---

## 8. 相关文档

- [`./speckit-done-standards.md`](./speckit-done-standards.md)
- [`./speckit-flow-metrics.md`](./speckit-flow-metrics.md)
- [`./speckit-exception-log-template.md`](./speckit-exception-log-template.md)
- [`./speckit-cli.md`](./speckit-cli.md)
- [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml)
- [`../../_bmad/speckit/commands/speckit.constitution.md`](../../_bmad/speckit/commands/speckit.constitution.md)
- [`../../_bmad/speckit/commands/speckit.checklist.md`](../../_bmad/speckit/commands/speckit.checklist.md)
