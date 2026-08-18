import { describe, expect, it } from 'vitest';

import * as finalJudgeCampaign from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign';

const CANDIDATE_HASH = `sha256:${'1'.repeat(64)}`;
const AGGREGATE_HASH = `sha256:${'2'.repeat(64)}`;
const CAMPAIGN_CLOSURE_HASH = `sha256:${'3'.repeat(64)}`;

type AcceptedResult = {
  schemaVersion: 'ExecutionFinalAcceptedResult/v1';
  executionFinalCandidateHash: string;
  candidateRef: { path: string; hash: string };
  requestRef: { path: string; hash: string };
  responseRef: { path: string; hash: string };
  aggregateRef: { path: string; hash: string };
  campaignClosureHash: string;
  decision: 'pass' | 'fail';
  coverageDisposition: 'coverage_satisfied';
};

type EffectivePass = {
  schemaVersion: string;
  effectivePass: true;
  executionFinalCandidateHash: string;
  aggregateHash: string;
  campaignClosureHash: string;
  decision: 'pass';
  effectivePassReceiptHash: string;
};

type EffectivePassCompiler = (input: {
  acceptedResult: AcceptedResult;
  aggregateHash: string;
  campaignClosureHash: string;
  [key: string]: unknown;
}) => EffectivePass;

function compiler(): EffectivePassCompiler {
  const candidate = (finalJudgeCampaign as unknown as Record<string, unknown>)
    .compileExecutionFinalJudgeEffectivePass;
  expect(
    typeof candidate,
    'main-agent-execution-final-judge-campaign must export compileExecutionFinalJudgeEffectivePass'
  ).toBe('function');
  return candidate as EffectivePassCompiler;
}

function acceptedResult(): AcceptedResult {
  return {
    schemaVersion: 'ExecutionFinalAcceptedResult/v1',
    executionFinalCandidateHash: CANDIDATE_HASH,
    candidateRef: {
      path: 'goal/execution-final-candidate.json',
      hash: CANDIDATE_HASH,
    },
    requestRef: {
      path: 'goal/final-judge/request.json',
      hash: `sha256:${'4'.repeat(64)}`,
    },
    responseRef: {
      path: 'goal/final-judge/response.json',
      hash: `sha256:${'5'.repeat(64)}`,
    },
    aggregateRef: {
      path: 'goal/final-judge/aggregate.json',
      hash: AGGREGATE_HASH,
    },
    campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
    decision: 'pass',
    coverageDisposition: 'coverage_satisfied',
  };
}

function compileInput() {
  return {
    acceptedResult: acceptedResult(),
    aggregateHash: AGGREGATE_HASH,
    campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
  };
}

describe('Execution EffectivePass binding', () => {
  it('binds exactly candidate hash, aggregate hash, campaign closure hash, and decision', () => {
    const effectivePass = compiler()(compileInput());

    expect(effectivePass).toMatchObject({
      schemaVersion: 'main-agent-execution-final-judge-effective-pass-receipt/v1',
      effectivePass: true,
      executionFinalCandidateHash: CANDIDATE_HASH,
      aggregateHash: AGGREGATE_HASH,
      campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
      decision: 'pass',
    });
    expect(Object.keys(effectivePass).sort()).toEqual(
      [
        'aggregateHash',
        'campaignClosureHash',
        'decision',
        'effectivePass',
        'effectivePassReceiptHash',
        'executionFinalCandidateHash',
        'schemaVersion',
      ].sort()
    );
    expect(effectivePass.effectivePassReceiptHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it('changes identity for every mutable semantic authority hash', () => {
    const compile = compiler();
    const baseline = compile(compileInput());
    const candidateMutation = acceptedResult();
    candidateMutation.executionFinalCandidateHash = `sha256:${'6'.repeat(64)}`;
    candidateMutation.candidateRef = {
      ...candidateMutation.candidateRef,
      hash: candidateMutation.executionFinalCandidateHash,
    };
    const aggregateMutation = acceptedResult();
    aggregateMutation.aggregateRef = {
      ...aggregateMutation.aggregateRef,
      hash: `sha256:${'7'.repeat(64)}`,
    };
    const closureMutation = acceptedResult();
    closureMutation.campaignClosureHash = `sha256:${'8'.repeat(64)}`;

    expect(
      compile({ ...compileInput(), acceptedResult: candidateMutation }).effectivePassReceiptHash
    ).not.toBe(baseline.effectivePassReceiptHash);
    expect(
      compile({
        acceptedResult: aggregateMutation,
        aggregateHash: aggregateMutation.aggregateRef.hash,
        campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
      }).effectivePassReceiptHash
    ).not.toBe(baseline.effectivePassReceiptHash);
    expect(
      compile({
        acceptedResult: closureMutation,
        aggregateHash: AGGREGATE_HASH,
        campaignClosureHash: closureMutation.campaignClosureHash,
      }).effectivePassReceiptHash
    ).not.toBe(baseline.effectivePassReceiptHash);
  });

  it('ignores ledger, state, provider, and dispatch mutations', () => {
    const compile = compiler();
    const baseline = compile(compileInput());
    const mutatedRuntime = compile({
      ...compileInput(),
      ledgerHeadHash: `sha256:${'9'.repeat(64)}`,
      authorityStateHash: `sha256:${'a'.repeat(64)}`,
      providerRef: 'provider-mutated',
      dispatchGroupId: `sha256:${'b'.repeat(64)}`,
    });

    expect(mutatedRuntime).toEqual(baseline);
  });

  it('rejects a non-pass accepted decision instead of issuing EffectivePass', () => {
    const compile = compiler();
    const rejected = { ...acceptedResult(), decision: 'fail' as const };

    expect(() => compile({ ...compileInput(), acceptedResult: rejected })).toThrowError(
      /execution_final_(?:accepted_result|effective_pass)_(?:invalid|decision_mismatch)/u
    );
  });
});
