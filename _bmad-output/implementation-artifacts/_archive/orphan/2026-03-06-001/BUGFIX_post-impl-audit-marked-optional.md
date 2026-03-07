# BUGFIX：实施后审计被标为可选与 BMAD 约定冲突

**日期**：2026-03-04  
**发现场景**：Dev Story 1.2 流程（specify → plan → GAPS → tasks → implement）中，实施后审计被标记为「可选」  
**文档路径**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_post-impl-audit-marked-optional.md`

---

## §1 现象/问题描述

### 1.1 现象

在 Dev Story 流程（如 Story 1.2：specify → plan → GAPS → tasks → implement）中，**实施后审计**被某处标为「**可选**」。用户或子代理据此可能跳过实施后审计，违反 BMAD 内建约定。

### 1.2 复现/发现场景

- 用户或 bmad-story-assistant 执行 Dev Story 1.2
- 流程描述或生成的 todo 中呈现：`specify → plan → GAPS → tasks → implement`，其后跟「实施后审计（可选）」或类似表述
- 导致实施后审计被误解为可跳过

### 1.3 预期行为

按 bmad-story-assistant、bmad-bug-assistant、REQUIREMENTS 及 speckit-workflow 约定：

- **实施后审计为必须步骤**，非可选
- post_impl 迭代结束标准为「实施后审计 §5 结论为完全覆盖、验证通过」
- 实施完成后**必须**发起实施后审计，迭代直至通过

### 1.4 审计依据对照

| 依据 | 规定 |
|------|------|
| bmad-story-assistant SKILL.md | 阶段四「实施后审计（增强版）」为**必须**步骤；示例 1：「实施完成后，发起实施后审计（audit-prompts.md §5）」 |
| bmad-bug-assistant SKILL.md | 流程含「实施 → 实施后审计」；实施后审计未标可选；未通过时**必须**按修改建议修复后再审计 |
| REQUIREMENTS §2.2 | post_impl 迭代结束标准为「实施后审计 §5 结论为完全覆盖、验证通过」 |
| speckit-workflow | 执行阶段后须通过 code-review §5；与 Layer 5 实施后审计衔接 |

---

## §2 根因分析

### 2.1 根因结论

**根因**：流程表述与职责分工导致实施后审计被弱化或误标为可选。

1. **STORY-A3-DEV 子代理 scope 仅含 speckit 五阶段**：模板写「specify → plan → GAPS → tasks → 执行」，未显式包含实施后审计；实施后审计由主 Agent 在阶段四执行。若从「Dev Story 子代理工作范围」理解流程，易将实施后审计视为「子代理范围外」→ 推论为「可选」。
2. **pr_review 与 post_impl  proximity 混淆**：REQUIREMENTS 等文档中，Layer 5 行写「post_impl, pr_review | … pr_review 可选」。此处「可选」修饰 pr_review（人工审核的可选记录），非 post_impl。若 LLM 或人工快读，可能将「可选」错误关联到实施后审计。
3. **流程总结缺「必须」强调**：部分流程概览仅列步骤名，未在实施后审计旁显式标注「必须」或「禁止跳过」，易被推断为可选。
4. **Todo/checklist 生成未统一约束**：若某处基于 STORY-A3-DEV scope 生成 todo 或 checklist，可能只含 specify→plan→GAPS→tasks→implement，而将实施后审计列作「可选后续」或遗漏，导致执行时被跳过。

### 2.2 根因链条（批判审计员复核）

| 层级 | 问题 | 后果 |
|------|------|------|
| STORY-A3-DEV 模板 | 子代理 scope 未含实施后审计；主 Agent 职责未在模板内强调「实施后审计必须」 | 子代理交付即视为「完成」，主 Agent 可能不发起阶段四 |
| 文档 proximity | Layer 5 行「pr_review 可选」与 post_impl 同列 | 误读为「实施后审计可选」 |
| 流程概览/README | 实施后审计未标「必须」「禁止跳过」 | 用户/Agent 推断可省略 |
| Todo/checklist 生成 | 无统一规范强制包含实施后审计且标为必须 | 生成的待办可能遗漏或标为可选 |

### 2.3 证据与引用

1. **bmad-story-assistant SKILL.md 第 798 行**（STORY-A3-DEV）：
   > 请对 Story {epic_num}-{story_num} 执行 Dev Story 实施。**必须嵌套执行 speckit-workflow 完整流程**：specify → plan → GAPS → tasks → 执行。
   - 子代理 scope 止于「执行」，实施后审计在阶段四由主 Agent 发起

2. **bmad-story-assistant SKILL.md 第 108–113 行**（示例 1）：
   > 4. 实施完成后，发起实施后审计（audit-prompts.md §5）  
   > 5. 审计通过即流程结束
   - 实施后审计为必做，但未在 Dev Story 流程块内显式标「必须」

3. **REQUIREMENTS §2.2 / 第 261–262 行**：
   > post_impl：实施后审计 §5 结论为「完全覆盖、验证通过」，且环节 2–6 得分已录入…  
   > pr_review：强制人工审核通过；可选记录，不作为迭代结束的必填条件。
   - 「可选」仅针对 pr_review 记录，非 post_impl

4. **bmad-story-assistant 阶段四（第 823–836 行）**：
   - 标题为「阶段四：实施后审计（增强版）」；前置检查、综合审计、审计结论处理均为必做
   - 未在标题或首段写「（可选）」，技能本身无误，但流程串联处可能被弱化

---

## §3 依据/参考（可选）

- bmad-story-assistant SKILL.md（Create Story → 审计 → Dev Story → 实施后审计）
- bmad-bug-assistant SKILL.md（根因分析 → … → 实施 → 实施后审计）
- REQUIREMENTS §2.2 各阶段迭代结束标准
- speckit-workflow 与 audit-prompts.md §5
- BUGFIX_ralph-method-missing-in-dev-story-flow.md（AC-6 回归：实施后审计必须执行）

---

## §4 修复方案

### 4.1 原则

- 在所有流程表述中，**实施后审计**必须明确为**必须步骤**，不得标为「可选」
- 子代理交付后，主 Agent **必须**发起实施后审计，不得以「子代理已完成」为由跳过

### 4.2 修改项

| 位置 | 修改内容 |
|------|----------|
| bmad-story-assistant SKILL.md 阶段三 Dev Story 流程 | 在 Dev Story 实施流程（§621 附近）末尾增补：「**6. 实施后审计（必须）**：子任务返回后，主 Agent 必须按阶段四发起实施后审计，禁止跳过。」 |
| bmad-story-assistant SKILL.md STORY-A3-DEV 模板 | 在模板末尾（子任务说明之后）增补主 Agent 职责：「子任务返回后，主 Agent 必须发起阶段四实施后审计（STORY-A4-POSTAUDIT），禁止跳过。实施后审计为必须步骤，非可选。」 |
| bmad-story-assistant SKILL.md 阶段四标题 | 将「阶段四：实施后审计（增强版）」下首段增补一句：「本阶段为**必须**步骤，非可选。主 Agent 在子任务返回后必须发起，不得跳过。」 |
| bmad-story-assistant SKILL.md 示例 1 | 在步骤 4 改为：「4. 实施完成后，**必须**发起实施后审计（audit-prompts.md §5）（本步骤为必须，非可选）」 |
| 流程概览/README（若存在） | 在含「实施后审计」的流程图中，为该节点增加标注「必须」或「禁止跳过」 |
| bmad-bug-assistant SKILL.md | 在流程定义处增补说明：「实施后审计为必须步骤，非可选。未通过时必须按修改建议修复后再次审计，直至通过。」 |

### 4.3 禁止词约束

- 在流程说明、todo、checklist 中，**禁止**对「实施后审计」使用：可选、可考虑、可省略、可跳过
- 若某处需区分「pr_review 可选记录」，须明确写「pr_review 记录为可选」，避免与实施后审计混同

### 4.4 与 ralph-method BUGFIX 的衔接

BUGFIX_ralph-method-missing-in-dev-story-flow 的 AC-6 要求：「bmad-story-assistant 阶段一、二、**四**行为不变」。本修复**强化**阶段四为必须，不改变阶段四的审计标准与通过条件，仅消除「可选」误解，与 AC-6 一致。

---

## §5 流程/建议流程（可选）

### 5.1 建议主 Agent 流程

1. 发起 Dev Story 子任务（STORY-A3-DEV）
2. 子任务返回后，执行兜底 cleanup（若有 current_pytest_session_pid.txt）
3. **必须**发起阶段四实施后审计（STORY-A4-POSTAUDIT），不得跳过
4. 若审计结论未通过，按修改建议修改后再次发起实施后审计，直至「完全覆盖、验证通过」

### 5.2 Todo/Checklist 生成建议

- 凡生成 Dev Story 或 speckit implement 后的待办，**必须**包含「实施后审计」且标为必须（非可选）
- 建议格式：`[ ] 实施后审计（必须；audit-prompts §5）`

---

## §6 验收标准（AC）

| AC | 描述 | 验证方式 |
|----|------|----------|
| AC-1 | bmad-story-assistant 阶段三、四说明中，实施后审计显式标为「必须」 | 人工检查 SKILL.md 阶段三、四相关段落 |
| AC-2 | STORY-A3-DEV 模板含主 Agent 必须发起实施后审计的说明 | 人工检查模板末尾是否有该职责 |
| AC-3 | 示例 1 步骤 4 明确实施后审计为必须、非可选 | 人工检查示例 1 步骤 4 |
| AC-4 | 无文档将「实施后审计」标为「可选」 | grep 全文检索，确认无「实施后审计」与「可选」同句出现（pr_review 可选除外） |
| AC-5 | 按修复后流程执行 Dev Story 1.2，主 Agent 发起实施后审计 | 模拟或实际执行，确认阶段四被触发 |

---

## §7 最终任务列表

| 任务 ID | 描述 | 产出/验证 |
|---------|------|-----------|
| T1 | 修改 bmad-story-assistant SKILL.md：在 Dev Story 实施流程（§621 附近）末尾增补「6. 实施后审计（必须）」说明 | 段落存在且明确必须 |
| T2 | 修改 bmad-story-assistant SKILL.md：在 STORY-A3-DEV 模板末尾增补主 Agent 必须发起实施后审计的职责说明 | 模板含该说明 |
| T3 | 修改 bmad-story-assistant SKILL.md：在阶段四首段增补「本阶段为必须步骤，非可选」 | 阶段四首段含该句 |
| T4 | 修改 bmad-story-assistant SKILL.md 示例 1 步骤 4：明确实施后审计为必须、非可选 | 示例 1 步骤 4 已更新 |
| T5 | 若 README 或流程概览含实施后审计节点：为该节点增加「必须」或「禁止跳过」标注 | 流程图/说明已更新 |
| T6 | 修改 bmad-bug-assistant SKILL.md：在流程定义处增补「实施后审计为必须步骤，非可选」说明 | 流程说明已更新 |
| T7 | 全库 grep 检索：确认无「实施后审计」与「可选」不当组合（pr_review 可选除外） | 检索报告或确认无问题 |
| T8 | 回归验证：执行 Dev Story 1.2 或等效流程，确认主 Agent 发起实施后审计 | 执行记录或测试通过 |

---

*本 BUGFIX 经 party-mode 根因辩论（批判审计员发言占比 >60%，至少 100 轮，最后 3 轮无新 gap 收敛）产出。*
