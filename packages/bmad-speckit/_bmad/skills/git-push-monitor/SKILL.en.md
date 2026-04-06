<!-- BLOCK_LABEL_POLICY=B -->
---
name: git-push-monitor
description: Automatically monitor long-running git push operations in the background. Continuously checks push status until completion, displays progress, and verifies success. Use when pushing large commits/files that may timeout or hang, or when you need to track push progress without blocking the terminal.
---

# Git Push Monitor

Automatically monitor git push operations that may take a long time or hang. Starts background monitoring, periodically checks push status, displays progress, and verifies completion.

## Script path (portable)

Scripts ship with the skill under the **Cursor user directory**, like other Cursor skills, for easy migration across machines:

- **Convention**: `{SKILLS_ROOT}\git-push-monitor\scripts\`
  - Windows (PowerShell): `$HOME\.cursor\skills\git-push-monitor\scripts\`
  - Linux/macOS: `~/.cursor/skills/git-push-monitor/scripts/`
- **Portable PowerShell** (recommended; same commands on any machine):
  - `$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1`
  - `$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1`
- Always invoke using the `$HOME`-based paths above; do **not** use `.\scripts\` in the current repo.

## Quick start

When a git push is running in the background or may take a long time:

```powershell
# Auto-detect branch and monitor (portable path)
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1"

# Or specify branch explicitly
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1" -BranchName "main" -MaxWaitSeconds 900
```

To start a push in the background and automatically monitor:

```powershell
# Auto-detect branch, start push, and monitor
& "$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1"

# Or specify branch explicitly
& "$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1" -BranchName "main"
```

## Usage

### Monitoring an existing push

If a git push is already running (in the background or another terminal):

```powershell
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1"
```

The script will:

- Auto-detect the current branch
- Auto-detect the push output file (if available)
- Monitor until the push completes or times out
- Display latest commit information on success

### Starting push with monitor

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
- `-RemoteName`: Remote name (default: `origin`)
- `-OutputFile`: Path to push output file (default: auto-detect from Cursor terminal files)
- `-MaxWaitSeconds`: Maximum wait time in seconds (default: 600)
- `-CheckInterval`: Check interval in seconds (default: 5)

**start-push-with-monitor.ps1:**

- `-BranchName`: Branch to push (default: auto-detect from current branch)
- `-RemoteName`: Remote name (default: `origin`)
- `-MaxWaitSeconds`: Maximum wait time in seconds (default: 600)
- `-CheckInterval`: Check interval in seconds (default: 5)

## How it works

1. **Initial state capture**: Records the current remote branch commit hash
2. **Periodic checking**: Every 5 seconds (configurable), checks whether the remote branch has updated
3. **Progress display**: Shows latest output from the push process when available
4. **Completion detection**: Detects when the remote commit matches the local commit
5. **Verification**: Displays latest commits to confirm a successful push

## Resources

### Scripts (under the Cursor skill directory, portable)

- **monitor-push.ps1**: `$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1` — poll push status until completion
- **start-push-with-monitor.ps1**: `$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1` — run push in the background and start monitoring

Both scripts support auto-detecting the current branch and output file. Use `$HOME`-based paths so the same invocation works across machines.
