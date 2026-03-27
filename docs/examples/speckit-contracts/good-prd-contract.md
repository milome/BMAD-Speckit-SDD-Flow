# Good PRD Contract Example

> 这是一个“足够能驱动 architecture / readiness / tasks”的 PRD contract 片段，不是完整 PRD。

---

## P0 Journey Inventory

| Journey ID | Actor | Goal | Completion State | Priority |
|---|---|---|---|---|
| `J01` | `buyer` | 提交订单并拿到“已下单”结果 | 页面显示订单号，订单状态为 `submitted`，库存被锁定 | `P0` |
| `J02` | `buyer` | 在支付失败后看到明确失败原因并可重试 | 页面显示失败原因，订单仍为 `pending_payment`，可重新发起支付 | `P0` |

## Journey Evidence Contract

| Journey ID | Success Evidence | Failure Evidence | Verification Owner |
|---|---|---|---|
| `J01` | smoke proof 断言订单号出现，订单表写入 `submitted` 记录 | 若库存不足，返回 `out_of_stock` 并不创建订单 | `feature_owner + qa` |
| `J02` | smoke proof 断言失败消息出现且重试按钮可用 | 若支付网关超时，系统记录 `payment_timeout` 并保持可重试 | `feature_owner + qa` |

## Actor-Permission-State Matrix

| Actor | Allowed Action | Forbidden Action | State Boundary |
|---|---|---|---|
| `buyer` | 提交自己的购物车订单 | 查看或重试他人的订单 | 只允许操作 `buyer_id = session.user_id` 的订单 |
| `support_agent` | 查询订单状态 | 代替买家发起支付 | 只读，不可执行支付写操作 |

## Failure Matrix

| Trigger | User-visible outcome | System outcome | Recovery |
|---|---|---|---|
| 库存不足 | 显示“库存不足” | 不创建订单 | 买家修改购物车后重提 |
| 支付网关超时 | 显示“支付失败，请重试” | 记录超时事件，订单保持 `pending_payment` | 买家可重试，support 可查超时日志 |

## Core Business Invariants

- `INV-01`: 未锁定库存前，不允许把订单标记为 `submitted`
- `INV-02`: 支付失败不会把订单推进到已完成态
- `INV-03`: 买家不能操作不属于自己的订单

## Deferred Ambiguities

- 是否允许多次支付重试的最大次数，目前 deferred 到 architecture / readiness 决定
- 是否需要支付失败后的自动补偿通知，目前 deferred，但必须在 readiness 前关闭或记 exception

---

## 为什么这是 good

- 先定义了 `P0 journey`，不是直接罗列功能点
- 成功与失败都带 evidence contract
- actor / permission / state boundary 是显式的
- failure path 有用户可见结果、系统结果和 recovery
- deferred ambiguity 被显式登记，而不是隐藏在默认假设里
