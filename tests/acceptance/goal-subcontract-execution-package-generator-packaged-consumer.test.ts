import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const roots: string[] = [];
const requiredCloseoutFiles = [
  'scripts/close-completed-campaign.js',
  'schemas/campaign-closeout-context.schema.json',
  'schemas/goal-campaign-closure-receipt.schema.json',
];

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function run(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_loglevel: 'error',
    },
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});

describe('goal subcontract closeout packaged consumer surface', () => {
  it('packs current worktree bytes and runs the installed closeout producer help', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-closeout-packaged-consumer-'));
    roots.push(root);
    const packRoot = path.join(root, 'pack');
    const consumerRoot = path.join(root, 'consumer');
    fs.mkdirSync(packRoot);
    fs.mkdirSync(consumerRoot);
    fs.writeFileSync(
      path.join(consumerRoot, 'package.json'),
      JSON.stringify({ name: 'goal-closeout-consumer', version: '1.0.0', private: true }),
      'utf8'
    );

    const packed = JSON.parse(
      run(`npm pack --ignore-scripts --json --pack-destination ${quote(packRoot)}`, REPO_ROOT)
    );
    expect(packed).toHaveLength(1);
    const tarballPath = path.join(packRoot, packed[0].filename);
    expect(fs.existsSync(tarballPath)).toBe(true);

    run(
      `npm install --ignore-scripts --no-audit --no-fund ${quote(tarballPath)}`,
      consumerRoot
    );
    const installedSkillRoot = path.join(
      consumerRoot,
      'node_modules',
      'bmad-speckit-sdd-flow',
      '_bmad',
      'skills',
      'goal-subcontract-execution-package-generator'
    );
    for (const relativePath of requiredCloseoutFiles) {
      expect(fs.existsSync(path.join(installedSkillRoot, relativePath))).toBe(true);
    }

    const producerPath = path.join(
      installedSkillRoot,
      'scripts',
      'close-completed-campaign.js'
    );
    const help = spawnSync(process.execPath, [producerPath, '--help'], {
      cwd: consumerRoot,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    expect(help.status, help.stderr || help.stdout).toBe(0);
    expect(help.stdout).toContain('Usage: close-completed-campaign');
  }, 120_000);
});
