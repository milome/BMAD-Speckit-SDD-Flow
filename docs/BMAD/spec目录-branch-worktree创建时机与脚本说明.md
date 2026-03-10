# Spec 子目录、Git Branch、Worktree 创建时机与脚本说明

**日期**: 2026-03-02  
**目的**: 明确 spec 子目录、git branch、worktree 子目录的创建时机、创建脚本及当前遗漏

---

## 〇、Solo 快速迭代与用户选择权

**来源**：DEBATE_solo开发worktree-branch选择_100轮总结_2026-03-03.md。支持 solo 快速迭代：用户可选择是否创建新 worktree、是否创建新 branch，允许在当前 worktree/branch 做多 epic/story、bugfix 开发。

### 用户选择点

| 选择点 | 参数 | 默认（BMAD） | 默认（standalone） | 说明 |
|--------|------|-------------|-------------------|------|
| 是否创建 branch | `-CreateBranch` | 否 | 是 | BMAD 模式默认不创建 branch，便于同 branch 多 story |
| 是否创建 worktree | `-CreateWorktree` | 否 | 不适用 | BMAD 模式默认不创建 worktree，Dev Story 在当前目录执行 |

### Solo 快速迭代场景

**适用**：solo 开发、多 epic/story 同 branch、快速迭代、bugfix 穿插。

**操作**：`create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug my-story`（不传 `-CreateBranch`、`-CreateWorktree`）

**效果**：
- 仅创建 spec 子目录 `specs/epic-4/story-1-my-story/` 及 `_bmad-output/implementation-artifacts/4-1-my-story/`
- 不创建 branch、不创建 worktree
- Dev Story 在当前目录执行，speckit 产出在 spec 子目录，BMAD 产出在 _bmad-output

### 完整隔离场景

**适用**：需独立 worktree、分支隔离、避免冲突。

**操作**：`create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug my-story -CreateBranch -CreateWorktree`

**效果**：
- 创建 `story-4-1` 分支
- 调用 `setup_worktree.ps1 create story-4-1` 创建 worktree
- 在 worktree 内执行 Dev Story

**混合**：`-CreateWorktree` 无 `-CreateBranch` 时，worktree 基于当前 branch 创建（不创建 story-{epic}-{story} 分支）。

---

## 一、总览表

| 产物 | standalone speckit | BMAD 流程 | 创建脚本 | 创建时机 |
|------|-------------------|-----------|----------|----------|
| **spec 子目录** | `specs/{index}-{name}/` | `specs/epic-{epic}/story-{story}-{slug}/` | `create-new-feature.ps1` | specify 阶段 |
| **git branch** | `{index}-{name}` | `story-{epic}-{story}` | 见下表 | 见下表 |
| **worktree 子目录** | `{父目录}/{repo名}-{branch}/`，与项目根平级 | 见下表 | 手动或 BMAD 命令 |

---

## 二、standalone speckit 流程

### 2.1 触发命令

`/speckit.specify` 或 `.speckit.specify`（在 `specs/000-Overview/` 或项目根执行）

### 2.2 创建脚本

**脚本路径**: `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

**调用方式**（由 speckit.specify 命令内部执行）:
```powershell
.\create-new-feature.ps1 -Json -Number <N+1> -ShortName "<short-name>" "<feature description>"
```

### 2.3 创建产物（一次性完成）

| 产物 | 是否创建 | 说明 |
|------|----------|------|
| spec 子目录 | ✅ | `specs/{index}-{name}/`，如 `specs/016-fix-realtime-tick/` |
| spec.md | ✅ | 从 `.specify/templates/spec-template.md` 复制 |
| git branch | ✅ | `git checkout -b {index}-{name}`，与 spec 目录同名 |
| worktree | ❌ | **不创建**，需手动 |

### 2.4 worktree 创建（手动）

**路径约定**（与 dev 分支所在目录平级）:
```
D:\Dev\{repo名}                    ← 主 repo（dev 等分支）
D:\Dev\{repo名}-015-indicator-system-refactor  ← worktree（015 分支）
```
即：`{父目录}/{repo名}-{branch-name}`，与主 repo 平级。repo名=主 repo 目录名（可由 REPO_NAME 环境变量覆盖）。

**脚本 1**（通用）: `_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1`

```powershell
# 从项目根或 specs/000-Overview 目录执行
.\specs\000-Overview\.specify\scripts\powershell\setup_worktree.ps1 create <branch-name>
# 示例: .\specs\000-Overview\.specify\scripts\powershell\setup_worktree.ps1 create 016-fix-realtime-tick
```

- **worktree 路径**: `$WorktreeBaseDir/$RepoName-{branch}`，其中 `$WorktreeBaseDir` = 主 repo 的父目录，`$RepoName` = 主 repo 目录名（可由 REPO_NAME 覆盖）
- **注意**: 已由 T-WT-1 修复，脚本内已使用 `git rev-parse --show-toplevel` 获取 repo 根；失败时向上查找 `.git` 目录（见 §六 O-2）。

**脚本 2**（按功能硬编码）: 各 spec 目录下的 `CREATE_WORKTREE.ps1`（如 `specs/008-kline-display-policy/CREATE_WORKTREE.ps1`）

- 原硬编码 `$RepoDir`、`$WorktreePath`；已改为动态获取（见 M-9）
- 适用：单功能独立 worktree，需人工维护每个功能的脚本

---

## 三、BMAD 流程

### 3.1 触发时机

1. **Create Story**（bmad-story-assistant）产出 Story 文档
2. **spec 目录创建**：在 Create Story 之后、执行 speckit specify 之前

### 3.2 创建脚本

**脚本路径**: 同上 `create-new-feature.ps1`

**调用方式**:
```powershell
.\create-new-feature.ps1 -ModeBmad -Epic <N> -Story <N> -Slug <slug>
# 示例: .\create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug implement-base-cache
```

### 3.3 创建产物（BMAD 模式）

| 产物 | 是否创建 | 说明 |
|------|----------|------|
| spec 子目录 | ✅ | `specs/epic-{epic}/story-{story}-{slug}/` |
| spec-E{epic}-S{story}.md | ✅ | 占位文件 |
| git branch | ❌ | **不创建**（仅输出 BRANCH_NAME，无 `git checkout -b`） |
| worktree | ❌ | **不创建** |

### 3.4 遗漏：BMAD 模式下 branch 与 worktree 由谁创建？

**当前状态**:
- `create-new-feature.ps1 -ModeBmad` 只创建 spec 目录和占位 spec 文件
- 输出 `BRANCH_NAME: story-4-1`，但**不执行** `git checkout -b story-4-1`

**预期创建方**（根据 bmad-speckit-integration-TASKS、using-git-worktrees）:
- **branch**: 应由 `using-git-worktrees` 技能在创建 worktree 时创建，或由 BMAD 工作流在「Dev Story 实施」前显式创建
- **worktree**: `using-git-worktrees` 技能，通过 `/bmad-create-worktree epic=N story=N` 等命令

**Story 级 worktree**（Story 数≤2）:
- 路径: `{父目录}/{repo名}-story-{epic}-{story}`（与项目根平级，repo名=目录名）
- 分支需已存在 `story-{epic}-{story}`，否则 `git worktree add` 会失败
- **遗漏**: 无脚本在 BMAD 流程中创建 `story-4-1` 分支，与 `create-new-feature.ps1 -ModeBmad` 未创建分支形成缺口

**Epic 级 worktree**（Story 数≥3）:
- 路径: `{父目录}/{repo名}-feature-epic-{epic}`（与项目根平级，repo名=目录名）
- 使用 `setup_worktree.ps1 create feature-epic-{epic_id}` 或 `git worktree add` 创建 worktree 时**同时创建** Epic 分支
- Story 分支 `story-4-1` 在 Epic worktree 内通过 `git checkout -b story-4-1` 创建
- **此处无遗漏**：Epic 级时 branch 在 worktree 创建或切换时创建

---

## 四、worktree 平级路径：如何调用、何时调用

### 4.1 路径约定（延续既有习惯）

| 主 repo | worktree | 说明 |
|---------|----------|------|
| `D:\Dev\{repo名}` | `D:\Dev\{repo名}-015-indicator-system-refactor` | 与 dev 分支所在目录平级 |
| `{父目录}/{repo名}` | `{父目录}/{repo名}-{branch}` | branch 如 `015-indicator-system-refactor`；repo名=目录名 |

### 4.2 如何调用

**方式 A：通用脚本 setup_worktree.ps1**

```powershell
# 在项目根（主 repo 或任一 worktree）执行
cd D:\Dev\{repo名}   # 或 cd D:\Dev\{repo名}-015-indicator-system-refactor
.\specs\000-Overview\.specify\scripts\powershell\setup_worktree.ps1 create 016-fix-realtime-tick
```

**方式 B：按功能硬编码的 CREATE_WORKTREE.ps1**

```powershell
# 进入对应 spec 目录执行
cd {repo根}/specs/008-kline-display-policy
.\CREATE_WORKTREE.ps1
# 脚本内已硬编码 $RepoDir、$BranchName、$WorktreePath
```

**方式 C：手动 git 命令**

```powershell
cd {repo根}
git checkout dev
repo_name=$(basename "$(git rev-parse --show-toplevel)")
git worktree add "../$repo_name-016-fix-realtime-tick" 016-fix-realtime-tick
cd "../$repo_name-016-fix-realtime-tick"
```

### 4.3 何时调用

| 时机 | 说明 |
|------|------|
| **standalone speckit** | `/speckit.specify` 执行后，`create-new-feature.ps1` 已创建 spec 目录和 branch，**随后手动**执行 setup_worktree.ps1 或 CREATE_WORKTREE.ps1 |
| **BMAD** | Create Story 之后、`create-new-feature.ps1 -ModeBmad` 创建 spec 目录后，需先创建 branch（当前遗漏），**再**执行 worktree 脚本 |
| **推荐顺序** | 1. speckit.specify（或 create-new-feature.ps1）→ 2. setup_worktree.ps1 create \<branch\> → 3. cd 到 worktree 开始开发 |

### 4.4 speckit.specify 是否调用 worktree 脚本？

**否**。speckit.specify 仅调用 `create-new-feature.ps1`，**不**调用 setup_worktree.ps1。worktree 需用户在上述时机手动创建。

---

## 五、创建时机汇总（总表）

| 流程 | spec 子目录 | git branch | worktree |
|------|-------------|------------|----------|
| **standalone** | `/speckit.specify` 执行时（create-new-feature.ps1） | 同上，create-new-feature.ps1 内 `git checkout -b` | 手动：`setup_worktree.ps1 create <branch>` 或各功能 `CREATE_WORKTREE.ps1` |
| **BMAD** | Create Story 之后，由 `create-new-feature.ps1 -ModeBmad` 或用户手动 | **遗漏**：Story 级时无明确创建点；Epic 级时在 worktree 内创建 | `using-git-worktrees`：`/bmad-create-worktree`，需 branch 已存在（Story 级） |

---

### 产出路径约定（与 worktree 并列）

| 流程 | 产出路径 |
|------|----------|
| 与 speckit-workflow 相关 | spec 子目录：`specs/{index}-{name}/` 或 `specs/epic-{epic}/story-{story}-{slug}/` |
| 与 BMAD 流程相关 | `_bmad-output/`：planning-artifacts/、implementation-artifacts/ 等 |

### 产出路径约定（_bmad-output 子目录）

| 流程 | 产出路径 |
|------|----------|
| speckit 之前 | planning-artifacts/{branch}/：epics.md、implementation-readiness-report、prd、architecture |
| speckit 之后 | implementation-artifacts/{epic}-{story}-{slug}/：Story、TASKS、prd、progress、DEBATE、BUGFIX |
| 创建时机 | create-new-feature.ps1 -ModeBmad 创建 spec 时，同步创建 _bmad-output/implementation-artifacts/{epic}-{story}-{slug}/ |

### pre-speckit 产出覆盖策略

| 产出 | 路径 | 覆盖策略 |
|------|------|----------|
| epics.md | planning-artifacts/{branch}/epics.md | 同 branch 重复执行覆盖；--archive 时先归档 |
| prd、就绪报告 | planning-artifacts/{branch}/ | 同上 |
| 归档 | planning-artifacts/_archive/{branch}/{date}-{seq}/ | --archive 时 |

---

## 六、当前遗漏与建议

### 6.1 遗漏清单

| 序号 | 遗漏 | 影响 | 建议 |
|------|------|------|------|
| **O-1** | BMAD 模式下 `create-new-feature.ps1` 不创建 git branch | Story 级 worktree 需要 `story-4-1` 分支，但无脚本创建 | 方案 A：`create-new-feature.ps1 -ModeBmad` 增加 `git checkout -b story-{epic}-{story}`；方案 B：在 bmad-story-assistant 或 using-git-worktrees 中明确「创建 spec 目录后、创建 worktree 前」调用分支创建步骤 |
| **O-2** | `setup_worktree.ps1` 的 `$RepoDir` 可能非 repo 根 | 脚本从 `$PSScriptRoot` 向上一级，得到 `.specify/scripts`，非 repo 根，git 命令可能失败 | 已修复（见 T-WT-1） |
| **O-3** | spec 目录、branch、worktree 的创建顺序与脚本未在单一文档中明确 | 用户和 Agent 难以确定正确执行顺序 | 本文档 + 在 speckit-workflow、bmad-story-assistant、using-git-worktrees 中交叉引用 |
| **O-4** | `/speckit.specify` 与 `create-new-feature.ps1` 的调用关系 | speckit.specify 命令描述调用 create-new-feature.ps1，但 BMAD 模式未被 speckit.specify 命令支持 | speckit.specify 命令需支持 `--mode bmad` 参数并传递 `-ModeBmad -Epic -Story -Slug` |

### 6.2 建议的创建顺序（BMAD Story 级）

1. **Create Story** → 产出 Story 文档，确定 epic、story、slug
2. **create-new-feature.ps1 -ModeBmad** → 创建 `specs/epic-4/story-1-{slug}/`、`spec-E4-S1.md`
3. **创建 branch**（待补充）→ `git checkout -b story-4-1`（在主 repo 或临时目录）
4. **/bmad-create-worktree** 或 `setup_worktree.ps1 create story-4-1` → 创建 worktree
5. **speckit specify/plan/tasks** → 在 worktree 内执行

---

## 七、脚本路径速查

| 脚本 | 路径 | 用途 |
|------|------|------|
| create-new-feature.ps1 | `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 创建 spec 子目录；standalone 时同时创建 branch；BMAD 时仅创建 spec 目录 |
| setup_worktree.ps1 | `_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1` | 通用 worktree 创建（需 branch 已存在） |
| CREATE_WORKTREE.ps1 | 各 `specs/{index}-{name}/CREATE_WORKTREE.ps1` | 按功能硬编码的 worktree 创建 |
| using-git-worktrees | `{SKILLS_ROOT}/using-git-worktrees/SKILL.md` | BMAD 流程的 worktree 策略与命令 |

---

*本文档由 spec 目录命名规则 Gap 解决实施后补充，用于澄清创建时机与脚本职责。*
