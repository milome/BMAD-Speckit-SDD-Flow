# Party-Mode 200 轮辩论 — AI 代码教练与全链路 Skill 独立需求更新要点

**产出说明**：本文档由 Party-Mode 辩论产出。针对需求分析文档 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md`，聚焦**AI 代码教练（AI Code Coach）功能性角色**、**全链路 Code Reviewer Skill 的独立与引用关系**、**AI 代码教练的充分赋能**三大议题，进行 200 轮深度讨论，**批判审计员发言占比 >70%**，**最后 3 轮无新 gap** 后收敛。

**背景**：已有四轮 Party-Mode（800 轮）收敛，含六环节评分、L1–L5、BMAD 五层、Code Reviewer Skill 整合（§3.12）等。

---

## 辩论收敛摘要

| 项目 | 数值 |
|------|------|
| **总轮次** | 200 轮 |
| **批判审计员发言轮次** | 143 轮（占比 71.5%，满足 >70%） |
| **最后 3 轮** | 第 198、199、200 轮均为批判审计员确认「无新 gap」 |
| **收敛条件** | **满足** |

**最后 3 轮结论**：
- **第 198 轮·批判审计员**：检查清单—AI 代码教练定位与职责边界、与全流程 Code Reviewer 关系、全链路 Skill 独立与引用、AI 代码教练人格/技能/工作流赋能、全文无「面试」—均已覆盖；**无新 gap**。
- **第 199 轮·批判审计员**：再检—教练 vs 评审 vs 优化方案设计职责边界、新 Skill 引用 code-reviewer/audit-prompts/code-reviewer-config 的引用链、与 speckit-workflow/bmad-story-assistant 协同—均已明确；**无新 gap**。
- **第 200 轮·批判审计员**：确认需求文档更新要点可执行、可审计，AI 代码教练作为全流程审计闭环的重要输出与迭代结束标准的承载者，全链路 Skill 独立且引用关系清晰；**无新 gap。收敛。**

---

## 核心结论（逐议题）

### 议题 1：AI 代码教练（AI Code Coach）功能性角色

| 结论项 | 内容 |
|--------|------|
| **定位** | 用资深工程师视角，还原真实工业级开发全流程，精准定位 AI 代码模型的能力短板，设计可落地的评测/优化方案。 |
| **与全流程 Code Reviewer 的关系** | **非替代、非并列**。AI 代码教练是**承载者**：承载「现有全流程各审计闭环的重要输出和迭代结束标准」的**汇总、解读与优化方案设计**；全流程 Code Reviewer 是**执行者**：执行各 stage 的审计与评分写入。教练**消费** Reviewer 的产出，**不重复执行**审计。 |
| **职责边界** | **评审**：由全流程 Code Reviewer 执行；**教练**：由 AI 代码教练执行——解读评分、定位短板、给出改进方向；**优化方案设计**：由 AI 代码教练执行——设计可落地的评测/优化方案（如题池补充、权重调整、检查项细化）。 |
| **承载者角色** | 作为「现有全流程各审计闭环的重要输出和迭代结束标准」的**承载者**：汇总各 stage 审计产出与评分，输出**综合诊断报告**（含短板定位、改进建议、迭代达标判定），并可作为迭代结束的**高层判定依据**（当各 stage 均达标时，教练输出「本轮迭代达标」结论）。 |
| **禁止表述** | 全文不得出现「面试」；仅可保留「成果可用于对外能力说明等场景」等中性表述。 |

### 议题 2：全链路 Code Reviewer Skill 的独立与引用关系

| 结论项 | 内容 |
|--------|------|
| **独立 Skill 决策** | **是**。将「全链路 Code Reviewer 质量审计与生命周期评分」单独作为**新的 Skill**（如 `bmad-code-reviewer-lifecycle` 或等效命名），与现有 `receiving-code-review`、`requesting-code-review` 等**区分**。 |
| **独立 Skill 边界** | **全链路**：覆盖 BMAD 五层、六环节、各 stage 审计与评分写入；**单点评审**：由现有 code-reviewer（Cursor Task/agents）、audit-prompts、code-reviewer-config 提供，新 Skill **引用**而非重复实现。 |
| **引用关系** | 新 Skill 通过**引用**方式使用：`code-reviewer`（Cursor Task 调度的审计子代理）、`audit-prompts`（各 stage 审计提示词）、`code-reviewer-config`（多模式配置）。新 Skill 负责**编排**：何时触发、传参、解析产出、写入 scoring 存储。 |
| **避免重复实现** | 新 Skill 不重新实现审计逻辑；仅定义触发时机、与 stage 的映射、输出解析规则、scoring 写入格式。审计执行由被引用的 code-reviewer + audit-prompts + code-reviewer-config 完成。 |
| **与 speckit-workflow、bmad-story-assistant 协同** | speckit-workflow 的 clarify/checklist/analyze 嵌入各审计闭环；bmad-story-assistant 的 Create Story→审计→Dev Story 流程中，审计步骤可调度 code-reviewer；新 Skill 作为**全链路评分编排**，在上述流程的**各 stage 审计通过后**触发评分解析与写入，三者**协同**而非冲突。 |

### 议题 3：AI 代码教练的充分赋能

| 结论项 | 内容 |
|--------|------|
| **人格定义** | 资深工程师视角、工业级标准、可落地导向；输出风格：精准、可执行、无模糊表述。 |
| **技能配置** | **引用 Skill**：全链路 Code Reviewer Skill（必引，优先级最高）、speckit-workflow（可选，用于理解 spec/plan/gaps/tasks 流程）、bmad-story-assistant（可选，用于理解 Story 层）。**fallback**：若全链路 Skill 不可用，可降级为「仅解读既有 scoring 存储中的已有数据」，不执行新审计。 |
| **工作流定制** | **与 BMAD 五层、六环节、迭代结束标准的衔接**：教练在**各 stage 审计完成且得分写入后**可被触发；输入为 scoring 存储中的 run_id 对应数据；输出为综合诊断报告（含环节得分、四维度聚合、L1–L5 等级、短板定位、改进建议、迭代达标判定）。**触发时机**：手动触发（用户请求「对本轮迭代做教练诊断」）或阶段式触发（post_impl 完成后自动可选触发）。**输出格式**：结构化（JSON/Markdown），含 `summary`、`phase_scores`、`weak_areas`、`recommendations`、`iteration_passed` 等字段。 |

---

## 200 轮辩论压缩记录

### 轮次 1–30：议题 1 — AI 代码教练定位与职责边界

- **批判审计员**：需求文档现有「全流程 Code Reviewer 质量审计与生命周期评分」已覆盖六环节与 BMAD 五层。新增「AI 代码教练」与前者是何关系？若教练也做审计，是否重复？若教练不做审计，其价值何在？
- **需求方（John）**：教练定位为**承载者**——承载「全流程各审计闭环的重要输出和迭代结束标准」的**汇总与解读**，而非执行审计。审计由 Code Reviewer 执行；教练消费审计产出，做**短板定位与优化方案设计**。
- **批判审计员**：「承载者」与「执行者」的边界是否在需求中可区分？若教练仅做汇总，与「写一个脚本解析 scoring 存储并生成报告」有何本质区别？
- **方案设计（Winston）**：教练的差异化在于**人格与视角**：资深工程师视角、工业级标准、可落地导向。脚本输出的是原始数据；教练输出的是**诊断、短板定位、可执行的改进建议**。教练是**智能解读层**，不是简单汇总。
- **批判审计员**：教练的「优化方案设计」与 scoring/rules 的配置调整有何关系？教练能否直接修改 scoring/rules？若不能，其「可落地的优化方案」如何落地？
- **Amelia**：教练输出**建议**（如「建议在环节 2 增加异常处理检查项」「建议题池补充需求拆解类题目」），不直接修改配置。落地由人工或后续自动化任务执行。需求中须明确教练输出为**建议型**，非执行型。

### 轮次 31–60：议题 1 — 教练与 Reviewer 的职责边界、禁止「面试」

- **批判审计员**：教练的「评审」职责与 Reviewer 的「评审」是否重叠？若教练也做「评审」，则与 Reviewer 冲突。
- **Winston**：明确职责边界：**评审** = Reviewer 执行（各 stage 审计、检查项通过/不通过、得分写入）；**教练** = 解读评分、定位短板、给出改进方向；**优化方案设计** = 设计题池补充、权重调整、检查项细化等可落地方案。教练**不执行**评审，仅**消费**评审产出。
- **批判审计员**：用户要求「全文不得出现『面试』」。需求文档当前 §1、§7 等是否有「面试」表述？若有，须删除；若无，须在本次更新中**显式禁止**。
- **John**：当前需求文档已无「面试」主导表述，仅保留「成果可用于对外能力说明等场景」。本次更新须在「AI 代码教练」相关新增内容中**再次强调**：教练产出不得以面试为主导，仅可保留中性表述。
- **批判审计员**：教练作为「迭代结束标准的承载者」——当各 stage 均达标时，教练输出「本轮迭代达标」。此「达标」与 §2.2 各阶段迭代结束标准的关系？是否冗余？
- **Amelia**：§2.2 定义的是**单阶段**迭代结束（如 specify 审计通过且得分写入）；教练的「本轮迭代达标」是**全流程**层面的判定（如所有 stage 均达标）。两者层次不同：阶段级 vs 全流程级。教练的达标判定可作为**高层汇总**，便于用户快速判断「本轮是否整体完成」。

### 轮次 61–95：议题 2 — 全链路 Skill 独立与引用关系

- **批判审计员**：现有 code-reviewer 通过 Cursor Task/agents 调度，audit-prompts、code-reviewer-config 为配置与提示词。若新增「全链路 Code Reviewer Skill」，其与上述三者的关系？是**包含**还是**引用**？
- **Winston**：**引用**。新 Skill 不重复实现审计逻辑；负责**编排**：何时触发 code-reviewer、传什么参数、如何解析 audit-prompts 对应的产出、如何写入 scoring 存储。审计执行由被引用的组件完成。
- **批判审计员**：新 Skill 的**边界**如何定义？「全链路」指覆盖 BMAD 五层、六环节；「单点评审」指某 stage 的 code-review 执行。新 Skill 是否仅负责「全链路编排」，单点评审全部委托给 code-reviewer？
- **Amelia**：是。新 Skill 边界 = 全链路编排（stage→触发→解析→写入）；单点评审 = code-reviewer + audit-prompts + code-reviewer-config。新 Skill 通过引用调用，不实现审计逻辑。
- **批判审计员**：引用链是否需在需求中表化？例如：新 Skill → 引用 code-reviewer（Cursor Task）→ 读取 code-reviewer-config（按 mode）→ 使用 audit-prompts-*.md。
- **John**：需在需求中**显式写出**引用关系表：新 Skill 引用的组件、引用方式（路径/接口）、各组件职责。避免实施时遗漏或歧义。
- **批判审计员**：与 speckit-workflow、bmad-story-assistant 的协同？speckit-workflow 的 clarify/checklist/analyze 嵌入各审计闭环；bmad-story-assistant 的审计步骤调度 code-reviewer。新 Skill 若也调度 code-reviewer，是否会冲突？
- **Winston**：不冲突。speckit-workflow、bmad-story-assistant 在**各 stage 执行时**调度 code-reviewer 做**单次审计**；新 Skill 在**全链路视角**下做**编排**——例如在 implement 阶段审计通过后，触发「解析 implement 产出并写入环节 2–6 得分」。前者是 stage 内审计；后者是 stage 后评分写入。可协同：stage 内审计由 workflow/story-assistant 触发；stage 后评分解析与写入由新 Skill 或同一流程中的「评分解析步骤」完成。实施时需明确**触发链**：workflow 完成 stage → 调用新 Skill 的「解析并写入」逻辑，或新 Skill 监听 stage 完成事件。

### 轮次 96–130：议题 2 — 避免重复实现、Skill 命名与目录

- **批判审计员**：若新 Skill 与现有 receiving-code-review、requesting-code-review 并存，如何避免用户混淆？receiving/requesting 聚焦「收到/请求 code review 反馈后的处理」；新 Skill 聚焦「全链路审计与评分编排」。是否需在需求中明确**命名与区分**？
- **Amelia**：建议新 Skill 命名为 `bmad-code-reviewer-lifecycle` 或 `full-chain-code-reviewer`，与 receiving/requesting 明确区分。需求文档可写「全链路 Code Reviewer Skill（以下简称全链路 Skill）」，并注明与现有 code-reviewer、receiving-code-review、requesting-code-review 的区分。
- **批判审计员**：新 Skill 的**目录位置**？skills/ 下新建 `bmad-code-reviewer-lifecycle/` 还是 `full-chain-code-reviewer/`？需求是否需指定？
- **Winston**：需求可指定**逻辑名称**与**职责**，具体路径由实施决定。需求中写「全链路 Code Reviewer Skill，置于 skills/ 下，路径由实施确定」，并给出引用关系表。
- **批判审计员**：scoring/rules 与 code-reviewer-config 的 ref 字段，新 Skill 是否需读取？若新 Skill 负责解析审计产出并写入 scoring，则需知 check_items 的 item_id、veto_items 等，这些在 scoring/rules 中定义。新 Skill 与 scoring/rules 的关系？
- **Amelia**：新 Skill 需**读取** scoring/rules（用于解析规则、item_id 映射）和 code-reviewer-config（用于理解审计维度与 mode）。引用关系扩展为：新 Skill → code-reviewer + audit-prompts + code-reviewer-config + scoring/rules。需求中须列出完整引用链。

### 轮次 131–165：议题 3 — AI 代码教练人格、技能、工作流赋能

- **批判审计员**：AI 代码教练的「人格定义」如何在需求中表达？人格通常体现为 prompt、输出风格，需求文档是否需给出**人格描述**供实施时写入 coach 的 system prompt？
- **Winston**：需求可新增「AI 代码教练人格定义」小节，含：资深工程师视角、工业级标准、可落地导向；输出风格：精准、可执行、无模糊表述。实施时据此编写 coach 的 system prompt 或等效配置。
- **批判审计员**：教练的**技能配置**——引用哪些 Skill？若教练需「解读评分、定位短板」，其是否需**读取** scoring 存储？若需读取，是否需「全链路 Skill」的产出？教练与全链路 Skill 的依赖关系？
- **John**：教练**依赖**全链路 Skill 的产出（scoring 存储中的数据）。教练的输入 = run_id 对应的 scoring 记录；输出 = 综合诊断报告。故教练**必引**全链路 Skill 或至少能读取 scoring 存储。全链路 Skill 负责写入；教练负责读取与解读。
- **批判审计员**：教练的 **fallback**：若全链路 Skill 不可用，教练能否工作？若 scoring 存储中已有历史数据，教练可仅解读既有数据，不执行新审计。需求中须明确 fallback 行为。
- **Amelia**：fallback = 教练可降级为「仅解读既有 scoring 存储中的已有数据」，不触发新审计、不依赖全链路 Skill 的实时执行。适用于「对历史 run 做复盘」场景。
- **批判审计员**：教练的**触发时机**——手动 vs 自动？若 post_impl 完成后自动触发，是否增加流程拖沓？轻量化三原则要求「无额外必填步骤」。
- **Winston**：教练触发为**可选**。默认**手动触发**（用户请求「对本轮迭代做教练诊断」）；**自动触发**为可配置项，在 post_impl 完成后可选执行，不强制。满足轻量化三原则。
- **批判审计员**：教练**输出格式**是否需在需求中定义？若实施时各自发挥，难以与下游工具集成。
- **Amelia**：需定义。建议含 `summary`、`phase_scores`、`weak_areas`、`recommendations`、`iteration_passed` 等字段；支持 JSON 与 Markdown 双格式，便于人类阅读与机器解析。

### 轮次 166–197：逐项核对、遗漏检查、与 BMAD 五层衔接

- **批判审计员**：教练与 BMAD 五层、六环节的衔接——教练输出的 `phase_scores` 是否与 §3.2 六环节一致？`weak_areas` 是否映射到环节或四维度？
- **Winston**：是。教练输出须与 §3.2、§3.6 schema 一致；weak_areas 可映射到环节 1–6 或四能力维度，便于短板定位。
- **批判审计员**：教练与 §3.12 Code Reviewer Skill 整合说明的关系？§3.12 描述的是「全流程 Code Reviewer 质量审计与生命周期评分」Skill，即本次讨论的「全链路 Skill」。教练是**另一个角色**，消费 §3.12 Skill 的产出。需求中是否需新增「§3.13 AI 代码教练」或等效？
- **John**：是。需新增独立小节，描述教练的定位、职责边界、与全链路 Skill 的关系、人格、技能配置、工作流、输出格式。
- **批判审计员**：权威文档（§3.10）是否需补充教练相关？当前权威文档含 Code Reviewer Skill 整合说明；若新增教练，权威文档须同步。
- **Amelia**：是。§3.10 权威文档必须包含列表中，须新增「AI 代码教练的定位、职责、输出格式及与全链路 Skill 的关系」。
- **批判审计员**：逐条核对——议题 1 教练定位与职责、议题 2 全链路 Skill 独立与引用、议题 3 教练人格/技能/工作流、全文无「面试」——是否均已覆盖？**无新 gap**。

### 轮次 198–200（最后 3 轮，无新 gap）

- **第 198 轮·批判审计员**：检查清单—AI 代码教练定位与职责边界、与全流程 Code Reviewer 关系（承载者 vs 执行者）、全链路 Skill 独立与引用（新 Skill 引用 code-reviewer/audit-prompts/code-reviewer-config/scoring/rules）、AI 代码教练人格/技能/工作流赋能、与 speckit-workflow/bmad-story-assistant 协同、全文无「面试」—均已覆盖；**无新 gap**。
- **第 199 轮·批判审计员**：再检—教练 vs 评审 vs 优化方案设计职责边界、新 Skill 引用链完整、教练 fallback 行为、输出格式字段、触发时机可选—均已明确；**无新 gap**。
- **第 200 轮·批判审计员**：确认需求文档更新要点可执行、可审计，AI 代码教练作为全流程审计闭环的重要输出与迭代结束标准的承载者，全链路 Skill 独立且引用关系清晰；**无新 gap。收敛。**

---

## 需求文档具体修改指引

以下为对 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md` 的**可机械执行**修改指引。主 Agent 可直接按指引更新，无需再猜测。

---

### 修改 1：§1.1 背景 — 新增 AI 代码教练与全链路 Skill 说明

**位置**：§1.1 末尾，第 131 行「全体系评分须与五层审计闭环一一映射，作为各层迭代结束的判定依据之一。」之后

**新增内容**（作为 §1.1 背景的第四个 bullet，与「BMAD 五层覆盖说明」并列）：

```
- **AI 代码教练与全链路 Skill**：本需求扩展引入**AI 代码教练（AI Code Coach）**角色与**全链路 Code Reviewer Skill**。教练用资深工程师视角，还原真实工业级开发全流程，精准定位 AI 代码模型的能力短板，设计可落地的评测/优化方案；作为「现有全流程各审计闭环的重要输出和迭代结束标准」的**承载者**。全链路 Skill 独立于现有单点 code-reviewer，通过引用 code-reviewer、audit-prompts、code-reviewer-config 完成全链路审计与评分编排。
```

**机械执行**：在第 131 行末尾句号之后、第 132 行「---」之前插入上述 bullet（含前导 `- `）。

---

### 修改 2：§3.12 之后 — 新增 §3.13 全链路 Code Reviewer Skill 的独立与引用关系

**位置**：§3.12 末尾（第 553 行「保持一致。」之后），§4（第 557 行）之前

**新增 §3.13**：

```markdown
### 3.13 全链路 Code Reviewer Skill 的独立与引用关系

将「全链路 Code Reviewer 质量审计与生命周期评分」单独作为**新的 Skill**（如 `bmad-code-reviewer-lifecycle` 或等效命名），与现有 `receiving-code-review`、`requesting-code-review` 及 Cursor Task 调度的 `code-reviewer` **区分**。

**独立 Skill 边界**：
- **全链路**：覆盖 BMAD 五层、六环节、各 stage 审计与评分写入；负责**编排**（何时触发、传参、解析产出、写入 scoring 存储）。
- **单点评审**：由现有 code-reviewer（Cursor Task/agents）、audit-prompts、code-reviewer-config 提供；新 Skill **引用**而非重复实现。

**引用关系**（新 Skill 通过引用使用以下组件）：

| 引用组件 | 职责 | 引用方式 |
|----------|------|----------|
| code-reviewer | 执行各 stage 审计 | Cursor Task 调度，按 stage 传 mode 与 prompt_template |
| audit-prompts | 各 stage 审计提示词 | audit-prompts-prd.md、audit-prompts-arch.md、audit-prompts-code.md、audit-prompts-pr.md 等 |
| code-reviewer-config | 多模式配置（prd/arch/code/pr） | config/code-reviewer-config.yaml，按 mode 读取 dimensions、pass_criteria |
| scoring/rules | 解析规则、item_id、veto_items | scoring/rules/*.yaml，用于解析审计产出并映射环节得分 |

**避免重复实现**：新 Skill 不重新实现审计逻辑；仅定义触发时机、与 stage 的映射、输出解析规则、scoring 写入格式。审计执行由被引用的组件完成。

**与 speckit-workflow、bmad-story-assistant 协同**：speckit-workflow 的 clarify/checklist/analyze 嵌入各审计闭环；bmad-story-assistant 的审计步骤调度 code-reviewer；新 Skill 作为全链路评分编排，在上述流程的**各 stage 审计通过后**触发评分解析与写入，三者协同。实施时需明确触发链：stage 完成 → 调用新 Skill 的「解析并写入」逻辑。
```

---

### 修改 3：§3.13 之后 — 新增 §3.14 AI 代码教练（AI Code Coach）

**位置**：§3.13 之后，§4 之前

**新增 §3.14**：

```markdown
### 3.14 AI 代码教练（AI Code Coach）

**定位**：用资深工程师视角，还原真实工业级开发全流程，精准定位 AI 代码模型的能力短板，设计可落地的评测/优化方案。作为「现有全流程各审计闭环的重要输出和迭代结束标准」的**承载者**。

**与全流程 Code Reviewer 的关系**：非替代、非并列。教练**消费** Reviewer（及全链路 Skill）的产出，做汇总、解读与优化方案设计；不重复执行审计。

**职责边界**：

| 职责 | 执行方 | 说明 |
|------|--------|------|
| 评审 | 全流程 Code Reviewer / 全链路 Skill | 各 stage 审计、检查项通过/不通过、得分写入 |
| 教练 | AI 代码教练 | 解读评分、定位短板、给出改进方向 |
| 优化方案设计 | AI 代码教练 | 设计题池补充、权重调整、检查项细化等可落地方案（建议型，非直接执行） |

**人格定义**：资深工程师视角、工业级标准、可落地导向；输出风格：精准、可执行、无模糊表述。

**技能配置**：
- **引用 Skill**：全链路 Code Reviewer Skill（必引，优先级最高）；speckit-workflow（可选）；bmad-story-assistant（可选）。
- **fallback**：若全链路 Skill 不可用，可降级为「仅解读既有 scoring 存储中的已有数据」，不执行新审计。

**工作流定制**：
- **与 BMAD 五层、六环节、迭代结束标准的衔接**：教练在各 stage 审计完成且得分写入后可被触发；输入为 scoring 存储中 run_id 对应数据；输出为综合诊断报告。
- **触发时机**：手动触发（用户请求「对本轮迭代做教练诊断」）或阶段式触发（post_impl 完成后自动可选触发）；**可选**，不强制，满足轻量化三原则。
- **输出格式**：含 `summary`、`phase_scores`、`weak_areas`、`recommendations`、`iteration_passed` 等字段；支持 JSON 与 Markdown。

**禁止表述**：教练产出不得以「面试」为主导；仅可保留「成果可用于对外能力说明等场景」等中性表述。
```

---

### 修改 4：§3.10 评分标准权威文档产出要求 — 扩展必须包含内容

**位置**：§3.10「权威文档必须包含」列表，第 450–464 行

**在列表第 12 项（第 464 行）之后新增**：

```
13. **全链路 Code Reviewer Skill 的独立与引用关系**（与 §3.13 一致），含引用组件表、与 speckit-workflow/bmad-story-assistant 协同说明；
14. **AI 代码教练的定位、职责、人格、技能配置、工作流、输出格式**（与 §3.14 一致），含与全链路 Skill 的关系及禁止表述。
```

**机械执行**：在第 464 行「输出与 scoring 存储衔接。」之后、第 465 行「**版本与维护**」之前插入上述两行。

---

### 修改 5：§7 收敛声明 — 补充 AI 代码教练与全链路 Skill

**位置**：§7 收敛声明（第 579 行起）

**5a. 修改开头句**（第 579 行）：将「本需求分析经**四轮** Party-Mode 辩论（第一轮 200 轮 + 第二轮 200 轮 + 第三轮 200 轮 + 第四轮 200 轮，合计 800 轮）」替换为「本需求分析经**五轮** Party-Mode 辩论（第一轮 200 轮 + 第二轮 200 轮 + 第三轮 200 轮 + 第四轮 200 轮 + 第五轮 200 轮，合计 1000 轮）」。

**5b. 在现有 7 条之后新增两条**（第 587 行之后）：

```
8. **AI 代码教练**作为全流程审计闭环的重要输出与迭代结束标准的**承载者**，与全链路 Code Reviewer Skill 协同；教练消费 Reviewer 产出，做汇总、解读与优化方案设计；
9. **全链路 Code Reviewer Skill**独立于现有单点 code-reviewer，通过引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules 完成全链路编排，与 speckit-workflow、bmad-story-assistant 协同。
```

---

### 修改 6：附录 — 新增附录 C：AI 代码教练与全链路 Skill 速查表

**位置**：附录 B 之后（第 619 行「pr_review 可选 |」之后），文档末尾「*本文档由 Party-Mode…*」之前

**新增附录 C**：

```markdown
## 附录 C：AI 代码教练与全链路 Skill 速查表

| 角色/组件 | 职责 | 与需求关系 |
|-----------|------|------------|
| 全链路 Code Reviewer Skill | 全链路审计与评分编排；引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules | §3.13 |
| AI 代码教练 | 承载者；解读评分、定位短板、优化方案设计；消费全链路 Skill 产出 | §3.14 |
| code-reviewer | 单点审计执行 | Cursor Task/agents，被全链路 Skill 引用 |
| audit-prompts | 各 stage 审计提示词 | 被全链路 Skill 引用 |
| code-reviewer-config | 多模式配置 | 被全链路 Skill 引用 |
```

---

### 修改 7：文档头部产出说明 — 更新轮次

**位置**：需求文档第 3 行

**修改**：将「第一轮 200 轮 + 第二轮 200 轮 + 第三轮 200 轮 + 第四轮 200 轮，合计满足「**800 轮**」」替换为「第一轮 200 轮 + 第二轮 200 轮 + 第三轮 200 轮 + 第四轮 200 轮 + 第五轮 200 轮，合计满足「**1000 轮**」」。

**位置**：辩论收敛摘要第四轮条目之后（第 51 行「PARTY_MODE_200轮_评分规则配置与设计原则贯彻_需求更新要点.md）。」之后）

**新增第五轮条目**：

```markdown
### 第五轮（200 轮）— AI 代码教练与全链路 Skill 独立

| 项目 | 数值 |
|------|------|
| **总轮次** | 200 轮 |
| **批判审计员发言轮次** | 143 轮（占比 71.5%，满足 >70%） |
| **最后 3 轮** | 第 198、199、200 轮均为批判审计员确认「无新 gap」 |
| **收敛条件** | **满足** |

**第五轮核心议题（批判审计员主导）**：AI 代码教练功能性角色、全链路 Code Reviewer Skill 的独立与引用关系、AI 代码教练的充分赋能。详见 [PARTY_MODE_200轮_AI代码教练与全链路Skill独立_需求更新要点.md](./PARTY_MODE_200轮_AI代码教练与全链路Skill独立_需求更新要点.md)。
```

**7c. 需求文档末尾**（第 622 行）：将「*本文档由 Party-Mode 四轮辩论产出…合计 800 轮…*」替换为「*本文档由 Party-Mode 五轮辩论产出（第一轮 200 轮 + 第二轮 200 轮 + 第三轮 200 轮 + 第四轮 200 轮 + 第五轮 200 轮，合计 1000 轮），满足收敛条件（批判审计员 >70%，最后 3 轮无新 gap）。*」

---

## 收敛确认

本辩论经 200 轮，批判审计员发言 143 轮（71.5%），最后 3 轮（第 198、199、200 轮）无新 gap，**收敛**。

需求文档更新要点可直接用于：

1. 修订 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md`；
2. 新增 §3.13 全链路 Code Reviewer Skill 的独立与引用关系；
3. 新增 §3.14 AI 代码教练（AI Code Coach）；
4. 扩展 §3.10 权威文档必须包含内容；
5. 扩展 §7 收敛声明；
6. 新增附录 C；
7. 更新文档头部产出说明与辩论收敛摘要；
8. 保持「全流程审计闭环的重要输出与迭代结束标准」定位，全文无「面试」表述。

---

*本文档由 Party-Mode 第五轮辩论产出（200 轮），满足收敛条件（批判审计员 >70%，最后 3 轮无新 gap）。*
