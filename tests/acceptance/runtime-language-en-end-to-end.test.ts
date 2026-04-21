import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime language en end-to-end', () => {
  it('documents language policy resolution and english audit-template selection on tracked docs', () => {
    const repoRoot = process.cwd();
    const localeDoc = readFileSync(
      path.join(repoRoot, 'docs', 'how-to', 'runtime-locale-and-i18n-config.md'),
      'utf8'
    );
    const governanceDoc = readFileSync(
      path.join(repoRoot, 'docs', 'how-to', 'runtime-governance-auto-inject-cursor-claude.md'),
      'utf8'
    );

    expect(localeDoc).toContain('languagePolicy');
    expect(localeDoc).toContain('resolvedMode');
    expect(localeDoc).toContain('audit-prompts');
    expect(localeDoc).toContain('project.json');
    expect(governanceDoc).toContain('RuntimePolicy schema');
    expect(governanceDoc).toContain('Cursor native hooks');
  });
});
