# Skill 文档审计报告：bmad-standalone-tasks-doc-review（第 7 轮）

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
| 本轮次 | 第 7 轮 |

---

## 2. 审计项逐条验证

### 2.1 需求覆盖

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 技能描述覆盖设计目标 | ✅ | 对 TASKS 严格审计、批判审计员 >70%、3 轮无 gap、审计子代理直接修改均有描述 |
| 适用场景完整 | ✅ | 用户发起审计、质量门控、3 轮收敛三种场景已覆盖 |
| 强制约束完整 | ✅ | 批判审计员、收敛条件、发现 gap 时行为、子代理类型均有表格 |
| 工作流完整 | ✅ | 解析路径→需求依据→发起审计→子代理选择→收敛检查→迭代→报告落盘 7 步 |
| 引用完整性 | ✅ | 引用 section 已含 audit-prompts §4/§5、audit-post-impl-rules、audit-prompts-critical-auditor-appendix |
| 可解析评分块主流程与模式 B 区分 | ✅ | 已明确主流程四维与模式 B §5.1 四维差异 |

### 2.2 可执行性

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 工作流步骤可操作 | ✅ | 每步有明确动作与产出 |
| 引用路径正确 | ✅ | skills/speckit-workflow/references/*、references/audit-prompt-tasks-doc.md、audit-prompt-impl.md 均存在 |
| 占位符完整 | ✅ | 步骤 3 已列全 {文档路径}、{需求依据路径}、{项目根}、{报告路径}、{轮次} |
| 子代理调度方式明确 | ✅ | 已含「Cursor Task 不存在、调用失败或超时」fallback 判定 |

### 2.3 依赖与一致性

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 与 audit-document-iteration-rules 一致 | ✅ | 审计子代理直接修改、3 轮针对被审文档、迭代流程一致 |
| 与 audit-prompts §4 一致 | ✅ | TASKS 审计精神、可解析评分块四维一致 |
| 与 audit-prompts §5 一致 | ✅ | 模式 B 引用、实施子代理修改代码、audit-post-impl-rules 一致 |
| 与 audit-prompts-critical-auditor-appendix 一致 | ✅ | 批判审计员必填结构、检查维度、strict 模式 3 轮收敛一致 |

### 2.4 边界与遗漏

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 批判审计员 >70% 约束明确 | ✅ | 强制约束表、audit-prompt-tasks-doc 模板均有 |
| 3 轮无 gap 收敛条件清晰 | ✅ | 强制约束表、工作流收敛检查、迭代步骤均有 |
| 发现 gap 时「审计子代理直接修改」强调 | ✅ | 强制约束表、工作流、引用 audit-document-iteration-rules 均有 |
| 报告保存时机 | ✅ | 步骤 3、7 已明确「每轮报告（无论通过与否）均须保存」 |

### 2.5 可解析评分块

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 报告格式要求完整 | ✅ | 总体评级 A/B/C/D、四维评分均有 |
| 主流程维度与 parseAndWriteScore 兼容 | ✅ | 需求完整性、可测试性、一致性、可追溯性与 audit-prompts §4.1 一致 |
| 模式 B 维度说明 | ✅ | 已补充 §5.1 四维（功能性、代码质量、测试覆盖、安全性）说明 |

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、引用路径失效、约束表述歧义、工作流不可落地、报告保存时机与模板一致性、占位符完整性、子代理不可用判定、模式 B 引用路径与维度差异、可解析评分块与 parseAndWriteScore 兼容性、收敛条件表述、批判审计员占比约束、audit-prompts §4/§5 引用正确性、引用 section 完整性、可解析评分块主流程与模式 B 区分、audit-prompts-critical-auditor-appendix 与 Skill >70% 的兼容性、步骤 6 迭代逻辑、步骤 7 报告路径格式与 slug 提取、frontmatter 与正文一致性、audit-post-impl-rules 在引用中的可追溯性、步骤 5 结论判定语义、模式 B 与主流程工作流边界、audit-prompt-tasks-doc 模板与 Skill 步骤 3 一致性、consecutive_pass_count 初始值与语义、引用路径相对基准（项目根）、audit-document-iteration-rules 在 prompt 中的可追溯性、适用场景与触发短语的覆盖、强制约束与 audit-document-iteration-rules §1.1 的对应、步骤 2 自洽依据时需求依据路径的明确性、步骤 4 code-reviewer 与 Cursor Task 的对应关系、步骤 5 与步骤 6 的衔接（consecutive_pass_count 与迭代发起条件）、步骤 7 报告路径中 slug 与 N 的提取约定、模式 B 触发时主流程 7 步是否仍适用、可解析评分块「强制」的传递链（Skill→prompt→审计子代理）、audit-prompt-impl 与模式 B 的引用完整性。

**每维度结论**：

- **遗漏需求点**：设计目标为 TASKS 严格审计、批判审计员 >70%、3 轮无 gap、审计子代理直接修改。技能描述、适用场景、强制约束、工作流、模式 B、可解析评分块均已覆盖。需求依据为 TASKS 自身时 `{需求依据路径}` 填被审文档路径已在步骤 2 明确。引用 section 已含 audit-prompts §4/§5、audit-post-impl-rules、audit-prompts-critical-auditor-appendix。可解析评分块主流程与模式 B 已区分。无遗漏。

- **边界未定义**：「code-reviewer 不可用」可操作判定（Cursor Task 不存在、调用失败或超时）已明确。consecutive_pass_count 由「置 0」与「+1」语义隐含初始为 0，与 audit-document-iteration-rules 一致。步骤 7 的 `{slug}` 从 TASKS 文档路径/文件名提取，示例 `AUDIT_TASKS_xxx_§4_roundN.md` 已暗示。模式 B 触发条件「用户要求对实施完成后的结果审计」已明确。无歧义。

- **验收不可执行**：工作流各步均有明确动作；引用路径已通过 Glob 验证存在。占位符列表完整。主 Agent 可按步骤 1–7 执行审计流程。可执行。

- **与前置文档矛盾**：与 audit-document-iteration-rules、audit-prompts §4/§5、audit-prompts-critical-auditor-appendix 无矛盾。Skill 要求批判审计员 >70%，高于 appendix §2 的 ≥50%，为更严格约束，与设计目标一致。audit-prompt-tasks-doc 模板「报告保存」已为「每轮报告（无论通过与否）均须保存」，与 Skill 步骤 7 一致。模式 B 引用 audit-post-impl-rules，与 audit-prompts §5 一致。无冲突。

- **引用路径失效**：skills/speckit-workflow/references/audit-document-iteration-rules.md、audit-prompts.md、audit-prompts-critical-auditor-appendix.md、audit-post-impl-rules.md 均存在。skills/bmad-standalone-tasks-doc-review/references/audit-prompt-tasks-doc.md、audit-prompt-impl.md 均存在。无失效。

- **约束表述歧义**：批判审计员 >70%、3 轮无 gap、审计子代理直接修改、每轮报告均须保存，表述清晰无歧义。

- **工作流不可落地**：步骤 1–7 每步可操作。模式 B 单独说明，与主流程边界清晰。可落地。

- **报告保存时机与模板一致性**：audit-prompt-tasks-doc 模板已含「每轮报告（无论通过与否）均须保存」，与 Skill 步骤 7 一致。无 gap。

- **占位符完整性**：步骤 3 已列全 {文档路径}、{需求依据路径}、{项目根}、{报告路径}、{轮次}，与 audit-prompt-tasks-doc 占位符说明表一致。

- **子代理不可用判定**：已补「Cursor Task 不存在、调用失败或超时」，可操作。

- **模式 B 引用路径与维度差异**：引用 section 已列 audit-prompts §5、audit-post-impl-rules。可解析评分块章节已区分主流程四维与模式 B §5.1 四维。

- **可解析评分块与 parseAndWriteScore 兼容性**：主流程四维与 audit-prompts §4.1 一致。模式 B 四维与 audit-prompts §5.1 一致。兼容。

- **收敛条件表述**：连续 3 轮无 gap 针对被审文档、发现 gap 不计数、修改后下一轮审计，与 audit-document-iteration-rules 一致。

- **批判审计员占比约束**：Skill 要求 >70%，高于 appendix 通用 ≥50%，符合设计目标。audit-prompt-tasks-doc 模板已含「不少于报告其余部分的 70%」，一致。

- **audit-prompts §4/§5 引用正确性**：主流程对应 §4，模式 B 对应 §5。引用 section 已补充 §5。

- **引用 section 完整性**：已列 audit-document-iteration-rules、audit-prompts §4、audit-prompts §5、audit-prompts-critical-auditor-appendix、audit-post-impl-rules。完整。

- **可解析评分块主流程与模式 B 区分**：标题已为「主流程（TASKS 文档审计）报告结尾须含」；已追加模式 B 维度说明。

- **audit-prompts-critical-auditor-appendix 与 Skill >70% 的兼容性**：appendix §2 规定占比 ≥50%，Skill 规定 >70%。Skill 为 stricter 约束，兼容。

- **步骤 6 迭代逻辑**：有 gap 时审计子代理已修改文档，下一轮审计同一路径即获得修改后内容。逻辑正确。

- **步骤 7 报告路径格式与 slug 提取**：`AUDIT_TASKS_{slug}_§4_round{N}.md` 与 audit-prompt-tasks-doc 占位符表示例一致。

- **frontmatter 与正文一致性**：frontmatter description 与正文设计目标一致。

- **audit-post-impl-rules 在引用中的可追溯性**：引用 section 已列，模式 B 收敛规则可追溯。

- **步骤 5 结论判定语义**：「结论『通过』」对应 audit 报告「完全覆盖、验证通过」，与 audit-document-iteration-rules 一致。

- **模式 B 与主流程工作流边界**：主流程 7 步适用于 TASKS 文档审计；模式 B 为独立分支，被审对象与修改者均不同。边界清晰。

- **audit-prompt-tasks-doc 模板与 Skill 步骤 3 一致性**：模板已有「每轮报告（无论通过与否）均须保存」；Skill 步骤 3 要求与步骤 7 一致，二者一致。

- **consecutive_pass_count 初始值与语义**：由「置 0」与「+1」语义隐含为 0，与 audit-document-iteration-rules 迭代流程一致。无需显式补充，主 Agent 可推断。

- **引用路径相对基准（项目根）**：引用使用 `skills/speckit-workflow/references/` 形式，在 BMAD 工作流中通常以项目根为基准；{项目根} 在步骤 3 占位符中提供。可接受。

- **audit-document-iteration-rules 在 prompt 中的可追溯性**：audit-prompt-tasks-doc 模板「审计未通过时」段落引用「详见 audit-document-iteration-rules.md」。完整路径由 Skill 引用 section 提供，主 Agent 发起审计时可确保审计子代理能访问。可接受。

- **适用场景与触发短语的覆盖**：frontmatter 与适用场景已列「对 {文档路径} 发起审计子任务」「TASKS 文档审计」等触发短语。覆盖完整。

- **强制约束与 audit-document-iteration-rules §1.1 的对应**：Skill 强制约束「发现 gap 时审计子代理须直接修改」与 audit-document-iteration-rules §1.1 完全一致。

- **步骤 2 自洽依据时需求依据路径的明确性**：已明确「{需求依据路径} 填被审文档路径」。无歧义。

- **步骤 4 code-reviewer 与 Cursor Task 的对应关系**：Skill 表述「Cursor Task 调度 code-reviewer」，与 Cursor 的 code-reviewer 子代理调度方式一致。

- **步骤 5 与步骤 6 的衔接**：步骤 5 更新 consecutive_pass_count；步骤 6 在「未达 3 轮无 gap」时发起下一轮。衔接正确。

- **步骤 7 报告路径中 slug 与 N 的提取约定**：slug 从 TASKS 文档名提取、N 为轮次，可从示例推断。主 Agent 可操作。

- **模式 B 触发时主流程 7 步是否仍适用**：模式 B 为分支场景，主流程 7 步中的步骤 1–4（解析路径、需求依据、发起审计、子代理选择）仍适用；步骤 5–7 的收敛与报告落盘在模式 B 下由 audit-post-impl-rules 与 audit-prompts §5 规定。Skill 已通过「模式 B」独立章节说明，边界清晰。

- **可解析评分块「强制」的传递链**：Skill 规定主流程报告须含可解析评分块；步骤 3 要求复制 audit-prompt-tasks-doc，该模板已含可解析评分块要求；审计子代理收到 prompt 后输出报告。传递链完整。

- **audit-prompt-impl 与模式 B 的引用完整性**：模式 B 章节已引用 references/audit-prompt-impl.md，该文件说明 §5 提示词来源及与文档审计的区别。完整。

**本轮结论**：本轮无新 gap。第 7 轮；consecutive_pass_count = 2（连续无 gap 第 2 轮）；建议累计至 3 轮无 gap 后收敛。

---

## 4. 已修改内容（审计子代理直接修改）

本轮未发现 gap，无需修改被审文档。

---

## 5. 收敛条件

本轮无 gap，consecutive_pass_count = 2。主 Agent 须再发起 1 轮审计（第 8 轮），若仍无 gap，则达成连续 3 轮无 gap，可收敛。

---

## 6. 结论

**完全覆盖、验证通过。** 本轮未发现 gap，被审文档满足设计目标与参考规范。主 Agent 可发起第 8 轮审计以完成收敛。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 95/100
- 可追溯性: 92/100
