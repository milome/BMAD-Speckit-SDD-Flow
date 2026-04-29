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

## Preferred Main-Agent Surface

Interactive hosts should prefer the repo-native orchestration surface before consuming legacy handoff summaries:

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect
```

When dispatch is required, use:

```bash
npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan
```

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
