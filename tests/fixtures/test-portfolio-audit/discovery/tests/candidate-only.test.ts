import { expect, test } from 'vitest';

test('looks like a test but is explicitly excluded', () => {
  expect('candidate-only').toBe('candidate-only');
});
