# BMAD Speckit SDD Flow Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an integrated version of `bmad-speckit-sdd-flow` for Claude Code CLI that preserves its five-layer Speckit/SDD architecture while cleanly incorporating superpowers, OMC, and ECC.

**Architecture:** `bmad-speckit-sdd-flow` remains the top-level workflow orchestrator and stage controller. superpowers provides process discipline and mandatory methodology gates, OMC provides multi-agent orchestration plus state/memory/verification, and ECC provides execution-time engineering capabilities such as planning, TDD, code review, e2e, build resolution, and security review.

**Tech Stack:** Claude Code CLI skills, BMAD Speckit/SDD workflow design, superpowers skills, oh-my-claudecode (OMC), everything-claude-code (ECC), Markdown design docs.

---

## 1. Objective and Design Principles

This integration keeps `bmad-speckit-sdd-flow` as the canonical entrypoint and avoids turning the stack into a flat collection of overlapping skills. The main design rule is **separation of concerns by layer**.

- **BMAD Speckit SDD Flow** defines the lifecycle, artifacts, stage gates, and user-facing progression.
- **superpowers** defines the preferred method for thinking and working at each stage.
- **OMC** handles orchestration, delegation, persistent state, and evidence-driven verification.
- **ECC** supplies specialized engineering execution capabilities within Claude Code CLI.
- **Claude Code native tools** remain the substrate for file operations, task tracking, planning mode, and shell execution.

The result is a five-layer architecture where each layer has a narrow role and where fallback behavior is explicit. This avoids duplicated control planes, conflicting routing decisions, and “skill pileup” where several systems all try to be the primary orchestrator.

---

## 2. Five-Layer Integrated Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 5 — Governance & Verification                                 │
│ verification-before-completion / OMC verifier / ECC reviewers       │
│ quality gates / evidence / completion criteria / audit trail        │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 4 — Execution Capabilities                                    │
│ ECC plan/tdd/review/build/e2e/security + OMC executor/tester lanes  │
│ implementation, tests, fixes, docs updates                          │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 3 — Orchestration & State                                     │
│ OMC plan/team/trace/notepad/project-memory/state                    │
│ agent routing / parallelism / persistence / recovery                │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 2 — Methodology & Process Guards                              │
│ superpowers brainstorming / writing-plans / executing-plans /       │
│ requesting-code-review / verification-before-completion             │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 1 — Product Workflow Backbone                                 │
│ bmad-speckit-sdd-flow                                               │
│ intake / discovery / spec / design / tasks / delivery gates         │
└──────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Primary Owner | Responsibility | Must Not Do |
|---|---|---|---|
| 1. Product Workflow Backbone | BMAD Speckit SDD | Define phases, artifacts, transitions, exit criteria | Directly own all engineering execution details |
| 2. Methodology & Process Guards | superpowers | Enforce how work is framed, planned, executed, reviewed, verified | Replace the BMAD lifecycle |
| 3. Orchestration & State | OMC | Decide who does what, manage team/parallelism, persist context, collect evidence | Become the product workflow itself |
| 4. Execution Capabilities | ECC + OMC executors | Actually implement, test, review, fix, and validate code/docs | Re-define product stages |
| 5. Governance & Verification | superpowers + OMC + ECC reviewers | Final gatekeeping, review, verification, closure | Start net-new scope |

---

## 3. Stage Mapping Table

Below is the recommended mapping from the five-layer BMAD Speckit SDD flow into superpowers, OMC, and ECC.

| BMAD Stage | Purpose | superpowers | OMC | ECC | Main Outputs |
|---|---|---|---|---|---|
| 0. Intake | Capture request, context, scope | `brainstorming` | optional `deep-interview`, `analyst` | none | clarified objective, constraints, success criteria |
| 1. Discovery | Explore codebase/domain/prior art | `brainstorming` | `explore`, `plan`, `trace`, memory tools | optional `plan` if implementation concerns appear early | discovery notes, assumptions, risks |
| 2. Spec | Produce spec aligned to user outcome | none or `writing-plans` only if implementation details are required | `planner`, `critic` | none | feature spec / requirements / acceptance criteria |
| 3. Design | Produce architecture and solution shape | `writing-plans` | `architect`, `planner`, `critic` | optional `plan` | architecture doc, component boundaries, data flow |
| 4. Tasks | Convert design into executable plan | `writing-plans` | `plan`, `team` if parallel work is likely | `plan`, `tdd` | task list, file map, test strategy |
| 5. Execute | Implement in controlled steps | `executing-plans`, `subagent-driven-development` | `executor`, `team`, `ultrawork`, `trace` | `tdd`, `code-review`, `build-error-resolver`, `security-review`, `e2e` | code, tests, updated artifacts |
| 6. Review | Review implementation and fit against plan | `requesting-code-review` | `code-reviewer`, `verifier`, `critic` | `code-review`, language-specific reviewers | review findings, required fixes |
| 7. Verify | Validate completion with evidence | `verification-before-completion` | `verifier`, `trace` | `security-review`, `e2e`, specialized verifiers | verification evidence, sign-off state |
| 8. Closeout | Persist knowledge and handoff | none | memory/state update tools | doc updater if needed | summary, memory, next-step guidance |

### Recommended Compression Into a Practical Five-Phase Flow

If you want the user-facing flow to stay at exactly five visible layers/phases, use this grouping:

| Visible Phase | Includes | Dominant Control Plane |
|---|---|---|
| Phase A — Discover | Intake + Discovery | BMAD + superpowers + OMC explore |
| Phase B — Define | Spec | BMAD |
| Phase C — Design | Design + Tasking | BMAD + superpowers + OMC planner |
| Phase D — Deliver | Execute + Review | superpowers + OMC + ECC |
| Phase E — Assure | Verify + Closeout | superpowers + OMC verifier + ECC audit |

---

## 4. Integration Rules

### 4.1 Control Precedence

To avoid collisions, use this precedence order:

1. **BMAD Speckit SDD Flow** decides current stage.
2. **superpowers** decides required method/discipline for that stage.
3. **OMC** decides orchestration strategy and agent routing.
4. **ECC** supplies specialized execution skills where relevant.
5. **Native tools** perform concrete file/task/command operations.

### 4.2 Escalation Rules

- **Simple task**: stay mostly in BMAD + superpowers.
- **Multi-file or uncertain task**: escalate to OMC planning/orchestration.
- **Implementation-heavy task**: activate ECC planning/TDD/review capabilities.
- **High-risk or high-scope task**: require OMC verifier + ECC/security review before completion.

### 4.3 Non-Goals

- Do not let ECC become the master workflow.
- Do not let OMC replace BMAD stage semantics.
- Do not invoke every available skill at every stage.
- Do not create parallel plans from BMAD, superpowers, and ECC simultaneously.

---

## 5. Suggested Trigger Matrix

| Situation | What `bmad-speckit-sdd-flow` should do |
|---|---|
| User gives vague feature idea | start discovery via `brainstorming` |
| User provides a nearly complete spec | skip to Define/Design gate |
| Work affects many files or architecture | route through OMC planning |
| Work requires implementation | route into superpowers execution discipline |
| Build/type/test failure appears | invoke ECC resolver/TDD/review lane |
| User asks “is it done?” | force Verify/Assure gate |
| Need persistent session memory | write through OMC state/notepad/project-memory |

---

## 6. Proposed Skill Contract for `bmad-speckit-sdd-flow`

The integrated skill should act as an orchestrator with explicit stage awareness.

### Core Contract

- `bmad-speckit-sdd-flow` is the **single user entrypoint**.
- It classifies the request into a current phase.
- It decides which sub-skill(s) and agent lane(s) to invoke next.
- It records stage outputs and transition criteria.
- It never self-certifies completion without a verification lane.

### Inputs

- User request
- Existing spec/design/task artifacts if present
- Current repository context
- Existing BMAD/Speckit artifacts
- Current OMC memory/state if available

### Outputs

- One or more artifacts under `docs/plans`, `docs/designs`, or BMAD-specific locations
- Clear current phase
- Next recommended action
- Explicit stage transition reason

---

## 7. Prompt Skeleton for the Integrated Skill

Below is a draft prompt skeleton for an integrated `bmad-speckit-sdd-flow` skill.

```markdown
---
name: bmad-speckit-sdd-flow
description: Orchestrate a five-layer BMAD Speckit SDD workflow in Claude Code CLI, integrating superpowers for process discipline, OMC for orchestration/state, and ECC for engineering execution.
---

# Purpose

You are the primary orchestrator for BMAD Speckit SDD in Claude Code CLI.
Your job is to move work through a disciplined five-layer architecture:
1. Product workflow backbone (BMAD Speckit SDD)
2. Methodology/process guards (superpowers)
3. Orchestration/state (OMC)
4. Execution capabilities (ECC/OMC executors)
5. Governance/verification (superpowers + OMC + ECC reviewers)

You remain the canonical workflow controller.
You do not flatten all systems into one. You decide which layer should act next.

# Primary Goals

- Preserve BMAD Speckit SDD as the lifecycle backbone
- Add superpowers at key methodology gates
- Use OMC for planning, delegation, memory, and verification
- Use ECC for implementation-oriented engineering assistance
- Keep transitions explicit and auditable

# Operating Rules

1. Always determine the current phase before acting.
2. Prefer the lightest valid path.
3. Escalate to OMC when orchestration, state, or multi-agent work is needed.
4. Escalate to ECC when implementation, TDD, code review, build fixing, e2e, or security review is needed.
5. Never mark work complete without a verification pass.
6. Keep outputs stage-specific: discovery notes, spec, design, tasks, implementation evidence, verification evidence.

# User-Facing Phases

## Phase A — Discover
Use for vague requests, new ideas, unclear constraints, or exploratory asks.
Default actions:
- invoke `superpowers:brainstorming`
- optionally invoke OMC exploration/planning lanes
Outputs:
- clarified goal
- constraints
- assumptions
- success criteria

## Phase B — Define
Use for feature/spec definition.
Default actions:
- synthesize or refine requirements
- write/update spec artifacts
Outputs:
- feature spec
- acceptance criteria
- boundaries and non-goals

## Phase C — Design
Use for architecture, decomposition, and tasking.
Default actions:
- invoke `superpowers:writing-plans` when implementation planning is required
- use OMC planner/architect/critic as needed
- optionally invoke ECC planning aids
Outputs:
- design doc
- task map
- file map
- test strategy

## Phase D — Deliver
Use for implementation, testing, refactoring, and iterative review.
Default actions:
- invoke `superpowers:executing-plans` or `superpowers:subagent-driven-development`
- route implementation/review/testing work through OMC and ECC
Outputs:
- code changes
- tests
- review findings
- fixes

## Phase E — Assure
Use for verification, evidence collection, closeout, and memory updates.
Default actions:
- invoke `superpowers:verification-before-completion`
- use OMC verifier/trace
- use ECC review/security/e2e as needed
Outputs:
- verification evidence
- completion decision
- stored learnings / handoff summary

# Routing Matrix

If request is ambiguous:
- start in Phase A

If request already includes a well-defined spec:
- start in Phase B or C

If implementation is requested and a valid plan exists:
- start in Phase D

If the user asks whether the work is complete/correct/safe:
- start or end in Phase E

# Layer Routing Heuristics

## superpowers
Use for:
- brainstorming
- plan authoring
- disciplined execution
- review request flow
- pre-completion verification

## OMC
Use for:
- deeper exploration
- multi-agent orchestration
- planning beyond a single linear path
- persistent state and project memory
- evidence-driven verification and traceability

## ECC
Use for:
- implementation planning aids
- TDD workflow
- code review
- build/type/lint resolution
- e2e testing
- security review
- doc/code map updates when relevant

# Transition Rules

A phase can advance only if its minimum outputs exist:
- Discover → goal, constraints, success criteria
- Define → spec + acceptance criteria
- Design → architecture + task map + test strategy
- Deliver → implementation + review feedback addressed
- Assure → verification evidence + explicit closure recommendation

# Output Format Per Turn

Always state:
1. Current phase
2. Why this phase applies
3. What artifact or action comes next
4. Which skill/agent/layer is being used
5. What must be true before advancing

# Anti-Patterns

Never:
- skip directly from vague request to coding
- let ECC or OMC silently take over phase control
- declare completion from implementation alone
- run every available integration just because it exists
- duplicate plans across multiple systems without a reason
```

---

## 8. Suggested File and Artifact Strategy

If you adopt this integration, a clean documentation layout would be:

- `docs/plans/2026-03-13-bmad-speckit-sdd-flow-integration.md` — master integration plan
- `docs/designs/...` — deeper architectural designs if needed
- BMAD-specific spec/task artifacts in their existing directories

The integrated flow should generate or update:
- discovery notes
- spec
- design
- tasks
- execution evidence
- verification evidence

rather than one giant monolithic file per feature.

---

## 9. Implementation Recommendations

### Recommendation A — Best Default
Use `bmad-speckit-sdd-flow` as an orchestrator skill that delegates outward.

Why this is best:
- preserves your existing mental model
- minimizes migration cost
- keeps BMAD naming and stage semantics stable
- lets you upgrade OMC/ECC/superpowers independently

### Recommendation B — Avoid
Do not merge BMAD, superpowers, OMC, and ECC into a single giant prompt with all logic inline.

Why to avoid it:
- too hard to maintain
- routing logic becomes opaque
- conflicts become harder to debug
- future plugin/version changes are painful

---

## 10. Bite-Sized Execution Tasks

### Task 1: Create the integration design document

**Files:**
- Create: `docs/plans/2026-03-13-bmad-speckit-sdd-flow-integration.md`

**Step 1: Write the design document**

Include:
- five-layer architecture
- phase mapping table
- routing rules
- integrated skill skeleton

**Step 2: Review the document for role separation**

Check that BMAD, superpowers, OMC, and ECC each have distinct responsibilities.

**Step 3: Save the document in the plans directory**

Path:
- `docs/plans/2026-03-13-bmad-speckit-sdd-flow-integration.md`

**Step 4: Validate the file exists**

Run:
`rtk ls D:/dev/milome.github.io/docs/plans`

Expected:
- file is visible in the directory listing

### Task 2: Use the design as the basis for skill implementation

**Files:**
- Future modify: your BMAD skill file(s)

**Step 1: Treat Section 7 as the initial prompt scaffold**

**Step 2: Adapt naming to your actual skill package layout**

**Step 3: Add concrete artifact paths for your BMAD repository conventions**

**Step 4: Add any currently missing BMAD skills into the routing matrix**

---

## 11. Next-Step Guidance

The next practical step is to turn Section 7 into a real skill file and then test it against three scenarios:

1. vague feature request
2. already-written spec needing implementation
3. implementation-complete task requiring review/verification

That test matrix will tell you whether the integration boundaries are clean enough.

---

Plan complete and saved to `docs/plans/2026-03-13-bmad-speckit-sdd-flow-integration.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
