import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mainAuditReviewGate } from '../../scripts/main-agent-audit-review-gate';
import { mainDeliveryCloseoutGate } from '../../scripts/main-agent-delivery-closeout-gate';
import { mainExecutionClosureGate } from '../../scripts/main-agent-execution-closure-gate';
import {
  resolveMainAgentOrchestrationSurface,
  runMainAgentConfirmationDriftRoute,
} from '../../scripts/main-agent-orchestration';
import { resolveSixModelRuntimeDecision } from '../../scripts/six-model-runtime-decision';
import { appendControlEventAndReplay } from '../../scripts/requirement-record-control-store';

const ROOT = process.cwd();
const INGEST = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'ingest-confirmation-event.js'
);
const OLD_SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const OLD_IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const PAGE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const ARCH_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-reconfirmation-runtime-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  const bookkeeping = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
  ]);
  return Object.fromEntries(Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key)));
}

function sourceDocumentHashFor(
  sourceText: string,
  blockText: string,
  confirmation: Record<string, unknown>
): string {
  return sha256Text(
    sourceText.replace(
      blockText,
      `implementationConfirmation:${stableStringify(semanticConfirmationForHash(confirmation))}`
    )
  );
}

function implementationConfirmationHashFor(confirmation: Record<string, unknown>): string {
  return sha256Text(stableStringify(semanticConfirmationForHash(confirmation)));
}

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeSource(): {
  sourcePath: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmation: Record<string, unknown>;
} {
  const sourcePath = path.join(tempDir, 'docs', 'reconfirmation-runtime.md');
  const confirmation: Record<string, unknown> = {
    contractSchemaVersion: 1,
    status: 'user_confirmed',
    recordId: 'REQ-RECONFIRM-RUNTIME',
    requirementSetId: 'REQ-RECONFIRM-RUNTIME',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    confirmationLanguage: 'zh-CN',
    confirmationProfile: 'implementation_confirmation',
    requiredViewPacks: ['currentTargetMap'],
    optionalViewPacks: [],
    confirmedAt: '2026-05-30T00:00:00.000Z',
    confirmedBy: 'user',
    sourceDocumentHash: OLD_SOURCE_HASH,
    implementationConfirmationHash: OLD_IMPLEMENTATION_HASH,
    confirmationRender: {
      htmlPath:
        '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/confirmation/confirmation.html',
      summaryPath:
        '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/confirmation/confirmation-summary.json',
      reportPath:
        '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/confirmation/confirmation-render-report.json',
      htmlHash: PAGE_HASH,
      confirmationPhrase: `确认以上范围进入下一阶段 sourceDocumentHash=${OLD_SOURCE_HASH} implementationConfirmationHash=${OLD_IMPLEMENTATION_HASH} confirmationPageHash=${PAGE_HASH}`,
    },
    applicability: { currentTargetMap: { applies: true } },
    must: [{ id: 'MUST-001', text: 'Initial semantic scope' }],
    notDone: [],
    mustNot: [],
    evidence: [],
    traceRows: [],
    requiredCommands: [],
    openQuestions: [],
    failurePaths: [],
    edgeCases: [],
  };
  const block = yaml
    .dump(
      { implementationConfirmation: confirmation },
      { lineWidth: 120, noRefs: true, sortKeys: false }
    )
    .trimEnd();
  const sourceText = [
    '# Reconfirmation Runtime',
    '',
    'Changed semantic source text requiring reconfirmation.',
    '',
    block,
    '',
  ].join('\n');
  writeText(sourcePath, sourceText);
  return {
    sourcePath,
    sourceDocumentHash: sourceDocumentHashFor(sourceText, block, confirmation),
    implementationConfirmationHash: implementationConfirmationHashFor(confirmation),
    confirmation,
  };
}

function baseRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'requirement-record/v1',
    recordId: 'REQ-RECONFIRM-RUNTIME',
    requirementSetId: 'REQ-RECONFIRM-RUNTIME',
    sourcePath: 'docs/reconfirmation-runtime.md',
    status: 'user_confirmed',
    flow: 'standalone_tasks',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    sourceDocumentHash: OLD_SOURCE_HASH,
    implementationConfirmationHash: OLD_IMPLEMENTATION_HASH,
    confirmationPageHash: PAGE_HASH,
    latestConfirmationProjectionHash: PAGE_HASH,
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCH_HASH,
      resolvedRecipeHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    currentMentalModel: 'implementation_readiness',
    currentStage: 'implementation_readiness',
    reconfirmationRequests: [],
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-RECONFIRM-RUNTIME',
        requirementSetId: 'REQ-RECONFIRM-RUNTIME',
        confirmedAt: '2026-05-30T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/reconfirmation-runtime.md',
        sourceDocumentHash: OLD_SOURCE_HASH,
        implementationConfirmationHash: OLD_IMPLEMENTATION_HASH,
        confirmationPageHash: PAGE_HASH,
        confirmationText: 'initial confirmation',
        renderReportPath:
          '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/confirmation/confirmation-render-report.json',
        htmlPath:
          '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/confirmation/confirmation.html',
      },
    ],
    sixModelResults: {
      requirement_confirmation: modelResult('requirement_confirmation', 'pass'),
      architecture_confirmation: modelResult('architecture_confirmation', 'pass'),
      implementation_readiness: modelResult('implementation_readiness', 'pass'),
      execution_closure: modelResult('execution_closure', 'pass'),
      audit_review: modelResult('audit_review', 'pass'),
    },
    mentalModelTransitions: [],
    gateChecks: [],
    artifactIndex: [],
    updatedAt: '2026-05-30T00:00:00.000Z',
    lastEventType: 'implementation_readiness_result_recorded',
    ...overrides,
  };
}

function modelResult(model: string, status: string): Record<string, unknown> {
  return {
    payloadKind: 'model_result',
    model,
    recordId: 'REQ-RECONFIRM-RUNTIME',
    requirementSetId: 'REQ-RECONFIRM-RUNTIME',
    sourceDocumentHash: OLD_SOURCE_HASH,
    implementationConfirmationHash: OLD_IMPLEMENTATION_HASH,
    status,
    resultRecordedAt: '2026-05-30T00:00:00.000Z',
    resultRecordedBy: 'test',
    blockingReasons: status === 'pass' ? [] : [`${model}_blocked`],
  };
}

function writeRecord(record: Record<string, unknown> = baseRecord()): string {
  const recordPath = path.join(
    tempDir,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-RECONFIRM-RUNTIME',
    'requirement-record.json'
  );
  writeJson(recordPath, record);
  writeJson(path.join(tempDir, '_bmad-output', 'runtime', 'requirement-records', 'index.json'), {
    version: 1,
    source: '_bmad-output/runtime/requirement-records/index.json',
    active: {
      requirementSetId: 'REQ-RECONFIRM-RUNTIME',
      recordId: 'REQ-RECONFIRM-RUNTIME',
      recordPath:
        '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/requirement-record.json',
    },
    records: [
      {
        requirementSetId: 'REQ-RECONFIRM-RUNTIME',
        recordId: 'REQ-RECONFIRM-RUNTIME',
        recordPath:
          '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/requirement-record.json',
        flow: 'standalone_tasks',
        status: 'user_confirmed',
      },
    ],
    items: [
      {
        requirementId: 'REQ-RECONFIRM-RUNTIME',
        sourceType: 'controlled_requirement_record',
        flow: 'standalone_tasks',
        status: 'user_confirmed',
        recordId: 'REQ-RECONFIRM-RUNTIME',
        requirementSetId: 'REQ-RECONFIRM-RUNTIME',
        recordPath:
          '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/requirement-record.json',
      },
    ],
  });
  return recordPath;
}

function routeSemanticDrift(recordPath: string) {
  const source = writeSource();
  return {
    source,
    result: runMainAgentConfirmationDriftRoute(tempDir, {
      source: source.sourcePath,
      requirementRecord: recordPath,
    }),
  };
}

function readEvents(recordPath: string): Array<Record<string, unknown>> {
  const eventLog = path.join(path.dirname(recordPath), 'events', 'control-events.jsonl');
  return fs
    .readFileSync(eventLog, 'utf8')
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function writeRenderReport(source: {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}): string {
  const reportPath = path.join(
    tempDir,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-RECONFIRM-RUNTIME',
    'confirmation',
    'confirmation-render-report.json'
  );
  writeJson(reportPath, {
    reportType: 'requirements_confirmation_render_report',
    confirmability: 'confirmable',
    recordId: 'REQ-RECONFIRM-RUNTIME',
    requirementSetId: 'REQ-RECONFIRM-RUNTIME',
    sourceDocumentHash: source.sourceDocumentHash,
    implementationConfirmationHash: source.implementationConfirmationHash,
    confirmationPageHash: PAGE_HASH,
    confirmInstruction: `确认以上范围进入下一阶段 sourceDocumentHash=${source.sourceDocumentHash} implementationConfirmationHash=${source.implementationConfirmationHash} confirmationPageHash=${PAGE_HASH}`,
    artifactRef: {
      path: '_bmad-output/runtime/requirement-records/REQ-RECONFIRM-RUNTIME/confirmation/confirmation.html',
      hash: PAGE_HASH,
    },
  });
  return reportPath;
}

function runIngest(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [INGEST, ...args], {
      cwd: tempDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (error) {
    const err = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    const stdout = Buffer.isBuffer(err.stdout)
      ? err.stdout.toString('utf8')
      : String(err.stdout ?? '');
    const stderr = Buffer.isBuffer(err.stderr)
      ? err.stderr.toString('utf8')
      : String(err.stderr ?? '');
    return {
      stdout: `${stdout}${stderr}`,
      status: err.status ?? 1,
    };
  }
}

function currentSemanticHashesFromResult(result: { classification?: Record<string, unknown> }): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const hashes = result.classification?.currentSemanticHashes as Record<string, unknown>;
  return {
    sourceDocumentHash: String(hashes.sourceDocumentHash),
    implementationConfirmationHash: String(hashes.implementationConfirmationHash),
  };
}

function writeExecutionClosureInputs(recordPath: string, attemptId: string): void {
  const base = path.join(path.dirname(recordPath), 'trace-execution', attemptId);
  writeJson(path.join(base, 'model_packet.json'), {
    sourceDocumentHash: OLD_SOURCE_HASH,
    implementationConfirmationHash: OLD_IMPLEMENTATION_HASH,
    requiredCommands: [],
  });
  writeJson(path.join(base, 'implementation-evidence', 'implementation-evidence-packet.json'), {
    attemptId,
    commandRuns: [],
    artifacts: [],
  });
  writeJson(path.join(base, 'command-results', 'summary.json'), []);
}

function auditPlan(attemptId: string): Record<string, unknown> {
  return {
    schemaVersion: 'audit-triad-execution-plan/v1',
    recordId: 'REQ-RECONFIRM-RUNTIME',
    requirementSetId: 'REQ-RECONFIRM-RUNTIME',
    attemptId,
    stageProfileId: 'audit-review',
    sourceDocumentHash: OLD_SOURCE_HASH,
    implementationConfirmationHash: OLD_IMPLEMENTATION_HASH,
    currentAttemptHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    currentEvidenceHash: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    criticalAuditorProfileHash:
      'sha256:7777777777777777777777777777777777777777777777777777777777777777',
    criticalAuditorStageProfileHash:
      'sha256:8888888888888888888888888888888888888888888888888888888888888888',
    requiredCheckItemSetHash:
      'sha256:9999999999999999999999999999999999999999999999999999999999999999',
    roundPolicy: { consecutiveNoGapRoundsRequired: 1 },
    subagents: [{ requiredCheckItemIds: ['CHK-001'] }],
  };
}

function auditRound(plan: Record<string, unknown>): Record<string, unknown> {
  return {
    roundId: 'round-1',
    stageProfileId: plan.stageProfileId,
    perspectiveResults: {
      product_intent: { agentId: 'product' },
      model_projection: { agentId: 'model' },
      main_agent_execution: { agentId: 'execution' },
    },
    coveredCheckItemIds: ['CHK-001'],
    validatedGapRefs: [],
    vetoItemResults: [],
    sourceDocumentHash: plan.sourceDocumentHash,
    implementationConfirmationHash: plan.implementationConfirmationHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    scoreReceiptRefs: ['score-receipt.json'],
    runAuditorHostReceiptRefs: ['host-receipt.json'],
  };
}

describe('main-agent reconfirmation runtime', () => {
  it('writes reconfirmation_requested, rollback, receipt, and synchronized index from production drift route', () => {
    const recordPath = writeRecord();
    const { result } = routeSemanticDrift(recordPath);

    expect(result).toMatchObject({
      ok: false,
      route: 'semantic_reconfirmation_required',
      nextRequiredAction: 'await_exact_confirmation_phrase_with_hashes',
    });
    expect(result.requestId).toMatch(/^reconfirm-/u);
    expect(result.eventId).toContain('reconfirmation_requested');
    expect(result.receiptPath && fs.existsSync(result.receiptPath)).toBe(true);
    expect(result.eventLogPath && fs.existsSync(result.eventLogPath)).toBe(true);

    const record = readJson(recordPath);
    expect(record.status).toBe('reconfirm_required');
    expect(record.lastEventType).toBe('mental_model_rollback_recorded');
    expect(record.currentMentalModel).toBe('requirement_confirmation');
    expect(record.currentStage).toBe('requirement_confirmation');
    expect(record.sixModelResults).toMatchObject({
      implementation_readiness: { status: 'pass' },
      execution_closure: { status: 'pass' },
      audit_review: { status: 'pass' },
    });
    const requests = record.reconfirmationRequests as Record<string, unknown>[];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      requestId: result.requestId,
      targetModel: 'requirement_confirmation',
      status: 'blocking_open',
      blocking: true,
      currentSemanticHashes: currentSemanticHashesFromResult(result),
      latestConfirmedSemanticHashes: {
        sourceDocumentHash: OLD_SOURCE_HASH,
        implementationConfirmationHash: OLD_IMPLEMENTATION_HASH,
      },
      blockingReasons: expect.arrayContaining(['source_semantic_hash_changed']),
    });
    expect(requests[0].sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'semantic_drift' }),
        expect.objectContaining({ sourceType: 'confirmation_drift_classifier' }),
      ])
    );
    const events = readEvents(recordPath);
    expect(events.map((event) => event.eventType)).toContain('reconfirmation_requested');
    expect(events.map((event) => event.eventType)).toContain('mental_model_rollback_recorded');
    const requestEvent = events.find((event) => event.eventType === 'reconfirmation_requested');
    expect(requestEvent?.writerId).toBe('main-agent-reconfirmation-router');
    expect(requestEvent?.payloadSchemaVersion).toBe('reconfirmation_requested/v1');
    expect((requestEvent?.payload as Record<string, unknown>).requestId).toBe(result.requestId);

    const index = readJson(
      path.join(tempDir, '_bmad-output', 'runtime', 'requirement-records', 'index.json')
    );
    expect(index.active).toMatchObject({
      requirementSetId: 'REQ-RECONFIRM-RUNTIME',
      recordId: 'REQ-RECONFIRM-RUNTIME',
    });
    expect((index.records as Record<string, unknown>[])[0]).toMatchObject({
      recordId: 'REQ-RECONFIRM-RUNTIME',
      status: 'reconfirm_required',
    });
    expect((index.items as Record<string, unknown>[])[0]).toMatchObject({
      recordId: 'REQ-RECONFIRM-RUNTIME',
      status: 'reconfirm_required',
    });
  });

  it('reuses the same open request for the same stable semantic hash tuple', () => {
    const recordPath = writeRecord();
    const first = routeSemanticDrift(recordPath).result;
    const eventCount = readEvents(recordPath).length;
    const second = routeSemanticDrift(recordPath).result;
    const record = readJson(recordPath);

    expect(second.requestId).toBe(first.requestId);
    expect(second.reusedExistingRequest).toBe(true);
    expect(second.eventId).toBeNull();
    expect(
      (record.reconfirmationRequests as Record<string, unknown>[]).filter(
        (request) => request.status === 'blocking_open'
      )
    ).toHaveLength(1);
    expect(readEvents(recordPath)).toHaveLength(eventCount);
  });

  it('fails rollback without an open blocking reconfirmation request', () => {
    const recordPath = writeRecord(
      baseRecord({ currentMentalModel: 'audit_review', currentStage: 'audit_review' })
    );
    expect(() =>
      appendControlEventAndReplay({
        recordPath,
        writerId: 'test',
        eventType: 'mental_model_rollback_recorded',
        payload: {
          eventType: 'mental_model_rollback_recorded',
          fromModel: 'audit_review',
          toModel: 'requirement_confirmation',
          sourceRefs: [{ sourceType: 'reconfirmation_request', id: 'missing' }],
        },
        reduce: (record) => {
          const open = ((record.reconfirmationRequests as Record<string, unknown>[]) ?? []).some(
            (request) => request.status === 'blocking_open'
          );
          if (!open) throw new Error('mental_model_rollback_requires_open_blocking_reconfirmation');
          return record;
        },
      })
    ).toThrow('mental_model_rollback_requires_open_blocking_reconfirmation');
  });

  it('controlled reconfirm ingest closes the matching request and fails hash mismatches before mutation', () => {
    const recordPath = writeRecord();
    const { source, result } = routeSemanticDrift(recordPath);
    const currentHashes = currentSemanticHashesFromResult(result);
    const reportPath = writeRenderReport(currentHashes);
    const beforeMismatch = fs.readFileSync(recordPath, 'utf8');
    const mismatch = runIngest([
      '--source',
      source.sourcePath,
      '--render-report',
      reportPath,
      '--confirmation-text',
      `确认以上范围进入下一阶段 sourceDocumentHash=${OLD_SOURCE_HASH} implementationConfirmationHash=${currentHashes.implementationConfirmationHash} confirmationPageHash=${PAGE_HASH} requestId=${result.requestId}`,
      '--confirmed-by',
      'test-user',
      '--record-id',
      'REQ-RECONFIRM-RUNTIME',
      '--requirement-record',
      recordPath,
      '--json',
    ]);
    expect(mismatch.status).not.toBe(0);
    expect(fs.readFileSync(recordPath, 'utf8')).toBe(beforeMismatch);

    const ingest = runIngest([
      '--source',
      source.sourcePath,
      '--render-report',
      reportPath,
      '--confirmation-text',
      `确认以上范围进入下一阶段 sourceDocumentHash=${currentHashes.sourceDocumentHash} implementationConfirmationHash=${currentHashes.implementationConfirmationHash} confirmationPageHash=${PAGE_HASH} requestId=${result.requestId}`,
      '--confirmed-by',
      'test-user',
      '--record-id',
      'REQ-RECONFIRM-RUNTIME',
      '--requirement-record',
      recordPath,
      '--request-id',
      String(result.requestId),
      '--confirmed-at',
      '2026-05-30T01:00:00.000Z',
      '--json',
    ]);
    expect(ingest.status, ingest.stdout).toBe(0);
    const record = readJson(recordPath);
    const requests = record.reconfirmationRequests as Record<string, unknown>[];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      requestId: result.requestId,
      status: 'controlled_confirmed',
      closedAt: '2026-05-30T01:00:00.000Z',
      closedBy: 'test-user',
    });
    expect(requests[0].confirmationEventId).toContain('confirmation_recorded');
    expect(record.status).toBe('user_confirmed');
    expect(record.currentMentalModel).toBe('requirement_confirmation');
    expect(record.currentStage).toBe('requirement_confirmation');
    expect(record.sixModelResults).toMatchObject({
      requirement_confirmation: {
        status: 'pass',
        sourceDocumentHash: currentHashes.sourceDocumentHash,
        implementationConfirmationHash: currentHashes.implementationConfirmationHash,
      },
    });
    expect((record.confirmationHistory as Record<string, unknown>[]).at(-1)).toMatchObject({
      eventType: 'confirmation_recorded',
      requestId: result.requestId,
    });
    const index = readJson(
      path.join(tempDir, '_bmad-output', 'runtime', 'requirement-records', 'index.json')
    );
    expect((index.records as Record<string, unknown>[])[0]).toMatchObject({
      status: 'user_confirmed',
    });
  });

  it('open request blocks runtime decision, derived readiness, and delivery acceptance request', () => {
    const recordPath = writeRecord(
      baseRecord({
        currentMentalModel: 'delivery_confirmation',
        currentStage: 'delivery_confirmation',
        reconfirmationRequests: [
          {
            requestId: 'reconfirm-open',
            targetModel: 'requirement_confirmation',
            status: 'blocking_open',
            sourceRefs: [{ sourceType: 'semantic_drift', id: 'fixture' }],
          },
        ],
        closeout: { attempts: [] },
        deliveryEvidence: { requiredCommands: [] },
      })
    );
    const record = readJson(recordPath);
    const decision = resolveSixModelRuntimeDecision({ record, attemptId: 'inspect' });
    expect(decision.ready).toBe(false);
    expect(decision.nextAction).toBe('run_pre_confirmation_drilldown');
    expect(decision.blockingReasonRefs).toContainEqual({
      sourceType: 'reconfirmation_request',
      id: 'reconfirm-open',
    });

    const surface = resolveMainAgentOrchestrationSurface({
      projectRoot: tempDir,
      flow: 'standalone_tasks',
      stage: 'delivery_confirmation',
      runtimeContext: {
        resolvedRuntimeContext: {
          kind: 'ResolvedRuntimeContext',
          recordId: 'REQ-RECONFIRM-RUNTIME',
          requirementSetId: 'REQ-RECONFIRM-RUNTIME',
          recordPath,
        },
      },
    });
    expect(surface.mainAgentReady).toBe(false);
    expect(surface.mainAgentNextAction).toBe('run_pre_confirmation_drilldown');

    const closeoutExit = mainDeliveryCloseoutGate([
      '--requirement-record',
      recordPath,
      '--attempt-id',
      'closeout-open-reconfirmation',
      '--json',
    ]);
    expect(closeoutExit).toBe(1);
    const updated = readJson(recordPath);
    expect(updated.lastEventType).toBe('delivery_confirmation_result_recorded');
    expect(updated.status).toBe('user_confirmed');
    expect(updated.closeout).toMatchObject({ decision: 'blocked' });
    expect(updated.closeout).not.toMatchObject({
      acceptanceRequest: { status: 'awaiting_user_acceptance' },
    });
    expect((updated.closeout as Record<string, unknown>).attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: 'blocked',
          blockingReasons: expect.arrayContaining(['open_reconfirmation_request_exists']),
        }),
      ])
    );
  });

  it('open request blocks execution closure and audit review gates', () => {
    const recordPath = writeRecord(
      baseRecord({
        currentMentalModel: 'execution_closure',
        currentStage: 'execution_closure',
        reconfirmationRequests: [
          {
            requestId: 'reconfirm-open',
            targetModel: 'requirement_confirmation',
            status: 'in_progress',
            sourceRefs: [{ sourceType: 'semantic_drift', id: 'fixture' }],
          },
        ],
      })
    );
    const attemptId = 'attempt-open-reconfirmation';
    writeExecutionClosureInputs(recordPath, attemptId);
    const executionExit = mainExecutionClosureGate([
      '--requirement-record',
      recordPath,
      '--attempt-id',
      attemptId,
      '--json',
    ]);
    expect(executionExit).toBe(1);
    let record = readJson(recordPath);
    expect(record.sixModelResults).toMatchObject({
      execution_closure: {
        status: 'blocked',
        blockingReasons: expect.arrayContaining(['open_reconfirmation_request_exists']),
      },
    });

    const plan = auditPlan(attemptId);
    const auditDir = path.join(path.dirname(recordPath), 'audit-triad', attemptId);
    writeJson(path.join(auditDir, 'audit-triad-execution-plan.json'), plan);
    writeJson(path.join(auditDir, 'rounds.json'), [auditRound(plan)]);
    const auditExit = mainAuditReviewGate([
      '--requirement-record',
      recordPath,
      '--attempt-id',
      attemptId,
      '--json',
    ]);
    expect(auditExit).toBe(1);
    record = readJson(recordPath);
    expect(record.sixModelResults).toMatchObject({
      audit_review: {
        status: 'blocked',
        blockingReasons: expect.arrayContaining(['open_reconfirmation_request_exists']),
      },
    });
  });
});
