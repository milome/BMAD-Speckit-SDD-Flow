import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderRequirementsContractTerminalCloseout } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-terminal-closeout';
import {
  createTerminalCloseoutFixture,
  sha256,
} from './helpers/requirements-contract-terminal-closeout-fixture';

describe('requirements contract terminal closeout packet', () => {
  it('publishes a packet and readback receipt from immutable upstream evidence', () => {
    const fixture = createTerminalCloseoutFixture();
    try {
      const result = renderRequirementsContractTerminalCloseout({
        cwd: fixture.root,
        contract: fixture.contractPath,
        bundle: fixture.bundlePath,
        terminalReceipt: fixture.terminalReceiptPath,
        packet: fixture.packetPath,
        readbackReceipt: fixture.readbackReceiptPath,
      });

      expect(result.packet).toMatchObject({
        schemaVersion: 'requirements-contract-terminal-closeout-packet/v1',
        identity: {
          transactionId: fixture.bundle.transactionId,
          implementationAttemptId: fixture.bundle.implementationAttemptId,
          architectureAuditAttemptId: fixture.bundle.architectureAuditAttemptId,
          preCandidateAuditAttemptId: fixture.bundle.preCandidateAuditAttemptId,
          finalAuditAttemptId: fixture.bundle.finalAuditAttemptId,
        },
        coverage: fixture.bundle.coverage,
        criticalMetrics: fixture.bundle.criticalMetrics,
        lifecycleDecisions: fixture.bundle.lifecycleDecisions,
        residualRisks: [],
      });
      expect(result.packet).not.toHaveProperty('packetHash');
      expect(result.packet).not.toHaveProperty('readbackReceiptHash');
      expect(JSON.stringify(result.packet)).not.toContain(fixture.readbackReceiptPath);
      expect(result.readbackReceipt).toMatchObject({
        schemaVersion: 'requirements-contract-artifact-readback-receipt/v1',
        artifactPath: fixture.packetPath,
        artifactHash: result.readbackReceipt.observedReadbackHash,
        terminalCommandReceipt: {
          path: fixture.terminalReceiptRef.path,
          hash: fixture.terminalReceiptRef.hash,
        },
        decision: 'pass',
      });
      expect(
        sha256(readFileSync(path.join(fixture.root, fixture.packetPath)))
      ).toBe(result.readbackReceipt.artifactHash);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a terminal receipt changed after its immutable binding was selected', () => {
    const fixture = createTerminalCloseoutFixture();
    try {
      writeFileSync(
        path.join(fixture.root, fixture.terminalReceiptPath),
        `${JSON.stringify({ ...fixture.terminalReceipt, result: 'BLOCK' })}\n`,
        'utf8'
      );
      expect(() =>
        renderRequirementsContractTerminalCloseout({
          cwd: fixture.root,
          contract: fixture.contractPath,
          bundle: fixture.bundlePath,
          terminalReceipt: fixture.terminalReceiptPath,
          expectedTerminalReceiptHash: fixture.terminalReceiptRef.hash,
          packet: fixture.packetPath,
          readbackReceipt: fixture.readbackReceiptPath,
        })
      ).toThrow('terminal_closeout_terminal_receipt_hash_mismatch');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
