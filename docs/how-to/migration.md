# BMAD-Speckit-SDD-Flow 迁移指南

> **版本**：v1.1 | **最后更新**：2026-03-17 | **适用仓库**：[BMAD-Speckit-SDD-Flow](../../README.md)
>
> 本文档面向**已有项目迁移**场景。新项目安装请参阅 [入门教程](../tutorials/getting-started.md)。

---

## 目录

- [1. 概述](#1-概述)
- [2. 迁移前评估](#2-迁移前评估)
- [3. 迁移策略 A：覆盖合并](#3-迁移策略-a覆盖合并)
- [4. 迁移策略 B：增量同步](#4-迁移策略-b增量同步)
- [5. _bmad 定制迁移](#5-_bmad-定制迁移)
- [6. _bmad-output 迁移](#6-_bmad-output-迁移)
- [7. 迁移后路径修正](#7-迁移后路径修正)
- [8. 迁移验证](#8-迁移验证)
- [9. 引用路径完整映射表](#9-引用路径完整映射表)
- [10. 常见 Q&A](#10-常见-qa)
- [11. 故障排除](#11-故障排除)

---

## 1. 概述

适用场景：项目已有 `_bmad/`、`_bmad-output/`、`.specify/`、`.speckit/` 等目录和文件（例如从早期同步方案获得），需迁移到本全流程。

新项目安装请参阅 [入门教程](../tutorials/getting-started.md)，其中涵盖前置条件、安装方式、Skills 安装和验证。

---

## 2. 迁移前评估

**迁移前必须回答的问题**：

| 检查项 | 命令/方法 | 目的 |
|--------|-----------|------|
| 现有 `_bmad/` 是否有自定义修改 | `git diff --stat _bmad/` 或人工检查 | 决定是否需要备份 |
| 现有 `_bmad-output/` 的产出 | `ls _bmad-output/implementation-artifacts/` | 确认现有产出不丢失 |
| 是否存在 `.specify/` | `Test-Path .specify` | 需迁移到 `specs/` |
| 是否存在 `.speckit/` | `Test-Path .speckit` | 需检查状态文件 |
| 现有 commands/rules 来源 | 对比文件内容 | 判断是否需要覆盖 |
| 全局 Skills 版本 | `ls $env:USERPROFILE\.cursor\skills\` | 仅检查运行时安装副本；repo 内 `_bmad/skills/` 才是第一批 skill 的 canonical 源 |

```powershell
$projectRoot = "D:\Dev\your-project"
Write-Host "=== 迁移前评估 ===" -ForegroundColor Cyan

$dirsToCheck = @("_bmad", "_bmad-output", ".specify", ".speckit", ".cursor", "commands", "rules", "specs", "config")
foreach ($d in $dirsToCheck) {
    $p = Join-Path $projectRoot $d
    if (Test-Path $p) {
        $count = (Get-ChildItem -Recurse -File $p -ErrorAction SilentlyContinue).Count
        Write-Host "[EXISTS] $d ($count files)" -ForegroundColor Yellow
    } else {
        Write-Host "[ABSENT] $d" -ForegroundColor Gray
    }
}
```

---

## 3. 迁移策略 A：覆盖合并

> 适用于：现有 `_bmad/` 无重要自定义修改，或已做好备份。

```powershell
$SOURCE = "D:\Dev\BMAD-Speckit-SDD-Flow"
$TARGET = "D:\Dev\your-project"

# 步骤 1: 备份现有 _bmad 定制（若有修改）
python "$SOURCE\skills\bmad-customization-backup\scripts\backup_bmad.py" --project-root $TARGET

# 步骤 2: 使用 init-to-root.js 部署核心目录（覆盖合并）
node "$SOURCE\scripts\init-to-root.js" $TARGET

# 步骤 3: 部署 npm 包外的文件
Copy-Item -Recurse -Force "$SOURCE\.cursor\commands" "$TARGET\.cursor\commands"
Copy-Item -Recurse -Force "$SOURCE\.cursor\rules" "$TARGET\.cursor\rules"
Copy-Item -Recurse -Force "$SOURCE\.cursor\agents" "$TARGET\.cursor\agents"
Copy-Item -Recurse -Force "$SOURCE\config" "$TARGET\config"

# 步骤 4: 应用之前的 _bmad 定制备份（若步骤 1 有备份）
# python "$SOURCE\skills\bmad-customization-backup\scripts\apply_bmad_backup.py" `
#     --backup-path "$TARGET\_bmad-output\bmad-customization-backups\<timestamp>_bmad" `
#     --project-root $TARGET `
#     --dry-run
```

---

## 4. 迁移策略 B：增量同步

> 适用于：现有项目与本仓库有双仓库同步关系，需要增量更新。

使用 `sync-manifest.yaml` 进行路径映射同步：

```powershell
Copy-Item "$SOURCE\_bmad\scripts\bmad-speckit\sync-manifest.yaml.example" "$TARGET\sync-manifest.yaml"

# 编辑 sync-manifest.yaml，调整路径映射后验证
pwsh "$SOURCE\_bmad\scripts\bmad-speckit\powershell\validate-sync-manifest.ps1"
```

`sync-manifest.yaml` 示例：

```yaml
paths:
  - path_a: "_bmad/"
    path_b: "_bmad/"
  - path_a: "_bmad-output/"
    path_b: "_bmad-output/"
  - path_a: ".cursor/agents/code-reviewer-config.yaml"
    path_b: "config/code-reviewer-config.yaml"
```

---

## 5. _bmad 定制迁移

若现有项目的 `_bmad/` 有自定义修改（如 party-mode 展示名优化、workflow 调整等）：

```powershell
# 1. 备份现有 _bmad 定制
python "$env:USERPROFILE\.cursor\skills\bmad-customization-backup\scripts\backup_bmad.py" `
    --project-root $TARGET

# 2. 覆盖为最新版本
node "$SOURCE\scripts\init-to-root.js" $TARGET

# 3. 应用备份中的定制（先 dry-run 确认）
$latestBackup = Get-ChildItem "$TARGET\_bmad-output\bmad-customization-backups" -Directory |
    Sort-Object Name -Descending | Select-Object -First 1
python "$env:USERPROFILE\.cursor\skills\bmad-customization-backup\scripts\apply_bmad_backup.py" `
    --backup-path $latestBackup.FullName `
    --project-root $TARGET `
    --dry-run
```

---

## 6. _bmad-output 迁移

现有项目的 `_bmad-output/implementation-artifacts/` 可能使用平铺结构，需迁移到两级层级结构（`epic-{N}-{slug}/story-{N}-{slug}/`）。

```powershell
# 先 dry-run 确认
python "$SOURCE\_bmad\scripts\bmad-speckit\python\migrate_bmad_output_to_subdirs.py" `
    --project-root $TARGET --dry-run

# 确认后执行
python "$SOURCE\_bmad\scripts\bmad-speckit\python\migrate_bmad_output_to_subdirs.py" `
    --project-root $TARGET
```

迁移规则：
- 文件名匹配 `{epic}-{story}-{slug}` 模式 → 移入对应子目录
- 无法解析的文件 → 移入 `_orphan/`
- `sprint-status.yaml` 保持原位

---

## 7. 迁移后路径修正

### 7.1 `.specify/` → `specs/` 迁移

```powershell
if (Test-Path "$TARGET\.specify") {
    if (-not (Test-Path "$TARGET\specs")) {
        New-Item -ItemType Directory "$TARGET\specs"
    }
    Copy-Item -Recurse -Force "$TARGET\.specify\*" "$TARGET\specs\"
    Write-Host "[MIGRATED] .specify/ -> specs/" -ForegroundColor Green
}
```

### 7.2 `.speckit/` 状态文件

`.speckit-state.yaml` 已完全移除，不再作为 runtime context。迁移时不应创建、分发或复制该文件作为运行时治理依赖。

### 7.3 `.cursor/rules/` 中的路径引用

若项目仍使用旧规则绑定，确保 legacy Party-Mode workflow 存在：

```powershell
if (-not (Test-Path "$TARGET\_bmad\core\workflows\party-mode\workflow.md")) {
    Write-Host "[WARN] legacy party-mode workflow.md missing; some old rules may fail" -ForegroundColor Yellow
}
```

同时建议验证 canonical skill 路径：

```powershell
if (-not (Test-Path "$TARGET\_bmad\skills\bmad-party-mode\workflow.md") -and -not (Test-Path "$TARGET\_bmad\core\workflows\party-mode\workflow.md")) {
    Write-Host "[ERROR] neither canonical nor legacy party-mode workflow exists!" -ForegroundColor Red
} elseif (-not (Test-Path "$TARGET\_bmad\skills\bmad-party-mode\workflow.md")) {
    Write-Host "[WARN] canonical bmad-party-mode skill workflow.md missing; legacy-bound flows may still work" -ForegroundColor Yellow
}
```

---

## 8. 迁移验证

```powershell
$TARGET = "D:\Dev\your-project"
Set-Location $TARGET
Write-Host "=== 迁移验证 ===" -ForegroundColor Cyan

$coreDirs = @(
    @("_bmad", "BMAD 核心框架"),
    @("_bmad\core\workflows\party-mode", "Party-Mode 工作流"),
    @("_bmad\bmm\workflows\4-implementation\create-story", "Create Story 工作流"),
    @("_bmad-output", "产出目录"),
    @("commands", "命令定义"),
    @("rules", "规则定义"),
    @(".cursor\rules", "Cursor 规则"),
    @(".cursor\commands", "Cursor 命令"),
    @("config", "项目配置")
)

foreach ($item in $coreDirs) {
    if (Test-Path $item[0]) {
        Write-Host "[OK] $($item[1]): $($item[0])" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $($item[1]): $($item[0])" -ForegroundColor Red
    }
}

# 先验证 repo 内 canonical skill 目录
$repoCanonicalSkills = @(
    @("_bmad\skills\bmad-party-mode", "Party-Mode canonical skill"),
    @("_bmad\skills\bmad-brainstorming", "Brainstorming canonical skill"),
    @("_bmad\skills\bmad-index-docs", "Index Docs canonical skill"),
    @("_bmad\skills\bmad-shard-doc", "Shard Doc canonical skill")
)
foreach ($item in $repoCanonicalSkills) {
    if (Test-Path $item[0]) {
        Write-Host "[OK] $($item[1]): $($item[0])" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $($item[1]): $($item[0])" -ForegroundColor Red
    }
}

# 全局 Skills 验证（仅运行时安装副本）
$SKILLS_ROOT = "$env:USERPROFILE\.cursor\skills"
$requiredSkills = @("speckit-workflow", "bmad-story-assistant", "bmad-bug-assistant", "bmad-code-reviewer-lifecycle", "code-review")
foreach ($skill in $requiredSkills) {
    $p = Join-Path $SKILLS_ROOT "$skill\SKILL.md"
    if (Test-Path $p) {
        Write-Host "[OK] Global Skill: $skill" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] Global Skill: $skill" -ForegroundColor Red
    }
}
```

---

## 9. 引用路径完整映射表

### 9.1 项目级路径（相对于项目根）

| 组件 | 路径 | 引用者 |
|------|------|--------|
| Party-Mode workflow | `_bmad/skills/bmad-party-mode/workflow.md` | canonical skill 路径；旧规则仍可能兼容 `_bmad/core/workflows/party-mode/workflow.md` |
| Create Story workflow | `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | bmad-story-assistant |
| Agent manifest | `_bmad/_config/agent-manifest.csv` | bmad-story-assistant, bmad-master |
| Code reviewer config | `config/code-reviewer-config.yaml` | bmad-code-reviewer-lifecycle |
| Speckit commands | `_bmad/speckit/commands/speckit.*.md` | Cursor 命令系统 |

### 9.2 全局路径（Cursor 全局 Skills，运行时安装副本）

| Skill | 全局路径 |
|-------|----------|
| speckit-workflow | `%USERPROFILE%\.cursor\skills\speckit-workflow\SKILL.md` |
| bmad-story-assistant | `%USERPROFILE%\.cursor\skills\bmad-story-assistant\SKILL.md` |
| bmad-bug-assistant | `%USERPROFILE%\.cursor\skills\bmad-bug-assistant\SKILL.md` |
| bmad-code-reviewer-lifecycle | `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md` |
| code-review | `%USERPROFILE%\.cursor\skills\code-review\SKILL.md` |

---

## 10. 常见 Q&A

**Q: `init-to-root.js` 会覆盖项目中已有的文件吗？**
A: 会。如果目标路径已有同名文件，该文件会被覆盖。建议安装前先备份重要的自定义修改。

**Q: 现有项目已有 `.specify/` 目录，迁移后会丢失数据吗？**
A: 不会。迁移步骤中会将 `.specify/` 下的内容复制到 `specs/` 目录。

**Q: `_bmad/` 的自定义修改会在覆盖安装时丢失吗？**
A: 会。建议先运行 `backup_bmad.py` 备份，覆盖后再用 `apply_bmad_backup.py` 恢复定制。

**Q: 双仓库同步模式和覆盖安装模式有何区别？**
A: **覆盖安装**（策略 A）一次性部署，适合明确切换到本仓库管理；**增量同步**（策略 B）使用 `sync-manifest.yaml` 定期拉取更新。

---

## 11. 故障排除

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| Party-Mode 无法启动 | `workflow.md` 缺失 | 重新运行 `init-to-root.js` |
| 审计找不到 prompt | `references/audit-prompts*.md` 缺失 | 检查全局 Skill 是否包含 `references/` 子目录 |
| check-prerequisites 报错 | `common.ps1` 缺失 | 确保 `_bmad/speckit/scripts/` 完整部署 |
| 全局 Skill 读不到 | 未安装到全局目录 | 重新运行 Skill 安装脚本 |
| _bmad-output 结构不对 | 旧的平铺结构 | 运行 `migrate_bmad_output_to_subdirs.py` |
| Windows 路径中文乱码 | PowerShell 编码问题 | 使用 `auto-commit-utf8` skill |

---

> **更多参考**：
> - [入门教程](../tutorials/getting-started.md) — 新项目安装完整指南
> - [README.md](../../README.md) — 项目总览
