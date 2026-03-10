# BUGFIX：speckit 执行 tasks 后生成 prd/progress 且未按 ralph 节奏更新

**日期**：2026-03-04  
**发现场景**：用户执行 speckit.implement 或 bmad Dev Story 后检查 prd/progress 产出  
**文档路径**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_speckit-ralph-prd-progress-timing.md`

---

## §1 现象/问题描述

### 1.1 现象

- **预期**（speckit-workflow §5.1、ralph-method）：执行 tasks 前创建 prd 与 progress；每完成一个 US 立即更新 prd（passes=true）与 progress（带时间戳 story log）。
- **实际**：prd/progress 在 tasks 执行**之后**才生成；仅作「生成后就一次性更新」，未按 ralph 的「每 US 完成即更新」节奏执行。

### 1.2 复现路径

1. 执行 `/speckit.implement` 或 bmad-story-assistant 的 Dev Story 实施；
2. 观察 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` 或 spec 目录；
3. 结果：prd、progress 在全部任务完成后才出现；progress 内容为批量 TDD 记录，无「每 US 完成即追加」的时间戳 story log。

### 1.3 证据示例

`progress.E2-S1.txt` 格式：T1–T6 的 TDD 记录一次性汇总，无逐 US 完成的增量更新；`prd.E2-S1.json` 中所有 `passes: true` 为事后批注。

---

## §2 根因分析

### 2.1 根因结论

**双轨执行 + 入口缺位 + 节奏未强制**：`commands/speckit.implement.md` 是 `/speckit.implement` 的实际入口，完全不含 prd/progress/ralph-method 相关步骤；speckit-workflow SKILL §5.1 虽有 ralph 强制前置，但 implement 命令执行时可能不加载该技能；prompt 未强制「每 US 完成即更新」的节奏，导致事后批注式更新。

### 2.2 根因链条

| 层级 | 问题 | 后果 |
|------|------|------|
| commands/speckit.implement.md | 步骤 1–9 中**无** prd/progress 创建、无 ralph 引用 | 执行 implement 时不会在任务前创建追踪文件 |
| commands/speckit.implement.md | step 8 的 "Report progress" 仅指 tasks.md 的 `[X]` 标记 | 与 ralph progress.txt 的 per-US 更新无关 |
| 执行入口优先级 | implement 命令独立于 speckit-workflow 技能加载 | 即使 SKILL 有 ralph 前置，命令文件未引用，易被忽略 |
| 子 Agent / 用户路径 | 可能仅执行 commands 文件，不加载 speckit-workflow | prd/progress 由事后补写或子 agent 自行推断生成 |
| ralph 节奏未编码 | 无 prompt 要求「每完成 US 即更新 prd + progress」 | 实施者倾向于批量更新，符合「生成后就更新」表象 |

### 2.3 双轨流程证据

| 来源 | 内容 | prd/progress 处理 |
|------|------|-------------------|
| speckit-workflow SKILL.md §5.1 | 步骤 2：【ralph-method 强制前置】创建 prd 与 progress | 执行前创建，但依赖技能加载 |
| commands/speckit.implement.md | 步骤 1–9：check-prerequisites → checklists → load context → parse tasks → execute | **无** prd/progress 相关步骤 |

### 2.4 ralph-method 节奏未被遵守的原因

1. **流程未规定**：commands/speckit.implement.md 未要求 per-US 更新；
2. **子 Agent 未加载**：执行 implement 时若只读 commands 文件，不会看到 speckit-workflow 的 TDD 记录格式与 ralph 更新要求；
3. **prompt 未强制**：audit-prompts §5 虽检查 prd/progress 存在与更新，但为**事后审计**；执行阶段 prompt 未在「每完成一任务」时显式触发更新动作。

### 2.5 与既有文档的衔接与遗漏

| 文档 | 已覆盖 | 遗漏 |
|------|--------|------|
| BUGFIX_ralph-method-missing-in-dev-story-flow | speckit-workflow §5.1、audit-prompts §5、bmad-story-assistant | **未触及** commands/speckit.implement.md |
| IMPROVEMENT_ANALYSIS_DevStory流程偏差 | 根因 3 时序未绑定、根因 5 子任务未强制加载 speckit-workflow | **未识别** implement 命令与 SKILL 的双轨冲突 |

---

## §3 依据/参考

| 依据 | 路径 / 引用 |
|------|-------------|
| speckit-workflow §5.1 | 步骤 2【ralph-method 强制前置】创建 prd 与 progress；TDD红绿灯记录格式要求更新 prd/progress |
| commands/speckit.implement.md | 步骤 1–9，无 prd/progress/ralph 提及 |
| ralph-method SKILL | Rule 1–4：执行前创建；每 US 完成更新 prd（passes=true）、progress（时间戳 story log） |
| audit-prompts.md §5 | 审计项（4）：prd/progress 存在且每 US 有更新 |
| BUGFIX_ralph-method-missing-in-dev-story-flow | §2.2 根因链条；§4.2.1 已修改 speckit-workflow §5.1 |
| IMPROVEMENT_ANALYSIS_DevStory流程偏差 | 根因 3 ralph 与 speckit 时序未绑定；根因 5 子任务未强制加载 speckit-workflow |
| party-mode 根因辩论 | 100 轮，批判审计员 >60%，聚焦双轨、时机、节奏、衔接；最后 3 轮无新 gap 收敛 |

---

## §4 修复方案

### 4.1 方案概述

在 `commands/speckit.implement.md` 中显式嵌入 ralph-method 强制前置与 per-US 更新节奏；建立 implement 命令与 speckit-workflow §5.1 的引用关系；确保无论通过命令或技能执行，prd/progress 的创建时机与更新节奏一致。

### 4.2 具体修改

#### 4.2.1 commands/speckit.implement.md

**修改位置**：在步骤 3「Load and analyze」之后、步骤 5「Parse tasks.md」之前，**新增强制前置步骤**；在步骤 6「Execute implementation」中**加入 per-US 更新要求**。

**新增步骤（插入为步骤 3.5，原步骤顺延）**：

```markdown
3.5. **【ralph-method 强制前置】创建 prd 与 progress 追踪文件**：
   - 若 FEATURE_DIR 或 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` 下不存在 `prd.{stem}.json` 与 `progress.{stem}.txt`，**必须**在开始执行任何任务前创建；
   - stem 为 tasks 文档 stem（如 tasks-E2-S1.md → `E2-S1` 或 `tasks-E2-S1`；无 BMAD 上下文时用 tasks 文件名 stem）；
   - prd 结构须符合 ralph-method schema，将 tasks 中的可验收任务映射为 US-001、US-002…；
   - 产出路径：与 tasks 同目录，或 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`（BMAD 流程时）；
   - **禁止**在未创建上述文件前开始编码或执行涉及生产代码的任务。
   - 参考：speckit-workflow SKILL §5.1、ralph-method SKILL Mandatory Execution Rules。
```

**修改步骤 6（Execute implementation）**：在 "Phase-by-phase execution" 与 "Validation checkpoints" 之间，**新增**：

```markdown
   - **Per-US tracking**：每完成一个可验收任务（对应 prd 中的一个 US），**必须立即**：
     1. 更新 prd：将对应 userStory 的 `passes` 设为 `true`；
     2. 更新 progress：追加一行带时间戳的 story log，格式 `[YYYY-MM-DD HH:MM] US-XXX: <title> - PASSED`；
     3. 禁止在全部任务完成后才批量更新 prd/progress。
```

**修改步骤 8（Progress tracking）**：将 "Report progress after each completed task" 扩展为：

```markdown
   - Report progress: 在 tasks.md 中标记 `[X]`；**同时**按 ralph-method 更新 prd（passes=true）与 progress（追加 story log）。
```

#### 4.2.2 commands/speckit.implement.md 头部引用

在文件 frontmatter 或 Outline 之后增加：

```markdown
**RALPH-METHOD 与 SPECKIT-WORKFLOW**：本命令执行 implement 时，须与 speckit-workflow SKILL §5.1 及 ralph-method SKILL 的 Mandatory Execution Rules 保持一致。若两者冲突，以 ralph-method 的「执行前创建」「每 US 完成即更新」为准。
```

#### 4.2.3 bmad-story-assistant 子任务 prompt 强化

在 STORY-A3-DEV 或等效实施子任务 prompt 中，**显式要求**：执行 implement 时，子 Agent 必须加载 speckit-workflow 与 ralph-method 技能，或至少遵守 commands/speckit.implement.md 中嵌入的 ralph 步骤；不得仅凭「执行 tasks」的泛化理解而跳过 prd/progress 创建与 per-US 更新。

#### 4.2.4 audit-prompts §5 执行阶段指引

在 audit-prompts.md §5 审计提示词**之前**，增加执行阶段指引（或通过 references 链接）：

```markdown
**执行阶段必须遵守**：在开始执行 tasks 前创建 prd/progress；每完成一个 US 立即更新。详见 speckit-workflow §5.1、commands/speckit.implement.md 步骤 3.5 与 6。
```

---

## §5 流程/建议流程

| 阶段 | 动作 | 产出 |
|------|------|------|
| 执行前 | 读取 tasks.md，解析 stem | stem 确定 |
| 执行前 | 检查 prd.{stem}.json、progress.{stem}.txt 是否存在 | 不存在则创建 |
| 执行前 | 按 tasks 映射生成 prd userStories | prd 初版 |
| 执行中 | 每完成一 US | 立即更新 prd passes、progress story log |
| 执行后 | 运行 audit-prompts §5 | 验证 prd/progress 存在且按 US 更新 |

**禁止**：在未创建 prd/progress 前开始编码；在全部任务完成后再批量更新 prd/progress。

---

## §7 最终任务列表

| 任务 ID | 修改路径 | 修改内容摘要 | 验收标准 |
|---------|----------|--------------|----------|
| T1 | `commands/speckit.implement.md` | 在步骤 3 之后插入步骤 3.5：ralph-method 强制前置（创建 prd/progress） | 执行 implement 前可读到创建要求 |
| T2 | `commands/speckit.implement.md` | 步骤 6 增加 Per-US tracking：每完成 US 立即更新 prd 与 progress | 禁止批量更新 |
| T3 | `commands/speckit.implement.md` | 步骤 8 将 progress 扩展为 tasks [X] + prd/progress 同步更新 | 双轨进度一致 |
| T4 | `commands/speckit.implement.md` | 头部增加 ralph-method 与 speckit-workflow 引用说明 | 与 SKILL 对齐 |
| T5 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | STORY-A3-DEV 中显式要求 implement 时遵守 ralph 步骤或加载 speckit-workflow | 子任务不跳过 |
| T6 | `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts.md` | §5 前增加执行阶段指引（prd/progress 创建与 per-US 更新） | 执行者有明确指引 |
| T7 | 回归验证 | 执行 Dev Story 或 speckit.implement，检查 prd/progress 在任务前创建且 per-US 更新 | 符合预期行为 |

---

## 附录：party-mode 根因辩论摘要

**执行约束**：100 轮，批判审计员发言占比 >60%，最后 3 轮无新 gap 收敛。

### 角色设定

- **批判审计员**：每轮提出质疑、gap、反证；>61 轮发言
- **Winston 架构师**：流程与架构
- **Amelia 开发**：实施视角
- **John 产品经理**：需求与验收

### 关键轮次（代表性）

**R1–R10 双轨与入口**
- 批判审计员：commands/speckit.implement.md 与 speckit-workflow §5.1 哪个被实际执行？implement 命令是否引用 ralph？
- Winston：两套流程并存，命令文件为入口时可能不加载 SKILL。
- Amelia：检查 commands 全文，无 prd/progress 步骤。
- 批判审计员：若用户直接运行 /speckit.implement，会走 commands 还是 SKILL？

**R11–R25 创建时机**
- 批判审计员：「执行后生成」的触发路径是什么？谁在何时创建 prd/progress？
- Amelia：可能是子 agent 完成全部任务后，作为交付物一次性生成。
- 批判审计员：BUGFIX_ralph-method-missing 已改 speckit-workflow §5.1，为什么仍出现执行后生成？
- Winston：该 BUGFIX 未修改 commands/speckit.implement.md，入口缺位未修复。

**R26–R45 ralph 节奏**
- 批判审计员：「每 US 完成即更新」未被遵守：流程未规定、子 agent 未加载、还是 prompt 未强制？
- Amelia：commands step 8 只要求 "Report progress"，指 tasks [X]，非 ralph progress。
- 批判审计员：audit-prompts §5 有检查，但是事后审计；执行时 prompt 有无 per-US 更新指令？
- John：用户期望是可追溯的增量进度，批注式更新无法满足。

**R46–R70 衔接与遗漏**
- 批判审计员：与 BUGFIX_ralph-method-missing、IMPROVEMENT_ANALYSIS 的衔接点与遗漏？
- Winston：BUGFIX 改 SKILL 与 audit，未改 commands；IMPROVEMENT 根因 5 指出子任务未强制加载 speckit-workflow，与 implement 入口缺位一致。
- 批判审计员：若 commands 与 SKILL 冲突，谁优先？应明确 implement 命令须内嵌或引用 ralph 步骤。

**R71–R97 修复方案收敛**
- 批判审计员：修复必须触及 commands，否则 SKILL 修改无效。
- Amelia：commands 步骤 3 后插入 ralph 前置；步骤 6 加入 per-US 更新；步骤 8 扩展 progress 含义。
- Winston：建立 commands 与 speckit-workflow 的引用，保证双轨一致。
- John：验收标准须可验证：执行前 prd/progress 存在，progress 含逐 US 时间戳。

**R98–R100 收敛（无新 gap）**
- 批判审计员：对当前修复方案无新 gap；须确保 bmad-story-assistant 子任务也遵守。
- Winston：在 STORY-A3-DEV 中显式要求 implement 遵守 ralph 步骤。
- 批判审计员：终审：有条件同意，条件为 T1–T7 全部落地；未发现新遗漏。
