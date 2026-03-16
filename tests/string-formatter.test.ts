/**
 * Unit tests for String Formatter Utility
 *
 * @module string-formatter.test
 */

import { describe, it, expect } from 'vitest';
import {
  toUpperCase,
  toLowerCase,
  trim,
  padStart,
  padEnd,
  NullableString,
} from '../src/string-formatter';

describe('String Formatter Utility', () => {
  describe('toUpperCase', () => {
    describe('normal cases', () => {
      it('should convert lowercase string to uppercase', () => {
        expect(toUpperCase('hello')).toBe('HELLO');
      });

      it('should convert mixed case string to uppercase', () => {
        expect(toUpperCase('HeLLo WoRLd')).toBe('HELLO WORLD');
      });

      it('should return already uppercase string unchanged', () => {
        expect(toUpperCase('HELLO')).toBe('HELLO');
      });

      it('should handle unicode characters', () => {
        expect(toUpperCase('héllo')).toBe('HÉLLO');
      });
    });

    describe('empty string handling', () => {
      it('should return empty string for empty input', () => {
        expect(toUpperCase('')).toBe('');
      });
    });

    describe('null/undefined handling', () => {
      it('should return empty string for null', () => {
        expect(toUpperCase(null)).toBe('');
      });

      it('should return empty string for undefined', () => {
        expect(toUpperCase(undefined)).toBe('');
      });
    });
  });

  describe('toLowerCase', () => {
    describe('normal cases', () => {
      it('should convert uppercase string to lowercase', () => {
        expect(toLowerCase('HELLO')).toBe('hello');
      });

      it('should convert mixed case string to lowercase', () => {
        expect(toLowerCase('HeLLo WoRLd')).toBe('hello world');
      });

      it('should return already lowercase string unchanged', () => {
        expect(toLowerCase('hello')).toBe('hello');
      });

      it('should handle unicode characters', () => {
        expect(toLowerCase('HÉLLO')).toBe('héllo');
      });
    });

    describe('empty string handling', () => {
      it('should return empty string for empty input', () => {
        expect(toLowerCase('')).toBe('');
      });
    });

    describe('null/undefined handling', () => {
      it('should return empty string for null', () => {
        expect(toLowerCase(null)).toBe('');
      });

      it('should return empty string for undefined', () => {
        expect(toLowerCase(undefined)).toBe('');
      });
    });
  });

  describe('trim', () => {
    describe('normal cases', () => {
      it('should remove leading and trailing spaces', () => {
        expect(trim('  hello  ')).toBe('hello');
      });

      it('should remove tabs', () => {
        expect(trim('\thello\t')).toBe('hello');
      });

      it('should remove newlines', () => {
        expect(trim('\nhello\n')).toBe('hello');
      });

      it('should remove mixed whitespace', () => {
        expect(trim(' \t\n hello \n\t ')).toBe('hello');
      });

      it('should not remove internal spaces', () => {
        expect(trim('  hello world  ')).toBe('hello world');
      });

      it('should return string without whitespace unchanged', () => {
        expect(trim('hello')).toBe('hello');
      });
    });

    describe('whitespace-only strings', () => {
      it('should return empty string for spaces only', () => {
        expect(trim('   ')).toBe('');
      });

      it('should return empty string for mixed whitespace only', () => {
        expect(trim(' \t\n\r ')).toBe('');
      });
    });

    describe('empty string handling', () => {
      it('should return empty string for empty input', () => {
        expect(trim('')).toBe('');
      });
    });

    describe('null/undefined handling', () => {
      it('should return empty string for null', () => {
        expect(trim(null)).toBe('');
      });

      it('should return empty string for undefined', () => {
        expect(trim(undefined)).toBe('');
      });
    });
  });

  describe('padStart', () => {
    describe('normal cases', () => {
      it('should pad with default space', () => {
        expect(padStart('hello', 10)).toBe('     hello');
      });

      it('should pad with custom character', () => {
        expect(padStart('5', 3, '0')).toBe('005');
      });

      it('should pad with multi-character string', () => {
        expect(padStart('5', 5, 'ab')).toBe('abab5');
      });
    });

    describe('boundary conditions', () => {
      it('should return original string when targetLength equals string length', () => {
        expect(padStart('hello', 5, 'x')).toBe('hello');
      });

      it('should return original string when targetLength is less than string length', () => {
        expect(padStart('hello', 3, 'x')).toBe('hello');
      });

      it('should handle targetLength of 0', () => {
        expect(padStart('hello', 0, 'x')).toBe('hello');
      });

      // GAP-001: negative targetLength
      it('should handle negative targetLength', () => {
        expect(padStart('hello', -1, 'x')).toBe('hello');
        expect(padStart('hello', -100, 'x')).toBe('hello');
      });
    });

    describe('padString handling', () => {
      // GAP-002: empty padString
      it('should use default space when padString is empty', () => {
        expect(padStart('5', 3, '')).toBe('  5');
      });

      it('should use default space when padString is undefined', () => {
        expect(padStart('5', 3)).toBe('  5');
      });
    });

    describe('null/undefined handling', () => {
      it('should return padded empty string for null input', () => {
        expect(padStart(null, 3, 'x')).toBe('xxx');
      });

      it('should return padded empty string for undefined input', () => {
        expect(padStart(undefined, 3, 'x')).toBe('xxx');
      });

      it('should return empty string for null with targetLength 0', () => {
        expect(padStart(null, 0, 'x')).toBe('');
      });
    });
  });

  describe('padEnd', () => {
    describe('normal cases', () => {
      it('should pad with default space', () => {
        expect(padEnd('hello', 10)).toBe('hello     ');
      });

      it('should pad with custom character', () => {
        expect(padEnd('5', 3, '0')).toBe('500');
      });

      it('should pad with multi-character string', () => {
        expect(padEnd('5', 5, 'ab')).toBe('5abab');
      });
    });

    describe('boundary conditions', () => {
      it('should return original string when targetLength equals string length', () => {
        expect(padEnd('hello', 5, 'x')).toBe('hello');
      });

      it('should return original string when targetLength is less than string length', () => {
        expect(padEnd('hello', 3, 'x')).toBe('hello');
      });

      it('should handle targetLength of 0', () => {
        expect(padEnd('hello', 0, 'x')).toBe('hello');
      });

      // GAP-001: negative targetLength
      it('should handle negative targetLength', () => {
        expect(padEnd('hello', -1, 'x')).toBe('hello');
        expect(padEnd('hello', -100, 'x')).toBe('hello');
      });
    });

    describe('padString handling', () => {
      // GAP-002: empty padString
      it('should use default space when padString is empty', () => {
        expect(padEnd('5', 3, '')).toBe('5  ');
      });

      it('should use default space when padString is undefined', () => {
        expect(padEnd('5', 3)).toBe('5  ');
      });
    });

    describe('null/undefined handling', () => {
      it('should return padded empty string for null input', () => {
        expect(padEnd(null, 3, 'x')).toBe('xxx');
      });

      it('should return padded empty string for undefined input', () => {
        expect(padEnd(undefined, 3, 'x')).toBe('xxx');
      });

      it('should return empty string for null with targetLength 0', () => {
        expect(padEnd(null, 0, 'x')).toBe('');
      });
    });
  });

  describe('immutability guarantee', () => {
    it('should not modify original string (toUpperCase)', () => {
      const original = 'hello';
      const result = toUpperCase(original);
      expect(original).toBe('hello');
      expect(result).toBe('HELLO');
    });

    it('should not modify original string (toLowerCase)', () => {
      const original = 'HELLO';
      const result = toLowerCase(original);
      expect(original).toBe('HELLO');
      expect(result).toBe('hello');
    });

    it('should not modify original string (trim)', () => {
      const original = '  hello  ';
      const result = trim(original);
      expect(original).toBe('  hello  ');
      expect(result).toBe('hello');
    });

    it('should not modify original string (padStart)', () => {
      const original = '5';
      const result = padStart(original, 3, '0');
      expect(original).toBe('5');
      expect(result).toBe('005');
    });

    it('should not modify original string (padEnd)', () => {
      const original = '5';
      const result = padEnd(original, 3, '0');
      expect(original).toBe('5');
      expect(result).toBe('500');
    });
  });
});