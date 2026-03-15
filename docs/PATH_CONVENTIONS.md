# 路径占位符约定

> 本项目的路径占位符定义，用于跨平台文档与配置。

## 三目录技能架构

| 目录 | 定位 | 技能数 | 加载方 |
|------|------|--------|--------|
| `skills/` | **公共通用技能** — 两个平台都能完整运行，无平台专用调度 | 7 | Cursor + Claude Code CLI 均加载 |
| `.cursor/skills/` | **Cursor 专用/优化版** — 主路径依赖 Cursor Task 等 Cursor 机制 | 8 | 仅 Cursor 加载 |
| `.claude/skills/` | **Claude Code CLI 适配版** — 映射为 `.claude/agents/`、auditor-* 等 CLI 执行体 | 8 (目标) | 仅 Claude Code CLI 加载 |

**同名技能覆盖机制**：Cursor 同名时 `.cursor/skills/` 优先于 `skills/`；Claude Code CLI 同名时 `.claude/skills/` 优先于 `skills/`。

**范围排除**：`.agents/skills/`（当前仅含 `qmd`）为外部执行体目录，不在三目录架构内。

### 引用规则

- 引用公共技能：`skills/X/SKILL.md`（如 `skills/code-review/SKILL.md`）
- 引用 Cursor 专用技能：`.cursor/skills/X/SKILL.md`（如 `.cursor/skills/speckit-workflow/SKILL.md`）
- 引用 Claude 适配技能：`.claude/skills/X/SKILL.md`（如 `.claude/skills/bmad-story-assistant/SKILL.md`）
- `.cursor/skills/` 中禁止出现 Claude 专用关键词（`Agent tool`、`subagent_type`、`.claude/agents/`）
- `.claude/skills/` 中禁止出现 Cursor 专用关键词（`mcp_task`、`Cursor Task`、`.cursor/rules/`）

## 占位符定义

| 占位符 | 含义 | Windows 展开 | macOS/Linux 展开 |
|--------|------|-------------|-----------------|
| `{SKILLS_ROOT}` | Cursor 全局 Skills 目录 | `%USERPROFILE%\.cursor\skills` | `~/.cursor/skills` |
| `{project-root}` | 当前项目根目录 | Cursor 工作区路径 | Cursor 工作区路径 |
| `{HOME}` | 用户主目录 | `%USERPROFILE%` | `~` 或 `$HOME` |

## 约定规则

1. **文档 / SKILL.md / 配置文件**：使用占位符 `{SKILLS_ROOT}`，不使用平台特定展开。
2. **PowerShell 脚本**：使用 `$HOME`（PowerShell 7 跨平台兼容）。
3. **Python 脚本**：使用 `Path.home()`。
4. **TypeScript/JS 代码**：使用 `process.env.USERPROFILE || process.env.HOME || os.homedir()`。
5. **YAML 配置**：使用 `{SKILLS_ROOT}` 占位符，由读取代码在运行时展开。
