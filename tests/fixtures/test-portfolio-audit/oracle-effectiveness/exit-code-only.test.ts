import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('claims behavior from only a process exit code', () => {
  const result = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  expect(result.status).toBe(0);
});
