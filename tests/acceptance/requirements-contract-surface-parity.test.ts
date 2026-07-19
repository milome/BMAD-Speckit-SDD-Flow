import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

interface ProjectionRegistry {
  schemaVersion: string;
  owner: {
    path: string;
    hash: string;
  };
  registryHash: string;
  projections: Array<{
    projectionId: string;
    canonicalPath: string;
    canonicalHash: string;
    surfacePaths: string[];
    surfaceHashes: Record<string, string>;
    allowedDifferences: string[];
    authority: 'none';
  }>;
}

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(
  ROOT,
  '_bmad',
  'shared',
  'requirements-contract',
  'requirements-contract-projection-registry.json'
);
const SCHEMA_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-projection-registry.schema.json'
);

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract surface parity', () => {
  it('publishes a tracked schema-valid projection registry with one hash-bound owner', () => {
    expect(existsSync(REGISTRY_PATH), 'projection registry is missing').toBe(true);
    expect(existsSync(SCHEMA_PATH), 'projection registry schema is missing').toBe(
      true
    );
    if (!existsSync(REGISTRY_PATH) || !existsSync(SCHEMA_PATH)) return;

    const registry = JSON.parse(
      readFileSync(REGISTRY_PATH, 'utf8')
    ) as ProjectionRegistry;
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(registry), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(existsSync(path.resolve(ROOT, registry.owner.path))).toBe(true);
    expect(registry.owner.hash).toBe(
      fileHash(path.resolve(ROOT, registry.owner.path))
    );
    expect(registry.registryHash).toBe(
      sha256Stable({
        schemaVersion: registry.schemaVersion,
        projections: registry.projections,
      })
    );
  });

  it('derives exact canonical and surface hashes without repository evidence paths', () => {
    expect(existsSync(REGISTRY_PATH), 'projection registry is missing').toBe(true);
    if (!existsSync(REGISTRY_PATH)) return;

    const registry = JSON.parse(
      readFileSync(REGISTRY_PATH, 'utf8')
    ) as ProjectionRegistry;
    expect(new Set(registry.projections.map((row) => row.projectionId)).size).toBe(
      registry.projections.length
    );
    expect(
      new Set(registry.projections.map((row) => row.canonicalPath)).size
    ).toBe(registry.projections.length);
    expect(JSON.stringify(registry)).not.toContain('docs/plans/evidence');

    for (const projection of registry.projections) {
      expect(projection.surfacePaths).toContain(projection.canonicalPath);
      expect(new Set(projection.surfacePaths).size).toBe(
        projection.surfacePaths.length
      );
      expect(Object.keys(projection.surfaceHashes).sort()).toEqual(
        [...projection.surfacePaths].sort()
      );
      expect(projection.allowedDifferences).toEqual([]);
      expect(projection.authority).toBe('none');

      const canonicalPath = path.resolve(ROOT, projection.canonicalPath);
      expect(
        existsSync(canonicalPath),
        `canonical projection is missing: ${projection.canonicalPath}`
      ).toBe(true);
      if (!existsSync(canonicalPath)) continue;

      const canonicalHash = fileHash(canonicalPath);
      expect(projection.canonicalHash).toBe(canonicalHash);
      for (const surfacePath of projection.surfacePaths) {
        const resolved = path.resolve(ROOT, surfacePath);
        expect(
          existsSync(resolved),
          `projection surface is missing: ${surfacePath}`
        ).toBe(true);
        if (existsSync(resolved)) {
          expect(fileHash(resolved)).toBe(canonicalHash);
          expect(projection.surfaceHashes[surfacePath]).toBe(canonicalHash);
        }
      }
    }
  });

});
