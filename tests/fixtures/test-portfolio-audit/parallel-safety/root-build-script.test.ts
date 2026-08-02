import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { it } from 'vitest';

const BUILD_SCRIPT = join(
  process.cwd(),
  'packages',
  'bmad-speckit',
  'scripts',
  'build-main-agent-dist.cjs'
);

it('builds repository runtime output', () => {
  execFileSync(process.execPath, [BUILD_SCRIPT], { cwd: process.cwd() });
});
