import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { expect, it } from 'vitest';

it('requirements_contract_recovery_finalize_action_missing', () => {
  const cliPath = path.resolve('packages/bmad-speckit/bin/bmad-speckit.js');
  const result = spawnSync(
    process.execPath,
    [cliPath, 'requirements-contract-recovery-finalize', '--help'],
    { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } }
  );

  expect(
    result.status,
    `requirements_contract_recovery_finalize_action_missing\nstdout=${result.stdout}\nstderr=${result.stderr}`
  ).toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toContain(
    'requirements-contract-recovery-finalize'
  );
});
