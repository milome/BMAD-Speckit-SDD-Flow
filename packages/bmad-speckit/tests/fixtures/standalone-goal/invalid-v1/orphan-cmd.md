# Orphan command

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-104
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject orphan commands.
scope: [lint]
nonGoals: []
globalBindingsAllowed: false
```

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-104
title: Command ownership
statement: Commands MUST have a valid owner.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
```

```standalone-source-plan-node
kind: CMD
id: CMD-NORM-104
title: Missing task owner
statement: This command has no valid task owner.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-NORM-999
requirementRefs: [REQ-NORM-104]
command: node --version
workingDirectory: .
passCriteria: The process exits zero.
```
