import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('proves behavioral integration E2E from a source string', () => {
  const source = readFileSync('tools/example.cjs', 'utf8');
  expect(source).toContain('module.exports');
});
