import { describe, expect, it } from 'vitest';
import * as sourceRootRegistry from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-root-registry';
import {
  REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY,
  SOURCE_ROOT_CLASS_REGISTRY_HASH,
  SOURCE_ROOT_CLASS_REGISTRY_VERSION,
  extractRegisteredSourceRootCandidates,
  validateRegisteredSourceRootInventory,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-root-registry';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const REQUIRED_ROOT_CLASSES = [
  'goal_outcome',
  'actor',
  'trigger',
  'user_journey',
  'functional_requirement',
  'non_functional_requirement',
  'negative_requirement',
  'constraint',
  'out_of_scope_boundary',
  'rule',
  'threshold',
  'condition',
  'state',
  'failure',
  'retry',
  'compensation',
  'idempotency',
  'ordering',
  'temporal',
  'target_ownership',
  'acceptance',
  'evidence_requirement',
  'unresolved_decision',
] as const;

type RegistryEntry = (typeof REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY)[number];

function markdownCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ').trim();
}

function sourceId(entry: RegistryEntry, index: number): string {
  return `${entry.sourceIdPrefix}-${String(index + 101).padStart(3, '0')}`;
}

function renderEntryTable(entry: RegistryEntry, index: number): string {
  const columns = [
    'ID',
    ...entry.fields.map((field) => field.sourceColumns[0]),
    ...entry.relatedRefColumns.map((field) => field.sourceColumns[0]),
  ];
  const values = [
    sourceId(entry, index),
    ...entry.fields.map((field) => `${entry.rootClass} ${field.bodyField} ${index + 1}`),
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

function renderRegisteredSource(entries: readonly RegistryEntry[]): string {
  return [
    '# Registry-derived Source PRD',
    '',
    ...entries.flatMap((entry) => {
      const registryIndex = REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY.findIndex(
        (candidate) => candidate.registryId === entry.registryId
      );
      return [renderEntryTable(entry, registryIndex), ''];
    }),
  ].join('\n');
}

describe('requirements contract Source Root omission mutation', () => {
  it('publishes one hash-bound registry covering every contract-required atomic Root class', () => {
    const registeredClasses = new Set(
      REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY.map((entry) => entry.rootClass)
    );

    expect(SOURCE_ROOT_CLASS_REGISTRY_VERSION).toBe(
      'requirements-contract-source-root-class-registry/v2'
    );
    expect([...registeredClasses].sort()).toEqual(
      expect.arrayContaining([...REQUIRED_ROOT_CLASSES].sort())
    );
    expect(SOURCE_ROOT_CLASS_REGISTRY_HASH).toBe(
      sha256Stable({
        schemaVersion: SOURCE_ROOT_CLASS_REGISTRY_VERSION,
        entries: REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY,
      })
    );
  });

  it('extracts stable registry-derived IDs and direct V2 requirement bodies without scenario fixtures', () => {
    const forwardSource = renderRegisteredSource(
      REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY
    );
    const reverseSource = renderRegisteredSource(
      [...REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY].reverse()
    );
    const forward = extractRegisteredSourceRootCandidates({
      sourcePath: 'docs/requirements/registry-derived-source.md',
      sourceText: forwardSource,
    });
    const reverse = extractRegisteredSourceRootCandidates({
      sourcePath: 'docs/requirements/registry-derived-source.md',
      sourceText: reverseSource,
    });

    expect(forward.map((root) => root.sourceRootId).sort()).toEqual(
      reverse.map((root) => root.sourceRootId).sort()
    );
    expect(new Set(forward.map((root) => root.sourceRootId)).size).toBe(forward.length);
    for (const requiredClass of REQUIRED_ROOT_CLASSES) {
      expect(
        forward.some((root) => root.rootClass === requiredClass),
        requiredClass
      ).toBe(true);
    }
    for (const requirementRoot of forward.filter(
      (root) =>
        root.rootClass === 'functional_requirement' ||
        root.rootClass === 'non_functional_requirement' ||
        root.rootClass === 'negative_requirement' ||
        root.rootClass === 'out_of_scope_boundary'
    )) {
      expect(requirementRoot.bodySchemaVersion).toBe(
        'requirement-contract-requirement/v2'
      );
      expect(requirementRoot.semanticBody).toMatchObject({
        id: requirementRoot.sourceRootId,
        schemaVersion: 'requirement-contract-requirement/v2',
      });
    }
  });

  it('extracts lineage witnesses without materializing semantic bodies before Lineage validation', () => {
    const extractWitnesses = (
      sourceRootRegistry as unknown as {
        extractRegisteredSourceRootLineageWitnesses?: (input: {
          sourcePath: string;
          sourceText: string;
        }) => Array<Record<string, unknown>>;
      }
    ).extractRegisteredSourceRootLineageWitnesses;
    expect(extractWitnesses).toBeTypeOf('function');
    if (!extractWitnesses) return;

    const sourcePath = 'docs/requirements/registry-lineage-witness-source.md';
    const sourceText = renderRegisteredSource(
      REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY
    );
    const witnesses = extractWitnesses({ sourcePath, sourceText });
    const candidates = extractRegisteredSourceRootCandidates({ sourcePath, sourceText });
    const candidateWitnesses = candidates.map((candidate) => ({
      sourceRootId: candidate.sourceRootId,
      sourcePath: candidate.sourcePath,
      sourceSpan: candidate.sourceSpan,
      authorityClass: candidate.proposedAuthorityClass,
    }));

    expect(witnesses).toEqual(candidateWitnesses);
    for (const witness of witnesses) {
      expect(witness).not.toHaveProperty('semanticBody');
      expect(witness).not.toHaveProperty('sourceContent');
    }
  });

  it('excludes generated implementationConfirmation bytes from Source Root authority hashes', () => {
    const authoritySource = renderRegisteredSource(
      REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY
    );
    const withProjection = `${authoritySource}
implementationConfirmation:
  status: draft
  confirmationRender:
    hash: sha256:${'1'.repeat(64)}
`;
    const withChangedProjection = withProjection.replace(
      `sha256:${'1'.repeat(64)}`,
      `sha256:${'2'.repeat(64)}`
    );
    const sourcePath = 'docs/requirements/registry-projection-source.md';
    const baseline = extractRegisteredSourceRootCandidates({
      sourcePath,
      sourceText: withProjection,
    });
    const withoutProjection = extractRegisteredSourceRootCandidates({
      sourcePath,
      sourceText: authoritySource,
    });
    const projectionChanged = extractRegisteredSourceRootCandidates({
      sourcePath,
      sourceText: withChangedProjection,
    });

    expect(withoutProjection).toEqual(baseline);
    expect(projectionChanged).toEqual(baseline);

    const requirementText = 'functional_requirement text 5';
    const authorityChanged = extractRegisteredSourceRootCandidates({
      sourcePath,
      sourceText: withProjection.replace(
        requirementText,
        `${requirementText} with authority change`
      ),
    });
    expect(
      authorityChanged.find((root) => root.sourceRootId === 'MUST-FR-105')?.semanticBody
    ).not.toEqual(
      baseline.find((root) => root.sourceRootId === 'MUST-FR-105')?.semanticBody
    );
  });

  it('blocks omission or class mutation of every material registry-derived Source Root', () => {
    const sourceText = renderRegisteredSource(
      REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY
    );
    const roots = extractRegisteredSourceRootCandidates({
      sourcePath: 'docs/requirements/registry-omission-source.md',
      sourceText,
    });
    const baseline = validateRegisteredSourceRootInventory({
      sourcePath: 'docs/requirements/registry-omission-source.md',
      sourceText,
      sourceRoots: roots,
    });

    expect(baseline).toMatchObject({
      decision: 'pass',
      missingRootIds: [],
      extraRootIds: [],
      rootClassMismatchIds: [],
    });

    for (const omitted of roots) {
      const result = validateRegisteredSourceRootInventory({
        sourcePath: 'docs/requirements/registry-omission-source.md',
        sourceText,
        sourceRoots: roots.filter((root) => root.sourceRootId !== omitted.sourceRootId),
      });
      expect(result.decision, omitted.sourceRootId).toBe('block');
      expect(result.missingRootIds, omitted.sourceRootId).toContain(omitted.sourceRootId);
    }

    const mutated = roots.map((root, index) =>
      index === 0 ? { ...root, rootClass: 'unregistered_mutation' } : root
    );
    const mutationResult = validateRegisteredSourceRootInventory({
      sourcePath: 'docs/requirements/registry-omission-source.md',
      sourceText,
      sourceRoots: mutated,
    });
    expect(mutationResult.decision).toBe('block');
    expect(mutationResult.rootClassMismatchIds).toContain(roots[0].sourceRootId);
  });
});
