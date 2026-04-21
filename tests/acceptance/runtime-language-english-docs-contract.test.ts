import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime language english docs contract', () => {
  it('keeps english-mode requirements explicit across tracked locale and runtime governance docs', () => {
    const root = process.cwd();
    const localeDoc = readFileSync(
      path.join(root, 'docs', 'how-to', 'runtime-locale-and-i18n-config.md'),
      'utf8'
    );
    const emitSchemaDoc = readFileSync(
      path.join(root, 'docs', 'reference', 'runtime-policy-emit-schema.md'),
      'utf8'
    );
    const governanceDoc = readFileSync(
      path.join(root, 'docs', 'how-to', 'runtime-governance-auto-inject-cursor-claude.md'),
      'utf8'
    );

    expect(localeDoc).toContain('languagePolicy');
    expect(localeDoc).toContain('resolvedMode');
    expect(localeDoc).toContain('英文模板');
    expect(emitSchemaDoc).toContain('_bmad-output/runtime/registry.json');
    expect(governanceDoc).toContain('RuntimePolicy schema');
    expect(governanceDoc).toContain('.cursor/hooks.json');
  });
});
