# Requirements Contract Source PRD Template

## Source Metadata

```yaml
sourceDocument:
  id: REQ-WEAK-MISSING-NEG
  title: Weak missing negative requirement
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
| FR-001 | The system must block weak inputs. | Prevent false readiness. | ACC-001 | Lint fails. | ACC-001 CMD-001 TRACE-001 | PATH-001 |
