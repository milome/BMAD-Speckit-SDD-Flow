export type PlaceholderType =
  | 'path'
  | 'command'
  | 'identifier'
  | 'stage_key'
  | 'plain_text'
  | 'markdown_block';

export const PROTECTED_PLACEHOLDER_TYPES: ReadonlySet<PlaceholderType> = new Set([
  'path',
  'command',
  'identifier',
  'stage_key',
]);
