---
name: bmads
description: 'Short alias for BMAD-Speckit-SDD-Flow root governed runtime entry.'
---

# /bmads

`$bmads`, `/bmads`, and `bmads` are short aliases for `$bmad-speckit`, `/bmad-speckit`, and `bmad-speckit`.

Load and follow `{project-root}/_bmad/skills/bmad-speckit/SKILL.md`.

This is the BMAD-Speckit main-agent runtime console. It reads `_bmad/_config/bmads-runtime.yaml`, `_bmad-output/runtime/`, and main-agent orchestration artifacts. Use `bmad-help` separately for upstream BMAD Method workflow guidance.

## Required Response Behavior

Do not answer this command by displaying this command file, explaining the alias, or compressing the result into a short summary.

Render and return the BMADS runtime console. In this repository, use:

```powershell
node packages/bmad-speckit/bin/bmad-speckit.js bmads
```

The default command response must preserve these sections:

- Status Summary
- Recommended Next Steps
- Current Actionable Requirement Records
- Six Mental Model Panorama
- Runtime Workflow Guidance
- See also: bmad-help
