TRACE-034 adds a source-defined subagent surface inventory gate.

Changed files:
- scripts/subagent-surface-inventory.ts
- tests/acceptance/subagent-surface-inventory.test.ts

Behavior:
- Parses subagentExecutionSurfaceRegistry from the confirmed implementationConfirmation source block.
- Scans scripts, hooks, agent publication surfaces, package sync, skills/workflows, BMM authoring agents, worktree/parallel surfaces, prompt packet surfaces, docs samples, and tests/fixtures.
- Requires every discovered row to be covered by registry mapping or explicitly excluded by an allowed reason code.
- Fails closed on unregistered execution surfaces, BMM workflow subagent markdown without registry mapping, control-flow surfaces without requiredEnvelope, stale scannerConfigHash rows, invalid exclusions, blocked rows, and renderer/test-owned authority attempts.
- Emits inventory only as evidence; controlled ingest records the pass decision through contractChecks.
