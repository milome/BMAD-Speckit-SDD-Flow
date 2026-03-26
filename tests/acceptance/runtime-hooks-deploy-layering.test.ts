import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime hooks deploy layering', () => {
  it('deploys cursor adapters from _bmad/cursor/hooks and shared helpers from _bmad/runtime/hooks', () => {
    const source = readFileSync(path.join(process.cwd(), 'scripts', 'init-to-root.js'), 'utf8');

    expect(source).toContain("const sharedDir = path.join(bmadRoot, 'runtime', 'hooks')");
    expect(source).toContain("const cursorHooksDir = path.join(bmadRoot, 'cursor', 'hooks')");
    expect(source).not.toContain("const fallbackDir = path.join(bmadRoot, 'claude', 'hooks')");
    expect(source).toContain('copyRecursive(sharedDir, destDir)');
    expect(source).toContain('const src = path.join(cursorHooksDir, name)');
    expect(source).not.toContain('const src = fs.existsSync(primary) ? primary : fallback');
  });

  it('deploys claude adapters from _bmad/claude/hooks and shared helpers from _bmad/runtime/hooks', () => {
    const source = readFileSync(path.join(process.cwd(), 'scripts', 'init-to-root.js'), 'utf8');

    expect(source).toContain('function syncClaudeRuntimePolicyHooks(targetDir, bmadRoot)');
    expect(source).toContain("const claudeHooksDir = path.join(bmadRoot, 'claude', 'hooks')");
    expect(source).toContain("path.join('.claude', 'hooks')");
    expect(source).toContain('syncClaudeRuntimePolicyHooks(targetDir, bmadRoot)');
  });
});
