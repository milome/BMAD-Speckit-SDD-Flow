import { describe, expect, it } from 'vitest';
import { deriveRequirementsContractFrozenUniverseFromText } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-frozen-universe';

const HASH_01 = `sha256:${'1'.repeat(64)}`;
const HASH_02 = `sha256:${'2'.repeat(64)}`;

function contractText(overrides: string[] = []) {
  return [
    '# Goal Execution Contract',
    '',
    '<!-- goal-slot:frontMatter required dynamic=frontMatter -->',
    '---',
    'sourceObligationRange: S001-S003',
    'sourceAmendmentId: AMEND-01+AMEND-02',
    `amend01SourceHash: ${HASH_01}`,
    'amend01Authority: authority/amend-01',
    `amend02SourceHash: ${HASH_02}`,
    'amend02AuthorityPath: authority/amend-02.md',
    'taskRange: G00-G01',
    'acceptanceRange: AC-01-AC-04',
    ...overrides,
    '---',
    '<!-- /goal-slot:frontMatter -->',
    '',
    'The effective universes remain exactly:',
    '',
    '```text',
    'G00-G01',
    'S001-S003',
    'AC-01-AC-04',
    'TR-01-TR-04',
    'CMD-01-CMD-05',
    'EVD-00-EVD-02',
    'ARTIFACT-01-ARTIFACT-07',
    'DSA-01-DSA-02',
    'MS-01-MS-03',
    'STAGE-01-STAGE-02',
    '```',
    '',
  ].join('\n');
}

describe('requirements contract frozen universe', () => {
  it('derives ordered universes and amendment bindings from the effective contract', () => {
    const universe = deriveRequirementsContractFrozenUniverseFromText(contractText());

    expect(universe).toMatchObject({
      taskIds: ['G00', 'G01'],
      sourceIds: ['S001', 'S002', 'S003'],
      acceptanceIds: ['AC-01', 'AC-02', 'AC-03', 'AC-04'],
      traceIds: ['TR-01', 'TR-02', 'TR-03', 'TR-04'],
      commandIds: ['CMD-01', 'CMD-02', 'CMD-03', 'CMD-04', 'CMD-05'],
      evidenceIds: ['EVD-00', 'EVD-01', 'EVD-02'],
      artifactIds: [
        'ARTIFACT-01',
        'ARTIFACT-02',
        'ARTIFACT-03',
        'ARTIFACT-04',
        'ARTIFACT-05',
        'ARTIFACT-06',
        'ARTIFACT-07',
      ],
      artifactIndexIds: [
        'ARTIFACT-02',
        'ARTIFACT-03',
        'ARTIFACT-04',
        'ARTIFACT-05',
        'ARTIFACT-06',
        'ARTIFACT-07',
      ],
      sourceAmendmentHashes: [HASH_01, HASH_02],
    });
    expect(universe.sourceAmendments).toEqual([
      { amendmentId: 'AMEND-01', authority: 'authority/amend-01', hash: HASH_01 },
      { amendmentId: 'AMEND-02', authority: 'authority/amend-02.md', hash: HASH_02 },
    ]);
  });

  it('fails closed when a declared amendment lacks its hash binding', () => {
    const text = contractText(['amend02SourceHash: missing']);

    expect(() => deriveRequirementsContractFrozenUniverseFromText(text)).toThrow(
      'contract_universe_source_amendment_hash_invalid:AMEND-02'
    );
  });
});
