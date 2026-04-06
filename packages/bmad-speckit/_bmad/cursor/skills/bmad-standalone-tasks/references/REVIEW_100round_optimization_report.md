# bmad-standalone-tasks 技能 100 轮深度分析评审报告

**被审技能**：`bmad-standalone-tasks`（SKILL.md + references/prompt-templates.md）  
**评审视角**：产品经理、架构师、批判审计员、开发代表  
**产出**：优化建议清单、可替换 SKILL 片段、prompt-templates 增补

---

## 一、优化建议清单

| 编号 | 角色视角 | 问题描述 | 建议修改或补充内容 | 建议插入位置 |
|-----|----------|----------|--------------------|--------------|
| O1 | 产品/流程 | 触发条件未覆盖「工作目录」「分支名」等可选输入，多文档并存时可能冲突 | 在「When to use」下增加：可选输入——工作目录（默认项目根）、分支名（若 ralph 需 branchName）；多文档并存时以用户首次指定的文档为主，prd/progress 命名随该文档 stem，避免同目录多任务交叉 | SKILL.md § When to use 与 § Hard constraints 之间新增小节「可选输入与多文档约定」 |
| O2 | 产品/流程 | 未完成任务清单的「未完成」由谁判定、从哪读取未明确 | 明确：主 Agent 解析文档路径后，从文档中识别未完成项（如 §7 任务列表、未勾选项、标注 TODO/未完成的节）；若文档无显式未完成标记，则约定「按文档内任务/US 顺序，与同目录 progress 文件对比，未在 progress 中出现且未标记 passes 的视为未完成」 | SKILL.md § Step 1 之前增加「前置：解析未完成任务清单」 |
| O3 | 架构/实施 | generalPurpose 子代理可能未加载 ralph-method、speckit-workflow，导致 prd 结构或 TDD 理解不一致 | 在实施 prompt 模板开头显式增加：「请先读取并遵循 ralph-method 技能（prd/progress 命名与 schema）、speckit-workflow 技能（TDD 红绿灯、15 条铁律、验收命令），再执行下方任务。」并注明技能路径：全局 skills 下 ralph-method、speckit-workflow | prompt-templates.md 实施模板首段 + SKILL.md Step 1 说明 |
| O4 | 架构/实施 | TASKS/BUGFIX 文档若仅含扁平任务列表（无 US-001 等 id），prd 生成方式未定义 | 补充：若文档无 US 结构，子代理须将文档中的可验收任务条目标号为 US-001、US-002…（或与文档原有编号一一映射），生成符合 ralph-method prd.json schema 的 prd；progress 中记录相同 id；若文档已有 §7 等带编号任务，可优先采用文档编号作为 US id 以保持可追溯 | SKILL.md § Hard constraints → ralph-method 段；prompt-templates.md 新增「无 US 结构时的 prd 生成说明」 |
| O5 | 架构/实施 | ralph-method 技能前置条件为「tasks.md 已存在」，本技能输入为 BUGFIX/TASKS 文档，存在语义冲突 | 在技能中显式写清：本技能为「standalone」用法，不要求先有 speckit 产出的 tasks.md；ralph-method 的 prd/progress 命名与更新节奏在此处沿用，但 US 来源为当前 TASKS/BUGFIX 文档，与 ralph-method 中「prd 与 tasks.md 一致」的表述并存时，以本技能约定为准（即 prd 与当前文档一致） | SKILL.md § References 之前新增「与 ralph-method / speckit-workflow 的衔接」小节 |
| O6 | 批判审计员 | 「批判审计员发言占比 >50%」在 code-reviewer 子任务中无可操作定义，执行时难以验证 | 在审计 prompt 中增加可操作定义：审计报告须包含独立段落「## 批判审计员结论」，且该段落字数或条目数不少于报告其余部分（即占比 >50%）；或明确：报告由「逐项审计结果」与「批判审计员结论」两部分组成，后者须单独成段并注明「批判审计员视角」，且篇幅占比 >50% | prompt-templates.md 审计模板「批判审计员」段；SKILL.md Step 2 Requirements |
| O7 | 批判审计员 | 「3 轮无 gap」的「轮」是否与「同一审计结论连续 3 次」一致未定义，易产生歧义 | 明确：一轮 = 一次完整审计子任务调用；「连续 3 轮无 gap」= 连续 3 次审计结论均为「完全覆盖、验证通过」且该 3 次报告中批判审计员结论段均注明「本轮无新 gap」；若任一轮出现「未通过」或「存在 gap」，则从下一轮重新计数，不累计 | SKILL.md Step 2 收敛条件；prompt-templates.md 输出与收敛段 |
| O8 | 批判审计员 | 禁止主 Agent 改生产的表述缺少路径与工具列举，主 Agent 可能误用 write/search_replace | 在「Main Agent prohibitions」中列举：禁止对以下路径执行 `search_replace`、`write`、`edit`：`vnpy/`、`*datafeed*`、`*/engine.py`、以及 TASKS/BUGFIX 文档中列为实现目标的任何路径；允许：同目录下 `prd.{stem}.json`、`progress.{stem}.txt` 的创建/更新可由子代理完成，主 Agent 仅允许编辑说明性文件（如 README、本 SKILL、artifact 目录下 .md） | SKILL.md § Step 3 与 § Hard constraints 第 1 条 |
| O9 | 可执行性 | 占位符 {DOC_PATH}、{任务清单} 的填写责任与数据来源未在 SKILL 中集中说明 | 在 SKILL.md 中增加「占位符说明」：{DOC_PATH} 由主 Agent 在解析用户输入后填写，为 TASKS/BUGFIX 文档的绝对路径或相对项目根的路径；{任务清单} 由主 Agent 从文档中提取未完成项后填写，格式示例：§7 T7a-1～T7a-9、§3 第 2～5 条 | SKILL.md Step 1 下方「DOC_PATH」段扩展为「占位符说明」小节 |
| O10 | 可执行性 | 实施分多批（如先 T7a 再 T7b）时，resume 如何传递「当前做到哪一批」未说明 | 约定：resume 时主 Agent 在 prompt 中显式传入「上一批已完成范围」与「本批待执行范围」，例如：「上一批已完成：§7 T7a-1～T7a-9；本批请从 T7b-1 开始执行至 T7b-10」。并建议在 references 中增加「Resume 专用 prompt」模板 | prompt-templates.md 新增「Resume 实施子任务」模板；SKILL.md Main Agent responsibilities 中「resume」一句扩展 |
| O11 | 边界与错误 | 文档路径不存在、子 agent 返回错误或超时时无处理约定 | 补充：若文档路径不存在，主 Agent 应向用户报错并列出已解析出的路径，不发起实施子任务；若子 agent 返回错误或超时，主 Agent 可发起一次 resume（若存在 agent ID），否则重新发起新的 mcp_task 并注明「上次未完成，请从 progress 文件或下列断点继续」；不替代子 agent 直接改代码 | SKILL.md 末尾新增「错误与边界处理」小节 |
| O12 | 边界与错误 | 主 Agent 是否允许编辑 progress/prd 文件未明确 | 明确：主 Agent **禁止**直接编辑 prd.*.json 与 progress.*.txt（这些由子代理按 ralph-method 维护）；主 Agent 仅允许编辑说明性/文档类 artifact（如 README、技能自身、审计结论记录 .md） | SKILL.md § Step 3 与 § Hard constraints |
| O13 | 架构/实施 | mcp_task 若不支持 subagent_type=code-reviewer，当前 Step 2 会失败 | 增加调用策略：优先使用 Cursor Task 调度 code-reviewer（若存在 .cursor/agents/code-reviewer.md 或 .claude/agents/code-reviewer.md）；若通过 mcp_task 调用且环境不支持 code-reviewer，则使用 subagent_type=generalPurpose 并将完整审计 prompt（含 §5 与批判审计员、3 轮无 gap 要求）传入，并在报告中注明「未使用 code-reviewer 子类型，使用 generalPurpose + 审计 prompt」 | SKILL.md Step 2 整段；prompt-templates.md 审计模板说明 |

---

## 二、可直接替换的 SKILL.md 片段

### 2.1 替换「When to use」与「可选输入」段（建议插入 O1）

**位置**：紧接 `## When to use` 段落后。

**替换为**：

```markdown
## When to use

- User says: **"/bmad 按 {用户输入的文档} 中的未完成任务实施"** or equivalent (e.g. "按 BUGFIX_xxx.md 实施", "按 TASKS_xxx.md 执行").
- Input: one **document path** (TASKS_*.md, BUGFIX_*.md, or similar task list with clear items and acceptance).

### 可选输入与多文档约定

- **工作目录**：未指定时默认为项目根；若用户指定工作目录，主 Agent 将 DOC_PATH 解析为该目录下的相对或绝对路径。
- **分支名**：若 ralph-method 的 prd 需要 branchName，可由子代理从文档或环境推断，或由用户显式提供。
- **多文档并存**：若用户同时提及多份 TASKS/BUGFIX 文档，以用户**首次明确指定的单份文档**为准；prd/progress 命名仅随该文档 stem，避免同目录多任务交叉导致文件覆盖。
```

### 2.2 替换「Step 2」审计调用策略（建议 O13）

**位置**：`## Step 2: Audit sub-task (after implementation)` 下，`**Tool**: mcp_task` 至 `**Requirements**:` 之间。

**替换为**：

```markdown
**Tool**: 优先 Cursor Task 调度 code-reviewer；若不可用则 `mcp_task`。  
**subagent_type**（仅 mcp_task 时）：若环境支持 `code-reviewer` 则使用；否则使用 `generalPurpose` 并传入完整审计 prompt（含 §5、批判审计员占比 >50%、3 轮无 gap），在审计报告开头注明「未使用 code-reviewer 子类型，使用 generalPurpose + 审计 prompt」。

**Requirements**:
```

### 2.3 替换「Step 3」禁止项（建议 O8、O12）

**位置**：`## Step 3: Main Agent prohibitions (reminder)` 整段。

**替换为**：

```markdown
## Step 3: Main Agent prohibitions (reminder)

- **禁止** 对以下路径或目标执行 `search_replace`、`write`、`edit`：`vnpy/`、`*datafeed*`、`*/engine.py`、以及 TASKS/BUGFIX 文档中列为实现目标的任何路径；禁止直接编辑 `prd.{stem}.json` 与 `progress.{stem}.txt`（由子代理按 ralph-method 维护）。
- **禁止** 用主 Agent 直接实现任务以替代 subagent；若 subagent 返回不完整，只能通过 **mcp_task resume** 或再次发起新的 mcp_task 继续，不得自行改代码。
- **允许** 主 Agent 仅编辑说明性/文档类文件（如 README、本 SKILL.md、artifact 目录下 .md），以配合审计结论或记录进度。
```

### 2.4 新增「与 ralph-method / speckit-workflow 的衔接」（建议 O5）

**位置**：`## References` 之前插入新小节。

**插入内容**：

```markdown
## 与 ralph-method / speckit-workflow 的衔接

- **Standalone 用法**：本技能不要求先存在 speckit 产出的 tasks.md；US 与 prd 来源为当前 TASKS/BUGFIX 文档。与 ralph-method 中「prd 与 tasks.md 一致」并存时，以本技能约定为准：prd 与**当前文档**一致。
- **无 US 结构时**：若文档仅有扁平任务列表，子代理须将每条可验收任务映射为 US-001、US-002…（或采用文档原有编号），生成符合 ralph-method prd.json schema 的 prd，并保持 progress 与 prd 的 id 一致。
- **技能加载**：实施子任务 prompt 中已要求子代理先读取 ralph-method 与 speckit-workflow 技能再执行，确保 prd 结构与 TDD/验收约束一致。
```

### 2.5 新增「错误与边界处理」（建议 O11）

**位置**：`## References` 之后、文件末尾。

**插入内容**：

```markdown
## 错误与边界处理

- **文档路径不存在**：主 Agent 解析用户输入得到路径后，若该路径不存在，应向用户报错并列出已解析路径，不发起实施子任务。
- **子 agent 错误或超时**：若有返回的 agent ID，主 Agent 可发起一次 **resume**；否则重新发起新的 mcp_task，并在 prompt 中注明「上次未完成，请从同目录 progress 文件或下列断点继续」，不替代子 agent 直接改生产代码。
- **主 Agent 禁止编辑**：prd.*.json、progress.*.txt 仅由子代理维护；主 Agent 不得为「补写 progress」等理由直接编辑上述文件。
```

---

## 三、prompt-templates.md 的增补

### 3.1 实施模板首段增补（建议 O3）

在现有实施模板「你正在按 **TASKS/BUGFIX 文档**…」之前增加一段：

```markdown
**前置（必须）**：请先读取并遵循以下技能再执行下方任务：
- **ralph-method**：prd/progress 命名规则与 schema（与当前文档同目录、prd.{stem}.json / progress.{stem}.txt）、每完成一 US 更新 prd 与 progress。
- **speckit-workflow**：TDD 红绿灯、15 条铁律、验收命令、架构忠实；禁止伪实现与占位。
技能路径：全局 skills 目录下的 ralph-method、speckit-workflow。

---
```

### 3.2 无 US 结构时的 prd 生成说明（建议 O4）

在 `prompt-templates.md` 中「Implementation sub-task」节末尾、代码块之后增加：

```markdown
#### 无 US 结构时的 prd 生成

当文档仅为扁平任务列表（无 US-001 等 id）时，子代理须：
1. 将文档中每条可验收任务依次标号为 US-001、US-002、…（或与文档已有编号如 T7a-1 一一映射，并在 prd 的 userStories[].id 中使用一致 id）。
2. 生成符合 ralph-method 的 prd.json（含 userStories、acceptanceCriteria、passes 等）。
3. progress 文件中记录的完成项与 prd 中的 id 一致。
4. 若文档存在 §7 等带编号任务列表，优先采用该编号作为 US id 以保持可追溯。
```

### 3.3 Resume 专用 prompt（建议 O10）

在 `prompt-templates.md` 中新增一节：

```markdown
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
```

### 3.4 审计模板中「批判审计员」可操作定义（建议 O6、O7）

在审计模板「## 批判审计员」段替换为：

```markdown
## 批判审计员
从对抗视角检查：遗漏任务、行号或路径失效、验收命令未跑、V5/验收误伤或漏网。
**可操作要求**：报告须包含独立段落「## 批判审计员结论」，且该段落字数或条目数不少于报告其余部分（即占比 >50%）；结论须明确「本轮无新 gap」或「本轮存在 gap」及具体项。

## 输出与收敛
- 结论须明确：**「完全覆盖、验证通过」** 或 **「未通过」**（并列 gap 与修改建议）。
- **一轮** = 一次本审计子任务的完整调用。「连续 3 轮无 gap」= 连续 3 次结论均为「完全覆盖、验证通过」且该 3 次报告中批判审计员结论段均注明「本轮无新 gap」；若任一轮为「未通过」或「存在 gap」，则从下一轮重新计数。
- 若通过且批判审计员无新 gap：注明「本轮无新 gap，第 N 轮；建议累计至 3 轮无 gap 后收敛」。
- 若未通过：注明「本轮存在 gap，不计数」，修复后再次发起本审计，直至连续 3 轮无 gap 收敛。
```

---

## 四、小结

- **优化建议**：共 13 条，覆盖触发与输入、prd/US 映射、子代理技能加载、审计可操作定义、占位符与 resume、错误与边界、code-reviewer 回退策略。
- **SKILL.md**：5 处替换/新增（可选输入与多文档、Step 2 调用策略、Step 3 禁止项、衔接说明、错误与边界）。
- **prompt-templates.md**：4 处增补（实施前置技能、无 US 结构 prd 说明、Resume 模板、审计批判审计员与 3 轮定义）。

主 Agent 可直接按上述编号与位置修改技能与模板，无需再跑 100 轮辩论；若需与现有 bmad-bug-assistant / bmad-story-assistant 的审计约定统一，可再将「audit-prompts §5」的引用路径与 code-reviewer 优先策略与彼处对齐。
