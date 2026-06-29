import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function prepareProjectRoot(root: string): void {
  fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'implementation-artifacts'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'requirement-records'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, 'docs', 'reference'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml'),
    [
      'version: 1',
      'sources_of_truth:',
      '  strategy_contract: _bmad/_config/orchestration-governance.contract.yaml',
      '  runtime_index: _bmad-output/runtime/requirement-records/index.json',
      'signals: {}',
      'stage_requirements:',
      '  implement: {}',
      'mapping_contract: {}',
      'adaptive_intake_governance_gate:',
      '  matchScoring: {}',
      '  decisionThresholds: {}',
    ].join('\n') + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'),
    JSON.stringify(
      {
        version: 1,
        active: {
          requirementSetId: 'REQ-PACKAGE-RUNTIME',
          recordId: 'REQ-PACKAGE-RUNTIME',
          recordPath:
            '_bmad-output/runtime/requirement-records/REQ-PACKAGE-RUNTIME/requirement-record.json',
        },
        records: [
          {
            requirementSetId: 'REQ-PACKAGE-RUNTIME',
            recordId: 'REQ-PACKAGE-RUNTIME',
            recordPath:
              '_bmad-output/runtime/requirement-records/REQ-PACKAGE-RUNTIME/requirement-record.json',
            flow: 'standalone_tasks',
            status: 'user_confirmed',
            updatedAt: '2026-06-28T00:00:00.000Z',
          },
        ],
        updatedAt: '2026-06-28T00:00:00.000Z',
        source: '_bmad-output/runtime/requirement-records/index.json',
        items: [
          {
            requirementId: 'REQ-PACKAGE-RUNTIME',
            sourceType: 'controlled_requirement_record',
            flow: 'standalone_tasks',
            status: 'user_confirmed',
            recordId: 'REQ-PACKAGE-RUNTIME',
            requirementSetId: 'REQ-PACKAGE-RUNTIME',
            recordPath:
              '_bmad-output/runtime/requirement-records/REQ-PACKAGE-RUNTIME/requirement-record.json',
            sourcePath: 'docs/plans/package-runtime.md',
            sourceDocumentHash: 'sha256:source',
            implementationConfirmationHash: 'sha256:implementation',
            confirmationPageHash: 'sha256:confirmation',
            updatedAt: '2026-06-28T00:00:00.000Z',
          },
        ],
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
    'development_status:\n  S1: in_progress\n',
    'utf8'
  );
}

describe('main-agent delivery evidence run', () => {
  it('writes standard evidence and keeps completion blocked for missing delivery evidence without long-run evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-evidence-run-'));
    prepareProjectRoot(root);
    try {
      const run = spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          path.join(process.cwd(), 'tsconfig.node.json'),
          '--transpile-only',
          path.join(
            process.cwd(),
            'packages',
            'bmad-speckit',
            'src',
            'main-agent',
            'source-authority',
            'scripts',
            'main-agent-delivery-evidence-run.ts'
          ),
          '--skipSprintAudit',
        ],
        { cwd: root, encoding: 'utf8' }
      );
      expect(run.status).toBe(1);
      const reportPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'gates',
        'main-agent-delivery-truth-gate-report.json'
      );
      expect(fs.existsSync(reportPath)).toBe(true);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        completionAllowed: boolean;
        failedEvidence: string[];
      };
      expect(report.completionAllowed).toBe(false);
      expect(report.failedEvidence.join('\n')).toContain('multi-host-host-matrix');
      expect(run.stdout).not.toContain('"id": "long-run-soak"');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not require consumer package.json for package source-authority release prerequisites', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-evidence-package-runtime-'));
    prepareProjectRoot(root);
    try {
      expect(fs.existsSync(path.join(root, 'package.json'))).toBe(false);
      const run = spawnSync(
        process.execPath,
        [
          path.join(
            process.cwd(),
            'packages',
            'bmad-speckit',
            'dist',
            'main-agent',
            'source-authority',
            'scripts',
            'main-agent-delivery-evidence-run.js'
          ),
          '--provider',
          'mock',
          '--skipSprintAudit',
        ],
        { cwd: root, encoding: 'utf8' }
      );
      expect(run.status).toBe(1);

      const releaseReportPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'gates',
        'main-agent-release-gate-report.json'
      );
      expect(fs.existsSync(releaseReportPath)).toBe(true);
      const release = JSON.parse(fs.readFileSync(releaseReportPath, 'utf8')) as {
        checks: Array<{ id: string; passed: boolean; command?: string; stderr?: string }>;
      };
      const checks = new Map(release.checks.map((check) => [check.id, check]));
      expect(checks.get('multi-host-e2e-journey')?.passed).toBe(true);
      expect(checks.get('quality-gate-artifact')?.passed).toBe(true);
      expect(checks.get('single-source-whitelist')?.passed).toBe(true);
      expect(checks.get('rerun-gate-e2e-loop')?.passed).toBe(true);
      const combinedOutput = `${run.stdout}\n${run.stderr}\n${JSON.stringify(release)}`;
      expect(combinedOutput).not.toContain('Could not read package.json');
      expect(combinedOutput).not.toContain('packages\\bmad-speckit\\bin\\bmad-speckit.js');
      expect(checks.get('single-source-whitelist')?.command).not.toContain('npm run');
      expect(checks.get('rerun-gate-e2e-loop')?.command).not.toContain('npm run');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
