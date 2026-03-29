import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runtime-worker-score-event-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'plan',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '14.2',
    storySlug: 'runtime-governance-score-event',
    epicId: 'epic-14',
    runId: 'run-governance-score-event-001',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14-2',
    updatedAt: '2026-03-28T00:00:00.000Z',
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
    timestamp: '2026-03-28T12:00:00.000Z',
    iteration_count: 1,
    iteration_records: [],
    first_pass: false,
    trigger_stage: 'speckit_2_2',
    journey_contract_signals: {
      smoke_task_chain: true,
      closure_task_id: true,
    },
    ...overrides,
  };
}

describe('governance runtime worker scoring event persistence', () => {
  it('appends structured governance rerun history onto the matching stage score record', async () => {
    const fixture = createFixtureProject();
    try {
      writeScoreRecord(fixture.root, makeStageScoreRecord());

      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-worker-score-event'
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
        attemptId: 'attempt-worker-score-event-01',
        sourceGateFailureIds: ['GF-100'],
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

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-score-event-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-score-event-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-28T01:00:00.000Z',
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
                attemptId: 'attempt-worker-score-event-02',
                sourceGateFailureIds: ['GF-100'],
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
                  blockerIds: ['IR-BLK-001'],
                  summary: 'Still missing readiness proof.',
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

      const updatedRecord = JSON.parse(
        readFileSync(
          path.join(fixture.root, 'packages', 'scoring', 'data', 'dev-e14-s2-plan-001.json'),
          'utf8'
        )
      ) as RunScoreRecord & {
        governance_rerun_history?: Array<{
          rerun_gate?: string;
          outcome?: string;
          decision_mode?: string;
          runner_summary_lines?: string[];
          summary_lines?: string[];
          executor_routing?: {
            routing_mode?: string;
            executor_route?: string;
            prioritized_signals?: string[];
          };
        }>;
      };

      expect(updatedRecord.phase_score).toBe(74);
      expect(updatedRecord.stage).toBe('plan');
      expect(updatedRecord.governance_rerun_history).toHaveLength(1);
      expect(updatedRecord.governance_rerun_history?.[0]).toMatchObject({
        rerun_gate: 'implementation-readiness',
        outcome: 'blocked',
        decision_mode: 'targeted',
        executor_routing: {
          routing_mode: 'targeted',
          executor_route: 'journey-contract-remediation',
          prioritized_signals: ['closure_task_id', 'smoke_task_chain'],
        },
      });
      expect(updatedRecord.governance_rerun_history?.[0]?.summary_lines).toContain(
        'Stop Reason: (none)'
      );
      expect(updatedRecord.governance_rerun_history?.[0]?.runner_summary_lines).toEqual(
        expect.arrayContaining([
          '## Governance Remediation Runner Summary',
          '- Should Continue: yes',
          '## Loop State Trace Summary',
        ])
      );
    } finally {
      fixture.cleanup();
    }
  });
});
