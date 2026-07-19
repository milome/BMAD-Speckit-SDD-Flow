import * as fs from 'node:fs';
import yaml from 'js-yaml';
import { requiredCommandExecutionDescriptorsFromModelPacket } from './requirements-contract-command-execution-receipt';
import { canonicalJson } from './requirements-contract-governed-write';

// Runtime source and packet documents are schema-governed dynamic records.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

export interface ModelPacketParityAudit {
  taskMismatches: string[];
  acceptanceMismatches: string[];
  sourceObligationMismatches: string[];
  commandMismatches: string[];
  stopConditionMismatches: string[];
  amendmentMismatches: string[];
  reverseHashEdges: string[];
  projectionDriftCount: number;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object')
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizedPath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function compare(
  mismatches: string[],
  label: string,
  expected: unknown,
  actual: unknown
): void {
  if (canonicalJson(expected ?? null) !== canonicalJson(actual ?? null)) {
    mismatches.push(label);
  }
}

function sourceCommandRefs(row: JsonRecord): string[] {
  return unique([
    ...strings(row.commandRefs),
    ...strings(row.contractValidationCommandRefs),
    ...strings(row.deliveryEvidenceCommandRefs),
  ]);
}

function sourceCommandProjection(confirmation: JsonRecord): JsonRecord[] {
  const traceRows = records(confirmation.traceRows);
  return records(confirmation.requiredCommands).map((command) => {
    const id = text(command.id ?? command.commandId);
    const directTraceRefs = unique([
      ...strings(command.traceRows),
      ...strings(command.traceRefs),
    ]);
    const traceRefs =
      directTraceRefs.length > 0
        ? directTraceRefs
        : traceRows
            .filter((row) => sourceCommandRefs(row).includes(id))
            .map((row) => text(row.id))
            .filter(Boolean);
    const traceRefSet = new Set(traceRefs);
    const rows = traceRows.filter((row) => traceRefSet.has(text(row.id)));
    return {
      id,
      command: text(command.command),
      traceRefs,
      requirementRefs: unique(
        rows.flatMap((row) => strings(row.covers)).filter((ref) => ref.startsWith('MUST-'))
      ),
      acceptanceRefs: unique(
        rows.flatMap((row) => [
          ...strings(row.acceptanceRefs),
          ...strings(row.e2eRefs),
        ])
      ),
    };
  });
}

function packetCommandProjection(packet: JsonRecord): {
  commands: JsonRecord[];
  issueCodes: string[];
} {
  const result = requiredCommandExecutionDescriptorsFromModelPacket(packet);
  return {
    commands: result.descriptors.map((descriptor) => ({
      id: descriptor.id,
      command: descriptor.command,
      traceRefs: descriptor.traceRefs,
      requirementRefs: descriptor.requirementRefs,
      acceptanceRefs: descriptor.acceptanceRefs,
    })),
    issueCodes: result.issueCodes,
  };
}

function sourceManifestCommandProjection(confirmation: JsonRecord): JsonRecord[] {
  return records(confirmation.requiredCommands).map((command) => ({
    id: text(command.id ?? command.commandId),
    command: text(command.command),
    traceRefs: unique([...strings(command.traceRows), ...strings(command.traceRefs)]),
    evidenceRefs: strings(command.evidenceRefs),
  }));
}

function packetManifestCommandProjection(packet: JsonRecord): JsonRecord[] {
  return records(record(packet.contractExecutionManifest).requiredCommands).map((command) => ({
    id: text(command.id ?? command.commandId),
    command: text(command.command),
    traceRefs: unique([...strings(command.traceRows), ...strings(command.traceRefs)]),
    evidenceRefs: strings(command.evidenceRefs),
  }));
}

function sourceTraceProjection(confirmation: JsonRecord): JsonRecord[] {
  return records(confirmation.traceRows).map((row) => ({
    id: text(row.id),
    covers: strings(row.covers),
    evidenceRefs: strings(row.evidenceRefs),
    commandRefs: sourceCommandRefs(row),
    artifactRefs: strings(row.artifactRefs),
    canonicalSurfaceRefs: strings(row.canonicalSurfaceRefs),
    currentTargetMapRefs: strings(row.currentTargetMapRefs),
    targetModificationPaths: strings(row.targetModificationPaths),
    acceptanceRefs: strings(row.acceptanceRefs),
    status: text(row.status),
  }));
}

function packetTraceProjection(packet: JsonRecord): JsonRecord[] {
  return records(record(packet.contractExecutionManifest).traceRows).map((row) => ({
    id: text(row.id),
    covers: strings(row.covers),
    evidenceRefs: strings(row.evidenceRefs),
    commandRefs: strings(row.commandRefs),
    artifactRefs: strings(row.artifactRefs),
    canonicalSurfaceRefs: strings(row.canonicalSurfaceRefs),
    currentTargetMapRefs: strings(row.currentTargetMapRefs),
    targetModificationPaths: strings(row.targetModificationPaths),
    acceptanceRefs: strings(row.acceptanceRefs),
    status: text(row.status),
  }));
}

function sourceTargetArtifactIds(confirmation: JsonRecord, projection: JsonRecord): string[] {
  if (Array.isArray(projection.targetArtifacts)) {
    return records(projection.targetArtifacts).map((row) => text(row.id)).filter(Boolean);
  }
  const currentTargetMap = record(confirmation.currentTargetMap);
  return [
    ...records(confirmation.artifactAutomationPlan),
    ...records(currentTargetMap.canonicalArtifacts),
    ...records(currentTargetMap.existingArtifacts).filter((row) =>
      Boolean(text(row.completionProofPolicy))
    ),
  ]
    .map((row) => text(row.id))
    .filter(Boolean);
}

function sourceTargetPaths(confirmation: JsonRecord, projection: JsonRecord): JsonRecord[] {
  const value =
    projection.targetModificationPaths !== undefined
      ? projection.targetModificationPaths
      : confirmation.targetModificationPaths;
  return [
    ...stringValues(value).map((item, index) => ({
      id: `TARGET-MOD-${index + 1}`,
      path: normalizedPath(item),
    })),
    ...records(value).map((row, index) => ({
      id: text(row.id) || `TARGET-MOD-${index + 1}`,
      path: normalizedPath(text(row.path ?? row.targetPath ?? row.targetPathOrField)),
    })),
  ];
}

function packetTargetPaths(packet: JsonRecord): JsonRecord[] {
  return records(record(packet.contractExecutionManifest).targetModificationPaths).map((row) => ({
    id: text(row.id),
    path: normalizedPath(text(row.path)),
  }));
}

const FORBIDDEN_PACKET_HASH_KEYS = new Set([
  'transactionManifestHash',
  'promptTransactionManifestHash',
  'auditReceiptHash',
  'generationReceiptHash',
  'modelPacketHash',
  'humanPromptHash',
  'goalExecutionHash',
]);

function collectReverseHashEdges(value: unknown, location = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectReverseHashEdges(item, `${location}[${index}]`)
    );
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as JsonRecord).flatMap(([key, child]) => {
    const childLocation = `${location}.${key}`;
    return [
      ...(FORBIDDEN_PACKET_HASH_KEYS.has(key) ? [childLocation] : []),
      ...collectReverseHashEdges(child, childLocation),
    ];
  });
}

export function auditModelPacketParity(input: {
  sourcePath: string;
  packet: JsonRecord;
}): ModelPacketParityAudit {
  const parsed = yaml.load(fs.readFileSync(input.sourcePath, 'utf8')) as JsonRecord;
  const confirmation = record(parsed?.implementationConfirmation);
  if (Object.keys(confirmation).length === 0) {
    throw new Error('model_packet_parity_source_confirmation_missing');
  }
  const packet = input.packet;
  const packetManifest = record(packet.contractExecutionManifest);
  const projection = record(confirmation.aiTddContractExecutionManifestProjection);
  const taskMismatches: string[] = [];
  const acceptanceMismatches: string[] = [];
  const sourceObligationMismatches: string[] = [];
  const commandMismatches: string[] = [];
  const stopConditionMismatches: string[] = [];
  const amendmentMismatches: string[] = [];

  compare(
    taskMismatches,
    'atomicImplementationTaskList',
    records(confirmation.atomicImplementationTaskList),
    records(packet.atomicImplementationTaskList)
  );
  compare(
    taskMismatches,
    'mustToAtomicTaskMap',
    record(confirmation.mustToAtomicTaskMap),
    record(packet.mustToAtomicTaskMap)
  );
  compare(
    taskMismatches,
    'atomicTaskToTraceMap',
    record(confirmation.atomicTaskToTraceMap),
    record(packet.atomicTaskToTraceMap)
  );

  compare(
    acceptanceMismatches,
    'acceptanceTests',
    records(confirmation.acceptanceTests),
    records(record(packet.errorCaseCoverage).acceptanceTests)
  );
  compare(
    acceptanceMismatches,
    'e2eSuites',
    records(confirmation.e2eSuites),
    records(record(packet.errorCaseCoverage).e2eSuites)
  );

  const packetRequirements = record(packet.requirements);
  compare(
    sourceObligationMismatches,
    'requirements.must',
    records(confirmation.must),
    records(packetRequirements.must)
  );
  compare(
    sourceObligationMismatches,
    'requirements.notDone',
    records(confirmation.notDone),
    records(packetRequirements.notDone)
  );
  compare(
    sourceObligationMismatches,
    'requirements.mustNot',
    records(confirmation.mustNot),
    records(packetRequirements.mustNot)
  );
  compare(
    sourceObligationMismatches,
    'requirements.evidence',
    records(confirmation.evidence),
    records(packetRequirements.evidence)
  );
  compare(
    sourceObligationMismatches,
    'failurePaths',
    records(confirmation.failurePaths),
    records(record(packet.errorCaseCoverage).failurePaths)
  );
  compare(
    sourceObligationMismatches,
    'edgeCases',
    records(confirmation.edgeCases),
    records(record(packet.errorCaseCoverage).edgeCases)
  );
  compare(
    sourceObligationMismatches,
    'traceOrder',
    records(confirmation.traceRows).map((row) => text(row.id)),
    strings(packet.traceOrder)
  );
  compare(
    sourceObligationMismatches,
    'traceRows',
    sourceTraceProjection(confirmation),
    packetTraceProjection(packet)
  );

  const packetCommands = packetCommandProjection(packet);
  commandMismatches.push(...packetCommands.issueCodes);
  compare(
    commandMismatches,
    'requiredCommandExecutionDescriptors',
    sourceCommandProjection(confirmation),
    packetCommands.commands
  );
  compare(
    commandMismatches,
    'contractExecutionManifest.requiredCommands',
    sourceManifestCommandProjection(confirmation),
    packetManifestCommandProjection(packet)
  );

  for (const field of ['finalGateMatrix', 'executionLoopProtocol', 'semanticGapPolicy']) {
    compare(
      stopConditionMismatches,
      field,
      record(projection[field]),
      record(packet[field])
    );
    compare(
      stopConditionMismatches,
      `contractExecutionManifest.${field}`,
      record(projection[field]),
      record(packetManifest[field])
    );
  }

  compare(
    amendmentMismatches,
    'targetArtifacts',
    sourceTargetArtifactIds(confirmation, projection),
    records(packetManifest.targetArtifacts).map((row) => text(row.id)).filter(Boolean)
  );
  compare(
    amendmentMismatches,
    'targetModificationPaths',
    sourceTargetPaths(confirmation, projection),
    packetTargetPaths(packet)
  );
  compare(
    amendmentMismatches,
    'currentTargetMapRefs',
    strings(projection.currentTargetMapRefs),
    strings(packetManifest.currentTargetMapRefs)
  );
  compare(
    amendmentMismatches,
    'canonicalSurfaceRefs',
    strings(projection.canonicalSurfaceRefs),
    strings(packetManifest.canonicalSurfaceRefs)
  );
  compare(
    amendmentMismatches,
    'safeWriteBindings',
    projection.safeWriteBindings ?? null,
    packetManifest.safeWriteBindings ?? null
  );

  const promptTransaction = record(packet.promptTransaction);
  const promptTransactionKeys = Object.keys(promptTransaction).sort();
  const expectedPromptTransactionKeys = [
    'manifestPath',
    'manifestSchemaVersion',
    'transactionId',
  ];
  const reverseHashEdges = collectReverseHashEdges(packet);
  if (canonicalJson(promptTransactionKeys) !== canonicalJson(expectedPromptTransactionKeys)) {
    reverseHashEdges.push('$.promptTransaction');
  }

  const categoryMismatches = [
    taskMismatches,
    acceptanceMismatches,
    sourceObligationMismatches,
    commandMismatches,
    stopConditionMismatches,
    amendmentMismatches,
  ];
  return {
    taskMismatches,
    acceptanceMismatches,
    sourceObligationMismatches,
    commandMismatches,
    stopConditionMismatches,
    amendmentMismatches,
    reverseHashEdges,
    projectionDriftCount: categoryMismatches.reduce(
      (total, mismatches) => total + mismatches.length,
      0
    ),
  };
}
