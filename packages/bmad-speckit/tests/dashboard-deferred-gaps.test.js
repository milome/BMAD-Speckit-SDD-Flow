const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { dashboardCommand } = require('../src/commands/dashboard.js');
const { deferredGapAuditCommand } = require('../src/commands/deferred-gap-audit.js');

function writeReport(root, filename, gapLines) {
  const reportDir = path.join(root, '_bmad-output', 'planning-artifacts', 'feature-gap');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, filename),
    [
      '# Implementation Readiness Report',
      '',
      '## Blockers Requiring Immediate Action',
      '',
      '- IR-BLK-001: missing proof chain',
      '',
      '## Deferred Gaps',
      '',
      ...gapLines,
      '',
      '## Deferred Gaps Tracking',
      '',
      '| Gap ID | 描述 | 原因 | 解决时机 | Owner | 状态检查点 |',
      '|--------|------|------|----------|-------|-----------|',
      '| Epic3-4-UX | 缺少正式 UX 规范 | MVP 可基于 PRD | 2026-04-01 | UX Designer | Epic 3 Planning |',
      '',
    ].join('\n'),
    'utf8'
  );
}

describe('dashboard deferred gaps', () => {
  it('loads deferred gap governance from _bmad hook assets instead of consumer root scripts', () => {
    const dashboardSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'dashboard.js'), 'utf8');
    const auditSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'deferred-gap-audit.js'), 'utf8');
    const loaderSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'deferred-gap-governance-loader.js'), 'utf8');

    assert.doesNotMatch(dashboardSource, /scripts\/deferred-gap-governance\.cjs/);
    assert.doesNotMatch(auditSource, /scripts\/deferred-gap-governance\.cjs/);
    assert.match(loaderSource, /_bmad[\\/]+runtime[\\/]+hooks[\\/]+deferred-gap-governance\.cjs/);
  });

  it('appends deferred gap table to dashboard markdown output', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-deferred-gaps-'));
    const previousCwd = process.cwd();
    try {
      writeReport(tempRoot, 'implementation-readiness-report-2026-04-07.md', [
        '- J04-Smoke-E2E: P0 Journey J04 缺少 Smoke E2E',
        '  - Reason: P2 优先级',
        '  - Resolution Target: Sprint 2+',
        '  - Owner: Dev Team',
      ]);
      writeReport(tempRoot, 'implementation-readiness-report-2026-04-08.md', [
        '- Epic3-4-UX: 缺少正式 UX 规范',
        '  - Reason: MVP 可基于 PRD',
        '  - Resolution Target: 2026-04-01',
        '  - Owner: UX Designer',
      ]);

      process.chdir(tempRoot);
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));
      try {
        dashboardCommand({ showDeferredGaps: true });
      } finally {
        console.log = originalLog;
      }

      const output = logs.join('\n');
      assert.match(output, /## Deferred Gap Governance Summary/);
      assert.match(output, /## Deferred Gaps Status/);
      assert.match(output, /Epic3-4-UX/);
      assert.match(output, /Alert Count:/);
    } finally {
      process.chdir(previousCwd);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('emits non-zero exit code when deferred-gap-audit finds alerts', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deferred-gap-audit-'));
    const previousCwd = process.cwd();
    const previousExitCode = process.exitCode;
    try {
      writeReport(tempRoot, 'implementation-readiness-report-2026-04-07.md', [
        '- J04-Smoke-E2E: P0 Journey J04 缺少 Smoke E2E',
        '  - Reason: P2 优先级',
        '  - Resolution Target: Sprint 2+',
        '  - Owner: Dev Team',
      ]);
      writeReport(tempRoot, 'implementation-readiness-report-2026-04-08.md', [
        '- Epic3-4-UX: 缺少正式 UX 规范',
        '  - Reason: MVP 可基于 PRD',
        '  - Resolution Target: 2026-04-01',
        '  - Owner: UX Designer',
      ]);

      process.chdir(tempRoot);
      process.exitCode = 0;
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));
      try {
        deferredGapAuditCommand({ json: true, failOnAlert: true });
      } finally {
        console.log = originalLog;
      }

      const payload = JSON.parse(logs.join('\n'));
      assert.equal(payload.status, 'alert');
      assert.ok(payload.alert_count > 0);
      assert.equal(process.exitCode, 1);
    } finally {
      process.exitCode = previousExitCode;
      process.chdir(previousCwd);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
