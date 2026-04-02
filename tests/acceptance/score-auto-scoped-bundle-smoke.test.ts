import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';

describe('score auto scoped bundle smoke', () => {
  it('writes a scoped bundle after a passing implement score and exposes it to dashboard snapshot', async () => {
    const fixture = await createRuntimeDashboardFixture({
      withSftDataset: true,
      withBundle: true,
      withRealToolTraceFixture: true,
      realToolTraceVariants: ['clean'],
    });

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'score-auto-scoped-bundle-'));
    const reportPath = path.join(tempRoot, 'AUDIT_Story_15-2_stage4.md');
    const binPath = path.join(process.cwd(), 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
    const artifactDocPath =
      '_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-2-i18n-bilingual-full-implementation/AUDIT_Story_15-2_stage4.md';

    try {
      fs.writeFileSync(
        reportPath,
        [
          '# Audit Report',
          '',
          'Overall Grade: A',
          '',
          '## Summary',
          'Auto scoped bundle validation passed.',
          '',
          'Issue List:',
          '(none)',
          '',
        ].join('\n'),
        'utf-8'
      );

      const scoreOutput = execFileSync(
        'node',
        [
          binPath,
          'score',
          '--reportPath',
          reportPath,
          '--stage',
          'implement',
          '--runId',
          'dev-e15-s2-implement-auto-smoke',
          '--scenario',
          'real_dev',
          '--event',
          'stage_audit_complete',
          '--writeMode',
          'single_file',
          '--dataPath',
          fixture.dataPath,
          '--artifactDocPath',
          artifactDocPath,
          '--skipTriggerCheck',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        }
      );

      const bundleLine = scoreOutput
        .split(/\r?\n/)
        .find((line) => line.includes('sft-bundle: wrote scoped bundle'));

      expect(bundleLine).toBeTruthy();
      const bundleId = bundleLine!.trim().split(' ').pop()!;
      const manifestPath = path.join(process.cwd(), '_bmad-output', 'datasets', bundleId, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        source_scope?: Record<string, unknown>;
      };

      expect(manifest.source_scope).toMatchObject({
        scope_type: 'story',
        epic_id: 'epic-15-runtime-governance-and-i18n',
        story_key: '2-i18n-bilingual-full-implementation',
        work_item_id: 'story:2-i18n-bilingual-full-implementation',
        board_group_id: 'epic:epic-15-runtime-governance-and-i18n',
      });

      const snapshotRaw = execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          '(Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:43123/api/snapshot?board_group_id=epic:epic-15-runtime-governance-and-i18n&work_item_id=story:2-i18n-bilingual-full-implementation").Content',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        }
      );

      const snapshot = JSON.parse(snapshotRaw) as {
        sft_summary: {
          last_bundle: null | {
            bundle_id: string;
            source_scope?: Record<string, unknown>;
          };
        };
      };

      expect(snapshot.sft_summary.last_bundle).toMatchObject({
        bundle_id: bundleId,
        source_scope: {
          scope_type: 'story',
          epic_id: 'epic-15-runtime-governance-and-i18n',
          story_key: '2-i18n-bilingual-full-implementation',
          work_item_id: 'story:2-i18n-bilingual-full-implementation',
          board_group_id: 'epic:epic-15-runtime-governance-and-i18n',
        },
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 180000);
});
