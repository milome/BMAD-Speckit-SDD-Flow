/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  appendControlEventAndReplay,
  sha256Text,
} from './requirement-record-control-store';

const MODELS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
] as const;

type MentalModel = (typeof MODELS)[number];
type JsonObject = Record<string, unknown>;

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`Unexpected positional argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function modelResult(record: JsonObject, model: MentalModel, status: string, recordedAt: string): JsonObject {
  return {
    payloadKind: 'model_result',
    model,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    status,
    resultRecordedAt: recordedAt,
    resultRecordedBy: 'main-agent-orchestration',
    blockingReasons: status === 'pass' ? [] : [`${model}_not_established`],
    sourceRefs: [
      {
        sourceType: model === 'requirement_confirmation' ? 'confirmation_event' : 'six_model_initialization',
        id:
          model === 'requirement_confirmation'
            ? 'confirmation_recorded'
            : `${model}:not_established`,
      },
    ],
    currentHashes: {
      sourceDocumentHash: text(record.sourceDocumentHash),
      implementationConfirmationHash: text(record.implementationConfirmationHash),
      confirmationPageHash: text(record.confirmationPageHash),
    },
  };
}

function repoRelative(root: string, filePath: string): string {
  const absolute = path.resolve(filePath);
  const relative = path.relative(root, absolute).replace(/\\/gu, '/');
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : absolute.replace(/\\/gu, '/');
}

function updateIndex(input: {
  root: string;
  recordPath: string;
  record: JsonObject;
  recordedAt: string;
}): string {
  const indexPath = path.join(input.root, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
  let index: JsonObject = {
    version: 1,
    source: '_bmad-output/runtime/requirement-records/index.json',
  };
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as JsonObject;
  }
  const recordId = text(input.record.recordId);
  const requirementSetId = text(input.record.requirementSetId) || recordId;
  const recordRef = {
    requirementSetId,
    recordId,
    recordPath: repoRelative(input.root, input.recordPath),
    flow: text(input.record.flow) || text(input.record.entryFlow) || 'standalone_tasks',
    status: text(input.record.status) || 'user_confirmed',
    updatedAt: input.recordedAt,
  };
  const records = Array.isArray(index.records) ? (index.records as JsonObject[]) : [];
  const items = Array.isArray(index.items) ? (index.items as JsonObject[]) : [];
  const nextIndex = {
    ...index,
    version: 1,
    updatedAt: input.recordedAt,
    source: '_bmad-output/runtime/requirement-records/index.json',
    active: {
      requirementSetId,
      recordId,
      recordPath: recordRef.recordPath,
    },
    records: [
      recordRef,
      ...records.filter(
        (item) =>
          text(item.recordId) !== recordId || text(item.requirementSetId) !== requirementSetId
      ),
    ],
    items: [
      {
        requirementId: requirementSetId,
        sourceType: 'controlled_requirement_record',
        flow: recordRef.flow,
        status: recordRef.status,
        recordId,
        requirementSetId,
        recordPath: recordRef.recordPath,
        sourcePath: repoRelative(input.root, text(input.record.sourcePath)),
        sourceDocumentHash: text(input.record.sourceDocumentHash),
        implementationConfirmationHash: text(input.record.implementationConfirmationHash),
        confirmationPageHash: text(input.record.confirmationPageHash),
        updatedAt: input.recordedAt,
      },
      ...items.filter(
        (item) =>
          text(item.requirementId) !== requirementSetId && text(item.recordId) !== recordId
      ),
    ],
  };
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, 'utf8');
  return indexPath;
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const root = path.resolve(text(args.cwd) || process.cwd());
  const requirementRecordArg = text(args.requirementRecord);
  if (!requirementRecordArg) throw new Error('missing --requirement-record');
  const recordPath = path.resolve(requirementRecordArg);
  const recordedAt = text(args.recordedAt) || new Date().toISOString();
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'main-agent-six-model-initializer',
    eventType: 'requirement_confirmation_result_recorded',
    recordedAt,
    payload: {
      model: 'requirement_confirmation',
      status: 'pass',
      recordedAt,
      sourceRefs: [{ sourceType: 'confirmation_event', id: 'confirmation_recorded' }],
    },
    reduce: (record) => {
      const sixModelResults = {
        ...object(record.sixModelResults),
      };
      for (const model of MODELS) {
        sixModelResults[model] = modelResult(
          record,
          model,
          model === 'requirement_confirmation' ? 'pass' : 'not_established',
          recordedAt
        );
      }
      return {
        ...record,
        flow: text(record.flow) || text(record.entryFlow) || 'standalone_tasks',
        stage: 'requirement_confirmation',
        currentStage: 'requirement_confirmation',
        currentMentalModel: 'requirement_confirmation',
        mentalModelTransitions: Array.isArray(record.mentalModelTransitions)
          ? record.mentalModelTransitions
          : [],
        sixModelResults,
        pendingBlockerIntake: Array.isArray(record.pendingBlockerIntake)
          ? record.pendingBlockerIntake
          : [],
        blockerIntakeRuns: Array.isArray(record.blockerIntakeRuns) ? record.blockerIntakeRuns : [],
        reconfirmationRequests: Array.isArray(record.reconfirmationRequests)
          ? record.reconfirmationRequests
          : [],
        architectureConfirmationState: object(record.architectureConfirmationState).status
          ? record.architectureConfirmationState
          : {
              status: 'missing',
              lastEventType: 'requirement_confirmation_result_recorded',
              updatedAt: recordedAt,
            },
        lastEventType: 'requirement_confirmation_result_recorded',
        updatedAt: recordedAt,
      };
    },
  });
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as JsonObject;
  const indexPath = updateIndex({ root, recordPath, record, recordedAt });
  const result = {
    ok: true,
    eventId: commit.event.eventId,
    eventHash: commit.event.eventHash,
    receiptPath: commit.receiptPath.replace(/\\/gu, '/'),
    requirementRecordPath: recordPath.replace(/\\/gu, '/'),
    requirementRecordHash: sha256Text(fs.readFileSync(recordPath, 'utf8')),
    requirementRecordIndexPath: indexPath.replace(/\\/gu, '/'),
  };
  process.stdout.write(
    args.json ? `${JSON.stringify(result, null, 2)}\n` : `initialized=${result.eventId}\n`
  );
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
