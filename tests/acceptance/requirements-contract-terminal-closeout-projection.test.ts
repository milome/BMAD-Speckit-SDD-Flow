import { rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  projectRequirementsContractTerminalCloseout,
  renderRequirementsContractTerminalCloseout,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-terminal-closeout';
import { createTerminalCloseoutFixture } from './helpers/requirements-contract-terminal-closeout-fixture';

describe('requirements contract terminal closeout projection', () => {
  it('projects only the validated packet plus readback-owned path and hash facts', () => {
    const fixture = createTerminalCloseoutFixture();
    try {
      const rendered = renderRequirementsContractTerminalCloseout({
        cwd: fixture.root,
        contract: fixture.contractPath,
        bundle: fixture.bundlePath,
        terminalReceipt: fixture.terminalReceiptPath,
        packet: fixture.packetPath,
        readbackReceipt: fixture.readbackReceiptPath,
      });
      const projection = projectRequirementsContractTerminalCloseout({
        cwd: fixture.root,
        packet: fixture.packetPath,
        readbackReceipt: fixture.readbackReceiptPath,
      });

      expect(projection).toEqual({
        ...rendered.packet,
        terminalCloseoutPacketPath: fixture.packetPath,
        terminalCloseoutPacketHash: rendered.readbackReceipt.artifactHash,
        terminalCloseoutReadbackReceiptPath: fixture.readbackReceiptPath,
        terminalCloseoutReadbackReceiptHash: projection.terminalCloseoutReadbackReceiptHash,
      });
      expect(projection.terminalCloseoutReadbackReceiptHash).toMatch(
        /^sha256:[a-f0-9]{64}$/u
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
