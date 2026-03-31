# Runtime Dashboard Host Bootstrap Release Notes

## 分层真相

runtime dashboard 宿主自动接线现在按三层分工：

1. `_bmad/`
   - **唯一发布真相**
   - 包含 Cursor / Claude 宿主接线脚本源文件
   - 包含 shared runtime hook helper

2. `.claude/` / `.cursor/`
   - **本仓运行时副本**
   - 由 `init-to-root` 或本仓初始化同步生成
   - 不再承担发布真相职责

3. 消费项目
   - 安装或执行 `init-to-root` 后，从 `_bmad` 同步获得运行时副本
   - Cursor / Claude Code CLI 在 session-start 时自动复用 dashboard server

## 最终自动拉起行为

### Cursor

消费项目进入 Cursor session 后：

1. `.cursor/hooks.json` 的 `sessionStart` 触发
2. 调用 `.cursor/hooks/runtime-dashboard-session-start.js`
3. 该脚本转调 `_bmad/runtime/hooks/runtime-dashboard-auto-start.js`
4. shared helper 走 `ensure-runtime-dashboard-server` / `dashboard-start` 的复用逻辑
5. 若已有健康服务：静默复用
6. 若需要首次拉起或重启：安静启动，仅在必要时提示 URL

### Claude Code CLI

消费项目进入 Claude Code CLI session 后：

1. `.claude/hooks/session-start.js` 触发
2. 同样调用 `_bmad/runtime/hooks/runtime-dashboard-auto-start.js`
3. 复用同一份 server state
4. 健康实例默认静默复用
5. 首次启动 / 重启时输出一行 `[BMAD Dashboard] <url>`

## 生命周期命令

消费项目里统一可用：

```bash
npx bmad-speckit dashboard-start --open
npx bmad-speckit dashboard-status
npx bmad-speckit dashboard-stop
```

## 发布清单

### 发布真相（tracked）

- `_bmad/claude/hooks/session-start.js`
- `_bmad/cursor/hooks/runtime-dashboard-session-start.js`
- `_bmad/runtime/hooks/runtime-dashboard-auto-start.js`
- `scripts/ensure-runtime-dashboard-server.cjs`
- `scripts/start-runtime-dashboard-server.cjs`
- `scripts/run-runtime-dashboard-forever.cjs`
- `scripts/runtime-dashboard-server-state.cjs`
- `packages/bmad-speckit/src/commands/dashboard-start.js`
- `packages/bmad-speckit/src/commands/dashboard-status.js`
- `packages/bmad-speckit/src/commands/dashboard-stop.js`

### 运行时副本（由同步生成）

- `.claude/hooks/session-start.js`
- `.cursor/hooks.json`
- `.cursor/hooks/runtime-dashboard-session-start.js`

### 验收矩阵

- `tests/acceptance/runtime-dashboard-host-bootstrap.test.ts`
- `tests/acceptance/runtime-dashboard-stable-launcher.test.ts`
- `tests/acceptance/runtime-dashboard-lifecycle-cli.test.ts`
- `tests/acceptance/runtime-dashboard-mcp-server.test.ts`
- `tests/acceptance/accept-install-consumer-cli.test.ts`

## 发布结论

发布后，消费项目中的 Cursor / Claude Code CLI 最终体验是：

1. 默认启用 dashboard 自动拉起/复用
2. 健康实例静默复用，接近 Serena 风格
3. 生命周期仍保留显式命令兜底
4. `_bmad` 是唯一可维护、可发布、可审计的真相层
