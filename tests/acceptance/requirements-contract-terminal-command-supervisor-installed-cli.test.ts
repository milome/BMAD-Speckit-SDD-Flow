import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import {
  createTerminalCloseoutFixture,
  terminalCommandIds,
} from './helpers/requirements-contract-terminal-closeout-fixture';

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

function writeText(root: string, relativePath: string, text: string): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  return sha256(text);
}

function writeJson(root: string, relativePath: string, value: unknown): string {
  return writeText(root, relativePath, `${JSON.stringify(value)}\n`);
}

function prepareTerminalFixture(options: { failFirstCommand?: boolean } = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
  const fixture = createTerminalCloseoutFixture();
  vi.useRealTimers();
  const root = fixture.root;
  const commandIds = terminalCommandIds();
  const requirementSetId = `req-${randomUUID()}`;
  const implementationAttemptId = fixture.bundle.implementationAttemptId;
  const declarationHash = sha256('installed-terminal-declaration');
  const recordPath = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  rmSync(path.join(root, fixture.terminalReceiptPath), { force: true });
  const recordHash = writeJson(root, recordPath, {
    schemaVersion: 'requirement-record/v1',
  });
  fixture.bundle.contractHash = fixture.writeContractWithCommandRows([
    options.failFirstCommand
      ? `| ${commandIds[0]} | \`node -e "process.exit(7)"\` | Repository root | block | AC-01 |`
      : `| ${commandIds[0]} | \`node -e "require('fs').appendFileSync('terminal-order.txt','${commandIds[0]}\\n')"\` | Repository root | pass | AC-01 |`,
    `| ${commandIds[1]} | \`node -e "require('fs').appendFileSync('terminal-order.txt','${commandIds[1]}\\n')"\` | Repository root | pass | AC-01 |`,
  ]);
  writeJson(root, fixture.bundlePath, fixture.bundle);
  const roles = [
    {
      artifactRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
      validationProfile: 'safe-write-receipt-manifest',
      targetPath: `${BASE}/safe-write-receipt-manifest.json`,
      receiptPath: `${BASE}/finalization-receipts/safe-write-receipt-manifest.receipt.json`,
      predecessorPath: 'not_applicable',
    },
    {
      artifactRole: 'EVD-15',
      validationProfile: 'goal-task-evidence',
      targetPath: `${BASE}/G15-final-gates.json`,
      receiptPath: `${BASE}/finalization-receipts/G15-final-gates.receipt.json`,
      predecessorPath: `${BASE}/finalization-receipts/safe-write-receipt-manifest.receipt.json`,
    },
    {
      artifactRole: 'ARTIFACT-01',
      validationProfile: 'implementation-evidence-bundle',
      targetPath: fixture.bundlePath,
      receiptPath: `${BASE}/finalization-receipts/implementation-evidence.receipt.json`,
      predecessorPath: `${BASE}/finalization-receipts/G15-final-gates.receipt.json`,
    },
  ] as const;
  let predecessor: { path: string; hash: string; artifactRole: string } | null = null;
  for (const role of roles) {
    const targetText =
      role.targetPath === fixture.bundlePath
        ? readFileSync(path.join(root, role.targetPath), 'utf8')
        : `${JSON.stringify({
            schemaVersion: `${role.artifactRole}/v1`,
            decision: 'PASS',
          })}\n`;
    const targetHash =
      role.targetPath === fixture.bundlePath
        ? sha256(targetText)
        : writeText(root, role.targetPath, targetText);
    const receipt = {
      schemaVersion: 'requirements-contract-finalization-safe-write-receipt/v1',
      commandId: 'requirements-contract-finalization-safe-write',
      finalizationRunId: `FINALIZATION-RUN-${randomUUID().toUpperCase()}`,
      requirementRecord: { path: recordPath, hash: recordHash },
      implementationAttemptId,
      exactArgv: ['node', role.artifactRole],
      argvHash: sha256(role.artifactRole),
      artifactRole: role.artifactRole,
      validationProfile: role.validationProfile,
      finalizationDeclarationHash: declarationHash,
      predecessor: predecessor
        ? {
            applicable: true,
            expectedReceiptPath: role.predecessorPath,
            receipt: predecessor,
          }
        : { applicable: false, expectedReceiptPath: 'not_applicable' },
      target: {
        path: role.targetPath,
        requiredSchemaVersion: `${role.artifactRole}/v1`,
        requiredSchemaHash: sha256('schema'),
        minBytes: 2,
        targetExistedBefore: false,
        previousHash: null,
        backupApplicability: 'not_applicable',
        backupPath: null,
        backupHash: null,
        nonexistenceProofHash: sha256(
          `installed-terminal-fixture-nonexistence/v1\n${role.targetPath}\n`
        ),
        promotedHash: targetHash,
        readbackHash: targetHash,
      },
      draft: {
        path: `${BASE}/.finalization-staging/${implementationAttemptId}/${role.artifactRole}.json`,
        hash: targetHash,
        bytes: Buffer.byteLength(targetText),
      },
      writerIdentity: 'requirements-contract-finalization-safe-writer/v1',
      result: 'PASS',
      selectedReceiptPath: role.receiptPath,
    };
    const receiptHash = writeJson(root, role.receiptPath, receipt);
    predecessor = {
      path: role.receiptPath,
      hash: receiptHash,
      artifactRole: role.artifactRole,
    };
  }
  return { commandIds, fixture, roles };
}

it('executes the terminal command supervisor from a clean tarball install without workspace links or source fallback', () => {
  const fixtureState = prepareTerminalFixture();
  const { fixture, roles } = fixtureState;
  const installRoot = path.join(fixture.root, 'install');
  const packRoot = path.join(installRoot, 'pack');
  const consumerRoot = path.join(installRoot, 'consumer');
  try {
    mkdirSync(packRoot, { recursive: true });
    mkdirSync(consumerRoot, { recursive: true });
    run(process.execPath, ['scripts/build-main-agent-dist.cjs'], PACKAGE_ROOT);
    const packOutput = run(
      process.execPath,
      [NPM_CLI, 'pack', '--ignore-scripts', '--silent', '--pack-destination', packRoot],
      PACKAGE_ROOT
    ).trim();
    const tarballPath = path.join(packRoot, packOutput.split(/\r?\n/u).at(-1) ?? '');
    writeJson(consumerRoot, 'package.json', {
      name: 'requirements-terminal-installed-consumer',
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

    const installedPackage = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
    const binPath = path.join(installedPackage, 'bin', 'bmad-speckit.js');
    expect(lstatSync(installedPackage).isSymbolicLink()).toBe(false);
    expect(realpathSync(binPath).startsWith(`${realpathSync(installedPackage)}${path.sep}`)).toBe(
      true
    );
    rmSync(path.join(installedPackage, 'src'), { recursive: true, force: true });
    expect(existsSync(path.join(installedPackage, 'src'))).toBe(false);

    const clockPreload = path.join(fixture.root, 'fixed-clock.cjs');
    writeFileSync(
      clockPreload,
      [
        'const RealDate = Date;',
        "const fixed = new RealDate('2026-07-18T12:00:00.000Z').valueOf();",
        'global.Date = class FixedDate extends RealDate {',
        '  constructor(...args) { super(...(args.length ? args : [fixed])); }',
        '  static now() { return fixed; }',
        '};',
        '',
      ].join('\n'),
      'utf8'
    );
    const bundleHash = sha256(readFileSync(path.join(fixture.root, fixture.bundlePath), 'utf8'));
    const result = spawnSync(
      process.execPath,
      [
        binPath,
        'requirements-contract-terminal-command-supervisor',
        '--contract',
        fixture.contractPath,
        '--bundle',
        fixture.bundlePath,
        '--safe-write-manifest-receipt',
        roles[0].receiptPath,
        '--evd15-receipt',
        roles[1].receiptPath,
        '--artifact01-receipt',
        roles[2].receiptPath,
        '--receipt',
        fixture.terminalReceiptPath,
        '--first-command',
        fixtureState.commandIds[0],
        '--second-command',
        fixtureState.commandIds[1],
        '--json',
      ],
      {
        cwd: fixture.root,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_PATH: '',
          NODE_OPTIONS: `--require=${clockPreload}`,
        },
        windowsHide: true,
      }
    );
    expect(result.status, result.stderr).toBe(0);
    const receipt = JSON.parse(result.stdout.trim());

    expect(receipt).toMatchObject({
      result: 'PASS',
      orderedExecutionDecision: 'pass',
      commands: [
        { commandId: fixtureState.commandIds[0], exitCode: 0 },
        { commandId: fixtureState.commandIds[1], exitCode: 0 },
      ],
    });
    expect(readFileSync(path.join(fixture.root, 'terminal-order.txt'), 'utf8')).toBe(
      `${fixtureState.commandIds.join('\n')}\n`
    );
    expect(sha256(readFileSync(path.join(fixture.root, fixture.bundlePath), 'utf8'))).toBe(
      bundleHash
    );
    expect(
      JSON.parse(readFileSync(path.join(fixture.root, fixture.terminalReceiptPath), 'utf8'))
    ).toEqual(receipt);
    expect(existsSync(path.join(fixture.root, fixture.packetPath))).toBe(true);
    expect(existsSync(path.join(fixture.root, fixture.readbackReceiptPath))).toBe(true);
    expect(existsSync(path.join(installedPackage, 'src'))).toBe(false);

    const blockedState = prepareTerminalFixture({ failFirstCommand: true });
    try {
      const blocked = spawnSync(
        process.execPath,
        [
          binPath,
          'requirements-contract-terminal-command-supervisor',
          '--contract',
          blockedState.fixture.contractPath,
          '--bundle',
          blockedState.fixture.bundlePath,
          '--safe-write-manifest-receipt',
          blockedState.roles[0].receiptPath,
          '--evd15-receipt',
          blockedState.roles[1].receiptPath,
          '--artifact01-receipt',
          blockedState.roles[2].receiptPath,
          '--receipt',
          blockedState.fixture.terminalReceiptPath,
          '--first-command',
          blockedState.commandIds[0],
          '--second-command',
          blockedState.commandIds[1],
          '--json',
        ],
        {
          cwd: blockedState.fixture.root,
          encoding: 'utf8',
          env: {
            ...process.env,
            NODE_PATH: '',
            NODE_OPTIONS: `--require=${clockPreload}`,
          },
          windowsHide: true,
        }
      );
      expect(blocked.status, blocked.stderr).not.toBe(0);
      const blockedReceipt = JSON.parse(blocked.stdout.trim());
      expect(blockedReceipt).toMatchObject({
        result: 'BLOCK',
        orderedExecutionDecision: 'block',
        commands: [
          { commandId: blockedState.commandIds[0], exitCode: 7 },
          { commandId: blockedState.commandIds[1], exitCode: -1 },
        ],
      });
      expect(
        existsSync(path.join(blockedState.fixture.root, blockedState.fixture.packetPath))
      ).toBe(false);
      expect(
        existsSync(path.join(blockedState.fixture.root, blockedState.fixture.readbackReceiptPath))
      ).toBe(false);
    } finally {
      rmSync(blockedState.fixture.root, { recursive: true, force: true });
    }
  } finally {
    vi.useRealTimers();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}, 360_000);
