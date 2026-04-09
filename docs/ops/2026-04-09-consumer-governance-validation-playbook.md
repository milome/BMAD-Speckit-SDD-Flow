# Consumer Governance Validation Playbook

> 日期：2026-04-09  
> 适用对象：像 `claw-scope` 这样通过 `file:` 依赖或 tarball 安装 `bmad-speckit-sdd-flow` 的 consumer 项目  
> 目的：验证 consumer 上的 runtime governance 安装、hook 调用、`gates loop` 事件流，以及新的 packet 执行闭环

---

## 这份文档解决什么问题

这份 playbook 不是讲“如何开发 governance 功能”，而是讲“如何在一个真实 consumer 项目上重新安装并验证它真的工作”。

重点验证两条链：

1. `gates loop` 的 hook 调用链是否真的活着
2. 新的 packet 执行闭环是否真的从 queue 走到 execution record，再推进到终态

它来自一次在 `D:/Dev/claw-scope` 上的真实验证，所以除了步骤，还包含踩过的坑和对应修复点。

---

## 适用前提

开始前先确认：

1. consumer 项目通过 `file:../BMAD-Speckit-SDD-Flow` 或 tarball 安装了 `bmad-speckit-sdd-flow`
2. 主仓库已经先完成最新构建
3. consumer 项目可以接受清理并重新生成：
   - `_bmad`
   - `_bmad-output`
   - `.claude`
   - `.cursor`

如果你只是要做一次最小验证，也至少要准备：

1. 一个可写的 consumer 项目目录
2. Node.js 18+
3. `npm install`
4. `npx bmad-speckit-init`

---

## 验证目标

最低通过标准如下：

1. consumer 重装后，hook-local runtime 文件齐全
2. `pre-continue-check` 能真实产出 blocker 和 rerun event
3. `post-tool-use` 能真实入 governance queue
4. background worker 能自动把 queue 从 `pending` 吃到 `done`
5. 自动生成 remediation artifact、packet 和 execution record
6. execution record 至少能自动推进到 `running`
7. 在需要时，结果吸收器能把它继续推进到 `awaiting_rerun_gate` / `gate_passed`

---

## Step 1: 清理旧安装面

在 consumer 项目里，先只清理 BMAD 管理面，不要碰业务源码：

```powershell
$root = 'D:/Dev/claw-scope'
$paths = @(
  "$root/_bmad",
  "$root/_bmad-output",
  "$root/.claude",
  "$root/.cursor",
  "$root/node_modules/bmad-speckit-sdd-flow"
)
foreach ($p in $paths) {
  if (Test-Path $p) {
    Remove-Item -LiteralPath $p -Recurse -Force
  }
}
```

如果 Windows 报 `EBUSY` / 文件锁：

1. 先关闭 Cursor / Claude / Tauri dev 进程
2. 等 1 到 2 秒
3. 再重试清理

不要一边 `npm install` 一边 `init`。这两步必须串行执行。

---

## Step 2: 重新安装并重建运行时

先在主仓库重建，再在 consumer 里重装依赖。

在主仓库运行：

```bash
npm run build:scoring
npm run build:runtime-context
npm run build:runtime-emit
```

然后在 consumer 里运行：

```bash
npm install --force
```

`--force` 的目的是在 `file:` 依赖场景下强制刷新快照。只跑一次普通 `npm install`，经常不会把主仓库的新 bundle 带进 consumer。

---

## Step 3: 重新初始化 Claude 和 Cursor 运行时

在 consumer 项目里串行执行：

```bash
npx bmad-speckit-init --agent cursor
npx bmad-speckit-init --agent claude-code
```

如果 `claude-code` 初始化时遇到 Windows `EBUSY`：

1. 先保住 `cursor` 初始化成功
2. 等 1 到 2 秒后重试 `claude-code`

不要并行跑这两个 init。

---

## Step 4: 验证 hook-local 运行时文件是否在位

至少检查这些文件：

Cursor:

```text
.cursor/hooks/governance-runtime-worker.cjs
.cursor/hooks/governance-remediation-runner.cjs
.cursor/hooks/governance-packet-dispatch-worker.cjs
.cursor/hooks/governance-execution-result-ingestor.cjs
.cursor/hooks/governance-packet-reconciler.cjs
.cursor/hooks/post-tool-use.cjs
.cursor/hooks/pre-continue-check.cjs
```

Claude:

```text
.claude/hooks/governance-runtime-worker.cjs
.claude/hooks/governance-remediation-runner.cjs
.claude/hooks/governance-packet-dispatch-worker.cjs
.claude/hooks/governance-execution-result-ingestor.cjs
.claude/hooks/governance-packet-reconciler.cjs
.claude/hooks/post-tool-use.cjs
.claude/hooks/pre-continue-check.cjs
```

如果这些文件不在，后面的验证没有意义。

---

## Step 5: 验证 CLI 入口

在 consumer 项目里运行：

```bash
npx bmad-speckit version
```

期望：

1. 命令成功执行
2. 输出 CLI version / template version / Node version

如果这里就失败，先修安装和 `.bin` wrapper，再做 hook 验证。

---

## Step 6: 验证 `gates loop` 的 pre-continue hook

这一步的目标不是“让 artifact 通过”，而是故意制造 blocker，确认 hook 会真实产出治理事件。

### 6.1 准备一个故意不完整的 readiness artifact

示例：

```powershell
$root = 'D:/Dev/claw-scope'
$valDir = Join-Path $root '_bmad-output/validation-consumer'
New-Item -ItemType Directory -Path $valDir -Force | Out-Null
$artifact = Join-Path $valDir 'implementation-readiness-report.md'
@'
# Implementation Readiness Report

## Blockers Requiring Immediate Action

- IR-BLK-001: missing proof chain

## Deferred Gaps

- J04-Smoke-E2E: P0 Journey J04 lacks Smoke E2E
  - Reason: P2 priority
  - Resolution Target: Sprint 2+
  - Owner: Dev Team
'@ | Set-Content -Path $artifact -Encoding UTF8
```

### 6.2 运行 pre-continue hook

在 consumer 根目录下运行：

```powershell
$env:BMAD_PRECONTINUE_ARTIFACT_PATH = $artifact
$env:BMAD_HOOKS_VERBOSE = '1'
node .claude/hooks/pre-continue-check.cjs check-implementation-readiness step-06-final-assessment
```

期望：

1. 退出码为 `2`
2. stdout/stderr 中出现结构化 blocker
3. `_bmad-output/runtime/governance/queue/pending-events/*.json` 出现 `governance-rerun-result`

如果这一步不成立，说明 `gates loop` 第一跳就没活。

---

## Step 7: 验证 post-tool-use 入队

准备一个 `governance-rerun-result` 事件，然后在 consumer 自己的 cwd 下喂给 hook：

```powershell
$event = @{
  type = 'governance-rerun-result'
  payload = @{
    projectRoot = $root
    sourceEventType = 'manual-validation'
    runnerInput = @{
      projectRoot = $root
      outputPath = (Join-Path $valDir 'auto-attempt.md')
      promptText = 'consumer validation'
      stageContextKnown = $true
      gateFailureExists = $true
      blockerOwnershipLocked = $true
      rootTargetLocked = $true
      equivalentAdapterCount = 1
      attemptId = 'consumer-validate-01'
      sourceGateFailureIds = @('CONSUMER-1')
      capabilitySlot = 'qa.readiness'
      canonicalAgent = 'PM + QA / readiness reviewer'
      actualExecutor = 'implementation readiness workflow'
      adapterPath = 'local workflow fallback'
      targetArtifacts = @('prd.md', 'architecture.md')
      expectedDelta = 'close readiness blockers'
      rerunOwner = 'PM'
      rerunGate = 'implementation-readiness'
      outcome = 'blocked'
      hostKind = 'cursor'
    }
    rerunGateResult = @{
      gate = 'implementation-readiness'
      status = 'fail'
      blockerIds = @('CONSUMER-1')
      summary = 'Need validation attempt.'
    }
  }
} | ConvertTo-Json -Depth 8

Push-Location $root
try {
  $event | node '.cursor/hooks/post-tool-use.cjs'
} finally {
  Pop-Location
}
```

期望：

1. 日志出现 `received rerun-result`
2. 日志出现 `queued rerun event path=...`
3. `_bmad-output/runtime/governance/queue/pending/*.json` 出现 queue item

---

## Step 8: 验证自动 background worker 吃队列

这一步才是最关键的自动化验证。

### 8.1 使用 `version: 2 + execution.enabled=true` 的临时 config

不要污染项目默认 provider，给这轮验证单独写一个 `stub` 配置文件，并通过 event 的 `configPath` 指向它。

核心字段：

```yaml
version: 2
primaryHost: cursor
provider:
  mode: stub
  id: consumer-validation-stub
execution:
  enabled: true
  authoritativeHost: cursor
  fallbackHosts:
    - claude
```

### 8.2 只靠 hook 自动链验证

调用 `post-tool-use.cjs` 后，不手跑 worker，直接轮询：

```text
_bmad-output/runtime/governance/queue/done/
_bmad-output/runtime/governance/executions/
_bmad-output/runtime/governance/queue/last-failed-debug.json
```

期望：

1. queue item 从 `pending` 自动进 `done`
2. 自动生成 execution record
3. 没有 `last-failed-debug.json`

### 8.3 这次在 `claw-scope` 上踩到的真实坑

这一步在 `claw-scope` 上暴露了 4 个真实问题，后续别的 consumer 项目也可能重复遇到：

1. **worker entry 解析顺序错误**
   `run-bmad-runtime-worker.cjs` 优先拿了项目里的 `.claude/hooks/governance-runtime-worker.cjs`，而不是与当前 wrapper 同目录的最新 worker。  
   修复方式：优先同目录 `governance-runtime-worker.cjs`。

2. **嵌入 CLI main 干扰 worker bundle**
   `governance-remediation-runner.ts`、`governance-remediation-artifact.ts`、`governance-execution-result-ingestor.ts`、`governance-packet-dispatch-worker.ts`、`governance-packet-reconciler.ts` 都带 CLI 入口，bundle 进 worker 后会误读 `process.argv`。  
   修复方式：引入 `BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS=1` 保护。

3. **consumer schema/rules 路径 fallback 不足**
   hook-local worker 在 `claw-scope` 里找不到 `run-score-schema.json`。  
   修复方式：`resolveSchemaDir()` / `resolveRulesDir()` 增加：
   - `node_modules/@bmad-speckit/...`
   - `node_modules/bmad-speckit/node_modules/@bmad-speckit/...`
   - `node_modules/bmad-speckit-sdd-flow/packages/...`

4. **`file:` 依赖不会自动刷新快照**
   只跑 `npm install` 经常不会把主仓库的最新 bundle 带进 consumer。  
   修复方式：删除 consumer 里的 `node_modules/bmad-speckit-sdd-flow` 后执行：

```bash
npm install --force
```

这一步在 `claw-scope` 上是必须的。

### 8.4 `claw-scope` 上最终验证结果

修复完后，在 `claw-scope` 上已经验证到：

1. `post-tool-use.cjs` 自动入队
2. background worker 自动启动
3. queue item 自动进入 `done`
4. 自动生成 remediation artifact 和 packet
5. 自动生成 execution record
6. execution record 自动推进到 `running`

这说明：

> `hook -> background worker -> 自动吃队列` 在真实 consumer 上已经打通。

---

## Step 9: 验证完整 packet 闭环

自动 worker 只需要证明它能把 queue 吃到 `running`。完整闭环还要再证明：

1. `running -> awaiting_rerun_gate`
2. `awaiting_rerun_gate -> gate_passed`

在 consumer 根目录下，可直接调用已部署的 hook-local ingestor：

```powershell
node .cursor/hooks/governance-execution-result-ingestor.cjs "<json-payload>"
```

或在 Node 里 `require()` 它并调用：

```js
const mod = require('./.cursor/hooks/governance-execution-result-ingestor.cjs');
mod.ingestGovernanceExecutionResult(...);
mod.ingestGovernanceRerunGateResult(...);
```

在 `claw-scope` 上，本次真实验证到的最终 record 状态是：

- `status: gate_passed`
- `lastRerunGateResult.status: pass`

所以这条闭环已经成立：

```text
packet -> execution record -> running -> awaiting_rerun_gate -> gate_passed
```

---

## 常见故障速查

### 故障 1：`npx bmad-speckit-init` 报 `MODULE_NOT_FOUND`

通常是 `npm install` 和 `init` 并行跑了，或者 file dependency 快照不完整。

处理：

1. 串行执行 `npm install`
2. 再执行 `npx bmad-speckit-init`

### 故障 2：Windows `EBUSY` / 文件锁

常见于：

- `_bmad` copy
- `.claude/.cursor` hook 覆盖

处理：

1. 关闭编辑器和相关 dev 进程
2. 等 1 到 2 秒
3. 重试 init

### 故障 3：`run-score-schema.json` 找不到

症状：

```text
ENOENT: ... schema/run-score-schema.json
```

处理顺序：

1. 确认主仓库已重建
2. 删除 consumer 的 `node_modules/bmad-speckit-sdd-flow`
3. `npm install --force`
4. 再 `npx bmad-speckit-init --agent cursor`

### 故障 4：hook 日志里说 `background worker started`，但 queue 一直不动

这通常不是 hook 本身坏了，而是：

1. worker bundle 入口选错了旧文件
2. bundle 里嵌入 CLI `main()` 抢了 argv
3. schema/rules fallback 缺失

处理时不要只盯日志，要同时查：

- `queue/pending`
- `queue/done`
- `queue/last-failed-debug.json`
- `executions/*.json`

---

## 建议的最小复用顺序

以后在任何 consumer 项目上，建议固定按这个顺序验证：

1. 清理旧安装面
2. 主仓库重建
3. consumer `npm install --force`
4. `npx bmad-speckit-init --agent cursor`
5. `npx bmad-speckit-init --agent claude-code`
6. 验证 hook-local 文件
7. 跑 `pre-continue-check`
8. 跑 `post-tool-use`
9. 看自动 background worker 是否把 queue 吃到 `done + execution record`
10. 再推进到 `gate_passed`

如果第 9 步成立，说明 consumer 安装和自动链已经健康。  
如果第 10 步也成立，说明 packet 闭环已经完整可用。

---

## 结论

这次在 `claw-scope` 上的真实验证证明了两件事：

1. `gates loop` 的 hook 调用链是活的
2. 新的 packet 执行闭环在真实 consumer 上可成立

后续别的 consumer 项目，直接复用这份 playbook 即可。\*\*\* End Patch
