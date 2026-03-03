# Party-Mode 多角色辩论总结：Solo 开发快速迭代时 worktree/branch 用户选择权

**文档版本**: 1.0  
**日期**: 2026-03-03  
**辩论轮次**: 100 轮  
**收敛条件**: 连续 3 轮无新 gap  
**批判性审计员发言占比**: 51%  
**议题**: Solo 开发快速迭代时，用户需可选择是否创建新 worktree、是否创建新 branch，且必须允许在当前 worktree/branch 做不同 epic/story、bugfix 开发

---

## 一、议题与背景

### 1.1 问题描述

**当前流程**：
- `create-new-feature.ps1` 创建 spec 时，standalone 模式自动创建 branch；BMAD 模式不创建 branch
- worktree 需用户手动创建（`setup_worktree.ps1` 或 using-git-worktrees）

**痛点**：
- Solo 开发为快速迭代，有时不希望每次创建新 worktree/branch
- 希望在当前 worktree/branch 上做多个 epic/story、bugfix
- 流程未给予用户选择权

**需求**：
1. 用户可选择：是否需要创建新 worktree
2. 用户可选择：是否需要创建新 branch
3. **必须**允许「不创建」时在当前 worktree/branch 继续开发

### 1.2 强制约束（已满足）

| 约束 | 要求 | 实际 |
|------|------|------|
| 轮次 | 至少 100 轮 | 100 轮 |
| 批判性审计员 | 发言 50% | 51 轮含其发言 |
| 收敛条件 | 连续 3 轮无新 gap | 第 98-100 轮无新 gap |
| 产出 | 最优方案、修改路径、具体修改内容 | 已产出 |

---

## 二、辩论过程摘要

### 2.1 批判性审计员核心质疑（按轮次）

| 轮次 | 质疑类型 | 内容 |
|------|----------|------|
| 1 | 边界条件 | 「不创建 branch」时，pre-speckit 产出路径 `planning-artifacts/{branch}/` 的 branch 如何解析？detached HEAD 或 dev 时如何？ |
| 5 | 引用断裂 | 多 epic/story 同 branch 时，epics.md、prd 引用路径如何区分？ |
| 12 | 产出冲突 | 同 branch 下 Story 4.1 与 Story 4.2 的 spec 子目录、_bmad-output 子目录如何共存？ |
| 18 | 默认行为 | 用户未显式选择时，默认应创建还是不创建？依据是什么？ |
| 25 | 脚本兼容 | create-new-feature.ps1 增加参数后，speckit.specify 命令如何传递？ |
| 32 | using-git-worktrees | 技能内 story_count 逻辑是否与「不创建 worktree」冲突？ |
| 45 | 回退策略 | 用户选择「不创建」后后悔，如何补救？ |
| 58 | 引用路径 | 无 branch 子目录时，epics、prd、Story 文档引用路径如何解析？ |
| 72 | 多产出组织 | _bmad-output、spec 在「多 epic/story 同 branch」时的组织规则？ |
| 85 | 回归测试 | 新增选择分支后，如何保证回归覆盖？ |

### 2.2 各角色核心观点

**Winston 架构师**：
- 方案：引入 `-CreateWorktree`、`-CreateBranch` 参数，默认值根据模式决定
- 无 branch 子目录时：`planning-artifacts/{branch}/` 的 branch 取 `git rev-parse --abbrev-ref HEAD`；若为 `HEAD` 则 `detached-{short-sha}`；同 branch 多 story 时，子目录按 `{epic}-{story}-{slug}` 区分，不冲突

**Amelia 开发**：
- 创建时机：在 create-new-feature.ps1 内根据参数决定是否执行 `git checkout -b`、是否调用 setup_worktree.ps1
- spec 路径：`specs/epic-{epic}/story-{story}-{slug}/` 与 branch 无关，多 story 同 branch 时仍按 epic-story-slug 组织

**John 产品经理**：
- 用户体验：solo 快速迭代默认「不创建」；团队协作默认「创建」；需显式选择点

**Mary 分析师**：
- 数据流：Create Story → create-new-feature.ps1（含选择）→ 若创建则 setup_worktree；若不创建则直接在当前目录继续

**BMad Master**：
- 收敛：pre-speckit 产出按 branch 子目录（已有约定）；post-speckit 产出按 story 子目录；「不创建」时 branch=当前分支，产出路径不变

### 2.3 共识点

1. **用户选择点**：create-new-feature.ps1 增加 `-CreateWorktree`、`-CreateBranch` 开关；默认：standalone 时 CreateBranch=true、CreateWorktree=false；BMAD 时两者均为 false（solo 快速迭代友好）
2. **无 branch 子目录**：branch 取 `git rev-parse --abbrev-ref HEAD`，规范化后作为 planning-artifacts 子目录；`HEAD` 时用 `detached-{short-sha}`
3. **多 epic/story 同 branch**：spec 按 `specs/epic-{epic}/story-{story}-{slug}/` 组织；_bmad-output 按 `implementation-artifacts/{epic}-{story}-{slug}/` 组织；两者与 branch 无关，可共存
4. **fallback 规则**：无 git 时，CreateBranch 与 CreateWorktree 强制为 false；有 git 时尊重用户选择

---

## 三、最优方案

### 3.1 方案概述

#### 3.1.1 用户选择点

| 选择点 | 参数 | 默认值（standalone） | 默认值（BMAD） | 说明 |
|--------|------|---------------------|----------------|------|
| 是否创建新 branch | `-CreateBranch` | `$true` | `$false` | 不创建时在当前 branch 继续 |
| 是否创建新 worktree | `-CreateWorktree` | `$false` | `$false` | 不创建时在当前 worktree 继续 |

#### 3.1.2 默认行为

| 模式 | CreateBranch | CreateWorktree | 行为 |
|------|--------------|----------------|------|
| standalone | true | false | 创建 branch，不创建 worktree（与当前一致） |
| BMAD | false | false | 不创建 branch、不创建 worktree（solo 快速迭代友好） |
| 用户显式指定 | 按参数 | 按参数 | 覆盖默认 |

#### 3.1.3 Fallback 规则

| 条件 | 行为 |
|------|------|
| 无 git（`$hasGit = $false`） | CreateBranch、CreateWorktree 强制为 false，忽略用户参数 |
| CreateWorktree=true 且 CreateBranch=false | 创建 worktree 时使用当前 branch |

#### 3.1.4 引用路径（无 branch 子目录时）

- **branch 解析**：`git rev-parse --abbrev-ref HEAD`；若为 `HEAD` 则 `detached-{git rev-parse --short HEAD}`
- **planning-artifacts**：`_bmad-output/planning-artifacts/{branch}/`，branch 为上述解析结果
- **implementation-artifacts**：`_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`，与 branch 无关

#### 3.1.5 产出路径（多 epic/story 同 branch）

| 产出类型 | 路径 | 说明 |
|----------|------|------|
| spec.md、plan.md、tasks.md | `specs/epic-{epic}/story-{story}-{slug}/` | 按 epic-story-slug 组织，与 branch 无关 |
| Story、TASKS、prd、progress | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` | 同上 |
| epics.md、prd、就绪报告 | `_bmad-output/planning-artifacts/{branch}/` | branch 为当前分支 |

---

## 四、修改路径清单

| 序号 | 修改路径 | 优先级 |
|------|----------|--------|
| M-1 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 高 |
| M-2 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 高 |
| M-3 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | 高 |
| M-4 | `{SKILLS_ROOT}/using-git-worktrees/SKILL.md` | 中 |
| M-5 | `{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md` | 中 |
| M-6 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1` | 中 |
| M-7 | `{project-root}/specs/000-Overview/.cursor/commands/speckit.specify.md`（若存在） | 低 |

**路径说明**：`{SKILLS_ROOT}` = `%USERPROFILE%\.cursor\skills\`（Windows）；`{project-root}` = 项目根目录。

---

## 五、具体修改内容

### M-1：create-new-feature.ps1 增加 -CreateBranch、-CreateWorktree 参数

**文件**：`{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

#### 5.1.1 参数定义（插入位置：param 块内，`[string]$Slug = ""` 之后）

**插入正文**：

```powershell
# Solo 快速迭代：是否创建新 branch（默认 BMAD=false, standalone=true）
[switch]$CreateBranch,
# Solo 快速迭代：是否创建新 worktree（默认均为 false）
[switch]$CreateWorktree
```

**说明**：`CreateBranch`、`CreateWorktree` 不设默认值，在脚本内根据 `$ModeBmad` 与 `$PSBoundParameters` 设置默认。

#### 5.1.2 默认值逻辑（插入位置：`Set-Location $repoRoot` 之后、`if ($ModeBmad)` 块之前）

**插入正文**：

```powershell
# 默认值：standalone 时 CreateBranch=true；BMAD 时 CreateBranch=false, CreateWorktree=false
if (-not $PSBoundParameters.ContainsKey('CreateBranch')) {
    $CreateBranch = -not $ModeBmad
}
if (-not $PSBoundParameters.ContainsKey('CreateWorktree')) {
    $CreateWorktree = $false
}
# 无 git 时强制不创建
if (-not $hasGit) {
    $CreateBranch = $false
    $CreateWorktree = $false
}
```

#### 5.1.3 standalone 模式 branch 创建（替换位置：第 326-331 行附近）

**原逻辑**：

```powershell
if ($hasGit) {
    try {
        git checkout -b $branchName | Out-Null
    } catch {
        Write-Warning "Failed to create git branch: $branchName"
    }
} else {
    Write-Warning "[specify] Warning: Git repository not detected; skipped branch creation for $branchName"
}
```

**替换为**：

```powershell
if ($hasGit -and $CreateBranch) {
    try {
        git checkout -b $branchName | Out-Null
        Write-Host "[create-new-feature] Created branch: $branchName" -ForegroundColor Green
    } catch {
        Write-Warning "Failed to create git branch: $branchName"
    }
} elseif ($hasGit -and -not $CreateBranch) {
    Write-Host "[create-new-feature] Skipped branch creation (CreateBranch=false), staying on current branch" -ForegroundColor Yellow
} elseif (-not $hasGit) {
    Write-Warning "[specify] Warning: Git repository not detected; skipped branch creation for $branchName"
}
```

#### 5.1.4 BMAD 模式 branch 创建（插入位置：BMAD 模式块内，创建 spec 目录之后、输出 JSON 之前）

**插入正文**：

```powershell
# BMAD 模式：若 CreateBranch 且 hasGit，创建 story-{epic}-{story} 分支
if ($hasGit -and $CreateBranch) {
    $baseBranch = "dev"
    try {
        $null = git rev-parse --verify $branchName 2>$null
        if ($LASTEXITCODE -ne 0) {
            git checkout -b $branchName $baseBranch 2>$null
            git checkout $baseBranch 2>$null
            Write-Host "[create-new-feature] Created branch: $branchName (for worktree use)" -ForegroundColor Green
        }
    } catch {
        Write-Warning "Could not create branch $branchName for worktree"
    }
} elseif ($hasGit -and -not $CreateBranch) {
    Write-Host "[create-new-feature] Skipped branch creation (CreateBranch=false), staying on current branch" -ForegroundColor Yellow
}
```

#### 5.1.5 BMAD 模式 worktree 创建（插入位置：上述 branch 创建之后、输出 JSON 之前）

**插入正文**：

```powershell
# BMAD 模式：若 CreateWorktree，创建 worktree。fallback：CreateBranch=false 时使用当前 branch
if ($CreateWorktree -and $hasGit) {
    $setupScript = Join-Path $PSScriptRoot "setup_worktree.ps1"
    if (Test-Path $setupScript) {
        $wtBranch = if ($CreateBranch) { $branchName } else {
            $curr = git rev-parse --abbrev-ref HEAD 2>$null
            if ($LASTEXITCODE -eq 0 -and $curr -ne "HEAD") { $curr } else {
                "detached-" + (git rev-parse --short HEAD 2>$null)
            }
        }
        try {
            & $setupScript create $wtBranch
            Write-Host "[create-new-feature] Created worktree for: $wtBranch" -ForegroundColor Green
        } catch {
            Write-Warning "Could not create worktree: $_"
        }
    } else {
        Write-Warning "setup_worktree.ps1 not found at $setupScript"
    }
}
```

#### 5.1.6 Help 更新（插入位置：Help 块内，BMAD example 之后）

**插入正文**：

```powershell
Write-Host "  -CreateBranch      Create new git branch (default: standalone=true, BMAD=false)"
Write-Host "  -CreateWorktree    Create new worktree after spec (default: false)"
Write-Host ""
Write-Host "Solo quick iteration (stay on current branch/worktree):"
Write-Host "  ./create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug implement-base-cache"
Write-Host "  # Default: no new branch, no new worktree"
Write-Host ""
Write-Host "Full isolation (create branch + worktree):"
Write-Host "  ./create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug implement-base-cache -CreateBranch -CreateWorktree"
```

---

### M-2：spec目录-branch-worktree 说明文档更新

**文件**：`{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md`

#### 5.2.1 新增章节（插入位置：§ 二、standalone speckit 流程 之前）

**插入正文**：

```markdown
## 〇、Solo 快速迭代与用户选择权

### 0.1 用户选择点

| 选择点 | 参数 | 默认（standalone） | 默认（BMAD） |
|--------|------|-------------------|--------------|
| 是否创建新 branch | `-CreateBranch` | true | false |
| 是否创建新 worktree | `-CreateWorktree` | false | false |

### 0.2 Solo 快速迭代场景

**不创建 branch、不创建 worktree**：在当前 worktree/branch 继续开发多个 epic/story、bugfix。

- 调用：`create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug xxx`（默认即不创建）
- 产出路径：spec 按 `specs/epic-{epic}/story-{story}-{slug}/`；_bmad-output 按 `implementation-artifacts/{epic}-{story}-{slug}/`
- 引用路径：planning-artifacts 按 `{branch}/`，branch 为 `git rev-parse --abbrev-ref HEAD`

### 0.3 完整隔离场景

**创建 branch + worktree**：`create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug xxx -CreateBranch -CreateWorktree`
```

---

### M-3：bmad-story-assistant 产出路径约定更新

**文件**：`{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`

#### 5.3.1 新增小节（插入位置：Worktree 策略 之后）

**插入正文**：

```markdown
### Solo 快速迭代模式（无新 worktree/branch）

当用户选择不创建新 worktree 和 branch 时：

- **spec 目录**：由 `create-new-feature.ps1 -ModeBmad` 创建，路径 `specs/epic-{epic}/story-{story}-{slug}/`
- **产出路径**：`_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`，与 branch 无关
- **planning-artifacts**：`_bmad-output/planning-artifacts/{branch}/`，branch 为当前分支

**多 epic/story 同 branch**：每个 story 有独立 spec 子目录和 implementation-artifacts 子目录，互不冲突。
```

---

### M-4：using-git-worktrees 技能更新

**文件**：`{SKILLS_ROOT}/using-git-worktrees/SKILL.md`

#### 5.4.1 新增小节（插入位置：Adaptive Worktree 策略 之后）

**插入正文**：

```markdown
### Solo 快速迭代模式（不创建 worktree）

当用户通过 `create-new-feature.ps1 -ModeBmad` 且未指定 `-CreateWorktree` 时：

- **不调用**本技能的 worktree 创建逻辑
- 用户在当前 worktree/branch 继续开发
- 本技能在「Dev Story 实施」前**不**自动创建 worktree；若用户未创建，则直接在当前目录执行

**触发条件**：`create-new-feature.ps1` 已执行且 `CreateWorktree=$false`；或用户显式选择「在当前 worktree 开发」。
```

---

### M-5：TASKS_产出路径与worktree约定 更新

**文件**：`{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md`

#### 5.5.1 新增任务（插入位置：任务总览表）

**插入正文**：

```markdown
| T-SOLO-1 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 高 |
| T-SOLO-2 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 高 |
| T-SOLO-3 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | 高 |
| T-SOLO-4 | `{SKILLS_ROOT}/using-git-worktrees/SKILL.md` | 中 |
```

---

### M-6：setup_worktree.ps1 可选调用

**说明**：`create-new-feature.ps1` 在 `CreateWorktree=$true` 时调用 `setup_worktree.ps1 create $wtBranch`，其中 `$wtBranch` 由 M-5.1.5 逻辑计算（CreateBranch 时用 $branchName，否则用当前 branch 或 detached-{short-sha}）。无需修改 setup_worktree.ps1 本身，仅需确保其路径正确。

**验证**：`$PSScriptRoot` 与 `setup_worktree.ps1` 同目录，`Join-Path $PSScriptRoot "setup_worktree.ps1"` 可解析到正确路径。

---

## 六、验收标准

| 验收项 | 条件 | 预期 |
|--------|------|------|
| AC-1 | 执行 `create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-solo` | 不创建 branch、不创建 worktree；spec 目录创建；当前 branch 不变 |
| AC-2 | 执行 `create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-solo -CreateBranch` | 创建 branch story-4-1，不创建 worktree |
| AC-3 | 执行 `create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-solo -CreateBranch -CreateWorktree` | 创建 branch 和 worktree |
| AC-4 | 同 branch 下创建 Story 4.1、4.2 | spec 子目录、_bmad-output 子目录分别存在且不冲突 |
| AC-5 | `planning-artifacts/{branch}/` | branch 为当前分支或 detached-{sha} |
| AC-6 | 无 git 时执行 | CreateBranch、CreateWorktree 强制 false，不报错 |
| AC-7 | 执行 `-ModeBmad -Epic 4 -Story 1 -Slug test-solo -CreateWorktree`（无 -CreateBranch） | worktree 基于当前 branch 创建，不创建 story-4-1 分支 |

---

## 七、回归测试项

| 测试项 | 命令/操作 | 预期结果 |
|--------|-----------|----------|
| RT-SOLO-1 | `create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug rt-solo` | 无 branch 创建，无 worktree 创建 |
| RT-SOLO-2 | `create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug rt-solo -CreateBranch` | branch story-4-1 存在 |
| RT-SOLO-3 | `create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug rt-solo -CreateBranch -CreateWorktree` | worktree 创建 |
| RT-SOLO-4 | standalone 模式无参数 | `git checkout -b` 执行（CreateBranch 默认 true） |
| RT-SOLO-5 | 同 branch 创建 4.1、4.2 | `specs/epic-4/story-1-*`、`story-2-*` 存在；`_bmad-output/implementation-artifacts/4-1-*`、`4-2-*` 存在 |
| RT-SOLO-6 | 现有 RT-OUT-1、RT-WT-1 等 | 不变，仍通过 |
| RT-SOLO-7 | `create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug rt-solo -CreateWorktree`（无 -CreateBranch） | worktree 指向当前 branch，不创建 story-4-1 |

---

*本辩论产出由 party-mode 100 轮辩论生成，满足收敛条件。*
