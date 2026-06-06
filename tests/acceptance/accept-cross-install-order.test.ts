import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cross install order', () => {
  it('documents durable project-local install and source-maintainer fallback', () => {
    const doc = readFileSync('docs/tutorials/getting-started.md', 'utf8');
    expect(doc).toContain('npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest');
    expect(doc).toContain('npx --no-install bmad-speckit init');
    expect(doc).toContain('--ai claude,cursor-agent,codex');
    expect(doc).toContain('--ai cursor-agent');
    expect(doc).toContain('--agent cursor');
    expect(doc).toContain('源码维护者路径');
  });
});
