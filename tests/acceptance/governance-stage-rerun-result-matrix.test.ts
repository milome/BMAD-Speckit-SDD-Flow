import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  enumerateGovernedRoutingIntersection,
  enumerateGovernedRoutingStages,
} from '../helpers/architecture-gates-test-helpers';
import {
  listGovernanceStageFixtureKeys,
  resolveGovernanceStageFixture,
} from '../helpers/governance-stage-fixture-catalog';

const ROOT = join(import.meta.dirname, '..', '..');

function setupProject(): string {
  const project = mkdtempSync(join(tmpdir(), 'gov-stage-matrix-'));
  cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
  mkdirSync(join(project, '_bmad-output', 'planning-artifacts', 'feature-matrix'), {
    recursive: true,
  });
  mkdirSync(join(project, '.git'), { recursive: true });
  writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/feature-matrix\n', 'utf8');
  writeFileSync(
    join(project, '_bmad', '_config', 'architecture-gates.yaml'),
    readFileSync(join(ROOT, '_bmad', '_config', 'architecture-gates.yaml'), 'utf8'),
    'utf8'
  );
  writeFileSync(
    join(project, '_bmad', '_config', 'continue-gate-routing.yaml'),
    readFileSync(join(ROOT, '_bmad', '_config', 'continue-gate-routing.yaml'), 'utf8'),
    'utf8'
  );
  return project;
}

interface GovernedStageCase {
  workflow: string;
  step: string;
  rerunGate: string;
  artifactName: string;
  content: string;
  fixtureIntent: string;
}

function loadGovernedStageCases(): GovernedStageCase[] {
  return enumerateGovernedRoutingStages().map((entry) => ({
    workflow: entry.workflow,
    step: entry.step,
    rerunGate: entry.rerunGate,
    ...buildArtifactFixture(entry.gateSet, entry.workflow, entry.step),
  }));
}

function buildArtifactFixture(
  gateSet: string,
  workflow: string,
  step: string
): Pick<GovernedStageCase, 'artifactName' | 'content' | 'fixtureIntent'> {
  const key = `${workflow}/${step}`;
  const fixture = resolveGovernanceStageFixture(key);
  if (!fixture) {
    throw new Error(`Missing artifact fixture mapping for governed stage: ${key} (gateSet=${gateSet})`);
  }
  return fixture;
}

function expectStageEvent(project: string, rerunGate: string): void {
  const stageEventDir = join(
    project,
    '_bmad-output',
    'runtime',
    'governance',
    'queue',
    'pending-events'
  );
  expect(existsSync(stageEventDir)).toBe(true);
  const files = readdirSync(stageEventDir).filter((file) => file.endsWith('.json'));
  expect(files.length).toBe(1);
  const event = JSON.parse(readFileSync(join(stageEventDir, files[0]), 'utf8')) as {
    type: string;
    payload: {
      sourceEventType?: string;
      runnerInput?: { rerunGate?: string };
      rerunGateResult?: { gate?: string; status?: string };
    };
  };
  expect(event.type).toBe('governance-rerun-result');
  expect(event.payload.sourceEventType).toBe('governance-pre-continue-check');
  expect(event.payload.runnerInput?.rerunGate).toBe(rerunGate);
  expect(event.payload.rerunGateResult?.gate).toBe(rerunGate);
  expect(event.payload.rerunGateResult?.status).toBe('fail');
}

describe('governance stage rerun-result matrix', () => {
  it.each(loadGovernedStageCases())('$workflow/$step emits governance-rerun-result for $rerunGate', (entry) => {
    const project = setupProject();
    try {
      const artifactPath = join(
        project,
        '_bmad-output',
        'planning-artifacts',
        'feature-matrix',
        entry.artifactName
      );
      writeFileSync(artifactPath, entry.content, 'utf8');

      let stdout = '';
      try {
        stdout = execFileSync(
          process.execPath,
          [join(ROOT, '_bmad', 'runtime', 'hooks', 'pre-continue-check.cjs'), entry.workflow, entry.step],
          { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );
      } catch (error: any) {
        stdout = error.stdout || '';
      }

      const result = JSON.parse(stdout) as { ok: boolean };
      expect(result.ok).toBe(false);
      expectStageEvent(project, entry.rerunGate);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it.each(loadGovernedStageCases())('$workflow/$step fixture intent stays explicit for future maintainers', (entry) => {
    expect(entry.fixtureIntent.length).toBeGreaterThan(24);
    expect(entry.fixtureIntent).toMatch(/fails|blocked|blocker|missing|placeholder|templated/i);
  });

  it('fixture catalog keys stay exactly aligned with routing ∩ gates enumeration', () => {
    expect(listGovernanceStageFixtureKeys()).toEqual(enumerateGovernedRoutingIntersection());
  });
});
