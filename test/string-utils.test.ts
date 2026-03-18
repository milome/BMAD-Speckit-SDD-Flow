import { describe, it, expect } from 'vitest';
import { camelCase, kebabCase, truncate, isEmpty } from '../src/string-utils';

describe('camelCase', () => {
  it('should convert space-separated words to camelCase', () => {
    expect(camelCase('hello world')).toBe('helloWorld');
    expect(camelCase('foo bar baz')).toBe('fooBarBaz');
  });

  it('should convert hyphen-separated words to camelCase', () => {
    expect(camelCase('hello-world')).toBe('helloWorld');
    expect(camelCase('foo-bar-baz')).toBe('fooBarBaz');
  });

  it('should convert underscore-separated words to camelCase', () => {
    expect(camelCase('hello_world')).toBe('helloWorld');
    expect(camelCase('foo_bar_baz')).toBe('fooBarBaz');
  });

  it('should handle already camelCase strings', () => {
    expect(camelCase('helloWorld')).toBe('helloWorld');
  });

  it('should handle single word', () => {
    expect(camelCase('hello')).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(camelCase('')).toBe('');
  });

  it('should handle mixed separators', () => {
    expect(camelCase('hello-world foo_bar')).toBe('helloWorldFooBar');
  });

  it('should handle strings with multiple spaces', () => {
    expect(camelCase('hello   world')).toBe('helloWorld');
  });
});

describe('kebabCase', () => {
  it('should convert camelCase to kebab-case', () => {
    expect(kebabCase('helloWorld')).toBe('hello-world');
    expect(kebabCase('fooBarBaz')).toBe('foo-bar-baz');
  });

  it('should convert space-separated words to kebab-case', () => {
    expect(kebabCase('hello world')).toBe('hello-world');
    expect(kebabCase('foo bar baz')).toBe('foo-bar-baz');
  });

  it('should convert PascalCase to kebab-case', () => {
    expect(kebabCase('HelloWorld')).toBe('hello-world');
    expect(kebabCase('Hello World')).toBe('hello-world');
  });

  it('should handle already kebab-case strings', () => {
    expect(kebabCase('hello-world')).toBe('hello-world');
  });

  it('should handle single word', () => {
    expect(kebabCase('hello')).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(kebabCase('')).toBe('');
  });

  it('should handle underscore-separated words', () => {
    expect(kebabCase('hello_world')).toBe('hello-world');
  });
});

describe('truncate', () => {
  it('should truncate string longer than specified length', () => {
    expect(truncate('hello world', 5)).toBe('he...');
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should not truncate string shorter than specified length', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hi', 5)).toBe('hi');
  });

  it('should handle string exactly at length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('should handle negative length', () => {
    expect(truncate('hello', -1)).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('should handle length less than 3', () => {
    expect(truncate('hello', 2)).toBe('...');
    expect(truncate('hello', 1)).toBe('...');
  });
});

describe('isEmpty', () => {
  it('should return true for empty string', () => {
    expect(isEmpty('')).toBe(true);
  });

  it('should return true for whitespace-only string', () => {
    expect(isEmpty('  ')).toBe(true);
    expect(isEmpty('\t')).toBe(true);
    expect(isEmpty('\n')).toBe(true);
    expect(isEmpty('   \t\n  ')).toBe(true);
  });

  it('should return true for null', () => {
    expect(isEmpty(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(isEmpty(undefined)).toBe(true);
  });

  it('should return false for non-empty string', () => {
    expect(isEmpty('hello')).toBe(false);
    expect(isEmpty('  hello  ')).toBe(false);
  });

  it('should return false for string with only whitespace and content', () => {
    expect(isEmpty(' a ')).toBe(false);
  });
});
