# Requirements Contract Source PRD Template

This template creates a canonical PRD source document for `requirements-contract-authoring`.
It is the starter template for an authoritative implementation source document.
It is not the confirmation schema and does not replace `_bmad/skills/requirements-contract-authoring/references/contract-template.md`.

## Template Authority

Use this file when creating a PRD that must be transformed into an inline `implementationConfirmation` block during controlled authoring.
The finished PRD is the single authoritative implementation source document for its requirement set.
Generated sidecar contracts, amendment files, conversation-only prompts, and renderer repair artifacts are not authoritative requirement sources.

The authoring flow must keep these layers separate:

- This template defines the PRD source structure and requirement extraction boundary.
- `_bmad/skills/requirements-contract-authoring/references/contract-template.md` defines the internal confirmation schema/reference used by the skill.
- `_bmad-output/runtime/requirement-records/<recordId>/authoring/*` stores authoring artifacts, receipts, audits, packets, hashes, and promotion evidence.
- `dist/**` and installed `.codex/.cursor/.claude` skill copies are generated surfaces and are not edited as canonical source.

## Source Metadata

```yaml
sourceDocument:
  id: <REQ-ID>
  title: <product capability title>
  status: draft
  authoritativeImplementationSource: true
  sourceKind: requirements_contract_source_prd
  createdAt: <YYYY-MM-DD>
  updatedAt: <YYYY-MM-DD>
classification:
  domain: <domain>
  projectType: <bmad project type>
  projectSubtype: <product subtype>
authoring:
  implementationConfirmationStatus: draft
  confirmationLanguage: not_selected
  implementationReadiness: false
  userConfirmed: false
```

## Requirement Extraction Boundary

`requirements-contract-authoring` must project requirement IDs only from the requirement-bearing sections below.
Projection-supporting sections provide rationale, evidence, paths, views, state maps, commands, and trace mappings; they must not create new `MUST-*` rows.

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

Rules:

- `MUST-*` rows must be projected only from `FR-*` and `NFR-*` rows.
- `NEG-*` rows must be projected only from `Negative Requirements And Not Done Conditions`.
- `OUT-*` rows must be projected only from `Out Of Scope`.
- `TRACE-*` rows must map execution closure and must not be treated as requirement sources.
- `Success Criteria`, `In Scope`, `User Journeys`, `Architecture Decision Records`, `Failure Matrix`, `Acceptance Evidence`, `Test And Verification Paths`, `Implementation Path Map`, `Source Current State`, `Source Target State`, and `Current Target Map` must not create `MUST-*` rows.
- Requirement IDs must remain stable after authoring begins.
- Non-requirement-bearing sections must not create `MUST-*`, `NEG-*`, or `OUT-*` rows.
- Historical audit notes must live in a provenance file and must not be copied into requirement-bearing sections.
- Generated views must cite existing `implementationConfirmation` IDs and must not introduce new requirements.

## Requirement Projection Authority

This section defines the only valid source-to-confirmation projection policy for the PRD.
Authoring must fail closed when a generated or inline canonical `MUST-*` ID matches a denied pattern.

```yaml
requirementProjectionAuthority:
  mustSources:
    - section: Functional Requirements
      sourceIdPattern: "^FR-[0-9]{3}$"
      projectedIdPattern: "^MUST-FR-[0-9]{3}$"
    - section: Non-Functional Requirements
      sourceIdPattern: "^NFR-[0-9]{3}$"
      projectedIdPattern: "^MUST-NFR-[0-9]{3}$"
  negativeSources:
    - section: Negative Requirements And Not Done Conditions
      sourceIdPattern: "^NEG-[0-9]{3}$"
      projectedIdPattern: "^NEG-[0-9]{3}$"
  outOfScopeSources:
    - section: Out Of Scope
      sourceIdPattern: "^OUT-[0-9]{3}$"
      projectedIdPattern: "^OUT-[0-9]{3}$"
  projectionSupportingSections:
    - Success Criteria
    - In Scope
    - User Journeys
    - Architecture Decision Records
    - Failure Matrix
    - Acceptance Evidence
    - Test And Verification Paths
    - Implementation Path Map
    - Source Current State
    - Source Target State
    - Current Target Map
    - Trace Matrix Source
  traceRows:
    sourceSection: Trace Matrix Source
    coversAllowedPatterns:
      - "^MUST-FR-[0-9]{3}$"
      - "^MUST-NFR-[0-9]{3}$"
      - "^NEG-[0-9]{3}$"
    outOfScopeCoverForbidden: true
    requiredCommandRefFields:
      - contractValidationCommandRefs
      - deliveryEvidenceCommandRefs
  deniedCanonicalMustIdPatterns:
    - "^MUST-.*-L[0-9]+-[0-9]+$"
```

## Renderer Field Source Schema

This section defines the source schema for the rendered confirmation page.
Rendered confirmation fields must be generated from the `implementationConfirmation` fields below.
Each `implementationConfirmation` field must be generated from the listed source sections and stable IDs.
Renderer field repair must not create requirements, rewrite requirement meaning, or add uncited requirement-bearing prose.

```yaml
rendererFieldSourceSchema:
  renderedFields:
    canonicalMustList:
      implementationConfirmationField: must[]
      sourceSections:
        - Functional Requirements
        - Non-Functional Requirements
      sourceIdPatterns:
        - "^FR-[0-9]{3}$"
        - "^NFR-[0-9]{3}$"
      canonicalIdPatterns:
        - "^MUST-FR-[0-9]{3}$"
        - "^MUST-NFR-[0-9]{3}$"
      deniedCanonicalIdPatterns:
        - "^MUST-.*-L[0-9]+-[0-9]+$"
    notDoneAndNegativeConstraints:
      implementationConfirmationField: notDone[]
      sourceSections:
        - Negative Requirements And Not Done Conditions
      sourceIdPatterns:
        - "^NEG-[0-9]{3}$"
      canonicalIdPatterns:
        - "^NEG-[0-9]{3}$"
    outOfScopeBoundary:
      implementationConfirmationFields:
        - mustNot[]
        - outOfScope[]
        - requirementBoundary
      sourceSections:
        - Out Of Scope
      sourceIdPatterns:
        - "^OUT-[0-9]{3}$"
      traceCoversAllowed: false
    applicabilityDomains:
      implementationConfirmationField: applicability
      sourceSections:
        - Renderer Field Source Schema
        - Source Metadata
        - Requirement Projection Authority
      requirementCreationAllowed: false
    preConfirmationDrilldown:
      implementationConfirmationField: preConfirmationDrilldown
      sourceSections:
        - controlled authoring artifacts
        - semantic kernel
        - must_decomposition_packet
        - Critical Auditor receipts
      requirementCreationAllowed: false
    confirmationRender:
      implementationConfirmationField: confirmationRender
      sourceSections:
        - controlled renderer output
        - confirmation-render-report.json
      requirementCreationAllowed: false
    traceMatrix:
      implementationConfirmationField: traceRows[]
      sourceSections:
        - Trace Matrix Source
      requirementCreationAllowed: false
      coversAllowedPatterns:
        - "^MUST-FR-[0-9]{3}$"
        - "^MUST-NFR-[0-9]{3}$"
        - "^NEG-[0-9]{3}$"
    currentVsTargetMap:
      implementationConfirmationField: currentTargetMap
      sourceSections:
        - Source Current State
        - Source Target State
        - Current Target Map
      requirementCreationAllowed: false
    evidenceAndAcceptance:
      implementationConfirmationFields:
        - evidence[]
        - acceptanceTests[]
        - e2eSuites[]
      sourceSections:
        - Acceptance Evidence
        - Test And Verification Paths
      requirementCreationAllowed: false
    failureAndEdgeViews:
      implementationConfirmationFields:
        - failurePaths[]
        - edgeCases[]
      sourceSections:
        - Failure Matrix
        - User Journeys
      requirementCreationAllowed: false
    aiTddManifestProjection:
      implementationConfirmationField: aiTddContractExecutionManifestProjection
      sourceSections:
        - Test And Verification Paths
        - Trace Matrix Source
        - Implementation Path Map
      requirementCreationAllowed: false
    targetModificationPaths:
      implementationConfirmationField: targetModificationPaths
      sourceSections:
        - Implementation Path Map
        - Current Target Map
        - Test And Verification Paths
      requirementCreationAllowed: false
    requirementBoundary:
      implementationConfirmationField: requirementBoundary
      sourceSections:
        - In Scope
        - Out Of Scope
        - User Journeys
      requirementCreationAllowed: false
    artifactAutomationPlan:
      implementationConfirmationField: artifactAutomationPlan
      sourceSections:
        - Implementation Path Map
        - Acceptance Evidence
        - Test And Verification Paths
      requirementCreationAllowed: false
```

## Source-to-Contract Projection Map

This section is a projection contract for authoring. It is not the final confirmation schema.
The authoring flow must materialize the final inline confirmation block from `_bmad/skills/requirements-contract-authoring/references/contract-template.md`.
Every row below names the canonical `finalField` and the exact PRD source authority used to populate it.
If a required source section or source ID is missing, authoring must fail closed instead of inventing final contract data.

```yaml
sourceToContractProjectionMap:
  canonicalFields:
    - finalField: contractSchemaVersion
      sourceAuthority: contract-template.md
      projectionRule: "Use the canonical schema version from the internal contract template."
    - finalField: recordId
      sourceAuthority: Source Metadata
      projectionRule: "Project from sourceDocument.id."
    - finalField: requirementSetId
      sourceAuthority: Source Metadata
      projectionRule: "Project from sourceDocument.id unless an explicit requirement set ID is provided."
    - finalField: entryFlow
      sourceAuthority: Source Metadata
      projectionRule: "Project from the selected authoring entry flow."
    - finalField: contractAuthoringRequired
      sourceAuthority: Template Authority
      projectionRule: "Always true for this PRD source template."
    - finalField: confirmationLanguage
      sourceAuthority: Source Metadata
      projectionRule: "Project only from explicit user selection; do not infer from conversation language."
    - finalField: confirmationRender
      sourceAuthority: controlled renderer output
      projectionRule: "Populate only after HTML render writes current html, summary, report, and hashes."
    - finalField: preConfirmationDrilldown
      sourceAuthority: authoring artifacts
      projectionRule: "Populate from semantic kernel, must_decomposition_packet, Critical Auditor receipts, and reconciliation report."
    - finalField: applicability
      sourceAuthority: Renderer Field Source Schema
      projectionRule: "Declare every domain with applies and reasonCode; currentTargetMap and aiTddContractGate are mandatory."
    - finalField: must
      sourceAuthority: Functional Requirements; Non-Functional Requirements
      projectionRule: "Project FR/NFR rows into stable MUST rows only after decomposition."
    - finalField: notDone
      sourceAuthority: Negative Requirements And Not Done Conditions
      projectionRule: "Project NEG rows into notDone rows with negative assertion and blocker evidence."
    - finalField: mustNot
      sourceAuthority: Out Of Scope
      projectionRule: "Project OUT rows into explicit scope boundaries."
    - finalField: evidence
      sourceAuthority: Acceptance Evidence; Test And Verification Paths
      projectionRule: "Project EVD rows with oracle, command refs, artifact refs, and acceptance type."
    - finalField: acceptanceTests
      sourceAuthority: Acceptance Evidence
      projectionRule: "Project ACC rows with file, covers, traceRows, evidenceRefs, commandRefs, and oracle."
    - finalField: e2eSuites
      sourceAuthority: Test And Verification Paths
      projectionRule: "Project E2E rows with executable path, covers, traceRows, evidenceRefs, commandRefs, and oracle."
    - finalField: traceRows
      sourceAuthority: Trace Matrix Source
      projectionRule: "Create one independent row per MUST/NEG closure boundary; do not compress all MUST rows into one trace."
    - finalField: sequenceViews
      sourceAuthority: User Journeys; Failure Matrix
      projectionRule: "Project happy and failure sequence views with visualKind, scope, traceRows, evidenceRefs, and acceptanceRefs."
    - finalField: flowViews
      sourceAuthority: User Journeys; Current Target Map
      projectionRule: "Project state or flow diagrams with reciprocal trace refs."
    - finalField: edgeCaseViews
      sourceAuthority: Failure Matrix; User Journeys
      projectionRule: "Project edge views with failurePathRefs and edgeCaseRefs."
    - finalField: boundaryViews
      sourceAuthority: Out Of Scope; In Scope
      projectionRule: "Project scope boundary views without adding new requirements."
    - finalField: targetModificationPaths
      sourceAuthority: Implementation Path Map
      projectionRule: "Project explicit target paths, coverageRole, changeType, ownerModel, traceRefs, evidenceRefs, and artifactRefs."
    - finalField: requirementBoundary
      sourceAuthority: In Scope; Out Of Scope; User Journeys
      projectionRule: "Classify business and governance requirement IDs plus view and diagram refs."
    - finalField: currentTargetMap
      sourceAuthority: Source Current State; Source Target State; Current Target Map
      projectionRule: "Project closed_loop_current_target_map from dedicated source sections, never from keyword heuristics."
    - finalField: artifactAutomationPlan
      sourceAuthority: Implementation Path Map; Acceptance Evidence; Test And Verification Paths
      projectionRule: "Project every generated, changed, or evidence artifact with owner, producer, consumer, retention, risk, trace, and evidence refs."
    - finalField: aiTddContractExecutionManifestProjection
      sourceAuthority: Test And Verification Paths; Trace Matrix Source; Current Target Map; Implementation Path Map
      projectionRule: "Project renderer strict-mode manifest coverage for error cases, command targets, trace closure, canonical surfaces, legacy denial, closeout proof, and evidence trust."
  sourceProjectionRequiredFields:
    - contractSchemaVersion
    - recordId
    - requirementSetId
    - entryFlow
    - contractAuthoringRequired
    - confirmationLanguage
    - confirmationRender
    - preConfirmationDrilldown
    - applicability
    - must
    - notDone
    - mustNot
    - evidence
    - acceptanceTests
    - e2eSuites
    - traceRows
    - sequenceViews
    - flowViews
    - edgeCaseViews
    - boundaryViews
    - targetModificationPaths
    - requirementBoundary
    - currentTargetMap
    - artifactAutomationPlan
    - aiTddContractExecutionManifestProjection
  currentTargetMapProjectionSeed:
    requiredViewPacks:
      - currentTargetMap
    currentSectionHeadings: ["Source Current State"]
    targetSectionHeadings: ["Source Target State"]
    currentSummary: []
    targetSummary: []
    diffRows: []
```

## Non-Requirement-Bearing Provenance Reference

Historical validation reports, Red Team findings, Failure Mode Analysis findings, Self-Consistency findings, comments, and change logs are stored in `<source-document-stem>.provenance.md`.
That provenance file is not an implementation source document and does not participate in `MUST-*`, `NEG-*`, or `OUT-*` extraction.

## Product Context

Describe the product capability, business outcome, users, operational environment, and existing system context.
Do not place requirements in this section unless they are repeated with stable IDs in an allowlisted requirement-bearing section.

## Success Criteria

Use stable `SC-*` IDs.

| ID | Criterion | Verification |
| --- | --- | --- |
| SC-001 | <measurable product outcome> | <command, test, inspection, or evidence path> |

## In Scope

Use stable `SCOPE-*` IDs.

| ID | In-scope capability | Requirement refs |
| --- | --- | --- |
| SCOPE-001 | <capability that must be delivered> | <FR/NFR/ADR/ACC refs> |

## Out Of Scope

Use stable `OUT-*` IDs.

| ID | Forbidden scope | Boundary assertion | Evidence |
| --- | --- | --- | --- |
| OUT-001 | <capability that must not be built> | <negative boundary assertion> | <test, inspection, or command evidence> |

## User Journeys

Use stable `UJ-*` IDs.

| ID | Actor | Trigger | Required flow | Completion state |
| --- | --- | --- | --- | --- |
| UJ-001 | <user/system actor> | <WHEN condition> | <THEN behavior sequence> | <observable final state> |

## Functional Requirements

Use stable `FR-*` IDs.

| ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | The system must <observable behavior>. | <why this is required> | <ACC/E2E refs> | <independent oracle proving this MUST> | <ACC/E2E/CMD/TRACE refs> | <owner, target path, and artifact refs> |

## Non-Functional Requirements

Use stable `NFR-*` IDs.

| ID | Quality attribute | Requirement | Measurement | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| NFR-001 | <performance, reliability, security, compliance, operability> | The system must <measurable quality constraint>. | <threshold and evidence> | <independent oracle proving this MUST> | <ACC/E2E/CMD/TRACE refs> | <owner, target path, and artifact refs> |

## Negative Requirements And Not Done Conditions

Use stable `NEG-*` IDs.
Each row defines a forbidden completion claim, negative behavior assertion, and the exact evidence needed to block false completion.
These rows project to `implementationConfirmation.notDone[]`.

| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |
| --- | --- | --- | --- | --- | --- |
| NEG-001 | <work, output, shortcut, fallback, or partial proof that does not count as complete> | <behavior that must not be accepted as success> | <observable condition that blocks completion> | <FAIL refs> | <ACC/E2E/CMD refs> |

## Architecture Decision Records

Use stable `ADR-*` IDs.

| ID | Decision | Requirement impact | Rejected alternatives |
| --- | --- | --- | --- |
| ADR-001 | <architecture decision> | <FR/NFR/OUT refs> | <explicitly rejected designs> |

## Failure Matrix

Use stable `FAIL-*` IDs.

| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence |
| --- | --- | --- | --- | --- |
| FAIL-001 | <failure condition> | <fail-closed behavior, recovery behavior, telemetry behavior> | <NEG refs> | <ACC/E2E refs> |

## Acceptance Evidence

Use stable `ACC-*` IDs.

| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| ACC-001 | <unit, integration, contract, migration, telemetry, parity, or manual evidence> | <FR/NFR/NEG refs> | <command and artifact path> | <independent pass/fail oracle> | <test file, command, and trace refs> | <owner and artifact refs> |

## Test And Verification Paths

Use stable `E2E-*` IDs for end-to-end suites and stable `CMD-*` IDs for command references.

| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E2E-001 | e2e | <FR/NFR/NEG refs> | <command> | <passing criteria> | <observable oracle for each covered MUST/NEG> | <ACC/E2E/CMD/TRACE refs> | <owner, runner, artifact refs, and failure owner> | <test and target paths> |
| CMD-001 | contract-validation | <FR/NFR/NEG refs> | <command> | <expected output or artifact> | <output oracle for each covered MUST/NEG> | <ACC/E2E/CMD/TRACE refs> | <owner, runner, artifact refs, and failure owner> | <command target files> |

## Trace Matrix Source

Use stable `TRACE-*` IDs.
Trace rows are execution mappings, not requirement sources.
`covers` must contain only `MUST-FR-*`, `MUST-NFR-*`, and `NEG-*` IDs.
`OUT-*` IDs must be bound through boundary refs and evidence refs, not through `covers`.

| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TRACE-001 | <one MUST-FR/MUST-NFR/NEG closure boundary> | <EVD refs> | <ACC/E2E refs> | <CMD refs> | <CMD refs> | <SEQ/FLOW/EDGEVIEW refs> | <ART refs> | <OUT/BOUNDARY refs> | <independent oracle for this closure boundary> | <specific assertion that closes this row> | <owner, target path, artifact refs, and remediation owner> |

## Implementation Path Map

Use stable `PATH-*` IDs.

| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PATH-001 | `<repo-relative-path>` | <component owner> | <specific implementation change> | <FR/NFR/ADR/ACC refs> | <independent oracle proving each mapped MUST> | <ACC/E2E/CMD/TRACE refs> | <owner, artifact refs, rollout owner, and rollback owner> |

## Source Current State

Use stable `CUR-*` IDs.
Describe the current user-visible behavior, runtime ownership, data ownership, repository path, operational constraint, and evidence source before implementation.
This section is the authoritative source for `implementationConfirmation.currentTargetMap.sourceStateProjection.currentRows[]` and `implementationConfirmation.currentTargetMap.currentSummary[]`.

| ID | Current behavior | Current owner or path | Current limitation | Evidence |
| --- | --- | --- | --- | --- |
| CUR-001 | <current user-visible behavior or control surface> | <current component, process, file, data store, or operator path> | <current limitation, bottleneck, missing capability, or unverified behavior> | <source evidence, code path, test, log, or user journey ref> |

## Source Target State

Use stable `TGT-*` IDs.
Describe the final productized target behavior, runtime ownership, data ownership, repository path, acceptance state, and evidence source after all confirmed requirements are implemented.
This section is the authoritative source for `implementationConfirmation.currentTargetMap.sourceStateProjection.targetRows[]` and `implementationConfirmation.currentTargetMap.targetSummary[]`.

| ID | Target behavior | Target owner or path | Required acceptance state | Evidence |
| --- | --- | --- | --- | --- |
| TGT-001 | <target user-visible behavior or control surface> | <target component, process, file, data store, or operator path> | <observable acceptance state that must be true> | <ACC/E2E/CMD refs> |

## Current Target Map

Use stable `CTM-*` IDs.
Each row must bind one or more `CUR-*` rows to one or more `TGT-*` rows and state the exact transition invariant.
This section is the authoritative source for `implementationConfirmation.currentTargetMap.diffRows[]`, `process[]`, `artifactPaths[]`, `canonicalArtifacts[]`, `existingArtifacts[]`, and `pathRegistry[]`.

| ID | Current refs | Target refs | Transition or closure action | Migration invariant | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CTM-001 | <CUR refs> | <TGT refs> | <split, replace, migrate, preserve, deny, verify, or close action> | <invariant that must remain true during migration> | <FR/NFR/ADR/ACC refs> | <independent oracle proving each current-to-target closure> | <ACC/E2E/CMD/TRACE refs> | <owner, target path, artifact refs, and recovery owner> |

## Human-Readable ID-Bound Views

These views are generated from `implementationConfirmation` and must cite existing IDs.
They must not add new requirement-bearing statements.

Required views:

- Happy-path sequence view
- Failure-path sequence view
- State and flow view
- Edge-case view
- Evidence overview
- E2E acceptance overview
- Business and governance boundary view
- Artifact automation plan
- Current-vs-target map

## Revision History

This section is non-requirement-bearing.

| Date | Change | Author | Notes |
| --- | --- | --- | --- |
| <YYYY-MM-DD> | <change summary> | <author> | <non-requirement note> |

## Validation Provenance

This section is non-requirement-bearing.
Store detailed validation reports in `<source-document-stem>.provenance.md`.

## Audit Findings

This section is non-requirement-bearing.
Closed audit findings must be summarized here only as provenance pointers.

## Comments

This section is non-requirement-bearing.
Discussion comments must not be interpreted as requirements.

## Change Log

This section is non-requirement-bearing.
Change log entries must not be interpreted as requirements.
