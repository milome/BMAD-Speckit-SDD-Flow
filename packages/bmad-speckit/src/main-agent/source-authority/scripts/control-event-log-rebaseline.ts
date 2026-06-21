/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  appendControlEventAndReplay,
  eventLogPathForRecord,
  readJson,
  sha256Json,
} from './requirement-record-control-store';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  requirementRecord?: string;
  reason?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  json?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readEvents(file: string): JsonObject[] {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8').trim();
  return content ? content.split(/\r?\n/u).map((line) => JSON.parse(line) as JsonObject) : [];
}

function detectedBreaks(events: JsonObject[]): JsonObject[] {
  const breaks: JsonObject[] = [];
  for (let index = 1; index < events.length; index += 1) {
    const expectedPrevious = text(events[index - 1].eventHash);
    const actualPrevious = text(events[index].previousEventHash);
    if (actualPrevious !== expectedPrevious) {
      breaks.push({
        index,
        eventId: text(events[index].eventId),
        expectedPrevious,
        actualPrevious,
      });
    }
  }
  return breaks;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

export function mainControlEventLogRebaseline(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: control-event-log-rebaseline --requirement-record <json> [--reason <text>] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const eventLogPath = eventLogPathForRecord(recordPath);
  const events = readEvents(eventLogPath);
  const recordedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const breaks = detectedBreaks(events);
  const payload = {
    rebaseline: {
      controlled: true,
      mode: 'event-log-chain-rebaseline',
      reason:
        args.reason ??
        'strict closeout proof requires controlled rebaseline after historical event-chain discontinuity',
      detectedBreaks: breaks,
      priorEventCount: events.length,
      priorEventHash: text(events.at(-1)?.eventHash),
      priorRecordHash: sha256Json(record),
      recordEventChainHead: text(record.eventChainHead),
      recordLastAppliedEventHash: text(record.lastAppliedEventHash),
      evaluatedAt: recordedAt,
      evaluatedBy,
    },
  };
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'control-log-rebaseline-writer',
    eventType: 'control_log_rebaseline_recorded',
    recordedAt,
    payload,
    reduce: (currentRecord) => ({
      ...currentRecord,
      lastEventType: 'control_log_rebaseline_recorded',
      updatedAt: recordedAt,
    }),
  });
  const output = {
    ok: true,
    eventLogPath: normalizePathForRecord(commit.eventLogPath),
    controlEventId: commit.event.eventId,
    controlEventHash: commit.event.eventHash,
    receiptPath: normalizePathForRecord(commit.receiptPath),
    detectedBreakCount: breaks.length,
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `control_log_rebaseline=${commit.event.eventHash}\n`
  );
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = mainControlEventLogRebaseline(process.argv.slice(2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    process.exitCode = 2;
  }
}
