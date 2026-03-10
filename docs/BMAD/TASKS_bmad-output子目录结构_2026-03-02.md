# TASKS：_bmad-output 子目录结构实施任务列表

**日期**: 2026-03-02  
**来源**: [DEBATE_bmad-output子目录结构_100轮总结_2026-03-02.md](./DEBATE_bmad-output子目录结构_100轮总结_2026-03-02.md)

---

## 任务总览

| 任务 ID | 修改路径 | 优先级 | 状态 |
|---------|----------|--------|------|
| T-BO-1 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | 高 | 待实施 |
| T-BO-2 | `{SKILLS_ROOT}/bmad-bug-assistant/SKILL.md` | 高 | 待实施 |
| T-BO-3 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 高 | 待实施 |
| T-BO-4 | `{SKILLS_ROOT}/speckit-workflow/SKILL.md` | 中 | 待实施 |
| T-BO-5 | `{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md` | 中 | 待实施 |
| T-BO-6 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 中 | 待实施 |
| T-BO-7 | `{project-root}/_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`（新建） | 中 | 待实施 |

---

## 任务详情

### T-BO-1：bmad-story-assistant 产出路径约定

**修改路径**：`{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`

**插入位置**：在「### 产出路径约定」小节（若已存在则替换），或「阶段零」之后新增。

**插入正文**：见 DEBATE 总结 §五 M-1。

**验收**：执行 Create Story 4.1 后，Story 文档写入 `_bmad-output/implementation-artifacts/4-1-{slug}/`。

---

### T-BO-2：bmad-bug-assistant 产出路径约定

**修改路径**：`{SKILLS_ROOT}/bmad-bug-assistant/SKILL.md`

**插入位置**：在「### 产出路径约定」或「根因分析」之后。

**插入正文**：见 DEBATE 总结 §五 M-2。

**验收**：有 story 的 BUGFIX 入 `{epic}-{story}-{slug}/`；无 story 的入 `_orphan/`。

---

### T-BO-3：create-new-feature.ps1 同步创建 _bmad-output 子目录

**修改路径**：`{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

**插入位置**：BMAD 模式中，创建 spec 目录之后、输出 JSON 之前。

**插入逻辑**：

```powershell
# 同步创建 _bmad-output 子目录（与 spec 同名）
$RepoDir = (git rev-parse --show-toplevel 2>$null)
if (-not $RepoDir) { $RepoDir = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path }
$bmadOutputBase = Join-Path $RepoDir "_bmad-output"
$implArtifacts = Join-Path $bmadOutputBase "implementation-artifacts"
$storySubdir = Join-Path $implArtifacts "${epic}-${story}-${slug}"
if (-not (Test-Path $storySubdir)) {
    New-Item -ItemType Directory -Path $storySubdir -Force | Out-Null
    Write-Host "[create-new-feature] Created _bmad-output subdir: $storySubdir"
}
```

**前置**：确保 `$epic`、`$story`、`$slug` 在 BMAD 模式中已定义（从参数或 JSON 解析）。

**验收**：`.\create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-e2e` 后，`_bmad-output/implementation-artifacts/4-1-test-e2e/` 存在。

---

### T-BO-4：speckit-workflow 引用 _bmad-output 子目录

**修改路径**：`{SKILLS_ROOT}/speckit-workflow/SKILL.md`

**插入位置**：在「### 1.0.1 speckit-workflow 产出路径约定」之后，新增「### 1.0.2 BMAD 产出与 _bmad-output 子目录对应」。

**插入正文**：见 DEBATE 总结 §五 M-4。

**验收**：文档中明确 spec 路径与 _bmad-output 子目录的对应关系。

---

### T-BO-5：TASKS_产出路径与worktree约定 更新

**修改路径**：`{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md`

**修改内容**：将 §1.2 产出路径表更新为 DEBATE 总结 §五 M-5 的表格。

**验收**：文档中产出路径与 DEBATE 总结一致。

---

### T-BO-6：spec目录-branch-worktree创建时机与脚本说明 更新

**修改路径**：`{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md`

**新增章节**：在「六、当前遗漏与建议」之前，新增「### 产出路径约定（_bmad-output 子目录）」。

**插入正文**：见 DEBATE 总结 §五 M-6。

**验收**：文档包含 pre-speckit 与 post-speckit 产出路径说明。

---

### T-BO-7：迁移脚本（可选）

**修改路径**：`{project-root}/_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`（新建）

**功能**：
1. 扫描 `_bmad-output/implementation-artifacts/` 下平铺文件
2. 按文件名解析 `{epic}-{story}-{slug}`（如 `4-1-implement-base-cache.md`、`TASKS_4-1-implement-base-cache.md`）
3. 创建 `{epic}-{story}-{slug}/` 子目录，移动文件
4. 无法解析的移动到 `_orphan/`
5. 支持 `--dry-run` 仅输出计划
6. 不移动 `planning-artifacts/` 下文件

**验收**：`python _bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py --dry-run` 输出迁移计划；`--execute` 执行迁移后，原平铺文件已入子目录。

---

## 回归测试

| 测试项 | 命令/操作 | 预期结果 |
|--------|-----------|----------|
| RT-BO-1 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-subdir | `_bmad-output/implementation-artifacts/4-1-test-subdir/` 存在 |
| RT-BO-2 | bmad-story-assistant Create Story 4.1 | Story 文档在 `_bmad-output/implementation-artifacts/4-1-{slug}/` |
| RT-BO-3 | create-epics-and-stories | epics.md 在 `_bmad-output/planning-artifacts/epics.md`（平铺） |
| RT-BO-4 | bmad-bug-assistant（无 story） | BUGFIX 入 `_bmad-output/implementation-artifacts/_orphan/` |
| RT-BO-5 | 迁移脚本 --dry-run | 输出迁移计划，无破坏性操作 |

---

## 实施顺序

1. **Phase 1**：T-BO-1、T-BO-2
2. **Phase 2**：T-BO-3
3. **Phase 3**：T-BO-5、T-BO-6
4. **Phase 4**：T-BO-4
5. **Phase 5**：T-BO-7（可选）
