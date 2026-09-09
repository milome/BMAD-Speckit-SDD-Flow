import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function packMembers(): string[] {
  const output = execSync('npm.cmd pack --dry-run --json --ignore-scripts', {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, npm_config_loglevel: 'error' },
  });
  const start = output.search(/\[\s*\{\s*"id"/u);
  expect(start).toBeGreaterThanOrEqual(0);
  const payload = JSON.parse(output.slice(start)) as Array<{
    files: Array<{ path: string }>;
  }>;
  return payload[0].files.map(({ path }) => path).sort();
}

describe('root package archive boundary', () => {
  it('excludes workspace draft/archive/artifact junk while retaining required runtime assets', () => {
    const members = packMembers();
    const junk = members.filter((member) =>
      /(^|\/)(?:\.obsidian|\.artifacts)(?:\/|$)|\.draft(?:\/|$)|\.archive-|\.backup-|^(?:console\.log|\{console)/u.test(member)
    );

    expect(junk).toEqual([]);
    expect(members).toContain('_bmad/shared/goal-contract/goal-execution-ir.schema.json');
    expect(members).toContain('_bmad/skills/req-trace-matrix-prompt-generator/SKILL.md');
    expect(
      members.some((member) =>
        /(?:^|\/)bmad-speckit\/dist\/commands\/large-doc\.js$/u.test(member)
      )
    ).toBe(true);
    expect(readFileSync(join(ROOT, 'packages/bmad-speckit/package.json'), 'utf8')).toContain(
      '"files"'
    );
  });
});
