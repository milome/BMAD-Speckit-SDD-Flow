# Tasks E999-S003：Stage Validator Transition Errors

**Input**: spec-E999-S003.md、plan-E999-S003.md、IMPLEMENTATION_GAPS-E999-S003.md

---

## 1. 执行任务

### T1 [x] 先补 typed transition validation 测试

- 修改 `tests/story-workflow/StageValidator.test.ts`
- 修改 `tests/story-workflow/StoryStateManager.test.ts`
- 修改 `tests/story-workflow/integration.test.ts`
- 新增对以下场景的断言：
  - valid sequential transition
  - prerequisite not met
  - skip not allowed
  - reverse not allowed
- RED 证据：初次运行测试失败，提示 `validateTransition is not a function`

### T2 [x] 实现 typed transition validation 并接入 manager

- 修改 `src/story-workflow/StageValidator.ts`
- 新增 `validateTransition(context)`
- `validateEntry()` 改为复用 typed 校验
- 修改 `src/story-workflow/StoryStateManager.ts`
- `advanceStage()` 调用 shared validator
- 新增 `getCompletedStages()`

### T3 [x] 回归测试并验证通过

- 运行目标测试：
  - `tests/story-workflow/StageValidator.test.ts`
  - `tests/story-workflow/StoryStateManager.test.ts`
  - `tests/story-workflow/integration.test.ts`
- 结果：3 files passed, 40 tests passed

### T4 [x] 更新实施追踪

- 写入 spec / plan / gaps / tasks 文档
- 写入 `prd.json` 与 `progress.txt`
- 更新 `.claude/state/stories/E999-S003-progress.yaml`

---

## 2. 验收勾选

| 检查项 | 状态 |
|--------|------|
| typed validateTransition 已实现 | [x] |
| prerequisite/skip/reverse 已覆盖 | [x] |
| StoryStateManager 已统一使用 validator | [x] |
| 目标测试通过 | [x] |
| state/tasks 文档已更新 | [x] |
