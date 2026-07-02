---
stepsCompleted: []
inputDocuments: []
workflowType: 'prd'
sourcePrdProjectionStatus: draft
---

# Product Requirements Document - {{project_name}}

**Author:** {{user_name}}
**Date:** {{date}}

## BMAD Discovery Layer

Capture original product intent, discovery notes, tradeoffs, journey narrative, rejected options, open questions, and elicitation evidence. This layer preserves business context and does not create requirement IDs by itself.

| ID | Discovery evidence | Source rationale | Projection target |
| --- | --- | --- | --- |
| DISC-001 | Describe the user problem and business context. | Explain why the capability matters. | FR/NFR/NEG/OUT/SC/UJ rows |

## Product Context

Describe the product capability, users, operational environment, existing system context, and business outcome. Requirements must be repeated with stable IDs in the source PRD projection sections below.

## Success Criteria

Use stable `SC-*` IDs.

| ID | Criterion | Verification |
| --- | --- | --- |
| SC-001 | Measurable product outcome. | Command, test, inspection, or evidence path. |

## In Scope

Use stable `SCOPE-*` IDs.

| ID | In-scope capability | Requirement refs |
| --- | --- | --- |
| SCOPE-001 | Capability that must be delivered. | FR/NFR/ADR/ACC refs |

## Out Of Scope

Use stable `OUT-*` IDs. `OUT-*` rows define boundaries and must not appear in `TRACE.covers`.

| ID | Forbidden scope | Boundary assertion | Evidence |
| --- | --- | --- | --- |
| OUT-001 | Capability that must not be built. | Negative boundary assertion. | ACC/E2E/CMD refs |

## User Journeys

Use stable `UJ-*` IDs.

| ID | Actor | Trigger | Required flow | Completion state |
| --- | --- | --- | --- | --- |
| UJ-001 | User or system actor. | WHEN condition. | THEN behavior sequence. | Observable final state. |

## Functional Requirements

Use stable `FR-*` IDs. Each row must provide a source rationale, acceptance link, per-MUST oracle, assertion source, and responsibility mapping.

| ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | The system must provide observable behavior. | Why this is required. | ACC/E2E refs | Independent oracle proving this MUST. | ACC/E2E/CMD/TRACE refs | Owner, target path, and artifact refs |

## Non-Functional Requirements

Use stable `NFR-*` IDs. Each row must be measurable, verifiable, and traceable.

| ID | Quality attribute | Requirement | Measurement | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| NFR-001 | Reliability, security, performance, compliance, or operability. | The system must meet a measurable constraint. | Threshold and evidence. | Independent oracle proving this MUST. | ACC/E2E/CMD/TRACE refs | Owner, target path, and artifact refs |

## Negative Requirements And Not Done Conditions

Use stable `NEG-*` IDs. These rows block false completion.

| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |
| --- | --- | --- | --- | --- | --- |
| NEG-001 | Work, output, shortcut, fallback, or partial proof that does not count as complete. | Behavior that must not be accepted as success. | Observable blocking condition. | FAIL refs | ACC/E2E/CMD refs |

## Architecture Decision Records

Use stable `ADR-*` IDs.

| ID | Decision | Requirement impact | Rejected alternatives |
| --- | --- | --- | --- |
| ADR-001 | Architecture or product decision. | FR/NFR/OUT refs | Explicitly rejected designs |

## Failure Matrix

Use stable `FAIL-*` IDs.

| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence |
| --- | --- | --- | --- | --- |
| FAIL-001 | Failure condition. | Fail-closed behavior, recovery behavior, or telemetry behavior. | NEG refs | ACC/E2E refs |

## Acceptance Evidence

Use stable `ACC-*` IDs.

| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| ACC-001 | Unit, integration, contract, migration, telemetry, parity, or manual evidence. | FR/NFR/NEG refs | Command and artifact path. | Independent pass/fail oracle. | Test file, command, and trace refs | Owner and artifact refs |

## Test And Verification Paths

Use stable `E2E-*` IDs for end-to-end suites and stable `CMD-*` IDs for command references.

| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E2E-001 | e2e | FR/NFR/NEG refs | Command. | Passing criteria. | Observable oracle for each covered MUST/NEG. | ACC/E2E/CMD/TRACE refs | Owner, runner, artifact refs, and failure owner | Test and target paths |
| CMD-001 | contract-validation | FR/NFR/NEG refs | Command. | Expected output or artifact. | Output oracle for each covered MUST/NEG. | ACC/E2E/CMD/TRACE refs | Owner, runner, artifact refs, and failure owner | Command target files |

## Trace Matrix Source

Use stable `TRACE-*` IDs. Each row must define an independent closure boundary; do not collapse all MUST rows into a single row.

| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TRACE-001 | One MUST-FR, MUST-NFR, or NEG closure boundary. | EVD refs | ACC/E2E refs | CMD refs | CMD refs | SEQ/FLOW/EDGEVIEW refs | ART refs | OUT/BOUNDARY refs | Independent oracle for this closure boundary. | Specific assertion that closes this row. | Owner, target path, artifact refs, and remediation owner |

## Implementation Path Map

Use stable `PATH-*` IDs.

| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PATH-001 | `repo-relative-path` | Component owner. | Specific implementation change. | FR/NFR/ADR/ACC refs | Independent oracle proving each mapped MUST. | ACC/E2E/CMD/TRACE refs | Owner, artifact refs, rollout owner, and rollback owner |

## Source Current State

Use stable `CUR-*` IDs.

| ID | Current behavior | Current owner or path | Current limitation | Evidence |
| --- | --- | --- | --- | --- |
| CUR-001 | Current user-visible behavior or control surface. | Current component, process, file, data store, or operator path. | Current limitation or unverified behavior. | Source evidence, code path, test, log, or user journey ref |

## Source Target State

Use stable `TGT-*` IDs.

| ID | Target behavior | Target owner or path | Required acceptance state | Evidence |
| --- | --- | --- | --- | --- |
| TGT-001 | Target user-visible behavior or control surface. | Target component, process, file, data store, or operator path. | Observable acceptance state that must be true. | ACC/E2E/CMD refs |

## Current Target Map

Use stable `CTM-*` IDs. Each row must bind `CUR-*` rows to `TGT-*` rows.

| ID | Current refs | Target refs | Transition or closure action | Migration invariant | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CTM-001 | CUR refs | TGT refs | Split, replace, migrate, preserve, deny, verify, or close action. | Invariant that must remain true during migration. | FR/NFR/ADR/ACC refs | Independent oracle proving current-to-target closure. | ACC/E2E/CMD/TRACE refs | Owner, target path, artifact refs, and recovery owner |

## Source PRD Instance Lint Handoff

Step 12 must run source PRD instance lint before marking `source_prd_draft_ready`. A failed lint result marks `source_prd_draft_blocked` and keeps the PRD available for staging repair. This document remains a PRD/source draft and does not become the final confirmation contract.
