# BMAD Speckit SDD Flow Structure Adaptation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adapt the integrated `bmad-speckit-sdd-flow` design to the repository’s actual `commands/` and `_bmad/` structure so that the workflow can evolve incrementally without breaking existing BMAD conventions.

**Architecture:** Keep `commands/` as the user-facing Claude Code CLI entry layer, while `_bmad/` remains the internal workflow/config/script substrate. The new integrated flow should be introduced as a thin orchestration layer that routes into existing BMAD assets first, then selectively composes superpowers, OMC, and ECC capabilities.

**Tech Stack:** Claude Code command markdown files, BMAD workflow/config YAML, shell scripts under `_bmad/scripts/bmad-speckit`, existing BMAD output conventions under `_bmad-output`, superpowers, OMC, ECC.

---

## 1. What the Current Repository Structure Tells Us

Based on the current repository structure, your BMAD implementation is **not** organized as native Claude Code `SKILL.md` files inside the repo. Instead, it currently uses a dual mechanism:

1. **`commands/*.md`** as the user-facing Claude Code command entrypoints.
2. **`_bmad/`** as the internal BMAD workflow/config/runtime layer.

This means the right adaptation strategy is **not** “drop a new SKILL.md into the repo and call it done.” Instead, the integrated `bmad-speckit-sdd-flow` should be mapped onto the existing split:

- `commands/` = **interaction contract / invocation surface**
- `_bmad/` = **workflow engine / configuration / conventions / scripts**
- `_bmad-output/` = **artifact persistence layer**

That aligns well with the five-layer architecture proposed earlier. In this repo, the five layers should be projected onto actual directories rather than introduced as a brand-new parallel structure.

---

## 2. Actual Structural Mapping

### 2.1 User-Facing Entry Layer → `commands/`

The file `commands/speckit.implement.md` already acts like a command-orchestrator prompt. It contains:
- prerequisite resolution through `_bmad/scripts/bmad-speckit/*/check-prerequisites`
- checklist gating
- plan/tasks/research/data-model/contracts loading
- TDD requirements
- PRD/progress tracking via ralph-method conventions
- phased execution rules

So the integrated flow should treat `commands/` as the place where **Claude Code interaction prompts live**.

### 2.2 Workflow Engine Layer → `_bmad/`

The `_bmad/` tree is already the home for:
- global config (`_bmad/core/config.yaml`)
- module config (`_bmad/bmb/config.yaml`, etc.)
- workflow definitions (`_bmad/core/workflows/party-mode/workflow.md`)
- agent guidance (`_bmad/core/agents/*.md`)
- shell/powershell/python helpers (`_bmad/scripts/bmad-speckit/...`)

So this is where `bmad-speckit-sdd-flow` should map its internal conventions, routing rules, and cross-stage contracts.

### 2.3 Artifact Layer → `_bmad-output/`

Your repo already persists:
- planning artifacts
- implementation artifacts
- audits
- RCA outputs
- progress/prd JSON/TXT sidecars

That means the integrated flow should **extend** this artifact model, not invent another persistence location.

---

## 3. Recommended Target Layout

Use a dual-track adaptation:

```text
commands/
  speckit.discover.md          # optional new entrypoint
  speckit.define.md            # optional new entrypoint
  speckit.design.md            # optional new entrypoint
  speckit.tasks.md             # existing/expected task generation entrypoint
  speckit.implement.md         # existing delivery entrypoint, upgraded
  speckit.assure.md            # optional new verification/closeout entrypoint
  bmad-speckit-sdd-flow.md     # optional umbrella orchestrator command

_bmad/
  core/
    workflows/
      speckit-sdd-flow/
        workflow.md            # new top-level flow definition
        steps/
          step-01-discover.md
          step-02-define.md
          step-03-design.md
          step-04-deliver.md
          step-05-assure.md
    agents/
      ...existing agent docs...
    config.yaml
  scripts/
    bmad-speckit/
      shell/
      powershell/
      python/

_bmad-output/
  planning-artifacts/
  implementation-artifacts/
  verification-artifacts/      # recommended new bucket if needed
```

### Recommendation

If you want minimum migration cost, do **not** start by adding all of these files at once.
Start with:
1. upgrade `commands/speckit.implement.md`
2. add `_bmad/core/workflows/speckit-sdd-flow/workflow.md`
3. optionally add `commands/bmad-speckit-sdd-flow.md` as an umbrella entrypoint

---

## 4. Mapping the Five-Layer Architecture Onto Real Directories

| Five-Layer Role | Repository Location | Notes |
|---|---|---|
| Layer 1 — Product Workflow Backbone | `_bmad/core/workflows/speckit-sdd-flow/` + `commands/bmad-speckit-sdd-flow.md` | BMAD lifecycle controller |
| Layer 2 — Methodology & Process Guards | command prompts and routing clauses inside `commands/*.md` | embed superpowers checkpoints here |
| Layer 3 — Orchestration & State | external OMC skill usage + `.omc/` + `_bmad-output/` links | keep OMC external, map outputs back to BMAD |
| Layer 4 — Execution Capabilities | `commands/speckit.implement.md` + ECC skill delegation | existing implement command is the best anchor |
| Layer 5 — Governance & Verification | new `commands/speckit.assure.md` or enhanced audit flow | connect to BMAD audits and verification artifacts |

---

## 5. Adapting to Existing BMAD Conventions

### 5.1 Config Conventions

`_bmad/core/config.yaml` and `_bmad/bmb/config.yaml` show that BMAD already assumes:
- Chinese communication/document output
- `_bmad-output` as the canonical output root

So the integrated flow must inherit these defaults rather than hardcoding new output paths like `docs/plans` as the only destination. `docs/plans` is fine for Claude-facing design docs, but BMAD execution artifacts should continue to live under `_bmad-output`.

### 5.2 Existing Implement Contract

`commands/speckit.implement.md` is already a strong execution contract. It should be treated as **Phase D — Deliver** in the new architecture, not replaced.

That command already handles:
- task execution sequencing
- prerequisite gating
- ralph-method tracking
- TDD discipline
- lint/test validation

So the adaptation should add:
- explicit upstream phase assumptions
- superpowers/OMC/ECC routing clauses
- stronger review/verify handoff

rather than rewriting the whole command.

### 5.3 Existing Discussion / Adversarial Review Model

The Party Mode and Critical Auditor materials in `_bmad/core/workflows/party-mode/` and `_bmad/core/agents/` provide a native BMAD mechanism for adversarial challenge. This is important because it means:

- BMAD already has a **design-time critique lane**
- OMC critic/verifier should complement, not replace it
- `bmad-code-reviewer-lifecycle` should align with this quality philosophy

In short: BMAD already has an internal “challenge the plan” mechanism. The integration should explicitly preserve it.

---

## 6. Where the Missing BMAD Skills Fit

You previously noted that these skills were not yet covered:
- `bmad-standalone-tasks`
- `bmad-bug-assistant`
- `bmad-code-reviewer-lifecycle`
- `bmad-standalone-tasks-doc-review`

They should be integrated as first-class routing lanes.

### Updated BMAD Routing Matrix

| BMAD Skill | Best Fit Phase | Role in New Architecture |
|---|---|---|
| `bmad-speckit-sdd-flow` | all phases | top-level orchestrator |
| `bmad-standalone-tasks` | Design / Deliver | execute task bundles outside full epic/story context |
| `bmad-bug-assistant` | Discover / Define / Deliver | bug RCA, root-cause-driven implementation path |
| `bmad-code-reviewer-lifecycle` | Review / Assure | lifecycle review gate before completion |
| `bmad-standalone-tasks-doc-review` | Assure | strict document/audit review for TASKS/TASKS-derived outputs |

### Practical Interpretation

- If the request is a **bugfix**, route early into `bmad-bug-assistant`, not generic feature flow.
- If work is **task-document centric** and not full feature-driven, route into `bmad-standalone-tasks`.
- After implementation, require `bmad-code-reviewer-lifecycle` before claiming done.
- If the main deliverable is a TASKS doc or audit doc, run `bmad-standalone-tasks-doc-review` in the assurance stage.

This gives BMAD-specific skills a clear place rather than leaving review/assurance entirely to superpowers or ECC.

---

## 7. Recommended Command-Level Adaptation

### 7.1 New Umbrella Command

Recommended new command:

- `commands/bmad-speckit-sdd-flow.md`

Purpose:
- determine request type
- select current phase
- route into the appropriate BMAD path
- decide whether to invoke superpowers / OMC / ECC / BMAD specialty skills

It should not do all implementation itself. It should be an orchestration prompt.

### 7.2 Keep `commands/speckit.implement.md` as the Delivery Engine

Do not replace it.
Adapt it by adding a preamble that clarifies:
- this command corresponds to **Phase D — Deliver**
- it assumes spec/design/tasks are already validated
- after implementation it must hand off to review/assure lanes

### 7.3 Add an Assurance Command

Recommended new command:
- `commands/speckit.assure.md`

Purpose:
- run verification-before-completion mindset
- invoke BMAD review/doc-review skills
- invoke OMC verifier / ECC review/e2e/security when relevant
- emit closeout summary + artifact pointers

This is the missing end-cap in the current structure.

---

## 8. Recommended `_bmad` Workflow Adaptation

Add a new workflow definition:

- `_bmad/core/workflows/speckit-sdd-flow/workflow.md`

This file should define the BMAD-native lifecycle in terms of five visible phases:

```text
Phase A — Discover
Phase B — Define
Phase C — Design
Phase D — Deliver
Phase E — Assure
```

And for each phase document:
- entry criteria
- required inputs
- preferred BMAD skill / command
- optional superpowers skill
- optional OMC lane
- optional ECC lane
- required outputs
- transition criteria

This gives you a BMAD-native canonical source of truth while `commands/` stays thin and operational.

---

## 9. Suggested Prompt Skeleton for `commands/bmad-speckit-sdd-flow.md`

```markdown
---
description: Orchestrate BMAD Speckit SDD across Discover, Define, Design, Deliver, and Assure using the repository's existing commands/ and _bmad/ structure.
---

## Purpose

You are the umbrella orchestration command for BMAD Speckit SDD in this repository.
You must preserve BMAD conventions in `_bmad/` and `_bmad-output/` while using Claude Code CLI commands as the interaction surface.

## Core Responsibilities

1. Determine request type: feature, bugfix, standalone task, review/audit, or verification.
2. Determine current phase: Discover, Define, Design, Deliver, or Assure.
3. Route to the correct BMAD-native lane first.
4. Add superpowers, OMC, and ECC only where they strengthen that phase.
5. Preserve artifact compatibility with `_bmad-output`.

## Phase Routing

### Discover
- Default for vague requests or exploratory asks
- Prefer BMAD discovery/story logic
- For bug-oriented requests, route to `bmad-bug-assistant`
- Optionally invoke superpowers brainstorming
- Optionally invoke BMAD Party Mode or OMC explore/critic lane

### Define
- Produce/refine spec, scope, and acceptance criteria
- Preserve BMAD artifact conventions
- Ensure output is concrete enough for design or tasks

### Design
- Produce architecture, task map, and delivery strategy
- For task-centric workflows, route to `bmad-standalone-tasks`
- Optionally invoke superpowers writing-plans
- Optionally invoke OMC planner/architect

### Deliver
- Route to `commands/speckit.implement.md` when implementation is ready
- Require TDD, PRD/progress tracking, and tasks discipline
- Optionally invoke ECC TDD/build/review capabilities

### Assure
- Route to `bmad-code-reviewer-lifecycle`
- If deliverable is task-doc centric, route to `bmad-standalone-tasks-doc-review`
- Optionally invoke superpowers verification-before-completion
- Optionally invoke OMC verifier/trace and ECC security/e2e/review

## Request Classification Rules

- Bug report / regression / root cause → `bmad-bug-assistant`
- Existing TASKS artifact / execution-only ask → `bmad-standalone-tasks`
- Full feature lifecycle → normal SDD flow
- “Review”, “audit”, “done yet?” → Assure phase

## Output Per Turn

Always state:
- current phase
- why this route was chosen
- which BMAD command/skill is primary
- which auxiliary layer is added (superpowers/OMC/ECC)
- what artifact or gate is next
```

---

## 10. Suggested Prompt Delta for `commands/speckit.implement.md`

Instead of rewriting the file, add these concepts:

### Add near the top
- This command is the canonical **Deliver phase** executor of BMAD Speckit SDD.
- It assumes upstream discovery/spec/design/tasking have already completed.
- If the request is primarily bug RCA, redirect to `bmad-bug-assistant` before implementation.
- If tasks are standalone and not tied to a full feature flow, allow delegation to `bmad-standalone-tasks`.

### Add near completion validation
Before declaring completion, require one of:
- `bmad-code-reviewer-lifecycle`
- `bmad-standalone-tasks-doc-review` for task-doc-heavy outputs
- or an equivalent explicit assurance pass

That keeps delivery and assurance cleanly separated.

---

## 11. Suggested `_bmad` Workflow File Outline

Recommended file:
- `_bmad/core/workflows/speckit-sdd-flow/workflow.md`

Suggested outline:

```markdown
---
name: speckit-sdd-flow
description: Canonical five-phase BMAD Speckit SDD orchestration workflow
---

## Goal
Define the BMAD-native lifecycle for Discover, Define, Design, Deliver, and Assure.

## Phase A — Discover
Entry:
Outputs:
Primary BMAD lane:
Optional superpowers/OMC/ECC support:
Exit criteria:

## Phase B — Define
...

## Phase C — Design
...

## Phase D — Deliver
Primary command: `commands/speckit.implement.md`
...

## Phase E — Assure
Primary BMAD review lanes:
- bmad-code-reviewer-lifecycle
- bmad-standalone-tasks-doc-review
...
```

---

## 12. Final Recommendation

### Best immediate path

Implement in this order:

1. **Create** `commands/bmad-speckit-sdd-flow.md`
2. **Create** `_bmad/core/workflows/speckit-sdd-flow/workflow.md`
3. **Patch** `commands/speckit.implement.md` with phase-awareness and assurance handoff
4. **Explicitly integrate** the four missing BMAD skills in the umbrella routing matrix

### Why this order works

- minimal disruption to existing commands
- preserves current BMAD execution behavior
- introduces the new architecture incrementally
- makes room for superpowers/OMC/ECC without replacing BMAD identity

---

## 13. Bite-Sized Execution Tasks

### Task 1: Create umbrella command design

**Files:**
- Future create: `commands/bmad-speckit-sdd-flow.md`

**Step 1:** Define request classification rules.

**Step 2:** Define Discover/Define/Design/Deliver/Assure routing.

**Step 3:** Add BMAD-first routing before superpowers/OMC/ECC enhancements.

### Task 2: Create BMAD workflow definition

**Files:**
- Future create: `_bmad/core/workflows/speckit-sdd-flow/workflow.md`

**Step 1:** Define five visible phases.

**Step 2:** Define entry/exit criteria for each phase.

**Step 3:** Map outputs into `_bmad-output` conventions.

### Task 3: Patch delivery command

**Files:**
- Future modify: `commands/speckit.implement.md`

**Step 1:** Add Deliver-phase identity.

**Step 2:** Add bug/standalone-task routing preconditions.

**Step 3:** Add mandatory assurance handoff before claiming completion.

### Task 4: Integrate missing BMAD specialty lanes

**Files:**
- Future modify: umbrella command + workflow docs

**Step 1:** route bug asks → `bmad-bug-assistant`

**Step 2:** route task-only execution → `bmad-standalone-tasks`

**Step 3:** route review gate → `bmad-code-reviewer-lifecycle`

**Step 4:** route task-doc audit → `bmad-standalone-tasks-doc-review`

---

## 15. Drafts That Were Written to the Repository and Must Be Preserved in Documentation

The following repository-level drafts were written during exploration and are intentionally preserved here as **design artifacts only**. They should be treated as candidate implementations for later review, not as approved source changes.

### 15.1 Draft A — `commands/bmad-speckit-sdd-flow.md`

Intended role:
- umbrella BMAD-first routing command
- classify request into Discover / Define / Design / Deliver / Assure
- choose BMAD-native lane first
- optionally layer superpowers / OMC / ECC

Draft responsibilities captured:
- request classification for feature / bug / standalone tasks / review
- explicit Deliver route to `/speckit.implement`
- explicit Assure route to `/speckit.assure`
- routing to `bmad-bug-assistant`, `bmad-standalone-tasks`, `bmad-code-reviewer-lifecycle`, and `bmad-standalone-tasks-doc-review`
- output contract requiring: current phase, reason, primary lane, auxiliary layers, next gate

Draft highlights:
- BMAD remains phase controller
- superpowers is methodology support
- OMC is orchestration/state support
- ECC is engineering support
- anti-patterns explicitly forbid skipping BMAD specialty lanes or declaring completion from implementation alone

### 15.2 Draft B — `_bmad/core/workflows/speckit-sdd-flow/workflow.md`

Intended role:
- canonical BMAD-native internal workflow definition
- five visible phases:
  - Phase A — Discover
  - Phase B — Define
  - Phase C — Design
  - Phase D — Deliver
  - Phase E — Assure

Draft responsibilities captured:
- entry conditions per phase
- outputs per phase
- exit criteria per phase
- request classification matrix
- artifact strategy preserving `_bmad-output`
- explicit pairing with `/speckit.implement`

Draft highlights:
- Deliver is defined as execution with continuous task/progress/prd synchronization
- Assure is defined as explicit review/verification before closure
- BMAD specialty lanes are preferred before auxiliary systems

### 15.3 Draft C — `commands/speckit.assure.md`

Intended role:
- canonical Phase E assurance command
- validate whether delivered work is truly ready to close
- route through BMAD review lanes before any completion claim

Draft responsibilities captured:
- classify assurance target as lifecycle review / task-doc review / bugfix verification / mixed review
- prefer `bmad-code-reviewer-lifecycle` for implementation review
- prefer `bmad-standalone-tasks-doc-review` for TASKS or audit-doc review
- route back upstream when assurance is premature
- emit a strict decision: `CLOSE`, `REWORK`, or `ESCALATE`

Draft output contract:
- Assurance Type
- Artifacts Reviewed
- Findings
- Decision
- Next Step

### 15.4 Draft D — Patch intent for `commands/speckit.implement.md`

Intended patch themes:
- explicitly mark the command as **Phase D — Deliver**
- add BMAD routing preconditions so bug/RCA-heavy asks do not jump straight into implementation
- allow standalone TASKS-oriented work to route through `bmad-standalone-tasks`
- require assurance handoff before final completion claims
- tighten side-effect rules so ignore/config file creation only happens when the active delivery scope truly requires it
- standardize `prd/progress` stem naming expectations

### 15.5 Preservation Rule

These draft implementations are preserved here so the next implementation pass can:
- selectively reapply them after review,
- compare them against upstream BMAD command conventions,
- decide whether to keep them as command files, migrate them into workflow-driven XML/YAML patterns, or split them into smaller step files.

They are **not** considered approved simply because they were drafted once.

---

## 16. Recommended Next Step After Revert

After reverting the repository changes, the safest next implementation approach is:

1. keep these drafts only in design docs;
2. review whether command-style files or BMAD workflow-driven files should be primary;
3. reintroduce approved versions one file at a time;
4. validate each file against existing BMAD command/workflow conventions before merging.
