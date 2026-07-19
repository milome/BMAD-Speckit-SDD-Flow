import { describe, expect, it } from 'vitest';
import { parseRequirementsContractSourceText } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-parser';

function semanticProjection(source: string) {
  const result = parseRequirementsContractSourceText(source, {
    sourcePath: 'docs/requirements/adversarial-source.md',
  });
  expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  if (!result.ok) throw new Error('expected parser success');
  return {
    headings: result.document.headings,
    tables: result.document.tables,
    yamlRootBlocks: result.document.yamlRootBlocks,
    blocks: result.document.blocks,
  };
}

describe('requirements contract Source PRD parser adversarial corpus', () => {
  it('ignores authority-shaped front matter and fenced examples while preserving one real authority block', () => {
    const source = [
      '---',
      'implementationConfirmation:',
      '  status: metadata_only',
      '---',
      '# Contract',
      '',
      '```yaml',
      'implementationConfirmation:',
      '  status: example_only',
      '```',
      '',
      'implementationConfirmation:',
      '  status: draft',
      '  note: |',
      '    first line',
      '    second line',
      '',
    ].join('\n');
    const result = parseRequirementsContractSourceText(source, {
      sourcePath: 'docs/requirements/front-matter-authority.md',
    });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) throw new Error('expected parser success');
    expect(result.document.yamlRootBlocks).toHaveLength(1);
    expect(result.document.yamlRootBlocks[0]).toMatchObject({
      key: 'implementationConfirmation',
      rawText: expect.stringContaining('second line'),
    });
  });

  it('normalizes BOM and mixed line endings without changing semantic extraction', () => {
    const lines = [
      '# Contract',
      '',
      '## Requirements',
      '| ID | Behavior | Oracle |',
      '|---|---|---|',
      '| FR-001 | escaped \\| value | ``a|b`` and [proof|ref](proof.md) |',
      '',
      'implementationConfirmation:',
      '  status: draft',
      '',
    ];
    const lf = lines.join('\n');
    const mixed =
      `\uFEFF${lines.slice(0, 3).join('\r\n')}\r\n` +
      `${lines.slice(3, 7).join('\n')}\n` +
      lines.slice(7).join('\r');

    expect(semanticProjection(mixed)).toEqual(semanticProjection(lf));
  });
});
