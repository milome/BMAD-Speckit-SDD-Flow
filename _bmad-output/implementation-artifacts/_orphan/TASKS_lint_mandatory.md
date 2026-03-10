# TASKS：强制 lint 验收标准（通用化）

**分析报告**：见 [ANALYSIS_LINT_UNIVERSAL_ADAPTATION.md](./ANALYSIS_LINT_UNIVERSAL_ADAPTATION.md)。  
**Lint 矩阵**：见 [lint-requirement-matrix.md](../../../skills/speckit-workflow/references/lint-requirement-matrix.md)。

## §1 背景

经 Party-Mode 多角色辩论（批判审计员、Winston 架构师、Amelia 开发、John 产品经理）至少 100 轮深度讨论，达成共识：**所有涉及 spec/plan/tasks/prd 生成与实施后审计的 skill 及参考文件，其验收标准必须包含按项目技术栈执行对应 Lint 工具的强制执行**；若有错误或警告，**必须修复**；若项目使用某主流语言（见 lint-requirement-matrix）但**未配置**该语言的 Lint 工具，须作为重要质量问题修复，**审计不予通过**。不得以「与本次任务不相关」为由推脱。

**适用场景**：
1. 生成 epic/story/spec/plan/tasks 时的验收标准；
2. ralph-method 生成 prd 时的验收标准；
3. **所有**实施后审计的清单/验收标准。

## §2 约束

- **禁止豁免**：不得以「与本次任务不相关」「历史问题」「前置 Story 引入」等理由豁免 lint 错误或警告；
- **未配置即不通过**：若项目使用 lint-requirement-matrix 所列主流语言之一（C/C++、Java、Python、JS/TS、Go、Rust、PHP、Ruby、Swift、Kotlin、C#、Shell、Dart、Lua、R、SQL 等）但未配置该语言的 Lint 工具，须作为重要质量问题修复，**审计不予通过**；
- **按技术栈执行**：按 lint-requirement-matrix.md 所列语言→工具→命令执行；不写死 `npm run lint`。
- **「未配置」判定方式**：依据项目特征文件（如 package.json、pyproject.toml、go.mod、Cargo.toml、pom.xml 等）识别语言，再对照 lint-requirement-matrix 检查该语言是否已配置 Lint；详见 ANALYSIS 第 5 节审计检测逻辑。

## §3 任务列表（每项含修改路径、具体修改内容）

### T0: 创建 lint-requirement-matrix（前置依赖）

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/references/lint-requirement-matrix.md`
- **具体修改内容**：创建该文件，包含完整语言→项目特征→主流工具→建议执行命令映射表，以及通用引用表述（若项目使用主流语言但未配置 Lint 则审计不予通过）。
- **验收标准**：文件存在且包含 C/C++、Java、Python、JS/TS、Go、Rust、PHP、Ruby、Swift、Kotlin、C#、Shell、Dart、Lua、R、SQL 等至少 16 种语言及通用引用表述。**于项目根目录下**执行 `rg "通用引用表述|未配置.*审计不予通过" skills/speckit-workflow/references/lint-requirement-matrix.md` 能匹配（返回非空）；表格行数 `rg -c "^\|" skills/speckit-workflow/references/lint-requirement-matrix.md` 统计所得 ≥18（表头行+分隔行+至少 16 种语言数据行）。注：lint-requirement-matrix.md 文件内容不包含 "lint-requirement-matrix" 字面串，故不得以该字面串作为 rg 验收模式。

---

### T1: speckit-workflow tasks-acceptance-templates

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/references/tasks-acceptance-templates.md`
- **修改位置**：第 3 节「验收标准必备要素：生产代码实现」之后，或第 5 节「验收执行规则」块内
- **具体修改内容**：

将「## 5. 验收执行规则（块）」中现有的 `- **lint（必须）**：若项目存在...` 条目**替换**为以下内容（若块中已有 lint 条目）；若无则插入到 `- **验证通过**` 之前：

```
- **lint（必须）**：项目须按其所用技术栈配置并执行对应的 Lint 工具（见 lint-requirement-matrix.md）；验收前须执行且无错误、无警告。若项目使用主流语言但未配置该语言的 Lint 工具，须作为重要质量问题修复，审计不予通过。禁止以「与本次任务不相关」为由豁免。
```

**原文定位**：在 `- **集成测试**` 与 `- **验证通过**` 之间；并**必须同时**将「验证通过」行改为：「仅当「生产代码实现」「集成测试」及「lint」均满足，且执行情况为「通过」时，方可在「验证通过」列勾选 `[x]`。」（与 T12 第 6 节「验证通过」逻辑一致，均以 lint 为必要条件。）

- **验收标准**：修改后 `grep -E "lint|lint-requirement-matrix" skills/speckit-workflow/references/tasks-acceptance-templates.md` 能匹配；第 5 节「验收执行规则」块中明确写出「必须按技术栈执行 lint，未配置即不通过」；「验证通过」行已包含「lint」为必要条件（与 T12 一致）。

---

### T2: speckit-workflow audit-prompts §5

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/references/audit-prompts.md`
- **修改位置**：§5 审计提示词主段落内，专项审查 (8) 之后
- **具体修改内容**：

在 §5 的主审计提示词块中，在「(8)**必须**检查：评分写入失败是否 non_blocking...」之后、「必须逐条进行检查和验证」之前，新增/更新一条：

```
（9）**必须**检查：项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint，须作为未通过项；已配置的须执行且无错误、无警告。**禁止**以「与本次任务不相关」豁免。
```

即：将 §5 段落中「(8)...必须逐条进行检查和验证」之间的内容，改为包含上述 (9) 的完整段落。

- **验收标准**：`grep -E "lint|lint-requirement-matrix" skills/speckit-workflow/references/audit-prompts.md` 能匹配。

---

### T3: audit-prompts-critical-auditor-appendix 批判审计员检查维度

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
- **修改位置**：第 3 节「批判审计员检查维度」表格内
- **具体修改内容**：

将表格中现有的「lint 未通过」行**替换**为以下行（若存在）；若无则新增：

| 维度 | 说明 |
|------|------|
| lint 未通过或未配置 | 项目使用主流语言但未配置 Lint（见 lint-requirement-matrix）；或已配置但执行存在错误/警告；禁止以「与本次任务不相关」豁免 |

位置：在「验收一致性」行之后、表格结束之前。若原表格已有「lint 未通过」行，则替换之，避免重复。

- **验收标准**：`grep -E "lint|lint-requirement-matrix" skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md` 能匹配。

---

### T4: speckit-workflow SKILL §5 执行流程

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/SKILL.md`
- **修改位置**：§5.1 执行流程第 7 步「检查点验证」之后，或 §5.3 关键约束
- **具体修改内容**：

将 §5.1 中现有的 `7.1. **lint（必须）**：若项目存在 npm run lint...` **替换**为以下内容（若已有 7.1 则替换；若无则在「7. **检查点验证**」之后新增）：

```
7.1. **lint（必须）**：每完成一批任务或全部任务完成前，项目须按技术栈执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须修复；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」为由豁免。
```

- **验收标准**：`grep -E "lint|lint-requirement-matrix" skills/speckit-workflow/SKILL.md` 能匹配。

---

### T5: ralph-method SKILL acceptanceCriteria 与 Verification Commands

- **修改路径**：`{用户 home}/.cursor/skills/ralph-method/SKILL.md`（例如 Windows `C:/Users/{用户名}/.cursor/skills/ralph-method/SKILL.md`，macOS/Linux `$HOME/.cursor/skills/ralph-method/SKILL.md`）；若项目内存在 `skills/ralph-method/SKILL.md` 或 `node_modules/ralph-method/` 等本地拷贝，须同步修改对应路径
- **修改位置**：Verification Commands 段落、prd schema 的 acceptanceCriteria 说明
- **具体修改内容**：

1. 在「## Verification Commands」段落中，在 `# JavaScript/TypeScript` 的示例 `npm run build && npm test` 后追加 ` && npm run lint`；JS/TS 项目须配置 lint 脚本，未配置则审计不通过；其他语言见项目内 `skills/speckit-workflow/references/lint-requirement-matrix.md`，或 speckit-workflow 技能内 references/lint-requirement-matrix.md。

```bash
# JavaScript/TypeScript
npm run build && npm test && npm run lint
# 其他语言：见 skills/speckit-workflow/references/lint-requirement-matrix.md，按技术栈执行对应 lint 命令
```

2. 在「Every story should end with verification」之后新增一句：

```
项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 则审计不予通过；已配置的须执行且无错误、无警告。不得以「与本次任务不相关」为由豁免。
```

- **验收标准**：在 ralph-method SKILL 文件路径下执行 `grep -E "lint|lint-requirement-matrix" SKILL.md` 能匹配；prd 生成时 acceptanceCriteria 包含 lint 要求。

---

### T6: speckit-workflow audit-prompts §4（tasks 审计）

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/references/audit-prompts.md`
- **修改位置**：§4 tasks.md 审计提示词主段落，专项审查 (4)
- **具体修改内容**：

将 §4 专项审查中现有的 (4)（「执行 npm run lint（或项目等效 lint 命令）」）**替换**为以下内容，避免重复 lint 项：

```
（4）每个任务或整体验收标准是否包含「按技术栈执行 Lint（见 lint-requirement-matrix），若使用主流语言但未配置 Lint 须作为 gap；已配置的须执行且无错误、无警告」；若缺失，须作为未覆盖项列出。
```

- **验收标准**：§4 审计时检查 tasks 文档是否含 lint 验收；`grep -E "lint|lint-requirement-matrix" skills/speckit-workflow/references/audit-prompts.md` 能匹配。

---

### T7: bmad-bug-assistant audit-prompts-section5 与 BUG-A4-POSTAUDIT

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-bug-assistant/references/audit-prompts-section5.md`、`d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-bug-assistant/SKILL.md`
- **修改位置**：audit-prompts-section5 的「审计内容」、BUG-A4-POSTAUDIT 模板
- **具体修改内容**：

1. 在 `skills/bmad-bug-assistant/references/audit-prompts-section5.md` 的「审计内容」列表中，**替换**现有的第 6 条（lint 相关，当前为「若项目存在 npm run lint 或等效脚本…」）为以下内容；若不存在 lint 项则在第 5 条之后插入：

```
6. 项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须作为未通过项；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」豁免。
```

2. 在 `skills/bmad-bug-assistant/SKILL.md` 的 BUG-A4-POSTAUDIT 模板「审计内容」中，**替换**现有的 lint 相关项（若存在）为上述内容；若不存在则在项 5 之后插入（原 6–10 顺延为 7–11）。**禁止**同时保留旧版 lint 与新版 lint，避免重复项。

- **验收标准**：`grep -E "lint|lint-requirement-matrix" skills/bmad-bug-assistant/references/audit-prompts-section5.md skills/bmad-bug-assistant/SKILL.md` 能匹配两文件。

---

### T8: bmad-story-assistant 阶段四实施后审计

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-story-assistant/SKILL.md`
- **修改位置**：阶段四「审计维度」、STORY-A4-POSTAUDIT 相关描述
- **具体修改内容**：

在阶段四「审计维度」列表中，在「3. 代码质量：是否符合项目编码规范」之后新增：

```
3.1. lint：项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须作为未通过项；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」豁免。
```

并确保阶段四使用的 audit-prompts §5 已含 T2 的修改（即 §5 已纳入 lint 检查）。

- **验收标准**：`grep -E "lint|lint-requirement-matrix" skills/bmad-story-assistant/SKILL.md` 能匹配。

---

### T9: bmad-standalone-tasks Step 2 审计 prompt

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-standalone-tasks/SKILL.md`、`d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-standalone-tasks/references/prompt-templates.md`
- **修改位置**：Step 2 的「§5 审计项」、Audit sub-task 模板
- **具体修改内容**：

将「## §5 审计项」列表中现有的第 7 项（若项目存在 npm run lint...）**替换**为以下内容；若当前仅 6 项则新增为第 7 项：

```
7. 项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须作为未通过项；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」豁免。
```

修改位置：SKILL.md 第 88–120 行附近、prompt-templates.md 的 Audit sub-task 模板对应位置。

- **验收标准**：`grep -E "lint|lint-requirement-matrix" skills/bmad-standalone-tasks/SKILL.md skills/bmad-standalone-tasks/references/prompt-templates.md` 能匹配两文件。

---

### T10: speckit.implement 命令

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/commands/speckit.implement.md`、`d:/Dev/BMAD-Speckit-SDD-Flow/.cursor/commands/speckit.implement.md`
- **修改位置**：Step 9「Completion validation」
- **具体修改内容**：

将 Step 9「Completion validation」中现有的 `若项目存在 npm run lint，执行...` 条目**替换**为以下内容（两处 commands 文件均须修改）；若无则插入到「Validate that tests pass」段落中：

```
- 项目须按技术栈执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须修复；已配置的须执行且无错误、无警告，方可宣布完成。
```

- **验收标准**：`grep -E "lint|lint-requirement-matrix" commands/speckit.implement.md .cursor/commands/speckit.implement.md` 能匹配两文件。

---

### T11: bmad-standalone-tasks-doc-review audit-prompt-tasks-doc（TASKS 文档审计）

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-tasks-doc.md`
- **修改位置**：「审计要求」列表第 6 项
- **具体修改内容**：

将「审计要求」中现有的第 6 项（lint 验收，若存在「执行 npm run lint」等旧表述）**替换**为以下内容；若无则新增：

```
6. **lint 验收**：任务列表或整体验收标准是否包含「按技术栈执行 Lint（见 lint-requirement-matrix），若使用主流语言但未配置 Lint 须作为 gap；已配置的须执行且无错误、无警告」；若缺失且涉及生产代码任务，须作为 gap 列出。
```

- **验收标准**：`grep -E "lint|lint-requirement-matrix" skills/bmad-standalone-tasks-doc-review/references/audit-prompt-tasks-doc.md` 能匹配。

---

### T12: tasks-acceptance-templates 验收执行说明（简短版）

- **修改路径**：`d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/references/tasks-acceptance-templates.md`
- **修改位置**：第 6 节「验收执行说明（简短版）」
- **具体修改内容**：

将第 6 节中现有的 `- **lint（必须）**：若项目存在 npm run lint...` 条目**替换**为以下内容（若该节已有 lint 条目）；若无则插入到「- **验证通过**」之前：

```
- **lint（必须）**：项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须修复；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」豁免。
```

**原文定位**：在 `- **集成测试**` 与 `- **验证通过**` 之间；并**必须同时**将第 6 节的「验证通过」行改为：「仅当「生产代码实现」「集成测试」及「lint」均满足，且「执行情况」为通过时，方可在「验证通过」列打勾 `[x]`。」——原第 6 节「验证通过」仅列「生产代码实现」与「集成测试」，未包含 lint，替换 lint 条目后须同步修正，否则验收逻辑矛盾。

- **验收标准**：第 6 节含 lint 且为按技术栈表述；「验证通过」行已包含 lint 作为必要条件（与 T1 第 5 节逻辑一致）；`grep -E "lint|lint-requirement-matrix" skills/speckit-workflow/references/tasks-acceptance-templates.md` 能匹配。

---

## §4 验收汇总

- **T0**：lint-requirement-matrix.md 已创建且包含至少 16 种语言及通用引用表述；
- **T1、T12**：对 tasks-acceptance-templates 第 5、6 节的「验证通过」修改须一致，均以 lint 为必要条件；
- **所有涉及 spec/plan/tasks/prd 生成的 skill** 均在验收标准中纳入按技术栈执行 Lint（引用 lint-requirement-matrix）；
- **所有实施后审计清单** 均包含 lint 检查项（含「未配置即不通过」）；
- **禁止** 以「与本次任务不相关」为由豁免 lint 错误/警告；
- 修改后**于项目根目录下**执行：`rg -l "lint|lint-requirement-matrix" skills/ commands/ .cursor/commands/` 应匹配上述项目内全部修改路径（含 T10 的 .cursor/commands/speckit.implement.md）。T5 ralph-method 若安装在 `~/.cursor/skills/ralph-method` 等项目外路径，需于该路径下手动执行验收命令。
