import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const BIN = resolve(process.cwd(), 'packages/bmad-speckit/bin/bmad-speckit.js');

function runCli(args: string[]) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 15000,
  });
}

describe('sft dataset cli regression', () => {
  it('exposes sft-preview, sft-validate, sft-bundle, and keeps sft-extract target compatibility option', () => {
    const preview = runCli(['sft-preview', '--help']);
    const validate = runCli(['sft-validate', '--help']);
    const bundle = runCli(['sft-bundle', '--help']);
    const extract = runCli(['sft-extract', '--help']);

    expect(preview.status).toBe(0);
    expect((preview.stdout || '') + (preview.stderr || '')).toContain('sft-preview');

    expect(validate.status).toBe(0);
    expect((validate.stdout || '') + (validate.stderr || '')).toContain('sft-validate');

    expect(bundle.status).toBe(0);
    expect((bundle.stdout || '') + (bundle.stderr || '')).toContain('sft-bundle');

    expect(extract.status).toBe(0);
    expect((extract.stdout || '') + (extract.stderr || '')).toContain('--target');
    expect((extract.stdout || '') + (extract.stderr || '')).toContain('legacy_instruction_io');
  });
});
