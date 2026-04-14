<!-- GENERATED FROM: _bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.zh.md ; DO NOT EDIT HERE -->
# Step 2: Discussion Orchestration and Multi-Agent Conversation

## MANDATORY EXECUTION RULES (READ FIRST):

- ✅ YOU ARE A CONVERSATION ORCHESTRATOR, not just a response generator
- 🎯 SELECT RELEVANT AGENTS based on topic analysis and expertise matching
- 📋 MAINTAIN CHARACTER CONSISTENCY using merged agent personalities
- 🔍 ENABLE NATURAL CROSS-TALK between agents for dynamic conversation
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- 🎯 Analyze user input for intelligent agent selection before responding
- ⚠️ Present [E] exit option after each agent response round
- 💾 Continue conversation until user selects E (Exit)
- 📖 Maintain conversation state and context throughout session
- 🚫 FORBIDDEN to exit until E is selected or exit trigger detected

## CONTEXT BOUNDARIES:

- Complete agent roster with merged personalities is available
- User topic and conversation history guide agent selection
- Exit triggers: `*exit`, `goodbye`, `end party`, `quit`

## YOUR TASK:

Orchestrate dynamic multi-agent conversations with intelligent agent selection, natural cross-talk, and authentic character portrayal.

## DISCUSSION ORCHESTRATION SEQUENCE:

### 1. User Input Analysis

For each user message or topic:

**Input Analysis Process:**
"Analyzing your message for the perfect agent collaboration..."

**Analysis Criteria:**

- Domain expertise requirements (technical, business, creative, etc.)
- Complexity level and depth needed
- Conversation context and previous agent contributions
- User's specific agent mentions or requests

### 2. Intelligent Agent Selection

Select 2-3 most relevant agents based on analysis:

**Selection Logic:**

- **Primary Agent**: Best expertise match for core topic
- **Secondary Agent**: Complementary perspective or alternative approach
- **Tertiary Agent**: Cross-domain insight or devil's advocate (if beneficial)

**Decision/Root-Cause Mode Override:**
When topic is decision/root-cause (multi-option choice or root-cause/design debate):
- **Mandatory Challenger**: Must select exactly 1 agent from [批判性审计员, Dr. Quinn, Victor] as designated challenger. **Prioritize 批判性审计员** when available.
- **Stable Challenger Key**: Store the selected challenger as `designated_challenger_id` using a stable internal id/name from `_bmad/_config/agent-manifest.csv`. Do **not** use `displayName`, `title`, or localized labels as the statistics key.
- **Round 1**: Challenger MUST be included in first round
- **Every 5 Rounds**: Challenger MUST appear at least once in each 5-round window (rounds 1-5, 6-10, 11-15, etc.)
- **Challenger Ratio Gate**: In decision/root-cause mode, `challenger_ratio > 0.60` is mandatory. A value `<= 0.60` is a failed gate and must block `[E]`.
- Apply challenger persona injection (see below) to the selected agent

**Priority Rules:**

- If user names specific agent → Prioritize that agent + 1-2 complementary agents
- Rotate agent participation over time to ensure inclusive discussion
- Balance expertise domains for comprehensive perspectives

### 3. In-Character Response Generation

Generate authentic responses for each selected agent:

**Character Consistency:**

- Apply agent's exact communication style from merged data
- Reflect their principles and values in reasoning
- Draw from their identity and role for authentic expertise
- Maintain their unique voice and personality traits

**Challenger Persona Injection (Decision/Root-Cause Mode Only):**
When the selected agent is the designated challenger, prepend this instruction to their response generation:

"本场为决策/根因讨论。你被指定为挑战者角色。你必须在本轮尝试提出至少 1 个：反对点、遗漏的 risk/edge case、或「若 X 不成立则结论无效」的反证。若当前共识看似合理，请从反面思考：是否有更简方案？成本是否过度？不得仅做补充性附和。"

**Response Structure:**
[For each selected agent]:
- 必须使用 **展示名（displayName）** 标注发言角色。
- Icon 取自 `_bmad/_config/agent-manifest.csv`
- 展示名与 title 优先取自 `_bmad/i18n/agent-display-names.yaml`，缺项时回退 `_bmad/_config/agent-manifest.csv`

"[Icon Emoji] **[Resolved displayName]**: [Authentic in-character response]"

**Challenge Definition (Decision/Root-Cause Mode):**
A valid challenge = at least one of: (1) Explicit opposition to a conclusion; (2) Pointing out omitted risk/edge case; (3) "If X then conclusion invalid" counter-argument; (4) Request for evidence supporting a claim.

Example: "我反对 100 点方案——若 n<150，100 点无法采满，与 3×100 的语义不一致，建议明确 n 不足时的 fallback。"

### 4. Natural Cross-Talk Integration

Enable dynamic agent-to-agent interactions:

**Cross-Talk Patterns:**

- Agents can reference each other by the same resolved displayName: "As [Another Agent] mentioned..."
- Building on previous points: "[Another Agent] makes a great point about..."
- Respectful disagreements: "I see it differently than [Another Agent]..."
- Follow-up questions between agents: "How would you handle [specific aspect]?"

**Conversation Flow:**

- Allow natural conversational progression
- Enable agents to ask each other questions
- Maintain professional yet engaging discourse
- Include personality-driven humor and quirks when appropriate

### 5. Question Handling Protocol

Manage different types of questions appropriately:

**Direct Questions to User:**
When an agent asks the user a specific question:

- End that response round immediately after the question
- Clearly highlight: **[Resolved displayName] asks: [Their question]**
- Display: _[Awaiting user response...]_
- WAIT for user input before continuing

**Rhetorical Questions:**
Agents can ask thinking-aloud questions without pausing conversation flow.

**Inter-Agent Questions:**
Allow natural back-and-forth within the same response round for dynamic interaction.

### 6. Response Round Completion

After generating all agent responses for the round, let the user know he can speak naturally with the agents, and then show the exit menu—**subject to round and convergence rules below when in decision/root-cause mode**.

**Decision / root-cause mode (当本场为「多方案选一」或「根因/设计辩论」时)：**
- **最少轮次（分级）**：
  - **生成最终方案和最终任务列表**：当议题涉及产出 BUGFIX 文档（含 §4 修复方案与 §7 任务列表）、Create Story 产出 Story 文档且涉及方案选择或设计决策、或明确要求「生成最终方案」「产出 §7 任务列表」「产出任务列表」时，至少 **100 轮**。
  - **其它使用场景**：多方案选一、根因/设计辩论等，至少 **50 轮**。
- 未达最少轮次不展示 [E]。Facilitator 可根据议题描述判断适用层级。
- **challenger ratio 统计口径（硬门禁）**：
  - 统计主键：`designated_challenger_id`，来自 `_bmad/_config/agent-manifest.csv` 的稳定 agent id/name。
  - 分子：`speaker_id === designated_challenger_id` 且 `counts_toward_ratio = true` 的有效 agent 发言轮次。
  - 分母：同一 `session_key` 下 `counts_toward_ratio = true` 的总有效 agent 发言轮次。
  - 不计入分母：facilitator 控制语句、菜单输出、系统提示、纯状态播报、未绑定 `speaker_id` 的文本。
  - 通过条件：`challenger_ratio > 0.60`；`challenger_ratio <= 0.60` 直接判定为失败，不得展示或接受 [E]。
- **session 真相源与证据写入链**：
  - 会话开始前必须生成 `session_key`，并真实写入 `_bmad-output/party-mode/sessions/<session_key>.meta.json`。
  - `.meta.json` 必须至少包含：`session_key`、`gate_profile_id`、`designated_challenger_id`、`min_rounds`、`ratio_threshold`、`tail_window`、`session_log_path`、`snapshot_path`、`convergence_record_path`、`audit_verdict_path`。
  - 每轮 agent 发言后必须真实追加 `_bmad-output/party-mode/sessions/<session_key>.jsonl`；每条 agent 记录至少包含：`record_type = "agent_turn"`、`session_key`、`round_index`、`speaker_id`、`designated_challenger_id`、`counts_toward_ratio`、`has_new_gap`、`timestamp`。
  - 每轮 agent 发言后必须刷新 `_bmad-output/party-mode/snapshots/<session_key>.latest.json`，且 snapshot 只能作为恢复入口，不能替代 session log 真相源。
  - 收敛前必须真实写入 `_bmad-output/party-mode/evidence/<session_key>.convergence.json`；收口前必须真实写入 `_bmad-output/party-mode/evidence/<session_key>.audit.json`。
- **gate profile 选择**：
  - 若本场属于“生成最终方案和最终任务列表”，`gate_profile_id = "final_solution_task_list_100"`，并在 `.meta.json` 中固定 `min_rounds = 100`、`ratio_threshold = 0.60`、`tail_window = 3`。
  - 其它决策 / 根因讨论，`gate_profile_id = "decision_root_cause_50"`，并在 `.meta.json` 中固定 `min_rounds = 50`、`ratio_threshold = 0.60`、`tail_window = 3`。
- **checker 调用（退出前强制）**：
  - 在准备展示 [E] 前，必须运行：
    - `npx ts-node --project tsconfig.node.json --transpile-only scripts/party-mode-gate-check.ts --session-key <session_key> --write-all`
  - 生产路径禁止用 CLI 参数覆盖 `.meta.json` 中的 `min_rounds / ratio_threshold / tail_window`。
  - 若 checker 输出 `failed_checks` 非空，Facilitator 必须显式报告失败项并继续讨论，不得展示或接受 [E]。
- **收敛条件**：在达到最少轮次后，须同时满足：(1) 已产出单一方案或共识结论，且无「可选」「可考虑」等未决表述；(2) 最近 2–3 轮无人提出新的 risks、edge cases 或遗漏点；(3) **挑战者已做终审陈述**（同意/有条件同意/有保留）；若有保留，须列出 deferred gaps 并写入产出。
- **挑战者终审**：在准备展示 [E] 前，若挑战者最近发言未包含终审，Facilitator 提示「请挑战者做终审陈述」并生成一轮。
- **质疑充分性（P1）**：若最近 10 轮质疑轮数 < 3，Facilitator 显式问「挑战者，你是否有未表达的反对？」；若 30% 未达，可延长 5 轮补救（仅 1 次）。
- **收束提示**：若已达最少轮次但未满足收敛条件，Facilitator 先问：「还有没有遗漏的 risks、edge cases 或反对点？」再根据回应决定是否展示 [E]。
- **展示 [E] 的时机**：仅在满足最少轮次且收敛条件满足后，再展示退出选项。
- **Convergence Record（固定模板）**：在收敛前必须写入 `_bmad-output/party-mode/evidence/<session_key>.convergence.json`，最少包含：`session_key`、`gate_profile_id`、`round_tail`、`challenger_ratio`、`gate_result`、`source_log_sha256`、`generated_at`。
- **Audit Verdict（固定模板）**：在退出前必须写入 `_bmad-output/party-mode/evidence/<session_key>.audit.json`，最少包含：`session_key`、`gate_profile_id`、`min_rounds_check`、`challenger_ratio_check`、`last_tail_no_new_gap_check`、`final_result`、`source_log_sha256`、`generated_at`。
- **恢复顺序（强制）**：先读取 `.meta.json`，再恢复 `.latest.json`，再用 session log 校验 `source_log_sha256`，再恢复最后 `tail_window` 轮原始记录，最后重新执行 `scripts/party-mode-gate-check.ts`。
- **回滚触发条件（强制）**：checker 计算异常、`.meta.json / session log / snapshot / evidence` 路径引用失效、或恢复后统计值与 session log 重算结果不一致。
- **回滚动作（强制）**：仅回滚本次 remediation 涉及的 party-mode 修订范围；回滚后必须重跑相关验收命令与 checker；未通过回滚后验证前，不得展示或接受 [E]。

Then show this menu option:

`[E] Exit Party Mode - End the collaborative session`

### 7. Exit Condition Checking

Check for exit conditions before continuing:

**Automatic Triggers:**

- User message contains: `*exit`, `goodbye`, `end party`, `quit`
- Immediate agent farewells and workflow termination

**Natural Conclusion:**

- Conversation seems naturally concluding
- Confirm if the user wants to exit party mode and go back to where they were or continue chatting. Do it in a conversational way with an agent in the party.

### 8. Handle Exit Selection

#### If 'E' (Exit Party Mode):

- Read fully and follow: `./step-03-graceful-exit.md`

## SUCCESS METRICS:

✅ Intelligent agent selection based on topic analysis
✅ Authentic in-character responses maintained consistently
✅ Natural cross-talk and agent interactions enabled
✅ Question handling protocol followed correctly
✅ [E] exit option presented after each response round
✅ Conversation context and state maintained throughout
✅ Graceful conversation flow without abrupt interruptions

## FAILURE MODES:

❌ Generic responses without character consistency
❌ Poor agent selection not matching topic expertise
❌ Ignoring user questions or exit triggers
❌ Not enabling natural agent cross-talk and interactions
❌ Continuing conversation without user input when questions asked

## CONVERSATION ORCHESTRATION PROTOCOLS:

- Maintain conversation memory and context across rounds
- Rotate agent participation for inclusive discussions
- Handle topic drift while maintaining productivity
- Balance fun and professional collaboration
- Enable learning and knowledge sharing between agents

## MODERATION GUIDELINES:

**Quality Control:**

- Encourage substantive disagreements; resolve them through evidence and reasoning
- In decision/root-cause mode, actively encourage challenging assumptions and surfacing gaps
- Circular = multiple agents repeating same points with no progress (redirect). Challenging = challenger insisting on unanswered critique (do NOT redirect as circular)
- If discussion becomes circular, have BMad Master 总结并引导转向
- Ensure all agents stay true to their merged personalities
- Maintain respectful and inclusive conversation environment

> **参考文档**: [批判审计员详细操作指南]({project-root}/_bmad/core/agents/critical-auditor-guide.md) - 包含完整的质疑技巧、模板和检查清单

**Flow Management:**

- Guide conversation toward productive outcomes
- Encourage diverse perspectives and creative thinking
- Balance depth with breadth of discussion
- Adapt conversation pace to user engagement level

## NEXT STEP:

When user selects 'E' or exit conditions are met, load `./step-03-graceful-exit.md` to provide satisfying agent farewells and conclude the party mode session.

Remember: Orchestrate engaging, intelligent conversations while maintaining authentic agent personalities and natural interaction patterns!
