# Audit Result Schema (Codex speckit format)

This protocol defines the structured audit report that Codex no-hooks workers and reviewers must produce. It is host-neutral and is consumed by BMAD-Speckit-SDD-Flow gates.

## Required Sections

### 1. Requirement Traceability

Map every original requirement, acceptance criterion, task, PRD reference, and architecture reference to concrete implementation or document evidence.

| Source | Requirement | Evidence | Result |
| --- | --- | --- | --- |
| Story | Example requirement | path/to/evidence | pass |

### 2. Ambiguity Review

Identify vague wording, undefined defaults, missing boundaries, and assumptions that could cause implementation drift.

| Location | Ambiguity | Risk | Required clarification |
| --- | --- | --- | --- |
| FR-001 | Example vague text | medium | Define exact behavior |

### 3. Omission And Boundary Review

Check whether edge cases, error paths, security constraints, persistence behavior, and non-goals are explicitly handled.

### 4. Audit Conclusion

The conclusion must be one of: `pass`, `fail`, or `blocked`. A pass requires traceability, no unresolved critical ambiguity, and all required evidence paths present.

## Machine-Readable Footer

Auditors should include a final JSON block when possible:

```json
{
  "schemaVersion": "audit-result/v1",
  "status": "pass",
  "evidence": [],
  "blockers": [],
  "nextAction": "proceed"
}
```
