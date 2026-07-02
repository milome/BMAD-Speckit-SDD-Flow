# Requirements Contract Source PRD Template

This source PRD is a golden instance for source PRD lint. It is the starter template for an authoritative implementation source document. It is not the confirmation schema and does not replace `_bmad/skills/requirements-contract-authoring/references/contract-template.md`.

## Template Authority

This file is a source PRD instance. `_bmad/skills/requirements-contract-authoring/references/contract-template.md` defines the internal confirmation schema/reference used by the skill.

## Source Metadata

```yaml
sourceDocument:
  id: REQ-SOURCE-PRD-LINT
  title: Source PRD lint capability
  status: draft
  authoritativeImplementationSource: true
  sourceKind: requirements_contract_source_prd
classification:
  domain: requirements
  projectType: bmad-speckit
authoring:
  implementationConfirmationStatus: draft
  confirmationLanguage: en
  implementationReadiness: false
```

## Requirement Extraction Boundary

Allowlisted requirement-bearing sections:

- `Functional Requirements`
- `Non-Functional Requirements`
- `Negative Requirements And Not Done Conditions`
- `Out Of Scope`

Projection-supporting sections:

- `Success Criteria`
- `In Scope`
- `User Journeys`
- `Architecture Decision Records`
- `Failure Matrix`
- `Acceptance Evidence`
- `Test And Verification Paths`
- `Implementation Path Map`
- `Source Current State`
- `Source Target State`
- `Current Target Map`
- `Trace Matrix Source`

Non-requirement-bearing sections:

- `Template Authority`
- `Source Metadata`
- `Requirement Extraction Boundary`
- `Requirement Projection Authority`
- `Renderer Field Source Schema`
- `Source-to-Contract Projection Map`
- `Non-Requirement-Bearing Provenance Reference`
- `Revision History`
- `Validation Provenance`
- `Audit Findings`
- `Comments`
- `Change Log`

## Requirement Projection Authority

```yaml
requirementProjectionAuthority:
  mustSources:
    - section: Functional Requirements
      projectedIdPattern: "^MUST-FR-[0-9]{3}$"
    - section: Non-Functional Requirements
      projectedIdPattern: "^MUST-NFR-[0-9]{3}$"
  projectionSupportingSections:
    - Success Criteria
  deniedCanonicalMustIdPatterns:
    - "^MUST-.*-L[0-9]+-[0-9]+$"
```

## Renderer Field Source Schema

```yaml
rendererFieldSourceSchema:
  renderedFields:
    canonicalMustList: { requirementCreationAllowed: false }
    applicabilityDomains: { requirementCreationAllowed: false }
    preConfirmationDrilldown: { requirementCreationAllowed: false }
    confirmationRender: { requirementCreationAllowed: false }
```

## Non-Requirement-Bearing Provenance Reference

Provenance is stored outside requirement-bearing sections.

## Product Context

The capability validates source PRD instances before requirements-contract authoring.

## Success Criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| SC-001 | Valid source PRDs become source_prd_draft_ready. | ACC-001 |

## In Scope

| ID | In-scope capability | Requirement refs |
| --- | --- | --- |
| SCOPE-001 | Source PRD lint. | FR-001 NFR-001 |

## Out Of Scope

| ID | Forbidden scope | Boundary assertion | Evidence |
| --- | --- | --- | --- |
| OUT-001 | Treating draft readiness as confirmation readiness. | Draft readiness never promotes implementation state. | ACC-004 |

## User Journeys

| ID | Actor | Trigger | Required flow | Completion state |
| --- | --- | --- | --- | --- |
| UJ-001 | Authoring user | Source PRD is submitted. | Lint runs, reports closure, and blocks weak inputs. | source_prd_draft_ready or blocked |

## Functional Requirements

| ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | The system must validate source PRD closure before authoring readiness. | Prevent weak confirmation input. | ACC-001 E2E-001 | CLI reports source_prd_draft_ready only for complete input. | ACC-001 CMD-001 TRACE-001 | PATH-001 owns CLI and lint evidence |

## Non-Functional Requirements

| ID | Quality attribute | Requirement | Measurement | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| NFR-001 | Auditability | The system must preserve traceable evidence for lint decisions. | JSON report lists issues and counts. | Report contains exact status and issue list. | ACC-002 CMD-002 TRACE-002 | PATH-001 owns report output |

## Negative Requirements And Not Done Conditions

| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |
| --- | --- | --- | --- | --- | --- |
| NEG-001 | A weak source PRD must not be marked ready. | Missing required closure is not success. | Lint issues are present. | FAIL-001 | ACC-003 CMD-003 |

## Architecture Decision Records

| ID | Decision | Requirement impact | Rejected alternatives |
| --- | --- | --- | --- |
| ADR-001 | Use a shared registry for source PRD lint rules. | FR-001 NFR-001 | Local duplicated lint constants |

## Failure Matrix

| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence |
| --- | --- | --- | --- | --- |
| FAIL-001 | Missing NEG or PATH rows. | Fail closed with source_prd_draft_blocked. | NEG-001 | ACC-003 |

## Acceptance Evidence

| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| ACC-001 | Ready status | MUST-FR-001 | CMD-001 JSON output | source_prd_draft_ready appears only on full pass. | CMD-001 TRACE-001 | PATH-001 |
| ACC-002 | Audit report | MUST-NFR-001 | CMD-002 JSON output | Report includes issues and counts. | CMD-002 TRACE-002 | PATH-001 |
| ACC-003 | Weak input blocking | NEG-001 | CMD-003 JSON output | source_prd_draft_blocked appears for weak input. | CMD-003 TRACE-003 | PATH-001 |
| ACC-004 | Scope boundary | OUT-001 | Manual inspection | Draft readiness is not confirmation readiness. | CMD-001 TRACE-004 | PATH-001 |

## Test And Verification Paths

| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E2E-001 | e2e | MUST-FR-001 MUST-NFR-001 NEG-001 | npx vitest run source-prd-instance-lint | Exit code 0 | Full pass and weak fail fixtures are both asserted. | ACC-001 ACC-002 ACC-003 TRACE-001 | lint owner | packages/bmad-speckit/src/main-agent/source-authority/scripts/lint-requirements-contract-source-prd.ts |
| CMD-001 | contract-validation | MUST-FR-001 | lint golden source PRD | status source_prd_draft_ready | Ready only for complete source. | ACC-001 TRACE-001 | lint owner | packages/bmad-speckit/src/main-agent/source-authority/tests/fixtures/source-prd/golden-source-prd.md |
| CMD-002 | contract-validation | MUST-NFR-001 | lint JSON report | report contains counts | JSON evidence exists. | ACC-002 TRACE-002 | lint owner | packages/bmad-speckit/src/main-agent/source-authority/scripts/lint-requirements-contract-source-prd.ts |
| CMD-003 | contract-validation | NEG-001 | lint weak source PRD | status source_prd_draft_blocked | Weak source is blocked. | ACC-003 TRACE-003 | lint owner | packages/bmad-speckit/src/main-agent/source-authority/tests/fixtures/source-prd/weak-missing-neg.md |

## Trace Matrix Source

| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | UJ-001 | PATH-001 | OUT-001 | Ready status proves FR closure. | FR closure is independent. | PATH-001 owner |
| TRACE-002 | MUST-NFR-001 | ACC-002 | ACC-002 E2E-001 | CMD-002 | CMD-002 | UJ-001 | PATH-001 | OUT-001 | Report proves NFR closure. | NFR closure is independent. | PATH-001 owner |
| TRACE-003 | NEG-001 | ACC-003 | ACC-003 E2E-001 | CMD-003 | CMD-003 | UJ-001 | PATH-001 | OUT-001 | Blocked status proves NEG closure. | NEG closure is independent. | PATH-001 owner |
| TRACE-004 | MUST-FR-001 | ACC-004 | ACC-004 | CMD-001 | CMD-001 | UJ-001 | PATH-001 | OUT-001 | Boundary inspection proves scope. | Boundary closure is independent. | PATH-001 owner |

## Implementation Path Map

| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PATH-001 | `packages/bmad-speckit/src/main-agent/source-authority/scripts/lint-requirements-contract-source-prd.ts` | source-authority | Validate source PRD instance readiness. | FR-001 NFR-001 NEG-001 | CLI pass and fail outputs prove closure. | ACC-001 ACC-002 ACC-003 TRACE-001 | lint owner and authoring owner |

## Source Current State

| ID | Current behavior | Current owner or path | Current limitation | Evidence |
| --- | --- | --- | --- | --- |
| CUR-001 | Template lint validates only the starter template. | source-authority template lint | Real source PRD instances can be weak. | ACC-003 |

## Source Target State

| ID | Target behavior | Target owner or path | Required acceptance state | Evidence |
| --- | --- | --- | --- | --- |
| TGT-001 | Instance lint validates real source PRD readiness. | source-authority instance lint | ACC-001 ACC-002 ACC-003 pass. | CMD-001 CMD-002 CMD-003 |

## Current Target Map

| ID | Current refs | Target refs | Transition or closure action | Migration invariant | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CTM-001 | CUR-001 | TGT-001 | Add instance lint before authoring readiness. | Draft readiness remains below confirmation readiness. | FR-001 NFR-001 | CMD-001 proves transition. | ACC-001 TRACE-001 | PATH-001 |

## Source-to-Contract Projection Map

```yaml
sourceToContractProjectionMap:
  canonicalFields:
    - finalField: contractSchemaVersion
    - finalField: recordId
    - finalField: requirementSetId
    - finalField: entryFlow
    - finalField: contractAuthoringRequired
    - finalField: confirmationLanguage
    - finalField: confirmationRender
    - finalField: preConfirmationDrilldown
    - finalField: applicability
    - finalField: must
    - finalField: notDone
    - finalField: mustNot
    - finalField: evidence
    - finalField: acceptanceTests
    - finalField: e2eSuites
    - finalField: traceRows
    - finalField: sequenceViews
    - finalField: flowViews
    - finalField: edgeCaseViews
    - finalField: boundaryViews
    - finalField: targetModificationPaths
    - finalField: requirementBoundary
    - finalField: currentTargetMap
    - finalField: artifactAutomationPlan
    - finalField: aiTddContractExecutionManifestProjection
```

## Human-Readable ID-Bound Views

- Happy-path sequence view
- Failure-path sequence view
- State and flow view
- Edge-case view
- Evidence overview
- E2E acceptance overview
- Business and governance boundary view
- Artifact automation plan
- Current-vs-target map

The aiTddContractExecutionManifestProjection is sourced from CMD and TRACE rows.

## Revision History

| Date | Change | Author | Notes |
| --- | --- | --- | --- |
| 2026-07-03 | Initial golden fixture | Codex | Non-requirement note |

## Validation Provenance

Stored in provenance files.

## Audit Findings

No open findings.

## Comments

No requirement-bearing comments.

## Change Log

No requirement-bearing change log entries.
