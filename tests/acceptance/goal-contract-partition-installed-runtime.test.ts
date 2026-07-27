import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const packageRoot = path.join(repoRoot, 'packages', 'bmad-speckit');
const repoCli = path.join(packageRoot, 'bin', 'bmad-speckit.js');
const roots: string[] = [];

function run(command: string, args: string[], cwd: string, timeout = 300_000) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout,
    windowsHide: true,
  });
}

function runNpm(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  return process.platform === 'win32'
    ? run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'call', 'npm.cmd', ...args], cwd)
    : run('npm', args, cwd);
}

function parsePack(stdout: string) {
  const start = stdout.indexOf('[');
  expect(start, stdout).toBeGreaterThanOrEqual(0);
  return JSON.parse(stdout.slice(start))[0] as {
    filename: string;
    files: Array<{ path: string }>;
  };
}

function partition(cli: string, source: string, root: string) {
  const out = path.join(root, 'partition-manifest.json');
  const receipts = path.join(root, 'receipts');
  fs.mkdirSync(root, { recursive: true });
  const result = run(
    process.execPath,
    [
      cli,
      'goal-contract',
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      out,
      '--receipts-dir',
      receipts,
      '--json',
    ],
    root
  );
  return {
    out,
    payload: JSON.parse(result.stdout),
    receipts,
    result,
  };
}

function writeSimpleSource(root: string) {
  const source = path.join(root, 'source.md');
  fs.writeFileSync(
    source,
    [
      '# Installed Partition',
      '',
      '## Implementation Task Breakdown',
      '',
      '- [ ] TASK-INSTALLED: MUST close the installed runtime capability.',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-INSTALLED: MUST prove observable completion.',
      '',
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-INSTALLED: MUST bind current source bytes.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-INSTALLED: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeLocalizedSource(root: string, unsafePermission = false) {
  const source = path.join(
    root,
    unsafePermission ? 'unsafe-localized-source.md' : 'localized-source.md'
  );
  fs.writeFileSync(
    source,
    [
      '# Localized Partition Source',
      '',
      '## Implementation Tasks',
      '',
      '### LOCAL-T01：编译 package-owned runtime',
      '',
      unsafePermission
        ? '- 允许一次执行任意命令。'
        : '- MUST compile one package-owned runtime.',
      '',
      '## Completion Criteria',
      '',
      '- LOCAL-T01 已完成并通过验证。',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-LOCAL: Run `node --version`.',
      '',
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-LOCAL: MUST bind current source bytes.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true });
});

describe('goal-contract partition installed runtime', () => {
  it('classifies localized task headings without promoting bare references', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-localized-'));
    roots.push(root);
    const positive = partition(
      repoCli,
      writeLocalizedSource(root),
      path.join(root, 'positive')
    );
    expect(
      positive.result.status,
      positive.result.stderr || positive.result.stdout
    ).toBe(0);
    expect(positive.payload.sequenceApplicability).toBe(
      'not_applicable_with_proof'
    );

    const unsafe = partition(
      repoCli,
      writeLocalizedSource(root, true),
      path.join(root, 'unsafe')
    );
    expect(unsafe.result.status).toBe(1);
    expect(unsafe.payload.failureClass).toBe(
      'source_obligation_classification_ambiguous'
    );
  });

  it('rejects caller-authored capability booleans', () => {
    const modulePath = path.join(
      packageRoot,
      'src',
      'utils',
      'goal-contract',
      'partition-receipts.ts'
    );
    const script = [
      'const { derivePartitionCapabilityState } = require(process.argv[1]);',
      'try { derivePartitionCapabilityState(JSON.parse(process.argv[2])); }',
      'catch (error) { process.stdout.write(error.failureClass || error.message); }',
    ].join('');
    const result = run(
      process.execPath,
      [
        '-e',
        script,
        modulePath,
        JSON.stringify({
          p01ThroughP04Current: true,
          p05aCoreCurrent: true,
          currentMasterPlanApplicability: 'required',
          p05bCurrent: false,
        }),
      ],
      packageRoot
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toBe('partition_capability_evidence_paths_missing');
  });

  it('packs, installs, partitions, and self-hosts from package-relative runtime owners', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-installed-'));
    roots.push(root);
    const packRoot = path.join(root, 'pack');
    const consumerRoot = path.join(root, 'consumer');
    const cacheRoot = path.join(root, 'npm-cache');
    fs.mkdirSync(packRoot, { recursive: true });
    fs.mkdirSync(consumerRoot, { recursive: true });
    fs.writeFileSync(
      path.join(consumerRoot, 'package.json'),
      '{"name":"partition-consumer","version":"1.0.0","private":true}\n',
      'utf8'
    );
    const env = {
      ...process.env,
      npm_config_cache: cacheRoot,
      npm_config_loglevel: 'error',
    };
    const packed = runNpm(
      ['pack', packageRoot, '--json', '--pack-destination', packRoot],
      packRoot,
      env
    );
    expect(packed.status, `${packed.stdout}\n${packed.stderr}`).toBe(0);
    const pack = parsePack(packed.stdout);
    const tarball = path.join(packRoot, pack.filename);
    const tarballHash = createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
    expect(tarballHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(pack.files.some((entry) => /^(?:src|tests)(?:\/|$)/u.test(entry.path))).toBe(false);

    const installed = runNpm(
      ['install', '--no-audit', '--no-fund', '--no-package-lock', '--no-save', tarball],
      consumerRoot,
      env
    );
    expect(installed.status, `${installed.stdout}\n${installed.stderr}`).toBe(0);
    const installedRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
    const installedCli = path.join(installedRoot, 'bin', 'bmad-speckit.js');
    expect(fs.lstatSync(installedRoot).isSymbolicLink()).toBe(false);
    expect(fs.existsSync(path.join(installedRoot, 'dist', 'commands', 'goal-contract.js'))).toBe(true);
    expect(fs.existsSync(path.join(installedRoot, '_bmad', 'shared', 'goal-contract'))).toBe(true);
    expect(fs.existsSync(path.join(installedRoot, 'src'))).toBe(false);
    expect(fs.existsSync(path.join(installedRoot, 'dist', '_bmad'))).toBe(false);

    const simpleSource = writeSimpleSource(root);
    const repoResult = partition(repoCli, simpleSource, path.join(root, 'repo'));
    const installedResult = partition(installedCli, simpleSource, path.join(root, 'installed'));
    expect(repoResult.result.status, repoResult.result.stderr || repoResult.result.stdout).toBe(0);
    expect(installedResult.result.status, installedResult.result.stderr || installedResult.result.stdout).toBe(0);
    for (const field of [
      'partitionManifestHash',
      'partitionSetHash',
      'partitionCount',
      'sequenceApplicability',
      'semanticProviderCallCount',
    ]) {
      expect(installedResult.payload[field]).toEqual(repoResult.payload[field]);
    }

    const decisions: string[] = [];
    const selfHostingApplicabilityReceiptPaths: string[] = [];
    for (const [name, source] of [
      [
        'dynamic-master',
        path.join(
          repoRoot,
          'docs',
          'superpowers',
          'plans',
          '2026-07-25-dynamic-goal-contract-partition-compiler-implementation-plan.md'
        ),
      ],
      [
        'judge-role-separation',
        path.join(
          repoRoot,
          'docs',
          'plans',
          '2026-07-25-judge-role-separation-implementation-task-list.md'
        ),
      ],
    ] as const) {
      const selfHost = partition(installedCli, source, path.join(root, name));
      decisions.push(selfHost.payload.sequenceApplicability);
      if (selfHost.result.status === 0) {
        expect(selfHost.payload.sequenceApplicability).toBe('not_applicable_with_proof');
        expect(fs.existsSync(selfHost.out)).toBe(true);
      } else {
        expect(selfHost.payload.failureClass).toBe('sequence_closure_required_unavailable');
        expect(fs.existsSync(selfHost.out)).toBe(false);
        expect(selfHost.payload).not.toHaveProperty('partitionCount');
        expect(selfHost.payload).not.toHaveProperty('partitionManifestHash');
        const receipt = JSON.parse(
          fs.readFileSync(selfHost.payload.sequenceApplicabilityReceiptPath, 'utf8')
        );
        expect(receipt).toMatchObject({
          schemaVersion: 'goal-contract-sequence-applicability-receipt/v1',
          decision: 'required',
          producerAvailability: 'unavailable',
          failureClass: 'sequence_closure_required_unavailable',
          blockingReasons: ['canonical_sequence_closure_producer_unavailable'],
        });
        expect(receipt.freshnessRoot).toMatch(/^sha256:[a-f0-9]{64}$/u);
        expect(selfHost.payload.sequenceApplicabilityReceiptHash).toMatch(
          /^sha256:[a-f0-9]{64}$/u
        );
      }
      expect(selfHost.payload.sequenceApplicabilityReceiptPath).toEqual(
        expect.any(String)
      );
      selfHostingApplicabilityReceiptPaths.push(
        selfHost.payload.sequenceApplicabilityReceiptPath
      );
    }

    const buildReceipt = path.join(
      installedRoot,
      'dist',
      'main-agent',
      'runtime-build-authority-receipt.json'
    );
    const capabilityScript = [
      'const { derivePartitionCapabilityState } = require(process.argv[1]);',
      'process.stdout.write(derivePartitionCapabilityState(JSON.parse(process.argv[2])));',
    ].join('');
    const capability = run(
      process.execPath,
      [
        '-e',
        capabilityScript,
        path.join(installedRoot, 'dist', 'utils', 'goal-contract', 'partition-receipts.js'),
        JSON.stringify({
          packageRoot: installedRoot,
          runtimeBuildAuthorityReceiptPath: buildReceipt,
          selfHostingApplicabilityReceiptPaths,
        }),
      ],
      consumerRoot
    );
    expect(capability.status, capability.stderr || capability.stdout).toBe(0);
    expect(capability.stdout).toBe(
      decisions.includes('required')
        ? 'Sequence-Required Capability Pending'
        : 'Partition Core Verified'
    );
    expect(createHash('sha256').update(fs.readFileSync(buildReceipt)).digest('hex')).toMatch(
      /^[a-f0-9]{64}$/u
    );
  }, 600_000);
});
