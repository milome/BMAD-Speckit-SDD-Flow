import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

const ROOT = join(import.meta.dirname, '..', '..');

describe('continue gate routing config', () => {
  it('maps workflows and steps to rerunGate across planning and implementation flows', () => {
    const raw = yaml.load(readFileSync(join(ROOT, '_bmad', '_config', 'continue-gate-routing.yaml'), 'utf8')) as any;
    expect(raw.schema).toBe('continue_gate_routing_v1');

    const workflows = raw.routes.map((route: any) => route.workflow);
    expect(workflows).toContain('bmad-create-product-brief');
    expect(workflows).toContain('bmad-create-prd');
    expect(workflows).toContain('bmad-create-architecture');
    expect(workflows).toContain('bmad-check-implementation-readiness');
    expect(workflows).toContain('bmad-create-epics-and-stories');
    expect(workflows).toContain('bmad-create-story');
    expect(workflows).toContain('bmad-dev-story');
    expect(workflows).toContain('speckit-workflow');

    const prdRoute = raw.routes.find((route: any) => route.workflow === 'bmad-create-prd');
    const archRoute = raw.routes.find((route: any) => route.workflow === 'bmad-create-architecture');
    const epicsRoute = raw.routes.find((route: any) => route.workflow === 'bmad-create-epics-and-stories');
    const devStoryRoute = raw.routes.find((route: any) => route.workflow === 'bmad-dev-story');

    expect(prdRoute.steps['step-04-journeys']).toBe('prd-contract-gate');
    expect(prdRoute.steps['step-11-polish']).toBe('prd-contract-gate');
    expect(archRoute.steps['step-04-decisions']).toBe('architecture-contract-gate');
    expect(archRoute.steps['step-07-validation']).toBe('architecture-contract-gate');
    expect(epicsRoute.steps['step-03-create-stories']).toBe('epics-contract-gate');
    expect(devStoryRoute.steps.workflow).toBe('speckit_5_2');
  });
});
