# Runtime Dashboard Stable Launcher Requirement

## 背景

当前 runtime dashboard 已经具备本地 live server、UI、MCP 相关基础能力，但在“消费项目安装后如何稳定启动”这一点上仍然缺少完整产品化方案。

现状问题：

1. `bmad-speckit dashboard-live` 只能前台阻塞启动，退出 session 后服务随之结束。
2. 现有 `scripts/start-runtime-dashboard-server.cjs` / `scripts/run-runtime-dashboard-forever.cjs` 仍是仓库内临时脚本，不是消费项目安装后的正式入口。
3. 用户在 Cursor / Claude Code CLI 中进入项目后，没有像 Serena MCP 那样稳定、可感知、可恢复的 web server 生命周期管理。
4. 缺少统一 state/health/pid/url 元数据约定，导致“服务是否已启动、地址是什么、是否可复用”无法稳定判断。

## 目标

为消费项目安装后的 runtime dashboard 提供一套稳定启动方案，优先实现：

1. `CLI 启动器 + 后台守护 + 固定 health 检查 + 自动打开浏览器`。
2. 支持 Cursor / Claude Code CLI 用户在项目内显式启动并稳定复用 dashboard server。
3. 启动器能把服务状态写入项目内 state 文件，供 CLI / MCP / 后续自动化逻辑读取。
4. 启动器具备幂等性：若已有健康服务在运行，则复用现有实例而不是重复起多个端口。

## 范围

本轮范围内：

1. requirement + execution plan 文档。
2. `start-runtime-dashboard-server` 正式化：
   - 启动 server
   - 写入 state 元数据
   - 输出 url / pid / health 信息
3. `run-runtime-dashboard-forever` 正式化：
   - 后台常驻
   - 守护 state 文件
   - 清晰的退出与重启行为
4. `bmad-speckit` CLI 接线：
   - 提供稳定用户入口
   - 支持 health 检查 / 复用 / open browser
5. state 管理：
   - server metadata file
   - pid / url / port / started_at / root / health status
6. 验证：
   - CLI 启动
   - health 成功
   - 重复启动复用
   - 浏览器自动打开逻辑至少完成可验证接线

## 非目标

本轮不做：

1. 真正“进入 Cursor / Claude Code CLI 即自动启动”的 host-level hook 集成。
2. 完整 MCP 自动拉起编排。
3. 跨机器/跨用户的系统服务安装（如 Windows Service、launchd、systemd）。
4. 生产级 daemon supervisor（如 pm2 / NSSM）集成。

## 用户故事

### Story 1: 显式启动

作为消费项目用户，
我希望在项目根目录执行一个稳定命令，
从而自动拉起 runtime dashboard server、完成 health 检查并打开浏览器。

### Story 2: 幂等复用

作为消费项目用户，
我希望重复执行启动命令时优先复用已有健康实例，
从而避免多个 dashboard server 冲突占端口。

### Story 3: 会话可恢复

作为 Cursor / Claude Code CLI 用户，
我希望启动后把服务 url / pid / port / health 写入项目 state，
从而后续命令或 MCP 可以稳定读取并连接同一个 dashboard。

## 行为规格

### 场景 1：首次启动

WHEN 用户在消费项目运行 runtime dashboard 启动命令
THEN CLI 应在后台拉起 dashboard server
AND 执行固定 health 检查
AND 将 server metadata 写入项目 state 文件
AND 默认输出最终可访问 URL
AND 在启用 open 选项时自动打开浏览器

### 场景 2：重复启动

WHEN 已有 dashboard server 运行且 health 成功
THEN CLI 不应重复创建新实例
AND 应直接返回已有实例 URL
AND 应更新/确认 state 文件仍有效

### 场景 3：脏状态恢复

WHEN state 文件存在但 pid 已失效或 health 失败
THEN CLI 应识别为 stale state
AND 清理或覆盖旧 metadata
AND 重新拉起新实例

### 场景 4：CLI 可观测性

WHEN 用户执行启动命令
THEN CLI 输出中至少包含：
- mode（started / reused / restarted）
- url
- port
- metadata path

## 验收标准

1. 存在正式 requirement/plan 文档，描述消费项目安装后的稳定启动路径。
2. 存在正式脚本与 CLI 接线，而不是只靠仓库内临时手工脚本。
3. 启动后可写入项目内 state 文件，至少包含：`pid`、`port`、`url`、`started_at`、`root`。
4. 再次执行启动命令时，若现有实例健康，则返回 `reused` 而不是重新起服。
5. 若 state 已失效，则能识别并完成 `restarted` 流程。
6. 支持 `--open` 或等价选项，完成浏览器自动打开接线。
7. 至少有一组自动化测试覆盖：
   - 首次启动
   - 重复启动复用
   - stale state 重启
   - health 检查

## 交付物

1. requirement 文档：本文件。
2. execution plan 文档。
3. 启动器脚本。
4. 后台守护脚本。
5. state 管理实现。
6. CLI 接线。
7. 验证测试。
