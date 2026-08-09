import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractConsumerRegistry,
  REQUIREMENTS_CONTRACT_CONSUMER_DEFINITIONS,
  REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry';

type ConsumerDefinition = {
  fileName?: string;
  path?: string;
};

type ScopeAmendmentError = Error & {
  code?: string;
  discoveredConsumerPaths?: string[];
  missingConsumerPaths?: string[];
  unregisteredConsumerCount?: number;
};

const SCRIPT_ROOT = 'packages/bmad-speckit/src/main-agent/source-authority/scripts';
const ROOT = process.cwd();
const SEMANTIC_READER_SOURCE = `
import { readFileSync } from 'node:fs';

export function readSemanticContract(filePath) {
  const requirementRecord = JSON.parse(readFileSync(filePath, 'utf8'));
  return requirementRecord.implementationConfirmation.currentTargetMap;
}
`;

function writeFixtureFile(root: string, relativePath: string, source = 'export {};\n'): void {
  const filePath = path.resolve(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, source, 'utf8');
}

function declaredConsumerPath(definition: ConsumerDefinition): string {
  return definition.path ?? path.posix.join(SCRIPT_ROOT, definition.fileName ?? '');
}

describe('requirements contract repository-wide production consumer inventory', () => {
  it('requires a scope amendment for undeclared semantic readers on every production surface', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-consumer-inventory-'));
    const productionReaders = [
      'scripts/alpha.ts',
      'scripts/requirements-contract-consumer-registry.js',
      '_bmad/shared/runtime/beta.js',
      'packages/example/src/gamma.ts',
      'packages/example/dist/delta.js',
      'packages/runtime-emit/dist/unregistered-reader.cjs',
      'node_modules/bmad-speckit/dist/epsilon.js',
    ].sort();

    try {
      writeFixtureFile(root, REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH);
      for (const definition of REQUIREMENTS_CONTRACT_CONSUMER_DEFINITIONS as readonly ConsumerDefinition[]) {
        writeFixtureFile(root, declaredConsumerPath(definition));
      }
      for (const readerPath of productionReaders) {
        writeFixtureFile(root, readerPath, SEMANTIC_READER_SOURCE);
      }
      writeFixtureFile(root, '_bmad/shared/.draft/archive.js', SEMANTIC_READER_SOURCE);
      writeFixtureFile(root, 'tests/acceptance/ignored-reader.test.ts', SEMANTIC_READER_SOURCE);
      writeFixtureFile(root, 'packages/example/src/inert-json-reader.ts', "JSON.parse('{}');\n");

      let scopeError: ScopeAmendmentError | undefined;
      try {
        createRequirementsContractConsumerRegistry(root);
      } catch (error) {
        scopeError = error as ScopeAmendmentError;
      }

      expect(scopeError).toMatchObject({
        code: 'scope_amendment_required',
        missingConsumerPaths: productionReaders,
        unregisteredConsumerCount: productionReaders.length,
      });
      if (!scopeError) return;
      expect(scopeError.discoveredConsumerPaths).toEqual(expect.arrayContaining(productionReaders));
      expect(scopeError.discoveredConsumerPaths).not.toContain(
        'tests/acceptance/ignored-reader.test.ts'
      );
      expect(scopeError.discoveredConsumerPaths).not.toContain('_bmad/shared/.draft/archive.js');
      expect(scopeError.discoveredConsumerPaths).not.toContain(
        'packages/example/src/inert-json-reader.ts'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the current repository production semantic reader inventory closed', () => {
    const registry = createRequirementsContractConsumerRegistry(ROOT);

    expect(registry.discovery.unregisteredConsumerCount).toBe(0);
  });
});
