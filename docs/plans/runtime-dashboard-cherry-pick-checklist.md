# Runtime Dashboard Cherry-Pick Checklist

> 给模型直接执行的极简版操作单。只保留顺序、命令、冲突归属、验证要求。

## 0. 预处理

```bash
git checkout dev
git status
git checkout -b chore/runtime-dashboard-cherry-pick
git stash push -u -m "pre-runtime-dashboard-cherry-pick"
```

当前 `dev` 基线（必须保留）：

- `f16e45d` provider-driven recommendation contract
- `9888438` rerun lifecycle and scoring artifacts
- `546f4e0` runner lock heartbeat stability test
- `26c1921` local dashboard artifacts / temp outputs gitignore

后续凡是命中治理主线文件，必须以这 4 个提交后的 `dev` 版本为 base 手工并入。

里程碑提交铁律：

- 每处理完一个 commit 或一个高风险手工 merge 小里程碑，必须：
  - 跑完该节最小验证
  - 测试全绿
  - 立即 commit
  - 再开始下一节

冲突总原则：

- 保留 `dev`：gates loop、provider recommendation、rerun queue、stop/background worker、governance summary。
- 保留 `worktree`：runtime dashboard、runtime event store/projection、canonical SFT、dashboard UI、runtime MCP。
- 混合：`parse-and-write.ts`、`run-score-schema.json`、`writer/types.ts`、hooks、`package.json`、`package-lock.json`。

必须以当前 `dev` 基线为 base 的核心文件：

- `_bmad/claude/hooks/post-tool-use.js`
- `_bmad/claude/hooks/stop.js`
- `_bmad/cursor/hooks/post-tool-use.js`
- `_bmad/runtime/hooks/run-bmad-runtime-worker.js`
- `scripts/governance-remediation-runner.ts`
- `scripts/prompt-routing-governance.ts`
- `packages/scoring/orchestrator/parse-and-write.ts`
- `packages/scoring/schema/run-score-schema.json`
- `packages/scoring/writer/types.ts`

---

## 1. `e1bc31e`

方式：直接 `cherry-pick`

```bash
git show e1bc31e -- packages/scoring/schema/canonical-sft-sample.schema.json packages/scoring/schema/dataset-bundle-manifest.schema.json packages/scoring/runtime/schema/runtime-event.schema.json packages/scoring/runtime/schema/runtime-run-projection.schema.json packages/scoring/runtime/types.ts packages/scoring/analytics/types.ts packages/scoring/package.json tests/acceptance/runtime-dashboard-schema-contract.test.ts packages/scoring/__tests__/canonical-sft-schema.test.ts
git cherry-pick e1bc31e
npx vitest run tests/acceptance/runtime-dashboard-schema-contract.test.ts
npx vitest run packages/scoring/__tests__/canonical-sft-schema.test.ts
```

---

## 2. `446d19a`

方式：直接 `cherry-pick`

```bash
git show 446d19a -- packages/scoring/runtime/event-store.ts packages/scoring/runtime/projection.ts packages/scoring/runtime/path.ts packages/scoring/runtime/index.ts packages/scoring/runtime/__tests__/event-store.test.ts packages/scoring/runtime/__tests__/projection.test.ts packages/scoring/package.json
git cherry-pick 446d19a
npx vitest run packages/scoring/runtime/__tests__/event-store.test.ts
npx vitest run packages/scoring/runtime/__tests__/projection.test.ts
```

---

## 3. `772f56d`

方式：可 cherry-pick；若 `parse-and-write.ts` 冲突，手工合并

```bash
git show 772f56d -- packages/runtime-context/src/cli.ts packages/scoring/orchestrator/parse-and-write.ts tests/acceptance/runtime-dashboard-event-wiring.test.ts tests/acceptance/runtime-dashboard-score-projection.test.ts
git cherry-pick 772f56d
```

冲突时：

- 保留 `dev` 中 governance rerun history / remediation trace / runner summary 逻辑
- 增量吸收 runtime event emission

验证：

```bash
npx vitest run tests/acceptance/runtime-dashboard-event-wiring.test.ts
npx vitest run tests/acceptance/runtime-dashboard-score-projection.test.ts
```

---

## 4. `8c751b5`

方式：直接 `cherry-pick`

```bash
git show 8c751b5 -- packages/bmad-speckit/bin/bmad-speckit.js packages/bmad-speckit/src/commands/dashboard-live.js packages/bmad-speckit/src/commands/dashboard.js packages/bmad-speckit/src/commands/runtime-mcp.js packages/bmad-speckit/src/commands/sft-bundle.js packages/bmad-speckit/src/commands/sft-extract.js packages/bmad-speckit/src/commands/sft-preview.js packages/bmad-speckit/src/commands/sft-validate.js packages/bmad-speckit/src/runtime-client.js packages/bmad-speckit/tests/runtime-client.test.js packages/bmad-speckit/tests/sft-bundle.test.js packages/bmad-speckit/tests/sft-preview.test.js docs/how-to/runtime-dashboard.md docs/how-to/training-ready-sft-export.md
git cherry-pick 8c751b5
npx vitest run packages/bmad-speckit/tests/runtime-client.test.js
npx vitest run packages/bmad-speckit/tests/sft-bundle.test.js
npx vitest run packages/bmad-speckit/tests/sft-preview.test.js
```

---

## 5. `1b79abd`

方式：可 cherry-pick；live-api / live-server 测试冲突时手工合并

```bash
git show 1b79abd -- tests/helpers/runtime-dashboard-fixture-manifest.ts tests/helpers/runtime-dashboard-fixture.ts tests/acceptance/runtime-dashboard-fixture-contract.test.ts tests/acceptance/runtime-dashboard-live-api.test.ts tests/acceptance/runtime-dashboard-live-server.test.ts tests/acceptance/runtime-dashboard-mcp-fallback.test.ts tests/acceptance/runtime-dashboard-mcp-server.test.ts packages/runtime-context/src/context.ts docs/reference/test-fixture-conventions.md
git cherry-pick 1b79abd
npx vitest run tests/acceptance/runtime-dashboard-fixture-contract.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-api.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-server.test.ts
```

---

## 6. `5d67970`

方式：可 cherry-pick

```bash
git show 5d67970 -- packages/scoring/dashboard/runtime-query.ts packages/scoring/dashboard/snapshot.ts packages/scoring/dashboard/mcp-server.ts packages/scoring/dashboard/ui/app.js packages/scoring/dashboard/__tests__/runtime-query.test.ts packages/scoring/dashboard/__tests__/mcp-server.test.ts tests/acceptance/integration/dashboard-runtime-snapshot.test.ts
git cherry-pick 5d67970
npx vitest run packages/scoring/dashboard/__tests__/runtime-query.test.ts
npx vitest run packages/scoring/dashboard/__tests__/mcp-server.test.ts
npx vitest run tests/acceptance/integration/dashboard-runtime-snapshot.test.ts
```

---

## 7. `aa6f36a`

方式：直接 `cherry-pick`

```bash
git show aa6f36a -- packages/scoring/analytics
git cherry-pick aa6f36a
npx vitest run packages/scoring/analytics
```

---

## 8. `438d332`

方式：手工迁移，不直接 cherry-pick

```bash
git show 438d332 -- _bmad/claude/hooks/post-tool-use.js _bmad/cursor/hooks/post-tool-use.js _bmad/runtime/hooks/post-tool-use-core.js scripts/init-to-root.js tests/acceptance/runtime-tool-trace-capture.test.ts tests/fixtures/cursor-post-tool-use-real.stdin.json tests/fixtures/cursor-post-tool-use-real-redacted.stdin.json tests/fixtures/cursor-post-tool-use-real-blocked.stdin.json
```

只迁移：tool trace sidecar capture。

不能覆盖：`dev` 的 rerun queue / background drain / governancePresentation / executorRouting / journeyContractHints。

验证：

```bash
npx vitest run tests/acceptance/runtime-tool-trace-capture.test.ts
npx vitest run tests/acceptance/governance-post-tool-use-background-worker.test.ts
npx vitest run tests/acceptance/governance-post-tool-use-hook.test.ts
```

---

## 9. `90e9dd2`

方式：手工迁移，不直接 cherry-pick

```bash
git show 90e9dd2 -- packages/bmad-speckit/bin/bmad-speckit.js packages/bmad-speckit/src/commands/score.js packages/bmad-speckit/src/services/sync-service.js packages/scoring/orchestrator/parse-and-write.ts packages/scoring/schema/run-score-schema.json packages/scoring/writer/types.ts packages/scoring/orchestrator/__tests__/tool-trace.test.ts tests/acceptance/runtime-cli-e2e-smoke.test.ts tests/acceptance/runtime-dashboard-sft-tab.test.ts
```

只迁移：runtime-cli / score / SFT preview bundle / tool trace / runtime path 所需能力。

不能覆盖：`dev` 的 governance rerun history、runner summary、remediation trace、provider recommendation 数据面。

验证：

```bash
npx vitest run packages/scoring/orchestrator/__tests__/tool-trace.test.ts
npx vitest run tests/acceptance/runtime-cli-e2e-smoke.test.ts
npx vitest run tests/acceptance/runtime-dashboard-sft-tab.test.ts
```

---

## 10. `39a05aa`

方式：直接 `cherry-pick`

```bash
git show 39a05aa -- packages/scoring/dashboard/mcp-server.ts tests/acceptance/runtime-dashboard-mcp-server.test.ts docs/reference/runtime-dashboard.md docs/how-to/guide-index.md
git cherry-pick 39a05aa
npx vitest run tests/acceptance/runtime-dashboard-mcp-server.test.ts
```

---

## 11. `b92e2df`

方式：可 cherry-pick；`package.json` / `package-lock.json` / dashboard UI 冲突时手工合并

```bash
git show b92e2df -- package.json package-lock.json packages/scoring/dashboard/live-server.ts packages/scoring/dashboard/runtime-query.ts packages/scoring/dashboard/snapshot.ts packages/scoring/dashboard/ui/app.js packages/scoring/dashboard/ui/index.html packages/scoring/dashboard/ui/src/main.jsx packages/scoring/dashboard/ui/src/styles.css packages/scoring/dashboard/ui/styles.css scripts/start-dashboard.ts tests/acceptance/runtime-dashboard-live-api.test.ts tests/acceptance/runtime-dashboard-live-server.test.ts tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts tests/acceptance/runtime-dashboard-sft-tab.test.ts
git cherry-pick b92e2df
```

验证：

```bash
npx vitest run tests/acceptance/runtime-dashboard-live-api.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-server.test.ts
npx vitest run tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts
```

---

## 12. 最终验证

```bash
npx vitest run packages/scoring/runtime packages/scoring/dashboard packages/scoring/analytics
npx vitest run tests/acceptance/runtime-dashboard-*.test.ts
npx vitest run tests/acceptance/governance-*.test.ts
npx vitest run tests/acceptance/runtime-cli-e2e-smoke.test.ts
npm run test:ci
```
