# Goal generation purpose conflict

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-109
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject a contradiction of the authorized compiler purpose.
scope: [lint]
nonGoals: []
globalBindingsAllowed: false
```

```standalone-source-plan-node
kind: NEG
id: NEG-NORM-109
title: Invalid self-denial
statement: Goal contract generation is forbidden.
normativeStrength: MUST
polarity: forbidden
applicability: { mode: always }
scope: local
prohibits: [goal_contract_generation]
```
