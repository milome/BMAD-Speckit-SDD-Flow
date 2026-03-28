import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { parseAndWriteScore } from '../parse-and-write';
import { computeStringHash } from '../../utils/hash';

const FIXTURES = path.join(__dirname, '../../parsers/__tests__/fixtures');

function run(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

describe('parseAndWriteScore stable patch snapshot', () => {
  it('persists an immutable patch snapshot and records its metadata when git diff is available', async () => {
    const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'scoring-patch-snapshot-'));

    try {
      const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
      const baseCommitHash = run('git rev-parse --short=8 HEAD~1', process.cwd());
      const runId = `patch-snapshot-${Date.now()}`;

      await parseAndWriteScore({
        content,
        stage: 'prd',
        runId,
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath,
        baseCommitHash,
      });

      const written = JSON.parse(
        fs.readFileSync(path.join(dataPath, `${runId}.json`), 'utf-8')
      ) as {
        patch_ref?: string;
        patch_snapshot_path?: string;
      };

      expect(written.patch_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(written.patch_snapshot_path).toBeDefined();
      expect(typeof written.patch_snapshot_path).toBe('string');
      expect(path.isAbsolute(String(written.patch_snapshot_path))).toBe(true);
      expect(fs.existsSync(String(written.patch_snapshot_path))).toBe(true);

      const patchContent = fs.readFileSync(String(written.patch_snapshot_path), 'utf-8');
      expect(written.patch_ref).toBe(`sha256:${computeStringHash(patchContent)}`);
      expect(patchContent.length).toBeGreaterThan(0);
      expect(patchContent).toContain('--- a/');
      expect(patchContent).toContain('+++ b/');
    } finally {
      fs.rmSync(dataPath, { recursive: true, force: true });
    }
  });
});
