import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime write-context script contract', () => {
  it('documents explicit target file usage and no longer presents root runtime-context.json as the target model', () => {
    const root = process.cwd();
    const script = readFileSync(path.join(root, 'scripts', 'write-runtime-context.js'), 'utf8');

    expect(script).toContain('Usage: node scripts/write-runtime-context.js <targetFile>');
    expect(script).toContain("const targetFileArg = process.argv[2]");
    expect(script).not.toContain('Write `.bmad/runtime-context.json`');
    expect(script).not.toContain("const root = process.argv[2]");
  });
});
