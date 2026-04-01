<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-code-reviewer-lifecycle
description: |
  Claude Code CLI / OMC adapter entry for the end-to-end Code Reviewer Lifecycle skill.
  Uses the Cursor bmad-code-reviewer-lifecycle semantics as the baseline: orchestrate audit output → parse → scoring write for each BMAD stage.
  Defines triggers, stage mapping, and report paths; references auditor-* executors, audit-prompts, code-reviewer-config, scoring/rules.
  Coordinates with speckit-workflow and bmad-story-assistant; after a stage audit passes, invoke parsing and write to scoring storage.
when_to_use: |
  Use when: after any BMAD workflow stage (prd/arch/story/specify/plan/gaps/tasks/implement/post_impl) audit you need score parsing and write;
  or speckit-workflow / bmad-story-assistant stage completion must run end-to-end “parse and write”;
  or the user explicitly asks for “end-to-end scoring”.
references:
  - auditor-spec: spec-stage audit executor; `.claude/agents/auditors/auditor-spec.md`
  - auditor-plan: plan-stage audit executor; `.claude/agents/auditors/auditor-plan.md`
  - auditor-tasks: tasks-stage audit executor; `.claude/agents/auditors/auditor-tasks.md`
  - auditor-implement: implement-stage audit executor; `.claude/agents/auditors/auditor-implement.md`
  - auditor-bugfix: bugfix-stage audit executor; `.claude/agents/auditors/auditor-bugfix.md`
  - auditor-document: document-stage audit executor; `.claude/agents/auditors/auditor-document.md`
  - audit-prompts: per-stage prompts; `.claude/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-prd: PRD audit prompts; `.claude/skills/speckit-workflow/references/audit-prompts-prd.md`
  - audit-prompts-arch: architecture audit prompts; `.claude/skills/speckit-workflow/references/audit-prompts-arch.md`
  - audit-prompts-code: code audit prompts; `.claude/skills/speckit-workflow/references/audit-prompts-code.md`
  - audit-prompts-pr: PR audit prompts; `.claude/skills/speckit-workflow/references/audit-prompts-pr.md`
  - code-reviewer-config: multi-mode config (prd/arch/code/pr); `_bmad/_config/code-reviewer-config.yaml`
  - scoring/rules: parsing rules, item_id, veto_items; `scoring/rules/*.yaml`
  - parseAndWriteScore (Story 3.3): parse audit report and write scoring; `scoring/orchestrator/parse-and-write.ts`; CLI `scripts/parse-and-write-score.ts`
---

# Claude adapter: bmad-code-reviewer-lifecycle

## Purpose

This skill is the unified Claude Code CLI / OMC entry for Cursor `bmad-code-reviewer-lifecycle`.

The goal is **not** to blindly copy the Cursor skill, but to:

1. **Inherit the validated end-to-end audit orchestration semantics** from Cursor (stage audit trigger → audit execution → report → scoring write)
2. **Map audit executors to `.claude/agents/auditor-*`** in Claude/OMC
3. **Integrate** scoring write, state machine, and handoff already implemented in the repo
4. **Ensure** Claude Code CLI can run each stage’s audit loop and scoring write continuously and correctly

---

## Core acceptance criteria

The Claude variant of `bmad-code-reviewer-lifecycle` must:

- Serve as the **end-to-end audit orchestration entry** for Claude Code CLI, unifying audit → parse → scoring write per stage
- Keep executor selection, fallback, and scoring write semantically aligned with the validated Cursor flow
- Fully integrate:
  - Multiple auditor agents (`auditor-spec`, `auditor-plan`, `auditor-tasks`, `auditor-implement`, `auditor-bugfix`, `auditor-document`)
  - Scoring write (`parse-and-write-score.ts`)
  - Handoff protocol
- **Not** mix Cursor Canonical Base, Claude Runtime Adapter, and Repo Add-ons into an unclear rewrite of prompts

---

## Cursor canonical base

The following inherits Cursor `bmad-code-reviewer-lifecycle` as the business baseline; the Claude variant must not rewrite intent arbitrarily:

### References (Architecture §2.2, §10.2)

| Component | Role | How it is used (Claude adapter) |
|-----------|------|----------------------------------|
| auditor-* | Run stage audits | Main Agent schedules `.claude/agents/auditors/auditor-*.md` via Agent tool (`subagent_type: general-purpose`) |
| audit-prompts | Stage prompts | `.claude/skills/speckit-workflow/references/audit-prompts*.md` |
| code-reviewer-config | Multi-mode (prd/arch/code/pr) | Read dimensions, pass_criteria by mode |
| scoring/rules | Parsing rules, item_id, veto_items | Map audit output to stage scores |

### Paths

- **Auditor executors**: `.claude/agents/auditors/auditor-spec.md`, `auditor-plan.md`, `auditor-gaps.md`, `auditor-tasks.md`, `auditor-implement.md`, `auditor-bugfix.md`, `auditor-document.md`
- **Audit prompts**: `.claude/skills/speckit-workflow/references/audit-prompts.md`, `audit-prompts-prd.md`, `audit-prompts-arch.md`, `audit-prompts-code.md`, `audit-prompts-pr.md`
- **Config**: `_bmad/_config/code-reviewer-config.yaml`, `_bmad/_config/stage-mapping.yaml`, `_bmad/_config/eval-lifecycle-report-paths.yaml`
- **Scoring rules**: `scoring/rules/` (`default/`, `gaps-scoring.yaml`, `iteration-tier.yaml`)
- **This skill**: `.claude/skills/bmad-code-reviewer-lifecycle/SKILL.md`

### Stage mapping and triggers

See `_bmad/_config/stage-mapping.yaml`. Stage → auditor mapping:

| stage | layer | auditor | prompt_template |
|-------|-------|---------|-------------------|
| `story` | layer_3 | managed by bmad-story-assistant | `audit-prompts.md` |
| `specify` | layer_4 | `auditor-spec` | `audit-prompts.md §1` |
| `plan` | layer_4 | `auditor-plan` | `audit-prompts.md §2` |
| `gaps` | layer_4 | `auditor-gaps` | `audit-prompts.md §3` |
| `tasks` | layer_4 | `auditor-tasks` | `audit-prompts.md §4` |
| `implement` | layer_4 | `auditor-implement` | `audit-prompts.md §5` |
| `post_impl` | layer_5 | `auditor-implement` | `audit-prompts.md §5` |
| `pr_review` | layer_5 | main Agent or OMC reviewer | `audit-prompts-pr.md` |
| `bugfix` | — | `auditor-bugfix` | `audit-prompts.md §5` |
| `document` | — | `auditor-document` | `audit-prompts.md §4 / TASKS-doc` |

### Stage scoring phases

| stage | scoring phases | report path source |
|-------|----------------|----------------------|
| `story` | `[1]` | `eval-lifecycle-report-paths.yaml` |
| `specify` | `[1]` | `eval-lifecycle-report-paths.yaml` |
| `plan` | `[1,2]` | `eval-lifecycle-report-paths.yaml` |
| `gaps` | `[1,2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `tasks` | `[2,3,4,5]` | `eval-lifecycle-report-paths.yaml` |
| `implement` | `[2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `post_impl` | `[2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `pr_review` | `[6]` | `eval-lifecycle-report-paths.yaml` |

### Report path conventions

See `_bmad/_config/eval-lifecycle-report-paths.yaml`.

### Mode mapping

| mode | config | use | prompt_template |
|------|----------|-----|-----------------|
| `code` | `code-reviewer-config.yaml` | code audit | `audit-prompts-code.md` |
| `prd` | `code-reviewer-config.yaml` | PRD audit | `audit-prompts-prd.md` |
| `arch` | `code-reviewer-config.yaml` | architecture audit | `audit-prompts-arch.md` |
| `pr` | `code-reviewer-config.yaml` | PR audit | `audit-prompts-pr.md` |

### Trigger mapping

| event | trigger | scope |
|-------|---------|-------|
| `stage_audit_complete` | auto | scoring phase for current stage |
| `story_status_change` | auto | phases 1–6 |
| `mr_created` | auto | phases 2–6 |
| `epic_pending_acceptance` | manual_or_auto | phase 6 / Epic rollup |
| `user_explicit_request` | manual | all phases |

---

## Claude/OMC runtime adapter

### Primary executor

Each stage audit is run by scheduling the corresponding `.claude/agents/auditors/auditor-*.md` via **Agent tool** (`subagent_type: general-purpose`). The main Agent passes the full markdown of the auditor agent as the prompt.

### Fallback strategy

Four-level fallback (priority descending):

1. **`.claude/agents/auditors/auditor-*`**: stage-specific executor (primary)
2. **OMC reviewer** (`oh-my-claudecode` code-reviewer `subagent_type`)
3. **code-review skill** (generic, following audit-prompts sections)
4. **Main Agent direct execution**: main Agent reads audit-prompts and produces the audit report line by line

**Fallback notice (FR26)**: When fallback triggers, show the user which executor level is used:

```
⚠️ Fallback notice: audit executor level {N} ({name}), reason: {why level N-1 failed}
```

Examples:

- `⚠️ Fallback notice: level 2 (OMC reviewer), reason: auditor-spec missing or unavailable`
- `⚠️ Fallback notice: level 4 (main Agent direct), reason: first three levels unavailable`

### Runtime contracts

- Must read: `.claude/protocols/audit-result-schema.md`
- Must read: `.claude/state/bmad-progress.yaml`
- Must reference: `code-reviewer-config.yaml`, `stage-mapping.yaml`, `eval-lifecycle-report-paths.yaml`, `parse-and-write-score`
- Return must include: `execution_summary`, `artifacts`, `handoff`
- Must state mode → auditor / stage → scoring / stage → reportPath / event → trigger

### CLI calling summary (Architecture pattern 2)

Before each audit subagent call, the main Agent **must** output:

```yaml
# CLI Calling Summary
Input: {stage}={current}, mode={audit mode}, reportPath={path}
Template: {auditor agent file path}
Output: {expected artifact—audit report path}
Fallback: {current level and downgrade plan}
Acceptance: {report conclusion “完全覆盖、验证通过”}
```

### YAML handoff (Architecture pattern 4)

After each stage audit, the main Agent **must** output:

```yaml
execution_summary:
  status: passed|failed
  stage: {current stage}
  mode: {audit mode}
  iteration_count: {cumulative rounds}
artifacts:
  reportPath: {audit report path}
  artifactDocPath: {audited doc path}
next_steps:
  - {next action}
handoff:
  next_action: scoring_trigger|iterate_audit|proceed_to_next_stage
  next_agent: bmad-master|auditor-{stage}|parse-and-write-score
  ready: true|false
```

---

## Repo add-ons

### Lifecycle phases

Full audit lifecycle has six phases; each stage audit should go through:

1. **Pre-audit**: read `code-reviewer-config.yaml`, `stage-mapping.yaml`, `eval-lifecycle-report-paths.yaml`; determine mode, auditor, report path, scoring phases
2. **Audit execution**: schedule auditor (primary or fallback) with the correct audit-prompts section
3. **Report generation**: save report to the agreed path; include parseable scoring blocks (“总体评级: [A|B|C|D]” and “维度评分: dimension: XX/100”)
4. **Scoring trigger**: after pass, run `parse-and-write-score.ts`
5. **Iteration tracking**: track `iteration_count`; failed rounds save reports and `iterationReportPaths`
6. **Convergence check**: by strictness—`standard` = single pass; `strict` = 3 consecutive no-gap rounds + Critical Auditor >50%

### parseAndWriteScore prerequisites (checklist)

Before calling `parseAndWriteScore` after a stage passes:

1. **Parseable blocks** at end of report: “总体评级: [A|B|C|D]” and “维度评分: dimension: XX/100”
2. **Line-by-line format**: if table + conclusions, append parseable blocks after conclusions
3. **Paths**: `--reportPath` allowed; convention `AUDIT_{stage}-E{epic}-S{story}.md`
4. **Parameters ready**: `stage` / `triggerStage` / `artifactDocPath` / `iterationCount`

### parse-and-write-score CLI example

```bash
npx bmad-speckit score \
  --reportPath <path> \
  --stage <stage> \
  --event stage_audit_complete \
  --triggerStage <triggerStage> \
  --epic {epic} \
  --story {story} \
  --artifactDocPath <path> \
  --iteration-count {n} \
  [--iterationReportPaths path1,path2,...]
```

**iteration_count (mandatory)**: the agent running the audit loop passes the cumulative count of failed rounds for this stage; pass 0 on first pass; verification rounds for “3 no-gap” do not add to `iteration_count`.

### Execution flow

1. Read `.claude/protocols/audit-result-schema.md`
2. Read `.claude/state/bmad-progress.yaml`
3. Read `code-reviewer-config.yaml`
4. Read `stage-mapping.yaml`
5. Read `eval-lifecycle-report-paths.yaml`
6. Resolve mode / scoring / reportPath / trigger from stage
7. Output **CLI Calling Summary**
8. Schedule auditor (primary → fallback)
9. Auditor reads artifacts and runs checklist
10. Auditor produces report
11. Validate `parseAndWriteScore` prerequisites
12. Trigger `parse-and-write-score`
13. Output **YAML handoff**
14. Update audit state

### Output / handoff

```yaml
execution_summary:
  status: passed|failed
  stage: review_passed
  mode: code|prd|arch|pr
artifacts:
  review: reviews/.../review.md
  reportPath: reports/.../audit.md
handoff:
  next_action: scoring_trigger|return_to_auditor
  next_agent: bmad-master|auditor-implement
  ready: true|false
```

### State updates

```yaml
layer: review
stage: review_passed
review_round: number
review_verdict: pass | fail
artifacts:
  review: reviews/.../review.md
```

### Constraints

- **Do not commit on your own**
- Must pass implement-stage audit (three-layer structure: Cursor base / Claude adapter / repo add-ons)

---

## Coordination with other skills

### speckit-workflow

For each phase (§1.2 spec, §2.2 plan, §3.2 gaps, §4.2 tasks, §5.2 implement):

1. This skill resolves auditor and mode for the current stage
2. This skill schedules audit via primary/fallback
3. After pass, triggers `parse-and-write-score`
4. Outputs YAML handoff for speckit-workflow next step

### bmad-story-assistant

`bmad-story-assistant` triggers speckit-workflow in Dev Story; audits are orchestrated indirectly through this skill.

---

## Use cases

- Unified audit orchestration and scoring for speckit phases
- Post-implementation code review (`post_impl`)
- Pre-PR check (`pr_review`)
- Code quality gates
- BUGFIX document audit (`bugfix`)
- TASKS document audit (`document`)

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
