import { describe, expect, it } from 'vitest';
import {
  canonicalRequirementSourceId,
  normalizeRequirementSourceInput,
  type RequirementSourceInput,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';

const SOURCE_TEXT = [
  '# Session Intake',
  '',
  'FR ID: 1 must keep `src/app/widget.ts` synchronized with `tests/widget.test.ts`.',
  'NFR_002: 延迟必须低于 100ms，并记录到 `docs/plans/`。',
  'Validation command: pytest tests/test_widget.py',
  'Windows target: `C:\\repo\\project\\src\\app\\widget.ts`',
  'Remote reference: https://example.test/specs/widget',
  'Root manifest: package.json',
  '',
  '```powershell',
  'npx vitest run tests/acceptance/widget.test.ts',
  '```',
  '',
  '## Current Target State Projection',
  'stale generated projection from an earlier run',
  '',
  'implementationConfirmation:',
  '  status: draft',
  '',
].join('\n');

describe('requirements contract source normalization', () => {
  it('defines all RequirementSourceInput variants and normalizes them to a lossless AST', () => {
    const variants: RequirementSourceInput[] = [
      { kind: 'session_prompt', sourceText: SOURCE_TEXT, sourcePath: 'prompt.md', inputChannel: 'file' },
      { kind: 'prd_draft', sourceText: SOURCE_TEXT, sourcePath: 'prd.md', inputChannel: 'file' },
      { kind: 'existing_contract', sourceText: SOURCE_TEXT, sourcePath: 'contract.md', inputChannel: 'file' },
      { kind: 'intake_document', sourceText: SOURCE_TEXT, sourcePath: 'intake.md', inputChannel: 'file' },
    ];

    for (const variant of variants) {
      const ast = normalizeRequirementSourceInput(variant);
      expect(ast.schemaVersion).toBe('requirement-source-ast/v1');
      expect(ast.inputKind).toBe(variant.kind);
      expect(ast.sourceHash).toMatch(/^sha256:/);
      expect(ast.normalizedHash).toMatch(/^sha256:/);
      expect(ast.headings.map((heading) => heading.text)).toContain('Session Intake');
      expect(ast.blocks.some((block) => block.span.startLine > 0 && block.hash.startsWith('sha256:'))).toBe(true);
      expect(ast.fences[0]).toMatchObject({ language: 'powershell' });
      expect(ast.languageSignals).toMatchObject({
        primary: 'mixed',
        containsChinese: true,
        containsEnglish: true,
      });
      expect(ast.staleProjectionBoundaries.map((boundary) => boundary.kind)).toEqual([
        'current_target_projection',
        'generated_projection',
        'implementation_confirmation',
      ]);
    }
  });

  it('normalizes declared ID header and ordinal variants to canonical stable IDs', () => {
    expect(canonicalRequirementSourceId('FR-1')).toBe('FR-001');
    expect(canonicalRequirementSourceId('FR ID: 001')).toBe('FR-001');
    expect(canonicalRequirementSourceId('FR_0001')).toBe('FR-001');
    expect(canonicalRequirementSourceId('NFR ID 2')).toBe('NFR-002');

    const ast = normalizeRequirementSourceInput({
      kind: 'prd_draft',
      sourceText: ['| FR ID | Text |', '|---|---|', '| FR-1 | A |', '| FR ID: 001 | B |'].join('\n'),
    });
    expect(ast.canonicalIds.map((id) => id.canonical)).toContain('FR-001');
    expect(new Set(ast.canonicalIds.map((id) => id.canonical)).size).toBe(1);
  });

  it('extracts Windows, POSIX, root-file, directory, URL, fenced, and unfenced paths plus commands', () => {
    const ast = normalizeRequirementSourceInput({ kind: 'intake_document', sourceText: SOURCE_TEXT });

    expect(ast.paths.windows).toContain('C:\\repo\\project\\src\\app\\widget.ts');
    expect(ast.paths.posix).toEqual(expect.arrayContaining(['src/app/widget.ts', 'tests/widget.test.ts']));
    expect(ast.paths.directories).toContain('docs/plans/');
    expect(ast.paths.rootFiles).toContain('package.json');
    expect(ast.paths.urls).toContain('https://example.test/specs/widget');
    expect(ast.paths.fenced).toContain('tests/acceptance/widget.test.ts');
    expect(ast.paths.unfenced).toContain('tests/test_widget.py');
    expect(ast.commands.unfenced).toContain('pytest tests/test_widget.py');
    expect(ast.commands.fenced).toContain('npx vitest run tests/acceptance/widget.test.ts');
  });

  it('normalizes recoverable markdown table shapes before source PRD lint can block them', () => {
    const ast = normalizeRequirementSourceInput({
      kind: 'existing_contract',
      sourceText: ['# Recoverable', '| FR ID | Text |', '|---|---|', '| FR-1 | Keep going |'].join('\n'),
    });
    expect(ast.recoverableShapes).toContain('markdown_table_alignment');
    expect(ast.canonicalIds.map((id) => id.canonical)).toContain('FR-001');
  });
});
