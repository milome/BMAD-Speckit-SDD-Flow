# Runtime Dashboard UI P1-1 Requirement

## Goal

按 `docs/plans/runtime-dashboard-cherry-pick-execution-playbook.md` 中 `b92e2df` 的目标结构，补迁当前 runtime dashboard 的 UI 层，把现有静态 `index.html + app.js + styles.css` 服务面收口到计划中的 React + Tailwind 风格 UI 结构，并补齐启动入口与 smoke 测试。

## Deliverable

交付以下结果：

1. 当前分支具备 `b92e2df` 目标中的 UI 结构资产：
   - `packages/scoring/dashboard/ui/src/main.jsx`
   - `packages/scoring/dashboard/ui/src/styles.css`
   - 以及与现有 live server 可兼容的 `ui/index.html` / `ui/app.js` / `ui/styles.css`
2. 补齐 dashboard 启动入口：
   - `scripts/start-dashboard.ts`
3. 补齐 UI smoke 测试：
   - `tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts`
4. 保证以下链路继续可用：
   - live api
   - live server
   - sft tab
   - 现有治理主线

## Constraints

1. 不回退当前 `dev` 上的治理能力：
   - provider recommendation
   - rerun lifecycle
   - background worker / stop hook
   - governance summary / remediation trace
2. 不得破坏当前已经通过的 runtime dashboard 相关测试。
3. 如果 `b92e2df` 中的 React/Tailwind 源码结构与当前静态 server 之间存在构建差异，允许采用“兼容落地”方式：
   - 保留可运行的 `ui/index.html` / `ui/app.js` / `ui/styles.css`
   - 同时补上 `ui/src/*` 作为源码层 truth source
4. 页面是否完全使用 React 打包产物，不作为本轮唯一目标；本轮重点是：
   - 结构补齐
   - 启动入口补齐
   - smoke 测试补齐
   - 页面可访问、可验证

## Acceptance Criteria

### Functional

1. `packages/scoring/dashboard/ui/src/main.jsx` 存在。
2. `packages/scoring/dashboard/ui/src/styles.css` 存在。
3. `scripts/start-dashboard.ts` 存在并可启动 dashboard server。
4. `tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts` 存在并通过。
5. live server 启动后，可通过浏览器访问页面并看到 Runtime Dashboard UI。

### Verification

至少通过以下验证：

```powershell
npx vitest run tests/acceptance/runtime-dashboard-live-api.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-server.test.ts
npx vitest run tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts
npx vitest run tests/acceptance/runtime-dashboard-sft-tab.test.ts
```

## Non-goals

1. 本轮不处理 `438d332` / `90e9dd2` 之外的其它高风险手工迁移尾项。
2. 本轮不重做整个 dashboard query / snapshot / MCP 架构。
3. 本轮不强制把整个 dashboard 切换到完整前端构建流水线；只要结构、入口、页面和 smoke 可验证即可。

## Assumptions

1. 当前静态版 UI 已可跑，因此可以作为兼容基线。
2. `b92e2df` 的价值主要在于：
   - React + Tailwind 源码结构
   - 文本溢出修复
   - start-dashboard 入口
   - Playwright smoke
3. 如果 `b92e2df` 的源码层和当前实现无法完全 1:1 合并，优先保留当前可运行能力，再补源码层与测试层。
