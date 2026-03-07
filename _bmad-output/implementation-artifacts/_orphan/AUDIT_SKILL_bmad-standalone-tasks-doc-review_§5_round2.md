# Skill 文档审计报告：bmad-standalone-tasks-doc-review（第 2 轮）

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计概述

| 项目 | 值 |
|------|-----|
| 被审对象 | skills/bmad-standalone-tasks-doc-review/SKILL.md |
| 需求依据 | 本技能的设计目标 + audit-document-iteration-rules、audit-prompts §4/§5、audit-prompts-critical-auditor-appendix |
| 项目根 | d:\Dev\BMAD-Speckit-SDD-Flow |
| 本轮次 | 第 2 轮 |

---

## 2. 审计项逐条验证

### 2.1 需求覆盖

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 技能描述覆盖设计目标 | ✅ | 对 TASKS 严格审计、批判审计员 >70%、3 轮无 gap、审计子代理直接修改文档均有描述 |
| 适用场景完整 | ✅ | 用户发起审计、质量门控、3 轮收敛三种场景已覆盖 |
| 强制约束完整 | ✅ | 批判审计员、收敛条件、发现 gap 时行为、子代理类型均有表格 |
| 工作流完整 | ✅ | 解析路径→需求依据→发起审计→子代理选择→收敛检查→迭代→报告落盘 7 步 |
| 遗漏章节 | ✅ | 第 1 轮已补需求依据占位符、报告保存时机等；第 2 轮补步骤 3 报告保存覆盖要求 |

### 2.2 可执行性

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 工作流步骤可操作 | ✅ | 每步有明确动作与产出 |
| 引用路径正确 | ✅ | skills/speckit-workflow/references/*、references/audit-prompt-tasks-doc.md、audit-prompt-impl.md 均存在 |
| 占位符完整 | ✅ | 步骤 3 已列全 {文档路径}、{需求依据路径}、{项目根}、{报告路径}、{轮次} |
| 子代理调度方式明确 | ✅ | 第 1 轮已补「Cursor Task 不存在、调用失败或超时」 |

### 2.3 依赖与一致性

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 与 audit-document-iteration-rules 一致 | ✅ | 审计子代理直接修改、3 轮针对被审文档、迭代流程一致 |
| 与 audit-prompts §4 一致 | ✅ | TASKS 审计精神、可解析评分块四维一致 |
| 与 audit-prompts-critical-auditor-appendix 一致 | ✅ | 批判审计员必填结构、检查维度、strict 模式 3 轮收敛一致 |
| 模式 B 与主流程无矛盾 | ✅ | 主流程审文档、模式 B 审实现，场景分离清晰 |

### 2.4 边界与遗漏

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 批判审计员 >70% 约束明确 | ✅ | 强制约束表、audit-prompt-tasks-doc 模板均有 |
| 3 轮无 gap 收敛条件清晰 | ✅ | 强制约束表、工作流收敛检查、迭代步骤均有 |
| 发现 gap 时「审计子代理直接修改」强调 | ✅ | 强制约束表、工作流、引用 audit-document-iteration-rules 均有 |
| 报告保存时机 | ⚠️→✅ | 第 2 轮发现：audit-prompt-tasks-doc 模板为「审计通过时」与 Skill 步骤 7「每轮均须保存」矛盾；已通过步骤 3 增加覆盖要求消除 |

### 2.5 可解析评分块

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 报告格式要求完整 | ✅ | 总体评级 A/B/C/D、四维评分均有 |
| 维度与 parseAndWriteScore 兼容 | ✅ | 需求完整性、可测试性、一致性、可追溯性与 audit-prompts §4.1 一致 |

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、引用路径失效、约束表述歧义、工作流不可落地、报告保存时机与模板一致性、占位符完整性、子代理不可用判定、模式 B 引用路径、可解析评分块与 parseAndWriteScore 兼容性、收敛条件表述、批判审计员占比约束。

**每维度结论**：

- **遗漏需求点**：设计目标为 TASKS 严格审计、批判审计员 >70%、3 轮无 gap、审计子代理直接修改。技能描述、适用场景、强制约束、工作流已覆盖。第 1 轮已补需求依据为 TASKS 自身时占位符说明。第 2 轮发现步骤 3 未明确「报告保存」与模板的覆盖关系——若 audit-prompt-tasks-doc 模板中为「审计通过时，将完整报告保存至」，则与 Skill 步骤 7「每轮报告（无论通过与否）均须保存」矛盾，主 Agent 复制模板时可能沿用错误表述。**已补充**：步骤 3 增加「报告保存部分须为『每轮报告（无论通过与否）均须保存至 {报告路径}』，与步骤 7 一致（若模板为『审计通过时』则须覆盖）」。

- **边界未定义**：第 1 轮已补「code-reviewer 不可用」可操作判定（Cursor Task 不存在、调用失败或超时）。无新增边界问题。

- **验收不可执行**：工作流各步均有明确动作；引用路径已验证存在；占位符列表完整。可执行。

- **与前置文档矛盾**：与 audit-document-iteration-rules、audit-prompts §4、audit-prompts-critical-auditor-appendix 无矛盾。第 2 轮发现 Skill 步骤 7 与 audit-prompt-tasks-doc 模板「报告保存」表述不一致——Skill 要求每轮均须保存，模板仅写「审计通过时」。此矛盾已通过步骤 3 的覆盖要求消除，主 Agent 在使用模板时须按步骤 3 覆盖。

- **引用路径失效**：skills/speckit-workflow/references/audit-document-iteration-rules.md、audit-prompts.md、audit-prompts-critical-auditor-appendix.md、audit-post-impl-rules.md 均存在。references/audit-prompt-tasks-doc.md、references/audit-prompt-impl.md 均存在。无失效。

- **约束表述歧义**：第 1 轮已明确「每轮报告（无论通过与否）均须保存」。第 2 轮发现的模板与 Skill 不一致已通过步骤 3 覆盖要求消除歧义。

- **工作流不可落地**：步骤 3 原未说明占位符完整列表及报告保存覆盖。第 2 轮已补：占位符含 {项目根}、{报告路径}、{轮次}（与 audit-prompt-tasks-doc 模板一致）；报告保存须覆盖为每轮均须保存。可落地。

- **报告保存时机与模板一致性**：此为第 2 轮核心 gap。audit-prompt-tasks-doc 模板「## 报告保存」写「审计通过时，将完整报告保存至：{报告路径}」，而 Skill 步骤 7 及 audit-document-iteration-rules 精神要求每轮均须保存。主 Agent 若直接复制模板而不覆盖，将导致未通过轮次不保存报告，违反迭代规则。**已修复**：步骤 3 明确要求覆盖报告保存部分。

- **占位符完整性**：步骤 3 已列全 {文档路径}、{需求依据路径}、{项目根}、{报告路径}、{轮次}，与 audit-prompt-tasks-doc 占位符说明表一致。

- **子代理不可用判定**：第 1 轮已补，无新增问题。

- **模式 B 引用路径**：第 1 轮已补全 audit-post-impl-rules 路径，无问题。

- **可解析评分块与 parseAndWriteScore 兼容性**：四维（需求完整性、可测试性、一致性、可追溯性）与 audit-prompts §4.1、audit-prompts-critical-auditor-appendix §7 一致，parseAndWriteScore 可解析。

- **收敛条件表述**：连续 3 轮无 gap 针对被审文档、发现 gap 不计数、修改后下一轮审计，表述清晰，与 audit-document-iteration-rules 一致。

- **批判审计员占比约束**：Skill 要求 >70%，audit-prompts-critical-auditor-appendix 通用为 ≥50%，本技能更严，符合设计目标。audit-prompt-tasks-doc 模板已含「不少于报告其余部分的 70%」，一致。

**本轮结论**：本轮存在 gap。具体项：1) 步骤 3 未明确报告保存部分与 audit-prompt-tasks-doc 模板的覆盖关系，模板「审计通过时」与 Skill 步骤 7「每轮均须保存」矛盾，主 Agent 复制模板时可能沿用错误表述。不计数；已直接修改被审文档（步骤 3 增加报告保存覆盖要求）消除上述 gap，修复后主 Agent 发起下一轮审计。

---

## 4. 已修改内容（审计子代理直接修改）

以下修改已直接应用于 `skills/bmad-standalone-tasks-doc-review/SKILL.md`：

1. **工作流步骤 3**：在「替换 `{文档路径}`、`{需求依据路径}`」后补充占位符 `{项目根}`、`{报告路径}`、`{轮次}`；并增加「**报告保存部分须为『每轮报告（无论通过与否）均须保存至 {报告路径}』**，与步骤 7 一致（若模板为『审计通过时』则须覆盖）」。

---

## 5. 收敛条件

本轮存在 gap，不计数。已直接修改被审文档消除 gap。主 Agent 收到本报告后发起下一轮审计。

---

## 6. 结论

**验证未通过**。本轮发现 1 项 gap（步骤 3 报告保存与模板一致性），已由审计子代理直接修改被审文档消除。建议主 Agent 发起第 3 轮审计以验证修改后的文档。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: B

维度评分:
- 需求完整性: 88/100
- 可测试性: 90/100
- 一致性: 85/100
- 可追溯性: 92/100
