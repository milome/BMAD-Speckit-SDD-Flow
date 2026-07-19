import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import {
  createRecoveryFixture,
  fileHash,
} from './helpers/requirements-contract-recovery-test-fixture';

type FileRef = {
  path: string;
  hash: string;
};

type ActionBinding = {
  actionId: string;
  sourceHandlerRef: FileRef;
  distHandlerRef: FileRef;
  outputSchemaRefs: FileRef[];
  packageDistRef: FileRef;
  semanticGate: {
    sourceSymbol: string;
    distSymbol: string;
  };
  routingOnly: boolean;
};

type ActionBindingManifest = {
  actions: ActionBinding[];
};

type RecoveryAuthoritySchema = {
  'x-finalizedCommandReceiptRoles': string[];
  'x-finalizerCommandRole': string;
};

const ROOT = process.cwd();
const PACKAGE_ROOT = path.join(ROOT, 'packages', 'bmad-speckit');
const ACTION_MANIFEST_RELATIVE_PATH = path.join(
  '_bmad',
  'shared',
  'requirements-contract',
  'requirements-contract-package-runtime-action-binding-manifest.json'
);
const DIST_SCHEMA_ROOT = path.join(
  'dist',
  'main-agent',
  'source-authority',
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'schemas'
);
const LINEAGE_SCHEMA_REF =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-recovery-lineage-receipt.schema.json';
const FINALIZATION_SCHEMA_REF =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-recovery-finalization-receipt.schema.json';
const STATE_DECISION_SCHEMA_REF =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-recovery-finalization-state-decision-receipt.schema.json';

function npmCliPath(): string {
  return (
    process.env.npm_execpath ??
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  );
}

function runNode(args: string[], cwd: string): string {
  return execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
      npm_config_prefer_offline: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parsePackFilename(stdout: string): string {
  const output = JSON.parse(stdout) as Array<{ filename?: string }>;
  expect(output).toHaveLength(1);
  expect(output[0]?.filename).toEqual(expect.any(String));
  return output[0]!.filename!;
}

function installPackedCli(): {
  root: string;
  consumerRoot: string;
  installedPackageRoot: string;
  cliPath: string;
  manifest: ActionBindingManifest;
  schema: RecoveryAuthoritySchema;
  cleanup(): void;
} {
  const root = mkdtempSync(path.join(tmpdir(), 'recovery-finalization-installed-cli-'));
  const packRoot = path.join(root, 'pack');
  const consumerRoot = path.join(root, 'consumer');
  mkdirSync(packRoot);
  mkdirSync(consumerRoot);

  const filename = parsePackFilename(
    runNode(
      [npmCliPath(), 'pack', '--json', '--ignore-scripts', '--pack-destination', packRoot],
      PACKAGE_ROOT
    )
  );
  const tarball = path.join(packRoot, filename);
  writeJson(path.join(consumerRoot, 'package.json'), {
    name: 'recovery-finalization-installed-cli-consumer',
    private: true,
  });
  runNode(
    [
      npmCliPath(),
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      tarball,
    ],
    consumerRoot
  );

  const installedPackageRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
  const cliPath = path.join(installedPackageRoot, 'bin', 'bmad-speckit.js');
  const manifestPath = path.join(installedPackageRoot, ACTION_MANIFEST_RELATIVE_PATH);
  const schemaPath = path.join(
    installedPackageRoot,
    DIST_SCHEMA_ROOT,
    'requirements-contract-recovery-lineage-receipt.schema.json'
  );
  expect(existsSync(cliPath)).toBe(true);
  expect(existsSync(manifestPath)).toBe(true);
  expect(existsSync(schemaPath)).toBe(true);
  expect(lstatSync(installedPackageRoot).isSymbolicLink()).toBe(false);
  expect(realpathSync(installedPackageRoot)).toBe(installedPackageRoot);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ActionBindingManifest;
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as RecoveryAuthoritySchema;
  const sourceRoot = path.join(installedPackageRoot, 'src');
  const disabledSourceRoot = path.join(root, 'disabled-installed-source');
  expect(existsSync(sourceRoot)).toBe(true);
  renameSync(sourceRoot, disabledSourceRoot);
  expect(existsSync(sourceRoot)).toBe(false);

  return {
    root,
    consumerRoot,
    installedPackageRoot,
    cliPath,
    manifest,
    schema,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function selectRecoveryActions(manifest: ActionBindingManifest): {
  bootstrap: ActionBinding;
  finalizer: ActionBinding;
} {
  const finalizers = manifest.actions.filter((action) => {
    const outputPaths = new Set(action.outputSchemaRefs.map((ref) => ref.path));
    return outputPaths.has(FINALIZATION_SCHEMA_REF) && outputPaths.has(STATE_DECISION_SCHEMA_REF);
  });
  const bootstraps = manifest.actions.filter((action) => {
    const outputPaths = new Set(action.outputSchemaRefs.map((ref) => ref.path));
    return outputPaths.has(LINEAGE_SCHEMA_REF) && !outputPaths.has(FINALIZATION_SCHEMA_REF);
  });
  expect(finalizers, 'installed manifest must expose one schema-bound finalizer').toHaveLength(1);
  expect(bootstraps, 'installed manifest must expose one schema-bound bootstrap').toHaveLength(1);
  return { bootstrap: bootstraps[0]!, finalizer: finalizers[0]! };
}

function expectInstalledActionBinding(installedPackageRoot: string, action: ActionBinding): void {
  expect(action.routingOnly).toBe(false);
  expect(action.semanticGate.sourceSymbol).not.toBe('');
  expect(action.semanticGate.distSymbol).not.toBe('');
  const distPath = path.join(installedPackageRoot, action.packageDistRef.path);
  expect(existsSync(distPath), `installed handler is missing: ${action.packageDistRef.path}`).toBe(
    true
  );
  if (existsSync(distPath)) expect(fileHash(distPath)).toBe(action.packageDistRef.hash);
}

function parseJsonLine(stdout: string): Record<string, unknown> {
  const line = stdout.trim().split(/\r?\n/u).filter(Boolean).at(-1);
  expect(line).toEqual(expect.any(String));
  return JSON.parse(line!) as Record<string, unknown>;
}

it('finalizes recovery through a packed and clean-installed CLI without source fallback', () => {
  const installation = installPackedCli();
  const fixture = createRecoveryFixture();
  try {
    const { bootstrap, finalizer } = selectRecoveryActions(installation.manifest);
    expect(fixture.roles.finalizer).toBe(installation.schema['x-finalizerCommandRole']);

    const fixtureRelativeToRepository = path.relative(ROOT, fixture.root);
    expect(
      fixtureRelativeToRepository.startsWith('..') || path.isAbsolute(fixtureRelativeToRepository)
    ).toBe(true);

    runNode(
      [
        installation.cliPath,
        bootstrap.actionId,
        '--contract',
        fixture.contractPath,
        '--authority',
        fixture.authorityPath,
        '--architecture-authority',
        fixture.architectureAuthorityPath,
        '--attempt-context',
        fixture.contextPath,
        '--qualified-red-receipt',
        fixture.qualifiedRedPath,
        '--consumer-root',
        fixture.consumerRoot,
        '--create-if-absent',
        '--initial-publication-receipt',
        fixture.publicationPath,
        '--out',
        fixture.provisionalPath,
        '--json',
      ],
      fixture.cwd
    );
    expect(existsSync(fixture.provisionalPath)).toBe(true);
    expect(existsSync(fixture.publicationPath)).toBe(true);

    const receiptRoles = installation.schema['x-finalizedCommandReceiptRoles'];
    const commandReceipts = receiptRoles.map((role) => fixture.createCommandReceipt(role));
    const finalizerPlan = Object.values(fixture.context.commandPlan).find(
      (entry: Record<string, unknown>) => entry.commandId === fixture.roles.finalizer
    ) as Record<string, unknown> | undefined;
    expect(finalizerPlan).toBeDefined();

    const stdout = runNode(
      [
        installation.cliPath,
        finalizer.actionId,
        '--contract',
        fixture.contractPath,
        '--authority',
        fixture.authorityPath,
        '--architecture-authority',
        fixture.architectureAuthorityPath,
        '--attempt-context',
        fixture.contextPath,
        '--recovery',
        fixture.provisionalPath,
        '--initial-publication-receipt',
        fixture.publicationPath,
        '--target',
        fixture.targetPath,
        '--expected-target-preimage-hash',
        fixture.context.recoveryTarget.preimageHash,
        '--qualified-red-receipt',
        fixture.qualifiedRedPath,
        ...commandReceipts.flatMap((receiptPath) => ['--command-receipt', receiptPath]),
        '--expected-provisional-hash',
        fileHash(fixture.provisionalPath),
        '--command-run-id',
        String(finalizerPlan!.commandRunId),
        '--invocation-sequence',
        String(finalizerPlan!.invocationSequence),
        '--finalization-run-id',
        fixture.context.finalizationRunId,
        '--transaction-root',
        fixture.transactionRoot,
        '--failure-root',
        fixture.failureRoot,
        '--finalization-receipt',
        fixture.finalizationReceiptPath,
        '--json',
      ],
      fixture.cwd
    );
    const result = parseJsonLine(stdout);
    const finalized = JSON.parse(readFileSync(fixture.targetPath, 'utf8')) as Record<
      string,
      unknown
    >;
    const finalizationReceipt = JSON.parse(
      readFileSync(fixture.finalizationReceiptPath, 'utf8')
    ) as Record<string, unknown>;

    expect(result).toMatchObject({
      decision: 'pass',
      passAuthority: false,
      outcome: 'committed',
    });
    expect(finalized.state).toBe('finalized');
    expect(Object.keys(finalized.commandReceiptRefs as Record<string, unknown>).sort()).toEqual(
      [...receiptRoles].sort()
    );
    expect(finalizationReceipt.commitCommandRunId).toBe(finalizerPlan!.commandRunId);
    expect(finalizationReceipt.commitInvocationSequence).toBe(finalizerPlan!.invocationSequence);
    expectInstalledActionBinding(installation.installedPackageRoot, bootstrap);
    expectInstalledActionBinding(installation.installedPackageRoot, finalizer);
    expect(existsSync(path.join(installation.installedPackageRoot, 'src'))).toBe(false);
  } finally {
    fixture.cleanup();
    installation.cleanup();
  }
}, 300_000);
