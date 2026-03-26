<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-rca-helper
description: |
  Use Party-Mode for deep root cause analysis (RCA) and optimal solution design from user topics, issue descriptions, or screenshots. Requires 100 discussion rounds, Critical Auditor speaking share >70%, and no new gaps in the last 3 rounds before convergence; then produce a final solution description and final task list with no vague or optional wording. After that, run a strict audit sub-task (code-reviewer, audit-prompts §4 / TASKS-doc style) with Critical Auditor >70% and 3-round no-gap convergence; when the audit fails, the sub-agent must edit the document directly to fix gaps, then re-audit until the report meets the literal pass phrase required by the audit protocol (see body). Use when: the user requests RCA, root-cause analysis, deep analysis of an issue, optimal plan plus task list, or post-RCA audit of a task document.
---

# BMAD RCA helper

Use **Party-Mode** to run deep root-cause analysis and solution design from the user’s **topic / issue description / screenshot / problem**, producing a **final solution description** and **final task list**; then run a strict audit loop on the artifact until the protocol-defined pass condition is met (see phase two).

## When to use

- The user supplies a topic, problem description, screenshot, or concrete issue and wants deep RCA.
- You need multi-role debate to surface an optimal plan and an executable task list.
- The deliverable must pass strict audit (Critical Auditor >70%, three consecutive rounds with no new gap).

## Mandatory constraints

| Constraint | Detail |
|------------|--------|
| Party-Mode rounds | **At least 100** (when producing final plan + task list) |
| Critical Auditor | Required; **>70%** speaking share (round count and volume dominated by the Critical Auditor) |
| Convergence | Debate ends only when **the last 3 rounds introduce no new gaps** |
| Plan and tasks | **No** vague wording; **forbid** phrases like “optional”, “we could”, “later”, “as appropriate”; **no** omissions |
| Audit subtask | After phase one converges and the doc exists, the main Agent **must** launch an audit subtask |
| Audit convergence | **Three consecutive rounds with no gap**; on failure the **audit sub-agent edits the audited document in-round**, not “advice only” |

## Workflow

### Phase 1: Party-Mode RCA and solution discussion

1. **Input**: Topic / issue / screenshot / problem (main Agent normalizes into one issue statement).
2. **Execution**: **Read** `{project-root}/_bmad/core/workflows/party-mode/workflow.md` and `steps/step-02-discussion-orchestration.md`, and **follow** the step-02 Response Structure for multi-role discussion.
3. **Roles**: **Include** ⚔️ **Critical Auditor**; you may include 🏗️ Winston (Architect), 💻 Amelia (Developer), 📋 John (Product Manager), etc. (display names must match `_bmad/_config/agent-manifest.csv`); Critical Auditor share **>70%**.
3b. **Speaking format (mandatory)**: Each speaker each round **must** use `[Icon Emoji] **[display name]**: [content]` (e.g. `🏗️ **Winston (Architect)**: ...`, `⚔️ **Critical Auditor**: ...`). Icons and names come from `agent-manifest.csv`; do not omit them.
4. **Rounds and convergence**:
   - **At least 100** rounds;
   - **Convergence**: **No new gaps in the last 3 rounds** (e.g. rounds 98–100);
   - No padding: each round must have substantive role speech.
5. **Outputs**:
   - Final solution: high quality, precise, no vague wording, no forbidden hedging, no gaps;
   - Final task list: executable, verifiable, mapped to the solution.

Suggested paths: if tied to a Story, use `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/`; else `_bmad-output/implementation-artifacts/_orphan/`. Example names: `RCA_{topic-slug}.md` or `TASKS_RCA_{topic-slug}.md` (sections §1 problem, §2 constraints, §3 RCA + solution, §4 tasks, §5 acceptance, etc.).

### Phase 2: Audit subtask (required)

1. **Trigger**: After phase one converges and the final plan + task document exists, the main Agent **must** start an audit subtask.
2. **Sub-agent**: Prefer **code-reviewer** (Cursor Task); else `mcp_task` with `subagent_type: generalPurpose`.
3. **Basis**: Use the full prompt template in [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) (audit-prompts §4 spirit + TASKS-style doc); or the project’s `.cursor/skills/speckit-workflow/references/audit-prompts.md` §4 adaptation.
4. **Audit rules**:
   - **Critical Auditor must appear**, **>70%** share;
   - **Convergence**: **three consecutive rounds with no gap** on the audited doc;
   - **On failure**: the **audit sub-agent edits the audited document in the same round** to remove gaps, then reports what changed; main Agent starts the next round; **forbidden** to only suggest edits. See [audit-document-iteration-rules](references/audit-document-iteration-rules.md) or `{project-root}/.cursor/skills/speckit-workflow/references/audit-document-iteration-rules.md`.
5. **Iterate** until the report conclusion matches the **literal** pass phrases expected by your audit template (often including `完全覆盖、验证通过`) **and** three consecutive no-gap rounds.
6. **Persist reports**: Each round’s report (pass or fail) must be saved to the agreed path, e.g. `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_RCA_{slug}_§4_round{N}.md`.

## References

| Resource | Path / note |
|----------|----------------|
| **party-mode** | `{project-root}/_bmad/core/workflows/party-mode/workflow.md`; step-02 orchestration, 100 rounds and convergence |
| **Critical Auditor** | `{project-root}/_bmad/core/agents/critical-auditor-guide.md` (if present); Critical Auditor is mandatory challenger in step-02 |
| **audit-prompts §4** | `{project-root}/.cursor/skills/speckit-workflow/references/audit-prompts.md` §4 (tasks audit); RCA audit prompt aligns with this |
| **audit-document-iteration-rules** | `{project-root}/.cursor/skills/speckit-workflow/references/audit-document-iteration-rules.md`; sub-agent edits doc on gap, 3-round no-gap convergence |
| **RCA audit template** | [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) |

## Forbidden wording (solution and task list)

The following must **not** appear in the final solution or task list. If the audit finds any, the verdict is fail.

| Disallowed pattern | Replace with |
|--------------------|--------------|
| Optional / “we could consider” | State **“Adopt option A”** with a short rationale |
| Later / next iteration / backlog hand-waving | Omit if out of scope; if in scope, define what this phase delivers |
| TBD / “depends” / “as appropriate” | Explicit conditionals (**if X then Y**) |
| Technical debt / “ship now, fix later” | Open a Story or exclude from scope; do not leave debt in the RCA artifact |

## Rules when the main Agent launches audit

- **Copy the full prompt** from **references/audit-prompt-rca-tasks.md** into the subtask, replacing every placeholder the template defines (e.g. document path, baseline path, project root, report path, round number).
- **Report save**: The template must require **every** round’s report to be written to the configured report path.
- If using code-reviewer, ensure it can access `audit-document-iteration-rules.md` and audit-prompts §4 (paste key excerpts or paths in the prompt).
