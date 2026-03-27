import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

function loadSchema(relativePath: string) {
  const schemaPath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
}

describe('runtime dashboard schema contracts', () => {
  it('validates runtime event records against runtime-event.schema.json', () => {
    const schema = loadSchema('packages/scoring/runtime/schema/runtime-event.schema.json');
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const sample = {
      event_id: 'evt-001',
      event_type: 'stage.started',
      event_version: 1,
      timestamp: '2026-03-28T00:00:00.000Z',
      run_id: 'run-001',
      stage: 'implement',
      scope: {
        story_key: '15-1-runtime-dashboard-sft',
      },
      payload: {
        status: 'running',
      },
    };

    expect(validate(sample)).toBe(true);
  });

  it('validates run projections against runtime-run-projection.schema.json', () => {
    const schema = loadSchema('packages/scoring/runtime/schema/runtime-run-projection.schema.json');
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const sample = {
      run_id: 'run-001',
      status: 'running',
      current_stage: 'implement',
      current_scope: {
        story_key: '15-1-runtime-dashboard-sft',
      },
      stage_history: [
        {
          stage: 'implement',
          status: 'running',
          started_at: '2026-03-28T00:00:00.000Z',
        },
      ],
      score_refs: [],
      artifact_refs: [],
      dataset_candidate_refs: [],
      last_event_at: '2026-03-28T00:00:00.000Z',
    };

    expect(validate(sample)).toBe(true);
  });
});
