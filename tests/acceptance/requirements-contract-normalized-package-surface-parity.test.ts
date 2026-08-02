import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizedPackageFixture } from './helpers/requirements-contract-normalized-package-fixture';
import {
  renderRequirementsContractNormalizedPackage,
  REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_DIST_PATH,
  REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_OWNER_PATH,
  REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_OWNER_PATH,
  REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_SURFACE_PATHS,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-package-renderer';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

function fileHash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

describe('requirements contract normalized package surface parity', () => {
  it('exports one renderer owner, one dist renderer, and declared schema surfaces', () => {
    expect(REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_OWNER_PATH).toBeTypeOf(
      'string'
    );
    expect(REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_DIST_PATH).toBeTypeOf(
      'string'
    );
    expect(REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_OWNER_PATH).toBeTypeOf(
      'string'
    );
    expect(REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_SURFACE_PATHS).toBeInstanceOf(
      Array
    );
  });

  it('keeps every declared normalized-package schema byte-identical', () => {
    expect(REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_OWNER_PATH).toBeTypeOf(
      'string'
    );
    expect(REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_SURFACE_PATHS).toBeInstanceOf(
      Array
    );
    if (
      typeof REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_OWNER_PATH !==
        'string' ||
      !Array.isArray(
        REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_SURFACE_PATHS
      )
    ) {
      return;
    }

    const ownerPath = path.resolve(
      ROOT,
      REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_OWNER_PATH
    );
    expect(existsSync(ownerPath)).toBe(true);
    if (!existsSync(ownerPath)) return;

    const ownerHash = fileHash(ownerPath);
    for (const surfacePath of REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_SURFACE_PATHS) {
      const resolved = path.resolve(ROOT, surfacePath);
      expect(existsSync(resolved), `schema surface is missing: ${surfacePath}`).toBe(
        true
      );
      if (existsSync(resolved)) expect(fileHash(resolved)).toBe(ownerHash);
    }
  });

  it('keeps source and dist renderer behavior identical for the shared fixture', () => {
    expect(REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_DIST_PATH).toBeTypeOf(
      'string'
    );
    if (
      typeof REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_DIST_PATH !==
      'string'
    ) {
      return;
    }

    const distPath = path.resolve(
      ROOT,
      REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_DIST_PATH
    );
    expect(existsSync(distPath)).toBe(true);
    if (!existsSync(distPath)) return;

    const distRenderer = require(distPath) as {
      renderRequirementsContractNormalizedPackage: typeof renderRequirementsContractNormalizedPackage;
    };
    expect(
      distRenderer.renderRequirementsContractNormalizedPackage(
        normalizedPackageFixture()
      )
    ).toEqual(
      renderRequirementsContractNormalizedPackage(normalizedPackageFixture())
    );
  });
});
