import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_ACTION_ID,
  REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_CLI_PATH,
  REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_DIST_PATH,
  REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_OWNER_PATH,
  REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_OWNER_PATH,
  REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_SURFACE_PATHS,
  requirementsContractProductionActivateCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-activate';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

function fileHash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

describe('requirements contract production activation receipt surface parity', () => {
  it('exports one action, producer owner, dist producer, CLI, and receipt schema owner', () => {
    for (const value of [
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_ACTION_ID,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_OWNER_PATH,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_DIST_PATH,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_CLI_PATH,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_OWNER_PATH,
    ]) {
      expect(value).toBeTypeOf('string');
    }
    expect(
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_SURFACE_PATHS
    ).toBeInstanceOf(Array);
  });

  it('keeps every declared activation receipt schema byte-identical', () => {
    expect(
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_OWNER_PATH
    ).toBeTypeOf('string');
    expect(
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_SURFACE_PATHS
    ).toBeInstanceOf(Array);
    if (
      typeof REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_OWNER_PATH !==
        'string' ||
      !Array.isArray(
        REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_SURFACE_PATHS
      )
    ) {
      return;
    }

    const ownerPath = path.resolve(
      ROOT,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_OWNER_PATH
    );
    expect(existsSync(ownerPath)).toBe(true);
    if (!existsSync(ownerPath)) return;

    const ownerHash = fileHash(ownerPath);
    for (const surfacePath of REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_SURFACE_PATHS) {
      const resolved = path.resolve(ROOT, surfacePath);
      expect(existsSync(resolved), `receipt schema is missing: ${surfacePath}`).toBe(
        true
      );
      if (existsSync(resolved)) expect(fileHash(resolved)).toBe(ownerHash);
    }
  });

  it('binds the package CLI and dist module to the production command owner', () => {
    for (const value of [
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_ACTION_ID,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_DIST_PATH,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_CLI_PATH,
    ]) {
      expect(value).toBeTypeOf('string');
    }
    if (
      typeof REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_ACTION_ID !== 'string' ||
      typeof REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_DIST_PATH !== 'string' ||
      typeof REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_CLI_PATH !== 'string'
    ) {
      return;
    }

    const distPath = path.resolve(
      ROOT,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_DIST_PATH
    );
    const cliPath = path.resolve(
      ROOT,
      REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_CLI_PATH
    );
    expect(existsSync(distPath)).toBe(true);
    expect(existsSync(cliPath)).toBe(true);
    if (!existsSync(distPath) || !existsSync(cliPath)) return;

    const distModule = require(distPath) as {
      requirementsContractProductionActivateCommand: typeof requirementsContractProductionActivateCommand;
    };
    const cliSource = readFileSync(cliPath, 'utf8');
    expect(distModule.requirementsContractProductionActivateCommand).toBeTypeOf(
      'function'
    );
    expect(cliSource).toContain(
      `.command('${REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_ACTION_ID}')`
    );
    expect(cliSource).toContain(path.basename(REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_DIST_PATH));
  });
});
