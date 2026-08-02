import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractSixModelConsumerInventory,
  REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_DEFINITIONS,
  REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry';

type ConsumerDefinition = {
  consumerId: string;
  canonicalPath: string;
};

type ScopeAmendmentError = Error & {
  code?: string;
  missingConsumerPaths?: string[];
  directAuthorityReadPaths?: string[];
  unregisteredConsumerCount?: number;
  directAuthorityReadCount?: number;
};

const ROOT = process.cwd();
function definitionPath(definition: ConsumerDefinition): string {
  return definition.canonicalPath;
}

function writeFixtureFile(root: string, relativePath: string, source = 'export {};\n'): void {
  const filePath = path.resolve(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, source, 'utf8');
}

function fixtureRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'six-model-consumer-migration-'));
  writeFixtureFile(root, REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH);
  for (const definition of REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_DEFINITIONS as readonly ConsumerDefinition[]) {
    if (definition.canonicalPath === 'generated-host-runtime-bundle') continue;
    writeFixtureFile(root, definitionPath(definition));
  }
  return root;
}

function scopeErrorFor(root: string): ScopeAmendmentError | undefined {
  try {
    createRequirementsContractSixModelConsumerInventory(root);
    return undefined;
  } catch (error) {
    return error as ScopeAmendmentError;
  }
}

describe('requirements contract six-model consumer migration', () => {
  it('requires a scope amendment for dynamically discovered six-model readers and writers', () => {
    const root = fixtureRoot();
    const readerPath = 'packages/example/src/direct-six-model-reader.ts';
    const writerPath = 'packages/example/src/direct-six-model-writer.ts';
    try {
      writeFixtureFile(
        root,
        readerPath,
        'export const status = (record) => record.sixModelResults?.implementation_readiness?.status;\n'
      );
      writeFixtureFile(
        root,
        writerPath,
        'export const update = (record) => ({ ...record, sixModelResults: {} });\n'
      );

      expect(scopeErrorFor(root)).toMatchObject({
        code: 'scope_amendment_required',
        missingConsumerPaths: [readerPath, writerPath],
        unregisteredConsumerCount: 2,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks a registered status consumer that bypasses the verified facade', () => {
    const root = fixtureRoot();
    const registeredConsumer = (
      REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_DEFINITIONS as readonly ConsumerDefinition[]
    ).find((definition) => definition.consumerId === 'six-model-main-orchestration');
    expect(registeredConsumer).toBeDefined();
    if (!registeredConsumer) {
      rmSync(root, { recursive: true, force: true });
      return;
    }
    const consumerPath = definitionPath(registeredConsumer);
    try {
      writeFixtureFile(
        root,
        consumerPath,
        'export const ready = (record) => record.sixModelResults?.implementation_readiness?.status === "pass";\n'
      );

      expect(scopeErrorFor(root)).toMatchObject({
        code: 'scope_amendment_required',
        directAuthorityReadPaths: [consumerPath],
        directAuthorityReadCount: 1,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('registers every current six-model surface with zero direct authority reads', () => {
    const inventory = createRequirementsContractSixModelConsumerInventory(ROOT);

    expect(inventory).toMatchObject({
      missingConsumerPaths: [],
      directAuthorityReadPaths: [],
      unregisteredConsumerCount: 0,
      directAuthorityReadCount: 0,
    });
    expect(inventory.discoveredPaths.length).toBeGreaterThan(0);
    expect(inventory.registeredPaths).toEqual(inventory.discoveredPaths);
  });

  it('keeps the verified facade as the only status authority implementation', () => {
    const facade = readFileSync(
      path.join(
        ROOT,
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-authority-core.cjs'
      ),
      'utf8'
    );
    expect(facade).toContain('function resolveVerifiedSixModelStatus');
    expect(facade).toContain('runtime_status_projection_decision_mismatch');
    expect(facade).toContain('runtime_status_receipt_attempt_stale');
  });
});
