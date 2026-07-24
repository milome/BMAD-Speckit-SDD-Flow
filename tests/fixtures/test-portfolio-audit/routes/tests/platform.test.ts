import { expect, it } from 'vitest';

it('provides a platform route fixture', () => {
  expect(process.platform).toBeTruthy();
});
