import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractVerificationDag,
  validateRequirementsContractVerificationDag,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-verification-dag';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function command(commandRef: string, overrides = {}) {
  return {
    commandRef,
    exactCommand: `npm test -- ${commandRef}`,
    inputByteHash: hash(`${commandRef}:bytes`),
    exitCode: 0,
    ...overrides,
  };
}

function origin(originId: string, overrides = {}) {
  return {
    originId,
    closureHash: hash(`${originId}:closure`),
    decision: 'pass',
    ...overrides,
  };
}

describe('requirements contract verification dag', () => {
  it('deduplicates command identities by rejecting duplicate executions and orders origins topologically', () => {
    const dag = compileRequirementsContractVerificationDag({
      candidateId: 'candidate-a',
      commandExecutions: [command('cmd-b'), command('cmd-a')],
      originClosures: [origin('origin-b'), origin('origin-a')],
      expectedOriginIds: ['origin-a', 'origin-b'],
    });

    expect(dag.topologicalOriginOrder).toEqual(['origin-a', 'origin-b']);
    expect(dag.originClosureHashes).toEqual([hash('origin-a:closure'), hash('origin-b:closure')]);
    expect(dag.duplicateCommandExecutionCount).toBe(0);
    expect(dag.missingOriginCount).toBe(0);
    expect(
      validateRequirementsContractVerificationDag(dag, {
        candidateId: 'candidate-a',
        verificationDagHash: dag.verificationDagHash,
      })
    ).toBe(dag);
  });

  it('fails closed for stale origin evidence, missing origins, and duplicate command identities', () => {
    expect(() =>
      compileRequirementsContractVerificationDag({
        candidateId: 'candidate-a',
        commandExecutions: [command('cmd-a')],
        originClosures: [origin('origin-a', { decision: 'fail' })],
        expectedOriginIds: ['origin-a'],
      })
    ).toThrow('verification_dag_origin_stale');

    expect(() =>
      compileRequirementsContractVerificationDag({
        candidateId: 'candidate-a',
        commandExecutions: [command('cmd-a')],
        originClosures: [origin('origin-a')],
        expectedOriginIds: ['origin-a', 'origin-b'],
      })
    ).toThrow('verification_dag_origin_missing');

    expect(() =>
      compileRequirementsContractVerificationDag({
        candidateId: 'candidate-a',
        commandExecutions: [command('cmd-a'), command('cmd-a')],
        originClosures: [origin('origin-a')],
        expectedOriginIds: ['origin-a'],
      })
    ).toThrow('verification_dag_duplicate_command_execution');
  });
});
