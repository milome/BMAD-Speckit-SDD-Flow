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

describe('cursor party-mode runtime assets sync', () => {
  it('keeps repo-root .cursor runtime assets aligned with checkpoint-free cursor canonical sources', () => {
    for (const [sourcePath, runtimePath] of CHECKPOINT_FREE_PAIRS) {
      const source = fs.readFileSync(sourcePath, 'utf8');
      const runtime = fs.readFileSync(runtimePath, 'utf8');

      expect(source).not.toMatch(/checkpoint/iu);
      expect(runtime).not.toMatch(/checkpoint/iu);
      expect(runtime).toBe(source);
    }
  });
});
