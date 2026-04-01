# Bad Architecture Contract Example

> 这个例子看起来“像架构文档”，但它没有真正承接 P0 journey。

---

## 系统组件

- Web 前端
- API 网关
- 订单服务
- 支付服务
- 库存服务
- 日志系统

## 技术选型

- 前端：React
- 后端：Node.js
- 数据库：PostgreSQL
- 队列：Redis

## 设计原则

- 高可用
- 易扩展
- 高性能
- 可观测

## 其他说明

- 失败情况后续补充
- 具体状态流转由开发实现时决定
- smoke 和 full E2E 后续统一规划
- fixture 先复用现有环境

---

## 为什么这是 bad

- 没有承接任何 `P0 journey`
- 没有 key path sequence
- 没有 business done / system accepted 区分
- “高可用、易扩展、可观测” 全是泛化口号
- 把失败处理、状态流转、smoke/full、fixture 都后置
- readiness 无法据此判断 blocker，tasks 也无法生成 runnable slice

这类 architecture 最常见的后果是：

- 组件图很完整
- 关键路径没人定义
- 开发各做各的模块
- 最后只有模块进度，没有可跑通的用户路径
