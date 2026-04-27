import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(import.meta.dirname, '..', '..');

const SCAN_ROOTS = [
  '_bmad/codex/agents',
  '_bmad/codex/skills',
  '_bmad/codex/protocols',
  '.codex/commands',
];

const FORBIDDEN_PATTERNS = [
  /\.claude[\\/]/i,
  /Claude Code CLI/i,
  /Cursor Task/i,
  /oh-my-claudecode/i,
  /OMC reviewer/i,
  /\bgeneralPurpose\b/i,
  /claude carrier adapter/i,
  /\.cursor[\\/]/i,
  /\bmcp_task\b/i,
  /Claude\/OMC/i,
  /Cursor Command/i,
  /Cursor speckit/i,
  /\bnpm run main-agent/i,
  /\bnpx ts-node scripts\//i,
  /scripts\/bmad-config\.ts/i,
  /scripts\/parse-bmad-audit-result\.ts/i,
];

const ALLOWLIST: Array<{ file: string; pattern: RegExp; reason: string }> = [
  {
    file: '_bmad/codex/agents/README.md',
    pattern: /Claude/i,
    reason: 'README may mention source migration history, not runtime instructions.',
  },
];

function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    if (!/\.(md|toml|txt)$/i.test(entry.name)) return [];
    return [fullPath];
  });
}

function relative(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function isAllowed(file: string, pattern: RegExp): boolean {
  return ALLOWLIST.some((entry) => entry.file === file && entry.pattern.source === pattern.source);
}

describe('Codex asset host leakage guard', () => {
  it('does not ship active Claude/Cursor runtime instructions in Codex assets', () => {
    const violations: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const filePath of collectFiles(path.join(ROOT, root))) {
        const file = relative(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(content) && !isAllowed(file, pattern)) {
            violations.push(`${file}: ${pattern}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
