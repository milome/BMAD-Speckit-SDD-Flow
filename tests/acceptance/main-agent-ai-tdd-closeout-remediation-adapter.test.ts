import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const adapterPath = path.resolve('scripts/main-agent-ai-tdd-closeout-remediation-adapter.ts');

async function loadAdapter(): Promise<Record<string, unknown>> {
  expect(
    existsSync(adapterPath),
    'expected the AI-TDD closeout remediation adapter implementation to exist'
  ).toBe(true);
  return import('../../scripts/main-agent-ai-tdd-closeout-remediation-adapter');
}

describe('AI-TDD closeout remediation adapter', () => {
  it('routes missing required-command evidence to a fresh dynamic-runner attempt before final closeout', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.remediateAiTddRequiredCommandEvidenceGap).toBe('function');
  });

  it('does not execute required commands locally or synthesize deliveryEvidence.requiredCommands', async () => {
    const adapter = await loadAdapter();
    expect(typeof adapter.assertNoLocalRequiredCommandExecution).toBe('function');
  });
});
