import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupFixtures,
  createFixture,
  SKILL_ROOT,
} from '../helpers/goal-subcontract-execution-package-fixture';

const require = createRequire(import.meta.url);
const { publish } = require('../../packages/bmad-speckit/src/services/skill-publisher');
let roots: readonly string[] = [];
const requiredFiles = [
  'SKILL.md',
  'agents/openai.yaml',
  'references/execution-package-contract.md',
  'references/task-report-and-handoff.md',
  'scripts/build-execution-package.js',
  'scripts/build-execution-package-projections.js',
  'scripts/build-execution-package-shared.js',
  'scripts/audit-execution-package.js',
  'scripts/audit-completed-campaign.js',
  'schemas/execution-package-manifest.schema.json',
  'schemas/child-prompt-packet.schema.json',
  'schemas/campaign-task-report-binding.schema.json',
  'assets/commit-message-template.txt',
];

function readNormalizedText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/gu, '\n');
}

afterEach(() => {
  const rootsToClean = roots;
  roots = [];
  cleanupFixtures();
  for (const root of rootsToClean) fs.rmSync(root, { recursive: true, force: true });
});

describe('goal subcontract execution package installed surface', () => {
  it('publishes every resource and runs from the installed Codex skill', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-subcontract-install-'));
    roots = [...roots, projectRoot];
    const sourceRoot = path.join(
      projectRoot,
      '_bmad',
      'skills',
      'goal-subcontract-execution-package-generator'
    );
    fs.mkdirSync(path.dirname(sourceRoot), { recursive: true });
    fs.cpSync(SKILL_ROOT, sourceRoot, { recursive: true });

    const result = publish(projectRoot, 'codex', { bmadPath: '_bmad' });
    expect(result.skippedReasons).toEqual([]);
    expect(result.published).toContain('goal-subcontract-execution-package-generator');

    const installedRoot = path.join(
      projectRoot,
      '.codex',
      'skills',
      'goal-subcontract-execution-package-generator'
    );
    for (const relativePath of requiredFiles) {
      const installedPath = path.join(installedRoot, relativePath);
      const canonicalPath = path.join(SKILL_ROOT, relativePath);
      expect(fs.existsSync(installedPath), `missing installed resource: ${relativePath}`).toBe(
        true
      );
      expect(
        fs.statSync(installedPath).isFile(),
        `installed resource is not a file: ${relativePath}`
      ).toBe(true);
      expect(
        readNormalizedText(installedPath),
        `installed resource differs from canonical source: ${relativePath}`
      ).toBe(readNormalizedText(canonicalPath));
    }

    const fixture = createFixture();
    const compiled = spawnSync(
      process.execPath,
      [
        path.join(installedRoot, 'scripts', 'build-execution-package.js'),
        '--request',
        fixture.requestPath,
        '--out',
        fixture.packageA,
        '--json',
      ],
      {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        timeout: 60_000,
        windowsHide: true,
      }
    );
    expect(compiled.status, compiled.stderr || compiled.stdout).toBe(0);
    expect(JSON.parse(compiled.stdout)).toMatchObject({
      ok: true,
      childCount: 2,
      requirementRecordBindingStatus: 'absent',
    });
  });
});
