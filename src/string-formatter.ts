/**
 * String Formatter Utility
 *
 * A pure functional string formatting module providing common string operations.
 * All functions are pure and return new strings without modifying inputs.
 *
 * @module string-formatter
 */

/**
 * Represents a nullable string type.
 */
export type NullableString = string | null | undefined;

/**
 * Converts a string to uppercase.
 *
 * @param input - The input string (can be null/undefined)
 * @returns Uppercase string, or empty string for null/undefined
 *
 * @example
 * toUpperCase('hello');  // 'HELLO'
 * toUpperCase(null);     // ''
 * toUpperCase(undefined); // ''
 */
export function toUpperCase(input: NullableString): string {
  if (input == null) return '';
  return input.toUpperCase();
}

/**
 * Converts a string to lowercase.
 *
 * @param input - The input string (can be null/undefined)
 * @returns Lowercase string, or empty string for null/undefined
 *
 * @example
 * toLowerCase('HELLO');  // 'hello'
 * toLowerCase(null);     // ''
 */
export function toLowerCase(input: NullableString): string {
  if (input == null) return '';
  return input.toLowerCase();
}

/**
 * Removes whitespace from both ends of a string.
 *
 * @param input - The input string (can be null/undefined)
 * @returns Trimmed string, or empty string for null/undefined
 *
 * @example
 * trim('  hello  ');  // 'hello'
 * trim(null);         // ''
 */
export function trim(input: NullableString): string {
  if (input == null) return '';
  return input.trim();
}

/**
 * Pads the start of a string with another string until the resulting string reaches the target length.
 *
 * @param input - The input string (can be null/undefined)
 * @param targetLength - The length of the resulting string
 * @param padString - The string to pad with (default: space)
 * @returns Padded string
 *
 * @example
 * padStart('5', 3, '0');   // '005'
 * padStart('hello', 10);   // '     hello'
 * padStart(null, 3, 'x');  // 'xxx'
 */
export function padStart(
  input: NullableString,
  targetLength: number,
  padString: string = ' '
): string {
  // Handle empty padString (GAP-002)
  const pad = padString || ' ';
  if (input == null) return ''.padStart(targetLength, pad);
  return input.padStart(targetLength, pad);
}

/**
 * Pads the end of a string with another string until the resulting string reaches the target length.
 *
 * @param input - The input string (can be null/undefined)
 * @param targetLength - The length of the resulting string
 * @param padString - The string to pad with (default: space)
 * @returns Padded string
 *
 * @example
 * padEnd('5', 3, '0');   // '500'
 * padEnd('hello', 10);   // 'hello     '
 * padEnd(null, 3, 'x');  // 'xxx'
 */
export function padEnd(
  input: NullableString,
  targetLength: number,
  padString: string = ' '
): string {
  // Handle empty padString (GAP-002)
  const pad = padString || ' ';
  if (input == null) return ''.padEnd(targetLength, pad);
  return input.padEnd(targetLength, pad);
}