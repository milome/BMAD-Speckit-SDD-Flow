import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const generatorPath = path.join(
  repoRoot,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.js'
);

describe('req-trace shared confirmed-requirements Goal compiler route', () => {
  it.each(['req_trace_direct', 'main_agent_compile'] as const)(
    'binds %s to the shared dist compiler and hash-only compilation refs',
    (entry) => {
      const source = readFileSync(generatorPath, 'utf8');

      expect(source).toContain(
        'dist/utils/goal-contract/control-plane/confirmed-requirements-goal-compiler.js'
      );
      expect(source).toContain('compileConfirmedRequirementsGoalSemantics');
      expect(source).toContain(`'${entry}'`);
      expect(source).toContain('sharedGoalCompilation');
      expect(source).toContain('canonicalRequirementSemanticHash');
      expect(source).toContain('goalExecutionIRHash');
      expect(source).toContain('goalExecutionClosureHash');
      expect(source).toContain('goalExecutionProjectionHash');
      expect(source).toContain('sharedGoalProjection');
      expect(source).not.toContain('slotData: buildGoalSlotData');
    }
  );
});
