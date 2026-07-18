import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import {
  fileHash,
  writeGovernedJson,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

it('creates and replaces amendment outputs with verified receipts and replacement backups', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-amendment-safe-write-'));
  try {
    const targetPath = path.join(root, 'amendment-output.json');
    const created = writeGovernedJson(targetPath, {
      schemaVersion: 'requirements-contract-amendment-output/v1',
      revision: 1,
    });

    expect(created.receipt).toMatchObject({
      mode: 'create',
      backupPath: null,
      originalHash: null,
      backupHash: null,
    });
    expect(created.targetRef).toMatchObject({
      hash: fileHash(targetPath),
      readbackHash: fileHash(targetPath),
      readbackVerified: true,
    });
    expect(existsSync(`${targetPath}.safe-write-receipt.json`)).toBe(true);

    const firstHash = fileHash(targetPath);
    const replaced = writeGovernedJson(targetPath, {
      schemaVersion: 'requirements-contract-amendment-output/v1',
      revision: 2,
    });

    expect(replaced.receipt).toMatchObject({
      mode: 'replace',
      originalHash: firstHash,
      finalHash: fileHash(targetPath),
    });
    expect(replaced.receipt.backupPath).not.toBeNull();
    expect(replaced.receipt.backupHash).toBe(firstHash);
    expect(existsSync(replaced.receipt.backupPath as string)).toBe(true);
    expect(fileHash(replaced.receipt.backupPath as string)).toBe(firstHash);
    expect(JSON.parse(readFileSync(targetPath, 'utf8'))).toMatchObject({ revision: 2 });
    expect(replaced.receiptRef).toMatchObject({
      hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      readbackHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      readbackVerified: true,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
