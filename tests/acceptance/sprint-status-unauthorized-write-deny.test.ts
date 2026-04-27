import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSprintStatusAuthorizedUpdate } from '../../scripts/sprint-status-authorized-update';

describe('sprint-status unauthorized write deny', () => {
  it('denies sprint-status writes without a valid token', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-status-deny-token-'));
    try {
      const reportPath = path.join(root, 'release-gate-report.json');
      fs.writeFileSync(
        reportPath,
        JSON.stringify({ critical_failures: 0, blocked_sprint_status_update: false }),
        'utf8'
      );

      expect(() =>
        runSprintStatusAuthorizedUpdate(root, {
          storyKey: '1-1-user-authentication',
          status: 'done',
          releaseGateReportPath: reportPath,
          token: 'invalid',
        })
      ).toThrow(/invalid release token/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('denies sprint-status writes when release gate blocks updates', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-status-deny-gate-'));
    try {
      const reportPath = path.join(root, 'release-gate-report.json');
      fs.writeFileSync(
        reportPath,
        JSON.stringify({ critical_failures: 1, blocked_sprint_status_update: true }),
        'utf8'
      );

      expect(() =>
        runSprintStatusAuthorizedUpdate(root, {
          storyKey: '1-1-user-authentication',
          status: 'done',
          releaseGateReportPath: reportPath,
          token: 'release-gate:pass:test',
        })
      ).toThrow(/release gate did not pass/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
