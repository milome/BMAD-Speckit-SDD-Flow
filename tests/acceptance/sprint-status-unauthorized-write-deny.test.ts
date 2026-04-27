import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSprintStatusAuthorizedUpdate } from '../../scripts/sprint-status-authorized-update';

function writeStrongReleaseGate(root: string, reportPath: string) {
  const contractPath = path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml');
  fs.mkdirSync(path.dirname(contractPath), { recursive: true });
  fs.writeFileSync(contractPath, 'signals: {}\nstage_requirements: {}\nmapping_contract: {}\n');
  const token = 'release-gate:pass:replay';
  const report = {
    generatedAt: '2026-04-27T00:00:00.000Z',
    critical_failures: 0,
    blocked_sprint_status_update: false,
    checks: [],
    blocking_reasons: [],
    completion_intent: {
      token,
      storyKey: '1-1-user-authentication',
      contractHash: crypto.createHash('sha256').update(fs.readFileSync(contractPath)).digest('hex'),
      gateReportHash: '',
      singleUse: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
  report.completion_intent.gateReportHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        generatedAt: report.generatedAt,
        checks: report.checks,
        blocking_reasons: report.blocking_reasons,
      })
    )
    .digest('hex');
  fs.writeFileSync(reportPath, JSON.stringify(report), 'utf8');
  return token;
}

describe('sprint-status unauthorized write deny', () => {
  it('denies sprint-status writes without a valid token', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-status-deny-token-'));
    try {
      const reportPath = path.join(root, 'release-gate-report.json');
      fs.writeFileSync(
        reportPath,
        JSON.stringify({
          critical_failures: 0,
          blocked_sprint_status_update: false,
          completion_intent: {
            token: 'release-gate:pass:test',
            storyKey: '1-1-user-authentication',
            contractHash: 'contract',
            gateReportHash: 'gate',
            singleUse: true,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        }),
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

  it('denies legacy prefix-only tokens without completion intent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-status-deny-legacy-'));
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
          token: 'release-gate:pass:test',
        })
      ).toThrow(/missing completion intent/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('denies replaying the same completion intent token', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-status-deny-replay-'));
    try {
      const reportPath = path.join(root, 'release-gate-report.json');
      const token = writeStrongReleaseGate(root, reportPath);
      const input = {
        storyKey: '1-1-user-authentication',
        status: 'done',
        releaseGateReportPath: reportPath,
        token,
      };

      runSprintStatusAuthorizedUpdate(root, input);
      expect(() => runSprintStatusAuthorizedUpdate(root, input)).toThrow(/already used/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
