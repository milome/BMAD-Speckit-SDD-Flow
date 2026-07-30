import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const { compileSourceCompositionPolicy } =
  require('../../packages/bmad-speckit/dist/utils/goal-contract/control-plane/source-composition-policy.js') as {
    compileSourceCompositionPolicy: (input: unknown) => Record<string, unknown>;
  };
const { hashControlPlaneValue } =
  require('../../packages/bmad-speckit/dist/utils/goal-contract/control-plane/canonical-hash.js') as {
    hashControlPlaneValue: (input: unknown) => string;
  };
import {
  compileRequirementsContractBcrComponentBinding,
  validateRequirementsContractBcrComponentBindingReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bcr-component-binding';

const hash = (character: string) => `sha256:${character.repeat(64)}`;
const requirementIds = ['BCR-C01', 'BCR-C02', 'BCR-C03', 'BCR-C04', 'BCR-C05', 'BCR-C06'];
const taskIds = [
  'BCR-T01',
  'BCR-T02',
  'BCR-T03',
  'BCR-T04',
  'BCR-T05',
  'BCR-T06',
  'BCR-T07',
  'BCR-T08',
];

function sourceCompositionPolicy() {
  const binding = {
    role: 'subordinate_component_specification',
    namespace: 'BCR',
    sourceArtifactId: 'bounded-code-reviewer-component-design',
    parentTaskRefs: ['J04'],
    requiredRequirementIds: [...requirementIds].reverse(),
    requiredTaskIds: [...taskIds].reverse(),
  };
  const requiredSubordinateBindings = [binding];
  const canonicalRequiredSubordinateBindings = [
    {
      ...binding,
      parentTaskRefs: [...binding.parentTaskRefs].sort(),
      requiredRequirementIds: [...binding.requiredRequirementIds].sort(),
      requiredTaskIds: [...binding.requiredTaskIds].sort(),
    },
  ];
  const authorityRecord = {
    authorityKind: 'imported_approved_contract',
    authoritySourceId: 'judge-role-separation-source-composition',
    declaredMode: 'composite_required',
    requiredSubordinateBindings,
    declaredRequiredBindingsHash: hashControlPlaneValue(canonicalRequiredSubordinateBindings),
    authorityEvidenceHash: hashControlPlaneValue({
      authoritySourceId: 'judge-role-separation-source-composition',
      mode: 'composite_required',
      requiredSubordinateBindings: canonicalRequiredSubordinateBindings,
    }),
  };
  return compileSourceCompositionPolicy({ authorityRecord });
}

function bindingInput() {
  const policy = sourceCompositionPolicy();
  const allIds = [...requirementIds, ...taskIds];
  return {
    sourceCompositionPolicy: policy,
    subordinateSource: {
      sourceArtifactId: 'bounded-code-reviewer-component-design',
      namespace: 'BCR',
      role: 'subordinate_component_specification',
      sourceHash: hash('a'),
      currentSourceHash: hash('a'),
      declaredSemanticDomains: ['reviewer_component'],
    },
    specSpanRegistry: {
      registryHash: hash('b'),
      sourceArtifactId: 'bounded-code-reviewer-component-design',
      coveredObligationIds: [...allIds].reverse(),
    },
    sourceObligationGraph: {
      graphHash: hash('c'),
      requirementIds: [...requirementIds].reverse(),
      taskIds: [...taskIds].reverse(),
      semanticObligationHashes: allIds.map((id) => hashControlPlaneValue({ id })),
    },
    namespaceOwnership: {
      ownershipHash: hash('d'),
      namespace: 'BCR',
      sourceArtifactId: 'bounded-code-reviewer-component-design',
      parentTaskRefs: ['J04'],
    },
    parentProjectionPolicy: {
      policyHash: hash('e'),
      parentRef: 'J04',
      projectionMode: 'hash_only',
    },
  };
}

describe('requirements contract BCR component authority binding', () => {
  it('derives all subordinate IDs from the compiled source composition policy', () => {
    const receipt = compileRequirementsContractBcrComponentBinding(bindingInput());

    expect(receipt.requiredRequirementIds).toEqual(requirementIds);
    expect(receipt.requiredTaskIds).toEqual(taskIds);
    expect(receipt.namespace).toBe('BCR');
    expect(receipt.parentTaskRefs).toEqual(['J04']);
    expect(receipt.decision).toBe('pass');
    expect(validateRequirementsContractBcrComponentBindingReceipt(receipt)).toBe(receipt);
  });

  it.each([
    ['missing-source', 'source_composition_subordinate_source_missing'],
    ['stale-source', 'source_composition_subordinate_source_stale'],
    ['missing-id', 'source_composition_required_id_missing'],
    ['duplicate', 'source_composition_semantic_obligation_duplicate'],
    ['scope-escape', 'source_composition_scope_escape'],
    ['namespace', 'source_composition_namespace_mismatch'],
    ['parent-ref', 'source_composition_parent_ref_mismatch'],
    ['downgrade', 'source_composition_downgrade_rejected'],
    ['forbidden-parent', 'source_composition_parent_semantics_forbidden'],
  ])('fails closed for %s with stable issue code', (kind, code) => {
    const input = bindingInput() as Record<string, any>;
    if (kind === 'missing-source') delete input.subordinateSource;
    if (kind === 'stale-source') {
      input.subordinateSource.currentSourceHash = hash('f');
    }
    if (kind === 'missing-id') {
      input.specSpanRegistry.coveredObligationIds =
        input.specSpanRegistry.coveredObligationIds.slice(1);
    }
    if (kind === 'duplicate') {
      input.sourceObligationGraph.semanticObligationHashes[1] =
        input.sourceObligationGraph.semanticObligationHashes[0];
    }
    if (kind === 'scope-escape') {
      input.sourceObligationGraph.taskIds.push('J04-T99');
    }
    if (kind === 'namespace') {
      input.namespaceOwnership.namespace = 'JUDGE';
    }
    if (kind === 'parent-ref') {
      input.namespaceOwnership.parentTaskRefs = ['J05'];
    }
    if (kind === 'downgrade') {
      input.sourceCompositionPolicy.mode = 'single_source';
    }
    if (kind === 'forbidden-parent') {
      input.subordinateSource.declaredSemanticDomains.push('final_acceptance_effective_pass');
    }

    expect(() => compileRequirementsContractBcrComponentBinding(input)).toThrow(code);
  });

  it('validates the package receipt schema and rejects receipt tampering', () => {
    const receipt = compileRequirementsContractBcrComponentBinding(bindingInput());
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-bcr-component-binding-receipt.schema.json'
        ),
        'utf8'
      )
    );

    expect(new Ajv2020({ strict: false }).compile(schema)(receipt)).toBe(true);
    expect(() =>
      validateRequirementsContractBcrComponentBindingReceipt({
        ...receipt,
        sourceCompositionPolicyHash: hash('0'),
      })
    ).toThrow('bcr_component_binding_receipt_hash_mismatch');
  });
});
