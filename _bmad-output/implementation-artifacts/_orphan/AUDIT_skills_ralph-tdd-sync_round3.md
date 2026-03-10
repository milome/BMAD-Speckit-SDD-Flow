# 第 3 轮执行阶段审计：bmad-standalone-tasks、bmad-bug-assistant、bmad-story-assistant 技能 ralph-method TDD 模式统一

**审计类型**：执行阶段审计（验证轮）  
**收敛目标**：连续 3 轮无 gap  
**前两轮**：第 1 轮 2 个 GAP 已修复；第 2 轮「完全覆盖、验证通过」，批判审计员注明「本轮无新 gap」。累计 2 轮无 gap。  
**本轮**：第 3 轮复验，满足「连续 3 轮无 gap」即可收敛。

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit |

---

## 被审对象

| 路径 | 说明 |
|------|------|
| skills/bmad-standalone-tasks/SKILL.md | 独立任务实施技能 |
| skills/bmad-standalone-tasks/references/prompt-templates.md | 实施与审计 prompt 模板 |
| skills/bmad-bug-assistant/SKILL.md | BUG 修复全流程技能 |
| skills/bmad-story-assistant/SKILL.md | Story 开发全流程技能 |

---

## 审计依据

- ralph-method TDD 模式：prd tddSteps（RED/GREEN/REFACTOR 三阶段）、progress 预填、TDD 三项含 REFACTOR 强制
- 第 2 轮审计项 1–3 逐项复验，确认无回归、无新 gap

---

## 审计项 1：bmad-story-assistant 第 5 步为「无论是否有重构」

**验证方式**：在 bmad-story-assistant SKILL.md 中搜索 TDD 红绿灯阻塞约束五步及第 5 步表述。

**验证结果**：✅ 通过

**证据**：`skills/bmad-story-assistant/SKILL.md` 第 872–878 行：

```markdown
**【TDD 红绿灯阻塞约束】**每个涉及生产代码的任务执行顺序为：
1. 先写/补测试并运行验收 → 必须得到失败结果（红灯）
2. 立即在 progress 追加 [TDD-RED] <任务ID> <验收命令> => N failed
3. 再实现并通过验收 → 得到通过结果（绿灯）
4. 立即在 progress 追加 [TDD-GREEN] <任务ID> <验收命令> => N passed
5. **无论是否有重构**，在 progress 追加 [TDD-REFACTOR] <任务ID> <内容>（无具体重构时写「无需重构 ✓」）
禁止在未完成步骤 1–2 之前执行步骤 3。禁止所有任务完成后集中补写 TDD 记录。
```

第 5 步明确为「**无论是否有重构**」，无回归、无新 gap。

---

## 审计项 2：prompt-templates.md 含完整【TDD 红绿灯阻塞约束】五步、交付前自检

**验证方式**：在 prompt-templates.md 中逐项确认五步约束及交付前自检。

**验证结果**：✅ 通过

**证据**：`skills/bmad-standalone-tasks/references/prompt-templates.md` 第 24–25 行：

```markdown
2. **TDD 红绿灯**：每个 US 执行前先写/补测试（红灯）→ 实现使通过（绿灯）→ 重构。**【TDD 红绿灯阻塞约束】** 每个涉及生产代码的任务执行顺序为：① 先写/补测试并运行验收 → 必须得到失败结果（红灯）；② 立即在 progress 追加 [TDD-RED] <任务ID> <验收命令> => N failed；③ 再实现并通过验收 → 得到通过结果（绿灯）；④ 立即在 progress 追加 [TDD-GREEN] <任务ID> <验收命令> => N passed；⑤ **无论是否有重构**，在 progress 追加 [TDD-REFACTOR] <任务ID> <内容>（无具体重构时写「无需重构 ✓」）。禁止在未完成步骤 1–2 之前执行步骤 3。禁止所有任务完成后集中补写 TDD 记录。**交付前自检**：涉及生产代码的每个 US，progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 须在 [TDD-GREEN] 之前；缺任一项则补充后再交付。
```

覆盖内容：
- ①–⑤ 五步完整
- 第 ⑤ 步为「**无论是否有重构**」
- **交付前自检**：progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 在 [TDD-GREEN] 之前

无回归、无新 gap。

---

## 审计项 3：三技能在 progress 预填、prd tddSteps、TDD 三项上一致

**验证方式**：对比 bmad-standalone-tasks、bmad-bug-assistant、bmad-story-assistant 在以下三方面的表述：progress 预填、prd tddSteps、TDD 三项（RED/GREEN/REFACTOR）。

**验证结果**：✅ 通过

### 3.1 progress 预填

| 技能 | 位置 | 内容 | 一致性 |
|------|------|------|--------|
| bmad-standalone-tasks | SKILL.md L74 | `[TDD-RED] _pending_`、`[TDD-GREEN] _pending_`、`[TDD-REFACTOR] _pending_` 或 `[DONE] _pending_` | ✓ |
| bmad-bug-assistant | SKILL.md L432–433 | 同上 | ✓ |
| bmad-story-assistant | SKILL.md L854–856 | `[TDD-RED]`、`[TDD-GREEN]`、`[TDD-REFACTOR]` 或 `[DONE] 占位行（_pending_）` | ✓ |

三技能均约定对涉及生产代码的 US 预填 RED/GREEN/REFACTOR 三槽位，仅文档/配置的含 [DONE]。

### 3.2 prd tddSteps

| 技能 | 位置 | 内容 | 一致性 |
|------|------|------|--------|
| bmad-standalone-tasks | SKILL.md L74 | 涉及生产代码的 US 含 `involvesProductionCode: true` 与 `tddSteps`（RED/GREEN/REFACTOR 三阶段）；仅文档/配置的含 `tddSteps`（DONE 单阶段） | ✓ |
| bmad-bug-assistant | SKILL.md L431–432 | 同上 | ✓ |
| bmad-story-assistant | SKILL.md L853–856 | 符合 ralph-method schema；progress 预填与 prd 一致 | ✓ |

bmad-story-assistant 通过「符合 ralph-method schema」引用同一 tddSteps 约定，与另两技能一致。

### 3.3 TDD 三项（RED/GREEN/REFACTOR）

| 技能 | 位置 | 内容 | 一致性 |
|------|------|------|--------|
| bmad-standalone-tasks | SKILL.md L76 | ⑤ **无论是否有重构**，在 progress 追加 [TDD-REFACTOR] | ✓ |
| bmad-bug-assistant | SKILL.md L442 | **无论是否有重构**，须追加 `[TDD-REFACTOR]`（无具体重构时写「无需重构 ✓」） | ✓ |
| bmad-story-assistant | SKILL.md L877 | 5. **无论是否有重构**，在 progress 追加 [TDD-REFACTOR] | ✓ |

三技能均要求 REFACTOR 为强制项（无论是否有重构），表述一致。

---

## 批判审计员结论（占比 >70%）

**对抗视角复验**：

1. **审计项 1**：bmad-story-assistant 第 5 步「无论是否有重构」在 STORY-A3-DEV 模板 L877 明确写出，与 bmad-standalone-tasks、bmad-bug-assistant 一致；无遗漏、无歧义。

2. **审计项 2**：prompt-templates.md 中 Implementation 与 Resume 模板均引用同一「强制约束」段落；Implementation 模板含完整五步与交付前自检，Resume 模板写明「与 Implementation 中 1～4 条相同」，逻辑闭环。

3. **审计项 3**：三技能在 progress 预填、prd tddSteps、TDD 三项上的表述已逐条对比，未发现差异或模糊化表述。bmad-story-assistant 对 prd 的「符合 ralph-method schema」引用合理，不构成 gap。

4. **回归检查**：对比第 2 轮修复后的状态，第 1 轮 GAP（第 5 步「无论是否有重构」、prompt-templates 五步与交付前自检）均已固化，未发现回退或削弱。

5. **边界情况**：仅文档/配置的 US 使用 [DONE] 单阶段、涉及生产代码的 US 必须含 RED/GREEN/REFACTOR 三项，三技能约定一致，无例外歧义。

**批判审计员结论**：**本轮无新 gap**。审计项 1–3 均通过复验，未发现回归或新增 gap。三技能在 ralph-method TDD 模式（progress 预填、prd tddSteps、TDD 三项含 REFACTOR 强制）上已统一，满足收敛条件。

---

## 审计结论

| 审计项 | 结论 | 说明 |
|--------|------|------|
| 1. bmad-story-assistant 第 5 步为「无论是否有重构」 | 通过 | L877 明确写出 |
| 2. prompt-templates.md 含完整五步与交付前自检 | 通过 | L24–25 完整覆盖 |
| 3. 三技能 progress 预填、prd tddSteps、TDD 三项一致 | 通过 | 逐项对比，无差异 |

**结论：通过**

**收敛状态**：连续 3 轮无 gap（第 2 轮、第 3 轮批判审计员均注明「本轮无新 gap」），**审计收敛**。

---

*报告生成时间：第 3 轮验证轮。*
