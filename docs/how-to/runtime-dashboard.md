# Runtime Dashboard 使用说明

这套 runtime dashboard 现在有三条并行但解耦的访问路径：

- Agent 接入：`MCP-first`
- 人工观察：`webserver-independent fallback`
- 本地脚本 / CLI：直接走 shared query core，必要时也可以复用 live dashboard HTTP

核心约束没有变：

- 单一数据投影来源是 `packages/scoring/dashboard/runtime-query.ts`
- MCP 只是 agent 工具入口，不是数据真相源
- live dashboard 不依赖 MCP 才能工作
- `bmad-speckit dashboard --json` 仍然可以直接产出 runtime snapshot JSON

## 什么时候用哪条路径

- 你要让 Cursor / Claude / Codex 把 runtime 当工具读：启动 `bmad-speckit runtime-mcp`
- 你要在本地持续观察 run、stage、score、SFT tab：启动 `bmad-speckit dashboard-live`
- 你只要拿一次快照给脚本、CI 或人工排查：执行 `bmad-speckit dashboard --json`

## 启动本地 live dashboard

运行：

```bash
npx bmad-speckit dashboard-live
```

默认绑定：

- Host: `127.0.0.1`
- Port: `43123`

也可以显式指定：

```bash
npx bmad-speckit dashboard-live --host 127.0.0.1 --port 43123
```

命令启动后会把 URL 打到 stdout。服务保持前台运行，直到收到 `SIGINT` 或 `SIGTERM`。

## 启动 runtime MCP server

运行：

```bash
npx bmad-speckit runtime-mcp
```

这个命令会以 stdio 方式启动 MCP server。默认行为是：

1. 如果没有传 `--dashboard-url`，自动启动本地 live dashboard
2. MCP tools 直接复用 shared query core 读取当前 run / stage / score / SFT summary
3. `open_dashboard` tool 返回 live dashboard URL，方便 agent 和人切换到可视化界面

如果你已经有一个 live dashboard 实例，可以复用它：

```bash
npx bmad-speckit runtime-mcp --dashboard-url http://127.0.0.1:43123
```

如果你想让 MCP 自己拉起 dashboard，但改端口：

```bash
npx bmad-speckit runtime-mcp --dashboard-port 43124 --host 127.0.0.1
```

## MCP 不可用时的 fallback

这是这套架构最重要的边界：

- MCP 没启动：`dashboard-live` 仍可正常打开和查询
- web server 没启动：`bmad-speckit dashboard --json` 仍可直接产出 snapshot
- 对 SFT CLI 来说：如果设置了 `BMAD_RUNTIME_DASHBOARD_URL` 或 `RUNTIME_DASHBOARD_URL`，会优先复用 HTTP dashboard；没有的话回退本地 shared core

换句话说，MCP 是 agent 入口，不应该成为整套 runtime 观测链路的单点故障。

## 查看 runtime snapshot JSON

如果你要直接拿机读快照，运行：

```bash
npx bmad-speckit dashboard --json --include-runtime --output-json _bmad-output/dashboard/runtime-dashboard.json
```

这会写出一份完整 snapshot，顶层字段固定为：

- `selection`
- `overview`
- `runtime_context`
- `stage_timeline`
- `score_detail`
- `sft_summary`

其中：

- `runtime_context` 给出当前 run、flow、current stage、scope
- `stage_timeline` 给出阶段时间线、phase score、迭代次数、veto
- `score_detail` 给出当前 run 的细粒度 score records
- `sft_summary` 给出 accepted / rejected / downgraded、target availability、rejection reasons、last bundle

## 直接查 live dashboard API

启动 `dashboard-live` 后，可以直接请求：

```text
GET /health
GET /api/snapshot
GET /api/overview
GET /api/runtime-context
GET /api/stage-timeline
GET /api/score-detail
GET /api/sft-summary
```

最常用的是：

- `/api/snapshot`：完整 runtime snapshot
- `/api/runtime-context`：当前 run / stage / scope
- `/api/sft-summary`：SFT tab 的数据源

## Agent 能看到什么

`runtime-mcp` 当前暴露这些工具：

- `get_current_run_summary`
- `get_stage_status`
- `get_score_gate_result`
- `preview_sft`
- `export_sft`
- `open_dashboard`
- `get_runtime_service_health`

这意味着 agent 既可以读当前 run/stage，也可以直接拿到 SFT preview 和 target compatibility，而不需要你在 UI 里手工点按钮。

## Rollout guardrails

上线或接入新 agent host 前，至少做这几项检查：

1. `npx bmad-speckit dashboard-live --help`
2. `npx bmad-speckit runtime-mcp --help`
3. 启动 live dashboard 后访问 `/health`
4. 用 `bmad-speckit dashboard --json` 检查 `runtime_context`、`stage_timeline`、`score_detail`、`sft_summary` 都有输出
5. 如果 MCP 未启动，确认 live dashboard 仍然可用，不允许整条链路直接 fail closed

这也是 fresh regression matrix 现在必须覆盖的 smoke 套件。
