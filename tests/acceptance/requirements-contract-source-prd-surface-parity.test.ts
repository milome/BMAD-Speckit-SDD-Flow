import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH,
  REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_SURFACE_PATHS,
  REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH,
  REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_SURFACE_PATHS,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-source-prd-rules';

const ROOT = process.cwd();

function fileHash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function expectByteParity(ownerPath: string, surfacePaths: readonly string[]): void {
  const resolvedOwner = path.resolve(ROOT, ownerPath);
  expect(existsSync(resolvedOwner)).toBe(true);
  if (!existsSync(resolvedOwner)) return;

  const ownerHash = fileHash(resolvedOwner);
  for (const surfacePath of surfacePaths) {
    const resolved = path.resolve(ROOT, surfacePath);
    expect(existsSync(resolved), `Source PRD surface is missing: ${surfacePath}`).toBe(
      true
    );
    if (existsSync(resolved)) expect(fileHash(resolved)).toBe(ownerHash);
  }
}

describe('requirements contract Source PRD surface parity', () => {
  it('exports declared template and schema surface sets', () => {
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH).toBeTypeOf(
      'string'
    );
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH).toBeTypeOf('string');
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_SURFACE_PATHS).toBeInstanceOf(
      Array
    );
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_SURFACE_PATHS).toBeInstanceOf(
      Array
    );
  });

  it('keeps source and dist template bytes identical', () => {
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH).toBeTypeOf(
      'string'
    );
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_SURFACE_PATHS).toBeInstanceOf(
      Array
    );
    if (
      typeof REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH !== 'string' ||
      !Array.isArray(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_SURFACE_PATHS)
    ) {
      return;
    }
    expectByteParity(
      REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH,
      REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_SURFACE_PATHS
    );
  });

  it('keeps source and dist template schema bytes identical', () => {
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH).toBeTypeOf('string');
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_SURFACE_PATHS).toBeInstanceOf(
      Array
    );
    if (
      typeof REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH !== 'string' ||
      !Array.isArray(REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_SURFACE_PATHS)
    ) {
      return;
    }
    expectByteParity(
      REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH,
      REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_SURFACE_PATHS
    );
  });
});
