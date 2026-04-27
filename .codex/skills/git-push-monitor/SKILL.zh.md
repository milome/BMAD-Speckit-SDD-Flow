---
name: git-push-monitor
description: 在后台持续监控可能耗时或挂起的 git push，轮询状态直至完成，展示进度并校验成功。适用于推送大提交/大文件可能超时或阻塞终端、或需要不阻塞终端地跟踪 push 进度时。
---

# Git Push 监控

自动监控可能耗时或挂起的 git push：启动后台监控、周期性检查 push 状态、展示进度并确认完成。

## 脚本路径（可移植）

脚本随 skill 安装在 **Cursor 用户目录** 下，与其它 Cursor skill 一致，便于迁移到其它机器：

- **约定目录**：`{SKILLS_ROOT}\git-push-monitor\scripts\`
  - Windows (PowerShell): `$HOME\.cursor\skills\git-push-monitor\scripts\`
  - Linux/macOS: `~/.cursor/skills/git-push-monitor/scripts/`
- **PowerShell 可移植写法**（推荐，任意机器执行同一套命令即可）：
  - `$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1`
  - `$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1`
- 调用时请使用上述基于 `$HOME` 的路径，勿用当前仓库下的 `.\scripts\`。

## 快速开始

当 git push 在后台运行或可能耗时较长时：

```powershell
# 自动检测分支并监控（可移植路径）
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1"

# 或显式指定分支
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1" -BranchName "main" -MaxWaitSeconds 900
```

在后台启动 push 并自动监控：

```powershell
# 自动检测分支，启动 push 并监控
& "$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1"

# 或显式指定分支
& "$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1" -BranchName "main"
```

## 用法

### 监控已在进行的 Push

若 git push 已在运行（后台或其它终端）：

```powershell
& "$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1"
```

脚本将：

- 自动检测当前分支
- 自动检测 push 输出文件（若存在）
- 监控直至 push 完成或超时
- 成功时展示最新提交信息

### 启动 Push 并监控

启动 push 并自动监控：

```powershell
& "$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1"
```

将：

- 在后台作业中启动 git push
- 立即开始监控
- 展示进度与完成状态

### 参数

**monitor-push.ps1：**

- `-BranchName`：要监控的分支（默认：从当前分支自动检测）
- `-RemoteName`：远程名（默认：`origin`）
- `-OutputFile`：push 输出文件路径（默认：从 Cursor 终端文件自动检测）
- `-MaxWaitSeconds`：最长等待秒数（默认：600）
- `-CheckInterval`：检查间隔秒数（默认：5）

**start-push-with-monitor.ps1：**

- `-BranchName`：要推送的分支（默认：从当前分支自动检测）
- `-RemoteName`：远程名（默认：`origin`）
- `-MaxWaitSeconds`：最长等待秒数（默认：600）
- `-CheckInterval`：检查间隔秒数（默认：5）

## 工作原理

1. **初始状态捕获**：记录当前远程分支提交哈希
2. **周期性检查**：每 5 秒（可配置）检查远程分支是否已更新
3. **进度展示**：若可获取 push 进程输出则展示最新内容
4. **完成检测**：检测远程提交是否与本地提交一致
5. **校验**：展示最新提交以确认 push 成功

## 资源

### 脚本（位于 Cursor skill 目录，可移植）

- **monitor-push.ps1**：`$HOME\.cursor\skills\git-push-monitor\scripts\monitor-push.ps1` — 轮询 push 状态直至完成
- **start-push-with-monitor.ps1**：`$HOME\.cursor\skills\git-push-monitor\scripts\start-push-with-monitor.ps1` — 后台执行 push 并启动监控

两脚本均支持自动检测当前分支与输出文件。调用时使用基于 `$HOME` 的路径即可在不同机器上复用。
