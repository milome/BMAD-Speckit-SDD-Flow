/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  appendControlEventAndReplay,
  sha256Text,
  type JsonObject,
} from './requirement-record-control-store';

const REPORT_EVENT_TYPE = 'independent_fixture_audit_report_ingested';
const DISPOSITION_EVENT_TYPE = 'independent_fixture_audit_disposition_ingested';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv: string[]): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = 'true';
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`unexpected_argument:${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing_argument:${arg}`);
    if (key === 'reportReceiptHash') {
      const current = Array.isArray(out[key]) ? out[key] as string[] : [];
      current.push(value);
      out[key] = current;
    } else {
      out[key] = value;
    }
    index += 1;
  }
  return out;
}

function required(args: Record<string, string | string[] | undefined>, key: string): string {
  const value = text(args[key]);
  if (!value) throw new Error(`missing_required:${key}`);
  return value;
}

function jsonArtifact(projectRoot: string, relativePath: string): {
  path: string;
  bytes: number;
  sha256: string;
  document: JsonObject;
} {
  if (path.isAbsolute(relativePath) || relativePath.includes('..')) {
    throw new Error('independent_fixture_ingest_artifact_path_unsafe');
  }
  const normalized = relativePath.replace(/\\/gu, '/');
  const file = path.resolve(projectRoot, ...normalized.split('/'));
  const prefix = `${path.resolve(projectRoot)}${path.sep}`;
  if (!file.startsWith(prefix) || !fs.existsSync(file)) {
    throw new Error('independent_fixture_ingest_artifact_missing');
  }
  const bytes = fs.readFileSync(file);
  const document = JSON.parse(bytes.toString('utf8')) as JsonObject;
  return { path: normalized, bytes: bytes.length, sha256: sha256Text(bytes.toString('utf8')), document };
}

function run(argv: string[]): JsonObject {
  const args = parseArgs(argv);
  if (args.help === 'true') {
    return {
      usage: 'independent-fixture-audit-controlled-ingest --record-path <record> --artifact-path <json> --review-epoch <epoch> --artifact-set-hash <sha256> --writer-id <writer> --event-id <id> --producer-execution-id <id> --producer-owner <owner> --producer-session-id <session> --ingested-at <iso> [--perspective <id> --auditor-role <role>] [--disposition true --report-receipt-hash <sha256> x3]',
    };
  }
  const recordPath = path.resolve(required(args, 'recordPath'));
  const projectRoot = path.resolve(text(args.projectRoot) || path.dirname(recordPath));
  const artifact = jsonArtifact(projectRoot, required(args, 'artifactPath'));
  const reviewEpoch = required(args, 'reviewEpoch');
  const artifactSetHash = required(args, 'artifactSetHash');
  const producerExecutionIdentity = {
    executionId: required(args, 'producerExecutionId'),
    owner: required(args, 'producerOwner'),
    sessionId: required(args, 'producerSessionId'),
  };
  const disposition = text(args.disposition) === 'true';
  const eventType = disposition ? DISPOSITION_EVENT_TYPE : REPORT_EVENT_TYPE;
  const eventId = required(args, 'eventId');
  const payload: JsonObject = disposition
    ? {
        dispositionPath: artifact.path,
        dispositionBytes: artifact.bytes,
        dispositionSha256: artifact.sha256,
        reviewEpoch,
        artifactSetHash,
        reportReceiptHashes: Array.isArray(args.reportReceiptHash) ? args.reportReceiptHash : [],
        producerExecutionIdentity,
        ingestedAt: required(args, 'ingestedAt'),
      }
    : {
        reportPath: artifact.path,
        reportBytes: artifact.bytes,
        reportSha256: artifact.sha256,
        reviewEpoch,
        artifactSetHash,
        perspective: required(args, 'perspective'),
        auditorRole: required(args, 'auditorRole'),
        producerExecutionIdentity,
        ingestedAt: required(args, 'ingestedAt'),
      };
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: required(args, 'writerId'),
    eventType,
    eventId,
    recordedAt: payload.ingestedAt as string,
    payload,
    reduce: (current) => current,
  });
  return {
    ok: true,
    eventType,
    eventId: commit.event.eventId,
    eventHash: commit.event.eventHash,
    receiptPath: commit.receiptPath,
    eventLogPath: commit.eventLogPath,
    artifactPath: artifact.path,
    artifactSha256: artifact.sha256,
  };
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(run(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export { run as runIndependentFixtureAuditControlledIngest };
