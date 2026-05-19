# TRACE-011 Implementation Delta Summary

## Changed Files

- `scripts/main-agent-bmad-artifact-hardcut.ts`
- `tests/acceptance/main-agent-bmad-artifact-hardcut.test.ts`

## Behavior Delta

- Added a read-only BMAD artifact hardcut checker that validates BMAD native authoring paths, BMAD workflow recommendation sources, requirement-scoped runtime output boundaries, and `docs/reference/**` schema-only semantics.
- Added acceptance tests proving pass behavior for preserved BMAD authoring paths, block behavior for active legacy runtime evidence, block behavior for `docs/reference/**` completion evidence, and block behavior when BMAD workflow recommendation sources are missing.

## Negative Assertions

- Active `_bmad-output/runtime/gates/**`, `_bmad-output/runtime/context/**`, `_bmad-output/runtime/governance/**`, and `_bmad-output/runtime/bmad-help-five-layer/**` artifacts are blocked as new target-state outputs or pass evidence.
- `docs/reference/**` artifacts are blocked when marked as completion evidence instead of schema or contract definition inputs.
- Missing BMAD native `bmad-help` workflow sources block the hardcut report.
