# Governance Executor Routing Matrix

This file defines the canonical governance routing matrix for definition-stage remediation and routing decisions.

## Non-Negotiable Rules

- Governance resolves routing in this order: `stage context -> gate failure -> artifact state -> PromptRoutingHints`.
- `PromptRoutingHints` may influence `entry routing` and `adapter selection` only.
- `PromptRoutingHints` may not override blocker ownership, failed-check severity, or artifact-derived root target.
- `canonical agent` is repo-owned truth; `optional skill adapter` and `MCP adapter` are runtime bindings only.
- `fallback` may change execution surface, but must not change semantic ownership.

## Starter Matrix

| Failure Class | Capability Slot | Canonical Agent | Optional Skill Adapter | MCP Adapter | Fallback | Rerun Owner |
| --- | --- | --- | --- | --- | --- | --- |
| requirements-ambiguity | pm.discovery | PM / Analyst | host product-manager or analyst skill | none | guided elicitation / user clarification | PM |
| missing-market-evidence | research.market | Analyst / Web Researcher | host market-research skill | web/search MCP | grounded web research | PM |
| missing-technical-proof | research.technical | Technical Researcher | host architect / technical-research skill | docs/API MCP | primary-source web research | PM |
| brief-definition-gap | brief.challenge | PM + Critical Auditor | host PM + review skill | none | party-mode brief-gate round | PM |
| prd-contract-gap | prd.contract | PM + Critical Auditor | host PM + review skill | none | party-mode prd-contract-gate round | PM |
| architecture-contract-gap | architecture.contract | Architect + Critical Auditor | host architect + review skill | none | party-mode architecture-contract-gate round | PM |
| architecture-decision-conflict | architecture.challenge | Architect + Critical Auditor | host architect + review skill | optional official docs MCP | party-mode challenge round | PM |
| traceability-gap | qa.traceability | PM + QA / readiness reviewer | host QA or PO skill | none | local artifact audit | PM |
| e2e-acceptance-undefined | po.acceptance | PM / PO-style owner | host product-owner skill | optional domain research MCP | guided acceptance workshop | PM |
| dependency-semantics-unclear | research.dependency | Technical Researcher | host docs-lookup / architect skill | docs/API MCP | primary-doc web lookup | PM |
| regulator-or-standard-time-sensitive | research.compliance | Analyst / Technical Researcher | host analyst / compliance research skill | regulatory web MCP | official-site web research | PM |

## Prompt Hint Boundary

Use `PromptRoutingHints` only after the owning `failure class`, `capability slot`, and artifact-derived root target are known.

Allowed uses:

- choose initial entry path before any failed gate exists
- choose among equivalent adapters under one capability slot
- honor explicit user interaction constraints such as `ask before deciding` or `do not browse`

Forbidden uses:

- redefining the blocker owner
- changing the failed-check severity
- switching the root target artifact away from the artifact-derived owner
- continuing downstream when a blocker gate remains open
