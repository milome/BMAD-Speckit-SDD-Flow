# 路径占位符约定

> 本项目的路径占位符定义，用于跨平台文档与配置。

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
