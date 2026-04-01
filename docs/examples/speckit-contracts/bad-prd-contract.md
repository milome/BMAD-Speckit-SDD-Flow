# Bad PRD Contract Example

> 这个例子的问题不在“写得少”，而在它无法驱动 architecture / readiness / tasks 形成可运行 E2E。

---

## 功能需求

- 用户可以下单
- 用户可以支付
- 支持查看订单状态
- 支持异常处理
- 后续可以扩展退款

## 验收标准

- 下单流程完成
- 支付功能完成
- 页面体验良好
- 异常情况合理处理

## 补充说明

- 默认库存系统可用
- 默认支付网关稳定
- 默认订单状态流转正确
- 如果有问题，后续再补

---

## 为什么这是 bad

- 没有 `Journey ID`，后续无法 trace
- 没有完成态定义，`下单流程完成` 无法验证
- 没有 actor / permission boundary
- 没有 failure matrix，只说“异常合理处理”
- 把关键依赖写成默认成立
- 使用“后续再补”这种 blocker 词，但没有 exception log 或 next gate

这类 PRD 往往会导致：

- architecture 只能画通用组件图
- readiness 无法判断 smoke path 是否可生成
- tasks 会退化成前后端模块任务
- implement 最后出现“功能点都做了，但关键 journey 还是跑不通”
