import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRequirementsContractSourceText } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-parser';

describe('requirements contract canonical source parser', () => {
  it('parses BOM and CRLF tables without splitting escaped, code-span, or link pipes', () => {
    const source = [
      '\uFEFF# Contract',
      '',
      '## Functional Requirements',
      '| ID | Behavior | Oracle |',
      '|---|---|---|',
      '| FR-001 | Visible \\| value | `a|b` and [proof|ref](docs/proof.md) |',
      '',
      '```md',
      '| ID | Behavior | Oracle |',
      '|---|---|---|',
      '| FR-999 | fenced | ignored |',
      '```',
    ].join('\r\n');

    const result = parseRequirementsContractSourceText(source, {
      sourcePath: 'docs/requirements/source.md',
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.document).toMatchObject({
      schemaVersion: 'requirements-contract-markdown-source-ast/v1',
      sourcePath: 'docs/requirements/source.md',
      hadBom: true,
      lineEnding: 'crlf',
    });
    expect(result.document?.tables).toHaveLength(1);
    expect(result.document?.tables[0]).toMatchObject({
      headingPath: ['Contract', 'Functional Requirements'],
      columns: ['ID', 'Behavior', 'Oracle'],
      startLine: 4,
      endLine: 6,
    });
    expect(result.document?.tables[0]?.rows).toEqual([
      expect.objectContaining({
        startLine: 6,
        cells: {
          ID: 'FR-001',
          Behavior: 'Visible | value',
          Oracle: '`a|b` and [proof|ref](docs/proof.md)',
        },
      }),
    ]);
  });

  it('fails closed when a table row has a different column count', () => {
    const result = parseRequirementsContractSourceText(
      [
        '# Contract',
        '',
        '## Functional Requirements',
        '| ID | Behavior | Oracle |',
        '|---|---|---|',
        '| FR-001 | missing oracle |',
      ].join('\n'),
      { sourcePath: 'docs/requirements/invalid-table.md' }
    );

    expect(result.ok).toBe(false);
    expect(result.document).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'markdown_table_column_count_mismatch',
        sourcePath: 'docs/requirements/invalid-table.md',
        startLine: 6,
        endLine: 6,
      }),
    ]);
  });

  it('rejects duplicate top-level YAML authority roots outside fences', () => {
    const result = parseRequirementsContractSourceText(
      [
        '# Contract',
        '',
        'implementationConfirmation:',
        '  status: draft',
        '',
        'implementationConfirmation:',
        '  status: confirmation_ready',
      ].join('\n'),
      { sourcePath: 'docs/requirements/duplicate-authority.md' }
    );

    expect(result.ok).toBe(false);
    expect(result.document).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'duplicate_yaml_root_block',
        sourcePath: 'docs/requirements/duplicate-authority.md',
        startLine: 6,
        endLine: 7,
        refs: ['implementationConfirmation', '3'],
      }),
    ]);
  });

  it('is the only Markdown table parser used by the Source PRD linter', () => {
    const linterSource = readFileSync(
      path.resolve(
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/lint-requirements-contract-source-prd.ts'
      ),
      'utf8'
    );

    expect(linterSource).toContain("from './requirements-contract-source-parser'");
    expect(linterSource).not.toMatch(/function parseTable\(/u);
    expect(linterSource).not.toMatch(/function splitTableLine\(/u);
    expect(linterSource).not.toContain(".split('|')");
  });
});
