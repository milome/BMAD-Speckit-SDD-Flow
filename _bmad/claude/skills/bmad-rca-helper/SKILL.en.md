<!-- BLOCK_LABEL_POLICY=B -->

---
name: bmad-rca-helper
description: |
  Claude Code CLI / OMC adapter entry for the BMAD RCA helper.
  Uses Cursor bmad-rca-helper as the semantic baseline: Party-Mode root-cause analysis → final solution + task list → audit convergence.
  Party-Mode gate, recovery, snapshot, evidence, and exit semantics are sourced from `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`; the current designated challenger hard gate is `>60%`, not a local override. For the "final solution + task list" scenario, require at least 100 rounds and three no-gap tail rounds before convergence; the audit subagent edits the audited document when gaps are found.
  Prefer `.claude/agents/auditors/auditor-document`; follow the fallback chain.
  Use when: RCA, deep root-cause analysis, issue/problem deep-dive, “optimal solution + task list”, or post-RCA audit of the task document.
when_to_use: |
  Use when: (1) the user requests deep RCA, (2) root-cause / issue deep analysis, (3) optimal solution plus executable task list, (4) auditing the RCA task document after RCA.
references:
  - auditor-document: RCA document audit executor; `.claude/agents/auditors/auditor-document.md`
  - auditor-bugfix: Bugfix audit executor; `.claude/agents/auditors/auditor-bugfix.md`
  - audit-document-iteration-rules: `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - audit-prompts: `.claude/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-critical-auditor-appendix: `.claude/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
  - prompt-template-rca-tasks: `.claude/skills/bmad-rca-helper/references/audit-prompt-rca-tasks.md`
  - rca-iteration-rules: `.claude/skills/bmad-rca-helper/references/audit-document-iteration-rules.md`
  - party-mode: `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.

# Claude adapter: bmad-rca-helper

> **Party-mode source of truth**: `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`. All party-mode rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit-gate semantics must follow that file; this skill must not define a second gate contract.

## Purpose

This skill is the unified Claude Code CLI / OMC entry for Cursor `bmad-rca-helper`.

The goal is **not** to blindly copy the Cursor skill, but to:

1. **Inherit validated RCA semantics** from Cursor (Party-Mode ~100 rounds → final solution + task list → audit convergence)
2. **Map audit executors to `.claude/agents/`** in Claude/OMC (audit → `auditor-document`)
3. **Integrate** handoff, scoring, and commit gate already in the repo
4. **Ensure** Claude Code CLI can run the full RCA pipeline end-to-end

---

## Core acceptance criteria

The Claude variant of `bmad-rca-helper` must:

- Act as the **RCA entry** for Claude Code CLI, unifying party-mode → deliverables → audit convergence
- Keep executor selection, fallback, and scoring write aligned with the validated Cursor flow
- Fully integrate:
  - `auditor-document` executor
  - Unified auditor host runner (`runAuditorHost`)
  - Handoff protocol
- **Not** mix Cursor Canonical Base, Claude Runtime Adapter, and Repo Add-ons into unclear prompt rewrites

---

## Three-layer architecture

### Layer 1: Cursor canonical base

> Inherits all validated semantics from Cursor `bmad-rca-helper`

#### When to use

- User supplies a topic, problem statement, screenshot, or concrete issue and wants deep root-cause analysis
- Multi-role debate to reach an optimal solution and an executable task list
- Deliverables must pass strict audit (audit-stage Critical Auditor >70% and three consecutive rounds with no new gap may still apply)

#### Mandatory constraints

| Constraint | Description |
|------------|-------------|
| Party-Mode rounds | **At least 100** (when producing final solution + task list) |
| Critical Auditor | Required; use the core step-02 challenger-share gate (current designated challenger hard gate: `challenger_ratio > 0.60`) |
| Convergence | Debate ends only when **the last 3 rounds introduce no new gap** (FR23a: verifiable) |
| Solution & tasks | **No** vague wording; **no** optional/later/TBD-style phrasing; **no** omissions |
| Audit subtask | After debate converges and the doc exists, the main Agent **must** launch an audit subtask |
| Audit convergence | **Three consecutive rounds with no gap**; on failure the **audit subagent edits the audited document in-round**, not “suggestions only” |

#### Workflow

##### Phase 1: Party-Mode RCA and solution discussion

1. **Input**: topic / problem / screenshot / issue (main Agent normalizes to one topic statement).
2. **Execution**: **Must read** `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` and `steps/step-02-discussion-orchestration.md`, and **strictly follow** the Response Structure plus the gate/recovery/evidence contract in step-02.
3. **Roles**: **Must** include ⚔️ **批判性审计员** (Critical Auditor); may include 🏗️ Winston (architect), 💻 Amelia (dev), 📋 John (PM), etc. Display names must match `_bmad/_config/agent-manifest.csv`; the challenger share threshold comes from core step-02, not this skill.
3b. **Turn format (mandatory)**: each role each round **must** use `[Icon Emoji] **[displayName]**: [content]` (e.g. `🏗️ **Winston (Architect)**: ...`, `⚔️ **批判性审计员**: ...`). Icons and display names come from `agent-manifest.csv`; do not omit.
4. **Rounds and convergence**:
   - **At least 100** rounds of discussion;
   - **Stop** only when **the last 3 rounds have no new gap** (e.g. rounds 98–100);
   - No padding: each round must have substantive role speech.
5. **Outputs**:
   - Final solution description: precise, no vague/optional/later phrasing, no omissions;
   - Final task list: executable, verifiable, 1:1 with the solution.

Document naming and paths: if tied to a Story, under `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/`; else `_bmad-output/implementation-artifacts/_orphan/`; e.g. `RCA_{topic-slug}.md` or `TASKS_RCA_{topic-slug}.md` (sections §1 brief, §2 constraints, §3 RCA + solution, §4 tasks, §5 acceptance, etc.).

##### Phase 2: Audit subtask (required)

1. **Trigger**: after phase 1 converges and the final solution + task list document exists, the main Agent **must** start an audit subtask.
2. **Subagent selection**: follow Fallback Strategy (Layer 2).
3. **Basis**: use the full prompt template in [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) (audit-prompts §4 spirit + TASKS-style doc).
4. **Audit rules**:
   - **Critical Auditor must appear**, share **>70%**;
   - **Convergence**: **three consecutive rounds with no gap** on the audited document;
   - **On fail**: **audit subagent must edit the audited document in the same round** to remove gaps, then report what changed; main Agent starts the next round; **no** “suggestions only”. See [references/audit-document-iteration-rules.md](references/audit-document-iteration-rules.md) or `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`.
5. **Iterate** until the report conclusion is 「**完全覆盖、验证通过**」 and three consecutive no-gap rounds. **Max 10** audit rounds; then stop with “max rounds reached—manual review”.
6. **Persist reports**: every round (pass or fail) to an agreed path, e.g. `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_RCA_{slug}_§4_round{N}.md`.
7. **Convergence check**: if verdict is pass and Critical Auditor states “no new gap this round” → `consecutive_pass_count + 1`; else reset. **Pass**: conclusion contains 「完全覆盖、验证通过」 or 「通过」; Critical Auditor section contains 「本轮无新 gap」, 「无新 gap」, or 「无 gap」.
8. **No infinite loop**: when `consecutive_pass_count >= 3`, **stop** immediately.

#### Mandatory parseable scoring block

Audit reports must end with:

```markdown
## 可解析评分块（供 parseAndWriteScore）
总体评级: [A|B|C|D]
维度评分:
- 需求完整性: XX/100
- 可测试性: XX/100
- 一致性: XX/100
- 可追溯性: XX/100
```

#### Forbidden wording (solution and task text)

The following must **not** appear in the final solution or task list; if the audit finds any, the verdict is fail.

| Forbidden phrase (literal, ZH) | Replace with (EN) |
|----------------------------------|-------------------|
| 可选、可考虑、可以考虑 | State “use option A” with a short rationale |
| 后续、后续迭代、待后续 | Omit if out of scope; if in scope, define what this phase completes |
| 待定、酌情、视情况 | Explicit conditionals (“if X then Y”) |
| 技术债、先这样后续再改 | Separate Story or out of scope; no tech-debt leftovers in RCA output |

---

### Layer 2: Claude/OMC runtime adapter

> Map Cursor executors to Claude Code CLI native executors

#### Primary executor

| Phase | Source | Claude executor | Agent file |
|-------|--------|-----------------|------------|
| RCA document audit | code-reviewer (Cursor-native Task) | `auditor-document` | `.claude/agents/auditors/auditor-document.md` |

Invocation: Agent tool (`subagent_type: general-purpose`).

#### Fallback (4 levels)

| Level | Mechanism | When |
|-------|-----------|------|
| L1 | `auditor-document` | Default |
| L2 | `code-reviewer` Agent | L1 unavailable |
| L3 | `code-review` skill | Agent unavailable |
| L4 | Main Agent runs the same three-layer prompt | All subagents unavailable |

**Fallback notice (FR26)**:

```
⚠️ Executor downgrade: L{from} → L{to}
  Reason: {reason}
  Current executor: {name}
```

#### CLI calling summary (Architecture D2)

Before each audit subagent call:

```yaml
--- CLI Calling Summary ---
subagent_type: general-purpose
target_agent: auditor-document
phase: rca_doc_audit
round: {N}
artifact_doc_path: {document path}
baseline_path: {requirements baseline path}
report_path: {report path}
fallback_level: L{N}
---
```

#### YAML handoff (Architecture D2/D4)

```yaml
--- YAML Handoff ---
execution_summary:
  status: passed|failed
  round: {N}
  critic_ratio: "{X}%"
  gap_count: {N}
  new_gap_count: {N}
  convergence_status: in_progress|converged
artifacts:
  artifact_doc_path: "{document path}"
  report_path: "{report path}"
next_steps:
  - action: revise_rca_doc|execute_rca_tasks
    agent: auditor-document|bmad-standalone-tasks
    ready: true|false
handoff:
  next_action: revise_rca_doc|execute_rca_tasks
  next_agent: auditor-document|bmad-standalone-tasks
  ready: true|false
---
```

---

### Layer 3: Repo add-ons

> State, hooks, handoff, scoring, commit gate

#### State

- `.claude/state/bmad-progress.yaml`: global BMAD progress
- Handoff: structured YAML at end of each phase

#### Scoring

On pass, do not hand-run `bmad-speckit score`. The executor only needs to return `projectRoot`, `reportPath`, and `artifactDocPath`; the invoking host/runner handles score write, audit-index updates, and the rest of post-audit automation.

#### Commit gate

- PASS means RCA document audit passed; may proceed to `bmad-standalone-tasks`
- Do not commit directly
- Final commit gated by `bmad-master`

---

## References and dependencies

| Resource | Path / note |
|----------|-------------|
| **party-mode** | `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`; all rounds / challenger ratio / recovery / evidence / exit-gate rules come from core step-02 |
| **Critical Auditor** | `{project-root}/_bmad/core/agents/critical-auditor-guide.md` if present; step-02 mandates the challenger role |
| **audit-prompts §4** | `.claude/skills/speckit-workflow/references/audit-prompts.md` §4 (tasks audit); RCA audit prompt aligns in spirit |
| **audit-document-iteration-rules** | `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md` |
| **This skill’s audit template** | [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) |
| **This skill’s iteration rules** | [references/audit-document-iteration-rules.md](references/audit-document-iteration-rules.md) |

---

## Prompt template integrity (mandatory)

When the main Agent starts an RCA document audit subtask, it **must** copy the **full** prompt from `references/audit-prompt-rca-tasks.md` into the subagent prompt and replace **all** placeholders. **Forbidden**:

- Omitting any paragraph
- Summarizing or paraphrasing
- Dropping mandatory guard lines from that template
- Removing “verbatim output” requirements

Do not omit format requirements for “final solution” and “final task list” in the Party-Mode deliverable template.

---

## Rules when the main Agent starts audit

- Copy the **entire** `references/audit-prompt-rca-tasks.md` prompt into the subtask, replacing every placeholder defined in that template (document path, baseline path, project root, report path, round)—use the exact placeholder spellings from the template file.
- **Reports**: the template must require every round’s report (pass or fail) saved to the configured report path.
- Ensure the audit subagent can access `audit-document-iteration-rules.md` and audit-prompts §4 context (paste key excerpts or paths in the prompt).

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->


