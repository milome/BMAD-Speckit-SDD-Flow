# Speckit Done Standards

> 各阶段的退出标准参考。策略键来自 [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml) 的 `stage_done_standards`。

---

## 使用原则

- done standard 是退出标准，不是阶段摘要
- 任何阶段若存在 blocker，就不能因为“文档基本齐全”而宣布通过
- 如果 reference 文档与 YAML 键不一致，以 YAML 为准

---

## 1. PRD Done

对应 YAML 键：

- `p0_journey_inventory_defined`
- `completion_states_explicit`
- `failure_paths_explicit`
- `owner_and_permission_boundaries_explicit`

通过标准：

- P0 journey inventory 已列出，且优先级清楚
- 每个关键 journey 的用户可见完成态可描述、可验证
- primary flow 之外的 failure path 已定义，不是只写 happy path
- owner、actor、permission boundary 已写清，不靠默认理解

常见未通过原因：

- 只有功能点，没有用户 journey
- 完成态写成“功能实现完成”
- 没写失败触发、恢复条件或拒绝条件
- 谁能做、谁不能做没有定义

---

## 2. Architecture Done

对应 YAML 键：

- `key_path_design_traced_to_p0_journeys`
- `testability_and_fixture_strategy_defined`
- `smoke_vs_full_e2e_positioning_defined`
- `re_readiness_triggers_defined`

通过标准：

- 架构围绕 key path，而不是围绕技术模块目录组织
- fixture strategy、testability、cleanup/lifecycle 有明确设计
- `smoke` 与 `full E2E` 的职责、时间预算、运行位置清楚
- 哪类改动需要 `re-readiness` 已显式列出

常见未通过原因：

- architecture 只讲组件，不讲关键路径
- fixture 生命周期没写
- smoke/full 混成一个笼统的 “E2E”
- 依赖语义变化时没有回到 readiness 的机制

---

## 3. Readiness Done

对应 YAML 键：

- `blocker_words_resolved`
- `silent_assumptions_removed_or_logged`
- `journey_ledger_and_trace_map_consistent`
- `smoke_path_generatable`

通过标准：

- blocker words、placeholder、silent assumption 已被消除或记录到 exception
- `journey-ledger`、`trace-map`、`closure note` 语义一致
- 至少可以生成 smoke skeleton，或已有真实 smoke path
- fixture / environment 前提是显式声明，不是默认存在

常见未通过原因：

- 文档里残留未定占位、后补占位或疑问占位标记
- ledger 和 trace 不一致
- 说要 smoke proof，但连 smoke path 都生成不出来
- closure path 未定义

---

## 4. Tasks Done

对应 YAML 键：

- `runnable_slices_over_module_queues`
- `evidence_type_and_verification_command_defined`
- `closure_note_path_defined`
- `definition_gaps_separated_from_implementation_gaps`

通过标准：

- tasks 按 runnable slice / journey-first 组织，而不是前后端模块桶
- 每个关键 slice 都有 evidence type 与 verification command
- closure note path 已明确，不是“后面补”
- definition gap 与 implementation gap 已分离

常见未通过原因：

- 任务写成“前端做完、后端做完、数据库做完”
- 只有开发任务，没有验证命令
- closure 任务不存在
- definition gap 混在开发任务里，导致实现阶段才发现规格未定

---

## 5. Implement Done

对应 YAML 键：

- `smoke_proof_recorded_for_each_p0_journey`
- `closure_notes_updated`
- `re_readiness_triggered_when_required`
- `module_complete_but_journey_not_runnable_prohibited`

通过标准：

- 每个 P0 journey 至少有 smoke proof 或明确的 exception 记录
- closure note 已更新，且含验证命令、deferred gap、next gate
- 触及 completion semantics / dependency semantics / permission boundaries / fixture-environment assumptions 时已触发 `re-readiness`
- 不存在“模块完成了，但 journey 仍不可跑”的漂移

常见未通过原因：

- 只有单元测试通过，没有 smoke proof
- closure note 缺任务、测试、gap 或 next gate
- 修改了关键语义却没有回 readiness
- 代码被导入测试，但未进入生产关键路径

---

## 6. Closure Done

对应 YAML 键：

- `deferred_gaps_explicit`
- `next_gate_or_expiry_explicit`
- `verification_commands_recorded`
- `owners_and_signoffs_recorded`

通过标准：

- 所有 deferred gap 已显式列出，而不是口头说明
- 每个 deferred item 都有 next gate 或 expiry
- verification commands 已保留下来，方便复跑与追责
- owner / sign-off 信息明确

常见未通过原因：

- 写了“剩余问题待后续处理”
- 没写谁负责、何时再过
- 没有把验证命令落进 closure note 或 exception log

---

## 7. 快速判定表

| Stage | 最关键的 blocker 问题 |
|---|---|
| PRD | P0 journey 与 completion state 是否可验证 |
| Architecture | key path、fixture strategy、smoke/full split 是否清楚 |
| Readiness | blocker words 与 silent assumptions 是否已清掉 |
| Tasks | 是否仍是 module queue 而非 runnable slice |
| Implement | 是否出现 `module complete but journey not runnable` |
| Closure | deferred gap、next gate、owner 是否都写清 |

---

## 8. 相关文档

- [`./speckit-governance.md`](./speckit-governance.md)
- [`./speckit-flow-metrics.md`](./speckit-flow-metrics.md)
- [`./speckit-exception-log-template.md`](./speckit-exception-log-template.md)
- [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml)
