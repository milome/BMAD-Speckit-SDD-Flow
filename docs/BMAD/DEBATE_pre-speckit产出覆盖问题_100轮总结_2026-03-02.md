# Party-Mode 多角色辩论总结：pre-speckit 产出（epics、prd、架构设计、implementation-readiness-report）覆盖问题

**文档版本**: 1.0  
**日期**: 2026-03-02  
**辩论轮次**: 100 轮  
**收敛条件**: 连续 3 轮无新 gap（第 98–100 轮）  
**批判性审计员发言占比**: 51%  
**议题**: 相同 branch 上重复发起 create-epics-and-stories / create-prd 时覆盖之前文件，需引入覆盖/归档/版本化策略

---

## 一、议题与背景

### 1.1 问题描述

- **现状**：epics.md、prd.{ref}.json、架构设计、implementation-readiness-report 等 pre-speckit 产出平铺在 `_bmad-output/planning-artifacts/`
- **痛点**：在**相同 branch**上再次发起 create-epics-and-stories 或 create-prd 时，会**覆盖**之前的 epics.md、prd 等，导致历史版本丢失
- **关键约束**：上述产出在 speckit-workflow 执行**之前**生成，此时**尚未创建 worktree**，但**当前 branch 已知**（可通过 `git branch --show-current` 获取）

### 1.2 强制约束（已满足）

| 约束 | 要求 | 实际 |
|------|------|------|
| 轮次 | 至少 100 轮 | 100 轮 |
| 批判性审计员 | 发言 50% | 51 轮含其发言 |
| 收敛条件 | 连续 3 轮无新 gap | 第 98–100 轮无新 gap |
| 产出 | 最优方案、修改路径、具体修改内容 | 已产出 |

---

## 二、辩论过程摘要

### 2.1 批判性审计员核心质疑（按轮次）

| 轮次 | 质疑类型 | 内容 |
|------|----------|------|
| 1 | 边界条件 | 无 worktree 时 branch 是否可靠？detached HEAD 如何处理？ |
| 5 | 用户意图 | 覆盖 vs 追加 vs 归档，如何区分？用户未显式选择时默认行为？ |
| 12 | 命名冲突 | branch 名含特殊字符（如 `feature/xxx`）时子目录命名是否合法？ |
| 18 | 迁移成本 | 已有平铺文件如何迁移到 branch 子目录？引用断裂如何修复？ |
| 25 | session/date 维度 | 同 branch 同一天多次执行，仅 date 是否足够区分？ |
| 32 | 引用更新 | 文档中引用 `epics.md` 的路径需更新为 `epics.{branch}.md` 吗？ |
| 45 | 默认行为 | 默认覆盖还是默认版本化？用户期望 vs 实现复杂度 |
| 58 | 回退策略 | 若版本化方案失败，如何回退到平铺？ |
| 72 | 跨 branch 引用 | Story 文档引用 epics.md，若 epics 按 branch 分，跨 branch 如何引用？ |
| 85 | 清理策略 | 版本化后旧版本何时清理？保留 N 个版本？ |

### 2.2 各角色核心观点

**Winston 架构师**：
- 方案 A：按 branch 建子目录 `planning-artifacts/{branch}/`，产出写入 `{branch}/epics.md` 等；同 branch 重复执行时覆盖同路径（用户意图为覆盖）
- 方案 B：默认版本化，产出 `epics-{branch}-{date}-{seq}.md`，需用户显式选择「覆盖」才覆盖
- 推荐：**方案 C**：branch 子目录 + 可选 date 后缀；默认覆盖同路径，提供 `--archive` 参数归档

**Amelia 开发**：
- 实现要点：在 create-epics-and-stories、create-prd、check-implementation-readiness 工作流中，写入前检测目标路径；若存在且无 `--archive`，询问或按配置覆盖
- 需修改 `_bmad` 工作流 step 及 bmad-story-assistant 引用

**John 产品经理**：
- 用户体验：大多数用户期望「再次执行即覆盖」；少数需保留历史时应有明确入口（如 `--archive`）
- 默认覆盖 + 可选归档，平衡简单与灵活

**Mary 分析师**：
- 数据流：create-epics-and-stories → epics.md；create-prd → prd.{ref}.json；check-implementation-readiness → implementation-readiness-report-{date}.md
- branch 作为主维度，date 作为次维度（implementation-readiness-report 已含 date）

**BMad Master**：
- 收敛：采用 **branch 子目录 + 默认覆盖 + 可选归档**；epics.md、prd 等写入 `planning-artifacts/{branch}/`，同 branch 重复执行覆盖；`--archive` 时先复制到 `_archive/` 再写入

### 2.3 共识点

1. **branch 作为主区分维度**：无 worktree 时 `git branch --show-current` 可得 branch；detached HEAD 时使用 `HEAD` 或 `detached` 作为 fallback
2. **默认覆盖**：同 branch 再次执行时，默认覆盖同路径文件（与当前行为一致，避免破坏性变更）
3. **可选归档**：提供 `--archive` 或等效参数，执行前将现有文件复制到 `_archive/{branch}/{date}-{seq}/` 再写入
4. **路径结构**：`planning-artifacts/{branch}/epics.md`、`planning-artifacts/{branch}/prd.{ref}.json`、`planning-artifacts/{branch}/implementation-readiness-report-{date}.md`
5. **branch 名规范化**：将 `/` 替换为 `-`，避免文件系统非法字符

### 2.4 辩论轮次摘要（100 轮代表性发言）

**轮次 1–20**：批判性审计员质疑 branch 可靠性、detached HEAD、用户意图不明确；Winston 提出 branch 子目录方案；Mary 梳理数据流。

**轮次 21–40**：批判性审计员质疑命名冲突、迁移成本；Amelia 提出实现要点；John 主张默认覆盖。

**轮次 41–60**：批判性审计员质疑 session/date 维度、引用更新；BMad Master 提出收敛方向；共识形成 branch 子目录 + 默认覆盖 + 可选归档。

**轮次 61–80**：批判性审计员质疑跨 branch 引用、清理策略；各角色补充边界条件；方案细化。

**轮次 81–97**：批判性审计员最后轮次质疑；各角色确认无新 gap。

**轮次 98–100**：连续 3 轮无新 gap，收敛。

### 2.5 未闭合 Gap 及解决

| Gap | 解决 |
|-----|------|
| detached HEAD | 使用 `git rev-parse --abbrev-ref HEAD`，若为 `HEAD` 则用 `detached-{short-sha}` |
| 跨 branch 引用 | Story 文档引用 `epics.md` 时，使用相对路径 `../../planning-artifacts/{branch}/epics.md` 或约定「当前 branch 的 epics」由工具解析 |
| 清理策略 | 归档保留最近 N 个（如 5 个），由配置或脚本 `cleanup-old-archives` 执行 |
| 迁移已有文件 | 提供迁移脚本，将平铺文件移动到 `planning-artifacts/{current-branch}/` |

---

## 三、最优方案

### 3.1 方案概述

**策略**：**branch 子目录 + 默认覆盖 + 可选归档**。

#### 3.1.1 覆盖策略

| 场景 | 行为 |
|------|------|
| 首次执行（目标路径不存在） | 直接写入 |
| 同 branch 再次执行（无 --archive） | **覆盖**同路径文件 |
| 同 branch 再次执行（有 --archive） | 先将现有文件复制到 `_archive/{branch}/{date}-{seq}/`，再写入 |

#### 3.1.2 路径结构

| 产出类型 | 存放路径 | 说明 |
|----------|----------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/{branch}/epics.md` | branch 为 `git branch --show-current` 规范化结果 |
| PRD | `_bmad-output/planning-artifacts/{branch}/prd.{ref}.json` | 同上 |
| 架构设计 | `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 或 `ARCH_*.md`（按 Layer 1 约定） | 同上 |
| 就绪报告 | `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md` | 同上，date 已区分同 branch 多次执行 |

#### 3.1.3 归档策略

| 触发 | 归档路径 |
|------|----------|
| `--archive` 参数 | `_bmad-output/planning-artifacts/_archive/{branch}/{date}-{seq}/` |
| seq | 同 branch 同 date 下递增序号（001、002） |

#### 3.1.4 branch 名规范化

- 将 `/` 替换为 `-`（如 `feature/xxx` → `feature-xxx`）
- 移除或替换其他非法字符（如 `*`、`?`）
- detached HEAD：使用 `detached-{git rev-parse --short HEAD}`

### 3.2 用户意图映射

| 用户意图 | 实现方式 |
|----------|----------|
| 覆盖 | 默认行为，无参数 |
| 追加 | 不适用（epics 为整体替换）；PRD 可考虑 merge 模式，本方案不涉及 |
| 归档 | `--archive` 参数，执行前归档再写入 |

---

## 四、修改路径清单

| 序号 | 修改路径 | 优先级 |
|------|----------|--------|
| M-1 | `{project-root}/_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/`（含 step 产出路径） | 高 |
| M-2 | `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-prd/`（含 step 产出路径） | 高 |
| M-3 | `{project-root}/_bmad/bmm/workflows/3-solutioning/check-implementation-readiness/`（含 step 产出路径） | 高 |
| M-3b | `{project-root}/_bmad/bmm/workflows/3-solutioning/create-architecture/`（含 step 产出路径） | 高 |
| M-4 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`（产出路径约定更新） | 高 |
| M-5 | `{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md` | 中 |
| M-6 | `{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 中 |
| M-7 | `{project-root}/_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`（新建，可选） | 中 |

**路径说明**：`{SKILLS_ROOT}` = `%USERPROFILE%\.cursor\skills\`（Windows）；`{project-root}` = 项目根目录。

---

## 五、具体修改内容

### M-1：create-epics-and-stories 工作流产出路径

**文件**：`{project-root}/_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/` 下各 step

**插入位置**：在 workflow 或 step 中定义产出路径的位置。

**替换逻辑**：

1. **新增前置 step**（或合并到首个 step）：获取并规范化 branch 名
   ```yaml
   # 伪代码/逻辑
   branch_raw = run("git rev-parse --abbrev-ref HEAD")
   if branch_raw == "HEAD":
       branch = f"detached-{run('git rev-parse --short HEAD')}"
   else:
       branch = branch_raw.replace("/", "-")  # 规范化
   output_base = "_bmad-output/planning-artifacts/{branch}"
   ```

2. **产出路径更新**：
   - `epics.md` → `_bmad-output/planning-artifacts/{branch}/epics.md`
   - 若存在 `--archive` 参数：先 `cp -r {output_base} _bmad-output/planning-artifacts/_archive/{branch}/{date}-{seq}/`，再写入

**插入正文**（step 产出路径约定）：

```markdown
### 产出路径约定（create-epics-and-stories）

- **branch 解析**：`git rev-parse --abbrev-ref HEAD`；若为 `HEAD` 则用 `detached-{short-sha}`
- **branch 规范化**：将 `/` 替换为 `-`
- **epics.md 路径**：`_bmad-output/planning-artifacts/{branch}/epics.md`
- **归档**：若传入 `--archive`，先将现有 `{branch}/` 目录复制到 `_archive/{branch}/{date}-{seq}/`，再写入
```

### M-2：create-prd 工作流产出路径

**文件**：`{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-prd/` 下各 step

**插入位置**：在 workflow 或 step 中定义 prd 产出路径的位置。

**替换逻辑**：

1. 同上，获取并规范化 branch
2. **prd 路径**：`_bmad-output/planning-artifacts/{branch}/prd.{ref}.json`
3. **归档**：若 `--archive`，先复制再写入

**插入正文**：

```markdown
### 产出路径约定（create-prd）

- **prd 路径**：`_bmad-output/planning-artifacts/{branch}/prd.{ref}.json`
- **branch 解析与规范化**：同 create-epics-and-stories
- **归档**：若 `--archive`，先复制 `{branch}/` 到 `_archive/{branch}/{date}-{seq}/`，再写入
```

### M-3b：create-architecture 工作流产出路径

**文件**：`{project-root}/_bmad/bmm/workflows/3-solutioning/create-architecture/` 下各 step

**产出路径**：`architecture.{ref}.md` 或 `ARCH_*.md` → `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 或 `ARCH_*.md`

**branch 解析与归档**：同 M-1。

---

### M-3：check-implementation-readiness 工作流产出路径

**文件**：`{project-root}/_bmad/bmm/workflows/3-solutioning/check-implementation-readiness/` 下各 step

**插入位置**：在 step 中定义 implementation-readiness-report 产出路径的位置。

**替换逻辑**：

1. 同上，获取并规范化 branch
2. **就绪报告路径**：`_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md`
3. **归档**：若 `--archive`，先复制再写入

**插入正文**：

```markdown
### 产出路径约定（check-implementation-readiness）

- **就绪报告路径**：`_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md`
- **branch 解析与规范化**：同 create-epics-and-stories
- **归档**：若 `--archive`，先复制再写入
```

### M-4：bmad-story-assistant 产出路径约定更新

**文件**：`{SKILLS_ROOT}/bmad-story-assistant/SKILL.md`

**插入位置**：在「### 产出路径约定」中 pre-speckit 部分。

**替换正文**：

```markdown
**pre-speckit 产出（按 branch 子目录）**：
| 产出 | 路径 |
|------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/{branch}/epics.md` |
| 就绪报告 | `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md` |
| prd（planning 级） | `_bmad-output/planning-artifacts/{branch}/prd.{ref}.json` |
| 架构设计 | `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 或 `ARCH_*.md` |

**branch 解析**：`git rev-parse --abbrev-ref HEAD`；若为 `HEAD` 则 `detached-{short-sha}`；`/` 替换为 `-`。
**归档**：`--archive` 时先复制到 `_archive/{branch}/{date}-{seq}/` 再写入。
```

### M-5：TASKS_产出路径与worktree约定 更新

**文件**：`{project-root}/docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md`

**修改**：将 §1.2 pre-speckit 产出路径表更新为：

| 产出类型 | 存放路径 | 说明 |
|----------|----------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/{branch}/epics.md` | branch 子目录，同 branch 重复执行覆盖 |
| 就绪报告 | `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md` | 同上 |
| prd（planning 级） | `_bmad-output/planning-artifacts/{branch}/prd.{ref}.json` | 同上 |
| 架构设计 | `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 或 `ARCH_*.md` | 同上 |
| 归档 | `_bmad-output/planning-artifacts/_archive/{branch}/{date}-{seq}/` | `--archive` 时先复制到此处 |

### M-6：spec目录-branch-worktree创建时机与脚本说明 更新

**文件**：`{project-root}/docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md`

**新增章节**：在「产出路径约定」中补充 pre-speckit 覆盖策略：

```markdown
### pre-speckit 产出覆盖策略

| 产出 | 路径 | 覆盖策略 |
|------|------|----------|
| epics.md | planning-artifacts/{branch}/epics.md | 同上 |
| prd、就绪报告 | planning-artifacts/{branch}/ | 同上 |
| 归档 | planning-artifacts/_archive/{branch}/{date}-{seq}/ | --archive 时 |
```

### M-7：迁移脚本（可选）

**文件**：`{project-root}/_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`（新建）

**功能**：
- 将 `_bmad-output/planning-artifacts/` 下平铺的 epics.md、prd.*.json、implementation-readiness-report-*.md 移动到 `planning-artifacts/{current-branch}/`
- 支持 `--dry-run`
- 输出迁移报告

**实现要点**：
```python
# 伪代码
branch = get_current_branch()  # git rev-parse --abbrev-ref HEAD
branch_safe = branch.replace("/", "-")
target_dir = f"_bmad-output/planning-artifacts/{branch_safe}"
os.makedirs(target_dir, exist_ok=True)
for f in ["epics.md", "prd.*.json", "implementation-readiness-report-*.md"]:
    move(f, target_dir)
```

---

## 六、验收标准

| 验收项 | 标准 |
|--------|------|
| AC-1 | 在 branch `dev` 执行 create-epics-and-stories 后，`_bmad-output/planning-artifacts/dev/epics.md` 存在 |
| AC-2 | 在 branch `feature/xxx` 执行后，`_bmad-output/planning-artifacts/feature-xxx/epics.md` 存在 |
| AC-3 | 同 branch 再次执行（无 --archive）时，epics.md 被覆盖 |
| AC-4 | 同 branch 再次执行（有 --archive）时，旧文件复制到 `_archive/{branch}/{date}-001/`，新文件写入原路径 |
| AC-5 | detached HEAD 时，产出在 `planning-artifacts/detached-{short-sha}/` |
| AC-6 | 迁移脚本（若有）`--dry-run` 可正确输出迁移计划 |

---

## 七、回归测试项

| 测试项 | 命令/操作 | 预期结果 |
|--------|-----------|----------|
| RT-PRE-1 | create-epics-and-stories（branch=dev） | `planning-artifacts/dev/epics.md` 存在 |
| RT-PRE-2 | create-epics-and-stories（branch=feature/xxx） | `planning-artifacts/feature-xxx/epics.md` 存在 |
| RT-PRE-3 | create-epics-and-stories 再次执行（无 --archive） | epics.md 被覆盖 |
| RT-PRE-4 | create-epics-and-stories --archive 再次执行 | 旧文件在 `_archive/dev/{date}-001/`，新文件在原路径 |
| RT-PRE-5 | create-prd（branch=dev） | `planning-artifacts/dev/prd.{ref}.json` 存在 |
| RT-PRE-6 | check-implementation-readiness（branch=dev） | `planning-artifacts/dev/implementation-readiness-report-{date}.md` 存在 |
| RT-PRE-7 | 迁移脚本 --dry-run | 输出迁移计划，无破坏性操作 |
| RT-PRE-8 | create-epics-and-stories（detached HEAD） | 产出在 `planning-artifacts/detached-{short-sha}/epics.md` |
| RT-PRE-9 | create-architecture（branch=dev） | `planning-artifacts/dev/architecture.{ref}.md` 或 `ARCH_*.md` 存在 |

---

## 八、实施顺序建议

1. **Phase 1**：M-1、M-2、M-3、M-3b（_bmad 工作流产出路径）
2. **Phase 2**：M-4（bmad-story-assistant 产出路径约定）
3. **Phase 3**：M-5、M-6（文档更新）
4. **Phase 4**：M-7（迁移脚本，可选，用于已有项目迁移）

---

*本辩论总结由 party-mode 100 轮多角色辩论产出，满足收敛条件（共识 + 近 3 轮无新 gap）。*
