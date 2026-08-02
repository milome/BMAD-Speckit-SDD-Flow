import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';

it('verifies the stable CLI bin entry', () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  expect(packageJson.bin['test-portfolio-fixture']).toBe('./bin/test-portfolio-fixture.cjs');
});
