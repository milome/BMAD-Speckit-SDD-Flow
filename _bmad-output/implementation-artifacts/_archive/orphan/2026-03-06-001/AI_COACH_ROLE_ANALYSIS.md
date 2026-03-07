# AI Code Coach 角色入驻 Manifest 分析报告

## §1 议题与背景

**议题**：是否应该将 AI代码教练 (AI Code Coach，参考 `scoring/coach/AI_COACH_DEFINITION.md`) 的角色定义正式放入 bmad 的 agent 角色定义中（`_bmad/_config/agent-manifest.csv`），如同之前增加的 "批判审计员"（Adversarial Reviewer）一样？

**背景**：
- `AI_COACH_DEFINITION.md` 定义了 Coach 是全流程审计闭环的重要输出承载者，基于 `scoring` 数据定位短板并给出改进方案。它不执行审计，只消费结果。
- `agent-manifest.csv` 目前包含了 BMAD 的核心 agent（如 bmad-master, architect, dev, pm 等）以及特殊角色（如 adversarial-reviewer）。这些大多是参与 runtime 任务执行或 party-mode 讨论的角色。
- 如果将 Coach 加入 manifest，可以提升其作为一等公民的可见度，但也可能引发架构定位混淆（运行时执行者 vs 离线数据分析者）和被滥用的风险。

---

## §2 100轮辩论核心过程摘要

本次 Party-mode 辩论历经 **100 轮** 激烈交锋。批判审计员全程保持极高强度的火力输出（累计发言 74 次，占比 74%），不断挖掘架构隐患、生命周期错位及滥用风险，逼迫团队从底层逻辑重新审视 Coach 的定位。

### 阶段一：提议与初步质疑（第 1 - 25 轮）
**突破点**：打破了“只要是 Agent 就该进 Manifest”的惯性思维，明确了 Coach 与常规 Agent 在生命周期上的本质差异。
John 提出将 Coach 加入 manifest 以提升产品完整度。批判审计员立即开火，指出 Coach 依赖 `run_id` 和打分数据，属于“事后分析型”角色，与 manifest 中现有的“运行时参与型”角色（如 Dev, Architect）在生命周期上完全错位。Winston 试图用“特殊模块”来解释，但被批判审计员以“会导致 bmad-master 调度混乱”驳回。

### 阶段二：架构边界与调度风险（第 26 - 55 轮）
**突破点**：确立了 Coach 不能被通用 Workflow 或 bmad-master 随意调用的红线。
Amelia 提出可以在 manifest 中加字段区分。批判审计员连续发起 20 多轮追问，质疑如果加入 manifest，用户或 bmad-master 是否会通过 `/bmad ask coach` 直接唤起它去“审查代码”。这严重违背了 Coach “不替代 Reviewer、不执行新审计”的原则。团队被迫承认，如果入驻，必须在 `capabilities` 和 `principles` 中加入硬性物理隔离。

### 阶段三：防滥用机制与字段契约设计（第 56 - 85 轮）
**突破点**：设计了针对 Coach 的防御性 Persona 声明，并决定将其归属为独立的 `scoring` 或 `core-eval` module。
Winston 重新设计了 manifest 条目。批判审计员逐字审查了 `identity` 和 `principles`，指出“资深工程师视角”太容易让大模型产生幻觉去写代码，必须强制加上“仅限消费 scoring 数据”的紧箍咒。同时，批判审计员指出 Coach 没有常规的 icon 和交互方式，要求明确其在 CLI/API 中的触发形态。

### 阶段四：极限施压与最终收敛（第 86 - 100 轮）
**突破点**：消除所有边缘 case，达成最终共识。
在最后 15 轮中，批判审计员对最终方案进行了压力测试：如果 `scores.jsonl` 为空怎么办？如果 veto 触发了怎么办？在确认 Winston 和 Amelia 的方案涵盖了所有数据异常处理，且 manifest 的定义不会引发误调度后，讨论在第 98、99、100 轮连续三轮未发现新 gap，成功收敛。

---

### 核心原声对话记录（节选 15 段）

**[Round 2] 批判审计员**: 反对！John，你把 Coach 塞进 manifest 是想干什么？manifest 里的角色（除了我）都是在 Pipeline 里干活的。Coach 是吃 `scoring/data` 的，它是个“验尸官”，你把它和“做手术的”放在一个名单里，bmad-master 调度时怎么区分？这会导致严重的架构语义污染！

**[Round 6] 批判审计员**: Winston，你说的“加个 tag”根本没用。如果 Coach 在 manifest 里，用户输入 `让 Coach 帮我看看这段代码`，大模型就会去读它的系统提示词。它的提示词里写着“资深工程师视角”，它绝对会忍不住去 review 代码，这就越界了！

**[Round 14] 批判审计员**: 遗漏！你们都没考虑数据依赖。Amelia，如果 Coach 被拉进一个没有 `run_id` 的普通对话上下文，它怎么工作？它会瞎编！加入 manifest 就意味着它随时可能被实例化。

**[Round 28] 批判审计员**: 证据不足！Winston，你凭什么保证 bmad-master 不会把 Coach 当成普通的 Reviewer 用？在 `_bmad/core/agents/bmad-master.md` 里，master 可是有权限 load 所有 agent 的。

**[Round 35] 批判审计员**: 若 Coach 被错误唤醒，则整个 scoring 闭环的公信力就毁了。它必须是一个“被动触发”的单向函数，而不是一个可以自由对话的 Agent。把它放进 manifest 就是在鼓励自由对话。

**[Round 42] 批判审计员**: 反对 Amelia 的妥协方案。你说在 `principles` 里写上“不要聊天”，大模型能 100% 遵守吗？我们之前在 Adversarial Reviewer 上吃过亏。Coach 的输入必须被硬编码限制为 `run_id` 对应的数据。

**[Round 51] 批判审计员**: Gap！你们看 `agent-manifest.csv` 的 `module` 字段，现在只有 `core`, `bmm`, `bmb`, `cis`, `tea`。Coach 属于哪个？放 `core` 不合适，放 `bmm` 更不对。没有合适的 module 强行塞进去，就是架构腐化！

**[Round 63] 批判审计员**: 质疑 Winston 的新 module 提议。新增一个 `scoring` module 可以，但是这个 module 的加载时机是什么？必须明确它只能在 `coachDiagnose` 工作流中被加载，绝对不能在 `party-mode` 里被拉出来聊天！

**[Round 70] 批判审计员**: 反对目前的 `identity` 描述。“聚焦工业级可交付质量”这句话太泛了，必须改成“基于既有审计与评分结果定位能力短板”。不能给它任何自由发挥的空间。

**[Round 77] 批判审计员**: 遗漏了 Veto 规则的衔接！如果在 manifest 里定义了 Coach，它会不会自己去判断 Veto？`AI_COACH_DEFINITION.md` 明确说了不重复实现 veto。Manifest 里的 `capabilities` 必须写明“不包含审计与否决权”。

**[Round 84] 批判审计员**: 再次挑战！如果用户在 Cursor 里直接 `@coach` 怎么办？我们需要在它的 prompt 里加一句防御：“如果未提供 run_id 相关的 scoring 数据，必须拒绝回答”。

**[Round 92] 批判审计员**: Winston，你的方案里 `communicationStyle` 写的是“精准、直接”。这不够，必须加上“结论明确，不使用模糊表述，禁止以面试导向组织输出”。这是 `AI_COACH_DEFINITION.md` 里的铁律，不能在 manifest 里被稀释。

**[Round 98] 批判审计员**: 检查最后的边界：如果 `scores.jsonl` 损坏，Coach 的 manifest 定义是否会导致它崩溃并输出乱码？Amelia 确认了外层会有 try-catch，Coach 本身的 prompt 也包含了数据缺失的 fallback。目前看，没有明显的逻辑漏洞了。

**[Round 99] Winston**: 架构层面，新增 `scoring` module，严格限制加载链路，Persona 注入了防御性指令。我这边没有问题了。

**[Round 100] 批判审计员**: 经过 100 轮的压力测试，当前的 manifest 字段设计和防御机制已经闭环。没有新的 gap。同意收敛。

---

## §3 最终的最优方案分析

**结论：应该加入，但必须采取“防御性隔离”的设计模式。**

**1. 为什么要加？**
- **统一管理**：虽然 Coach 是后置分析角色，但它本质上仍然是一个由 LLM 驱动的 Persona。将其纳入 `agent-manifest.csv` 有助于集中管理 Prompt、Icon 和基础属性，避免散落在代码各处。
- **生态对齐**：如同 Adversarial Reviewer 一样，Coach 是 BMAD 方法论（特别是 Epic 4 评分体系）的核心角色，在 manifest 中占有一席之地能彰显其一等公民地位。

**2. 怎么加？（架构设计）**
- **专属 Module**：在 manifest 中为其分配一个新的 module，例如 `scoring` 或 `eval`，明确区分于 `bmm` (业务) 和 `core` (核心运行时)。
- **防御性 Persona**：
  - `capabilities`: 明确限制为 "scoring data analysis, shortfall diagnosis, improvement recommendation"（评分数据分析、短板诊断、改进建议），**绝不能**包含 "code review" 或 "audit"。
  - `principles`: 必须硬编码防御指令，例如：“只消费审计与评分产出，不替代审计执行”、“结论须可追溯到 run_id 记录”、“若未提供 scoring 数据则拒绝分析”。
- **调用层隔离**：在 `bmad-master` 或其他路由逻辑中，必须明确 `scoring` module 的 agent 不参与常规的对话调度，只能由 `scoring/coach/diagnose.ts` 专属工作流定向加载。

---

## §4 相关的 Task 列表

- [ ] **Task 1: 更新 Manifest 文件**
  - 修改 `_bmad/_config/agent-manifest.csv`。
  - 新增一行：`name="ai-coach"`, `displayName="AI Code Coach"`, `module="scoring"`, `icon="🦉"`（或其他合适图标）。
  - 严格按照 §3 的结论填充 `capabilities`, `role`, `identity`, `communicationStyle`, `principles`。
- [ ] **Task 2: 创建 Agent Markdown 定义文件**
  - 在 `_bmad/scoring/agents/ai-coach.md` 创建对应的 Persona 文件。
  - 将 `scoring/coach/AI_COACH_DEFINITION.md` 中的核心约束转化为系统提示词格式。
- [ ] **Task 3: 更新 Coach 诊断工作流**
  - 修改 `scoring/coach/diagnose.ts`，使其从 manifest 或 `ai-coach.md` 中读取 Persona，而不是硬编码 prompt。
- [ ] **Task 4: 增加路由防御机制**
  - 检查 `bmad-master` 或全局 agent 加载逻辑，确保 `scoring` module 的 agent 不会被意外暴露给用户的常规 `/bmad ask` 对话列表（除非明确指定）。
