# Dangling typed reference

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-102
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject dangling references.
scope: [lint]
nonGoals: []
globalBindingsAllowed: false
```

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-102
title: Dangling task reference
statement: Every typed reference MUST resolve.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
taskRefs: [TASK-NORM-999]
```
