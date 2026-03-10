# Skill 文档审计报告：bmad-standalone-tasks-doc-review

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
| 本轮次 | 第 1 轮 |

---

## 2. 审计项逐条验证

### 2.1 需求覆盖

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 技能描述覆盖设计目标 | ✅ | 对 TASKS 严格审计、批判审计员 >70%、3 轮无 gap、审计子代理直接修改文档均有描述 |
| 适用场景完整 | ✅ | 用户发起审计、质量门控、3 轮收敛三种场景已覆盖 |
| 强制约束完整 | ✅ | 批判审计员、收敛条件、发现 gap 时行为、子代理类型均有表格 |
| 工作流完整 | ✅ | 解析路径→需求依据→发起审计→子代理选择→收敛检查→迭代→报告落盘 7 步 |
| 遗漏章节 | ⚠️→✅ | 原缺：需求依据为 TASKS 自身时占位符说明、报告保存时机、code-reviewer 不可用判定、audit-post-impl-rules 完整路径；已通过直接修改补充 |

### 2.2 可执行性

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 工作流步骤可操作 | ✅ | 每步有明确动作与产出 |
| 引用路径正确 | ✅ | skills/speckit-workflow/references/* 存在且可访问 |
| references/audit-prompt-tasks-doc.md 存在 | ✅ | 已验证 |
| references/audit-prompt-impl.md 存在 | ✅ | 已验证 |
| 子代理调度方式明确 | ⚠️→✅ | 原缺「不可用」可操作定义；已补充「Cursor Task 不存在、调用失败或超时」 |

### 2.3 依赖与一致性

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 与 audit-document-iteration-rules 一致 | ✅ | 审计子代理直接修改、3 轮针对被审文档、迭代流程一致 |
| 与 audit-prompts §4 一致 | ✅ | TASKS 审计精神、可解析评分块四维一致 |
| 与 audit-prompts-critical-auditor-appendix 一致 | ✅ | 批判审计员必填结构、检查维度、strict 模式 3 轮收敛一致 |
| 模式 B 与主流程无矛盾 | ✅ | 主流程审文档、模式 B 审实现，场景分离清晰 |
| 内部逻辑自洽 | ✅ | 工作流与强制约束、引用之间无冲突 |

### 2.4 边界与遗漏

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 批判审计员 >70% 约束明确 | ✅ | 强制约束表、audit-prompt-tasks-doc 模板均有 |
| 3 轮无 gap 收敛条件清晰 | ✅ | 强制约束表、工作流收敛检查、迭代步骤均有 |
| 发现 gap 时「审计子代理直接修改」强调 | ✅ | 强制约束表、工作流、引用 audit-document-iteration-rules 均有 |
| 报告保存时机 | ⚠️→✅ | 原工作流「每轮报告保存」与模板「审计通过时」存在歧义；已明确「每轮报告（无论通过与否）均须保存」且主 Agent 须在 prompt 中明确 |

### 2.5 可解析评分块

| 审计项 | 结果 | 说明 |
|--------|------|------|
| 报告格式要求完整 | ✅ | 总体评级 A/B/C/D、四维评分均有 |
| 维度与 parseAndWriteScore 兼容 | ✅ | 需求完整性、可测试性、一致性、可追溯性与 audit-prompts §4.1 一致 |

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、引用路径失效、约束表述歧义、工作流不可落地、audit-prompts §5 与 §4 引用混淆、报告保存时机、子代理不可用判定、需求依据占位符、模式 B 引用路径。

**每维度结论**：

- **遗漏需求点**：设计目标为 TASKS 严格审计、批判审计员 >70%、3 轮无 gap、审计子代理直接修改。技能描述、适用场景、强制约束、工作流已覆盖；原缺需求依据为 TASKS 自身时占位符说明，已补充。
- **边界未定义**：原「code-reviewer 不可用」未定义，易导致主 Agent 判断不一致；已补充「Cursor Task 不存在、调用失败或超时」为可操作判定。
- **验收不可执行**：工作流各步均有明确动作，可执行；引用路径已验证存在。
- **与前置文档矛盾**：与 audit-document-iteration-rules、audit-prompts §4、audit-prompts-critical-auditor-appendix 无矛盾。模式 B 引用 audit-post-impl-rules 原仅写文件名，与其他引用风格不一致；已改为完整路径。
- **引用路径失效**：skills/speckit-workflow/references/*、references/audit-prompt-tasks-doc.md、references/audit-prompt-impl.md 均存在。audit-post-impl-rules 原未给路径，已补全。
- **约束表述歧义**：原「报告落盘」与模板「审计通过时」存在歧义，可能被理解为未通过不保存；已明确每轮均须保存且主 Agent 须在 prompt 中明确。
- **工作流不可落地**：步骤 2 原未说明需求依据为 TASKS 自身时 {需求依据路径} 的填法；已补充「填被审文档路径」。
- **audit-prompts §5 与 §4 引用混淆**：本技能主流程为 TASKS 文档审计，对应 §4 精神；模式 B 为实施后审计，对应 §5。两者场景分离，无混淆。SKILL 引用正确。
- **报告保存时机**：已通过修改消除歧义。
- **子代理不可用判定**：已补充可操作定义。
- **需求依据占位符**：已补充自洽依据时的填法。
- **模式 B 引用路径**：已补全 audit-post-impl-rules 路径。

**本轮结论**：本轮存在 gap。具体项：1) audit-post-impl-rules 引用路径不完整；2) 报告保存时机与模板存在歧义；3) code-reviewer 不可用无可操作判定；4) 需求依据为 TASKS 自身时 {需求依据路径} 未说明。不计数；已直接修改被审文档消除上述 gap，修复后主 Agent 发起下一轮审计。

---

## 4. 已修改内容（审计子代理直接修改）

以下修改已直接应用于 `skills/bmad-standalone-tasks-doc-review/SKILL.md`：

1. **工作流步骤 2**：在「否则以 TASKS 自身为自洽依据」后补充「（此时 `{需求依据路径}` 填被审文档路径）」。
2. **工作流步骤 4**：将「若 code-reviewer 不可用」改为「若 code-reviewer 不可用（如 Cursor Task 不存在、调用失败或超时）」。
3. **工作流步骤 7**：将「每轮报告保存至」改为「每轮报告（无论通过与否）均须保存至」，并补充「主 Agent 发起审计时须在 prompt 中明确此要求」。
4. **模式 B**：将「收敛规则见 audit-post-impl-rules.md」改为「收敛规则见 `skills/speckit-workflow/references/audit-post-impl-rules.md`」。

---

## 5. 收敛条件

本轮存在 gap，不计数。已直接修改被审文档消除 gap。主 Agent 收到本报告后发起下一轮审计。

---

## 6. 结论

**验证未通过**。本轮发现 4 项 gap，已由审计子代理直接修改被审文档消除。建议主 Agent 发起第 2 轮审计以验证修改后的文档。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: B

维度评分:
- 需求完整性: 85/100
- 可测试性: 88/100
- 一致性: 82/100
- 可追溯性: 90/100
