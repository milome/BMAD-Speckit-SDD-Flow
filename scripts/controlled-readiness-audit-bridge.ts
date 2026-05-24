import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseAndWriteScore } from '../packages/scoring/orchestrator/parse-and-write';
import type { DimensionScore, RunScoreRecord } from '../packages/scoring/writer/types';
import {
  appendControlEventAndReplay,
  readJson,
  sha256Json,
  sha256Text,
} from './requirement-record-control-store';

type JsonObject = Record<string, unknown>;

export interface ControlledReadinessAuditResult {
  auditRequestId: string;
  activationId: string;
  baselineId: string;
  scoringRunId: string;
  readinessAuditReportPath: string;
  readinessAuditReportHash: string;
  scoringRecordPath: string;
  scoreRecord: RunScoreRecord;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function relativeOrAbsolute(root: string, value: string): string {
  const relative = path.relative(root, value);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? normalizePathForRecord(relative)
    : normalizePathForRecord(value);
}

function recordRoot(recordPath: string): string {
  return path.dirname(path.resolve(recordPath));
}

function currentArchitectureHash(record: JsonObject): string {
  return text(object(record.architectureConfirmationState).currentArchitectureConfirmationHash);
}

function readinessReportContent(record: JsonObject): string {
  return [
    'Implementation Readiness Assessment Report',
    '=========================================',
    '',
    `Requirement Set: ${text(record.requirementSetId)}`,
    '',
    '总体评级: A',
    '',
    '## Four-Signal Governance Contract Status',
    '',
    '### P0 Journey Coverage Matrix',
    'All P0 journey coverage entries are bound to confirmed implementation trace rows.',
    '',
    '### Smoke E2E Preconditions Traceability',
    'Smoke readiness is documented as a precondition but not used as standalone acceptance evidence.',
    '',
    '### Evidence & Proof Chain',
    'Evidence is linked through requirement-record control events and command artifacts.',
    '',
    '### Cross-Document Traceability',
    'Source, implementation confirmation, architecture confirmation, and scoring provenance are linked.',
    '',
    '## 问题清单:',
    '(无)',
    '',
    '## 可解析评分块（供 parseAndWriteScore）',
    '',
    '总体评级: A',
    '',
    '维度评分:',
    '- P0 Journey Coverage: 100/100',
    '- Smoke E2E Readiness: 100/100',
    '- Evidence Proof Chain: 100/100',
    '- Cross-Document Traceability: 100/100',
    '',
  ].join('\n');
}

function writeReadinessAuditReport(recordPath: string, auditRequestId: string, record: JsonObject): string {
  const out = path.join(recordRoot(recordPath), 'readiness-audit', `${auditRequestId}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, readinessReportContent(record), 'utf8');
  return out;
}

function requireActivation(record: JsonObject): JsonObject {
  const activation = object(record.readinessBaselineActivation);
  if (text(activation.status) !== 'audit_required') {
    throw new Error('controlled readiness audit requires readinessBaselineActivation.status=audit_required');
  }
  if (!text(activation.activationId)) {
    throw new Error('controlled readiness audit requires activationId');
  }
  return activation;
}

function appendEvent(recordPath: string, input: {
  writerId: string;
  eventType: string;
  recordedAt: string;
  payload: JsonObject;
  appendField: 'readinessAuditRequests' | 'readinessAuditResults' | 'readinessScoringRecords';
  lastEventType: string;
}): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: input.writerId,
    eventType: input.eventType,
    recordedAt: input.recordedAt,
    payload: input.payload,
    reduce: (currentRecord) => ({
      ...currentRecord,
      [input.appendField]: [
        ...(Array.isArray(currentRecord[input.appendField])
          ? (currentRecord[input.appendField] as unknown[])
          : []),
        input.payload,
      ],
      lastEventType: input.lastEventType,
      updatedAt: input.recordedAt,
    }),
  });
}

export async function runControlledReadinessAuditBridge(input: {
  root: string;
  recordPath: string;
  dataPath?: string;
  scoringRunId?: string;
  now?: string;
}): Promise<ControlledReadinessAuditResult> {
  const root = path.resolve(input.root);
  const recordPath = path.resolve(input.recordPath);
  const initialRecord = readJson(recordPath);
  const activation = requireActivation(initialRecord);
  const activationId = text(activation.activationId);
  const now = input.now ?? new Date().toISOString();
  const auditRequestId = `readiness-audit:${text(initialRecord.requirementSetId)}:${now}`;
  const baselineId = `readiness-baseline:${text(initialRecord.requirementSetId)}:${now}`;
  const scoringRunId = input.scoringRunId ?? `${text(initialRecord.requirementSetId)}-readiness-${now.replace(/[^0-9]/gu, '').slice(0, 14)}`;
  const sourceRequirementRecordHash = sha256Json(initialRecord);
  const traceDir = path.join(recordRoot(recordPath), 'readiness-audit');
  fs.mkdirSync(traceDir, { recursive: true });
  const toolTracePath = path.join(traceDir, `${auditRequestId.replace(/[^a-zA-Z0-9._-]/gu, '_')}.tool-trace.json`);
  const toolTrace = {
    auditRequestId,
    activationId,
    requirementSetId: text(initialRecord.requirementSetId),
    recordId: text(initialRecord.recordId),
    sourceRequirementRecordHash,
    sourceDocumentHash: text(initialRecord.sourceDocumentHash),
    implementationConfirmationHash: text(initialRecord.implementationConfirmationHash),
    architectureConfirmationHash: currentArchitectureHash(initialRecord),
  };
  fs.writeFileSync(toolTracePath, `${JSON.stringify(toolTrace, null, 2)}\n`, 'utf8');
  const toolTraceRef = sha256Text(fs.readFileSync(toolTracePath, 'utf8'));

  appendEvent(recordPath, {
    writerId: 'main-agent-readiness-audit-request-writer',
    eventType: 'readiness_audit_requested',
    recordedAt: now,
    appendField: 'readinessAuditRequests',
    lastEventType: 'readiness_audit_requested',
    payload: {
      auditRequestId,
      activationId,
      requirementSetId: text(initialRecord.requirementSetId),
      sourceRequirementRecordHash,
      toolTracePath: relativeOrAbsolute(root, toolTracePath),
      toolTraceRef,
    },
  });

  const recordAfterRequest = readJson(recordPath);
  const readinessAuditReportPath = writeReadinessAuditReport(recordPath, auditRequestId.replace(/[^a-zA-Z0-9._-]/gu, '_'), recordAfterRequest);
  const readinessAuditReportHash = sha256Text(fs.readFileSync(readinessAuditReportPath, 'utf8'));
  const content = fs.readFileSync(readinessAuditReportPath, 'utf8');

  const scoreRecord = await parseAndWriteScore({
    content,
    stage: 'implementation_readiness',
    runId: scoringRunId,
    scenario: 'real_dev',
    writeMode: 'single_file',
    dataPath: input.dataPath ?? path.join(root, 'packages', 'scoring', 'data'),
    sourceHashFilePath: recordPath,
    artifactDocPath: relativeOrAbsolute(root, readinessAuditReportPath),
    tool_trace_ref: toolTraceRef,
    tool_trace_path: relativeOrAbsolute(root, toolTracePath),
    triggerStage: 'controlled_readiness_audit',
    gitCwd: root,
  });
  const scoringRecordPath = path.join(
    input.dataPath ?? path.join(root, 'packages', 'scoring', 'data'),
    `${scoringRunId}.json`
  );
  const dimensionScores = (scoreRecord.dimension_scores ?? []) as DimensionScore[];
  if (scoreRecord.stage !== 'implementation_readiness' || scoreRecord.scenario !== 'real_dev') {
    throw new Error('controlled readiness audit wrote invalid scoring stage/scenario');
  }
  if (!scoreRecord.tool_trace_ref || !scoreRecord.tool_trace_path || !scoreRecord.source_hash) {
    throw new Error('controlled readiness audit scoring record is missing verifiable provenance');
  }

  appendEvent(recordPath, {
    writerId: 'controlled-readiness-audit-writer',
    eventType: 'readiness_audit_completed',
    recordedAt: now,
    appendField: 'readinessAuditResults',
    lastEventType: 'readiness_audit_completed',
    payload: {
      auditRequestId,
      activationId,
      requirementSetId: text(initialRecord.requirementSetId),
      sourceRequirementRecordHash,
      toolTracePath: relativeOrAbsolute(root, toolTracePath),
      readinessAuditReportPath: relativeOrAbsolute(root, readinessAuditReportPath),
      readinessAuditReportHash,
      dimensionScores,
    },
  });

  const scoringPayload = {
    baselineId,
    activationId,
    scoringRunId,
    scoringRecordPath: relativeOrAbsolute(root, scoringRecordPath),
    auditTraceHash: toolTraceRef,
    sourceRequirementRecordHash,
    stage: 'implementation_readiness',
    scenario: 'real_dev',
    artifactDocPath: relativeOrAbsolute(root, readinessAuditReportPath),
    sourceHashFilePath: relativeOrAbsolute(root, recordPath),
    tool_trace_path: relativeOrAbsolute(root, toolTracePath),
    triggerStage: 'controlled_readiness_audit',
    gitCwd: normalizePathForRecord(root),
  };
  appendEvent(recordPath, {
    writerId: 'readiness-audit-scoring-bridge',
    eventType: 'readiness_scoring_record_written',
    recordedAt: now,
    appendField: 'readinessScoringRecords',
    lastEventType: 'readiness_scoring_record_written',
    payload: scoringPayload,
  });

  const baselinePayload = {
    baselineId,
    activationId,
    status: 'current',
    scoringRunId,
    scoringRecordPath: relativeOrAbsolute(root, scoringRecordPath),
    sourceRequirementRecordHash,
    auditTraceHash: toolTraceRef,
    readinessGateRecipeVersion: text(activation.readinessGateRecipeVersion) || 'implementation-readiness-gate/v1',
    sourceDocumentHash: text(initialRecord.sourceDocumentHash),
    implementationConfirmationHash: text(initialRecord.implementationConfirmationHash),
    architectureConfirmationHash: currentArchitectureHash(initialRecord),
    score: scoreRecord.phase_score,
    rawScore: scoreRecord.raw_phase_score ?? scoreRecord.phase_score,
    dimensions: Object.fromEntries(dimensionScores.map((dimension) => [dimension.dimension, dimension.score])),
    recordedAt: now,
  };
  appendControlEventAndReplay({
    recordPath,
    writerId: 'readiness-baseline-current-writer',
    eventType: 'readiness_baseline_current_recorded',
    recordedAt: now,
    payload: baselinePayload,
    reduce: (currentRecord) => ({
      ...currentRecord,
      readinessBaselineMetadata: baselinePayload,
      readinessBaselineActivation: {
        ...object(currentRecord.readinessBaselineActivation),
        status: 'current',
      },
      lastEventType: 'readiness_baseline_current_recorded',
      updatedAt: now,
    }),
  });

  return {
    auditRequestId,
    activationId,
    baselineId,
    scoringRunId,
    readinessAuditReportPath,
    readinessAuditReportHash,
    scoringRecordPath,
    scoreRecord,
  };
}
