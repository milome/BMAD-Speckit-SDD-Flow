# Orphan acceptance criterion

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-103
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject orphan acceptance criteria.
scope: [lint]
nonGoals: []
globalBindingsAllowed: false
```

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-103
title: Acceptance ownership
statement: Acceptance criteria MUST have a valid owner.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
```

```standalone-source-plan-node
kind: AC
id: AC-NORM-103-S01
title: Missing task owner
statement: The acceptance criterion has no valid task owner.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-NORM-999
requirementRefs: [REQ-NORM-103]
predicate: The invalid owner is rejected.
```
