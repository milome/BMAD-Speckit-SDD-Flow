# Runtime Dashboard CI Green Requirement

## Goal

将当前分支修复到 `npm run test:ci` 全绿，并在此基础上把 runtime-dashboard cherry-pick 的两份审计文档更新为最终闭环版。

## Deliverable

1. 修复当前阻塞整仓 CI 的失败点。
2. 让 `npm run test:ci` 全绿。
3. 更新以下两份文档到最终闭环状态：
   - `docs/plans/2026-03-31-runtime-dashboard-cherry-pick-progress-audit.md`
   - `docs/plans/2026-03-31-runtime-dashboard-cherry-pick-remaining-worklist.md`

## Constraints

1. 继续留在当前 `dev` 分支上工作。
2. 只修当前 `test:ci` 的真实失败项，不扩展新功能范围。
3. 不回退当前已跑绿的 runtime-dashboard / governance / UI smoke 主链。
4. 文档更新必须反映真实最终结果，不能粉饰失败或省略 residual risk。

## Acceptance Criteria

1. `npm run test:ci` 返回码为 `0`。
2. 本轮修复后，runtime-dashboard cherry-pick 主线仍保持：
   - runtime/dashboard/analytics 主矩阵通过
   - governance extended 通过
   - UI smoke 通过
3. 两份审计文档更新为最终闭环版，明确说明：
   - 当前已完成项
   - 真实验证命令与结果
   - 若仍有 residual risk，仅保留非阻断项

## Known Failing Points At Start

当前已知阻塞 `npm run test:ci` 的失败点：

1. `tests/acceptance/runtime-dashboard-sft-tab.test.ts` 超时
2. `tests/acceptance/sft-dataset-cli-regression.test.ts` 失败
3. `packages/scoring/orchestrator/__tests__/parse-and-write.test.ts` 中 `arch` case 超时
4. `packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts` 首个 case 超时

## Non-goals

1. 本轮不新增新的 cherry-pick 范围。
2. 本轮不重构整套 dashboard 前端实现。
