# BMAD-Speckit 入门教程

> 从零到生成第一个 `spec.md` 的完整路径。涵盖安装、配置与第一次使用。
> 现有项目迁移请参阅 [迁移指南](../how-to/migration.md)。

---

## 1. 前置条件

| 条件 | 要求 | 说明 |
|------|------|------|
| Node.js | ≥18 | 运行 `init-to-root.js` 和 scoring 脚本 |
| PowerShell | ≥7 | 运行 `check-prerequisites.ps1` 等脚本 |
| Cursor IDE | 最新版 | 使用 skills、commands、rules |
| Git | ≥2.x | worktree、分支管理 |

```powershell
git clone <BMAD-Speckit-SDD-Flow-repo-url> D:\Dev\BMAD-Speckit-SDD-Flow
```

---

## 2. 安装

### 2.1 方式一：一键安装（推荐）

需要 PowerShell ≥7，在 **BMAD-Speckit-SDD-Flow 源仓库根目录**执行：

```powershell
pwsh scripts/setup.ps1 -Target D:\Dev\your-project
```

该脚本自动完成：核心目录部署 + `.cursor/` 同步 + 全局 Skills 安装 + 安装验证。

### 2.2 方式二：npm 安装

```powershell
cd D:\Dev\your-project

# 安装（postinstall 默认走 --agent cursor）
npm install --save-dev D:\Dev\BMAD-Speckit-SDD-Flow

# 若要生成 Claude Code 隔离运行时，显式执行
node D:\Dev\BMAD-Speckit-SDD-Flow\scripts\init-to-root.js D:\Dev\your-project --agent claude-code
```

`postinstall` 脚本会自动复制以下目录到项目根：
- `_bmad/` → `{项目根}/_bmad/`
- `_bmad-output/` → `{项目根}/_bmad-output/`
- `commands/` → `{项目根}/commands/`
- `rules/` → `{项目根}/rules/`

npm 包**不含**的目录需手动复制：

```powershell
$SOURCE = "D:\Dev\BMAD-Speckit-SDD-Flow"

# Cursor IDE 配置
Copy-Item -Recurse -Force "$SOURCE\.cursor\commands" ".cursor\commands"
Copy-Item -Recurse -Force "$SOURCE\.cursor\rules" ".cursor\rules"
Copy-Item -Recurse -Force "$SOURCE\.cursor\agents" ".cursor\agents"

# 项目配置
Copy-Item -Recurse -Force "$SOURCE\config" "config"
```

### 2.3 方式三：克隆后手动部署

```powershell
git clone <BMAD-Speckit-SDD-Flow-repo-url> D:\Dev\BMAD-Speckit-SDD-Flow

node D:\Dev\BMAD-Speckit-SDD-Flow\scripts\init-to-root.js D:\Dev\your-project --agent cursor
```

若 `setup.ps1` 未就绪，可手动三步：

1. `node scripts/init-to-root.js D:\Dev\your-project`
2. 将 speckit 命令复制到 `.cursor\commands\`
3. 将 5 个必须 Skill 复制到全局 `$env:USERPROFILE\.cursor\skills\`

### 2.4 非交互式安装

> 适用于：CI/CD 流水线、脚本化安装、批量部署、已知配置的快速安装。参考 [BMAD Method 非交互式安装](https://docs.bmad-method.org/how-to/non-interactive-installation/)。

**说明**：`npx bmad-speckit init` 从上游 bmad-method 模板拉取；`setup.ps1` 与 `init-to-root.js` 从本仓库的 `_bmad` 部署。若需 BMAD-Speckit-SDD-Flow 的定制内容，优先使用 setup.ps1 或 init-to-root.js。

#### bmad-speckit init 可用选项

通过 `npx bmad-speckit init` 初始化时，可使用以下标志跳过交互：

| 标志 | 说明 | 示例 |
|------|------|------|
| `--ai <name>` | AI 选择，逗号分隔多选 | `--ai cursor-agent` 或 `--ai cursor-agent,claude` |
| `-y, --yes` | 跳过所有提示，使用默认值 | `--yes` |
| `--modules <list>` | 逗号分隔的模块 ID | `--modules bmm,bmb,tea` |
| `--template <tag\|url>` | 模板版本或 tarball URL | `--template latest` 或 `--template v1.0.0` |
| `--force` | 强制覆盖非空目录 | `--force` |
| `--no-git` | 跳过 git init | `--no-git` |
| `--bmad-path <path>` | 共享 _bmad 路径（worktree 模式） | `--bmad-path /path/to/_bmad` |
| `--no-ai-skills` | 跳过发布 AI skills | `--no-ai-skills` |
| `--offline` | 仅使用本地缓存，不联网 | `--offline` |
| `--script <type>` | 脚本类型：sh 或 ps | `--script ps` |
| `--here` | 使用当前目录作为目标 | `--here` |

**完全非交互示例**：

```powershell
cd D:\Dev\your-project
npx bmad-speckit init . --ai cursor-agent --yes
```

**CI/CD 流水线示例**（需先 `npm install bmad-speckit-sdd-flow` 或 `bmad-speckit`）：

```powershell
npx bmad-speckit init "${GITHUB_WORKSPACE}" --ai cursor-agent --modules bmm --yes --no-git
```

#### setup.ps1 可用选项

| 参数 | 说明 | 默认 |
|------|------|------|
| `-Target <path>` | 目标项目根目录 | 必填 |
| `-Agent <name>` | AI 类型：cursor、claude-code 或逗号分隔 | cursor |
| `-Full` | 完整模式（含 config） | 否 |
| `-SkipSkills` | 跳过全局 Skills 安装 | 否 |
| `-SkipScoring` | 跳过 scoring 目录复制 | 否 |
| `-DryRun` | 仅输出计划，不执行 | 否 |

```powershell
pwsh scripts/setup.ps1 -Target D:\Dev\your-project -Agent cursor -Full
```

#### init-to-root.js 可用选项

| 参数 | 说明 |
|------|------|
| `[targetDir]` | 目标目录（缺省为当前目录） |
| `--agent <name>` | cursor 或 claude-code |
| `--full` | 包含 config 等完整部署 |

```powershell
node D:\Dev\BMAD-Speckit-SDD-Flow\scripts\init-to-root.js D:\Dev\your-project --agent cursor --full
```

---

## 3. 全局 Skills 安装

全局 Skills 安装到 `%USERPROFILE%\.cursor\skills\`（Windows）或 `~/.cursor/skills/`（macOS/Linux）。

**必须安装的 Skills**（工作流核心依赖）：

| # | Skill | 说明 |
|---|-------|------|
| 1 | **speckit-workflow** | 核心：specify→plan→gaps→tasks→implement |
| 2 | **bmad-story-assistant** | Epic/Story 全流程 |
| 3 | **bmad-bug-assistant** | BUGFIX 全流程 |
| 4 | **bmad-code-reviewer-lifecycle** | 审计→解析→scoring 写入 |
| 5 | **code-review** | 审计执行引擎 |

```powershell
$SKILLS_ROOT = "$env:USERPROFILE\.cursor\skills"
$required = @(
    "speckit-workflow",
    "bmad-story-assistant",
    "bmad-bug-assistant",
    "bmad-code-reviewer-lifecycle",
    "code-review"
)
foreach ($skill in $required) {
    $src = "D:\Dev\BMAD-Speckit-SDD-Flow\skills\$skill"
    $dest = "$SKILLS_ROOT\$skill"
    if (Test-Path $src) {
        Copy-Item -Recurse -Force $src $dest
        Write-Host "[OK] $skill -> $dest"
    }
}
```

**推荐安装的 Skills**：bmad-standalone-tasks、bmad-customization-backup、bmad-orchestrator、using-git-worktrees、ralph-method、auto-commit-utf8、git-push-monitor。

---

## 4. 安装验证

在**目标项目根目录**执行：

```powershell
cd D:\Dev\your-project
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly
```

手动验证关键路径：

```powershell
$checks = @(
    "_bmad",
    "_bmad\core\workflows\party-mode\workflow.md",
    "_bmad\_config\agent-manifest.csv",
    "_bmad-output\config\settings.json",
    ".cursor\rules\bmad-bug-auto-party-mode.mdc",
    ".cursor\commands\bmad-bmm-create-story.md",
    "config\code-reviewer-config.yaml"
)
foreach ($path in $checks) {
    if (Test-Path $path) {
        Write-Host "[OK] $path" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $path" -ForegroundColor Red
    }
}
```

---

## 5. 创建第一个 Feature（1 分钟）

```powershell
cd D:\Dev\your-project
git checkout -b 001-my-first-feature
```

在 Cursor 中运行命令：`/speckit.specify`

确认 `specs/001-my-first-feature/spec.md` 已生成。

---

## 6. 完成 specify → plan → tasks 流程（2 分钟）

依次运行：`/speckit.plan` → 审计通过 → `/speckit.tasks`

确认 `plan.md`、`tasks.md` 已生成。

---

## 7. 下一步

**想体验 BMAD 全流程？** 在 Cursor 中依次运行 `/bmad-bmm-create-story`（输入 Epic 与 Story 编号）→ 审计通过 → `/bmad-bmm-dev-story`，将触发 Layer 4 嵌套 Speckit（specify → plan → tasks → implement）。

**常用 Skills**（安装时已部署到全局，直接可用）：
- **bmad-story-assistant**：Story 全流程（Create Story → Dev Story），对应命令 `/bmad-bmm-create-story`、`/bmad-bmm-dev-story`
- **bmad-bug-assistant**：描述问题时自动进入 Party-Mode，产出 BUGFIX 文档并生成修复任务
- **bmad-standalone-tasks**：按单份 TASKS/BUGFIX 文档执行，用法示例：`/bmad 按 TASKS_xxx.md 中的未完成任务实施`

**更多资源**：
- [迁移指南](../how-to/migration.md) — 现有项目迁移流程
- [BMAD Story 流程](bmad-story-assistant.md) — Story 助手使用说明
- [架构概述](../explanation/architecture.md) — 五层架构与 Speckit 工作流
- [README.md](../../README.md) — 项目总览
