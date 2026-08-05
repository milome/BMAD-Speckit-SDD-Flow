# Canonical Intent Control Plane Kernel Fixture

The shared fixture preserves the normative source ownership used by the goal-contract tests.

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
