import { expect, test } from 'vitest';

test('runs a configured non-standard test filename', () => {
  expect('runner-resolved').toBe('runner-resolved');
});
