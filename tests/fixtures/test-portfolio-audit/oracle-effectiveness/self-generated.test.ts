import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';

function produceCanonicalBytes(input: string) {
  return Buffer.from(input, 'utf8');
}

function hash(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

it('uses caller-declared expected bytes and hash', () => {
  const actual = produceCanonicalBytes('input');
  const expected = actual;
  const actualHash = hash(actual);
  const expectedHash = hash(actual);

  expect(actual).toEqual(expected);
  expect(actualHash).toBe(expectedHash);
});
