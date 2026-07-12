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

Render and return the BMADS runtime console. In consumer projects, use:

```powershell
npx --no-install bmad-speckit bmads
```

On Windows PowerShell, if `npx` resolves to a blocked PowerShell shim, use `npx.cmd --no-install bmad-speckit bmads`.

Before the final render, inspect the primary RequirementRecord. When it is at `implementation_readiness=pass`, `nextSafeAction=dispatch-plan`, and the compiled packet is missing or unusable, automatically execute the controlled `dispatch-plan` with the exact inspected identities:

```text
main-agent-orchestration --action dispatch-plan --host <active-host> --record-id <primary.recordId> --requirement-set-id <primary.requirementSetId>
```

After compilation, validate `model_packet.json`, `human_prompt.txt`, `audit_receipt.json`, `goal_execution.md`, their hashes, packet authority, `ContractExecutionManifest`, and audit receipt, then re-render the BMADS runtime console. Do not ask the user to copy a suggested prompt. This transition must not execute `dispatch_implement` and must not start the implementation run loop. Fail closed on any blocker.

The default command response must preserve these sections:

- Status Summary
- Recommended Next Steps
- Current Actionable Requirement Records
- Six Mental Model Panorama
- Runtime Workflow Guidance
- See also: bmad-help
