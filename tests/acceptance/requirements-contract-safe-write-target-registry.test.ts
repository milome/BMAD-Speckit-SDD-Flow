import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyRequirementsContractSafeWritePath,
  REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY,
  resolveRequirementsContractSafeWriteTargetSet,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-safe-write-target-registry';

interface SafeWriteTargetFixtureContext {
  requirementSetId: string;
  implementationAttemptId: string;
  bundleRevision: string;
  activationAttemptId: string;
  sourcePrdPath: string;
  consumerRegistryPath: string;
  evidenceRoot: string;
  goalExecutionApplicable: boolean;
  activationOutcome: 'success' | 'blocked';
  classification: {
    excludedControlRelativePaths: string[];
    unregisteredRelativePath: string;
  };
}

const ROOT = process.cwd();
const FIXTURE_ROOT = path.join(
  ROOT,
  'tests',
  'fixtures',
  'requirements-contract',
  'safe-write-target-registry'
);
const context = JSON.parse(
  readFileSync(path.join(FIXTURE_ROOT, 'context.json'), 'utf8')
) as SafeWriteTargetFixtureContext;

function normalize(value: string): string {
  return value.replace(/\\/gu, '/').replace(/\/+$/u, '');
}

function isWithin(root: string, candidate: string): boolean {
  const normalizedRoot = normalize(root);
  const normalizedCandidate = normalize(candidate);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`)
  );
}

function difference(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function classifyWithContext(
  value: string
): 'receipt_complete' | 'excluded_control_evidence' | 'unregistered' {
  return classifyRequirementsContractSafeWritePath(value, context);
}

describe('requirements contract safe-write target registry', () => {
  it('resolves tracked fixture inputs without embedding repository evidence paths', () => {
    expect(existsSync(path.resolve(ROOT, context.sourcePrdPath))).toBe(true);
    expect(existsSync(path.resolve(ROOT, context.consumerRegistryPath))).toBe(true);
    expect(JSON.stringify(REQUIREMENTS_CONTRACT_SAFE_WRITE_TARGET_REGISTRY)).not.toContain(
      'docs/plans/evidence'
    );

    const first = resolveRequirementsContractSafeWriteTargetSet(context);
    const second = resolveRequirementsContractSafeWriteTargetSet(context);
    const runtimeRoot =
      `_bmad-output/runtime/requirement-records/${context.requirementSetId}`;
    const explicitTargets = new Set([
      normalize(context.sourcePrdPath),
      normalize(context.consumerRegistryPath),
    ]);

    expect(second).toEqual(first);
    expect(first.targetSetHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(first.targets).toContain(normalize(context.sourcePrdPath));
    expect(first.targets).toContain(normalize(context.consumerRegistryPath));
    expect(first.targets).not.toContainEqual(
      expect.stringContaining('docs/plans/evidence')
    );
    expect(
      first.targets.every(
        (target) =>
          explicitTargets.has(normalize(target)) ||
          isWithin(context.evidenceRoot, target) ||
          isWithin(runtimeRoot, target)
      )
    ).toBe(true);
  });

  it('derives goal and activation applicability from target-set differences', () => {
    const successWithGoal = resolveRequirementsContractSafeWriteTargetSet(context);
    const successWithoutGoal = resolveRequirementsContractSafeWriteTargetSet({
      ...context,
      goalExecutionApplicable: false,
    });
    const blockedWithGoal = resolveRequirementsContractSafeWriteTargetSet({
      ...context,
      activationOutcome: 'blocked',
    });
    const goalOnlyTargets = difference(
      successWithGoal.targets,
      successWithoutGoal.targets
    );
    const successOnlyTargets = difference(
      successWithGoal.targets,
      blockedWithGoal.targets
    );
    const blockedOnlyTargets = difference(
      blockedWithGoal.targets,
      successWithGoal.targets
    );

    expect(goalOnlyTargets).toHaveLength(1);
    expect(
      goalOnlyTargets.every((target) =>
        isWithin(
          `_bmad-output/runtime/requirement-records/${context.requirementSetId}`,
          target
        )
      )
    ).toBe(true);
    expect(successOnlyTargets).toHaveLength(1);
    expect(blockedOnlyTargets).toHaveLength(1);
    expect(
      [...successOnlyTargets, ...blockedOnlyTargets].every((target) =>
        isWithin(context.evidenceRoot, target)
      )
    ).toBe(true);
  });

  it('classifies fixture-scoped control evidence without admitting it to the exact set', () => {
    const exactSet = resolveRequirementsContractSafeWriteTargetSet(context);
    const receiptCompleteTarget = exactSet.targets.find((target) =>
      isWithin(context.evidenceRoot, target)
    );

    expect(receiptCompleteTarget).toBeDefined();
    if (receiptCompleteTarget) {
      expect(classifyWithContext(receiptCompleteTarget)).toBe('receipt_complete');
    }
    for (const relativePath of context.classification.excludedControlRelativePaths) {
      const candidate = normalize(`${context.evidenceRoot}/${relativePath}`);
      expect(classifyWithContext(candidate)).toBe('excluded_control_evidence');
      expect(exactSet.targets).not.toContain(candidate);
    }
    expect(
      classifyWithContext(
        normalize(
          `${context.evidenceRoot}/${context.classification.unregisteredRelativePath}`
        )
      )
    ).toBe('unregistered');
  });
});
