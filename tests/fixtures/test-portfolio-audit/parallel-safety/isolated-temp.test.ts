import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';

it('allocates an isolated temporary directory', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'test-portfolio-audit-'));
  expect(workspace).toContain('test-portfolio-audit-');
});
