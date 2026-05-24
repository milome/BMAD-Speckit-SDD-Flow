# E2E And Definition Of Done Rules

Use this reference when designing E2E acceptance tests and completion gates.

## Test Levels

| Level | Purpose | Counts As Acceptance? |
|---|---|---|
| Smoke | Startup, command exists, page renders, HTTP 200 | No |
| Integration | Module boundaries, real adapters, package wiring | Sometimes |
| Acceptance E2E | Full user journey with real entry and business oracle | Yes |
| Adversarial E2E | Failure, idempotency, recovery, concurrency | Yes |

## Smoke Tests That Must Not Count

Do not count a test as acceptance E2E if it only asserts:

- exit code is 0
- stdout contains `success`
- HTTP status is 200
- page renders
- a function was called
- a mock returned expected data
- the same production helper computed the expected value

## Acceptance E2E Requirements

Each acceptance E2E must specify:

- linked `MUST`, `NEG`, `OUT`, `EVD`, and `TRACE` IDs as applicable
- real user entry point
- precondition and setup
- trigger action
- independent oracle
- state or artifact assertions
- audit/trace assertions where relevant
- forbidden side effects
- cleanup strategy
- gate command

## Recommended E2E Set

For non-trivial orchestration or workflow features, require at least:

- one golden-path E2E
- one validation/config/permission failure E2E
- one idempotency or duplicate execution E2E
- one external failure or worker failure E2E
- one recovery/resume E2E
- one artifact/schema/audit evidence E2E

Add concurrency E2E when the feature uses shared state, locks, queues, dispatchers, workers, files, or external side effects.

## Definition Of Done

The DoD should say:

```text
Done means matrix closure with evidence, not code completion.

- All required `MUST`, `NEG`, `OUT`, `EVD`, and `TRACE` rows are PASS or explicitly non-blocking by confirmed scope.
- Every PASS row has test and verification evidence.
- GAPS are closed or explicitly accepted.
- E2E acceptance uses real entry points and independent oracles.
- Smoke tests are listed separately and do not count as acceptance.
- Core business logic is not mocked in acceptance E2E.
- No TODO, placeholder, fake success, stub, or mock-only path remains.
- Any scope reduction has an approved Scope Change Request.
```

## Completion Evidence Packet

Require this at closeout:

```markdown
## Completion Evidence Packet

### Matrix Closure

### Verification Commands

### E2E Evidence

### Artifacts And State Proof

### Negative/Recovery Proof

### Residual Risks

### Scope Changes
```
