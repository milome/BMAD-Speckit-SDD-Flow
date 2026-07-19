import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateAutomaticResolutionCases,
  type AutomaticResolutionEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import {
  resolveSemanticField,
  sha256Stable,
  sha256Text,
  type SemanticResolutionCandidate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function sourceGroundedCase(): AutomaticResolutionEvaluationCase {
  const identity = randomUUID();
  const value = `operator-${identity}`;
  const fieldRef = `requirements.${identity}.semantics.actor`;
  const sourcePath = `docs/requirements/${identity}.md`;
  const sourceSpan = { startLine: 1, endLine: 1 };
  const content = value;
  const resolutionId = `resolution-${identity}`;
  const resolutionRunId = `run-${identity}`;
  const parserId = `parser-${identity}`;
  const parserHash = sha256Stable({ parserId });
  const extraction = {
    fieldRef,
    sourceSpan,
    excerptHash: sha256Text(value),
    valueHash: sha256Stable(value),
    parserId,
    parserHash,
  };
  const candidate: SemanticResolutionCandidate = {
    resolutionId,
    fieldRef,
    value,
    semanticKind: 'actor',
    resolutionAuthorityClass: 'source_extracted',
    premises: [
      {
        kind: 'source',
        sourcePath,
        sourceSpan,
        excerpt: value,
        hash: sha256Text(content),
      },
    ],
    derivationRule: null,
    applicabilityProof: null,
    conflictingCandidates: [],
  };
  const result = resolveSemanticField(candidate, {
    trustedSourceSnapshots: {
      [sourcePath]: {
        content,
        hash: sha256Text(content),
        extractions: [
          {
            ...extraction,
            observationHash: sha256Stable(extraction),
          },
        ],
      },
    },
    trustedInvocationContext: {
      resolverId: `resolver-${identity}`,
      resolutionRunId,
      sourceModelBefore: { requirements: { [identity]: { semantics: {} } } },
    },
  });
  return {
    caseRef: candidate.resolutionId,
    eligibleForAutomaticResolution: true,
    expectedAuthorized: true,
    actualAuthorized: result.status === 'authorized',
    unresolved: result.status === 'unresolved',
    requiresHumanDecision: false,
  };
}

function unresolvedCase(
  authorityClass: SemanticResolutionCandidate['resolutionAuthorityClass'],
  requiresHumanDecision: boolean
): AutomaticResolutionEvaluationCase {
  const identity = randomUUID();
  const candidate: SemanticResolutionCandidate = {
    resolutionId: `resolution-${identity}`,
    fieldRef: `requirements.${identity}.semantics.actor`,
    value: `operator-${identity}`,
    semanticKind: 'actor',
    resolutionAuthorityClass: authorityClass,
    premises: [],
    derivationRule: null,
    applicabilityProof: null,
    conflictingCandidates: [],
  };
  const result = resolveSemanticField(candidate);
  return {
    caseRef: candidate.resolutionId,
    eligibleForAutomaticResolution: false,
    expectedAuthorized: false,
    actualAuthorized: result.status === 'authorized',
    unresolved: result.status === 'unresolved',
    requiresHumanDecision,
  };
}

describe('requirements contract automatic resolution evaluation', () => {
  it('measures production resolution without accepting hypotheses or business decisions', () => {
    const cases = [
      sourceGroundedCase(),
      unresolvedCase('model_hypothesis', false),
      unresolvedCase('business_decision_required', true),
    ];

    const result = evaluateAutomaticResolutionCases(cases);

    expect(result.caseCount).toBe(cases.length);
    expect(result.autoResolutionCoverage).toBe(1);
    expect(result.autoResolutionPrecision).toBe(1);
    expect(result.autoResolutionFalseAcceptRate).toBe(0);
    expect(result.humanEscalationRate).toBe(0.5);
    expect(result.falseAcceptCount).toBe(0);
    expect(result.falseBlockCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks an independently labeled invalid automatic authorization', () => {
    const valid = sourceGroundedCase();
    const invalidAccepted: AutomaticResolutionEvaluationCase = {
      ...unresolvedCase('model_hypothesis', false),
      actualAuthorized: true,
      unresolved: false,
    };

    const result = evaluateAutomaticResolutionCases([valid, invalidAccepted]);

    expect(result.autoResolutionFalseAcceptRate).toBe(1);
    expect(result.falseAcceptCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
