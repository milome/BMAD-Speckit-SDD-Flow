import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractCandidatePackageCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-candidate-package';

function write(root: string, relativePath: string, value: string) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

describe('requirements contract candidate package provenance', () => {
  it('packs the sole package owner and publishes an immutable phase receipt', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-candidate-package-'));
    try {
      const transactionId = `TX-${randomUUID()}`;
      const implementationAttemptId = `IMP-${randomUUID()}`;
      const phaseAuditAttemptId = `AUD-${randomUUID()}`;
      write(
        root,
        'packages/bmad-speckit/package.json',
        `${JSON.stringify({
          name: 'bmad-speckit',
          version: '1.2.3',
          files: ['dist', 'src'],
        })}\n`
      );
      write(root, 'packages/bmad-speckit/src/index.js', 'module.exports = 1;\n');
      write(root, 'packages/bmad-speckit/dist/index.js', 'module.exports = 1;\n');
      const phaseRoot = path.join(
        root,
        'audit-phases',
        transactionId,
        implementationAttemptId,
        'architecture',
        phaseAuditAttemptId
      );
      const tarball = path.join(
        phaseRoot,
        'candidate-package/bmad-speckit-candidate.tgz'
      );
      const receipt = path.join(
        phaseRoot,
        'candidate-package/candidate-package.receipt.json'
      );

      const result = await requirementsContractCandidatePackageCommand({
        cwd: root,
        packageRoot: 'packages/bmad-speckit',
        packageManifest: 'packages/bmad-speckit/package.json',
        distRoot: 'packages/bmad-speckit/dist',
        phase: 'architecture',
        phaseAuditAttemptId,
        tarball,
        receipt,
        json: false,
      });

      expect(result.schemaVersion).toBe('requirements-contract-candidate-package-receipt/v1');
      expect(result.packArgv).toEqual(['npm.cmd', 'pack', '--json', '--ignore-scripts']);
      expect(result.nodeVersion).toBe('v22.22.1');
      expect(result.npmVersion).toBe('10.9.4');
      expect(result.originalTarballRef.hash).toBe(result.canonicalTarballRef.hash);
      expect(result.phaseIdentity).toMatchObject({
        transactionId,
        implementationAttemptId,
        phase: 'architecture',
        phaseAuditAttemptId,
      });
      expect(result.packedEntries).toEqual(
        expect.arrayContaining(['package/dist/index.js', 'package/src/index.js'])
      );
      expect(existsSync(tarball)).toBe(true);
      expect(JSON.parse(readFileSync(receipt, 'utf8')).decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
