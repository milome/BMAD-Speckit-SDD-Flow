# Runtime Dashboard Cherry-Pick Execution Playbook

> **Current path**: `runAuditorHost`
> **Legacy path**: `bmad-speckit score` / `parse-and-write-score`

> 这是一份给模型直接执行的迁移操作单，不是摘要文档。目标是把 `runtime-dashboard-sft` worktree 的 runtime dashboard / SFT / runtime MCP 能力安全迁移到当前 `dev`，同时不破坏 `dev` 已经形成的治理主线。

核心约束：

1. worktree 上最重要的能力增强是 `SFT` 的生产级增强与 `dashboard` 可视化，这部分要尽量完整保留，测试必须通过。
2. `dev` 上最重要的主线能力是：`brief -> prd -> arch -> implement readiness -> speckit_5_2 -> story post audit` 的全链路 gates loop，以及 provider 提示词辅助功能，这部分不能回退。
3. 对 hooks / queue / remediation runner / scoring schema 的重叠修改，禁止简单覆盖；必须做模型主导的手工合并。

---

## 0. 使用方式

## 0.0 当前 dev 基线（后续所有迁移的保留前提）

在执行 `runtime-dashboard-sft` 的任何 cherry-pick 之前，当前 `dev` 已经完成并提交了 4 个基线提交。这 4 个提交不是待迁移对象，而是后续所有冲突判断的起点。

### 已完成提交

1. `f16e45d` `feat(governance): add provider-driven recommendation contract`
2. `9888438` `feat(governance): wire rerun lifecycle and scoring artifacts`
3. `546f4e0` `test(governance): cover runner lock heartbeat stability`
4. `26c1921` `chore(gitignore): ignore local dashboard artifacts and temp outputs`

### 这些提交的保留含义

- provider recommendation 契约、artifact / runner / presenter 输出链路已在 `dev` 上稳定。
- remediation runner、runtime worker、stop hook、background worker、scoring rerun history、journey contract remediation 已在 `dev` 上稳定。
- runner lock heartbeat 的稳定性测试已补齐。
- 本地产物已经通过 `.gitignore` 隔离。

### 后续迁移硬规则

- 后续所有 cherry-pick / 手工 merge 都不能回退上述 4 个提交形成的能力。
- 如果 incoming commit 触及这些能力相关文件，必须以“这 4 个提交之后的 `dev` 版本”为 base 做手工并入。

### 0.1 执行模式

按 commit 顺序处理，每次只做一个 commit：

1. 读取本节列出的 `git show` 文件清单
2. 判断该 commit 用 `cherry-pick` 还是“手工迁移”
3. 处理冲突或手工抄入变更
4. 跑本节列出的最小验证
5. 最小验证通过后，必须立即提交一个 milestone commit
6. 提交完成后，才能进入下一个 commit / 下一个阶段

### 0.1.1 里程碑提交铁律

每完成一个 cherry-pick 或一个手工 merge 小里程碑，都必须执行：

1. 跑完该节对应的最小验证矩阵
2. 确认测试全绿
3. 立刻提交当前结果
4. 再开始下一阶段或下一个 commit

禁止：

- 连续 cherry-pick 多个 commit 后再统一提交
- 多个高风险 merge 混在一个未提交工作区里一起解
- 测试未绿就继续下一个 commit

### 0.2 预处理命令

```bash
git checkout dev
git status

# 可选：在专门迁移分支执行
git checkout -b chore/runtime-dashboard-cherry-pick

# 如有未提交改动，先处理或 stash
git stash push -u -m "pre-runtime-dashboard-cherry-pick"
```

### 0.2.1 每个里程碑提交命令模板

```bash
git status
git add <本里程碑涉及文件>
git commit -m "feat(runtime-dashboard): <本里程碑摘要>"
```

如果是测试 / fixture / docs 型里程碑：

```bash
git commit -m "test(runtime-dashboard): <本里程碑摘要>"
git commit -m "docs(runtime-dashboard): <本里程碑摘要>"
```

### 0.3 冲突归属总原则

- `dev` 优先保留：
  - provider recommendation / prompt-routing / remediation runner / rerun queue / stop hook / background worker
  - 全链路 gate loop
  - governance summary / scoring rerun history / remediation audit trace
- `worktree` 优先保留：
  - runtime dashboard schema / event store / query / snapshot / mcp-server / live server / UI
  - canonical SFT schema / exporter / bundle / preview / validate
- 混合合并：
  - `packages/scoring/orchestrator/parse-and-write.ts`
  - `packages/scoring/schema/run-score-schema.json`
  - `packages/scoring/writer/types.ts`
  - `_bmad/claude/hooks/post-tool-use.js`
  - `_bmad/cursor/hooks/post-tool-use.js`
  - `package.json` / `package-lock.json`

### 0.4 后续 cherry-pick 必须以当前 dev 基线为 base 的文件

以下文件如果在 worktree commit 中出现，默认处理方式不是“直接取 incoming”，而是“以当前 `dev` 为 base 手工并入 runtime-dashboard-sft 所需能力”：

- `_bmad/claude/hooks/post-tool-use.js`
- `_bmad/claude/hooks/stop.js`
- `_bmad/cursor/hooks/post-tool-use.js`
- `_bmad/runtime/hooks/run-bmad-runtime-worker.js`
- `_bmad/runtime/hooks/governance-rerun-queue.js`
- `_bmad/runtime/hooks/governance-runner-summary-format.js`
- `_bmad/runtime/hooks/governance-runner-summary-presenter.js`
- `scripts/governance-provider-adapter.ts`
- `scripts/governance-remediation-artifact.ts`
- `scripts/governance-remediation-config.ts`
- `scripts/governance-remediation-runner.ts`
- `scripts/governance-runtime-queue.ts`
- `scripts/model-governance-hints-schema.ts`
- `scripts/model-governance-policy-filter.ts`
- `scripts/prompt-routing-governance.ts`
- `scripts/prompt-routing-hints-schema.ts`
- `scripts/execution-intent-schema.ts`
- `scripts/governance-hook-types.ts`
- `scripts/skill-inventory-provider.ts`
- `scripts/skill-semantic-features-config.ts`
- `scripts/bmad-runtime-worker.ts`
- `packages/scoring/orchestrator/parse-and-write.ts`
- `packages/scoring/schema/run-score-schema.json`
- `packages/scoring/writer/types.ts`
- 所有 `tests/acceptance/governance-*.test.ts`
- `tests/acceptance/model-governance-policy-filter.test.ts`
- `tests/acceptance/prompt-routing-governance.test.ts`
- `tests/acceptance/skill-inventory-provider.test.ts`

判断规则：

- 如果该文件属于当前 `dev` 治理主线，incoming 只能“增量并入”，不能整体覆盖。
- 只有当 incoming diff 明确是纯新增、且不会改变治理行为时，才允许接近原样迁入。

---

## 1. Commit `e1bc31e`

### 1.1 基本信息

- Message: `feat: add runtime and canonical SFT schemas`
- 建议方式：`可直接 cherry-pick，若 package.json 冲突则手工解冲突`
- 风险等级：中

### 1.2 git show 文件清单

```bash
git show e1bc31e -- packages/scoring/__tests__/canonical-sft-schema.test.ts
git show e1bc31e -- packages/scoring/schema/canonical-sft-sample.schema.json
git show e1bc31e -- packages/scoring/schema/dataset-bundle-manifest.schema.json
git show e1bc31e -- packages/scoring/analytics/types.ts
git show e1bc31e -- packages/scoring/package.json
git show e1bc31e -- packages/scoring/runtime/schema/runtime-event.schema.json
git show e1bc31e -- packages/scoring/runtime/schema/runtime-run-projection.schema.json
git show e1bc31e -- packages/scoring/runtime/types.ts
git show e1bc31e -- tests/acceptance/runtime-dashboard-schema-contract.test.ts
```

### 1.3 预期保留点

- 新增 `canonical SFT` schema 与样例 schema
- 新增 `runtime event` / `runtime run projection` schema
- `packages/scoring/analytics/types.ts` 中与 runtime dashboard / SFT 对应的类型增强
- schema contract acceptance 测试

### 1.4 冲突处理指令

如果 `packages/scoring/package.json` 冲突：

- 保留 `dev` 现有脚本和依赖
- 仅增量加入 runtime schema / SFT schema 所需依赖
- 不删除 `dev` 为 governance / scoring 已加的脚本与依赖

### 1.5 最小验证

```bash
git cherry-pick e1bc31e
npx vitest run tests/acceptance/runtime-dashboard-schema-contract.test.ts
npx vitest run packages/scoring/__tests__/canonical-sft-schema.test.ts
```

### 1.6 执行后状态检查清单

- `packages/scoring/schema/` 下新增 schema 文件已经存在且被引用。
- `packages/scoring/runtime/types.ts` 与 `packages/scoring/analytics/types.ts` 类型定义没有出现断裂。
- `packages/scoring/package.json` 没有删除当前 `dev` 已有依赖或脚本。
- `tests/acceptance/runtime-dashboard-schema-contract.test.ts` 通过。
- `packages/scoring/__tests__/canonical-sft-schema.test.ts` 通过。

### 1.7 本节完成后必须提交

建议 commit message：

```bash
git add packages/scoring/schema/canonical-sft-sample.schema.json packages/scoring/schema/dataset-bundle-manifest.schema.json packages/scoring/runtime/schema/runtime-event.schema.json packages/scoring/runtime/schema/runtime-run-projection.schema.json packages/scoring/runtime/types.ts packages/scoring/analytics/types.ts packages/scoring/package.json tests/acceptance/runtime-dashboard-schema-contract.test.ts packages/scoring/__tests__/canonical-sft-schema.test.ts
git commit -m "feat(runtime): add runtime and canonical sft schemas"
```

---

## 2. Commit `446d19a`

### 2.1 基本信息

- Message: `feat: add runtime event store and projection engine`
- 建议方式：`可直接 cherry-pick，若 package.json 冲突则手工解冲突`
- 风险等级：中

### 2.2 git show 文件清单

```bash
git show 446d19a -- packages/scoring/package.json
git show 446d19a -- packages/scoring/runtime/__tests__/event-store.test.ts
git show 446d19a -- packages/scoring/runtime/__tests__/projection.test.ts
git show 446d19a -- packages/scoring/runtime/event-store.ts
git show 446d19a -- packages/scoring/runtime/index.ts
git show 446d19a -- packages/scoring/runtime/path.ts
git show 446d19a -- packages/scoring/runtime/projection.ts
```

### 2.3 预期保留点

- runtime event store 基础实现
- runtime projection engine
- runtime 包导出入口
- event-store / projection 单测

### 2.4 冲突处理指令

- `packages/scoring/runtime/*` 目录如当前 `dev` 未修改，优先保留 incoming
- `package.json` 只做依赖增量合并

### 2.5 最小验证

```bash
git cherry-pick 446d19a
npx vitest run packages/scoring/runtime/__tests__/event-store.test.ts
npx vitest run packages/scoring/runtime/__tests__/projection.test.ts
```

### 2.6 执行后状态检查清单

- `packages/scoring/runtime/event-store.ts`、`projection.ts`、`index.ts` 都已落地。
- event store 与 projection 测试均通过。
- `packages/scoring/package.json` 依赖未回退。
- runtime 目录没有出现仅 schema 存在、实现缺失的半完成状态。

### 2.7 本节完成后必须提交

建议 commit message：

```bash
git add packages/scoring/runtime/event-store.ts packages/scoring/runtime/projection.ts packages/scoring/runtime/path.ts packages/scoring/runtime/index.ts packages/scoring/runtime/__tests__/event-store.test.ts packages/scoring/runtime/__tests__/projection.test.ts packages/scoring/package.json
git commit -m "feat(runtime): add runtime event store and projection engine"
```

---

## 3. Commit `772f56d`

### 3.1 基本信息

- Message: `feat: wire runtime and score event emission`
- 建议方式：`可 cherry-pick，但 parse-and-write.ts 出现冲突时必须手工合并`
- 风险等级：中

### 3.2 git show 文件清单

```bash
git show 772f56d -- packages/runtime-context/src/cli.ts
git show 772f56d -- packages/scoring/orchestrator/parse-and-write.ts
git show 772f56d -- tests/acceptance/runtime-dashboard-event-wiring.test.ts
git show 772f56d -- tests/acceptance/runtime-dashboard-score-projection.test.ts
```

### 3.3 预期保留点

- runtime-context CLI 能写出 runtime event 所需上下文
- score write / parse-and-write 能向 runtime projection 发事件
- event wiring / score projection acceptance 测试

### 3.4 冲突处理指令

对 `packages/scoring/orchestrator/parse-and-write.ts`：

- 保留 `dev` 当前已有的 governance rerun history / remediation audit trace / runner summary / journey contract 相关逻辑
- 增量吸收 incoming 的 runtime event emission 逻辑
- 不允许覆盖 `dev` 的 run-score schema 写入字段

### 3.5 最小验证

```bash
git cherry-pick 772f56d
npx vitest run tests/acceptance/runtime-dashboard-event-wiring.test.ts
npx vitest run tests/acceptance/runtime-dashboard-score-projection.test.ts
```

### 3.6 执行后状态检查清单

- `packages/runtime-context/src/cli.ts` 已能产出 runtime event 所需上下文。
- `packages/scoring/orchestrator/parse-and-write.ts` 中，runtime event emission 已接入，但 governance rerun history / remediation trace / runner summary 字段未丢失。
- `runtime-dashboard-event-wiring` 与 `runtime-dashboard-score-projection` 两个 acceptance 通过。
- 任何与 run-score schema 相关的字段改动已经同步到类型层。

### 3.7 本节完成后必须提交

建议 commit message：

```bash
git add packages/runtime-context/src/cli.ts packages/scoring/orchestrator/parse-and-write.ts tests/acceptance/runtime-dashboard-event-wiring.test.ts tests/acceptance/runtime-dashboard-score-projection.test.ts
git commit -m "feat(runtime): wire runtime and score event emission"
```

---

## 4. Commit `8c751b5`

### 4.1 基本信息

- Message: `feat: 打通 runtime dashboard 与 canonical SFT 链路`
- 建议方式：`可直接 cherry-pick`
- 风险等级：低

### 4.2 git show 文件清单

```bash
git show 8c751b5 -- docs/how-to/guide-index.md
git show 8c751b5 -- docs/how-to/runtime-dashboard.md
git show 8c751b5 -- docs/how-to/training-ready-sft-export.md
git show 8c751b5 -- docs/reference/source-code.md
git show 8c751b5 -- docs/reference/speckit-cli.md
git show 8c751b5 -- packages/bmad-speckit/bin/bmad-speckit.js
git show 8c751b5 -- packages/bmad-speckit/src/commands/dashboard-live.js
git show 8c751b5 -- packages/bmad-speckit/src/commands/dashboard.js
git show 8c751b5 -- packages/bmad-speckit/src/commands/init.js
git show 8c751b5 -- packages/bmad-speckit/src/commands/runtime-mcp.js
git show 8c751b5 -- packages/bmad-speckit/src/commands/sft-bundle.js
git show 8c751b5 -- packages/bmad-speckit/src/commands/sft-extract.js
git show 8c751b5 -- packages/bmad-speckit/src/commands/sft-preview.js
git show 8c751b5 -- packages/bmad-speckit/src/commands/sft-validate.js
git show 8c751b5 -- packages/bmad-speckit/src/messages/cli.js
git show 8c751b5 -- packages/bmad-speckit/src/runtime-client.js
git show 8c751b5 -- packages/bmad-speckit/tests/runtime-client.test.js
git show 8c751b5 -- packages/bmad-speckit/tests/sft-bundle.test.js
git show 8c751b5 -- packages/bmad-speckit/tests/sft-preview.test.js
```

### 4.3 预期保留点

- bmad-speckit CLI 增加 dashboard / runtime-mcp / sft-* 命令
- runtime client
- 文档入口与使用说明
- runtime-client / sft-bundle / sft-preview 测试

### 4.4 冲突处理指令

- 若 `packages/bmad-speckit/bin/bmad-speckit.js` 冲突，保留 `dev` 现有命令入口，再把 incoming 的 dashboard / sft 命令增量接入
- 若 `init.js` 冲突，保留 `dev` 当前 init 行为，避免破坏安装链路 acceptance

### 4.5 最小验证

```bash
git cherry-pick 8c751b5
npx vitest run packages/bmad-speckit/tests/runtime-client.test.js
npx vitest run packages/bmad-speckit/tests/sft-bundle.test.js
npx vitest run packages/bmad-speckit/tests/sft-preview.test.js
```

### 4.6 执行后状态检查清单

- `packages/bmad-speckit/bin/bmad-speckit.js` 已暴露 dashboard / runtime-mcp / sft-* 命令。
- `packages/bmad-speckit/src/runtime-client.js` 存在且测试通过。
- 文档页 `docs/how-to/runtime-dashboard.md`、`docs/how-to/training-ready-sft-export.md` 已存在。
- 没有破坏现有 `bmad-speckit` 的 init / version / install 相关行为。

### 4.7 本节完成后必须提交

建议 commit message：

```bash
git add docs/how-to/runtime-dashboard.md docs/how-to/training-ready-sft-export.md docs/how-to/guide-index.md docs/reference/source-code.md docs/reference/speckit-cli.md packages/bmad-speckit/bin/bmad-speckit.js packages/bmad-speckit/src/commands/dashboard-live.js packages/bmad-speckit/src/commands/dashboard.js packages/bmad-speckit/src/commands/runtime-mcp.js packages/bmad-speckit/src/commands/sft-bundle.js packages/bmad-speckit/src/commands/sft-extract.js packages/bmad-speckit/src/commands/sft-preview.js packages/bmad-speckit/src/commands/sft-validate.js packages/bmad-speckit/src/runtime-client.js packages/bmad-speckit/tests/runtime-client.test.js packages/bmad-speckit/tests/sft-bundle.test.js packages/bmad-speckit/tests/sft-preview.test.js
git commit -m "feat(runtime-dashboard): wire dashboard and canonical sft cli surfaces"
```

---

## 5. Commit `1b79abd`

### 5.1 基本信息

- Message: `test(runtime): centralize stage-aligned fixture manifest and warning guards`
- 建议方式：`可 cherry-pick，但 live-api / live-server 测试冲突要手工解`
- 风险等级：中

### 5.2 git show 文件清单

```bash
git show 1b79abd -- docs/reference/test-fixture-conventions.md
git show 1b79abd -- packages/runtime-context/src/context.ts
git show 1b79abd -- packages/scoring/parsers/__tests__/fixtures/sample-implement-report-high-score.md
git show 1b79abd -- tests/acceptance/runtime-dashboard-fixture-contract.test.ts
git show 1b79abd -- tests/acceptance/runtime-dashboard-live-api.test.ts
git show 1b79abd -- tests/acceptance/runtime-dashboard-live-server.test.ts
git show 1b79abd -- tests/acceptance/runtime-dashboard-mcp-fallback.test.ts
git show 1b79abd -- tests/acceptance/runtime-dashboard-mcp-server.test.ts
git show 1b79abd -- tests/helpers/runtime-dashboard-fixture-manifest.ts
git show 1b79abd -- tests/helpers/runtime-dashboard-fixture.ts
```

### 5.3 预期保留点

- fixture manifest / helper 统一
- stage-aligned fixture contract 文档
- runtime dashboard live / mcp 测试统一到新夹具体系

### 5.4 冲突处理指令

- 如果 live-api / live-server 测试已经在 `dev` 上被修改，优先保留 `dev` 中与治理主线相关的等待逻辑和环境修复，再吸收 fixture manifest 层面的增强

### 5.5 最小验证

```bash
git cherry-pick 1b79abd
npx vitest run tests/acceptance/runtime-dashboard-fixture-contract.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-api.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-server.test.ts
```

### 5.6 执行后状态检查清单

- `tests/helpers/runtime-dashboard-fixture-manifest.ts` 与 `tests/helpers/runtime-dashboard-fixture.ts` 已统一。
- `docs/reference/test-fixture-conventions.md` 已生成。
- runtime dashboard live / mcp 测试已经切到新的 fixture 体系并保持通过。
- `packages/runtime-context/src/context.ts` 的变更未影响现有 registry / context 行为。

### 5.7 本节完成后必须提交

建议 commit message：

```bash
git add docs/reference/test-fixture-conventions.md packages/runtime-context/src/context.ts packages/scoring/parsers/__tests__/fixtures/sample-implement-report-high-score.md tests/acceptance/runtime-dashboard-fixture-contract.test.ts tests/acceptance/runtime-dashboard-live-api.test.ts tests/acceptance/runtime-dashboard-live-server.test.ts tests/acceptance/runtime-dashboard-mcp-fallback.test.ts tests/acceptance/runtime-dashboard-mcp-server.test.ts tests/helpers/runtime-dashboard-fixture-manifest.ts tests/helpers/runtime-dashboard-fixture.ts
git commit -m "test(runtime-dashboard): centralize stage-aligned fixture manifest"
```

---

## 6. Commit `5d67970`

### 6.1 基本信息

- Message: `feat(runtime-dashboard): add runtime query, snapshot, mcp, and live ui surfaces`
- 建议方式：`可 cherry-pick，若 dashboard 测试冲突则手工解`
- 风险等级：中

### 6.2 git show 文件清单

```bash
git show 5d67970 -- tests/acceptance/integration/dashboard-runtime-snapshot.test.ts
git show 5d67970 -- packages/scoring/dashboard/__tests__/mcp-server.test.ts
git show 5d67970 -- packages/scoring/dashboard/__tests__/runtime-query.test.ts
git show 5d67970 -- packages/scoring/dashboard/mcp-server.ts
git show 5d67970 -- packages/scoring/dashboard/runtime-query.ts
git show 5d67970 -- packages/scoring/dashboard/snapshot.ts
git show 5d67970 -- packages/scoring/dashboard/ui/app.js
```

### 6.3 预期保留点

- runtime query API
- dashboard snapshot 生成
- runtime MCP server
- dashboard UI surface 的第一版

### 6.4 冲突处理指令

- 对 `packages/scoring/dashboard/*`：优先保留 incoming 的 dashboard 功能实现，但如果 `dev` 已在 dashboard 中加入治理 summary / runtime 额外字段，则要混合保留

### 6.5 最小验证

```bash
git cherry-pick 5d67970
npx vitest run packages/scoring/dashboard/__tests__/runtime-query.test.ts
npx vitest run packages/scoring/dashboard/__tests__/mcp-server.test.ts
npx vitest run tests/acceptance/integration/dashboard-runtime-snapshot.test.ts
```

### 6.6 执行后状态检查清单

- `packages/scoring/dashboard/runtime-query.ts`、`snapshot.ts`、`mcp-server.ts` 已落地。
- dashboard runtime snapshot 集成测试通过。
- `packages/scoring/dashboard/ui/app.js` 中 runtime UI surface 可构建。
- 如果 `dev` 已有 dashboard 治理字段展示，确认没有被覆盖。

### 6.7 本节完成后必须提交

建议 commit message：

```bash
git add packages/scoring/dashboard/runtime-query.ts packages/scoring/dashboard/snapshot.ts packages/scoring/dashboard/mcp-server.ts packages/scoring/dashboard/ui/app.js packages/scoring/dashboard/__tests__/runtime-query.test.ts packages/scoring/dashboard/__tests__/mcp-server.test.ts tests/acceptance/integration/dashboard-runtime-snapshot.test.ts
git commit -m "feat(runtime-dashboard): add runtime query snapshot and mcp surfaces"
```

---

## 7. Commit `aa6f36a`

### 7.1 基本信息

- Message: `feat(scoring-sft): add canonical samples, exporters, redaction, and bundle flow`
- 建议方式：`可直接 cherry-pick`
- 风险等级：低

### 7.2 git show 文件清单

```bash
git show aa6f36a -- packages/scoring/analytics/__tests__/bundle-writer.test.ts
git show aa6f36a -- packages/scoring/analytics/__tests__/candidate-builder-chunking.test.ts
git show aa6f36a -- packages/scoring/analytics/__tests__/candidate-builder-tool-trace.test.ts
git show aa6f36a -- packages/scoring/analytics/__tests__/candidate-builder.test.ts
git show aa6f36a -- packages/scoring/analytics/__tests__/hf-conversational-export.test.ts
git show aa6f36a -- packages/scoring/analytics/__tests__/hf-tool-calling-export.test.ts
git show aa6f36a -- packages/scoring/analytics/__tests__/openai-chat-export.test.ts
git show aa6f36a -- packages/scoring/analytics/__tests__/quality-gates.test.ts
git show aa6f36a -- packages/scoring/analytics/__tests__/redaction.test.ts
git show aa6f36a -- packages/scoring/analytics/bundle-writer.ts
git show aa6f36a -- packages/scoring/analytics/candidate-builder.ts
git show aa6f36a -- packages/scoring/analytics/canonical-sample.ts
git show aa6f36a -- packages/scoring/analytics/exporters/hf-conversational.ts
git show aa6f36a -- packages/scoring/analytics/exporters/hf-tool-calling.ts
git show aa6f36a -- packages/scoring/analytics/exporters/openai-chat.ts
git show aa6f36a -- packages/scoring/analytics/quality-gates.ts
git show aa6f36a -- packages/scoring/analytics/redaction.ts
git show aa6f36a -- packages/scoring/analytics/sft-extractor.ts
git show aa6f36a -- packages/scoring/analytics/tool-trace.ts
```

### 7.3 预期保留点

- canonical sample builder
- tool trace / chunking / exporter / redaction / quality gates / bundle writer
- 对应 analytics 测试

### 7.4 冲突处理指令

- analytics 目录若无重叠，优先完整接入 incoming
- 如 `dev` 已对 analytics 新增治理统计能力，确保两者类型导出不冲突

### 7.5 最小验证

```bash
git cherry-pick aa6f36a
npx vitest run packages/scoring/analytics
```

### 7.6 执行后状态检查清单

- analytics 下 canonical sample / exporter / redaction / bundle writer / tool trace 文件齐全。
- `packages/scoring/analytics` 整体测试通过。
- SFT exporter 的输出类型和 schema 没有发生漂移。
- 没有覆盖当前 `dev` 已存在的 analytics 治理统计增强。

### 7.7 本节完成后必须提交

建议 commit message：

```bash
git add packages/scoring/analytics
git commit -m "feat(scoring-sft): add canonical sample exporters and bundle flow"
```

---

## 8. Commit `438d332`

### 8.1 基本信息

- Message: `feat(runtime-hooks): capture canonical tool trace sidecars`
- 建议方式：`手工迁移，不直接 cherry-pick`
- 风险等级：高

### 8.2 git show 文件清单

```bash
git show 438d332 -- _bmad/claude/hooks/post-tool-use.js
git show 438d332 -- _bmad/claude/settings.json
git show 438d332 -- _bmad/cursor/hooks/post-tool-use.js
git show 438d332 -- _bmad/runtime/hooks/post-tool-use-core.js
git show 438d332 -- scripts/init-to-root.js
git show 438d332 -- tests/acceptance/runtime-tool-trace-capture.test.ts
git show 438d332 -- tests/fixtures/cursor-post-tool-use-real-blocked.stdin.json
git show 438d332 -- tests/fixtures/cursor-post-tool-use-real-redacted.stdin.json
git show 438d332 -- tests/fixtures/cursor-post-tool-use-real.stdin.json
```

### 8.3 预期保留点

- canonical tool trace sidecar capture
- hook core 的可复用逻辑
- 对应 acceptance fixture 与测试

### 8.4 明确保留 / 丢弃规则

必须保留：

- 当前 `dev` 的 governance rerun queue 事件识别
- detached background worker 触发逻辑
- governancePresentation / executor routing / journeyContractHints 逻辑

可以引入：

- 与 tool trace sidecar 生成直接相关的逻辑
- sidecar 的 redact / blocked / raw 三种输入夹具

必须丢弃或重写：

- 任何会覆盖当前 `post-tool-use` rerun 事件处理主线的 incoming 逻辑

### 8.5 手工迁移步骤

1. 读取当前 `dev` 的 `_bmad/claude/hooks/post-tool-use.js`、`_bmad/cursor/hooks/post-tool-use.js`
2. 对比 `438d332` 中的 diff
3. 只抽出 tool trace sidecar capture 片段
4. 接到当前 `dev` 的 post-tool-use 主链之后，不能改动 queue drain 主链接口
5. 补 `runtime-tool-trace-capture.test.ts`

### 8.6 最小验证

```bash
npx vitest run tests/acceptance/runtime-tool-trace-capture.test.ts
npx vitest run tests/acceptance/governance-post-tool-use-background-worker.test.ts
npx vitest run tests/acceptance/governance-post-tool-use-hook.test.ts
```

### 8.7 执行后状态检查清单

- hooks 已能产出 canonical tool trace sidecar。
- 现有 detached background drain 行为不退化。
- governance post-tool-use 相关 acceptance 仍通过。
- `_bmad/claude/settings.json` 如有改动，不会改变当前 `dev` 的运行时入口语义。

### 8.9 本节完成后必须提交

建议 commit message：

```bash
git add _bmad/claude/hooks/post-tool-use.js _bmad/cursor/hooks/post-tool-use.js _bmad/runtime/hooks/post-tool-use-core.js _bmad/claude/settings.json scripts/init-to-root.js tests/acceptance/runtime-tool-trace-capture.test.ts tests/fixtures/cursor-post-tool-use-real.stdin.json tests/fixtures/cursor-post-tool-use-real-redacted.stdin.json tests/fixtures/cursor-post-tool-use-real-blocked.stdin.json
git commit -m "feat(runtime-hooks): capture canonical tool trace sidecars"
```

### 8.8 高风险逐文件提示词模板

#### 文件: `_bmad/claude/hooks/post-tool-use.js`

```text
请只处理文件 `_bmad/claude/hooks/post-tool-use.js`。

目标：把 commit 438d332 中与 canonical tool trace sidecar capture 直接相关的逻辑迁入当前 dev 版本，同时完整保留 dev 已有的 governance-rerun-result 事件入队、detached background drain、governancePresentation、executorRouting、journeyContractHints 逻辑。

要求：
1. 先读当前 dev 文件，再读 438d332 中该文件 diff。
2. 列出 incoming 新增逻辑中哪些属于 tool trace，哪些属于 governance rerun 既有逻辑。
3. 只迁入 tool trace 必需逻辑。
4. 禁止删除或改写当前 dev 的 postToolUse 主分支行为。
5. 修改后说明：
   - 保留了哪些 dev 主线逻辑
   - 吸收了哪些 incoming tool trace 逻辑
```

#### 文件: `_bmad/cursor/hooks/post-tool-use.js`

```text
请只处理文件 `_bmad/cursor/hooks/post-tool-use.js`。

目标：把 438d332 中 cursor hook 的 tool trace sidecar capture 能力并入当前 dev 版本，但不能破坏现有 governance rerun queue / detached worker / provider recommendation 数据传递。

要求：
1. dev 版本的治理主链路优先。
2. incoming 版本仅提取 tool trace sidecar 相关片段。
3. 保证 cursor hook 输出仍兼容当前 acceptance。
4. 修改后列出具体保留点与新增点。
```

#### 文件: `_bmad/runtime/hooks/post-tool-use-core.js`

```text
请只处理文件 `_bmad/runtime/hooks/post-tool-use-core.js`。

目标：如果 438d332 引入了可复用的 tool trace core，则在不改变现有 governance hook contract 的前提下迁入；如果该 core 会与现有 governance hook types 冲突，则只保留可复用的纯函数或 sidecar 生成逻辑。

要求：
1. 不要把 governance rerun 逻辑迁到这个 core 中。
2. 保持该 core 为 tool trace 辅助层，而不是新的主调度入口。
3. 必要时新增适配层，不直接替换现有主逻辑。
```

#### 文件: `scripts/init-to-root.js`

```text
请只处理文件 `scripts/init-to-root.js`。

目标：把 438d332 中与 runtime tool trace 所需部署文件相关的复制逻辑补齐，但不能影响当前 dev 的 _bmad / runtime hooks / claude hooks 的部署路径和镜像策略。

要求：
1. 仅增量加入新文件部署。
2. 不改变现有 init:claude 与 install consumer 的行为。
3. 修改后用 acceptance 验证安装链路不退化。
```

---

## 9. Commit `90e9dd2`

### 9.1 基本信息

- Message: `feat(runtime-cli): wire score, sft preview bundle, and end-to-end runtime path`
- 建议方式：`手工迁移，不直接 cherry-pick`
- 风险等级：高

### 9.2 git show 文件清单

```bash
git show 90e9dd2 -- packages/bmad-speckit/bin/bmad-speckit.js
git show 90e9dd2 -- packages/bmad-speckit/src/commands/score.js
git show 90e9dd2 -- packages/bmad-speckit/src/services/sync-service.js
git show 90e9dd2 -- packages/scoring/orchestrator/__tests__/tool-trace.test.ts
git show 90e9dd2 -- packages/scoring/orchestrator/parse-and-write.ts
git show 90e9dd2 -- packages/scoring/schema/run-score-schema.json
git show 90e9dd2 -- packages/scoring/writer/types.ts
git show 90e9dd2 -- tests/acceptance/runtime-cli-e2e-smoke.test.ts
git show 90e9dd2 -- tests/acceptance/runtime-dashboard-sft-tab.test.ts
```

### 9.3 预期保留点

- CLI score / runtime path / sft preview bundle 的 E2E 接线
- tool trace 与 scoring/orchestrator 的接线
- runtime dashboard SFT tab 的联动

### 9.4 明确保留 / 丢弃规则

必须保留：

- 当前 `dev` 的 scoring rerun history 字段
- governance remediation summary / runner summary / remediation trace
- 现有 writer/types/schema 中与治理主线有关的字段

可以引入：

- runtime-cli 和 SFT preview / bundle 的 E2E 路径
- tool-trace 的 orchestrator 接线

禁止：

- 用 incoming 的 schema 全量覆盖当前 schema
- 删除或回退当前治理链路字段

### 9.5 手工迁移步骤

1. 分别读取 incoming 与当前 `dev` 的 `parse-and-write.ts`、`run-score-schema.json`、`writer/types.ts`
2. 以 `dev` 为底，增量接入 runtime-cli / tool-trace / sft tab 需要的字段和逻辑
3. 同步修改测试

### 9.6 最小验证

```bash
npx vitest run packages/scoring/orchestrator/__tests__/tool-trace.test.ts
npx vitest run tests/acceptance/runtime-cli-e2e-smoke.test.ts
npx vitest run tests/acceptance/runtime-dashboard-sft-tab.test.ts
```

### 9.7 执行后状态检查清单

- `packages/bmad-speckit/src/commands/score.js` 已接入 runtime path / SFT preview bundle 所需流程。
- `packages/scoring/orchestrator/parse-and-write.ts` 仍保留当前 dev 的治理字段写入。
- `packages/scoring/schema/run-score-schema.json` 与 `packages/scoring/writer/types.ts` 已同步。
- runtime-cli smoke 和 dashboard-sft tab 测试通过。

### 9.9 本节完成后必须提交

建议 commit message：

```bash
git add packages/bmad-speckit/bin/bmad-speckit.js packages/bmad-speckit/src/commands/score.js packages/bmad-speckit/src/services/sync-service.js packages/scoring/orchestrator/__tests__/tool-trace.test.ts packages/scoring/orchestrator/parse-and-write.ts packages/scoring/schema/run-score-schema.json packages/scoring/writer/types.ts tests/acceptance/runtime-cli-e2e-smoke.test.ts tests/acceptance/runtime-dashboard-sft-tab.test.ts
git commit -m "feat(runtime-cli): wire score sft preview bundle and runtime path"
```

### 9.8 高风险逐文件提示词模板

#### 文件: `packages/scoring/orchestrator/parse-and-write.ts`

```text
请只处理文件 `packages/scoring/orchestrator/parse-and-write.ts`。

目标：把 90e9dd2 中 runtime-cli / tool-trace / SFT preview bundle 需要的接线并入当前 dev 版本，同时完整保留 dev 已有的 governance rerun history、runner summary、remediation audit trace、journey contract propagation 相关逻辑。

要求：
1. 先列出 dev 独有字段与 incoming 独有字段。
2. 以 dev 为底，增量并入 incoming 能力。
3. 不允许删除 dev 的写入字段或 schema 对应逻辑。
4. 修改后指出哪些调用点新增了 runtime-cli / tool-trace 接线。
```

#### 文件: `packages/scoring/schema/run-score-schema.json`

```text
请只处理文件 `packages/scoring/schema/run-score-schema.json`。

目标：把 90e9dd2 所需 schema 字段并入当前 schema，但不能删除当前 dev 已有的 governance rerun history、runner_summary_lines、remediationAuditTrace 等字段。

要求：
1. 对比 incoming 与 dev schema。
2. 只做并集，不做覆盖。
3. 修改后列出新增字段和保留字段。
4. 确认 writer/types/orchestrator 与 schema 一致。
```

#### 文件: `packages/scoring/writer/types.ts`

```text
请只处理文件 `packages/scoring/writer/types.ts`。

目标：与 run-score schema 保持完全同步，把 90e9dd2 所需字段并入，但不回退 dev 当前治理相关字段。

要求：
1. 以当前 dev 类型为底。
2. 增量加入 incoming 所需 runtime-cli / SFT / tool-trace 字段。
3. 不允许出现 schema 与 types 不一致。
```

#### 文件: `packages/bmad-speckit/bin/bmad-speckit.js`

```text
请只处理文件 `packages/bmad-speckit/bin/bmad-speckit.js`。

目标：吸收 90e9dd2 中 runtime-cli / score / sft preview bundle 相关命令入口，同时保留 dev 当前 CLI 行为与已接入命令。

要求：
1. 不能覆盖已有命令注册。
2. 对同名命令采用增量扩展，不允许语义回退。
3. 修改后列出新增命令和被保留的既有命令。
```

#### 文件: `packages/bmad-speckit/src/commands/score.js`

```text
请只处理文件 `packages/bmad-speckit/src/commands/score.js`。

目标：把 runtime path / preview bundle / tool trace 需要的 score 逻辑并入当前版本，但不能影响现有 dev 的评分命令兼容性。

要求：
1. 保持旧参数兼容。
2. 仅增量加入 runtime-dashboard-sft 所需能力。
3. 修改后说明新旧路径如何共存。
```

#### 文件: `package.json` / `package-lock.json`

```text
请只处理 `package.json` 和 `package-lock.json`。

目标：把 runtime dashboard UI / live server / SFT preview bundle 所需依赖和脚本并入当前 dev，不能删除已有治理主线脚本。

要求：
1. 逐项比较 scripts / dependencies / devDependencies。
2. 对现有 dev 脚本保持不变；新增 dashboard/SFT 脚本时使用增量命名。
3. lockfile 必须与最终 package.json 一致。
4. 修改后列出新增脚本与新增依赖。
```

---

## 10. Commit `39a05aa`

### 10.1 基本信息

- Message: `feat: 统一 runtime MCP selection schema 与 work item 参考文档`
- 建议方式：`可直接 cherry-pick`
- 风险等级：低

### 10.2 git show 文件清单

```bash
git show 39a05aa -- docs/how-to/guide-index.md
git show 39a05aa -- docs/reference/runtime-dashboard.md
git show 39a05aa -- packages/scoring/dashboard/mcp-server.ts
git show 39a05aa -- tests/acceptance/runtime-dashboard-mcp-server.test.ts
```

### 10.3 预期保留点

- runtime dashboard MCP selection schema 统一
- 参考文档 `docs/reference/runtime-dashboard.md`
- mcp-server acceptance 更新

### 10.4 最小验证

```bash
git cherry-pick 39a05aa
npx vitest run tests/acceptance/runtime-dashboard-mcp-server.test.ts
```

### 10.5 执行后状态检查清单

- `docs/reference/runtime-dashboard.md` 已存在并可被索引。
- `packages/scoring/dashboard/mcp-server.ts` 已采用统一 selection schema。
- MCP server acceptance 通过。
- 没有破坏当前 dev 的 dashboard governance summary 输出。

### 10.6 本节完成后必须提交

建议 commit message：

```bash
git add docs/how-to/guide-index.md docs/reference/runtime-dashboard.md packages/scoring/dashboard/mcp-server.ts tests/acceptance/runtime-dashboard-mcp-server.test.ts
git commit -m "feat(runtime-dashboard): align runtime mcp selection schema"
```

---

## 11. Commit `b92e2df`

### 11.1 基本信息

- Message: `feat(runtime-dashboard): 完善 dashboard UI 功能并修复文本溢出`
- 建议方式：`可 cherry-pick，但 package.json / lockfile / runtime dashboard 测试冲突要手工解`
- 风险等级：中

### 11.2 git show 文件清单

```bash
git show b92e2df -- .eslintignore
git show b92e2df -- package.json
git show b92e2df -- package-lock.json
git show b92e2df -- packages/scoring/dashboard/__tests__/mcp-server.test.ts
git show b92e2df -- packages/scoring/dashboard/__tests__/runtime-query.test.ts
git show b92e2df -- packages/scoring/dashboard/live-server.ts
git show b92e2df -- packages/scoring/dashboard/runtime-query.ts
git show b92e2df -- packages/scoring/dashboard/snapshot.ts
git show b92e2df -- packages/scoring/dashboard/ui/app.js
git show b92e2df -- packages/scoring/dashboard/ui/index.html
git show b92e2df -- packages/scoring/dashboard/ui/src/main.jsx
git show b92e2df -- packages/scoring/dashboard/ui/src/styles.css
git show b92e2df -- packages/scoring/dashboard/ui/styles.css
git show b92e2df -- packages/scoring/data/scores.jsonl
git show b92e2df -- scripts/start-dashboard.ts
git show b92e2df -- tests/acceptance/runtime-cli-e2e-smoke.test.ts
git show b92e2df -- tests/acceptance/runtime-dashboard-live-api.test.ts
git show b92e2df -- tests/acceptance/runtime-dashboard-live-server.test.ts
git show b92e2df -- tests/acceptance/runtime-dashboard-sft-tab.test.ts
git show b92e2df -- tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts
git show b92e2df -- tests/helpers/ensure-scoring-build.ts
git show b92e2df -- tests/helpers/json-rpc.ts
```

### 11.3 预期保留点

- dashboard live-server 完整功能
- UI 主界面、样式、文本溢出修复
- start-dashboard 脚本
- playwright smoke、live api/server、runtime dashboard sft tab 测试

### 11.4 冲突处理指令

- `package.json` / `package-lock.json`：只增量加入 dashboard UI 所需依赖与脚本
- `runtime-query.ts` / `snapshot.ts` / `mcp-server.ts`：保留 `dev` 中新增的治理 summary / provider recommendation 显示字段，再叠加 incoming UI 逻辑
- `packages/scoring/data/scores.jsonl`：不要把 worktree 的本地数据文件带入 `dev`

### 11.5 最小验证

```bash
git cherry-pick b92e2df
npx vitest run tests/acceptance/runtime-dashboard-live-api.test.ts
npx vitest run tests/acceptance/runtime-dashboard-live-server.test.ts
npx vitest run tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts
```

### 11.6 执行后状态检查清单

- `packages/scoring/dashboard/live-server.ts`、`ui/index.html`、`ui/src/main.jsx`、`ui/src/styles.css` 已落地。
- dashboard UI 文本溢出修复仍在。
- `scripts/start-dashboard.ts` 可启动 dashboard。
- `package.json` / `package-lock.json` 已同步，且没有删掉 dev 当前脚本。
- live-api / live-server / UI smoke 测试通过。

### 11.7 本节完成后必须提交

建议 commit message：

```bash
git add .eslintignore package.json package-lock.json packages/scoring/dashboard/live-server.ts packages/scoring/dashboard/runtime-query.ts packages/scoring/dashboard/snapshot.ts packages/scoring/dashboard/ui/app.js packages/scoring/dashboard/ui/index.html packages/scoring/dashboard/ui/src/main.jsx packages/scoring/dashboard/ui/src/styles.css packages/scoring/dashboard/ui/styles.css scripts/start-dashboard.ts tests/acceptance/runtime-dashboard-live-api.test.ts tests/acceptance/runtime-dashboard-live-server.test.ts tests/acceptance/runtime-dashboard-sft-tab.test.ts tests/acceptance/runtime-dashboard-ui-playwright.smoke.ts tests/helpers/ensure-scoring-build.ts tests/helpers/json-rpc.ts
git commit -m "feat(runtime-dashboard): finalize live ui and overflow fixes"
```

---

## 12. 最终验证矩阵

> 11 个 commit 处理完后，必须跑下面的最小矩阵；如果全部通过，再跑全量 CI。

### 12.1 runtime dashboard / SFT 最小矩阵

```bash
npx vitest run packages/scoring/runtime
npx vitest run packages/scoring/dashboard
npx vitest run packages/scoring/analytics
npx vitest run tests/acceptance/runtime-dashboard-*.test.ts
npx vitest run tests/acceptance/runtime-cli-e2e-smoke.test.ts
```

### 12.2 治理主线最小矩阵

```bash
npx vitest run tests/acceptance/governance-*.test.ts
npx vitest run tests/acceptance/prompt-routing-governance.test.ts
npx vitest run tests/acceptance/model-governance-policy-filter.test.ts
```

### 12.3 最终全量确认

```bash
npm run test:ci
```

---

## 13. 模型执行要求

执行这份 playbook 时，模型必须遵守：

1. 每处理一个 commit，都先读本节列出的 `git show` 文件清单。
2. 如果该 commit 被标记为“手工迁移”，不得直接 `cherry-pick`。
3. 每个阶段完成后必须跑对应最小验证。
4. 如果验证失败，不得继续处理下一个 commit，必须先修到绿。
5. 在任何冲突中，治理主线不允许回退。

---

*生成时间: 2026-03-30*  
*扩展来源: `docs/plans/runtime-dashboard-cherry-pick-guide.md`*  
*用途: 供模型逐 commit 精确执行与手工合并。*
