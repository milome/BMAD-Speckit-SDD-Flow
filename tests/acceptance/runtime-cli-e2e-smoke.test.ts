import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';

describe('runtime cli e2e smoke', () => {
  it('score + preview + bundle commands complete against runtime dashboard fixture data', async () => {
    const fixture = await createRuntimeDashboardFixture({
      withSftDataset: true,
      withBundle: true,
      withRealToolTraceFixture: true,
      realToolTraceVariants: ['clean'],
    });

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-cli-smoke-'));
    const bugfixPath = path.join(tempRoot, 'docs', 'plans', 'BUGFIX_runtime-cli-smoke.md');
    const reportPath = path.join(tempRoot, 'AUDIT_implement_runtime-cli-smoke.md');
    const workFile = path.join(tempRoot, 'src', 'runtime-dashboard.ts');
    const binPath = path.join(process.cwd(), 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

    try {
      fs.mkdirSync(path.dirname(bugfixPath), { recursive: true });
      fs.mkdirSync(path.dirname(workFile), { recursive: true });

      fs.writeFileSync(
        bugfixPath,
        [
          '## §1 问题',
          'runtime cli smoke 需要验证 score / preview / bundle 主链。',
          '',
          '## §4 修复方案',
          '保留 runtime path 与 preview bundle 接线，并确保 score 命令仍然能写入评分记录。',
          '',
        ].join('\n'),
        'utf-8'
      );

      fs.writeFileSync(
        reportPath,
        [
          '# Audit Report',
          '',
          'Overall Grade: A',
          '',
          '## Summary',
          'CLI smoke validation passed.',
          '',
          '- [PASS] functionality',
          '- [PASS] code_quality',
          '- [PASS] test_coverage',
          '',
        ].join('\n'),
        'utf-8'
      );

      fs.writeFileSync(
        workFile,
        [
          'export function renderRuntimeDashboard() {',
          "  return 'runtime-cli-smoke';",
          '}',
          '',
        ].join('\n'),
        'utf-8'
      );

      fs.writeFileSync(path.join(tempRoot, '.gitignore'), 'node_modules/\n', 'utf-8');

      const git = (command: string) =>
        execFileSync('git', command.split(' '), {
          cwd: tempRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        });

      git('init');
      git('config user.email vitest@example.com');
      git('config user.name Vitest');
      git('add .');
      git('commit -m base');
      const baseCommitHash = git('rev-parse --short HEAD').trim();

      fs.writeFileSync(
        workFile,
        [
          'export function renderRuntimeDashboard() {',
          "  return 'runtime-cli-smoke-updated';",
          '}',
          '',
        ].join('\n'),
        'utf-8'
      );

      execFileSync(
        'node',
        [
          binPath,
          'score',
          '--reportPath',
          reportPath,
          '--stage',
          'implement',
          '--runId',
          'runtime-cli-smoke-run',
          '--scenario',
          'real_dev',
          '--event',
          'stage_audit_complete',
          '--writeMode',
          'single_file',
          '--dataPath',
          fixture.dataPath,
          '--artifactDocPath',
          bugfixPath,
          '--baseCommitHash',
          baseCommitHash,
          '--skipTriggerCheck',
        ],
        {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        }
      );

      const previewOutput = execFileSync(
        'node',
        [binPath, 'sft-preview', '--dataPath', fixture.dataPath, '--target', 'openai_chat', '--format', 'json'],
        {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        }
      );
      const preview = JSON.parse(previewOutput.trim()) as {
        total_candidates: number;
        accepted: number;
      };
      expect(preview.total_candidates).toBeGreaterThan(0);
      expect(preview.accepted).toBeGreaterThan(0);

      const bundleDir = path.join(tempRoot, '_bmad-output', 'datasets');
      const bundleOutput = execFileSync(
        'node',
        [
          binPath,
          'sft-bundle',
          '--dataPath',
          fixture.dataPath,
          '--target',
          'openai_chat',
          '--bundle-dir',
          bundleDir,
        ],
        {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
        }
      );
      const bundle = JSON.parse(bundleOutput.trim()) as {
        bundle_dir: string;
        manifest_path: string;
      };

      expect(typeof bundle.bundle_dir).toBe('string');
      expect(typeof bundle.manifest_path).toBe('string');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 120000);
});
