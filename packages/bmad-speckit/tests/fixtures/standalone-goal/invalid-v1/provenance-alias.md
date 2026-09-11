# Provenance ID used as semantic alias

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-107
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject provenance aliases.
scope: [lint]
nonGoals: []
globalBindingsAllowed: false
```

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-107
aliases: [SRC-INVALID-01]
title: Invalid provenance alias
statement: Provenance IDs MUST NOT become semantic aliases.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
```
