import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PACKAGE_SOURCE_SCRIPT_ROOT =
  'packages/bmad-speckit/src/main-agent/source-authority/scripts';
const OWNED_SCORING_WRITER = `${PACKAGE_SOURCE_SCRIPT_ROOT}/controlled-readiness-audit-bridge.ts`;
const FORBIDDEN_DIRECT_WRITERS = [
  `${PACKAGE_SOURCE_SCRIPT_ROOT}/main-agent-implementation-readiness-gate.ts`,
  `${PACKAGE_SOURCE_SCRIPT_ROOT}/main-agent-orchestration.ts`,
];

describe('readiness score writer boundary', () => {
  it('keeps implementation_readiness score writes inside the controlled audit bridge', () => {
    const controlledBridge = readFileSync(OWNED_SCORING_WRITER, 'utf8');

    expect(controlledBridge).toContain('parseAndWriteScore');
    expect(controlledBridge).toContain("stage: 'implementation_readiness'");
    expect(controlledBridge).toContain("triggerStage: 'controlled_readiness_audit'");

    for (const file of FORBIDDEN_DIRECT_WRITERS) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain('parseAndWriteScore');
      expect(content).not.toContain("stage: 'implementation_readiness'");
      expect(content).not.toContain('RunScoreRecord');
    }
  });
});
