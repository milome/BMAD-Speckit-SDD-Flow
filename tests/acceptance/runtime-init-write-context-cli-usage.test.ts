import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime init write-context cli usage', () => {
  it('uses a bootstrap-only context path and does not seed a dummy active story', () => {
    const root = process.cwd();
    const initScript = readFileSync(path.join(root, 'scripts', 'init-to-root.js'), 'utf8');

    expect(initScript).toContain("'_bmad-output', 'runtime', 'context', 'bootstrap.json'");
    expect(initScript).toContain("[script, targetContext, 'unknown', 'specify']");
    expect(initScript).toContain(
      'bootstrap context only; no active requirement record is selected during init'
    );
    expect(initScript).not.toContain("[script, targetContext, 'story', 'story_create']");
    expect(initScript).not.toContain("[script, targetDir, 'story', 'specify']");
  });
});
