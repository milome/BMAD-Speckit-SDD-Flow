---
name: bmad-story-assistant
description: |
  Claude Code CLI / OMC 版 BMAD Story Assistant 适配入口。
  以 Cursor bmad-story-assistant 为语义基线，完整编排 Story 创建 → 审计 → Dev Story → 实施后审计 → 失败回环，
  并接入仓库内已实现的多 agent、hooks、状态机、handoff、评分写入与 commit gate 机制。
---

# Claude Adapter: BMAD Story Assistant

## Purpose

本 skill 是 Cursor `bmad-story-assistant` 在 Claude Code CLI / OMC 环境下的统一适配入口。

目标不是简单复制 Cursor skill，而是：

1. **继承 Cursor 已验证的流程语义**
2. **在 Claude/OMC 运行时中选择正确执行器并定义 fallback**
3. **接入仓库中已开发完成的状态机、hooks、handoff、审计闭环、评分写入与 commit gate**
4. **确保在 Claude Code CLI 中能完整、连续、正确地执行 Story 创建 → 开发 → 审计闭环迭代等全流程**

---

## 核心验收标准

Claude 版 `bmad-story-assistant` 必须满足：

- 能作为 Claude Code CLI 的**统一入口**，连续编排 Story 创建、阶段审计、Dev Story 实施、实施后审计与失败回环
- 各阶段跳转、执行器选择、fallback、状态落盘、评分写入与审计闭环均与 Cursor 已验证流程语义一致
- 完整接入本仓新增的：
  - 多 agent
  - hooks
  - 状态机
  - handoff
  - 审计执行体
  - parseAndWriteScore
  - commit gate
- 不得将 Cursor Canonical Base、Claude Runtime Adapter、Repo Add-ons 混写为来源不明的重写版 prompt

---

## Cursor Canonical Base

以下内容继承自 Cursor `bmad-story-assistant`，属于业务语义基线，Claude 版不得擅自重写其意图：

### 阶段模型
1. Create Story
2. Story 审计
3. Dev Story / `STORY-A3-DEV`
4. 实施后审计 / `STORY-A4-POSTAUDIT`
5. 失败回环与重新审计

### 关键模板基线
- `STORY-A3-DEV`
- `STORY-A4-POSTAUDIT`
- Story 文档阶段审计要求
- 前置检查、TDD 红绿灯、ralph-method、post-audit 的基线约束

### 必须保留的基线语义
- 主 Agent 不得绕过关键阶段
- 前置文档必须已通过审计
- Dev Story 不得在实施已结束后重复触发
- 实施完成后必须发起 post-audit
- TDD 顺序与记录要求不可跳过
- 子任务返回后 cleanup / post-audit 的顺序必须保持

### 不属于 Cursor Canonical Base 的内容
以下内容禁止写入 Cursor Base，应放入 Runtime Adapter 或 Repo Add-ons：
- Claude / OMC 的具体 agent 名称
- `oh-my-claudecode:code-reviewer`
- `code-review` skill
- `auditor-spec` / `auditor-plan` / `auditor-tasks` / `auditor-implement`
- 仓库本地 scoring、禁止词、批判审计员格式、state 更新细节

---

## Claude/OMC Runtime Adapter

本节定义 Cursor 语义在 Claude Code CLI / OMC 中的具体执行方式。

### Stage Routing Map

| Cursor 阶段 | Claude 入口 / 执行体 | 说明 |
|------|------|------|
| Create Story | Claude 版 `bmad-story-assistant` adapter skill → story/create 执行体 | 当前以设计位保留，后续应映射到 `.claude/agents/...` |
| Story 审计 | Story 审计执行体 / reviewer | 当前以设计位保留，后续应标准化 |
| `STORY-A3-DEV` | `.claude/agents/speckit-implement.md` | 已三层化，并对齐 `STORY-A3-DEV` |
| `STORY-A4-POSTAUDIT` | `.claude/agents/layers/bmad-layer4-speckit-implement.md` + `auditor-implement` | 已三层化，auditor 优先 |
| spec 审计 | `auditor-spec` | primary |
| plan 审计 | `auditor-plan` | primary |
| tasks 审计 | `auditor-tasks` | primary |
| implement 审计 | `auditor-implement` | primary |
| bugfix 审计 | `auditor-bugfix` | primary |

### Primary Executors

- Story / Layer 4 / implement/post-audit 的 primary executor 优先使用仓库自定义执行体
- 审计阶段优先使用：
  - `auditor-spec`
  - `auditor-plan`
  - `auditor-tasks`
  - `auditor-implement`
  - `auditor-bugfix`
- Dev Story 实施优先使用：
  - `.claude/agents/speckit-implement.md`

### Optional Reuse

如运行时可用，可复用：
- `oh-my-claudecode:code-reviewer`
- `code-review` skill
- OMC executor / reviewer 型 agent
- 测试 / lint 专用执行器

### Fallback Strategy

统一回退策略如下：

1. 优先使用仓库定义的 primary executor
2. 若 primary executor 在当前环境不可直接调用，则回退到 OMC reviewer / executor
3. 若 OMC reviewer / executor 不可用，则回退到 `code-review` skill 或等价能力
4. 若上述执行体均不可用，则由主 Agent 直接执行同一份三层结构 prompt
5. fallback 仅允许改变执行器，不得改变：
   - Cursor Canonical Base
   - Repo Add-ons
   - 输出格式
   - 评分块
   - required_fixes 结构
   - handoff / state 更新规则

### Runtime Contracts

所有阶段必须遵守以下运行时契约：

- 必须维护：
  - `.claude/state/bmad-progress.yaml`
  - `.claude/state/stories/*-progress.yaml`（如适用）
- 必须维护 handoff 信息：
  - `artifactDocPath`
  - `reportPath`
  - `iteration_count`
  - `next_action`
- 审计通过后必须触发：
  - `parse-and-write-score.ts`
  - 审计通过标记
  - 状态更新
- 实施完成但 post-audit 未执行时，禁止重新进入开发阶段
- 如 hooks 可用，仅允许 hooks 做：
  - 观测
  - checkpoint
  - 恢复提示
  - 非业务门控
- hooks 不得替代：
  - 阶段放行
  - commit 放行
  - 主状态机决策

---

## Repo Add-ons

以下内容为仓库附加增强，不属于 Cursor 原始语义。

### 审计增强
- 禁止词检查
- 批判审计员输出格式
- `本轮无新 gap / 本轮存在 gap`
- strict convergence（如 implement 连续 3 轮无 gap）

### 评分与存储增强
- `parse-and-write-score.ts`
- `iteration_count`
- `iterationReportPaths`
- 可解析评分块要求

### 状态与门控增强
- `.claude/state/bmad-progress.yaml`
- `.claude/state/stories/*.yaml`
- commit gate
- handoff 协议

### 运行时治理增强
- ralph-method 追踪文件
- progress / prd 必填
- hooks / state / runtime adapter 行为

---

## Stage-by-Stage Orchestration

### Stage 1: Create Story

Claude 端 Stage 1 Create Story 执行体，负责在 BMAD Story 流程中生成 Story 文档，并将流程推进到 Story 审计阶段。

#### Purpose

本阶段是 Cursor `bmad-story-assistant` 中 Create Story 阶段在 Claude Code CLI / OMC 环境下的执行适配器。

目标：
- 继承 Cursor Create Story 阶段的业务语义
- 在 Claude 运行时下定义清晰的执行器、输入、状态更新与 handoff
- 为后续 Stage 2 Story 审计提供标准产物

#### Required Inputs

- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- `project_root`
- 如存在：`sprint-status.yaml`、相关需求文档、前置 Epic/Story 规划文档

#### Cursor Canonical Base

- 主文本基线来源：Cursor `bmad-story-assistant` skill 的 Stage 1 Create Story（`STORY-A1-CREATE`）模板。
- 主 Agent 在发起 Create Story 子任务**之前**必须先执行 sprint-status 前置检查：
  1. 当用户通过 `epic_num/story_num`（或「4、1」等形式）指定 Story，或从 sprint-status 解析下一 Story 时，必须先检查 sprint-status 是否存在。
  2. 可调用 `scripts/check-sprint-ready.ps1 -Json` 或 `_bmad/scripts/bmad-speckit/powershell/check-sprint-ready.ps1 -Json`（若项目根有 `scripts/` 则优先），并解析 `SPRINT_READY`。
  3. 若 sprint-status 不存在，必须提示用户「⚠️ sprint-status.yaml 不存在，建议先运行 sprint-planning」，要求用户显式确认「已知绕过，继续」或先执行 sprint-planning；未确认前不得发起 Create Story 子任务。
  4. 若 sprint-status 存在，可附带「sprint-status 已确认」标志于子任务 prompt，简化子任务逻辑。
  5. 仅当用户明确「已通过 party-mode 且审计通过，跳过 Create Story」并仅请求 Dev Story 时，方可豁免本阶段。
- 通过子任务调用 Create Story 工作流时，主 Agent 须将 **完整模板** `STORY-A1-CREATE` 整段复制并替换占位符；**禁止**概括或缩写模板。
- 跳过判断：仅当用户**明确**说出「已通过 party-mode 且审计通过」「跳过 Create Story」时，主 Agent 方可跳过阶段一、二。若用户仅提供 Epic/Story 编号或说「Story 已存在」而未明确上述表述，**必须**执行 Create Story。
- Create Story 模板要求：
  - 通过子任务执行 `/bmad-bmm-create-story` 等价工作流，生成 Epic `{epic_num}`、Story `{epic_num}-{story_num}` 的 Story 文档。
  - 输出 Story 文档到 `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`。
  - 创建 Story 文档时必须使用明确描述，禁止使用 Story 禁止词表中的词（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。
  - 当功能不在本 Story 范围但属本 Epic 时，须写明「由 Story X.Y 负责」及任务具体描述；确保 X.Y 存在且 scope 含该功能。禁止模糊推迟表述。
  - **party-mode 强制**：无论 Epic/Story 文档是否已存在，只要涉及以下任一情形，**必须**进入 party-mode 进行多角色辩论（最少 100 轮）：① 有多个实现方案可选；② 存在架构/设计决策或 trade-off；③ 方案或范围存在歧义或未决点。
  - 全程必须使用中文。
- Create Story 产出后，Story 文档通常保存在：`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`。

#### Subtask Template (STORY-A1-CREATE)

发起创建 Story 子任务时，必须使用以下完整模板（所有占位符需预先替换）：

**模板 ID**：STORY-A1-CREATE

```yaml
description: "Create Story {epic_num}-{story_num} via BMAD create-story workflow"
prompt: |
  【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段一 Create Story prompt 模板（ID STORY-A1-CREATE）整段复制并替换占位符后重新发起。

  请执行 BMAD Create Story 工作流，生成 Epic {epic_num}、Story {epic_num}-{story_num} 的 Story 文档。

  **工作流步骤**：
  1. 加载 {project-root}/_bmad/core/tasks/workflow.xml
  2. 读取其全部内容
  3. 以 {project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml 作为 workflow-config 参数
  4. 按照 workflow.xml 的指示执行 create-story 工作流
  5. 输出 Story 文档到 {project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md（slug 从 Story 标题或用户输入推导）

  **强制约束**：
  - 创建 story 文档必须使用明确描述，禁止使用本 skill「§ 禁止词表（Story 文档）」中的词（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。
  - 当功能不在本 Story 范围但属本 Epic 时，须写明「由 Story X.Y 负责」及任务具体描述；确保 X.Y 存在且 scope 含该功能（若 X.Y 不存在，审计将判不通过并建议创建）。禁止「先实现 X，或后续扩展」「其余由 X.Y 负责」等模糊表述。
  - **party-mode 强制**：无论 Epic/Story 文档是否已存在，只要涉及以下任一情形，**必须**进入 party-mode 进行多角色辩论（**最少 100 轮**，见 party-mode step-02 的「生成最终方案和最终任务列表」或 Create Story 产出方案场景）：① 有多个实现方案可选；② 存在架构/设计决策或 trade-off；③ 方案或范围存在歧义或未决点。**禁止**以「Epic 已存在」「Story 已生成」为由跳过 party-mode。共识前须达最少轮次；若未达成单一方案或仍有未闭合的 gaps/risks，继续辩论直至满足或达上限轮次。
  - 全程必须使用中文。
```

**占位符替换说明**：
- `{epic_num}` → 实际 Epic 编号（如 `4`）
- `{story_num}` → 实际 Story 编号（如 `1`）
- `{epic-slug}` → Epic 短名（如 `cli-integration`）
- `{slug}` → Story 短名（从标题或输入推导）
- `{project-root}` → 项目根目录绝对路径

#### Claude/OMC Runtime Adapter

**执行体调用方式**

主 Agent 使用本 skill 时，必须按以下方式调用执行体：

**重要**：Claude Code CLI 的 `Agent` 工具没有专门的 `subagent_type` 对应 `.claude/agents/*.md` 文件。无论使用内置执行体还是自定义 agent 文件，都使用 `subagent_type: general-purpose`，并通过 `prompt` 参数传入完整的执行指令。

1. **直接执行模式**（推荐）：
   主 Agent 直接读取本 skill 中 Stage 1 的完整 prompt（含上面的 Subtask Template），整段复制并替换占位符后，使用 `Agent` 工具调用执行体：
   ```yaml
   tool: Agent
   subagent_type: general-purpose
   description: "Execute Stage 1 Create Story"
   prompt: |
     [本 skill Stage 1 的完整内容，含 Cursor Canonical Base + Subtask Template，所有占位符已替换]
   ```

2. **Agent 文件引用模式**：
   若使用 `.claude/agents/bmad-story-create.md` 作为执行体，必须先将该文件内容完整读入，然后作为 `prompt` 传入。`subagent_type` 仍然是 `general-purpose`：
   ```yaml
   tool: Agent
   subagent_type: general-purpose
   description: "Create Story via bmad-story-create agent"
   prompt: |
     你作为 bmad-story-create 执行体，执行以下 Stage 1 Create Story 流程：

     [读取 .claude/agents/bmad-story-create.md 的完整内容，含：]
     [1. Role]
     [2. Input Reception - 确认接收到的参数]
     [3. Required Inputs - 替换为实际值]
     [4. Cursor Canonical Base - 完整复制]
     [5. Subtask Template - 完整复制，占位符已替换]
     [6. Mandatory Startup]
     [7. Execution Flow]
     [8. Output / Handoff 要求]
   ```

**重要**：
- 不得仅传入执行体文件路径让执行体自己去读，必须将完整 prompt 内容传入
- 执行体本身不加载 skill，所有指令由主 Agent 通过 prompt 参数传递
- 执行体返回后，主 Agent 必须校验 handoff 输出，并决定下一步路由

---

**Primary Executor**
- `.claude/agents/bmad-story-create.md`（通过 Agent 工具调用，完整 prompt 由主 Agent 传入）

**Optional Reuse**
- 可复用已有 discussion / brainstorming / party-mode 等价能力辅助生成 Story 文档
- 可复用 `speckit-constitution.md`、`speckit-analyze.md`、`speckit-checklist.md` 作为输入约束与检查辅助

**Fallback Strategy**
1. 优先由 `bmad-story-create` agent 直接生成 Story 文档
2. 若需要深入讨论且 OMC / 对话式执行器可用，则复用其完成方案收敛，但最终 Story 产物仍由本阶段负责落盘
3. 若外部 executor 不可用，则由主 Agent 顺序执行需求收集、结构化生成、质量自检
4. fallback 不得改变 Cursor Canonical Base 的语义要求

**Runtime Contracts**
- 产物路径：`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{epic_num}-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md`
- Story 产出完成后，必须将 story state 更新为 `story_created`
- 必须写入 handoff，交由 `bmad-story-audit` 执行 Stage 2
- 若用户明确跳过 Create Story，必须记录跳过依据并直接进入 Story 审计

#### Repo Add-ons

- Story 文档必须遵守本仓禁止词规则
- Story 文档必须可审计，不得出现无法映射到后续阶段的模糊范围
- 产出目录与命名必须符合本仓 BMAD story 目录规范
- 状态文件与 handoff 必须兼容 `.claude/state/bmad-progress.yaml` 与 `.claude/state/stories/*-progress.yaml`

#### Output / Handoff

完成后输出 handoff：

```yaml
layer: 3
stage: story_create
artifactPath: _bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{epic_num}-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md
next_action: story_audit
next_agent: bmad-story-audit
```

### Stage 2: Story 审计

Claude 端 Stage 2 Story 审计执行体，负责审计 Story 文档并决定是否允许进入 Dev Story。

#### Purpose

本阶段是 Cursor `bmad-story-assistant` 中 Story 文档审计阶段在 Claude Code CLI / OMC 环境下的执行适配器。

目标：
- 继承 Cursor Story 审计语义
- 对 Story 文档进行 pass/fail 判定
- 审计通过后 handoff 到 Dev Story
- 审计失败后回环修 Story 文档

#### Required Inputs

- `storyDocPath`
- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- 相关需求来源 / Epic / Story 规划文档 / 约束文档（如存在）

#### Cursor Canonical Base

- 主文本基线来源：Cursor `bmad-story-assistant` skill 的 Stage 2 Story 审计模板（`STORY-A2-AUDIT`）。
- Story 文档生成后，**必须**发起审计子任务，迭代直至「完全覆盖、验证通过」。
- 严格度选择：
  - **strict**：连续 3 轮无 gap + 批判审计员 >50%
  - **standard**：单次 + 批判审计员
- 选择逻辑：
  - 若无 party-mode 产出物（story 目录下无 `DEBATE_共识_*`、`party-mode 收敛纪要` 等）或用户要求 strict → 使用 **strict**（补偿缺失的 party-mode 深度）
  - 若有 party-mode 产出物存在且用户未强制 strict → 使用 **standard**
- 审计子代理优先顺序：
  - 优先通过 code-reviewer / 等效 reviewer 执行 Story 审计
  - 若 reviewer 不可用，则回退到通用执行体，但必须传入 **完整** `STORY-A2-AUDIT` 模板；**不得**使用其他通用审计提示词替代
- 主 Agent 须整段复制 `STORY-A2-AUDIT` 模板并替换占位符；**禁止**概括、缩写或只传摘要。
- 审计内容必须逐项验证：
  1. Story 文档是否完全覆盖原始需求与 Epic 定义
  2. 若 Story 文档中存在禁止词表任一词，一律判为未通过
  3. 多方案场景是否已通过辩论达成共识并选定最优方案
  4. 是否有技术债或占位性表述
  5. 若 Story 含「由 Story X.Y 负责」，须验证对应 Story 文档存在且 scope/验收标准含该任务具体描述；否则判不通过
- 报告结尾必须输出：结论（通过/未通过）+ 必达子项 + Story 阶段可解析评分块（总体评级 A/B/C/D + 四维评分：需求完整性 / 可测试性 / 一致性 / 可追溯性）。
- 审计通过后必做：执行 `parse-and-write-score.ts --stage story --event story_status_change --triggerStage bmad_story_stage2 --epic {epic_num} --story {story_num} --iteration-count {累计值}`。
- 审计未通过时：审计子代理须在本轮内**直接修改被审 Story 文档**以消除 gap；若建议涉及创建或更新其他 Story，主 Agent 须先执行该建议，再重新审计当前 Story。
- 阶段二准入检查：主 Agent 在收到阶段二通过结论后、进入阶段三之前，必须先执行 `check-story-score-written.ts`；若未写入则补跑 `parse-and-write-score.ts`。

#### Claude/OMC Runtime Adapter

**执行体调用方式**

主 Agent 调用 Stage 2 执行体时，必须将本 skill 中 Stage 2 的完整内容（含 Cursor Canonical Base 的所有审计要求）通过 `Agent` 工具传入：

```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 2 Story Audit"
prompt: |
  你作为 bmad-story-audit 执行体，执行以下 Stage 2 Story 审计流程：

  **Required Inputs**（已替换为实际值）：
  - storyDocPath: {实际路径}
  - epic_num: {实际值}
  - story_num: {实际值}
  - ...

  **Cursor Canonical Base - 审计要求**（完整复制本 skill Stage 2 部分）：
  [1. Story 文档生成后，必须发起审计子任务...]
  [2. 严格度选择：strict/standard...]
  [3. 审计内容逐项验证...]
  [4. 报告结尾必须输出...]
  [5. 审计通过后必做...]

  **Repo Add-ons**：
  - 必须执行禁止词检查
  - 必须输出批判审计员结论
  - 必须输出可解析评分块

  **Runtime Contracts**：
  - 审计报告路径：...
  - 审计通过后更新 state 为 story_audit_passed

  完成后输出 PASS/FAIL handoff 格式。
```

**重要**：执行体本身不加载 skill，所有审计指令、检查项、输出格式要求必须由主 Agent 通过 prompt 参数完整传递。

---

**Primary Executor**
- `.claude/agents/bmad-story-audit.md`（通过 Agent 工具调用，完整 prompt 由主 Agent 传入）

**Optional Reuse**
- 可复用 `code-review` / reviewer 能力辅助生成审计报告
- 可复用现有仓库审计格式、批判审计员要求与评分块要求

**Fallback Strategy**
1. 优先由 `bmad-story-audit` agent 执行 Story 审计
2. 若 OMC reviewer 可用，则复用其进行辅助审查，但最终判定仍由本阶段汇总并落盘
3. 若 reviewer 不可用，则由主 Agent 直接执行同一份三层结构审计 prompt
4. fallback 不得降低审计严格度

**Runtime Contracts**
- 审计报告路径：`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{epic_num}-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md`
- 审计通过：更新 story state 为 `story_audit_passed`，handoff 到 `speckit-implement`
- 审计失败：更新 story state 为 `story_audit_failed`，要求修 Story 文档后重新审计

#### Repo Add-ons

- Story 审计必须执行本仓禁止词检查
- 必须输出批判审计员结论
- 必须明确标注 pass / fail / required_fixes
- state 与 handoff 需兼容本仓 BMAD story 状态机

#### Output / Handoff

**PASS**
```yaml
layer: 3
stage: story_audit_passed
artifactPath: {storyDocPath}
auditReportPath: _bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{epic_num}-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md
next_action: dev_story
next_agent: speckit-implement
```

**FAIL**
```yaml
layer: 3
stage: story_audit_failed
artifactPath: {storyDocPath}
auditReportPath: _bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{epic_num}-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md
next_action: revise_story
next_agent: bmad-story-create
```

### Stage 3: Dev Story / `STORY-A3-DEV`

Claude 端 Stage 3 Dev Story 执行体，负责按 TDD 红绿灯模式执行任务并完成代码实现。

#### Purpose

本阶段是 Cursor `bmad-story-assistant` 中 Dev Story 阶段在 Claude Code CLI / OMC 环境下的执行适配器。

目标：
- 继承 Cursor Dev Story 阶段业务语义
- 严格执行 TDD 红绿灯顺序
- 维护 ralph-method 追踪文件
- 实施后必须发起 Stage 4 Post Audit

#### Required Inputs

- `tasksPath`: tasks.md 文件路径
- `epic`: Epic 编号
- `story`: Story 编号
- `epicSlug`: Epic 名称 slug
- `storySlug`: Story 名称 slug
- `mode`: `bmad` 或 `standalone`

#### Cursor Canonical Base

- 以 `STORY-A3-DEV` 为主文本基线
- 前置文档必须 PASS（Story 审计通过状态）
- TDD 红绿灯顺序必须完整（RED → GREEN → REFACTOR）
- 必须维护 ralph-method 追踪文件（prd.json + progress.txt）
- 子任务返回后必须发起 `STORY-A4-POSTAUDIT`
- 实施过程中必须遵守 15 条铁律

#### Subtask Template (STORY-A3-DEV)

```yaml
description: "Execute Dev Story {epic}-{story} via STORY-A3-DEV workflow"
prompt: |
  【必读】本 prompt 须为完整模板且所有占位符已替换。

  你作为 speckit-implement / bmad-layer4-speckit-implement 执行体，执行 BMAD Stage 3 Dev Story 流程。

  **Required Inputs**（已替换为实际值）：
  - tasksPath: {实际路径}
  - epic: {实际值}
  - story: {实际值}
  - epicSlug: {实际值}
  - storySlug: {实际值}
  - mode: bmad

  **Cursor Canonical Base - Dev Story 要求**：
  1. 前置检查：Story 审计必须已 PASS
  2. 读取 tasks.md、plan.md、IMPLEMENTATION_GAPS.md
  3. 验证 ralph-method 文件存在（prd.json + progress.txt）
  4. 逐任务执行 TDD 红绿灯循环：
     - [TDD-RED] 编写失败的测试
     - [TDD-GREEN] 编写最小实现使测试通过
     - [TDD-REFACTOR] 重构代码
  5. 实时更新 ralph-method 追踪文件
  6. 执行 batch 间审计和最终审计
  7. 完成后必须发起 STORY-A4-POSTAUDIT

  **强制约束**：
  - 禁止在未创建 prd/progress 前开始编码
  - 禁止先写生产代码再补测试
  - 禁止跳过重构阶段
  - 必须遵守 15 条铁律

  **Repo Add-ons**：
  - 更新 `.claude/state/stories/{epic}-{story}-progress.yaml` 为 `implement_in_progress` / `implement_passed`
  - 执行 `parse-and-write-score.ts` 记录进度
  - handoff 到 Stage 4 Post Audit
```

#### Claude/OMC Runtime Adapter

**执行体调用方式**

主 Agent 调用 Stage 3 执行体时，必须将本 skill 中 Stage 3 的完整内容通过 `Agent` 工具传入：

```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 3 Dev Story"
prompt: |
  你作为 speckit-implement / bmad-layer4-speckit-implement 执行体，执行以下 Stage 3 Dev Story 流程：

  [本 skill Stage 3 的完整内容，含 Required Inputs、Cursor Canonical Base、Subtask Template，所有占位符已替换]
```

**重要**：执行体本身不加载 skill，所有指令由主 Agent 通过 prompt 参数完整传递。

---

**Primary Executor**
- `.claude/agents/speckit-implement.md`
- `.claude/agents/layers/bmad-layer4-speckit-implement.md`（BMAD 模式）

**Fallback Strategy**
1. 优先由 speckit-implement / bmad-layer4-speckit-implement 执行
2. 若不可用，回退到主 Agent 直接执行 TDD 循环
3. batch 审计与最终审计由 `auditor-implement` 或主 Agent 执行

**Runtime Contracts**
- 必须创建/更新 ralph-method 追踪文件（prd.json + progress.txt）
- 必须按 TDD 顺序执行（RED → GREEN → REFACTOR）
- 每个 User Story 完成后更新 prd.json passes 状态
- 必须记录 TDD 循环到 progress.txt
- 实施后必须触发 Stage 4 Post Audit

#### Repo Add-ons

- progress / prd 更新要求
- 本仓 scoring / handoff / lint / key path 要求
- 严格收敛检查（continuous 3 rounds no gap）
- 批判审计员介入

#### Output / Handoff

完成后输出 handoff：

```yaml
layer: 4
stage: implement_passed
artifactPath: {storyDocPath}
ralphMethodPath: _bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/
next_action: post_audit
next_agent: auditor-implement
```

### Stage 4: Post Audit / `STORY-A4-POSTAUDIT`

Claude 端 Stage 4 Post Audit 执行体，负责对 Dev Story 实施结果进行严格审计。

#### Purpose

本阶段是 Cursor `bmad-story-assistant` 中 Post Audit 阶段在 Claude Code CLI / OMC 环境下的执行适配器。

目标：
- 继承 Cursor Post Audit 语义
- 验证代码实现完全覆盖 tasks、spec、plan
- 专项审查 TDD 执行证据和 ralph-method 追踪文件
- 决定是否允许进入 commit gate

#### Required Inputs

- `artifactDocPath`: 被审代码/文档路径
- `reportPath`: 审计报告保存路径
- `tasksPath`: tasks.md 路径（对照用）
- `specPath`: spec.md 路径（对照用，可选）
- `planPath`: plan.md 路径（对照用，可选）
- `epic`: Epic 编号
- `story`: Story 编号
- `epicSlug`: Epic 名称 slug
- `storySlug`: Story 名称 slug
- `iterationCount`: 当前迭代轮数（默认 0）
- `strictness`: 严格度模式（simple/standard/strict，默认 standard）

#### Cursor Canonical Base

- 以 Cursor post-audit 语义为基线
- post-audit 是必须步骤，非可选
- 被审对象是**代码实现**，不是文档
- 发现 gap 时**不直接修改代码**（由主 Agent 委托实施子代理修改）
- 使用 **code 模式维度**（功能性、代码质量、测试覆盖、安全性）
- 必须验证 TDD 红绿灯执行证据
- 必须检查 ralph-method 追踪文件
- 审计通过后必须触发 `parse-and-write-score`

#### Subtask Template (STORY-A4-POSTAUDIT)

```yaml
description: "Execute Post Audit for {epic}-{story} via STORY-A4-POSTAUDIT"
prompt: |
  【必读】本 prompt 须为完整模板且所有占位符已替换。

  你作为 auditor-implement 执行体，执行 BMAD Stage 4 Post Audit 流程。

  **Required Inputs**（已替换为实际值）：
  - artifactDocPath: {实际路径}
  - reportPath: {实际路径}
  - tasksPath: {实际路径}
  - specPath: {实际路径}
  - planPath: {实际路径}
  - epic: {实际值}
  - story: {实际值}
  - iterationCount: {实际值}
  - strictness: {standard|strict}

  **Cursor Canonical Base - Post Audit 要求**：
  1. 读取 audit-prompts.md §5
  2. 读取批判审计员规范
  3. 读取实施后审计规则
  4. 读取 tasks.md、spec.md、plan.md 作为对照基线
  5. 读取 ralph-method 追踪文件（prd.json + progress.txt）
  6. 逐项验证代码实现覆盖度
  7. 专项审查 TDD 红绿灯执行证据
  8. 生成包含批判审计员结论的完整报告
  9. 报告结尾输出可解析评分块

  **审计维度**：
  - 功能性实现完整性
  - 代码质量标准
  - 测试覆盖率
  - 安全性检查

  **Repo Add-ons**：
  - 禁止词检查
  - 批判审计员结论
  - parseAndWriteScore 触发
  - commit gate 前置条件检查
```

#### Claude/OMC Runtime Adapter

**执行体调用方式**

主 Agent 调用 Stage 4 执行体时，必须将本 skill 中 Stage 4 的完整内容通过 `Agent` 工具传入：

```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 4 Post Audit"
prompt: |
  你作为 auditor-implement 执行体，执行以下 Stage 4 Post Audit 流程：

  [本 skill Stage 4 的完整内容，含 Required Inputs、Cursor Canonical Base、Subtask Template，所有占位符已替换]
```

**重要**：执行体本身不加载 skill，所有审计指令由主 Agent 通过 prompt 参数完整传递。

---

**Primary Executor**
- `.claude/agents/auditors/auditor-implement.md`

**Fallback Strategy**
1. 优先由 `auditor-implement` agent 执行 Post Audit
2. 若不可用，回退到 OMC reviewer
3. 再不可用，回退到 `code-review` skill
4. 最后回退到主 Agent 直接执行同一份三层 audit prompt

**Runtime Contracts**
- 审计报告路径：`_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_implement-{epic}-{story}.md`
- 审计通过后必须执行 `parse-and-write-score.ts`
- 审计通过后更新 story state 为 `implement_passed`
- 审计失败后更新 story state 为 `implement_failed`，回退到 Stage 3 修复

#### Repo Add-ons

- strict convergence（连续 3 轮无 gap）
- 批判审计员结论
- parseAndWriteScore 触发
- commit gate 前置条件检查
- 本仓禁止词检查

#### Output / Handoff

**PASS**
```yaml
layer: 4
stage: implement_audit_passed
artifactPath: {storyDocPath}
auditReportPath: _bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_implement-{epic}-{story}.md
next_action: commit_gate
next_agent: bmad-master
```

**FAIL**
```yaml
layer: 4
stage: implement_audit_failed
artifactPath: {storyDocPath}
auditReportPath: _bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_implement-{epic}-{story}.md
required_fixes: [...]
next_action: fix_implement
next_agent: speckit-implement
```

---

## Failure / Recovery Matrix

| 场景 | Primary 动作 | Fallback | 结果 |
|------|------|------|------|
| Story 审计失败 | 修复 Story 文档并重审 | reviewer fallback | 不得进入 Dev Story |
| spec 审计失败 | 修复 spec 并重审 | `auditor-spec` fallback | 不得进入 plan |
| plan 审计失败 | 修复 plan 并重审 | `auditor-plan` fallback | 不得进入 tasks |
| tasks 审计失败 | 修复 tasks 并重审 | `auditor-tasks` fallback | 不得进入 implement |
| implement 审计失败 | 修复代码/文档并重审 | `auditor-implement` fallback | 不得进入 commit gate |
| OMC 不可用 | 回退到仓库定义 reviewer / skill / main agent | 逐级 fallback | 保持语义与输出契约不变 |
| state drift | 读取 `.claude/state/...` 恢复上下文 | handoff + report 兜底 | 恢复后继续正确阶段 |
| 产物缺失 | 停止并要求补齐前置文件 | 无 | 不得跳阶段 |

---

## State / Audit / Handoff Contracts

### 状态真相源
- `bmad-progress.yaml` 是全局阶段真相源
- `stories/*-progress.yaml` 是 story 级真相源

### 审计规则
- 未通过审计 = 阶段未完成
- fail = 必须回修
- pass = 才能更新状态 / 继续下一阶段
- implement 审计必须满足 strict convergence（若仓库当前规则要求）

### handoff 最小字段
- `layer`
- `stage`
- `artifactDocPath` / `artifacts`
- `auditReportPath`
- `iteration_count`
- `next_action`

---

## 运行时禁止事项

1. 禁止把 Cursor Canonical Base、Runtime Adapter、Repo Add-ons 混写成来源不明的重写版 prompt
2. 禁止把 fallback 当成降级语义的借口
3. 禁止绕过 post-audit
4. 禁止 state 未更新就推进阶段
5. 禁止在未满足审计门控前 commit

---

## 实施建议（后续）

1. 用本 skill 作为 Claude Code CLI 中 `bmad-story-assistant` 的统一入口
2. 后续补齐：
   - Story Create 的 Claude 执行器映射
   - Story 审计的标准执行体
3. 将现有 `.claude/agents/*.md` 中的适配规则逐步统一回收为：
   - skill 总入口
   - 阶段执行器
   - 阶段审计执行器

---

## Verification Requirements

Claude 版 skill 落地后，至少应满足以下验证：

- 不得出现硬编码本地绝对路径
- Canonical Base 必须绑定明确的 Cursor 模板/阶段
- Runtime Adapter 必须有：
  - `Primary Executor`
  - `Fallback Strategy`
  - `Runtime Contracts`
- 相关 accept 测试必须通过
- 审计 fail / pass / retry / resume 路径必须能通过 grep 与状态文件验证

---

## 一句话结论

> Claude 版 `bmad-story-assistant` 不是 Cursor skill 的直接复制品，而是一个以 Cursor 为语义基线、以 Claude/OMC 为执行适配层、以本仓规则为增强层的统一编排入口 skill。
