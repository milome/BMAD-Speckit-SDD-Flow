import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainGovernedDataProducts } from '../../scripts/main-agent-governed-data-products';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function readJsonl(file: string): Record<string, unknown>[] {
  const content = readFileSync(file, 'utf8').trim();
  return content ? content.split(/\r?\n/u).map((line) => JSON.parse(line)) : [];
}

function writeFixture(root: string): { recordPath: string; candidateEventsPath: string; dataDir: string } {
  const recordId = 'REQ-GOVERNED-DATA';
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const dataDir = path.join(base, 'data');
  const evidenceDir = path.join(base, 'evidence', 'TRACE-DONE');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, 'implementation-evidence-summary.json');
  writeFileSync(evidencePath, `${JSON.stringify({ traceRows: ['TRACE-DONE'], decision: 'pass' }, null, 2)}\n`, 'utf8');
  const sourcePath = path.join(root, 'docs', 'design', 'example.md');
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, '# Example requirement\n', 'utf8');

  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId,
        requirementSetId: recordId,
        sourcePath,
        status: 'user_confirmed',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            sourceDocumentHash: SOURCE_HASH,
            implementationConfirmationHash: IMPLEMENTATION_HASH,
          },
        ],
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
        },
        architectureConfirmations: [
          {
            eventType: 'architecture_confirmation_recorded',
            architectureConfirmationArtifactHash: ARCHITECTURE_HASH,
          },
        ],
        executionIterations: [
          {
            eventType: 'execution_iteration_recorded',
            executionIterationId: 'exec-done',
            runId: 'run-done',
            status: 'done',
            traceRows: ['TRACE-DONE'],
            taskRefs: ['TASK-DATA-SFT-GOVERNANCE'],
            evidenceRefs: ['EVD-DONE'],
          },
        ],
        requirementClosures: [
          { requirementId: 'TRACE-DONE', status: 'pass' },
          { requirementId: 'EVD-DONE', status: 'pass' },
          { requirementId: 'TRACE-OPEN', status: 'open' },
        ],
        artifactIndex: [
          {
            artifactType: 'implementation_evidence',
            sourceOfTruthRole: 'evidence',
            path: evidencePath,
            contentHash: sha256Text(`${JSON.stringify({ traceRows: ['TRACE-DONE'], decision: 'pass' }, null, 2)}\n`),
            producer: 'main-agent-governed-data-products.test',
            purpose: 'pass-grade controlled implementation evidence',
            relatedRequirementIds: ['TRACE-DONE', 'EVD-DONE'],
            status: 'active',
            inputVersion: 'fixture-v1',
            outputVersion: 'fixture-v1',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  const candidateEventsPath = path.join(dataDir, 'candidate-events.jsonl');
  const candidateEvents = [
    {
      mentorEventId: 'candidate-chat-log',
      sourceKind: 'chat_log',
      status: 'done',
      traceRows: ['TRACE-DONE'],
      evidenceRefs: ['EVD-DONE'],
      quality: { acceptanceDecision: 'accepted', trainingReady: true, phaseScore: 100 },
    },
    {
      mentorEventId: 'candidate-failed',
      sourceKind: 'controlled_execution_iteration',
      status: 'failed',
      traceRows: ['TRACE-DONE'],
      evidenceRefs: ['EVD-DONE'],
      quality: { acceptanceDecision: 'accepted', trainingReady: true, phaseScore: 100 },
    },
    {
      mentorEventId: 'candidate-low-quality',
      sourceKind: 'controlled_execution_iteration',
      status: 'done',
      traceRows: ['TRACE-DONE'],
      evidenceRefs: ['EVD-DONE'],
      quality: { acceptanceDecision: 'accepted', trainingReady: true, phaseScore: 70 },
    },
    {
      mentorEventId: 'candidate-unclosed',
      sourceKind: 'controlled_execution_iteration',
      status: 'done',
      traceRows: ['TRACE-OPEN'],
      evidenceRefs: ['EVD-DONE'],
      quality: { acceptanceDecision: 'accepted', trainingReady: true, phaseScore: 100 },
    },
    {
      mentorEventId: 'candidate-contaminated',
      sourceKind: 'controlled_execution_iteration',
      status: 'done',
      traceRows: ['TRACE-DONE'],
      evidenceRefs: ['EVD-DONE'],
      quality: { acceptanceDecision: 'accepted', trainingReady: true, phaseScore: 100 },
      contamination: { detected: true },
    },
  ];
  writeFileSync(candidateEventsPath, `${candidateEvents.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
  return { recordPath, candidateEventsPath, dataDir };
}

describe('main-agent governed data products', () => {
  it('writes requirement-scoped governed data artifacts without mutating the requirement record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'governed-data-products-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const code = mainGovernedDataProducts([
        '--requirement-record',
        fixture.recordPath,
        '--candidate-events',
        fixture.candidateEventsPath,
        '--out-dir',
        fixture.dataDir,
        '--generated-at',
        '2026-05-19T12:00:00.000Z',
        '--generated-by',
        'test-agent',
        '--json',
      ]);

      expect(code).toBe(0);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
      for (const fileName of [
        'mentor-events.jsonl',
        'sample-routes.jsonl',
        'canonical-samples.jsonl',
        'dataset-manifest.json',
        'data-governance-report.json',
        'governance/split-report.json',
        'governance/dedup-report.json',
        'governance/contamination-report.json',
        'governance/holdout-registry.json',
        'governance/post-training-eval-report.json',
        'governance/data-governance-gate-report.json',
        'governance/training-run.json',
      ]) {
        expect(existsSync(path.join(fixture.dataDir, fileName))).toBe(true);
      }
      const trainingRun = JSON.parse(readFileSync(path.join(fixture.dataDir, 'governance', 'training-run.json'), 'utf8'));
      const evalReport = JSON.parse(readFileSync(path.join(fixture.dataDir, 'governance', 'post-training-eval-report.json'), 'utf8'));
      expect(trainingRun).toMatchObject({
        status: 'completed',
        modelTrainingPerformed: false,
      });
      expect(evalReport).toMatchObject({
        decision: 'pass',
        trainingLossOnly: false,
        trainingRunId: trainingRun.trainingRunId,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes forbidden direct sources and failed or unsafe samples away from SFT', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'governed-data-routes-'));
    try {
      const fixture = writeFixture(root);
      mainGovernedDataProducts([
        '--requirement-record',
        fixture.recordPath,
        '--candidate-events',
        fixture.candidateEventsPath,
        '--out-dir',
        fixture.dataDir,
        '--generated-at',
        '2026-05-19T12:00:00.000Z',
      ]);

      const routes = readJsonl(path.join(fixture.dataDir, 'sample-routes.jsonl'));
      const byEvent = new Map(routes.map((route) => [route.mentorEventId, route]));
      expect(byEvent.get('candidate-chat-log')).toMatchObject({
        destination: 'discard',
        sftEligible: false,
      });
      expect(byEvent.get('candidate-failed')).toMatchObject({
        destination: 'rca',
        sftEligible: false,
      });
      expect(byEvent.get('candidate-low-quality')).toMatchObject({
        destination: 'preference',
        sftEligible: false,
      });
      expect(byEvent.get('candidate-unclosed')).toMatchObject({
        destination: 'eval',
        sftEligible: false,
      });
      expect(byEvent.get('candidate-contaminated')).toMatchObject({
        destination: 'quarantine',
        sftEligible: false,
      });
      const canonicalSamples = readJsonl(path.join(fixture.dataDir, 'canonical-samples.jsonl'));
      expect(canonicalSamples.every((sample) => JSON.stringify(sample).includes('candidate-chat-log'))).toBe(false);
      expect(canonicalSamples.length).toBeGreaterThanOrEqual(1);
      expect(canonicalSamples.every((sample) => (sample.quality as Record<string, unknown>).training_ready === true)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits manifest and governance report with eval-first, holdout, redaction, contamination, withdrawal, and direct-source policy', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'governed-data-manifest-'));
    try {
      const fixture = writeFixture(root);
      mainGovernedDataProducts([
        '--requirement-record',
        fixture.recordPath,
        '--candidate-events',
        fixture.candidateEventsPath,
        '--out-dir',
        fixture.dataDir,
        '--generated-at',
        '2026-05-19T12:00:00.000Z',
      ]);

      const manifest = JSON.parse(readFileSync(path.join(fixture.dataDir, 'dataset-manifest.json'), 'utf8'));
      expect(manifest.source_snapshot).toMatchObject({
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        architectureConfirmationHash: ARCHITECTURE_HASH,
      });
      expect(manifest.validation_summary).toMatchObject({
        evalFirstRequired: true,
        holdoutRequired: true,
        sampleRoutesRequired: true,
        redactionRequired: true,
        contaminationScanRequired: true,
        withdrawalGovernanceRequired: true,
      });
      expect(manifest.validation_summary.directRawLogSourcesForbidden).toEqual([
        'chat_log',
        'worker_log',
        'terminal_output',
        'final_code',
        'human_summary',
      ]);

      const report = JSON.parse(readFileSync(path.join(fixture.dataDir, 'data-governance-report.json'), 'utf8'));
      expect(report.assertions).toContain('SFT positive samples only include pass-grade controlled execution events');
      expect(report.assertions).toContain('forbidden direct sources are discarded and never exported to SFT');
      expect(report.counts.destinations).toMatchObject({
        discard: 1,
        rca: 1,
        preference: 1,
        eval: 1,
        quarantine: 1,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves existing controlled mentor event log rows when writing governed projections', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'governed-data-preserve-'));
    try {
      const fixture = writeFixture(root);
      const existingEvent = { eventType: 'execution_iteration_recorded', executionIterationId: 'existing-event' };
      writeFileSync(path.join(fixture.dataDir, 'mentor-events.jsonl'), `${JSON.stringify(existingEvent)}\n`, 'utf8');

      mainGovernedDataProducts([
        '--requirement-record',
        fixture.recordPath,
        '--candidate-events',
        fixture.candidateEventsPath,
        '--out-dir',
        fixture.dataDir,
        '--generated-at',
        '2026-05-19T12:00:00.000Z',
      ]);

      const events = readJsonl(path.join(fixture.dataDir, 'mentor-events.jsonl'));
      expect(events).toEqual(expect.arrayContaining([existingEvent]));
      expect(events.length).toBeGreaterThan(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
