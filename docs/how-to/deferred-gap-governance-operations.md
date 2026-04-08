# Deferred Gaps 治理操作说明

这页文档只回答两个操作问题：

1. 如何用 `dashboard --show-deferred-gaps` 快速查看当前 Deferred Gaps 状态
2. 如何用 `deferred-gap-audit` 判断是否已经发生治理漂移

适用场景：

- readiness report 已经开始显式记录 `Deferred Gaps`
- 你需要在 Sprint Planning 前确认 gap 是否被带入计划
- 你怀疑某个 gap 被静默删除、超期，或 owner 丢失

## 什么时候用哪个命令

- 想给人快速看当前状态：用 `dashboard --show-deferred-gaps`
- 想给脚本 / CI / weekly audit 做阻断：用 `deferred-gap-audit`

## 1. 查看 Deferred Gaps 看板

执行：

```bash
npx bmad-speckit dashboard --show-deferred-gaps
```

如果你还要同时拿 runtime snapshot：

```bash
npx bmad-speckit dashboard --show-deferred-gaps --json --output-json _bmad-output/dashboard/runtime-dashboard.json
```

### 输出结构

在原有 dashboard Markdown 后面，会追加两块内容：

1. `Deferred Gap Governance Summary`
2. `Deferred Gaps Status`

### 输出样例

```md
## Deferred Gap Governance Summary

- Readiness Reports: 2
- Deferred Gap Count: 2
- Deferred Gaps Explicit: yes
- Alert Count: 1

## Deferred Gaps Status

| Gap ID | 状态 | 目标 Sprint / Resolution Target | 当前风险 | Owner |
|--------|------|-------------------------------|----------|-------|
| J04-Smoke-E2E | deferred | Sprint 2+ | 可能漂移 | Dev Team |
| Epic3-4-UX | expired | 2026-04-01 | 高风险 | UX Designer |

### Deferred Gap Alerts

- Gap Epic3-4-UX exceeded resolution_target 2026-04-01
```

### 字段含义

- `状态`
  - `deferred`: 已显式推迟，但尚未进入当前 sprint 执行
  - `in_progress`: 已被 `deferred_gap_plan` 绑定到计划工作项
  - `resolved`: 已显式标记解决
  - `expired`: 已超过 `resolution_target`
- `当前风险`
  - `低风险`: 已进入计划或信息完整
  - `可能漂移`: 还没排进计划，且没有充分解释
  - `高风险`: 已超期或 owner 缺失

## 2. 运行 Deferred Gap 审计

执行 Markdown 审计：

```bash
npx bmad-speckit deferred-gap-audit
```

输出 JSON：

```bash
npx bmad-speckit deferred-gap-audit --json
```

作为门禁运行：

```bash
npx bmad-speckit deferred-gap-audit --fail-on-alert
```

如果要把审计结果落盘：

```bash
npx bmad-speckit deferred-gap-audit --output _bmad-output/deferred-gap-audit.md --fail-on-alert
```

## 3. 告警语义

当前实现里，`deferred-gap-audit` 会把以下情况视为 `alert`：

### A. 静默移除

同一条 readiness 链路中，上一版 report 有某个 gap，而最新版 report 不再出现，且没有找到明确解决证据。

样例：

```text
Gap J04-Smoke-E2E was removed without resolution evidence between implementation-readiness-report-2026-04-07.md and implementation-readiness-report-2026-04-08.md
```

这是最强阻断信号。它表示模型或人工在没有 closure / resolution evidence 的情况下直接删掉了 gap。

### B. 缺 Owner

最新版 readiness / sprint planning 状态里，某个 gap 没有 `owner`。

样例：

```text
Gap Epic3-4-UX is missing an owner in the latest readiness/sprint plan state
```

### C. 已超期

`resolution_target` 是可解析日期，且当前时间已经超过该日期，但 gap 仍未 `resolved`。

样例：

```text
Gap Epic3-4-UX exceeded resolution_target 2026-04-01
```

## 4. 哪些情况当前不会直接报 alert

当前实现中，下面这些更多体现为风险，不一定直接触发 `alert`：

- gap 还没进入 `planned_work_items`，但也没有超期
- gap 继续延期，但只是 `resolution_target` 被更新
- gap 仍处于 `deferred`，但 owner 和 target 都完整

这些情况仍然应该在 Sprint Planning 中处理，因为 `deferred_gap_plan` 要求每个 gap：

- 要么绑定 `planned_work_items`
- 要么写 `explicit_reason`

也就是说：

- `dashboard` 更偏向可视化和风险观察
- `sprint-planning` workflow 更偏向“必须安排或必须解释”
- `deferred-gap-audit --fail-on-alert` 目前只对更强的治理异常做阻断

## 5. Weekly Audit

仓库已提供每周审计工作流：

- [deferred-gap-audit.yml](D:/Dev/BMAD-Speckit-SDD-Flow/.github/workflows/deferred-gap-audit.yml)

触发方式：

- 每周一 UTC 02:00 自动运行
- 也可以手工 `workflow_dispatch`

默认命令：

```bash
npx bmad-speckit deferred-gap-audit --output _bmad-output/deferred-gap-audit.md --fail-on-alert
```

如果有告警，job 会以非零退出码失败。

## 6. 推荐操作顺序

1. readiness 完成后，先看 `dashboard --show-deferred-gaps`
2. Sprint Planning 前，确认 `deferred_gap_plan.items` 覆盖了所有 gap
3. 提交前或周巡检时，跑 `deferred-gap-audit --fail-on-alert`
4. 如果出现 “removed without resolution evidence”，先补 resolution evidence 或把 gap 恢复到 readiness report，不要直接继续

## 7. 相关文档

- [runtime-dashboard.md](./runtime-dashboard.md)
- [guide-index.md](./guide-index.md)
- [Deferred Gaps Governance Requirements](../requirements/2026-04-08-deferred-gaps-governance.md)
