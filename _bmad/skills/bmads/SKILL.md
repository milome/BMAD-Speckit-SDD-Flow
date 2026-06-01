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
2. Return the renderer stdout to the user as the final answer, line-for-line.
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

Preserve the renderer's Markdown heading hierarchy exactly. Do not compress `##` or `###` sections into plain bullets, prose summaries, or a shorter section list.

Strict stdout passthrough is required for standalone entry invocations. The final answer must contain only the renderer stdout, with no agent-authored summary, translation, truncation, reordering, field deletion, code-span removal, or prose replacement. Preserve every section body, field, list item, code span, and line order emitted by the renderer.

If the renderer output is too long, do not summarize it yourself. Ask the user to explicitly rerun with `--budget compact`, `--budget route`, `--budget expanded`, or `--budget full`, or run the requested budget if the user already specified one.

The fixed execution template is:

1. Commentary: state that the runtime renderer will be executed.
2. Tool: run the package CLI renderer.
3. Final: paste the renderer stdout exactly.

Never replace the full `Six Mental Model Panorama` with a sentence such as "current position is 2/6". Never shorten `Current Actionable Requirement Records` to record IDs only.
