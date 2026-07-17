import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runRequirementsContractRealConsumerAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-real-consumer-adapter';
import { requirementsContractRealConsumerJourneyCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-real-consumer-journey';

function write(root: string, relativePath: string, value = 'module.exports = {};\n') {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

describe('requirements contract real Consumer journey', () => {
  it('observes ten fixed installed boundaries through typed phase-bound records', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-real-consumer-adapter-'));
    const consumerRoot = path.join(root, 'consumer');
    const installedRoot = path.join(consumerRoot, 'node_modules/bmad-speckit');
    const phaseAuditAttemptId = `AUDIT-${randomUUID()}`;
    try {
      write(installedRoot, 'package.json', '{"name":"bmad-speckit","version":"0.0.0-test"}\n');
      for (const relativePath of [
        'bin/bmad-speckit.js',
        'dist/main-agent/index.js',
        'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-journey.js',
        '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json',
        'dist/main-agent/source-authority/scripts/requirements-contract-stage-registry.js',
        'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-adapter.js',
        'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-boundary-observer.js',
        'dist/main-agent/source-authority/scripts/requirements-contract-evidence-verify.js',
        'dist/main-agent/source-authority/scripts/requirements-contract-terminal-command-supervisor.js',
      ]) {
        write(installedRoot, relativePath);
      }
      const result = runRequirementsContractRealConsumerAdapter({
        consumerRoot,
        installedPackageRoot: installedRoot,
        phaseRoot: path.join(root, 'phase'),
        transactionId: `TX-${randomUUID()}`,
        implementationAttemptId: `IMP-${randomUUID()}`,
        phaseAuditAttemptId,
      });

      expect(result.stageObservations).toHaveLength(10);
      expect(result.formalBoundaryRefs.facade[0]).toMatchObject({
        canonicalOwnerId: 'requirements-contract-read-facade',
        phaseAuditAttemptId,
      });
      expect(result.workspaceLinkCount).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects alternate Consumer roots before packaging or installation', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-real-consumer-root-'));
    try {
      await expect(
        requirementsContractRealConsumerJourneyCommand({
          cwd: root,
          contract: 'contract.md',
          consumerRoot: path.join(root, 'consumer'),
          restoreCleanBaseline: true,
          phase: 'final',
          phaseRoot: 'audit-phases/TX/IMP/final/AUDIT',
          phaseAuditAttemptId: 'AUDIT',
          packageRoot: 'packages/bmad-speckit',
          packageManifest: 'packages/bmad-speckit/package.json',
          distRoot: 'packages/bmad-speckit/dist',
          candidateTarball: 'audit-phases/TX/IMP/final/AUDIT/candidate-package/package.tgz',
          candidatePackageReceipt:
            'audit-phases/TX/IMP/final/AUDIT/candidate-package/receipt.json',
          journeyEvidence: 'audit-phases/TX/IMP/final/AUDIT/consumer/journey.json',
          preConfirmationSnapshot:
            'audit-phases/TX/IMP/final/AUDIT/consumer/snapshot.json',
          confirmationReceipt:
            'audit-phases/TX/IMP/final/AUDIT/consumer/confirmation.json',
          runAllStages: true,
          json: false,
        })
      ).rejects.toThrow('real_consumer_root_mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
