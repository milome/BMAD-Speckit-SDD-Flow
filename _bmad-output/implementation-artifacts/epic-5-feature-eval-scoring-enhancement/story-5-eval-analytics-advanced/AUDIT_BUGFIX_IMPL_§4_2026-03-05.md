# 执行阶段审计报告（§4）：BUGFIX_tdd-marker-audit-recurrence §7/§8 任务列表

- **审计日期**：2026-03-05
- **审计类型**：执行阶段审计（§4 实施后审计）
- **审计对象**：BUGFIX_tdd-marker-audit-recurrence.md §7 T1~T5 + §8 T-FS-01~06 全部子任务
- **审计依据**：audit-prompts.md §5；BUGFIX 文档各任务验收标准；实际文件与代码；progress 文件 TDD 标记
- **审计人员（多角色）**：批判审计员（发言占比 >70%）/ Winston 架构师 / Amelia 开发

---

## 一、审计方法说明

本审计采用多角色辩论模式，以下各轮次展示角色视角。

---

## 二、多角色辩论记录（精简版，至收敛）

### 第 1~10 轮：§7 T1~T5 基础审查

**批判审计员**（第 1~3 轮）：T1 首次审计文件头，进度日志中写到"完成"，但我必须直接读取文件核实。不能相信 progress 的自我报告。

**Amelia**：实际读取 `AUDIT_§5_Story5.5_2026-03-05.md` 第 1 行。

**验证结果（T1）**：
```
第1行：⚠️ 本报告为首次审计（已作废）。最终有效结论见：
第2行：AUDIT_§5_Story5.5_round3_verification_2026-03-05.md（结论：通过）
```
✅ **T1 通过**：文件头第 1-2 行含"⚠️ 本报告为首次审计（已作废）"。

**批判审计员**（第 4~5 轮）：T2 speckit-workflow SKILL 的 REFACTOR 改为"判断"而非"动作"，需逐行核实是否改了正确位置。

**验证结果（T2）**：
```
行324：重构…无论是否有具体重构动作，均须在 progress 中记录 `[TDD-REFACTOR]` 一行…
       无具体重构时写"无需重构 ✓"，集成任务写"无新增生产代码，各模块独立性已验证，无跨模块重构 ✓"
行350：[TDD-REFACTOR] TX [重构操作描述 | 无需重构 ✓ | 集成任务: 无新增生产代码，各模块独立性已验证 ✓]
行361：[TDD-REFACTOR] - 标记重构阶段（必须记录判断结果，无论是否有具体重构动作；禁止省略此行）
```
✅ **T2 通过**：三处修改均已到位，含"判断"而非"动作"定义、"无需重构"合法描述。

**批判审计员**（第 6~7 轮）：T3 bmad-story-assistant 在任务列表前是否有 TDD progress 验收自检段？不能仅看行号，要看内容。

**验证结果（T3）**：
```
行830：**TDD progress 验收自检（每个 US 完成后立即验证）**：
行831：- [ ] progress.{stem}.txt 中对应 US 有 [TDD-RED] 一行（集成任务可写"首次全量运行 N failed"）
行832：- [ ] progress.{stem}.txt 中对应 US 有 [TDD-GREEN] 一行
行833：- [ ] progress.{stem}.txt 中对应 US 有 [TDD-REFACTOR] 一行（无需重构须显式写"无需重构 ✓"，禁止省略）
```
✅ **T3 通过**：TDD progress 验收自检段落存在，位于实施 prompt 中，三条 checkbox 完整。

**批判审计员**（第 8 轮）：T4 在 bmad-story-assistant 末尾补充 [TDD-REFACTOR] 禁止省略说明，需核实行 833 是否确实含禁止省略措辞。

**验证结果（T4）**：行 833："无需重构须显式写"无需重构 ✓"，**禁止省略**"。
✅ **T4 通过**：文件末尾含 [TDD-REFACTOR] 禁止省略说明。

**批判审计员**（第 9~10 轮）：T5 audit-prompts.md 第 44 行，"每个涉及生产代码的 US"措辞是否准确落实？这是强化粒度的关键。

**验证结果（T5）**：
```
行44：…每个涉及生产代码的 US 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各一行
      （集成任务 REFACTOR 可用'无需重构'表述）…
```
✅ **T5 通过**：措辞已从"全文件至少各一行"升级为"每个 US 各一行"。

---

### 第 11~25 轮：§8 T-FS-01~06 目录迁移审查

**批判审计员**（第 11 轮）：旧扁平目录是否真正不存在？需要枚举 16 个旧路径，不能仅看新路径是否存在。

**验证结果（T-FS 旧路径）**：逐一检查 16 个旧目录：
```
OK (removed): 1-1-eval-system-scoring-core
OK (removed): 1-2-eval-system-storage-writer
OK (removed): 2-1-eval-rules-yaml-config
OK (removed): 2-2-eval-authority-doc
OK (removed): 3-1-eval-lifecycle-skill-def
OK (removed): 3-2-eval-layer1-3-parser
OK (removed): 3-3-eval-skill-scoring-write
OK (removed): 4-1-eval-veto-iteration-rules
OK (removed): 4-2-eval-ai-coach
OK (removed): 4-3-eval-scenario-bmad-integration
OK (removed): 5-1-eval-foundation-modules
OK (removed): 5-2-eval-scoring-rules-expansion
OK (removed): 5-3-eval-parser-llm-fallback
OK (removed): 5-4-eval-analytics-clustering
OK (removed): 5-5-eval-analytics-advanced
OK (removed): parseAndWriteScore-embedding-and-skill-migration
```
✅ 旧扁平目录均已移除。

**验证结果（T-FS 新路径）**：implementation-artifacts/ 下目录列表：
```
epic-1-feature-eval-scoring-core
epic-2-feature-eval-rules-authority
epic-3-feature-eval-lifecycle-skill
epic-4-feature-eval-coach-veto-integration
epic-5-feature-eval-scoring-enhancement
_orphan
```
✅ 新层级目录结构正确，`_orphan/` 存在。

**批判审计员**（第 12 轮）：`git log --oneline -- .../BUGFIX_tdd-marker-audit-recurrence.md` 验证 git mv 保留历史。

**验证结果（git 历史）**：
```bash
git log --oneline --follow -- "_bmad-output/.../BUGFIX_tdd-marker-audit-recurrence.md"
# 输出：（空）
```
⚠️ **发现 GAP-1（T-FS-01~06 git 历史）**：

- `git log` 返回空。根本原因：BUGFIX 文件从未在旧路径被 git 跟踪（原始为 untracked 新建文件），因此 `A`（新增）而非 `R`（重命名）是正常状态——该文件本身无历史可保留。
- **但更关键的问题**：所有 T-FS git mv 变更**仅 staged，未提交**。最新 commit 为 `4b26051 feat: 完成 Story 5.2 与 5.3 评分增强`，T-FS 后无新 commit。
- `git status --short` 确认其他已跟踪文件（如 `5-5-eval-analytics-advanced/5-5-eval-analytics-advanced.md → epic-5-feature-eval-scoring-enhancement/story-5-eval-analytics-advanced/5-5-eval-analytics-advanced.md`）确实显示为 `R`（git mv 保留历史意图正确），但该 rename 未提交，`git log` 无法追踪。

**判定**：T-FS 目录结构已正确，git mv 使用正确（staged 状态 `R` 验证），但 **git log 历史验证因缺少 commit 而无法通过**。此为中等严重性 GAP：若永不 commit，历史保留意义丧失。

**批判审计员**（第 13 轮）：进度声明 T-FS-01~06 均 PASSED，但 PASSED 的标准是什么？progress 中说"git status 确认 renamed"，这是 staged 状态验证，不是已提交状态。

**Winston（架构师）**：从工程规范来看，git mv + 未 commit 处于"临时安全"状态——只要最终 commit 前不 add 其他无关变更，历史会在 commit 时完整记录。但从审计标准来看，"可以查到历史"的验收标准需要 commit 后才能满足。进度文件将此标记为 PASSED 属于过早宣告通过。

---

### 第 26~45 轮：T-SCRIPT-01、T-CMD-01、T-CONFIG-01、T-RULE-01 审查

**批判审计员**（第 26~27 轮）：T-SCRIPT-01 需逐行检查 `$epicDirName` 变量名是否实际来自函数返回（含 slug），而非静态数字。

**验证结果（T-SCRIPT-01）**：
```
行299：function Get-EpicDirName { ... }
行305：$exact = "epic-$EpicNum"
行306：$withSlug = if ($DerivedSlug) { "epic-$EpicNum-$DerivedSlug" } else { $null }
行360：$epicDirName = Get-EpicDirName -SpecsDir $specsDir -EpicNum $Epic -DerivedSlug $epicSlug
行362：$storyDirName = "story-$Story-$Slug"
行373：$epicArtifactsDir = Join-Path $implArtifacts $epicDirName   # 复用 $epicDirName（含 slug）
行374：$storySubdir = Join-Path $epicArtifactsDir $storyDirName
```
✅ **T-SCRIPT-01 通过**：使用 `epic-{N}-{slug}/story-{N}-{slug}/` 格式，`$epicDirName` 来自函数推导。

**批判审计员**（第 28~29 轮）：T-CMD-01 两个副本均需验证，新路径存在且旧路径消失。

**验证结果（T-CMD-01）**：
- `commands/speckit.implement.md` 行59/62：含 `epic-{epic}-{epic-slug}/story-{story}-{slug}/` ✅
- `.cursor/commands/speckit.implement.md` 行59/62：含 `epic-{epic}-{epic-slug}/story-{story}-{slug}/` ✅
- 两文件旧格式 `{epic}-{story}-{slug}` 搜索：无结果 ✅
✅ **T-CMD-01 通过**。

**批判审计员**（第 30 轮）：T-CONFIG-01 是阻断级，必须逐字核实。

**验证结果（T-CONFIG-01）**：
```yaml
# config/eval-lifecycle-report-paths.yaml 第17行
report_path: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_Story_{epic}-{story}.md
```
旧格式搜索无结果。✅ **T-CONFIG-01 通过（阻断级）**。

**批判审计员**（第 31~32 轮）：T-RULE-01 两个副本：`.cursor/rules/` 和 `rules/`。

**验证结果（T-RULE-01）**：
- `.cursor/rules/bmad-bug-auto-party-mode.mdc` 行36：含 `epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md` ✅
- `rules/bmad-bug-auto-party-mode.mdc` 行36：含同样新格式 ✅
- 两文件旧格式搜索：无结果 ✅
✅ **T-RULE-01 通过**。

---

### 第 46~60 轮：T-SKILL-01~04 和 T-SKILL-LOCAL-01 审查

**批判审计员**（第 46 轮）：T-SKILL-01 检查目标是"旧路径模式 `{epic}-{story}-{slug}/`（含尾部斜杠，作为目录使用）"。注意 `{epic}-{story}-{slug}.md`（作为文件名）可能是合法残留——需分清"目录路径"与"文件名"。

**验证结果（T-SKILL-01 全局 bmad-story-assistant）**：
```powershell
Select-String -Pattern "\{epic\}-\{story\}-\{slug\}/" # 作为目录：无结果 ✅
Select-String -Pattern "\{epic\}-\{story\}-\{slug\}"  # 作为文件名：行262、263 有残留
```
行262：`epic-{epic}-{epic-slug}/story-{story}-{slug}/{epic}-{story}-{slug}.md`
行263：`epic-{epic}-{epic-slug}/story-{story}-{slug}/TASKS_{epic}-{story}-{slug}.md`

**批判审计员**：行262/263 中 `{epic}-{story}-{slug}` 出现在新层级路径内作为**文件名**（story document 和 TASKS document 的命名规范），非目录路径。这是文件命名约定的合理保留，不属于"目录格式旧残留"。新目录路径已正确。
✅ **T-SKILL-01 通过**（文件名中的旧模式是合法保留，非目录路径残留）。

**批判审计员**（第 47 轮）：T-SKILL-02 全局 bmad-bug-assistant，搜索旧路径。

**验证结果**：`{epic}-{story}-{slug}` 搜索：无结果 ✅
✅ **T-SKILL-02 通过**。

**批判审计员**（第 48 轮）：T-SKILL-03 全局 speckit-workflow，搜索旧路径。

**验证结果**：`{epic}-{story}-{slug}` 搜索：无结果 ✅
✅ **T-SKILL-03 通过**。

**批判审计员**（第 49 轮）：T-SKILL-04 全局 bmad-code-reviewer-lifecycle，`3-1-eval-lifecycle-skill-def` 硬编码路径。

**验证结果**：`3-1-eval-lifecycle-skill-def` 搜索：无结果 ✅
✅ **T-SKILL-04 通过**。

**批判审计员**（第 50~52 轮）：T-SKILL-LOCAL-01 本地四个文件。

**验证结果**：
```
skills\bmad-story-assistant\SKILL.md - {epic}-{story}-{slug}/ 搜索：无结果 ✅
skills\speckit-workflow\SKILL.md - {epic}-{story}-{slug} 搜索：无结果 ✅
skills\bmad-bug-assistant\SKILL.md - {epic}-{story}-{slug} 搜索：无结果 ✅
skills\bmad-code-reviewer-lifecycle\SKILL.md - 3-1-eval-lifecycle-skill-def 搜索：无结果 ✅
```
✅ **T-SKILL-LOCAL-01 通过**（全部 4 个本地 SKILL 副本无旧路径残留）。

---

### 第 61~80 轮：T-MIGRATE-01 Python 脚本审查

**批判审计员**（第 61 轮）：T-MIGRATE-01 要求 `import subprocess` 移至文件顶部。需查第几行，是否在 `from __future__` 之后但在任何函数定义之前。

**验证结果（subprocess import 位置）**：
```python
# 文件结构（前22行）
#!/usr/bin/env python3
"""..."""
from __future__ import annotations
import argparse
import re
import subprocess     # 第21行
import sys
from pathlib import Path
```
✅ `import subprocess` 在文件顶部（第21行），与 `import re` 相邻，非函数级 import。

**批判审计员**（第 62 轮）：新函数 `get_epic_slug_from_epics_md` 是否存在？目标路径构建是否使用新层级格式？

**验证结果**：
```python
行29：def get_epic_slug_from_epics_md(epic_num: str, project_root: Path) -> str | None:
行163：epic_slug2 = get_epic_slug_from_epics_md(epic_num2, project_root)
行164：epic_dir2 = f"epic-{epic_num2}-{epic_slug2}" if epic_slug2 else f"epic-{epic_num2}"
行165：target_dir = impl_artifacts / epic_dir2 / f"story-{story_num2}-{slug2}"
行183：epic_slug = get_epic_slug_from_epics_md(epic_num, project_root)
行184：epic_dir = f"epic-{epic_num}-{epic_slug}" if epic_slug else f"epic-{epic_num}"
行186：target_dir = impl_artifacts / epic_dir / story_dir
```
✅ 新函数存在，目标路径构建使用 `epic-{N}-{slug}/story-{N}-{slug}/` 格式。

**批判审计员**（第 63~65 轮）：运行 `--dry-run` 验收命令，检查输出是否显示新层级格式路径。

**验证结果（dry-run 输出）**：
```
[migrate] 迁移计划 （dry-run，不实际移动）
-> _orphan/
    .gitkeep
    epic-3-retro-2026-03-04.md
    epic-4-retro-2026-03-05.md
    sprint-status.yaml
[migrate] dry-run 完成，共 4 个文件待迁移。
```

**批判审计员**（第 66~68 轮，提出 GAP-2）：

⚠️ **发现 GAP-2（T-MIGRATE-01 干运行验收失败）**：

验收标准要求 dry-run 输出"路径形如 `epic-{N}-{slug}/story-{N}-{slug}/`"，但实际输出只显示 `_orphan/`，**未出现任何 `epic-{N}-{slug}/story-{N}-{slug}/` 格式**。

根本原因：T-FS-01~06 已将所有平铺 epic-story 目录迁移完毕，implementation-artifacts 根目录下已无符合 `{N}-{N}-{slug}` 文件名模式的文件，脚本找不到可以演示新格式的迁移对象。

⚠️ **发现 GAP-3（T-MIGRATE-01 sprint-status.yaml 处理错误）**：

dry-run 显示 `sprint-status.yaml` 和 retro 文件（`epic-3-retro-2026-03-04.md`、`epic-4-retro-2026-03-05.md`）将被移至 `_orphan/`。但：
- BUGFIX §8 迁移映射表明确注明："`sprint-status.yaml`、`.gitkeep`（根层文件）保留根层，不移动"
- `docs/INSTALLATION_AND_MIGRATION_GUIDE.md` 第486行："sprint-status.yaml 保持原位"
- `should_skip_file()` 函数缺少对 `sprint-status.yaml`、`.gitkeep`、`epic-*-retro-*.md` 的跳过逻辑

**Winston（架构师）**：`should_skip_file` 函数目前仅排除 `current_session_pids_*.txt` 和 `bmad-customization-backups/` 目录，未包含根层保留文件。这会导致实际执行时将应保留的文件移入 `_orphan/`，破坏目录结构约定。

**Amelia（开发）**：这是明确的实现 GAP，需要在 `should_skip_file` 中添加：
```python
if name in ("sprint-status.yaml", ".gitkeep"):
    return True
if re.match(r"^epic-\d+-retro-.*\.md$", name):
    return True
```

---

### 第 81~90 轮：T-DOCS-01/02、T-SPEC-01/02 审查

**批判审计员**（第 81 轮）：T-DOCS-02 scoring/parsers/README.md 旧格式搜索。

**验证结果（T-DOCS-02）**：`{epic}-{story}-{slug}` 搜索：无结果 ✅
✅ **T-DOCS-02 通过**。

**批判审计员**（第 82~83 轮）：T-DOCS-01 INSTALLATION guide 按验收命令逐字执行。

**验证结果（T-DOCS-01）**：
```
# 旧格式搜索结果（验收要求"应无结果"）：
行486：文件名匹配 `{epic}-{story}-{slug}` 模式 → 移入对应子目录
行897：脚本会自动识别文件名中的 `{epic}-{story}-{slug}` 模式，并将文件迁移到两级层级结构

# 新格式搜索结果（验收要求"应有结果"）：
行644：implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/
```

**批判审计员**（第 84~85 轮）：⚠️ **发现 GAP-4（T-DOCS-01 验收命令未完全通过）**：

验收标准：`Select-String -Pattern "\{epic\}-\{story\}-\{slug\}"` 应无结果，但行 486 和 897 仍有匹配。

区分说明：这两处均为描述性文字（说明脚本识别的 INPUT 文件名规律），而非"产出路径约定"。从工程语义上属于合理的历史格式说明文字。

**但从严格验收角度**：BUGFIX 明确要求"旧模式应无结果"，当前有 2 处残留。**不满足零结果验收标准**，判定为部分未通过。

修改建议：将行 486 改为描述新格式："文件名匹配 `{N}-{N}-{slug}` 模式（旧格式）→ 移入对应两级层级目录 `epic-{N}-{slug}/story-{N}-{slug}/`"；行 897 中 `` `{epic}-{story}-{slug}` `` 改为 `` `{N}-{N}-{slug}` ``（旧格式标注）。

**批判审计员**（第 86~87 轮）：T-SPEC-01 specs/epic-3/ 检查。

**验证结果（T-SPEC-01）**：
```powershell
Get-ChildItem -Path "specs\epic-3" -Recurse -Filter "*.md" | Select-String -Pattern "_bmad-output/implementation-artifacts/[0-9]"
# 无结果 ✅
```
✅ **T-SPEC-01 通过**。

**批判审计员**（第 88~90 轮）：T-SPEC-02 specs/epic-4/ 和 epic-5/ 检查。

**验证结果（T-SPEC-02）**：
```powershell
Get-ChildItem -Path "specs\epic-4","specs\epic-5" -Recurse -Filter "*.md" | Select-String -Pattern "_bmad-output/implementation-artifacts/[0-9]"
# 共 15 处匹配
```

**具体文件**：

**epic-4 中的残留（9 处）**：
- `AUDIT_REPORT_IMPLEMENTATION_GAPS-E4-S3.md`
- `AUDIT_REPORT_plan-E4-S2.md`
- `AUDIT_REPORT_plan-E4-S3.md`
- `AUDIT_REPORT_post-audit-E4-S2_2026-03-05.md`（3 处）
- `AUDIT_REPORT_spec-E4-S1_vs_Story.md`
- `AUDIT_REPORT_spec-E4-S2.md`
- `AUDIT_REPORT_spec-E4-S3.md`
- `AUDIT_REPORT_tasks-E4-S3.md`
- `spec-E4-S1.md`（行132，在 T-SPEC-02 明确列出的 5 个活跃文件范围内）

**epic-5 中的残留（5 处）**：
- `spec-E5-S2.md`（行15，在 T-SPEC-02 5 文件范围内）
- `spec-E5-S3.md`（在范围内）
- `spec-E5-S4.md`（在范围内）
- `spec-E5-S5.md`（在范围内）

⚠️ **发现 GAP-5（T-SPEC-02 严重未通过）**：

验收标准：`应无结果`。实际 15 处命中，包括：
1. T-SPEC-02 明确列出的 5 个活跃 spec 文件中，**spec-E4-S1.md、spec-E5-S2/S3/S4/S5 均有残留**（共 5 个文件未更新）。
2. AUDIT_REPORT 文件 9 个虽可能视为"历史记录类"不在 T-SPEC-02"活跃 spec 文件"范围内，但验收命令检查所有 .md 文件，明确要求零结果。

**批判审计员判定**：T-SPEC-02 **未通过**，任务声明 PASSED 属于虚假报告。

---

### 第 91~97 轮：ralph-method 与 TDD 红绿灯验证

**批判审计员**（第 91~92 轮）：prd.json 是否存在？所有 story passes=true？

**验证结果（ralph-method prd）**：
- `prd.BUGFIX_tdd-marker-audit-recurrence.json` 存在 ✅
- 全部 25 个任务 passes=true ✅（包括 T-SPEC-02: passes=true，但实际未通过——prd 与实际不符）

**批判审计员**：prd.json 中 T-SPEC-02 标记为 passes=true，但实际验证显示 5 个 spec 文件未更新。这是 ralph-method 合规性的额外 GAP——prd 数据与实际执行结果不一致。

**批判审计员**（第 93~94 轮）：progress 文件 TDD 标记验证。

**验证结果（TDD 红绿灯标记）**：

Progress 文件中找到：
```
[TDD-RED] T-SCRIPT-01 create-new-feature.ps1 ... => 旧格式目录...
[TDD-GREEN] T-SCRIPT-01 create-new-feature.ps1 ... => 新格式目录...
[TDD-REFACTOR] T-SCRIPT-01 ...
[TDD-RED] T-MIGRATE-01 python migrate_bmad_output_to_subdirs.py --dry-run => ...
[TDD-GREEN] T-MIGRATE-01 python migrate_bmad_output_to_subdirs.py --dry-run => ...
[TDD-REFACTOR] T-MIGRATE-01 ...
```

T1~T5 各有 [TDD-REFACTOR]（非生产代码任务，仅 REFACTOR 是合法的）。
✅ **TDD 红绿灯格式通过**：T-SCRIPT-01 和 T-MIGRATE-01 均有三段标记，格式符合 `[TDD-RED/GREEN/REFACTOR] <任务ID> <描述>`。

**批判审计员**（第 95 轮）：T-MIGRATE-01 的 [TDD-RED] 描述是否真实反映了"修改前输出旧格式"？

**验证**：Progress 第一个 T-MIGRATE-01 [TDD-RED]：`python migrate_bmad_output_to_subdirs.py --dry-run => 脚本在此会话开始时已按路径逻辑...`。描述略含糊，但有实质内容。✅ 可接受。

---

### 第 98~100 轮：最终收敛检查

**批判审计员**（第 98 轮）：本轮新 GAP 汇总：
- GAP-1：T-FS git mv 未提交，git log 无法验证历史保留
- GAP-2：T-MIGRATE-01 dry-run 无法显示 epic-{N}-{slug}/story-{N}-{slug}/ 格式
- GAP-3：T-MIGRATE-01 should_skip_file() 缺少 sprint-status.yaml 等保留逻辑
- GAP-4：T-DOCS-01 行 486/897 仍有旧格式描述性残留
- GAP-5：T-SPEC-02 5 个活跃 spec 文件未更新（明确在任务范围内），共 15 处旧路径残留

**批判审计员**（第 99 轮）：是否有新 GAP？重审 T-SKILL-01 行 262/263 的文件名残留——审计判定为合法残留（文件名约定），非目录路径残留。无新 GAP。

**批判审计员**（第 100 轮）：最终确认无新 GAP。GAP-1~5 已稳定，最后 3 轮（98/99/100）无新 GAP，满足收敛条件。

---

## 三、逐项验证总结

| # | 验收项 | 状态 | 详情 |
|---|--------|------|------|
| ① §7 T1 | ✅ 通过 | 文件头第1-2行含"⚠️ 本报告为首次审计（已作废）" |
| ① §7 T2 | ✅ 通过 | speckit-workflow SKILL 3处修改到位，含"判断"定义、"无需重构"合法描述 |
| ① §7 T3 | ✅ 通过 | bmad-story-assistant SKILL 行830添加 TDD progress 验收自检段落 |
| ① §7 T4 | ✅ 通过 | 行833含 [TDD-REFACTOR] 禁止省略说明 |
| ① §7 T5 | ✅ 通过 | audit-prompts.md 行44更新为"每个涉及生产代码的 US"粒度 |
| ② T-FS-01~06 目录结构 | ⚠️ 部分通过 | 旧目录全部移除 ✅，新层级结构正确 ✅，_orphan 存在 ✅；但**git mv 未提交**，git log 历史验证失败 ⚠️ |
| ③ T-SCRIPT-01 | ✅ 通过 | create-new-feature.ps1 使用 epicDirName（含 slug）+ story-{N}-{slug} 格式 |
| ④ T-CMD-01 | ✅ 通过 | 两个 speckit.implement.md 副本均更新，旧格式无残留 |
| ⑤ T-CONFIG-01 | ✅ 通过（阻断级） | eval-lifecycle-report-paths.yaml 行17已更新，旧格式无残留 |
| ⑥ T-RULE-01 | ✅ 通过 | 两个 bmad-bug-auto-party-mode.mdc 副本均更新 |
| ⑦ T-SKILL-01~04 | ✅ 通过 | 全局 4 个 SKILL 文件旧目录路径无残留（行262/263 的文件名残留为合法保留） |
| ⑧ T-SKILL-LOCAL-01 | ✅ 通过 | 本地 4 个 SKILL 副本旧路径无残留 |
| ⑨ T-MIGRATE-01 | ⚠️ 部分通过 | import subprocess 在顶部 ✅，新函数存在 ✅，路径格式正确 ✅；dry-run 无法演示新格式 ⚠️，should_skip_file 缺少保留逻辑导致 sprint-status.yaml 被误移 ⚠️ |
| ⑩ T-DOCS-01 | ⚠️ 部分通过 | 行644已更新为新格式 ✅；行486、897 仍含旧格式描述性文字（2处），不满足"应无结果"验收标准 ⚠️ |
| ⑩ T-DOCS-02 | ✅ 通过 | scoring/parsers/README.md 无旧路径残留 |
| ⑪ T-SPEC-01 | ✅ 通过 | specs/epic-3/ 下所有 .md 文件无旧数字格式路径 |
| ⑪ T-SPEC-02 | ❌ **未通过** | spec-E4-S1.md（行132）、spec-E5-S2/S3/S4/S5（各1处）共5个明确在任务范围内的活跃 spec 文件未更新；epic-4 另有9个 AUDIT_REPORT 文件残留；验收命令应无结果但实际有15处命中 |
| ⑫ ralph-method prd | ⚠️ 部分通过 | prd.json 存在 ✅，progress 有时间戳 ✅；但 T-SPEC-02 在 prd 中标记 passes=true 与实际不符 ❌ |
| ⑬ TDD 红绿灯 | ✅ 通过 | T-SCRIPT-01、T-MIGRATE-01 各有 [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] 三行，格式正确 |

---

## 四、发现的 GAP 汇总

### GAP-1（中）：T-FS git 历史验证失败（未提交）

**现象**：T-FS-01~06 所有 git mv 变更仅 staged，未 commit。`git log --oneline -- BUGFIX_tdd-marker-audit-recurrence.md` 返回空。

**影响**：git 历史保留的有效性无法通过 `git log` 验证。若工作区发生其他变更或重置，历史保留意图可能丧失。

**修改建议**：执行 `git commit -m "chore: T-FS-01~06 迁移 implementation-artifacts 至两级层级结构（git mv）"` 将所有 T-FS 变更统一提交。

---

### GAP-2（低）：T-MIGRATE-01 dry-run 无法演示新路径格式

**现象**：dry-run 仅显示 `_orphan/` 路径，无 `epic-{N}-{slug}/story-{N}-{slug}/` 输出。

**原因**：T-FS 已手动完成迁移，implementation-artifacts 根目录无平铺 epic-story 文件残留。

**影响**：验收命令无法直接验证脚本新路径逻辑，需依赖代码审查（代码逻辑本身已正确）。

**修改建议**：在 INSTALLATION_AND_MIGRATION_GUIDE.md 和 T-MIGRATE-01 验收说明中补注："若实际迁移已完成，dry-run 可能无演示材料；脚本逻辑正确性通过代码审查（行163-165、183-186）验证"。

---

### GAP-3（高）：T-MIGRATE-01 should_skip_file() 缺少保留逻辑

**现象**：dry-run 显示 `sprint-status.yaml`、`.gitkeep`、`epic-3-retro-2026-03-04.md`、`epic-4-retro-2026-03-05.md` 将被移至 `_orphan/`。

**与规范冲突**：BUGFIX §8 迁移映射表："sprint-status.yaml、.gitkeep 保留根层，不移动"。INSTALLATION_AND_MIGRATION_GUIDE.md 行486："sprint-status.yaml 保持原位"。

**修改建议**：
```python
def should_skip_file(path: Path, impl_artifacts: Path) -> bool:
    name = path.name
    # 保留根层文件
    if name in ("sprint-status.yaml", ".gitkeep"):
        return True
    if re.match(r"^epic-\d+-retro-.*\.md$", name):
        return True
    # 原有逻辑...
```

---

### GAP-4（低）：T-DOCS-01 INSTALLATION guide 2处旧格式描述性残留

**现象**：行486、897 含 `` `{epic}-{story}-{slug}` ``，为描述脚本识别的 INPUT 文件名模式的说明性文字。

**验收标准**：`Select-String -Pattern "\{epic\}-\{story\}-\{slug\}"` 应无结果，实际 2 处命中。

**区分说明**：语义上为合理的历史格式说明；但严格验收标准不通过。

**修改建议**：
- 行486：改为 `文件名匹配 \`{N}-{N}-{slug}\` 旧格式 → 移入 \`epic-{N}-{slug}/story-{N}-{slug}/\``
- 行897：将 `` `{epic}-{story}-{slug}` 模式 `` 改为 `` `{N}-{N}-{slug}` 旧格式命名模式 ``

---

### GAP-5（阻断级）：T-SPEC-02 5个活跃 spec 文件未更新

**现象**：以下文件各有 1 处 `_bmad-output/implementation-artifacts/[0-9]` 格式旧路径残留：
- `specs/epic-4/story-1-eval-veto-iteration-rules/spec-E4-S1.md`（行132）
- `specs/epic-5/story-2-eval-scoring-rules-expansion/spec-E5-S2.md`（行15）
- `specs/epic-5/story-3-eval-parser-llm-fallback/spec-E5-S3.md`
- `specs/epic-5/story-4-eval-analytics-clustering/spec-E5-S4.md`
- `specs/epic-5/story-5-eval-analytics-advanced/spec-E5-S5.md`

此外 epic-4 有 9 个 AUDIT_REPORT 文件含旧路径（根据任务范围定义，可能属于次要残留）。

**验收结果**：验收命令 `应无结果`，实际 15 处命中。

**修改建议**：
```powershell
# 对每个文件执行路径替换（以 spec-E5-S2.md 为例）：
# 行15：`_bmad-output/implementation-artifacts/5-2-eval-scoring-rules-expansion/...`
# 改为：`_bmad-output/implementation-artifacts/epic-5-feature-eval-scoring-enhancement/story-2-eval-scoring-rules-expansion/...`
```

---

## 五、最终结论

**结论：未通过**

### 未满足的必达子项

| 必达子项 | 状态 | 原因 |
|----------|------|------|
| ① §7 T1~T5 完整实现 | ✅ 通过 | — |
| ② T-FS-01~06 git mv 迁移完整 | ⚠️ **部分未通过** | 目录结构正确但 git mv 未提交，git log 验证失败（GAP-1） |
| ③ T-SCRIPT-01 脚本更新 | ✅ 通过 | — |
| ④ T-CMD-01 命令文件更新 | ✅ 通过 | — |
| ⑤ T-CONFIG-01 阻断级 YAML 更新 | ✅ 通过 | — |
| ⑥ T-RULE-01 规则文件更新 | ✅ 通过 | — |
| ⑦ T-SKILL-01~04 全局 SKILL 路径 | ✅ 通过 | — |
| ⑧ T-SKILL-LOCAL-01 本地 SKILL 路径 | ✅ 通过 | — |
| ⑨ T-MIGRATE-01 Python 脚本更新 | ⚠️ **部分未通过** | 脚本逻辑正确但 should_skip_file 缺少保留逻辑（GAP-3），dry-run 无法演示新格式（GAP-2） |
| ⑩ T-DOCS-01/02 文档更新 | ⚠️ **部分未通过** | T-DOCS-02 通过；T-DOCS-01 行486/897 有2处旧格式残留（GAP-4） |
| ⑪ T-SPEC-01/02 spec 文件更新 | ❌ **未通过** | T-SPEC-01 通过；T-SPEC-02 **5个明确在任务范围的 spec 文件未更新，验收命令返回15处命中**（GAP-5，阻断级） |
| ⑫ ralph-method prd/progress | ⚠️ **部分未通过** | prd 中 T-SPEC-02 标记 passes=true 与实际不符 |
| ⑬ TDD 红绿灯记录 | ✅ 通过 | — |

### 阻断级不满足项（必须修复）

1. **T-SPEC-02（阻断）**：5 个活跃 spec 文件（spec-E4-S1.md、spec-E5-S2/S3/S4/S5）仍有旧路径引用，验收命令未满足"应无结果"。需逐一替换后重新验证。

2. **T-FS git commit（必要）**：所有 T-FS git mv 变更须 commit，否则 git 历史保留形同虚设。执行：`git commit -m "chore: T-FS-01~06 迁移 implementation-artifacts 至两级层级结构"`

### 次要修复项（修复后重审）

3. **T-MIGRATE-01 should_skip_file（高）**：补充 sprint-status.yaml、.gitkeep、retro 文件的跳过逻辑，防止执行时误移根层保留文件。

4. **T-DOCS-01（低）**：INSTALLATION guide 行486、897 旧格式措辞改为显式标注"旧格式"以避免混淆。

5. **ralph-method prd（低）**：T-SPEC-02 的 passes 字段改为 false，待修复后更新。

---

## 六、审计通过要求

重新执行以下验收命令，所有返回"应无结果"：
```powershell
# T-SPEC-02 验收
Get-ChildItem -Path "specs\epic-4","specs\epic-5" -Recurse -Filter "*.md" | Select-String -Pattern "_bmad-output/implementation-artifacts/[0-9]"

# T-FS git 历史验收
git log --oneline --follow -- "_bmad-output/implementation-artifacts/epic-5-feature-eval-scoring-enhancement/story-5-eval-analytics-advanced/5-5-eval-analytics-advanced.md"

# T-MIGRATE-01 dry-run（验证 sprint-status.yaml 不出现在迁移计划中）
python _bmad\scripts\bmad-speckit\python\migrate_bmad_output_to_subdirs.py --project-root . --dry-run
```

---

*本报告由代码审计员生成，经 100 轮多角色辩论（批判审计员 >70% 发言）收敛，最后 3 轮（98/99/100 轮）无新 GAP。*
