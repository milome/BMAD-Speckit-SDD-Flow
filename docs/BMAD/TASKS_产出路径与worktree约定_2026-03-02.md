# 产出路径与 Worktree 约定 - 任务列表

**日期**: 2026-03-02  
**来源**: spec 目录命名规则 Gap 解决、worktree 讨论、产出路径补充约定、_bmad-output 子目录结构优化  
**参考文档**: [spec目录-branch-worktree创建时机与脚本说明.md](./spec目录-branch-worktree创建时机与脚本说明.md)、[TASKS_spec目录命名规则Gap_2026-03-02.md](./TASKS_spec目录命名规则Gap_2026-03-02.md)、[DEBATE_bmad-output子目录结构_100轮辩论产出_2026-03-02.md](./DEBATE_bmad-output子目录结构_100轮辩论产出_2026-03-02.md)、[DEBATE_pre-speckit产出覆盖问题_100轮总结_2026-03-02.md](./DEBATE_pre-speckit产出覆盖问题_100轮总结_2026-03-02.md)、[DEBATE_solo开发worktree-branch选择_100轮总结_2026-03-03.md](./DEBATE_solo开发worktree-branch选择_100轮总结_2026-03-03.md)

---

## 任务总览

| 任务 ID | 修改路径 | 优先级 |
|---------|----------|--------|
| T-OUT-1 | `{SKILLS_ROOT}/speckit-workflow/SKILL.md` | 高 |
| T-OUT-2 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`、`{SKILLS_ROOT}/bmad-bug-assistant/SKILL.md` | 高 |
| T-WT-1 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1` | 高 |
| T-WT-2 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 中 |
| T-WT-3 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 中 |
| T-BK-1 | `{SKILLS_ROOT}/speckit-scripts-backup/`（新建技能） | 中 |
| T-RT-1 | `{project-root}/tests/` 或 `{project-root}/docs/BMAD/`（端到端回归测试） | 中 |
| T-BMAD-1 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | 高 |
| T-BMAD-2 | `{SKILLS_ROOT}/bmad-bug-assistant/SKILL.md` | 高 |
| T-BMAD-3 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 高 |
| T-BMAD-4 | `{SKILLS_ROOT}/speckit-workflow/SKILL.md` | 中 |
| T-BMAD-5 | 本文档 §1.2 | 中 |
| T-BMAD-6 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 中 |
| T-BMAD-7 | `{project-root}/_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`（新建，可选） | 中 |
| T-PRE-1 | `{project-root}/_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/` | 高 |
| T-PRE-2 | `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-prd/` | 高 |
| T-PRE-3 | `{project-root}/_bmad/bmm/workflows/3-solutioning/check-implementation-readiness/` | 高 |
| T-PRE-3b | `{project-root}/_bmad/bmm/workflows/3-solutioning/create-architecture/` | 高 |
| T-PRE-4 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | 高 |
| T-PRE-5 | 本文档 §1.2 | 中 |
| T-PRE-6 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 中 |
| T-PRE-7 | `{project-root}/_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`（新建，可选） | 中 |
| T-SOLO-1 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 高 |
| T-SOLO-2 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 高 |
| T-SOLO-3 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | 高 |
| T-SOLO-4 | `{SKILLS_ROOT}/using-git-worktrees/SKILL.md` | 中 |
| T-SOLO-5 | 本文档（任务总览、回归测试） | 中 |
| T-SOLO-6 | `{project-root}/_bmad/_config/bmad-help.csv`、`{project-root}/_bmad/core/tasks/help.md` | 中 |

**路径说明**：`{SKILLS_ROOT}` = `%USERPROFILE%\.cursor\skills\`（Windows）；`{project-root}` = 项目根目录。

---

## 一、产出路径约定

### 1.1 speckit-workflow 产出 → spec 子目录

| 产出类型 | 存放路径 | 说明 |
|----------|----------|------|
| spec.md | `specs/{index}-{name}/spec.md` 或 `specs/epic-{epic}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | speckit.specify 产出 |
| plan.md | 同上目录 | speckit.plan 产出 |
| tasks.md | 同上目录 | speckit.tasks 产出 |
| IMPLEMENTATION_GAPS.md | 同上目录 | speckit.gaps 产出 |
| checklists/ | 同上目录下 | speckit.specify 产出的 checklist |
| research.md、data-model.md、contracts/ | 同上目录 | speckit.plan 产出 |

**原则**：与 speckit-workflow 相关的所有产出文件**必须**放在 spec 子目录下，不得放在 `_bmad-output` 或项目根其他位置。

### 1.2 BMAD 流程产出 → _bmad-output

**pre-speckit 产出（按 branch 子目录，同 branch 重复执行覆盖）**：

| 产出类型 | 存放路径 | 说明 |
|----------|----------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/{branch}/epics.md` | branch 为 `git branch --show-current` 规范化 |
| 就绪报告 | `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md` | 同上 |
| prd（planning 级） | `_bmad-output/planning-artifacts/{branch}/prd.md` 或 `prd.{ref}.json` | create-prd 产出 prd.md；同上 |
| 架构设计 | `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 或 `ARCH_*.md` | 同上 |
| 归档 | `_bmad-output/planning-artifacts/_archive/{branch}/{date}-{seq}/` | `--archive` 时先复制到此处 |

**post-speckit 产出（入 story 子目录）**：

| 产出类型 | 存放路径 | 说明 |
|----------|----------|------|
| Story 文档 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/{epic}-{story}-{slug}.md` | Create Story 产出 |
| TASKS | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/TASKS_{epic}-{story}-{slug}.md` | Dev Story 产出 |
| prd、progress | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/prd.{ref}.json`、`progress.{ref}.txt` | ralph-method |
| DEBATE 共识 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/DEBATE_共识_{slug}_{date}.md` | party-mode |
| BUGFIX 文档（有 story） | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/BUGFIX_{slug}.md` | bmad-bug-assistant |
| BUGFIX 文档（无 story） | `_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md` | 无 story 时入 _orphan |
| 跨 Story DEBATE | `_bmad-output/implementation-artifacts/_shared/DEBATE_共识_{slug}_{date}.md` | 跨 Story 时入 _shared |
| 备份 | `_bmad-output/bmad-customization-backups/` | 已有约定 |

**原则**：与 speckit-workflow 相关的产出在 spec 子目录；BMAD 产出在 `_bmad-output`。post-speckit 产出入 `implementation-artifacts/{epic}-{story}-{slug}/` 子目录，与 spec 路径 `specs/epic-{epic}/story-{story}-{slug}/` 对齐。

---

## 二、任务详情

### T-OUT-1：speckit-workflow 明确产出路径约定

#### 修改路径

`{SKILLS_ROOT}/speckit-workflow/SKILL.md`

#### 具体修改内容

**插入位置**：在「### 1.0 spec 目录路径约定」**之后**（若已存在）或「### 1.1 必须完成」**之前**，新增小节「### 1.0.1 speckit-workflow 产出路径约定」。

**插入正文**：

```markdown
### 1.0.1 speckit-workflow 产出路径约定

**所有 speckit-workflow 相关产出必须放在 spec 子目录下**：

| 产出 | 路径 | 命令 |
|------|------|------|
| spec.md | `specs/{index}-{name}/spec.md` 或 `specs/epic-{epic}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | speckit.specify |
| plan.md | 同上目录 | speckit.plan |
| tasks.md | 同上目录 | speckit.tasks |
| IMPLEMENTATION_GAPS.md | 同上目录 | speckit.gaps |
| checklists/ | 同上目录下 | speckit.specify |
| research.md、data-model.md、contracts/ | 同上目录 | speckit.plan |

**禁止**：将 speckit 产出放在 `_bmad-output` 或项目根其他位置。BMAD 流程产出见 bmad-story-assistant、bmad-bug-assistant 技能约定。
```

#### 验收标准

- [ ] 新增小节位于 §1.0 之后或 §1.1 之前
- [ ] 明确产出路径为 spec 子目录
- [ ] 明确禁止将 speckit 产出放在 _bmad-output

---

### T-OUT-2：bmad-story-assistant 与 bmad-bug-assistant 明确产出路径

#### 修改路径

- `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`
- `{SKILLS_ROOT}/bmad-bug-assistant/SKILL.md`

#### 具体修改内容

**bmad-story-assistant**：在「阶段零」或「前置检查」之后，新增小节「### 产出路径约定」。

**插入正文**：

```markdown
### 产出路径约定

**所有 bmad-story-assistant 执行时生成的文档必须放在 `_bmad-output` 下**：

| 产出 | 路径 |
|------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/epics.md` |
| Story 文档 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/TASKS_{epic}-{story}-{slug}.md` |
| prd、progress | `_bmad-output/implementation-artifacts/prd.{ref}.json`、`progress.{ref}.txt` |
| DEBATE 共识 | `_bmad-output/implementation-artifacts/DEBATE_共识_{slug}_{date}.md` |

**spec 子目录**：仅存放 speckit-workflow 产出（spec.md、plan.md、tasks.md 等），由 speckit 命令生成。BMAD 产出不得与 speckit 产出混放。
```

**bmad-bug-assistant**：在「根因分析」或「前置检查」之后，新增小节「### 产出路径约定」。

**插入正文**：

```markdown
### 产出路径约定

**所有 bmad-bug-assistant 执行时生成的文档必须放在 `_bmad-output` 下**：

| 产出 | 路径 |
|------|------|
| BUGFIX 文档 | `_bmad-output/implementation-artifacts/BUGFIX_{slug}.md` 或 `_bmad-output/BUGFIX_{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/TASKS_BUGFIX_{slug}.md` |
| prd、progress | `_bmad-output/implementation-artifacts/prd.BUGFIX_{slug}.json`、`progress.BUGFIX_{slug}.txt` |

**禁止**：将 BMAD 产出放在 spec 子目录。spec 子目录仅存放 speckit-workflow 产出。
```

#### 验收标准

- [ ] 两个技能均新增产出路径约定小节
- [ ] 明确 BMAD 产出放在 _bmad-output
- [ ] 明确与 spec 子目录的职责分离

---

### T-WT-1：setup_worktree.ps1 修复 $RepoDir 与 $WorktreeBaseDir 路径解析

#### 修改路径

`{project-root}/_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1`

#### 具体修改内容

**修改 1**：将第 17–19 行的配置块替换为：

```powershell
# 配置：使用 git 获取 repo 根，确保 worktree 创建在父目录（与主 repo 平级）
$RepoDir = $null
try {
    $RepoDir = git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0) { $RepoDir = $null }
} catch { }
if (-not $RepoDir) {
    $RepoDir = Split-Path -Parent $PSScriptRoot
    while ($RepoDir -and -not (Test-Path (Join-Path $RepoDir '.git'))) {
        $parent = Split-Path -Parent $RepoDir
        if ($parent -eq $RepoDir) { break }
        $RepoDir = $parent
    }
}
if (-not $RepoDir) {
    Write-Host "[ERROR] Could not determine repository root" -ForegroundColor Red
    exit 1
}
$RepoDir = $RepoDir.TrimEnd('/', '\')
$WorktreeBaseDir = Split-Path -Parent $RepoDir
$BaseBranch = "dev"
```

**修改 2**：在脚本末尾的 Help 说明中，确保示例路径正确：

```powershell
Write-Host "      Example: If repo is at D:\Dev\my-project, worktree at D:\Dev\my-project-{branch-name}"
```

#### 验收标准

- [ ] 从主 repo 或 worktree 执行时，$RepoDir 正确指向 repo 根
- [ ] $WorktreeBaseDir 为 repo 父目录（如 D:\Dev\）
- [ ] 执行 `create 016-test` 时，worktree 创建在 `{父目录}/{repo名}-016-test`（与主 repo 平级）

---

### T-WT-2：更新 spec目录-branch-worktree 说明文档

#### 修改路径

`{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md`

#### 具体修改内容

**新增章节**：在「六、当前遗漏与建议」之前，新增「### 产出路径约定」。

**插入正文**：

```markdown
### 产出路径约定（与 worktree 并列）

| 流程 | 产出路径 |
|------|----------|
| 与 speckit-workflow 相关 | spec 子目录：`specs/{index}-{name}/` 或 `specs/epic-{epic}/story-{story}-{slug}/` |
| 与 BMAD 流程相关 | `_bmad-output/`：planning-artifacts/、implementation-artifacts/ 等 |
```

**更新**：将 O-2 遗漏项中「建议改用」改为「已修复（见 T-WT-1）」，若 T-WT-1 已完成。

#### 验收标准

- [ ] 文档包含产出路径约定
- [ ] 与 worktree 路径约定并列说明

---

### T-WT-3：create-new-feature.ps1 -ModeBmad 增加 branch 创建（可选）

#### 修改路径

`{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

#### 具体修改内容

**修改**：在 BMAD 模式分支内，在创建 spec 目录之后、输出 JSON 之前，增加 branch 创建逻辑：

```powershell
# 若存在 git，创建 story-{epic}-{story} 分支（供后续 worktree 使用）
$baseBranch = "dev"
if ($hasGit) {
    try {
        $null = git rev-parse --verify $branchName 2>$null
        if ($LASTEXITCODE -ne 0) {
            git checkout -b $branchName $baseBranch 2>$null
            git checkout $baseBranch 2>$null
        }
    } catch {
        Write-Warning "Could not create branch $branchName for worktree"
    }
}
```

**注意**：若 BMAD 流程由 using-git-worktrees 负责创建 branch，本任务可标记为「可选」或「暂不实施」。

#### 验收标准

- [ ] 执行 `-ModeBmad -Epic 4 -Story 1 -Slug implement-base-cache` 后，`story-4-1` 分支存在
- [ ] 主 repo 仍停留在 dev（或原分支），未切换到 story-4-1

---

### T-BK-1：新建 speckit-scripts-backup 技能（类似 bmad-customization-backup）

#### 背景

修改了 speckit 相关脚本（create-new-feature.ps1、setup_worktree.ps1 等）后，需要将定制版本备份并应用到**新项目**。同一项目内无需同步，因 speckit 脚本已在 git 索引中。

#### 修改路径

`{SKILLS_ROOT}/speckit-scripts-backup/`（新建技能目录及 SKILL.md、scripts/）

#### 具体修改内容

**1. 创建技能结构**：

```
{SKILLS_ROOT}/speckit-scripts-backup/
├── SKILL.md
├── scripts/
│   ├── backup_speckit_scripts.py
│   └── apply_speckit_scripts.py
└── references/
    └── migrate.md（可选）
```

**2. SKILL.md 内容要点**：

- **用途**：备份 specs/000-Overview/.specify/scripts/ 下的定制脚本（create-new-feature.ps1、setup_worktree.ps1 等），并在新项目中应用。
- **备份输出**：`_bmad-output/speckit-scripts-backups/YYYY-MM-DD_HH-MM-SS_speckit-scripts/`
- **备份范围**：`specs/000-Overview/.specify/scripts/` 下全部内容（或显式清单：create-new-feature.ps1、setup_worktree.ps1、find-related-docs.ps1 等）
- **应用场景**：新项目尚无 speckit 定制脚本，或新项目使用默认 speckit 需升级为 BMAD 增强版时
- **同一项目**：无需同步，脚本已由 git 管理

**3. backup_speckit_scripts.py**：

- 参数：`--project-root`（默认 cwd）
- 将 `specs/000-Overview/.specify/scripts/` 复制到 `_bmad-output/speckit-scripts-backups/<timestamp>_speckit-scripts/`
- 生成 manifest.txt

**4. apply_speckit_scripts.py**：

- 参数：`--backup-path`、`--project-root`、`--dry-run`
- 将备份内容按相对路径覆盖到目标项目的 `specs/000-Overview/.specify/scripts/`
- 若目标路径不存在，先创建目录结构

#### 验收标准

- [ ] 技能目录存在，含 SKILL.md、backup/apply 脚本
- [ ] 执行 backup 后，`_bmad-output/speckit-scripts-backups/` 下存在带时间戳的备份
- [ ] 执行 apply 到新项目（或空目录）后，create-new-feature.ps1 含 -ModeBmad 等参数
- [ ] SKILL 中明确「同一项目无需同步」

---

### T-RT-1：增加端到端流程回归测试

#### 修改路径

`{project-root}/tests/test_speckit_worktree_e2e.py`（新建）或 `{project-root}/docs/BMAD/` 下测试清单文档

#### 具体修改内容

**1. 端到端流程覆盖**：

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| 1 | create-new-feature.ps1 无参数 + feature 描述 | spec 子目录创建，branch 创建 |
| 2 | setup_worktree.ps1 create \<branch\> | worktree 在父目录平级创建（{repo名}-{branch}） |
| 3 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-e2e | specs/epic-4/story-1-test-e2e/ 及 spec-E4-S1.md 存在 |
| 4 | 产出路径：speckit 产出在 spec 子目录 | spec.md、plan.md 等位于 spec 子目录 |
| 5 | 产出路径：BMAD 产出在 _bmad-output | Story、TASKS 等位于 _bmad-output/implementation-artifacts/ |

**2. 实现方式**（二选一或并存）：

- **方式 A**：Python 测试脚本，调用 subprocess 执行 PowerShell 脚本，断言目录/文件存在
- **方式 B**：Markdown 测试清单（`docs/BMAD/E2E_TEST_CHECKLIST_speckit_worktree.md`），人工或 CI 按步骤执行并勾选

**3. 测试隔离**：使用临时分支名（如 `999-e2e-test`）、测试后清理（删除 worktree、删除 spec 目录）

**4. 回归测试表更新**：在「三、回归测试」中新增 RT-E2E 行，引用本端到端测试。

#### 验收标准

- [ ] 存在端到端测试脚本或测试清单文档
- [ ] 覆盖 create-new-feature（standalone + BMAD）、setup_worktree、产出路径
- [ ] 测试可重复执行，有清理步骤
- [ ] 回归测试表（§三）含 RT-E2E 项，执行命令或文档路径明确

---

### 2.1 _bmad-output 子目录结构优化（T-BMAD-1～T-BMAD-7）

**来源**：DEBATE_bmad-output子目录结构_100轮辩论产出_2026-03-02.md。解决 implementation-artifacts 平铺杂乱问题，post-speckit 产出入 story 子目录。

### T-BMAD-1：bmad-story-assistant 产出路径约定（pre/post speckit）

#### 修改路径

`{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`

#### 具体修改内容

**插入位置**：在「### 产出路径约定」或「阶段零」之后，新增/替换小节「### 产出路径约定」。

**插入正文**（见 DEBATE 文档 M-1）：

```markdown
### 产出路径约定

**pre-speckit 产出（保持平铺）**：
| 产出 | 路径 |
|------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/epics.md` |
| 就绪报告 | `_bmad-output/planning-artifacts/implementation-readiness-report-{date}.md` |
| prd（planning 级） | `_bmad-output/planning-artifacts/prd.{ref}.json` |

**post-speckit 产出（入 story 子目录）**：
| 产出 | 路径 |
|------|------|
| Story 文档 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/{epic}-{story}-{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/TASKS_{epic}-{story}-{slug}.md` |
| prd、progress | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/prd.{ref}.json`、`progress.{ref}.txt` |
| DEBATE 共识 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/DEBATE_共识_{slug}_{date}.md` |
| 跨 Story DEBATE | `_bmad-output/implementation-artifacts/_shared/DEBATE_共识_{slug}_{date}.md` |

**子目录创建**：Create Story 产出时，若 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` 不存在，须先创建。子目录由 create-new-feature.ps1 -ModeBmad 在创建 spec 时同步创建，或由 bmad-story-assistant 在首次写入 Story 时创建。
```

**阶段一 Create Story 产出路径更新**：将 prompt 中的 `_bmad-output/implementation-artifacts/{epic_num}-{story_num}-<title>.md` 改为 `_bmad-output/implementation-artifacts/{epic_num}-{story_num}-{slug}/{epic_num}-{story_num}-{slug}.md`（slug 从 Story 标题或用户输入推导）。

#### 验收标准

- [ ] 技能含 pre-speckit / post-speckit 产出路径约定
- [ ] Create Story 产出路径指向 story 子目录

---

### T-BMAD-2：bmad-bug-assistant 产出路径约定（有/无 story）

#### 修改路径

`{SKILLS_ROOT}/bmad-bug-assistant/SKILL.md`

#### 具体修改内容

**插入位置**：在「### 产出路径约定」或「根因分析」之后。

**插入正文**（见 DEBATE 文档 M-2）：

```markdown
### 产出路径约定

**有 story 上下文的 BUGFIX**：
| 产出 | 路径 |
|------|------|
| BUGFIX 文档 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/BUGFIX_{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/TASKS_BUGFIX_{slug}.md` |
| prd、progress | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/prd.BUGFIX_{slug}.json`、`progress.BUGFIX_{slug}.txt` |

**无 story 上下文的 BUGFIX**：
| 产出 | 路径 |
|------|------|
| BUGFIX 文档 | `_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/_orphan/TASKS_BUGFIX_{slug}.md` |
```

#### 验收标准

- [ ] 有 story / 无 story 路径区分明确
- [ ] 无 story 时入 _orphan

---

### T-BMAD-3：create-new-feature.ps1 同步创建 _bmad-output 子目录

#### 修改路径

`{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

#### 具体修改内容

**插入位置**：在 BMAD 模式创建 spec 目录之后（`New-Item` 之后）、输出 JSON 之前（`if ($Json)` 之前）。

**插入逻辑**：

```powershell
# 同步创建 _bmad-output 子目录（与 spec 同名）
$bmadOutputBase = Join-Path $repoRoot "_bmad-output"
$implArtifacts = Join-Path $bmadOutputBase "implementation-artifacts"
$storySubdirName = "$Epic-$Story-$Slug"
$storySubdir = Join-Path $implArtifacts $storySubdirName
if (-not (Test-Path $storySubdir)) {
    New-Item -ItemType Directory -Path $storySubdir -Force | Out-Null
    Write-Host "[create-new-feature] Created _bmad-output subdir: $storySubdir"
}
```

**前置条件**：确保 `$Epic`、`$Story`、`$Slug` 在 BMAD 模式块内已定义。

#### 验收标准

- [ ] 执行 `-ModeBmad -Epic 4 -Story 1 -Slug test-e2e` 后，`_bmad-output/implementation-artifacts/4-1-test-e2e/` 存在

---

### T-BMAD-4：speckit-workflow 引用 _bmad-output 子目录

#### 修改路径

`{SKILLS_ROOT}/speckit-workflow/SKILL.md`

#### 具体修改内容

**插入位置**：在「### 1.0.1 speckit-workflow 产出路径约定」之后。

**插入正文**：

```markdown
### 1.0.2 BMAD 产出与 _bmad-output 子目录对应

speckit 产出在 spec 子目录；BMAD 产出在 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`。
当 spec 路径为 `specs/epic-{epic}/story-{story}-{slug}/` 时，对应 BMAD 子目录为 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`。
```

#### 验收标准

- [ ] speckit-workflow 与 _bmad-output 子目录对应关系明确

---

### T-BMAD-5：本文档 §1.2 更新

#### 修改路径

`{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md`

#### 具体修改内容

**已完成**：§1.2 已更新为 pre-speckit / post-speckit 二分法及 story 子目录路径。

#### 验收标准

- [ ] §1.2 产出路径表与 DEBATE 共识一致

---

### T-BMAD-6：spec目录-branch-worktree 说明文档更新

#### 修改路径

`{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md`

#### 具体修改内容

**新增章节**：在「六、当前遗漏与建议」之前，新增「### 产出路径约定（_bmad-output 子目录）」：

```markdown
### 产出路径约定（_bmad-output 子目录）

| 流程 | 产出路径 |
|------|----------|
| speckit 之前 | planning-artifacts 平铺：epics.md、implementation-readiness-report |
| speckit 之后 | implementation-artifacts/{epic}-{story}-{slug}/：Story、TASKS、prd、progress、DEBATE、BUGFIX |
| 创建时机 | create-new-feature.ps1 -ModeBmad 创建 spec 时，同步创建 _bmad-output/implementation-artifacts/{epic}-{story}-{slug}/ |
```

#### 验收标准

- [ ] 文档含 _bmad-output 子目录约定

---

### T-BMAD-7：迁移脚本（可选）

#### 修改路径

`{project-root}/_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`（新建）

#### 具体修改内容

**功能**：按文件名解析 `{epic}-{story}-{slug}`，将平铺文件移动到对应子目录；若无法解析，移动到 `_orphan/`。支持 `--dry-run`。

**实现要点**：
- 解析 `{epic}-{story}-{slug}.md`、`TASKS_{epic}-{story}-{slug}.md`、`prd.{ref}.json`（ref 含 epic-story-slug）等
- 创建目标子目录；移动文件；输出迁移报告
- 不移动 `_bmad-output/planning-artifacts/` 下文件
- 不移动 `current_session_pids_*.txt`、`bmad-customization-backups/` 等根目录文件

#### 验收标准

- [ ] 迁移脚本 `--dry-run` 可正确解析并输出迁移计划

---

### 2.2 pre-speckit 产出覆盖策略（T-PRE-1～T-PRE-7）

**来源**：DEBATE_pre-speckit产出覆盖问题_100轮总结_2026-03-02.md。解决同 branch 重复发起 create-epics-and-stories / create-prd 时覆盖之前文件的问题。

**与 T-BMAD-1 的关系**：T-PRE-4 的 pre-speckit 产出路径约定**替换** T-BMAD-1 中的 pre-speckit 部分。若已实施 T-BMAD-1，T-PRE-4 实施时须用 branch 子目录约定覆盖原有平铺约定。

### T-PRE-1：create-epics-and-stories 工作流产出路径（branch 子目录）

#### 修改路径

`{project-root}/_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/` 下各 step

#### 具体修改内容

**新增前置逻辑**：获取并规范化 branch 名
```yaml
branch_raw = run("git rev-parse --abbrev-ref HEAD")
if branch_raw == "HEAD":
    branch = f"detached-{run('git rev-parse --short HEAD')}"
else:
    branch = branch_raw.replace("/", "-")
output_base = "_bmad-output/planning-artifacts/{branch}"
```

**产出路径更新**：`epics.md` → `_bmad-output/planning-artifacts/{branch}/epics.md`

**归档逻辑**：若传入 `--archive`，先将现有 `{branch}/` 目录复制到 `_archive/{branch}/{date}-{seq}/`，再写入。

#### 验收标准

- [ ] branch=dev 执行后 `planning-artifacts/dev/epics.md` 存在
- [ ] branch=feature/xxx 执行后 `planning-artifacts/feature-xxx/epics.md` 存在
- [ ] 同 branch 再次执行（无 --archive）时覆盖
- [ ] 同 branch 再次执行（有 --archive）时旧文件入 `_archive/{branch}/{date}-001/`

---

### T-PRE-2：create-prd 工作流产出路径

#### 修改路径

`{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-prd/` 下各 step

#### 具体修改内容

**产出路径**：`prd.md` 或 `prd.{ref}.json` → `_bmad-output/planning-artifacts/{branch}/prd.md` 或 `prd.{ref}.json`

**branch 解析与归档**：同 T-PRE-1。

#### 验收标准

- [ ] branch=dev 执行 create-prd 后 `planning-artifacts/dev/prd.md` 或 `prd.{ref}.json` 存在

---

### T-PRE-3：check-implementation-readiness 工作流产出路径

#### 修改路径

`{project-root}/_bmad/bmm/workflows/3-solutioning/check-implementation-readiness/` 下各 step

#### 具体修改内容

**产出路径**：`implementation-readiness-report-{date}.md` → `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md`

**branch 解析与归档**：同 T-PRE-1。

#### 验收标准

- [ ] branch=dev 执行后 `planning-artifacts/dev/implementation-readiness-report-{date}.md` 存在

---

### T-PRE-3b：create-architecture 工作流产出路径

#### 修改路径

`{project-root}/_bmad/bmm/workflows/3-solutioning/create-architecture/` 下各 step

#### 具体修改内容

**产出路径**：`architecture.{ref}.md` 或 `ARCH_*.md` → `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 或 `ARCH_*.md`

**branch 解析与归档**：同 T-PRE-1。

#### 验收标准

- [ ] branch=dev 执行 create-architecture 后 `planning-artifacts/dev/architecture.{ref}.md` 或 `ARCH_*.md` 存在

---

### T-PRE-4：bmad-story-assistant pre-speckit 产出路径约定更新

#### 修改路径

`{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`

#### 具体修改内容

**替换**「### 产出路径约定」中 pre-speckit 部分为（**覆盖** T-BMAD-1 的 pre-speckit 约定）：

```markdown
**pre-speckit 产出（按 branch 子目录）**：
| 产出 | 路径 |
|------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/{branch}/epics.md` |
| 就绪报告 | `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md` |
| prd（planning 级） | `_bmad-output/planning-artifacts/{branch}/prd.md` 或 `prd.{ref}.json` |
| 架构设计 | `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 或 `ARCH_*.md` |

**branch 解析**：`git rev-parse --abbrev-ref HEAD`；若为 `HEAD` 则 `detached-{short-sha}`；`/` 替换为 `-`。
**归档**：`--archive` 时先复制到 `_archive/{branch}/{date}-{seq}/` 再写入。
```

#### 验收标准

- [ ] 技能中 pre-speckit 路径含 `{branch}` 子目录

---

### T-PRE-5：本文档 §1.2 更新

#### 修改路径

本文档 §1.2

#### 具体修改内容

**已完成**：§1.2 pre-speckit 产出路径已更新为 branch 子目录及归档策略。

#### 验收标准

- [ ] §1.2 与 DEBATE 共识一致

---

### T-PRE-6：spec目录-branch-worktree 说明文档更新

#### 修改路径

`{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md`

#### 具体修改内容

**新增**「### pre-speckit 产出覆盖策略」：

```markdown
### pre-speckit 产出覆盖策略

| 产出 | 路径 | 覆盖策略 |
|------|------|----------|
| epics.md | planning-artifacts/{branch}/epics.md | 同 branch 重复执行覆盖；--archive 时先归档 |
| prd、就绪报告 | planning-artifacts/{branch}/ | 同上 |
| 归档 | planning-artifacts/_archive/{branch}/{date}-{seq}/ | --archive 时 |
```

#### 验收标准

- [ ] 文档含 pre-speckit 覆盖策略

---

### T-PRE-7：迁移脚本（可选）

#### 修改路径

`{project-root}/_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`（新建）

#### 具体修改内容

**功能**：将 `_bmad-output/planning-artifacts/` 下平铺的 epics.md、prd.*.json、implementation-readiness-report-*.md 移动到 `planning-artifacts/{current-branch}/`。支持 `--dry-run`。

#### 验收标准

- [ ] 迁移脚本 `--dry-run` 可正确输出迁移计划

---

### 2.3 Solo 开发 worktree/branch 用户选择权（T-SOLO-1～T-SOLO-5）

**来源**：DEBATE_solo开发worktree-branch选择_100轮总结_2026-03-03.md。支持 solo 快速迭代：用户可选择是否创建新 worktree、是否创建新 branch，允许在当前 worktree/branch 做多 epic/story、bugfix 开发。

### T-SOLO-1：create-new-feature.ps1 增加 -CreateBranch、-CreateWorktree 参数

#### 修改路径

`{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

#### 具体修改内容

**1. 参数定义**（param 块内，`[string]$Slug = ""` 之后）：`[switch]$CreateBranch`、`[switch]$CreateWorktree`

**2. 默认值逻辑**（`Set-Location $repoRoot` 之后、`if ($ModeBmad)` 之前）：standalone 时 CreateBranch=true；BMAD 时 CreateBranch=false、CreateWorktree=false；无 git 时两者强制 false。

**3. standalone 模式**：将 branch 创建改为 `if ($hasGit -and $CreateBranch)`，增加 `-not $CreateBranch` 时的提示。

**4. BMAD 模式**：在创建 spec 目录之后、输出 JSON 之前，增加：若 `$CreateBranch` 则 `git checkout -b $branchName dev`；若 `$CreateWorktree` 则调用 `setup_worktree.ps1 create $wtBranch`，其中 `$wtBranch = if ($CreateBranch) { $branchName } else { 当前分支（git rev-parse --abbrev-ref HEAD）或 detached-{short-sha} }`（fallback：CreateBranch=false 时使用当前 branch）。

**5. Help 更新**：增加 `-CreateBranch`、`-CreateWorktree` 说明及 Solo 快速迭代、完整隔离示例。

#### 验收标准

- [ ] BMAD 模式默认不创建 branch、不创建 worktree
- [ ] `-CreateBranch` 时创建 branch
- [ ] `-CreateWorktree` 时创建 worktree
- [ ] `-CreateWorktree` 且无 `-CreateBranch` 时，worktree 基于当前 branch 创建（不创建 story-{epic}-{story} 分支）
- [ ] 无 git 时两者强制 false

**与 T-WT-3 的关系**：T-SOLO-1 实施后，T-WT-3 的 branch 创建逻辑由 T-SOLO-1 的 `CreateBranch` 条件替代；两者修改同一脚本，T-SOLO-1 为 T-WT-3 的条件化扩展。

---

### T-SOLO-2：spec目录-branch-worktree 说明文档新增 Solo 章节

#### 修改路径

`{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md`

#### 具体修改内容

**新增**「## 〇、Solo 快速迭代与用户选择权」章节（§二之前），含用户选择点、Solo 快速迭代场景、完整隔离场景。

#### 验收标准

- [ ] 文档含 Solo 快速迭代与用户选择权说明

---

### T-SOLO-3：bmad-story-assistant 补充 Solo 快速迭代模式

#### 修改路径

`{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`

#### 具体修改内容

**新增小节**（Worktree 策略之后）「### Solo 快速迭代模式（无新 worktree/branch）」：说明不创建时 spec、产出路径、planning-artifacts 按 `{branch}/`，多 epic/story 同 branch 时各 story 独立子目录。

#### 验收标准

- [ ] 技能含 Solo 快速迭代模式说明

---

### T-SOLO-4：using-git-worktrees 补充「不创建 worktree」场景

#### 修改路径

`{SKILLS_ROOT}/using-git-worktrees/SKILL.md`

#### 具体修改内容

**新增小节**（Adaptive Worktree 策略之后）「### Solo 快速迭代模式（不创建 worktree）」：说明 create-new-feature.ps1 未指定 -CreateWorktree 时不调用 worktree 创建，Dev Story 在当前目录执行。

#### 验收标准

- [ ] 技能含「不创建 worktree」场景说明

---

### T-SOLO-5：本文档任务总览与回归测试更新

#### 修改路径

本文档

#### 具体修改内容

**已完成**：任务总览已含 T-SOLO-1～5；回归测试表已含 RT-SOLO-1～7。

#### 验收标准

- [ ] 回归测试表含 RT-SOLO 项

---

### T-SOLO-6：bmad-help 提示 Solo branch/worktree 选择

#### 修改路径

- `{project-root}/_bmad/_config/bmad-help.csv`
- `{project-root}/_bmad/core/tasks/help.md`

#### 具体修改内容

**1. bmad-help.csv**：在 Create Story (CS) 行的 `description` 列中扩展说明（**以 description 为主**；若 CSV 有 `options` 列且被 help 任务读取，可额外补充 `Solo: 默认不创建 branch/worktree | 完整隔离: -CreateBranch -CreateWorktree`，否则仅改 description）：

- **description 扩展**（必须）：在现有描述后追加「BMAD 默认不创建 branch/worktree（solo 快速迭代）；可选 -CreateBranch、-CreateWorktree 做完整隔离。」

**2. help.md**：**优先**在「7. Additional guidance to convey」段落中新增规则；若该段落不存在或结构已变，则插入「6. Present recommendations」相关段落：

- 当推荐 Create Story 或 Dev Story 时，若用户处于 BMAD 流程，附加提示：「Solo 快速迭代：默认不创建新 branch/worktree，可在当前目录继续；需完整隔离时使用 -CreateBranch -CreateWorktree。」

**3. 路径说明**：`{project-root}/_bmad/` 适用于已安装 BMAD 方法的项目。若项目内无 `_bmad` 目录（BMAD 未安装），则 T-SOLO-6 不适用，可跳过。

#### 验收标准

- [ ] bmad-help 推荐 Create Story/Dev Story 时，用户可见 Solo 与完整隔离的选项说明
- [ ] 执行 bmad-help 问「下一步」时，推荐中包含对 -CreateBranch、-CreateWorktree 的简要说明

---

## 三、回归测试

| 测试项 | 命令/操作 | 预期结果 |
|--------|-----------|----------|
| RT-OUT-1 | 执行 speckit.specify | spec.md 等产出在 spec 子目录下 |
| RT-OUT-2 | 执行 bmad-story-assistant Create Story | Story 文档在 _bmad-output/implementation-artifacts/ |
| RT-WT-1 | 从 worktree 执行 setup_worktree.ps1 create 099-test | 在 {父目录} 下创建 {repo名}-099-test |
| RT-WT-2 | 从主 repo 执行 setup_worktree.ps1 create 098-test | 在 {父目录} 下创建 {repo名}-098-test |
| RT-E2E | `pytest tests/test_speckit_worktree_e2e.py -v` 或按 `docs/BMAD/E2E_TEST_CHECKLIST_speckit_worktree.md` 执行 | create-new-feature、setup_worktree、产出路径全流程通过 |
| RT-BMAD-1 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-subdir | `_bmad-output/implementation-artifacts/4-1-test-subdir/` 存在 |
| RT-BMAD-2 | bmad-story-assistant Create Story 4.1 | Story 文档在 `_bmad-output/implementation-artifacts/4-1-{slug}/` |
| RT-BMAD-3 | create-epics-and-stories（branch=dev） | epics.md 在 `_bmad-output/planning-artifacts/dev/epics.md` |
| RT-BMAD-4 | bmad-bug-assistant（无 story） | BUGFIX 入 `_bmad-output/implementation-artifacts/_orphan/` |
| RT-BMAD-5 | party-mode 跨 Story DEBATE | DEBATE 共识入 `_bmad-output/implementation-artifacts/_shared/` |
| RT-PRE-1 | create-epics-and-stories（branch=dev） | `planning-artifacts/dev/epics.md` 存在 |
| RT-PRE-2 | create-epics-and-stories（branch=feature/xxx） | `planning-artifacts/feature-xxx/epics.md` 存在 |
| RT-PRE-3 | create-epics-and-stories 再次执行（无 --archive） | epics.md 被覆盖 |
| RT-PRE-4 | create-epics-and-stories --archive 再次执行 | 旧文件在 `_archive/dev/{date}-001/`，新文件在原路径 |
| RT-PRE-5 | create-prd（branch=dev） | `planning-artifacts/dev/prd.md` 或 `prd.{ref}.json` 存在 |
| RT-PRE-6 | check-implementation-readiness（branch=dev） | `planning-artifacts/dev/implementation-readiness-report-{date}.md` 存在 |
| RT-PRE-7 | 迁移脚本 --dry-run | 输出迁移计划，无破坏性操作 |
| RT-PRE-8 | create-epics-and-stories（detached HEAD） | 产出在 `planning-artifacts/detached-{short-sha}/epics.md` |
| RT-PRE-9 | create-architecture（branch=dev） | `planning-artifacts/dev/architecture.{ref}.md` 或 `ARCH_*.md` 存在 |
| RT-SOLO-1 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug rt-solo | 无 branch 创建，无 worktree 创建 |
| RT-SOLO-2 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug rt-solo -CreateBranch | branch story-4-1 存在 |
| RT-SOLO-3 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug rt-solo -CreateBranch -CreateWorktree | worktree 创建 |
| RT-SOLO-4 | standalone 模式无参数 | git checkout -b 执行（CreateBranch 默认 true） |
| RT-SOLO-5 | 同 branch 创建 4.1、4.2 | specs/epic-4/story-1-*、story-2-* 及 implementation-artifacts/4-1-*、4-2-* 存在 |
| RT-SOLO-6 | 现有 RT-OUT-1、RT-WT-1 等 | 不变，仍通过 |
| RT-SOLO-7 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug rt-solo -CreateWorktree（无 -CreateBranch） | worktree 指向当前 branch，不创建 story-4-1 |
| RT-SOLO-8 | 执行 bmad-help 问「下一步」 | 推荐 Create Story/Dev Story 时含 Solo（默认不创建 branch/worktree）与完整隔离（-CreateBranch -CreateWorktree）说明 |

---

## 四、实施顺序建议

1. **Phase 1**：T-OUT-1、T-OUT-2（产出路径约定）
2. **Phase 2**：T-WT-1（setup_worktree.ps1 路径修复）
3. **Phase 3**：T-WT-2（文档更新）
4. **Phase 4**：T-WT-3（可选，BMAD branch 创建）
5. **Phase 5**：T-BK-1（speckit-scripts-backup 技能）
6. **Phase 6**：T-RT-1（端到端回归测试）
7. **Phase 7**：T-BMAD-1、T-BMAD-2（技能产出路径约定）
8. **Phase 8**：T-BMAD-3（create-new-feature.ps1 同步创建子目录）
9. **Phase 9**：T-BMAD-5、T-BMAD-6（文档更新）
10. **Phase 10**：T-BMAD-4（speckit-workflow 引用）
11. **Phase 11**：T-BMAD-7（迁移脚本，可选）
12. **Phase 12**：T-PRE-1、T-PRE-2、T-PRE-3、T-PRE-3b（_bmad 工作流产出路径）
13. **Phase 13**：T-PRE-4（bmad-story-assistant pre-speckit 路径约定）
14. **Phase 14**：T-PRE-5、T-PRE-6（文档更新）
15. **Phase 15**：T-PRE-7（迁移脚本，可选）
16. **Phase 16**：T-SOLO-1（create-new-feature.ps1 核心修改）
17. **Phase 17**：T-SOLO-2（说明文档）
18. **Phase 18**：T-SOLO-3、T-SOLO-4（技能更新）
19. **Phase 19**：T-SOLO-5（本文档更新）
20. **Phase 20**：T-SOLO-6（bmad-help 提示 Solo 选项）

---

*本任务列表由产出路径约定与 worktree 讨论补充生成，可与 TASKS_spec目录命名规则Gap_2026-03-02 合并实施。_bmad-output 子目录结构优化任务来源于 DEBATE_bmad-output子目录结构_100轮辩论产出。pre-speckit 产出覆盖策略任务来源于 DEBATE_pre-speckit产出覆盖问题_100轮总结。Solo 开发 worktree/branch 选择任务来源于 DEBATE_solo开发worktree-branch选择_100轮总结。*
