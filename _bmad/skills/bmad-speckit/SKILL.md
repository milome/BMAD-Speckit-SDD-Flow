---
name: bmad-speckit
description: 'Root governed runtime entry for BMAD-Speckit-SDD-Flow. Use for explicit aliases and natural-language next-step, continue, status, or what-now questions when an active RequirementRecord may exist, including 下一步, 继续, and 现在该做什么. This route has priority over bmad-help for governed runtime navigation.'
---

# BMAD-Speckit Governed Runtime Entry

`$bmad-speckit`, `/bmad-speckit`, and `bmad-speckit` are equivalent host-neutral entry aliases.

Short aliases `$bmads`, `/bmads`, and `bmads` load this same entry.

## Natural-Language Routing Priority

Treat generic requests such as `下一步？`, `继续`, `现在该做什么？`, `what next?`,
`continue`, and runtime status questions as this governed runtime entry whenever an active
RequirementRecord may exist. This priority applies before `bmad-help`; use `bmad-help`
only for explicit upstream BMAD workflow, method, agent, or catalog guidance.

## Required Response Behavior

This is an execution entry, not an explanation page. When the user invokes `$bmad-speckit`, `/bmad-speckit`, `bmad-speckit`, `$bmads`, `/bmads`, or `bmads`, do not stop after showing this skill file or summarizing the runtime contract.

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

When the inspected primary record has all of the following properties:

- `currentMentalModel=implementation_readiness`
- `implementation_readiness=pass`
- `nextSafeAction=dispatch-plan`
- the compiled packet is missing or unusable
- no safety blocker, stale confirmation, hash mismatch, reconfirmation, or blocking business decision is present

the Agent must automatically execute the controlled `dispatch-plan`. Do not ask the user to copy a suggested prompt or manually run the command.

Bind the action to the exact identities returned by the same inspect result:

```text
main-agent-orchestration --action dispatch-plan --host <active-host> --record-id <primary.recordId> --requirement-set-id <primary.requirementSetId>
```

Use the installed local runtime controller when available. The `npx --no-install bmad-speckit` prefix is allowed only as the package-local fallback.

After the action returns:

1. Re-inspect the same RequirementRecord.
2. Require all four synchronized artifacts to be usable: `model_packet.json`, `human_prompt.txt`, `audit_receipt.json`, and `goal_execution.md`.
3. Require current hashes, packet authority, `ContractExecutionManifest`, and audit receipt validation to pass.
4. Re-render the BMADS runtime console so the user sees the resulting `execution_closure` / `dispatch_implement` position.

This automatic transition compiles execution input only. It must not execute `dispatch_implement`, must not start the implementation run loop, must not invoke `/goal`, and must not write execution closure PASS.

If controlled dispatch-plan fails, fail closed. Preserve its bounded blocker evidence, re-render the unchanged safe route, and do not substitute a manually invented packet.

## User Activation

The normal consumer-project activation path is the user typing one of these aliases in the active AI host session:

```text
$bmad-speckit
/bmad-speckit
bmad-speckit
```

Do not ask the consumer user to run `npm run main-agent-orchestration` or `npx bmad-speckit main-agent-orchestration ...` as the default activation path.

CLI commands are allowed only for install validation, CI, debug, or a no-skill fallback host.

## Authority

This entry means: BMAD-Speckit-SDD-Flow takes root governed runtime authority for the current request.

Do not treat this as upstream BMAD Method `/bmad`. Do not register `$bmad` as an alias unless a user explicitly enables an upstream-compatible alias outside this default install.

## Runtime Contract

1. Inspect the project skeleton and `_bmad-output/runtime/` state.
2. Resolve the active host: Codex, Cursor, Claude, or another supported host.
3. Normalize the host entry into the `main-agent-orchestration` control plane through `main-agent-unified-ingress` or the installed equivalent runtime controller.
4. Resolve the active requirement from explicit `recordId` / `requirementSetId` / `runId`, or from `_bmad-output/runtime/requirement-records/index.json`.
5. Reload `_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json` before any global branch decision.
6. Drive the flow from `currentMentalModel` and the six user-facing mental models:
   `requirement_confirmation`, `architecture_confirmation`, `implementation_readiness`, `execution_closure`, `audit_review`, `delivery_confirmation`.
7. Treat `bmad-help` as BMAD workflow routing projection and read model only. It may explain BMAD recommended next steps, but it must not replace `requirement-record.json`, `currentMentalModel`, or controlled gate evidence.
8. For implementation work, issue bounded dispatch packets and require controlled TaskReport / evidence ingest.
9. Before claiming completion, require Delivery Closeout Gate evidence for the current closeout attempt. Quality, release, score, dashboard, SFT, hooks, and old reports are evidence or projections only.

## Agent Internal First Action

After user activation, the main Agent must internally run or emulate:

```text
main-agent-orchestration --action inspect --host <codex|cursor|claude>
```

This is an internal control action, not a consumer-user command. Use the installed local runtime controller when available. Use `npx` only as validation, CI, debug, or no-skill fallback.

## Continue Automation Entry

For users who want BMAD-Speckit to continue from existing BMAD artifacts into remaining governed stages, keep the user-facing entry as `$bmad-speckit`.

Do not route through `bmads-auto`. `bmads-auto` is quarantined as a deprecated implementation surface and may only be mined for ideas that are reimplemented under Main Agent authority.

Required internal Main Agent path:

1. Inspect the current control surface.
2. If the current control record is at passing implementation readiness and no usable packet exists, automatically materialize the bounded dispatch plan with the exact requirement-scoped `main-agent-orchestration --action dispatch-plan`.
3. Stop after packet compilation and re-inspection. Do not start `main-agent-orchestration --action run-loop` in the same implementation-readiness transition.
4. Re-read inspect after every child result, host closeout, rerun, or blocking event before deciding the next global branch.
5. Treat `mainAgentNextAction`, `mainAgentReady`, and old handoff summaries as compatibility hints only.
6. Require controlled ingest for TaskReport, execution evidence, audit evidence, gate checks, requirement closures, and closeout attempts.

Expected current-stage behavior:

- If requirement confirmation is missing, stale, or hash-mismatched, route to requirements contract authoring and confirmation before implementation.
- If architecture confirmation is required or stale, block implementation until active requirement-scoped architecture confirmation exists.
- If implementation readiness is stale or missing, block implementation dispatch until the controlled readiness gate passes.
- If execution, audit, or delivery evidence is incomplete, continue through `execution_closure`, `audit_review`, and `delivery_confirmation` without downgrading the six-model chain.
- Keep governed delivery gates named `main-agent:release-gate` and `main-agent:delivery-truth-gate`; these labels are current Main Agent gates, not deprecated `bmads-auto` surfaces.
