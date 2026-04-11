# Speckit Exception Log Template

> 用于记录被显式允许的治理例外。默认策略来源于 [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml) 的 `exception_policy`。
> **Current path**: explicit governance debt ledger with owner + next gate
> **Legacy path**: implicit waiver / later-fix note without traceability

---

## 使用规则

- 没有 exception log，就不算“已批准例外”
- 例外必须带 owner、reason、mitigation、expiry 或 next gate
- 例外不是逃逸口；它只是把债务显式化并可追责

默认推荐日志位置：

- `docs/logs/speckit-exceptions.md`

---

## 触发条件

以下情况默认应记 exception：

- `risk_tier_override`
- `deferred_full_e2e`
- `waived_gate`
- `unresolved_definition_gap`
- `unresolved_implementation_gap`
- `owner_signoff_missing`

---

## 必填字段

| 字段                  | 说明                                                        |
| --------------------- | ----------------------------------------------------------- |
| `exception_id`        | 唯一 ID，例如 `EX-20260327-01`                              |
| `risk_tier`           | `low` / `medium` / `high`                                   |
| `affected_stage`      | 受影响阶段，如 `readiness`、`tasks`、`implement`、`closure` |
| `owner`               | 谁对该例外负责收口                                          |
| `reason`              | 为什么必须开例外，而不是正常过 gate                         |
| `mitigation`          | 当前缓解动作                                                |
| `expiry_or_next_gate` | 失效时间或下一次必须重新过的 gate                           |

推荐补充字段：

- `feature_or_story`
- `journey_ids`
- `related_artifacts`
- `signoffs`
- `status`

---

## 模板

```markdown
# Speckit Exceptions

## EX-YYYYMMDD-01

- **exception_id**: `EX-YYYYMMDD-01`
- **feature_or_story**: `E?-S?` 或具体 feature slug
- **risk_tier**: `medium`
- **affected_stage**: `implement`
- **trigger**: `deferred_full_e2e`
- **owner**: `feature_owner`
- **journey_ids**: `J01`
- **reason**: 说明为什么本轮必须延期，而不是满足标准 gate
- **mitigation**: 当前已补的缓解措施，例如 smoke proof、额外监控、限制发布范围
- **expiry_or_next_gate**: 例如 `Before release candidate` 或 `2026-04-03`
- **related_artifacts**:
  - `specs/.../tasks.md`
  - `closure-notes/J01.md`
- **signoffs**:
  - `architect_or_tech_lead`
  - `qa_or_release_owner`
- **status**: `open`
```

---

## 示例说明

### 例 1：deferred full E2E

可接受前提：

- 已有 smoke proof
- closure note 已记录 deferred reason
- 明确了 next gate

不可接受写法：

- “full E2E 后面再补”

### 例 2：risk tier override

必须写清：

- 为什么要从 `high` 降到 `medium` 或从 `medium` 升到 `high`
- 谁批准了这次调整
- 对应 gates / sign-off 如何变化

### 例 3：unresolved definition gap

只有在 gap 被显式登记、owner 接手、并定义了下一次必须收口的 gate 时，才可以继续流转。

---

## 关闭规则

一个 exception 只有在以下条件同时满足时才能关闭：

- 原因已消除或替代 gate 已完成
- 关联 closure / readiness / audit 工件已更新
- owner 明确确认关闭
- 如果例外影响 risk tier 或 sign-off，相关审批链已补齐

建议关闭时补一行：

```markdown
- **closed_at**: `YYYY-MM-DD`
- **closure_evidence**: 链接到 closure note、audit report 或 full E2E 证明
```

---

## 相关文档

- [`./speckit-governance.md`](./speckit-governance.md)
- [`./speckit-done-standards.md`](./speckit-done-standards.md)
- [`./speckit-flow-metrics.md`](./speckit-flow-metrics.md)
- [`../../_bmad/_config/speckit-governance.yaml`](../../_bmad/_config/speckit-governance.yaml)
