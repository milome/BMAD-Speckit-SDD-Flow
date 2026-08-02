import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractGapClosureReadonlyAuditorAdapterCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-gap-closure-readonly-auditor-adapter';
import { resolveCanonicalPackageTarball } from '../helpers/canonical-package-artifact';

const REPO_ROOT = path.resolve(__dirname, '../..');
const NPM_CLI =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

function sha256(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function installCanonicalPackageCli(root: string): string {
  const tarballPath = resolveCanonicalPackageTarball(REPO_ROOT);
  const consumerRoot = path.join(root, 'consumer');
  mkdirSync(consumerRoot, { recursive: true });
  writeJson(path.join(consumerRoot, 'package.json'), {
    name: 'gap-closure-readonly-auditor-adapter-consumer',
    private: true,
  });
  const installation = spawnSync(
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
    {
      cwd: consumerRoot,
      env: {
        ...process.env,
        NODE_PATH: '',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
      },
      encoding: 'utf8',
      windowsHide: true,
    }
  );
  if (installation.status !== 0) {
    throw new Error(
      [
        `canonical package installation failed: ${tarballPath}`,
        installation.stdout,
        installation.stderr,
        installation.error?.message,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
  const candidates = [
    path.join(
      consumerRoot,
      'node_modules',
      'bmad-speckit-sdd-flow',
      'node_modules',
      'bmad-speckit',
      'bin',
      'bmad-speckit.js'
    ),
    path.join(
      consumerRoot,
      'node_modules',
      'bmad-speckit',
      'bin',
      'bmad-speckit.js'
    ),
  ];
  const packageCli = candidates.find((candidate) => existsSync(candidate));
  if (!packageCli) {
    throw new Error(`installed canonical package CLI missing: ${candidates.join(', ')}`);
  }
  return packageCli;
}

describe('requirements-contract gap closure readonly auditor adapter', () => {
  it('rejects a request path outside the project root before invoking transport', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-auditor-adapter-'));
    try {
      await expect(
        requirementsContractGapClosureReadonlyAuditorAdapterCommand({
          projectRoot: root,
          request: path.join('..', 'outside-request.json'),
          json: true,
        })
      ).rejects.toThrow('gap_closure_auditor_adapter_request_path_escape');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is exposed through the package CLI without accepting a path outside the project root', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-auditor-adapter-cli-'));
    try {
      const packageCli = installCanonicalPackageCli(root);
      const result = spawnSync(
        process.execPath,
        [
          packageCli,
          'requirements-contract-gap-closure-readonly-auditor-adapter',
          '--project-root',
          root,
          '--request',
          path.join('..', 'outside-request.json'),
          '--json',
        ],
        {
          cwd: root,
          encoding: 'utf8',
        }
      );

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        'gap_closure_auditor_adapter_request_path_escape'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('binds a real failing provider process to a parseable event log', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gap-closure-auditor-provider-'));
    const originalPath = process.env.PATH;
    const originalPathAlias = process.env.Path;
    try {
      const requestPath = path.join(root, 'independent-audit-request.json');
      const fixtureIdentity = crypto.randomUUID().replace(/-/gu, '');
      const hash = sha256(fixtureIdentity);
      writeJson(requestPath, {
        schemaVersion: 'gap-closure-independent-audit-request/v1',
        gapId: `GAP-${fixtureIdentity}`,
        candidatePath: path.join(root, 'closure-candidate.json'),
        candidateHash: hash,
        requirementRecordPath: path.join(root, 'requirement-record.json'),
        requirementRecordHash: hash,
        projectRoot: root,
        freshnessRoot: root,
        sourceSnapshotHash: hash,
        sourceDocumentHash: hash,
        semanticModelHash: hash,
        projectionSetHash: hash,
        productionEntry: 'bmad-speckit main-agent gap-closure-evidence',
        productionCallChain: ['public entry', 'package adapter'],
        changedProductionFiles: ['packages/bmad-speckit/src/main-agent/runtime.ts'],
        positiveCommand: 'npm exec --offline -- vitest run targeted.test.ts',
        positiveRunId: `positive-${fixtureIdentity}`,
        positiveLogPath: path.join(root, 'positive.log'),
        positiveLogHash: hash,
        negativeCommands: ['npm exec --offline -- vitest run negative.test.ts'],
        negativeRunIds: [`negative-${fixtureIdentity}`],
        negativeResults: [{ failureClass: 'tamper_rejected', exitCode: 1 }],
        negativeLogPaths: [path.join(root, 'negative.log')],
        producerReceiptPaths: [path.join(root, 'producer-receipt.json')],
        producerReceiptHashes: [hash],
        distHash: hash,
        packageHash: hash,
        cleanMaterializationReceiptPath: path.join(root, 'clean-materialization-receipt.json'),
        cleanMaterializationReceiptHash: hash,
        auditorAdapterPath: path.join(root, 'adapter.js'),
        auditorAdapterHash: hash,
        actionBindingManifestPath: path.join(root, 'action-binding.json'),
        actionBindingManifestHash: hash,
        canonicalAssetsManifestPath: path.join(root, 'canonical-assets.json'),
        canonicalAssetsManifestHash: hash,
        criticalAuditorProfilePath: path.join(root, 'critical-auditor-profile.json'),
        criticalAuditorProfileHash: hash,
        criticalAuditorProfileDeclaredHash: hash,
        requestedAt: new Date().toISOString(),
        requestHash: hash,
      });

      const binRoot = path.join(root, 'bin');
      const javascriptEntry = path.join(
        binRoot,
        'node_modules',
        '@openai',
        'codex',
        'bin',
        'codex.js'
      );
      const transportSource = [
        "const fs = require('node:fs');",
        "const crypto = require('node:crypto');",
        'const args = process.argv.slice(2);',
        "const outputIndex = args.indexOf('--output-last-message');",
        'const outputPath = args[outputIndex + 1];',
        "const hash = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;",
        "const assessment = { decision: 'FAIL', findings: [{ code: 'provider_negative_control' }], verifiedConditions: { noProductionTestInjection: false, noHardcodedMachineIdentity: false, cleanMaterializationReproducible: false }, verificationRuns: [{ command: 'node --version', exitCode: 0, stdoutHash: hash('stdout'), stderrHash: hash('stderr') }], rationale: 'Negative provider control intentionally fails closed.' };",
        "fs.mkdirSync(require('node:path').dirname(outputPath), { recursive: true });",
        "fs.writeFileSync(outputPath, `${JSON.stringify(assessment)}\\n`, 'utf8');",
        "process.stdout.write(`${JSON.stringify({ type: 'turn.completed', status: 'failed_closed' })}\\n`);",
      ].join('\n');
      mkdirSync(path.dirname(javascriptEntry), { recursive: true });
      writeFileSync(javascriptEntry, transportSource, 'utf8');
      writeFileSync(
        path.join(binRoot, 'codex.cmd'),
        `@echo off\r\n"${process.execPath}" "%~dp0node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n`,
        'utf8'
      );
      const unixExecutable = path.join(binRoot, 'codex');
      writeFileSync(unixExecutable, `#!/usr/bin/env node\n${transportSource}`, 'utf8');
      chmodSync(unixExecutable, 0o755);
      const fixturePath = [binRoot, originalPath ?? originalPathAlias]
        .filter(Boolean)
        .join(path.delimiter);
      process.env.PATH = fixturePath;
      if (process.platform === 'win32') process.env.Path = fixturePath;

      const result = await requirementsContractGapClosureReadonlyAuditorAdapterCommand({
        projectRoot: root,
        request: requestPath,
        json: false,
      });
      const providerInvocation = result.providerInvocation as Record<string, unknown>;

      expect(result.decision).toBe('FAIL');
      expect(providerInvocation.eventCount).toBe(1);
      expect(providerInvocation.eventLogPath).toBe(providerInvocation.stdoutPath);
      expect(providerInvocation.eventLogHash).toBe(providerInvocation.stdoutHash);
      expect(readFileSync(String(providerInvocation.eventLogPath), 'utf8')).toContain(
        'turn.completed'
      );
    } finally {
      if (originalPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = originalPath;
      }
      if (process.platform === 'win32') {
        if (originalPathAlias === undefined) {
          delete process.env.Path;
        } else {
          process.env.Path = originalPathAlias;
        }
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
});
