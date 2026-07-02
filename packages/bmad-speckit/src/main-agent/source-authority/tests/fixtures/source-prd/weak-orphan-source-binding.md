# Requirements Contract Source PRD Template

## Source Metadata

```yaml
sourceDocument:
  id: REQ-WEAK-ORPHAN
  title: Weak orphan source binding
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
| FR-001 | The system must reject orphan refs. | Orphan closure is unsafe. | ACC-999 | Lint reports orphan ref. | ACC-999 CMD-999 TRACE-999 | PATH-999 |
