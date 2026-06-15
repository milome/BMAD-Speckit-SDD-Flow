import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const HARD_CODED_LARGE_DOCUMENT_WRITER =
  'packages/bmad-speckit/src/utils/large-document-writer';

function listFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    if (entry.isFile()) files.push(full);
  }
  return files;
}

describe('skill runtime resolver contract', () => {
  it('exports the shared runtime dependency resolver API', () => {
    const resolverPath = path.join(
      ROOT,
      '_bmad',
      'shared',
      'skill-runtime',
      'resolve-bmad-runtime.js'
    );
    expect(fs.existsSync(resolverPath)).toBe(true);

    const requireResolver = createRequire(import.meta.url);
    const resolver = requireResolver(resolverPath);
    expect(typeof resolver.requireBmadSpeckit).toBe('function');
    expect(typeof resolver.requireRootPackageDependency).toBe('function');
    expect(typeof resolver.requireLargeDocumentWriter).toBe('function');
    expect(typeof resolver.requireJsYaml).toBe('function');
  });

  it('does not hardcode monorepo-only large-document-writer paths in skill/shared scripts', () => {
    const scriptFiles = [
      ...listFiles(path.join(ROOT, '_bmad', 'skills')),
      ...listFiles(path.join(ROOT, '_bmad', 'shared')),
      ...listFiles(path.join(ROOT, '.codex', 'skills')),
      ...listFiles(path.join(ROOT, '.codex', 'shared')),
    ].filter((file) => /\.(?:cjs|js|mjs|ts)$/u.test(file));

    const offenders = scriptFiles
      .filter((file) =>
        fs.readFileSync(file, 'utf8').replace(/\\/gu, '/').includes(HARD_CODED_LARGE_DOCUMENT_WRITER)
      )
      .map((file) => path.relative(ROOT, file).replace(/\\/gu, '/'));

    expect(offenders).toEqual([]);
  });
});
