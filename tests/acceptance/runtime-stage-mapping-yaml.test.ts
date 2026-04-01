/**
 * §A.3：stage-mapping.yaml 须含 `runtime_flow_stage_to_trigger_stage` 且保留既有顶层键。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

const STAGE_MAPPING = join(import.meta.dirname, '..', '..', '_bmad', '_config', 'stage-mapping.yaml');

describe('stage-mapping.yaml runtime segment', () => {
  it('保留 version / layer_to_stages / stage_to_phase / trigger_modes 且含 runtime_flow_stage_to_trigger_stage', () => {
    const raw = yaml.load(readFileSync(STAGE_MAPPING, 'utf8')) as Record<string, unknown>;
    expect(typeof raw.version).toBe('string');
    expect(raw.layer_to_stages).toBeDefined();
    expect(raw.stage_to_phase).toBeDefined();
    expect(raw.trigger_modes).toBeDefined();
    const rt = raw.runtime_flow_stage_to_trigger_stage as Record<string, Record<string, string>>;
    expect(rt).toBeDefined();
    expect(rt.story?.implement).toBe('speckit_5_2');
    expect(rt.standalone_tasks?.implement).toBe('implement');
    expect(rt.story?.implement).not.toBe(rt.standalone_tasks?.implement);
  });
});
