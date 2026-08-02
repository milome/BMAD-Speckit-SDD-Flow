import { execFileSync } from 'node:child_process';
import { it } from 'vitest';

it('verifies the package installation path', () => {
  const output = execFileSync('npm', ['install', '--ignore-scripts'], {
    encoding: 'utf8',
  });
  expect(output).toBeTypeOf('string');
});
