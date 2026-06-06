<!-- BLOCK_LABEL_POLICY=B -->
---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

### Adaptive Worktree Strategy

This skill supports two worktree granularities, which are automatically selected based on Epic characteristics. **worktree is level with the project root**: `{parent directory}/{repo name}-{branch}`, where `{repo name}` = the main repo directory name (obtained by basename of `git rev-parse --show-toplevel`), `{parent directory}` = the parent directory of the main repo. Can be overridden by the `REPO_NAME` environment variable. (implemented by setup_worktree.ps1)

**Story-level worktree**:
- Path: `{parent directory}/{repo name}-story-{epic_num}-{story_num}`
- Applicable to: Epic with Story count ≤ 2
- Features: Complete isolation, suitable for stories with strong dependencies or high risks

**Epic-level worktree**:
- Path: `{parent directory}/{repo name}-feature-epic-{epic_num}`
- Applicable to: Epic with Story count ≥ 3
- Features: shared worktree, Story managed in the form of branches
- Advantages: Reduce context switching time by 87%

**story_count source (Fixed by GAP-005; Fixed by GAP-072)**: `story_count = epic.story_count or len(epic.stories) or user_input`; if epic.story_count and len(epic.stories) both exist and are different, log a warning and use epic.story_count. Default 0.

**Automatic detection logic**:
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
**Manual Override**:
Users can forcefully specify the worktree type through command line parameters:
```bash
/bmad-create-worktree epic=4 story=1 type=story-level  # 强制Story级
/bmad-create-worktree epic=4 story=1 type=epic-level   # 强制Epic级
```
### Solo fast iteration mode (no worktree created)

**Applicable**: solo development, rapid iteration. `create-new-feature.ps1 -ModeBmad` When `-CreateWorktree` is not specified, worktree creation is not called.

**Effect**: Dev Story is executed in the current directory and no new worktree is created. The spec subdirectory and _bmad-output output path are consistent with the BMAD convention, except that there is no worktree isolation.

**Complete isolation**: When worktree is required, use `create-new-feature.ps1 -ModeBmad -Epic N -Story N -Slug xxx -CreateBranch -CreateWorktree`.

## Directory Selection Process

**Preferred creation path:** Use repository-native Speckit/BMAD scripts to create branches and worktrees when they exist. Use raw `git worktree add` only as a fallback.

**worktree is level with the project root**: the path is `{parent directory}/{repo name}-{branch}`, where `{repo name}` = the main repo directory name (obtained by basename of `git rev-parse --show-toplevel`), `{parent directory}` = the parent directory of the main repo (such as `D:\Dev\`). Can be overridden by the `REPO_NAME` environment variable. No need to select directories within the project.

### 1. Prioritize searching for Speckit/BMAD scripts in the warehouse

Look for the following scripts in order; use them first if you find them:
```bash
# Preferred worktree script locations
_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1
specs/000-Overview/.specify/scripts/powershell/setup_worktree.ps1

# Preferred branch/spec bootstrap script
_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1
specs/000-Overview/.specify/scripts/powershell/create-new-feature.ps1
```
**If found:**
- Prioritize using `create-new-feature.ps1` to be responsible for branch/spec initialization (if required by the project process)
- Prioritize using `setup_worktree.ps1 create <branch>` to be responsible for worktree creation
- Do not write `git worktree add` by hand first, unless the script does not exist or cannot be adapted to the current repository
- **Important constraints**: Script priority is only a solidification of the branch/worktree creation method. **There is no guarantee** that the build, test, Vitest, Pytest, IDE index or other tool behavior under the worktree will be exactly the same as the main repo; baseline verification must still be performed after the creation is completed.

### 2. Get the worktree path
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
### 3. Check CLAUDE.md (optional)
```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```
**If preference specified:** can override the default path (if the project has special conventions).

## Safety Verification

The worktree is outside the project (on par with the main repo) and does not require .gitignore verification.

### Epic-level worktree creation process

When the number of Stories is detected ≥ 3, the following creation process is executed:

**Step 1: Detect Epic features (GAP-007 fixed: Epic configuration schema)**
```python
# Epic 配置路径：.bmad-config/epic-{epic_id}.json（GAP-023 修复：若项目已有 .bmad-config 则合并而非覆盖）
# Schema: { "epic_id": int, "story_count": int, "stories": [...], "mode": "serial"|"parallel" }
epic_info = load_epic_config(epic_id)  # 从 .bmad-config/epic-{epic_id}.json 读取
story_count = epic_info.story_count or len(epic_info.stories or [])
# GAP-075 修复：branches.json 为分支状态快照；epic 主配置的 stories 数组在分支 merge 后由 Phase 5 流程更新，非实时同步
existing_worktrees = list_worktrees()
```
**Step 2: Check existing worktree**
- If an Epic-level worktree already exists, skip creation and use it directly
- If a Story-level worktree already exists, prompt the user whether to migrate

**Step 3: Create an Epic-level worktree**
```bash
# 使用 setup_worktree.ps1 或 git worktree add（worktree 与项目根平级）
# 路径: {父目录}/{repo名}-feature-epic-{epic_id}
setup_worktree.ps1 create feature-epic-{epic_id}
# 或: repo_name=$(basename "$(git rev-parse --show-toplevel)"); git worktree add -b feature-epic-{epic_id} "$(dirname $(git rev-parse --show-toplevel))/$repo_name-feature-epic-{epic_id}"

# 验证创建成功
cd {父目录}/{repo名}-feature-epic-{epic_id}
git status
```
**Step 3.5: Migrate _bmad customization (optional)**
- If there is a backup of `_bmad-output/bmad-customization-backups/`, run in the new worktree:
  ```bash
  python {SKILLS_ROOT}/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{最新备份路径}" --project-root "{新worktree根}"
  ```
The latest backup path: `_bmad-output/bmad-customization-backups/`, sort by timestamp to get the latest directory (such as `YYYY-MM-DD_HH-MM-SS_bmad`)
- If there is no backup, skip it; users can perform bmad-customization-backup backup after completing _bmad modification in the main worktree, and then migrate manually
- **Precondition**: After phases 1–3 are completed, perform a backup on the main worktree

**Step 4: Initialize the Epic workspace**
- Install dependencies (if there is package.json/requirements.txt)
- Run the initial build to verify that the environment is OK
-Create Story branch template

**Step 5: Record metadata**
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
**Check after creation**:
- [ ] The worktree directory exists and is not empty
- [ ] The git status is normal and the branch is correct
- [ ] can execute git commands normally
- [ ] Metadata file created

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
### Story branch management (within Epic-level worktree)

In the Epic-level worktree, each Story is managed as a branch.

**Create Story branch**:
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
**Switch Story branch**:
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
**Merge Story branch**:
```bash
# Story开发完成，合并到feature-epic-4
git checkout feature-epic-4
git merge --no-ff story-4-1 -m "Merge Story 4.1: description"

# 删除已合并的Story分支（可选）
git branch -d story-4-1
```
**Branch naming convention**:
- Format: `story-{epic_num}-{story_num}`
- Example: `story-4-1`, `story-4-2`
- Prohibited: use of special characters or spaces

**Branch status tracking (GAP-024 fix: storage path `.bmad-config/epic-{epic_id}-branches.json`)**:
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
## Serial/parallel mode switching

Epic-level worktrees support two execution modes: serial (default) and parallel.

### Serial mode (default)

**Execution process**:
```
Story 4.1 → 开发 → commit → PR → merge到feature-epic-4
    ↓
Story 4.2（基于merge后的feature-epic-4）→ 开发 → commit → PR → merge
    ↓
Story 4.3 → ...
```
**Features**:
- Each Story is based on the merged code of the previous Story
- Automatically handle cross-story dependencies
- Story sequence suitable for strong dependencies

**Enable command**:
```bash
/bmad-set-worktree-mode epic=4 mode=serial
```
### Parallel mode

**Execution process**:
```
Story 4.1 ─┐
           ├─→ 并行开发 → 各自PR → 逐个merge + 冲突解决审计
Story 4.2 ─┘
```
**Trigger conditions**:
1. File scope prediction shows no overlap (or user accepts risk)
2. User explicitly confirms enabling parallel mode
3. There is no strong dependency between stories

**Enable command**:
```bash
/bmad-set-worktree-mode epic=4 mode=parallel
```
**Conflict handling**:
When parallel stories modify the same file at the same time:
1. The first Story merges normally
2. A conflict occurs during the second Story merge
3. Prompt users to resolve conflicts
4. Trigger code-review audit after conflict resolution
5. You can only continue after passing the audit.

### Mode switching logic
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
### Pattern query
```bash
/bmad-get-worktree-mode epic=4
# 输出: serial 或 parallel
```
## Conflict detection and resolution audit

### Conflict detection mechanism

**Automatic detection timing (GAP-008 fix)**:
1. When the Story branch merges into feature-epic-4
2. Before switching the Story branch (check uncommitted changes)
3. **Only in parallel mode**: Periodic scan (**GAP-061 fix**: "Every hour" = 60 minutes since the last scan was completed, or triggered after each merge in parallel mode); meaningless in serial mode, not executed

**Detection content**:
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
**Conflict Rating**:
| Level | Condition | Processing |
|-----|------|---------|
| Warning | Files overlap but modification areas do not conflict | Prompt user to continue execution |
| Medium | Files overlap and may conflict | User confirmation required, serial mode recommended |
| Serious | A merge conflict has occurred | It must be resolved before continuing |

### Conflict resolution process

**Step 1: Pause execution**
```
⚠️  检测到冲突！
Epic: 4
冲突分支: story-4-1, story-4-2
冲突文件: src/cache/base.py, src/config/settings.py

已暂停执行，请解决冲突后继续。
```
**Step 2: Guide users to solve**
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
**Step 3: Trigger conflict resolution audit**
After the conflict is resolved, the code-review audit must be triggered:
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
**Step 4: Continue after passing the audit**
Only after the conflict resolution audit passes, subsequent operations can be continued.

### Conflict Prevention Recommendations

1. **Story planning phase**: Try to execute stories that modify different files in parallel
2. **Periodic synchronization**: Frequently merge the changes of feature-epic-4 to the Story branch
3. **Timely communication**: Synchronize the scope of files being modified within the team
4. **Small step submission**: frequent commits to reduce the scope of a single change

### Conflict Statistics and Reporting

Log information about each conflict:
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
When the conflict frequency exceeds the threshold (eg >3 times per hour), it is recommended to switch back to serial mode.

## Roll back to Story level mechanism

When serious problems occur in the Epic-level worktree (such as frequent conflicts and performance problems), it can be rolled back to the Story level.

### Rollback scene

**Scenario 1: Epic has just started and the first Story is not completed**
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
**Scenario 2: The Epic is in progress and multiple Stories have been completed**
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
**Scenario 3: The system automatically recommends rollback**
When the system detects the following situations, it proactively recommends rollback:
- Number of conflicts >5 times within 1 hour
- Average conflict resolution time >30 minutes
- User rejects conflict resolution 3 times in a row
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
### Rollback data migration

Data that needs to be migrated during rollback:
1. **Code Change**: Branches that have been pushed to the remote do not need to be migrated
2. **Configuration file**: .bmad-config/epic-*.json needs to be updated
3. **Metadata**: Conflict history and audit records need to be retained
4. **Uncommitted changes**: Need to stash or push after commit

### Verify after rollback

After the rollback is complete, verify the following:
- [ ] Story-level worktree was created successfully
- [ ] can switch branches normally
- [ ] Complete historical submission record
- [ ] Configuration files updated correctly

### Rollback limitation (GAP-006 fix: differentiated from rollback)

- **Rollback** (rollback-worktree): worktree level, calculated by Epic; **Rollback** (correct-course) is stage level, calculated by Story (see task 2.8)
- The same Epic can be rolled back a maximum of 2 times, and more than this requires BMad Master approval
- The rollback operation is irreversible (once you return to the Story level, you cannot automatically return to the Epic level)
- Rollback must document reasons and decision-making process

## Quick Reference

| Situation | Action |
|-----------|--------|
| worktree path | `{parent directory}/{repo name}-{branch}`, level with the project root (repo name = directory name, can be overridden by REPO_NAME) |
| Create worktree | `setup_worktree.ps1 create <branch>` or `git worktree add` |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Mistakes

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** The worktree is level with the project root, and the path is `{parent directory}/{repo name}-{branch}`

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
- Use sibling path: {parent directory}/{repo name}-{branch}
-Auto-detect and run project setup
-Verify clean test baseline

## Integration

**Called by:**
- **brainstorming** (Phase 4) - REQUIRED when design is approved and implementation follows
- Any skill needing isolated workspace

**Pairs with:**
- **finishing-a-development-branch** - REQUIRED for cleanup after work complete
- **executing-plans** or **subagent-driven-development** - Work happens in this worktree

### BMAD-Speckit integrated scene triggering

In the BMAD-Speckit integration solution, this skill is triggered in the following scenarios:

**Layer 3 Create Story stage**:
- Trigger command: `/bmad-bmm-dev-story epic={num} story={num}`
- Automatically detect the number of Epic Stories
- Number of Stories ≤ 2: Create a Story-level worktree
- Number of Stories ≥ 3: Create an Epic-level worktree (if it does not exist) or reuse an existing Epic-level worktree

**When Story is switched**:
- Trigger command: `/bmad-switch-story epic={num} from={num} to={num}`
- Switch Story branches within the Epic-level worktree
- Automatically check for uncommitted changes
- Automatically handle cross-story dependencies

**When switching modes**:
- Trigger command: `/bmad-set-worktree-mode epic={num} mode={serial/parallel}`
- Modify Epic's execution mode
- Verify switching conditions (e.g. parallel mode checks for file overlap)

**When rolling back**:
- Trigger command: `/bmad-rollback-worktree epic={num} target={story-level}`
- Perform rollback to Story level
- Migrate necessary data
