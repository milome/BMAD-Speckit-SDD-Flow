# Runtime Dashboard Cherry-Pick Decision Summary

> 给人审阅的决策版摘要。用于快速决定哪些 commit 直接 cherry-pick，哪些 commit 必须模型手工迁移，以及每个阶段成功的判断标准。

## 核心结论

### 必须同时满足的两条主线

1. `runtime-dashboard-sft` worktree 上最重要的功能增强是：
   - runtime dashboard 可视化
   - canonical / production-grade SFT 导出与 bundle
   这部分尽量按原功能保留，且测试必须通过。

2. 当前 `dev` 分支上最重要的功能主线是：
   - `brief -> prd -> arch -> implement readiness -> speckit_5_2 -> story post audit`
   - provider 提示词辅助与 recommendation 契约
   这部分必须完整保留，不能被 cherry-pick 回退。

### 当前 `dev` 基线（后续冲突的保留前提）

在开始 runtime-dashboard-sft 迁移前，当前 `dev` 已经包含 4 个关键提交：

- `f16e45d` provider-driven recommendation contract
- `9888438` rerun lifecycle and scoring artifacts
- `546f4e0` runner lock heartbeat stability test
- `26c1921` local dashboard artifacts / temp outputs gitignore

后续所有 cherry-pick 或手工 merge，必须把这 4 个提交之后的 `dev` 版本视为基线真相。

### 总体策略

- 低风险 commit：优先直接 cherry-pick。
- 中风险 commit：可以 cherry-pick，但要准备手工解冲突。
- 高风险 commit：不要直接 cherry-pick，必须模型手工迁移。
- 每完成一个 cherry-pick 或手工 merge 小里程碑，跑完该步验证后必须立即 commit，再进入下一步。

---

## Commit 分级

### A. 可直接 cherry-pick

- `8c751b5` 打通 runtime dashboard 与 canonical SFT CLI 链路
- `aa6f36a` scoring-sft canonical sample / exporters / redaction / bundle flow
- `39a05aa` runtime MCP selection schema 与参考文档

这些 commit 主要是新增文件或局部增强，对当前治理主线重叠较小。

### B. 可 cherry-pick，但需准备手工解冲突

- `e1bc31e` runtime / canonical SFT schemas
- `446d19a` runtime event store / projection engine
- `772f56d` runtime and score event emission
- `1b79abd` fixture manifest / warning guards / live tests
- `5d67970` runtime query / snapshot / MCP / live UI surface
- `b92e2df` dashboard UI 完善与文本溢出修复

这些 commit 会与当前 `dev` 的 package、scoring、dashboard 测试形成局部冲突，但总体可控。

### C. 建议手工迁移，不建议直接 cherry-pick

- `438d332` runtime-hooks: capture canonical tool trace sidecars
- `90e9dd2` runtime-cli: wire score, sft preview bundle, and end-to-end runtime path

这两个 commit 会直接命中当前 `dev` 的核心冲突区：

- `_bmad/claude/hooks/post-tool-use.js`
- `_bmad/cursor/hooks/post-tool-use.js`
- `packages/scoring/orchestrator/parse-and-write.ts`
- `packages/scoring/schema/run-score-schema.json`
- `packages/scoring/writer/types.ts`

此外，以下文件也必须默认以当前 `dev` 基线为 base 手工并入，而不是直接接受 incoming 覆盖：

- `_bmad/claude/hooks/stop.js`
- `_bmad/runtime/hooks/run-bmad-runtime-worker.js`
- `scripts/governance-remediation-runner.ts`
- `scripts/prompt-routing-governance.ts`
- `scripts/governance-provider-adapter.ts`

如果直接 cherry-pick，最容易把现有治理主线覆盖坏。

---

## 推荐执行顺序

### 阶段 1：runtime / schema 基础层

顺序：

1. `e1bc31e`
2. `446d19a`
3. `772f56d`

目标：把 runtime event / projection / schema / emission 基础层搭起来。

### 阶段 2：dashboard / SFT 主功能层

顺序：

4. `8c751b5`
5. `5d67970`
6. `aa6f36a`
7. `39a05aa`
8. `b92e2df`

目标：把 dashboard、runtime query、snapshot、MCP、UI、SFT exporter / bundle / preview 打通。

### 阶段 3：fixture / test 对齐层

顺序：

9. `1b79abd`

目标：把 fixture 和 live / mcp / dashboard 测试体系统一。

### 阶段 4：高风险手工迁移层

顺序：

10. `438d332` 手工迁移
11. `90e9dd2` 手工迁移

目标：仅吸收 tool trace sidecar 与 runtime-cli / score / SFT preview bundle 所需的高风险增强，不回退治理主线。

---

## 冲突决策归属

### 保留 `dev` 的部分

- governance rerun queue
- detached background worker
- stop hook / post-tool-use hook 的治理主链路
- provider recommendation / prompt-routing / remediation runner / runner summary
- scoring rerun history / remediation audit trace / journey contract propagation

### 保留 `worktree` 的部分

- runtime dashboard schema / event store / projection engine
- dashboard runtime query / snapshot / MCP / live UI / UI overflow fix
- canonical SFT schemas、candidate builder、exporters、bundle/preview/validate
- runtime-cli 与 SFT dashboard 相关 CLI 能力

### 必须混合合并的文件

- `_bmad/claude/hooks/post-tool-use.js`
- `_bmad/cursor/hooks/post-tool-use.js`
- `packages/scoring/orchestrator/parse-and-write.ts`
- `packages/scoring/schema/run-score-schema.json`
- `packages/scoring/writer/types.ts`
- `package.json`
- `package-lock.json`

---

## 最小验证矩阵

### 阶段 1 后

```bash
npx vitest run tests/acceptance/runtime-dashboard-schema-contract.test.ts
npx vitest run packages/scoring/runtime/__tests__/event-store.test.ts
npx vitest run packages/scoring/runtime/__tests__/projection.test.ts
npx vitest run tests/acceptance/runtime-dashboard-event-wiring.test.ts
npx vitest run tests/acceptance/runtime-dashboard-score-projection.test.ts
```

### 阶段 2 后

```bash
npx vitest run packages/scoring/dashboard
npx vitest run packages/scoring/analytics
npx vitest run tests/acceptance/runtime-dashboard-live-api.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-server.test.ts
npx vitest run tests/acceptance/runtime-dashboard-mcp-server.test.ts
npx vitest run tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts
npx vitest run tests/acceptance/runtime-dashboard-sft-tab.test.ts
```

### 阶段 3 后

```bash
npx vitest run tests/acceptance/runtime-dashboard-fixture-contract.test.ts
```

### 阶段 4 后

```bash
npx vitest run tests/acceptance/runtime-tool-trace-capture.test.ts
npx vitest run packages/scoring/orchestrator/__tests__/tool-trace.test.ts
npx vitest run tests/acceptance/runtime-cli-e2e-smoke.test.ts
npx vitest run tests/acceptance/governance-post-tool-use-background-worker.test.ts
npx vitest run tests/acceptance/governance-post-tool-use-hook.test.ts
```

### 最终确认

```bash
npm run test:ci
```

---

## 直接可用的建议

### 如果目标是最低风险迁移

先只处理：

- `e1bc31e`
- `446d19a`
- `772f56d`
- `8c751b5`
- `5d67970`
- `aa6f36a`
- `39a05aa`

把 `438d332`、`90e9dd2` 暂时拆成手工迁移任务，不要同一轮混进来。

### 如果目标是完整迁移

就按 `runtime-dashboard-cherry-pick-checklist.md` 执行，并在最后两步启用模型手工合并。

---

## 与详细执行版的关系

- 这份文档用于人快速决策。
- 详细逐 commit 执行和高风险逐文件提示词模板，见：
  - `docs/plans/runtime-dashboard-cherry-pick-execution-playbook.md`
  - `docs/plans/runtime-dashboard-cherry-pick-checklist.md`

---

*生成时间: 2026-03-30*  
*用途: 审阅与决策，不直接用于逐文件操作。*
