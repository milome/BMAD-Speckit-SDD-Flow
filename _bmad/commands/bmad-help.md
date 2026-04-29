---
name: bmad-help
description: 'Get unstuck: show next workflow steps or answer BMad Method questions. Use when unsure what to do next.'
---

# /bmad-help

Load and execute the bmad-help skill to analyze current state and recommend next steps.

## Activation

1. **LOAD** the bmad-help skill from `{project-root}/_bmad/core/skills/bmad-help/SKILL.md`
2. **READ AND EXECUTE** `{project-root}/_bmad/core/tasks/help.md`
3. **FOLLOW** the routing and display instructions in `./workflow.md` (same directory as SKILL.md)
4. **LOAD** `{project-root}/_bmad/_config/bmad-help.csv`
5. Analyze real repository artifacts, runtime state, flow, contextMaturity, complexity, implementationReadinessStatus, module, phase, and artifacts before recommending next steps
6. The first user-visible result must preserve the recommendation labels `recommended / blocked`, and use `rerouteRequired` when the current flow must be upgraded instead of executed directly
7. Do **not** call `scripts/bmad-help-renderer.ts`; `/bmad-help` is an AI-host skill/task execution path, not a terminal renderer

## Trigger

- AI IDE Command: `/bmad-help`
- Natural language: "what should I do next", "what do I do now", or any BMad-related question
