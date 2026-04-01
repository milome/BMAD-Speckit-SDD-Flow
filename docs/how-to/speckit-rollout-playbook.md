# Speckit Rollout Playbook

> 用这份 playbook 把新的 Speckit journey-first 治理从“文档定义”落到“团队默认做法”。

---

## 1. 目标

这轮 rollout 的目标不是一次性把所有 feature 都切到新流程，而是先让团队稳定做到这几件事：

- PRD 先写清 `P0 journey`、完成态、失败路径
- architecture 先写 key path、fixture strategy、smoke/full E2E 边界
- readiness 真正作为 blocker gate 使用
- tasks 按 runnable slice 组织，而不是按模块桶拆分
- implement 和 closure 能留下 smoke proof、trace、closure note、exception log

如果团队现在只能稳定做到其中一半，先把这一半做扎实，再扩大 rollout。

---

## 2. 先选什么做试点

推荐先用 1 到 2 个 feature 试点，不要直接拿最大、最乱、最历史包袱的项目开刀。

优先选择：

- 有明确 `P0 journey`
- blast radius 可控
- fixture / environment 可本地复现
- 有真实 smoke path，但 full E2E 成本还没高到难以维护
- 会跨 2 到 3 个模块协作，但不涉及复杂多系统权限切换

不建议第一批就选：

- 高风险合规改造
- 大规模权限模型迁移
- 需要跨多团队同步的主链路重构
- 当前连基本 Story / handoff / audit 都不稳定的团队

默认试点 tier：

- 第一批建议从 `medium` 开始
- 只有局部小改且不碰完成态/权限边界时才降到 `low`
- 只有确实高 blast radius、跨系统或合规敏感时才升到 `high`

---

## 3. 分阶段 rollout

### Phase 1: 定义链路先稳定

目标：

- PRD、architecture、readiness 先说同一种语言

必须做到：

- PRD 有 `P0 Journey Inventory`
- architecture 有 `P0 Key Path Sequences`
- readiness 能列出 blocker、smoke path、fixture / environment readiness

通过标志：

- 团队不再把“功能列表完整”当成“准备好实现”

### Phase 2: 执行链路接上

目标：

- tasks、implement、closure 都消费前面的 contract

必须做到：

- tasks 按 `journey-first / runnable slice` 输出
- 每个关键 slice 有 `Evidence Type`、`Verification Command`、`Closure Note Path`
- implement 完成后能留下 smoke proof 和 closure note

通过标志：

- 不再出现“前后端都做完了，但 P0 journey 还是跑不通”

### Phase 3: 工具和门禁默认化

目标：

- 把 readiness gate、ambiguity linter、smoke skeleton、fixture 规则接到本地和 CI

必须做到：

- 本地能运行 readiness / ambiguity / smoke 相关命令
- PR 至少能阻断明显 blocker
- full E2E 先有明确位置，不急着第一天就做 PR blocker

通过标志：

- 团队不再靠人工记忆发现定义缺口

### Phase 4: 治理和例外沉淀

目标：

- 让 risk tier、done standards、exception policy 成为默认参考

必须做到：

- 例外都写进 exception log
- deferred gap 有 next gate 或 expiry
- incident learnings 能回写到模板、checklist 或 examples

通过标志：

- 流程偏差可追责，可复盘，可更新金源

---

## 4. 什么时候用 low / medium / high

| Tier     | 什么时候用                                         | 什么时候别用                             |
| -------- | -------------------------------------------------- | ---------------------------------------- |
| `low`    | 小改动、局部替换、不碰权限边界和完成态             | 任何涉及 P0 completion semantics 的改动  |
| `medium` | 默认 feature 工作、跨模块但可控、要跑通 P0 journey | 需要更强 sign-off 的高 blast radius 改动 |
| `high`   | 多系统、高风险、权限/合规/核心语义迁移             | 只是因为团队“想更稳一点”就一律上高 tier  |

判断规则很简单：

- 一旦改 completion semantics、dependency semantics、permission boundaries、fixture / environment assumptions，默认至少 `medium`
- 如果再叠加高 blast radius 或合规要求，升到 `high`

---

## 5. 角色训练怎么拆

### PM / Feature Owner

重点训练：

- 怎么写 `P0 journey`
- 怎么写完成态和失败路径
- 什么叫 silent assumption
- 什么情况必须开 exception

不要把重点放在：

- 让 PM 去记所有 test/tool 命令

### Architect / Tech Lead

重点训练：

- key path sequence
- smoke/full E2E split
- fixture strategy
- re-readiness trigger
- readiness blocker 判断

不要把重点放在：

- 只补组件图和技术选型摘要

### Developer / QA

重点训练：

- tasks 怎么写 runnable slice
- evidence type / verification command / closure note 怎么落
- definition gap 和 implementation gap 怎么分
- 什么叫 `module complete but journey not runnable`

不要把重点放在：

- 只追求单元测试绿

### Release / QA Owner

重点训练：

- smoke proof 与 full E2E 的分工
- exception log 审核
- deferred gap 是否有 next gate

---

## 6. Incident 学习如何回流

每次 incident 或 post-audit 发现的关键问题，都不要只停在“这次补好了”。

推荐固定回流顺序：

1. 先记录到 `closure note` 或 `exception log`
2. 判断它属于哪类 gap
   - definition gap
   - implementation gap
   - fixture / environment gap
   - governance / owner gap
3. 回写到最近的源头文档
   - PRD 模板
   - architecture 模板
   - readiness gate
   - tasks / implement 命令
   - omissions pattern library
4. 如果这个坑会重复出现，再补：
   - example
   - linter rule
   - checklist item
5. 在下一轮试点前告知团队“默认做法已经变了什么”

这一步不做，rollout 就会停留在一次性改文档，而不是形成可复用制度。

---

## 7. 试点完成后看什么指标

建议至少看这些指标：

- `first_smoke_pass_time`
- `definition_gap_count`
- `implementation_gap_count`
- `re_readiness_count`
- `deferred_gap_count`
- `challenge_density`
- `exception_count`

读法：

- `first_smoke_pass_time` 很高，往往表示 tasks 没按 runnable slice 切
- `definition_gap_count` 高，说明 deep interview / PRD / architecture 还不扎实
- `re_readiness_count` 高，不一定是坏事；它经常说明团队开始真实暴露语义变化，而不是假装没有变化
- `exception_count` 高，要检查 tier 是否被低估，或 gating 太晚才触发

---

## 8. 常见 rollout 反模式

- 一上来就要求所有 feature 都走 `high`
- 只改模板，不改 tasks / implement / closure
- 只加 gate，不给 examples 和 playbook
- 只追 smoke proof，不写 closure note
- 发生例外时口头同意，不写 exception log
- 发现问题后只补本地实现，不回写模板 / checklist / examples

---

## 9. 推荐阅读顺序

1. [`../reference/speckit-governance.md`](../reference/speckit-governance.md)
2. [`../reference/speckit-done-standards.md`](../reference/speckit-done-standards.md)
3. [`../reference/speckit-exception-log-template.md`](../reference/speckit-exception-log-template.md)
4. [`../reference/speckit-flow-metrics.md`](../reference/speckit-flow-metrics.md)
5. [`../reference/speckit-cli.md`](../reference/speckit-cli.md)
6. [`../examples/speckit-contracts/good-prd-contract.md`](../examples/speckit-contracts/good-prd-contract.md)
7. [`../examples/speckit-contracts/good-architecture-contract.md`](../examples/speckit-contracts/good-architecture-contract.md)
8. [`../examples/speckit-contracts/good-smoke-e2e.md`](../examples/speckit-contracts/good-smoke-e2e.md)

---

## 10. 最后建议

如果团队现在只想先做一件事，就先让 `P0 journey runnable` 成为共同语言。

只要这条主线没有被稳定建立，再多 checklist、schema、CI、审计角色，最后也只会回到“文档看起来齐，但 E2E 仍然跑不通”。
