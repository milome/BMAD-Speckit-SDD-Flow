import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const COMMAND_SCAN_PATHS = ['package.json'];
const COMMAND_FORBIDDEN_PATTERNS = [
  /ts-node[^\n\r]*scripts[\\/]main-agent-orchestration\.ts/u,
  /tsx[^\n\r]*scripts[\\/]main-agent-orchestration\.ts/u,
  /node[^\n\r]*scripts[\\/]main-agent-orchestration\.ts/u,
];
const BUNDLE_SCAN_PATHS = ['packages/runtime-emit/dist', '.cursor/hooks', '.claude/hooks'];
const BUNDLE_FORBIDDEN_STRINGS = [
  {
    id: 'root-orchestration-bundle-marker',
    text: '// ../../scripts/main-agent-orchestration.ts',
  },
  {
    id: 'synthetic-consecutive-no-new-gap',
    text: 'consecutiveNoNewGapRounds: 3',
  },
  {
    id: 'synthetic-bounded-no-new-gap',
    text: 'convergenceVerdict: "bounded_no_new_gap"',
  },
  {
    id: 'old-source-materialization-mandate',
    text: 'source_materialization_before_deep_audit',
  },
];

function collectTextFiles(relativePath: string): string[] {
  const absolute = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];

  const files: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...collectTextFiles(path.relative(ROOT, child)));
    else if (/\.(?:cjs|js|mjs|json|ts)$/u.test(entry.name)) files.push(child);
  }
  return files;
}

describe('requirements contract hook bundle source authority', () => {
  it('rejects active commands that execute root main-agent orchestration TypeScript', () => {
    const hits: string[] = [];

    for (const scanPath of COMMAND_SCAN_PATHS) {
      for (const file of collectTextFiles(scanPath)) {
        const relativeFile = path.relative(ROOT, file).replace(/\\/g, '/');
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of COMMAND_FORBIDDEN_PATTERNS) {
          const match = content.match(pattern);
          if (match) hits.push(`${relativeFile}: ${match[0]}`);
        }
      }
    }

    expect(hits).toEqual([]);
  });

  it('rejects hook bundles that package root orchestration or synthetic convergence claims', () => {
    const hits: string[] = [];

    for (const scanPath of BUNDLE_SCAN_PATHS) {
      for (const file of collectTextFiles(scanPath)) {
        const relativeFile = path.relative(ROOT, file).replace(/\\/g, '/');
        const content = fs.readFileSync(file, 'utf8');
        for (const rule of BUNDLE_FORBIDDEN_STRINGS) {
          if (content.includes(rule.text)) hits.push(`${relativeFile}: ${rule.id}`);
        }
      }
    }

    expect(hits).toEqual([]);
  });
});
