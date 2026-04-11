# 消费项目安装指南

本文档只面向“消费项目”的实际安装与接线，不假设你正在修改本仓库本身。

适用场景：

- 你有一个现有项目，想把 BMAD-Speckit-SDD-Flow 安装进去
- 你需要在该项目里启用 Cursor / Claude Code 运行时
- 你需要继续配置 provider 的 `baseUrl` / `apiKey` / `model`
- 你希望确认 runtime dashboard / hooks 的启动路径是否完整

不适用场景：

- 修改本仓库源码或开发安装器本身
- 只想阅读 BMAD 方法论，不打算落地到消费项目

## 结论先说

如果你的目标是“把一套可运行的 BMAD/Speckit 能力装进一个消费项目”，当前最可执行的路径是：

1. 用 `setup.ps1` 或 `init-to-root.js` 把 `_bmad`、`.cursor`、`.claude` 等骨架部署到消费项目
2. 按需要补充 Cursor / Claude 的运行时配置
3. 如果要启用治理 provider，显式配置 `_bmad/_config/governance-remediation.yaml`
4. 最后执行最小验证命令，确认 hooks、dashboard、provider 都可用

补充说明：

- `dashboard` 属于默认支持能力
- `runtime-mcp` 属于增强能力，需要显式开关 `--with-mcp` 启用，不属于默认安装产物

如果你只照旧 README 的 Quick Start 做，信息还不够覆盖消费者项目的完整安装链，尤其是：

- provider 的 `baseUrl` / `apiKeyEnv` / `model` 怎么配
- runtime dashboard 如何自动启动、如何手动兜底

所以这篇文档给出一条真正可执行的消费者路径。

## 最高优先级：另一台没有本仓库源码的机器

这是当前文档里必须优先考虑的场景：

- 目标机器上**没有** `BMAD-Speckit-SDD-Flow` 仓库
- 你要把本仓库的定制能力装进一个消费项目
- 你需要的不是“可能可用”，而是**已验证的安装路径**

当前文档中，**已验证** 的 off-repo 安装方式是：

```powershell
cd <consumer-root>
npm install --save-dev .\bmad-speckit-sdd-flow-<version>.tgz
npx bmad-speckit version
npx bmad-speckit check
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

这条路径对应的仓库内验证证据是：

- `tests/acceptance/accept-root-package-bmad-speckit-bin.test.ts`
- `tests/acceptance/accept-install-consumer-cli.test.ts`

如果你手里拿的是**发布到 registry 的根包**，只有在它与上述 tgz 来自**同一个已验证发布产物**时，才应视为等价路径。

反过来，下面这条：

```powershell
npx bmad-speckit init . --ai cursor-agent --yes
```

在本文里只应被视为：

- 上游 bootstrap / 快速初始化入口
- **不是** 本仓库定制能力在 off-repo 场景下的最高优先级默认方案

## 当前必须明确的安装事实

### 1. 消费项目根目录不是 governance 运行入口落点

当前设计下，消费项目**不应该**依赖根目录 `scripts/` 作为 runtime governance 主运行面。换句话说，下面这种路径缺失本身不是 bug：

- `<consumer>/scripts/governance-runtime-worker.*`
- `<consumer>/scripts/governance-remediation-runner.*`

真正应该出现并被宿主消费的是：

- `<consumer>/_bmad/runtime/hooks/governance-runtime-worker.cjs`
- `<consumer>/_bmad/runtime/hooks/governance-remediation-runner.cjs`
- `<consumer>/.claude/hooks/governance-runtime-worker.cjs`
- `<consumer>/.claude/hooks/governance-remediation-runner.cjs`
- `<consumer>/.cursor/hooks/governance-runtime-worker.cjs`
- `<consumer>/.cursor/hooks/governance-remediation-runner.cjs`

### 2. 仅完成 npm 安装，不等于两侧 hooks 已经全部对齐

当前最稳妥的消费项目安装链分两步：

1. 安装包
2. 显式执行 agent 对齐

示例：

```powershell
cd <consumer-root>
npm install --save-dev D:\Dev\BMAD-Speckit-SDD-Flow
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

如果你只做了第 1 步，可能已经拿到了 `_bmad` 和 CLI，但还没有把最新 hook 资产完整同步到 `.claude/hooks` / `.cursor/hooks`。

### 3. `npx` 要区分“init”与“已安装后的 init 对齐”

- `npx bmad-speckit init . --ai cursor-agent --yes`
  - 更接近“快速初始化入口”
  - 不保证等同于本仓库当前源码里的所有最新定制治理链

- `npm install --save-dev <本仓库>` 之后执行 `npx bmad-speckit-init --agent ...`
  - 这是当前推荐的消费者安装态对齐路径
  - 可以把包内 `_bmad/runtime/hooks` 与平台 hook 薄壳同步到项目实际运行目录

## 安装路径选择

### 路径 A：推荐，用本仓库源代码直接部署

适合：

- 你能访问本仓库源码
- 你希望拿到本仓库的完整定制能力，包括 runtime governance、hooks、i18n、dashboard

Windows：

```powershell
pwsh scripts/setup.ps1 -Target <消费项目根目录> -Full
```

或者：

```powershell
node scripts/init-to-root.js <消费项目根目录> --agent cursor --full
node scripts/init-to-root.js <消费项目根目录> --agent claude-code --full
```

说明：

- `setup.ps1` 是完整路径，额外包含 Skills 安装与检查
- `init-to-root.js` 更适合 CI、脚本化或无 PowerShell 的场景
- 如果你只想装 Cursor，可只跑 `--agent cursor`
- 如果你也要 Claude Code，补跑一次 `--agent claude-code`

推荐安装后立即补一轮显式核对：

```powershell
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly
```

### 路径 B：npm / npx 初始化

适合：

- 你希望快速初始化一个消费项目
- 你接受 npm 包当前提供的能力边界

```powershell
npx bmad-speckit init . --ai cursor-agent --yes
```

如果你随后要验证 runtime governance 是否真的完整落地，继续执行：

```powershell
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

注意：

- 这条路径更接近“快速初始化”
- 如果你明确需要本仓库里较新的运行时治理、双语或 dashboard 接线，优先回到路径 A
- 对 runtime governance 来说，**不要把“跑过 npx init”误认为“宿主 hooks 已经全部更新”**；请以 `.claude/hooks`、`.cursor/hooks` 与 settings/hooks.json 的实际文件为准

## 安装后，消费项目里应该出现什么

至少应出现以下目录或文件：

```text
<consumer-root>/
├─ _bmad/
├─ _bmad-output/
├─ .cursor/
├─ .claude/
├─ specs/
└─ package.json        # 非 Node 项目可选
```

## 第一步：验证骨架已安装

在消费项目根目录运行：

```powershell
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly
```

再做手动检查：

```powershell
$checks = @(
  '_bmad',
  '_bmad\_config\architecture-gates.yaml',
  '_bmad\_config\continue-gate-routing.yaml',
  '.cursor\hooks.json',
  '.claude\settings.json',
  '_bmad-output',
  'specs'
)

foreach ($path in $checks) {
  if (Test-Path $path) {
    Write-Host "[OK] $path" -ForegroundColor Green
  } else {
    Write-Host "[MISSING] $path" -ForegroundColor Red
  }
}
```

如果这些都不存在或明显缺项，不要继续配 provider / MCP，先回头修安装。

## 1.1 安装态核对清单

下面这份清单专门回答“消费项目安装后到底有没有装对”。按 `node_modules`、`_bmad/runtime/hooks`、`.claude/hooks`、`.cursor/hooks`、宿主配置 五层一次性核对。

```powershell
cd <consumer-root>

$checks = @(
  'node_modules',
  '_bmad\runtime\hooks\governance-runtime-worker.cjs',
  '_bmad\runtime\hooks\governance-remediation-runner.cjs',
  '.claude\hooks\governance-runtime-worker.cjs',
  '.claude\hooks\governance-remediation-runner.cjs',
  '.claude\hooks\post-tool-use.cjs',
  '.cursor\hooks\governance-runtime-worker.cjs',
  '.cursor\hooks\governance-remediation-runner.cjs',
  '.cursor\hooks\post-tool-use.cjs',
  '.claude\settings.json',
  '.cursor\hooks.json'
)

foreach ($path in $checks) {
  if (Test-Path $path) {
    Write-Host "[OK] $path" -ForegroundColor Green
  } else {
    Write-Host "[MISSING] $path" -ForegroundColor Red
  }
}
```

通过标准：

- `_bmad/runtime/hooks` 下两个 governance CJS 文件存在
- `.claude/hooks` 下两个 governance CJS 文件存在
- `.cursor/hooks` 下两个 governance CJS 文件存在
- `.claude/settings.json` 与 `.cursor/hooks.json` 存在

如果 `.claude/hooks/governance-runtime-worker.cjs` 或 `.cursor/hooks/governance-remediation-runner.cjs` 缺失，直接补跑：

```powershell
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

## 第二步：配置 Cursor / Claude Code

### Cursor

重点看：

- [cursor-setup.md](./cursor-setup.md)
- [runtime-dashboard-stable-launcher.md](./runtime-dashboard-stable-launcher.md)

消费者项目里你最需要确认的是：

1. `.cursor/hooks.json` 存在
2. `.cursor/hooks/` 下有 runtime dashboard 与 governance 相关 hook 副本
3. 进入 session 后 dashboard 能自动复用或自动启动

最少核对这几个文件：

- `.cursor/hooks/post-tool-use.cjs`
- `.cursor/hooks/governance-runtime-worker.cjs`
- `.cursor/hooks/governance-remediation-runner.cjs`
- `.cursor/hooks.json`

手动兜底命令：

```bash
npx bmad-speckit dashboard-start --open
npx bmad-speckit dashboard-status
```

### Claude Code

重点看：

- [claude-code-setup.md](./claude-code-setup.md)
- [runtime-dashboard-stable-launcher.md](./runtime-dashboard-stable-launcher.md)

消费者项目里你最需要确认的是：

1. `.claude/hooks/` 存在 session-start 相关 hook
2. `.claude/settings.json` 已包含对应 hook 配置
3. 进入 Claude session 后 dashboard 能自动复用或启动

最少核对这几个文件：

- `.claude/hooks/post-tool-use.cjs`
- `.claude/hooks/stop.cjs`
- `.claude/hooks/governance-runtime-worker.cjs`
- `.claude/hooks/governance-remediation-runner.cjs`
- `.claude/settings.json`

如果宿主没有执行相关 hook，仍可把下面命令当成安装校验或排障 fallback：

```bash
npx bmad-speckit dashboard-start --open
```

说明：

- dashboard 的自动启动是通过宿主 hooks 完成的
- 上面的手工命令只用于 dashboard 生命周期验证与排障，不代表治理或 post-audit 主路径需要人工触发
- 默认不需要单独启动 MCP server，dashboard 本身即可提供人工可见的运行时观察能力
- 只有当你明确需要工具化的 runtime 接口时，才考虑 `runtime-mcp`

## 第三步：配置 provider

这一步只在你需要“治理 runtime 真实访问模型服务”时才做。

主配置文件：

```text
<consumer-root>/_bmad/_config/governance-remediation.yaml
```

详细字段说明见：

- [provider-configuration.md](./provider-configuration.md)

### 最小推荐配置

```yaml
version: 1

primaryHost: cursor

packetHosts:
  - cursor
  - claude

provider:
  mode: openai-compatible
  id: openai-prod
  displayName: OpenAI Production
  baseUrl: https://api.openai.com/v1
  model: gpt-4.1-mini
  apiKeyEnv: OPENAI_API_KEY
  timeoutMs: 30000
```

### 关键规则

1. 优先用 `apiKeyEnv`，不要把 key 写进仓库文件
2. `baseUrl` 写基础前缀，不要手动补 `/chat/completions`
3. `model` 直接写 provider 接受的真实模型名
4. provider 配置属于消费项目，不属于本仓库开发时的全局配置

### 环境变量示例

PowerShell：

```powershell
$env:OPENAI_API_KEY = "your-key"
```

Bash：

```bash
export OPENAI_API_KEY="your-key"
```

## 第四步：启动 runtime dashboard

无论你用 Cursor 还是 Claude，消费者项目都建议先确认 dashboard 能工作。

推荐命令：

```bash
npx bmad-speckit dashboard-start --open
npx bmad-speckit dashboard-status
```

停止：

```bash
npx bmad-speckit dashboard-stop
```

如果只想拿一份快照：

```bash
npx bmad-speckit dashboard --json --include-runtime --output-json _bmad-output/dashboard/runtime-dashboard.json
```

## 关于 runtime-mcp

`runtime-mcp` 当前定位为增强能力，而不是默认安装路径的一部分。

默认安装：

- 不生成 `.mcp.json`
- 不生成 `.runtime-mcp/...`
- 不要求用户额外启动 MCP server

只有在你明确需要把 runtime 信息作为 agent 工具接口暴露时，才显式启用：

```powershell
node scripts/init-to-root.js <消费项目根目录> --agent cursor --with-mcp
node scripts/init-to-root.js <消费项目根目录> --agent claude-code --with-mcp
```

对应布局与边界见：

- [runtime-mcp-installation.md](./runtime-mcp-installation.md)

## 第五步：做最小验活

### 安装验活

```powershell
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly
```

### 最小复验命令列表

如果你只想保留一套最短、最有价值的复验命令，当前推荐这组：

```powershell
cd <consumer-root>

# 1. 基础骨架
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly

# 2. CLI 是否可用
npx bmad-speckit check

# 3. 强制对齐 Claude / Cursor hooks
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor

# 4. 手动核对治理关键文件
Test-Path .claude\hooks\governance-runtime-worker.cjs
Test-Path .claude\hooks\governance-remediation-runner.cjs
Test-Path .cursor\hooks\governance-runtime-worker.cjs
Test-Path .cursor\hooks\governance-remediation-runner.cjs

# 5. dashboard smoke
npx bmad-speckit dashboard-status
```

判定规则：

- 第 1、2 步必须成功
- 第 3 步必须无报错
- 第 4 步四个 `Test-Path` 都应返回 `True`
- 第 5 步至少应返回 dashboard 状态，不应报 CLI 解析失败

### dashboard 验活

```bash
npx bmad-speckit dashboard-start
npx bmad-speckit dashboard-status
```

### provider 验活

如果你已经配置了 `governance-remediation.yaml` 和环境变量，建议先做最小 smoke，而不是直接跑完整治理链路。

参考：

- [provider-configuration.md](./provider-configuration.md)

### Runtime Governance 验活说明

当前仓库已经补齐消费项目零-`scripts/` 的治理运行链。也就是说：

- runtime governance 真正使用的是 hooks / `_bmad/runtime/hooks`
- 不是消费项目根的 `scripts/`

因此验活时应当优先检查：

- `.claude/hooks/governance-runtime-worker.cjs`
- `.claude/hooks/governance-remediation-runner.cjs`
- `.cursor/hooks/governance-runtime-worker.cjs`
- `.cursor/hooks/governance-remediation-runner.cjs`

而不是去找：

- `<consumer>/scripts/governance-runtime-worker.*`
- `<consumer>/scripts/governance-remediation-runner.*`

如果你在真实 consumer 里遇到以下问题：

- hook 执行时报 `MODULE_NOT_FOUND`
- packaged worker 报 schema 缺失
- governance rerun history 报 `RunScoreRecord stage enum` 校验失败

先看：

- [consumer-packaging-troubleshooting.md](./consumer-packaging-troubleshooting.md)

### CLI 入口排障

对消费项目来说，**不要依赖全局 `bmad-speckit` shim**。优先使用：

```powershell
cd <consumer-root>
npx bmad-speckit version
```

原因：

- `npx bmad-speckit` 会优先尝试当前项目安装树里的 CLI 入口
- 直接输入 `bmad-speckit` 时，Windows 可能先命中全局 shim（例如 `nvm` / 全局 npm bin）
- 一旦全局 shim 指向旧版本或不存在的安装树，就会出现“本地项目明明装了，但命令还是坏的”假象

建议检查：

```powershell
where bmad-speckit
```

如果输出落在全局路径，例如：

- `D:\nvm4w\nodejs\bmad-speckit.cmd`

那说明你当前 shell 里存在全局 shim 干扰。此时：

1. **不要**继续用裸命令 `bmad-speckit`
2. 先在消费项目根目录执行 `npx bmad-speckit ...`
3. 如果你怀疑 `npx` 也受环境污染，可改用：

```powershell
npm exec bmad-speckit -- version
```

最小验活建议：

```powershell
cd <consumer-root>
npx bmad-speckit version
npx bmad-speckit check
```

如果这两条能跑通，再继续执行：

```powershell
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

## Hook 提示开关

如果你希望本项目 hooks 在执行时把提示信息直接打印出来，可以打开：

```json
{
  "env": {
    "BMAD_HOOKS_VERBOSE": "1"
  }
}
```

推荐放置位置：

- Claude Code：`<consumer>/.claude/settings.json`
- 或宿主等效的项目级环境配置

当前语义：

- `BMAD_HOOKS_VERBOSE=0`
  - 默认静默，只保留必要 hook 结果
- `BMAD_HOOKS_VERBOSE=1`
  - 输出 hook 级提示，包括：
    - `pre-continue-check passed`
    - `pre-continue-check failed`
    - `pre-continue-check skipped: artifact self write`
    - 以及 governance rerun 入队、worker started / skipped 等信息

这能帮助你快速判断：

1. hook 是否真的被调用
2. 是否因为 self-write 被主动跳过
3. 是否真的命中了 continue gate 拦截

## 推荐阅读顺序

如果你是第一次给一个消费项目安装，建议按这个顺序读：

1. 本文：消费者安装主路径
2. [migration.md](./migration.md)：如果目标项目已经有旧版 `_bmad`
3. [cursor-setup.md](./cursor-setup.md) 或 [claude-code-setup.md](./claude-code-setup.md)
4. [runtime-dashboard-stable-launcher.md](./runtime-dashboard-stable-launcher.md)
5. [provider-configuration.md](./provider-configuration.md)
6. [consumer-packaging-troubleshooting.md](./consumer-packaging-troubleshooting.md)

## 审计结论

针对“消费者项目全新安装”这个目标，现有文档体系在这篇文档补上之前并不够聚合，信息是分散的：

- 安装主路径在 `README` 和 `getting-started`
- provider 配置在单独 how-to
- dashboard 稳定启动又在另一篇 how-to

现在补上本文后，消费者项目安装链路已经有了一份相对完整、可执行的入口文档。

但仍要明确边界：

- 当前正式支持面应理解为 Cursor / Claude 两条消费者安装路径
- runtime-mcp 保留为显式启用的增强能力，不是默认安装要求
- 如果你要的是“消费项目接上真实 provider 并跑治理链路”，当前支持配置，但 smoke/一键验活脚本还可以继续加强
