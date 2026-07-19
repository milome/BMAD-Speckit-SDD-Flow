---
templateSchemaVersion: requirements-contract-product-prd/v1
artifactRole: product_prd
authority: product_background
workflowType: prd
productState: draft
stepsCompleted: []
discoveryEnvelopeRefs: []
inputDocuments: []
decisionRefs: []
---

# Product PRD Template

**Product:** {{project_name}}
**Owner:** {{user_name}}
**Date:** {{date}}

## Document Purpose

Use this template to turn resolved discovery context into a durable product and
domain brief. It records why the product matters, who it serves, the outcomes it
seeks, and the boundaries that shape later work.

This document owns product background only. It does not authorize implementation
behavior, readiness, tasks, code changes, test obligations, delivery state, or
completion claims. Any later implementation authoring begins as a separate
controlled workflow with its own identity and validation path.

## Authoring Boundary

Keep statements at the product, user, market, policy, and domain level.

- Describe user problems and desired outcomes without prescribing code structure.
- Describe product capabilities without turning them into executable work items.
- Record business constraints without assigning repository paths or commands.
- Keep unresolved decisions explicit rather than filling gaps with assumptions.
- Preserve links to discovery inputs instead of copying transcript material without
  context.
- Use plain product language that stakeholders can review independently of delivery
  planning.

Do not use this document to grant implementation authority or to declare that work
may start. Product approval means the background is suitable for the next workflow;
it does not approve a technical solution.

## Discovery Inputs

List the discovery envelopes and supporting documents used to prepare this product
brief. Every entry should be immutable or hash-bound so later reviewers can identify
the exact input without treating this document as a transcript store.

| Ref | Input kind | Location | Hash | Product use | State |
| --- | --- | --- | --- | --- | --- |
| DISC-001 | discovery envelope | `<repo-relative path or durable ref>` | `sha256:<hash>` | `<context carried into this brief>` | reviewed |
| INPUT-001 | supporting document | `<repo-relative path or durable ref>` | `sha256:<hash>` | `<product question informed>` | reviewed |

If an input is superseded, keep the old ref and record the replacement. Do not
silently rewrite lineage.

## Discovery Summary

Summarize the resolved product understanding from the referenced discovery work.
Keep unknowns visible.

### Established Context

- **Observed situation:** <what users or the business experience today>
- **Affected groups:** <users, customers, operators, partners, or regulators>
- **Material impact:** <cost, delay, risk, missed value, or unmet need>
- **Desired change:** <the user-visible or business-level improvement>
- **Timing context:** <why the product question matters now>

### Unresolved Product Questions

| Question ref | Question | Why it matters | Decision owner | Needed by | State |
| --- | --- | --- | --- | --- | --- |
| Q-001 | <open product question> | <impact of leaving it unresolved> | <owner> | <milestone or date> | open |

Unresolved questions remain open inputs. Do not invent a preferred answer to make
the document appear complete.

## Product Context

Describe the product area and domain in terms a stakeholder can understand without
repository knowledge.

| Context area | Current understanding | Origin refs | Confidence |
| --- | --- | --- | --- |
| Product or service | <what exists or is proposed> | <DISC/INPUT refs> | confirmed |
| Business model | <how value is created or protected> | <DISC/INPUT refs> | confirmed |
| Operating environment | <channels, regions, policies, or partner context> | <DISC/INPUT refs> | confirmed |
| Existing experience | <how users accomplish the goal today> | <DISC/INPUT refs> | confirmed |
| Domain vocabulary | <terms that need shared meaning> | <DISC/INPUT refs> | confirmed |

### Domain Terms

| Term | Product meaning | Common confusion | Origin refs |
| --- | --- | --- | --- |
| <term> | <meaning in this product> | <meaning to avoid> | <DISC/INPUT refs> |

## Problem And Opportunity

### Problem Statement

<Describe the user or business problem, the context in which it occurs, and the
consequence of leaving it unresolved. Focus on the problem rather than a preferred
technical solution.>

### Opportunity Statement

<Describe the improvement that becomes possible if the product addresses the
problem. State the value in user and business terms.>

### Product Signals

| Signal | Current observation | Desired direction | Origin refs |
| --- | --- | --- | --- |
| <user or business signal> | <baseline observation> | <increase, decrease, preserve, or learn> | <DISC/INPUT refs> |

## Users And Stakeholders

| Group | Primary need | Current difficulty | Desired product relationship | Influence |
| --- | --- | --- | --- | --- |
| <primary user> | <goal> | <friction or risk> | <how the product should help> | direct |
| <secondary stakeholder> | <goal> | <friction or risk> | <how the product should support them> | advisory |

Record material differences between groups instead of creating one generic user.

## User Journeys

Use product-level journey labels for discussion. These journeys communicate context
and desired experience; they are not executable specifications.

| Journey ref | Actor | Starting context | Desired progression | Product outcome | Open questions |
| --- | --- | --- | --- | --- | --- |
| PJ-001 | <actor> | <situation and trigger> | <experience from start to finish> | <user-visible result> | <Q refs or none> |

Include failure-prone, interrupted, and recovery-oriented experiences when they are
important to the product problem. Keep the description at the experience level.

## Product Vision

<State the durable product direction in one or two paragraphs. Describe the change
the product should create for its users and the business without naming a technical
design.>

### Product Principles

| Principle | Product meaning | Tradeoff guidance |
| --- | --- | --- |
| <principle> | <how the product should feel or behave at a high level> | <what to favor when choices conflict> |

Principles should help resolve product choices. Avoid slogans that cannot guide a
real decision.

## Product Outcomes

Product outcomes describe observable value. They do not prescribe implementation
tasks.

| Outcome ref | Desired outcome | Beneficiary | Indicator | Desired direction | Time horizon |
| --- | --- | --- | --- | --- | --- |
| PO-001 | <user or business outcome> | <group> | <measurable indicator> | <increase, decrease, preserve, or learn> | <period> |

Each outcome should connect to the problem statement and at least one user journey.
If the team cannot identify an indicator, record the learning gap under open
questions.

## Success Measures

Define how stakeholders will judge whether the product direction is producing
useful results. Measures may be quantitative or qualitative, but they must describe
the product or user state rather than internal work completion.

| Measure ref | Measure | Baseline | Desired level or direction | Review cadence | Owner |
| --- | --- | --- | --- | --- | --- |
| PM-001 | <product or user measure> | <known baseline or unknown> | <desired level or direction> | <cadence> | <owner> |

### Guardrail Measures

| Guardrail ref | Condition to preserve | Warning signal | Owner |
| --- | --- | --- | --- |
| PG-001 | <quality, trust, policy, or operational condition> | <observable warning signal> | <owner> |

Guardrails make product tradeoffs visible. They do not grant approval for a
technical approach.

## Product Scope

Define the product boundary in capability and experience terms.

### Included Product Areas

| Scope ref | Product area | Why included | Related outcomes | Related journeys |
| --- | --- | --- | --- | --- |
| PS-001 | <capability or experience area> | <product rationale> | <PO refs> | <PJ refs> |

### Explicit Product Exclusions

| Exclusion ref | Excluded area | Why excluded now | Revisit signal |
| --- | --- | --- | --- |
| PX-001 | <capability, market, channel, or experience not covered> | <product reason> | <condition that may reopen the decision> |

Exclusions are product boundaries, not implementation shortcuts. Record a decision
ref when an exclusion resolves a material stakeholder disagreement.

## Product Capabilities

Describe the capabilities the product concept needs from a user and business
perspective. Keep the entries solution-neutral.

| Capability ref | Capability | User value | Business value | Related outcomes | Dependencies | State |
| --- | --- | --- | --- | --- | --- | --- |
| PC-001 | <product capability> | <value to users> | <value to the business> | <PO refs> | <other capability, policy, or partner> | proposed |

Suggested capability states are `proposed`, `validated`, `deferred`, and `rejected`.
State changes should cite a product decision ref.

## Business Rules And Policies

Record domain rules that shape the product concept. Express the business meaning and
owner without translating the rule into code behavior.

| Rule ref | Business rule or policy | Applies to | Policy owner | Origin refs | Open interpretation |
| --- | --- | --- | --- | --- | --- |
| PBR-001 | <business rule or policy> | <users, regions, products, or situations> | <owner> | <DISC/INPUT refs> | <Q ref or none> |

When a rule is legally or contractually constrained, link the durable controlling
document rather than paraphrasing beyond the confirmed product interpretation.

## Product Constraints

| Constraint ref | Constraint | Product impact | Flexibility | Owner |
| --- | --- | --- | --- | --- |
| PCO-001 | <market, policy, partner, budget, timing, or operating constraint> | <how it shapes product choices> | fixed | <owner> |

Use `fixed`, `negotiable`, or `unknown` for flexibility. Unknown constraints remain
open questions.

## Assumptions And Dependencies

### Assumptions

| Assumption ref | Assumption | Product consequence if false | Validation owner | State |
| --- | --- | --- | --- | --- |
| PA-001 | <assumption about users, market, policy, or operations> | <impact> | <owner> | unvalidated |

### Dependencies

| Dependency ref | Dependency | Provider or owner | Product impact | Needed by | State |
| --- | --- | --- | --- | --- | --- |
| PD-001 | <partner, policy, data, capability, or organizational dependency> | <owner> | <impact if delayed or unavailable> | <milestone or date> | unknown |

## Alternatives And Tradeoffs

Document meaningful product alternatives that were considered during discovery.

| Alternative ref | Option | Product advantages | Product disadvantages | Decision state | Decision ref |
| --- | --- | --- | --- | --- | --- |
| ALT-001 | <product alternative> | <user or business advantages> | <user or business disadvantages> | under_review | <decision ref or none> |

Rejected alternatives remain useful context when they explain a product boundary.
Do not use this section to select a technical architecture.

## Risks And Open Questions

### Product Risks

| Risk ref | Product risk | Likelihood | Impact | Product response | Owner | State |
| --- | --- | --- | --- | --- | --- | --- |
| PR-001 | <user, market, policy, trust, partner, or operating risk> | <low, medium, high> | <low, medium, high> | <avoid, reduce, transfer, monitor, or learn> | <owner> | open |

### Open Questions

| Question ref | Question | Affected sections | Decision owner | Next discovery action | State |
| --- | --- | --- | --- | --- | --- |
| Q-001 | <open product question> | <section refs> | <owner> | <interview, analysis, policy review, or stakeholder decision> | open |

An open question may block product approval when its answer could materially change
the problem, audience, outcomes, scope, capability set, or governing policy.

## Product Decisions

Record decisions that resolve product ambiguity. A product decision owns only the
background and boundary described here.

| Decision ref | Decision | Alternatives considered | Decision owner | Date | Affected sections |
| --- | --- | --- | --- | --- | --- |
| PDEC-001 | <product decision> | <ALT refs or summary> | <owner> | <YYYY-MM-DD> | <section refs> |

If a decision changes, add a successor row and mark the earlier row superseded. Keep
the original entry for review history.

## Review Record

| Review ref | Reviewer | Review focus | Result | Open refs | Date |
| --- | --- | --- | --- | --- | --- |
| PREVIEW-001 | <stakeholder> | <problem, users, outcomes, scope, policy, or risk> | <approved, changes_requested, or advisory> | <Q/PR/PDEC refs> | <YYYY-MM-DD> |

Approval here confirms the product background is suitable for downstream use. It
does not approve technical design, implementation work, or delivery completion.

## Workflow Handoff

Before handing this document to a later workflow, confirm:

- `artifactRole` remains `product_prd`.
- `authority` remains `product_background`.
- Every discovery envelope and supporting input has a durable ref.
- Material product statements can be traced to discovery inputs or product
  decisions.
- Open questions, assumptions, dependencies, alternatives, and risks remain
  explicit.
- Product outcomes and scope are understandable without repository-specific
  language.
- No section grants implementation authority or declares delivery state.

A later requirements-authoring workflow may consume this document as product
background. That workflow must establish its own stable identity, intake lineage,
semantic model, validation path, and human approval before implementation can be
authorized.

Do not mutate this Product PRD into an implementation contract. Preserve it as the
reviewable product layer and create the downstream artifact through its registered
workflow.

## Change History

| Date | Change | Author | Affected sections | Notes |
| --- | --- | --- | --- | --- |
| <YYYY-MM-DD> | <product-background change> | <author> | <section refs> | <reason and decision refs> |
