import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime init write-context cli usage', () => {
  it('uses explicit target context file path when bootstrapping runtime context from init script', () => {
    const root = process.cwd();
    const initScript = readFileSync(path.join(root, 'scripts', 'init-to-root.js'), 'utf8');

    expect(initScript).toContain("'_bmad-output', 'runtime', 'context', 'project.json'");
    expect(initScript).toContain("[script, targetContext, 'story', 'story_create']");
    expect(initScript).not.toContain("[script, targetDir, 'story', 'specify']");
  });
});
