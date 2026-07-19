import { randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateSourceRootOmissionCases,
  type SourceRootOmissionEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import {
  REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY,
  extractRegisteredSourceRootCandidates,
  validateRegisteredSourceRootInventory,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-root-registry';

type RegistryEntry = (typeof REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY)[number];

function markdownCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ').trim();
}

function renderSource(): { sourcePath: string; sourceText: string } {
  const offset = 100 + (randomBytes(1)[0] % 500);
  const sections = REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY.map(
    (entry: RegistryEntry, index) => {
      const columns = [
        'ID',
        ...entry.fields.map((field) => field.sourceColumns[0]),
        ...entry.relatedRefColumns.map((field) => field.sourceColumns[0]),
      ];
      const values = [
        `${entry.sourceIdPrefix}-${String(offset + index).padStart(3, '0')}`,
        ...entry.fields.map(
          (field) => `${entry.rootClass} ${field.bodyField} ${randomUUID()}`
        ),
        ...entry.relatedRefColumns.map(() => 'none'),
      ];
      return [
        `## ${entry.sourceSection}`,
        '',
        `| ${columns.map(markdownCell).join(' | ')} |`,
        `| ${columns.map(() => '---').join(' | ')} |`,
        `| ${values.map(markdownCell).join(' | ')} |`,
      ].join('\n');
    }
  );
  return {
    sourcePath: `docs/requirements/source-root-${randomUUID()}.md`,
    sourceText: ['# Source Root evaluation', '', ...sections].join('\n\n'),
  };
}

function omissionCases(): SourceRootOmissionEvaluationCase[] {
  const { sourcePath, sourceText } = renderSource();
  const roots = extractRegisteredSourceRootCandidates({ sourcePath, sourceText });
  const baseline = validateRegisteredSourceRootInventory({
    sourcePath,
    sourceText,
    sourceRoots: roots,
  });
  expect(baseline.decision).toBe('pass');
  return roots.map((omitted) => {
    const result = validateRegisteredSourceRootInventory({
      sourcePath,
      sourceText,
      sourceRoots: roots.filter((root) => root.sourceRootId !== omitted.sourceRootId),
    });
    return {
      caseRef: omitted.sourceRootId,
      rootClass: omitted.rootClass,
      mutationDetected:
        result.decision === 'block' &&
        result.missingRootIds.includes(omitted.sourceRootId),
    };
  });
}

describe('requirements contract Source Root omission evaluation', () => {
  it('detects every Requirement, NEG, and Acceptance root omission', () => {
    const cases = omissionCases();

    const result = evaluateSourceRootOmissionCases(cases);

    expect(result.requirementRootOmissionDetectionRate).toBe(1);
    expect(result.negativeRootOmissionDetectionRate).toBe(1);
    expect(result.acceptanceRootOmissionDetectionRate).toBe(1);
    expect(result.undetectedMutationCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks when one required root omission escapes detection', () => {
    const cases = omissionCases();
    const requirementCase = cases.find((item) =>
      ['functional_requirement', 'non_functional_requirement'].includes(item.rootClass)
    );
    expect(requirementCase).toBeDefined();
    const mutated = cases.map((item) =>
      item.caseRef === requirementCase?.caseRef
        ? { ...item, mutationDetected: false }
        : item
    );

    const result = evaluateSourceRootOmissionCases(mutated);

    expect(result.requirementRootOmissionDetectionRate).toBeLessThan(1);
    expect(result.undetectedMutationCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
