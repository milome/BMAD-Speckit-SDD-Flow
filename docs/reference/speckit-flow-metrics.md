# Speckit Flow Metrics

> Speckit 治理层使用的核心指标词典。指标键来自 [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml) 的 `health_metrics.keys`。

---

## 1. 设计原则

- 指标用于发现流程退化，不用于粉饰阶段完成
- 指标必须可追溯到具体工件、审计报告或 closure note
- 指标没有被采集，不等于指标为 0

---

## 2. 指标定义

## `first_smoke_pass_time`

单位：`minutes`

定义：

- 从 tasks 获批可执行，到第一个 P0 journey smoke proof 通过之间的时间

关注点：

- 过长通常意味着 PRD / architecture / tasks 没把关键路径收敛清楚
- 如果 `first_smoke_pass_time` 很长，同时 `definition_gap_count` 也高，优先回头看定义质量，而不是只怪实现速度

推荐采集点：

- tasks 审计通过时间
- 第一次 smoke pass 或 closure note 记录时间

## `definition_gap_count`

单位：`count`

定义：

- 当前阶段边界仍未关闭的 definition gap 数量

关注点：

- 高 definition gap 往往意味着 deep interview、PRD、architecture 质量不足
- implement 阶段若仍对外宣称完成，但 definition gap > 0，应视为高风险

## `implementation_gap_count`

单位：`count`

定义：

- 当前阶段边界仍未关闭的 implementation gap 数量

关注点：

- 用于区分“规格未定”与“代码未补”
- 不能用 implementation gap 去掩盖 definition gap

## `re_readiness_count`

单位：`count`

定义：

- 实现阶段因为 completion semantics、dependency semantics、permission boundaries、fixture/environment assumptions 变化而回到 readiness 的次数

关注点：

- 次数高不一定是坏事，可能说明 gate 真正在工作
- 问题在于：是否反复因为同类遗漏回退

## `deferred_gap_count`

单位：`count`

定义：

- 被显式延期到 closure note 或 exception log 的 gap 数量

关注点：

- `deferred` 只能代表显式债务，不能代表隐式遗忘
- 若 deferred gap 高，但没有 next gate 或 expiry，说明 closure 质量不足

## `challenge_density`

单位：`findings_per_review`

定义：

- 每次审计、checklist 或 review 平均提出的高价值 challenge / finding 数量

关注点：

- 太低可能说明审计流于形式
- 太高且持续不降，通常表示前置文档质量差或 owner model 未发挥作用

## `exception_count`

单位：`count`

定义：

- 当前 feature / story 的活跃 exception 数

关注点：

- exception 多不是问题本身，关键是是否有 owner、reason、mitigation、expiry_or_next_gate
- 高风险 tier 下的 exception_count 应与 sign-off 强度一起看

---

## 3. 推荐解读方式

| 现象 | 优先怀疑 |
|---|---|
| `first_smoke_pass_time` 长 + `definition_gap_count` 高 | PRD / architecture 定义不够硬 |
| `implementation_gap_count` 高 + `definition_gap_count` 低 | tasks 切分或实现推进有问题 |
| `re_readiness_count` 高 | 关键语义变更频繁，或前期 assumptions 未显式化 |
| `deferred_gap_count` 高 | closure / exception discipline 可能不足 |
| `challenge_density` 接近 0 | checklist / audit 可能失真 |
| `exception_count` 高 | 需要审视 risk tier 是否被低估 |

---

## 4. 建议数据来源

| 指标 | 推荐数据来源 |
|---|---|
| `first_smoke_pass_time` | tasks 审计通过时间、smoke proof 时间、closure note 时间 |
| `definition_gap_count` | readiness 报告、audit 报告、checklist 结果 |
| `implementation_gap_count` | implement 审计、post-audit、task execution evidence |
| `re_readiness_count` | handoff、phase receipt、implement audit |
| `deferred_gap_count` | closure note、exception log |
| `challenge_density` | audit 报告、checklist 结果、批判审计员 findings |
| `exception_count` | exception log |

---

## 5. 使用边界

- 不要把这些指标当成 velocity KPI
- 不要拿低 `challenge_density` 当作“文档写得很好”的证据
- 不要把 `deferred_gap_count=0` 理解成没有风险，除非 closure 与 exception 都真的审过

---

## 6. 相关文档

- [`./speckit-governance.md`](./speckit-governance.md)
- [`./speckit-done-standards.md`](./speckit-done-standards.md)
- [`./speckit-exception-log-template.md`](./speckit-exception-log-template.md)
- [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml)
