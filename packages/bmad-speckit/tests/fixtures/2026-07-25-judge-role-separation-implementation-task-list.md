# Test Fixture: Judge Role Separation

This compact source-plan fixture is test data, not an active execution contract.
It mentions a review sequence as domain prose but does not request Sequence closure authority.

## Task Dependency DAG

```text
J01-T01 -> J02-T01 -> J03-T01 -> J04-T01 -> J05-T01 -> J06-T01 -> J07-T01 -> J08-T01 -> J09-T01
```

### Task J01-T01: Establish Judge Role Authority

**Dependencies:** none

#### Files

- Create: `packages/fixture/judge/j01.ts`

### Task J02-T01: Bind Provider Runtime

**Dependencies:** J01-T01

#### Files

- Create: `packages/fixture/judge/j02.ts`

### Task J03-T01: Compile Requirements Assessment

**Dependencies:** J02-T01

#### Files

- Create: `packages/fixture/judge/j03.ts`

### Task J04-T01: Integrate BCR Parent Authority

**Dependencies:** J03-T01

#### Files

- Create: `packages/fixture/judge/j04.ts`

### Task J05-T01: Execute Judge Campaign

**Dependencies:** J04-T01

#### Files

- Create: `packages/fixture/judge/j05.ts`

### Task J06-T01: Integrate Main Agent Output

**Dependencies:** J05-T01

#### Files

- Create: `packages/fixture/judge/j06.ts`

### Task J07-T01: Publish Installed Surface

**Dependencies:** J06-T01

#### Files

- Create: `packages/fixture/judge/j07.ts`

### Task J08-T01: Verify Runtime Parity

**Dependencies:** J07-T01

#### Files

- Create: `packages/fixture/judge/j08.ts`

### Task J09-T01: Close Delivery Evidence

**Dependencies:** J08-T01

#### Files

- Create: `packages/fixture/judge/j09.ts`

## Acceptance Criteria

- AC-JUDGE-01: The source partitions without requesting Sequence closure.

## Completion Evidence

- EVD-JUDGE-01: Record the partition manifest and applicability receipt.

## Required Test Commands

- CMD-JUDGE-01: Run `node --version`.
