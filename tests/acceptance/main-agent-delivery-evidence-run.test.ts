import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function prepareProjectRoot(root: string): void {
  fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'implementation-artifacts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'reference'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml'),
    [
      'signals: {}',
      'stage_requirements:',
      '  implement: {}',
      'mapping_contract: {}',
      'adaptiveIntakeGovernanceGate:',
      '  matchScoring: {}',
      '  decisionThresholds: {}',
    ].join('\n') + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
    'development_status:\n  S1: in_progress\n',
    'utf8'
  );
}

describe('main-agent delivery evidence run', () => {
  it('writes standard evidence and keeps completion blocked for mock short-run evidence', () => {
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
          path.join(process.cwd(), 'scripts', 'main-agent-delivery-evidence-run.ts'),
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
      expect(report.failedEvidence.join('\n')).toContain('dual-host-real-journey');
      expect(report.failedEvidence.join('\n')).toContain('wall-clock-8h-soak');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
