import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

function shellQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

describe('e2e dual host journey runner', () => {
  it('runs mock dual-host journey and updates sprint-status only after gates pass', () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-host-e2e-'));
    try {
      const contractPath = path.join(
        fixtureRoot,
        '_bmad',
        '_config',
        'orchestration-governance.contract.yaml'
      );
      const sprintStatusPath = path.join(
        fixtureRoot,
        '_bmad-output',
        'implementation-artifacts',
        'sprint-status.yaml'
      );

      fs.mkdirSync(path.dirname(contractPath), { recursive: true });
      fs.mkdirSync(path.dirname(sprintStatusPath), { recursive: true });

      fs.writeFileSync(
        contractPath,
        yaml.dump({
          version: '1.0.0',
          signals: { p0_journey_coverage: {} },
          stage_requirements: { implement: { required_signals: ['p0_journey_coverage'] } },
          mapping_contract: { required_fields: ['storyId'] },
        }),
        'utf8'
      );
      fs.writeFileSync(
        sprintStatusPath,
        yaml.dump({
          generated: '2026-04-26',
          development_status: {
            'epic-99': 'in-progress',
            '99-1-sample-story': 'backlog',
          },
        }),
        'utf8'
      );

      writeRuntimeContextRegistry(fixtureRoot, defaultRuntimeContextRegistry(fixtureRoot));
      writeRuntimeContext(
        fixtureRoot,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'project',
        })
      );

      const command = [
        'npx',
        'ts-node',
        '--project',
        'tsconfig.node.json',
        '--transpile-only',
        'scripts/e2e-dual-host-journey-runner.ts',
        '--project-root',
        shellQuote(fixtureRoot),
        '--mode mock',
        '--hosts claude,codex',
        '--write-sprint-status',
      ].join(' ');

      const stdout = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      const result = JSON.parse(stdout) as { reportFile: string; finalPassed: boolean };
      expect(result.finalPassed).toBe(true);
      expect(fs.existsSync(result.reportFile)).toBe(true);

      const report = JSON.parse(fs.readFileSync(result.reportFile, 'utf8')) as {
        finalPassed: boolean;
        sprintStatusUpdate: { applied: boolean; storyKey: string; toStatus: string };
        journeys: Array<{ host: string; passed: boolean }>;
      };

      expect(report.finalPassed).toBe(true);
      expect(report.journeys).toHaveLength(2);
      expect(report.journeys.every((item) => item.passed)).toBe(true);
      expect(report.sprintStatusUpdate.applied).toBe(true);
      expect(report.sprintStatusUpdate.storyKey).toBe('99-1-sample-story');
      expect(report.sprintStatusUpdate.toStatus).toBe('in-progress');

      const sprintStatus = yaml.load(fs.readFileSync(sprintStatusPath, 'utf8')) as {
        development_status: Record<string, string>;
      };
      expect(sprintStatus.development_status['99-1-sample-story']).toBe('in-progress');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, 120000);
});
