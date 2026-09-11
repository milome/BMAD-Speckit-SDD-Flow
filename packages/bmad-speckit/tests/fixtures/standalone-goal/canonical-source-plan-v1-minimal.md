# Canonical Source Plan v1 Minimal Fixture

This fixture is executable compiler input for the standalone Goal contract path. It is deliberately small, but it exercises the complete Source Plan v1 node vocabulary and binding model. Narrative headings and this paragraph are descriptive provenance only; fenced declarations are semantic authority.

## Contract And Metadata

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-NORM-001
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
goal: Compile one complete sparse and owner-bound Goal execution authority.
scope: [goal_source_normalization, standalone_compilation]
nonGoals: [execute_fixture_commands, invoke_authoring_judge, infer_owners_from_markdown]
declaredDomains: [NORM]
globalBindingsAllowed: true
globalAuthorityRefs: [NFR-NORM-001]
```

The standalone fixture intentionally has no `implementationConfirmation`. Confirmation remains mandatory only for confirmed Requirements entry routes.

## Requirement Owners

```standalone-source-plan-node
kind: REQ
id: REQ-NORM-001
aliases: [FIX-NORM-01]
title: Owner-bound canonical compilation
statement: The compiler MUST preserve declared semantic owners and compile only justified sparse relations.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
taskRefs: [TASK-NORM-001]
acceptanceRefs: [AC-NORM-001-S01]
```

```standalone-source-plan-node
kind: NFR
id: NFR-NORM-001
title: Linear graph growth
statement: Graph size MUST grow with declared nodes and relations rather than an implicit Cartesian product.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: global
globalAuthorityRef: NFR-NORM-001
taskRefs: [TASK-NORM-001]
acceptanceRefs: [AC-NORM-001-S01]
```

```standalone-source-plan-node
kind: NEG
id: NEG-NORM-001
title: Validation bypass prohibition
statement: When validation is required, the execution MUST NOT bypass its declared command or fabricate evidence.
normativeStrength: MUST
polarity: forbidden
applicability:
  mode: conditional
  condition: A required validation command or evidence gate applies to the selected work.
scope: local
prohibits: [bypass_required_validation, fabricate_validation_evidence]
acceptanceRefs: [AC-NORM-001-S01]
```

```standalone-source-plan-node
kind: OUT
id: OUT-NORM-001
aliases: [NOT-DONE-NORM-01]
title: Business execution excluded
statement: Running fixture commands against a consumer repository is excluded from this compiler validation fixture.
normativeStrength: MUST
polarity: excluded
applicability: { mode: always }
scope: local
projectionLabel: NOT DONE
```

## Execution And Acceptance

```standalone-source-plan-node
kind: TASK
id: TASK-NORM-001
aliases: [WORK-NORM-01]
title: Compile the canonical source graph
statement: Implement and verify canonical owner aggregation and sparse Goal execution compilation.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
acceptanceRefs: [AC-NORM-001-S01]
pathRefs: [PATH-NORM-001]
commandRefs: [CMD-NORM-001, CMD-NORM-002, CMD-NORM-003]
evidenceRefs: [EVD-NORM-001]
artifactRefs: [ART-NORM-001]
dependencyRefs: [DEP-NORM-001]
stopRefs: [STOP-NORM-001]
executionClass: executable_child
ownedProductionPaths: [packages/bmad-speckit/src/utils/goal-contract/source-plan]
steps:
  - Parse explicit typed nodes without promoting Markdown structure.
  - Resolve declared owners and typed references.
  - Compile and validate the sparse canonical graph.
```

```standalone-source-plan-node
kind: AC
id: AC-NORM-001-S01
aliases: [AC-20-S03]
title: Sparse owner aggregation scenario
statement: Canonical compilation retains the complete requirement context and emits only declared relations.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-NORM-001
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
taskRefs: [TASK-NORM-001]
commandRefs: [CMD-NORM-001]
evidenceRefs: [EVD-NORM-001]
predicate: The graph contains every declared node and relation exactly once and contains no inferred Cartesian edges.
given: A valid standalone-source-plan/v1 document with explicit owners and references.
when: The standalone Goal compiler normalizes and compiles the source.
then: The emitted authority preserves owner blocks, applicability, aliases, commands, and evidence bindings.
pass: All expected nodes and declared relations exist, and no undeclared relation exists.
fail: Any node is fragmented, orphaned, silently dropped, or connected by an undeclared relation.
blocked: Any typed reference is unresolved, ambiguous, or incompatible with its declared owner.
```

```standalone-source-plan-node
kind: PATH
id: PATH-NORM-001
title: Source Plan compiler module
statement: Limit production changes for this task to the declared Source Plan compiler module.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: AC-NORM-001-S01
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
taskRefs: [TASK-NORM-001]
path: packages/bmad-speckit/src/utils/goal-contract/source-plan
access: modify
```

## Verification And Boundaries

```standalone-source-plan-node
kind: CMD
id: CMD-NORM-001
title: Canonical fixture verification
statement: Run the focused canonical Source Plan fixture test.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-NORM-001
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
taskRefs: [TASK-NORM-001]
acceptanceRefs: [AC-NORM-001-S01]
evidenceRefs: [EVD-NORM-001]
commandDeclarationClass: executable_expression
command: node scripts/run-node-tests.cjs goal-contract-canonical-source-plan-minimal.test.js
workingDirectory: packages/bmad-speckit
passCriteria: The process exits zero and every positive and negative fixture assertion passes.
```

```standalone-source-plan-node
kind: CMD
id: CMD-NORM-002
title: Canonical fixture command set
statement: Resolve the reviewed command set to its declared executable member without inventing an invocation.
normativeStrength: MUST
polarity: descriptive
applicability: { mode: always }
scope: local
ownerRef: TASK-NORM-001
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
commandDeclarationClass: source_command_set
commandSetRefs: [CMD-NORM-001]
workingDirectory: packages/bmad-speckit
passCriteria: Every member resolves to one declared executable command and no synthetic command is emitted.
```

```standalone-source-plan-node
kind: CMD
id: CMD-NORM-003
title: Conditional acceptance-command selector
statement: Preserve a conditional command selection rule without inventing an executable invocation.
normativeStrength: MUST
polarity: descriptive
applicability: { mode: conditional, condition: Before each owned compatibility bypass is removed. }
scope: local
ownerRef: TASK-NORM-001
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
commandDeclarationClass: conditional_selector
selectionRule: Select the declared executable command for the acceptance scenario corresponding to the bypass being removed.
selectionTarget: corresponding_acceptance_command
workingDirectory: packages/bmad-speckit
passCriteria: Selection occurs only after the corresponding acceptance owner is known, and no synthetic command is emitted.
```

```standalone-source-plan-node
kind: EVD
id: EVD-NORM-001
title: Focused test evidence
statement: Record bounded test evidence for the canonical fixture acceptance gate.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: AC-NORM-001-S01
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
producerRef: CMD-NORM-001
consumerRefs: [AC-NORM-001-S01, TASK-NORM-001]
expectedFields: [exitCode, tests, pass, fail, logPath, logSha256]
assertion: exitCode is zero, fail is zero, and the evidence log hash matches its receipt.
```

```standalone-source-plan-node
kind: ART
id: ART-NORM-001
title: Canonical graph receipt
statement: Persist the canonical graph identity used by the acceptance evidence.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: CMD-NORM-001
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
producerRef: CMD-NORM-001
consumerRefs: [TASK-NORM-001]
path: .artifacts/goal-source-contract-normalization/phase3/canonical-minimal-graph.json
requiredFields: [schemaVersion, sourceHash, profileHash, canonicalGraphHash, nodeCount, relationCount]
```

```standalone-source-plan-node
kind: DEP
id: DEP-NORM-001
title: Frozen profile dependency
statement: Canonical compilation depends on the hash-verified standalone Source Plan profile.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-NORM-001
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
taskRefs: [TASK-NORM-001]
dependency: _bmad/shared/goal-contract/standalone-source-plan-profile.json
requiredState: The profile schema, self hash, template hash, and installed projections are valid and equal.
```

```standalone-source-plan-node
kind: STOP
id: STOP-NORM-001
title: Invalid source authority stop
statement: Stop compilation before authority emission when canonical ownership or reference integrity fails.
normativeStrength: MUST
polarity: required
applicability:
  mode: conditional
  condition: The linter reports any invalid, missing, ambiguous, or unauthorized semantic binding.
scope: local
ownerRef: AC-NORM-001-S01
requirementRefs: [REQ-NORM-001, NFR-NORM-001]
acceptanceRefs: [AC-NORM-001-S01]
trigger: source lint result has ok=false or issueCount greater than zero.
requiredState: No GoalExecutionIR, Goal projection, generation receipt, or partial authority has been emitted.
```

This fixture covers all canonical node kinds and every relation field in the v1 profile. The legacy aliases remain secondary identities, `NOT DONE` is an `OUT` projection, and the conditional prohibition and stop rule remain conditional rather than becoming unconditional execution tasks.
