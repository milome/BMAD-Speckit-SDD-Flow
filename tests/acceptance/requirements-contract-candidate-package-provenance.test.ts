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
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { requirementsContractCandidatePackageCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-candidate-package';
import { createRuntimeBuildAuthorityReceipt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-build-authority';

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
          files: ['dist', '_bmad', 'bin'],
        })}\n`
      );
      write(root, 'packages/bmad-speckit/dist/index.js', 'module.exports = 1;\n');
      write(root, 'packages/bmad-speckit/bin/bmad-speckit.js', 'module.exports = 1;\n');
      write(root, 'packages/bmad-speckit/_bmad/runtime/owner.txt', 'package owner\n');
      write(
        root,
        'packages/bmad-speckit/scripts/build-main-agent-dist.cjs',
        'module.exports = {};\n'
      );
      write(root, 'package-lock.json', '{"lockfileVersion":3}\n');
      const runtimeAssetManifestPath = path.join(
        root,
        'packages/bmad-speckit/dist/main-agent/runtime-asset-manifest.json'
      );
      write(
        root,
        'packages/bmad-speckit/dist/main-agent/runtime-asset-manifest.json',
        `${JSON.stringify({
          schemaVersion: 'bmad-speckit-main-agent-runtime-assets/v2',
          hashDomainRegistry: {
            schemaVersion: 'requirements-contract-hash-domains/v2',
          },
          entries: [],
        })}\n`
      );
      const buildAuthority = createRuntimeBuildAuthorityReceipt({
        packageRoot: path.join(root, 'packages/bmad-speckit'),
        runtimeAssetManifestPath,
        buildScriptPath: path.join(
          root,
          'packages/bmad-speckit/scripts/build-main-agent-dist.cjs'
        ),
        dependencyLockPath: path.join(root, 'package-lock.json'),
      });
      write(
        root,
        'packages/bmad-speckit/dist/main-agent/runtime-build-authority-receipt.json',
        `${JSON.stringify(buildAuthority)}\n`
      );
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

      expect(result.schemaVersion).toBe('requirements-contract-candidate-package-receipt/v2');
      expect(result.packArgv).toEqual([
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        'pack',
        '--json',
        '--ignore-scripts',
      ]);
      const receiptSchema = JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-candidate-package-receipt.schema.json'
          ),
          'utf8'
        )
      );
      const validateReceipt = new Ajv2020({ allErrors: true, strict: false }).compile(
        receiptSchema
      );
      expect(validateReceipt(result), JSON.stringify(validateReceipt.errors)).toBe(true);
      expect(
        validateReceipt({
          ...result,
          packArgv: [process.platform === 'win32' ? 'npm.cmd' : 'npm', 'pack'],
        })
      ).toBe(false);
      expect(result.nodeVersion).toBe('v22.22.1');
      expect(result.npmVersion).toBe('10.9.4');
      expect(result.originalTarballRef.hash).toBe(result.canonicalTarballRef.hash);
      expect(result.phaseIdentity).toMatchObject({
        transactionId,
        implementationAttemptId,
        phase: 'architecture',
        phaseAuditAttemptId,
      });
      expect(result.packedEntries).toEqual(expect.arrayContaining([
        'package/dist/index.js',
        'package/dist/main-agent/runtime-asset-manifest.json',
        'package/dist/main-agent/runtime-build-authority-receipt.json',
        'package/_bmad/runtime/owner.txt',
      ]));
      expect(result.packedEntries).not.toContain('package/src/index.js');
      expect(result.forbiddenPackedSourceSnapshotCount).toBe(0);
      expect(result.buildAuthorityReceiptRef.hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(result.distBuildHash).toBe(buildAuthority.distBuildHash);
      expect(result.tarballBytesHash).toBe(result.publicationHash);
      expect(result.packedRuntimeHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(result.packedRuntimeHash).toBe(buildAuthority.packageRuntimeHash);
      expect(result.packedRuntimeFileCount).toBeGreaterThan(0);
      expect(existsSync(tarball)).toBe(true);
      expect(JSON.parse(readFileSync(receipt, 'utf8')).decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
