import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';

const FIXTURE_PATH = path.join(
  process.cwd(),
  'packages',
  'scoring',
  'data',
  '__fixtures-dashboard-epic-story'
);
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'dashboard-generate.ts');
const GOVERNANCE_CURRENT_RUN = path.join(
  process.cwd(),
  '_bmad-output',
  'runtime',
  'governance',
  'current-run.json'
);

const tempRoots: string[] = [];
let governanceCurrentRunBackup: string | null = null;

afterEach(() => {
  if (governanceCurrentRunBackup == null) {
    fs.rmSync(GOVERNANCE_CURRENT_RUN, { force: true });
  } else {
    fs.mkdirSync(path.dirname(GOVERNANCE_CURRENT_RUN), { recursive: true });
    fs.writeFileSync(GOVERNANCE_CURRENT_RUN, governanceCurrentRunBackup, 'utf8');
    governanceCurrentRunBackup = null;
  }
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('dashboard governance routing integration', () => {
  it('CLI dashboard output uses governance routing summary from scoring records instead of runtime current-run', { timeout: 45000 }, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-governance-routing-'));
    tempRoots.push(root);

    const dataPath = path.join(root, 'scoring-data');
    fs.mkdirSync(dataPath, { recursive: true });
    const fixtureRecords = fs
      .readFileSync(path.join(FIXTURE_PATH, 'scores.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const withGovernanceHistory = fixtureRecords.map((record, index) =>
      index === fixtureRecords.length - 1
        ? {
            ...record,
            governance_rerun_history: [
              {
                event_id: 'gov-evt-targeted-01',
                timestamp: '2026-03-28T12:05:00.000Z',
                rerun_gate: 'implementation-readiness',
                outcome: 'blocked',
                decision_mode: 'targeted',
                executor_routing: {
                  routing_mode: 'targeted',
                  executor_route: 'journey-contract-remediation',
                  prioritized_signals: ['closure_task_id', 'smoke_task_chain'],
                },
                summary_lines: [
                  'Routing Mode: targeted',
                  'Executor Route: journey-contract-remediation',
                  'Stop Reason: await human review',
                  'Journey Contract Signals: closure_task_id, smoke_task_chain',
                ],
                runner_summary_lines: [
                  '## Governance Remediation Runner Summary',
                  '- Should Continue: no',
                  '- Stop Reason: await human review',
                  '',
                  '## Loop State Trace Summary',
                  '- Journey Contract Signals: closure_task_id, smoke_task_chain',
                ],
              },
            ],
          }
        : record
    );
    fs.writeFileSync(
      path.join(dataPath, 'scores.jsonl'),
      withGovernanceHistory.map((record) => JSON.stringify(record)).join('\n') + '\n',
      'utf8'
    );

    governanceCurrentRunBackup = fs.existsSync(GOVERNANCE_CURRENT_RUN)
      ? fs.readFileSync(GOVERNANCE_CURRENT_RUN, 'utf8')
      : null;
    const governanceDir = path.dirname(GOVERNANCE_CURRENT_RUN);
    fs.mkdirSync(governanceDir, { recursive: true });
    fs.writeFileSync(
      GOVERNANCE_CURRENT_RUN,
      JSON.stringify(
        [
          {
            id: 'queue-item-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-28T12:00:00.000Z',
            result: {
              artifactPath: '_bmad-output/planning-artifacts/attempt-2.md',
              executorRouting: {
                routingMode: 'generic',
                executorRoute: 'default-gate-remediation',
                prioritizedSignals: [],
              },
            },
          },
        ],
        null,
        2
      ),
      'utf8'
    );

    const outPath = path.join(root, 'dashboard.md');
    execSync(
      `npx ts-node "${SCRIPT_PATH}" --dataPath "${dataPath}" --epic 99 --story 99 --strategy epic_story_window --windowHours 999999 --output "${outPath}"`,
      { cwd: process.cwd(), encoding: 'utf-8' }
    );

    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toContain('## Governance History Summary');
    expect(content).toContain('Dominant Routing Mode: targeted (1/1)');
    expect(content).toContain(
      'Top Signal: closure_task_id (1 次；阶段 tasks；gates implementation-readiness)'
    );
    expect(content).toContain('Worsening Gates: none');
    expect(content).toContain('## Governance Executor Routing');
    expect(content).toContain('Routing Mode: targeted');
    expect(content).toContain('Executor Route: journey-contract-remediation');
    expect(content).toContain('Signals: closure_task_id、smoke_task_chain');
    expect(content).toContain('Trace Summary:');
    expect(content).toContain('Stop Reason: await human review');
    expect(content).toContain('Journey Contract Signals: closure_task_id, smoke_task_chain');
    expect(content).toContain('## Governance Latest Raw Event');
    expect(content).toContain('## Governance Remediation Runner Summary');
    expect(content).toContain('- Should Continue: no');
    expect(content).toContain('Source: scoring-governance-history');
    expect(content).toContain('## Governance Routing Mode Distribution');
    expect(content).toContain('targeted: 1');
    expect(content).toContain('## Governance Signal Hotspots');
    expect(content).toContain('closure_task_id: 1 次');
    expect(content).toContain('smoke_task_chain: 1 次');
    expect(content).toContain('## Governance Gate Failure Trend');
    expect(content).toContain('implementation-readiness: flat');
  });
});
