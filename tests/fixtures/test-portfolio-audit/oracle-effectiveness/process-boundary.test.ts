import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('observes process output across the boundary', () => {
  const result = spawnSync(process.execPath, ['-e', "process.stdout.write('ready')"], {
    encoding: 'utf8',
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('ready');
});
