import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REQUIREMENT_RECORD_SCHEMA_OWNER_PATH,
  REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS,
  resolveRequirementRecordSchemaPath,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-live-schema-gate';

const ROOT = process.cwd();

function fileHash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

describe('requirement record live schema surface parity', () => {
  it('exports one canonical schema owner and a unique declared surface set', () => {
    expect(REQUIREMENT_RECORD_SCHEMA_OWNER_PATH).toBeTypeOf('string');
    expect(REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS).toBeInstanceOf(Array);
    if (
      typeof REQUIREMENT_RECORD_SCHEMA_OWNER_PATH !== 'string' ||
      !Array.isArray(REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS)
    ) {
      return;
    }

    expect(new Set(REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS).size).toBe(
      REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS.length
    );
    expect(REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS).toContain(
      REQUIREMENT_RECORD_SCHEMA_OWNER_PATH
    );
  });

  it('keeps every declared root, package, and dist schema byte-identical', () => {
    expect(REQUIREMENT_RECORD_SCHEMA_OWNER_PATH).toBeTypeOf('string');
    expect(REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS).toBeInstanceOf(Array);
    if (
      typeof REQUIREMENT_RECORD_SCHEMA_OWNER_PATH !== 'string' ||
      !Array.isArray(REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS)
    ) {
      return;
    }

    expect(existsSync(path.resolve(ROOT, REQUIREMENT_RECORD_SCHEMA_OWNER_PATH))).toBe(
      true
    );
    if (
      !existsSync(path.resolve(ROOT, REQUIREMENT_RECORD_SCHEMA_OWNER_PATH))
    ) {
      return;
    }

    const ownerHash = fileHash(
      path.resolve(ROOT, REQUIREMENT_RECORD_SCHEMA_OWNER_PATH)
    );
    for (const surfacePath of REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS) {
      const resolved = path.resolve(ROOT, surfacePath);
      expect(existsSync(resolved), `schema surface is missing: ${surfacePath}`).toBe(
        true
      );
      if (existsSync(resolved)) expect(fileHash(resolved)).toBe(ownerHash);
    }
  });

  it('resolves the live validator schema only through the declared surfaces', () => {
    expect(resolveRequirementRecordSchemaPath).toBeTypeOf('function');
    expect(REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS).toBeInstanceOf(Array);
    if (
      typeof resolveRequirementRecordSchemaPath !== 'function' ||
      !Array.isArray(REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS)
    ) {
      return;
    }

    const resolved = resolveRequirementRecordSchemaPath();
    const declared = REQUIREMENT_RECORD_SCHEMA_SURFACE_PATHS.map((surfacePath) =>
      path.resolve(ROOT, surfacePath)
    );

    expect(declared).toContain(path.resolve(resolved));
  });
});
