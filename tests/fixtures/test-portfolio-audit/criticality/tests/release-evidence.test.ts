import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';

it('verifies the release workflow evidence path', () => {
  const workflow = readFileSync(join(process.cwd(), '.github', 'workflows', 'release.yml'), 'utf8');
  expect(workflow).toContain('npm pack');
});
