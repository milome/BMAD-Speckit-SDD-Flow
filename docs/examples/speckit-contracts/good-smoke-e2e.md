# Good Smoke E2E Example

> 这是一个 smoke proof contract 示例，重点是证明 `P0 journey` 可跑，而不是覆盖所有边角。

---

## Target Journey

- `Journey ID`: `J01`
- `Goal`: buyer 提交订单并看到订单号
- `Related Invariants`: `INV-01`, `INV-03`

## Fixture And Environment

- buyer fixture: `buyer-smoke-01`
- cart fixture: 单商品、库存充足
- payment fixture: 不参与本 smoke
- environment: 本地 stub inventory service
- cleanup: 测试结束后删除订单记录并释放库存锁

## Verification Command

```bash
pnpm test:e2e:smoke --grep "J01 submit order"
```

## Required Assertions

- UI 显示订单号
- 订单状态为 `submitted`
- 库存锁记录存在
- 日志中带 `journey_id=J01`

## Non-Goals

- 不覆盖退款
- 不覆盖支付失败重试
- 不覆盖 nightly full E2E 范围

## Closure Link

- `closure-notes/J01.md`

---

## 为什么这是 good

- 明确说明“验证哪条 journey”
- fixture、environment、cleanup 都是显式的
- verification command 可直接跑
- assertion 既有用户可见结果，也有系统状态证明
- 明确了 smoke 的边界，不拿它冒充 full E2E
