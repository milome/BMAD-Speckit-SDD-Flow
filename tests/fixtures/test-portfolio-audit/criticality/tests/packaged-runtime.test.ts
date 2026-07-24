import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';

it('verifies the packaged runtime entry', () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  expect(packageJson.main).toBe('./dist/runtime.cjs');
});
