# Duplicate canonical ID

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-101
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject duplicate IDs.
scope: [lint]
nonGoals: []
globalBindingsAllowed: false
```

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-101
title: First declaration
statement: The first declaration MUST remain unique.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
```

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-101
title: Duplicate declaration
statement: A duplicate declaration MUST be rejected.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
```
