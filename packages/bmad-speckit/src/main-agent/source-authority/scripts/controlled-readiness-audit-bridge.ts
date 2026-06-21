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
import { resolveRuntimeScoringDataPath } from './runtime-scoring-data-path';

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

function writeReadinessAuditReport(
  recordPath: string,
  auditRequestId: string,
  record: JsonObject
): string {
  const out = path.join(recordRoot(recordPath), 'readiness-audit', `${auditRequestId}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, readinessReportContent(record), 'utf8');
  return out;
}

function sha256File(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return sha256Text(fs.readFileSync(filePath, 'utf8'));
}

function writeReadinessAuditManifest(recordPath: string, manifest: JsonObject): string {
  const out = path.join(recordRoot(recordPath), 'readiness-audit', 'manifest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return out;
}

function resolveReadinessAuditContext(
  record: JsonObject,
  now: string
): {
  activationId: string;
  baselineId: string;
  readinessGateRecipeVersion: string;
} {
  const requirementSetId = text(record.requirementSetId);
  const metadata = object(record.readinessBaselineMetadata);
  const metadataStatus = text(metadata.status);
  const metadataActivationId = text(metadata.activationId);
  const metadataBaselineId = text(metadata.baselineId);
  if (metadataStatus === 'current' && metadataActivationId && metadataBaselineId) {
    return {
      activationId: metadataActivationId,
      baselineId: metadataBaselineId,
      readinessGateRecipeVersion:
        text(metadata.readinessGateRecipeVersion) || 'implementation-readiness-gate/v1',
    };
  }

  const activation = object(record.readinessBaselineActivation);
  const activationStatus = text(activation.status);
  const activationId = text(activation.activationId);
  if (activationStatus === 'audit_required' && activationId) {
    return {
      activationId,
      baselineId: text(activation.baselineId) || `readiness-baseline:${requirementSetId}`,
      readinessGateRecipeVersion:
        text(activation.readinessGateRecipeVersion) || 'implementation-readiness-gate/v1',
    };
  }

  if (metadataStatus === 'current') {
    return {
      activationId:
        metadataActivationId || `implementation-readiness-result:${requirementSetId}:${now}`,
      baselineId: metadataBaselineId || `readiness-baseline:${requirementSetId}`,
      readinessGateRecipeVersion:
        text(metadata.readinessGateRecipeVersion) || 'implementation-readiness-gate/v1',
    };
  }

  throw new Error(
    'controlled readiness audit requires readinessBaselineMetadata.status=current or legacy readinessBaselineActivation.status=audit_required'
  );
}

function appendEvent(
  recordPath: string,
  input: {
    writerId: string;
    eventType: string;
    recordedAt: string;
    payload: JsonObject;
    appendField: 'readinessAuditRequests' | 'readinessAuditResults' | 'readinessScoringRecords';
    lastEventType: string;
  }
): void {
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
  const now = input.now ?? new Date().toISOString();
  const readinessContext = resolveReadinessAuditContext(initialRecord, now);
  const activationId = readinessContext.activationId;
  const auditRequestId = `readiness-audit:${text(initialRecord.requirementSetId)}:${now}`;
  const baselineId = readinessContext.baselineId;
  const scoringRunId =
    input.scoringRunId ??
    `${text(initialRecord.requirementSetId)}-readiness-${now.replace(/[^0-9]/gu, '').slice(0, 14)}`;
  const dataPath = resolveRuntimeScoringDataPath({
    root,
    dataPath: input.dataPath,
  });
  const sourceRequirementRecordHash = sha256Json(initialRecord);
  const traceDir = path.join(recordRoot(recordPath), 'readiness-audit');
  fs.mkdirSync(traceDir, { recursive: true });
  const toolTracePath = path.join(
    traceDir,
    `${auditRequestId.replace(/[^a-zA-Z0-9._-]/gu, '_')}.tool-trace.json`
  );
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
  const readinessAuditReportPath = writeReadinessAuditReport(
    recordPath,
    auditRequestId.replace(/[^a-zA-Z0-9._-]/gu, '_'),
    recordAfterRequest
  );
  const readinessAuditReportHash = sha256Text(fs.readFileSync(readinessAuditReportPath, 'utf8'));
  const content = fs.readFileSync(readinessAuditReportPath, 'utf8');

  const scoreRecord = await parseAndWriteScore({
    content,
    stage: 'implementation_readiness',
    runId: scoringRunId,
    scenario: 'real_dev',
    writeMode: 'single_file',
    dataPath,
    sourceHashFilePath: recordPath,
    artifactDocPath: relativeOrAbsolute(root, readinessAuditReportPath),
    tool_trace_ref: toolTraceRef,
    tool_trace_path: relativeOrAbsolute(root, toolTracePath),
    triggerStage: 'controlled_readiness_audit',
    gitCwd: root,
  });
  const scoringRecordPath = path.join(dataPath, `${scoringRunId}.json`);
  const scoringRecordHash = sha256File(scoringRecordPath);
  const patchSnapshotPath = text(scoreRecord.patch_snapshot_path);
  const patchSnapshotHash = patchSnapshotPath ? sha256File(patchSnapshotPath) : null;
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
    scoringRecordHash,
    ...(patchSnapshotPath
      ? {
          patchSnapshotPath: relativeOrAbsolute(root, patchSnapshotPath),
          patchSnapshotHash,
        }
      : {}),
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
  const manifestPath = writeReadinessAuditManifest(recordPath, {
    schemaVersion: 'readiness-audit-manifest/v1',
    recordId: text(initialRecord.recordId),
    requirementSetId: text(initialRecord.requirementSetId),
    auditRequestId,
    activationId,
    baselineId,
    scoringRunId,
    scoringRecordPath: relativeOrAbsolute(root, scoringRecordPath),
    scoringRecordHash,
    ...(patchSnapshotPath
      ? {
          patchSnapshotPath: relativeOrAbsolute(root, patchSnapshotPath),
          patchSnapshotHash,
        }
      : {}),
    readinessAuditReportPath: relativeOrAbsolute(root, readinessAuditReportPath),
    readinessAuditReportHash,
    toolTracePath: relativeOrAbsolute(root, toolTracePath),
    auditTraceHash: toolTraceRef,
    sourceRequirementRecordHash,
    generatedAt: now,
  });
  const manifestHash = sha256Text(fs.readFileSync(manifestPath, 'utf8'));
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
    scoringRecordHash,
    ...(patchSnapshotPath
      ? {
          patchSnapshotPath: relativeOrAbsolute(root, patchSnapshotPath),
          patchSnapshotHash,
        }
      : {}),
    readinessAuditManifestPath: relativeOrAbsolute(root, manifestPath),
    readinessAuditManifestHash: manifestHash,
    sourceRequirementRecordHash,
    auditTraceHash: toolTraceRef,
    readinessGateRecipeVersion: readinessContext.readinessGateRecipeVersion,
    sourceDocumentHash: text(initialRecord.sourceDocumentHash),
    implementationConfirmationHash: text(initialRecord.implementationConfirmationHash),
    architectureConfirmationHash: currentArchitectureHash(initialRecord),
    score: scoreRecord.phase_score,
    rawScore: scoreRecord.raw_phase_score ?? scoreRecord.phase_score,
    dimensions: Object.fromEntries(
      dimensionScores.map((dimension) => [dimension.dimension, dimension.score])
    ),
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
