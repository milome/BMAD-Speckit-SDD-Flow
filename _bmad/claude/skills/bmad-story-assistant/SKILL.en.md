<!-- BLOCK_LABEL_POLICY=B -->

---
name: bmad-story-assistant
description: |
  Claude Code CLI / OMC entry for the BMAD Story Assistant.
  Uses Cursor `bmad-story-assistant` as the semantic baseline to orchestrate Story creation → audit → Dev Story → post-implementation audit → failure loopback,
  and integrates this repository’s multi-agent, hooks, state machine, handoff, score writing, and commit gate mechanisms.
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.

# Claude Adapter: BMAD Story Assistant

## Purpose

This skill is the unified adaptation entrance of Cursor `bmad-story-assistant` in Claude Code CLI / OMC environment.

The goal is not to simply copy the Cursor skill, but to:

1. **Inherit Cursor’s verified process semantics**
2. **Select the correct executor and define fallback in Claude/OMC runtime**
3. **Integrate the repository’s state machine, hooks, handoff, audit closed loop, score writing, and commit gate**
4. **Ensure that the entire process of Story creation → development → audit closed-loop iteration can be executed completely, continuously and correctly in Claude Code CLI**

---

## Core Acceptance Criteria

The Claude version of `bmad-story-assistant` must satisfy:

- Can be used as the **unified entrance** of Claude Code CLI to continuously orchestrate Story creation, stage audit, Dev Story implementation, post-implementation audit and failure loopback
- Each stage jump, executor selection, fallback, status placement, score writing and audit closed loop are all semantically consistent with Cursor's verified process
- Complete access to the new additions to this warehouse:
  - Multi-agent
  - hooks
  - State machine
  -handoff
  - Audit executive
  - runAuditorHost
  -commit gate
- Cursor Canonical Base, Claude Runtime Adapter, and Repo Add-ons must not be mixed into a rewritten version of prompt from unknown sources.

## Party-Mode Specialized Subtype Contract

From this revision onward, Claude-side party-mode is no longer described as a `general-purpose` main path.

- **Primary path**: `.claude/agents/party-mode-facilitator.md`
- **Formal subtype**: `subagent_type: party-mode-facilitator`
- **Scope**: any party-mode debate that resolves design trade-offs, architecture decisions, scope ambiguity, or Story planning disagreements
- **Compatibility fallback**: only when the specialized facilitator is unavailable may the flow fall back to `subagent_type: general-purpose` with the full facilitator contract inlined
- **Non party-mode executors**: `bmad-story-create`, `auditor-*`, `speckit-implement`, and other non-specialized executors may still use `general-purpose`

So `general-purpose` still exists in the Claude Story flow, but it is **no longer the recommended main path for party-mode**.

## Deferred Gaps Dev Story Addendum

This distributed English variant must keep the same Deferred Gaps guardrails as the main Chinese contract.

- Before implementation, Dev Story must read and validate `deferred-gap-register.yaml`.
- Dev Story must also read and validate `journey-ledger`, `trace-map`, and `closure-notes`.
- Implementation must fail closed when an active gap has no task binding, `Smoke Task Chain`, `Closure Task ID`, or production path mapping.
- Post-audit must inspect `closure_evidence`, `carry_forward_evidence`, `Production Path`, `Smoke Proof`, and `Acceptance Evidence`.
- `module complete but journey not runnable` is a hard failure, not a warning.

---

## Cursor Canonical Base

The following content is inherited from Cursor `bmad-story-assistant` and belongs to the business semantic baseline. The Claude version is not allowed to rewrite its intention without authorization:

### Stage model
1.Create Story
2. Story audit
3. Dev Story / `STORY-A3-DEV`
4. Post-Implementation Audit / `STORY-A4-POSTAUDIT`
5. Failure loopback and re-audit

### Key Template Baseline
- `STORY-A3-DEV`
- `STORY-A4-POSTAUDIT`
- Story document stage audit requirements
- Baseline constraints for pre-checking, TDD traffic lights, ralph-method, and post-audit

### Baseline semantics that must be preserved
- The master agent must not bypass critical stages
- Pre-requisite documents must have passed audit
- Dev Story must not be triggered repeatedly after implementation has ended
- Post-audit must be initiated after implementation is completed
- TDD sequencing and logging requirements cannot be skipped
- The order of cleanup / post-audit must be maintained after the subtask returns

### Content that does not belong to Cursor Canonical Base
The following content is prohibited from being written to Cursor Base and should be placed in Runtime Adapter or Repo Add-ons:
- Specific agent name of Claude/OMC
- `oh-my-claudecode:code-reviewer`
- `code-review` skill
- `auditor-spec` / `auditor-plan` / `auditor-tasks` / `auditor-implement`
- Warehouse local scoring, forbidden words, critical auditor format, state update details

---

## Claude/OMC Runtime Adapter

This section defines how Cursor semantics are implemented in Claude Code CLI/OMC.

### Stage Routing Map

| Cursor stage | Claude entry/execution body | Description |
|------|------|------|
| Create Story | Claude version `bmad-story-assistant` adapter skill → story/create execution body | Currently reserved as design bit, it should be mapped to `.claude/agents/...` in the future |
| Story audit | Story audit executive / reviewer | Currently reserved as a design bit, it should be standardized in the future |
| `STORY-A3-DEV` | `.claude/agents/speckit-implement.md` | Tri-layered and aligned `STORY-A3-DEV` |
| `STORY-A4-POSTAUDIT` | `.claude/agents/layers/bmad-layer4-speckit-implement.md` + `auditor-implement` | Already three-layered, auditor takes priority |
| spec audit | `auditor-spec` | primary |
| plan audit | `auditor-plan` | primary |
| tasks audit | `auditor-tasks` | primary |
| implement audit | `auditor-implement` | primary |
| bugfix audit | `auditor-bugfix` | primary |

### Primary Executors

- The primary executor of Story / Layer 4 / implement/post-audit gives priority to using the warehouse custom executor
- Prioritize use during the audit phase:
  - `auditor-spec`
  - `auditor-plan`
  - `auditor-tasks`
  - `auditor-implement`
  - `auditor-bugfix`
- Dev Story implementation prefers to use:
  - `.claude/agents/speckit-implement.md`

### Optional Reuse

If available at runtime, it can be reused:
- `oh-my-claudecode:code-reviewer`
- `code-review` skill
- OMC executor / reviewer type agent
- Test/lint dedicated executor

### Fallback Strategy

The unified fallback strategy is as follows:

1. Prioritize using the primary executor defined by the warehouse
2. If the primary executor cannot be called directly in the current environment, fall back to OMC reviewer / executor
3. If OMC reviewer/executor is unavailable, fall back to `code-review` skill or equivalent capabilities
4. If none of the above execution bodies are available, the main Agent will directly execute the same three-layer structure prompt
5. fallback only allows changes to the executor, not:
   - Cursor Canonical Base
   -Repo Add-ons
   - Output format
   - Rating block
   - required_fixes structure
   - handoff / state update rules

### Runtime Contracts

All stages must adhere to the following runtime contracts:

- Must maintain:
  - `.claude/state/bmad-progress.yaml`
  - `.claude/state/stories/*-progress.yaml` (if applicable)
- Handoff information must be maintained:
  - `artifactDocPath`
  - `reportPath`
  - `iteration_count`
  - `next_action`
- Must be triggered after passing the audit:
  - `run-auditor-host.ts`
  - Audit pass mark
  - Status updates
- When the implementation is completed but post-audit is not executed, it is prohibited to re-enter the development phase.
- If hooks are available, only hooks are allowed to do:
  - Observation
  -checkpoint
  - Recovery tips
  - Non-business gate control
- hooks must not be substituted for:
  - Phased release
  - commit release
  - Main state machine decisions

---

## Repo Add-ons

The following content is an additional enhancement to the warehouse and does not belong to the original semantics of Cursor.

### Audit enhancement
- Forbidden word check
- Critique auditor output format
- `No new gap in this round / There is a gap in this round`
- strict convergence (such as implement 3 consecutive rounds without gaps)

### Rating and storage enhancements
- `run-auditor-host.ts`
- `iteration_count`
- `iterationReportPaths`
- Parsable scoring block requirements

### Status and gate control enhancement
- `.claude/state/bmad-progress.yaml`
- `.claude/state/stories/*.yaml`
-commit gate
- handoff protocol

### Configure system integration (audit granularity)

This skill supports controlling the audit granularity by configuring the system to implement three modes: `full`/`story`/`epic`.

#### Configuration loading

The master Agent must load the configuration when the skill starts:
```typescript
import { loadConfig, shouldAudit, shouldValidate } from './scripts/bmad-config';

const config = loadConfig();
```
#### Configure sources (by priority)

1. **CLI parameters**: `--audit-granularity=story` | `--continue`
2. **Environment variables**: `BMAD_AUDIT_GRANULARITY=story` | `BMAD_AUTO_CONTINUE=true`
3. **Project configuration**: `_bmad/_config/bmad-story-config.yaml`
4. **Default value**: `audit-granularity=full`, `auto_continue=false`

#### Conditional audit routing

Each Layer 4 stage (specify/plan/gaps/tasks/implement) must determine the execution path according to the configuration:
```typescript
// 条件审计逻辑模板
const stageConfig = getStageConfig('specify'); // 或当前阶段

if (stageConfig.audit) {
  // 路径 1: 完整审计（默认 full 模式）
  await executeFullAudit({
    strictness: stageConfig.strictness, // 'standard' | 'strict'
    subagentTool: 'Agent',
    subagentType: 'general-purpose'
  });
} else if (stageConfig.validation) {
  // 路径 2: 基础验证（story 模式的中间阶段）
  await executeBasicValidation({
    level: stageConfig.validation,      // 'basic' | 'test_only'
    checks: stageConfig.checks          // 验证项列表
  });
  // 验证通过后直接标记阶段完成，不生成 AUDIT_报告
  await markStageAsPassedWithoutAudit();
} else {
  // 路径 3: 仅生成文档（epic 模式的 story 阶段）
  await markStageAsPassedWithoutAudit();
}
```
#### Behavior of each mode

| Patterns | Story Creation | Intermediate Stages | Post-Implementation | Epic Audit |
|------|-----------|----------|--------|----------|
| **full** | Audit | All Audit | Audit | - |
| **story** | Audit | Basic Verification | Audit | - |
| **epic** | Not audited | Not audited | Not audited | Audited |

#### Authentication level definition

**basic verification** (used in the intermediate stage of story mode):
- Document existence check
- Basic structural inspection
- Required Chapter Check

**test_only verification** (for story mode implement phase):
- All tests passed
- Lint error-free
- Document exists

#### Execution body calling method

After using the configuration system, the execution body calling template is updated to:
```yaml
tool: Agent
subagent_type: general-purpose  # 始终使用 general-purpose，通过 prompt 传递配置
description: "Execute Stage with config-aware routing"
prompt: |
  【必读】本 prompt 包含配置上下文。

  **配置上下文**:
  - audit_mode: "story"  # full | story | epic
  - stage: "specify"     # 当前阶段
  - should_audit: false  # 根据配置计算
  - validation: "basic"  # 当 audit: false 时的验证级别

  **执行逻辑**:
  1. 读取配置并解析 should_audit
  2. 如果 should_audit: true → 执行完整审计流程（Step 4 审计循环）
  3. 如果 should_audit: false:
     - 若 validation: "basic" → 执行基础验证
     - 若 validation: "test_only" → 执行测试验证
     - 若 validation: null → 直接标记阶段通过
  4. 根据结果更新状态文件
```
### Runtime governance enhancements
- ralph-method trace file
- progress / prd required
- hooks / state / runtime adapter behavior

---

## Stage-by-Stage Orchestration

### Stage 1: Create Story

Claude's Stage 1 Create Story execution body is responsible for generating Story documents in the BMAD Story process and advancing the process to the Story audit stage.

#### Purpose

This stage is the execution adapter of the Create Story stage in Cursor `bmad-story-assistant` in the Claude Code CLI / OMC environment.

Goal:
- Inherit the business semantics of the Cursor Create Story phase
- Clearly defined executors, inputs, state updates and handoffs under the Claude runtime
- Provide standard products for subsequent Stage 2 Story audits

#### Required Inputs

- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- `project_root`
- If exists: `sprint-status.yaml`, related requirements documents, pre-Epic/Story planning documents

#### Cursor Canonical Base

- Main text baseline source: Stage 1 Create Story (`STORY-A1-CREATE`) template of the Cursor `bmad-story-assistant` skill.
- The main Agent must perform a sprint-status pre-check before initiating the Create Story subtask:
  1. When the user specifies Story through `epic_num/story_num` (or "4, 1", etc.), or parses the next Story from sprint-status, it must first check whether sprint-status exists.
  2. You can call `scripts/check-sprint-ready.ps1 -Json` or `_bmad/speckit/scripts/powershell/check-sprint-ready.ps1 -Json` (if the project root has `scripts/`, it will take precedence), and parse `SPRINT_READY`.
  3. If sprint-status does not exist, the user must be prompted "⚠️ sprint-status.yaml does not exist, it is recommended to run sprint-planning first" and require the user to explicitly confirm "Known bypass, continue" or execute sprint-planning first; the Create Story subtask must not be initiated before confirmation.
  4. If sprint-status exists, you can add the "sprint-status confirmed" mark to the subtask prompt to simplify the subtask logic.
  5. This stage can be exempted only if the user clearly "has passed party-mode and passed the audit, skip Create Story" and only requests Dev Story.
- When calling the Create Story workflow through a subtask, the master Agent must copy the entire **complete template** `STORY-A1-CREATE` and replace the placeholders; it is prohibited to generalize or abbreviate the template.
- Skip judgment: Only when the user **explicitly** says "passed party-mode and audit passed" and "skip Create Story", the main agent can skip stages one and two. If the user only provides the Epic/Story number or says "Story already exists" without clarifying the above statement, Create Story must be executed.
- Create Story template requirements:
  - Execute the equivalent workflow of `/bmad-bmm-create-story` through subtasks to generate Story documents of Epic `{epic_num}` and Story `{epic_num}-{story_num}`.
  - Output the Story document to `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`.
  - When creating Story documents, you must use clear descriptions and prohibit the use of words in the Story forbidden list (optional, considerable, follow-up, first implementation, subsequent expansion, pending, discretionary, contingent, technical debt).
  - When the function is not within the scope of this Story but belongs to this Epic, it must be stated "Responsible for Story X.Y" and a detailed description of the task; ensure that X.Y exists and the scope includes the function. Vague and delayed expressions are prohibited.
  - **party-mode mandatory**: Regardless of whether the Epic/Story document already exists, you **must** enter party-mode for multi-role debate (minimum 100 rounds) as long as any of the following situations are involved: ① There are multiple implementation options available; ② There are architectural/design decisions or trade-offs; ③ There are ambiguities or unresolved points in the options or scope.
  - Chinese must be used throughout the entire process.
- After Create Story is produced, the Story document is usually saved in: `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`.

#### Subtask Template (STORY-A1-CREATE)

When initiating the Create Story subtask, the following complete template must be used (all placeholders need to be replaced beforehand):

**Template ID**: STORY-A1-CREATE
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
  5. 输出 Story 文档到 {project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md（slug 从 Story 标题或用户输入推导）

  **强制约束**：
  - 创建 story 文档必须使用明确描述，禁止使用本 skill「§ 禁止词表（Story 文档）」中的词（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。
  - 当功能不在本 Story 范围但属本 Epic 时，须写明「由 Story X.Y 负责」及任务具体描述；确保 X.Y 存在且 scope 含该功能（若 X.Y 不存在，审计将判不通过并建议创建）。禁止「先实现 X，或后续扩展」「其余由 X.Y 负责」等模糊表述。
  - **party-mode 强制**：无论 Epic/Story 文档是否已存在，只要涉及以下任一情形，**必须**进入 party-mode 进行多角色辩论（**最少 100 轮**，见 party-mode step-02 的「生成最终方案和最终任务列表」或 Create Story 产出方案场景）：① 有多个实现方案可选；② 存在架构/设计决策或 trade-off；③ 方案或范围存在歧义或未决点。**禁止**以「Epic 已存在」「Story 已生成」为由跳过 party-mode。共识前须达最少轮次；若未达成单一方案或仍有未闭合的 gaps/risks，继续辩论直至满足或达上限轮次。
  - 全程必须使用中文。
```
**Placeholder replacement instructions**:
- `{epic_num}` → actual Epic number (e.g. `4`)
- `{story_num}` → actual Story number (e.g. `1`)
- `{epic-slug}` → Epic short name (like `cli-integration`)
- `{slug}` → Story short name (derived from title or input)
- `{project-root}` → absolute path to the project root directory

#### Stage 1 CLI output requirements before calling

The main Agent must output a call summary in the following format in the current session CLI before calling the Stage 1 execution body:
```
═══════════════════════════════════════════════════════════════════
Stage 1: Create Story - 子代理调用摘要
═══════════════════════════════════════════════════════════════════
执行体: bmad-story-create
subagent_type: general-purpose
调用时间: {timestamp}

输入参数:
  • epic_num: {实际值}
  • story_num: {实际值}
  • epic_slug: {实际值}
  • story_slug: {实际值}
  • project_root: {实际值}

提示词结构摘要:
  ├─ Cursor Canonical Base
  │   ├─ sprint-status 前置检查要求
  │   ├─ STORY-A1-CREATE 完整模板
  │   ├─ party-mode 强制要求（100轮辩论）
  │   └─ Story 禁止词表约束
  ├─ Claude/OMC Runtime Adapter
  │   ├─ Primary Executor: bmad-story-create
  │   ├─ Fallback: 主 Agent 直接执行
  │   └─ Runtime Contracts: 产物路径、状态更新
  └─ Repo Add-ons
      ├─ 禁止词检查
      ├─ 本仓目录规范
      └─ BMAD 状态机兼容

预期产物:
  • Story 文档: _bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md
  • 状态更新: story_created
  • Handoff 目标: bmad-story-audit
═══════════════════════════════════════════════════════════════════
```
The Agent tool is called immediately after output.

#### Claude/OMC Runtime Adapter

**Execution body calling method**

When the main Agent uses this skill, it must call the execution body in the following way:

**Important**: Claude Code CLI's `Agent` tool now supports formal specialized subtype routing for this product path. Whenever Stage 1 requires party-mode debate, the main path must use `.claude/agents/party-mode-facilitator.md` with `subagent_type: party-mode-facilitator`. Only non-specialized executors continue to use `general-purpose`.

1. **Party-mode debate mode** (preferred, and mandatory whenever design trade-offs, scope ambiguity, or architecture choices remain open):
   The main Agent reads `.claude/agents/party-mode-facilitator.md` in full and invokes it as the specialized subtype:
   ```yaml
   tool: Agent
   subagent_type: party-mode-facilitator
   description: "Run Stage 1 Party-Mode debate"
   prompt: |
     [Full contents of .claude/agents/party-mode-facilitator.md]

     Agenda:
     - debate before Story Create
     - current Epic/Story inputs and constraints
     - produce a convergence memo for downstream bmad-story-create
   ```
2. **Direct execution mode** (non party-mode, or after the facilitator has already produced convergence output):
   The main Agent directly reads the complete prompt of Stage 1 in this skill (including the Subtask Template above), copies the entire section and replaces the placeholder, and then uses the `Agent` tool to call the executor:
   ```yaml
   tool: Agent
   subagent_type: general-purpose
   description: "Execute Stage 1 Create Story"
   prompt: |
     [本 skill Stage 1 的完整内容，含 Cursor Canonical Base + Subtask Template，所有占位符已替换]
   ```
3. **Agent file reference mode**:
   If you use `.claude/agents/bmad-story-create.md` as the executable body, you must first read the entire file content and then pass it in as `prompt`. These non-specialized executors still use `general-purpose`:
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
**Important**:
- You must not just pass in the executable file path and let the executor read it by itself. You must pass in the complete prompt content.
- The execution body itself does not load skills, and all instructions are passed by the main Agent through the prompt parameter.
- Party-mode debate must prefer `party-mode-facilitator` as the main path.
- After the execution body returns, the main Agent must verify the handoff output and decide the next route

---

**Primary Executor**
- `.claude/agents/bmad-story-create.md` (called through the Agent tool, the complete prompt is passed in by the main Agent)

**Optional Reuse**
- Reuse existing discussion / brainstorming / party-mode equivalent capabilities to assist in generating Story documents
- Reusable `speckit-constitution.md`, `speckit-analyze.md`, `speckit-checklist.md` as input constraints and checking aids

**Fallback Strategy**
1. Prioritize directly generating Story documents by `bmad-story-create` agent
2. If in-depth discussion is required and the OMC/conversational executor is available, reuse it to complete the solution convergence, but this stage will still be responsible for finalizing the final Story product.
3. If the external executor is unavailable, the main Agent will sequentially execute requirements collection, structured generation, and quality self-inspection.
4. Fallback must not change the semantic requirements of Cursor Canonical Base

**Runtime Contracts**
- Product path: `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md`
- After the Story output is completed, the story state must be updated to `story_created`
- Must be written to handoff and handed over to `bmad-story-audit` for execution in Stage 2
- If the user explicitly skips Create Story, the skip reason must be recorded and the Story audit must be entered directly

#### Repo Add-ons

- Story documents must comply with the forbidden word rules of this warehouse
- Story documents must be auditable and must not have ambiguous scope that cannot be mapped to subsequent stages
- The output directory and naming must comply with the BMAD story directory specifications of this warehouse
- The state file and handoff must be compatible with `.claude/state/bmad-progress.yaml` and `.claude/state/stories/*-progress.yaml`

#### Output / Handoff

Output handoff after completion:
```yaml
layer: 3
stage: story_create

execution_summary:
  agent: bmad-story-create
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: sprint_status_check
      status: passed
      result: "sprint-status.yaml 已确认"
    - step: story_generation
      status: completed
      result: "Story 文档已生成"
    - step: document_persistence
      status: completed
      result: "文档已写入"
    - step: state_update
      status: completed
      result: "状态已更新为 story_created"

artifacts:
  story_doc:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md"
    exists: true

handoff:
  next_action: story_audit
  next_agent: bmad-story-audit
  ready: true
```
### Stage 2: Story Audit

Claude's Stage 2 Story audit execution body is responsible for auditing Story documents and deciding whether to allow access to Dev Story.

#### Purpose

This stage is the execution adapter of the Story document audit stage in Cursor `bmad-story-assistant` in the Claude Code CLI / OMC environment.

Goal:
- Inherit Cursor Story audit semantics
- Perform pass/fail judgment on Story documents
- Handoff to Dev Story after passing the audit
- Loopback to repair Story documents after audit failure

#### Required Inputs

- `storyDocPath`
- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- Relevant requirements sources/Epic/Story planning documents/constraint documents (if existing)

#### Cursor Canonical Base

- Main text baseline source: Stage 2 Story Audit Template (`STORY-A2-AUDIT`) for the Cursor `bmad-story-assistant` skill.
- After the Story document is generated, the audit subtask must be initiated and iterated until "complete coverage and verification passed".
- Strictness selection:
  - **strict**: 3 consecutive rounds without gap + critical auditor >50%
  - **standard**: single + critical auditor
- Selection logic:
  - If there is no party-mode output (there is no `DEBATE_consensus_*`, `party-mode convergence record`, etc. in the story directory) or the user requires strict → use **strict** (to compensate for the missing party-mode depth)
  - If party-mode artifacts exist and user does not enforce strict → use **standard**
- Audit subagent priority:
  - Prioritize Story auditing through code-reviewer / equivalent reviewer
  - If reviewer is unavailable, fall back to the universal execution body, but the **complete** `STORY-A2-AUDIT` template must be passed in; **must not** be replaced by other universal audit prompt words
- The master agent must copy the entire `STORY-A2-AUDIT` template and replace the placeholders; summarizing, abbreviating or only passing the summary is prohibited.
- The audit content must be verified item by item:
  1. Whether the Story document fully covers the original requirements and Epic definition
  2. If there is any word in the prohibited word list in the Story document, it will be judged as failed.
  3. Whether the multi-solution scenario has reached consensus through debate and selected the optimal solution
  4. Is there technical debt or placeholder statements?
  5. If the Story contains "Responsible by Story
- The end of the report must output: conclusion (passed/failed) + required sub-items + Story stage parsable scoring blocks (overall rating A/B/C/D + four-dimensional scoring: requirements completeness/testability/consistency/traceability).
- Must do after passing the audit: return the fields required by `runAuditorHost` and let the invoking host/runner complete the story-stage close-out.
- When the audit fails: The audit sub-agent must **directly modify the audited Story document** within this round to eliminate the gap; if the recommendation involves creating or updating other Stories, the main Agent must first implement the recommendation and then re-audit the current Story.
- Phase 2 admission check: after receiving the phase 2 passing conclusion and before entering phase 3, the main agent must first confirm that the unified auditor host runner has completed story-stage post-audit automation; if not, backfill `runAuditorHost` instead of hand-running score CLI.

#### Stage 2 CLI output requirements before calling

The main Agent must output a call summary in the following format in the current session CLI before calling the Stage 2 execution body:
```
═══════════════════════════════════════════════════════════════════
Stage 2: Story 审计 - 子代理调用摘要
═══════════════════════════════════════════════════════════════════
执行体: bmad-story-audit
subagent_type: general-purpose
调用时间: {timestamp}

输入参数:
  • storyDocPath: {实际值}
  • epic_num: {实际值}
  • story_num: {实际值}
  • epic_slug: {实际值}
  • story_slug: {实际值}

审计严格度:
  • 当前模式: {strict|standard}
  • 判定依据: {无 party-mode 产物 → strict / 有 party-mode → standard}

提示词结构摘要:
  ├─ Cursor Canonical Base
  │   ├─ STORY-A2-AUDIT 完整模板
  │   ├─ 逐项验证要求（5大验证项）
  │   ├─ 批判审计员介入要求
  │   └─ 可解析评分块格式要求
  ├─ Claude/OMC Runtime Adapter
  │   ├─ Primary Executor: bmad-story-audit
  │   ├─ Fallback: OMC reviewer → code-review skill → 主 Agent
  │   └─ Runtime Contracts: 报告路径、状态更新
  └─ Repo Add-ons
      ├─ 禁止词检查
      ├─ 批判审计员结论（>50%字数）
      ├─ runAuditorHost 触发
      └─ 统一 auditor host runner 完成态检查

预期产物:
  • 审计报告: _bmad-output/.../AUDIT_story-{epic_num}-{story_num}.md
  • 评分写入: scoring/data/...json
  • 状态更新: story_audit_passed / story_audit_failed
═══════════════════════════════════════════════════════════════════
```
The Agent tool is called immediately after output.

#### Claude/OMC Runtime Adapter

**Execution body calling method**

When the main Agent calls the Stage 2 execution body, the complete content of Stage 2 in this skill (including all audit requirements of the Cursor Canonical Base) must be passed in through the `Agent` tool:
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
**Important**: The executor does not load this skill by itself; all audit instructions, checklist items, and output-format requirements must be fully passed by the Main Agent via the `prompt` parameter.

---

**Primary Executor**
- `.claude/agents/bmad-story-audit.md` (called through the Agent tool, the complete prompt is passed in by the main Agent)

**Optional Reuse**
- Reusable `code-review` / reviewer capabilities assist in generating audit reports
- Reusable existing warehouse audit formats, critical auditor requirements and scoring block requirements

**Fallback Strategy**
1. Priority is given to `bmad-story-audit` agent to perform Story auditing
2. If the OMC reviewer is available, it will be reused for auxiliary review, but the final judgment will still be summarized and placed at this stage.
3. If the reviewer is unavailable, the main Agent directly executes the same three-tier structure audit prompt
4. Fallback shall not reduce audit stringency

**Runtime Contracts**
- Audit report path: `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md`
- Audit passed: update story state to `story_audit_passed`, handoff to `speckit-implement`
- Audit failed: Update story state to `story_audit_failed`, requiring the Story document to be repaired and re-audited.

#### Repo Add-ons

- Story audit must perform the forbidden word check of this warehouse
- Critical auditor conclusion must be output
- pass / fail / required_fixes must be clearly marked
- state and handoff must be compatible with the BMAD story state machine of this warehouse

#### Output / Handoff

**PASS**
```yaml
layer: 3
stage: story_audit_passed

execution_summary:
  agent: bmad-story-audit
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: passed
  strictness: {strict|standard}

audit_summary:
  gaps_found: 0
  criteria_verified:
    - requirement_coverage: passed
    - forbidden_words_check: passed
    - multi_solution_consensus: passed
    - tech_debt_check: passed
    - story_references_valid: passed
  critical_auditor_percentage: "{XX}%"
  score_block_generated: true

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md"
    exists: true
  score_data:
    path: "scoring/data/{epic_num}-{story_num}-story-audit.json"
    written: true

handoff:
  next_action: dev_story
  next_agent: speckit-implement
  ready: true
```

**FAIL**
```yaml
layer: 3
stage: story_audit_failed

execution_summary:
  agent: bmad-story-audit
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: failed

audit_summary:
  gaps_found: {N}
  criteria_failed:
    - {具体失败项}
  critical_auditor_percentage: "{XX}%"

required_fixes_detail:
  fixes:
    - fix_id: FIX-001
      description: "{修复描述}"
      location: "{文档位置}"
      severity: critical|high|medium
  fix_strategy: direct_modify
  iteration_required: true

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
    modified_in_round: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{story_num}-{story_slug}/AUDIT_story-{epic_num}-{story_num}.md"
    exists: true

handoff:
  next_action: revise_story
  next_agent: bmad-story-create
  ready: true
```
### Stage 3: Dev Story / `STORY-A3-DEV`

Claude's Stage 3 Dev Story execution body is responsible for executing tasks according to the TDD traffic light mode and completing code implementation.

#### Purpose

This stage is the execution adapter of the Dev Story stage in Cursor `bmad-story-assistant` in the Claude Code CLI / OMC environment.

Goal:
- Inherit the business semantics of Cursor Dev Story stage
- Strictly implement the TDD traffic light sequence
- Maintain ralph-method tracking files
- A Stage 4 Post Audit must be initiated after implementation

#### Required Inputs

- `tasksPath`: tasks.md file path
- `epic`: Epic number
- `story`: Story number
- `epicSlug`: Epic name slug
- `storySlug`: Story name slug
- `mode`: `bmad` or `standalone`

#### Cursor Canonical Base

- Use `STORY-A3-DEV` as the main text baseline
- The pre-requisite document must be PASS (Story audit passing status)
- TDD traffic light sequence must be complete (RED → GREEN → REFACTOR)
- Must maintain ralph-method tracking files (prd.json + progress.txt)
- `STORY-A4-POSTAUDIT` must be initiated after the subtask returns
- 15 iron rules must be observed during implementation

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
  - 执行 `run-auditor-host.ts` 记录进度
  - handoff 到 Stage 4 Post Audit
```
#### Stage 3 CLI output requirements before calling

The main Agent must output a call summary in the following format in the current session CLI before calling the Stage 3 execution body:
```
═══════════════════════════════════════════════════════════════════
Stage 3: Dev Story - 子代理调用摘要
═══════════════════════════════════════════════════════════════════
执行体: bmad-layer4-dev-story
type: agent-sequence (5 sub-agents)
调用时间: {timestamp}

输入参数:
  • tasksPath: {实际值}
  • epic: {实际值}
  • story: {实际值}
  • epicSlug: {实际值}
  • storySlug: {实际值}
  • mode: {实际值}

TDD 红绿灯顺序强调:
  1. RED: 先写测试 → 测试失败
  2. GREEN: 实现代码 → 测试通过
  3. IMPROVE: 重构代码 → 保持通过

提示词结构摘要:
  ├─ Cursor Canonical Base
  │   ├─ Layer 4 五阶段执行序列 (specify → plan → gaps → tasks → implement)
  │   ├─ 每阶段 handoff 检查点
  │   └─ 强制 TDD 要求
  ├─ Claude/OMC Runtime Adapter
  │   ├─ Primary: bmad-layer4-dev-story (sequence coordinator)
  │   ├─ Sub-agents: specify, plan, gaps, tasks, implement
  │   └─ Runtime Contracts: 每阶段产物路径、状态更新
  └─ Repo Add-ons
      ├─ 禁止词检查
      ├─ ralph-method 追踪
      └─ TDD 证据审查

预期产物:
  • 设计文档: _bmad-output/.../DESIGN-{epic}-{story}.md
  • 实现代码: src/... (根据 story 而定)
  • 测试代码: tests/... (根据 story 而定)
  • 状态更新: story_development_completed
═══════════════════════════════════════════════════════════════════
```
The Agent tool is called immediately after output.

#### Claude/OMC Runtime Adapter

**Execution body calling method**

When the main Agent calls the Stage 3 execution body, the complete content of Stage 3 in this skill must be passed in through the `Agent` tool:
```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 3 Dev Story"
prompt: |
  你作为 speckit-implement / bmad-layer4-speckit-implement 执行体，执行以下 Stage 3 Dev Story 流程：

  [本 skill Stage 3 的完整内容，含 Required Inputs、Cursor Canonical Base、Subtask Template，所有占位符已替换]
```
**Important**: The execution body itself does not load the skill, and all instructions are completely passed by the main Agent through the prompt parameter.

---

**Primary Executor**
- `.claude/agents/speckit-implement.md`
- `.claude/agents/layers/bmad-layer4-speckit-implement.md` (BMAD mode)

**Fallback Strategy**
1. Prioritize execution by speckit-implement / bmad-layer4-speckit-implement
2. If unavailable, fall back to the main Agent and directly execute the TDD cycle
3. Batch audit and final audit are performed by `auditor-implement` or the main Agent

**Runtime Contracts**
- Must create/update ralph-method tracking files (prd.json + progress.txt)
- Must be executed in TDD order (RED → GREEN → REFACTOR)
- Update prd.json passes status after each User Story is completed
- TDD loops must be logged to progress.txt
- Stage 4 Post Audit must be triggered after implementation

#### Repo Add-ons

- progress / prd update requirements
- This warehouse's scoring / handoff / lint / key path requirements
- Strict convergence check (continuous 3 rounds no gap)
-Critical auditor intervention

#### Output / Handoff

Output handoff after completion:
```yaml
layer: 4
stage: implement_passed

execution_summary:
  agent: speckit-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: party_mode_check
      status: passed
      result: "party-mode.yaml 已确认"
    - step: spec_read
      status: completed
      result: "spec.md 已读取"
    - step: plan_read
      status: completed
      result: "plan.md 已读取"
    - step: tasks_read
      status: completed
      result: "tasks.md 已读取"
    - step: tdd_red
      status: completed
      result: "测试已编写，失败状态确认"
    - step: tdd_green
      status: completed
      result: "实现已编写，测试通过"
    - step: tdd_refactor
      status: completed
      result: "代码已重构"
    - step: state_update
      status: completed
      result: "story state 已更新为 implement_passed"

tdd_summary:
  red_phase:
    tests_written: {count}
    tests_failed_initially: {count}
    status: completed
  green_phase:
    implementation_complete: true
    tests_passing: {count}
    status: completed
  refactor_phase:
    code_quality_checks_passed: true
    test_coverage: "{percent}%"
    status: completed

ralph_method_status:
  prd_json_updated: true
  progress_txt_updated: true
  passes_status: "all_passed"

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  implementation_code:
    path: "{implementationPath}"
    exists: true
    file_count: {count}
  test_files:
    path: "{testPath}"
    exists: true
    coverage: "{percent}%"
  ralph_artifacts:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/"
    files:
      - "prd.json"
      - "progress.txt"

handoff:
  next_action: post_audit
  next_agent: auditor-implement
  next_stage: 4
  ready: true
  prerequisites_met:
    - tdd_cycle_complete
    - ralph_method_tracked
    - state_updated
```
**Runtime Governance (S11 - post-audit):** The main Agent executes before calling the post-audit subtask:
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit`
Execute after the subtask returns:
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit --persist`
`{story_key}` is the kebab-case key of the current Story.

### Stage 4: Post Audit / `STORY-A4-POSTAUDIT`

Claude is the Stage 4 Post Audit executor, responsible for strictly auditing the Dev Story implementation results.

#### Purpose

This stage is the execution adapter of the Post Audit stage in Cursor `bmad-story-assistant` in the Claude Code CLI / OMC environment.

Goal:
- Inherit Cursor Post Audit semantics
- Verify that the code implementation fully covers tasks, specs, and plans
- Special review of TDD implementation evidence and ralph-method tracking files
- Decide whether to allow entry to the commit gate

#### Required Inputs

- `artifactDocPath`: the code/document path under review
- `reportPath`: audit report saving path
- `tasksPath`: tasks.md path (for comparison)
- `specPath`: spec.md path (for comparison, optional)
- `planPath`: plan.md path (for comparison, optional)
- `epic`: Epic number
- `story`: Story number
- `epicSlug`: Epic name slug
- `storySlug`: Story name slug
- `iterationCount`: current iteration round number (default 0)
- `strictness`: strictness mode (simple/standard/strict, default standard)

#### Cursor Canonical Base

- Baseline Cursor post-audit semantics
- post-audit is a required step, not optional
- The subject of review is **code implementation**, not documentation
- **Do not modify the code directly** when a gap is discovered (the main Agent entrusts the sub-agent to implement modifications)
- Use **code pattern dimensions** (functionality, code quality, test coverage, security)
- Evidence of TDD traffic light execution must be verified
- Must check ralph-method trace file
- `runAuditorHost` must be triggered after the audit passes

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
  - runAuditorHost 触发
  - commit gate 前置条件检查
```
#### Stage 4 CLI output requirements before calling

The main Agent must output a call summary in the following format in the current session CLI before calling the Stage 4 execution body:
```
═══════════════════════════════════════════════════════════════════
Stage 4: Post Audit - 子代理调用摘要
═══════════════════════════════════════════════════════════════════
执行体: bmad-story-post-audit
subagent_type: general-purpose
调用时间: {timestamp}

输入参数:
  • artifactDocPath: {实际值}
  • reportPath: {实际值}
  • tasksPath: {实际值}
  • specPath: {实际值}
  • planPath: {实际值}
  • gapsPath: {实际值}
  • implementationPath: {实际值}

代码模式维度强调:
  • 禁止词检查: 无模糊表述、无延期承诺
  • 一致性检查: 实现与 spec/plan/tasks 对齐
  • TDD 证据审查: 测试覆盖率 ≥ 80%
  • 代码质量: 函数 < 50 行，文件 < 800 行

strict convergence 检查:
  • 第1轮: 初步审计，发现所有 gap
  • 第2轮: 验证修复，确认无新 gap
  • 第3轮: 最终确认，输出通过标记

提示词结构摘要:
  ├─ Cursor Canonical Base
  │   ├─ POST-AUDIT-PROTOCOL 完整模板
  │   ├─ 5大代码审计维度（禁止词/一致性/TDD/质量/安全）
  │   ├─ 批判审计员介入要求
  │   └─ 可解析评分块格式
  ├─ Claude/OMC Runtime Adapter
  │   ├─ Primary Executor: bmad-story-post-audit
  │   ├─ Fallback: auditor-spec/plan/tasks/implement 序列
  │   └─ Runtime Contracts: 审计报告路径、评分写入
  └─ Repo Add-ons
      ├─ 禁止词检查（含代码注释）
      ├─ 批判审计员结论（>50%字数）
      ├─ runAuditorHost 触发
      └─ strict 模式 3 轮收敛

预期产物:
  • 审计报告: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  • 评分写入: scoring/data/...json
  • 状态更新: story_audit_passed / story_audit_failed
═══════════════════════════════════════════════════════════════════
```
The Agent tool is called immediately after output.

#### Claude/OMC Runtime Adapter

**Execution body calling method**

When the main Agent calls the Stage 4 execution body, the complete content of Stage 4 in this skill must be passed in through the `Agent` tool:
```yaml
tool: Agent
subagent_type: general-purpose
description: "Execute Stage 4 Post Audit"
prompt: |
  你作为 auditor-implement 执行体，执行以下 Stage 4 Post Audit 流程：

  [本 skill Stage 4 的完整内容，含 Required Inputs、Cursor Canonical Base、Subtask Template，所有占位符已替换]
```
**Important**: The execution body itself does not load the skill, and all audit instructions are completely passed by the main Agent through the prompt parameter.

---

**Primary Executor**
- `.claude/agents/auditors/auditor-implement.md`

**Fallback Strategy**
1. Post Audit is executed by `auditor-implement` agent first.
2. If unavailable, fall back to OMC reviewer
3. If it is no longer available, fall back to `code-review` skill
4. Finally, fall back to the main Agent and directly execute the same three-layer audit prompt.

**Runtime Contracts**
- Audit report path: `_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md`
- `run-auditor-host.ts` must be executed after passing the audit
- Update story state to `implement_passed` after passing the audit
- After audit failure, update story state to `implement_failed` and fall back to Stage 3 for repair

#### Repo Add-ons

- strict convergence (no gap for 3 consecutive rounds)
- Criticize the auditor’s conclusions
- runAuditorHost triggers
- commit gate precondition check
- Check forbidden words in this warehouse

#### Output / Handoff

**PASS**
```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 已读取"
    - step: strictness_determination
      status: passed
      result: "审计严格度: {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "代码实现已读取"
    - step: tasks_comparison
      status: completed
      result: "tasks 覆盖度已验证"
    - step: spec_comparison
      status: completed
      result: "spec 对齐度已验证"
    - step: tdd_evidence_review
      status: completed
      result: "TDD 红绿灯证据已审查"
    - step: ralph_method_check
      status: completed
      result: "ralph-method 追踪文件已检查"
    - step: reviewer_invocation
      status: completed
      result: "批判审计员已介入"
    - step: parse_and_write_score
      status: completed
      result: "评分已写入 scoring/data/"
    - step: state_update
      status: completed
      result: "story state 已更新为 implement_audit_passed"

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  tdd_evidence:
    red_phase_confirmed: true
    green_phase_confirmed: true
    refactor_phase_confirmed: true
    test_coverage: "{percent}%"
  ralph_method_check:
    prd_json_complete: true
    progress_txt_complete: true
    all_stories_passed: true
  code_quality:
    avg_function_lines: {number}
    avg_file_lines: {number}
    no_banned_words: true
    security_checks_passed: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**FAIL**
```yaml
layer: 4
stage: implement_audit_failed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 已读取"
    - step: strictness_determination
      status: passed
      result: "审计严格度: {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "代码实现已读取"
    - step: tasks_comparison
      status: failed
      result: "发现 tasks 未覆盖项"
    - step: spec_comparison
      status: failed
      result: "发现 spec 偏离项"
    - step: tdd_evidence_review
      status: failed
      result: "TDD 证据不足"
    - step: ralph_method_check
      status: failed
      result: "ralph-method 追踪不完整"
    - step: reviewer_invocation
      status: completed
      result: "批判审计员已介入"
    - step: gap_documentation
      status: completed
      result: "所有 gap 已记录"

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  gaps_found:
    total: {count}
    critical: {count}
    major: {count}
    minor: {count}
  required_fixes:
    - category: "tasks_coverage"
      description: "{gap_description}"
      priority: critical
    - category: "spec_alignment"
      description: "{gap_description}"
      priority: major
    - category: "tdd_evidence"
      description: "{gap_description}"
      priority: major
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "FAIL"
    critical_gaps: {count}

required_fixes_detail:
  fix_strategy: "return_to_stage_3"
  estimated_fix_time: "{duration}"
  fix_categories:
    - category: "implementation"
      items: [{gap_items}]
    - category: "tests"
      items: [{gap_items}]
    - category: "documentation"
      items: [{gap_items}]

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  gaps_list:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/GAPS_{epic}-{story}_stage4.md"
    exists: true

handoff:
  next_action: fix_implement
  next_agent: speckit-implement
  next_stage: 3
  ready: true
  fix_required: true
  prerequisites_met:
    - audit_completed
    - gaps_documented
    - reviewer_conclusion_verified
```
---

#### Story Type Detection (Code vs Document Mode)

Stage 4 supports two audit modes, automatically routing according to Story type:

| Story type | Detection basis | Audit mode | Execution body |
|-----------|----------|----------|--------|
| **Code Implementation Type** | tasks.md contains code tasks, spec.md defines interface/implementation | Code Mode | `auditor-implement` |
| **Document verification type** | tasks.md tasks are pure documentation/verification work, no production code | Document Mode | `auditor-document` |

**Automatic detection logic** (main Agent execution):
```typescript
// TypeScript 检测逻辑示例
function detectStoryType(tasksPath: string, specPath?: string): 'code' | 'document' {
  const tasksContent = readFile(tasksPath);

  // 文档型特征：任务均为文档创建、验证、测试配置等
  const documentPatterns = [
    /创建.*文档/i,
    /验证.*输出/i,
    /检查.*配置/i,
    /测试.*Story/i,
    /文档.*生成/i,
    /格式.*验证/i,
  ];

  // 代码型特征：涉及生产代码、接口实现、模块开发
  const codePatterns = [
    /实现.*函数/i,
    /创建.*模块/i,
    /添加.*接口/i,
    /编写.*代码/i,
    /开发.*功能/i,
    /refactor|重构/i,
  ];

  const docMatches = documentPatterns.filter(p => p.test(tasksContent)).length;
  const codeMatches = codePatterns.filter(p => p.test(tasksContent)).length;

  // 优先判断：如果有代码相关任务，视为代码型
  if (codeMatches > 0) return 'code';
  if (docMatches > 0 && codeMatches === 0) return 'document';

  // 默认保守策略：按代码型处理（更严格）
  return 'code';
}
```
#### Extended Cursor Canonical Base (Code vs Document)

**Code Mode (code audit mode)**:

- The subject of review is **code implementation**, not documentation
- **Do not modify the code directly** when a gap is discovered (the main Agent entrusts the sub-agent to implement modifications)
- Use **code pattern dimensions** (functionality, code quality, test coverage, security)
- Evidence of TDD traffic light execution must be verified
- Must check ralph-method trace file
- `runAuditorHost` must be triggered after the audit passes

**Document Mode**:

- The subject of review is the **Story document itself**, not the code
- When a gap is found **directly modify the document under review** (auditor will repair it by itself)
- Use **document mode dimensions** (document completeness, task completion, consistency, traceability)
- No need to check TDD evidence (no code)
- No need to check ralph-method file (no code)
- Must verify that all tasks in tasks.md are marked complete
- `runAuditorHost` must be triggered after the audit passes

#### Code vs Document audit comparison

| Project | Code audit (auditor-implement) | Document audit (auditor-document) |
|------|----------------------------------|----------------------------------|
| **Object being reviewed** | Code implementation | Story document itself |
| **When a gap is found** | **Do not modify the code** (main Agent entrusts modification) | **Modify the document directly** (auditor repairs it by itself) |
| **Dimensions** | Functionality/code quality/test coverage/security | Documentation completeness/task completion/consistency/traceability |
| **TDD Check** | Forced check by US | None (no code) |
| **ralph-method** | Force check prd.json + progress.txt | None (no code) |
| **tasks check** | Verify code coverage tasks | Verify task mark completion |
| **Forbidden word check** | progress.txt + code comments | Story document full text |
| **Iterative convergence** | 3 consecutive rounds without gap (strict) | 3 consecutive rounds without gap (strict) |
| **Critical Auditor** | ≥50% word count | ≥50% word count |

---

### Document Mode Subtask Template (STORY-A4-DOCUMENT-AUDIT)
```yaml
description: "Execute Document Post Audit for {epic}-{story} via STORY-A4-DOCUMENT-AUDIT"
prompt: |
  【必读】本 prompt 须为完整模板且所有占位符已替换。

  你作为 auditor-document 执行体，执行 BMAD Stage 4 Post Audit（文档审计模式）流程。

  **Required Inputs**（已替换为实际值）：
  - artifactDocPath: {实际路径}（被审 Story 文档路径）
  - tasksPath: {实际路径}（验证任务完成状态）
  - reportPath: {实际路径}（审计报告保存路径）
  - epic: {实际值}
  - story: {实际值}
  - iterationCount: {实际值}
  - strictness: {standard|strict}

  **Cursor Canonical Base - Document Audit 要求**：
  1. 读取 audit-prompts.md §1（借用 spec 审计的文档检查方法）
  2. 读取批判审计员规范
  3. 读取文档迭代规则
  4. 读取被审 Story 文档
  5. 读取 tasks.md，验证所有任务已标记完成
  6. 检查 Story 文档质量（完整性、准确性、规范性）
  7. 检查文档中无禁止词、无模糊表述
  8. 发现 gap 时直接修改被审文档
  9. 生成包含批判审计员结论的完整报告
  10. 报告结尾输出可解析评分块

  **审计维度**（Document Mode）：
  - 文档完整性：结构完整、章节齐全、格式规范
  - 任务完成度：tasks.md 中所有任务已标记完成
  - 一致性：文档内部一致、与前置文档一致
  - 可追溯性：需求可追溯到验收标准

  **Repo Add-ons**：
  - 禁止词检查（Story 文档全文）
  - 批判审计员结论（>50%字数）
  - runAuditorHost 触发
  - commit gate 前置条件检查
```
---

#### Stage 4 pre-call CLI output requirements (dual mode)

**Code Mode call summary**:
```
═══════════════════════════════════════════════════════════════════
Stage 4: Post Audit (Code Mode) - 子代理调用摘要
═══════════════════════════════════════════════════════════════════
执行体: auditor-implement
subagent_type: general-purpose
调用时间: {timestamp}

Story 类型检测:
  • 检测依据: tasks.md 内容分析
  • 检测结果: 代码实现型（Code Mode）

输入参数:
  • artifactDocPath: {实际值}
  • reportPath: {实际值}
  • tasksPath: {实际值}
  • specPath: {实际值}
  • planPath: {实际值}

代码模式维度强调:
  • 禁止词检查: 无模糊表述、无延期承诺
  • 一致性检查: 实现与 spec/plan/tasks 对齐
  • TDD 证据审查: 测试覆盖率 ≥ 80%
  • 代码质量: 函数 < 50 行，文件 < 800 行

strict convergence 检查:
  • 第1轮: 初步审计，发现所有 gap
  • 第2轮: 验证修复，确认无新 gap
  • 第3轮: 最终确认，输出通过标记

预期产物:
  • 审计报告: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  • 评分写入: scoring/data/...json
  • 状态更新: implement_audit_passed / implement_audit_failed
═══════════════════════════════════════════════════════════════════
```
**Document Mode call summary**:
```
═══════════════════════════════════════════════════════════════════
Stage 4: Post Audit (Document Mode) - 子代理调用摘要
═══════════════════════════════════════════════════════════════════
执行体: auditor-document
subagent_type: general-purpose
调用时间: {timestamp}

Story 类型检测:
  • 检测依据: tasks.md 内容分析
  • 检测结果: 文档验证型（Document Mode）

输入参数:
  • artifactDocPath: {实际值}
  • tasksPath: {实际值}
  • reportPath: {实际值}

文档模式维度强调:
  • 文档完整性: 结构完整、章节齐全、格式规范
  • 任务完成度: tasks.md 中所有任务已标记完成
  • 一致性: 文档内部一致、与前置文档一致
  • 可追溯性: 需求可追溯到验收标准

关键区别:
  • 被审对象: Story 文档本身（非代码）
  • Gap 修复: 审计子代理直接修改文档
  • 无 TDD 检查: 无代码实现
  • 无 ralph-method: 无代码实现

strict convergence 检查:
  • 第1轮: 初步审计，发现所有 gap
  • 第2轮: 验证修复，确认无新 gap
  • 第3轮: 最终确认，输出通过标记

预期产物:
  • 审计报告: _bmad-output/.../AUDIT-POST-{epic}-{story}.md
  • 评分写入: scoring/data/...json
  • Gap 修复: 直接修改 Story 文档
  • 状态更新: implement_audit_passed / implement_audit_failed
═══════════════════════════════════════════════════════════════════
```
The Agent tool is called immediately after output.

---

#### Claude/OMC Runtime Adapter (dual mode)

**Execution body calling method**

When the main Agent calls the Stage 4 execution body, it must select the correct execution body according to the Story type:
```typescript
// 主 Agent 路由逻辑
const storyType = detectStoryType(tasksPath, specPath);

if (storyType === 'code') {
  // Code Mode - 使用 auditor-implement
  await Agent({
    subagent_type: 'general-purpose',
    description: "Execute Stage 4 Post Audit (Code Mode)",
    prompt: codeModePrompt // 完整 STORY-A4-POSTAUDIT 模板
  });
} else {
  // Document Mode - 使用 auditor-document
  await Agent({
    subagent_type: 'general-purpose',
    description: "Execute Stage 4 Post Audit (Document Mode)",
    prompt: documentModePrompt // 完整 STORY-A4-DOCUMENT-AUDIT 模板
  });
}
```
**Primary Executor (by mode)**

| Mode | Primary Executor | Agent File |
|------|------------------|------------|
| Code Mode | `auditor-implement` | `.claude/agents/auditors/auditor-implement.md` |
| Document Mode | `auditor-document` | `.claude/agents/auditors/auditor-document.md` |

**Fallback Strategy (dual mode)**

Code Mode:
1. Post Audit is executed by `auditor-implement` agent first.
2. If unavailable, fall back to OMC reviewer
3. If it is no longer available, fall back to `code-review` skill
4. Finally, fall back to the main Agent and directly execute the same three-layer audit prompt.

Document Mode:
1. Post Audit is executed by `auditor-document` agent first.
2. If unavailable, fall back to OMC reviewer
3. If it is no longer available, fall back to `code-review` skill
4. Finally, fall back to the main Agent and directly execute the same three-layer audit prompt.

**Important**: The execution body itself does not load the skill, and all audit instructions are completely passed by the main Agent through the prompt parameter.

---

**Runtime Contracts (dual mode)**

Code Mode:
- Audit report path: `_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md`
- `run-auditor-host.ts` must be executed after passing the audit
- Update story state to `implement_passed` after passing the audit
- After audit failure, update story state to `implement_failed` and fall back to Stage 3 for repair

Document Mode:
- Audit report path: `_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md`
- `run-auditor-host.ts` must be executed after passing the audit
- After passing the audit, update the story state to `implement_passed` (document-type Story is regarded as implemented)
- After the audit fails, update the story state to `implement_failed` and return to the repair document

---

#### Repo Add-ons (dual mode)

Code Mode:
- strict convergence (no gap for 3 consecutive rounds)
- Criticize the auditor’s conclusions
- runAuditorHost triggers
- commit gate precondition check
- Inspection of forbidden words in this warehouse (including code comments)
- TDD traffic light review
- ralph-method tracking file review

Document Mode:
- strict convergence (no gap for 3 consecutive rounds)
- Criticize the auditor’s conclusion (≥50% word count)
- runAuditorHost triggers
- commit gate precondition check
- Check forbidden words in this warehouse (full text of Story document)
- Document structural integrity check
- Verification of task completion

---

#### Output / Handoff (dual mode)

**Code Mode-PASS**
```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-implement
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 已读取"
    - step: strictness_determination
      status: passed
      result: "审计严格度: {simple|standard|strict}"
    - step: artifact_read
      status: completed
      result: "代码实现已读取"
    - step: tasks_comparison
      status: completed
      result: "tasks 覆盖度已验证"
    - step: spec_comparison
      status: completed
      result: "spec 对齐度已验证"
    - step: tdd_evidence_review
      status: completed
      result: "TDD 红绿灯证据已审查"
    - step: ralph_method_check
      status: completed
      result: "ralph-method 追踪文件已检查"
    - step: reviewer_invocation
      status: completed
      result: "批判审计员已介入"
    - step: parse_and_write_score
      status: completed
      result: "评分已写入 scoring/data/"
    - step: state_update
      status: completed
      result: "story state 已更新为 implement_audit_passed"

audit_summary:
  coverage:
    tasks_verified: {percent}%
    spec_verified: {percent}%
    plan_verified: {percent}%
  tdd_evidence:
    red_phase_confirmed: true
    green_phase_confirmed: true
    refactor_phase_confirmed: true
    test_coverage: "{percent}%"
  ralph_method_check:
    prd_json_complete: true
    progress_txt_complete: true
    all_stories_passed: true
  code_quality:
    avg_function_lines: {number}
    avg_file_lines: {number}
    no_banned_words: true
    security_checks_passed: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{storyDocPath}"
    exists: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT_Story_{epic}-{story}_stage4.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**Document Mode - PASS**

```yaml
layer: 4
stage: implement_audit_passed

execution_summary:
  agent: auditor-document
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 已读取"
    - step: strictness_determination
      status: passed
      result: "审计严格度: {simple|standard|strict}"
    - step: document_read
      status: completed
      result: "Story 文档已读取"
    - step: tasks_read
      status: completed
      result: "tasks.md 已读取，所有任务已标记完成"
    - step: document_structure_check
      status: completed
      result: "文档结构完整性已验证"
    - step: forbidden_words_check
      status: completed
      result: "禁止词检查通过"
    - step: document_consistency_check
      status: completed
      result: "文档一致性已验证"
    - step: reviewer_invocation
      status: completed
      result: "批判审计员已介入"
    - step: parse_and_write_score
      status: completed
      result: "评分已写入 scoring/data/"
    - step: state_update
      status: completed
      result: "story state 已更新为 implement_audit_passed"

audit_summary:
  coverage:
    document_complete: true
    tasks_all_completed: true
    no_gaps_found: true
  document_quality:
    structure_complete: true
    format_compliant: true
    no_banned_words: true
    links_valid: true
  document_consistency:
    internal_consistent: true
    aligned_with_spec: true
    aligned_with_plan: true
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "PASS"
    critical_gaps: 0

artifacts:
  story_doc:
    path: "{artifactDocPath}"
    exists: true
    modified_in_round: false
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  scoring_data:
    path: "scoring/data/dev-{epic}-{story}-implement-{timestamp}.json"
    exists: true

handoff:
  next_action: commit_gate
  next_agent: bmad-master
  next_stage: commit
  ready: true
  prerequisites_met:
    - audit_passed
    - score_written
    - state_updated
    - reviewer_conclusion_verified
```

**Document Mode - FAIL**

```yaml
layer: 4
stage: implement_audit_failed

execution_summary:
  agent: auditor-document
  started_at: "{timestamp}"
  completed_at: "{timestamp}"
  duration_seconds: {seconds}
  status: completed

  steps_completed:
    - step: config_read
      status: passed
      result: "bmad-story-config.yaml 已读取"
    - step: strictness_determination
      status: passed
      result: "审计严格度: {simple|standard|strict}"
    - step: document_read
      status: completed
      result: "Story 文档已读取"
    - step: tasks_read
      status: failed
      result: "发现未完成任务"
    - step: document_structure_check
      status: failed
      result: "文档结构不完整"
    - step: forbidden_words_check
      status: failed
      result: "发现禁止词"
    - step: reviewer_invocation
      status: completed
      result: "批判审计员已介入"
    - step: gap_fix_document
      status: completed
      result: "已直接修改 Story 文档"
    - step: gap_documentation
      status: completed
      result: "所有 gap 已记录"

audit_summary:
  gaps_found:
    total: {count}
    critical: {count}
    major: {count}
    minor: {count}
  required_fixes:
    - category: "tasks_completion"
      description: "{gap_description}"
      priority: critical
    - category: "document_structure"
      description: "{gap_description}"
      priority: major
    - category: "forbidden_words"
      description: "{gap_description}"
      priority: major
  reviewer_conclusion:
    reviewer_word_count: {count}
    total_report_word_count: {count}
    reviewer_percentage: "{percent}%"
    verdict: "FAIL"
    critical_gaps: {count}

required_fixes_detail:
  fix_strategy: "direct_document_modify"
  estimated_fix_time: "{duration}"
  fix_categories:
    - category: "document_structure"
      items: [{gap_items}]
    - category: "forbidden_words"
      items: [{gap_items}]
    - category: "tasks_completion"
      items: [{gap_items}]

artifacts:
  story_doc:
    path: "{artifactDocPath}"
    exists: true
    modified_in_round: true
  audit_report:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/AUDIT-POST-{epic}-{story}.md"
    exists: true
    reviewer_conclusion_included: true
    parseable_score_block: true
  gaps_list:
    path: "_bmad-output/implementation-artifacts/epic-{epic}-{epicSlug}/story-{story}-{storySlug}/GAPS_{epic}-{story}_stage4.md"
    exists: true

handoff:
  next_action: fix_document
  next_agent: auditor-document
  next_stage: 4
  ready: true
  fix_required: true
  prerequisites_met:
    - audit_completed
    - gaps_documented
    - document_modified
    - reviewer_conclusion_verified
```
---

## Failure / Recovery Matrix

| Scene | Primary Action | Fallback | Result |
|------|------|------|------|
| Story audit failed | Repair Story document and review again | reviewer fallback | Not allowed to enter Dev Story |
| Spec audit failed | Repair spec and try again | `auditor-spec` fallback | Not allowed to enter plan |
| Plan audit failed | Repair plan and try again | `auditor-plan` fallback | Do not enter tasks |
| Tasks audit failed | Repair tasks and retry | `auditor-tasks` fallback | Do not enter implement |
| implement audit failed (Code Mode) | Fix code/documentation and re-review | `auditor-implement` fallback | Do not enter commit gate |
| implement audit failure (Document Mode) | modify the document directly and review again | `auditor-document` fallback | not allowed to enter the commit gate |
| OMC is not available | Fallback to warehouse definition reviewer / skill / main agent | Level-by-level fallback | Keep semantics and output contracts unchanged |
| state drift | read `.claude/state/...` restore context | handoff + report to get the bottom of things | continue with the correct phase after recovery |
| Product missing | Stop and ask to complete prerequisite files | None | No stage skipping allowed |

---

## State / Audit / Handoff Contracts

### Status truth source
- `bmad-progress.yaml` is the global stage truth source
- `stories/*-progress.yaml` is the story-level source of truth

### Audit rules
- Failed audit = stage not completed
- fail = must be repaired
- pass = to update status/continue to next stage
- implement audit must meet strict convergence (if required by the current rules of the warehouse)

### handoff minimum field
- `layer`
- `stage`
- `artifactDocPath` / `artifacts`
- `auditReportPath`
- `iteration_count`
- `next_action`

---

## Runtime Prohibitions

1. It is prohibited to mix Cursor Canonical Base, Runtime Adapter, and Repo Add-ons into a rewritten version of prompt from unknown sources.
2. It is forbidden to use fallback as an excuse for downgrading semantics
3. Disable bypassing post-audit
4. It is forbidden to advance the state without updating it.
5. It is forbidden to commit before the audit gate is met.

---

## Implementation suggestions (follow-up)

1. Use this skill as a unified entry point for `bmad-story-assistant` in Claude Code CLI
2. Subsequent completion:
   - Claude Actuator Mapping for Story Create
   - Story audit standard execution body
3. Gradually recycle the existing adaptation rules in `.claude/agents/*.md` into:
   -Skill main entrance
   - stage executor
   - Stage audit executor

---

## Verification Requirements

After the Claude version of the skill is launched, it should at least meet the following verifications:

- No hardcoded local absolute paths allowed
- Canonical Base must be bound to an explicit Cursor template/stage
- Runtime Adapter must have:
  - `Primary Executor`
  - `Fallback Strategy`
  - `Runtime Contracts`
- The relevant accept test must pass
- Audit fail / pass / retry / resume paths must pass grep and status file verification

---

## One sentence conclusion

> The Claude version of `bmad-story-assistant` is not a direct copy of the Cursor skill, but a unified orchestration entry with Cursor as the semantic baseline, Claude/OMC as the execution adaptation layer, and repository-local rules as the enhancement layer.

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->


