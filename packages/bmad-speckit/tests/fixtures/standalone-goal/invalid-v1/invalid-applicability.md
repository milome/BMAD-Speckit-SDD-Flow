# Invalid conditional applicability

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-106
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject incomplete conditions.
scope: [lint]
nonGoals: []
globalBindingsAllowed: false
```

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-106
title: Missing condition
statement: Conditional applicability MUST name its condition.
normativeStrength: MUST
polarity: required
applicability: { mode: conditional }
scope: local
```
