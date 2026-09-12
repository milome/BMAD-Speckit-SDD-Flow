import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CANONICAL_ROOT = path.join(ROOT, '_bmad', 'shared', 'contract-execution-manifest');
const REFERENCE_ROOT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'references',
  'contract-execution-manifest'
);

const PROJECTED_FILES = [
  'build-contract-execution-manifest.js',
  'normalize-contract-execution-manifest.js',
  'hash-contract-execution-manifest.js',
  'audit-contract-execution-manifest.js',
  path.join('schema', 'contract-execution-manifest.schema.json'),
] as const;

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('ContractExecutionManifest req-trace reference parity', () => {
  it.each(PROJECTED_FILES)('%s is an exact projection of the canonical asset', (relativePath) => {
    const canonical = readFileSync(path.join(CANONICAL_ROOT, relativePath));
    const reference = readFileSync(path.join(REFERENCE_ROOT, relativePath));

    expect(reference.equals(canonical)).toBe(true);
    expect(sha256(reference)).toBe(sha256(canonical));
  });
});
