import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as sourceResolver from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-interaction-resolver';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type ResolverSurface = Pick<
  typeof sourceResolver,
  | 'createInteractionDecisionReceipt'
  | 'resolveInteractionCandidates'
  | 'validateInteractionDecisionReceipt'
>;

const ROOT = process.cwd();
const SOURCE_PATH = path.join(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-interaction-resolver.ts'
);
const DIST_PATH = path.join(
  ROOT,
  'packages/bmad-speckit/dist/main-agent/source-authority/scripts/requirements-contract-interaction-resolver.js'
);
const require = createRequire(import.meta.url);

function distResolver(): ResolverSurface {
  return require(DIST_PATH) as ResolverSurface;
}

function unresolvedCandidate(identity: string) {
  return {
    interactionKind: 'participant' as const,
    resolutionId: `resolution-${identity}`,
    fieldRef: `/resolvedInteractions/participant/${identity}`,
    value: {
      id: identity,
      kind: 'runtime_component',
      label: `Runtime component ${identity}`,
    },
    semanticKind: 'participant',
    resolutionAuthorityClass: 'model_hypothesis' as const,
    premises: [],
    derivationRule: null,
    applicabilityProof: null,
    conflictingCandidates: [],
  };
}

describe('requirements contract interaction source and dist surface parity', () => {
  it('executes the generated dist resolver with the same fail-closed behavior', () => {
    expect(existsSync(SOURCE_PATH)).toBe(true);
    expect(existsSync(DIST_PATH)).toBe(true);

    const identity = randomUUID();
    const input = {
      sequenceModelBefore: {
        schemaVersion: 'sequence-contract-test/v1',
        resolvedInteractions: {},
      },
      candidates: [unresolvedCandidate(identity)],
    };
    const sourceResult = sourceResolver.resolveInteractionCandidates(input);
    const distResult = distResolver().resolveInteractionCandidates(input);

    expect(distResult).toEqual(sourceResult);
    expect(sourceResult.authorized).toEqual([]);
    expect(sourceResult.unresolved).toEqual([
      expect.objectContaining({
        fieldRef: `/resolvedInteractions/participant/${identity}`,
        blocking: true,
        reasonCode: 'model_hypothesis_not_authority',
      }),
    ]);
    expect(sourceResult.sequenceModelHashAfter).toBe(
      sourceResult.sequenceModelHashBefore
    );
  });

  it('creates and validates the same hash-bound Decision Receipt on both surfaces', () => {
    const identity = randomUUID();
    const before = {
      schemaVersion: 'sequence-contract-test/v1',
      resolvedInteractions: {},
    };
    const value = {
      id: identity,
      order: 1,
    };
    const after = {
      ...before,
      resolvedInteractions: {
        step: {
          [identity]: value,
        },
      },
    };
    const input = {
      receiptRef: `decisions/${identity}.json`,
      questionId: `question-${identity}`,
      questionHash: sha256Stable({ identity, role: 'question' }),
      responseId: `response-${identity}`,
      responseHash: sha256Stable({ identity, role: 'response' }),
      selection: {
        kind: 'option' as const,
        optionId: `option-${identity}`,
      },
      fieldRef: `/resolvedInteractions/step/${identity}`,
      value,
      sequenceModelBefore: before,
      sequenceModelAfter: after,
      affectedRequirementRefs: [`requirement-${identity}`],
      invalidatedArtifactRefs: [],
      confirmedAt: '2026-07-18T00:00:00.000Z',
    };

    const sourceReceipt =
      sourceResolver.createInteractionDecisionReceipt(input);
    const dist = distResolver();
    const distReceipt = dist.createInteractionDecisionReceipt(input);

    expect(distReceipt).toEqual(sourceReceipt);
    expect(sourceResolver.validateInteractionDecisionReceipt(sourceReceipt)).toBe(
      true
    );
    expect(dist.validateInteractionDecisionReceipt(distReceipt)).toBe(true);
  });
});
