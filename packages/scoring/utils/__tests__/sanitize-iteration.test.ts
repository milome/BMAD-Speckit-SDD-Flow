import { describe, it, expect } from 'vitest';
import { sanitizeIterationCount } from '../sanitize-iteration';

describe('sanitizeIterationCount', () => {
  it('returns 0 for NaN', () => {
    expect(sanitizeIterationCount(NaN)).toBe(0);
  });

  it('returns 0 for -1', () => {
    expect(sanitizeIterationCount(-1)).toBe(0);
  });

  it('returns 2 for 1.7 (rounds)', () => {
    expect(sanitizeIterationCount(1.7)).toBe(2);
  });

  it('returns 0 for undefined', () => {
    expect(sanitizeIterationCount(undefined)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(sanitizeIterationCount(null)).toBe(0);
  });

  it('returns value for valid positive integer', () => {
    expect(sanitizeIterationCount(3)).toBe(3);
  });
});
