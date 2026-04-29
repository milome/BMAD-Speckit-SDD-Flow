<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-rca-helper
description: |
  Use Party-Mode for deep root cause analysis (RCA) and optimal solution design from user topics, issue descriptions, or screenshots. Party-mode gate, recovery, snapshot, evidence, and exit semantics are sourced from `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`; the current hard gate for the designated challenger is `>60%`, not a local override. For the "final solution + final task list" scenario, require 100 discussion rounds and no new gaps in the last 3 rounds before convergence; then produce a final solution description and final task list with no vague or optional wording. After that, run a strict audit sub-task (code-reviewer, audit-prompts §4 / TASKS-doc style) and re-audit until the report meets the literal pass phrase required by the audit protocol (see body). Use when: the user requests RCA, root-cause analysis, deep analysis of an issue, optimal plan plus task list, or post-RCA audit of a task document.
---

# BMAD RCA helper

Use **Party-Mode** to run deep root-cause analysis and solution design from the user’s **topic / issue description / screenshot / problem**, producing a **final solution description** and **final task list**; then run a strict audit loop on the artifact until the protocol-defined pass condition is met (see phase two).

## When to use

- The user supplies a topic, problem description, screenshot, or concrete issue and wants deep RCA.
- You need multi-role debate to surface an optimal plan and an executable task list.
- The deliverable must pass strict audit (Critical Auditor >70%, three consecutive rounds with no new gap).

## Main-Agent Orchestration Surface (Mandatory)

In interactive mode, this skill must treat repo-native `main-agent-orchestration` as the only orchestration authority. `runAuditorHost` is only the post-audit close-out entry; it must not replace the main Agent's next-branch decision.

Before launching any audit subtask, implementation subtask, or other bounded execution, the main Agent must:

1. Run `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`
2. Read `orchestrationState`, `pendingPacketStatus`, `pendingPacket`, `continueDecision`, `mainAgentNextAction`, and `mainAgentReady`
3. If the next branch is dispatchable but no usable packet exists yet, run `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
4. Dispatch only from the returned packet / instruction instead of continuing from party-mode prose, RCA prose, or handoff summary alone
5. Re-run `inspect` after each child result and after each `runAuditorHost` close-out before choosing the next global branch

`mainAgentNextAction / mainAgentReady` remain compatibility summary fields only; authoritative runtime truth is `orchestrationState + pendingPacket + continueDecision`.

> Party-mode source of truth (Codex): `{project-root}/_bmad/cursor/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`
> Rounds, `designated_challenger_id`, `challenger_ratio > 0.60`, session/meta/snapshot/evidence, recovery, and exit-gate semantics must come from core step-02. This skill must not define a second party-mode gate contract.

## Mandatory constraints

| Constraint | Detail |
|------------|--------|
| Party-Mode rounds | **At least 100** (when producing final plan + task list) |
| Critical Auditor | Required; use the core step-02 challenger-share gate (current designated challenger hard gate: `challenger_ratio > 0.60`) |
| Convergence | Debate ends only when **the last 3 rounds introduce no new gaps** |
| Plan and tasks | **No** vague wording; **forbid** phrases like “optional”, “we could”, “later”, “as appropriate”; **no** omissions |
| Audit subtask | After phase one converges and the doc exists, the main Agent **must** launch an audit subtask |
| Audit convergence | **Three consecutive rounds with no gap**; on failure the **audit sub-agent edits the audited document in-round**, not “advice only” |

## Workflow

### Phase 1: Party-Mode RCA and solution discussion

1. **Input**: Topic / issue / screenshot / problem (main Agent normalizes into one issue statement).
2. **Execution**: **Read** `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` and `{project-root}/_bmad/cursor/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`, and **follow** the Codex step-02 Response Structure plus its gate/recovery/evidence contract for multi-role discussion.
3. **Roles**: **Include** ⚔️ **Critical Auditor**; you may include 🏗️ Winston (Architect), 💻 Amelia (Developer), 📋 John (Product Manager), etc. (display names must match `_bmad/_config/agent-manifest.csv`); the challenger share threshold comes from core step-02, not this skill.
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
2. **Sub-agent**: Prefer **code-reviewer** (Codex worker dispatch); else `Codex worker adapter` with `subagent_type: general-purpose`.
3. **Basis**: Use the full prompt template in [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) (audit-prompts §4 spirit + TASKS-style doc); or the project’s `.codex/skills/speckit-workflow/references/audit-prompts.md` §4 adaptation.
4. **Audit rules**:
   - **Critical Auditor must appear**, **>70%** share;
   - **Convergence**: **three consecutive rounds with no gap** on the audited doc;
   - **On failure**: the **audit sub-agent edits the audited document in the same round** to remove gaps, then reports what changed; main Agent starts the next round; **forbidden** to only suggest edits. See [audit-document-iteration-rules](references/audit-document-iteration-rules.md) or `{project-root}/.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`.
5. **Iterate** until the report conclusion matches the **literal** pass phrases expected by your audit template (often including `完全覆盖、验证通过`) **and** three consecutive no-gap rounds.
6. **Persist reports**: Each round’s report (pass or fail) must be saved to the agreed path, e.g. `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_RCA_{slug}_§4_round{N}.md`.

## References

| Resource | Path / note |
|----------|----------------|
| **party-mode** | `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` + `{project-root}/_bmad/cursor/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`; Codex-side rounds / challenger ratio / recovery / evidence / exit-gate rules come from the Codex step-02 override |
| **Critical Auditor** | `{project-root}/_bmad/core/agents/critical-auditor-guide.md` (if present); Critical Auditor is mandatory challenger in step-02 |
| **audit-prompts §4** | `{project-root}/.codex/skills/speckit-workflow/references/audit-prompts.md` §4 (tasks audit); RCA audit prompt aligns with this |
| **audit-document-iteration-rules** | `{project-root}/.codex/skills/speckit-workflow/references/audit-document-iteration-rules.md`; sub-agent edits doc on gap, 3-round no-gap convergence |
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
