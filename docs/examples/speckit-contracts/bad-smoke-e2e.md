# Bad Smoke E2E Example

> 这个例子的问题不是测试少，而是它没有真正证明关键 journey 可跑。

---

## 测试目标

- 测试下单功能

## 执行方式

- 使用现有测试环境
- 如有需要手动准备数据
- 运行端到端测试

## 断言

- 页面没有报错
- 接口返回成功
- 主要流程基本可用

## 补充

- 失败路径后续再测
- cleanup 视情况处理
- 如果 smoke 太慢，后续再拆

---

## 为什么这是 bad

- 没有 `Journey ID`
- 不知道证明的是哪条 P0 journey
- “现有测试环境” 是典型 silent assumption
- 没有 fixture 生命周期和 cleanup
- “页面没有报错”“接口返回成功” 不等于 journey 完成
- 失败路径被直接后置
- smoke 与 full E2E 没有边界

这类 smoke 测试通常会造成：

- CI 偶尔绿，但没人知道绿了什么
- fixture 互相污染
- 模块接口成功，却没有用户可见完成态证明
