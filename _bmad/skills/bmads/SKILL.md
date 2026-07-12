---
name: bmads
description: 'Short alias for the bmad-speckit governed runtime. Use for explicit aliases and natural-language next-step, continue, status, or what-now questions when an active RequirementRecord may exist, including 下一步, 继续, and 现在该做什么. This route has priority over bmad-help for governed runtime navigation.'
---

# BMADS Alias

`$bmads`, `/bmads`, and `bmads` are aliases for `$bmad-speckit`, `/bmad-speckit`, and `bmad-speckit`.

Load and follow `{project-root}/_bmad/skills/bmad-speckit/SKILL.md`.

## Natural-Language Routing Priority

Treat generic requests such as `下一步？`, `继续`, `现在该做什么？`, `what next?`,
`continue`, and runtime status questions as this governed runtime entry whenever an active
RequirementRecord may exist. This priority applies before `bmad-help`; use `bmad-help`
only for explicit upstream BMAD workflow, method, agent, or catalog guidance.

## Required Response Behavior

This is an execution entry, not an explanation page. When the user invokes `$bmads`, do not stop after showing this skill file or summarizing the alias.

Required steps:

1. Inspect the BMADS runtime state through the installed package runtime.
2. If the primary record is at `implementation_readiness=pass` and its compiled packet is missing or unusable, automatically execute the controlled `dispatch-plan` for that exact record.
3. Re-inspect state and re-render the BMADS runtime console after the controlled action finishes.
4. Return the final renderer stdout to the user as the final answer, line-for-line.
5. Use the default budget unless the user explicitly requests `--budget full`, debug output, or another budget.

Default runtime command in consumer projects:

```powershell
npx --no-install bmad-speckit bmads
```

On Windows PowerShell, if `npx` resolves to a blocked PowerShell shim, use `npx.cmd --no-install bmad-speckit bmads`.

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

1. Commentary: state that governed runtime inspection and any safe automatic transition will be executed.
2. Tool: run `bmads --json` or the equivalent internal inspect surface.
3. Tool: when and only when the automatic dispatch-plan conditions below pass, run the exact requirement-scoped controlled action.
4. Tool: re-render the BMADS runtime console.
5. Final: paste the renderer stdout exactly. This means the final renderer pass after any safe automatic transition.

Never replace the full `Six Mental Model Panorama` with a sentence such as "current position is 2/6". Never shorten `Current Actionable Requirement Records` to record IDs only.

## Automatic Dispatch-Plan Transition

When the inspected primary record has `currentMentalModel=implementation_readiness`, `implementation_readiness=pass`, `nextSafeAction=dispatch-plan`, and its compiled packet is missing or unusable, automatically execute the controlled `dispatch-plan` after confirming no safety blocker, stale hash, reconfirmation, or blocking business decision exists.

Bind the action to the exact identities returned by the same inspect result:

```text
main-agent-orchestration --action dispatch-plan --host <active-host> --record-id <primary.recordId> --requirement-set-id <primary.requirementSetId>
```

Do not ask the user to copy a suggested prompt. After the action, re-inspect the same RequirementRecord, validate `model_packet.json`, `human_prompt.txt`, `audit_receipt.json`, `goal_execution.md`, their hashes, packet authority, `ContractExecutionManifest`, and audit receipt, then re-render the BMADS runtime console.

This transition compiles execution input only. It must not execute `dispatch_implement`, must not start the implementation run loop, must not invoke `/goal`, and must not write execution closure PASS. If compilation fails, fail closed and preserve bounded blocker evidence.
