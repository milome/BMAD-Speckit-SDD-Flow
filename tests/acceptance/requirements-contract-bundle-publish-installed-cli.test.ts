import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

const PACKAGE_ROOT = path.resolve('packages/bmad-speckit');
const NPM_CLI =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const MEMBERS = [
  ['semantic-ir.json', 'requirement-contract-model/v2'],
  ['trace-graph.json', 'requirements-contract-trace-graph/v1'],
  ['target-bindings.json', 'requirements-contract-target-bindings/v1'],
  ['task-graph.json', 'requirements-contract-task-graph/v1'],
  ['red-contracts.json', 'requirements-contract-red-contracts/v1'],
  ['oracle-registry.json', 'requirements-contract-oracle-registry/v1'],
  ['acceptance-contracts.json', 'requirements-contract-acceptance-manifest/v1'],
  ['evidence-requirements.json', 'requirements-contract-evidence-requirements/v1'],
  ['business-behavior-delta.json', 'requirements-contract-business-behavior-delta/v1'],
  ['implementation-impact-map.json', 'requirements-contract-implementation-impact-map/v1'],
] as const;

function run(executable: string, args: string[], cwd: string): string {
  return execFileSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

it(
  'publishes a Bundle revision through the clean-installed package CLI',
  () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-bundle-installed-'));
    try {
      const packRoot = path.join(root, 'pack');
      const consumerRoot = path.join(root, 'consumer');
      mkdirSync(packRoot);
      mkdirSync(consumerRoot);
      run(process.execPath, ['scripts/build-main-agent-dist.cjs'], PACKAGE_ROOT);
      const packOutput = run(
        process.execPath,
        [NPM_CLI, 'pack', '--ignore-scripts', '--silent', '--pack-destination', packRoot],
        PACKAGE_ROOT
      ).trim();
      const tarballPath = path.join(packRoot, packOutput.split(/\r?\n/u).at(-1) ?? '');
      writeJson(path.join(consumerRoot, 'package.json'), {
        name: 'requirements-bundle-installed-consumer',
        private: true,
      });
      run(
        process.execPath,
        [
          NPM_CLI,
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--no-package-lock',
          tarballPath,
        ],
        consumerRoot
      );

      const requirementSetId = `req-${randomUUID()}`;
      const acceptanceRootId = `AR-${randomUUID()}`;
      const recordRoot = path.join(
        consumerRoot,
        '_bmad-output/runtime/requirement-records',
        requirementSetId
      );
      const currentRoot = path.join(recordRoot, 'authoring/current');
      mkdirSync(path.join(currentRoot, 'proofs'), { recursive: true });
      const sourcePath = path.join(consumerRoot, 'source.md');
      writeFileSync(sourcePath, '# Source\n', 'utf8');
      const recordPath = path.join(recordRoot, 'requirement-record.json');
      writeJson(recordPath, {
        schemaVersion: 'requirement-record/v1',
        recordId: requirementSetId,
        requirementSetId,
        currentAttemptId: `IMP-${randomUUID()}`,
        status: 'user_confirmed',
        sourcePath,
        sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
        implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
        confirmationHistory: createRecordedConfirmationHistory({
          recordId: requirementSetId,
          sourcePath,
          sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
          implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
        }),
        semanticModelHash: `sha256:${'3'.repeat(64)}`,
        recordRevision: 0,
        activeBundleRevision: null,
      });
      for (const [fileName, schemaVersion] of MEMBERS) {
        writeJson(
          path.join(currentRoot, fileName),
          fileName === 'acceptance-contracts.json'
            ? { schemaVersion, acceptanceRootIds: [acceptanceRootId] }
            : { schemaVersion, id: `${fileName}-${randomUUID()}` }
        );
      }
      writeJson(path.join(currentRoot, 'acceptance-root-proof-manifest.json'), {
        orderedRootIds: [acceptanceRootId],
      });
      for (const proofName of [
        'intake-receipt.json',
        'intent-lineage-ledger.json',
        'semantic-conservation-manifest.json',
      ]) {
        writeJson(path.join(currentRoot, 'proofs', proofName), { decision: 'pass' });
      }

      const receiptPath = path.join(consumerRoot, 'bundle-publication-receipt.json');
      const binPath = path.join(
        consumerRoot,
        'node_modules/bmad-speckit/bin/bmad-speckit.js'
      );
      const stdout = run(
        process.execPath,
        [
          binPath,
          'requirements-contract-bundle-publish',
          '--requirement-record',
          path.relative(consumerRoot, recordPath),
          '--source-document',
          path.relative(consumerRoot, sourcePath),
          '--receipt',
          path.relative(consumerRoot, receiptPath),
          '--json',
        ],
        consumerRoot
      );
      const receipt = JSON.parse(stdout.trim());
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const revisionRoot = path.join(
        recordRoot,
        'authoring/revisions',
        receipt.bundleRevision
      );

      expect(receipt).toMatchObject({ commandId: 'CMD-26', result: 'pass' });
      expect(record).toMatchObject({
        recordRevision: 1,
        activeBundleRevision: receipt.bundleRevision,
      });
      expect(readdirSync(revisionRoot)).toHaveLength(11);
      expect(JSON.parse(readFileSync(receiptPath, 'utf8'))).toEqual(receipt);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  120_000
);
