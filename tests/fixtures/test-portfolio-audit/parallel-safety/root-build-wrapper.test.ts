import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { it } from 'vitest';

function run(command: string, args: string[]) {
  return spawnSync(command, args, { cwd: process.cwd() });
}

const BUILD_SCRIPT = join(
  process.cwd(),
  'packages',
  'bmad-speckit',
  'scripts',
  'build-main-agent-dist.cjs'
);

it('builds repository runtime output through a local wrapper', () => {
  run(process.execPath, [BUILD_SCRIPT]);
});
