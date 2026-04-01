import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RunScoreRecord } from '../../packages/scoring/writer/types';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import { governancePendingQueueFilePath } from '../../scripts/governance-runtime-queue';
import { runGovernanceRemediation } from '../../scripts/governance-remediation-runner';
import { writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

const REPO_ROOT = process.cwd();
const DASHBOARD_SCRIPT = path.join(REPO_ROOT, 'scripts', 'dashboard-generate.ts');

function writeGovernanceConfig(root: string): string {
  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    [
      'version: 1',
      'primaryHost: cursor',
      'packetHosts:',
      '  - cursor',
      'provider:',
      '  mode: stub',
      '  id: readiness-governance-stub',
    ].join('\n'),
    'utf8'
  );
  return configPath;
}

function createFixtureProject(): {
  root: string;
  configPath: string;
  cleanup: () => void;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runner-summary-e2e-'));
  cpSync(path.join(REPO_ROOT, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'plan',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '14.2',
    storySlug: 'runner-summary-e2e',
    epicId: 'epic-14',
    runId: 'run-runner-summary-e2e-001',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14-2',
    updatedAt: '2026-03-29T00:00:00.000Z',
  });

  return {
    root,
    configPath: writeGovernanceConfig(root),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function writeScoreRecord(root: string, record: RunScoreRecord): void {
  const dataPath = path.join(root, 'packages', 'scoring', 'data');
  mkdirSync(dataPath, { recursive: true });
  writeFileSync(path.join(dataPath, `${record.run_id}.json`), JSON.stringify(record, null, 2), 'utf8');
}

function makeStageScoreRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'dev-e14-s2-plan-001',
    scenario: 'real_dev',
    stage: 'plan',
    phase_score: 74,
    phase_weight: 0.25,
    check_items: [],
    timestamp: '2026-03-29T12:00:00.000Z',
    iteration_count: 1,
    iteration_records: [],
    first_pass: false,
    trigger_stage: 'speckit_2_2',
    ...overrides,
  };
}

function waitBriefly(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

describe('governance runner summary end-to-end flow', () => {
  it('reuses the scoring-history runner_summary_lines in dashboard raw event output while the remediation artifact carries the same canonical runner summary section', async () => {
    const fixture = createFixtureProject();
    try {
      writeScoreRecord(fixture.root, makeStageScoreRecord());

      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-runner-summary-e2e'
      );
      mkdirSync(outDir, { recursive: true });
      const firstOutput = path.join(outDir, 'attempt-1.md');
      const secondOutput = path.join(outDir, 'attempt-2.md');

      const firstRun = await runGovernanceRemediation({
        projectRoot: fixture.root,
        outputPath: firstOutput,
        promptText: '做 implementation readiness 修复，不要联网，最小修复。',
        stageContextKnown: true,
        gateFailureExists: true,
        blockerOwnershipLocked: true,
        rootTargetLocked: true,
        equivalentAdapterCount: 1,
        attemptId: 'attempt-runner-summary-e2e-01',
        sourceGateFailureIds: ['GF-E2E-001'],
        capabilitySlot: 'qa.readiness',
        canonicalAgent: 'PM + QA / readiness reviewer',
        actualExecutor: 'implementation readiness workflow',
        adapterPath: 'local workflow fallback',
        targetArtifacts: ['prd.md', 'architecture.md'],
        expectedDelta: 'close readiness blockers',
        rerunOwner: 'PM',
        rerunGate: 'implementation-readiness',
        outcome: 'blocked',
        hostKind: 'cursor',
      });

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-runner-summary-e2e-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-runner-summary-e2e-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-29T13:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              runnerInput: {
                projectRoot: fixture.root,
                outputPath: secondOutput,
                promptText: '继续 implementation readiness 修复，不要联网。',
                stageContextKnown: true,
                gateFailureExists: true,
                blockerOwnershipLocked: true,
                rootTargetLocked: true,
                equivalentAdapterCount: 1,
                attemptId: 'attempt-runner-summary-e2e-02',
                sourceGateFailureIds: ['GF-E2E-001'],
                capabilitySlot: 'qa.readiness',
                canonicalAgent: 'PM + QA / readiness reviewer',
                actualExecutor: 'implementation readiness workflow',
                adapterPath: 'local workflow fallback',
                targetArtifacts: ['prd.md', 'architecture.md'],
                expectedDelta: 'close readiness blockers',
                rerunOwner: 'PM',
                rerunGate: 'implementation-readiness',
                outcome: 'blocked',
                hostKind: 'cursor',
                loopStateId: firstRun.loopState.loopStateId,
                rerunGateResult: {
                  gate: 'implementation-readiness',
                  status: 'fail',
                  blockerIds: ['IR-BLK-E2E-001'],
                  summary: 'Need another readiness remediation attempt.',
                  updatedArtifacts: ['implementation-readiness-report'],
                },
              },
            },
          },
          null,
          2
        ),
        'utf8'
      );

      await processQueue(fixture.root);

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const current = JSON.parse(
          readFileSync(
            path.join(fixture.root, 'packages', 'scoring', 'data', 'dev-e14-s2-plan-001.json'),
            'utf8'
          )
        ) as RunScoreRecord & { governance_rerun_history?: Array<{ runner_summary_lines?: string[] }> };
        if ((current.governance_rerun_history?.length ?? 0) > 0) {
          break;
        }
        waitBriefly(100);
      }

      const updatedRecord = JSON.parse(
        readFileSync(
          path.join(fixture.root, 'packages', 'scoring', 'data', 'dev-e14-s2-plan-001.json'),
          'utf8'
        )
      ) as RunScoreRecord & {
        governance_rerun_history?: Array<{ runner_summary_lines?: string[] }>;
      };
      const runnerSummaryLines =
        updatedRecord.governance_rerun_history?.[0]?.runner_summary_lines ?? [];
      const commonRunnerSummaryLines = runnerSummaryLines.filter(
        (line) =>
          line.trim().length > 0 &&
          line !== '## Packet Paths' &&
          !line.startsWith('- cursor:') &&
          !line.startsWith('- claude:') &&
          !line.startsWith('- codex:')
      );

      expect(runnerSummaryLines).toEqual(
        expect.arrayContaining([
          '## Governance Remediation Runner Summary',
          '- Should Continue: yes',
          '## Loop State Trace Summary',
          '- Stop Reason: (none)',
        ])
      );

      const artifact = readFileSync(secondOutput, 'utf8');
      expect(artifact).toContain('## Governance Remediation Runner Summary');
      expect(artifact).toContain('## Loop State Trace Summary');
      for (const line of commonRunnerSummaryLines) {
        expect(artifact).toContain(line);
      }

      const dashboardPath = path.join(fixture.root, 'dashboard.md');
      execSync(
        `npx ts-node "${DASHBOARD_SCRIPT}" --dataPath "${path.join(
          fixture.root,
          'packages',
          'scoring',
          'data'
        )}" --epic 14 --story 2 --strategy epic_story_window --windowHours 999999 --output "${dashboardPath}"`,
        { cwd: REPO_ROOT, encoding: 'utf8' }
      );

      const dashboard = readFileSync(dashboardPath, 'utf8');
      expect(dashboard).toContain('## Governance Latest Raw Event');
      for (const line of commonRunnerSummaryLines) {
        expect(dashboard).toContain(line);
      }
    } finally {
      fixture.cleanup();
    }
  }, 60000);
});
