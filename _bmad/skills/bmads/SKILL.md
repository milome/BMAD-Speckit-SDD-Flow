---
name: bmads
description: Short alias for bmad-speckit root governed runtime entry.
---

# BMADS Alias

`$bmads`, `/bmads`, and `bmads` are aliases for `$bmad-speckit`, `/bmad-speckit`, and `bmad-speckit`.

Load and follow `{project-root}/_bmad/skills/bmad-speckit/SKILL.md`.

## Required Response Behavior

This is an execution entry, not an explanation page. When the user invokes `$bmads`, do not stop after showing this skill file or summarizing the alias.

Required steps:

1. Render the BMADS runtime console through the installed package runtime.
2. Return the rendered console output to the user, preserving the default section structure.
3. Use the default budget unless the user explicitly requests `--budget full`, debug output, or another budget.

Default runtime command in this repository:

```powershell
node packages/bmad-speckit/bin/bmad-speckit.js bmads
```

The default response must include the runtime page sections:

- Status Summary
- Recommended Next Steps
- Current Actionable Requirement Records
- Six Mental Model Panorama
- Runtime Workflow Guidance
- See also: bmad-help

Do not replace the runtime page with:

- The `<skill>...</skill>` block
- A description of the alias
- A compressed summary of only recordId / current position / next safe action
