---
stepsCompleted: []
inputDocuments: []
workflowType: 'prd'
---

# Product Requirements Document - {{project_name}}

**Author:** {{user_name}}
**Date:** {{date}}

## P0 Journey Inventory

_List the minimum user journeys that must be runnable for this product to be considered real._

| Journey ID | Actor | Trigger | Business Completion State | Current Workaround | Priority |
|------------|-------|---------|---------------------------|--------------------|----------|
| J01 | [actor] | [trigger] | [observable business done] | [manual workaround / none] | P0 |

## Journey Evidence Contract

_Define how each P0 journey will be proven, not just described._

| Journey ID | Given | When | Then | Success Evidence | Smoke Path | Full E2E / Deferred Reason |
|------------|-------|------|------|------------------|------------|----------------------------|
| J01 | [starting state] | [action] | [expected outcome] | [metric / artifact / visible result] | [yes/no + path] | [test id / reason] |

## Actor-Permission-State Matrix

_Capture actor, permission, and state transitions that affect journey execution._

| Actor | Permission Boundary | Start State | End State | Notes |
|------|----------------------|-------------|-----------|-------|
| [actor] | [rbac / capability] | [state] | [state] | [notes] |

## Failure Matrix

_Document the failure triggers that would break the core journeys and what the user sees next._

| Journey ID | Failure Trigger | User-Visible Impact | Recovery Path | Owner |
|------------|-----------------|---------------------|---------------|-------|
| J01 | [trigger] | [impact] | [retry / fallback / support path] | [owner] |

## Core Business Invariants

_List the business truths that must hold across all implementations and future planning._

- INV-01: [business invariant]
- INV-02: [business invariant]

## Deferred Ambiguities

_Any unresolved ambiguity must be explicit and owned. Silence is not allowed._

| Ambiguity ID | Question | Why It Matters | Owner | Resolution Gate |
|--------------|----------|----------------|-------|-----------------|
| DA-01 | [open question] | [impact] | [owner] | [prd / architecture / readiness] |
