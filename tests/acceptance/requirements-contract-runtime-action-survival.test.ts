import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CLI_PATH = path.resolve('packages/bmad-speckit/bin/bmad-speckit.js');
const ACTIONS = [
  'requirements-contract-six-model-projection-parity-verify',
  'requirements-contract-consumer-cli-capability-observe',
  'requirements-contract-eval',
  'requirements-contract-critical-auditor-judge-adapter',
  'requirements-contract-prompt-transaction-publish',
  'requirements-contract-production-bypass-evidence-materialize',
  'requirements-contract-production-bypass-verify',
  'requirements-contract-recovery-bootstrap',
  'requirements-contract-recovery-finalize',
] as const;

function runAction(actionId: string, args: string[] = []) {
  return spawnSync(process.execPath, [CLI_PATH, actionId, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

describe('requirements contract runtime action survival boundary', () => {
  it.each(ACTIONS)('keeps %s registered and fail closed without required inputs', (actionId) => {
    const help = runAction(actionId, ['--help']);
    expect(help.status, `${help.stdout}\n${help.stderr}`).toBe(0);
    expect(`${help.stdout}\n${help.stderr}`).toContain(actionId);

    const missingInput = runAction(actionId);
    const output = `${missingInput.stdout}\n${missingInput.stderr}`;
    expect(missingInput.status, output).not.toBe(0);
    expect(output).not.toContain(`unknown command '${actionId}'`);
  });
});
