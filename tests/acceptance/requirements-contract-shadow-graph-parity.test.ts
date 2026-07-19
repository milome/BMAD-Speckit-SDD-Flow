import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type ShadowLogicalProjection = {
  trace: unknown;
  prompt: unknown;
  target: unknown;
  oracle: unknown;
  acceptance: unknown;
  gate: unknown;
};

function productionShadowReaders(): string[] {
  const root = path.resolve(
    'packages/bmad-speckit/src/main-agent/source-authority'
  );
  const evaluationPath = path.join(root, 'scripts', 'requirements-contract-evaluation.ts');
  const findings: string[] = [];
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory)) {
      const candidate = path.join(directory, name);
      if (statSync(candidate).isDirectory()) {
        visit(candidate);
        continue;
      }
      if (!/\.(?:ts|js)$/u.test(candidate) || candidate === evaluationPath) continue;
      if (/\bshadow(?:Graph|_graph)\b/iu.test(readFileSync(candidate, 'utf8'))) {
        findings.push(path.relative(root, candidate).replaceAll('\\', '/'));
      }
    }
  };
  visit(root);
  return findings;
}

function logicalProjection(): ShadowLogicalProjection {
  return {
    trace: { requirementRef: 'MUST-FR-001', edgeRefs: ['EDGE-001'] },
    prompt: { taskRefs: ['TASK-001'], commandRefs: ['CMD-001'] },
    target: { targetRefs: ['TARGET-001'] },
    oracle: { oracleRefs: ['ORACLE-001'], independent: true },
    acceptance: { acceptanceRootRefs: ['ACCEPTANCE-ROOT-001'] },
    gate: { decision: 'pass', blockingIssueCount: 0 },
  };
}

describe('requirements contract Shadow Graph parity harness', () => {
  it('compares V1 and V2 logical decisions without granting Shadow authority', async () => {
    const evaluationModule = (await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation'
    )) as Record<string, unknown>;
    const evaluate = evaluationModule.evaluateRequirementsContractShadowParity as
      | ((input: {
          v1: ShadowLogicalProjection;
          v2: ShadowLogicalProjection;
        }) => Record<string, unknown>)
      | undefined;

    expect(typeof evaluate).toBe('function');
    expect(evaluate?.({ v1: logicalProjection(), v2: logicalProjection() })).toMatchObject({
      authority: 'none',
      shadowProductionReadCount: 0,
      parityCaseCount: 6,
      mismatchCount: 0,
      decision: 'pass',
    });

    const drifted = logicalProjection();
    drifted.oracle = { oracleRefs: ['ORACLE-002'], independent: false };
    expect(evaluate?.({ v1: logicalProjection(), v2: drifted })).toMatchObject({
      authority: 'none',
      mismatchCount: 1,
      issues: ['shadow_oracle_parity_mismatch'],
      decision: 'block',
    });
  });

  it('has no production Shadow Graph reader outside the evaluation harness', () => {
    expect(productionShadowReaders()).toEqual([]);
  });
});
