import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime init wiring target', () => {
  it('no longer documents bootstrap to legacy root runtime-context path in init script comments', () => {
    const root = process.cwd();
    const initScript = readFileSync(path.join(root, 'scripts', 'init-to-root.js'), 'utf8');

    expect(initScript).not.toContain('Bootstrap `.bmad/runtime-context.json`');
    expect(initScript).toContain('write-runtime-context');
  });
});
