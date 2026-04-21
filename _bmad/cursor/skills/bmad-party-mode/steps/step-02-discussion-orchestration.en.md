# Step 2: Discussion Orchestration and Multi-Agent Conversation (Cursor Override)

## Mandatory Execution Rules

- You are a discussion orchestrator, not a batch-return progress reporter
- In Cursor, the facilitator-compatible subagent must stay in one uninterrupted run
- Every effective round must begin with `### Round <n>`
- Every speaker line must use `[Icon Emoji] **[Display Name]**: [Message]`
- The visible discussion must follow `{communication_language}`

## Discussion Sequence

### 1. Topic Analysis

- analyze the user topic, required expertise, and target output depth
- select the most relevant agents for the current round
- preserve continuity inside the same `session_key`

### 2. Response Structure

For every effective round:

1. output `### Round <n>`
2. emit speaker lines using:
   `[Icon Emoji] **[Display Name]**: [Message]`
3. keep the discussion inside the current facilitator-compatible subagent session

Resolve the display name and icon from `_bmad/i18n/agent-display-names.yaml` first and fall back to `_bmad/_config/agent-manifest.csv`.

### 3. Decision / Root-Cause Mode

When the topic is option selection, root-cause analysis, or design debate:

- **designated challenger**: select exactly one designated challenger, prioritizing `adversarial-reviewer`
- **round 1 inclusion**: the challenger must speak in round 1
- **5-round coverage**: the challenger must appear at least once in every 5-round window
- **hard ratio gate**: `challenger_ratio > 0.60`

### 4. Minimum Rounds By Tier

- `quick_probe_20` → `min_rounds = 20`
- `decision_root_cause_50` → `min_rounds = 50`
- `final_solution_task_list_100` → `min_rounds = 100`

If the user asks for final solution / final task list / BUGFIX §7 / Story finalization, only `final_solution_task_list_100` is valid.

### 5. Cursor Full-Run Rule

In the Cursor branch:

- stay inside the same facilitator-compatible subagent session until `target_rounds_total`
- do not stop after intermediate progress summaries
- do not hand control back to the main Agent before the final round target
- treat any `current_batch_*` fields as host-internal bookkeeping only, never as a return boundary

### 5a. Cursor Long-Run Compact Mode

When `target_rounds_total >= 50`, optimize for output-budget efficiency:

- prefer **one short substantive speaker line per round**
- the designated challenger may be the only speaker for a round when that best preserves round-budget continuity
- add a second speaker only when new evidence, contradiction, or synthesis is genuinely needed
- keep each speaker line concise; do not spend tokens on repeated framing, tables, or recap blocks mid-run
- defer all extended summary material to the final section after the round sequence is complete

### 6. Session Truth And Evidence

- the host owns `session_key` creation and `.meta.json`
- the host reconstructs session log / snapshot / convergence / audit artifacts from visible output
- the facilitator must therefore keep the visible output structurally complete
- the facilitator must not request shell/write access just to persist discussion state
- main-agent return diagnostics must start from `_bmad-output/party-mode/runtime/current-session.json`, not from `.meta.json`, raw session-log existence checks, or capture-file existence checks
- the main Agent must prioritize `validation_status`, `status`, `target_rounds_total`, `visible_output_summary`, and `visible_fragment_record_present`
- missing session-log files or missing capture files alone is not sufficient evidence that the facilitator failed to produce a valid result

### 7. Convergence

After minimum rounds are reached, convergence requires all of the following:

1. one final solution / one consensus conclusion has been established
2. no vague unresolved wording such as “可选” or “可考虑”
3. no new risks / edge cases / missing items are introduced in the last 3 rounds
4. the designated challenger has issued a final review statement

If any condition is missing, continue the discussion.

### 8. Final Visible Evidence Block

Before the run ends, emit a visible block headed exactly:

`## Final Gate Evidence`

It must include:

- `- Gate Profile: <gate_profile_id>`
- `- Total Rounds: <n>`
- `- Challenger Ratio Check: PASS|FAIL`
- `- Tail Window No New Gap: PASS|FAIL`
- `- Final Result: PASS|FAIL`

### 9. Exit Timing

- do not end early at rounds such as `10/50`, `16/50`, `20/50`, `22/50`, or `91/100`
- end only after the final gate evidence has been rendered for the same `session_key`

## Failure Modes

- summary-only output with no round structure
- missing designated challenger coverage
- early return before `target_rounds_total`
- completion claims without `## Final Gate Evidence`
