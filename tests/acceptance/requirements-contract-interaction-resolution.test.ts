import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveInteractionCandidates,
  type InteractionResolutionCandidate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-interaction-resolver';
import {
  sha256Stable,
  sha256Text,
  type SourceResolutionPremise,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const kinds = [
  'participant',
  'step',
  'branch',
  'ordering',
  'temporal',
  'deployment',
  'diagram_applicability',
] as const;
const decisionReceiptSchemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-decision-receipt.schema.json'
);

function sourceContent(excerpt: string): string {
  return [...Array.from({ length: 10 }, (_, index) => `context-${index + 1}`), excerpt].join('\n');
}

const trustedSourceRegistry = new Map<string, Record<string, unknown>>();

function proof(identity: string, value: unknown, fieldRef: string): SourceResolutionPremise {
  const excerpt = JSON.stringify(value);
  const content = sourceContent(excerpt);
  const sourcePath = `docs/requirements/${identity}.md`;
  const sourceSpan = { startLine: 11, endLine: 11 };
  const extractionPayload = {
    fieldRef,
    sourceSpan,
    excerptHash: sha256Text(excerpt),
    valueHash: sha256Stable(value),
    parserId: 'canonical-parser-test',
    parserHash: sha256Stable('canonical-parser-test-implementation'),
  };
  trustedSourceRegistry.set(sourcePath, {
    content,
    hash: sha256Text(content),
    extractions: [{
      ...extractionPayload,
      observationHash: sha256Stable(extractionPayload),
    }],
  });
  return {
    kind: 'source',
    sourcePath,
    sourceSpan,
    excerpt,
    hash: sha256Text(content),
  };
}

function trustedSourceOptions(candidates: InteractionResolutionCandidate[]) {
  return {
    trustedInvocationContext: {
      resolverId: 'interaction-resolver-test',
      resolutionRunId: 'interaction-resolution-run-test',
    },
    trustedSourceSnapshots: Object.fromEntries(
      candidates.flatMap((candidate) =>
        candidate.premises
          .filter((premise) => premise.kind === 'source')
          .map((premise) => [premise.sourcePath, trustedSourceRegistry.get(premise.sourcePath)])
      )
    ),
  };
}

function fixtures(namespace: string, reverse = false): InteractionResolutionCandidate[] {
  const values = kinds.map((interactionKind, index) => {
    const identity = `${namespace}-${interactionKind}`;
    const value =
      interactionKind === 'participant'
        ? { id: identity, kind: 'runtime_component', label: `${namespace} service` }
        : { id: identity, order: index + 1 };
    const fieldRef = `/resolvedInteractions/${interactionKind}/${identity}`;
    return {
      interactionKind,
      resolutionId: `resolution-${identity}`,
      fieldRef,
      value,
      semanticKind: interactionKind,
      resolutionAuthorityClass: 'source_extracted' as const,
      premises: [proof(identity, value, fieldRef)],
      derivationRule: null,
      applicabilityProof: null,
      conflictingCandidates: [],
    };
  });
  return reverse ? values.reverse() : values;
}

describe('proof-carrying interaction resolution', () => {
  it('resolves only the seven interaction candidate kinds and preserves sequence hashes', () => {
    const before = { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} };
    const candidates = fixtures('alpha');
    const result = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates,
      ...trustedSourceOptions(candidates),
    });

    expect(result.authorized).toHaveLength(kinds.length);
    expect(result.unresolved).toEqual([]);
    expect(result.sequenceModelHashBefore).toBe(sha256Stable(before));
    expect(result.sequenceModelHashAfter).toBe(sha256Stable(result.sequenceModelAfter));
    expect(result.sequenceModelHashAfter).not.toBe(result.sequenceModelHashBefore);
    expect(result.authorized.every((item) => item.semanticResolutionReceipt !== null)).toBe(true);
    expect(result.authorized.map((item) => item.interactionKind).sort()).toEqual([...kinds].sort());
  });

  it('keeps unproved and synthetic participants unresolved without mutating the sequence', () => {
    const before = { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} };
    const synthetic = fixtures('synthetic')[0];
    synthetic.value = { id: 'user', kind: 'human_actor', label: 'User' };
    synthetic.premises = [proof(
      'synthetic-participant',
      synthetic.value,
      synthetic.fieldRef
    )];
    const hypothesis = fixtures('hypothesis')[1];
    hypothesis.resolutionAuthorityClass = 'model_hypothesis';
    hypothesis.confidence = 1;
    const result = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates: [synthetic, hypothesis],
      ...trustedSourceOptions([synthetic, hypothesis]),
    });

    expect(result.authorized).toEqual([]);
    expect(result.unresolved.map((item) => item.reasonCode)).toEqual(
      expect.arrayContaining(['synthetic_participant_forbidden', 'model_hypothesis_not_authority'])
    );
    expect(result.sequenceModelAfter).toEqual(before);
  });

  it('is fully deterministic under identity-preserving candidate permutation', () => {
    const run = (candidates: InteractionResolutionCandidate[]) =>
      resolveInteractionCandidates({
        sequenceModelBefore: { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} },
        candidates,
        ...trustedSourceOptions(candidates),
      });
    const forwardCandidates = fixtures('permutation');
    const reverseCandidates = [...forwardCandidates].reverse();
    const forward = run(forwardCandidates);
    const reverse = run(reverseCandidates);
    const renamedCandidates = fixtures('renamed', true);
    const renamed = run(renamedCandidates);

    expect(reverse.sequenceModelHashAfter).toBe(forward.sequenceModelHashAfter);
    expect(sha256Stable(reverse.authorized)).toBe(sha256Stable(forward.authorized));
    expect(sha256Stable(reverse.unresolved)).toBe(sha256Stable(forward.unresolved));
    expect(JSON.stringify(renamed.sequenceModelAfter)).toContain('renamed-participant');
    expect(JSON.stringify(renamed.sequenceModelAfter)).not.toContain('permutation-participant');
  });

  it('applies authorized fields through Sequence Contract array pointers', () => {
    const participant = fixtures('array')[0];
    participant.fieldRef = '/sequenceScenarios/0/participants/-';
    participant.premises = [proof('array-participant', participant.value, participant.fieldRef)];
    const before = {
      schemaVersion: 'sequence-fixture/v1',
      sequenceScenarios: [{ participants: [] }],
    };
    const result = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates: [participant],
      ...trustedSourceOptions([participant]),
    });

    expect(result.authorized).toHaveLength(1);
    expect(
      (result.sequenceModelAfter.sequenceScenarios as Array<{ participants: unknown[] }>)[0]
        .participants
    ).toEqual([participant.value]);
  });

  it('accepts only canonical hash-bound Decision Receipts', () => {
    const before = { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} };
    const candidate = fixtures('decision')[2];
    candidate.resolutionAuthorityClass = 'business_decision_required';
    const after = {
      schemaVersion: 'sequence-fixture/v1',
      resolvedInteractions: { branch: { 'decision-branch': candidate.value } },
    };
    const receiptPayload = {
      schemaVersion: 'requirements-decision-receipt/v1' as const,
      receiptRef: 'decisions/decision-branch.json',
      questionId: 'question-decision-branch',
      questionHash: sha256Stable('question-decision-branch'),
      responseId: 'response-decision-branch',
      responseHash: sha256Stable('response-decision-branch'),
      selection: { kind: 'option' as const, optionId: 'option-decision-branch' },
      fieldRef: candidate.fieldRef,
      valueHash: sha256Stable(candidate.value),
      authorityState: 'human_confirmed' as const,
      sequenceModelHashBefore: sha256Stable(before),
      sequenceModelHashAfter: sha256Stable(after),
      affectedRequirementRefs: ['requirement-decision-branch'],
      invalidatedArtifactRefs: [],
      confirmedAt: '2026-07-14T00:00:00.000Z',
    };
    const receipt = {
      ...receiptPayload,
      receiptHash: sha256Stable(receiptPayload),
    };
    const schemaHash = sha256Text(readFileSync(decisionReceiptSchemaPath, 'utf8'));
    candidate.decisionReceiptRef = receipt.receiptRef;
    const trustedDecisionReceipts = {
      [receipt.receiptRef]: {
        receiptPath: receipt.receiptRef,
        receiptFileHash: sha256Stable(receipt),
        schemaHash,
        receipt,
      },
    };

    expect(
      resolveInteractionCandidates({
        sequenceModelBefore: before,
        candidates: [candidate],
        trustedDecisionReceipts,
      })
        .authorized[0].authorityState
    ).toBe('human_confirmed');
    const extraFieldPayload = {
      ...receiptPayload,
      unexpected: 'claimant-owned-extra',
    };
    const extraFieldReceipt = {
      ...extraFieldPayload,
      receiptHash: sha256Stable(extraFieldPayload),
    } as never;
    trustedDecisionReceipts[receipt.receiptRef] = {
      receiptPath: receipt.receiptRef,
      receiptFileHash: sha256Stable(extraFieldReceipt),
      schemaHash,
      receipt: extraFieldReceipt,
    };
    expect(
      resolveInteractionCandidates({
        sequenceModelBefore: before,
        candidates: [candidate],
        trustedDecisionReceipts,
      })
        .authorized
    ).toEqual([]);
    const wrongHashReceipt = {
      ...receipt,
      receiptHash: sha256Stable('forged'),
    };
    trustedDecisionReceipts[receipt.receiptRef] = {
      receiptPath: receipt.receiptRef,
      receiptFileHash: sha256Stable(wrongHashReceipt),
      schemaHash,
      receipt: wrongHashReceipt,
    };
    expect(
      resolveInteractionCandidates({
        sequenceModelBefore: before,
        candidates: [candidate],
        trustedDecisionReceipts,
      })
        .authorized
    ).toEqual([]);
  });

  it('rejects malformed candidates, unknown authority, and unknown kinds before decisions', () => {
    expect(() => resolveInteractionCandidates(null as never)).not.toThrow();
    expect(resolveInteractionCandidates(null as never).unresolved[0].reasonCode)
      .toBe('malformed_interaction_input');
    const before = { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} };
    const unknownAuthority = fixtures('unknown-authority')[2];
    unknownAuthority.resolutionAuthorityClass = 'unknown_authority' as never;
    const unknownKind = { ...unknownAuthority, interactionKind: 'unknown_kind' as never };
    const malformedCandidate = null as never;

    expect(
      resolveInteractionCandidates({ sequenceModelBefore: before, candidates: [unknownAuthority] })
        .unresolved[0].reasonCode
    ).toBe('unsupported_resolution_authority_class');
    expect(
      resolveInteractionCandidates({ sequenceModelBefore: before, candidates: [unknownKind] })
        .unresolved[0].reasonCode
    ).toBe('unsupported_interaction_kind');
    expect(() =>
      resolveInteractionCandidates({ sequenceModelBefore: before, candidates: [malformedCandidate] })
    ).not.toThrow();
  });

  it('rejects ambiguous writes to the same append field deterministically', () => {
    const before = {
      schemaVersion: 'sequence-fixture/v1',
      sequenceScenarios: [{ participants: [] }],
    };
    const candidates = [fixtures('append-first')[0], fixtures('append-second')[0]];
    for (const candidate of candidates) {
      candidate.fieldRef = '/sequenceScenarios/0/participants/-';
    }
    const forward = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates,
      ...trustedSourceOptions(candidates),
    });
    const reverse = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates: [...candidates].reverse(),
      ...trustedSourceOptions(candidates),
    });

    expect(forward.authorized).toEqual([]);
    expect(forward.sequenceModelAfter).toEqual(before);
    expect(sha256Stable(reverse.unresolved)).toBe(sha256Stable(forward.unresolved));
    expect(forward.unresolved.every((item) => item.reasonCode === 'ambiguous_interaction_field'))
      .toBe(true);
  });

  it('blocks ancestor and descendant field writes before applying either candidate', () => {
    const before = { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} };
    const [, parent, child] = fixtures('overlapping-fields');
    parent.fieldRef = '/resolvedInteractions/flow';
    parent.value = { id: 'overlapping-flow', order: 1, child: {} };
    parent.premises = [proof('overlapping-flow', parent.value, parent.fieldRef)];
    child.fieldRef = '/resolvedInteractions/flow/child';
    child.value = { id: 'overlapping-flow-child', order: 2 };
    child.premises = [proof('overlapping-flow-child', child.value, child.fieldRef)];
    const candidates = [parent, child];

    const result = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates,
      ...trustedSourceOptions(candidates),
    });

    expect(result.authorized).toEqual([]);
    expect(result.sequenceModelAfter).toEqual(before);
    expect(result.unresolved.map((item) => item.reasonCode)).toEqual([
      'overlapping_interaction_field',
      'overlapping_interaction_field',
    ]);
  });

  it('uses explicit business order before interaction kind when building the receipt chain', () => {
    const before = { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} };
    const [participant, step] = fixtures('business-order');
    participant.value = {
      id: 'business-order-participant',
      kind: 'runtime_component',
      label: 'Business Order Participant',
      order: 2,
    };
    participant.premises = [proof(
      'business-order-participant',
      participant.value,
      participant.fieldRef
    )];
    step.value = { id: 'business-order-step', order: 1 };
    step.premises = [proof('business-order-step', step.value, step.fieldRef)];
    const candidates = [participant, step];
    const result = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates,
      ...trustedSourceOptions(candidates),
    });

    expect(result.authorized.map((item) => item.interactionKind)).toEqual([
      'step',
      'participant',
    ]);
  });

  it('rejects prototype-bearing JSON pointers without side effects before authority checks', () => {
    const before = { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} };
    const candidate = fixtures('prototype')[3];
    candidate.fieldRef = '/__proto__/polluted';
    candidate.resolutionAuthorityClass = 'model_hypothesis';

    try {
      const result = resolveInteractionCandidates({
        sequenceModelBefore: before,
        candidates: [candidate],
      });
      expect(Reflect.get(Object.prototype, 'polluted')).toBeUndefined();
      expect(result.sequenceModelAfter).toEqual(before);
      expect(result.unresolved[0].reasonCode).toBe('invalid_interaction_field_ref');
    } finally {
      Reflect.deleteProperty(Object.prototype, 'polluted');
    }
  });

  it('rejects extra candidate fields and mixed premises at the interaction boundary', () => {
    const before = { schemaVersion: 'sequence-fixture/v1', resolvedInteractions: {} };
    const extraFieldCandidate = fixtures('strict-interaction')[1] as
      InteractionResolutionCandidate & { unexpected: string };
    extraFieldCandidate.unexpected = 'claimant-owned-extra';
    const mixedPremiseCandidate = fixtures('mixed-interaction-premise')[1];
    mixedPremiseCandidate.premises = [
      ...mixedPremiseCandidate.premises,
      { kind: 'unknown', payload: 'discard-me' } as never,
    ];

    const extraFieldResult = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates: [extraFieldCandidate],
      ...trustedSourceOptions([extraFieldCandidate]),
    });
    const mixedPremiseResult = resolveInteractionCandidates({
      sequenceModelBefore: before,
      candidates: [mixedPremiseCandidate],
      ...trustedSourceOptions([mixedPremiseCandidate]),
    });

    expect(extraFieldResult.authorized).toEqual([]);
    expect(extraFieldResult.unresolved[0].reasonCode).toBe('malformed_interaction_candidate');
    expect(mixedPremiseResult.authorized).toEqual([]);
    expect(mixedPremiseResult.unresolved[0].reasonCode).toBe(
      'malformed_interaction_candidate'
    );
  });
});
