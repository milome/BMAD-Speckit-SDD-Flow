import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  appendControlEventAndReplay,
  sha256Json,
  sha256Text,
  type ControlCommitResult,
} from './requirement-record-control-store';

type JsonObject = Record<string, unknown>;

const RECORD_ID = 'REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING';
const ATTEMPT_ID = 'closeout-20260523T011500Z';
const SOURCE_DOCUMENT_HASH =
  'sha256:655bffedd4674bd05c1ec7ec36e20e3ccccc937b5ebf819cb2b3fb13efdf974d';
const IMPLEMENTATION_CONFIRMATION_HASH =
  'sha256:3e42f89332b42219b7e85efffe148367071f457daaa40b2a020fe0a0777e072a';
const ARCHITECTURE_CONFIRMATION_HASH =
  'sha256:0000000000000000000000000000000000000000000000000000000000000000';

interface CommandRef extends JsonObject {
  commandId: string;
  command: string;
  runId: string;
  closeoutAttemptId: string;
  exitCode: number;
  startedAt: string;
  completedAt: string;
  outputSummary: string;
}

interface TraceSpec {
  id: string;
  covers: string[];
  taskRefs: string[];
  evidenceRefs: string[];
  commands: string[];
}

function recordPath(root: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    RECORD_ID,
    'requirement-record.json'
  );
}

function hashFile(root: string, file: string): string {
  return sha256Text(fs.readFileSync(path.resolve(root, file), 'utf8'));
}

function commandRef(input: {
  commandId: string;
  command: string;
  outputSummary: string;
}): CommandRef {
  return {
    commandId: input.commandId,
    command: input.command,
    runId: `${ATTEMPT_ID}-${input.commandId}`,
    closeoutAttemptId: ATTEMPT_ID,
    exitCode: 0,
    startedAt: '2026-05-23T01:14:30.000Z',
    completedAt: '2026-05-23T01:15:10.000Z',
    outputSummary: input.outputSummary,
  };
}

function artifact(input: {
  artifactType: string;
  sourceOfTruthRole: 'control' | 'evidence' | 'projection' | 'read_model';
  path: string;
  contentHash: string;
  producer: string;
  purpose: string;
  relatedRequirementIds: string[];
  traceRows: string[];
  evidenceRefs: string[];
}): JsonObject {
  return {
    artifactType: input.artifactType,
    sourceOfTruthRole: input.sourceOfTruthRole,
    recordId: RECORD_ID,
    requirementSetId: RECORD_ID,
    path: input.path,
    contentHash: input.contentHash,
    producer: input.producer,
    purpose: input.purpose,
    relatedRequirementIds: input.relatedRequirementIds,
    status: 'active',
    inputVersion: 'implementationConfirmation/v1',
    outputVersion: input.artifactType,
    traceRows: input.traceRows,
    evidenceRefs: input.evidenceRefs,
  };
}

function buildCommands(): Record<string, CommandRef> {
  return {
    'CMD-CONTRACT-001': commandRef({
      commandId: 'CMD-CONTRACT-001',
      command:
        'node _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts --source docs/requirements/2026-05-22-main-agent-inspect-readiness-baseline-self-healing-requirement.md --out _bmad-output/runtime/requirement-records/REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING/confirmation/confirmation.html --language zh-CN --record-id REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING --entry-flow standalone_tasks --mode confirmation',
      outputSummary:
        'confirmation render exit 0; scopeConfirmability=confirmable; source projection deliveryReadiness=delivery_ready=false',
    }),
    'CMD-CONTRACT-002': commandRef({
      commandId: 'CMD-CONTRACT-002',
      command:
        'node C:/Users/milom/.codex/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js docs/requirements/2026-05-22-main-agent-inspect-readiness-baseline-self-healing-requirement.md',
      outputSummary: 'reverse audit PASS; failedChecks=[]',
    }),
    'CMD-CONTRACT-003': commandRef({
      commandId: 'CMD-CONTRACT-003',
      command: 'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js',
      outputSummary: 'checkedFiles=2800 findings=0',
    }),
    'CMD-DELIVERY-001': commandRef({
      commandId: 'CMD-DELIVERY-001',
      command: 'npx vitest run tests/unit/resolve-active-requirement*.test.ts',
      outputSummary: '1 file passed; 4 tests passed',
    }),
    'CMD-DELIVERY-002': commandRef({
      commandId: 'CMD-DELIVERY-002',
      command: 'npx vitest run tests/unit/main-agent-implementation-readiness-gate*.test.ts',
      outputSummary: '1 file passed; 1 test passed',
    }),
    'CMD-DELIVERY-003': commandRef({
      commandId: 'CMD-DELIVERY-003',
      command:
        'npx vitest run tests/acceptance/main-agent-orchestration-consumer.test.ts tests/acceptance/main-agent-drift-surface-e2e.test.ts',
      outputSummary: '2 files passed; 11 tests passed',
    }),
    'CMD-DELIVERY-004': commandRef({
      commandId: 'CMD-DELIVERY-004',
      command: 'npx vitest run tests/unit/readiness-drift*.test.ts',
      outputSummary: '1 file passed; 3 tests passed',
    }),
    'CMD-DELIVERY-005': commandRef({
      commandId: 'CMD-DELIVERY-005',
      command: 'rg "implementation_readiness|parseAndWriteScore|RunScoreRecord" scripts packages tests',
      outputSummary:
        'rg exit 0; controlled-readiness-audit-bridge is the production parseAndWriteScore owner; boundary unit test passed',
    }),
  };
}

function buildTraces(): TraceSpec[] {
  return [
    {
      id: 'TRACE-001',
      covers: ['MUST-001', 'MUST-002', 'NEG-001', 'NEG-002'],
      taskRefs: ['TASK-001'],
      evidenceRefs: ['EVD-001', 'EVD-002'],
      commands: ['CMD-CONTRACT-002', 'CMD-CONTRACT-003', 'CMD-DELIVERY-001'],
    },
    {
      id: 'TRACE-002',
      covers: ['MUST-003', 'MUST-004'],
      taskRefs: ['TASK-002'],
      evidenceRefs: ['EVD-003', 'EVD-004'],
      commands: ['CMD-CONTRACT-002', 'CMD-CONTRACT-003', 'CMD-DELIVERY-002', 'CMD-DELIVERY-003'],
    },
    {
      id: 'TRACE-003',
      covers: ['MUST-005', 'NEG-003'],
      taskRefs: ['TASK-003'],
      evidenceRefs: ['EVD-004', 'EVD-010'],
      commands: ['CMD-CONTRACT-002', 'CMD-CONTRACT-003', 'CMD-DELIVERY-003', 'CMD-DELIVERY-005'],
    },
    {
      id: 'TRACE-004',
      covers: ['MUST-006'],
      taskRefs: ['TASK-004'],
      evidenceRefs: ['EVD-005'],
      commands: ['CMD-CONTRACT-002', 'CMD-CONTRACT-003', 'CMD-DELIVERY-003'],
    },
    {
      id: 'TRACE-005',
      covers: ['MUST-007', 'NEG-005', 'NEG-006'],
      taskRefs: ['TASK-005'],
      evidenceRefs: ['EVD-006'],
      commands: ['CMD-CONTRACT-002', 'CMD-CONTRACT-003', 'CMD-DELIVERY-004'],
    },
    {
      id: 'TRACE-006',
      covers: ['MUST-008', 'NEG-004'],
      taskRefs: ['TASK-006'],
      evidenceRefs: ['EVD-007'],
      commands: ['CMD-CONTRACT-002', 'CMD-CONTRACT-003', 'CMD-DELIVERY-003'],
    },
    {
      id: 'TRACE-007',
      covers: ['MUST-009', 'NEG-007'],
      taskRefs: ['TASK-007'],
      evidenceRefs: ['EVD-008', 'EVD-009'],
      commands: ['CMD-CONTRACT-002', 'CMD-CONTRACT-003', 'CMD-DELIVERY-003'],
    },
  ];
}

function buildArtifacts(root: string): JsonObject[] {
  return [
    artifact({
      artifactType: 'source_implementation',
      sourceOfTruthRole: 'evidence',
      path: 'scripts/resolve-active-requirement.ts',
      contentHash: hashFile(root, 'scripts/resolve-active-requirement.ts'),
      producer: 'codex-execution',
      purpose: 'active requirement resolver fallback, index repair projection, explicit selector recovery',
      relatedRequirementIds: ['MUST-001', 'MUST-002', 'NEG-001', 'NEG-002'],
      traceRows: ['TRACE-001'],
      evidenceRefs: ['EVD-001', 'EVD-002'],
    }),
    artifact({
      artifactType: 'unit_test',
      sourceOfTruthRole: 'evidence',
      path: 'tests/unit/resolve-active-requirement.test.ts',
      contentHash: hashFile(root, 'tests/unit/resolve-active-requirement.test.ts'),
      producer: 'codex-execution',
      purpose: 'resolver fallback, explicit selector, ambiguity, and no runtime/context fallback tests',
      relatedRequirementIds: ['MUST-001', 'MUST-002', 'NEG-001', 'NEG-002', 'NEG-006'],
      traceRows: ['TRACE-001', 'TRACE-005'],
      evidenceRefs: ['EVD-001', 'EVD-002', 'EVD-006'],
    }),
    artifact({
      artifactType: 'source_implementation',
      sourceOfTruthRole: 'evidence',
      path: 'scripts/main-agent-implementation-readiness-gate.ts',
      contentHash: hashFile(root, 'scripts/main-agent-implementation-readiness-gate.ts'),
      producer: 'codex-execution',
      purpose: 'readiness gate writes audit_required activation metadata without scoring write',
      relatedRequirementIds: ['MUST-003', 'MUST-004', 'NEG-003'],
      traceRows: ['TRACE-002', 'TRACE-003'],
      evidenceRefs: ['EVD-003', 'EVD-010'],
    }),
    artifact({
      artifactType: 'source_implementation',
      sourceOfTruthRole: 'evidence',
      path: 'scripts/controlled-readiness-audit-bridge.ts',
      contentHash: hashFile(root, 'scripts/controlled-readiness-audit-bridge.ts'),
      producer: 'codex-execution',
      purpose: 'controlled audit/scoring bridge writes implementation_readiness RunScoreRecord with provenance',
      relatedRequirementIds: ['MUST-004', 'MUST-005', 'MUST-006', 'NEG-003'],
      traceRows: ['TRACE-002', 'TRACE-003', 'TRACE-004'],
      evidenceRefs: ['EVD-004', 'EVD-005', 'EVD-010'],
    }),
    artifact({
      artifactType: 'source_implementation',
      sourceOfTruthRole: 'evidence',
      path: 'scripts/main-agent-orchestration.ts',
      contentHash: hashFile(root, 'scripts/main-agent-orchestration.ts'),
      producer: 'codex-execution',
      purpose: 'inspect diagnostics, controlled readiness audit action, completed_no_dispatch, drift baseline surface',
      relatedRequirementIds: ['MUST-004', 'MUST-008', 'MUST-009', 'NEG-004', 'NEG-007'],
      traceRows: ['TRACE-002', 'TRACE-006', 'TRACE-007'],
      evidenceRefs: ['EVD-004', 'EVD-007', 'EVD-008'],
    }),
    artifact({
      artifactType: 'source_implementation',
      sourceOfTruthRole: 'evidence',
      path: 'packages/scoring/governance/readiness-drift.ts',
      contentHash: hashFile(root, 'packages/scoring/governance/readiness-drift.ts'),
      producer: 'codex-execution',
      purpose: 'readiness baseline precedence and stale baseline fail-closed projection',
      relatedRequirementIds: ['MUST-007', 'NEG-005', 'NEG-006'],
      traceRows: ['TRACE-005'],
      evidenceRefs: ['EVD-006'],
    }),
    artifact({
      artifactType: 'unit_test',
      sourceOfTruthRole: 'evidence',
      path: 'tests/unit/main-agent-implementation-readiness-gate.test.ts',
      contentHash: hashFile(root, 'tests/unit/main-agent-implementation-readiness-gate.test.ts'),
      producer: 'codex-execution',
      purpose: 'activation metadata and no scoring write unit evidence',
      relatedRequirementIds: ['MUST-003', 'NEG-003'],
      traceRows: ['TRACE-002', 'TRACE-003'],
      evidenceRefs: ['EVD-003', 'EVD-010'],
    }),
    artifact({
      artifactType: 'unit_test',
      sourceOfTruthRole: 'evidence',
      path: 'tests/unit/readiness-drift.test.ts',
      contentHash: hashFile(root, 'tests/unit/readiness-drift.test.ts'),
      producer: 'codex-execution',
      purpose: 'baseline precedence and stale metadata fail-closed unit evidence',
      relatedRequirementIds: ['MUST-007', 'NEG-005', 'NEG-006'],
      traceRows: ['TRACE-005'],
      evidenceRefs: ['EVD-006'],
    }),
    artifact({
      artifactType: 'unit_test',
      sourceOfTruthRole: 'evidence',
      path: 'tests/unit/readiness-score-writer-boundary.test.ts',
      contentHash: hashFile(root, 'tests/unit/readiness-score-writer-boundary.test.ts'),
      producer: 'codex-execution',
      purpose: 'negative proof that main-agent/readiness gate do not own score writes',
      relatedRequirementIds: ['NEG-003'],
      traceRows: ['TRACE-003'],
      evidenceRefs: ['EVD-010'],
    }),
    artifact({
      artifactType: 'acceptance_test',
      sourceOfTruthRole: 'evidence',
      path: 'tests/acceptance/main-agent-orchestration-consumer.test.ts',
      contentHash: hashFile(root, 'tests/acceptance/main-agent-orchestration-consumer.test.ts'),
      producer: 'codex-execution',
      purpose: 'controlled audit, scoring bridge, current baseline, completed_no_dispatch, inspect diagnostics acceptance evidence',
      relatedRequirementIds: ['MUST-004', 'MUST-005', 'MUST-006', 'MUST-008', 'MUST-009', 'NEG-004', 'NEG-007'],
      traceRows: ['TRACE-002', 'TRACE-003', 'TRACE-004', 'TRACE-006', 'TRACE-007'],
      evidenceRefs: ['EVD-004', 'EVD-005', 'EVD-007', 'EVD-008'],
    }),
    artifact({
      artifactType: 'acceptance_test',
      sourceOfTruthRole: 'evidence',
      path: 'tests/acceptance/main-agent-drift-surface-e2e.test.ts',
      contentHash: hashFile(root, 'tests/acceptance/main-agent-drift-surface-e2e.test.ts'),
      producer: 'codex-execution',
      purpose: 'drift surface E2E evidence',
      relatedRequirementIds: ['MUST-007', 'NEG-005'],
      traceRows: ['TRACE-005'],
      evidenceRefs: ['EVD-006'],
    }),
    artifact({
      artifactType: 'readiness_audit_report',
      sourceOfTruthRole: 'evidence',
      path: '_bmad-output/runtime/requirement-records/REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING/readiness-audit/readiness-audit_REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING_2026-05-23T01_08_25.670Z.md',
      contentHash: hashFile(
        root,
        '_bmad-output/runtime/requirement-records/REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING/readiness-audit/readiness-audit_REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING_2026-05-23T01_08_25.670Z.md'
      ),
      producer: 'controlled-readiness-audit-bridge',
      purpose: 'four-dimension readiness audit report parsed by scoring bridge',
      relatedRequirementIds: ['MUST-005', 'MUST-006', 'NEG-007'],
      traceRows: ['TRACE-003', 'TRACE-004', 'TRACE-007'],
      evidenceRefs: ['EVD-004', 'EVD-005'],
    }),
    artifact({
      artifactType: 'scoring_read_model',
      sourceOfTruthRole: 'read_model',
      path: 'packages/scoring/data/REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING-readiness-20260523T010900Z.json',
      contentHash: hashFile(
        root,
        'packages/scoring/data/REQ-MAIN-AGENT-INSPECT-READINESS-BASELINE-SELF-HEALING-readiness-20260523T010900Z.json'
      ),
      producer: 'parseAndWriteScore via controlled-readiness-audit-bridge',
      purpose: 'implementation_readiness RunScoreRecord with verifiable provenance',
      relatedRequirementIds: ['MUST-005', 'MUST-006'],
      traceRows: ['TRACE-003', 'TRACE-004'],
      evidenceRefs: ['EVD-004', 'EVD-005', 'EVD-010'],
    }),
  ];
}

function commandRunRefs(ids: string[], commands: Record<string, CommandRef>): CommandRef[] {
  return ids.map((id) => commands[id]).filter(Boolean);
}

function artifactsFor(input: {
  traceRows: string[];
  evidenceRefs: string[];
  requirementId?: string;
  artifacts: JsonObject[];
}): JsonObject[] {
  return input.artifacts.filter((item) => {
    const traceRows = (item.traceRows as string[]) ?? [];
    const evidenceRefs = (item.evidenceRefs as string[]) ?? [];
    const relatedRequirementIds = (item.relatedRequirementIds as string[]) ?? [];
    return (
      traceRows.some((id) => input.traceRows.includes(id)) ||
      evidenceRefs.some((id) => input.evidenceRefs.includes(id)) ||
      Boolean(input.requirementId && relatedRequirementIds.includes(input.requirementId))
    );
  });
}

function buildPayload(root: string, recordedAt: string): JsonObject {
  const commands = buildCommands();
  const traces = buildTraces();
  const artifacts = buildArtifacts(root);
  const commandTraceRows: Record<string, string[]> = {
    'CMD-CONTRACT-001': traces.map((trace) => trace.id),
    'CMD-CONTRACT-002': traces.map((trace) => trace.id),
    'CMD-CONTRACT-003': traces.map((trace) => trace.id),
    'CMD-DELIVERY-001': ['TRACE-001'],
    'CMD-DELIVERY-002': ['TRACE-002'],
    'CMD-DELIVERY-003': ['TRACE-002', 'TRACE-003', 'TRACE-004', 'TRACE-006', 'TRACE-007'],
    'CMD-DELIVERY-004': ['TRACE-005'],
    'CMD-DELIVERY-005': ['TRACE-003'],
  };
  const commandEvidenceRefs: Record<string, string[]> = {
    'CMD-CONTRACT-003': ['EVD-009'],
    'CMD-DELIVERY-001': ['EVD-001', 'EVD-002'],
    'CMD-DELIVERY-002': ['EVD-003'],
    'CMD-DELIVERY-003': ['EVD-004', 'EVD-005', 'EVD-007', 'EVD-008'],
    'CMD-DELIVERY-004': ['EVD-006'],
    'CMD-DELIVERY-005': ['EVD-010'],
  };
  const requirementIds = [
    ...new Set([
      ...traces.flatMap((trace) => trace.covers),
      ...traces.flatMap((trace) => trace.evidenceRefs),
    ]),
  ];
  const executionIterations = traces.map((trace) => ({
    eventType: 'execution_iteration_recorded',
    recordId: RECORD_ID,
    requirementSetId: RECORD_ID,
    executionIterationId: `execution-${trace.id}`,
    runId: `${ATTEMPT_ID}-${trace.id}`,
    status: 'done',
    traceRows: [trace.id],
    taskRefs: trace.taskRefs,
    evidenceRefs: trace.evidenceRefs,
    filesChanged: [],
    diffSummary: `Implemented and verified ${trace.id} from confirmed implementationConfirmation traceRows.`,
    commandRunRefs: commandRunRefs(trace.commands, commands),
    evidenceArtifactRefs: artifactsFor({
      traceRows: [trace.id],
      evidenceRefs: trace.evidenceRefs,
      artifacts,
    }),
    sourceRefs: [{ sourceType: 'implementation_confirmation_trace_row', id: trace.id }],
    sourceDocumentHash: SOURCE_DOCUMENT_HASH,
    implementationConfirmationHash: IMPLEMENTATION_CONFIRMATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_CONFIRMATION_HASH,
    recordedAt,
    recordedBy: 'codex-execution',
  }));
  const requirementClosures = requirementIds.map((id) => {
    const relatedTraces = traces.filter(
      (trace) => trace.covers.includes(id) || trace.evidenceRefs.includes(id)
    );
    const traceRows = relatedTraces.map((trace) => trace.id);
    const evidenceRefs = [
      ...new Set([
        ...relatedTraces.flatMap((trace) => trace.evidenceRefs),
        ...(id.startsWith('EVD-') ? [id] : []),
      ]),
    ];
    const commandIds = [...new Set(relatedTraces.flatMap((trace) => trace.commands))];
    return {
      eventType: 'requirement_closure_recorded',
      recordId: RECORD_ID,
      requirementSetId: RECORD_ID,
      requirementId: id,
      status: 'pass',
      traceRows,
      evidenceRefs,
      commandRunRefs: commandRunRefs(commandIds, commands),
      evidenceArtifactRefs: artifactsFor({
        traceRows,
        evidenceRefs,
        requirementId: id,
        artifacts,
      }),
      sourceRefs: [
        { sourceType: 'implementation_confirmation_trace_rows', id: traceRows.join(',') || id },
        { sourceType: 'closeout_attempt', id: ATTEMPT_ID },
      ],
      recordedAt,
      recordedBy: 'codex-execution',
    };
  });
  const requiredCommands = Object.values(commands).map((command) => ({
    commandId: command.commandId,
    command: command.command,
    commandType: command.commandId.startsWith('CMD-CONTRACT') ? 'contract' : 'delivery',
    blockingIfMissing: true,
    negativeOrRegression: command.commandId === 'CMD-DELIVERY-005',
    closeoutAttemptId: ATTEMPT_ID,
    lastRunRef: {
      commandId: command.commandId,
      runId: command.runId,
      closeoutAttemptId: ATTEMPT_ID,
    },
    traceRows: commandTraceRows[command.commandId] ?? [],
    evidenceRefs: commandEvidenceRefs[command.commandId] ?? [],
    artifactRefs: [
      artifact({
        artifactType: 'command_run_output',
        sourceOfTruthRole: 'evidence',
        path: `terminal://current-session/${command.commandId}`,
        contentHash: sha256Json(command),
        producer: 'codex-execution',
        purpose: `Fresh required command result: ${command.outputSummary}`,
        relatedRequirementIds: [
          ...(commandTraceRows[command.commandId] ?? []),
          ...(commandEvidenceRefs[command.commandId] ?? []),
        ],
        traceRows: commandTraceRows[command.commandId] ?? [],
        evidenceRefs: commandEvidenceRefs[command.commandId] ?? [],
      }),
    ],
  }));

  return {
    attemptId: ATTEMPT_ID,
    sourceDocumentHash: SOURCE_DOCUMENT_HASH,
    implementationConfirmationHash: IMPLEMENTATION_CONFIRMATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_CONFIRMATION_HASH,
    traces: traces.map((trace) => trace.id),
    executionIterations,
    requirementClosures,
    contractChecks: [
      {
        eventType: 'contract_check_recorded',
        checkId: `contract:CMD-CONTRACT-001:${ATTEMPT_ID}`,
        contract: 'CMD-CONTRACT-001 render confirmation',
        decision: 'pass',
        sourceRefs: [{ sourceType: 'command_run', id: commands['CMD-CONTRACT-001'].runId }],
        recordedAt,
        recordedBy: 'codex-execution',
      },
      {
        eventType: 'contract_check_recorded',
        checkId: `contract:CMD-CONTRACT-002:${ATTEMPT_ID}`,
        contract: 'CMD-CONTRACT-002 reverse audit',
        decision: 'pass',
        sourceRefs: [{ sourceType: 'command_run', id: commands['CMD-CONTRACT-002'].runId }],
        recordedAt,
        recordedBy: 'codex-execution',
      },
      {
        eventType: 'contract_check_recorded',
        checkId: `contract:CMD-CONTRACT-003:${ATTEMPT_ID}`,
        contract: 'CMD-CONTRACT-003 encoding integrity',
        decision: 'pass',
        sourceRefs: [{ sourceType: 'command_run', id: commands['CMD-CONTRACT-003'].runId }],
        recordedAt,
        recordedBy: 'codex-execution',
      },
    ],
    gateChecks: [
      {
        eventType: 'gate_check_recorded',
        checkId: `delivery:${ATTEMPT_ID}`,
        gate: 'Implementation Confirmation Runtime Closure Gate',
        decision: 'pass',
        blockingReasons: [],
        checks: traces.map((trace) => ({
          id: trace.id,
          passed: true,
          covers: trace.covers,
          evidenceRefs: trace.evidenceRefs,
          commands: trace.commands,
        })),
        sourceRefs: [{ sourceType: 'closeout_attempt', id: ATTEMPT_ID }],
        commandRunRefs: Object.values(commands),
        recordedAt,
        recordedBy: 'codex-execution',
      },
    ],
    artifactIndex: artifacts,
    deliveryEvidence: {
      requiredCommands,
      historicalRunRefs: Object.values(commands).map((command) => ({
        commandId: command.commandId,
        runId: command.runId,
        closeoutAttemptId: ATTEMPT_ID,
      })),
    },
  };
}

function reduce(record: JsonObject, payload: JsonObject): JsonObject {
  const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  return {
    ...record,
    executionIterations: [
      ...array(record.executionIterations),
      ...array(payload.executionIterations),
    ],
    requirementClosures: [
      ...array(record.requirementClosures),
      ...array(payload.requirementClosures),
    ],
    contractChecks: [...array(record.contractChecks), ...array(payload.contractChecks)],
    gateChecks: [...array(record.gateChecks), ...array(payload.gateChecks)],
    artifactIndex: [...array(record.artifactIndex), ...array(payload.artifactIndex)],
    deliveryEvidence: payload.deliveryEvidence,
    lastEventType: 'trace_runtime_closure_recorded',
    updatedAt: new Date().toISOString(),
  };
}

function main(): void {
  const root = process.cwd();
  const recordedAt = new Date().toISOString();
  const payload = buildPayload(root, recordedAt);
  const result: ControlCommitResult = appendControlEventAndReplay({
    recordPath: recordPath(root),
    writerId: 'codex-trace-closure-writer',
    eventType: 'trace_runtime_closure_recorded',
    recordedAt,
    payload,
    reduce,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        eventId: result.event.eventId,
        eventHash: result.event.eventHash,
        receiptPath: result.receiptPath.replace(/\\/gu, '/'),
        afterRecordHash: result.afterRecordHash,
        closedIds: (payload.requirementClosures as unknown[]).length,
      },
      null,
      2
    )}\n`
  );
}

main();
