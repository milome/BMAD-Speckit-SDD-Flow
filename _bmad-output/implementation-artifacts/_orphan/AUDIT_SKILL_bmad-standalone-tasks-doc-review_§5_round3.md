# Skill 文档审计报告：bmad-standalone-tasks-doc-review（第 3 轮）

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
| 本轮次 | 第 3 轮 |

---

## 2. 审计项逐条验证

### 2.1 需求覆盖

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 技能描述覆盖设计目标 | ✅ | 对 TASKS 严格审计、批判审计员 >70%、3 轮无 gap、审计子代理直接修改文档均有描述 |
| 适用场景完整 | ✅ | 用户发起审计、质量门控、3 轮收敛三种场景已覆盖 |
| 强制约束完整 | ✅ | 批判审计员、收敛条件、发现 gap 时行为、子代理类型均有表格 |
| 工作流完整 | ✅ | 解析路径→需求依据→发起审计→子代理选择→收敛检查→迭代→报告落盘 7 步 |
| 遗漏章节 | ✅ | 第 1、2 轮已补需求依据占位符、报告保存时机、步骤 3 模板覆盖要求等 |

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
| 报告保存时机 | ✅ | 步骤 3、7 已明确「每轮报告（无论通过与否）均须保存」；audit-prompt-tasks-doc 模板已同步 |

### 2.5 可解析评分块

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 报告格式要求完整 | ✅ | 总体评级 A/B/C/D、四维评分均有 |
| 维度与 parseAndWriteScore 兼容 | ✅ | 需求完整性、可测试性、一致性、可追溯性与 audit-prompts §4.1 一致 |

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、引用路径失效、约束表述歧义、工作流不可落地、报告保存时机与模板一致性、占位符完整性、子代理不可用判定、模式 B 引用路径、可解析评分块与 parseAndWriteScore 兼容性、收敛条件表述、批判审计员占比约束、audit-prompts §4/§5 引用正确性、引用路径相对性、步骤 6 迭代逻辑、步骤 7 报告路径格式。

**每维度结论**：

- **遗漏需求点**：设计目标为 TASKS 严格审计、批判审计员 >70%、3 轮无 gap、审计子代理直接修改。技能描述、适用场景、强制约束、工作流已覆盖。第 1 轮已补需求依据为 TASKS 自身时 `{需求依据路径}` 填被审文档路径。第 2 轮已补步骤 3 报告保存覆盖要求。无遗漏。

- **边界未定义**：第 1 轮已补「code-reviewer 不可用」可操作判定（Cursor Task 不存在、调用失败或超时）。consecutive_pass_count 初始值未显式写，但「置 0」与「+1」的语义隐含初始为 0，主 Agent 可正确实现。步骤 7 的 `{slug}` 可从 TASKS 文档路径/文件名提取，占位符表示例 `AUDIT_TASKS_xxx_§4_roundN.md` 已暗示，无歧义。

- **验收不可执行**：工作流各步均有明确动作；引用路径已验证存在；占位符列表完整。主 Agent 可按步骤 1–7 执行审计流程。可执行。

- **与前置文档矛盾**：与 audit-document-iteration-rules、audit-prompts §4、audit-prompts-critical-auditor-appendix 无矛盾。audit-prompt-tasks-doc 模板「## 报告保存」已为「**每轮报告（无论通过与否）均须保存**。将完整报告保存至：{报告路径}」，与 Skill 步骤 7 一致。步骤 3 的「若模板为『审计通过时』则须覆盖」为兜底说明，当前模板已正确，无冲突。

- **引用路径失效**：skills/speckit-workflow/references/audit-document-iteration-rules.md、audit-prompts.md、audit-prompts-critical-auditor-appendix.md、audit-post-impl-rules.md 均存在。skills/bmad-standalone-tasks-doc-review/references/audit-prompt-tasks-doc.md、audit-prompt-impl.md 均存在。无失效。

- **约束表述歧义**：批判审计员 >70%、3 轮无 gap、审计子代理直接修改、每轮报告均须保存，表述清晰无歧义。

- **工作流不可落地**：步骤 1 解析文档路径、步骤 2 确定需求依据、步骤 3 复制模板并替换占位符、步骤 4 选择子代理、步骤 5 收敛检查、步骤 6 迭代发起、步骤 7 报告落盘，每步可操作。可落地。

- **报告保存时机与模板一致性**：第 2 轮已修复。audit-prompt-tasks-doc 模板已含「每轮报告（无论通过与否）均须保存」，与 Skill 步骤 7 一致。步骤 3 的覆盖要求作为兜底有效。无 gap。

- **占位符完整性**：步骤 3 已列全 {文档路径}、{需求依据路径}、{项目根}、{报告路径}、{轮次}，与 audit-prompt-tasks-doc 占位符说明表一致。

- **子代理不可用判定**：第 1 轮已补「Cursor Task 不存在、调用失败或超时」，可操作。无 gap。

- **模式 B 引用路径**：第 1 轮已补全 `skills/speckit-workflow/references/audit-post-impl-rules.md`，与其他引用风格一致。

- **可解析评分块与 parseAndWriteScore 兼容性**：四维（需求完整性、可测试性、一致性、可追溯性）与 audit-prompts §4.1、audit-prompts-critical-auditor-appendix §7 一致，parseAndWriteScore 可解析。

- **收敛条件表述**：连续 3 轮无 gap 针对被审文档、发现 gap 不计数、修改后下一轮审计，与 audit-document-iteration-rules 一致。

- **批判审计员占比约束**：Skill 要求 >70%，高于 audit-prompts-critical-auditor-appendix 通用 ≥50%，符合设计目标。audit-prompt-tasks-doc 模板已含「不少于报告其余部分的 70%」，一致。

- **audit-prompts §4/§5 引用正确性**：主流程对应 §4（TASKS 文档审计），模式 B 对应 §5（实施后审计）。引用正确，场景分离清晰。

- **引用路径相对性**：Skill 引用 `skills/speckit-workflow/references/*` 为项目根相对路径；`references/audit-prompt-tasks-doc.md` 为 Skill 目录相对路径。两种用法正确。

- **步骤 6 迭代逻辑**：有 gap 时审计子代理已修改文档，下一轮审计同一路径即获得修改后内容。逻辑正确。

- **步骤 7 报告路径格式**：`AUDIT_TASKS_{slug}_§4_round{N}.md` 与 audit-prompt-tasks-doc 占位符表示例一致。slug 从 TASKS 文档名提取的约定可从示例推断。

**本轮结论**：本轮无新 gap。第 3 轮；本轮为连续无 gap 的第 1 轮，建议累计至连续 3 轮无 gap 后收敛。

---

## 4. 已修改内容（审计子代理直接修改）

本轮无 gap，未对被审文档进行修改。

---

## 5. 收敛条件

本轮无新 gap，第 3 轮。本轮为连续无 gap 的第 1 轮（前两轮存在 gap 已修复）。建议主 Agent 继续发起第 4、5 轮审计，累计至连续 3 轮无 gap 后收敛。

---

## 6. 结论

**完全覆盖、验证通过**。本轮未发现 gap，被审文档 skills/bmad-standalone-tasks-doc-review/SKILL.md 满足设计目标及参考规范要求。建议主 Agent 发起第 4 轮审计以累计收敛轮次。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 95/100
- 可追溯性: 95/100
