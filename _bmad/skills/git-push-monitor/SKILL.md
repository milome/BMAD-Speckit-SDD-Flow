---
name: git-push-monitor
description: Automatically monitor long-running git push operations in the background. Continuously checks push status until completion, displays progress, and verifies success. Use when pushing large commits/files that may timeout or hang, or when you need to track push progress without blocking the terminal.
---

# Git Push Monitor

Automatically monitor git push operations that may take a long time or hang. Starts background monitoring, periodically checks push status, displays progress, and verifies completion.

## Script Path（可移植）

脚本随 skill 安装在 **Cursor 用户目录** 下，与其它 Cursor skill 一致，便于迁移到其它机器：

- **约定目录**：`{SKILLS_ROOT}\git-push-monitor\scripts\`
  - Windows (PowerShell): `$HOME\.cursor\skills\git-push-monitor\scripts\`
  - Linux/macOS: `~/.cursor/skills/git-push-monitor/scripts/`
- **PowerShell 可移植写法**（推荐，任意机器执行同一套命令即可）：
  - `$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1`
  - `$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1`
- 调用时请使用上述基于 `$HOME` 的路径，勿用当前仓库下的 `.\scripts\`。

## Quick Start

When a git push is running in the background or may take a long time:

```powershell
# Auto-detect branch and monitor（可移植路径）
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1"

# Or specify branch explicitly
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1" -BranchName "main" -MaxWaitSeconds 900
```

To start a push in background and automatically monitor:

```powershell
# Auto-detect branch, start push, and monitor
& "$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1"

# Or specify branch explicitly
& "$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1" -BranchName "main"
```

## Usage

### Monitoring an Existing Push

If a git push is already running (in background or another terminal):

```powershell
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1"
```

The script will:
- Auto-detect the current branch
- Auto-detect the push output file (if available)
- Monitor until push completes or timeout
- Display latest commit information on success

### Starting Push with Monitor

To start a push and automatically monitor it:

```powershell
& "$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1"
```

This will:
- Start git push in a background job
- Immediately begin monitoring
- Display progress and completion status

### Parameters

**monitor-push.ps1:**
- `-BranchName`: Branch to monitor (default: auto-detect from current branch)
- `-RemoteName`: Remote name (default: "origin")
- `-OutputFile`: Path to push output file (default: auto-detect from Cursor terminal files)
- `-MaxWaitSeconds`: Maximum wait time in seconds (default: 600)
- `-CheckInterval`: Check interval in seconds (default: 5)

**start-push-with-monitor.ps1:**
- `-BranchName`: Branch to push (default: auto-detect from current branch)
- `-RemoteName`: Remote name (default: "origin")
- `-MaxWaitSeconds`: Maximum wait time in seconds (default: 600)
- `-CheckInterval`: Check interval in seconds (default: 5)

## How It Works

1. **Initial State Capture**: Records the current remote branch commit hash
2. **Periodic Checking**: Every 5 seconds (configurable), checks if remote branch has updated
3. **Progress Display**: Shows latest output from push process if available
4. **Completion Detection**: Detects when remote commit matches local commit
5. **Verification**: Displays latest commits to confirm successful push

## Resources

### Scripts（位于 Cursor skill 目录，可移植）

- **monitor-push.ps1**：`$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1` — 轮询 push 状态直至完成
- **start-push-with-monitor.ps1**：`$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1` — 后台执行 push 并启动监控

两脚本均支持自动检测当前分支与输出文件。调用时使用基于 `$HOME` 的路径即可在不同机器上复用。
