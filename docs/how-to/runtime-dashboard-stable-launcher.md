# Runtime Dashboard Stable Launcher

## 目标

这份说明面向消费项目用户，描述 runtime dashboard 在 Cursor / Claude Code CLI 项目中的稳定启动方式，以及自动接线骨架的最终行为。

## 生命周期命令

### 1. 启动或复用

```bash
npx bmad-speckit dashboard-start --open
```

行为：

1. 若已有健康实例，直接复用。
2. 若 state 存在但实例失效，自动重启。
3. 首次启动时拉起后台常驻 server。
4. `--open` 时自动打开浏览器。

输出 JSON 至少包含：

- `mode`: `started` / `reused` / `restarted`
- `url`
- `port`
- `pid`
- `state_path`

### 2. 查看状态

```bash
npx bmad-speckit dashboard-status
```

用途：

1. 查看当前 metadata。
2. 确认 pid 是否仍存活。
3. 确认 `health_url` 是否可访问。

### 3. 停止服务

```bash
npx bmad-speckit dashboard-stop
```

用途：

1. 停掉后台 dashboard server。
2. 清理项目内 state 文件。

## 状态文件

稳定启动链路把 server metadata 写入：

```text
outputs/runtime/runtime-dashboard/server.json
```

字段包括：

- `pid`
- `host`
- `port`
- `url`
- `health_url`
- `started_at`
- `root`
- `mode`

## Cursor 消费项目

消费项目安装后，`init-to-root` / `npm install` 会同步：

- `.cursor/hooks/runtime-dashboard-session-start.js`
- `._bmad/runtime/hooks/runtime-dashboard-auto-start.js`
- `.cursor/hooks.json` 中的 `sessionStart` 自动接线

当前骨架行为：

1. 用户进入 Cursor 项目 session 时，Cursor host 会触发 `sessionStart`。
2. `runtime-dashboard-session-start.js` 会调用 shared helper。
3. shared helper 走 `dashboard-start` 的复用逻辑。
4. 如果项目允许自动启动，则复用或拉起 dashboard server。

这意味着：

- 理想路径下，用户不需要再手工敲 `dashboard-start`。
- 若 host 没执行 hook，仍可手工执行 `dashboard-start --open` 作为 fallback。

## Claude Code CLI 消费项目

消费项目安装并同步 `claude-code` agent 后，会有：

- `.claude/hooks/session-start.js`
- `_bmad/runtime/hooks/runtime-dashboard-auto-start.js`

当前骨架行为：

1. Claude session start 时执行 `.claude/hooks/session-start.js`。
2. hook 在 checkpoint 注入之外，追加 dashboard auto-start 调用。
3. 若服务可复用，则输出 `[BMAD Dashboard] reused: <url>`。
4. 若服务不存在，则自动拉起并输出 `[BMAD Dashboard] started: <url>`。

## 推荐使用方式

### 当前最稳妥

如果你要确保一定有 dashboard：

```bash
npx bmad-speckit dashboard-start --open
```

### 自动接线可用时

如果消费项目宿主已正确执行 session-start hook：

1. 进入 Cursor 或 Claude Code CLI session。
2. dashboard server 自动复用或自动启动。
3. 需要确认时运行：

```bash
npx bmad-speckit dashboard-status
```

## 与 Serena 风格的关系

Serena 的体验是“宿主接入后自动连上 server”。

本项目当前已经具备两层能力：

1. **稳定 server 生命周期**：`dashboard-start/status/stop`
2. **宿主自动接线骨架**：Cursor / Claude session-start hook

所以：

- 在宿主 hook 正常执行时，用户可以不再手工输入启动命令。
- 在宿主 hook 未执行或被关闭时，仍然可以通过 `dashboard-start --open` 手工兜底。
