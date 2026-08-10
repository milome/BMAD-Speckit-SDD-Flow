# Judge Role Separation Implementation Task List

## J04

- JUDGE-C01: MUST preserve the primary implementation authority in JUDGE.
- JUDGE-T01: MUST compile the composite source authority deterministically.
- BCR-C01 through BCR-C06 remain subordinate BCR-owned requirements.
- BCR-T01 through BCR-T08 remain subordinate BCR-owned tasks.
- J04 is the parent task for the bounded code reviewer component.

## Task Dependency DAG

```text
J01-T01 -> J02-T01 -> J03-T01 -> J04-T01 -> J05-T01 -> J06-T01 -> J07-T01 -> J08-T01 -> J09-T01
```

### Task J01-T01: Establish Judge Role Authority

#### Files

- Create: `packages/fixture/judge/j01.ts`

### Task J02-T01: Bind Provider Runtime

#### Files

- Create: `packages/fixture/judge/j02.ts`

### Task J03-T01: Compile Requirements Assessment

#### Files

- Create: `packages/fixture/judge/j03.ts`

### Task J04-T01: Integrate BCR Parent Authority

#### Files

- Create: `packages/fixture/judge/j04.ts`

### Task J05-T01: Execute Judge Campaign

#### Files

- Create: `packages/fixture/judge/j05.ts`

### Task J06-T01: Integrate Main Agent Output

#### Files

- Create: `packages/fixture/judge/j06.ts`

### Task J07-T01: Publish Installed Surface

#### Files

- Create: `packages/fixture/judge/j07.ts`

### Task J08-T01: Verify Runtime Parity

#### Files

- Create: `packages/fixture/judge/j08.ts`

### Task J09-T01: Close Delivery Evidence

#### Files

- Create: `packages/fixture/judge/j09.ts`

## Completion Evidence

- EVD-JUDGE-01: Record the partition manifest and applicability receipt.
- The composite authority bundle MUST bind the primary and subordinate sources.
- The compiled source policy MUST fail closed on missing or stale subordinate input.

## Acceptance Criteria

- AC-JUDGE-01: The source partitions without requesting Sequence closure.

## Required Test Commands

- CMD-JUDGE-01: Run `node --version`.

## Boundary

- JUDGE MUST NOT absorb BCR-owned requirements or tasks.
- BCR MUST NOT expand the Campaign or Final Judge authority.
