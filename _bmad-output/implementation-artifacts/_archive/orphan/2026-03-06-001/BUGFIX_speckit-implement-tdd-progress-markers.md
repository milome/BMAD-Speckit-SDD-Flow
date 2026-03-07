# BUGFIX：speckit 执行 tasks 时 progress 缺少 TDD-RED/GREEN/REFACTOR 记录

**日期**：2026-03-04  
**发现场景**：用户执行 speckit.implement 或 bmad Dev Story 后，progress 仅有 story log，无 [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] 记录  
**文档路径**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_speckit-implement-tdd-progress-markers.md`

---

## §1 现象/问题描述

### 1.1 现象

- **预期**（speckit-workflow §5.1、bmad-story-assistant §3.3、tasks 文件 Agent 规则）：执行 tasks 时按 TDD 红灯-绿灯-重构循环推进；每完成涉及生产代码的任务，在 progress 中**必须**追加 `[TDD-RED]`、`[TDD-GREEN]`、`[TDD-REFACTOR]` 记录（speckit-workflow 禁止省略重构阶段）。
- **实际**：progress 仅有 `[YYYY-MM-DD HH:MM] US-XXX: <title> - PASSED` 格式的 story log，无 TDD 周期标记；TDD 红绿灯约束未被强制执行。

### 1.2 复现路径

1. 执行 `/speckit.implement` 或 bmad-story-assistant 的 Dev Story 实施；
2. 观察 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/progress.{stem}.txt`；
3. 结果：progress 仅有 story log 行，无 `[TDD-RED]`、`[TDD-GREEN]`、`[TDD-REFACTOR]` 任何一行。

### 1.3 证据示例

- `progress.3-3-eval-skill-scoring-write.txt`：仅有 `[2026-03-04 19:02] US-001: ... - PASSED` 等 story log，无 TDD 标记。
- `AUDIT_REPORT_Story3.3_实施后_§5_2026-03-04.md` 第 135 行：明确记录「progress 无显式 [TDD-RED]/[TDD-GREEN]」，判定为轻微偏差。

---

## §2 根因分析

### 2.1 根因结论

**入口缺位 + 格式未嵌入**：`commands/speckit.implement.md` 是 `/speckit.implement` 的实际入口，其 Per-US tracking 与 Progress tracking 仅规定 story log 格式（`[YYYY-MM-DD HH:MM] US-XXX: <title> - PASSED`），**完全未提及** `[TDD-RED]`、`[TDD-GREEN]`、`[TDD-REFACTOR]`；执行 implement 时若仅加载 commands 而不加载 speckit-workflow / bmad-story-assistant，则不会在 progress 中写入 TDD 标记。

### 2.2 根因链条

| 层级 | 问题 | 后果 |
|------|------|------|
| commands/speckit.implement.md | 步骤 6、8 仅规定 story log 格式 | 无 TDD marker 格式要求 |
| commands/speckit.implement.md | 全文无 [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] 提及 | 执行者不知道需写入 |
| 执行路径 | implement 命令可能独立于 speckit-workflow 技能加载 | 即使 SKILL 有 TDD 格式，命令未引用，易被忽略 |
| BUGFIX_speckit-ralph-prd-progress-timing | 已修复 prd/progress 创建与 per-US 节奏，但未修复 progress 的 TDD 格式 | 故事 log 有，TDD 标记仍缺失 |

### 2.3 与 speckit-workflow / bmad-story-assistant 的脱节

| 来源 | TDD 格式要求 | commands 是否引用 |
|------|--------------|-------------------|
| speckit-workflow §5.1.1 | [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 必填；禁止省略重构阶段 | 否 |
| bmad-story-assistant §3.3 | 每完成涉及生产代码的任务，progress 追加 [TDD-RED] 与 [TDD-GREEN] | 否 |
| tasks 文件（如 tasks-E3-S3.md）| 每完成涉及生产代码的任务，progress 中追加 [TDD-RED] 与 [TDD-GREEN] 记录 | 否（commands 不读 tasks 的 Agent 规则）|

### 2.4 业界最佳实践

TDD 红-绿-重构为完整三阶段循环（Kent Beck、Martin Fowler）；refactor 阶段为**必做**，非「如有重构」可选。若实现已符合最佳实践，可记录为 `[TDD-REFACTOR] TX 无重构（已符合最佳实践）`，但不得跳过该阶段。

---

## §3 依据/参考

| 依据 | 路径 / 引用 |
|------|-------------|
| speckit-workflow §5.1 | TDD 红绿灯循环；§5.1.1 禁止省略重构阶段 |
| speckit-workflow §5.1.1 | 必填字段：[TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] |
| speckit-workflow references/task-execution-tdd.md | 重构至符合最佳实践后方可结束，不得跳过重构 |
| bmad-story-assistant §3.3 | STORY-A3-DEV 要求 progress 追加 [TDD-RED] 与 [TDD-GREEN] |
| commands/speckit.implement.md | 步骤 6、8 仅规定 story log，无 TDD 格式 |
| tasks-E3-S3.md 第 23 行 | 每完成涉及生产代码的任务，progress 中追加 [TDD-RED] 与 [TDD-GREEN] 记录 |
| BUGFIX_speckit-ralph-prd-progress-timing | 已嵌入 prd/progress 创建与 per-US 更新，未嵌入 TDD 格式 |

---

## §4 修复方案

### 4.1 方案概述

在 `commands/speckit.implement.md` 的 Per-US tracking 与 Progress tracking 中显式嵌入 TDD marker 格式要求；将 progress 更新扩展为「story log + TDD 三行」（RED、GREEN、REFACTOR 均必填）；与 speckit-workflow §5.1.1、bmad-story-assistant §3.3 对齐。

### 4.2 具体修改

#### 4.2.1 commands/speckit.implement.md 步骤 6（Per-US tracking）

**修改位置**：步骤 6 中的「更新 progress」部分。

**当前**：
```
2. 更新 progress：追加一行带时间戳的 story log，格式 `[YYYY-MM-DD HH:MM] US-XXX: <title> - PASSED`；
```

**修改为**：
```
2. 更新 progress：必须同时追加以下内容：
   - story log：`[YYYY-MM-DD HH:MM] US-XXX: <title> - PASSED`；
   - TDD 记录（涉及生产代码的任务必填，三行缺一不可）：
     - `[TDD-RED] <任务ID> <验收命令> => N failed`（红灯：测试先失败）
     - `[TDD-GREEN] <任务ID> <验收命令> => N passed`（绿灯：实现后通过）
     - `[TDD-REFACTOR] <任务ID> [重构操作描述]`（必填：有重构则写具体操作；无则写「无重构（已符合最佳实践）」）
   参考：speckit-workflow SKILL §5.1.1、task-execution-tdd.md；禁止省略 REFACTOR 阶段。
```

#### 4.2.2 commands/speckit.implement.md 步骤 8（Progress tracking）

**当前**：
```
   - Report progress: 在 tasks.md 中标记 `[X]`；**同时**按 ralph-method 更新 prd（passes=true）与 progress（追加 story log）。
```

**修改为**：
```
   - Report progress: 在 tasks.md 中标记 `[X]`；**同时**按 ralph-method 更新 prd（passes=true）与 progress（追加 story log + TDD 三行记录，格式见步骤 6）。
```

#### 4.2.3 头部引用增强

**当前**（第 5-6 行）：
```
**RALPH-METHOD 与 SPECKIT-WORKFLOW**：本命令执行 implement 时，须与 speckit-workflow SKILL §5.1 及 ralph-method SKILL 的 Mandatory Execution Rules 保持一致。若两者冲突，以 ralph-method 的「执行前创建」「每 US 完成即更新」为准。
```

**修改为**：
```
**RALPH-METHOD 与 SPECKIT-WORKFLOW**：本命令执行 implement 时，须与 speckit-workflow SKILL §5.1 及 ralph-method SKILL 的 Mandatory Execution Rules 保持一致。若两者冲突，以 ralph-method 的「执行前创建」「每 US 完成即更新」为准。**TDD 红绿灯**：progress 必须包含每任务的 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录，禁止省略；详见 speckit-workflow §5.1.1。
```

#### 4.2.4 audit-prompts §5 专项补充（必做）

在 audit-prompts.md §5 的专项审查第 (4) 项中，将「progress 中带时间戳的 story log」扩展为「progress 中带时间戳的 story log，且涉及生产代码的任务须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行」。否则实施后 §5 审计无法验证 progress 是否含 TDD 标记，修复与验证闭环不完整。

---

## §5 流程/建议流程

| 阶段 | 动作 | 产出 |
|------|------|------|
| 红灯 | 编写/补充测试，运行确认失败 | progress 追加 [TDD-RED] |
| 绿灯 | 最小实现，运行确认通过 | progress 追加 [TDD-GREEN] |
| 重构 | 在测试保护下优化至最佳实践；若无改动则记录「无重构（已符合最佳实践）」 | progress 追加 [TDD-REFACTOR] |
| 完成 US | 更新 prd passes、story log、TDD 三行 | 可追溯的完整 TDD 周期 |

**禁止**：跳过红灯直接绿灯；省略 REFACTOR 阶段；用「最终回归通过」替代逐任务 TDD 记录。

---

## §6 验收标准

| AC | 描述 | 验证方式 |
|----|------|----------|
| AC-1 | commands 步骤 6 含 TDD 三行格式要求 | grep "TDD-RED\|TDD-GREEN\|TDD-REFACTOR" commands/speckit.implement.md |
| AC-2 | commands 步骤 8 引用 TDD 格式 | grep "TDD" commands/speckit.implement.md 步骤 8 |
| AC-3 | 头部含 TDD 红绿灯引用 | grep "TDD" commands/speckit.implement.md 前 10 行 |
| AC-4 | 实施后 progress 含每任务 TDD 三行 | 执行 implement，grep -E "\[TDD-(RED|GREEN|REFACTOR)\]" progress.*.txt |

---

## §7 最终任务列表

| 任务 ID | 修改路径 | 修改内容摘要 | 验收标准 |
|---------|----------|--------------|----------|
| T1 | `commands/speckit.implement.md` | 步骤 6「更新 progress」扩展为 story log + TDD 三行（RED/GREEN/REFACTOR 必填） | AC-1 |
| T2 | `commands/speckit.implement.md` | 步骤 8 Report progress 引用 TDD 格式 | AC-2 |
| T3 | `commands/speckit.implement.md` | 头部增加 TDD 红绿灯引用 | AC-3 |
| T4 | `skills/speckit-workflow/references/audit-prompts.md` | §5 第 (4) 项扩展为含 TDD 标记检查（必做） | grep audit-prompts.md 含 TDD 相关检查表述；§5 审计时检查 progress 含 TDD |
| T5 | 回归验证 | 执行 implement，检查 progress 含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] | AC-4 |
