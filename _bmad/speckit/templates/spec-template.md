# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"
**Source Requirement Documents**: [original requirements doc / PRD / Epic-Story / design doc / user prompt / bootstrap brief]
**Specification Mode**: `STANDARD` or `GREENFIELD_BOOTSTRAP`

## Hard Rules *(mandatory)*

- `spec.md` MUST stay grounded in an explicit upstream requirements source. If no formal document exists, write `user prompt` or `bootstrap brief` explicitly instead of leaving the source implicit.
- User stories MUST be written as user-visible journeys / runnable slices, not technical modules or internal layer completion.
- Every user story MUST define a user-visible outcome and an independent test that can prove the slice delivers value on its own.
- Every chapter and requirement point from the upstream source MUST appear in the requirement mapping table below. Missing coverage is a blocker, not a warning.
- Any unresolved ambiguity that changes user-visible behavior, acceptance, permissions, data contract, or operational boundary MUST be marked `NEEDS CLARIFICATION`.
- If any `P0` or `P1` journey still depends on unresolved `NEEDS CLARIFICATION`, the spec is not ready to advance to planning.

## 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| §1 概述 | [Brief requirement summary] | User Story 1 / FR-001 / SC-001 | ✅ / ❌ |
| §2 [Section Name] | [Brief requirement summary] | User Story 2 / FR-00X / SC-00X | ✅ / ❌ |

**说明**：
- 原始需求文档的每一章、每一条须在 spec.md 中有明确对应并标注覆盖状态。
- 若为 `GREENFIELD_BOOTSTRAP`，原始文档章节可写为 `user prompt`、`bootstrap brief` 或等价输入来源，但不得留空。
- `❌` 状态必须在本轮补齐，或明确转入 `NEEDS CLARIFICATION` 并阻断进入 plan。

## Clarification Ledger

| Clarification ID | Source section | Open question | Blocking impact | Status |
|------------------|----------------|---------------|-----------------|--------|
| CL-001 | §[N] | [What is unclear?] | P0 / P1 / P2 / P3 | Open / Resolved |
| CL-002 | §[N] | [What is unclear?] | P0 / P1 / P2 / P3 | Open / Resolved |

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
  Every functional requirement MUST trace back to the mapping table above
  and MUST support at least one user-visible journey.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
  Every success criterion MUST validate user-visible completion,
  not merely internal module completion.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
