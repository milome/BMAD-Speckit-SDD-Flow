import { expect, it } from 'vitest';

function parsePositive(value: number) {
  if (value < 0) throw new Error('negative value');
  return value;
}

it('rejects the negative fixture', () => {
  expect(() => parsePositive(-1)).toThrow('negative value');
});
