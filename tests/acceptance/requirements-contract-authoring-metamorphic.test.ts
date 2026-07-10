import { describe, expect, it } from 'vitest';
import {
  closedModelForSource,
  semanticModelHash,
} from './helpers/requirements-contract-autonomous-compiler-fixture';

function sourceWithRequirement(requirementLine: string): string {
  return [
    '# Metamorphic Source',
    '',
    '## Functional Requirements',
    '',
    requirementLine,
    '',
    'Target path: `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts`',
    'Command: `npx vitest run tests/acceptance/requirements-contract-authoring-metamorphic.test.ts`',
  ].join('\n');
}

describe('requirements contract authoring metamorphic invariants', () => {
  it('keeps equivalent requirement ID spellings on the same semantic model hash', () => {
    const variants = [
      sourceWithRequirement('FR ID 1: The autonomous compiler MUST close before render.'),
      sourceWithRequirement('FR-001: The autonomous compiler MUST close before render.'),
      sourceWithRequirement('| FR ID | Requirement |\n| --- | --- |\n| FR_1 | The autonomous compiler MUST close before render. |'),
    ];
    const hashes = variants.map((source) => semanticModelHash(closedModelForSource(source)));

    expect(new Set(hashes)).toHaveLength(1);
  });

  it('closes deterministic seeded source-shape property cases to zero measure', () => {
    const rows = Array.from({ length: 16 }, (_item, index) => {
      const id = index % 2 === 0 ? `FR ID ${index + 1}` : `FR-${String(index + 1).padStart(3, '0')}`;
      const path =
        index % 3 === 0
          ? '`packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts`'
          : '`tests/acceptance/requirements-contract-authoring-metamorphic.test.ts`';
      return sourceWithRequirement(`${id}: Requirement ${index + 1} MUST retain semantic closure.\nTarget path: ${path}`);
    });

    const models = rows.map(closedModelForSource);
    expect(models.every((model) => model.invariantClosure.remainingIssueCount === 0)).toBe(true);
    expect(models.every((model) => model.invariantClosure.measureAfter?.unresolvedInvariantCount === 0)).toBe(true);
    expect(models.every((model) => model.invariantClosure.measureAfter?.missingProjectionCount === 0)).toBe(true);
    expect(new Set(models.map(semanticModelHash)).size).toBe(rows.length);
  });
});
