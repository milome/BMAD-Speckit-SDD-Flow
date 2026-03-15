# IMPLEMENTATION_GAPS-E999-S003

## 1. 差距识别

### GAP-1：StageValidator 只有字符串校验结果

现状：
- `validateEntry` 仅返回 `{ valid, errors: string[] }`
- 无法让调用方按错误码区分 prerequisite / skip / reverse

影响：
- StoryStateManager 无法统一复用结构化语义
- 测试只能依赖文本或绕过核心能力

### GAP-2：StoryStateManager 未统一使用 typed transition validation

现状：
- `advanceStage()` 只做 final stage 与 completed 检查
- 未在真正切换前调用 validator 的结构化转换校验

影响：
- manager 与 validator 逻辑分散，后续可能漂移

### GAP-3：缺少对 skip / reverse typed error 的真实测试证据

现状：
- 已有测试更偏向字符串校验
- 不足以证明 StageTransitionError 语义真实可用

影响：
- 无法满足本 story 的 typed transition validation 目标

---

## 2. Gap → 任务映射

| Gap ID | 对应任务 |
|--------|----------|
| GAP-1 | T1, T2 |
| GAP-2 | T2 |
| GAP-3 | T1, T3 |

---

## 3. 实现优先级

1. 先补测试拿到 RED 证据
2. 再补 `validateTransition`
3. 再让 `StoryStateManager` 统一接入
4. 最后回归验证并更新状态

---

## 4. 通过标准

- `validateTransition` 对三类非法转换返回不同 error code
- `validateEntry` 复用 typed 能力但保持兼容
- `advanceStage()` 调用 validator
- 目标测试通过
