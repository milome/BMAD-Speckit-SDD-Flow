import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as finalJudgeCampaign from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign';

const CANDIDATE_HASH = `sha256:${'a'.repeat(64)}`;
const REQUEST_HASH = `sha256:${'b'.repeat(64)}`;
const RESPONSE_HASH = `sha256:${'c'.repeat(64)}`;
const AGGREGATE_HASH = `sha256:${'d'.repeat(64)}`;
const CAMPAIGN_CLOSURE_HASH = `sha256:${'e'.repeat(64)}`;

type AcceptedResultInput = {
  projectRoot: string;
  executionFinalCandidateHash: string;
  candidateRef: { path: string; hash: string };
  requestRef: { path: string; hash: string };
  responseRef: { path: string; hash: string };
  aggregateRef: { path: string; hash: string };
  campaignClosureHash: string;
  decision: 'pass';
  coverageDisposition: 'coverage_satisfied';
};

type AcceptedResultPublication = {
  acceptedResult: Record<string, unknown>;
  path: string;
  hash: string;
  reused: boolean;
};

type AcceptedResultPublisher = (input: AcceptedResultInput) => AcceptedResultPublication;

function publisher(): AcceptedResultPublisher {
  const candidate = (finalJudgeCampaign as unknown as Record<string, unknown>)
    .publishExecutionFinalAcceptedResult;
  expect(
    typeof candidate,
    'main-agent-execution-final-judge-campaign must export publishExecutionFinalAcceptedResult'
  ).toBe('function');
  return candidate as AcceptedResultPublisher;
}

function publicationInput(projectRoot: string): AcceptedResultInput {
  return {
    projectRoot,
    executionFinalCandidateHash: CANDIDATE_HASH,
    candidateRef: {
      path: 'goal/execution-final-candidate.json',
      hash: CANDIDATE_HASH,
    },
    requestRef: {
      path: 'goal/final-judge/request.json',
      hash: REQUEST_HASH,
    },
    responseRef: {
      path: 'goal/final-judge/response.json',
      hash: RESPONSE_HASH,
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

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

describe('ExecutionFinalAcceptedResult recovery', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(resolve(tmpdir(), 'execution-final-accepted-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('ships the closed accepted-result schema', () => {
    const schemaPath = resolve(
      process.cwd(),
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-execution-final-accepted-result.schema.json'
    );
    expect(existsSync(schemaPath)).toBe(true);
    if (!existsSync(schemaPath)) return;
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, any>;
    expect(schema).toMatchObject({
      title: 'Execution Final Accepted Result',
      type: 'object',
      additionalProperties: false,
    });
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'executionFinalCandidateHash',
        'candidateRef',
        'requestRef',
        'responseRef',
        'aggregateRef',
        'campaignClosureHash',
        'decision',
        'coverageDisposition',
      ])
    );
  });

  it('publishes immutable accepted authority at the candidate-keyed Windows-safe path', () => {
    const published = publisher()(publicationInput(projectRoot));
    const expectedPath = `accepted/sha256-${CANDIDATE_HASH.slice('sha256:'.length)}.json`;
    const bytes = readFileSync(resolve(projectRoot, published.path));

    expect(published).toMatchObject({
      path: expectedPath,
      reused: false,
      acceptedResult: {
        schemaVersion: 'ExecutionFinalAcceptedResult/v1',
        executionFinalCandidateHash: CANDIDATE_HASH,
        candidateRef: publicationInput(projectRoot).candidateRef,
        requestRef: publicationInput(projectRoot).requestRef,
        responseRef: publicationInput(projectRoot).responseRef,
        aggregateRef: publicationInput(projectRoot).aggregateRef,
        campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
        decision: 'pass',
        coverageDisposition: 'coverage_satisfied',
      },
    });
    expect(published.path).not.toContain(':');
    expect(JSON.parse(bytes.toString('utf8'))).toEqual(published.acceptedResult);
    expect(published.hash).toBe(sha256(bytes));
  });

  it('reuses only the exact accepted-result bytes for the same candidate hash', () => {
    const publish = publisher();
    const first = publish(publicationInput(projectRoot));
    const firstBytes = readFileSync(resolve(projectRoot, first.path));

    const second = publish(publicationInput(projectRoot));
    const secondBytes = readFileSync(resolve(projectRoot, second.path));

    expect(second).toEqual({ ...first, reused: true });
    expect(secondBytes.equals(firstBytes)).toBe(true);
  });

  it.each([
    ['bytes', 'tamper persisted bytes'],
    ['hash', 'change a bound reference hash'],
    ['path', 'change a bound reference path'],
  ] as const)('rejects conflicting %s for an existing candidate key', (kind) => {
    const publish = publisher();
    const input = publicationInput(projectRoot);
    const first = publish(input);
    let conflictingInput = input;

    if (kind === 'bytes') {
      writeFileSync(
        resolve(projectRoot, first.path),
        `${JSON.stringify({ ...first.acceptedResult, coverageDisposition: 'tampered' })}\n`,
        'utf8'
      );
    } else if (kind === 'hash') {
      conflictingInput = {
        ...input,
        aggregateRef: { ...input.aggregateRef, hash: `sha256:${'f'.repeat(64)}` },
      };
    } else {
      conflictingInput = {
        ...input,
        aggregateRef: { ...input.aggregateRef, path: 'goal/final-judge/other.json' },
      };
    }

    expect(() => publish(conflictingInput)).toThrowError(
      /execution_final_accepted_result_(?:conflict|invalid)/u
    );
  });
});
