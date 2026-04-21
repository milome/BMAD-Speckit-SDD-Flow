# Step 2: Discussion Orchestration and Multi-Agent Conversation (Cursor Override)

## MANDATORY EXECUTION RULES

- ✅ You are a conversation orchestrator, not a batch-return progress reporter
- ✅ In Cursor, the facilitator-compatible subagent must stay in one uninterrupted run
- ✅ Every effective round must begin with `### Round <n>`
- ✅ Every speaker line must use `[Icon Emoji] **[展示名]**: [发言内容]`
- ✅ Respect `{communication_language}` for the visible discussion

## DISCUSSION SEQUENCE

### 1. Topic Analysis

- Analyze the user topic, required expertise, and desired output depth
- Select the most relevant agents for the current round
- Preserve continuity with previous rounds in the same `session_key`

### 2. Response Structure

For every effective round:

1. Output `### Round <n>`
2. Emit speaker turns using:
   `[Icon Emoji] **[展示名]**: [发言内容]`
3. Keep the discussion inside the current facilitator-compatible session

The display name and icon must come from `_bmad/i18n/agent-display-names.yaml` first and fall back to `_bmad/_config/agent-manifest.csv`.

### 3. Decision / Root-Cause Mode

When the topic is option selection, root-cause analysis, or design debate:

- **Mandatory challenger**: select exactly one designated challenger, prioritizing `adversarial-reviewer`
- **Round 1 inclusion**: the designated challenger must speak in round 1
- **Five-round coverage**: the designated challenger must appear at least once in every 5-round window
- **Challenger ratio gate**: `challenger_ratio > 0.60`

### 4. Minimum Rounds By Tier

- `quick_probe_20` → `min_rounds = 20`
- `decision_root_cause_50` → `min_rounds = 50`
- `final_solution_task_list_100` → `min_rounds = 100`

If the request asks for final solution / final task list / BUGFIX §7 / Story finalization, only `final_solution_task_list_100` is valid.

### 5. Cursor Full-Run Rule

In the Cursor branch:

- stay inside the same facilitator-compatible subagent session until `target_rounds_total`
- do not stop at intermediate progress summaries
- do not return control to the main Agent before the final round target
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

After the minimum rounds are reached, convergence requires all of the following:

1. one final solution / one consensus conclusion has been established
2. there is no vague unresolved wording such as “可选” or “可考虑”
3. no new risks / edge cases / missing items are introduced in the last 3 rounds
4. the designated challenger has issued a final review statement

If any condition is still missing, continue the discussion.

### 8. Final Visible Evidence Block

Before the run ends, output a visible block headed exactly:

`## Final Gate Evidence`

It must include:

- `- Gate Profile: <gate_profile_id>`
- `- Total Rounds: <n>`
- `- Challenger Ratio Check: PASS|FAIL`
- `- Tail Window No New Gap: PASS|FAIL`
- `- Final Result: PASS|FAIL`

### 9. Exit Timing

- Do not end early at rounds such as `10/50`, `16/50`, `20/50`, `22/50`, or `91/100`
- End only after the final gate evidence has been rendered for the same `session_key`

## FAILURE MODES

- ❌ summary-only output with no round structure
- ❌ missing designated challenger coverage
- ❌ early return before `target_rounds_total`
- ❌ final result claims without `## Final Gate Evidence`
