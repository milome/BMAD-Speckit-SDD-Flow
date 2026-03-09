# Prompt templates for bmad-standalone-tasks

Use these when invoking mcp_task for implementation (generalPurpose) and audit (code-reviewer). Replace `{DOC_PATH}` and any `{…}` placeholders.

---

## Implementation sub-task (generalPurpose)

**前置（必须）**：请先读取并遵循以下技能再执行下方任务：
- **ralph-method**：prd/progress 命名规则与 schema（与当前文档同目录、prd.{stem}.json / progress.{stem}.txt）、每完成一 US 更新 prd 与 progress。
- **speckit-workflow**：TDD 红绿灯、15 条铁律、验收命令、架构忠实；禁止伪实现与占位。
请从当前环境可用的技能中加载 ralph-method、speckit-workflow（若为 Cursor，通常为全局 skills 目录）；若无法定位，则按本 prompt 中已写明的 ralph-method / speckit-workflow 约束执行。

---

```
你正在按 **TASKS/BUGFIX 文档** 执行未完成任务。必须严格遵循以下约束，不得违反。

## 文档与路径
- **TASKS/BUGFIX 文档路径**：{DOC_PATH}
- **任务清单**：{TASK_LIST}（由主 Agent 从文档解析未完成项后填写，示例：§7 T7a-1～T7a-9、§3 T7b-1～T7b-10。）

## 强制约束
1. **ralph-method**：在本文档同目录创建并维护 prd 与 progress 文件（文档为 BUGFIX_xxx.md 时使用 prd.BUGFIX_xxx.json、progress.BUGFIX_xxx.txt）；每完成一个 US 必须更新 prd（对应 passes=true）、progress（追加一条带时间戳的 story log）；按 US 顺序执行。**prd 须符合 ralph-method schema**：涉及生产代码的 US 含 `involvesProductionCode: true` 与 `tddSteps`（RED/GREEN/REFACTOR 三阶段）；仅文档/配置的含 `tddSteps`（DONE 单阶段）。**progress 预填 TDD 槽位**：生成 progress 时，对每个 US 预填 `[TDD-RED] _pending_`、`[TDD-GREEN] _pending_`、`[TDD-REFACTOR] _pending_` 或 `[DONE] _pending_`，涉及生产代码的 US 含三者，仅文档/配置的含 [DONE]；执行时将 `_pending_` 替换为实际结果。
2. **TDD 红绿灯**：每个 US 执行前先写/补测试（红灯）→ 实现使通过（绿灯）→ 重构。**【TDD 红绿灯阻塞约束】** 每个涉及生产代码的任务执行顺序为：① 先写/补测试并运行验收 → 必须得到失败结果（红灯）；② 立即在 progress 追加 [TDD-RED] <任务ID> <验收命令> => N failed；③ 再实现并通过验收 → 得到通过结果（绿灯）；④ 立即在 progress 追加 [TDD-GREEN] <任务ID> <验收命令> => N passed；⑤ **无论是否有重构**，在 progress 追加 [TDD-REFACTOR] <任务ID> <内容>（无具体重构时写「无需重构 ✓」）。禁止在未完成步骤 1–2 之前执行步骤 3。禁止所有任务完成后集中补写 TDD 记录。**交付前自检**：涉及生产代码的每个 US，progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 须在 [TDD-GREEN] 之前；缺任一项则补充后再交付。
3. **speckit-workflow**：禁止伪实现、占位、TODO 式实现；必须运行文档中的验收命令；架构忠实于 BUGFIX/TASKS 文档；禁止在任务描述中添加「将在后续迭代」；禁止标记完成但功能未实际调用。
4. **验收**：每批任务完成后运行文档中给出的 pytest 或验收命令，并将结果写入 progress。

请读取上述路径下的文档，按未完成任务逐项实施，并输出：已完成的 US/任务编号、验收命令运行结果、以及更新后的 prd/progress 状态摘要。
```

#### 无 US 结构时的 prd 生成

当文档仅为扁平任务列表（无 US-001 等 id）时，子代理须：
1. 将文档中每条可验收任务依次标号为 US-001、US-002、…（或与文档已有编号如 T7a-1 一一映射，并在 prd 的 userStories[].id 中使用一致 id）。
2. 生成符合 ralph-method 的 prd.json（含 userStories、acceptanceCriteria、passes、involvesProductionCode、tddSteps 等）。
3. progress 预填 TDD 槽位（[TDD-RED] _pending_、[TDD-GREEN] _pending_、[TDD-REFACTOR] _pending_ 或 [DONE] _pending_）；完成项与 prd 中的 id 一致。
4. 若文档存在 §7 等带编号任务列表，优先采用该编号作为 US id 以保持可追溯。

---

## Resume 实施子任务（generalPurpose）

当 Step 1 子任务未在一次调用内完成时，主 Agent 使用 **mcp_task resume** 或重新发起 mcp_task 时，可传入以下模板（填写断点与本批范围）。

```
你正在**接续**执行 TASKS/BUGFIX 文档的未完成任务。请先读取同目录下的 progress 文件确认已完成范围，再从本批起点开始执行。

## 文档与路径
- **TASKS/BUGFIX 文档路径**：{DOC_PATH}
- **上一批已完成**：{已完成范围，如 §7 T7a-1～T7a-9}
- **本批待执行**：{本批范围，如 §7 T7b-1～T7b-10}

## 强制约束
（与「Implementation sub-task」中 1～4 条相同：ralph-method、TDD 红绿灯、speckit-workflow、验收。）

请从本批待执行的第一项开始，逐项实施并更新 prd/progress，输出：本批已完成的 US/任务编号、验收命令运行结果、以及更新后的 prd/progress 状态摘要。
```

---

## Audit sub-task (code-reviewer, §5 + 批判审计员, 3 轮无 gap)

```
对 **实施完成后的结果** 执行 **audit-prompts §5 执行阶段审计**。必须引入 **批判审计员（Critical Auditor）** 视角，且批判审计员发言占比须 **>70%**。

## 被审对象
- 实施依据文档：{DOC_PATH}
- 实施产物：代码变更、prd、progress、以及文档中要求的验收命令输出

## §5 审计项
1. 任务是否真正实现（无预留/占位/假完成）
2. 生产代码是否在关键路径中被使用
3. 需实现的项是否均有实现与测试/验收覆盖
4. 验收表/验收命令是否已按实际执行并填写
5. 是否遵守 ralph-method（prd/progress 更新、US 顺序）；涉及生产代码的每个 US 是否含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行（[TDD-REFACTOR] 允许写「无需重构 ✓」；[TDD-RED] 须在 [TDD-GREEN] 之前）
6. 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用

## 批判审计员
从对抗视角检查：遗漏任务、行号或路径失效、验收命令未跑、§5/验收误伤或漏网。
**可操作要求**：报告须包含独立段落「## 批判审计员结论」，且该段落字数或条目数不少于报告其余部分的 70%（即占比 >70%）；结论须明确「本轮无新 gap」或「本轮存在 gap」及具体项。若上下文中提供了本轮次序号（如「第 2 轮」），请在结论中注明该轮次。

## 输出与收敛
- 结论须明确：**「完全覆盖、验证通过」** 或 **「未通过」**（并列 gap 与修改建议）。
- **一轮** = 一次本审计子任务的完整调用。「连续 3 轮无 gap」= 连续 3 次结论均为「完全覆盖、验证通过」且该 3 次报告中批判审计员结论段均注明「本轮无新 gap」；若任一轮为「未通过」或「存在 gap」，则从下一轮重新计数。
- 若通过且批判审计员无新 gap：注明「本轮无新 gap，第 N 轮；建议累计至 3 轮无 gap 后收敛」。
- 若未通过：注明「本轮存在 gap，不计数」，修复后再次发起本审计，直至连续 3 轮无 gap 收敛。
```
