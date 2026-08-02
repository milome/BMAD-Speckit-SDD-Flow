---
templateSchemaVersion: requirements-contract-discovery-envelope/v1
artifactRole: discovery_envelope
authority: none
workflowType: prd
stepsCompleted: []
inputDocuments: []
discoveryState: in_progress
transcriptRefs: []
candidateRefs: []
openDecisionRefs: []
---

# Product Discovery Envelope - {{project_name}}

**Author:** {{user_name}}
**Date:** {{date}}

This envelope preserves non-authoritative discovery state. It cannot declare final
requirements, trace closure, implementation readiness, or delivery completion.

## Workflow Progress

Record workflow progress without treating a completed step as semantic authority.

| Step | State | Updated by | Evidence ref |
|---|---|---|---|
| discovery | not_started | none | none |

## Input References

Bind source documents and external inputs by stable reference. Do not copy them into
final requirement structures inside this envelope.

| Input ref | Type | Path or URI ref | Hash | Classification |
|---|---|---|---|---|
| INPUT-001 | user_input | pending | pending | unclassified |

## Discovery Transcript References

Preserve immutable session, turn, excerpt, and span references for later Intake
Receipt construction.

| Transcript ref | Session ref | Turn ref | Excerpt or span ref | Hash |
|---|---|---|---|---|
| TRANSCRIPT-001 | pending | pending | pending | pending |

## Semantic Candidate References

Candidates are hypotheses only. Resolver and Grill decisions are required before any
candidate can become an authorized semantic node.

| Candidate ref | Candidate type | Source refs | State | Decision receipt ref |
|---|---|---|---|---|
| CANDIDATE-001 | model_hypothesis | pending | unresolved | none |

## Open Decisions

Keep unresolved business decisions explicit and dependency ordered.

| Decision ref | Question | Blocking dependency | Owner | State |
|---|---|---|---|---|
| DECISION-001 | pending | none | user | unresolved |

## Discovery Notes

Capture product context, users, journeys, constraints, alternatives, and rejected
options as discovery evidence. These notes remain non-authoritative until promoted
through Intake, lineage, Resolver, Grill, validation, and registered rendering.

## Materialization Handoff

When discovery is complete, route this envelope through the registered artifact-role
classifier. Product documents use the Product PRD Renderer. Requirement source
documents require a stable requirement identity, Intake Receipt, Intent Lineage
Ledger, Semantic Conservation Manifest, Validation Facade, Canonical Renderer, Safe
Writer, readback, and registration. No template step or local edit may bypass that
chain.
