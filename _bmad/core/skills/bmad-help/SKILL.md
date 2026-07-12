---
name: bmad-help
description: 'Use only for explicit upstream BMAD workflow, method, agent, or catalog guidance. Do not use for generic next-step, continue, status, or what-now questions when an active RequirementRecord may exist; those route to bmads or bmad-speckit governed runtime. Derives flow, contextMaturity, complexity, and implementationReadinessStatus for read-only recommendations.'
---

Follow the instructions in ./workflow.md.

## Natural-Language Routing Boundary

Generic next-step, continue, status, or what-now requests are not standalone `bmad-help`
activation when an active RequirementRecord may exist. Route those requests to `bmads` /
`bmad-speckit` first so governed runtime state decides the next safe action. Use `bmad-help`
only when the user explicitly asks for upstream BMAD workflow, method, agent, or catalog
guidance, or when no governed runtime record exists.

## Required Response Behavior

This is an execution entry, not an explanation page. When the user invokes `$bmad-help`, `/bmad-help`, or `bmad-help`, do not stop after showing this skill file, showing `workflow.md`, or summarizing the workflow rules.

Required steps:

1. Render the BMAD Help page through the installed package runtime.
2. Return the renderer stdout to the user as the final answer, line-for-line.
3. Use the default budget unless the user explicitly requests `--budget full`, debug output, or another budget.

Default runtime command in consumer projects:

```powershell
npx --no-install bmad-speckit bmad-help
```

On Windows PowerShell, if `npx` resolves to a blocked PowerShell shim, use `npx.cmd --no-install bmad-speckit bmad-help`.

The default response must include the runtime page sections:

- Status Summary
- Runtime Cross-Entry
- Recommended Next Steps
- Upstream Workflow Guidance

Do not replace the runtime page with:

- The `<skill>...</skill>` block
- The raw `workflow.md` content
- A summary that omits the rendered page sections

Preserve the renderer's Markdown heading hierarchy exactly. Do not compress `##` or `###` sections into plain bullets, prose summaries, or a shorter section list.

Strict stdout passthrough is required for standalone entry invocations. The final answer must contain only the renderer stdout, with no agent-authored summary, translation, truncation, reordering, field deletion, code-span removal, or prose replacement. Preserve every section body, field, list item, code span, and line order emitted by the renderer.

If the renderer output is too long, do not summarize it yourself. Ask the user to explicitly rerun with `--budget compact`, `--budget route`, `--budget expanded`, or `--budget full`, or run the requested budget if the user already specified one.

The fixed execution template is:

1. Commentary: state that the runtime renderer will be executed.
2. Tool: run the package CLI renderer.
3. Final: paste the renderer stdout exactly.

Never replace rendered BMAD Help workflow sections with a prose summary. Never drop `Runtime Cross-Entry`, `Upstream Workflow Guidance`, `Official Execution Paths`, or `See also` when they are present in renderer stdout.
