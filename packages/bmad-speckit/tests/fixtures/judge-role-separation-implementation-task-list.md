# Judge Role Separation Implementation Task List

## J04

- JUDGE-C01: MUST preserve the primary implementation authority in JUDGE.
- JUDGE-T01: MUST compile the composite source authority deterministically.
- BCR-C01 through BCR-C06 remain subordinate BCR-owned requirements.
- BCR-T01 through BCR-T08 remain subordinate BCR-owned tasks.
- J04 is the parent task for the bounded code reviewer component.

## Completion Evidence

- The composite authority bundle MUST bind the primary and subordinate sources.
- The compiled source policy MUST fail closed on missing or stale subordinate input.

## Boundary

- JUDGE MUST NOT absorb BCR-owned requirements or tasks.
- BCR MUST NOT expand the Campaign or Final Judge authority.
