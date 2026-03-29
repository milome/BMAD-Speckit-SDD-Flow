# Stage-Specific Exit Criteria

## brief-gate

Exit only when:
- `Known Unknowns` are explicitly logged
- blocker-level contradictions are either resolved or deferred
- the current brief section no longer has blocker-level empty contract fields

## prd-contract-gate

Exit only when:
- P0 journeys are concrete enough to map forward
- evidence wording is explicit enough to audit
- unresolved blockers are named and owned

## architecture-contract-gate

Exit only when:
- key path sequence is explicit
- business done vs system accepted is explicit
- smoke prerequisites and fallback expectations are not hand-wavy

## readiness-blocker-gate

Exit only when:
- blocker ownership is stable
- rerun target is named
- unresolved blockers and deferred risks are visible in the closing summary
