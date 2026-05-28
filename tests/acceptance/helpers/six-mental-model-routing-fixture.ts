import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type JsonObject = Record<string, unknown>;
export type ModelStatus = 'pass' | 'blocked' | 'fail' | 'stale' | 'not_established';

export const SOURCE_HASH =
  'sha256:1111111111111111111111111111111111111111111111111111111111111111';
export const IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
export const PAGE_HASH =
  'sha256:3333333333333333333333333333333333333333333333333333333333333333';

export const MODELS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
] as const;

export type MentalModel = (typeof MODELS)[number];

export const ROUTE_ORDER: MentalModel[] = [...MODELS];

export const NEXT_MODEL: Partial<Record<MentalModel, MentalModel>> = {
  requirement_confirmation: 'architecture_confirmation',
  architecture_confirmation: 'implementation_readiness',
  implementation_readiness: 'execution_closure',
  execution_closure: 'audit_review',
  audit_review: 'delivery_confirmation',
};

export function modelResult(
  model: MentalModel,
  status: ModelStatus,
  blockingReasons: string[] = []
): JsonObject {
  return {
    payloadKind: 'model_result',
    model,
    recordId: 'REQ-SIX-MODEL-ROUTING-E2E',
    requirementSetId: 'REQSET-SIX-MODEL-ROUTING-E2E',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    status,
    resultRecordedAt: '2026-05-28T00:00:00.000Z',
    resultRecordedBy: 'six-model-routing-e2e',
    blockingReasons,
    sourceRefs: [{ sourceType: 'fixture', id: model }],
    currentHashes: {
      sourceDocumentHash: SOURCE_HASH,
      implementationConfirmationHash: IMPLEMENTATION_HASH,
    },
  };
}

function baseRecord(): JsonObject {
  return {
    schemaVersion: 'requirement-record/v1',
    recordId: 'REQ-SIX-MODEL-ROUTING-E2E',
    requirementSetId: 'REQSET-SIX-MODEL-ROUTING-E2E',
    status: 'user_confirmed',
    sourcePath: 'docs/requirements/six-model-routing-e2e.md',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    confirmationPageHash: PAGE_HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-SIX-MODEL-ROUTING-E2E',
        requirementSetId: 'REQSET-SIX-MODEL-ROUTING-E2E',
        confirmedAt: '2026-05-28T00:00:00.000Z',
        confirmedBy: 'test',
        sourcePath: 'docs/requirements/six-model-routing-e2e.md',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationPageHash: PAGE_HASH,
        confirmationText: 'confirmed',
        renderReportPath:
          '_bmad-output/runtime/requirement-records/REQSET-SIX-MODEL-ROUTING-E2E/confirmation/report.json',
        htmlPath:
          '_bmad-output/runtime/requirement-records/REQSET-SIX-MODEL-ROUTING-E2E/confirmation/confirmation.html',
      },
    ],
    currentMentalModel: 'requirement_confirmation',
    mentalModelTransitions: [],
    reconfirmationRequests: [],
    rerunLoops: [],
    sixModelResults: Object.fromEntries(
      ROUTE_ORDER.map((model) => [
        model,
        modelResult(model, model === 'requirement_confirmation' ? 'pass' : 'not_established'),
      ])
    ),
  };
}

export function withRecord<T>(run: (recordPath: string) => T): T {
  const root = mkdtempSync(path.join(os.tmpdir(), 'six-model-routing-e2e-'));
  try {
    const recordPath = path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      'REQSET-SIX-MODEL-ROUTING-E2E',
      'requirement-record.json'
    );
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, `${JSON.stringify(baseRecord(), null, 2)}\n`, 'utf8');
    return run(recordPath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function readRecord(recordPath: string): JsonObject {
  return JSON.parse(readFileSync(recordPath, 'utf8')) as JsonObject;
}

export function modelResults(record: JsonObject): JsonObject {
  return record.sixModelResults as JsonObject;
}
