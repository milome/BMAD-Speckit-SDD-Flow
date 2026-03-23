# 环境要求

本文档明确 BMAD-Speckit-SDD-Flow 项目的运行环境依赖。

## 必需/可选组件

| 组件 | 必需 | 用途 | 替代方案 |
|------|------|------|----------|
| **Node.js** | 必需 | `npm test`、`npx bmad-speckit`、init 部署 | 无 |
| **PowerShell ≥7** | 部分流程 | `scripts/setup.ps1`、`scripts/bmad-sync-from-v6.ps1` | 见下方 Linux/macOS |
| **Git** | 必需 | 版本控制、sync、worktree | 无 |
| **Python ≥3.8** | 可选 | `bmad-customization-backup`、`bmad-distillator` | 无 Python 时相关 skills 不可用 |

## Linux/macOS 用户

当无 PowerShell 时：

- **setup**：使用 `scripts/setup.sh` 或手动复制 `_bmad/` 内容到 `.cursor/`、`.claude/`
- **sync**：使用 `scripts/bmad-sync-from-v6.sh`（若存在）或 `bmad-sync-from-v6.ps1` 需 pwsh
- **push 监控**：使用 `./scripts/monitor-push.sh` 完成等价于 `monitor-push.ps1` 的轮询逻辑

```bash
./scripts/monitor-push.sh                    # 自动检测分支
./scripts/monitor-push.sh -BranchName main -MaxWaitSeconds 900
```

## Cursor vs Claude Code

| 环境 | Skills 位置 | Commands 位置 |
|------|-------------|---------------|
| Cursor | `.cursor/skills/`、`$HOME/.cursor/skills/` | `.cursor/commands/` |
| Claude Code CLI | `.claude/skills/`、`skills/` | `.claude/commands/` |

若仅使用 Cursor，未部署 Claude 版 skill 时，部分功能缺失；反之亦然。
