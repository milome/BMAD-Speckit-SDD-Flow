# Good Architecture Contract Example

> 这是一个 key-path-first 的 architecture contract 片段，不是完整架构文档。

---

## Inherited Product Contracts

- `J01`: buyer 提交订单并拿到 `submitted` 结果
- `J02`: 支付失败后 buyer 能看到失败原因并重试
- `INV-01`: 未锁定库存前不能进入 `submitted`
- `INV-03`: buyer 不能操作不属于自己的订单

## P0 Key Path Sequences

### `J01` submit order

1. UI 提交购物车
2. Order API 验证 session 与 buyer ownership
3. Inventory service 尝试锁库存
4. Order service 写订单与状态 `submitted`
5. UI 展示订单号

### `J02` payment fail and retry

1. UI 发起支付
2. Payment adapter 调用网关
3. 若 timeout / fail，Order service 保持 `pending_payment`
4. UI 展示失败原因与重试入口

## Business Completion State vs System Completion State

| Journey | Business Done | System Accepted |
|---|---|---|
| `J01` | 买家看到订单号且库存已锁定 | API 返回 200 只是中间信号，不足以证明完成 |
| `J02` | 买家看到失败原因且可以重试 | 网关响应失败本身不算完成，必须回写订单状态并暴露 UI 反馈 |

## Sync / Async Boundaries

- 库存锁定必须同步完成后才能写 `submitted`
- 支付失败日志可异步投递，但 UI 失败反馈与订单状态回写必须同步

## Fallback And Compensation Strategy

- 库存锁失败：直接拒绝下单，不创建订单
- 支付超时：记录 timeout 事件，订单保持 `pending_payment`
- 若订单写入成功但通知失败：补偿任务异步重试，不影响 buyer 当前结果

## Minimum Observability Contract

- 每次 `J01` 记录 `journey_id=J01`、buyer_id、order_id、inventory_lock_result
- 每次 `J02` 记录 `journey_id=J02`、payment_error_code、retry_allowed`
- smoke proof 必须能从日志或测试输出来确认关键状态变化

## Testability And Smoke E2E Preconditions

- 提供独立 smoke fixture：buyer、库存、支付网关 stub
- smoke suite 只验证 `J01`、`J02` 关键路径
- full E2E 放 nightly，覆盖更广支付分支
- fixture 生命周期和 cleanup 规则已定义，禁止共享脏状态

## Re-readiness Triggers

以下改动必须回到 readiness：

- 修改订单完成态定义
- 修改支付失败后的状态流转
- 修改 buyer ownership 校验
- 修改 fixture / environment 假设

---

## 为什么这是 good

- 先承接 PRD contract，再展开架构
- key path sequence 比“系统组件图”优先
- 区分 business done 与 system accepted
- sync / async boundary 可验证
- observability、fixture、smoke/full split 都能直接服务 readiness 和 implement
