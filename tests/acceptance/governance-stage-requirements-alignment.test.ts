import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readYaml(relativePath: string): any {
  return yaml.load(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('governance stage requirements alignment', () => {
  it('keeps continue-gate route stages defined in the governance contract', () => {
    const contract = readYaml('_bmad/_config/orchestration-governance.contract.yaml') as {
      stage_requirements: Record<string, unknown>;
    };
    const routing = readYaml('_bmad/_config/continue-gate-routing.yaml') as {
      routes: Array<{ workflow: string; stage: string }>;
    };

    const contractStages = new Set(Object.keys(contract.stage_requirements));
    const missing = routing.routes
      .filter((route) => !contractStages.has(route.stage))
      .map((route) => `${route.workflow}:${route.stage}`);

    expect(missing).toEqual([]);
  });
});
