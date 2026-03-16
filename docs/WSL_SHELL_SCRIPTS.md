# WSL / Shell 脚本使用说明

项目为所有 PowerShell 脚本提供**完整功能对应**的 shell (bash) 版本，可在 WSL、Linux、macOS 下使用。

## 脚本对照表

| PowerShell | Shell | 说明 |
|------------|-------|------|
| `scripts/setup.ps1` | `scripts/setup.sh` | 一键安装 |
| `scripts/check-sprint-ready.ps1` | `scripts/check-sprint-ready.sh` | Sprint 状态检查 |
| `scripts/bmad-sync-from-v6.ps1` | `scripts/bmad-sync-from-v6.sh` | BMAD v6 同步 |
| `_bmad/.../powershell/check-prerequisites.ps1` | `_bmad/.../shell/check-prerequisites.sh` | speckit 前置检查 |
| `_bmad/.../powershell/create-new-feature.ps1` | `_bmad/.../shell/create-new-feature.sh` | 创建 Feature（含 -CreateBranch/-CreateWorktree） |
| `_bmad/.../powershell/validate-sync-manifest.ps1` | `_bmad/.../shell/validate-sync-manifest.sh` | 同步清单校验（调用 Python；shell 用 --manifest/--repo-a/--repo-b） |
| `_bmad/.../powershell/validate-audit-config.ps1` | `_bmad/.../shell/validate-audit-config.sh` | audit_convergence 校验 |
| `_bmad/.../powershell/setup_worktree.ps1` | `_bmad/.../shell/setup_worktree.sh` | Git worktree 管理 |
| `_bmad/.../powershell/update-agent-context.ps1` | `_bmad/.../shell/update-agent-context.sh` | Agent 上下文更新（16 种 agent） |
| `_bmad/.../powershell/setup-plan.ps1` | `_bmad/.../shell/setup-plan.sh` | 设置 plan 模板 |
| `_bmad/.../powershell/find-related-docs.ps1` | `_bmad/.../shell/find-related-docs.sh` | 查找相关设计文档 |
| `skills/git-push-monitor/scripts/monitor-push.ps1` | `skills/git-push-monitor/scripts/monitor-push.sh` | Git push 监控（含 -OutputFile） |
| `skills/git-push-monitor/scripts/start-push-with-monitor.ps1` | `skills/git-push-monitor/scripts/start-push-with-monitor.sh` | 后台 push 并启动监控 |
| `skills/pr-template-generator/scripts/generate-pr-template.ps1` | `skills/pr-template-generator/scripts/generate-pr-template.sh` | PR 模板生成（commit 分类、文件统计、AutoDetectLastPR、UTF-8） |

## 使用示例

### 一键安装 (WSL/Linux/macOS)

```bash
bash scripts/setup.sh -Target /home/user/my-project -Full
# 或
npm run setup:sh -- -Target /home/user/my-project -Full
```

### Sprint 检查

```bash
./scripts/check-sprint-ready.sh -Json
# 或指定 repo
./scripts/check-sprint-ready.sh -Json -RepoRoot /path/to/project
```

### BMAD v6 同步

```bash
./scripts/bmad-sync-from-v6.sh -Phase 1 -DryRun
./scripts/bmad-sync-from-v6.sh -Phase 1
```

### speckit 前置检查

```bash
./_bmad/speckit/scripts/shell/check-prerequisites.sh -Json -RequireTasks -IncludeTasks -RequireSprintStatus
```

### 创建 Feature (BMAD 模式)

```bash
./_bmad/speckit/scripts/shell/create-new-feature.sh -ModeBmad -Epic 4 -Story 1 -Slug my-story
```

### 同步清单校验（validate-sync-manifest）

shell 版调用 Python，参数与 PS 对应关系：PS `-ManifestPath`→`--manifest`，`-RepoA`→`--repo-a`，`-RepoB`→`--repo-b`。

```bash
./_bmad/speckit/scripts/shell/validate-sync-manifest.sh --manifest sync-manifest.yaml --repo-a /path/to/repo-a --repo-b /path/to/repo-b
```

### Worktree 管理

```bash
./_bmad/speckit/scripts/shell/setup_worktree.sh create 005-my-feature
./_bmad/speckit/scripts/shell/setup_worktree.sh list
./_bmad/speckit/scripts/shell/setup_worktree.sh remove 005-my-feature
./_bmad/speckit/scripts/shell/setup_worktree.sh sync ../my-repo-005-my-feature
```

### Git push 监控（后台 push + 监控）

```bash
./skills/git-push-monitor/scripts/start-push-with-monitor.sh
./skills/git-push-monitor/scripts/start-push-with-monitor.sh -b main -r origin -m 600
```

### audit 配置校验、Plan 设置、Agent 更新、相关文档

```bash
# 校验 config/speckit.yaml 禁止 audit_convergence: simple
./_bmad/speckit/scripts/shell/validate-audit-config.sh

# 设置 plan 模板
./_bmad/speckit/scripts/shell/setup-plan.sh -Json

# 更新 Agent 上下文
./_bmad/speckit/scripts/shell/update-agent-context.sh claude
./_bmad/speckit/scripts/shell/update-agent-context.sh   # 更新全部

# 查找相关设计文档
./_bmad/speckit/scripts/shell/find-related-docs.sh -FeatureDescription "用户认证" -ShortName auth -Json
```

## package.json 新增脚本

| 命令 | 说明 |
|------|------|
| `npm run setup:sh -- -Target <path>` | 使用 shell 版一键安装 |
| `npm run setup:full:sh -- -Target <path>` | 完整模式 shell 安装 |

## 前置条件 (Shell 环境)

- **bash** ≥ 4
- **Node.js** ≥ 18
- **Python** ≥ 3.8（validate-sync-manifest 需要）
- **Git** ≥ 2.x

无需 PowerShell。Skills 安装到 `$HOME/.cursor/skills`（与 Windows `%USERPROFILE%\.cursor\skills` 对等）。
