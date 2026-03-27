import * as fs from 'fs';
import * as path from 'path';
import { resolveRuntimeEventsPath } from './path';
import type { RuntimeEvent } from './types';

const SUPPORTED_EVENT_VERSION = 1;

export interface RuntimeEventStoreOptions {
  root?: string;
}

function sanitizeFilePart(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isRuntimeEvent(value: unknown): value is RuntimeEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.event_id !== 'string' || value.event_id.trim() === '') {
    return false;
  }
  if (typeof value.event_type !== 'string' || value.event_type.trim() === '') {
    return false;
  }
  if (value.event_version !== SUPPORTED_EVENT_VERSION) {
    return false;
  }
  if (typeof value.timestamp !== 'string' || value.timestamp.trim() === '') {
    return false;
  }
  if (typeof value.run_id !== 'string' || value.run_id.trim() === '') {
    return false;
  }
  if (!isRecord(value.payload)) {
    return false;
  }

  return true;
}

function compareEvents(left: RuntimeEvent, right: RuntimeEvent): number {
  const byTimestamp = left.timestamp.localeCompare(right.timestamp);
  if (byTimestamp !== 0) {
    return byTimestamp;
  }
  return left.event_id.localeCompare(right.event_id);
}

export function appendRuntimeEvent(
  event: RuntimeEvent,
  options: RuntimeEventStoreOptions = {}
): string {
  const root = options.root ?? process.cwd();
  const eventsRoot = resolveRuntimeEventsPath(root);
  fs.mkdirSync(eventsRoot, { recursive: true });

  const fileName = `${sanitizeFilePart(event.timestamp)}-${sanitizeFilePart(event.event_id)}.json`;
  const filePath = path.join(eventsRoot, fileName);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  const body = JSON.stringify(event, null, 2) + '\n';

  fs.writeFileSync(tmpPath, body, 'utf-8');
  fs.renameSync(tmpPath, filePath);

  return filePath;
}

export function readRuntimeEvents(
  options: RuntimeEventStoreOptions = {}
): RuntimeEvent[] {
  const root = options.root ?? process.cwd();
  const eventsRoot = resolveRuntimeEventsPath(root);

  if (!fs.existsSync(eventsRoot)) {
    return [];
  }

  const events: RuntimeEvent[] = [];
  const entries = fs.readdirSync(eventsRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (entry.name.endsWith('.tmp') || !entry.name.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(eventsRoot, entry.name);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
      if (isRuntimeEvent(parsed)) {
        events.push(parsed);
      }
    } catch {
      // Ignore malformed event files.
    }
  }

  return events.sort(compareEvents);
}
