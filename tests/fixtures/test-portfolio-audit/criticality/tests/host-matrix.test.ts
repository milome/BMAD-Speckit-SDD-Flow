import { platform } from 'node:os';
import { it } from 'vitest';

it('records an extended host compatibility observation', () => {
  expect(['aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', 'win32']).toContain(platform());
});
