# Codex CLI 消费项目 MCP 安装布局

## 目标

本方案面向“消费项目”安装 BMAD/Speckit 能力后，额外为 **Codex CLI** 生成一套可直接启动的本地 MCP server 布局。

注意：

- 这里讨论的是 **安装到消费项目后的 MCP 运行时布局**
- 不是启动 `BMAD-Speckit-SDD-Flow` 仓库自身的 MCP
- server 应放在 **消费项目目录内**，便于项目级配置、相对路径启动、随项目迁移与版本控制

## 安装器应生成的完整目录结构

以下以消费项目根目录记作 `<consumer-root>`。

```text
<consumer-root>/
├─ _bmad/
├─ _bmad-output/
├─ .codex/
│  ├─ mcp/
│  │  └─ bmad-runtime/
│  │     ├─ server/
│  │     │  ├─ package.json
│  │     │  ├─ dist/
│  │     │  │  ├─ index.js
│  │     │  │  ├─ tools/
│  │     │  │  └─ lib/
│  │     │  ├─ scripts/
│  │     │  │  ├─ build.ps1
│  │     │  │  ├─ build.sh
│  │     │  │  ├─ smoke.ps1
│  │     │  │  └─ smoke.sh
│  │     │  ├─ config/
│  │     │  │  └─ server.config.json
│  │     │  ├─ logs/
│  │     │  ├─ tmp/
│  │     │  └─ README.md
│  │  └─ templates/
│  │     ├─ codex.mcp.json
│  │     └─ server.config.json
│  ├─ install/
│  │  ├─ install-consumer-mcp.ps1
│  │  ├─ install-consumer-mcp.sh
│  │  ├─ verify-consumer-mcp.ps1
│  │  └─ verify-consumer-mcp.sh
│  └─ generated/
│     └─ mcp.json
├─ .mcp.json
└─ AGENTS.md
```

## 目录职责

### `.codex/mcp/bmad-runtime/server/`

消费项目内真正要被 Codex CLI 启动的 MCP server。

要求：

- `stdio` 模式启动
- 不依赖本仓库的绝对路径
- 只依赖消费项目内的 `_bmad/`、`_bmad-output/`、`.codex/mcp/...`
- 可单独 smoke test

### `.codex/mcp/templates/`

安装器模板目录。

要求：

- 存放可渲染的 `.mcp.json` 模板
- 存放 server 自身配置模板

### `.codex/install/`

安装与验活脚本。

要求：

- 安装时生成消费项目所需目录
- 渲染 `.mcp.json`
- 检查 Node / npm / dist 文件是否齐全
- 可做本地验活

### `.codex/generated/mcp.json`

安装器生成的中间产物，便于调试和审计。

### `<consumer-root>/.mcp.json`

消费项目最终让 Codex CLI 读取的 MCP 配置。

## 推荐的 Codex CLI MCP 配置片段

如果消费项目里的 server 放在：

`<consumer-root>/.codex/mcp/bmad-runtime/server/dist/index.js`

则推荐生成：

```json
{
  "mcpServers": {
    "bmad-runtime": {
      "command": "node",
      "args": [
        ".codex/mcp/bmad-runtime/server/dist/index.js"
      ],
      "env": {
        "BMAD_PROJECT_ROOT": ".",
        "BMAD_OUTPUT_ROOT": "_bmad-output",
        "BMAD_MCP_LOG_DIR": ".codex/mcp/bmad-runtime/server/logs",
        "BMAD_MCP_TMP_DIR": ".codex/mcp/bmad-runtime/server/tmp"
      }
    }
  }
}
```

## 推荐 server.config.json 模板

路径：

`<consumer-root>/.codex/mcp/bmad-runtime/server/config/server.config.json`

```json
{
  "name": "bmad-runtime",
  "transport": "stdio",
  "projectRoot": ".",
  "bmadRoot": "_bmad",
  "outputRoot": "_bmad-output",
  "logDir": "logs",
  "tmpDir": "tmp",
  "features": {
    "readRuntimeContext": true,
    "readPolicies": true,
    "readScoringArtifacts": true,
    "emitSessionHints": true
  }
}
```

## 安装器应执行的动作

### 1. 创建目录

安装器应确保以下目录存在：

- `.codex/mcp/bmad-runtime/server/`
- `.codex/mcp/bmad-runtime/server/config/`
- `.codex/mcp/bmad-runtime/server/dist/`
- `.codex/mcp/bmad-runtime/server/logs/`
- `.codex/mcp/bmad-runtime/server/tmp/`
- `.codex/mcp/templates/`
- `.codex/install/`
- `.codex/generated/`

### 2. 复制运行时产物

安装器应把“可运行的 MCP server 文件”复制到：

- `.codex/mcp/bmad-runtime/server/dist/`

而不是指向 BMAD-Speckit-SDD-Flow 仓库绝对路径。

### 3. 渲染配置模板

安装器应基于模板生成：

- `.codex/generated/mcp.json`
- `<consumer-root>/.mcp.json`
- `.codex/mcp/bmad-runtime/server/config/server.config.json`

### 4. 验活

验活至少分两层：

1. 文件层
   - `dist/index.js` 存在
   - `.mcp.json` 存在
   - `server.config.json` 存在
2. 进程层
   - 可执行 `node .codex/mcp/bmad-runtime/server/dist/index.js`
   - 进程能正常启动并等待 stdio

## 推荐验活命令

### Windows

```powershell
node .codex/mcp/bmad-runtime/server/dist/index.js
```

如果 server 支持 `--smoke`，则更推荐：

```powershell
node .codex/mcp/bmad-runtime/server/dist/index.js --smoke
```

### POSIX

```bash
node .codex/mcp/bmad-runtime/server/dist/index.js
```

## 设计原则

### 必须避免

- `.mcp.json` 里写死 `D:\Dev\BMAD-Speckit-SDD-Flow\...`
- 让消费项目运行时依赖本仓库源码目录存在
- 把 server 放在 `_bmad/` 这种主要用于方法资产分发的位置

### 推荐做法

- 方法资产继续放 `_bmad/`
- MCP 可执行运行时放 `.codex/mcp/bmad-runtime/server/`
- 安装器把“可执行产物 + 配置模板”一起落到消费项目

## 建议的后续实现

为了真正落地，仓库内应补两类产物：

1. `scripts/mcp/consumer/` 下的安装与验活脚本
2. `templates/consumer-mcp/` 下的 `.mcp.json` 与 `server.config.json` 模板

下一步可直接在本仓库补一套脚本草案，作为“消费项目安装后可用”的 MCP 发布/安装雏形。

---

## Provider 配置补充

如果 consumer MCP 后续要接入真实模型服务，除了安装 `.mcp.json` / `server.config.json` / `dist/index.js` 之外，还需要补 provider 层配置。

目前 provider 侧的实现入口主要在：

- [governance-remediation-config.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/scripts/governance-remediation-config.ts)
- [governance-provider-adapter.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/scripts/governance-provider-adapter.ts)

已支持：

- `openai-compatible`
- `anthropic-compatible`
- `http-json`
- `stub`

更细一层的 provider 配置说明，包括：

- OpenAI / Anthropic / 自定义 provider 的 API key 注入方式
- endpoint / baseUrl 约定
- model 字段的当前语义
- model mapping 的推荐扩展方向

见：

- [provider-configuration.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/how-to/provider-configuration.md)

建议阅读顺序：

1. 先看本文，理解 consumer MCP 安装布局
2. 再看 [provider-configuration.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/how-to/provider-configuration.md)，补齐真实 provider 接线
