# Orphan evidence

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-105
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Reject orphan evidence.
scope: [lint]
nonGoals: []
globalBindingsAllowed: false
```

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-105
title: Evidence ownership
statement: Evidence MUST have a valid owner.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
```

```standalone-source-plan-node
kind: CMD
id: CMD-NORM-105
title: Valid evidence producer
statement: Produce evidence for the negative fixture.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: REQ-NORM-105
requirementRefs: [REQ-NORM-105]
command: node --version
workingDirectory: .
passCriteria: The process exits zero.
```

```standalone-source-plan-node
kind: EVD
id: EVD-NORM-105
title: Missing acceptance owner
statement: This evidence has no valid acceptance owner.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: AC-NORM-999-S01
requirementRefs: [REQ-NORM-105]
producerRef: CMD-NORM-105
expectedFields: [exitCode]
```
