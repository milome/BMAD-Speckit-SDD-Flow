import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractTraceEdgeTypeRegistryProjection,
  REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY_OWNER_PATH,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-trace-edge-type-registry';
import { REQUIREMENTS_CONTRACT_PROJECTION_SURFACE_ROOTS } from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-projection-registry';

const ROOT = process.cwd();
const PROJECTION_FILE_NAME = 'requirements-contract-trace-edge-type-registry.json';
const SURFACE_PATHS = REQUIREMENTS_CONTRACT_PROJECTION_SURFACE_ROOTS.map((surfaceRoot) =>
  path.resolve(ROOT, surfaceRoot, PROJECTION_FILE_NAME)
);
const CANONICAL_PATH = SURFACE_PATHS[0]!;
const SCHEMA_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-trace-edge-type-registry.schema.json'
);

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract trace edge-type registry surface parity', () => {
  it('exports one source owner and deterministic projection factory', () => {
    expect(REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY_OWNER_PATH).toBeDefined();
    expect(createRequirementsContractTraceEdgeTypeRegistryProjection).toBeTypeOf('function');
    expect(
      existsSync(path.resolve(ROOT, REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY_OWNER_PATH))
    ).toBe(true);
  });

  it('publishes a schema-valid projection derived from the source owner', () => {
    expect(existsSync(CANONICAL_PATH)).toBe(true);
    expect(existsSync(SCHEMA_PATH)).toBe(true);
    if (!existsSync(CANONICAL_PATH) || !existsSync(SCHEMA_PATH)) return;

    const ownerHash = fileHash(
      path.resolve(ROOT, REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY_OWNER_PATH)
    );
    const projection = JSON.parse(readFileSync(CANONICAL_PATH, 'utf8'));
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(projection), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(projection).toEqual(
      createRequirementsContractTraceEdgeTypeRegistryProjection(ownerHash)
    );
  });

  it('keeps canonical host and package projections byte-identical', () => {
    expect(existsSync(CANONICAL_PATH)).toBe(true);
    if (!existsSync(CANONICAL_PATH)) return;

    const canonicalHash = fileHash(CANONICAL_PATH);
    for (const surfacePath of SURFACE_PATHS) {
      expect(existsSync(surfacePath), `registry surface is missing: ${surfacePath}`).toBe(true);
      if (existsSync(surfacePath)) expect(fileHash(surfacePath)).toBe(canonicalHash);
    }
  });
});
