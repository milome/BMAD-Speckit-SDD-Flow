<!-- BLOCK_LABEL_POLICY=B -->

---
name: bmad-standalone-tasks-doc-review
description: |
  Claude Code CLI / OMC adapter entry for BMAD standalone TASKS document audit.
  Uses Cursor bmad-standalone-tasks-doc-review as the semantic baseline for strict TASKS document quality gates.
  Critical Auditor >70%, three consecutive rounds with no new gap; the audit subagent must edit the audited document when gaps are found.
  When the main Agent launches an audit subtask, it **must** copy the full prompt template from this skill and fill placeholders—no omission, summary, or paraphrase.
  Prefer `.claude/agents/auditors/auditor-tasks-doc`; follow the fallback chain.
  Use when: TASKS document audit, “audit subtask on {path}”, or pre-implementation quality gate.
when_to_use: |
  Use when: (1) the user requests a strict TASKS document audit, (2) “audit subtask on {document path}” or “TASKS document audit”, (3) pre-implementation document quality gate.
references:
  - auditor-tasks-doc: TASKS doc audit executor; `.claude/agents/auditors/auditor-tasks-doc.md`
  - auditor-document: document audit executor; `.claude/agents/auditors/auditor-document.md`
  - audit-document-iteration-rules: `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - audit-prompts: `.claude/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-critical-auditor-appendix: `.claude/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
  - audit-post-impl-rules: `.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`
  - prompt-template-tasks-doc: `.claude/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-tasks-doc.md`
  - prompt-template-impl: `.claude/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-impl.md`
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.

> **Orphan TASKS doc-review closeout contract**: when the audited document lives under `_orphan/`, the structured audit report must explicitly provide `stage=standalone_tasks`, `artifactDocPath`, and `reportPath`. Missing any field, returning `stage=document`, or relying on prose-only `PASS` must not count as authoritative closeout.

# Claude adapter: bmad-standalone-tasks-doc-review

## Purpose

This skill is the unified Claude Code CLI / OMC entry for Cursor `bmad-standalone-tasks-doc-review`.

The goal is **not** to blindly copy the Cursor skill, but to:

1. **Inherit validated TASKS document audit semantics** (resolve path → baseline → subagent audit → convergence → iterate)
2. **Map executors to `.claude/agents/`** (`auditor-tasks-doc`, `auditor-document`)
3. **Integrate** handoff, scoring, and commit gate
4. **Ensure** Claude Code CLI can run TASKS document audits end-to-end

## Host Guard (must run first)

If the actual host is **Cursor IDE**, or the invocation context clearly uses Cursor semantics (for example `mcp_task`, `generalPurpose`, or `Cursor Task`), then:

1. **Stop immediately**
2. Print the exact message below:

```text
HOST_MISMATCH: Loaded the Claude variant of bmad-standalone-tasks-doc-review under a Cursor host. Use `.cursor/skills/bmad-standalone-tasks-doc-review/SKILL.md` instead.
```

3. **Do not** continue into this Claude adapter’s fallback logic

Continue with the rest of this file **only** when the real host is Claude Code CLI / OMC.

---

## Core acceptance criteria

The Claude variant must:

- Act as the **TASKS document audit entry** for Claude Code CLI, unifying parse → audit → convergence
- Keep executor selection, fallback, and scoring write aligned with Cursor
- Integrate:
  - `auditor-tasks-doc` executor
  - Unified auditor host runner (`runAuditorHost`)
  - Handoff protocol
- **Not** mix Cursor Canonical Base, Claude Runtime Adapter, and Repo Add-ons into unclear prompt rewrites

---

## Three-layer architecture

### Layer 1: Cursor canonical base

> Inherits all validated semantics from Cursor `bmad-standalone-tasks-doc-review`

#### When to use

- User specifies a document path and asks for an audit subtask
- Quality gate before implementing a TASKS document
- Audit that must reach “full coverage, verified pass” with 3-round no-gap convergence

#### Mandatory constraints

| Constraint | Description |
|------------|-------------|
| Critical Auditor | Must participate; speaking share **>70%** |
| Convergence | **Three consecutive rounds with no new gap** (on the audited document) |
| When a gap is found | **Audit subagent must edit the audited document in the same round**; suggestions-only forbidden |
| Max rounds | **10**; then force-stop with “max rounds reached—manual review” |

#### Workflow

1. **Resolve document path** from user input (`{document-path}`, e.g. `_bmad-output/implementation-artifacts/_orphan/TASKS_xxx.md`).
2. **Baseline**: If the TASKS header has a reference field, read it as baseline; else the TASKS doc is self-contained (`{baseline-path}` = audited path).
3. **Launch audit**: Copy the full prompt from [references/audit-prompt-tasks-doc.md](references/audit-prompt-tasks-doc.md), replace `{document-path}`, `{baseline-path}`, `{project-root}`, `{report-path}`, `{round}`; the **report save** section must say **every round’s report (pass or fail) is saved to `{report-path}`**.
4. **Subagent choice**: Follow fallback strategy (Layer 2).
5. **Convergence**: If verdict is pass and Critical Auditor says “no new gap this round” → `consecutive_pass_count + 1`; else reset. **Pass**: conclusion contains “完全覆盖、验证通过” or “通过”; Critical Auditor contains “本轮无新 gap”, “无新 gap”, or “无 gap”.
6. **Iterate**: Until 3 no-gap rounds. **No infinite loops**: when `consecutive_pass_count >= 3`, **stop**.
7. **Persist reports**: Every round to `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_{slug}_§4_round{N}.md`; state this in the subagent prompt.

#### Mandatory parseable scoring block

Main flow (TASKS document audit) reports must end with:

```markdown
## 可解析评分块（供 parseAndWriteScore）
总体评级: [A|B|C|D]
维度评分:
- 需求完整性: XX/100
- 可测试性: XX/100
- 一致性: XX/100
- 可追溯性: XX/100
```

#### Mode B: post-implementation audit (§5)

When auditing **implementation results** (code, prd, progress), use audit-prompts §5:

- Audited object is code/implementation, not only the TASKS doc
- Gaps fixed by **implementation** subagent, not audit subagent
- Convergence: `.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`

See [references/audit-prompt-impl.md](references/audit-prompt-impl.md).

---

### Layer 2: Claude/OMC runtime adapter

> Map Cursor executors to Claude Code CLI native executors

#### Primary executor

| Phase | Source platform | Claude executor | Agent definition |
|-------|-----------------|-----------------|-------------------|
| TASKS doc audit | code-reviewer (Cursor-native Task) | `auditor-tasks-doc` | `.claude/agents/auditors/auditor-tasks-doc.md` |
| Document audit (stage 4) | code-reviewer (Cursor-native Task) | `auditor-document` | `.claude/agents/auditors/auditor-document.md` |

Invocation: Agent tool (`subagent_type: general-purpose`).

#### Fallback (4 levels)

| Level | Mechanism | Condition |
|-------|-----------|-----------|
| L1 (Primary) | `auditor-tasks-doc` | Default |
| L2 | `code-reviewer` Agent | auditor-tasks-doc unavailable |
| L3 | `code-review` skill | Agent mechanism unavailable |
| L4 | Main Agent runs same three-layer prompt | All subagents unavailable |

**Fallback notice (FR26)**:

```
⚠️ Executor downgrade: L{from} → L{to}
  Reason: {why}
  Current executor: {name}
```

#### CLI calling summary (Architecture D2)

Before each audit subagent call:

```yaml
--- CLI Calling Summary ---
subagent_type: general-purpose
target_agent: auditor-tasks-doc
phase: tasks_doc_audit
round: {N}
artifact_doc_path: {path}
baseline_path: {baseline}
report_path: {path}
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
  artifact_doc_path: "{path}"
  report_path: "{path}"
next_steps:
  - action: revise_tasks_doc|execute_standalone_tasks
    agent: auditor-tasks-doc|bmad-standalone-tasks
    ready: true|false
handoff:
  next_action: revise_tasks_doc|execute_standalone_tasks
  next_agent: auditor-tasks-doc|bmad-standalone-tasks
  ready: true|false
---
```

---

### Layer 3: Repo add-ons

> State, hooks, handoff, scoring, commit gate

#### State

- `.claude/state/bmad-progress.yaml`: global BMAD progress
- Handoff: structured YAML at end of each phase

#### Post-audit automation close-out

On pass, do not hand-run `bmad-speckit score`. The executor only needs to return `projectRoot`, `reportPath`, and `artifactDocPath`; the invoking host/runner handles score write, audit-index updates, and the rest of post-audit automation.

#### Commit gate

- PASS means document audit passed; may proceed to `bmad-standalone-tasks` implementation
- Do not commit directly
- Final commit gated by `bmad-master`

#### Forbidden wording

Reports must not use delay language: “optional”, “later”, “TBD”, “depending”, “next iteration”, “not yet”, “implement first”, etc. (match Chinese list in canonical SKILL.md).

---

## References

- **audit-document-iteration-rules**: `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
- **audit-prompts §4**: `.claude/skills/speckit-workflow/references/audit-prompts.md` §4
- **audit-prompts §5**: `.claude/skills/speckit-workflow/references/audit-prompts.md` §5
- **audit-prompts-critical-auditor-appendix**: `.claude/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
- **audit-post-impl-rules**: `.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`

---

## Prompt template integrity (mandatory)

When launching a TASKS document audit subtask, the main Agent **must** copy the **full** prompt from `references/audit-prompt-tasks-doc.md` into the subagent prompt and replace all placeholders. **Forbidden**:

- Omitting any paragraph
- Summarizing or paraphrasing
- Dropping mandatory guard lines exactly as authored in the source audit prompt template (required-reading boilerplate must remain verbatim)
- Removing “verbatim output” requirements

Post-implementation audit template: `references/audit-prompt-impl.md`.

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->

