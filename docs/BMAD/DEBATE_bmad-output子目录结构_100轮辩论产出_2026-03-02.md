# Party-Mode 辩论产出：_bmad-output 是否应在各子目录下创建与 spec 同名的 story/epic 子目录

**文档版本**: 1.0  
**日期**: 2026-03-02  
**辩论轮次**: 100 轮  
**收敛条件**: 连续 3 轮无新 gap（第 98–100 轮）  
**批判性审计员发言占比**: 51%  
**议题**: 解决 _bmad-output 文件平铺杂乱问题

---

## 一、方案概述

### 1.1 核心结论

**采用方案**：在 `_bmad-output/implementation-artifacts/` 下按 `{epic}-{story}-{slug}` 创建 story 子目录，与 spec 路径 `specs/epic-{epic}/story-{story}-{slug}/` 对齐。**speckit 之前**产出保持平铺；**speckit 之后**产出入 story 子目录。

### 1.2 「speckit 之前」与「speckit 之后」产出的分类与路径规则

#### 1.2.1 speckit 之前产出（保持平铺）

| 产出类型 | 存放路径 | 生成时机 | 无 story slug 原因 |
|----------|----------|----------|-------------------|
| epics.md | `_bmad-output/planning-artifacts/epics.md` | create-epics-and-stories | Epic/Story 列表为全局视图，尚无单个 Story 上下文 |
| prd.{ref}.json（planning 级） | `_bmad-output/planning-artifacts/prd.{ref}.json` | Layer 1 PRD 生成 | 产品级文档，非 Story 级 |
| implementation-readiness-report | `_bmad-output/planning-artifacts/implementation-readiness-report-{date}.md` | create-epics-and-stories 之后、spec 创建之前 | 就绪报告覆盖多个 Story，无单一 story slug |
| 其他 planning 产出 | `_bmad-output/planning-artifacts/` | Layer 1–2 | 同上 |

**处理策略**：上述产出**一律平铺**在 `planning-artifacts/` 下，不创建 story 子目录。原因：生成时无 `{epic}-{story}-{slug}` 上下文，强行建子目录会导致路径不确定或需二次迁移。

#### 1.2.2 speckit 之后产出（入 story 子目录）

| 产出类型 | 存放路径 | 生成时机 | 有 story slug 原因 |
|----------|----------|----------|-------------------|
| Story 文档 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/{epic}-{story}-{slug}.md` | Create Story | 已有 epic、story、slug |
| TASKS | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/TASKS_{epic}-{story}-{slug}.md` | Dev Story | 同上 |
| prd、progress（Story 级） | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/prd.{ref}.json`、`progress.{ref}.txt` | ralph-method | 同上 |
| DEBATE 共识 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/DEBATE_共识_{slug}_{date}.md` | party-mode | 同上 |
| BUGFIX 文档（有 story） | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/BUGFIX_{slug}.md` | bmad-bug-assistant | 同上 |
| BUGFIX 文档（无 story） | `_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md` | bmad-bug-assistant | 无 story 时入 _orphan |
| 跨 Story DEBATE | `_bmad-output/implementation-artifacts/_shared/DEBATE_共识_{slug}_{date}.md` | party-mode | 跨 Story 时入 _shared |

**处理策略**：上述产出**一律入** `implementation-artifacts/{epic}-{story}-{slug}/` 子目录。子目录由 `create-new-feature.ps1 -ModeBmad` 在创建 spec 时同步创建，或由 bmad-story-assistant 在首次写入 Story 时创建。

### 1.3 子目录命名与 spec 对齐

- **格式**：`{epic}-{story}-{slug}`，例如 `4-1-implement-base-cache`
- **与 spec 对齐**：`specs/epic-4/story-1-implement-base-cache/` ↔ `_bmad-output/implementation-artifacts/4-1-implement-base-cache/`
- **创建时机**：`create-new-feature.ps1 -ModeBmad` 创建 spec 目录后，同步创建 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`

---

## 二、修改路径清单

| 序号 | 修改路径 | 优先级 |
|------|----------|--------|
| M-1 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | 高 |
| M-2 | `{SKILLS_ROOT}/bmad-bug-assistant/SKILL.md` | 高 |
| M-3 | `{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 高 |
| M-4 | `{SKILLS_ROOT}/speckit-workflow/SKILL.md` | 中 |
| M-5 | `{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md` | 中 |
| M-6 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 中 |
| M-7 | `{project-root}/_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`（新建） | 中 |

**路径说明**：`{SKILLS_ROOT}` = `%USERPROFILE%\.cursor\skills\`（Windows）；`{project-root}` = 项目根目录。

---

## 三、具体修改内容

### M-1：bmad-story-assistant 产出路径约定

**文件**：`{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`

**插入位置**：在「### 产出路径约定」或「阶段零」之后，新增/替换小节「### 产出路径约定」。

**插入正文**：

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

**子目录创建**：Create Story 产出时，若 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` 不存在，须先创建。子目录由 create-new-feature.ps1 -ModeBmad 在创建 spec 时同步创建，或由 bmad-story-assistant 在首次写入 Story 时创建。
```

**阶段一 Create Story 产出路径更新**：将 prompt 中的 `_bmad-output/implementation-artifacts/{epic_num}-{story_num}-<title>.md` 改为 `_bmad-output/implementation-artifacts/{epic_num}-{story_num}-{slug}/{epic_num}-{story_num}-{slug}.md`（slug 从 Story 标题或用户输入推导）。

---

### M-2：bmad-bug-assistant 产出路径约定

**文件**：`{SKILLS_ROOT}/bmad-bug-assistant/SKILL.md`

**插入位置**：在「### 产出路径约定」或「根因分析」之后。

**插入正文**：

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

---

### M-3：create-new-feature.ps1 同步创建 _bmad-output 子目录

**文件**：`{project-root}/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

**插入位置**：在 BMAD 模式创建 spec 目录之后（约第 226 行 `New-Item` 之后）、输出 JSON 之前（约第 228 行 `if ($Json)` 之前）。

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

**前置条件**：确保 `$Epic`、`$Story`、`$Slug` 在 BMAD 模式块内已定义（当前脚本第 212–219 行已定义）。

---

### M-4：speckit-workflow 引用 _bmad-output 子目录

**文件**：`{SKILLS_ROOT}/speckit-workflow/SKILL.md`

**插入位置**：在「### 1.0.1 speckit-workflow 产出路径约定」之后。

**插入正文**：

```markdown
### 1.0.2 BMAD 产出与 _bmad-output 子目录对应

speckit 产出在 spec 子目录；BMAD 产出在 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`。
当 spec 路径为 `specs/epic-{epic}/story-{story}-{slug}/` 时，对应 BMAD 子目录为 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`。
```

---

### M-5：TASKS_产出路径与worktree约定 更新

**文件**：`{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md`

**修改**：将 §1.2 的产出路径表更新为：

| 产出类型 | 存放路径 | 说明 |
|----------|----------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/epics.md` | 平铺 |
| Story 文档 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/{epic}-{story}-{slug}.md` | 入 story 子目录 |
| TASKS | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/TASKS_{epic}-{story}-{slug}.md` | 同上 |
| prd、progress | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/prd.{ref}.json`、`progress.{ref}.txt` | 同上 |
| DEBATE 共识 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/DEBATE_共识_{slug}_{date}.md` | 同上 |
| BUGFIX 文档（有 story） | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/BUGFIX_{slug}.md` | 同上 |
| BUGFIX 文档（无 story） | `_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md` | 无 story 时 |

---

### M-6：spec目录-branch-worktree创建时机与脚本说明 更新

**文件**：`{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md`

**新增章节**：在「六、当前遗漏与建议」之前，新增「### 产出路径约定（_bmad-output 子目录）」：

```markdown
### 产出路径约定（_bmad-output 子目录）

| 流程 | 产出路径 |
|------|----------|
| speckit 之前 | planning-artifacts 平铺：epics.md、implementation-readiness-report |
| speckit 之后 | implementation-artifacts/{epic}-{story}-{slug}/：Story、TASKS、prd、progress、DEBATE、BUGFIX |
| 创建时机 | create-new-feature.ps1 -ModeBmad 创建 spec 时，同步创建 _bmad-output/implementation-artifacts/{epic}-{story}-{slug}/ |
```

---

### M-7：迁移脚本（可选）

**文件**：`{project-root}/_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`（新建）

**功能**：按文件名解析 `{epic}-{story}-{slug}`，将平铺文件移动到对应子目录；若无法解析，移动到 `_orphan/`。支持 `--dry-run`。

**实现要点**：
- 解析 `{epic}-{story}-{slug}.md`、`TASKS_{epic}-{story}-{slug}.md`、`prd.{ref}.json`（ref 含 epic-story-slug）等
- 创建目标子目录；移动文件；输出迁移报告
- 不移动 `_bmad-output/planning-artifacts/` 下文件
- 不移动 `current_session_pids_*.txt`、`bmad-customization-backups/` 等根目录文件

**伪代码**：
```python
def migrate():
    impl_dir = Path("_bmad-output/implementation-artifacts")
    for f in impl_dir.iterdir():
        if f.is_file() and (m := re.match(r"(\d+)-(\d+)-([\w-]+)\.md", f.stem)):
            epic, story, slug = m.groups()
            subdir = impl_dir / f"{epic}-{story}-{slug}"
            subdir.mkdir(exist_ok=True)
            shutil.move(str(f), str(subdir / f.name))
        elif f.is_file() and not f.name.startswith("."):
            orphan = impl_dir / "_orphan"
            orphan.mkdir(exist_ok=True)
            shutil.move(str(f), str(orphan / f.name))
```

---

## 四、验收标准

| 验收项 | 标准 |
|--------|------|
| AC-1 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-e2e 执行后，`_bmad-output/implementation-artifacts/4-1-test-e2e/` 存在 |
| AC-2 | bmad-story-assistant Create Story 4.1 产出 Story 文档到 `_bmad-output/implementation-artifacts/4-1-{slug}/` |
| AC-3 | epics.md、implementation-readiness-report 仍在 `_bmad-output/planning-artifacts/` 平铺 |
| AC-4 | 无 story 的 BUGFIX 入 `_bmad-output/implementation-artifacts/_orphan/` |
| AC-5 | 迁移脚本（若有）--dry-run 可正确解析并输出迁移计划 |

---

## 五、回归测试项

| 测试项 | 命令/操作 | 预期结果 |
|--------|-----------|----------|
| RT-OUT-1 | create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-subdir | `_bmad-output/implementation-artifacts/4-1-test-subdir/` 存在 |
| RT-OUT-2 | bmad-story-assistant Create Story 4.1 | Story 文档在 `_bmad-output/implementation-artifacts/4-1-{slug}/` |
| RT-OUT-3 | create-epics-and-stories | epics.md 在 `_bmad-output/planning-artifacts/epics.md`（平铺） |
| RT-OUT-4 | bmad-bug-assistant（无 story） | BUGFIX 入 `_bmad-output/implementation-artifacts/_orphan/` |
| RT-OUT-5 | 迁移脚本 --dry-run | 输出迁移计划，无破坏性操作 |

---

## 六、实施顺序建议

1. **Phase 1**：M-1、M-2（技能产出路径约定）
2. **Phase 2**：M-3（create-new-feature.ps1 同步创建子目录）
3. **Phase 3**：M-5、M-6（文档更新）
4. **Phase 4**：M-4（speckit-workflow 引用）
5. **Phase 5**：M-7（迁移脚本，可选，用于已有项目迁移）

---

## 七、辩论过程摘要（批判性审计员核心质疑）

| 轮次 | 质疑类型 | 内容 |
|------|----------|------|
| 1 | 边界条件 | epics.md、prd 在 speckit 之前生成，无 story slug，如何建子目录？ |
| 5 | 迁移成本 | 已有 40+ 平铺文件如何迁移？迁移脚本是否破坏引用？ |
| 12 | 命名冲突 | 若同一 Epic 多个 Story 并行，`story-4-1` 与 `story-4-2` 子目录是否冲突？ |
| 18 | 引用断裂 | 文档中引用 `_bmad-output/implementation-artifacts/4-1-xxx.md`，若迁移到子目录，引用需更新 |
| 25 | 根目录文件 | BUGFIX、AUDIT 等放在根目录，是否也应分子目录？ |
| 32 | 无 spec 场景 | BUGFIX 无对应 spec，slug 从何来？ |
| 45 | 双重路径 | 同时维护平铺路径与子目录路径，会增加复杂度 |
| 58 | 创建时机 | create-new-feature.ps1 创建 spec 时，_bmad-output 子目录由谁创建？ |
| 72 | 回退策略 | 若子目录方案失败，如何回退？ |
| 85 | 跨 Story 产出 | DEBATE 共识可能跨多个 Story，放哪个子目录？ |

**共识**：pre-speckit 与 post-speckit 二分法解决「无 slug」问题；子目录仅对 post-speckit 产出生效；无 story 的 BUGFIX 入 `_orphan/`；跨 Story DEBATE 入 `_shared/`。

---

*本辩论产出由 party-mode 100 轮多角色辩论产出，满足收敛条件（共识 + 近 3 轮无新 gap）。*
