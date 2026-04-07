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

如果你只照旧 README 的 Quick Start 做，信息还不够覆盖消费者项目的完整安装链，尤其是：

- provider 的 `baseUrl` / `apiKeyEnv` / `model` 怎么配
- runtime dashboard 如何自动启动、如何手动兜底

所以这篇文档给出一条真正可执行的消费者路径。

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

### 路径 B：npm / npx 初始化

适合：

- 你希望快速初始化一个消费项目
- 你接受 npm 包当前提供的能力边界

```powershell
npx bmad-speckit init . --ai cursor-agent --yes
```

注意：

- 这条路径更接近“快速初始化”
- 如果你明确需要本仓库里较新的运行时治理、双语或 dashboard 接线，优先回到路径 A

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

## 第二步：配置 Cursor / Claude Code

### Cursor

重点看：

- [cursor-setup.md](./cursor-setup.md)
- [runtime-dashboard-stable-launcher.md](./runtime-dashboard-stable-launcher.md)

消费者项目里你最需要确认的是：

1. `.cursor/hooks.json` 存在
2. `.cursor/hooks/` 下有 runtime dashboard 相关 hook 副本
3. 进入 session 后 dashboard 能自动复用或自动启动

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

如果宿主不触发 hook，也可以手动执行：

```bash
npx bmad-speckit dashboard-start --open
```

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

## 第五步：做最小验活

### 安装验活

```powershell
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly
```

### dashboard 验活

```bash
npx bmad-speckit dashboard-start
npx bmad-speckit dashboard-status
```

### provider 验活

如果你已经配置了 `governance-remediation.yaml` 和环境变量，建议先做最小 smoke，而不是直接跑完整治理链路。

参考：

- [provider-configuration.md](./provider-configuration.md)

## 推荐阅读顺序

如果你是第一次给一个消费项目安装，建议按这个顺序读：

1. 本文：消费者安装主路径
2. [migration.md](./migration.md)：如果目标项目已经有旧版 `_bmad`
3. [cursor-setup.md](./cursor-setup.md) 或 [claude-code-setup.md](./claude-code-setup.md)
4. [runtime-dashboard-stable-launcher.md](./runtime-dashboard-stable-launcher.md)
5. [provider-configuration.md](./provider-configuration.md)

## 审计结论

针对“消费者项目全新安装”这个目标，现有文档体系在这篇文档补上之前并不够聚合，信息是分散的：

- 安装主路径在 `README` 和 `getting-started`
- provider 配置在单独 how-to
- dashboard 稳定启动又在另一篇 how-to

现在补上本文后，消费者项目安装链路已经有了一份相对完整、可执行的入口文档。

但仍要明确边界：

- 当前正式支持面应理解为 Cursor / Claude 两条消费者安装路径
- 如果你要的是“消费项目接上真实 provider 并跑治理链路”，当前支持配置，但 smoke/一键验活脚本还可以继续加强
