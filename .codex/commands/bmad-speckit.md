---
name: bmad-speckit
description: 'Root governed runtime entry for BMAD-Speckit-SDD-Flow. Use $bmad-speckit, /bmad-speckit, or bmad-speckit to let this framework take governance control.'
---

# /bmad-speckit

`$bmad-speckit`, `/bmad-speckit`, and `bmad-speckit` are equivalent BMAD-Speckit-SDD-Flow governed runtime entry aliases.

## Activation

1. Load the `bmad-speckit` skill from `{project-root}/_bmad/skills/bmad-speckit/SKILL.md`.
2. Treat this as a root governed runtime entry for BMAD-Speckit-SDD-Flow, not as upstream BMAD Method `/bmad`.
3. Inspect current project runtime state via `_bmad-output/runtime/`, `_bmad/_config/bmads-runtime.yaml`, and the main-agent orchestration surface.
4. Route execution through `main-agent-orchestration` / `main-agent-unified-ingress` for the active host.
5. Use `bmads` / `bmad-speckit` for the BMAD-Speckit main-agent control plane.
6. Keep `bmad-help` as upstream BMAD Method workflow help, not as the root takeover alias.

## Trigger

- AI IDE command: `/bmad-speckit`
- Codex/Cursor/Claude skill syntax: `$bmad-speckit`
- Natural alias: `bmad-speckit`

Short aliases `$bmads`, `/bmads`, and `bmads` are equivalent and load the same governed runtime entry.
