# BUGFIX：Dev Story 执行流程未纳入 ralph-method 强制约束

**日期**：2026-03-04  
**发现场景**：Dev Story 1.1（specify → plan → gaps → tasks → implement）执行后  
**文档路径**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_ralph-method-missing-in-dev-story-flow.md`

---

## §1 问题描述

### 1.1 现象

Dev Story 1.1（eval-system-scoring-core）完整执行 specify → plan → gaps → tasks → implement 后，`_bmad-output/implementation-artifacts/1-1-eval-system-scoring-core/` 目录下**未生成** ralph-method 要求的追踪文件：

- 缺失：`prd.json` 或 `prd.tasks-E1-S1.json`（及等价命名）
- 缺失：`progress.txt` 或 `progress.tasks-E1-S1.txt`（及等价命名）

### 1.2 复现步骤

1. 使用 bmad-story-assistant 执行 Dev Story 1.1（或直接执行 speckit-workflow 的 specify → plan → GAPS → tasks → implement）
2. 执行完成后检查 `_bmad-output/implementation-artifacts/1-1-eval-system-scoring-core/` 目录
3. 结果：仅有 Story 文档 `1-1-eval-system-scoring-core.md`，无 prd、progress 文件

### 1.3 预期行为

按 ralph-method 技能 Mandatory Execution Rules：

- 实施开始前**必须**创建 `prd.json` 与 `progress.txt`（或按参考文档命名的 `prd.{stem}.json`、`progress.{stem}.txt`）
- 不得在未创建上述文件前开始编码
- 每完成一个 user story 必须更新 prd（passes=true）、progress（追加 story log）

---

## §2 根因分析

### 2.1 根因结论

**流程衔接缺失**：speckit-workflow 的 §5 执行流程与 bmad-story-assistant 的 Dev Story 流程中，均未将「执行前必须创建 prd.json 和 progress.txt」作为**强制前置步骤**显式嵌入；ralph-method 技能未被流程**显式调用**；审计环节未检查 prd/progress 存在性，导致漏掉时无法被发现。

### 2.2 根因链条

| 层级 | 问题 | 后果 |
|------|------|------|
| speckit-workflow | §5.1 执行流程未包含「执行前创建 prd/progress」步骤 | 流程本身不要求 ralph-method |
| speckit-workflow | 未显式调用 ralph-method 技能 | ralph-method 不会被自动触发 |
| bmad-story-assistant | STORY-A3-DEV 模板仅要求「读取并遵守 ralph-method」 | 依赖子代理自主性，易被忽略 |
| audit-prompts | §5 未检查 prd/progress 存在性 | 漏掉时无法通过审计发现 |

### 2.3 证据与引用

1. **speckit-workflow SKILL.md §5.1 执行流程**（第 257–266 行）：
   - 步骤 1：读取 tasks.md
   - 步骤 2：阅读前置文档
   - 步骤 3：使用 TodoWrite 创建任务追踪
   - 步骤 4：逐任务执行 TDD 循环
   - **无**「执行前创建 prd.json 和 progress.txt」步骤

2. **ralph-method SKILL.md Mandatory Execution Rules**（第 35–39 行）：
   - Rule 1：Before implementation starts, you MUST create both tracking files.
   - Rule 2：You MUST NOT begin coding any user story until both files exist.

3. **bmad-story-assistant SKILL.md STORY-A3-DEV 模板**（第 804 行）：
   - 仅写「请读取 ralph-method 技能与 speckit-workflow 技能，严格按照其规则执行」
   - 未显式列出「执行前必须创建 prd.json 和 progress.txt」

4. **audit-prompts.md §5**：
   - 审计维度含需求覆盖度、测试完整性、代码质量、文档一致性、可追溯性
   - **无** prd/progress 存在性检查项

5. **实际产出验证**：
   - `_bmad-output/implementation-artifacts/1-1-eval-system-scoring-core/` 仅含 `1-1-eval-system-scoring-core.md`
   - 无 `prd*.json`、`progress*.txt`

---

## §3 影响范围

### 3.1 受影响流程

- **bmad-story-assistant** 阶段三 Dev Story 实施（所有 Epic/Story）
- **speckit-workflow** §5 执行 tasks.md 中的任务（standalone 或嵌套于 BMAD）
- **bmad-standalone-tasks** 按 TASKS/BUGFIX 文档实施（已有 ralph-method 内联约束，本 BUG 主要影响 speckit 路径）

### 3.2 受影响技能

| 技能 | 修改必要性 |
|------|------------|
| speckit-workflow | 必须：§5 增加 ralph-method 前置步骤 |
| bmad-story-assistant | 必须：STORY-A3-DEV 显式要求创建 prd/progress |
| speckit-workflow references/audit-prompts.md | 必须：§5 增加 prd/progress 审计项 |

### 3.3 不受影响

- 已有 prd/progress 的 BUGFIX 流程（bmad-bug-assistant、bmad-standalone-tasks 已内联 ralph-method 约束）
- 非 Dev Story 的 Create Story、审计等阶段

---

## §4 修复方案

### 4.1 方案概述

在 speckit-workflow、bmad-story-assistant、audit-prompts 三处显式嵌入 ralph-method 强制约束，使「执行前创建 prd/progress」成为不可跳过的流程步骤，并在审计中验证。

### 4.2 具体修改

#### 4.2.1 speckit-workflow SKILL.md

**修改位置**：§5.1 执行流程（「### 5.1 执行流程」小节）

**修改内容**：在步骤 1「读取 tasks.md」之后、步骤 2「阅读前置文档」之前，**新增强制前置步骤**：

```markdown
1. **读取 tasks.md**（或 tasks-v*.md），识别所有未完成任务（`[ ]` 复选框）。
2. **【ralph-method 强制前置】创建 prd 与 progress 追踪文件**：
   - 若与 tasks 同目录或 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` 下不存在 `prd.{stem}.json` 与 `progress.{stem}.txt`，**必须**在开始执行任何任务前创建；
   - stem 为 tasks 文档 stem（如 tasks-E1-S1 → `tasks-E1-S1`；无 BMAD 上下文时用 tasks 文件名 stem）；
   - prd 结构须符合 ralph-method schema，将 tasks 中的可验收任务映射为 US-001、US-002…（或与 tasks 编号一一对应）；
   - 产出路径：与 tasks 同目录，或 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/`（BMAD 流程时）；
   - **禁止**在未创建上述文件前开始编码或执行涉及生产代码的任务。
3. **阅读前置文档**：需求文档、plan.md、IMPLEMENTATION_GAPS.md，理解技术架构与需求范围。
4. **使用 TodoWrite** 创建任务追踪列表，首个任务标记 `in_progress`。
5. （后续步骤保持不变）
```

**说明**：原步骤 2–7 顺延为步骤 4–9。

#### 4.2.2 bmad-story-assistant SKILL.md

**修改位置**：STORY-A3-DEV 模板（阶段三 Dev Story 实施 prompt）

**修改内容**：在「【强制前置检查】」段之后、「---」分隔线之前，**新增**：

```markdown
  5. 验证 ralph-method 追踪文件已创建或将在执行首步创建
     - 检查路径: _bmad-output/implementation-artifacts/{epic_num}-{story_num}-*/prd.*.json 与 progress.*.txt
     - 若不存在：子代理**必须**在开始执行 tasks 前，根据 tasks-E{epic_num}-S{story_num}.md 生成 prd 与 progress（符合 ralph-method schema），否则不得开始编码。
```

在「**必须遵守**」段中，将「ralph-method」条**显式扩展**为：

```markdown
  - **ralph-method**：执行前**必须**在 `_bmad-output/implementation-artifacts/{epic_num}-{story_num}-{slug}/` 创建 prd.{stem}.json 与 progress.{stem}.txt（stem 为 tasks 文档 stem）；每完成一个 US 必须更新 prd（passes=true）、progress（追加 story log）；按 US 顺序执行。**禁止**在未创建上述文件前开始编码。
```

#### 4.2.3 speckit-workflow references/audit-prompts.md

**修改位置**：§5 执行 tasks.md 中的任务（TDD 红绿灯模式）后审计提示词

**修改内容**：在审计维度中**新增**一项：

```markdown
此外，必须专项审查：（4）是否已创建并维护 ralph-method 追踪文件（prd.json 或 prd.{stem}.json、progress.txt 或 progress.{stem}.txt），且每完成一个 US 有对应更新（prd 中 passes=true、progress 中带时间戳的 story log）；若未创建或未按 US 更新，必须作为未通过项列出。
```

将原（1）（2）（3）保留，新增项编号为（4）。

#### 4.2.4 tasks 与 prd 的映射约定（speckit-workflow）

**修改位置**：speckit-workflow SKILL.md §5 或 references 新增小节

**修改内容**：补充 tasks 与 ralph-method US 的映射规则：

- tasks 使用 T1、T2、T1.1、T1.2 等格式时：可将 T1 映射为 US-001，T1.1–T1.n 作为 US-001 的子任务；或按顶层任务 T1–T5 映射为 US-001–US-005；
- prd 的 userStories 须与 tasks 中的可验收任务一一对应或可追溯；
- 具体映射策略由执行 Agent 在生成 prd 时确定，但须保证 tasks 中每条可验收任务在 prd 中有对应 US 且验收标准一致。

---

## §5 验收标准

### 5.1 流程验收

| AC-ID | 验收标准 | 验证方式 |
|-------|----------|----------|
| AC-1 | speckit-workflow §5.1 执行流程中包含「执行前创建 prd/progress」的强制步骤 | 阅读 speckit-workflow SKILL.md §5.1，确认步骤存在且表述明确 |
| AC-2 | bmad-story-assistant STORY-A3-DEV 模板中显式要求「执行前必须创建 prd 和 progress」 | 阅读 bmad-story-assistant SKILL.md 阶段三模板，确认存在该要求 |
| AC-3 | audit-prompts.md §5 审计提示词包含 prd/progress 存在性与更新检查 | 阅读 audit-prompts.md §5，确认审计维度含 prd/progress 检查 |
| AC-4 | 按修复后流程执行任意 Dev Story，产出目录下存在 prd.*.json 与 progress.*.txt | 执行 Dev Story（或模拟执行），检查 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` 下文件存在 |

### 5.2 回归验收

| AC-ID | 验收标准 | 验证方式 |
|-------|----------|----------|
| AC-5 | 现有 speckit-workflow 其他阶段（specify、plan、GAPS、tasks 生成）行为不变 | 执行 specify→plan→gaps→tasks，确认产出与修改前一致 |
| AC-6 | bmad-story-assistant 阶段一、二、四行为不变 | 执行 Create Story、审计、实施后审计，确认流程无回归 |

### 5.3 文档验收

| AC-ID | 验收标准 | 验证方式 |
|-------|----------|----------|
| AC-7 | 本 BUGFIX 文档 §4 无禁止词（可选、可考虑、后续、待定、酌情、视情况、技术债） | 人工检查 §4 全文 |
| AC-8 | §7 任务列表（若有）每项含修改路径、验收标准，无占位表述 | 人工检查 §7 |

---

## §6 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 子代理仍忽略新增步骤 | 在 STORY-A3-DEV 前置检查中增加「prd/progress 不存在则拒绝执行」的硬性校验 |
| tasks 与 prd 映射歧义 | 在 speckit-workflow 中提供默认映射规则（如 T1→US-001），减少歧义 |
| 历史 Story 无 prd/progress | 本修复仅约束新执行；历史 Story 可选择性补全，不强制回溯 |

---

## §7 任务列表

（待阶段三 party-mode 补充后填入；或由实施时按 §4 逐项执行）

| 任务 ID | 修改路径 | 修改内容摘要 | 验收标准 |
|---------|----------|--------------|----------|
| T1 | `{SKILLS_ROOT}/speckit-workflow/SKILL.md` | §5.1 执行流程新增 ralph-method 强制前置步骤（步骤 2） | AC-1 |
| T2 | `{SKILLS_ROOT}/bmad-story-assistant/SKILL.md` | STORY-A3-DEV 前置检查新增 prd/progress 验证；必须遵守段扩展 ralph-method | AC-2 |
| T3 | `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts.md` | §5 审计提示词新增 prd/progress 检查项 | AC-3 |
| T4 | `{SKILLS_ROOT}/speckit-workflow/SKILL.md` | §5 或 references 新增 tasks 与 prd 映射约定 | 文档完整、可执行 |
| T5 | 回归验证 | 执行 Dev Story 1.1 或等效流程，确认 prd/progress 产出 | AC-4、AC-5、AC-6 |

---

## 附录：参考文档

| 文档 | 路径 |
|------|------|
| ralph-method SKILL | `~/.cursor/skills/ralph-method/SKILL.md` |
| speckit-workflow SKILL | `~/.cursor/skills/speckit-workflow/SKILL.md` |
| bmad-story-assistant SKILL | `~/.cursor/skills/bmad-story-assistant/SKILL.md` |
| audit-prompts | `speckit-workflow/references/audit-prompts.md` |
| 产出路径约定 | `docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md` |
