import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ADAPTER_PATH = path.resolve(
  'packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter.ts'
);

describe('requirements-backed Goal shared compiler route', () => {
  it('keeps canonical record lineage and typed compilation on the shared route', () => {
    const source = fs.readFileSync(ADAPTER_PATH, 'utf8');

    expect(source).toMatch(
      /'requirement-records',[\s\S]*requestId,[\s\S]*'record',[\s\S]*'requirement-record\.json'/u
    );
    expect(source).toContain(
      'sourceBindingHash: context.sourceBinding.sourceBindingHash'
    );
    expect(source).toContain('compileConfirmedRequirementsGoalSemantics(');
    expect(source).not.toContain('function renderParentGoal(');
  });
});
