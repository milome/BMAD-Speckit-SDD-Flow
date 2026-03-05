# BUGFIX：§5 审计 TDD 标记问题反复出现

- **创建日期**：2026-03-05
- **关联 Story**：5.5 eval-analytics-advanced
- **Party-Mode 轮次**：100 轮（收敛：第 97–100 轮无新 gap）

---

## §1 现象 / 问题描述

用户收到 `AUDIT_§5_Story5.5_2026-03-05.md` 的审计结论「未通过」，原因是 progress 文件缺少 `[TDD-RED]`、`[TDD-GREEN]`、`[TDD-REFACTOR]` 标记，并附有修复建议（补入 US-002 的三段标记示例）。

用户疑问：**为什么这类审计问题反复出现？**

**当前实际状态（已通过）**：

经 round 2（`AUDIT_§5_Story5.5_round2_2026-03-05.md`）和 round 3 独立复核（`AUDIT_§5_Story5.5_round3_verification_2026-03-05.md`）确认，progress 文件已包含：

| 标记类型 | 出现次数 | 判定 |
|----------|----------|------|
| [TDD-RED] | 4 行 | ✅ 满足 |
| [TDD-GREEN] | 5 行 | ✅ 满足 |
| [TDD-REFACTOR] | 2 行 | ✅ 满足 |

**用户看到的是第一轮审计报告（已作废）**，该报告针对的是 TDD 标记补入之前的 progress 快照。

---

## §2 根因分析

### 根因 A（主因）：TDD 标记事后补入而非实时记录

**现象**：实施子代理完成全部 5 个 US 后，progress 文件只有 `[日期] US-00X: 描述 - PASSED` 这类状态行，没有 TDD 三段式标记。TDD 标记是在首次审计报告指出问题之后才补入的。

**机制**：子代理的任务执行顺序是：
1. 实现代码
2. 运行测试（记录 PASSED）
3. 推进下一个 US

TDD 文档（RED/GREEN/REFACTOR）被当成"可选的事后总结"而非"实施过程中的必要输出"。

**本质**：ralph-method 的 `progress.txt` 是设计为实施过程中的**实时 TDD 日志**，但子代理将其用作**完成后的状态记录**。

---

### 根因 B：REFACTOR 阶段系统性省略

progress 文件中，US-003（prompt-optimizer）和 US-004（rule-suggestion）只有 RED+GREEN，没有 REFACTOR。US-005（集成回归）只有 GREEN。

**机制**：
- REFACTOR 是 TDD 三阶段中最容易被遗漏的，因为测试通过后开发者/子代理往往认为"任务完成"。
- US-005 是集成/回归任务，没有"先写失败测试"的自然动作，RED 阶段在语义上不自然。子代理选择跳过。

**当前规则的模糊性**：audit-prompts §5 要求"各至少一行"，但未区分功能开发任务与集成/回归任务的 TDD 模式差异。

---

### 根因 C：audit-prompts §5 检查粒度未在工作流中明确

规则要求"全文件至少各一行"（宽松），还是"每个 US 各三段"（严格），在 speckit-workflow 和 bmad-story-assistant 的文档中均未明确说明。子代理可以"合理误解"：只要文件里出现过就行，导致 US-001/002 充当全文件的"代表"，US-003/004/005 的 REFACTOR 被省略。

---

### 根因 D：审计报告版本未随修复更新（信息混淆）

用户看到的是 `AUDIT_§5_Story5.5_2026-03-05.md`（首次，已作废），而 round 2 和 round 3 已通过，但文件命名不直观（round2、round3 命名与首次命名没有明显的"替代"关系）。用户容易误以为问题仍未解决。

---

## §3 依据 / 参考

| 文档 | 关键证据 |
|------|----------|
| `AUDIT_§5_Story5.5_2026-03-05.md` §④ | 首次审计时 progress 无 TDD 标记 |
| `AUDIT_§5_Story5.5_round2_2026-03-05.md` §④ | TDD 标记补入后 ✅ 通过 |
| `AUDIT_§5_Story5.5_round3_verification_2026-03-05.md` §④ | 独立复核确认 ✅ 通过 |
| `progress.5-5-eval-analytics-advanced.txt` 当前内容 | US-001/002 有完整 RED/GREEN/REFACTOR；US-003/004 有 RED/GREEN；US-005 有 GREEN |

---

## §4 修复方案

### 4.1 即时修复（当前 Story 5.5）

**状态**：✅ 已完成。

TDD 标记已在 round 2 审计前补入，round 2 和 round 3 均通过。用户看到的首次审计报告是历史快照，已由 round 3 替代为最终有效审计结论。

**须执行**：将 `AUDIT_§5_Story5.5_2026-03-05.md` 标记为"已作废"并在文件头加注，避免混淆：

```
⚠️ 本报告为首次审计（已作废）。最终有效结论见：
AUDIT_§5_Story5.5_round3_verification_2026-03-05.md（结论：通过）
```

### 4.2 系统修复（防止再次出现）

**修复 A：子代理实施 prompt 中将 TDD progress 记录要求前置**

在 bmad-story-assistant SKILL 和 speckit-workflow SKILL 中，将 TDD progress 日志要求移至任务描述**之前**，并明确"每完成一个 US 立即写入 RED→GREEN→REFACTOR"：

```
【每个 US 实施完成前必须执行，不可跳过】
在 progress.{slug}.txt 追加：
[TDD-RED] US-00X {name}: {测试命令} => FAIL（原因）
[TDD-GREEN] US-00X {name}: 实现后 => N passed
[TDD-REFACTOR] US-00X {name}: {重构内容} / 无需重构（集成任务）
```

**修复 B：明确集成/回归任务的 TDD 三段式写法**

在规范中补充：集成/回归任务（如"全量回归"US）的三段式写法为：

```
[TDD-RED] US-00X integration: 运行前确认前置模块存在 / 首次运行发现 N failed
[TDD-GREEN] US-00X integration: 全量测试 => N passed
[TDD-REFACTOR] US-00X integration: 各模块独立，无跨模块重构 / 或 {具体重构}
```

**修复 C：在 story 实施任务模板 §7 末尾添加 TDD progress 验收 checklist**

```
- [ ] progress.{slug}.txt 中每个 US 均有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各一行（集成任务可用"无需重构"表述）
- [ ] 审计前确认 progress 是否为最新版本（非缓存/快照）
```

---

## §5 流程建议

### 审计轮次命名约定

建议建立审计文件的"替代"关系约定：

| 当前命名 | 建议改进 |
|----------|----------|
| `AUDIT_§5_Story5.5_2026-03-05.md` | 在文件头加 `⚠️ 已作废，见 round3` |
| `AUDIT_§5_Story5.5_round3_verification_2026-03-05.md` | 在文件头加 `✅ 最终有效审计` |

或采用文件命名约定：`AUDIT_§5_{slug}_FINAL_2026-03-05.md` 表示最终有效报告。

---

## §6 REFACTOR 阶段补充分析

### 为什么 REFACTOR 基本从不执行

**直接原因**：GREEN 阶段（测试通过）触发强烈的"任务完成"信号，REFACTOR 没有明确的"新绿灯"输出，极易被跳过。

**根本原因**：REFACTOR 被错误理解为"必须有具体重构动作才记录"，而不是"必须做出判断并记录判断结果"。面对"无需重构"时，子代理不知道该写什么，选择跳过整行。

**集成任务额外问题**：US-005（全量回归）类型的任务，"重构"这个词语义不清晰，子代理无从落笔。

### REFACTOR 的正确定义

REFACTOR 不是"我做了重构"，而是"我检查了代码质量并做出判断"。**无论结论如何，都必须记录**：

```
# 有具体重构
[TDD-REFACTOR] US-003 prompt-optimizer: 将 readMdFiles 抽取为独立函数，便于单测 mock

# 无需重构（同样合法，必须显式记录）
[TDD-REFACTOR] US-003 prompt-optimizer: 逻辑已清晰，命名规范，无需重构 ✓

# 集成/回归任务
[TDD-REFACTOR] US-005 integration: 无新增生产代码，各模块独立性已验证，无跨模块重构 ✓
```

---

## §7 最终任务列表

| # | 任务 | 状态 | 优先级 |
|---|------|------|--------|
| T1 | 在首次审计文件 `_bmad-output/implementation-artifacts/5-5-eval-analytics-advanced/AUDIT_§5_Story5.5_2026-03-05.md` 文件头添加「已作废」注记，指向 round3 文件。验收：文件头第 1-4 行含"⚠️ 本报告为首次审计（已作废）" | 🔲 待执行 | 高 |
| T2 | 在 `speckit-workflow` SKILL（`C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`）中：①将 TDD progress 要求前置；②明确 REFACTOR 含义为"判断"而非"动作"；③补充"无需重构"和集成任务三段式写法示例（见 §7 T2 细化，修改第 332 行，已以内容锚定为准） | 🔲 待执行 | 中 |
| T3 | 在 `bmad-story-assistant` SKILL 的实施子任务 prompt 模板中：①将 TDD progress 记录要求置于任务列表之前；②为 REFACTOR 提供自检清单（函数长度/重复逻辑/命名/mock 机会）；③明确"无需重构"是合法且必须记录的结论。**T3 须在 T4 之前执行**（两者均追加到第 828 行末尾，T3 内容在前） | 🔲 待执行 | 中 |
| T4 | 在 `bmad-story-assistant` SKILL Dev Story 实施 prompt 模板末尾（`C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md` 第 828 行 `必须遵守` 段落内）补充 TDD progress checklist：追加"每个 US 完成后须在 progress 追加三行 [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR]（集成任务 REFACTOR 可写'无需重构'）"。**T4 须在 T3 之后执行** | 🔲 待执行 | 低 |
| T5 | 在 `C:\Users\milom\.cursor\skills\speckit-workflow\references\audit-prompts.md` 第 44 行（以内容锚定），将"涉及生产代码的任务须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行"升级为"每个涉及生产代码的 US 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各一行（集成任务 REFACTOR 可用'无需重构'表述）" | 🔲 待执行 | 低 |

**当前 Story 5.5 的 §5 审计状态**：✅ 已通过（round 3 最终确认）。T1 为必须执行的文档修正（防止引用旧报告产生混淆），T2~T5 为防止 REFACTOR 反复缺失的系统改进。

---

## §8 附加改进：implementation-artifacts 目录结构与 specs 对齐

### 背景

`specs/` 目录已采用 `epic-{N}-{slug}/story-{N}-{slug}/` 两级层级结构，但 `_bmad-output/implementation-artifacts/` 目前为扁平的 `{epic}-{story}-{slug}/` 一级结构。为使两个目录回顾时能直观对应，需将 implementation-artifacts 迁移为相同的两级层级结构，epic 目录同样具备序号和 slug。

### 迁移映射表

**目标结构**：`_bmad-output/implementation-artifacts/epic-{N}-{slug}/story-{N}-{slug}/`

| 当前路径（相对 implementation-artifacts/） | 目标路径（相对 implementation-artifacts/） |
|---------------------------------------------|---------------------------------------------|
| `1-1-eval-system-scoring-core/` | `epic-1-feature-eval-scoring-core/story-1-eval-system-scoring-core/` |
| `1-2-eval-system-storage-writer/` | `epic-1-feature-eval-scoring-core/story-2-eval-system-storage-writer/` |
| `2-1-eval-rules-yaml-config/` | `epic-2-feature-eval-rules-authority/story-1-eval-rules-yaml-config/` |
| `2-2-eval-authority-doc/` | `epic-2-feature-eval-rules-authority/story-2-eval-authority-doc/` |
| `3-1-eval-lifecycle-skill-def/` | `epic-3-feature-eval-lifecycle-skill/story-1-eval-lifecycle-skill-def/` |
| `3-2-eval-layer1-3-parser/` | `epic-3-feature-eval-lifecycle-skill/story-2-eval-layer1-3-parser/` |
| `3-3-eval-skill-scoring-write/` | `epic-3-feature-eval-lifecycle-skill/story-3-eval-skill-scoring-write/` |
| `4-1-eval-veto-iteration-rules/` | `epic-4-feature-eval-coach-veto-integration/story-1-eval-veto-iteration-rules/` |
| `4-2-eval-ai-coach/` | `epic-4-feature-eval-coach-veto-integration/story-2-eval-ai-coach/` |
| `4-3-eval-scenario-bmad-integration/` | `epic-4-feature-eval-coach-veto-integration/story-3-eval-scenario-bmad-integration/` |
| `5-1-eval-foundation-modules/` | `epic-5-feature-eval-scoring-enhancement/story-1-eval-foundation-modules/` |
| `5-2-eval-scoring-rules-expansion/` | `epic-5-feature-eval-scoring-enhancement/story-2-eval-scoring-rules-expansion/` |
| `5-3-eval-parser-llm-fallback/` | `epic-5-feature-eval-scoring-enhancement/story-3-eval-parser-llm-fallback/` |
| `5-4-eval-analytics-clustering/` | `epic-5-feature-eval-scoring-enhancement/story-4-eval-analytics-clustering/` |
| `5-5-eval-analytics-advanced/` | `epic-5-feature-eval-scoring-enhancement/story-5-eval-analytics-advanced/` |
| `parseAndWriteScore-embedding-and-skill-migration/` | `_orphan/parseAndWriteScore-embedding-and-skill-migration/`（归入 _orphan） |
| `epic-3-retro-2026-03-04.md`（根层文件） | 保留根层，不移动 |
| `epic-4-retro-2026-03-05.md`（根层文件） | 保留根层，不移动 |
| `sprint-status.yaml`、`.gitkeep`（根层文件） | 保留根层，不移动 |

### §8 任务列表

#### T-FS-01：迁移 Epic 1 的 story 目录【GAP-A 修正：使用 git mv】

**操作文件**：`_bmad-output/implementation-artifacts/`

```powershell
Set-Location "d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts"
New-Item -ItemType Directory -Force -Path "epic-1-feature-eval-scoring-core"
git mv "1-1-eval-system-scoring-core" "epic-1-feature-eval-scoring-core/story-1-eval-system-scoring-core"
git mv "1-2-eval-system-storage-writer" "epic-1-feature-eval-scoring-core/story-2-eval-system-storage-writer"
```

**验收**：`git status` 确认两行均显示 `renamed` 而非 `deleted + untracked`。

---

#### T-FS-02：迁移 Epic 2 的 story 目录【GAP-A 修正：使用 git mv】

**操作文件**：`_bmad-output/implementation-artifacts/`

```powershell
Set-Location "d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts"
New-Item -ItemType Directory -Force -Path "epic-2-feature-eval-rules-authority"
git mv "2-1-eval-rules-yaml-config" "epic-2-feature-eval-rules-authority/story-1-eval-rules-yaml-config"
git mv "2-2-eval-authority-doc" "epic-2-feature-eval-rules-authority/story-2-eval-authority-doc"
```

**验收**：`git status` 确认两行均显示 `renamed`。

---

#### T-FS-03：迁移 Epic 3 的 story 目录【GAP-A 修正：使用 git mv】

**操作文件**：`_bmad-output/implementation-artifacts/`

```powershell
Set-Location "d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts"
New-Item -ItemType Directory -Force -Path "epic-3-feature-eval-lifecycle-skill"
git mv "3-1-eval-lifecycle-skill-def" "epic-3-feature-eval-lifecycle-skill/story-1-eval-lifecycle-skill-def"
git mv "3-2-eval-layer1-3-parser" "epic-3-feature-eval-lifecycle-skill/story-2-eval-layer1-3-parser"
git mv "3-3-eval-skill-scoring-write" "epic-3-feature-eval-lifecycle-skill/story-3-eval-skill-scoring-write"
```

**验收**：`git status` 确认三行均显示 `renamed`。

---

#### T-FS-04：迁移 Epic 4 的 story 目录【GAP-A 修正：使用 git mv】

**操作文件**：`_bmad-output/implementation-artifacts/`

```powershell
Set-Location "d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts"
New-Item -ItemType Directory -Force -Path "epic-4-feature-eval-coach-veto-integration"
git mv "4-1-eval-veto-iteration-rules" "epic-4-feature-eval-coach-veto-integration/story-1-eval-veto-iteration-rules"
git mv "4-2-eval-ai-coach" "epic-4-feature-eval-coach-veto-integration/story-2-eval-ai-coach"
git mv "4-3-eval-scenario-bmad-integration" "epic-4-feature-eval-coach-veto-integration/story-3-eval-scenario-bmad-integration"
```

**验收**：`git status` 确认三行均显示 `renamed`。

---

#### T-FS-05：迁移 Epic 5 的 story 目录【GAP-A 修正：使用 git mv】

> ⚠️ **注意**：T-FS-05 会移动本 BUGFIX 文档所在的 `5-5-eval-analytics-advanced/` 目录。执行后，本文档新路径为 `epic-5-feature-eval-scoring-enhancement/story-5-eval-analytics-advanced/BUGFIX_tdd-marker-audit-recurrence.md`，请及时切换路径继续访问。

**操作文件**：`_bmad-output/implementation-artifacts/`

```powershell
Set-Location "d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts"
New-Item -ItemType Directory -Force -Path "epic-5-feature-eval-scoring-enhancement"
git mv "5-1-eval-foundation-modules" "epic-5-feature-eval-scoring-enhancement/story-1-eval-foundation-modules"
git mv "5-2-eval-scoring-rules-expansion" "epic-5-feature-eval-scoring-enhancement/story-2-eval-scoring-rules-expansion"
git mv "5-3-eval-parser-llm-fallback" "epic-5-feature-eval-scoring-enhancement/story-3-eval-parser-llm-fallback"
git mv "5-4-eval-analytics-clustering" "epic-5-feature-eval-scoring-enhancement/story-4-eval-analytics-clustering"
git mv "5-5-eval-analytics-advanced" "epic-5-feature-eval-scoring-enhancement/story-5-eval-analytics-advanced"
```

**验收**：`git status` 确认五行均显示 `renamed`。

#### T-FS-06：迁移 orphan 特殊目录

**操作文件**：`_bmad-output/implementation-artifacts/`

```powershell
# 先创建 _orphan 目录（若不存在）
New-Item -ItemType Directory -Force -Path "_orphan"
# 用 git mv 保留历史
git mv "parseAndWriteScore-embedding-and-skill-migration" "_orphan/parseAndWriteScore-embedding-and-skill-migration"
```

**验收**：`git status` 确认显示为 `renamed` 而非 `deleted + untracked`。

---

#### T-SCRIPT-01：更新 create-new-feature.ps1 story 子目录创建逻辑【GAP-C 修正：以此段为唯一规范，见 §8 细化版本】

**文件**：`_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

> ⚠️ **唯一规范**：本任务的完整修改前/后内容在下方 §8 GAP-5 细化段落中给出，**以 §8 版本为准**（含完整注释行和 `$bmadOutputBase`/`$implArtifacts` 赋值的 7 行代码段）。执行者请直接参考 §8 细化版本，忽略任何行号指引，以代码片段锚定替换。

---

#### T-CMD-01：更新 commands/speckit.implement.md 路径约定【审计新增 GAP-F】

**文件（须同时更新两个副本）**：
1. `d:\Dev\BMAD-Speckit-SDD-Flow\commands\speckit.implement.md`
2. `d:\Dev\BMAD-Speckit-SDD-Flow\.cursor\commands\speckit.implement.md`

**修改前**（两个文件的第 59 行及第 62 行，含旧路径约定）：
```
_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/
```

**修改后**（两个文件均修改为）：
```
_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/
```

**验收**：
```powershell
# 旧路径应无结果
Select-String -Path "commands\speckit.implement.md" -Pattern "\{epic\}-\{story\}-\{slug\}"
Select-String -Path ".cursor\commands\speckit.implement.md" -Pattern "\{epic\}-\{story\}-\{slug\}"
# 新路径应有结果
Select-String -Path "commands\speckit.implement.md" -Pattern "epic-\{epic\}-\{epic-slug\}"
Select-String -Path ".cursor\commands\speckit.implement.md" -Pattern "epic-\{epic\}-\{epic-slug\}"
```

> **说明（高优先级）**：`commands/speckit.implement.md` 是 `/speckit.implement` 命令的运行时指令模板，控制每次 Story 实施时子代理的 prd/progress 路径创建行为。不更新会导致未来所有新 Story 的 prd/progress 写入旧扁平路径，ralph-method 验收失败。T-CMD-01 须在 T-FS-01~06 完成后、T-DOCS-01 之前执行。

---

#### T-SKILL-01：更新 bmad-story-assistant SKILL 路径约定

> **说明**：本任务更新全局版本。workspace 本地 skill 副本的更新由 **T-SKILL-LOCAL-01**（见下方）统一处理，须与本任务同步执行。

**文件**：`C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

将以下所有路径模式：
- `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` 
- `_bmad-output/implementation-artifacts/{epic_num}-{story_num}-<slug>/`
- `_bmad-output/implementation-artifacts/{epic_num}-{story_num}-*/`
- `_bmad-output/implementation-artifacts/4-1-*/` （示例硬编码）
- `_bmad-output/implementation-artifacts/4-1-<slug>/4-1-<slug>.md`（示例）
- `_bmad-output/implementation-artifacts/{X}-{Y}-*/`（推迟闭环验证）

统一替换为：
- `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`
- `_bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{epic_num}-{story_num}-*/`
- `_bmad-output/implementation-artifacts/epic-4-*/story-4-1-*/`（示例）
- `_bmad-output/implementation-artifacts/epic-{X}-*/story-{X}-{Y}-*/`（推迟闭环）

**受影响行**：97、112、132、139、140、262–268、495、508、551、553、721、724、805、823、828、1398

---

---

### §7 T2/T3 修改位置细化【审计 P1 修正】

#### T2 细化：speckit-workflow SKILL TDD 内容修改

**文件**：`C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**修改位置 1**（以内容锚定，实际约第 332 行，`重构` 步骤描述）【GAP-K 修正：以内容锚定，不依赖行号】：

```
# 修改前
- **重构**：在测试保护下优化代码至符合最佳实践（SOLID、命名、解耦、性能），确保测试仍全部通过。重构至符合最佳实践后方可结束。

# 修改后
- **重构**：在测试保护下检查并优化代码质量（SOLID、命名、解耦、性能）。**无论是否有具体重构动作，均须在 progress 中记录 `[TDD-REFACTOR]` 一行**；无具体重构时写"无需重构 ✓"，集成任务写"无新增生产代码，各模块独立性已验证，无跨模块重构 ✓"。
```

**修改位置 2**（第 350 行，TDD 记录模板中的 REFACTOR 行）：

```
# 修改前
[TDD-REFACTOR] TX [重构操作描述]

# 修改后
[TDD-REFACTOR] TX [重构操作描述 | 无需重构 ✓ | 集成任务: 无新增生产代码，各模块独立性已验证 ✓]
```

**修改位置 3**（第 361 行，必填字段说明第 3 条）：

```
# 修改前
3. `[TDD-REFACTOR]` - 标记重构阶段

# 修改后
3. `[TDD-REFACTOR]` - 标记重构阶段（必须记录判断结果，无论是否有具体重构动作；禁止省略此行）
```

---

#### T3 细化：bmad-story-assistant SKILL 实施 prompt 修改

**文件**：`C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`

**修改位置**（第 828 行，Dev Story 实施 prompt 模板中的"必须遵守"段落，在末尾补充追加）：

在第 828 行末尾（`pytest 在项目根目录运行。` 后）追加：

```
**TDD progress 验收自检（每个 US 完成后立即验证）**：
- [ ] progress.{stem}.txt 中对应 US 有 [TDD-RED] 一行（集成任务可写"首次全量运行 N failed"）
- [ ] progress.{stem}.txt 中对应 US 有 [TDD-GREEN] 一行
- [ ] progress.{stem}.txt 中对应 US 有 [TDD-REFACTOR] 一行（无需重构须显式写"无需重构 ✓"，禁止省略）
```

---

#### T-SKILL-02：更新 bmad-bug-assistant SKILL 路径约定

**文件**：`C:\Users\milom\.cursor\skills\bmad-bug-assistant\SKILL.md`

**修改前**（第 149–151 行）：
```
| BUGFIX 文档 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/BUGFIX_{slug}.md` |
| TASKS       | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/TASKS_BUGFIX_{slug}.md` |
| prd、progress | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/prd.BUGFIX_{slug}.json`、`progress.BUGFIX_{slug}.txt` |
```

**修改后**：
```
| BUGFIX 文档 | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md` |
| TASKS       | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/TASKS_BUGFIX_{slug}.md` |
| prd、progress | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.BUGFIX_{slug}.json`、`progress.BUGFIX_{slug}.txt` |
```

---

#### T-SKILL-03：更新 speckit-workflow SKILL 路径约定

**文件**：`C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md`

**修改前**（第 145–146 行）：
```
speckit 产出在 spec 子目录；BMAD 产出在 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`。
当 spec 路径为 `specs/epic-{epic}/story-{story}-{slug}/` 时，对应 BMAD 子目录为 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`。
```

**修改后**：
```
speckit 产出在 spec 子目录；BMAD 产出在 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`。
当 spec 路径为 `specs/epic-{epic}/story-{story}-{slug}/` 时，对应 BMAD 子目录为 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`。
```

**修改位置 2**（第 322 行，prd/progress 路径检查描述）【GAP-V 新增】：

```
# 修改前（第 322 行）
`_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` 下不存在 prd/progress

# 修改后
`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/` 下不存在 prd/progress
```

**修改位置 3**（第 325 行，BMAD 产出路径描述）【GAP-V 新增】：

```
# 修改前（第 325 行）
产出路径 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`（BMAD 流程时）

# 修改后
产出路径 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`（BMAD 流程时）
```

> 注：第 314、317 行（旧描述）行号可能因文档更新而偏移，执行时以内容锚定为准，不依赖行号。

**验收**：
```powershell
Select-String -Path "C:\Users\milom\.cursor\skills\speckit-workflow\SKILL.md" -Pattern "\{epic\}-\{story\}-\{slug\}"
# 应仅剩不需修改的示例或说明，不含产出路径定义
```

---

#### T-SKILL-04：更新 bmad-code-reviewer-lifecycle SKILL 硬编码路径

**文件**：`C:\Users\milom\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md`

**修改前**（第 45 行）：
```
详见 `config/eval-lifecycle-report-paths.yaml` 或 `_bmad-output/implementation-artifacts/3-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md`。
```

**修改后**：
```
详见 `config/eval-lifecycle-report-paths.yaml` 或 `_bmad-output/implementation-artifacts/epic-3-feature-eval-lifecycle-skill/story-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md`。
```

---

#### T-RULE-01：更新 bmad-bug-auto-party-mode 规则文件路径约定【Party-Mode 新增 GAP-1；GAP-D 扩展两个副本】

**文件（须同时更新两个副本）**：
1. `d:\Dev\BMAD-Speckit-SDD-Flow\.cursor\rules\bmad-bug-auto-party-mode.mdc`
2. `d:\Dev\BMAD-Speckit-SDD-Flow\rules\bmad-bug-auto-party-mode.mdc`（项目根 rules/ 副本）

**修改前**（两个文件的第 36 行，内容相同）：
```
路径：有 story 时 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/BUGFIX_{slug}.md`；
```

**修改后**（两个文件均修改为）：
```
路径：有 story 时 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md`；
```

**验收**：
```powershell
# 两个文件旧路径均应无结果
Select-String -Path ".cursor\rules\bmad-bug-auto-party-mode.mdc" -Pattern "\{epic\}-\{story\}-\{slug\}"
Select-String -Path "rules\bmad-bug-auto-party-mode.mdc" -Pattern "\{epic\}-\{story\}-\{slug\}"
# 两个文件新路径均应有结果
Select-String -Path ".cursor\rules\bmad-bug-auto-party-mode.mdc" -Pattern "epic-\{epic\}-\{epic-slug\}"
Select-String -Path "rules\bmad-bug-auto-party-mode.mdc" -Pattern "epic-\{epic\}-\{epic-slug\}"
```

> **说明**：两个副本均为 `alwaysApply: true` 规则文件，不同工具/IDE 可能读取不同副本，必须同步更新。

---

#### T-MIGRATE-01：更新 migrate_bmad_output_to_subdirs.py 迁移逻辑【Party-Mode 新增 GAP-2】

**文件**：`_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`

**背景**：该脚本在 `docs/INSTALLATION_AND_MIGRATION_GUIDE.md` 第476、481、895、993行被直接调用，是向用户公开的标准迁移工具，不能废弃。

**需修改内容**：

1. **在脚本顶部 import 区域新增 `import subprocess`**（与现有 `import re` 相邻）。

   **新增 `get_epic_slug_from_epics_md(epic_num: str, project_root: Path) -> str | None` 函数**（无函数级 import，直接使用顶级 `subprocess` 和 `re`）：

   ```python
   def get_epic_slug_from_epics_md(epic_num: str, project_root: Path) -> str | None:
       """从 _bmad-output/planning-artifacts/{branch}/epics.md 提取 epic slug。"""
       try:
           branch = subprocess.run(
               ["git", "rev-parse", "--abbrev-ref", "HEAD"],
               capture_output=True, text=True, cwd=project_root
           ).stdout.strip() or "dev"
       except Exception:
           branch = "dev"
       for b in [branch, "dev"]:
           epics_md = project_root / "_bmad-output" / "planning-artifacts" / b / "epics.md"
           if epics_md.exists():
               text = epics_md.read_text(encoding="utf-8")
               m = re.search(
                   rf"^#{{2,3}}\s+Epic\s+{re.escape(str(epic_num))}\s*[：:]\s*(.+)",
                   text, re.MULTILINE
               )
               if m:
                   title = m.group(1).strip()
                   return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
       return None
   ```

2. **修改 `run_migration()` dry-run 显示段（第 134-139 行）**【GAP-H 修正】：

   修改前（dry-run 输出段，显示旧扁平路径）：
   ```python
   for subdir in sorted(by_subdir.keys()):
       target_dir = impl_artifacts / subdir
       ...
   ```

   修改后（dry-run 段同步使用新路径逻辑）：
   ```python
   for subdir in sorted(by_subdir.keys()):
       m2 = EPIC_STORY_SLUG_RE.match(subdir)
       if m2:
           epic_num2, story_num2, slug2 = m2.group(1), m2.group(2), m2.group(3)
           epic_slug2 = get_epic_slug_from_epics_md(epic_num2, project_root)
           epic_dir2 = f"epic-{epic_num2}-{epic_slug2}" if epic_slug2 else f"epic-{epic_num2}"
           target_dir = impl_artifacts / epic_dir2 / f"story-{story_num2}-{slug2}"
       else:
           target_dir = impl_artifacts / subdir
       ...
   ```

3. **修改 `run_migration()` 中实际执行段目标目录构建逻辑**：

   修改前：
   ```python
   target_dir = impl_artifacts / subdir   # subdir = "{N}-{N}-{slug}"
   ```

   修改后（复用已有 `EPIC_STORY_SLUG_RE`，不调用不存在的函数）：
   ```python
   m = EPIC_STORY_SLUG_RE.match(subdir)
   if m:
       epic_num, story_num, slug_part = m.group(1), m.group(2), m.group(3)
       epic_slug = get_epic_slug_from_epics_md(epic_num, project_root)
       epic_dir = f"epic-{epic_num}-{epic_slug}" if epic_slug else f"epic-{epic_num}"
       story_dir = f"story-{story_num}-{slug_part}"
       target_dir = impl_artifacts / epic_dir / story_dir
   else:
       target_dir = impl_artifacts / subdir  # fallback: 保持原行为
   ```

4. **`import subprocess` 移至文件顶部**【GAP-L 修正：函数级 import 违反 Python 最佳实践】：

   在脚本顶部（现有 `import re` 旁边）添加：
   ```python
   import subprocess
   ```
   并将 `get_epic_slug_from_epics_md` 函数体内的 `import subprocess, re as _re` 删除，直接使用顶级 `subprocess` 和 `re`（函数内将 `_re.search` 改为 `re.search`，`_re.sub` 改为 `re.sub`）。

5. **TDD 步骤**【GAP-P 修正：Python 脚本修改须含 TDD-RED/GREEN/REFACTOR】：

   ```
   [TDD-RED] T-MIGRATE-01：修改前运行 python migrate_bmad_output_to_subdirs.py --dry-run
             确认输出目标路径仍为旧格式（如 4-1-eval-ai-coach/），此为红灯（功能未修改时的预期状态）
   [TDD-GREEN] T-MIGRATE-01：修改 run_migration() 后运行 python migrate_bmad_output_to_subdirs.py --dry-run
              确认输出目标路径形如 epic-4-feature-eval-coach-veto-integration/story-2-eval-ai-coach/ => 绿灯
   [TDD-REFACTOR] T-MIGRATE-01：函数逻辑清晰，import 已移至顶部，无需额外重构 ✓
   ```

6. **验收命令**：
   ```powershell
   cd d:\Dev\BMAD-Speckit-SDD-Flow\_bmad\scripts\bmad-speckit\python
   python migrate_bmad_output_to_subdirs.py --dry-run
   # 确认输出路径形如 epic-{N}-{slug}/story-{N}-{slug}/
   ```

7. **更新脚本顶部注释**：说明目标结构已从 `{N}-{N}-{slug}/` 变更为 `epic-{N}-{slug}/story-{N}-{slug}/`

---

#### T-DOCS-01：更新 INSTALLATION_AND_MIGRATION_GUIDE.md 路径约定【Party-Mode 新增 GAP-2 附属】

**文件**：`docs/INSTALLATION_AND_MIGRATION_GUIDE.md`

**修改内容**：

| 位置 | 修改前 | 修改后 |
|------|--------|--------|
| 第 644 行 | `implementation-artifacts/{epic}-{story}-{slug}/` | `implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/` |
| 第 472 行 | "使用平铺结构（文件直接放在 `implementation-artifacts/` 下），需迁移到 Story 子目录结构" | "使用平铺结构，需迁移到两级层级结构（`epic-{N}-{slug}/story-{N}-{slug}/`）" |
| 第 891 行 | "可以使用 `migrate_bmad_output_to_subdirs.py` 将现有平铺文件迁移到 Story 子目录结构" | "可以使用 `migrate_bmad_output_to_subdirs.py` 将现有平铺文件迁移到两级层级结构（`epic-{N}-{epic-slug}/story-{N}-{slug}/`）；脚本会自动从 `_bmad-output/planning-artifacts/{branch}/epics.md` 提取 epic slug" |

**验收**：
```powershell
# 旧模式应无结果
Select-String -Path "docs\INSTALLATION_AND_MIGRATION_GUIDE.md" -Pattern "\{epic\}-\{story\}-\{slug\}"
# 新模式应有结果（注意：与修改后内容 epic-{epic}-{epic-slug} 一致）
Select-String -Path "docs\INSTALLATION_AND_MIGRATION_GUIDE.md" -Pattern "epic-\{epic\}-\{epic-slug\}"
```

---

#### T-SKILL-LOCAL-01：更新 workspace 本地 skill 副本路径约定【审计 Round2 GAP-G-残留 + GAP-NEW-1 + GAP-NEW-2】

> Cursor IDE 在存在 workspace 本地 `skills/` 时**优先加载本地副本**，不更新本地副本则全局修改无效。**以下三个文件须强制更新**，无需确认。

**须同时更新四个文件**【GAP-R3-1：补充第 4 个本地副本】：
1. `d:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-story-assistant\SKILL.md`（7 处旧路径，对应全局 T-SKILL-01）
2. `d:\Dev\BMAD-Speckit-SDD-Flow\skills\speckit-workflow\SKILL.md`（4 处旧路径，对应全局 T-SKILL-03）
3. `d:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-bug-assistant\SKILL.md`（3 处旧路径，对应全局 T-SKILL-02）
4. `d:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-code-reviewer-lifecycle\SKILL.md`（硬编码路径 `3-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md`，对应全局 T-SKILL-04）

**更新规则**：与各自全局版本（T-SKILL-01~04）的替换规则完全一致，但文件路径不同。以内容锚定方式找到旧路径模式 `{epic}-{story}-{slug}/` 或数字路径 `3-1-eval-lifecycle-skill-def/` 并替换为新层级格式。

**验收**：
```powershell
# 四个本地文件旧模式均应无结果
Select-String -Path "skills\bmad-story-assistant\SKILL.md" -Pattern "\{epic\}-\{story\}-\{slug\}"
Select-String -Path "skills\speckit-workflow\SKILL.md" -Pattern "\{epic\}-\{story\}-\{slug\}"
Select-String -Path "skills\bmad-bug-assistant\SKILL.md" -Pattern "\{epic\}-\{story\}-\{slug\}"
Select-String -Path "skills\bmad-code-reviewer-lifecycle\SKILL.md" -Pattern "3-1-eval-lifecycle-skill-def"
```

---

#### T-CONFIG-01：更新 config/eval-lifecycle-report-paths.yaml【审计 Round2 GAP-NEW-3 阻断级】

**文件**：`d:\Dev\BMAD-Speckit-SDD-Flow\config\eval-lifecycle-report-paths.yaml`

**修改位置**：第 17 行（运行时审计报告路径配置，直接决定报告写入路径）

**修改前**：
```yaml
report_path: _bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md
```

**修改后**：
```yaml
report_path: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_Story_{epic}-{story}.md
```

**验收**：
```powershell
Select-String -Path "config\eval-lifecycle-report-paths.yaml" -Pattern "\{epic\}-\{story\}-\{slug\}"
# 应无结果（旧路径已替换）
```

> **说明（阻断级）**：不更新此文件，T-FS 迁移后审计报告将写入不存在的旧路径，直接导致写入失败。须在 T-FS-01~06 执行后立即更新。

---

#### T-DOCS-02：更新 scoring/parsers/README.md 路径示例【审计 Round2 GAP-NEW-4】

**文件**：`d:\Dev\BMAD-Speckit-SDD-Flow\scoring\parsers\README.md`

**修改位置**：第 16 行（路径示例）

**修改前**（包含旧路径模式）：
```
_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/...
```

**修改后**：
```
_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/...
```

**验收**：
```powershell
Select-String -Path "scoring\parsers\README.md" -Pattern "\{epic\}-\{story\}-\{slug\}"
# 应无结果
```

---

#### T-SPEC-01：更新 specs/epic-3/ 下含旧路径约定的文件【审计 Round2 GAP-NEW-5；Round3 GAP-R3-2 补全】

**涉及文件**（已 grep 确认，共 10 个含旧路径约定的文件）【GAP-R3-2 修正：原"6个"描述不完整，以下为完整列表】：
- `specs/epic-3/story-1-eval-lifecycle-skill-def/spec-E3-S1.md`
- `specs/epic-3/story-1-eval-lifecycle-skill-def/plan-E3-S1.md`
- `specs/epic-3/story-1-eval-lifecycle-skill-def/tasks-E3-S1.md`（第 104、119 行含产出物路径约定）
- `specs/epic-3/story-1-eval-lifecycle-skill-def/IMPLEMENTATION_GAPS-E3-S1.md`
- `specs/epic-3/story-2-eval-layer1-3-parser/spec-E3-S2.md`
- `specs/epic-3/story-2-eval-layer1-3-parser/plan-E3-S2.md`
- `specs/epic-3/story-3-eval-skill-scoring-write/spec-E3-S3.md`
- `specs/epic-3/story-3-eval-skill-scoring-write/plan-E3-S3.md`
- `specs/epic-3/story-3-eval-skill-scoring-write/tasks-E3-S3.md`
- `specs/epic-3/story-3-eval-skill-scoring-write/IMPLEMENTATION_GAPS-E3-S3.md`

**更新规则**：将各文件中出现的 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`（或数字格式 `3-N-*/`）替换为 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`

**验收**：
```powershell
Get-ChildItem -Path "specs\epic-3" -Recurse -Filter "*.md" | Select-String -Pattern "_bmad-output/implementation-artifacts/[0-9]"
# 应无结果（旧数字格式路径已替换）
```

---

#### T-SPEC-02：更新 specs/epic-4/ 和 specs/epic-5/ 下含旧路径的活跃 spec 文件【审计 Round3 GAP-R3-3 高优先级】

**背景**：T-FS-04/05 执行后，epic-4/5 下的 story 目录将移至新层级结构，但 spec 文件内部仍引用旧数字格式路径（如 `4-1-eval-veto-iteration-rules/`），形成**立即断链**。

**涉及文件**（已 grep 确认，共 5 个含旧路径的活跃 spec 文件）：
- `specs/epic-4/story-1-eval-veto-iteration-rules/tasks-E4-S1.md`（或含 `4-1-` 路径的 plan/spec）
- `specs/epic-5/story-2-eval-scoring-rules-expansion/tasks-E5-S2.md`（或含 `5-2-` 路径的文件）
- `specs/epic-5/story-3-eval-parser-llm-fallback/`（含 `5-3-` 路径的文件）
- `specs/epic-5/story-4-eval-analytics-clustering/`（含 `5-4-` 路径的文件）
- `specs/epic-5/story-5-eval-analytics-advanced/`（含 `5-5-` 路径的文件）

**更新规则**：将所有数字格式路径 `N-N-slug/` 替换为对应的新层级路径 `epic-N-slug/story-N-slug/`，具体映射见 §8 迁移映射表。

**验收**：
```powershell
Get-ChildItem -Path "specs\epic-4","specs\epic-5" -Recurse -Filter "*.md" | Select-String -Pattern "_bmad-output/implementation-artifacts/[0-9]"
# 应无结果
```

---

### §8 任务执行顺序与依赖关系【Party-Mode 新增 GAP-6 关联】

所有 §8 任务必须**按以下顺序执行**，存在依赖：

```
T-FS-01~06（物理目录迁移）
    ↓ 迁移完成后
T-SCRIPT-01（脚本适配新结构）      ←  T-FS-01~06 必须先完成
T-CMD-01（commands 路径约定）      ←  可与 T-SCRIPT-01 并行（高优先级）
T-CONFIG-01（YAML 报告路径更新）   ←  可与 T-SCRIPT-01 并行【阻断级，必须执行】
T-RULE-01（规则文件路径约定）      ←  可与 T-SCRIPT-01 并行
T-SKILL-01~04（全局 SKILL 路径更新）←  可与 T-SCRIPT-01 并行
T-SKILL-LOCAL-01（本地 SKILL 副本）←  必须与 T-SKILL-01~04 同步执行
T-MIGRATE-01（迁移脚本更新）      ←  可与 T-SKILL 并行
T-DOCS-01（安装指南更新）          ←  T-MIGRATE-01 完成后
T-DOCS-02（scoring README 更新）   ←  可与 T-DOCS-01 并行
T-SPEC-01（specs/epic-3/ 更新）    ←  可与 T-DOCS 并行
T-SPEC-02（specs/epic-4~5/ 更新）  ←  须在 T-FS-04/05 之前或同步执行（防止断链）
```

---

### §8 任务执行说明【GAP-6：git mv 要求说明】

**T-FS-01~06 必须使用 `git mv` 而非 `Move-Item`**，否则 git 将识别为"删除+新增"，丢失 audit 报告、Story 文档等文件的 git 历史（blame、log）。

每个 T-FS-01~06 任务体中已包含完整的 `git mv` 命令（见各任务正文），无需"以此类推"自行构造。

前置条件检查（在执行任何 T-FS 任务前运行）：
```powershell
Set-Location "d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts"
git status  # 确认工作区干净（无未提交变更）
```

---

### §8 T-SKILL-01 细化：三类替换模式【Party-Mode 新增 GAP-3/GAP-4】

**文件**：`C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`（第 97、112、132、139、140、262–268、495、508、551、553、721、724、805、823、828、1398 行）

将所有路径引用按以下三种模式分类处理：

**模式 A（占位符模式，适用大多数行）**：
```
# 修改前
`_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`
`_bmad-output/implementation-artifacts/{epic_num}-{story_num}-<slug>/`
`_bmad-output/implementation-artifacts/{epic_num}-{story_num}-*/`
`_bmad-output/implementation-artifacts/{X}-{Y}-*/`

# 修改后
`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`
`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/`
`_bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{epic_num}-{story_num}-*/`
`_bmad-output/implementation-artifacts/epic-{X}-*/story-{X}-{Y}-*/`
```

**模式 B（具体示例行，第139、140、112行）**：
```
# 修改前（第 112 行）
`_bmad-output/implementation-artifacts/4-1-<slug>/4-1-<slug>.md`
# 修改后
`_bmad-output/implementation-artifacts/epic-4-*/story-4-1-<slug>/4-1-<slug>.md`

# 修改前（第 139 行）
Story 文档路径：`_bmad-output/implementation-artifacts/4-1-*/4-1-*.md`
# 修改后
Story 文档路径：`_bmad-output/implementation-artifacts/epic-4-*/story-4-1-*/*.md`

# 修改前（第 140 行）
TASKS 文档路径：（如 `_bmad-output/implementation-artifacts/4-1-*/TASKS_4-1-*.md`）
# 修改后
TASKS 文档路径：（如 `_bmad-output/implementation-artifacts/epic-4-*/story-4-1-*/TASKS_4-1-*.md`）
```

**模式 C（EXCLUDED_TESTS 路径，第 97 行）**：
```
# 修改前
`_bmad-output/implementation-artifacts/EXCLUDED_TESTS_{epic_num}-{story_num}.md`
# 修改后（EXCLUDED_TESTS 归入 story 子目录）
`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/EXCLUDED_TESTS_{epic_num}-{story_num}.md`
```

---

### §8 T-SCRIPT-01 更新（代码片段锚定）【Party-Mode 改进 GAP-5】

**文件**：`_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`

**定位方式**（代码片段锚定，而非行号）：找到 `# Sync create _bmad-output subdir` 注释及其后的 `$storySubdirName` 赋值代码块。

**修改前**：
```powershell
# Sync create _bmad-output subdir (same name as spec)
$bmadOutputBase = Join-Path $repoRoot "_bmad-output"
$implArtifacts = Join-Path $bmadOutputBase "implementation-artifacts"
$storySubdirName = "$Epic-$Story-$Slug"
$storySubdir = Join-Path $implArtifacts $storySubdirName
if (-not (Test-Path $storySubdir)) {
    New-Item -ItemType Directory -Path $storySubdir -Force | Out-Null
    Write-Host "[create-new-feature] Created _bmad-output subdir: $storySubdir"
}
```

**修改后**：
```powershell
# Sync create _bmad-output subdir (层级结构: epic-{N}-{slug}/story-{N}-{slug}/)
$bmadOutputBase = Join-Path $repoRoot "_bmad-output"
$implArtifacts = Join-Path $bmadOutputBase "implementation-artifacts"
$epicArtifactsDir = Join-Path $implArtifacts $epicDirName   # 复用已推导的 $epicDirName（含 slug）
$storySubdirName  = "story-$Story-$Slug"
$storySubdir = Join-Path $epicArtifactsDir $storySubdirName
if (-not (Test-Path $storySubdir)) {
    New-Item -ItemType Directory -Path $storySubdir -Force | Out-Null
    Write-Host "[create-new-feature] Created _bmad-output subdir: $storySubdir"
}
```

> **说明**：`$epicDirName` 由 `Get-EpicDirName` 函数推导，该函数从 `specs/` 目录结构读取现有 `epic-{N}-{slug}/` 名称，已能正确产生带 slug 的目录名，直接复用即可。（旧注释中"已在 T2 修复正则后"为历史误导性文字，已删除。）

**TDD 步骤**【GAP-P 修正：PowerShell 脚本修改须含 TDD-RED/GREEN/REFACTOR】：

```
[TDD-RED]  T-SCRIPT-01：修改前调用脚本：.\create-new-feature.ps1 -ModeBmad -Epic 99 -Story 1 -Slug test-slug
           确认创建的是旧格式目录 _bmad-output/implementation-artifacts/99-1-test-slug/（红灯）
[TDD-GREEN] T-SCRIPT-01：修改后调用脚本：.\create-new-feature.ps1 -ModeBmad -Epic 99 -Story 1 -Slug test-slug
           确认创建的是 epic-99-*/story-1-test-slug/（绿灯），然后删除测试目录
[TDD-REFACTOR] T-SCRIPT-01：脚本逻辑清晰，$epicDirName 复用合理，无需重构 ✓
```

**验收命令**：
```powershell
# 在 project root 运行
._bmad\scripts\bmad-speckit\powershell\create-new-feature.ps1 -ModeBmad -Epic 99 -Story 1 -Slug test-slug -DryRun
# 确认输出路径包含 epic-99-* / story-1-test-slug
```
