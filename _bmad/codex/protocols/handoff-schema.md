# Handoff Schema

This protocol defines stage-to-stage handoff data for Codex no-hooks and other BMAD-Speckit-SDD-Flow hosts.

## Required Fields

- `layer`: current layer identifier, for example `layer_4`.
- `stage`: current stage, for example `specify`, `plan`, `tasks`, `implement`, or `assure`.
- `artifactDocPath`: primary artifact path.
- `auditReportPath`: audit report path.
- `next_action`: recommended next action.
- `ready`: whether the handoff is ready for automatic continuation.
- `mainAgentNextAction`: compatibility summary for main-agent consumers.
- `mainAgentReady`: compatibility readiness flag for main-agent consumers.

## Main-Agent Control Boundary

Consumer users activate governance through `$bmad-speckit`, `/bmad-speckit`, or `bmad-speckit` in the active AI host session. `main-agent-orchestration inspect / dispatch-plan` is an internal control-plane action; npm / npx access is install validation, CI, debug, or no-skill fallback only.

Handoff fields are not a control source. Before choosing the next global branch, the main Agent must re-read controlled records and derive authority only from `requirement-record.json`, `currentMentalModel`, the six mental model chain, and controlled-ingest gate / audit / closeout / evidence records.

`orchestrationState`, `pendingPacket`, `continueDecision`, `mainAgentNextAction`, and `mainAgentReady` are projection, compatibility hint, or evidence only. They cannot bypass current hashes, current attempt checks, RequirementRecord authority, or the six mental model chain.

## Transition Rules

- `specify -> plan`: requires spec audit pass.
- `plan -> tasks`: requires plan audit pass.
- `tasks -> implement`: requires tasks audit pass.
- `implement -> assure`: requires implementation audit pass.

## Example

```yaml
layer: layer_4
stage: specify
artifactDocPath: specs/epic-1/story-1/spec.md
auditReportPath: reports/spec-audit.md
next_action: proceed_to_plan
ready: true
mainAgentNextAction: dispatch_implement
mainAgentReady: true
```
