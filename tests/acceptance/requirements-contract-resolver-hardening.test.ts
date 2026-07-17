import { describe, expect, it } from 'vitest';
import {
  applySemanticFieldValue,
  resolveSemanticField,
  semanticFieldRefsOverlap,
  sha256Text,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  resolveInteractionCandidates,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-interaction-resolver';

function sourcePremise() {
  const content = 'fixture source';
  return {
    kind: 'source' as const,
    sourcePath: 'fixtures/source.txt',
    sourceSpan: { startLine: 1, endLine: 1 },
    excerpt: content,
    hash: sha256Text(content),
  };
}

function interactionCandidate(premise: unknown) {
  return {
    interactionKind: 'step',
    resolutionId: 'fixture-resolution',
    fieldRef: 'steps',
    value: { order: 1, text: 'fixture step' },
    semanticKind: 'sequence_step',
    resolutionAuthorityClass: 'source_extracted',
    premises: [premise],
    derivationRule: null,
    applicabilityProof: null,
    conflictingCandidates: [],
    decisionReceiptRef: 'fixtures/decision-receipt.json',
  };
}

describe('requirements contract resolver hardening', () => {
  it('rejects non-canonical array aliases before they can overwrite the same element', () => {
    const model = { items: [{ value: 'original' }] };
    const aliases = ['/items/01', '/items/1e0', '/items/+1', '/items/-0', '/items/ 0 '];

    for (const alias of aliases) {
      expect(applySemanticFieldValue(model, alias, { value: 'changed' }), alias).toBeNull();
    }
    expect(semanticFieldRefsOverlap('/items/01/value', '/items/1')).toBe(true);
  });

  it('blocks duplicate semantic premises before evaluating caller authority', () => {
    const premise = sourcePremise();
    const result = resolveSemanticField({
      resolutionId: 'fixture-resolution',
      fieldRef: 'derivedValue',
      value: 'fixture output',
      semanticKind: 'derived_fixture',
      resolutionAuthorityClass: 'rule_derived',
      premises: [premise, { ...premise }],
      derivationRule: 'fixture/rule',
      applicabilityProof: null,
      conflictingCandidates: [],
    });

    expect(result).toMatchObject({
      status: 'unresolved',
      reasonCode: 'duplicate_resolution_premise',
    });
  });

  it('fails closed before cloning non-canonical or sparse sequence models', () => {
    const withUndefined = { kept: 'yes', silentlyDropped: undefined };
    const sparse: unknown[] = [];
    sparse.length = 1;

    for (const sequenceModelBefore of [withUndefined, { items: sparse }]) {
      const result = resolveInteractionCandidates({
        sequenceModelBefore,
        candidates: [],
      });

      expect(result.unresolved).toEqual([
        expect.objectContaining({ reasonCode: 'noncanonical_sequence_model' }),
      ]);
    }
  });

  it('rejects malformed nested premises and undeclared interaction input fields', () => {
    const malformedPremise = {
      ...sourcePremise(),
      sourcePath: 0,
      sourceSpan: { startLine: '1', endLine: 1 },
    };
    const malformedCandidate = resolveInteractionCandidates({
      sequenceModelBefore: {},
      candidates: [interactionCandidate(malformedPremise)],
    });
    const undeclaredInput = resolveInteractionCandidates({
      sequenceModelBefore: {},
      candidates: [],
      unexpected: true,
    });

    expect(malformedCandidate.unresolved).toEqual([
      expect.objectContaining({ reasonCode: 'malformed_interaction_candidate' }),
    ]);
    expect(undeclaredInput.unresolved).toEqual([
      expect.objectContaining({ reasonCode: 'malformed_interaction_input' }),
    ]);
  });
});
