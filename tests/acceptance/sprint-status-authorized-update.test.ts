import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSprintStatusAuthorizedUpdate } from '../../scripts/sprint-status-authorized-update';

describe('sprint-status authorized update', () => {
  it('updates sprint-status only with a passing release gate token and writes audit evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-status-authorized-'));
    try {
      const reportPath = path.join(root, 'release-gate-report.json');
      fs.writeFileSync(
        reportPath,
        JSON.stringify({ critical_failures: 0, blocked_sprint_status_update: false }),
        'utf8'
      );

      const result = runSprintStatusAuthorizedUpdate(root, {
        storyKey: '1-1-user-authentication',
        status: 'done',
        releaseGateReportPath: reportPath,
        token: 'release-gate:pass:test',
      });

      expect(result.updated).toBe(true);
      expect(fs.readFileSync(result.sprintStatusPath, 'utf8')).toContain(
        '1-1-user-authentication: done'
      );
      expect(
        fs.existsSync(
          path.join(
            root,
            '_bmad-output',
            'runtime',
            'governance',
            'sprint-status-update-audit.json'
          )
        )
      ).toBe(true);
      const audit = JSON.parse(
        fs.readFileSync(
          path.join(
            root,
            '_bmad-output',
            'runtime',
            'governance',
            'sprint-status-update-audit.json'
          ),
          'utf8'
        )
      ) as { authorized: boolean };
      expect(audit.authorized).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
