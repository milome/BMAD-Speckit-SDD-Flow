# Canonical Intent Control Plane Kernel Fixture

The shared fixture preserves the normative source ownership used by the goal-contract tests.

## Task Dependency DAG

```text
CK01-T01 -> CK02-T01 -> CK03-T01 -> CK04-T01 -> CK05-T01 -> CK06-T01 -> CK07-T01 -> CK08-T01 -> CK09-T01 -> CK10-T01
```

### Task CK01-T01: Establish Canonical Authority

**Dependencies:** none

#### Files

- Create: `packages/fixture/kernel/authority.ts`

### Task CK02-T01: Compile Partition Runtime

**Dependencies:** CK01-T01

#### Files

- Create: `packages/fixture/kernel/partition.ts`

### Task CK03-T01: Compile Canonical Intent

**Dependencies:** CK02-T01

#### Files

- Create: `packages/fixture/kernel/intent.ts`

### Task CK04-T01: Compile Goal Contract

**Dependencies:** CK03-T01

#### Files

- Create: `packages/fixture/kernel/contract.ts`

### Task CK05-T01: Compile Execution Projection

**Dependencies:** CK04-T01

#### Files

- Create: `packages/fixture/kernel/projection.ts`

### Task CK06-T01: Freeze Partition Manifest

**Dependencies:** CK05-T01

#### Files

- Create: `packages/fixture/kernel/manifest.ts`

### Task CK07-T01: Activate Campaign

**Dependencies:** CK06-T01

#### Files

- Create: `packages/fixture/kernel/activation.ts`

### Task CK08-T01: Close Child Contracts

**Dependencies:** CK07-T01

#### Files

- Create: `packages/fixture/kernel/closure.ts`

### Task CK09-T01: Publish Kernel Facade

**Dependencies:** CK08-T01

#### Files

- Create: `packages/fixture/kernel/facade.ts`

### Task CK10-T01: Run Kernel Integration Gates

**Dependencies:** CK01-T01, CK02-T01, CK03-T01, CK04-T01, CK05-T01, CK06-T01, CK07-T01, CK08-T01, CK09-T01

#### Files

- Inspect: `packages/fixture/kernel/facade.ts`

#### Acceptance Criteria

- CK10-AC01: The terminal verification task owns no production files.
- CK10-AC02: The terminal task verifies the canonical authority output.
- CK10-AC03: The terminal task verifies the partition runtime output.
- CK10-AC04: The terminal task verifies the campaign lifecycle output.
- CK10-AC05: The terminal task verifies the package surface output.
- CK10-AC06: The terminal task verifies the final evidence output.

#### Completion Evidence

- CK10-EVD01: Record deterministic integration evidence.
- CK10-EVD02: Record canonical authority evidence.
- CK10-EVD03: Record partition runtime evidence.
- CK10-EVD04: Record campaign lifecycle evidence.
- CK10-EVD05: Record package surface evidence.
- CK10-EVD06: Record final closure evidence.

#### Required Test Commands

- CK10-CMD01: Run `node --version`.

```yaml
sourceCompositionPolicy:
  mode: composite_required
  policyAuthorityBinding:
    authorityKind: deterministic_source_authority_adapter
    authoritySourceId: judge-role-separation-source-authority
    declaredMode: composite_required
    declaredRequiredBindingsHash: sha256(canonical(requiredSubordinateBindings))
    authorityEvidenceHash: sha256(canonical(adapterAuthorityRecord))
  requiredSubordinateBindings:
    - role: subordinate_component_specification
      namespace: BCR
      sourceArtifactId: bounded-code-reviewer-component-design
      parentTaskRefs:
        - J04
      requiredRequirementIds:
        - BCR-C01
        - BCR-C02
        - BCR-C03
        - BCR-C04
        - BCR-C05
        - BCR-C06
      requiredTaskIds:
        - BCR-T01
        - BCR-T02
        - BCR-T03
        - BCR-T04
        - BCR-T05
        - BCR-T06
        - BCR-T07
        - BCR-T08

CompositeSourceAuthorityBundle:
  sourceCompositionPolicyHash: sha256(canonical(sourceCompositionPolicy))
  primarySource:
    role: primary_implementation_authority
    namespace: JUDGE
    sourceArtifactId: judge-role-separation-implementation-task-list
  subordinateSources:
    - role: subordinate_component_specification
      namespace: BCR
      sourceArtifactId: bounded-code-reviewer-component-design
      parentTaskRefs:
        - J04
      requiredRequirementIds:
        - BCR-C01
        - BCR-C02
        - BCR-C03
        - BCR-C04
        - BCR-C05
        - BCR-C06
      requiredTaskIds:
        - BCR-T01
        - BCR-T02
        - BCR-T03
        - BCR-T04
        - BCR-T05
        - BCR-T06
        - BCR-T07
        - BCR-T08
  conflictPolicy: fail_closed
```

## Required Test Commands

- CMD-KERNEL-01: Run `node --version`.
