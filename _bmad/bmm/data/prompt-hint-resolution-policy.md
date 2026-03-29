# Prompt Hint Resolution Policy

## Resolution Order

Governance must resolve routing context in this exact order:

1. `stage context`
2. `gate failure`
3. `artifact state`
4. `PromptRoutingHints`

## Allowed Influence

`PromptRoutingHints` may influence:

- entry routing when no failed gate exists yet
- adapter selection when multiple equivalent adapters exist under the same capability slot
- interaction style
- research policy preference when this does not conflict with blocker requirements

## Forbidden Influence

`PromptRoutingHints` may not influence:

- blocker ownership
- failed-check severity
- artifact-derived root target
- whether downstream continuation is allowed in the presence of a blocker

## Low-Confidence Rule

If `PromptRoutingHints.confidence = low`, governance should keep routing unchanged unless the hint expresses an explicit operational constraint such as:

- `do not browse`
- `ask before deciding`
- `minimal patch only`

Low-confidence hints must still be recorded in remediation metadata as `ignored` or `partially applied`.
