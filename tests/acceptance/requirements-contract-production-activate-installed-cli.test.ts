import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const PACKAGE_ROOT = path.resolve('packages/bmad-speckit');
const SOURCE = path.join(
  PACKAGE_ROOT,
  'src/main-agent/source-authority/scripts/requirements-contract-production-activate.ts'
);
const DIST =
  'dist/main-agent/source-authority/scripts/requirements-contract-production-activate.js';
const NPM_CLI =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');

function run(executable: string, args: string[], cwd: string, env = process.env): string {
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`command_failed:${result.status}:${result.stderr}`);
  }
  return result.stdout;
}

function write(root: string, relativePath: string, value: unknown): void {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value)}\n`, 'utf8');
}

it('dispatches production activation through a clean-installed CLI without consumer docs', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'production-activate-installed-'));
  try {
    const packageCopy = path.join(root, 'package');
    const packDir = path.join(root, 'pack');
    const consumer = path.join(root, 'consumer');
    const fakeBin = path.join(root, 'fake-bin');
    mkdirSync(packDir);
    mkdirSync(consumer);
    mkdirSync(fakeBin);
    cpSync(PACKAGE_ROOT, packageCopy, {
      recursive: true,
      filter: (source) => !source.split(path.sep).includes('node_modules'),
    });
    const compiled = ts.transpileModule(readFileSync(SOURCE, 'utf8'), {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    writeFileSync(path.join(packageCopy, DIST), compiled, 'utf8');
    const packOutput = run(
      process.execPath,
      [NPM_CLI, 'pack', '--ignore-scripts', '--silent', '--pack-destination', packDir],
      packageCopy
    ).trim();
    const tarball = path.join(packDir, packOutput.split(/\r?\n/u).at(-1)!);
    write(consumer, 'package.json', { name: 'activation-consumer', private: true });
    run(
      process.execPath,
      [
        NPM_CLI,
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        tarball,
      ],
      consumer
    );
    writeFileSync(path.join(fakeBin, 'npx.cmd'), '@echo off\r\nexit /b 1\r\n', 'utf8');
    copyFileSync(process.execPath, path.join(fakeBin, 'pwsh.exe'));
    const requirementSetId = `req-${randomUUID()}`;
    const record = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
    const registry =
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';
    write(consumer, record, {
      requirementSetId,
      currentAttemptId: `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`,
    });
    write(consumer, registry, {
      schemaVersion: 'requirements-contract-consumer-registry/v1',
      requirementSetId,
      shadowOutputEnabled: true,
      v1OutputEnabled: true,
      productionReadModelVersion: 'v1',
    });
    const bin = path.join(consumer, 'node_modules/bmad-speckit/bin/bmad-speckit.js');
    const result = spawnSync(
      process.execPath,
      [
        bin,
        'requirements-contract-production-activate',
        '--requirement-record',
        record,
        '--registry',
        registry,
        '--activation-plan-dir',
        'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plans',
        '--activation-plan-write-receipt-dir',
        'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plan-write-receipts',
        '--success-receipt',
        'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json',
        '--blocked-attempt-dir',
        'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-attempts',
        '--json',
      ],
      {
        cwd: consumer,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` },
      }
    );

    expect(result.status, result.stderr).toBe(0);
    const receipt = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)!);
    expect(receipt).toMatchObject({
      activationOutcome: 'blocked',
      failure: { code: 'nested_command_failed' },
    });
    expect(result.stderr).not.toContain('production_activate_contract_missing');
    expect(readFileSync(path.join(consumer, receipt.activationPlan.path), 'utf8')).toContain(
      'requirements-contract-production-activation-plan/v1'
    );
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}, 180_000);
