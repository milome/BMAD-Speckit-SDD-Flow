---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

### Adaptive Worktree策略

本技能支持两种worktree粒度，根据Epic特征自动选择。**worktree 与项目根平级**：`{父目录}/{repo名}-{branch}`，其中 `{repo名}` = 主 repo 目录名（由 `git rev-parse --show-toplevel` 的 basename 获取），`{父目录}` = 主 repo 的父目录。可由 `REPO_NAME` 环境变量覆盖。（由 setup_worktree.ps1 实现）

**Story级worktree**：
- 路径：`{父目录}/{repo名}-story-{epic_num}-{story_num}`
- 适用：Story数≤2的Epic
- 特点：完全隔离，适合强依赖或高风险Story

**Epic级worktree**：
- 路径：`{父目录}/{repo名}-feature-epic-{epic_num}`
- 适用：Story数≥3的Epic
- 特点：共享worktree，Story以分支形式管理
- 优势：减少87%上下文切换时间

**story_count 来源（GAP-005 修复；GAP-072 修复）**：`story_count = epic.story_count or len(epic.stories) or user_input`；若 epic.story_count 与 len(epic.stories) 均存在且不同，记录警告并采用 epic.story_count。默认 0。

**自动检测逻辑**：
```python
def determine_worktree_strategy(epic):
    story_count = epic.story_count or len(epic.stories) or 0
    worktree_base = Path(repo_root).parent  # 项目根父目录

    repo_name = Path(repo_root).name  # 或 os.path.basename(repo_root)
    if story_count <= 2:
        return {
            "type": "story-level",
            "path": str(worktree_base / f"{repo_name}-story-{epic.id}-{story.id}"),
            "branch": f"story-{epic.id}-{story.id}"
        }
    else:
        return {
            "type": "epic-level",
            "path": str(worktree_base / f"{repo_name}-feature-epic-{epic.id}"),
            "branch": f"story-{epic.id}-{story.id}"
        }
```

**手动覆盖**：
用户可通过命令行参数强制指定worktree类型：
```bash
/bmad-create-worktree epic=4 story=1 type=story-level  # 强制Story级
/bmad-create-worktree epic=4 story=1 type=epic-level   # 强制Epic级
```

### Solo 快速迭代模式（不创建 worktree）

**适用**：solo 开发、快速迭代。`create-new-feature.ps1 -ModeBmad` 未指定 `-CreateWorktree` 时，不调用 worktree 创建。

**效果**：Dev Story 在当前目录执行，不创建新 worktree。spec 子目录、_bmad-output 产出路径与 BMAD 约定一致，仅无 worktree 隔离。

**完整隔离**：需 worktree 时，使用 `create-new-feature.ps1 -ModeBmad -Epic N -Story N -Slug xxx -CreateBranch -CreateWorktree`。

## Directory Selection Process

**Preferred creation path:** Use repository-native Speckit/BMAD scripts to create branches and worktrees when they exist. Use raw `git worktree add` only as a fallback.

**worktree 与项目根平级**：路径为 `{父目录}/{repo名}-{branch}`，其中 `{repo名}` = 主 repo 目录名（由 `git rev-parse --show-toplevel` 的 basename 获取），`{父目录}` = 主 repo 的父目录（如 `D:\Dev\`）。可由 `REPO_NAME` 环境变量覆盖。无需在项目内选择目录。

### 1. 优先查找仓库内 Speckit/BMAD 脚本

按顺序查找以下脚本；找到即可优先使用：

```bash
# Preferred worktree script locations
_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1
specs/000-Overview/.specify/scripts/powershell/setup_worktree.ps1

# Preferred branch/spec bootstrap script
_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1
specs/000-Overview/.specify/scripts/powershell/create-new-feature.ps1
```

**If found:**
- 优先用 `create-new-feature.ps1` 负责 branch/spec 初始化（如果该项目流程需要）
- 优先用 `setup_worktree.ps1 create <branch>` 负责 worktree 创建
- 不要先手写 `git worktree add`，除非脚本不存在或无法适配当前仓库
- **重要约束**：脚本优先只是在固化 branch/worktree 创建方式，**不保证** worktree 下构建、测试、Vitest、Pytest、IDE 索引或其他工具行为与主 repo 完全一致；创建完成后仍必须执行 baseline verification

### 2. 获取 worktree 路径

```bash
# 获取 repo 根目录
repo_root=$(git rev-parse --show-toplevel)
# 父目录
worktree_base=$(dirname "$repo_root")
# 动态获取 repo 名
repo_name=$(basename "$repo_root")
# worktree 路径
worktree_path="$worktree_base/$repo_name-$BRANCH_NAME"
```

### 3. Check CLAUDE.md（可选）

```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```

**If preference specified:** 可覆盖默认路径（若项目有特殊约定）。

## Safety Verification

worktree 在项目外（与主 repo 平级），无需 .gitignore 验证。

### Epic级worktree创建流程

当检测到Story数≥3时，执行以下创建流程：

**步骤1：检测Epic特征（GAP-007 修复：Epic 配置 schema）**
```python
# Epic 配置路径：.bmad-config/epic-{epic_id}.json（GAP-023 修复：若项目已有 .bmad-config 则合并而非覆盖）
# Schema: { "epic_id": int, "story_count": int, "stories": [...], "mode": "serial"|"parallel" }
epic_info = load_epic_config(epic_id)  # 从 .bmad-config/epic-{epic_id}.json 读取
story_count = epic_info.story_count or len(epic_info.stories or [])
# GAP-075 修复：branches.json 为分支状态快照；epic 主配置的 stories 数组在分支 merge 后由 Phase 5 流程更新，非实时同步
existing_worktrees = list_worktrees()
```

**步骤2：检查现有worktree**
- 如果已存在Epic级worktree，跳过创建，直接使用
- 如果已存在Story级worktree，提示用户是否迁移

**步骤3：创建Epic级worktree**
```bash
# 使用 setup_worktree.ps1 或 git worktree add（worktree 与项目根平级）
# 路径: {父目录}/{repo名}-feature-epic-{epic_id}
setup_worktree.ps1 create feature-epic-{epic_id}
# 或: repo_name=$(basename "$(git rev-parse --show-toplevel)"); git worktree add -b feature-epic-{epic_id} "$(dirname $(git rev-parse --show-toplevel))/$repo_name-feature-epic-{epic_id}"

# 验证创建成功
cd {父目录}/{repo名}-feature-epic-{epic_id}
git status
```

**步骤3.5：迁移 _bmad 定制（可选）**
- 若 `_bmad-output/bmad-customization-backups/` 存在备份，在新 worktree 中运行：
  ```bash
  python {SKILLS_ROOT}/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{最新备份路径}" --project-root "{新worktree根}"
  ```
  最新备份路径：`_bmad-output/bmad-customization-backups/` 下按时间戳排序取最新目录（如 `YYYY-MM-DD_HH-MM-SS_bmad`）
- 若无备份，跳过；用户可在主 worktree 完成 _bmad 修改后执行 bmad-customization-backup 备份，再手动迁移
- **前置条件**：阶段 1–3 完成后，在主 worktree 执行一次 backup

**步骤4：初始化Epic工作区**
- 安装依赖（如有package.json/requirements.txt）
- 运行初始构建验证环境正常
- 创建Story分支模板

**步骤5：记录元数据**
```json
{
  "epic_id": 4,
  "worktree_type": "epic-level",
  "path": "{父目录}/{repo名}-feature-epic-4",
  "created_at": "2026-03-02T10:00:00Z",
  "stories": [],
  "mode": "serial"
}
```

**创建后检查**：
- [ ] worktree目录存在且非空
- [ ] git状态正常，分支正确
- [ ] 可以正常执行git命令
- [ ] 元数据文件已创建

## Creation Steps

### 1. Detect Project Name

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. Create Worktree

```bash
# Preferred: use repository-native Speckit/BMAD scripts when available
# 1) If create-new-feature.ps1 is the repo's branch/spec bootstrap, use it to create branch/spec state first
# 2) Then use setup_worktree.ps1 create <branch> to create the worktree at the sibling path

# Fallback only when no suitable script exists:
repo_root=$(git rev-parse --show-toplevel)
worktree_base=$(dirname "$repo_root")
repo_name=$(basename "$repo_root")
path="$worktree_base/$repo_name-$BRANCH_NAME"
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

**Priority order:**
1. `create-new-feature.ps1` + `setup_worktree.ps1`
2. `setup_worktree.ps1` directly
3. Raw `git worktree add` fallback

### 3. Run Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 4. Verify Clean Baseline

Run tests to ensure worktree starts clean:

```bash
# Examples - use project-appropriate command
npm test
cargo test
pytest
go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### 5. Report Location

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

### Story分支管理（Epic级worktree内）

在Epic级worktree中，每个Story作为一个分支管理。

**创建Story分支**：
```bash
# 进入Epic worktree（与项目根平级）
cd {父目录}/{repo名}-feature-epic-4

# 确保基于最新的feature-epic-4分支
git checkout feature-epic-4
git pull origin feature-epic-4

# 创建Story分支
git checkout -b story-4-1

# 推送分支到远程（可选）
git push -u origin story-4-1
```

**切换Story分支**：
```bash
# 检查当前状态（必须clean才能切换）
git status

# 如果有未提交变更，先stash或commit
if has_uncommitted_changes():
    print("警告：有未提交变更，请先commit或stash")
    return

# 切换到另一个Story分支
git checkout story-4-2

# 如果需要基于其他Story的最新代码
# 先merge那个Story到feature-epic-4，再rebase
git rebase feature-epic-4
```

**合并Story分支**：
```bash
# Story开发完成，合并到feature-epic-4
git checkout feature-epic-4
git merge --no-ff story-4-1 -m "Merge Story 4.1: description"

# 删除已合并的Story分支（可选）
git branch -d story-4-1
```

**分支命名规范**：
- 格式：`story-{epic_num}-{story_num}`
- 示例：`story-4-1`, `story-4-2`
- 禁止：使用特殊字符或空格

**分支状态跟踪（GAP-024 修复：存储路径 `.bmad-config/epic-{epic_id}-branches.json`）**：
```json
{
  "epic_id": 4,
  "branches": [
    {"name": "story-4-1", "status": "merged", "pr": 123},
    {"name": "story-4-2", "status": "active", "pr": null},
    {"name": "story-4-3", "status": "pending", "pr": null}
  ]
}
```

## 串行/并行模式切换

Epic级worktree支持两种执行模式：串行（默认）和并行。

### 串行模式（默认）

**执行流程**：
```
Story 4.1 → 开发 → commit → PR → merge到feature-epic-4
    ↓
Story 4.2（基于merge后的feature-epic-4）→ 开发 → commit → PR → merge
    ↓
Story 4.3 → ...
```

**特点**：
- 每个Story基于前一个Story合并后的代码
- 自动处理跨Story依赖
- 适合强依赖的Story序列

**启用命令**：
```bash
/bmad-set-worktree-mode epic=4 mode=serial
```

### 并行模式

**执行流程**：
```
Story 4.1 ─┐
           ├─→ 并行开发 → 各自PR → 逐个merge + 冲突解决审计
Story 4.2 ─┘
```

**触发条件**：
1. 文件范围预测显示无重叠（或用户接受风险）
2. 用户显式确认启用并行模式
3. Story间无强依赖关系

**启用命令**：
```bash
/bmad-set-worktree-mode epic=4 mode=parallel
```

**冲突处理**：
当并行Story同时修改同一文件时：
1. 第一个Story正常merge
2. 第二个Story merge时出现冲突
3. 提示用户解决冲突
4. 冲突解决后触发code-review审计
5. 审计通过后才能继续

### 模式切换逻辑

```python
def set_worktree_mode(epic_id, mode):
    epic_config = load_epic_config(epic_id)

    if mode == "parallel":
        # 检查是否可以切换到并行模式
        if has_story_dependencies(epic_id):
            raise Error("存在Story依赖，不能切换到并行模式")

        if has_file_overlap(epic_id):
            warn("检测到文件范围重叠，建议保持串行模式")
            if not user_confirm("确定要切换到并行模式？"):
                return

    epic_config.mode = mode
    save_epic_config(epic_id, epic_config)

    print(f"Epic {epic_id} 已切换到{mode}模式")
```

### 模式查询

```bash
/bmad-get-worktree-mode epic=4
# 输出: serial 或 parallel
```

## 冲突检测和解决审计

### 冲突检测机制

**自动检测时机（GAP-008 修复）**：
1. Story分支merge到feature-epic-4时
2. 切换Story分支前（检查未提交变更）
3. **仅在并行模式下**：定期扫描（**GAP-061 修复**：「每小时」= 自上一次扫描完成起 60 分钟，或并行模式下每次 merge 后触发）；串行模式下无意义，不执行

**检测内容**：
```python
def detect_conflicts(epic_id):
    conflicts = []

    # 获取所有活跃Story分支
    branches = get_active_story_branches(epic_id)

    for i, branch1 in enumerate(branches):
        for branch2 in branches[i+1:]:
            # 检查两个分支是否有文件修改重叠
            overlap = check_file_overlap(branch1, branch2)
            if overlap:
                conflicts.append({
                    "branches": [branch1, branch2],
                    "files": overlap,
                    "severity": calculate_severity(overlap)
                })

    return conflicts
```

**冲突分级**：
| 级别 | 条件 | 处理方式 |
|-----|------|---------|
| 警告 | 文件重叠但修改区域不冲突 | 提示用户，继续执行 |
| 中等 | 文件重叠且可能冲突 | 要求用户确认，建议串行模式 |
| 严重 | 已发生merge冲突 | 必须解决后才能继续 |

### 冲突解决流程

**步骤1：暂停执行**
```
⚠️  检测到冲突！
Epic: 4
冲突分支: story-4-1, story-4-2
冲突文件: src/cache/base.py, src/config/settings.py

已暂停执行，请解决冲突后继续。
```

**步骤2：引导用户解决**
```bash
# 切换到目标分支
git checkout story-4-2

# 尝试merge feature-epic-4（包含story-4-1的变更）
git merge feature-epic-4

# 解决冲突（手动编辑冲突文件）
# 冲突标记格式：
# <<<<<<< HEAD
# Story 4.2的代码
# =======
# Story 4.1的代码（来自feature-epic-4）
# >>>>>>> feature-epic-4

# 标记冲突已解决
git add <冲突文件>
git commit -m "Merge feature-epic-4 into story-4-2, resolve conflicts"
```

**步骤3：触发冲突解决审计**
冲突解决后，必须触发code-review审计：
```markdown
## 冲突解决审计请求

**冲突信息**：
- Epic: 4
- 分支: story-4-1, story-4-2
- 文件: src/cache/base.py, src/config/settings.py

**审计重点**：
1. 冲突解决是否正确保留了双方的功能
2. 是否有代码重复或逻辑错误
3. 测试是否仍然通过
4. 是否引入了新的bug

**审计方式**：
- 优先：Cursor Task调度code-reviewer
- 回退：mcp_task generalPurpose

**通过标准**：A/B级
```

**步骤4：审计通过后继续**
只有冲突解决审计通过后，才能继续执行后续操作。

### 冲突预防建议

1. **Story规划阶段**：尽量将修改不同文件的Story并行执行
2. **定期同步**：频繁将feature-epic-4的变更merge到Story分支
3. **及时沟通**：团队内同步正在修改的文件范围
4. **小步提交**：频繁commit，减少单次变更范围

### 冲突统计和报告

记录每次冲突的信息：
```json
{
  "epic_id": 4,
  "conflicts": [
    {
      "timestamp": "2026-03-02T14:30:00Z",
      "branches": ["story-4-1", "story-4-2"],
      "files": ["src/cache/base.py"],
      "resolution_time_minutes": 15,
      "audit_result": "A级"
    }
  ],
  "total_conflicts": 1,
  "avg_resolution_time": 15
}
```

当冲突频率超过阈值（如每小时>3次），建议切换回串行模式。

## 回滚到Story级机制

当Epic级worktree出现严重问题（如频繁冲突、性能问题），可以回滚到Story级。

### 回滚场景

**场景1：Epic刚开始，第一个Story未完成**
```bash
# 1. 保存当前工作（如有）
git stash

# 2. 删除Epic worktree（路径与项目根平级）
git worktree remove {父目录}/{repo名}-feature-epic-4

# 3. 清理配置
rm .bmad-config/epic-4.json

# 4. 恢复Story级配置
echo '{"worktree_granularity": "story-level"}' > .bmad-config

# 5. 重新执行当前Story（使用Story级worktree）
/bmad-create-worktree epic=4 story=1 type=story-level
```

**场景2：Epic进行中，多个Story已完成**
```bash
# 1. 推送所有Story分支到远程
cd {父目录}/{repo名}-feature-epic-4
for branch in $(git branch --list 'story-4-*'); do
    git checkout $branch
    git push origin $branch
done

# 2. 推送feature-epic-4分支
git checkout feature-epic-4
git push origin feature-epic-4

# 3. 返回主工作区（主 repo 与 worktree 平级）
cd ../{repo名}

# 4. 获取远程分支
git fetch origin

# 5. 切换到Story级模式
echo '{"worktree_granularity": "story-level"}' > .bmad-config

# 6. 继续下一个Story（使用Story级worktree）
/bmad-create-worktree epic=4 story=N type=story-level  # GAP-084 修复：N 为下一个未完成 Story 编号，或由用户输入指定

# 7. 清理Epic worktree（确认所有分支已推送后）
git worktree remove {父目录}/{repo名}-feature-epic-4
```

**场景3：系统自动建议回滚**
当系统检测到以下情况时，主动建议回滚：
- 1小时内冲突次数>5次
- 平均冲突解决时间>30分钟
- 用户连续3次拒绝冲突解决方案

```
⚠️  建议回滚到Story级worktree

检测到Epic 4的worktree使用状况不佳：
- 过去1小时冲突次数: 6次
- 平均解决时间: 35分钟
- 建议切换为Story级以提高隔离性

[1] 立即回滚到Story级（推荐）
[2] 继续Epic级（风险自负）
[3] 暂停，人工评估
```

### 回滚数据迁移

回滚时需要迁移的数据：
1. **代码变更**：已push到远程的分支无需迁移
2. **配置文件**：.bmad-config/epic-*.json需要更新
3. **元数据**：冲突历史、审计记录需要保留
4. **未提交变更**：需要stash或commit后push

### 回滚后验证

回滚完成后，验证以下事项：
- [ ] Story级worktree创建成功
- [ ] 可以正常切换分支
- [ ] 历史提交记录完整
- [ ] 配置文件正确更新

### 回滚限制（GAP-006 修复：与回退区分）

- **回滚**（rollback-worktree）：worktree 级别，按 Epic 计；**回退**（correct-course）为阶段级别，按 Story 计（见任务 2.8）
- 同一 Epic 最多回滚 2 次，超过需要 BMad Master 审批
- 回滚操作不可逆（一旦回到Story级，不能自动回到Epic级）
- 回滚必须记录原因和决策过程

## Quick Reference

| Situation | Action |
|-----------|--------|
| worktree 路径 | `{父目录}/{repo名}-{branch}`，与项目根平级（repo名=目录名，可REPO_NAME覆盖） |
| 创建 worktree | `setup_worktree.ps1 create <branch>` 或 `git worktree add` |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Mistakes

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** worktree 与项目根平级，路径为 `{父目录}/{repo名}-{branch}`

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools
- **Fix:** Auto-detect from project files (package.json, etc.)

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Get repo root: git rev-parse --show-toplevel]
[worktree path: {父目录}/{repo名}-{branch}]
[Create worktree: setup_worktree.ps1 create feature/auth 或 git worktree add]
[Run npm install]
[Run npm test - 47 passing]

Worktree ready at {父目录}/{repo名}-feature-auth
Tests passing (47 tests, 0 failures)
Ready to implement auth feature
```

## Red Flags

**Never:**
- Skip baseline test verification
- Proceed with failing tests without asking
- Assume directory location when ambiguous
- Skip CLAUDE.md check

**Always:**
- Use sibling path: {父目录}/{repo名}-{branch}
- Auto-detect and run project setup
- Verify clean test baseline

## Integration

**Called by:**
- **brainstorming** (Phase 4) - REQUIRED when design is approved and implementation follows
- Any skill needing isolated workspace

**Pairs with:**
- **finishing-a-development-branch** - REQUIRED for cleanup after work complete
- **executing-plans** or **subagent-driven-development** - Work happens in this worktree

### BMAD-Speckit整合场景触发

在BMAD-Speckit整合方案中，本技能在以下场景被触发：

**Layer 3 Create Story阶段**：
- 触发命令：`/bmad-bmm-dev-story epic={num} story={num}`
- 自动检测Epic的Story数量
- Story数≤2：创建Story级worktree
- Story数≥3：创建Epic级worktree（如不存在）或复用已有Epic级worktree

**Story切换时**：
- 触发命令：`/bmad-switch-story epic={num} from={num} to={num}`
- 在Epic级worktree内切换Story分支
- 自动检查未提交变更
- 自动处理跨Story依赖

**模式切换时**：
- 触发命令：`/bmad-set-worktree-mode epic={num} mode={serial/parallel}`
- 修改Epic的执行模式
- 验证切换条件（如并行模式检查文件重叠）

**回滚时**：
- 触发命令：`/bmad-rollback-worktree epic={num} target={story-level}`
- 执行回滚到Story级的操作
- 迁移必要数据
