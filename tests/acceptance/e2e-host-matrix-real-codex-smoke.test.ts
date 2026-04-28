import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { runHostMatrixJourneyRunner } from '../../scripts/e2e-host-matrix-journey-runner';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('host-matrix real codex smoke', () => {
  it('uses the codex worker adapter smoke in real mode instead of only checking codex --version', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'host-matrix-real-codex-'));
    try {
      const contractPath = path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml');
      const sprintStatusPath = path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
      fs.mkdirSync(path.dirname(contractPath), { recursive: true });
      fs.mkdirSync(path.dirname(sprintStatusPath), { recursive: true });
      fs.writeFileSync(
        contractPath,
        yaml.dump({
          signals: {},
          stage_requirements: { implement: {} },
          mapping_contract: {},
        }),
        'utf8'
      );
      fs.writeFileSync(sprintStatusPath, 'development_status:\n  S1: in-progress\n', 'utf8');
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'project',
        })
      );

      const reportPath = path.join(root, '_bmad-output', 'runtime', 'e2e', 'real-codex.json');
      const exitCode = runHostMatrixJourneyRunner([
        '--project-root',
        root,
        '--mode',
        'real',
        '--hosts',
        'codex',
        '--report-path',
        reportPath,
      ]);

      expect(exitCode).toBe(0);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        journeys: Array<{
          host: string;
          passed: boolean;
          workerSmoke?: { attempted: boolean; passed: boolean; taskReportPath: string };
        }>;
      };
      expect(report.journeys[0].host).toBe('codex');
      expect(report.journeys[0].passed).toBe(true);
      expect(report.journeys[0].workerSmoke?.attempted).toBe(true);
      expect(report.journeys[0].workerSmoke?.passed).toBe(true);
      expect(fs.existsSync(report.journeys[0].workerSmoke!.taskReportPath)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});

