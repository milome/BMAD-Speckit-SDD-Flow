# Runtime MCP Installation

`runtime-mcp` 不是默认安装产物。

默认消费者安装只覆盖：

- `_bmad/`
- `_bmad-output/`
- `.cursor/`
- `.claude/`
- runtime dashboard 与对应 hooks

只有在显式传入 `--with-mcp` 时，才会额外生成 runtime MCP 布局。

## 启用方式

在本仓库根目录执行：

```powershell
node scripts/init-to-root.js <consumer-root> --agent cursor --with-mcp
node scripts/init-to-root.js <consumer-root> --agent claude-code --with-mcp
```

也可以和 `--full` 组合：

```powershell
node scripts/init-to-root.js <consumer-root> --agent cursor --full --with-mcp
```

如果你没有传 `--with-mcp`：

- 不会生成 `.mcp.json`
- 不会生成 `.runtime-mcp/...`
- 不需要额外启动 MCP server

## 生成物

显式启用 `--with-mcp` 后，消费者项目里会新增：

```text
<consumer-root>/
├─ .mcp.json
└─ .runtime-mcp/
   ├─ server/
   │  ├─ dist/
   │  │  └─ index.cjs
   │  ├─ config/
   │  │  └─ server.config.json
   │  └─ README.md
   ├─ logs/
   └─ tmp/
```

这些文件是“增强能力布局”，不是默认必须文件。

## 默认安装与显式启用的差异

默认安装：

- 支持 dashboard
- 支持 runtime governance hooks
- 不生成 MCP 配置
- 不生成 `.runtime-mcp/...`

`--with-mcp` 安装：

- 保留默认安装的全部能力
- 额外生成 `.mcp.json`
- 额外生成 `.runtime-mcp/server/...`
- 可以把 runtime 信息通过 MCP 工具接口暴露给 agent

## 验活方式

### 1. 文件存在性

在消费者项目根目录确认：

```powershell
$checks = @(
  '.mcp.json',
  '.runtime-mcp\server\dist\index.cjs',
  '.runtime-mcp\server\config\server.config.json'
)

foreach ($path in $checks) {
  if (Test-Path $path) {
    Write-Host "[OK] $path" -ForegroundColor Green
  } else {
    Write-Host "[MISSING] $path" -ForegroundColor Red
  }
}
```

### 2. 进程验活

```powershell
node .runtime-mcp/server/dist/index.cjs
```

如果后续该入口支持 `--smoke`，优先使用：

```powershell
node .runtime-mcp/server/dist/index.cjs --smoke
```

### 3. 配置验活

确认 `.mcp.json` 中没有写死本仓库绝对路径，而是指向消费者项目内的相对路径。

## 边界说明

这篇文档只描述：

- 如何通过 `--with-mcp` 显式启用 runtime MCP
- 启用后会生成什么
- 怎么做最小验活
- 它与默认安装有何差异

它不表示：

- runtime MCP 已经成为默认消费者安装链路
- 所有消费者项目都必须生成 `.mcp.json`
- 不启用 MCP 就无法使用 dashboard 或运行时治理

恰好相反：

- dashboard 默认支持
- runtime governance hooks 默认支持
- runtime MCP 仅在显式启用时提供
