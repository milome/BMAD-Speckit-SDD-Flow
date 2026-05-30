import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(
  process.cwd(),
  '.codex',
  'skills',
  'goal-execution-contract-generator',
  'scripts',
  'check-docs-review-dependency.js'
);

function writeDocsReview(root: string): string {
  const skillDir = join(root, 'skills', 'docs-review');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    [
      '---',
      'name: docs-review',
      '---',
      '',
      '# Documentation Review Skill',
      '',
      '@./../_shared/metabase-style-guide.md',
      '',
    ].join('\n'),
    'utf8'
  );
  return join(skillDir, 'SKILL.md');
}

describe('docs-review shared dependency checker', () => {
  it('fails closed when an installed skill references a missing sibling _shared file', () => {
    const codexHome = mkdtempSync(join(tmpdir(), 'docs-review-shared-missing-'));
    try {
      const skillPath = writeDocsReview(codexHome);
      const result = spawnSync(process.execPath, [SCRIPT], {
        cwd: process.cwd(),
        env: { ...process.env, CODEX_HOME: codexHome },
        encoding: 'utf8',
      });
      const payload = JSON.parse(result.stdout);

      expect(result.status).toBe(5);
      expect(payload.status).toBe('broken_shared_dependency');
      expect(payload.skillPath).toBe(skillPath);
      expect(payload.sharedReferences.missing).toEqual(['metabase-style-guide.md']);
    } finally {
      rmSync(codexHome, { recursive: true, force: true });
    }
  });

  it('repairs missing shared files from DOCS_REVIEW_SHARED_SOURCE when auto-install is enabled', () => {
    const codexHome = mkdtempSync(join(tmpdir(), 'docs-review-shared-repair-'));
    const sharedSource = mkdtempSync(join(tmpdir(), 'docs-review-shared-source-'));
    try {
      writeDocsReview(codexHome);
      writeFileSync(
        join(sharedSource, 'metabase-style-guide.md'),
        '# Metabase style guide\n',
        'utf8'
      );

      const result = spawnSync(process.execPath, [SCRIPT, '--auto-install'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CODEX_HOME: codexHome,
          DOCS_REVIEW_SHARED_SOURCE: sharedSource,
        },
        encoding: 'utf8',
      });
      const payload = JSON.parse(result.stdout);
      const installedSharedFile = join(codexHome, 'skills', '_shared', 'metabase-style-guide.md');

      expect(result.status).toBe(0);
      expect(payload.status).toBe('available_repaired');
      expect(existsSync(installedSharedFile)).toBe(true);
      expect(readFileSync(installedSharedFile, 'utf8')).toBe('# Metabase style guide\n');
    } finally {
      rmSync(codexHome, { recursive: true, force: true });
      rmSync(sharedSource, { recursive: true, force: true });
    }
  });
});
