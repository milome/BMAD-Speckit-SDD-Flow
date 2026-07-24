import { expect, it } from 'vitest';

it('compares a result with itself', () => {
  const actual = { ready: true };
  expect(actual).toEqual(actual);
});
