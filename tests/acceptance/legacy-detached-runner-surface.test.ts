import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listUnexpectedLegacyConsumerHookFiles } from '../../packages/bmad-speckit/src/services/install-surface-manifest';

describe('legacy detached runner surface', () => {
  it('removes the legacy detached-runner helper from the repo surface', () => {
    expect(listUnexpectedLegacyConsumerHookFiles(path.join(process.cwd(), '_bmad', 'runtime', 'hooks'))).toHaveLength(0);
    expect(listUnexpectedLegacyConsumerHookFiles(path.join(process.cwd(), '.claude', 'hooks'))).toHaveLength(0);
    expect(listUnexpectedLegacyConsumerHookFiles(path.join(process.cwd(), '.cursor', 'hooks'))).toHaveLength(0);
  });
});
