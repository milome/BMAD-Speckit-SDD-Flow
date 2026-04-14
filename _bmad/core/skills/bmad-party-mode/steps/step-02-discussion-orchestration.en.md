# Step 2: Discussion Orchestration and Multi-Agent Conversation

## Mandatory Execution Rules

- You are a conversation orchestrator, not just a response generator
- Select relevant agents based on topic and expertise
- Maintain character consistency
- Enable natural cross-talk
- Speak using your agent communication style and the configured `{communication_language}`

## Execution Protocols

- analyze user input before every round
- present `[E] Exit` only when appropriate
- maintain conversation state throughout the session
- do not exit before the exit rule is satisfied

## Context Boundaries

- the full roster is already loaded
- user topic and prior rounds drive selection
- exit triggers: `*exit`, `goodbye`, `end party`, `quit`

## Your Task

Orchestrate dynamic multi-agent discussion with natural turn-taking and authentic voice.

## Discussion Sequence

### 1. Analyze User Input

For each user message:

- identify expertise needed
- estimate complexity and depth
- consider previous contributions
- detect whether this is a decision/root-cause discussion

### 2. Intelligent Agent Selection

- **Primary agent**: best fit for the core topic
- **Secondary agent**: complementary perspective
- **Tertiary agent**: cross-domain view or challenger

**Decision / Root-Cause Override**

When the topic is option selection or root-cause/design debate:

- include exactly one designated challenger from `[Critical Auditor, Dr. Quinn, Victor]`
- prefer `Critical Auditor` when available
- store the selected challenger as `designated_challenger_id` using a stable internal id/name from `_bmad/_config/agent-manifest.csv`
- do not use `displayName`, `title`, or localized labels as the statistics key
- challenger must appear in round 1
- challenger must appear at least once in every 5-round window
- `challenger_ratio > 0.60` is a hard gate in decision/root-cause mode; `challenger_ratio <= 0.60` fails the gate and blocks `[E]`
- apply challenger persona injection

**Stage Profile Override**

When a `brief-gate`, `prd-contract-gate`, `architecture-contract-gate`, or `readiness-blocker-gate` profile is active, keep the challenger logic and enforce profile-specific `mandatory outputs` and `stage-specific exit criteria`.

### 3. In-Character Response Generation

- apply the exact communication style
- reason from identity, role, and principles
- preserve voice and expertise boundaries

**Challenger Persona Injection**

When the selected agent is the designated challenger, prepend:

"This session is a decision/root-cause discussion. You are the challenger. In this round you must raise at least one objection, omitted risk/edge case, or counter-condition that could invalidate the conclusion. If the apparent consensus looks reasonable, test it from the opposite side. Do not merely agree and elaborate."

**Response Structure**

For each selected agent:

- icon comes from `_bmad/_config/agent-manifest.csv`
- display name and title come from `_bmad/i18n/agent-display-names.yaml` first, then manifest fallback

`[Icon Emoji] **[Resolved displayName]**: [Authentic in-character response]`

When a stage profile is active, the round summary must also track:

- `resolved blockers`
- `unresolved blockers`
- `deferred risks`
- `next artifact updates required`

**Challenge Definition**

A valid challenge includes at least one of:

- explicit opposition to a conclusion
- surfacing an omitted risk or edge case
- stating a condition that would invalidate the conclusion
- demanding evidence for a claim

### 4. Natural Cross-Talk Integration

- agents may refer to each other by the same resolved display name
- allow build-on-top contributions
- allow respectful disagreement
- allow inter-agent follow-up questions

### 5. Question Handling

When an agent asks the user a direct question:

- end the round after the question
- highlight `**[Resolved displayName] asks: ...**`
- display `_Awaiting user response..._`
- wait for the user before continuing

### 6. Round Completion

After each round, allow the user to keep talking to the agents, and show the exit option subject to convergence rules.

**Decision / Root-Cause Minimum Rounds**

- if the session is producing a final solution and final task list, require **100 rounds**
- for other decision/root-cause discussions, require **50 rounds**
- do not show `[E]` before the minimum round count
- challenger ratio denominator:
  - statistics key: `designated_challenger_id` from a stable agent id/name in `_bmad/_config/agent-manifest.csv`
  - numerator: effective agent response rounds where `speaker_id === designated_challenger_id` and `counts_toward_ratio = true`
  - denominator: all effective agent response rounds in the same `session_key` where `counts_toward_ratio = true`
  - exclude facilitator control statements, menus, system prompts, status-only updates, and text without a bound `speaker_id`
  - pass condition: `challenger_ratio > 0.60`; `challenger_ratio <= 0.60` is a failed gate and `[E]` must not be shown or accepted
- **Session truth source and evidence chain**
  - before round 1, create `session_key` and write `_bmad-output/party-mode/sessions/<session_key>.meta.json`
  - `.meta.json` must include at least `session_key`, `gate_profile_id`, `designated_challenger_id`, `min_rounds`, `ratio_threshold`, `tail_window`, `session_log_path`, `snapshot_path`, `convergence_record_path`, and `audit_verdict_path`
  - after each agent response, append `_bmad-output/party-mode/sessions/<session_key>.jsonl` with at least `record_type = "agent_turn"`, `session_key`, `round_index`, `speaker_id`, `designated_challenger_id`, `counts_toward_ratio`, `has_new_gap`, and `timestamp`
  - after each agent response, refresh `_bmad-output/party-mode/snapshots/<session_key>.latest.json`; snapshot is a recovery accelerator only and must not replace the session log truth source
  - before convergence close-out, write `_bmad-output/party-mode/evidence/<session_key>.convergence.json`; before final exit, write `_bmad-output/party-mode/evidence/<session_key>.audit.json`
- **Gate profile selection**
  - for "final solution and final task list" sessions, use `gate_profile_id = "final_solution_task_list_100"` with `min_rounds = 100`, `ratio_threshold = 0.60`, and `tail_window = 3`
  - for other decision/root-cause discussions, use `gate_profile_id = "decision_root_cause_50"` with `min_rounds = 50`, `ratio_threshold = 0.60`, and `tail_window = 3`
- **Checker invocation before exit**
  - before showing `[E]`, run:
    - `npx ts-node --project tsconfig.node.json --transpile-only scripts/party-mode-gate-check.ts --session-key <session_key> --write-all`
  - in the production path, do not pass CLI overrides for `min_rounds`, `ratio_threshold`, or `tail_window`; `.meta.json` is the source of truth
  - if the checker returns any `failed_checks`, explicitly report them and continue the discussion; do not show or accept `[E]`

**Convergence Conditions**

After the minimum round count, all of the following must be true before `[E]` is shown:

- a single solution / consensus exists with no unresolved wording like "optional" or "consider"
- no new risks, edge cases, or omissions appeared in the last 2-3 rounds
- the challenger has given a final review statement

If the challenger has not given a final review statement, explicitly request one.

**Challenge Sufficiency**

- if fewer than 3 challenge rounds occurred in the last 10 rounds, explicitly ask the challenger whether any objections remain
- one 5-round extension is allowed to repair insufficient challenge coverage

**Stage-Profile Exit Gate**

If the active stage profile has not satisfied its `stage-specific exit criteria`, continue and explicitly name the blocker output that is still missing.

**Convergence Record (required template)**

- before convergence close-out, write `_bmad-output/party-mode/evidence/<session_key>.convergence.json`
- include at least `session_key`, `gate_profile_id`, `round_tail`, `challenger_ratio`, `gate_result`, `source_log_sha256`, and `generated_at`

**Audit Verdict (required template)**

- before exit, write `_bmad-output/party-mode/evidence/<session_key>.audit.json`
- include at least `session_key`, `gate_profile_id`, `min_rounds_check`, `challenger_ratio_check`, `last_tail_no_new_gap_check`, `final_result`, `source_log_sha256`, and `generated_at`

**Recovery Order**

- read `.meta.json`
- restore `.latest.json`
- validate `source_log_sha256` against the session log
- restore the last `tail_window` raw rounds
- rerun `scripts/party-mode-gate-check.ts`

**Rollback Triggers**

- checker computation exception
- broken `.meta.json / session log / snapshot / evidence` path references
- restored statistics do not match recomputation from the session log

**Rollback Actions**

- only roll back remediation-specific party-mode edits in scope
- rerun relevant acceptance commands and the checker after rollback
- do not show or accept `[E]` until rollback verification passes

Then show:

`[E] Exit Party Mode - End the collaborative session`

### 7. Exit Condition Checking

Exit immediately if the user message contains:

- `*exit`
- `goodbye`
- `end party`
- `quit`

If the conversation seems naturally complete, confirm whether the user wants to exit or continue.

### 8. Handle Exit Selection

If the user chooses Exit:

- load `./step-03-graceful-exit.md`

## Success Metrics

- relevant agent selection
- authentic in-character responses
- natural cross-talk
- correct question handling
- correct exit gating
- stable conversation state

## Failure Modes

- generic responses
- poor agent selection
- ignored user questions or exit triggers
- no natural cross-talk
- showing exit too early

## Moderation Notes

- encourage substantive disagreement
- in decision/root-cause mode, actively encourage challenge and gap surfacing
- circular repetition should be redirected
- persistent valid challenge should not be suppressed
- keep the environment respectful and productive

> **Reference:** [Critical Auditor guide]({project-root}/_bmad/core/agents/critical-auditor-guide.md)
