# IMPLEMENTATION_GAPS-E999-S004

## 1. 差距识别

### GAP-1：StageValidator 缺少对外可复用的 allowed next stages 查询能力

现状：
- 当前阶段推进语义主要分散在转换校验逻辑与常量读取中
- 缺少稳定、可直接断言的 allowed next stages 公共结果

影响：
- 调用方无法围绕同一份 next stage 语义组织校验与错误展示
- 测试无法直接证明阶段允许集合是单一事实来源

### GAP-2：结构化转换错误未承载 allowed next stages 语义

现状：
- 现有 typed transition error 已包含基础阶段上下文
- 错误 details 中未强制承载当前阶段允许进入的 next stages 集合

影响：
- 调用方无法从错误对象直接获知当前允许路径
- `StoryStateManager` 与测试只能依赖消息文本或推断逻辑

### GAP-3：StoryStateManager 需要以共享语义证明未维护第二套阶段规则

现状：
- `advanceStage()` 已调用 validator 进行转换校验
- 仍需通过文档化任务与测试证明 manager 推进判断、错误透出、allowed next stages 语义完全来源于共享 validator

影响：
- 若缺少对应测试证据，无法证明 manager 与 validator 没有语义漂移

### GAP-4：缺少围绕 allowed next stages 的 RED → GREEN → 回归证据

现状：
- 现有测试覆盖 typed transition validation
- 对 allowed next stages 查询、错误 details、manager 语义复用的覆盖粒度不足

影响：
- 无法满足本 story 对 TDD 顺序和单一语义复用的验收要求

---

## 2. Gap → 任务映射

| Gap ID | 对应任务 |
|--------|----------|
| GAP-1 | T1, T2 |
| GAP-2 | T1, T2 |
| GAP-3 | T1, T2, T3 |
| GAP-4 | T1, T3 |

---

## 3. 实现优先级

1. 先补测试拿到 RED 证据
2. 再补 `StageValidator` 的 allowed next stages 能力与错误 details
3. 再验证 `StoryStateManager` 统一复用共享语义
4. 最后回归测试并核对文档映射

---

## 4. 通过标准

- `StageValidator` 可返回稳定的 allowed next stages 集合
- `validateTransition` 非法错误 details 包含 `allowedNextStages`
- `validateEntry` 继续兼容旧返回格式并复用共享校验
- `advanceStage()` 通过共享 validator 完成阶段推进判断
- 目标测试通过，且能直接断言 allowed next stages 语义
