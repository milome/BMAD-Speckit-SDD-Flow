import * as crypto from 'node:crypto';

import type { JsonObject } from './requirement-record-live-schema-gate';

export interface ControlledIngestWriterProjection {
  writerId: string;
  eventTypes: string[];
  writerHash: string;
}

export interface ControlledIngestWriterRegistrySnapshot {
  controlledIngestWriterRegistryRequired: true;
  controlledIngestWriterRegistry: ControlledIngestWriterProjection[];
  controlledIngestWriterRegistryHash: string;
  confirmationWriter: ControlledIngestWriterProjection;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(',')}}`;
}

function writerHashMaterial(row: JsonObject, eventTypes: string[]): JsonObject {
  return {
    writerId: text(row.writerId),
    scriptPath: text(row.scriptPath),
    scriptContentHash: text(row.scriptContentHash),
    ownerModel: text(row.ownerModel),
    allowedWriteApis: row.allowedWriteApis ?? [],
    allowedPaths: row.allowedPaths ?? [],
    allowedEventTypes: eventTypes,
    payloadContractRefs: row.payloadContractRefs ?? [],
    writesControlFields: row.writesControlFields ?? [],
    receiptPath: text(row.receiptPath),
    beforeAfterHashRequired: row.beforeAfterHashRequired === true,
    canModifyWriterRegistry: row.canModifyWriterRegistry === true,
    registryHash: text(row.registryHash),
    architectureConfirmationHash: text(row.architectureConfirmationHash),
  };
}

export function projectControlledIngestWriterRegistry(
  confirmation: JsonObject,
  sourceDocumentHash: string,
  implementationConfirmationHash: string
): ControlledIngestWriterRegistrySnapshot {
  const rows = objects(confirmation.controlledIngestWriterRegistry);
  if (rows.length === 0) {
    throw new Error('controlled_ingest_writer_registry_missing');
  }
  const writers = rows.map((row, index) => {
    const writerId = text(row.writerId);
    const eventTypes = Array.isArray(row.allowedEventTypes)
      ? row.allowedEventTypes.map(text).filter(Boolean)
      : [];
    if (!writerId || eventTypes.length === 0) {
      throw new Error(`controlled_ingest_writer_registry_row_invalid:${index}`);
    }
    for (const field of [
      'scriptPath',
      'scriptContentHash',
      'ownerModel',
      'receiptPath',
      'registryHash',
      'architectureConfirmationHash',
    ]) {
      if (!text(row[field])) {
        throw new Error(`controlled_ingest_writer_registry_field_missing:${writerId}:${field}`);
      }
    }
    if (!isSha256(text(row.scriptContentHash))) {
      throw new Error(`controlled_ingest_writer_script_hash_invalid:${writerId}`);
    }
    if (!isSha256(text(row.registryHash))) {
      throw new Error(`controlled_ingest_writer_registry_hash_invalid:${writerId}`);
    }
    if (!isSha256(text(row.architectureConfirmationHash))) {
      throw new Error(`controlled_ingest_writer_architecture_hash_invalid:${writerId}`);
    }
    if (row.beforeAfterHashRequired !== true || row.canModifyWriterRegistry !== false) {
      throw new Error(`controlled_ingest_writer_mutation_policy_invalid:${writerId}`);
    }
    return {
      writerId,
      eventTypes,
      writerHash: sha256Text(stableStringify(writerHashMaterial(row, eventTypes))),
    };
  });
  if (new Set(writers.map((writer) => writer.writerId)).size !== writers.length) {
    throw new Error('controlled_ingest_writer_registry_duplicate_writer');
  }
  const confirmationWriter = writers.find(
    (writer) => writer.writerId === 'requirements-confirmation-ingest'
  );
  if (!confirmationWriter) {
    throw new Error('controlled_ingest_writer_not_authorized:requirements-confirmation-ingest');
  }
  if (!confirmationWriter.eventTypes.includes('confirmation_recorded')) {
    throw new Error(
      'controlled_ingest_writer_event_not_authorized:requirements-confirmation-ingest:confirmation_recorded'
    );
  }
  const registryPayload = {
    schemaVersion: 'controlled-ingest-writer-registry/v1',
    sourceDocumentHash,
    implementationConfirmationHash,
    writers,
  };
  return {
    controlledIngestWriterRegistryRequired: true,
    controlledIngestWriterRegistry: writers,
    controlledIngestWriterRegistryHash: sha256Text(JSON.stringify(registryPayload)),
    confirmationWriter,
  };
}
