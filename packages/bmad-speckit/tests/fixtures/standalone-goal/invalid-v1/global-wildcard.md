# Unauthorized global wildcard

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-108
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject implicit global fan-out.
scope: [lint]
nonGoals: []
globalBindingsAllowed: true
globalAuthorityRefs: [NFR-NORM-108]
```

```standalone-source-plan-node
kind: NFR
id: NFR-NORM-108
title: Invalid wildcard fan-out
statement: Global authority MUST still use explicit typed bindings.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: global
globalAuthorityRef: NFR-NORM-108
taskRefs: ['*']
```
