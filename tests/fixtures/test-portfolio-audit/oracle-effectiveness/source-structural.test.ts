import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps the source wiring contract', () => {
  const source = readFileSync('tools/example.cjs', 'utf8');
  expect(source).toContain('module.exports');
});
