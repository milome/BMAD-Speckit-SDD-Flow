# Runtime Router

## Purpose

Route the user's "check implementation readiness" intent without taking ownership of the six mental model state machine.

## Route Labels

Use these shared labels consistently with `bmad-help`:

- `upstream_planning_readiness`
- `speckit_runtime_readiness`
- `readiness_help_projection`
- `governed_runtime_readiness_gate`
- `readiness_auto_remediation`

## Authority Boundary

This skill does not own `currentMentalModel`, controlled ingest, implementation readiness auto-remediation, or mental model progression.

Only `main_agent_orchestration` and controlled ingest may progress the six mental model chain.

This skill must not write `requirement-record.json`, dispatch remediation, or treat an upstream readiness report as a six mental model `implementation_readiness` PASS.

## Decision Matrix

`currentMentalModel=requirement_confirmation`
=> blocked: complete requirement confirmation first.

`currentMentalModel=architecture_confirmation`
=> blocked: complete architecture confirmation first.

`currentMentalModel=implementation_readiness`
=> use `governed_runtime_readiness_gate`.
=> if `nextAction=dispatch_remediation`, the main Agent may enter `readiness_auto_remediation`.
=> this skill must not run the upstream planning readiness workflow.

`currentMentalModel=execution_closure|audit_review|delivery_confirmation`
=> do not reopen implementation readiness unless controlled evidence says stale or a new blocker exists.

No `currentMentalModel` and no active requirement record
=> run `upstream_planning_readiness` through the upstream branch-scoped BMAD check-implementation-readiness workflow.

## Output Contract

Return one of:

- `recommended: upstream_planning_readiness`
- `recommended: speckit_runtime_readiness`
- `recommended: governed_runtime_readiness_gate`
- `blocked: requirement_confirmation_required`
- `blocked: architecture_confirmation_required`
- `blocked: runtime_state_invalid`
- `rerouteRequired: governed_runtime_main_agent`

## Upstream Workflow Fallback

Only load `../check-implementation-readiness/workflow.md` when no governed runtime state exists, or when the user explicitly asks for BMAD upstream planning artifact readiness.
