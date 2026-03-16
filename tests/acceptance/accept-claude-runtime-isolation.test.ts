import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('claude runtime isolation', () => {
  it('creates dedicated claude runtime paths', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain('.claude/state');
    expect(script).toContain('.claude/hooks');
  });

  it('wraps Windows npm-based audits through cmd.exe', () => {
    const script = readFileSync('scripts/speckit-cli.ts', 'utf8');
    expect(script).toContain('function buildCrossPlatformCommand');
    expect(script).toContain("process.platform !== 'win32'");
    expect(script).toContain('cmd.exe');
    expect(script).toContain('/d /s /c');
  });
});
