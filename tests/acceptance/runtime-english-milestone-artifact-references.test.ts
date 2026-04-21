import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime english milestone artifact references', () => {
  it('keeps milestone contracts discoverable from tracked runtime governance references', () => {
    const root = process.cwd();
    const hooksReference = readFileSync(
      path.join(root, 'docs', 'reference', 'cursor-runtime-governance-hooks.md'),
      'utf8'
    );
    expect(hooksReference).toContain('Cursor native hooks 配置入口');
    expect(hooksReference).toContain('story-scoped runtime context');
  });
});
