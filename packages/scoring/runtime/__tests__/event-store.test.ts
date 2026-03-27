import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appendRuntimeEvent, readRuntimeEvents } from '../event-store';
import { resolveRuntimeEventsPath } from '../path';
import type { RuntimeEvent } from '../types';

function makeEvent(overrides: Partial<RuntimeEvent> = {}): RuntimeEvent {
  return {
    event_id: 'evt-001',
    event_type: 'run.created',
    event_version: 1,
    timestamp: '2026-03-28T00:00:00.000Z',
    run_id: 'run-001',
    payload: {},
    ...overrides,
  };
}

describe('runtime event store', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-events-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('writes append-only runtime event files and reads them back in order', () => {
    const first = makeEvent();
    const second = makeEvent({
      event_id: 'evt-002',
      event_type: 'stage.started',
      stage: 'implement',
      timestamp: '2026-03-28T00:00:01.000Z',
    });

    appendRuntimeEvent(first, { root });
    appendRuntimeEvent(second, { root });

    const files = fs.readdirSync(resolveRuntimeEventsPath(root));
    expect(files.length).toBe(2);

    const events = readRuntimeEvents({ root });
    expect(events.map((event) => event.event_id)).toEqual(['evt-001', 'evt-002']);
  });

  it('ignores tmp files, malformed json, and unsupported event versions', () => {
    const eventsRoot = resolveRuntimeEventsPath(root);
    fs.mkdirSync(eventsRoot, { recursive: true });

    fs.writeFileSync(
      path.join(eventsRoot, 'valid.json'),
      JSON.stringify(makeEvent({ event_id: 'evt-valid' })),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(eventsRoot, 'ignored.tmp'),
      JSON.stringify(makeEvent({ event_id: 'evt-tmp' })),
      'utf-8'
    );
    fs.writeFileSync(path.join(eventsRoot, 'broken.json'), '{not json', 'utf-8');
    fs.writeFileSync(
      path.join(eventsRoot, 'unsupported.json'),
      JSON.stringify(makeEvent({ event_id: 'evt-v2', event_version: 2 })),
      'utf-8'
    );

    const events = readRuntimeEvents({ root });
    expect(events.map((event) => event.event_id)).toEqual(['evt-valid']);
  });
});
