# Auto-repair source materialization belongs to author-confirmation-ready-source

Status: accepted

Auto-repairing source materialization belongs to `author-confirmation-ready-source`, not the renderer and not consumer-project helper scripts. The authoring lane owns the repair registry, retry loop, receipts, and final Source Mutation Decision because it is the only stage that can safely combine source extraction, Target Authority, Validation Authority, coverage, and source-write gating.

## Considered Options

- `author-confirmation-ready-source` owns auto-repair and retries before Source Mutation Decision.
- `author-confirmation-ready-source` runs auto-repair by default and exposes `--no-auto-repair` only for diagnostics.
- `render-requirements-confirmation-html.ts` mutates source when it finds deterministic renderer blockers.
- Consumer projects create temporary generators to patch missing authoring output.

## Consequences

- The renderer MUST remain read-only for Implementation Source Documents and only report confirmability blockers.
- Consumer projects MUST NOT create temporary generators to compensate for upstream authoring gaps.
- `author-confirmation-ready-source` MUST own the deterministic repair registry and retry loop for auto-repairable generation defects.
- `author-confirmation-ready-source` MUST enable auto-repair by default.
- `author-confirmation-ready-source` MUST expose `--no-auto-repair` as a debugging override that surfaces deterministic generation defects without promoting source changes.
- The v2.1.10 repair registry MUST be implemented as a TypeScript typed map inside package source and MUST export a JSON receipt for auditability.
- External JSON, YAML, or consumer-project configuration MUST NOT decide repairability in v2.1.10; external declarative configuration is deferred until the registry schema is stable.
- Any renderer or materializer issue code that is missing from the repair registry MUST be normalized inside `author-confirmation-ready-source` to `repair_registry_unclassified_issue_code` and treated as an upstream runtime defect.
- Unclassified issue codes MUST NOT be passed through to consumer projects as raw blockers and MUST NOT default to `input_required`.
- When an unclassified issue code exists, `author-confirmation-ready-source` MUST stop only as an upstream package/runtime defect with a registry-update receipt; it is not consumer required input and must not be presented as a PRD, Target Authority, Validation Authority, or user confirmation problem.
- The auto-repair loop MUST NOT use an arbitrary fixed retry count as the success boundary; it must run until the generated requirement contract is confirmable or until deterministic no-progress evidence proves an upstream runtime defect.
- A non-convergent deterministic repair loop MUST NOT promote or hand off a partially generated requirement contract as consumer-ready output.
- Authority gaps remain non-fabricatable: Target Authority, Validation Authority, user confirmation, and source-hash safety must come from source-bound or explicit authority.
