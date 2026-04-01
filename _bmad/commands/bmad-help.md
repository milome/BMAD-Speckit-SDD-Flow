---
name: bmad-help
description: 'Get unstuck: show next workflow steps or answer BMad Method questions. Use when unsure what to do next.'
---

# /bmad-help

Load and execute the bmad-help skill to analyze current state and recommend next steps.

## Activation

1. **LOAD** the bmad-help skill from `{project-root}/_bmad/core/skills/bmad-help/SKILL.md`
2. **FOLLOW** the instructions in `./workflow.md` (same directory as SKILL.md)
3. The workflow loads `{project-root}/_bmad/_config/bmad-help.csv` and presents recommendations based on module, phase, and artifacts

## Trigger

- AI IDE Command: `/bmad-help`
- Natural language: "what should I do next", "what do I do now", or any BMad-related question
