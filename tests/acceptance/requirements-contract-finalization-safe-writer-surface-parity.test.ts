import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  requirementsContractFinalizationSafeWriteCommand,
  type RequirementsContractFinalizationSafeWriteOptions,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-finalization-safe-writer';

const BASE = 'docs/plans/evidence/loop-engineering-remediation';
const PACKAGE_ROOT = path.resolve('packages/bmad-speckit');
const CLI_PATH = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const DIST_PATH = path.join(
  PACKAGE_ROOT,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-finalization-safe-writer.js'
);
const require = createRequire(import.meta.url);
const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

type Command = (
  options: RequirementsContractFinalizationSafeWriteOptions
) => Promise<Record<string, unknown>>;

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, relativePath);
  const text = `${JSON.stringify(value)}\n`;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  return text;
}

function createFixture(root: string) {
  const requirementSetId = 'req-finalization-surface-parity';
  const implementationAttemptId = 'IMPL-ATTEMPT-SURFACE-PARITY';
  const requirementRecord = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  const draft =
    `${BASE}/.finalization-staging/${implementationAttemptId}` +
    '/safe-write-receipt-manifest.json';
  const target = `${BASE}/safe-write-receipt-manifest.json`;
  const receipt = `${BASE}/finalization-receipts/safe-write-receipt-manifest.receipt.json`;
  const declarationHash = sha256('surface-parity-declaration');
  writeJson(root, requirementRecord, {
    schemaVersion: 'requirement-record/v1',
    recordId: requirementSetId,
    requirementSetId,
    currentAttemptId: implementationAttemptId,
    status: 'user_confirmed',
    sourcePath: 'source.md',
    sourceDocumentHash: sha256('source'),
    implementationConfirmationHash: sha256('confirmation'),
    semanticModelHash: sha256('semantic'),
  });
  const draftBytes = writeJson(root, draft, {
    schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
    finalizationDeclarationHash: declarationHash,
    decision: 'PASS',
  });
  const options: RequirementsContractFinalizationSafeWriteOptions = {
    cwd: root,
    requirementRecord,
    implementationAttemptId,
    draft,
    target,
    receipt,
    blockedReceiptRoot: `${BASE}/finalization-receipts/blocked`,
    artifactRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
    validationProfile: 'safe-write-receipt-manifest',
    minBytes: 2,
    finalizationDeclarationHash: declarationHash,
    expectedPredecessorReceipt: 'not_applicable',
    json: false,
  };
  return { draftBytes, options, receipt, target };
}

async function runDirect(command: Command, prefix: string) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  const fixture = createFixture(root);
  const result = await command(fixture.options);
  return {
    fixture,
    receiptBytes: readFileSync(path.join(root, fixture.receipt), 'utf8'),
    result,
    root,
    targetBytes: readFileSync(path.join(root, fixture.target), 'utf8'),
  };
}

function runCli() {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-cli-parity-'));
  const fixture = createFixture(root);
  const options = fixture.options;
  const result = spawnSync(
    process.execPath,
    [
      CLI_PATH,
      'requirements-contract-finalization-safe-write',
      '--requirement-record',
      options.requirementRecord,
      '--implementation-attempt-id',
      options.implementationAttemptId,
      '--draft',
      options.draft,
      '--target',
      options.target,
      '--receipt',
      options.receipt,
      '--blocked-receipt-root',
      options.blockedReceiptRoot,
      '--artifact-role',
      options.artifactRole,
      '--validation-profile',
      options.validationProfile,
      '--min-bytes',
      String(options.minBytes),
      '--finalization-declaration-hash',
      options.finalizationDeclarationHash,
      '--expected-predecessor-receipt',
      options.expectedPredecessorReceipt,
      '--json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
      windowsHide: true,
    }
  );
  expect(result.status, result.stderr).toBe(0);
  const output = result.stdout.trim().split(/\r?\n/u).filter(Boolean).at(-1) ?? '';
  return {
    fixture,
    receiptBytes: readFileSync(path.join(root, fixture.receipt), 'utf8'),
    result: JSON.parse(output) as Record<string, unknown>,
    root,
    targetBytes: readFileSync(path.join(root, fixture.target), 'utf8'),
  };
}

function comparable(receipt: Record<string, unknown>) {
  const { finalizationRunId: _runId, ...stable } = receipt;
  const target = stable.target as Record<string, unknown>;
  const { nonexistenceProofHash: _nonexistenceProofHash, ...stableTarget } = target;
  return { ...stable, target: stableTarget };
}

describe('requirements contract finalization safe writer surface parity', () => {
  it('executes equivalent source, freshly generated dist, and package CLI promotion behavior', async () => {
    const roots: string[] = [];
    try {
      const build = spawnSync(process.execPath, ['scripts/build-main-agent-dist.cjs'], {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
      expect(existsSync(DIST_PATH)).toBe(true);
      const distModule = require(DIST_PATH) as {
        requirementsContractFinalizationSafeWriteCommand: Command;
      };

      const source = await runDirect(
        requirementsContractFinalizationSafeWriteCommand as Command,
        'requirements-finalization-source-parity-'
      );
      roots.push(source.root);
      const dist = await runDirect(
        distModule.requirementsContractFinalizationSafeWriteCommand,
        'requirements-finalization-dist-parity-'
      );
      roots.push(dist.root);
      const cli = runCli();
      roots.push(cli.root);

      for (const surface of [source, dist, cli]) {
        expect(surface.result).toMatchObject({
          result: 'PASS',
          writerIdentity: 'requirements-contract-finalization-safe-writer/v1',
        });
        expect(surface.targetBytes).toBe(surface.fixture.draftBytes);
        expect(JSON.parse(surface.receiptBytes)).toEqual(surface.result);
        const target = surface.result.target as Record<string, unknown>;
        expect(target.nonexistenceProofHash).toBe(
          sha256(
            `finalization-target-nonexistence/v1\n${target.path}\n${surface.result.finalizationRunId}\n`
          )
        );
      }
      expect(comparable(dist.result)).toEqual(comparable(source.result));
      expect(comparable(cli.result)).toEqual(comparable(source.result));
    } finally {
      for (const root of roots) rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});
