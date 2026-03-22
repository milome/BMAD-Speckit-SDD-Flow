import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime-policy removes speckit fallback', () => {
  it('does not let emit-runtime-policy use removed speckit fallback logic', () => {
    const repoRoot = process.cwd();
    const emitSource = readFileSync(
      path.join(repoRoot, 'scripts', 'emit-runtime-policy.ts'),
      'utf8'
    );

    expect(emitSource).not.toContain('removed fallback helper');
    expect(emitSource).not.toContain('.speckit-state.yaml');
  });
});
