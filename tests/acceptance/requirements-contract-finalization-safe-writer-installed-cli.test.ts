import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

const BASE = 'docs/plans/evidence/loop-engineering-remediation';
const PACKAGE_ROOT = path.resolve('packages/bmad-speckit');
const NPM_CLI =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

function run(executable: string, args: string[], cwd: string): string {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_PATH: '',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
    },
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      [`command failed: ${executable} ${args.join(' ')}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n')
    );
  }
  return result.stdout;
}

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, relativePath);
  const text = `${JSON.stringify(value)}\n`;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  return text;
}

function createFixture(root: string) {
  const requirementSetId = `req-${randomUUID()}`;
  const implementationAttemptId = `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`;
  const requirementRecord = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  const draft =
    `${BASE}/.finalization-staging/${implementationAttemptId}` +
    '/safe-write-receipt-manifest.json';
  const target = `${BASE}/safe-write-receipt-manifest.json`;
  const receipt = `${BASE}/finalization-receipts/safe-write-receipt-manifest.receipt.json`;
  const declarationHash = sha256('installed-finalization-declaration');
  writeJson(root, requirementRecord, {
    schemaVersion: 'requirement-record/v1',
    recordId: requirementSetId,
    requirementSetId,
    currentAttemptId: implementationAttemptId,
    status: 'user_confirmed',
    sourcePath: 'source.md',
    sourceDocumentHash: sha256('source'),
    implementationConfirmationHash: sha256('confirmation'),
    confirmationHistory: createRecordedConfirmationHistory({
      recordId: requirementSetId,
      sourcePath: 'source.md',
      sourceDocumentHash: sha256('source'),
      implementationConfirmationHash: sha256('confirmation'),
    }),
    semanticModelHash: sha256('semantic'),
  });
  const draftBytes = writeJson(root, draft, {
    schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
    finalizationDeclarationHash: declarationHash,
    decision: 'PASS',
  });
  const args = [
    'requirements-contract-finalization-safe-write',
    '--requirement-record',
    requirementRecord,
    '--implementation-attempt-id',
    implementationAttemptId,
    '--draft',
    draft,
    '--target',
    target,
    '--receipt',
    receipt,
    '--blocked-receipt-root',
    `${BASE}/finalization-receipts/blocked`,
    '--artifact-role',
    'SAFE-WRITE-RECEIPT-MANIFEST',
    '--validation-profile',
    'safe-write-receipt-manifest',
    '--min-bytes',
    '2',
    '--finalization-declaration-hash',
    declarationHash,
    '--expected-predecessor-receipt',
    'not_applicable',
    '--json',
  ];
  return { args, declarationHash, draft, draftBytes, receipt, target };
}

it('promotes and fails closed through a clean tarball-installed CLI without workspace links or source fallback', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-finalization-installed-'));
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
    writeJson(consumerRoot, 'package.json', {
      name: 'requirements-finalization-installed-consumer',
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

    const installedRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
    const binPath = path.join(installedRoot, 'bin', 'bmad-speckit.js');
    const distPath = path.join(
      installedRoot,
      'dist',
      'main-agent',
      'source-authority',
      'scripts',
      'requirements-contract-finalization-safe-writer.js'
    );
    expect(lstatSync(installedRoot).isSymbolicLink()).toBe(false);
    expect(realpathSync(binPath).startsWith(`${realpathSync(installedRoot)}${path.sep}`)).toBe(
      true
    );
    expect(existsSync(distPath)).toBe(true);
    rmSync(path.join(installedRoot, 'src'), { recursive: true, force: true });
    expect(existsSync(path.join(installedRoot, 'src'))).toBe(false);

    const fixture = createFixture(consumerRoot);
    const passOutput = run(process.execPath, [binPath, ...fixture.args], consumerRoot);
    const passReceipt = JSON.parse(passOutput.trim());
    const targetPath = path.join(consumerRoot, fixture.target);
    const receiptPath = path.join(consumerRoot, fixture.receipt);
    const targetBytes = readFileSync(targetPath, 'utf8');
    const receiptBytes = readFileSync(receiptPath, 'utf8');

    expect(passReceipt).toMatchObject({
      result: 'PASS',
      writerIdentity: 'requirements-contract-finalization-safe-writer/v1',
      target: {
        promotedHash: sha256(fixture.draftBytes),
        readbackHash: sha256(fixture.draftBytes),
      },
    });
    expect(targetBytes).toBe(fixture.draftBytes);
    expect(JSON.parse(receiptBytes)).toEqual(passReceipt);

    const replayDraftBytes = writeJson(consumerRoot, fixture.draft, {
      schemaVersion: 'requirements-contract-safe-write-receipt-manifest/v1',
      finalizationDeclarationHash: fixture.declarationHash,
      decision: 'PASS',
      replay: true,
    });
    const replay = spawnSync(process.execPath, [binPath, ...fixture.args], {
      cwd: consumerRoot,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
      windowsHide: true,
    });
    expect(replay.status).toBe(1);
    const match = replay.stderr.match(
      /finalization_safe_write_blocked:([^:\r\n]+):finalization_safe_write_success_receipt_immutable/u
    );
    expect(match, replay.stderr).not.toBeNull();
    const blockedPath = match?.[1] ?? '';
    const blocked = JSON.parse(readFileSync(path.join(consumerRoot, blockedPath), 'utf8'));

    expect(readFileSync(targetPath, 'utf8')).toBe(targetBytes);
    expect(readFileSync(receiptPath, 'utf8')).toBe(receiptBytes);
    expect(readFileSync(path.join(consumerRoot, blocked.draft.archivedPath), 'utf8')).toBe(
      replayDraftBytes
    );
    expect(blocked).toMatchObject({
      result: 'BLOCK',
      selectedReceiptPath: blockedPath,
      failure: { code: 'finalization_safe_write_success_receipt_immutable' },
    });
    expect(existsSync(path.join(installedRoot, 'src'))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 180_000);
