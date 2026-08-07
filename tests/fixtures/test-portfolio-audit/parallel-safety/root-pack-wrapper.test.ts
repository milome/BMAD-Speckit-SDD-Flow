import { spawnSync } from 'node:child_process';
import { it } from 'vitest';

const run = (command: string, args: string[]) =>
  spawnSync(command, args, { cwd: process.cwd() });

it('packs from the repository root through a local wrapper', () => {
  run('npm', ['pack']);
});
