# Tasks E999-S004：Stage Validator Allowed Next Stages

**Input**: spec-E999-S004.md、plan-E999-S004.md、IMPLEMENTATION_GAPS-E999-S004.md

---

## 1. 执行任务

### T1 [ ] 先补 allowed next stages 与语义复用测试

- 修改 `tests/story-workflow/StageValidator.test.ts`
- 修改 `tests/story-workflow/StoryStateManager.test.ts`
- 修改 `tests/story-workflow/integration.test.ts`
- 新增对以下场景的断言：
  - 当前阶段返回稳定的 `allowedNextStages`
  - 合法 next stage 通过共享语义校验
  - 非法 target stage 返回结构化错误
  - 错误 `details.allowedNextStages` 可直接断言
  - manager 推进失败时透出与 validator 一致的 `allowedNextStages`
- RED 证据：初次运行测试失败，提示缺少 allowed next stages 查询能力或错误 details 不包含 `allowedNextStages`

### T2 [ ] 实现 allowed next stages 能力并接入 manager 语义

- 修改 `src/story-workflow/StageValidator.ts`
- 新增 allowed next stages 查询方法
- `validateTransition()` 改为统一复用 allowed next stages 结果
- 结构化错误 details 写入 `allowedNextStages`
- `validateEntry()` 改为复用更新后的转换校验
- 修改 `src/story-workflow/StoryStateManager.ts`
- `advanceStage()` 继续通过共享 validator 完成推进校验，并保证不维护第二套阶段语义

### T3 [ ] 回归测试并验证通过

- 运行目标测试：
  - `tests/story-workflow/StageValidator.test.ts`
  - `tests/story-workflow/StoryStateManager.test.ts`
  - `tests/story-workflow/integration.test.ts`
- 验证：
  - allowed next stages 查询断言通过
  - manager 与 validator 错误语义一致
  - 合法推进路径与既有历史记录行为保持通过

### T4 [ ] 核对 speckit 文档与实现映射

- 核对 `spec-E999-S004.md` 与 `plan-E999-S004.md` 中的目标文件路径
- 核对 `IMPLEMENTATION_GAPS-E999-S004.md` 的 gap 与任务映射
- 确认 tasks 能直接映射到以下文件：
  - `src/story-workflow/StageValidator.ts`
  - `src/story-workflow/StoryStateManager.ts`
  - `tests/story-workflow/StageValidator.test.ts`
  - `tests/story-workflow/StoryStateManager.test.ts`
  - `tests/story-workflow/integration.test.ts`

---

## 2. 验收勾选

| 检查项 | 状态 |
|--------|------|
| allowed next stages 查询能力已定义 | [ ] |
| 结构化错误包含 `allowedNextStages` | [ ] |
| StoryStateManager 已统一复用 validator 语义 | [ ] |
| TDD 顺序覆盖 RED → GREEN → 回归验证 | [ ] |
| 目标测试与文档映射已确认 | [ ] |
