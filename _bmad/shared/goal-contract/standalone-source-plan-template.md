# Standalone Source Plan v1 Template

This template is the canonical producer contract for standalone Goal compilation. Keep the fenced YAML field names and canonical IDs machine-valid. Human headings, explanatory prose, and section order may change; they are never the sole semantic authority. Do not add `implementationConfirmation` to a standalone Source Plan.

Confirmed six-state and req-trace sources retain their own `implementationConfirmation` syntax and admission gates; they do not copy this Markdown fence layout. After confirmation, their deterministic adapter must produce the same `CanonicalRequirementGraph/v1`, pass the same canonical graph lint rules defined by this profile, and use the same Goal Execution IR, closure, and projection compiler as this standalone source.

## Contract And Metadata

The single `standalone-source-plan` block declares Goal, Scope, Non-Goals, identity domains, purpose, and global-binding authority. Replace the example values without changing `sourcePlanVersion`, `intendedConsumer`, or `purpose`. A prohibition against `goal_contract_generation` conflicts with this purpose and is invalid.

```standalone-source-plan
sourcePlanVersion: standalone-source-plan/v1
sourcePlanId: PLAN-EXAMPLE-001
intendedConsumer: goal-execution-contract-generator
purpose: implementation_execution
sourceLanguage: en-US
repositoryIdentity: example/repository
declaredDomains: [EXAMPLE]
legacyAliasNamespaces: [FIX, WORK]
goal: Compile an owner-aware Goal execution contract.
scope:
  - Normalize explicit typed source nodes.
  - Preserve source-grounded bindings and conditions.
nonGoals:
  - Execute the generated Goal contract.
  - Treat headings or prose fragments as requirements.
globalBindingsAllowed: true
globalAuthorityRefs: [NFR-EXAMPLE-001]
```

Each semantic node uses one `standalone-source-plan-node` block. Root owners are `REQ`, `NFR`, `NEG`, or `OUT`. Every other node declares `ownerRef` and applicable `requirementRefs`. Use `scope: global` only with a `globalAuthorityRef` listed above; otherwise use `scope: local`.

## Requirement Owners

```standalone-source-plan-node
kind: REQ
id: REQ-EXAMPLE-001
title: Owner-aware compilation
statement: The compiler MUST aggregate typed child clauses under their declared owner.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
taskRefs: [TASK-EXAMPLE-001]
acceptanceRefs: [AC-EXAMPLE-001]
```

```standalone-source-plan-node
kind: NFR
id: NFR-EXAMPLE-001
title: Sparse relation growth
statement: The compiler MUST keep relation growth proportional to declared nodes and edges.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: global
globalAuthorityRef: NFR-EXAMPLE-001
taskRefs: [TASK-EXAMPLE-001]
acceptanceRefs: [AC-EXAMPLE-001]
```

```standalone-source-plan-node
kind: NEG
id: NEG-EXAMPLE-001
title: Test bypass prohibition
statement: The implementation MUST NOT bypass a required validation command.
normativeStrength: MUST
polarity: forbidden
applicability: { mode: always }
scope: local
prohibits: [required_validation_bypass]
acceptanceRefs: [AC-EXAMPLE-001]
```

```standalone-source-plan-node
kind: OUT
id: OUT-EXAMPLE-001
title: Business execution boundary
statement: Executing consumer business commands is outside this compilation scope.
normativeStrength: MUST
polarity: excluded
applicability: { mode: always }
scope: local
excludedActions: [consumer_business_execution]
```

`MUST`, `SHOULD`, and `MAY` are `normativeStrength` values, not ID prefixes. Render an `OUT-*` owner as `NOT DONE`; never create a `NOT-DONE-*` ID. Legacy identifiers belong in `aliases`, while `SRC-*`, `SPAN-*`, `source-block-*`, and `clause-*` remain provenance-only identities.

## Execution And Acceptance

```standalone-source-plan-node
kind: TASK
id: TASK-EXAMPLE-001
aliases: [WORK-EXAMPLE-01]
title: Implement owner-aware compilation
statement: Implement the typed normalization and sparse compilation path.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
requirementRefs: [REQ-EXAMPLE-001, NFR-EXAMPLE-001]
acceptanceRefs: [AC-EXAMPLE-001]
pathRefs: [PATH-EXAMPLE-001]
commandRefs: [CMD-EXAMPLE-001]
evidenceRefs: [EVD-EXAMPLE-001]
artifactRefs: [ART-EXAMPLE-001]
dependencyRefs: [DEP-EXAMPLE-001]
stopRefs: [STOP-EXAMPLE-001]
executionClass: executable_child
ownedProductionPaths: [packages/bmad-speckit/src/utils/goal-contract/source-plan]
steps:
  - Parse the typed source nodes.
  - Resolve owners and declared references.
  - Compile the sparse semantic graph.
```

```standalone-source-plan-node
kind: AC
id: AC-EXAMPLE-001
title: Typed ownership acceptance
statement: The compiled graph preserves every declared owner and applicable relation.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-EXAMPLE-001
requirementRefs: [REQ-EXAMPLE-001, NFR-EXAMPLE-001]
predicate: Every typed child resolves to its declared owner and no unrelated owner.
given: A valid standalone-source-plan/v1 document.
when: The standalone compiler normalizes and compiles the source.
then: The canonical graph and Goal IR contain only declared applicable relations.
pass: All owner and sparse-relation assertions pass.
fail: Any child is orphaned or bound to an unrelated owner.
blocked: Any referenced owner or required proof declaration is unresolved.
commandRefs: [CMD-EXAMPLE-001]
evidenceRefs: [EVD-EXAMPLE-001]
```

Scenario-specific acceptance may use `AC-EXAMPLE-001-S01`. Given, When, Then, PASS, FAIL, and BLOCKED stay fields of that one AC block and never become independent requirements.

## Verification And Boundaries

```standalone-source-plan-node
kind: PATH
id: PATH-EXAMPLE-001
title: Compiler source path
statement: Restrict implementation writes to the declared compiler module.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: global
globalAuthorityRef: NFR-EXAMPLE-001
ownerRef: TASK-EXAMPLE-001
requirementRefs: [REQ-EXAMPLE-001, NFR-EXAMPLE-001]
path: packages/example/src/compiler.ts
access: write
```

`PATH.ownerRef` may bind a production path to `REQ`, `NFR`, or `TASK`, and may bind an acceptance-specific test path to `AC`. The owner type carries semantic scope; path text and Markdown placement do not infer ownership.

```standalone-source-plan-node
kind: CMD
id: CMD-EXAMPLE-001
title: Focused compiler test
statement: Run the focused compiler test from the declared working directory.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-EXAMPLE-001
requirementRefs: [REQ-EXAMPLE-001, NFR-EXAMPLE-001]
acceptanceRefs: [AC-EXAMPLE-001]
commandDeclarationClass: executable_expression
command: node --test tests/compiler.test.js
workingDirectory: packages/example
passCriteria: The command exits with code zero and reports no failed test.
```

A source-declared command set uses `kind: CMD`, `commandDeclarationClass: source_command_set`, and non-empty `commandSetRefs`. It MUST omit `command`; the compiler resolves its members to executable declarations and MUST NOT manufacture a synthetic invocation.

A source-declared conditional command selector uses `kind: CMD`, `commandDeclarationClass: conditional_selector`, conditional `applicability`, and non-empty `selectionRule` plus `selectionTarget`. It MUST omit both `command` and `commandSetRefs`; the compiler preserves the selector and its owner relation but MUST NOT treat it as an executable command until the rule resolves against a concrete acceptance owner.

```standalone-source-plan-node
kind: EVD
id: EVD-EXAMPLE-001
title: Compiler test evidence
statement: Record the focused compiler test result for the owning acceptance criterion.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: AC-EXAMPLE-001
requirementRefs: [REQ-EXAMPLE-001, NFR-EXAMPLE-001]
producerRef: CMD-EXAMPLE-001
consumerRefs: [AC-EXAMPLE-001]
expectedFields: [command, exitCode, passed, failed]
```

```standalone-source-plan-node
kind: ART
id: ART-EXAMPLE-001
title: Canonical graph artifact
statement: Publish the canonical requirement graph as a hash-bound artifact.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-EXAMPLE-001
requirementRefs: [REQ-EXAMPLE-001]
producerRef: TASK-EXAMPLE-001
acceptanceRefs: [AC-EXAMPLE-001]
path: .artifacts/example/canonical-requirement-graph.json
requiredFields: [schemaVersion, nodes, relations, graphHash]
```

```standalone-source-plan-node
kind: DEP
id: DEP-EXAMPLE-001
title: YAML parser dependency
statement: The compiler requires the repository-provided YAML parser.
normativeStrength: MUST
polarity: required
applicability: { mode: always }
scope: local
ownerRef: TASK-EXAMPLE-001
requirementRefs: [REQ-EXAMPLE-001]
dependency: js-yaml
requiredState: Resolvable from the package dependency graph.
```

```standalone-source-plan-node
kind: STOP
id: STOP-EXAMPLE-001
title: Missing owner stop
statement: Stop compilation when a typed child has no unique semantic owner.
normativeStrength: MUST
polarity: required
applicability: { mode: conditional, condition: A typed child owner cannot be resolved uniquely. }
scope: local
ownerRef: TASK-EXAMPLE-001
requirementRefs: [REQ-EXAMPLE-001]
trigger: source_semantic_owner_missing
requiredState: No Goal authority or partial output is published.
```

All references are explicit and type-compatible. Do not use `*`, implicit adjacency, or a universal owner list. A global declaration is valid only when metadata permits it and `globalAuthorityRef` resolves to one of the declared `globalAuthorityRefs`.
