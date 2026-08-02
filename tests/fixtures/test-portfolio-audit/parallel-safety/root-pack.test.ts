import { execFileSync } from 'node:child_process';
import { it } from 'vitest';

it('packs from the repository root', () => {
  execFileSync('npm', ['pack'], { cwd: process.cwd() });
});
