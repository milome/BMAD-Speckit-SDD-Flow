# Consumer Governance Validation

在修改 runtime hooks、runtime-emit bundle、init 部署逻辑后，用这份 reference 验证真实 consumer 是否仍然形成完整治理闭环。

## 何时读取

满足任一条件就读取本文件：

- 改了 `.claude/hooks` / `.cursor/hooks`
- 改了 `packages/runtime-emit`
- 改了 `scripts/init-to-root.js` / `bmad-speckit-init`
- 改了 governance queue / worker / dispatch / ingestor / packet closure
- 自动脚本失败，需要手工排查

## 最低通过标准

必须同时成立：

1. consumer 重装后 hook-local runtime 文件齐全
2. `pre-continue-check` 能产出 blocker 和 `governance-rerun-result`
3. `post-tool-use` 能把事件送入 governance queue
4. background worker 能把 queue 从 `pending` 吃到 `done`
5. 自动生成 remediation artifact、packet、execution record
6. execution record 能推进到 `running`
7. rerun gate 结果吸收后能推进到 `gate_passed`

## 优先使用自动脚本

```powershell
# 源仓库
pwsh -NoProfile -File scripts/validate-consumer-governance.ps1 -ConsumerRoot <consumer-root>

# 已安装 consumer
pwsh -NoProfile -File node_modules/bmad-speckit-sdd-flow/scripts/validate-consumer-governance.ps1 -ConsumerRoot <consumer-root>
```

期待结果：

- 生成 machine-readable summary
- summary `status=passed`
- `verify-post-tool-use-and-background-worker.executionStatus=running`
- `verify-execution-closure.finalStatus=gate_passed`

## 手工验证顺序

### 1. 仅清理安装面，保留 `_bmad-output`

只清理 BMAD 管理面：

- `_bmad`
- `.claude`
- `.cursor`
- `node_modules/bmad-speckit-sdd-flow`

`_bmad-output` 绝不能删除。它包含 planning artifacts、implementation artifacts、runtime context、governance records 等运行时工件。

Windows 上若遇到 `EBUSY`：

1. 关闭 Cursor / Claude / dev server
2. 等 1 到 2 秒
3. 重试

### 2. 在主仓库重建

```bash
npm run build:scoring
npm run build:runtime-context
npm run build:runtime-emit
```

### 3. 在 consumer 强制重装

```bash
npm install --force
```

`file:` 依赖场景下，普通 `npm install` 常常不会刷新最新 bundle。

### 4. 串行重新 init

```bash
npx bmad-speckit-init --agent cursor
npx bmad-speckit-init --agent claude-code
```

不要并行跑。`claude-code` 若遇到 `EBUSY`，等待后重试。

### 5. 校验 hook-local 文件

至少确认这两组文件存在：

- `.cursor/hooks/governance-runtime-worker.cjs`
- `.cursor/hooks/governance-remediation-runner.cjs`
- `.cursor/hooks/governance-packet-dispatch-worker.cjs`
- `.cursor/hooks/governance-execution-result-ingestor.cjs`
- `.cursor/hooks/governance-packet-reconciler.cjs`
- `.cursor/hooks/post-tool-use.cjs`
- `.cursor/hooks/pre-continue-check.cjs`

- `.claude/hooks/governance-runtime-worker.cjs`
- `.claude/hooks/governance-remediation-runner.cjs`
- `.claude/hooks/governance-packet-dispatch-worker.cjs`
- `.claude/hooks/governance-execution-result-ingestor.cjs`
- `.claude/hooks/governance-packet-reconciler.cjs`
- `.claude/hooks/post-tool-use.cjs`
- `.claude/hooks/pre-continue-check.cjs`

### 6. 校验 CLI 入口

```bash
npx bmad-speckit version
```

应输出 CLI version / template version / Node version。

### 7. 验证 `pre-continue-check`

准备一个故意不完整的 readiness artifact，然后执行：

```powershell
$env:BMAD_PRECONTINUE_ARTIFACT_PATH = $artifact
$env:BMAD_HOOKS_VERBOSE = '1'
node .claude/hooks/pre-continue-check.cjs check-implementation-readiness step-06-final-assessment
```

期待：

- exit code = `2`
- stdout / stderr 出现 blocker
- `_bmad-output/runtime/governance/queue/pending-events/*.json` 出现 `governance-rerun-result`

### 8. 验证 `post-tool-use`

向 `.cursor/hooks/post-tool-use.cjs` 或 `.claude/hooks/post-tool-use.cjs` 喂一个 `governance-rerun-result` 事件。

期待：

- stdout / hook log 出现 `received rerun-result`
- stdout / hook log 出现 `queued rerun event`
- `_bmad-output/runtime/governance/queue/pending/*.json` 出现 queue item

### 9. 验证自动 background worker

调用 `post-tool-use` 后不要手跑 worker，直接轮询：

- `_bmad-output/runtime/governance/queue/done`
- `_bmad-output/runtime/governance/executions`
- `_bmad-output/runtime/governance/queue/last-failed-debug.json`

期待：

- queue item 自动进入 `done`
- 自动生成 execution record
- record 状态推进到 `running`
- 没有 `last-failed-debug.json`

使用唯一 run id / outputPath / capabilitySlot 来区分本次验证结果，不要通过删除 `_bmad-output/runtime/governance` 来“重置环境”。

### 10. 验证 packet 闭环

再喂 execution result 和 rerun gate result：

```powershell
node .cursor/hooks/governance-execution-result-ingestor.cjs "<json-payload>"
```

或：

```js
const mod = require('./.cursor/hooks/governance-execution-result-ingestor.cjs');
mod.ingestGovernanceExecutionResult(...);
mod.ingestGovernanceRerunGateResult(...);
```

期待：

- `running -> awaiting_rerun_gate`
- `awaiting_rerun_gate -> gate_passed`

## 常见真实故障

### 1. worker entry 选错旧文件

症状：

- hook 说 `background worker started`
- queue 不动，或行为像旧版本

处理：

- `run-bmad-runtime-worker.cjs` 应优先加载与当前 wrapper 同目录的 `governance-runtime-worker.cjs`
- 不要优先回落到项目里遗留的旧 hook 文件

### 2. bundle 里嵌入 CLI main 干扰 worker

症状：

- worker 进程起了，但行为异常
- bundle 内误读 `process.argv`

处理：

- 相关 bundle 内嵌 CLI 入口必须受 `BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS=1` 保护

### 3. consumer schema / rules fallback 不足

症状：

- `ENOENT: ... run-score-schema.json`

处理：

- schema / rules 解析要覆盖这些路径：
  - `node_modules/@bmad-speckit/...`
  - `node_modules/bmad-speckit/node_modules/@bmad-speckit/...`
  - `node_modules/bmad-speckit-sdd-flow/packages/...`

### 4. `file:` 依赖没有刷新

症状：

- 主仓库已修复，consumer 仍表现为旧行为

处理：

1. 删除 consumer 的 `node_modules/bmad-speckit-sdd-flow`
2. `npm install --force`
3. 重新 `npx bmad-speckit-init`

### 5. execution record 卡在 `pending_dispatch`

症状：

- queue 已进 `done`
- packet 已生成
- execution record 停在 `pending_dispatch`

处理：

- dispatch 阶段实际读取的是 canonical `_bmad/_config/governance-remediation.yaml`
- 仅在事件里传 `configPath` 不一定够；验证阶段常常要临时覆写 canonical config，使 `version: 2` 且 `execution.enabled=true`
- 验证结束后再恢复原配置

### 6. 误删 `_bmad-output`

症状：

- `_bmad-output/planning-artifacts/...` 丢失
- `_bmad-output/runtime/...` 丢失
- consumer 上下文、历史记录或规划产物无法回滚

处理：

- 重新安装时只重装安装面，不碰 `_bmad-output`
- 验证脚本使用唯一 run id 叠加新结果，而不是删除旧结果

## 证据优先级

不要只凭一句 `background worker started` 下结论。优先看：

1. queue `pending -> done`
2. `current-run.json`
3. execution record JSON
4. `last-failed-debug.json`
5. hook log

真正的闭环证据是：

```text
pre-continue-check -> governance-rerun-result
post-tool-use -> queue/pending
background worker -> queue/done
execution record -> running
execution ingestor -> awaiting_rerun_gate
rerun gate ingestor -> gate_passed
```
