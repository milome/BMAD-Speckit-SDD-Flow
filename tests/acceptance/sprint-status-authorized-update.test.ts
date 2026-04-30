import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSprintStatusAuthorizedUpdate } from '../../scripts/sprint-status-authorized-update';

function writeContract(root: string): string {
  const contractPath = path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml');
  fs.mkdirSync(path.dirname(contractPath), { recursive: true });
  fs.writeFileSync(contractPath, 'signals: {}\nstage_requirements: {}\nmapping_contract: {}\n');
  return crypto.createHash('sha256').update(fs.readFileSync(contractPath)).digest('hex');
}

function reportHash(report: { generatedAt: string; checks: unknown[]; blocking_reasons: string[] }) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        generatedAt: report.generatedAt,
        checks: report.checks,
        blocking_reasons: report.blocking_reasons,
      })
    )
    .digest('hex');
}

describe('sprint-status authorized update', () => {
  it('updates sprint-status only with a passing release gate token and writes audit evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-status-authorized-'));
    try {
      const reportPath = path.join(root, 'release-gate-report.json');
      const token = 'release-gate:pass:strong';
      const contractHash = writeContract(root);
      const report = {
        generatedAt: '2026-04-27T00:00:00.000Z',
        critical_failures: 0,
        blocked_sprint_status_update: false,
        checks: [],
        blocking_reasons: [],
        completion_intent: {
          token,
          storyKey: '1-1-user-authentication',
          contractHash,
          gateReportHash: '',
          singleUse: true,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      };
      report.completion_intent.gateReportHash = reportHash(report);
      fs.writeFileSync(
        reportPath,
        JSON.stringify(report),
        'utf8'
      );

      const result = runSprintStatusAuthorizedUpdate(root, {
        storyKey: '1-1-user-authentication',
        status: 'done',
        releaseGateReportPath: reportPath,
        token,
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
      ) as {
        authorized: boolean;
        gateReportHash: string;
        contractHash: string;
        fromStatus: string | null;
        toStatus: string;
        singleUse: boolean;
      };
      expect(audit.authorized).toBe(true);
      expect(audit.gateReportHash).toBe(report.completion_intent.gateReportHash);
      expect(audit.contractHash).toBe(contractHash);
      expect(audit.fromStatus).toBe('missing');
      expect(audit.toStatus).toBe('done');
      expect(audit.singleUse).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
