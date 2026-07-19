import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateInteractionCompilerCases,
  type InteractionCompilerEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import {
  resolveInteractionCandidates,
  type InteractionResolutionCandidate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-interaction-resolver';
import {
  sha256Stable,
  sha256Text,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function sourceCandidate(identity: string): {
  candidate: InteractionResolutionCandidate;
  sourcePath: string;
  trustedSource: Record<string, unknown>;
} {
  const fieldRef = `/resolvedInteractions/participant/${identity}`;
  const value = {
    id: `participant-${identity}`,
    kind: 'runtime_component',
    label: `Service ${identity}`,
  };
  const excerpt = JSON.stringify(value);
  const content = `context\n${excerpt}`;
  const sourcePath = `docs/requirements/${identity}.md`;
  const sourceSpan = { startLine: 2, endLine: 2 };
  const extraction = {
    fieldRef,
    sourceSpan,
    excerptHash: sha256Text(excerpt),
    valueHash: sha256Stable(value),
    parserId: `parser-${identity}`,
    parserHash: sha256Stable({ identity, kind: 'parser' }),
  };
  return {
    candidate: {
      interactionKind: 'participant',
      resolutionId: `resolution-${identity}`,
      fieldRef,
      value,
      semanticKind: 'participant',
      resolutionAuthorityClass: 'source_extracted',
      premises: [
        {
          kind: 'source',
          sourcePath,
          sourceSpan,
          excerpt,
          hash: sha256Text(content),
        },
      ],
      derivationRule: null,
      applicabilityProof: null,
      conflictingCandidates: [],
    },
    sourcePath,
    trustedSource: {
      content,
      hash: sha256Text(content),
      extractions: [
        {
          ...extraction,
          observationHash: sha256Stable(extraction),
        },
      ],
    },
  };
}

function productionInteractionCase(): InteractionCompilerEvaluationCase {
  const valid = sourceCandidate(randomUUID());
  const hypothesis = sourceCandidate(randomUUID());
  hypothesis.candidate.resolutionAuthorityClass = 'model_hypothesis';
  const before = {
    schemaVersion: 'sequence-fixture/v1',
    resolvedInteractions: {},
  };
  const result = resolveInteractionCandidates({
    sequenceModelBefore: before,
    candidates: [valid.candidate, hypothesis.candidate],
    trustedInvocationContext: {
      resolverId: `resolver-${randomUUID()}`,
      resolutionRunId: `run-${randomUUID()}`,
    },
    trustedSourceSnapshots: {
      [valid.sourcePath]: valid.trustedSource,
      [hypothesis.sourcePath]: hypothesis.trustedSource,
    },
  });
  return {
    caseRef: `interaction-${randomUUID()}`,
    expectedAuthorizedCount: 1,
    actualAuthorizedCount: result.authorized.length,
    expectedUnresolvedCount: 1,
    actualUnresolvedCount: result.unresolved.length,
    sequenceHashBeforeValid: result.sequenceModelHashBefore === sha256Stable(before),
    sequenceHashAfterValid:
      result.sequenceModelHashAfter === sha256Stable(result.sequenceModelAfter),
    projectionAuthorityMutationCount: 0,
  };
}

describe('requirements contract interaction compiler evaluation', () => {
  it('authorizes source-grounded interactions and blocks model hypotheses', () => {
    const productionCase = productionInteractionCase();

    const result = evaluateInteractionCompilerCases([productionCase]);

    expect(result.falseAcceptCount).toBe(0);
    expect(result.falseBlockCount).toBe(0);
    expect(result.sequenceHashMismatchCount).toBe(0);
    expect(result.projectionAuthorityMutationCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks an interaction projection that grants authority beyond the resolver result', () => {
    const invalid: InteractionCompilerEvaluationCase = {
      ...productionInteractionCase(),
      actualAuthorizedCount: 2,
      actualUnresolvedCount: 0,
      projectionAuthorityMutationCount: 1,
    };

    const result = evaluateInteractionCompilerCases([invalid]);

    expect(result.falseAcceptCount).toBe(1);
    expect(result.projectionAuthorityMutationCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
