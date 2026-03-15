# 实施后审计规则（实施后阶段统一 strict）

本文件定义**实施后审计**的 strict 规则，为 bmad-story-assistant 阶段四、speckit-workflow §5.2、bmad-standalone-tasks Step 2 三处提供 Single source of truth。

---

## 1. 实施后审计的适用范围

**实施后** = 代码/可运行产物已完成的审计。以下三处均为实施后审计，**必须**遵循本规则：

| 技能 | 阶段/步骤 | 审计对象 |
|------|-----------|----------|
| bmad-story-assistant | 阶段四（实施后审计） | Story 实施后的代码、prd、progress |
| speckit-workflow | §5.2 执行阶段审计 | tasks.md 执行后的代码、prd、progress |
| bmad-standalone-tasks | Step 2 审计子任务 | TASKS/BUGFIX 实施后的代码、prd、progress |

---

## 2. strict 规则（必须遵守）

实施后审计**必须**满足以下条件，缺一不可：

### 2.1 批判审计员

- 审计报告须包含独立段落 **「## 批判审计员结论」**
- 该段落**字数或条目数不少于报告其余部分**（即占比 ≥50%）
- 必填结构：已检查维度列表、每维度结论、「本轮无新 gap」或「本轮存在 gap」及具体项
- 详见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)

### 2.2 连续 3 轮无 gap 收敛

**一轮** = 一次完整审计子任务/子代理调用。

**连续 3 轮无 gap** = 连续 3 次审计结论均为「完全覆盖、验证通过」，且该 3 次报告中批判审计员结论段均注明「本轮无新 gap」。

**计数规则**：
- 收到 pass 且批判审计员无新 gap → `consecutive_pass_count + 1`
- 任一轮为「未通过」或「存在 gap」→ `consecutive_pass_count` 置 0，从下一轮重新计数
- 达到 3 即收敛，可结束审计

**示例**：
- 通过-通过-gap → 修改 → 通过-通过-通过 → 后 3 轮算收敛 ✓
- 通过-通过-通过 → 收敛 ✓

### 2.3 与 iteration_count 的区分

- **iteration_count**：统计审计**未通过**的轮次（fail 次数），用于 scoring tier 系数等
- **consecutive_pass_count**：用于收敛条件，不写入 scoring，仅流程内部控制

---

## 3. 与 audit-prompts §5 的引用关系

- **audit-prompts.md §5**：执行阶段审计的提示词模板，含逐项检查清单
- **本文件**：实施后审计的**流程与收敛规则**（3 轮无 gap、批判审计员要求）
- 三者配合：审计子任务使用 audit-prompts §5 的提示词，同时按本文件执行 3 轮收敛逻辑，并引用 audit-prompts-critical-auditor-appendix 的批判审计员格式

---

## 4. batch 场景（speckit-workflow）

- **batch 间审计**（每批 tasks 完成后的中间检查点）：可用 **standard**（单次 + 批判审计员），不必 3 轮
- **最终 §5.2 审计**（全部 tasks 执行完毕后的总审计）：**必须 strict**，连续 3 轮无 gap 收敛

---

## 5. 引用本文件

三处技能在描述实施后审计时，应引用本规则：

- 路径：`.cursor/skills/speckit-workflow/references/audit-post-impl-rules.md`
- 或相对引用：`[audit-post-impl-rules.md](audit-post-impl-rules.md)`（同目录下）
