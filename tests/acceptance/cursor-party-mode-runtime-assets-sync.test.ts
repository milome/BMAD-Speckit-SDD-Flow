import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const CHECKPOINT_FREE_PAIRS = [
  [
    path.join(ROOT, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
    path.join(ROOT, '.cursor', 'agents', 'party-mode-facilitator.md'),
  ],
  [
    path.join(ROOT, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.en.md'),
    path.join(ROOT, '.cursor', 'agents', 'party-mode-facilitator.en.md'),
  ],
  [
    path.join(ROOT, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.zh.md'),
    path.join(ROOT, '.cursor', 'agents', 'party-mode-facilitator.zh.md'),
  ],
  [
    path.join(
      ROOT,
      '_bmad',
      'cursor',
      'skills',
      'bmad-party-mode',
      'steps',
      'step-02-discussion-orchestration.md'
    ),
    path.join(
      ROOT,
      '.cursor',
      'skills',
      'bmad-party-mode',
      'steps',
      'step-02-discussion-orchestration.md'
    ),
  ],
  [
    path.join(
      ROOT,
      '_bmad',
      'cursor',
      'skills',
      'bmad-party-mode',
      'steps',
      'step-02-discussion-orchestration.en.md'
    ),
    path.join(
      ROOT,
      '.cursor',
      'skills',
      'bmad-party-mode',
      'steps',
      'step-02-discussion-orchestration.en.md'
    ),
  ],
  [
    path.join(
      ROOT,
      '_bmad',
      'cursor',
      'skills',
      'bmad-party-mode',
      'steps',
      'step-02-discussion-orchestration.zh.md'
    ),
    path.join(
      ROOT,
      '.cursor',
      'skills',
      'bmad-party-mode',
      'steps',
      'step-02-discussion-orchestration.zh.md'
    ),
  ],
  [
    path.join(ROOT, '_bmad', 'cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'),
    path.join(ROOT, '.cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'),
  ],
] as const;

function stripRuntimeHeader(content: string): string {
  return content.replace(/<!-- RUNTIME-MATERIALIZED facilitator[\s\S]*? -->\r?\n?/u, '');
}

function sourcePathFromRuntimeHeader(runtime: string): string | null {
  const match = /source=([^\s>]+)\s/u.exec(runtime);
  return match ? path.join(ROOT, match[1]) : null;
}

function normalizeForComparison(content: string): string {
  return content
    .replace(/\.en\.md/gu, '.md')
    .replace(/\.zh\.md/gu, '.md')
    .replace(
      /_bmad\/cursor\/skills\/bmad-party-mode\/steps\/step-02-discussion-orchestration\.md/gu,
      '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md'
    );
}

describe('cursor party-mode runtime assets sync', () => {
  it('keeps repo-root .cursor runtime assets aligned with checkpoint-free cursor canonical sources', () => {
    for (const [sourcePath, runtimePath] of CHECKPOINT_FREE_PAIRS) {
      const source = fs.readFileSync(sourcePath, 'utf8');
      const runtime = fs.readFileSync(runtimePath, 'utf8');
      const runtimeSourcePath = sourcePathFromRuntimeHeader(runtime);
      const expectedSource = runtimeSourcePath
        ? fs.readFileSync(runtimeSourcePath, 'utf8')
        : source;

      expect(source).not.toMatch(/checkpoint/iu);
      expect(runtime).not.toMatch(/checkpoint/iu);
      expect(normalizeForComparison(stripRuntimeHeader(runtime))).toBe(
        normalizeForComparison(expectedSource)
      );
    }
  });
});
