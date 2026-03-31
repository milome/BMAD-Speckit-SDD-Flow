# Runtime Dashboard P1-2 Requirement

## Goal

对 runtime-dashboard cherry-pick 当前收口状态执行最终验证矩阵，确认当前分支已经具备宣称“runtime-dashboard cherry-pick 主线收口”的证据，并将结果回写到两份审计文档。

## Deliverable

1. 执行 runtime dashboard / SFT / governance 主线的最终矩阵。
2. 形成一份基于真实执行结果的收口结论。
3. 回写以下两份文档：
   - `docs/plans/2026-03-31-runtime-dashboard-cherry-pick-progress-audit.md`
   - `docs/plans/2026-03-31-runtime-dashboard-cherry-pick-remaining-worklist.md`

## Constraints

1. 不引入新的功能改动，除非是为跑通最终矩阵所必需的小修复。
2. 不回退当前 `dev` 的治理主线能力。
3. 不隐藏失败项；若最终矩阵有未通过项，必须真实记录。

## Acceptance Criteria

1. 至少执行以下矩阵：

```powershell
npx vitest run packages/scoring/runtime packages/scoring/dashboard packages/scoring/analytics
npx vitest run tests/acceptance/runtime-dashboard-*.test.ts
npx vitest run tests/acceptance/runtime-cli-e2e-smoke.test.ts
npx vitest run tests/acceptance/governance-*.test.ts
npm run test:runtime-dashboard-ui-smoke
```

2. 两份审计文档更新为“收口状态”，包含：
   - 已完成项
   - 若仍有残余项，则注明
   - 本轮真实验证命令与结果摘要

## Non-goals

1. 本轮不再开启新的功能范围。
2. 本轮不再新增新的迁移目标，只做收口验证与审计回写。
