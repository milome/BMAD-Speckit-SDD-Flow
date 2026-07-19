import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractLintProfileRegistryProjection,
  REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY_OWNER_PATH,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-lint-profile-registry';

const ROOT = process.cwd();
const RELATIVE_PROJECTION_PATH = path.join(
  'shared',
  'requirements-contract',
  'requirements-contract-lint-profile-registry.json'
);
const CANONICAL_PATH = path.join(ROOT, '_bmad', RELATIVE_PROJECTION_PATH);
const SCHEMA_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-lint-profile-registry.schema.json'
);
const SURFACE_PATHS = [
  CANONICAL_PATH,
  path.join(ROOT, '.codex', RELATIVE_PROJECTION_PATH),
  path.join(ROOT, '.cursor', RELATIVE_PROJECTION_PATH),
  path.join(ROOT, '.claude', RELATIVE_PROJECTION_PATH),
  path.join(ROOT, 'packages', 'bmad-speckit', '_bmad', RELATIVE_PROJECTION_PATH),
  path.join(
    ROOT,
    'packages',
    'bmad-speckit',
    'dist',
    'main-agent',
    'source-authority',
    '_bmad',
    RELATIVE_PROJECTION_PATH
  ),
];

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract lint-profile registry surface parity', () => {
  it('exports one source owner and deterministic projection factory', () => {
    expect(REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY_OWNER_PATH).toBeDefined();
    expect(createRequirementsContractLintProfileRegistryProjection).toBeTypeOf(
      'function'
    );
    expect(
      existsSync(
        path.resolve(ROOT, REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY_OWNER_PATH)
      )
    ).toBe(true);
  });

  it('publishes a schema-valid projection derived from the lint owner', () => {
    expect(existsSync(CANONICAL_PATH)).toBe(true);
    expect(existsSync(SCHEMA_PATH)).toBe(true);
    if (!existsSync(CANONICAL_PATH) || !existsSync(SCHEMA_PATH)) return;

    const ownerHash = fileHash(
      path.resolve(ROOT, REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY_OWNER_PATH)
    );
    const projection = JSON.parse(readFileSync(CANONICAL_PATH, 'utf8'));
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(projection), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(projection).toEqual(
      createRequirementsContractLintProfileRegistryProjection(ownerHash)
    );
  });

  it('keeps root, package, host, and dist projections byte-identical', () => {
    expect(existsSync(CANONICAL_PATH)).toBe(true);
    if (!existsSync(CANONICAL_PATH)) return;

    const canonicalHash = fileHash(CANONICAL_PATH);
    for (const surfacePath of SURFACE_PATHS) {
      expect(existsSync(surfacePath), `registry surface is missing: ${surfacePath}`).toBe(
        true
      );
      if (existsSync(surfacePath)) expect(fileHash(surfacePath)).toBe(canonicalHash);
    }
  });
});
