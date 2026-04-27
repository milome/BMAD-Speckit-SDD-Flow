<!-- BLOCK_LABEL_POLICY=B -->

---
name: bmad-code-reviewer-lifecycle
description: |
  Codex CLI / OMC adapter entry for the end-to-end Code Reviewer Lifecycle skill.
  Uses the Cursor bmad-code-reviewer-lifecycle semantics as the baseline: orchestrate audit output 鈫?parse 鈫?scoring write for each BMAD stage.
  Defines triggers, stage mapping, and report paths; references auditor-* executors, audit-prompts, code-reviewer-config, scoring/rules.
  Coordinates with speckit-workflow and bmad-story-assistant; after a stage audit passes, invoke parsing and write to scoring storage.
when_to_use: |
  Use when: after any BMAD workflow stage (prd/arch/story/specify/plan/gaps/tasks/implement/post_impl) audit you need score parsing and write;
  or speckit-workflow / bmad-story-assistant stage completion must run end-to-end 鈥減arse and write鈥?
  or the user explicitly asks for 鈥渆nd-to-end scoring鈥?
references:
  - auditor-spec: spec-stage audit executor; `.codex/agents/auditors/auditor-spec.md`
  - auditor-plan: plan-stage audit executor; `.codex/agents/auditors/auditor-plan.md`
  - auditor-tasks: tasks-stage audit executor; `.codex/agents/auditors/auditor-tasks.md`
  - auditor-implement: implement-stage audit executor; `.codex/agents/auditors/auditor-implement.md`
  - auditor-bugfix: bugfix-stage audit executor; `.codex/agents/auditors/auditor-bugfix.md`
  - auditor-document: document-stage audit executor; `.codex/agents/auditors/auditor-document.md`
  - audit-prompts: per-stage prompts; `.codex/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-prd: PRD audit prompts; `.codex/skills/speckit-workflow/references/audit-prompts-prd.md`
  - audit-prompts-arch: architecture audit prompts; `.codex/skills/speckit-workflow/references/audit-prompts-arch.md`
  - audit-prompts-code: code audit prompts; `.codex/skills/speckit-workflow/references/audit-prompts-code.md`
  - audit-prompts-pr: PR audit prompts; `.codex/skills/speckit-workflow/references/audit-prompts-pr.md`
  - code-reviewer-config: multi-mode config (prd/arch/code/pr); `_bmad/_config/code-reviewer-config.yaml`
  - scoring/rules: parsing rules, item_id, veto_items; `scoring/rules/*.yaml`
  - runAuditorHost / unified auditor host runner: single post-audit entry for score write, auditIndex update, and post-audit automation
---

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout terminology: in this document, a stage is considered complete only when `runAuditorHost` returns `closeout approved`. An audit report `PASS` only means the host close-out may start; `PASS` alone must not be treated as completion, admission, or release.

# Codex adapter: bmad-code-reviewer-lifecycle

## Purpose

This skill is the unified Codex CLI / OMC entry for Cursor `bmad-code-reviewer-lifecycle`.

The goal is **not** to blindly copy the Cursor skill, but to:

1. **Inherit the validated end-to-end audit orchestration semantics** from Cursor (stage audit trigger 鈫?audit execution 鈫?report 鈫?scoring write)
2. **Map audit executors to `.codex/agents/auditor-*`** in Codex no-hooks
3. **Integrate** scoring write, state machine, and handoff already implemented in the repo
4. **Ensure** Codex CLI can run each stage鈥檚 audit loop and scoring write continuously and correctly

---

## Core acceptance criteria

The Claude variant of `bmad-code-reviewer-lifecycle` must:

- Serve as the **end-to-end audit orchestration entry** for Codex CLI, unifying audit 鈫?parse 鈫?scoring write per stage
- Keep executor selection, fallback, and scoring write semantically aligned with the validated Cursor flow
- Fully integrate:
  - Multiple auditor agents (`auditor-spec`, `auditor-plan`, `auditor-tasks`, `auditor-implement`, `auditor-bugfix`, `auditor-document`)
  - 缁熶竴 auditor host runner锛坄runAuditorHost`锛?  - Handoff protocol
- **Not** mix Codex Canonical Base, Claude Runtime Adapter, and Repo Add-ons into an unclear rewrite of prompts

## Main-Agent Orchestration Surface (mandatory)

In interactive mode, this skill must treat repo-native `main-agent-orchestration` as the only orchestration authority. `runAuditorHost` is only the post-audit close-out entry; it must not replace the main Agent's next-branch decision.

Before launching any auditor, remediation subtask, or other bounded execution, the main Agent must:

1. Run `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect`
2. Read `orchestrationState`, `pendingPacketStatus`, `pendingPacket`, `continueDecision`, `mainAgentNextAction`, and `mainAgentReady`
3. If the next branch is dispatchable but no usable packet exists yet, run `npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan`
4. Dispatch only from the returned packet / instruction instead of continuing from audit prose, scoring prose, or handoff summary alone
5. Re-run `inspect` after each child result and after each `runAuditorHost` close-out before choosing the next global branch

`mainAgentNextAction / mainAgentReady` remain compatibility summary fields only; authoritative runtime truth is `orchestrationState + pendingPacket + continueDecision`.

---

## Codex Canonical Base

The following inherits Cursor `bmad-code-reviewer-lifecycle` as the business baseline; the Claude variant must not rewrite intent arbitrarily:

### References (Architecture 搂2.2, 搂10.2)

| Component | Role | How it is used (Codex adapter) |
|-----------|------|----------------------------------|
| auditor-* | Run stage audits | Main Agent schedules `.codex/agents/auditors/auditor-*.md` via Agent tool (`subagent_type: general-purpose`) |
| audit-prompts | Stage prompts | `.codex/skills/speckit-workflow/references/audit-prompts*.md` |
| code-reviewer-config | Multi-mode (prd/arch/code/pr) | Read dimensions, pass_criteria by mode |
| scoring/rules | Parsing rules, item_id, veto_items | Map audit output to stage scores |

### Paths

- **Auditor executors**: `.codex/agents/auditors/auditor-spec.md`, `auditor-plan.md`, `auditor-gaps.md`, `auditor-tasks.md`, `auditor-implement.md`, `auditor-bugfix.md`, `auditor-document.md`
- **Audit prompts**: `.codex/skills/speckit-workflow/references/audit-prompts.md`, `audit-prompts-prd.md`, `audit-prompts-arch.md`, `audit-prompts-code.md`, `audit-prompts-pr.md`
- **Config**: `_bmad/_config/code-reviewer-config.yaml`, `_bmad/_config/stage-mapping.yaml`, `_bmad/_config/eval-lifecycle-report-paths.yaml`
- **Scoring rules**: `scoring/rules/` (`default/`, `gaps-scoring.yaml`, `iteration-tier.yaml`)
- **This skill**: `.codex/skills/bmad-code-reviewer-lifecycle/SKILL.md`

### Stage mapping and triggers

See `_bmad/_config/stage-mapping.yaml`. Stage 鈫?auditor mapping:

| stage | layer | auditor | prompt_template |
|-------|-------|---------|-------------------|
| `story` | layer_3 | managed by bmad-story-assistant | `audit-prompts.md` |
| `specify` | layer_4 | `auditor-spec` | `audit-prompts.md 搂1` |
| `plan` | layer_4 | `auditor-plan` | `audit-prompts.md 搂2` |
| `gaps` | layer_4 | `auditor-gaps` | `audit-prompts.md 搂3` |
| `tasks` | layer_4 | `auditor-tasks` | `audit-prompts.md 搂4` |
| `implement` | layer_4 | `auditor-implement` | `audit-prompts.md 搂5` |
| `post_impl` | layer_5 | `auditor-implement` | `audit-prompts.md 搂5` |
| `pr_review` | layer_5 | main Agent or Codex reviewer | `audit-prompts-pr.md` |
| `bugfix` | 鈥?| `auditor-bugfix` | `audit-prompts.md 搂5` |
| `document` | 鈥?| `auditor-document` | `audit-prompts.md 搂4 / TASKS-doc` |

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
| `story_status_change` | auto | phases 1鈥? |
| `mr_created` | auto | phases 2鈥? |
| `epic_pending_acceptance` | manual_or_auto | phase 6 / Epic rollup |
| `user_explicit_request` | manual | all phases |

---

## Codex no-hooks Runtime Adapter

### Primary executor

Each stage audit is run by scheduling the corresponding `.codex/agents/auditors/auditor-*.md` via **Agent tool** (`subagent_type: general-purpose`). The main Agent passes the full markdown of the auditor agent as the prompt.

### Fallback strategy

Four-level fallback (priority descending):

1. **`.codex/agents/auditors/auditor-*`**: stage-specific executor (primary)
2. **Codex reviewer** (`Codex-native reviewer` code-reviewer `subagent_type`)
3. **code-review skill** (generic, following audit-prompts sections)
4. **Main Agent direct execution**: main Agent reads audit-prompts and produces the audit report line by line

**Fallback notice (FR26)**: When fallback triggers, show the user which executor level is used:

```
鈿狅笍 Fallback notice: audit executor level {N} ({name}), reason: {why level N-1 failed}
```

Examples:

- `鈿狅笍 Fallback notice: level 2 (Codex reviewer), reason: auditor-spec missing or unavailable`
- `鈿狅笍 Fallback notice: level 4 (main Agent direct), reason: first three levels unavailable`

### Runtime contracts

- Must read: `.codex/protocols/audit-result-schema.md`
- Must read: `.codex/state/bmad-progress.yaml`
- Must reference: `code-reviewer-config.yaml`, `stage-mapping.yaml`, `eval-lifecycle-report-paths.yaml`, `runAuditorHost`
- Return must include: `execution_summary`, `artifacts`, `handoff`
- Must state mode 鈫?auditor / stage 鈫?scoring / stage 鈫?reportPath / event 鈫?trigger

### CLI calling summary (Architecture pattern 2)

Before each audit subagent call, the main Agent **must** output:

```yaml
# CLI Calling Summary
Input: {stage}={current}, mode={audit mode}, reportPath={path}
Template: {auditor agent file path}
Output: {expected artifact鈥攁udit report path}
Fallback: {current level and downgrade plan}
Acceptance: {report conclusion 鈥滃畬鍏ㄨ鐩栥€侀獙璇侀€氳繃鈥潁
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
  next_agent: bmad-master|auditor-{stage}|runAuditorHost
  ready: true|false
  mainAgentNextAction: dispatch_review|dispatch_remediation|dispatch_implement
  mainAgentReady: true|false
```

`mainAgentNextAction / mainAgentReady` in this handoff block are compatibility summary fields only. Before any global branch change, the main Agent must re-read `main-agent-orchestration`.

---

## Repo add-ons

### Lifecycle phases

Full audit lifecycle has six phases; each stage audit should go through:

1. **Pre-audit**: read `code-reviewer-config.yaml`, `stage-mapping.yaml`, `eval-lifecycle-report-paths.yaml`; determine mode, auditor, report path, scoring phases
2. **Audit execution**: schedule auditor (primary or fallback) with the correct audit-prompts section
3. **Report generation**: save report to the agreed path; include parseable scoring blocks (鈥滄€讳綋璇勭骇: [A|B|C|D]鈥?and 鈥滅淮搴﹁瘎鍒? dimension: XX/100鈥?
4. **Host trigger**: after pass, call `runAuditorHost`
5. **Iteration tracking**: track `iteration_count`; failed rounds save reports and `iterationReportPaths`
6. **Convergence check**: by strictness鈥擿standard` = single pass; `strict` = 3 consecutive no-gap rounds + Critical Auditor >50%

### Unified auditor host runner prerequisites (checklist)

Before calling the unified auditor host runner after a stage passes:

1. **Parseable blocks** at end of report: 鈥滄€讳綋璇勭骇: [A|B|C|D]鈥?and 鈥滅淮搴﹁瘎鍒? dimension: XX/100鈥?2. **Line-by-line format**: if table + conclusions, append parseable blocks after conclusions
3. **Paths**: `--reportPath` allowed; convention `AUDIT_{stage}-E{epic}-S{story}.md`
4. **Parameters ready**: `stage` / `triggerStage` / `artifactDocPath` / `iterationCount`

### Unified auditor host runner contract

The unified auditor host runner (`runAuditorHost`) is responsible for:

- score write
- auditIndex update
- post-audit automation

**iteration_count (mandatory)**: the agent running the audit loop passes the cumulative count of failed rounds for this stage; pass 0 on first pass; verification rounds for 鈥? no-gap鈥?do not add to `iteration_count`.

### Execution flow

1. Read `.codex/protocols/audit-result-schema.md`
2. Read `.codex/state/bmad-progress.yaml`
3. Read `code-reviewer-config.yaml`
4. Read `stage-mapping.yaml`
5. Read `eval-lifecycle-report-paths.yaml`
6. Resolve mode / scoring / reportPath / trigger from stage
7. Output **CLI Calling Summary**
8. Schedule auditor (primary 鈫?fallback)
9. Auditor reads artifacts and runs checklist
10. Auditor produces report
11. Validate unified auditor host runner prerequisites
12. Trigger `runAuditorHost`
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
  mainAgentNextAction: dispatch_review
  mainAgentReady: true|false
```

Again, the handoff block is compatibility-only; interactive control must return to `main-agent-orchestration`.

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
- Must pass implement-stage audit (three-layer structure: Cursor base / Codex adapter / repo add-ons)

---

## Coordination with other skills

### speckit-workflow

For each phase (搂1.2 spec, 搂2.2 plan, 搂3.2 gaps, 搂4.2 tasks, 搂5.2 implement):

1. This skill resolves auditor and mode for the current stage
2. This skill schedules audit via primary/fallback
3. After pass, triggers `runAuditorHost`
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
