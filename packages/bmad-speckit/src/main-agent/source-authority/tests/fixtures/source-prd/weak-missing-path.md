# Requirements Contract Source PRD Template

## Source Metadata

```yaml
sourceDocument:
  id: REQ-WEAK-MISSING-PATH
  title: Weak missing path
  status: draft
  authoritativeImplementationSource: true
  sourceKind: requirements_contract_source_prd
classification:
  domain: requirements
authoring:
  implementationConfirmationStatus: draft
```

## Functional Requirements

| ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | The system must name target paths. | Path closure is required. | ACC-001 | Lint reports path gap. | ACC-001 CMD-001 TRACE-001 | missing target path |
