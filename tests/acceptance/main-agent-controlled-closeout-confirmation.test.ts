import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256Json } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store';
import { stableHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-verification-evidence-normalizer';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const RUNTIME = path.join(ROOT, 'packages/bmad-speckit/src/main-agent/runtime.ts');
const RUNNER =
  'const {mainAgentRuntimeCommand}=require(process.argv[1]);Promise.resolve(mainAgentRuntimeCommand(process.argv.slice(2))).then(code=>{process.exitCode=code;}).catch(error=>{console.error(error);process.exitCode=2;});';
const REQUEST_ID = 'REQ-CONTROLLED-CLOSEOUT-001';
const ATTEMPT_ID = 'CLOSEOUT-001';
const HASH = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const CANDIDATE_HASH = HASH('execution-final-candidate');
const CLOSEOUT_REQUEST_ID = `goal-closeout-${CANDIDATE_HASH.slice('sha256:'.length, 39)}`;
const ACCEPT = `Accept current Goal delivery and close the record\ndecision=accept\nrequestId=${CLOSEOUT_REQUEST_ID}\nexecutionFinalCandidateHash=${CANDIDATE_HASH}`;
const REJECT = `Reject current Goal delivery and keep the record open\ndecision=reject\nrequestId=${CLOSEOUT_REQUEST_ID}\nexecutionFinalCandidateHash=${CANDIDATE_HASH}`;

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fixture(root: string, currentAttemptId = ATTEMPT_ID) {
  const recordRoot = path.join(root, '_bmad-output/runtime/requirement-records', REQUEST_ID);
  const recordPath = path.join(recordRoot, 'requirement-record.json');
  const sourceDocumentHash = HASH('source');
  const implementationConfirmationHash = HASH('implementation');
  const writers = [
    {
      writerId: 'main-agent-controlled-closeout-confirmation',
      eventTypes: ['record_closed', 'closeout_acceptance_rejected'],
      writerHash: HASH('controlled-closeout-writer'),
    },
  ];
  const artifactRoot = `goal/runtime/execution-final/candidates/sha256-${CANDIDATE_HASH.slice(
    'sha256:'.length
  )}`;
  const gatePayload = {
    schemaVersion: 'GoalDeliveryCloseoutGateReceipt/v1',
    status: 'pass',
    closeoutAttemptId: CLOSEOUT_REQUEST_ID,
    contextHash: HASH('context'),
    executionFinalCandidateHash: CANDIDATE_HASH,
    candidateBytesHash: HASH('candidate-bytes'),
    campaignClosureHash: HASH('campaign-closure'),
    executionFinalJudgeCampaignHash: HASH('final-judge-campaign'),
    effectivePassReceiptHash: HASH('effective-pass'),
    taskReportRef: {
      path: 'goal/runtime/runs/RUN-0123456789ABCDEF/execution/EXEC-001/projections/TaskReport.json',
      hash: HASH('task-report'),
    },
    verifiedPrerequisiteStatusesHash: HASH('verified-prerequisites'),
  };
  const gateReceipt = {
    ...gatePayload,
    deliveryCloseoutGateReceiptHash: stableHash(gatePayload),
  };
  const gateReceiptRef = {
    path: `${artifactRoot}/delivery-closeout-gate-receipt.json`,
    hash: gateReceipt.deliveryCloseoutGateReceiptHash,
  };
  const pageHtml = `<html><body><pre>${ACCEPT}</pre><pre>${REJECT}</pre></body></html>\n`;
  const pageRef = {
    path: `${artifactRoot}/controlled-closeout.html`,
    hash: HASH(pageHtml),
  };
  const requestIdentity = {
    schemaVersion: 'ControlledCloseoutRequestIdentity/v1',
    deliveryGateReceiptRef: gateReceiptRef,
    executionFinalCandidateHash: CANDIDATE_HASH,
    requestId: CLOSEOUT_REQUEST_ID,
    pageId: `goal-closeout-page-${CANDIDATE_HASH.slice('sha256:'.length, 39)}`,
    intent: 'accept_or_reject_goal_delivery',
    exactAcceptText: ACCEPT,
    exactRejectText: REJECT,
  };
  const { schemaVersion: _identitySchemaVersion, ...requestIdentityFields } = requestIdentity;
  const requestArtifactPayload = {
    schemaVersion: 'ControlledCloseoutRequest/v1',
    status: 'awaiting_user_acceptance',
    recordId: REQUEST_ID,
    ...requestIdentityFields,
    pageRef,
    closeoutAcceptanceRequestHash: stableHash(requestIdentity),
  };
  const request = {
    ...requestArtifactPayload,
    controlledCloseoutRequestHash: stableHash(requestArtifactPayload),
  };
  const requestRef = {
    path: `${artifactRoot}/controlled-closeout-request.json`,
    hash: request.controlledCloseoutRequestHash,
  };
  const requestPath = path.join(root, ...requestRef.path.split('/'));
  writeJson(path.join(root, ...gateReceiptRef.path.split('/')), gateReceipt);
  writeJson(requestPath, request);
  mkdirSync(path.dirname(path.join(root, ...pageRef.path.split('/'))), { recursive: true });
  writeFileSync(path.join(root, ...pageRef.path.split('/')), pageHtml, 'utf8');
  writeJson(recordPath, {
    schemaVersion: 'requirement-record/v1',
    recordId: REQUEST_ID,
    requirementSetId: REQUEST_ID,
    status: 'awaiting_user_acceptance',
    sourcePath: 'requirements.md',
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticModelHash: HASH('semantic-model'),
    currentAttemptId,
    recordRevision: 1,
    currentMentalModel: 'delivery_confirmation',
    currentStage: 'delivery_confirmation',
    lastEventType: 'delivery_confirmation_user_acceptance_requested',
    sixModelResults: {
      delivery_confirmation: {
        status: 'awaiting_user_acceptance',
        currentAttemptId,
      },
    },
    closeout: {
      currentAttemptId: CLOSEOUT_REQUEST_ID,
      decision: 'pass',
      acceptanceRequest: {
        requestId: CLOSEOUT_REQUEST_ID,
        closeoutAttemptId: CLOSEOUT_REQUEST_ID,
        requestRef,
        deliveryGateReceiptRef: gateReceiptRef,
        pageRef,
        executionFinalCandidateHash: CANDIDATE_HASH,
        currentImplementationAttemptId: ATTEMPT_ID,
        expectedRecordRevision: 1,
        status: 'awaiting_user_acceptance',
        htmlPath: pageRef.path,
        renderReportPath: gateReceiptRef.path,
        closeoutConfirmationPageHash: pageRef.hash,
        deliveryCloseoutReportHash: gateReceiptRef.hash,
      },
    },
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: REQUEST_ID,
        requirementSetId: REQUEST_ID,
        confirmedAt: '2026-08-18T00:00:00.000Z',
        confirmedBy: 'main-agent-controlled-closeout-confirmation.test',
        sourcePath: 'requirements.md',
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationPageHash: HASH('confirmation-page'),
        confirmationText: 'confirmed source authority fixture',
        renderReportPath: 'confirmation/render-report.json',
        htmlPath: 'confirmation/confirmation.html',
      },
    ],
    controlledIngestWriterRegistryRequired: true,
    controlledIngestWriterRegistry: writers,
    controlledIngestWriterRegistryHash: sha256Json({
      schemaVersion: 'controlled-ingest-writer-registry/v1',
      sourceDocumentHash,
      implementationConfirmationHash,
      writers,
    }),
    updatedAt: '2026-08-18T00:00:00.000Z',
  });
  return { recordRoot, recordPath, requestRef, gateReceiptRef, pageRef };
}

function args(root: string, text: string) {
  return [
    'controlled-closeout',
    '--cwd',
    root,
    '--request-id',
    REQUEST_ID,
    '--exact-confirmation-text',
    text,
    '--json',
  ];
}

function invoke(root: string, text: string) {
  const completed = spawnSync(process.execPath, [TSX, '-e', RUNNER, RUNTIME, ...args(root, text)], {
    cwd: root,
    encoding: 'utf8',
  });
  return { ...completed, envelope: completed.stdout ? JSON.parse(completed.stdout) : null };
}

function invokeAsync(root: string, text: string) {
  return new Promise<ReturnType<typeof invoke>>((resolve) => {
    const child = spawn(process.execPath, [TSX, '-e', RUNNER, RUNTIME, ...args(root, text)], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) =>
      resolve({
        status,
        stdout,
        stderr,
        envelope: stdout ? JSON.parse(stdout) : null,
      } as ReturnType<typeof invoke>)
    );
  });
}

function result(completed: ReturnType<typeof invoke>): Record<string, any> {
  return (
    completed.envelope?.data?.result ??
    completed.envelope?.data ??
    completed.envelope?.result ??
    completed.envelope
  );
}

function transactionCount(recordRoot: string) {
  const root = path.join(recordRoot, 'events/control-store/transactions');
  return existsSync(root)
    ? readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
    : 0;
}

function snapshot(root: string): string {
  const rows: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else
        rows.push(
          `${path.relative(root, target)}:${statSync(target).mtimeMs}:${HASH(readFileSync(target, 'utf8'))}`
        );
    }
  };
  visit(root);
  return rows.join('\n');
}

describe('main-agent controlled closeout confirmation', () => {
  it('atomically commits one accepted requirement-record version with delivery pass and record_closed', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-accept-'));
    try {
      const input = fixture(root);
      const completed = invoke(root, ACCEPT);
      expect(completed.status, completed.stderr || completed.stdout).toBe(0);
      expect(result(completed).status).toBe('record_closed');
      const record = JSON.parse(readFileSync(input.recordPath, 'utf8'));
      expect(record.sixModelResults.delivery_confirmation.status).toBe('pass');
      expect(record.lastEventType).toBe('record_closed');
      expect(transactionCount(input.recordRoot)).toBe(1);
      const marker = JSON.parse(
        readFileSync(
          path.join(input.recordRoot, 'events/control-store/current-commit.json'),
          'utf8'
        )
      );
      const committed = JSON.parse(
        readFileSync(path.join(marker.committedTransactionPath, 'requirement-record.json'), 'utf8')
      );
      expect(committed.sixModelResults.delivery_confirmation.status).toBe('pass');
      expect(committed.lastEventType).toBe('record_closed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records an exact rejection without closing the record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-reject-'));
    try {
      const input = fixture(root);
      const completed = invoke(root, REJECT);
      expect(completed.status, completed.stderr || completed.stdout).toBe(0);
      const recordText = readFileSync(input.recordPath, 'utf8');
      const record = JSON.parse(recordText);
      expect(record.lastEventType).toBe('closeout_acceptance_rejected');
      expect(['blocked', 'closeout_rejected']).toContain(result(completed).status);
      expect(record.sixModelResults.delivery_confirmation.status).not.toBe('pass');
      expect(recordText).not.toContain('"lastEventType": "record_closed"');
      expect(transactionCount(input.recordRoot)).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('replays the same accepted decision with zero writes and rejects a conflicting decision', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-replay-'));
    try {
      const input = fixture(root);
      expect(invoke(root, ACCEPT).status).toBe(0);
      const before = snapshot(input.recordRoot);
      const replay = invoke(root, ACCEPT);
      expect(replay.status, replay.stderr || replay.stdout).toBe(0);
      expect(['record_closed', 'record_closed_reused']).toContain(result(replay).status);
      expect(snapshot(input.recordRoot)).toBe(before);
      const conflict = invoke(root, REJECT);
      expect(conflict.status).not.toBe(0);
      expect(snapshot(input.recordRoot)).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['substring', () => ACCEPT.slice(0, -1), ATTEMPT_ID],
    ['wrong polarity', () => ACCEPT.replace('decision=accept', 'decision=reject'), ATTEMPT_ID],
    ['stale attempt', () => ACCEPT, 'CLOSEOUT-002'],
  ])('fails closed for %s confirmation', (_name, textFor, currentAttemptId) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-invalid-'));
    try {
      const input = fixture(root, currentAttemptId);
      const before = snapshot(input.recordRoot);
      expect(invoke(root, textFor()).status).not.toBe(0);
      expect(snapshot(input.recordRoot)).toBe(before);
      expect(transactionCount(input.recordRoot)).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['pre-CAS', 'post-CAS'])(
    'recovers %s projection state and converges on one accepted version',
    (recoveryPoint) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-recovery-'));
      try {
        const input = fixture(root);
        expect(invoke(root, ACCEPT).status).toBe(0);
        const controlRoot = path.join(input.recordRoot, 'events/control-store');
        const markerPath = path.join(controlRoot, 'current-commit.json');
        const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
        const manifest = JSON.parse(
          readFileSync(
            path.join(marker.committedTransactionPath, 'transaction-manifest.json'),
            'utf8'
          )
        );
        if (recoveryPoint === 'pre-CAS') {
          rmSync(markerPath);
        } else {
          writeFileSync(input.recordPath, '{"partial":true}\n', 'utf8');
        }
        writeJson(path.join(controlRoot, '.lock'), {
          schemaVersion: 'requirement-record-control-lock/v1',
          transactionId: marker.transactionId,
          writerId: 'main-agent-controlled-closeout-confirmation',
          eventType: 'record_closed',
          artifactIndexTargets: manifest.artifactIndexes.map(
            (entry: { targetPath: string }) => entry.targetPath
          ),
          artifactWriteTargets: manifest.artifactWrites.map(
            (entry: { targetPath: string }) => entry.targetPath
          ),
          processId: Number.MAX_SAFE_INTEGER,
          acquiredAt: '2026-08-18T00:00:00.000Z',
        });
        const recovered = invoke(root, ACCEPT);
        expect(recovered.status, recovered.stderr || recovered.stdout).toBe(0);
        expect(JSON.parse(readFileSync(input.recordPath, 'utf8')).lastEventType).toBe(
          'record_closed'
        );
        expect(transactionCount(input.recordRoot)).toBe(1);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('serializes concurrent double accept into one committed record version', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-concurrent-'));
    try {
      const input = fixture(root);
      const contenders = await Promise.all([invokeAsync(root, ACCEPT), invokeAsync(root, ACCEPT)]);
      expect(contenders.map((entry) => entry.status)).toEqual([0, 0]);
      expect(JSON.parse(readFileSync(input.recordPath, 'utf8')).lastEventType).toBe(
        'record_closed'
      );
      expect(transactionCount(input.recordRoot)).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
